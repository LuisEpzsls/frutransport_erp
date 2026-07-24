const { z } = require('zod');
const { ML_BASE_URL, ML_INTERNAL_SECRET } = require('../config/ml');

// Validación de entrada: valores absurdos no llegan ni al modelo ni a la BD.
// gastos_adicionales modela la estructura variable de costos reales
// (supervisión, fletes de camiones, jabas, extracostos…); monto negativo =
// recupero/descuento (p. ej. venta de descarte).
const gastoSchema = z.object({
  concepto: z.string().min(1).max(120),
  monto: z.coerce.number().refine((v) => v !== 0, 'monto no puede ser 0'),
  moneda: z.enum(['PEN', 'USD']).default('PEN'),
});

// Las 13 operaciones reales (CONTENEDORES.xlsx) venden en términos FOB
// ("PRECIO FOB CAJA" en cada hoja): el flete marítimo internacional lo asume
// el comprador, nunca Frutransport — por eso no hay un campo dedicado.
// Si alguna venta futura no fuera FOB, el flete se registra como gasto
// adicional. agenciamiento y SLI se cotizan naturalmente en USD; se acepta
// PEN opcionalmente para convertir con el tipo de cambio de la operación.
//
// Materia prima: cajas_contenedor y kg_cosecha_comprados son decisiones de
// negocio INDEPENDIENTES (se elige cuántas cajas lleva el contenedor y,
// por separado, se negocia cuánta cosecha completa comprar y a qué precio
// por kg) — el costo de MP se calcula directo sobre lo comprado, no se
// deriva de las cajas. El % de descarte estimado por el modelo ML se usa
// solo de forma informativa (cuántas cajas rendiría esa cosecha).
const predictSchema = z.object({
  producto: z.string().min(1),
  destino: z.string().min(1),
  precio_mp_kg: z.coerce.number().positive(),
  peso_neto_caja: z.coerce.number().positive(),
  cajas_contenedor: z.coerce.number().int().positive(),
  kg_cosecha_comprados: z.coerce.number().positive(),
  costo_maquila: z.coerce.number().positive(),
  tipo_cambio: z.coerce.number().min(3).max(5),
  costo_agenciamiento: z.coerce.number().positive(),
  costo_agenciamiento_moneda: z.enum(['PEN', 'USD']).default('USD'),
  costo_sli: z.coerce.number().positive(),
  costo_sli_moneda: z.enum(['PEN', 'USD']).default('USD'),
  // Recupero por venta del descarte: monto POSITIVO (se resta del costo
  // total) — campo dedicado en vez de un gasto adicional genérico, porque es
  // estructural en toda operación real (todo contenedor tiene descarte).
  recupero_descarte: z.coerce.number().min(0).optional(),
  recupero_descarte_moneda: z.enum(['PEN', 'USD']).default('USD'),
  // % de utilidad que el cotizador elige sobre el subtotal de costos
  // (todo incluido) para llegar al precio de venta / FOB por caja.
  utilidad_pct: z.coerce.number().min(0).max(1),
  mes: z.coerce.number().int().min(1).max(12).optional(),
  gastos_adicionales: z.array(gastoSchema).max(40).optional(),
});

/**
 * POST /api/ml/predict
 */
const predict = async (req, res) => {
  const parsed = predictSchema.safeParse(req.body);
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return res.status(400).json({ error: `Campos faltantes o inválidos: ${detalle}` });
  }
  const payload = parsed.data;

  const mes = payload.mes || (new Date().getMonth() + 1);

  try {
    // 3. ENVIAR SÓLO LAS FEATURES NECESARIAS AL MOTOR ML
    const mlPayload = {
      producto: payload.producto,
      destino: payload.destino,
      precio_mp_kg: parseFloat(payload.precio_mp_kg),
      mes: parseInt(mes, 10)
    };

    const mlResponse = await fetch(`${ML_BASE_URL}/predict`, {
      method:  'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Internal-Key': ML_INTERNAL_SECRET
      },
      body:    JSON.stringify(mlPayload),
    });

    if (!mlResponse.ok) {
      const errorBody = await mlResponse.json().catch(() => ({ detail: mlResponse.statusText }));
      return res.status(mlResponse.status).json({
        error:   'El motor ML rechazó la petición',
        detalle: errorBody.detail || errorBody,
      });
    }

    const prediction = await mlResponse.json();
    const porcentaje_descarte_estimado = prediction.porcentaje_descarte;

    // 2. PROTECCIÓN CONTRA RIESGO EXTREMO
    if (porcentaje_descarte_estimado >= 0.60) {
      return res.status(400).json({
        error: `La proyección de descarte de la IA es demasiado alta (${(porcentaje_descarte_estimado * 100).toFixed(1)}%) para viabilizar la operación matemáticamente.`
      });
    }

    // LÓGICA DETERMINÍSTICA (CONTABILIDAD)
    const tipo_cambio = parseFloat(payload.tipo_cambio);
    const precio_mp_kg = parseFloat(payload.precio_mp_kg);
    const cajas_contenedor = parseInt(payload.cajas_contenedor, 10);
    const peso_neto_caja = parseFloat(payload.peso_neto_caja);
    const kg_cosecha_comprados = parseFloat(payload.kg_cosecha_comprados);
    const costo_maquila = parseFloat(payload.costo_maquila);
    const costo_agenciamiento = parseFloat(payload.costo_agenciamiento);
    const costo_sli = parseFloat(payload.costo_sli);
    const utilidad_pct = parseFloat(payload.utilidad_pct);

    // Costo Materia Prima = directo sobre lo negociado (kg de la cosecha
    // comprada × precio por kg) — no se deriva de las cajas del contenedor.
    const costo_mp_usd = (kg_cosecha_comprados * precio_mp_kg) / tipo_cambio;

    // Informativo (no afecta el costo): cuántas cajas rendiría esta cosecha
    // según el % de descarte estimado, para comparar contra las cajas elegidas.
    const kg_netos_esperados = kg_cosecha_comprados * (1 - porcentaje_descarte_estimado);
    const cajas_posibles_estimadas = Math.floor(kg_netos_esperados / peso_neto_caja);

    // Costo Maquila = cajas_contenedor * costo_maquila / tipo_cambio
    const costo_maquila_usd = (cajas_contenedor * costo_maquila) / tipo_cambio;

    // Costos fijos: naturalmente en USD; PEN es la opción, se convierte con el TC
    const agenciamiento_usd = payload.costo_agenciamiento_moneda === 'PEN'
      ? costo_agenciamiento / tipo_cambio
      : costo_agenciamiento;
    const sli_usd = payload.costo_sli_moneda === 'PEN'
      ? costo_sli / tipo_cambio
      : costo_sli;
    const costos_fijos_usd = agenciamiento_usd + sli_usd;

    // Gastos adicionales (estructura variable de la operación) → todo a USD
    const gastos = payload.gastos_adicionales ?? [];
    const gastosUsd = gastos.map(g => ({
      concepto: g.concepto,
      moneda: g.moneda,
      monto: g.monto,
      monto_usd: Math.round((g.moneda === 'USD' ? g.monto : g.monto / tipo_cambio) * 100) / 100,
    }));
    const gastos_adicionales_usd = gastosUsd.reduce((s, g) => s + g.monto_usd, 0);

    // Recupero por venta de descarte: monto positivo que se RESTA del costo.
    const recupero_descarte = payload.recupero_descarte ?? 0;
    const recupero_descarte_usd = payload.recupero_descarte_moneda === 'PEN'
      ? recupero_descarte / tipo_cambio
      : recupero_descarte;

    // Subtotal de costos (todo incluido) → + utilidad → precio de venta / FOB por caja
    const subtotal_costos =
      costo_mp_usd + costo_maquila_usd + costos_fijos_usd + gastos_adicionales_usd - recupero_descarte_usd;
    const utilidad_usd = subtotal_costos * utilidad_pct;
    const precio_venta_total = subtotal_costos + utilidad_usd;
    const precio_fob_caja = precio_venta_total / cajas_contenedor;

    // 4. RESPUESTA AL CLIENTE JSON ESTRUCTURADO (estimacion_pre_compra)
    res.json({
      ok: true,
      estimacion_pre_compra: {
        costo_total_estimado: Math.round(subtotal_costos * 100) / 100,
        desglose: {
          materia_prima: Math.round(costo_mp_usd * 100) / 100,
          maquila: Math.round(costo_maquila_usd * 100) / 100,
          agenciamiento: Math.round(agenciamiento_usd * 100) / 100,
          sli: Math.round(sli_usd * 100) / 100,
          costos_fijos_total: Math.round(costos_fijos_usd * 100) / 100,
          gastos_adicionales_total: Math.round(gastos_adicionales_usd * 100) / 100,
          ...(recupero_descarte > 0 ? { recupero_descarte: -Math.round(recupero_descarte_usd * 100) / 100 } : {}),
        },
        gastos_adicionales: gastosUsd,
        utilidad_usd: Math.round(utilidad_usd * 100) / 100,
        precio_venta_total: Math.round(precio_venta_total * 100) / 100,
        precio_fob_caja: Math.round(precio_fob_caja * 100) / 100,
        cajas_posibles_estimadas,
        kg_netos_esperados: Math.round(kg_netos_esperados * 100) / 100
      },
      metadatos_ml: {
        porcentaje_descarte_estimado: porcentaje_descarte_estimado,
        mae: prediction.mae,
        r2: prediction.r2,
        modelo: prediction.modelo_nombre
      },
      // Payload listo para POST/PATCH /api/cotizaciones — el frontend guarda sin recalcular
      cotizacion_sugerida: {
        producto: payload.producto,
        variedad: payload.variedad ?? null,
        destino: payload.destino,
        volumenTon: Math.round(((cajas_contenedor * peso_neto_caja) / 1000) * 1000) / 1000,
        tipoCargamento: payload.tipo_cargamento || 'CONTENEDOR',
        pesoNetoCaja: peso_neto_caja,
        precioMpKg: precio_mp_kg,
        cajasContenedor: cajas_contenedor,
        kgCosechaComprados: kg_cosecha_comprados,
        costoMaquila: costo_maquila,
        costoAgenciamiento: costo_agenciamiento,
        costoAgenciamientoMoneda: payload.costo_agenciamiento_moneda,
        costoSli: costo_sli,
        costoSliMoneda: payload.costo_sli_moneda,
        recuperoDescarte: payload.recupero_descarte ?? null,
        recuperoDescarteMoneda: payload.recupero_descarte_moneda,
        tipoCambio: tipo_cambio,
        mes: mes,
        utilidadPct: utilidad_pct,
        porcentajeDescarteEstimado: porcentaje_descarte_estimado,
        costoTotalEstimado: Math.round(subtotal_costos * 100) / 100,
        precioVentaEstimado: Math.round(precio_venta_total * 100) / 100,
        precioFobCajaEstimado: Math.round(precio_fob_caja * 100) / 100,
        gastos: gastos.map(g => ({ concepto: g.concepto, monto: g.monto, moneda: g.moneda }))
      },
      solicitante: req.user ? req.user.email : 'desconocido'
    });

  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Motor ML no disponible. ¿Está corriendo uvicorn en el puerto 8000?',
      });
    }
    res.status(500).json({ error: err.message });
  }
};

const healthCheck = async (_req, res) => {
  try {
    const mlResponse = await fetch(`${ML_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'X-Internal-Key': ML_INTERNAL_SECRET }
    });
    const body = await mlResponse.json();
    res.json({ mlEngine: 'ok', ...body });
  } catch {
    res.status(503).json({ mlEngine: 'down', error: 'Motor ML no disponible' });
  }
};

// Categorías de producto/destino con las que el modelo fue entrenado — para
// que el catálogo del ERP marque qué entradas aún no son predecibles.
const categorias = async (_req, res) => {
  try {
    const mlResponse = await fetch(`${ML_BASE_URL}/categorias`, {
      method: 'GET',
      headers: { 'X-Internal-Key': ML_INTERNAL_SECRET },
    });
    if (!mlResponse.ok) {
      return res.status(mlResponse.status).json({ error: 'El motor ML no pudo devolver las categorías' });
    }
    res.json(await mlResponse.json());
  } catch {
    res.status(503).json({ error: 'Motor ML no disponible' });
  }
};

module.exports = { predict, healthCheck, categorias };

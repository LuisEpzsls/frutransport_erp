const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { departamentosDeUsuario, tieneAccesoDepartamento } = require('../services/accesoDepartamento');
const { notificarCotizacionCreada, notificarCotizacionLiquidada } = require('../services/notificaciones');

const prisma = new PrismaClient();

const ESTADOS = ['PENDIENTE', 'APROBADA', 'EN_TRANSITO', 'LIQUIDADA', 'RECHAZADA'];
const monedaEnum = z.enum(['PEN', 'USD']);

// ── Esquemas de validación (zod) ───────────────────────────────────────────
// Gastos adicionales: estructura variable de costos de la operación
// (monto negativo = recupero/descuento, p. ej. venta de descarte).
const gastoSchema = z.object({
  concepto: z.string().min(1).max(120),
  monto: z.coerce.number().refine((v) => v !== 0, 'monto no puede ser 0'),
  moneda: z.enum(['PEN', 'USD']).default('PEN'),
});

// Desglose de la compra de materia prima por lote/camión — informativo, no
// participa de la fórmula de costos (kgCosechaComprados ya es la fuente de
// verdad); el cotizador avisa si la suma no coincide.
const loteMateriaPrimaSchema = z.object({
  etiqueta: z.string().min(1).max(120),
  kg: z.coerce.number().positive(),
});

// Desglose de la venta del descarte por lote (kg × precio por kg) — el monto
// se calcula solo y se suma al campo dedicado recuperoDescarte, en vez de
// pedirle al cotizador que sume el total a mano.
const loteDescarteVendidoSchema = z.object({
  kg: z.coerce.number().positive(),
  precioKg: z.coerce.number().positive(),
  moneda: z.enum(['PEN', 'USD']).default('PEN'),
});

// Un "borrador" es simplemente una cotización PENDIENTE que se autoguarda
// desde el cotizador apenas se toca el formulario — la mayoría de campos son
// opcionales porque al principio puede no haber datos todavía (solo
// producto/destino/departamentoId, que siempre tienen valor desde el primer
// render del formulario).
const borradorSchema = z.object({
  producto: z.string().min(1),
  variedad: z.string().nullish(),
  destino: z.string().min(1),
  volumenTon: z.coerce.number().positive().nullish(),
  tipoCargamento: z.string().min(1).nullish(),
  pesoNetoCaja: z.coerce.number().positive().nullish(),
  precioMpKg: z.coerce.number().positive().nullish(),
  // Materia prima: cajas del contenedor y kg de cosecha comprados son
  // decisiones de negocio independientes (ver mlController).
  cajasContenedor: z.coerce.number().int().positive().nullish(),
  kgCosechaComprados: z.coerce.number().positive().nullish(),
  costoMaquila: z.coerce.number().positive().nullish(),
  costoAgenciamiento: z.coerce.number().positive().nullish(),
  costoAgenciamientoMoneda: monedaEnum.nullish(),
  costoSli: z.coerce.number().positive().nullish(),
  costoSliMoneda: monedaEnum.nullish(),
  // Recupero por venta del descarte: monto POSITIVO recuperado (se resta del
  // costo total en la fórmula) — campo dedicado, ver mlController.
  recuperoDescarte: z.coerce.number().min(0).nullish(),
  recuperoDescarteMoneda: monedaEnum.nullish(),
  tipoCambio: z.coerce.number().positive().nullish(),
  mes: z.coerce.number().int().min(1).max(12).nullish(),
  // % de utilidad elegido sobre el subtotal de costos → precio de venta/FOB.
  utilidadPct: z.coerce.number().min(0).max(1).nullish(),
  porcentajeDescarteEstimado: z.coerce.number().min(0).max(1).nullish(),
  costoTotalEstimado: z.coerce.number().positive().nullish(),
  precioVentaEstimado: z.coerce.number().positive().nullish(),
  precioFobCajaEstimado: z.coerce.number().positive().nullish(),
  notas: z.string().nullish(),
  gastos: z.array(gastoSchema).max(40).optional(),
  lotesMateriaPrima: z.array(loteMateriaPrimaSchema).max(20).optional(),
  lotesDescarteVendido: z.array(loteDescarteVendidoSchema).max(20).optional(),
  departamentoId: z.coerce.number().int().positive(),
  clienteId: z.string().uuid().nullish(),
  // Trazabilidad de logística (reemplaza el registro manual en CONTENEDORES.xlsx).
  numeroBooking: z.string().max(60).nullish(),
  fechaCosechaInicio: z.coerce.date().nullish(),
  fechaCosechaFin: z.coerce.date().nullish(),
  fechaProcesamiento: z.coerce.date().nullish(),
  fechaLlenadoDespacho: z.coerce.date().nullish(),
  numeroContenedorLogistica: z.string().max(60).nullish(),
});

// PATCH: el rubro no se reasigna una vez creada la cotización; el resto de
// campos son parciales (autoguardado envía lo que tenga en cada momento).
const editarSchema = borradorSchema.omit({ departamentoId: true }).partial();

// Venta pactada en la orden de compra — se conoce (si acaso) al aprobar,
// antes de que exista una factura real.
const aprobarSchema = z.object({
  valorVentaOc: z.coerce.number().positive().nullish(),
  valorVentaOcMoneda: monedaEnum.nullish(),
});

const liquidarSchema = z.object({
  porcentajeDescarteReal: z.coerce.number().min(0).max(1),
  costoTotalReal: z.coerce.number().positive(),
  utilidadRealPct: z.coerce.number().min(0).max(1),
  // Venta REAL facturada — puede ser menor al objetivo (costo + utilidad);
  // es la única forma de saber si el contenedor ganó o perdió dinero de verdad.
  valorVentaFactura: z.coerce.number().positive().nullish(),
  valorVentaFacturaMoneda: monedaEnum.nullish(),
});

const formatearErrores = (zodError) =>
  zodError.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');

// Línea base de gastos habituales (conocimiento de negocio extraído de
// CONTENEDORES.xlsx, misma lista precargada como plantilla en el cotizador
// del frontend) — punto de partida mientras `gastos_cotizacion` todavía no
// acumula suficientes cotizaciones LIQUIDADA con gastos desglosados para
// calcular una frecuencia real. Los 13 contenedores reales del seed no
// tienen gastos itemizados (solo el costo total agregado), así que el
// histórico real empieza en cero y crece con el uso del propio ERP.
const GASTOS_HABITUALES_LINEA_BASE = [
  'Pago de supervisión + cosecheros',
  'Flete de camiones',
  'Alquiler de jabas',
  'Comisión por fruta',
  'Gestor(a) de calidad',
  'Pruebas de laboratorio',
  'Cartón',
  'Bandejas',
  'Costos fijos administrativos',
];
const MINIMO_MUESTRAS_HISTORICO = 5;
const UMBRAL_FRECUENCIA = 0.6;

/** Mediana de un arreglo numérico (robusta ante outliers, a diferencia de la media). */
const mediana = (valores) => {
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 !== 0
    ? ordenados[mitad]
    : (ordenados[mitad - 1] + ordenados[mitad]) / 2;
};

// Componentes OBLIGATORIOS del costo del contenedor — a diferencia de los
// gastos adicionales (variables, "habituales" pero no siempre presentes),
// estos son parte estructural de la fórmula de costos en todas las
// cotizaciones (materia prima → maquila → agenciamiento → SLI) y deben estar
// completos antes de liquidar, para que ningún componente del costo real
// quede afuera y termine absorbido silenciosamente por la empresa.
const CAMPOS_COSTO_OBLIGATORIOS = [
  { campo: 'kgCosechaComprados', etiqueta: 'kg de cosecha comprados' },
  { campo: 'precioMpKg', etiqueta: 'precio de materia prima' },
  { campo: 'cajasContenedor', etiqueta: 'cajas por contenedor' },
  { campo: 'costoMaquila', etiqueta: 'costo de maquila' },
  { campo: 'costoAgenciamiento', etiqueta: 'costo de agenciamiento' },
  { campo: 'costoSli', etiqueta: 'costo de SLI' },
];

// Mapea los campos "planos" de un borrador validado a columnas de Prisma
// (todo lo que no venga en el body queda en NULL — un borrador nuevo).
const camposEscalares = (b) => ({
  producto: b.producto,
  variedad: b.variedad ?? null,
  destino: b.destino,
  volumenTon: b.volumenTon ?? null,
  tipoCargamento: b.tipoCargamento ?? null,
  pesoNetoCaja: b.pesoNetoCaja ?? null,
  precioMpKg: b.precioMpKg ?? null,
  cajasContenedor: b.cajasContenedor ?? null,
  kgCosechaComprados: b.kgCosechaComprados ?? null,
  costoMaquila: b.costoMaquila ?? null,
  costoAgenciamiento: b.costoAgenciamiento ?? null,
  costoAgenciamientoMoneda: b.costoAgenciamientoMoneda ?? null,
  costoSli: b.costoSli ?? null,
  costoSliMoneda: b.costoSliMoneda ?? null,
  recuperoDescarte: b.recuperoDescarte ?? null,
  recuperoDescarteMoneda: b.recuperoDescarteMoneda ?? null,
  tipoCambio: b.tipoCambio ?? null,
  mes: b.mes ?? null,
  utilidadPct: b.utilidadPct ?? null,
  porcentajeDescarteEstimado: b.porcentajeDescarteEstimado ?? null,
  costoTotalEstimado: b.costoTotalEstimado ?? null,
  precioVentaEstimado: b.precioVentaEstimado ?? null,
  precioFobCajaEstimado: b.precioFobCajaEstimado ?? null,
  notas: b.notas ?? null,
  clienteId: b.clienteId ?? null,
  numeroBooking: b.numeroBooking ?? null,
  fechaCosechaInicio: b.fechaCosechaInicio ?? null,
  fechaCosechaFin: b.fechaCosechaFin ?? null,
  fechaProcesamiento: b.fechaProcesamiento ?? null,
  fechaLlenadoDespacho: b.fechaLlenadoDespacho ?? null,
  numeroContenedorLogistica: b.numeroContenedorLogistica ?? null,
});

// Resultado REAL del contenedor: venta REALMENTE facturada − costo (directo
// y con utilidad) — a diferencia de "estimado vs real" (que solo compara
// proyección de costo contra costo real), esto dice si la operación ganó o
// perdió dinero de verdad. Usa costo/precio real si ya se liquidó, si no el
// estimado (como preview). null si todavía no hay venta facturada.
const conResultado = (c) => {
  const costo = c.costoTotalReal ?? c.costoTotalEstimado;
  const precioConUtilidad = c.precioVentaReal ?? c.precioVentaEstimado;
  return {
    ...c,
    resultadoCostoDirecto: (c.valorVentaFactura != null && costo != null)
      ? Math.round((c.valorVentaFactura - costo) * 100) / 100 : null,
    resultadoConUtilidad: (c.valorVentaFactura != null && precioConUtilidad != null)
      ? Math.round((c.valorVentaFactura - precioConUtilidad) * 100) / 100 : null,
  };
};

// ── GET /api/cotizaciones?page=1&estado=PENDIENTE&departamentoId=1 ─────────
// Sin departamentoId: ADMIN/AUDITOR ven todo, MANAGER ve solo sus rubros
// asignados. Con departamentoId: se exige acceso a ese rubro puntual.
// CLIENTE (portal externo): no se rige por rubros, solo ve sus propias
// cotizaciones asociadas (where.clienteId = self).
const listar = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
    const take = 20;

    const where = {};
    if (req.query.estado) {
      if (!ESTADOS.includes(req.query.estado)) {
        return res.status(400).json({ error: `estado inválido. Valores: ${ESTADOS.join(', ')}` });
      }
      where.estado = req.query.estado;
    }

    if (req.user.role === 'CLIENTE') {
      where.clienteId = req.user.id;
    } else {
      if (req.query.departamentoId) {
        const departamentoId = parseInt(req.query.departamentoId, 10);
        if (Number.isNaN(departamentoId)) {
          return res.status(400).json({ error: 'departamentoId inválido' });
        }
        if (!(await tieneAccesoDepartamento(prisma, req.user, departamentoId))) {
          return res.status(403).json({ error: 'Sin acceso a ese rubro' });
        }
        where.departamentoId = departamentoId;
      } else {
        const misDepartamentos = await departamentosDeUsuario(prisma, req.user);
        if (misDepartamentos) where.departamentoId = { in: misDepartamentos };
      }
      // Filtro opcional por cliente (p. ej. pantalla de Contenedores) — dentro
      // del scoping por rubro ya resuelto arriba, no requiere chequeo aparte.
      if (req.query.clienteId) where.clienteId = req.query.clienteId;
    }

    // ?soloConNumero=true — pantalla de Contenedores: excluye el dataset
    // sintético y cualquier cotización creada antes de la numeración (ambos
    // sin numeroContenedorGeneral asignado).
    if (req.query.soloConNumero === 'true') where.numeroContenedorGeneral = { not: null };

    // ?ordenarPor=contenedor — vista de Contenedores: orden por numeración
    // secuencial en vez de fecha de creación (Historial sigue usando fecha).
    const orderBy = req.query.ordenarPor === 'contenedor'
      ? { numeroContenedorGeneral: 'asc' }
      : { creadoEn: 'desc' };

    const [data, total] = await Promise.all([
      prisma.cotizacion.findMany({
        where,
        take,
        skip: (page - 1) * take,
        orderBy,
        include: {
          usuario: { select: { email: true } },
          cliente: { select: { id: true, nombreCompleto: true, empresa: true } },
          gastos: { select: { concepto: true, monto: true, moneda: true } },
          lotesMateriaPrima: { select: { id: true, etiqueta: true, kg: true } },
          lotesDescarteVendido: { select: { id: true, kg: true, precioKg: true, moneda: true } },
          departamento: { select: { id: true, nombre: true, slug: true } },
        },
      }),
      prisma.cotizacion.count({ where }),
    ]);

    res.json({ data: data.map(conResultado), total, page, pages: Math.ceil(total / take) });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/cotizaciones/gastos-habituales — alerta de gasto faltante ─────
// Analítica basada en datos históricos (NO un modelo de ML entrenado): calcula
// qué % de las cotizaciones LIQUIDADA registraron cada concepto de gasto, y
// devuelve los que superan el umbral — el cotizador los cruza contra el
// borrador actual para avisar si falta uno que casi siempre se registra
// (busca evitar que un gasto real termine absorbido por la empresa por
// simple olvido, sin una segunda revisión).
//
// Además calcula, por concepto, mediana + MAD (Median Absolute Deviation)
// del monto en USD — detección de anomalías en el monto: si el cotizador
// registra un importe muy alejado de lo habitual para ese concepto (mismo
// tipo de olvido/error, pero en la magnitud del gasto en vez de su
// presencia), el frontend puede avisarlo con un z-score modificado
// (Iglewicz & Hoaglin), robusto ante muestras chicas y ante los propios
// outliers que se busca detectar (a diferencia de media/desviación estándar).
const gastosHabituales = async (_req, res, next) => {
  try {
    const totalLiquidadasConGastos = await prisma.cotizacion.count({
      where: { estado: 'LIQUIDADA', gastos: { some: {} } },
    });

    if (totalLiquidadasConGastos < MINIMO_MUESTRAS_HISTORICO) {
      return res.json({
        origen: 'linea_base',
        total: totalLiquidadasConGastos,
        gastos: GASTOS_HABITUALES_LINEA_BASE.map((concepto) => ({ concepto, frecuencia: null })),
        estadisticasMonto: {},
      });
    }

    const filas = await prisma.gastoCotizacion.findMany({
      where: { cotizacion: { estado: 'LIQUIDADA' } },
      select: { concepto: true, monto: true, moneda: true, cotizacion: { select: { tipoCambio: true } } },
    });

    const montosPorConcepto = new Map();
    for (const fila of filas) {
      if (fila.moneda === 'PEN' && !fila.cotizacion.tipoCambio) continue; // sin TC no se puede convertir de forma confiable
      const montoUsd = fila.moneda === 'USD' ? fila.monto : fila.monto / fila.cotizacion.tipoCambio;
      if (!montosPorConcepto.has(fila.concepto)) montosPorConcepto.set(fila.concepto, []);
      montosPorConcepto.get(fila.concepto).push(montoUsd);
    }

    const gastos = [...montosPorConcepto.entries()]
      .map(([concepto, montos]) => ({
        concepto,
        frecuencia: Math.round((montos.length / totalLiquidadasConGastos) * 100) / 100,
        vecesUsado: montos.length,
      }))
      .filter((g) => g.frecuencia >= UMBRAL_FRECUENCIA)
      .sort((a, b) => b.frecuencia - a.frecuencia);

    const estadisticasMonto = {};
    for (const [concepto, montos] of montosPorConcepto.entries()) {
      if (montos.length < MINIMO_MUESTRAS_HISTORICO) continue;
      const medianaUsd = mediana(montos);
      const madUsd = mediana(montos.map((m) => Math.abs(m - medianaUsd)));
      estadisticasMonto[concepto] = { medianaUsd, madUsd, n: montos.length };
    }

    res.json({ origen: 'historico', total: totalLiquidadasConGastos, gastos, estadisticasMonto });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/cotizaciones/:id — para resumir un borrador o ver el detalle ──
const obtener = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'id inválido' });
    }

    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id },
      include: {
        usuario: { select: { email: true } },
        gastos: { select: { concepto: true, monto: true, moneda: true } },
        lotesMateriaPrima: { select: { id: true, etiqueta: true, kg: true } },
        lotesDescarteVendido: { select: { id: true, kg: true, precioKg: true, moneda: true } },
        departamento: { select: { id: true, nombre: true, slug: true } },
      },
    });
    if (!cotizacion) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    if (req.user.role === 'CLIENTE') {
      if (cotizacion.clienteId !== req.user.id) {
        return res.status(404).json({ error: 'Cotización no encontrada' });
      }
    } else if (!(await tieneAccesoDepartamento(prisma, req.user, cotizacion.departamentoId))) {
      return res.status(403).json({ error: 'Sin acceso a ese rubro' });
    }

    res.json({ data: conResultado(cotizacion) });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/cotizaciones — crea un borrador PENDIENTE (autoguardado) ─────
// La primera llamada del cotizador (apenas se toca el formulario) cae acá;
// llamadas siguientes van por PATCH /:id.
const crear = async (req, res, next) => {
  try {
    const parsed = borradorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: formatearErrores(parsed.error) });
    }
    const b = parsed.data;

    if (!(await tieneAccesoDepartamento(prisma, req.user, b.departamentoId))) {
      return res.status(403).json({ error: 'Sin acceso a ese rubro' });
    }

    // La numeración de contenedor (numeroContenedorGeneral/Cliente) NO se
    // asigna acá — un borrador recién creado todavía puede quedar abandonado
    // a medio llenar. Se asigna al aprobar (ver `aprobar`), que es el momento
    // en que la cotización deja de ser solo una estimación y se vuelve un
    // contenedor real a trackear.
    const cotizacion = await prisma.cotizacion.create({
      data: {
        ...camposEscalares(b),
        estado: 'PENDIENTE',
        usuarioId: req.user.id,
        departamentoId: b.departamentoId,
        ...(b.gastos?.length
          ? { gastos: { create: b.gastos.map((g) => ({ concepto: g.concepto, monto: g.monto, moneda: g.moneda })) } }
          : {}),
        ...(b.lotesMateriaPrima?.length
          ? { lotesMateriaPrima: { create: b.lotesMateriaPrima.map((l) => ({ etiqueta: l.etiqueta, kg: l.kg })) } }
          : {}),
        ...(b.lotesDescarteVendido?.length
          ? { lotesDescarteVendido: { create: b.lotesDescarteVendido.map((l) => ({ kg: l.kg, precioKg: l.precioKg, moneda: l.moneda })) } }
          : {}),
      },
      include: {
        gastos: { select: { concepto: true, monto: true, moneda: true } },
        lotesMateriaPrima: { select: { id: true, etiqueta: true, kg: true } },
        lotesDescarteVendido: { select: { id: true, kg: true, precioKg: true, moneda: true } },
      },
    });

    await notificarCotizacionCreada(prisma, cotizacion, req.user.id);

    res.status(201).json({ ok: true, data: cotizacion });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/cotizaciones/:id — autoguardado de un borrador PENDIENTE ────
const editar = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'id inválido' });
    }

    const parsed = editarSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: formatearErrores(parsed.error) });
    }
    const { gastos, lotesMateriaPrima, lotesDescarteVendido, ...resto } = parsed.data;

    const existente = await prisma.cotizacion.findUnique({ where: { id } });
    if (!existente) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }
    if (existente.estado !== 'PENDIENTE') {
      return res.status(409).json({ error: 'Solo se puede editar una cotización PENDIENTE' });
    }
    if (!(await tieneAccesoDepartamento(prisma, req.user, existente.departamentoId))) {
      return res.status(403).json({ error: 'Sin acceso a ese rubro' });
    }

    const dataEscalar = {};
    for (const [k, v] of Object.entries(resto)) {
      dataEscalar[k] = v ?? null;
    }

    const cotizacion = await prisma.$transaction(async (tx) => {
      if (gastos !== undefined) {
        await tx.gastoCotizacion.deleteMany({ where: { cotizacionId: id } });
      }
      if (lotesMateriaPrima !== undefined) {
        await tx.loteMateriaPrima.deleteMany({ where: { cotizacionId: id } });
      }
      if (lotesDescarteVendido !== undefined) {
        await tx.loteDescarteVendido.deleteMany({ where: { cotizacionId: id } });
      }
      return tx.cotizacion.update({
        where: { id },
        data: {
          ...dataEscalar,
          ...(gastos !== undefined
            ? { gastos: { create: gastos.map((g) => ({ concepto: g.concepto, monto: g.monto, moneda: g.moneda })) } }
            : {}),
          ...(lotesMateriaPrima !== undefined
            ? { lotesMateriaPrima: { create: lotesMateriaPrima.map((l) => ({ etiqueta: l.etiqueta, kg: l.kg })) } }
            : {}),
          ...(lotesDescarteVendido !== undefined
            ? { lotesDescarteVendido: { create: lotesDescarteVendido.map((l) => ({ kg: l.kg, precioKg: l.precioKg, moneda: l.moneda })) } }
            : {}),
        },
        include: {
          gastos: { select: { concepto: true, monto: true, moneda: true } },
          lotesMateriaPrima: { select: { id: true, etiqueta: true, kg: true } },
          lotesDescarteVendido: { select: { id: true, kg: true, precioKg: true, moneda: true } },
        },
      });
    });

    res.json({ ok: true, data: cotizacion });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/cotizaciones/:id/aprobar — PENDIENTE → APROBADA ─────────────
// Momento en que la cotización deja de ser una estimación editable y se
// vuelve un contenedor real a trackear: se asigna acá (una sola vez, nunca
// se recalcula) la numeración secuencial (general por rubro y por cliente),
// visible después en /admin/contenedores. A partir de acá la cotización ya
// no se puede editar (ver `editar`); solo queda pendiente `liquidar`.
const aprobar = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'id inválido' });
    }

    const parsed = aprobarSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: formatearErrores(parsed.error) });
    }
    const { valorVentaOc, valorVentaOcMoneda } = parsed.data;

    const existente = await prisma.cotizacion.findUnique({ where: { id } });
    if (!existente) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }
    if (existente.estado !== 'PENDIENTE') {
      return res.status(409).json({ error: `No se puede aprobar: la cotización está ${existente.estado}` });
    }
    const faltantes = CAMPOS_COSTO_OBLIGATORIOS.filter(({ campo }) => existente[campo] == null);
    if (faltantes.length > 0) {
      return res.status(400).json({
        error: `Faltan componentes del costo del contenedor antes de aprobar: ${faltantes.map((f) => f.etiqueta).join(', ')}.`,
      });
    }
    if (!(await tieneAccesoDepartamento(prisma, req.user, existente.departamentoId))) {
      return res.status(403).json({ error: 'Sin acceso a ese rubro' });
    }

    // OJO: `notas: { not: X }` en Prisma genera `<>` (excluye NULL por la
    // lógica de 3 valores de SQL) — la mayoría de cotizaciones reales tienen
    // notas=NULL, así que hace falta el OR explícito para no perderlas.
    // id: { not: id } — a diferencia de cuando esto se calculaba en crear()
    // (donde la fila todavía no existía al contar), acá la fila YA existe
    // como PENDIENTE desde que se creó el borrador: sin excluirse a sí misma,
    // el conteo se cuenta de más (off-by-one).
    const numeroContenedorGeneral = (await prisma.cotizacion.count({
      where: {
        id: { not: id },
        departamentoId: existente.departamentoId,
        OR: [{ notas: { not: 'Registro histórico (dataset tesis)' } }, { notas: null }],
      },
    })) + 1;
    const numeroContenedorCliente = existente.clienteId
      ? (await prisma.cotizacion.count({
          where: { id: { not: id }, departamentoId: existente.departamentoId, clienteId: existente.clienteId },
        })) + 1
      : null;

    const cotizacion = await prisma.cotizacion.update({
      where: { id },
      data: {
        estado: 'APROBADA',
        numeroContenedorGeneral,
        numeroContenedorCliente,
        valorVentaOc: valorVentaOc ?? null,
        valorVentaOcMoneda: valorVentaOcMoneda ?? null,
      },
    });

    res.json({ ok: true, data: conResultado(cotizacion) });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/cotizaciones/:id/liquidar — cierra el ciclo ─────────────────
const liquidar = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'id inválido' });
    }

    const parsed = liquidarSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: formatearErrores(parsed.error) });
    }

    const existente = await prisma.cotizacion.findUnique({ where: { id } });
    if (!existente) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }
    if (existente.estado !== 'APROBADA') {
      const mensaje = existente.estado === 'PENDIENTE'
        ? 'La cotización debe aprobarse antes de liquidar (asigna el N° de contenedor)'
        : `No se puede liquidar: la cotización está ${existente.estado}`;
      return res.status(409).json({ error: mensaje });
    }
    const faltantes = CAMPOS_COSTO_OBLIGATORIOS.filter(({ campo }) => existente[campo] == null);
    if (faltantes.length > 0) {
      return res.status(400).json({
        error: `Faltan componentes del costo del contenedor antes de liquidar: ${faltantes.map((f) => f.etiqueta).join(', ')}.`,
      });
    }
    if (!(await tieneAccesoDepartamento(prisma, req.user, existente.departamentoId))) {
      return res.status(403).json({ error: 'Sin acceso a ese rubro' });
    }

    const precioVentaReal = parsed.data.costoTotalReal * (1 + parsed.data.utilidadRealPct);
    const precioFobCajaReal = precioVentaReal / existente.cajasContenedor;

    const cotizacion = await prisma.cotizacion.update({
      where: { id },
      data: {
        porcentajeDescarteReal: parsed.data.porcentajeDescarteReal,
        costoTotalReal: parsed.data.costoTotalReal,
        utilidadRealPct: parsed.data.utilidadRealPct,
        precioVentaReal: Math.round(precioVentaReal * 100) / 100,
        precioFobCajaReal: Math.round(precioFobCajaReal * 100) / 100,
        valorVentaFactura: parsed.data.valorVentaFactura ?? null,
        valorVentaFacturaMoneda: parsed.data.valorVentaFacturaMoneda ?? null,
        estado: 'LIQUIDADA',
      },
    });

    await notificarCotizacionLiquidada(prisma, cotizacion, req.user.id);

    res.json({ ok: true, data: conResultado(cotizacion) });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/cotizaciones/:id/reabrir — retrocede UN paso ────────────────
// LIQUIDADA → APROBADA (limpia los valores reales de cierre: descarte/costo/
// utilidad real, precio de venta/FOB real, venta facturada) o
// APROBADA → PENDIENTE (limpia la numeración de contenedor y la venta
// pactada — vuelve a ser editable vía `editar`). Para corregir un error de
// captura sin tener que recrear la cotización desde cero.
const reabrir = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'id inválido' });
    }

    const existente = await prisma.cotizacion.findUnique({ where: { id } });
    if (!existente) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }
    if (!(await tieneAccesoDepartamento(prisma, req.user, existente.departamentoId))) {
      return res.status(403).json({ error: 'Sin acceso a ese rubro' });
    }

    let data;
    if (existente.estado === 'LIQUIDADA') {
      data = {
        estado: 'APROBADA',
        porcentajeDescarteReal: null,
        costoTotalReal: null,
        utilidadRealPct: null,
        precioVentaReal: null,
        precioFobCajaReal: null,
        valorVentaFactura: null,
        valorVentaFacturaMoneda: null,
      };
    } else if (existente.estado === 'APROBADA' || existente.estado === 'RECHAZADA') {
      data = {
        estado: 'PENDIENTE',
        numeroContenedorGeneral: null,
        numeroContenedorCliente: null,
        valorVentaOc: null,
        valorVentaOcMoneda: null,
      };
    } else {
      return res.status(409).json({ error: 'Una cotización PENDIENTE ya está abierta' });
    }

    const cotizacion = await prisma.cotizacion.update({ where: { id }, data });

    res.json({ ok: true, data: conResultado(cotizacion) });
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, obtener, crear, editar, aprobar, liquidar, reabrir, gastosHabituales };

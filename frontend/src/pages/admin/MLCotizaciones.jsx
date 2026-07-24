/**
 * @fileoverview MLCotizaciones — Cotizador con predicción ML en vivo.
 *
 * Flujo:
 *  1. El usuario completa los campos base (producto/destino restringidos a
 *     las categorías vistas en entrenamiento — el motor rechaza desconocidas).
 *     Cajas por contenedor y Kg de cosecha comprados son decisiones de
 *     negocio INDEPENDIENTES (se eligen las cajas del contenedor y, por
 *     separado, se negocia cuánta cosecha completa comprar y a qué precio
 *     por kg — no una se deriva de la otra).
 *  2. Debounce de 500 ms → POST /api/ml/predict cuando deja de escribir.
 *  3. Panel de resultado: precio FOB por caja y precio de venta total (costo
 *     + % de utilidad elegido), desglose de costos, % descarte, modelo/MAE,
 *     latencia real, y cuántas cajas rendiría la cosecha comprada (informativo).
 *  4. El bloqueo por descarte >= 60% (HTTP 400 del backend) se muestra como
 *     advertencia destacada, no como error genérico.
 *  5. Autoguardado: cada cambio (debounced) crea o actualiza un borrador
 *     PENDIENTE (POST la primera vez, PATCH después) — el id viaja en la URL
 *     (?borrador=) para poder resumir el trabajo tras recargar la página o
 *     seguir editando desde Historial.
 *
 * No hay campo de flete marítimo: las operaciones reales (CONTENEDORES.xlsx)
 * venden en términos FOB — el flete internacional lo asume el comprador. Si
 * alguna vez no fuera así, se registra como gasto adicional.
 */

import { useState, useEffect, useRef } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useRubro } from '../../context/RubroContext';

// Catálogo de respaldo mientras carga /api/productos y /api/destinos (o si
// la llamada falla) — coincide con las categorías originales del
// entrenamiento. "Nacional" = ventas a clientes locales; el producto
// combinado modela contenedores mixtos (varios productos en un contenedor).
const PRODUCTOS_RESPALDO = ['Palta Hass', 'Palta Fuerte', 'Palta Fuerte / Palta Hass', 'Mandarina Malvacea'];
const DESTINOS_RESPALDO  = ['España', 'EE.UU.', 'México', 'Países Bajos', 'Nacional'];

const CAMPOS_NUMERICOS = [
  { key: 'precio_mp_kg',         label: 'Precio materia prima negociado (S/ · kg)', step: '0.01' },
  { key: 'peso_neto_caja',       label: 'Peso neto por caja (kg)',                  step: '0.1'  },
  { key: 'cajas_contenedor',     label: 'Cajas por contenedor',                     step: '1'    },
  { key: 'kg_cosecha_comprados', label: 'Kg de cosecha comprados',                  step: '1'    },
  { key: 'costo_maquila',        label: 'Costo maquila (S/ · caja)',                step: '0.01' },
];

// Agenciamiento y SLI se cotizan naturalmente en USD; PEN es la opción
// (se convierte con el tipo de cambio de la operación).
const CAMPOS_MONEDA = [
  { key: 'costo_agenciamiento', monedaKey: 'costo_agenciamiento_moneda', label: 'Costo agenciamiento' },
  { key: 'costo_sli',           monedaKey: 'costo_sli_moneda',           label: 'Costo SLI' },
];

// Componentes OBLIGATORIOS del costo del contenedor — a diferencia de los
// gastos adicionales (variables, "habituales" pero no siempre presentes),
// estos son parte estructural de la fórmula (materia prima → maquila →
// agenciamiento → SLI) en toda cotización; el backend los exige antes de
// liquidar (ver cotizacionesController.js).
const CAMPOS_COSTO_OBLIGATORIOS = [
  { key: 'kg_cosecha_comprados', etiqueta: 'Kg de cosecha comprados' },
  { key: 'precio_mp_kg',         etiqueta: 'Precio de materia prima' },
  { key: 'cajas_contenedor',     etiqueta: 'Cajas por contenedor' },
  { key: 'costo_maquila',        etiqueta: 'Costo de maquila' },
  { key: 'costo_agenciamiento',  etiqueta: 'Costo de agenciamiento' },
  { key: 'costo_sli',            etiqueta: 'Costo de SLI' },
];

// Conceptos presentes en la mayoría de los contenedores reales
// (CONTENEDORES.xlsx): se precargan como plantilla en cada cotización.
// Monto vacío = no aplica (no se envía); monto negativo = recupero.
const GASTOS_FRECUENTES = [
  { concepto: 'Pago de supervisión + cosecheros', moneda: 'PEN' },
  { concepto: 'Flete de camiones',                moneda: 'PEN' },
  { concepto: 'Alquiler de jabas',                moneda: 'PEN' },
  { concepto: 'Comisión por fruta',               moneda: 'PEN' },
  { concepto: 'Gestor(a) de calidad',             moneda: 'USD' },
  { concepto: 'Pruebas de laboratorio',           moneda: 'USD' },
  { concepto: 'Cartón',                           moneda: 'USD' },
  { concepto: 'Bandejas',                         moneda: 'USD' },
  { concepto: 'Costos fijos administrativos',     moneda: 'USD' },
];

const plantillaGastos = () =>
  GASTOS_FRECUENTES.map((g) => ({ concepto: g.concepto, monto: '', moneda: g.moneda }));

const FORM_INICIAL = {
  producto: 'Palta Hass', destino: 'España', precio_mp_kg: '',
  peso_neto_caja: '4.0', cajas_contenedor: '', kg_cosecha_comprados: '', costo_maquila: '',
  tipo_cambio: '', costo_agenciamiento: '', costo_sli: '',
  costo_agenciamiento_moneda: 'USD', costo_sli_moneda: 'USD',
  // Recupero por venta del descarte: monto POSITIVO (se resta del costo) —
  // campo dedicado, no un gasto adicional (no debe poder borrarse sin querer).
  recupero_descarte: '', recupero_descarte_moneda: 'USD',
  utilidad_pct: '0.08',
  // Trazabilidad de logística (reemplaza el registro manual en CONTENEDORES.xlsx).
  numero_booking: '', fecha_cosecha_inicio: '', fecha_cosecha_fin: '',
  fecha_procesamiento: '', fecha_llenado_despacho: '', numero_contenedor_logistica: '',
  notas: '',
};

// Lotes de materia prima: desglose de la compra por camión/complemento —
// informativo, no participa del cálculo (kg_cosecha_comprados ya es la
// fuente de verdad); se avisa si la suma no coincide.
const loteVacio = () => ({ etiqueta: '', kg: '' });

// Lotes de descarte vendido: kg × precio por kg (pueden ser varios precios
// distintos en el mismo contenedor) — se suman solos en recupero_descarte,
// en vez de pedirle al cotizador que sume el total a mano.
const loteDescarteVacio = () => ({ kg: '', precioKg: '', moneda: 'PEN' });

// Campos que NO afectan la predicción ML ni la fórmula de costos —
// puramente informativos/trazabilidad, se guardan tal cual en cada autoguardado.
const CAMPOS_LOGISTICA = [
  { key: 'numero_booking',               label: 'N° de booking',   tipo: 'text' },
  { key: 'numero_contenedor_logistica',  label: 'N° de contenedor (asignado por la naviera)', tipo: 'text' },
  { key: 'fecha_cosecha_inicio',         label: 'Cosecha — inicio', tipo: 'date' },
  { key: 'fecha_cosecha_fin',            label: 'Cosecha — fin',    tipo: 'date' },
  { key: 'fecha_procesamiento',          label: 'Fecha de procesamiento', tipo: 'date' },
  { key: 'fecha_llenado_despacho',       label: 'Fecha de llenado/despacho (planta)', tipo: 'date' },
];
// Campos opcionales que NO deben bloquear la predicción en vivo si están
// vacíos: logística/trazabilidad + recupero por descarte (no todo contenedor
// tiene descarte vendido al momento de cotizar).
const CLAVES_OPCIONALES = new Set([...CAMPOS_LOGISTICA.map((c) => c.key), 'recupero_descarte', 'notas']);

const ETIQUETAS_DESGLOSE = {
  materia_prima:            'Materia prima',
  maquila:                  'Maquila',
  agenciamiento:            'Agenciamiento',
  sli:                      'SLI',
  costos_fijos_total:       'Total costos fijos',
  gastos_adicionales_total: 'Total gastos adicionales',
  recupero_descarte:        'Recupero por venta de descarte',
};

const fmtUsd = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2 });

// Detección de anomalías en el monto de un gasto: z-score modificado
// (Iglewicz & Hoaglin) sobre mediana + MAD del histórico de ese concepto —
// robusto ante muestras chicas y ante los propios outliers, a diferencia de
// media/desviación estándar. Sin variación histórica (MAD=0), cualquier
// desvío notable (>20%) ya cuenta como atípico.
const UMBRAL_Z_MODIFICADO = 3.5;
function anomaliaDeMonto(montoUsd, stats) {
  if (!stats) return null;
  const { medianaUsd, madUsd } = stats;
  if (madUsd === 0) {
    return Math.abs(montoUsd - medianaUsd) > medianaUsd * 0.2 ? { medianaUsd } : null;
  }
  const z = (0.6745 * (montoUsd - medianaUsd)) / madUsd;
  return Math.abs(z) > UMBRAL_Z_MODIFICADO ? { medianaUsd } : null;
}

export default function MLCotizaciones() {
  const { rubroActivo } = useRubro();
  const [searchParams, setSearchParams] = useSearchParams();
  const idBorrador = searchParams.get('borrador');

  const [form, setForm] = useState(FORM_INICIAL);
  // Gastos adicionales: arranca con la plantilla de conceptos frecuentes;
  // "+ Agregar gasto" cubre los imprevistos de cada operación.
  const [gastos, setGastos]       = useState(plantillaGastos);
  // Lotes de materia prima: desglose de la compra por camión/complemento.
  const [lotes, setLotes]         = useState([]);
  // Lotes de descarte vendido: kg × precio — se suman solos en recupero_descarte.
  const [lotesDescarte, setLotesDescarte] = useState([]);
  const [tc, setTc]               = useState(null); // { venta, compra, fecha, fuente } | { error: true }
  const [productos, setProductos] = useState(null); // catálogo dinámico (Admin › Catálogo)
  const [destinos, setDestinos]   = useState(null);
  const [categorias, setCategorias] = useState(null); // categorías con las que el modelo fue entrenado
  const [gastosHabituales, setGastosHabituales] = useState([]); // alerta: gastos que casi siempre se registran
  const [estadisticasMonto, setEstadisticasMonto] = useState({}); // detección de anomalías en el monto (mediana + MAD por concepto)
  const [clientes, setClientes]   = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [pred, setPred]           = useState(null);
  const [error, setError]         = useState(null);
  const [advertencia, setAdvertencia] = useState(null); // bloqueo descarte >= 60%
  const [cargando, setCargando]   = useState(false);
  const [latencia, setLatencia]   = useState(null);

  // Autoguardado del borrador (id viaja en la URL para resumir tras recargar).
  const [draftId, setDraftId] = useState(idBorrador ? parseInt(idBorrador, 10) : null);
  const [cargandoBorrador, setCargandoBorrador] = useState(!!idBorrador);
  const [guardadoEstado, setGuardadoEstado] = useState('idle'); // idle | guardando | guardado | error
  // Gate explícito: sin esto, el autoguardado NUNCA crea nada — evita que
  // recargar /admin/ml sin ?borrador= genere un PENDIENTE nuevo cada vez.
  const [borradorIniciado, setBorradorIniciado] = useState(!!idBorrador);

  const timer = useRef(null);
  const timerGuardado = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const agregarGasto = () =>
    setGastos((g) => [...g, { concepto: '', monto: '', moneda: 'PEN' }]);

  const setGasto = (i, k) => (e) =>
    setGastos((g) => g.map((fila, idx) => (idx === i ? { ...fila, [k]: e.target.value } : fila)));

  const quitarGasto = (i) =>
    setGastos((g) => g.filter((_, idx) => idx !== i));

  const agregarLote = () => setLotes((l) => [...l, loteVacio()]);
  const setLote = (i, k) => (e) =>
    setLotes((l) => l.map((fila, idx) => (idx === i ? { ...fila, [k]: e.target.value } : fila)));
  const quitarLote = (i) => setLotes((l) => l.filter((_, idx) => idx !== i));

  const agregarLoteDescarte = () => setLotesDescarte((l) => [...l, loteDescarteVacio()]);
  const setLoteDescarte = (i, k) => (e) =>
    setLotesDescarte((l) => l.map((fila, idx) => (idx === i ? { ...fila, [k]: e.target.value } : fila)));
  const quitarLoteDescarte = (i) => setLotesDescarte((l) => l.filter((_, idx) => idx !== i));

  // Tipo de cambio oficial SUNAT: se precarga una sola vez al abrir la
  // pantalla (el campo sigue siendo editable manualmente).
  useEffect(() => {
    api.get('/tipo-cambio')
      .then(({ data }) => {
        setTc(data);
        setForm((f) => (f.tipo_cambio === '' ? { ...f, tipo_cambio: data.venta } : f));
      })
      .catch(() => setTc({ error: true }));
  }, []);

  // Catálogo dinámico de productos/destinos (Admin › Catálogo) + categorías
  // con las que el modelo ML fue entrenado, para avisar si una entrada
  // nueva todavía no es predecible. Clientes: selector opcional para
  // asociar la cotización a un cliente del directorio.
  useEffect(() => {
    api.get('/productos').then(({ data }) => setProductos(data.data.filter((p) => p.activo))).catch(() => setProductos(null));
    api.get('/destinos').then(({ data }) => setDestinos(data.data.filter((d) => d.activo))).catch(() => setDestinos(null));
    api.get('/ml/categorias').then(({ data }) => setCategorias(data)).catch(() => setCategorias(null));
    api.get('/clientes').then(({ data }) => setClientes(data.data)).catch(() => setClientes([]));
    api.get('/cotizaciones/gastos-habituales').then(({ data }) => {
      setGastosHabituales(data.gastos);
      setEstadisticasMonto(data.estadisticasMonto ?? {});
    }).catch(() => { setGastosHabituales([]); setEstadisticasMonto({}); });
  }, []);


  // Resumir un borrador existente (?borrador=id en la URL): hidrata el
  // formulario completo con lo último guardado.
  useEffect(() => {
    if (!idBorrador) return;
    api.get(`/cotizaciones/${idBorrador}`)
      .then(({ data }) => {
        const c = data.data;
        const aTexto = (v, porDefecto = '') => (v == null ? porDefecto : String(v));
        const aFecha = (v) => (v == null ? '' : String(v).slice(0, 10));
        setForm({
          producto: c.producto ?? FORM_INICIAL.producto,
          destino: c.destino ?? FORM_INICIAL.destino,
          precio_mp_kg: aTexto(c.precioMpKg),
          peso_neto_caja: aTexto(c.pesoNetoCaja, '4.0'),
          cajas_contenedor: aTexto(c.cajasContenedor),
          kg_cosecha_comprados: aTexto(c.kgCosechaComprados),
          costo_maquila: aTexto(c.costoMaquila),
          tipo_cambio: aTexto(c.tipoCambio),
          costo_agenciamiento: aTexto(c.costoAgenciamiento),
          costo_sli: aTexto(c.costoSli),
          costo_agenciamiento_moneda: c.costoAgenciamientoMoneda ?? 'USD',
          costo_sli_moneda: c.costoSliMoneda ?? 'USD',
          recupero_descarte: aTexto(c.recuperoDescarte),
          recupero_descarte_moneda: c.recuperoDescarteMoneda ?? 'USD',
          utilidad_pct: aTexto(c.utilidadPct, '0.08'),
          numero_booking: aTexto(c.numeroBooking),
          numero_contenedor_logistica: aTexto(c.numeroContenedorLogistica),
          fecha_cosecha_inicio: aFecha(c.fechaCosechaInicio),
          fecha_cosecha_fin: aFecha(c.fechaCosechaFin),
          fecha_procesamiento: aFecha(c.fechaProcesamiento),
          fecha_llenado_despacho: aFecha(c.fechaLlenadoDespacho),
          notas: c.notas ?? '',
        });
        setGastos(c.gastos?.length
          ? c.gastos.map((g) => ({ concepto: g.concepto, monto: String(g.monto), moneda: g.moneda }))
          : plantillaGastos());
        setLotes(c.lotesMateriaPrima?.length
          ? c.lotesMateriaPrima.map((l) => ({ etiqueta: l.etiqueta, kg: String(l.kg) }))
          : []);
        setLotesDescarte(c.lotesDescarteVendido?.length
          ? c.lotesDescarteVendido.map((l) => ({ kg: String(l.kg), precioKg: String(l.precioKg), moneda: l.moneda }))
          : []);
        setClienteId(c.clienteId ?? '');
        setBorradorIniciado(true);
      })
      .catch(() => setError('No se pudo cargar el borrador guardado'))
      .finally(() => setCargandoBorrador(false));
  }, [idBorrador]);

  const nombresProducto = productos ? productos.map((p) => p.nombre) : PRODUCTOS_RESPALDO;
  const nombresDestino  = destinos  ? destinos.map((d) => d.nombre)   : DESTINOS_RESPALDO;
  const esEntrenado = (tipo, nombre) => {
    if (!categorias) return true; // sin info del motor ML: no advertir de más
    const lista = tipo === 'producto' ? categorias.producto : categorias.destino;
    return !Array.isArray(lista) || lista.includes(nombre);
  };

  const usarTipoCambioSunat = () => {
    if (tc && !tc.error) setForm((f) => ({ ...f, tipo_cambio: tc.venta }));
  };

  // Activa el autoguardado a partir de lo que ya esté escrito en el
  // formulario (primera vez que se persiste algo en esta pantalla).
  const iniciarCotizacion = () => setBorradorIniciado(true);

  // Abandona el borrador actual y arranca uno en blanco (mismo TC de SUNAT
  // si ya se había cargado). Quita ?borrador= de la URL.
  const nuevaCotizacion = () => {
    setForm({ ...FORM_INICIAL, tipo_cambio: tc && !tc.error ? tc.venta : '' });
    setGastos(plantillaGastos());
    setLotes([]);
    setLotesDescarte([]);
    setClienteId('');
    setPred(null);
    setError(null);
    setAdvertencia(null);
    setLatencia(null);
    setDraftId(null);
    setGuardadoEstado('idle');
    setSearchParams({}, { replace: true });
    setBorradorIniciado(true);
  };

  // Debounce 500 ms: consulta solo cuando el usuario deja de escribir.
  // Los gastos incompletos (sin concepto o sin monto) no se envían todavía.
  const gastosCompletos = gastos.filter((g) => g.concepto.trim() !== '' && g.monto !== '');
  const firmaGastos = JSON.stringify(gastosCompletos);

  // Lotes de materia prima: informativo, se avisa (no bloquea) si la suma no
  // coincide con "Kg de cosecha comprados" — mismo dato, desglosado por lote.
  const lotesCompletos = lotes.filter((l) => l.etiqueta.trim() !== '' && l.kg !== '');
  const firmaLotes = JSON.stringify(lotesCompletos);
  const sumaLotesKg = lotesCompletos.reduce((s, l) => s + parseFloat(l.kg || 0), 0);
  const lotesNoCoinciden = lotesCompletos.length > 0 && form.kg_cosecha_comprados !== ''
    && Math.abs(sumaLotesKg - parseFloat(form.kg_cosecha_comprados)) > 0.5;

  // Lotes de descarte vendido: kg × precio por kg, convertido a USD y sumado
  // — reemplaza el cálculo manual que antes había que hacer para "recupero
  // por venta de descarte" (p. ej. 1490.3 kg a $0.40 + 30.6 kg a $0.20).
  const lotesDescarteCompletos = lotesDescarte.filter((l) => l.kg !== '' && l.precioKg !== '');
  const firmaLotesDescarte = JSON.stringify(lotesDescarteCompletos);
  const sumaDescarteUsd = lotesDescarteCompletos.reduce((s, l) => {
    const montoUsd = l.moneda === 'USD'
      ? parseFloat(l.kg) * parseFloat(l.precioKg)
      : (form.tipo_cambio !== '' ? (parseFloat(l.kg) * parseFloat(l.precioKg)) / parseFloat(form.tipo_cambio) : 0);
    return s + montoUsd;
  }, 0);

  // Con lotes de descarte cargados, el total (en USD) se deriva solo — ya no
  // hay que sumarlo a mano. Sin lotes, recupero_descarte sigue siendo
  // editable directamente (p. ej. si solo se tiene el total ya sumado).
  const recuperoDescarteEfectivo = lotesDescarteCompletos.length > 0
    ? String(Math.round(sumaDescarteUsd * 100) / 100)
    : form.recupero_descarte;
  const recuperoDescarteMonedaEfectiva = lotesDescarteCompletos.length > 0 ? 'USD' : form.recupero_descarte_moneda;

  // Componentes obligatorios del costo (materia prima, maquila, agenciamiento,
  // SLI...) que todavía están vacíos — el backend bloquea liquidar si falta
  // alguno.
  const componentesCostoFaltantes = CAMPOS_COSTO_OBLIGATORIOS.filter(({ key }) => form[key] === '');

  // Gastos que casi siempre se registran (histórico o línea base) y que NO
  // están en el borrador actual — avisa antes de que la empresa termine
  // absorbiendo un gasto real por simple olvido, sin una segunda revisión.
  const nombresGastosActuales = new Set(gastosCompletos.map((g) => g.concepto.trim().toLowerCase()));
  const gastosFaltantes = gastosHabituales.filter(
    (h) => !nombresGastosActuales.has(h.concepto.trim().toLowerCase())
  );
  const estadisticasMontoPorNombre = new Map(
    Object.entries(estadisticasMonto).map(([concepto, stats]) => [concepto.trim().toLowerCase(), stats])
  );

  useEffect(() => {
    if (cargandoBorrador) return undefined;
    // Los campos de logística (opcionales, no participan del cálculo) no
    // deben bloquear la predicción en vivo.
    const completos = Object.entries(form).every(([k, v]) => CLAVES_OPCIONALES.has(k) || v !== '');
    if (!completos) return undefined;

    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setCargando(true);
      setError(null);
      setAdvertencia(null);
      const t0 = performance.now();
      try {
        const payload = {
          ...form,
          recupero_descarte: recuperoDescarteEfectivo,
          recupero_descarte_moneda: recuperoDescarteMonedaEfectiva,
          gastos_adicionales: JSON.parse(firmaGastos).map((g) => ({
            concepto: g.concepto,
            monto: parseFloat(g.monto),
            moneda: g.moneda,
          })),
        };
        const { data } = await api.post('/ml/predict', payload);
        setLatencia(Math.round(performance.now() - t0));
        setPred(data);
      } catch (err) {
        setPred(null);
        setLatencia(null);
        const mensaje = err.response?.data?.error || 'Error de conexión con el motor ML';
        // El corte de seguridad del backend (descarte >= 60%) llega como 400
        if (err.response?.status === 400 && /demasiado alta/i.test(mensaje)) {
          setAdvertencia(mensaje);
        } else {
          setError(mensaje);
        }
      } finally {
        setCargando(false);
      }
    }, 500);

    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, firmaGastos, firmaLotesDescarte, cargandoBorrador]);

  // Autoguardado: solo corre si el usuario inició explícitamente la
  // cotización (botón "Iniciar cotización" / "Nueva cotización") — de lo
  // contrario, entrar a /admin/ml (o recargar) no debe crear nada en
  // Historial hasta que sea una decisión deliberada.
  useEffect(() => {
    if (cargandoBorrador || !borradorIniciado || !rubroActivo?.id) return undefined;

    clearTimeout(timerGuardado.current);
    timerGuardado.current = setTimeout(async () => {
      setGuardadoEstado('guardando');
      const base = pred?.cotizacion_sugerida
        ? { ...pred.cotizacion_sugerida }
        : {
            producto: form.producto,
            variedad: null,
            destino: form.destino,
            tipoCargamento: 'CONTENEDOR',
            pesoNetoCaja: form.peso_neto_caja ? parseFloat(form.peso_neto_caja) : null,
            precioMpKg: form.precio_mp_kg ? parseFloat(form.precio_mp_kg) : null,
            cajasContenedor: form.cajas_contenedor ? parseInt(form.cajas_contenedor, 10) : null,
            kgCosechaComprados: form.kg_cosecha_comprados ? parseFloat(form.kg_cosecha_comprados) : null,
            costoMaquila: form.costo_maquila ? parseFloat(form.costo_maquila) : null,
            costoAgenciamiento: form.costo_agenciamiento ? parseFloat(form.costo_agenciamiento) : null,
            costoAgenciamientoMoneda: form.costo_agenciamiento_moneda,
            costoSli: form.costo_sli ? parseFloat(form.costo_sli) : null,
            costoSliMoneda: form.costo_sli_moneda,
            recuperoDescarte: recuperoDescarteEfectivo ? parseFloat(recuperoDescarteEfectivo) : null,
            recuperoDescarteMoneda: recuperoDescarteMonedaEfectiva,
            tipoCambio: form.tipo_cambio ? parseFloat(form.tipo_cambio) : null,
            utilidadPct: form.utilidad_pct ? parseFloat(form.utilidad_pct) : null,
            volumenTon: (form.cajas_contenedor && form.peso_neto_caja)
              ? Math.round(((parseInt(form.cajas_contenedor, 10) * parseFloat(form.peso_neto_caja)) / 1000) * 1000) / 1000
              : null,
            gastos: gastosCompletos.map((g) => ({ concepto: g.concepto, monto: parseFloat(g.monto), moneda: g.moneda })),
          };
      // Trazabilidad de logística: no participa del cálculo ML/costos, se
      // toma siempre directo del formulario (no de cotizacion_sugerida).
      const logistica = {
        numeroBooking: form.numero_booking || null,
        numeroContenedorLogistica: form.numero_contenedor_logistica || null,
        fechaCosechaInicio: form.fecha_cosecha_inicio || null,
        fechaCosechaFin: form.fecha_cosecha_fin || null,
        fechaProcesamiento: form.fecha_procesamiento || null,
        fechaLlenadoDespacho: form.fecha_llenado_despacho || null,
        notas: form.notas || null,
      };
      // Lotes: tampoco viajan en la respuesta del motor ML (son puramente
      // informativos), se toman siempre del formulario.
      const lotesMateriaPrima = lotesCompletos.map((l) => ({ etiqueta: l.etiqueta, kg: parseFloat(l.kg) }));
      const lotesDescarteVendido = lotesDescarteCompletos.map((l) => ({
        kg: parseFloat(l.kg), precioKg: parseFloat(l.precioKg), moneda: l.moneda,
      }));
      const payload = { ...base, ...logistica, lotesMateriaPrima, lotesDescarteVendido, clienteId: clienteId || null, departamentoId: rubroActivo.id };

      try {
        if (draftId) {
          await api.patch(`/cotizaciones/${draftId}`, payload);
        } else {
          const { data } = await api.post('/cotizaciones', payload);
          setDraftId(data.data.id);
          setSearchParams({ borrador: String(data.data.id) }, { replace: true });
        }
        setGuardadoEstado('guardado');
      } catch {
        setGuardadoEstado('error');
      }
    }, 600);

    return () => clearTimeout(timerGuardado.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, firmaGastos, firmaLotes, firmaLotesDescarte, clienteId, pred, cargandoBorrador, borradorIniciado, rubroActivo?.id]);

  // El cotizador ML es exclusivo de Agroexportación: si el usuario cambia
  // de rubro (o no tiene acceso a este), vuelve al dashboard de su rubro.
  if (rubroActivo && rubroActivo.slug !== 'agroexport') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <div className="erp-page">
      <div className="erp-eyebrow">Agroexportación · Cotizador</div>
      <h1 className="erp-title">Nueva cotización.</h1>
      <p className="erp-sub" style={{ marginBottom: 12 }}>
        La predicción de descarte y el costo del contenedor se actualizan solos al completar los campos.
      </p>
      <p className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 26, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {!borradorIniciado && (
          <button type="button" onClick={iniciarCotizacion} className="erp-btn erp-btn--accent erp-btn--sm">
            + Iniciar cotización
          </button>
        )}
        {!borradorIniciado && 'Los cambios no se guardan todavía — la predicción de abajo es solo una vista previa.'}
        {borradorIniciado && guardadoEstado === 'guardando' && 'Guardando…'}
        {borradorIniciado && guardadoEstado === 'guardado' && draftId && `✓ Borrador #${draftId} guardado automáticamente`}
        {borradorIniciado && guardadoEstado === 'error' && '⚠ No se pudo guardar el último cambio (se reintentará con el próximo)'}
        {borradorIniciado && draftId && (
          <>
            <Link to="/admin/historial" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Ver en historial →
            </Link>
            <button type="button" onClick={nuevaCotizacion} className="erp-btn erp-btn--ghost erp-btn--sm">
              + Nueva cotización
            </button>
          </>
        )}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,1fr)', gap: 22, alignItems: 'start' }}>
        {/* ── Columna 1: formulario ─────────────────────────────────── */}
        <section className="erp-card erp-card-pad">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="erp-label">Cliente (opcional)</label>
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="erp-select">
                <option value="">Sin asociar</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombreCompleto}{c.empresa ? ` · ${c.empresa}` : ''}</option>
                ))}
              </select>
              <p className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 4 }}>
                El N° de contenedor se asigna al aprobar la cotización desde Historial.
              </p>
            </div>
            <div>
              <label className="erp-label">Producto</label>
              <select value={form.producto} onChange={set('producto')} className="erp-select">
                {nombresProducto.map((p) => (
                  <option key={p} value={p}>{p}{esEntrenado('producto', p) ? '' : ' · sin entrenar'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="erp-label">Destino</label>
              <select value={form.destino} onChange={set('destino')} className="erp-select">
                {nombresDestino.map((d) => (
                  <option key={d} value={d}>{d}{esEntrenado('destino', d) ? '' : ' · sin entrenar'}</option>
                ))}
              </select>
            </div>

            {CAMPOS_NUMERICOS.map(({ key, label, step }) => (
              <div key={key}>
                <label className="erp-label">{label}</label>
                <input
                  type="number"
                  min="0"
                  step={step}
                  value={form[key]}
                  onChange={set(key)}
                  className="erp-input"
                />
              </div>
            ))}

            {/* Tipo de cambio: precargado desde SUNAT, siempre editable */}
            <div>
              <label className="erp-label">Tipo de cambio (S/ · USD)</label>
              <input
                type="number" min="0" step="0.001"
                value={form.tipo_cambio}
                onChange={set('tipo_cambio')}
                className="erp-input"
              />
              {tc && !tc.error && (
                <p className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 4 }}>
                  SUNAT venta {tc.venta} · compra {tc.compra} ({tc.fecha}){' '}
                  <button
                    type="button"
                    onClick={usarTipoCambioSunat}
                    style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent-2)', textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    usar
                  </button>
                </p>
              )}
              {tc?.error && (
                <p className="mono" style={{ fontSize: 10.5, color: 'var(--warn)', marginTop: 4 }}>
                  No se pudo obtener el TC de SUNAT — ingrésalo manualmente.
                </p>
              )}
            </div>

            {/* Agenciamiento y SLI: USD por defecto, PEN opcional con conversión */}
            {CAMPOS_MONEDA.map(({ key, monedaKey, label }) => (
              <div key={key}>
                <label className="erp-label">{label}</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="number" min="0" step="0.01"
                    value={form[key]}
                    onChange={set(key)}
                    className="erp-input"
                    style={{ flex: 1 }}
                  />
                  <select value={form[monedaKey]} onChange={set(monedaKey)} className="erp-select" style={{ width: 76 }}>
                    <option value="USD">USD</option>
                    <option value="PEN">S/</option>
                  </select>
                </div>
              </div>
            ))}

            {/* Recupero por venta de descarte: monto POSITIVO, se resta del
                costo total — campo dedicado (no un gasto adicional). */}
            <div>
              <label className="erp-label">Recupero por venta de descarte (opcional)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="number" min="0" step="0.01"
                  value={recuperoDescarteEfectivo}
                  onChange={set('recupero_descarte')}
                  disabled={lotesDescarteCompletos.length > 0}
                  className="erp-input"
                  style={{ flex: 1 }}
                />
                <select
                  value={recuperoDescarteMonedaEfectiva}
                  onChange={set('recupero_descarte_moneda')}
                  disabled={lotesDescarteCompletos.length > 0}
                  className="erp-select"
                  style={{ width: 76 }}
                >
                  <option value="USD">USD</option>
                  <option value="PEN">S/</option>
                </select>
              </div>
              <p className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 4 }}>
                {lotesDescarteCompletos.length > 0
                  ? 'Calculado automáticamente desde los lotes de descarte vendido, abajo.'
                  : 'Monto recuperado por la fruta descartada vendida — se resta automáticamente del costo total. Si vendiste a distintos precios por kg, usa "Lotes de descarte vendido" abajo en vez de escribir el total a mano.'}
              </p>
            </div>

            {/* Utilidad: % elegido por el cotizador sobre el subtotal de costos */}
            <div>
              <label className="erp-label">% de utilidad (fracción, p. ej. 0.08 = 8%)</label>
              <input
                type="number" min="0" max="1" step="0.01"
                value={form.utilidad_pct}
                onChange={set('utilidad_pct')}
                className="erp-input"
              />
            </div>
          </div>

          {/* ── Datos de logística y trazabilidad (reemplaza el registro manual
              en CONTENEDORES.xlsx) — no afectan el costo ni la predicción ML. */}
          <div style={{ marginTop: 24, borderTop: '1px dashed var(--line-2)', paddingTop: 16 }}>
            <span className="erp-eyebrow">Datos de logística y trazabilidad (opcional)</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 10 }}>
              {CAMPOS_LOGISTICA.map(({ key, label, tipo }) => (
                <div key={key}>
                  <label className="erp-label">{label}</label>
                  <input
                    type={tipo}
                    value={form[key]}
                    onChange={set(key)}
                    className="erp-input"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Lotes de materia prima: desglose de la compra por camión/
              complemento — informativo, no participa del cálculo (kg de
              cosecha comprados ya es la fuente de verdad para el costo). */}
          <div style={{ marginTop: 24, borderTop: '1px dashed var(--line-2)', paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span className="erp-eyebrow">Lotes de materia prima (opcional)</span>
              <button type="button" onClick={agregarLote} className="erp-btn erp-btn--ghost erp-btn--sm">
                + Agregar lote
              </button>
            </div>
            <p className="erp-sub" style={{ fontSize: 12, margin: '4px 0 12px' }}>
              Desglose de la compra por camión/complemento (p. ej. "Primer camión", "Complemento para completar CNT") — no cambia el costo, solo trazabilidad.
            </p>

            {lotes.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Etiqueta (p. ej. Primer camión)"
                  value={l.etiqueta}
                  onChange={setLote(i, 'etiqueta')}
                  className="erp-input"
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Kg"
                  value={l.kg}
                  onChange={setLote(i, 'kg')}
                  className="erp-input"
                  style={{ width: 120 }}
                />
                <button
                  type="button"
                  onClick={() => quitarLote(i)}
                  aria-label="Quitar lote"
                  style={{ background: 'none', border: 'none', color: 'var(--ink-3)', padding: '0 4px' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--warn)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-3)'; }}
                >
                  ✕
                </button>
              </div>
            ))}

            {lotesCompletos.length > 0 && (
              <p className="mono" style={{ fontSize: 10.5, color: lotesNoCoinciden ? 'var(--warn)' : 'var(--ink-3)', marginTop: 4 }}>
                Suma de lotes: {sumaLotesKg.toLocaleString('en-US', { maximumFractionDigits: 2 })} kg
                {form.kg_cosecha_comprados !== '' && ` · Kg de cosecha comprados: ${form.kg_cosecha_comprados} kg`}
                {lotesNoCoinciden && ' ⚠ no coincide'}
              </p>
            )}
          </div>

          {/* ── Lotes de descarte vendido: kg × precio, pueden ser distintos
              precios por kg en el mismo contenedor — el total se suma solo
              y se refleja en "Recupero por venta de descarte" arriba. */}
          <div style={{ marginTop: 24, borderTop: '1px dashed var(--line-2)', paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span className="erp-eyebrow">Lotes de descarte vendido (opcional)</span>
              <button type="button" onClick={agregarLoteDescarte} className="erp-btn erp-btn--ghost erp-btn--sm">
                + Agregar lote
              </button>
            </div>
            <p className="erp-sub" style={{ fontSize: 12, margin: '4px 0 12px' }}>
              Kg de descarte vendidos y a qué precio por kg (pueden ser varios precios distintos) — el total se calcula solo.
            </p>

            {lotesDescarte.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Kg"
                  value={l.kg}
                  onChange={setLoteDescarte(i, 'kg')}
                  className="erp-input"
                  style={{ width: 120 }}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Precio por kg"
                  value={l.precioKg}
                  onChange={setLoteDescarte(i, 'precioKg')}
                  className="erp-input"
                  style={{ width: 120 }}
                />
                <select value={l.moneda} onChange={setLoteDescarte(i, 'moneda')} className="erp-select" style={{ width: 76 }}>
                  <option value="PEN">S/</option>
                  <option value="USD">USD</option>
                </select>
                <button
                  type="button"
                  onClick={() => quitarLoteDescarte(i)}
                  aria-label="Quitar lote"
                  style={{ background: 'none', border: 'none', color: 'var(--ink-3)', padding: '0 4px' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--warn)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-3)'; }}
                >
                  ✕
                </button>
              </div>
            ))}

            {lotesDescarteCompletos.length > 0 && (
              <p className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 4 }}>
                Total recuperado: ${sumaDescarteUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>

          {/* Notas: causa raíz de anomalías (p. ej. "fallas del recolector de
              cosecha, aumentó el descarte") — conocimiento de negocio que
              hoy solo vive en la memoria de quien cotiza. */}
          <div style={{ marginTop: 24, borderTop: '1px dashed var(--line-2)', paddingTop: 16 }}>
            <span className="erp-eyebrow">Notas (opcional)</span>
            <textarea
              value={form.notas}
              onChange={set('notas')}
              placeholder="p. ej. Se originó pérdida por fallas del recolector de cosecha; aumentó el descarte y los calibres fueron más pequeños."
              className="erp-input"
              rows={3}
              style={{ width: '100%', marginTop: 10, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {componentesCostoFaltantes.length > 0 && (
            <div className="erp-alert erp-alert--warn" style={{ marginTop: 16, fontSize: 12.5 }}>
              <strong style={{ display: 'block', marginBottom: 4, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.06em' }}>
                Componentes del costo del contenedor sin completar
              </strong>
              Estos campos son obligatorios para liquidar la operación (el costo del contenedor quedaría incompleto sin ellos):
              {componentesCostoFaltantes.map(({ key, etiqueta }) => (
                <div key={key}>{etiqueta}</div>
              ))}
            </div>
          )}

          {/* ── Gastos adicionales (estructura variable de la operación) ── */}
          <div style={{ marginTop: 24, borderTop: '1px dashed var(--line-2)', paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span className="erp-eyebrow">Gastos adicionales</span>
              <button type="button" onClick={agregarGasto} className="erp-btn erp-btn--ghost erp-btn--sm">
                + Agregar gasto
              </button>
            </div>
            <p className="erp-sub" style={{ fontSize: 12, margin: '4px 0 12px' }}>
              Los conceptos frecuentes ya están listados: completa el monto de los que apliquen
              (los vacíos se ignoran) y agrega los imprevistos. Monto negativo = recupero
              (p. ej. venta de descarte).
            </p>

            {gastosFaltantes.length > 0 && (
              <div className="erp-alert erp-alert--warn" style={{ marginBottom: 12, fontSize: 12.5 }}>
                <strong style={{ display: 'block', marginBottom: 4, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.06em' }}>
                  Gastos que casi siempre aplican y no están registrados
                </strong>
                {gastosFaltantes.map((g) => (
                  <div key={g.concepto}>
                    {g.concepto}
                    {g.frecuencia != null && ` (en ${(g.frecuencia * 100).toFixed(0)}% de las operaciones liquidadas)`}
                  </div>
                ))}
              </div>
            )}

            {gastos.map((g, i) => {
              const statsConcepto = g.concepto.trim() !== ''
                ? estadisticasMontoPorNombre.get(g.concepto.trim().toLowerCase())
                : undefined;
              const montoUsd = g.monto !== '' && form.tipo_cambio !== ''
                ? (g.moneda === 'USD' ? parseFloat(g.monto) : parseFloat(g.monto) / parseFloat(form.tipo_cambio))
                : null;
              const anomalia = montoUsd != null ? anomaliaDeMonto(montoUsd, statsConcepto) : null;

              return (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Concepto (p. ej. Flete de camiones)"
                      value={g.concepto}
                      onChange={setGasto(i, 'concepto')}
                      className="erp-input"
                      style={{ flex: 1 }}
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Monto"
                      value={g.monto}
                      onChange={setGasto(i, 'monto')}
                      className="erp-input"
                      style={{ width: 110 }}
                    />
                    <select value={g.moneda} onChange={setGasto(i, 'moneda')} className="erp-select" style={{ width: 76 }}>
                      <option value="PEN">S/</option>
                      <option value="USD">USD</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => quitarGasto(i)}
                      aria-label="Quitar gasto"
                      style={{ background: 'none', border: 'none', color: 'var(--ink-3)', padding: '0 4px' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--warn)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-3)'; }}
                    >
                      ✕
                    </button>
                  </div>
                  {anomalia && (
                    <p className="mono" style={{ fontSize: 10.5, color: 'var(--warn)', margin: '4px 0 0' }}>
                      ⚠ Monto inusual para &quot;{g.concepto}&quot; — lo habitual ronda ${fmtUsd(anomalia.medianaUsd)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Columna 2: resultado en vivo ──────────────────────────── */}
        <section className="erp-card erp-card-pad" style={{ position: 'sticky', top: 24 }}>
          <div className="erp-eyebrow" style={{ marginBottom: 12 }}>Precio de venta</div>

          {cargando && <p className="erp-sub">Calculando…</p>}

          {advertencia && (
            <div className="erp-alert erp-alert--warn" style={{ marginBottom: 14 }}>
              <strong style={{ display: 'block', marginBottom: 4, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.06em' }}>
                Operación bloqueada por riesgo
              </strong>
              {advertencia}
            </div>
          )}

          {error && (
            <div className="erp-alert erp-alert--error" style={{ marginBottom: 14 }}>{error}</div>
          )}

          {!pred && !cargando && !error && !advertencia && (
            <p className="erp-sub">Completa el formulario para ver la estimación.</p>
          )}

          {pred && (
            <>
              {/* Hero: precio FOB por caja — la cifra que se le cotiza al cliente */}
              <div style={{ fontSize: 38, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
                ${fmtUsd(pred.estimacion_pre_compra.precio_fob_caja)}
                <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink-3)' }}> / caja FOB</span>
              </div>
              <p className="erp-sub" style={{ margin: '8px 0 2px' }}>
                Precio de venta total: <strong style={{ color: 'var(--ink)' }}>${fmtUsd(pred.estimacion_pre_compra.precio_venta_total)}</strong>
                {' · '}Costo total: <strong style={{ color: 'var(--ink)' }}>${fmtUsd(pred.estimacion_pre_compra.costo_total_estimado)}</strong>
              </p>
              <p className="erp-sub" style={{ margin: '2px 0' }}>
                Descarte proyectado:{' '}
                <strong style={{ color: 'var(--ink)' }}>
                  {(pred.metadatos_ml.porcentaje_descarte_estimado * 100).toFixed(1)}%
                </strong>
              </p>
              <p className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                {pred.metadatos_ml.modelo} · MAE {pred.metadatos_ml.mae}
                {latencia !== null && <> · {latencia} ms</>}
              </p>

              {pred.estimacion_pre_compra.cajas_posibles_estimadas != null && (
                <p className="erp-sub" style={{ fontSize: 12, marginTop: 10 }}>
                  Con {form.kg_cosecha_comprados} kg de cosecha y ese % de descarte, rendiría{' '}
                  <strong style={{ color: 'var(--ink)' }}>~{pred.estimacion_pre_compra.cajas_posibles_estimadas} cajas</strong>
                  {' '}(elegiste {form.cajas_contenedor}).
                  {Number(form.cajas_contenedor) > pred.estimacion_pre_compra.cajas_posibles_estimadas && (
                    <span style={{ color: 'var(--warn)' }}> Podría no alcanzar la cosecha comprada.</span>
                  )}
                </p>
              )}

              <table className="erp-table" style={{ marginTop: 18 }}>
                <thead>
                  <tr>
                    <th>Componente</th>
                    <th style={{ textAlign: 'right' }}>USD</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(pred.estimacion_pre_compra.desglose).map(([k, v]) => (
                    <tr key={k}>
                      <td>{ETIQUETAS_DESGLOSE[k] ?? k}</td>
                      <td className="num" style={{ color: v < 0 ? 'var(--accent-2)' : undefined }}>{fmtUsd(v)}</td>
                    </tr>
                  ))}
                  {(pred.estimacion_pre_compra.gastos_adicionales ?? []).map((g, i) => (
                    <tr key={`gasto-${i}`}>
                      <td style={{ paddingLeft: 28, fontSize: 12, color: 'var(--ink-3)' }}>
                        {g.concepto} {g.moneda === 'PEN' ? `(S/ ${g.monto})` : ''}
                      </td>
                      <td className="num" style={{ fontSize: 11.5, color: g.monto_usd < 0 ? 'var(--accent-2)' : 'var(--ink-3)' }}>
                        {fmtUsd(g.monto_usd)}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ fontWeight: 600, color: 'var(--ink)' }}>Costo total estimado</td>
                    <td className="num" style={{ fontWeight: 600, color: 'var(--ink)' }}>
                      {fmtUsd(pred.estimacion_pre_compra.costo_total_estimado)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      Utilidad ({(parseFloat(form.utilidad_pct) * 100).toFixed(1)}%)
                    </td>
                    <td className="num" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      {fmtUsd(pred.estimacion_pre_compra.utilidad_usd)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600, color: 'var(--ink)' }}>Precio de venta total</td>
                    <td className="num" style={{ fontWeight: 600, color: 'var(--accent-2)' }}>
                      {fmtUsd(pred.estimacion_pre_compra.precio_venta_total)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600, color: 'var(--ink)' }}>Precio FOB por caja</td>
                    <td className="num" style={{ fontWeight: 600, color: 'var(--accent-2)' }}>
                      {fmtUsd(pred.estimacion_pre_compra.precio_fob_caja)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

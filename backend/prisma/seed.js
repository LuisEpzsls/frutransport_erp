require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const CSV_PATH = path.join(__dirname, "..", "..", "ml_engine", "data", "cotizaciones.csv");
const PESO_NETO_CAJA_DEFAULT = 4.0;

// ── Operaciones reales: 13 contenedores de CONTENEDORES.xlsx (2023-2024) ──
// Convenciones acordadas con el negocio (2026-07-08):
//  - porcentaje_descarte = kg_descarte / (kg_exportables + kg_descarte)
//    (definición del propio CNT 13: "TOTAL EXPORTABLE MÁS DESCARTE").
//  - precio_mp_kg = soles pagados / kg comprados (promedio ponderado de lotes).
//  - costo_total = costo directo operativo en USD, SIN extracostos
//    extraordinarios (CNT 03: sin aranceles México; CNT 13: sin gastos control).
//  - Ventas nacionales (CNT 05-07) → destino "Nacional" (5ª categoría del modelo).
//  - Contenedores mixtos (CNT 09): el contenedor es la unidad de negocio y se
//    registra COMPLETO como un solo registro; el producto combinado
//    ("Palta Fuerte / Palta Hass") es una categoría propia del modelo y el
//    precio MP es el promedio ponderado de todos los lotes.
//  - CNT 10, 11 y 12 no tenían línea de descarte en el Excel: se cargan con 0
//    provisional. Para corregir: editar aquí, borrar los registros con nota
//    "Operación real (CNT ..)" y re-seedear, o UPDATE directo + reentrenar.
const OPERACIONES_REALES = [
  { cnt: "01",   fecha: "2023-04-28", producto: "Palta Hass",         destino: "España",       precio_mp_kg: 3.486, porcentaje_descarte: 0.0585, cajas_contenedor: 2400, peso_neto_caja: 10.2,  costo_total_contenedor: 42977.87,
    cliente: "palacios", n_general: 1, n_cliente: 1, n_contenedor: "CAIU 5556458", n_booking: "LMM0410384", cosecha_inicio: null, cosecha_fin: null, procesamiento: "2023-05-05" },
  { cnt: "02",   fecha: "2023-05-10", producto: "Palta Hass",         destino: "España",       precio_mp_kg: 3.558, porcentaje_descarte: 0.0862, cajas_contenedor: 2240, peso_neto_caja: 10.2,  costo_total_contenedor: 34178.86,
    cliente: "palacios", n_general: 2, n_cliente: 2, n_contenedor: "CAIU5557393", n_booking: "LMM0410385", cosecha_inicio: "2023-05-10", cosecha_fin: "2023-05-10", procesamiento: "2023-05-12" },
  { cnt: "03",   fecha: "2023-10-13", producto: "Mandarina Malvacea", destino: "México",       precio_mp_kg: 2.100, porcentaje_descarte: 0.1533, cajas_contenedor: 2296, peso_neto_caja: 10.2,  costo_total_contenedor: 36197.75,
    cliente: "gabrielVicente", n_general: 3, n_cliente: 1, n_contenedor: "FBIU5359820", n_booking: "169DA01906", cosecha_inicio: "2023-10-13", cosecha_fin: "2023-10-13", procesamiento: null },
  { cnt: "04",   fecha: "2023-10-18", producto: "Mandarina Malvacea", destino: "EE.UU.",       precio_mp_kg: 2.139, porcentaje_descarte: 0.3489, cajas_contenedor: 2296, peso_neto_caja: 10.2,  costo_total_contenedor: 32920.63,
    cliente: "centuryFarms", n_general: 4, n_cliente: 1, n_contenedor: "FSCU5943114", n_booking: "LIMD17712900", cosecha_inicio: null, cosecha_fin: null, procesamiento: null },
  { cnt: "05",   fecha: "2023-10-25", producto: "Mandarina Malvacea", destino: "Nacional",     precio_mp_kg: 2.000, porcentaje_descarte: 0.2946, cajas_contenedor: 2296, peso_neto_caja: 10.2,  costo_total_contenedor: 24141.25,
    cliente: "seforpun", n_general: 5, n_cliente: 1, n_contenedor: null, n_booking: null, cosecha_inicio: "2023-10-25", cosecha_fin: "2023-10-25", procesamiento: "2023-10-27" },
  { cnt: "06",   fecha: "2023-10-27", producto: "Mandarina Malvacea", destino: "Nacional",     precio_mp_kg: 2.000, porcentaje_descarte: 0.2946, cajas_contenedor: 2296, peso_neto_caja: 10.2,  costo_total_contenedor: 14863.05,
    cliente: "inmaGolden", n_general: 6, n_cliente: 1, n_contenedor: null, n_booking: null, cosecha_inicio: "2023-10-27", cosecha_fin: "2023-10-27", procesamiento: "2023-10-28" },
  { cnt: "07",   fecha: "2023-11-03", producto: "Mandarina Malvacea", destino: "Nacional",     precio_mp_kg: 2.000, porcentaje_descarte: 0.2037, cajas_contenedor: 2296, peso_neto_caja: 10.2,  costo_total_contenedor: 27082.50,
    cliente: "seforpun", n_general: 7, n_cliente: 2, n_contenedor: null, n_booking: null, cosecha_inicio: "2023-11-03", cosecha_fin: "2023-11-03", procesamiento: null },
  { cnt: "08",   fecha: "2023-11-11", producto: "Mandarina Malvacea", destino: "EE.UU.",       precio_mp_kg: 2.300, porcentaje_descarte: 0.0524, cajas_contenedor: 2296, peso_neto_caja: 10.2,  costo_total_contenedor: 29528.66,
    cliente: "centuryFarms", n_general: 8, n_cliente: 2, n_contenedor: "FSU5943114", n_booking: "LIMD18477400", cosecha_inicio: "2023-11-11", cosecha_fin: "2023-11-11", procesamiento: "2023-11-11" },
  { cnt: "09",   fecha: "2024-02-12", producto: "Palta Fuerte / Palta Hass", destino: "Países Bajos", precio_mp_kg: 5.456, porcentaje_descarte: 0.0043, cajas_contenedor: 4672, peso_neto_caja: 4.575, costo_total_contenedor: 45569.35,
    cliente: "pingFruit", n_general: 9, n_cliente: 1, n_contenedor: "TLLU 1068700", n_booking: "LMM0451858", cosecha_inicio: "2024-02-12", cosecha_fin: "2024-02-23", procesamiento: "2024-02-14" },
  { cnt: "10",   fecha: "2024-03-05", producto: "Palta Hass",         destino: "Países Bajos", precio_mp_kg: 4.939, porcentaje_descarte: 0.0,    cajas_contenedor: 3304, peso_neto_caja: 6.844, costo_total_contenedor: 40883.69,
    cliente: "pingFruit", n_general: 10, n_cliente: 2, n_contenedor: "TTNU8977122", n_booking: "LMM0453659", cosecha_inicio: "2024-03-05", cosecha_fin: "2024-03-10", procesamiento: "2024-03-06" },
  { cnt: "11",   fecha: "2024-03-17", producto: "Palta Hass",         destino: "España",       precio_mp_kg: 5.268, porcentaje_descarte: 0.0,    cajas_contenedor: 4064, peso_neto_caja: 5.473, costo_total_contenedor: 44147.46,
    cliente: "guerreroMercovasa", n_general: 11, n_cliente: 1, n_contenedor: "IKSU4008650", n_booking: "LMM0454985", cosecha_inicio: "2024-03-17", cosecha_fin: "2024-03-23", procesamiento: "2024-03-18" },
  { cnt: "12",   fecha: "2024-03-26", producto: "Palta Hass",         destino: "España",       precio_mp_kg: 5.427, porcentaje_descarte: 0.0,    cajas_contenedor: 4560, peso_neto_caja: 4.946, costo_total_contenedor: 45453.73,
    cliente: "guerreroMercovasa", n_general: 12, n_cliente: 2, n_contenedor: "TLLU1071411", n_booking: "LMM0456040", cosecha_inicio: "2024-03-26", cosecha_fin: "2024-03-26", procesamiento: "2024-03-26" },
  { cnt: "13",   fecha: "2024-04-19", producto: "Palta Hass",         destino: "España",       precio_mp_kg: 5.557, porcentaje_descarte: 0.0644, cajas_contenedor: 2089, peso_neto_caja: 10.0,  costo_total_contenedor: 47987.46,
    cliente: "guerreroMercovasa", n_general: 13, n_cliente: 3, n_contenedor: "TCLU1387145", n_booking: "LMM0458865", cosecha_inicio: "2024-04-19", cosecha_fin: "2024-04-22", procesamiento: "2024-04-20" },
];

// ── Clientes reales (Razón Social de cada hoja de CONTENEDORES.xlsx) ──────
// Sin passwordHash: registros de seguimiento, activables después desde
// Control de usuarios › Clientes (mismo patrón que la alta rápida del cotizador).
const CLIENTES_REALES = [
  { key: "palacios",           nombreCompleto: "Palacios Escutia SL",         empresa: "Palacios Escutia SL",         pais: "España",       email: "palacios.escutia@clientes.frutransport.pe" },
  { key: "gabrielVicente",     nombreCompleto: "Gabriel/Vicente",             empresa: "Gabriel/Vicente",             pais: "México",       email: "gabriel.vicente@clientes.frutransport.pe" },
  { key: "centuryFarms",       nombreCompleto: "Century Farms Internacional", empresa: "Century Farms Internacional", pais: "EE.UU.",       email: "century.farms@clientes.frutransport.pe" },
  { key: "seforpun",           nombreCompleto: "Seforpun EIRL",               empresa: "Seforpun EIRL",               pais: "Perú",         email: "seforpun@clientes.frutransport.pe" },
  { key: "inmaGolden",         nombreCompleto: "Inma Golden",                 empresa: "Inma Golden",                 pais: "Perú",         email: "inma.golden@clientes.frutransport.pe" },
  { key: "pingFruit",          nombreCompleto: "Ping Fruit",                  empresa: "Ping Fruit",                  pais: "Países Bajos", email: "ping.fruit@clientes.frutransport.pe" },
  { key: "guerreroMercovasa",  nombreCompleto: "Guerrero Mercovasa SL",       empresa: "Guerrero Mercovasa SL",       pais: "España",       email: "guerrero.mercovasa@clientes.frutransport.pe" },
];

/** Lee ml_engine/data/cotizaciones.csv (50 registros sintéticos de la tesis). */
function leerCsvHistorico() {
  const raw = fs.readFileSync(CSV_PATH, "utf8").trim();
  const [header, ...lineas] = raw.split(/\r?\n/);
  const cols = header.split(",");
  return lineas.map((linea) => {
    const valores = linea.split(",");
    return Object.fromEntries(cols.map((c, i) => [c, valores[i]]));
  });
}

/** Inserta un registro histórico como cotización LIQUIDADA (dato de entrenamiento). */
function aCotizacionLiquidada(r, usuarioId, departamentoId, clienteId = null) {
  const cajas = parseInt(r.cajas_contenedor, 10);
  const pesoCaja = r.peso_neto_caja ?? PESO_NETO_CAJA_DEFAULT;
  return {
    producto: r.producto,
    destino: r.destino,
    volumenTon: Math.round(cajas * pesoCaja) / 1000,
    tipoCargamento: "CONTENEDOR",
    pesoNetoCaja: pesoCaja,
    precioMpKg: parseFloat(r.precio_mp_kg),
    porcentajeDescarteReal: parseFloat(r.porcentaje_descarte),
    costoTotalReal: parseFloat(r.costo_total_contenedor),
    estado: "LIQUIDADA",
    notas: r.cnt
      ? `Operación real (CNT ${r.cnt})`
      : "Registro histórico (dataset tesis)",
    creadoEn: new Date(r.fecha),
    usuarioId,
    departamentoId,
    clienteId,
    // Trazabilidad de logística + numeración (solo presentes en operaciones
    // reales; los 50 registros sintéticos del CSV no traen estas claves).
    numeroContenedorGeneral: r.n_general ?? null,
    numeroContenedorCliente: r.n_cliente ?? null,
    numeroContenedorLogistica: r.n_contenedor ?? null,
    numeroBooking: r.n_booking ?? null,
    fechaCosechaInicio: r.cosecha_inicio ? new Date(r.cosecha_inicio) : null,
    fechaCosechaFin: r.cosecha_fin ? new Date(r.cosecha_fin) : null,
    fechaProcesamiento: r.procesamiento ? new Date(r.procesamiento) : null,
  };
}

// Contraseñas reales de las cuentas de seed: NUNCA hardcodeadas acá.
// Viven en credentials.md (gitignored) y se leen por variable de entorno,
// con un fallback aleatorio (impredecible, se descarta al terminar el
// proceso) para que un `RUN_SEED=true` sin configurar no cree cuentas con
// contraseñas conocidas por accidente — hay que ir a credentials.md o
// exportar la env var para saber cuál es.
const passwordAleatoria = () => require("crypto").randomBytes(18).toString("base64").replace(/[+/=]/g, "").slice(0, 18);
const PWD_ADMIN     = process.env.SEED_ADMIN_PASSWORD     ?? passwordAleatoria();
const PWD_MANAGER    = process.env.SEED_MANAGER_PASSWORD   ?? passwordAleatoria();
const PWD_AUDITOR    = process.env.SEED_AUDITOR_PASSWORD   ?? passwordAleatoria();
const PWD_CLIENTE1   = process.env.SEED_CLIENTE1_PASSWORD  ?? passwordAleatoria();
const PWD_CLIENTE2   = process.env.SEED_CLIENTE2_PASSWORD  ?? passwordAleatoria();

async function main() {
  const hash = (pwd) => bcrypt.hash(pwd, 10);

  // ── Usuarios ERP ──────────────────────────────────────────────────
  const admin = await prisma.usuario.upsert({
    where: { email: "admin@frutransport.pe" },
    update: {},
    create: {
      email: "admin@frutransport.pe",
      passwordHash: await hash(PWD_ADMIN),
      role: "ADMIN",
    },
  });

  const manager = await prisma.usuario.upsert({
    where: { email: "manager@frutransport.pe" },
    update: {},
    create: {
      email: "manager@frutransport.pe",
      passwordHash: await hash(PWD_MANAGER),
      role: "MANAGER",
    },
  });

  await prisma.usuario.upsert({
    where: { email: "auditor@frutransport.pe" },
    update: {},
    create: {
      email: "auditor@frutransport.pe",
      passwordHash: await hash(PWD_AUDITOR),
      role: "AUDITOR",
    },
  });

  // ── Clientes externos ─────────────────────────────────────────────
  await prisma.cliente.upsert({
    where: { email: "importador@fresco-asia.com" },
    update: {},
    create: {
      nombreCompleto: "Zhang Wei",
      empresa: "Fresco Asia Ltd.",
      pais: "China",
      telefono: "+86 21 5555 0100",
      email: "importador@fresco-asia.com",
      passwordHash: await hash(PWD_CLIENTE1),
      verificado: true,
    },
  });

  await prisma.cliente.upsert({
    where: { email: "compras@supermercados-nl.com" },
    update: {},
    create: {
      nombreCompleto: "Jan de Vries",
      empresa: "Supermercados NL B.V.",
      pais: "Netherlands",
      telefono: "+31 20 555 0142",
      email: "compras@supermercados-nl.com",
      passwordHash: await hash(PWD_CLIENTE2),
      verificado: true,
    },
  });

  // ── Departamentos ─────────────────────────────────────────────────
  const departamentos = [
    { nombre: "Agroexportación",          slug: "agroexport",  orden: 1 },
    { nombre: "Importaciones",             slug: "importaciones", orden: 2 },
    { nombre: "Servicios Automotrices",    slug: "automotriz",  orden: 3 },
    { nombre: "Logística y Mudanzas",      slug: "logistica",   orden: 4 },
    { nombre: "Transporte Pesado",         slug: "transporte",  orden: 5 },
    { nombre: "Telecomunicaciones",        slug: "telecom",     orden: 6 },
  ];

  const departamentosCreados = {};
  for (const d of departamentos) {
    departamentosCreados[d.slug] = await prisma.departamento.upsert({
      where: { slug: d.slug },
      update: {},
      create: d,
    });
  }

  // ── Catálogo de productos y destinos ────────────────────────────────
  // Las categorías con las que el modelo ML ya fue entrenado (train.py) —
  // administrables desde /admin/catalogo; una entrada nueva es seleccionable
  // en el cotizador pero no será predecible hasta reentrenar con datos reales.
  const PRODUCTOS_ENTRENADOS = ["Palta Hass", "Palta Fuerte", "Palta Fuerte / Palta Hass", "Mandarina Malvacea"];
  const DESTINOS_ENTRENADOS = ["España", "EE.UU.", "México", "Países Bajos", "Nacional"];

  for (const nombre of PRODUCTOS_ENTRENADOS) {
    await prisma.producto.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }
  for (const nombre of DESTINOS_ENTRENADOS) {
    await prisma.destino.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }
  const agro = departamentosCreados["agroexport"];

  // ── Clientes reales (Razón Social de CONTENEDORES.xlsx) ──────────────
  const clientesReales = {};
  for (const c of CLIENTES_REALES) {
    clientesReales[c.key] = await prisma.cliente.upsert({
      where: { email: c.email },
      update: {},
      create: {
        nombreCompleto: c.nombreCompleto,
        empresa: c.empresa,
        pais: c.pais,
        email: c.email,
        verificado: false, // sin acceso al portal: solo registro de seguimiento
      },
    });
  }

  // ── Acceso por rubro ────────────────────────────────────────────────
  // ADMIN administra los 6 rubros; MANAGER solo Agroexportación (el único
  // con funcionalidad real hoy). AUDITOR no participa de esta tabla: audita
  // todos los rubros sin necesidad de asignación explícita.
  await prisma.usuarioDepartamento.createMany({
    data: Object.values(departamentosCreados).map((d) => ({ usuarioId: admin.id, departamentoId: d.id })),
    skipDuplicates: true,
  });
  await prisma.usuarioDepartamento.createMany({
    data: [{ usuarioId: manager.id, departamentoId: agro.id }],
    skipDuplicates: true,
  });

  // ── Dataset de entrenamiento: 50 sintéticos (CSV) + operaciones reales ──
  // Todo el dataset de entrenamiento pertenece a Agroexportación (es el
  // único rubro con cotizaciones reales hasta ahora).
  const sinteticosSembrados = await prisma.cotizacion.count({
    where: { notas: "Registro histórico (dataset tesis)" },
  });
  if (sinteticosSembrados === 0) {
    await prisma.cotizacion.createMany({
      data: leerCsvHistorico().map((r) => aCotizacionLiquidada(r, admin.id, agro.id)),
    });
    console.log("✓ 50 cotizaciones LIQUIDADA insertadas (sintéticas del CSV)");
  } else {
    console.log(`✓ Sintéticas ya sembradas (${sinteticosSembrados}) — omitido`);
  }

  const realesSembradas = await prisma.cotizacion.count({
    where: { notas: { startsWith: "Operación real (CNT" } },
  });
  if (realesSembradas === 0) {
    await prisma.cotizacion.createMany({
      data: OPERACIONES_REALES.map((r) =>
        aCotizacionLiquidada(r, admin.id, agro.id, clientesReales[r.cliente]?.id ?? null)
      ),
    });
    console.log(`✓ ${OPERACIONES_REALES.length} operaciones reales insertadas (CONTENEDORES.xlsx, 13 CNT)`);
  } else {
    console.log(`✓ Operaciones reales ya sembradas (${realesSembradas}) — omitido`);
  }

  console.log("✓ Seed completado");
  console.log("\nCuentas creadas (contraseñas NO se imprimen acá):");
  console.log("  admin@frutransport.pe    [ADMIN]");
  console.log("  manager@frutransport.pe  [MANAGER]");
  console.log("  auditor@frutransport.pe  [AUDITOR]");
  console.log("  importador@fresco-asia.com   [CLIENTE]");
  console.log("  compras@supermercados-nl.com [CLIENTE]");
  console.log("\nContraseñas: ver credentials.md, o las variables SEED_*_PASSWORD");
  console.log("que se hayan usado para sembrar (si no se definieron, cada una se");
  console.log("generó aleatoria y ya no es recuperable — hay que activar acceso");
  console.log("de nuevo o resembrar con SEED_*_PASSWORD definidas).");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

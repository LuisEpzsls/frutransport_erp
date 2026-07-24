/**
 * Tests de /api/cotizaciones — autorización por rol y por rubro (Prisma mockeado).
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockCreate = jest.fn();
const mockFindMany = jest.fn().mockResolvedValue([]);
const mockCount = jest.fn().mockResolvedValue(0);
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockDeleteMany = jest.fn();
const mockGastoFindMany = jest.fn().mockResolvedValue([]);
const mockUsuarioDepartamentoFindUnique = jest.fn();
const mockUsuarioDepartamentoFindMany = jest.fn().mockResolvedValue([]);
const mockUsuarioFindMany = jest.fn().mockResolvedValue([]); // sin destinatarios que notificar
const mockNotificacionCreateMany = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    cotizacion: {
      create: mockCreate,
      findMany: mockFindMany,
      count: mockCount,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
    gastoCotizacion: { deleteMany: mockDeleteMany, findMany: mockGastoFindMany },
    usuarioDepartamento: {
      findUnique: mockUsuarioDepartamentoFindUnique,
      findMany: mockUsuarioDepartamentoFindMany,
    },
    usuario: { findMany: mockUsuarioFindMany },
    notificacion: { createMany: mockNotificacionCreateMany },
    $transaction: jest.fn((fn) => fn({
      cotizacion: { update: mockUpdate },
      gastoCotizacion: { deleteMany: mockDeleteMany },
      loteMateriaPrima: { deleteMany: mockDeleteMany },
      loteDescarteVendido: { deleteMany: mockDeleteMany },
    })),
  })),
}));

const app = require('../server');

const tokenDe = (role) =>
  jwt.sign({ id: 'u-test', email: `${role.toLowerCase()}@frutransport.pe`, role }, process.env.JWT_SECRET);

const cotizacionValida = {
  producto: 'Palta Hass',
  destino: 'España',
  volumenTon: 4.8,
  tipoCargamento: 'CONTENEDOR',
  pesoNetoCaja: 4.0,
  porcentajeDescarteEstimado: 0.12,
  costoTotalEstimado: 13178.36,
  departamentoId: 1,
};

beforeEach(() => {
  mockUsuarioDepartamentoFindUnique.mockResolvedValue({ usuarioId: 'u-test', departamentoId: 1 });
});

test('POST /api/cotizaciones sin rol ADMIN/MANAGER devuelve 403', async () => {
  const res = await request(app)
    .post('/api/cotizaciones')
    .set('Authorization', `Bearer ${tokenDe('AUDITOR')}`)
    .send(cotizacionValida);

  expect(res.status).toBe(403);
  expect(res.body.error).toMatch(/permisos/i);
});

test('PATCH /:id/liquidar sin rol ADMIN/MANAGER devuelve 403', async () => {
  const res = await request(app)
    .patch('/api/cotizaciones/1/liquidar')
    .set('Authorization', `Bearer ${tokenDe('AUDITOR')}`)
    .send({ porcentajeDescarteReal: 0.15, costoTotalReal: 14000 });

  expect(res.status).toBe(403);
});

test('POST /api/cotizaciones con datos inválidos devuelve 400 (zod)', async () => {
  const res = await request(app)
    .post('/api/cotizaciones')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({ ...cotizacionValida, porcentajeDescarteEstimado: 1.5, costoTotalEstimado: -10 });

  expect(res.status).toBe(400);
});

test('POST /api/cotizaciones sin departamentoId devuelve 400', async () => {
  const { departamentoId, ...sinDepartamento } = cotizacionValida;
  const res = await request(app)
    .post('/api/cotizaciones')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send(sinDepartamento);

  expect(res.status).toBe(400);
});

test('POST /api/cotizaciones en un rubro sin acceso devuelve 403', async () => {
  mockUsuarioDepartamentoFindUnique.mockResolvedValue(null); // MANAGER sin ese rubro asignado

  const res = await request(app)
    .post('/api/cotizaciones')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send(cotizacionValida);

  expect(res.status).toBe(403);
  expect(res.body.error).toMatch(/rubro/i);
});

test('POST /api/cotizaciones con gastos adicionales los persiste (nested create)', async () => {
  mockCreate.mockResolvedValue({ id: 99, estado: 'PENDIENTE', departamentoId: 1, gastos: [] });

  const res = await request(app)
    .post('/api/cotizaciones')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({
      ...cotizacionValida,
      gastos: [{ concepto: 'Alquiler de jabas', monto: 385, moneda: 'PEN' }],
    });

  expect(res.status).toBe(201);
  const dataEnviada = mockCreate.mock.calls[0][0].data;
  expect(dataEnviada.gastos.create).toEqual([
    { concepto: 'Alquiler de jabas', monto: 385, moneda: 'PEN' },
  ]);
  expect(dataEnviada.departamentoId).toBe(1);
});

test('POST /api/cotizaciones con gasto inválido devuelve 400', async () => {
  const res = await request(app)
    .post('/api/cotizaciones')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({ ...cotizacionValida, gastos: [{ concepto: '', monto: 100 }] });

  expect(res.status).toBe(400);
});

test('POST /api/cotizaciones acepta clienteId opcional', async () => {
  mockCreate.mockResolvedValue({ id: 100, estado: 'PENDIENTE', departamentoId: 1, gastos: [] });

  const res = await request(app)
    .post('/api/cotizaciones')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({ ...cotizacionValida, clienteId: '3fa85f64-5717-4562-b3fc-2c963f66afa6' });

  expect(res.status).toBe(201);
  const ultimaLlamada = mockCreate.mock.calls.at(-1)[0];
  expect(ultimaLlamada.data.clienteId).toBe('3fa85f64-5717-4562-b3fc-2c963f66afa6');
});

test('POST /api/cotizaciones NO asigna numeración todavía (se asigna al aprobar)', async () => {
  mockCreate.mockResolvedValue({ id: 102, estado: 'PENDIENTE', departamentoId: 1, gastos: [] });

  const res = await request(app)
    .post('/api/cotizaciones')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({ ...cotizacionValida, clienteId: '3fa85f64-5717-4562-b3fc-2c963f66afa6' });

  expect(res.status).toBe(201);
  const dataEnviada = mockCreate.mock.calls.at(-1)[0].data;
  expect(dataEnviada.numeroContenedorGeneral).toBeUndefined();
  expect(dataEnviada.numeroContenedorCliente).toBeUndefined();
});

test('GET /api/cotizaciones como CLIENTE se restringe a sus propias cotizaciones', async () => {
  const res = await request(app)
    .get('/api/cotizaciones')
    .set('Authorization', `Bearer ${tokenDe('CLIENTE')}`);

  expect(res.status).toBe(200);
  expect(mockFindMany.mock.calls[0][0].where).toEqual({ clienteId: 'u-test' });
  expect(mockUsuarioDepartamentoFindMany).not.toHaveBeenCalled();
});

test('GET /api/cotizaciones acepta clienteId como filtro (pantalla de Contenedores)', async () => {
  const res = await request(app)
    .get('/api/cotizaciones?departamentoId=1&clienteId=3fa85f64-5717-4562-b3fc-2c963f66afa6')
    .set('Authorization', `Bearer ${tokenDe('ADMIN')}`);

  expect(res.status).toBe(200);
  const where = mockFindMany.mock.calls.at(-1)[0].where;
  expect(where.departamentoId).toBe(1);
  expect(where.clienteId).toBe('3fa85f64-5717-4562-b3fc-2c963f66afa6');
});

test('GET /api/cotizaciones?ordenarPor=contenedor ordena por numeroContenedorGeneral', async () => {
  const res = await request(app)
    .get('/api/cotizaciones?departamentoId=1&ordenarPor=contenedor')
    .set('Authorization', `Bearer ${tokenDe('ADMIN')}`);

  expect(res.status).toBe(200);
  expect(mockFindMany.mock.calls.at(-1)[0].orderBy).toEqual({ numeroContenedorGeneral: 'asc' });
});

test('GET /api/cotizaciones?soloConNumero=true excluye registros sin numeroContenedorGeneral', async () => {
  const res = await request(app)
    .get('/api/cotizaciones?departamentoId=1&soloConNumero=true')
    .set('Authorization', `Bearer ${tokenDe('ADMIN')}`);

  expect(res.status).toBe(200);
  expect(mockFindMany.mock.calls.at(-1)[0].where.numeroContenedorGeneral).toEqual({ not: null });
});

test('POST /api/cotizaciones crea un borrador mínimo (solo producto/destino/departamentoId)', async () => {
  mockCreate.mockResolvedValue({ id: 101, estado: 'PENDIENTE', departamentoId: 1, gastos: [] });

  const res = await request(app)
    .post('/api/cotizaciones')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({ producto: 'Palta Hass', destino: 'España', departamentoId: 1 });

  expect(res.status).toBe(201);
  const dataEnviada = mockCreate.mock.calls.at(-1)[0].data;
  expect(dataEnviada.volumenTon).toBeNull();
  expect(dataEnviada.cajasContenedor).toBeNull();
  expect(dataEnviada.utilidadPct).toBeNull();
});

test('POST /api/cotizaciones acepta los campos de logística y trazabilidad', async () => {
  mockCreate.mockResolvedValue({ id: 104, estado: 'PENDIENTE', departamentoId: 1, gastos: [] });

  const res = await request(app)
    .post('/api/cotizaciones')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({
      ...cotizacionValida,
      numeroBooking: 'BK-2026-0042',
      numeroContenedorLogistica: 'MSCU1234567',
      fechaCosechaInicio: '2026-05-01',
      fechaCosechaFin: '2026-05-03',
      fechaProcesamiento: '2026-05-05',
    });

  expect(res.status).toBe(201);
  const dataEnviada = mockCreate.mock.calls.at(-1)[0].data;
  expect(dataEnviada.numeroBooking).toBe('BK-2026-0042');
  expect(dataEnviada.numeroContenedorLogistica).toBe('MSCU1234567');
  expect(dataEnviada.fechaCosechaInicio).toBeInstanceOf(Date);
});

test('POST /api/cotizaciones acepta recuperoDescarte y lotesMateriaPrima (nested create)', async () => {
  mockCreate.mockResolvedValue({ id: 105, estado: 'PENDIENTE', departamentoId: 1, gastos: [], lotesMateriaPrima: [] });

  const res = await request(app)
    .post('/api/cotizaciones')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({
      ...cotizacionValida,
      recuperoDescarte: 164.99,
      recuperoDescarteMoneda: 'USD',
      lotesMateriaPrima: [
        { etiqueta: 'Primer camión', kg: 6088.60 },
        { etiqueta: 'Segundo camión', kg: 8706.70 },
      ],
    });

  expect(res.status).toBe(201);
  const dataEnviada = mockCreate.mock.calls.at(-1)[0].data;
  expect(dataEnviada.recuperoDescarte).toBe(164.99);
  expect(dataEnviada.recuperoDescarteMoneda).toBe('USD');
  expect(dataEnviada.lotesMateriaPrima.create).toEqual([
    { etiqueta: 'Primer camión', kg: 6088.60 },
    { etiqueta: 'Segundo camión', kg: 8706.70 },
  ]);
});

test('POST /api/cotizaciones acepta lotesDescarteVendido (kg × precio por kg, nested create)', async () => {
  mockCreate.mockResolvedValue({ id: 106, estado: 'PENDIENTE', departamentoId: 1, gastos: [], lotesDescarteVendido: [] });

  const res = await request(app)
    .post('/api/cotizaciones')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({
      ...cotizacionValida,
      lotesDescarteVendido: [
        { kg: 1490.3, precioKg: 0.4, moneda: 'USD' },
        { kg: 30.6, precioKg: 0.2, moneda: 'USD' },
      ],
    });

  expect(res.status).toBe(201);
  const dataEnviada = mockCreate.mock.calls.at(-1)[0].data;
  expect(dataEnviada.lotesDescarteVendido.create).toEqual([
    { kg: 1490.3, precioKg: 0.4, moneda: 'USD' },
    { kg: 30.6, precioKg: 0.2, moneda: 'USD' },
  ]);
});

test('PATCH /api/cotizaciones/:id reemplaza los lotes de materia prima cuando se envían', async () => {
  mockFindUnique.mockResolvedValue({ id: 1, departamentoId: 1, estado: 'PENDIENTE' });
  mockUpdate.mockResolvedValue({ id: 1, estado: 'PENDIENTE', gastos: [], lotesMateriaPrima: [] });

  const res = await request(app)
    .patch('/api/cotizaciones/1')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({ lotesMateriaPrima: [{ etiqueta: 'Complemento 1', kg: 9542.75 }] });

  expect(res.status).toBe(200);
  expect(mockDeleteMany).toHaveBeenCalled();
  const dataEnviada = mockUpdate.mock.calls.at(-1)[0].data;
  expect(dataEnviada.lotesMateriaPrima.create).toEqual([{ etiqueta: 'Complemento 1', kg: 9542.75 }]);
});

test('GET /api/cotizaciones/:id devuelve el detalle', async () => {
  mockFindUnique.mockResolvedValue({ id: 1, departamentoId: 1, clienteId: null, estado: 'PENDIENTE' });

  const res = await request(app)
    .get('/api/cotizaciones/1')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`);

  expect(res.status).toBe(200);
  expect(res.body.data.id).toBe(1);
});

test('GET /api/cotizaciones/:id inexistente devuelve 404', async () => {
  mockFindUnique.mockResolvedValue(null);

  const res = await request(app)
    .get('/api/cotizaciones/999')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`);

  expect(res.status).toBe(404);
});

test('GET /api/cotizaciones/:id en un rubro sin acceso devuelve 403', async () => {
  mockFindUnique.mockResolvedValue({ id: 1, departamentoId: 1, clienteId: null, estado: 'PENDIENTE' });
  mockUsuarioDepartamentoFindUnique.mockResolvedValue(null);

  const res = await request(app)
    .get('/api/cotizaciones/1')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`);

  expect(res.status).toBe(403);
});

test('GET /api/cotizaciones/:id de otro cliente devuelve 404 (no 403, para no confirmar existencia)', async () => {
  mockFindUnique.mockResolvedValue({ id: 1, departamentoId: 1, clienteId: 'otro-cliente', estado: 'PENDIENTE' });

  const res = await request(app)
    .get('/api/cotizaciones/1')
    .set('Authorization', `Bearer ${tokenDe('CLIENTE')}`);

  expect(res.status).toBe(404);
});

test('PATCH /api/cotizaciones/:id autoguarda un borrador PENDIENTE', async () => {
  mockFindUnique.mockResolvedValue({ id: 1, departamentoId: 1, estado: 'PENDIENTE' });
  mockUpdate.mockResolvedValue({ id: 1, estado: 'PENDIENTE', cajasContenedor: 2400, gastos: [] });

  const res = await request(app)
    .patch('/api/cotizaciones/1')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({ cajasContenedor: 2400, utilidadPct: 0.08 });

  expect(res.status).toBe(200);
  expect(mockUpdate.mock.calls.at(-1)[0].data.cajasContenedor).toBe(2400);
});

test('PATCH /api/cotizaciones/:id reemplaza los gastos cuando se envían', async () => {
  mockFindUnique.mockResolvedValue({ id: 1, departamentoId: 1, estado: 'PENDIENTE' });
  mockUpdate.mockResolvedValue({ id: 1, estado: 'PENDIENTE', gastos: [] });

  const res = await request(app)
    .patch('/api/cotizaciones/1')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({ gastos: [{ concepto: 'Flete de camiones', monto: 500, moneda: 'PEN' }] });

  expect(res.status).toBe(200);
  expect(mockDeleteMany).toHaveBeenCalledWith({ where: { cotizacionId: 1 } });
  expect(mockUpdate.mock.calls.at(-1)[0].data.gastos.create).toEqual([
    { concepto: 'Flete de camiones', monto: 500, moneda: 'PEN' },
  ]);
});

test('PATCH /api/cotizaciones/:id sobre una LIQUIDADA devuelve 409', async () => {
  mockFindUnique.mockResolvedValue({ id: 1, departamentoId: 1, estado: 'LIQUIDADA' });

  const res = await request(app)
    .patch('/api/cotizaciones/1')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({ utilidadPct: 0.1 });

  expect(res.status).toBe(409);
});

test('PATCH /api/cotizaciones/:id inexistente devuelve 404', async () => {
  mockFindUnique.mockResolvedValue(null);

  const res = await request(app)
    .patch('/api/cotizaciones/999')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({ utilidadPct: 0.1 });

  expect(res.status).toBe(404);
});

test('PATCH /api/cotizaciones/:id sin rol ADMIN/MANAGER devuelve 403', async () => {
  const res = await request(app)
    .patch('/api/cotizaciones/1')
    .set('Authorization', `Bearer ${tokenDe('AUDITOR')}`)
    .send({ utilidadPct: 0.1 });

  expect(res.status).toBe(403);
});

test('PATCH /:id/liquidar calcula precioVentaReal y precioFobCajaReal desde utilidadRealPct', async () => {
  mockFindUnique.mockResolvedValue({
    id: 1, departamentoId: 1, estado: 'APROBADA', cajasContenedor: 2400,
    kgCosechaComprados: 26000, precioMpKg: 3.486, costoMaquila: 8.5,
    costoAgenciamiento: 1800, costoSli: 2200,
  });
  mockUpdate.mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data }));

  const res = await request(app)
    .patch('/api/cotizaciones/1/liquidar')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({ porcentajeDescarteReal: 0.0585, costoTotalReal: 42977.87, utilidadRealPct: 0.08 });

  expect(res.status).toBe(200);
  expect(res.body.data.precioVentaReal).toBeCloseTo(46416.10, 1);
  expect(res.body.data.precioFobCajaReal).toBeCloseTo(19.34, 1);
});

test('PATCH /:id/liquidar con valorVentaFactura reproduce el resultado real del CNT 01 (pérdida real pese a la utilidad planeada)', async () => {
  mockFindUnique.mockResolvedValue({
    id: 1, departamentoId: 1, estado: 'APROBADA', cajasContenedor: 2400,
    kgCosechaComprados: 30833, precioMpKg: 3.486, costoMaquila: 8.5,
    costoAgenciamiento: 500, costoSli: 1911.6,
  });
  mockUpdate.mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data }));

  const res = await request(app)
    .patch('/api/cotizaciones/1/liquidar')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({
      porcentajeDescarteReal: 0.0585, costoTotalReal: 42977.87, utilidadRealPct: 0.08,
      // Lo REALMENTE facturado (CONTENEDORES.xlsx, hoja CNT 01) — muy por
      // debajo del objetivo (costo + utilidad = 46,416.10).
      valorVentaFactura: 39297.34, valorVentaFacturaMoneda: 'USD',
    });

  expect(res.status).toBe(200);
  expect(res.body.data.valorVentaFactura).toBe(39297.34);
  // 39,297.34 − 42,977.87 = -3,680.53 (Excel: "RESULTADO DEL CNT A COSTO DIRECTO")
  expect(res.body.data.resultadoCostoDirecto).toBeCloseTo(-3680.53, 1);
  // 39,297.34 − 46,416.10 = -7,118.76 (Excel: "RESULTADO DEL CNT CON UTILIDAD")
  expect(res.body.data.resultadoConUtilidad).toBeCloseTo(-7118.76, 1);
});

test('GET /api/cotizaciones/:id sin valorVentaFactura no calcula resultado (queda null)', async () => {
  mockFindUnique.mockResolvedValue({
    id: 1, departamentoId: 1, estado: 'LIQUIDADA', costoTotalReal: 42977.87, precioVentaReal: 46416.10,
    valorVentaFactura: null,
  });

  const res = await request(app)
    .get('/api/cotizaciones/1')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`);

  expect(res.status).toBe(200);
  expect(res.body.data.resultadoCostoDirecto).toBeNull();
  expect(res.body.data.resultadoConUtilidad).toBeNull();
});

test('PATCH /:id/liquidar sobre una PENDIENTE (todavía no aprobada) devuelve 409', async () => {
  mockFindUnique.mockResolvedValue({ id: 1, departamentoId: 1, estado: 'PENDIENTE', cajasContenedor: 2400 });

  const res = await request(app)
    .patch('/api/cotizaciones/1/liquidar')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({ porcentajeDescarteReal: 0.1, costoTotalReal: 1000, utilidadRealPct: 0.08 });

  expect(res.status).toBe(409);
  expect(res.body.error).toMatch(/debe aprobarse/i);
});

test('PATCH /:id/liquidar sin cajasContenedor devuelve 400', async () => {
  mockFindUnique.mockResolvedValue({ id: 1, departamentoId: 1, estado: 'APROBADA', cajasContenedor: null });

  const res = await request(app)
    .patch('/api/cotizaciones/1/liquidar')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({ porcentajeDescarteReal: 0.1, costoTotalReal: 1000, utilidadRealPct: 0.08 });

  expect(res.status).toBe(400);
});

test('PATCH /:id/liquidar con costo de SLI o agenciamiento faltante devuelve 400 y los nombra', async () => {
  mockFindUnique.mockResolvedValue({
    id: 1, departamentoId: 1, estado: 'APROBADA', cajasContenedor: 2400,
    kgCosechaComprados: 26000, precioMpKg: 3.486, costoMaquila: 8.5,
    costoAgenciamiento: null, costoSli: null,
  });

  const res = await request(app)
    .patch('/api/cotizaciones/1/liquidar')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({ porcentajeDescarteReal: 0.1, costoTotalReal: 1000, utilidadRealPct: 0.08 });

  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/costo de agenciamiento/i);
  expect(res.body.error).toMatch(/costo de SLI/i);
});

// ── PATCH /api/cotizaciones/:id/aprobar ────────────────────────────────────
test('PATCH /:id/aprobar asigna numeración y pasa a APROBADA', async () => {
  mockFindUnique.mockResolvedValue({
    id: 1, departamentoId: 1, estado: 'PENDIENTE', clienteId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    kgCosechaComprados: 26000, precioMpKg: 3.486, cajasContenedor: 2400,
    costoMaquila: 8.5, costoAgenciamiento: 1800, costoSli: 2200,
  });
  mockCount
    .mockResolvedValueOnce(13) // 13 CNT reales ya cargados (dataset sintético excluido)
    .mockResolvedValueOnce(2); // 2 cotizaciones previas de este cliente
  mockUpdate.mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data }));

  const res = await request(app)
    .patch('/api/cotizaciones/1/aprobar')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`);

  expect(res.status).toBe(200);
  expect(res.body.data.estado).toBe('APROBADA');
  expect(res.body.data.numeroContenedorGeneral).toBe(14);
  expect(res.body.data.numeroContenedorCliente).toBe(3);
  // Los mocks no se limpian entre tests: -2 es la primera de las dos
  // llamadas a count() que hace ESTE test (general, luego cliente).
  const filtroConteoGeneral = mockCount.mock.calls.at(-2)[0].where;
  expect(filtroConteoGeneral.OR).toEqual([
    { notas: { not: 'Registro histórico (dataset tesis)' } },
    { notas: null },
  ]);
  // La fila ya existe como PENDIENTE al momento de aprobar (a diferencia de
  // cuando esto se calculaba en crear()) — sin excluirse a sí misma con
  // `id: { not }`, el conteo se cuenta de más (off-by-one, reproducido en
  // verificación manual contra Docker).
  expect(filtroConteoGeneral.id).toEqual({ not: 1 });
  expect(mockCount.mock.calls.at(-1)[0].where.id).toEqual({ not: 1 });
});

test('PATCH /:id/aprobar sin clienteId deja numeroContenedorCliente en null', async () => {
  mockFindUnique.mockResolvedValue({
    id: 1, departamentoId: 1, estado: 'PENDIENTE', clienteId: null,
    kgCosechaComprados: 26000, precioMpKg: 3.486, cajasContenedor: 2400,
    costoMaquila: 8.5, costoAgenciamiento: 1800, costoSli: 2200,
  });
  mockCount.mockResolvedValueOnce(0);
  mockUpdate.mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data }));

  const res = await request(app)
    .patch('/api/cotizaciones/1/aprobar')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`);

  expect(res.status).toBe(200);
  expect(res.body.data.numeroContenedorGeneral).toBe(1);
  expect(res.body.data.numeroContenedorCliente).toBeNull();
});

test('PATCH /:id/aprobar acepta valorVentaOc opcional (venta pactada en la orden/contrato)', async () => {
  mockFindUnique.mockResolvedValue({
    id: 1, departamentoId: 1, estado: 'PENDIENTE', clienteId: null,
    kgCosechaComprados: 26000, precioMpKg: 3.486, cajasContenedor: 2400,
    costoMaquila: 8.5, costoAgenciamiento: 1800, costoSli: 2200,
  });
  mockCount.mockResolvedValueOnce(0);
  mockUpdate.mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data }));

  const res = await request(app)
    .patch('/api/cotizaciones/1/aprobar')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({ valorVentaOc: 44352, valorVentaOcMoneda: 'USD' });

  expect(res.status).toBe(200);
  expect(res.body.data.valorVentaOc).toBe(44352);
  expect(res.body.data.valorVentaOcMoneda).toBe('USD');
});

test('PATCH /:id/aprobar con componentes de costo faltantes devuelve 400', async () => {
  mockFindUnique.mockResolvedValue({ id: 1, departamentoId: 1, estado: 'PENDIENTE', cajasContenedor: null });

  const res = await request(app)
    .patch('/api/cotizaciones/1/aprobar')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`);

  expect(res.status).toBe(400);
});

test('PATCH /:id/aprobar sobre una cotización que no está PENDIENTE devuelve 409', async () => {
  mockFindUnique.mockResolvedValue({ id: 1, departamentoId: 1, estado: 'APROBADA' });

  const res = await request(app)
    .patch('/api/cotizaciones/1/aprobar')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`);

  expect(res.status).toBe(409);
});

test('PATCH /:id/aprobar inexistente devuelve 404', async () => {
  mockFindUnique.mockResolvedValue(null);

  const res = await request(app)
    .patch('/api/cotizaciones/1/aprobar')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`);

  expect(res.status).toBe(404);
});

test('PATCH /:id/aprobar sin rol ADMIN/MANAGER devuelve 403', async () => {
  const res = await request(app)
    .patch('/api/cotizaciones/1/aprobar')
    .set('Authorization', `Bearer ${tokenDe('AUDITOR')}`);

  expect(res.status).toBe(403);
});

// ── PATCH /api/cotizaciones/:id/reabrir ────────────────────────────────────
test('PATCH /:id/reabrir de LIQUIDADA vuelve a APROBADA y limpia los valores reales', async () => {
  mockFindUnique.mockResolvedValue({ id: 1, departamentoId: 1, estado: 'LIQUIDADA' });
  mockUpdate.mockImplementation(({ data }) => Promise.resolve({ id: 1, estado: 'LIQUIDADA', ...data }));

  const res = await request(app)
    .patch('/api/cotizaciones/1/reabrir')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`);

  expect(res.status).toBe(200);
  expect(res.body.data.estado).toBe('APROBADA');
  expect(res.body.data.costoTotalReal).toBeNull();
  expect(res.body.data.valorVentaFactura).toBeNull();
  const dataEnviada = mockUpdate.mock.calls.at(-1)[0].data;
  expect(dataEnviada.porcentajeDescarteReal).toBeNull();
  expect(dataEnviada.precioVentaReal).toBeNull();
  expect(dataEnviada.precioFobCajaReal).toBeNull();
});

test('PATCH /:id/reabrir de APROBADA vuelve a PENDIENTE y limpia la numeración y venta O/C', async () => {
  mockFindUnique.mockResolvedValue({ id: 1, departamentoId: 1, estado: 'APROBADA' });
  mockUpdate.mockImplementation(({ data }) => Promise.resolve({ id: 1, estado: 'APROBADA', ...data }));

  const res = await request(app)
    .patch('/api/cotizaciones/1/reabrir')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`);

  expect(res.status).toBe(200);
  expect(res.body.data.estado).toBe('PENDIENTE');
  const dataEnviada = mockUpdate.mock.calls.at(-1)[0].data;
  expect(dataEnviada.numeroContenedorGeneral).toBeNull();
  expect(dataEnviada.numeroContenedorCliente).toBeNull();
  expect(dataEnviada.valorVentaOc).toBeNull();
});

test('PATCH /:id/reabrir sobre una PENDIENTE devuelve 409 (ya está abierta)', async () => {
  mockFindUnique.mockResolvedValue({ id: 1, departamentoId: 1, estado: 'PENDIENTE' });

  const res = await request(app)
    .patch('/api/cotizaciones/1/reabrir')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`);

  expect(res.status).toBe(409);
});

test('PATCH /:id/reabrir inexistente devuelve 404', async () => {
  mockFindUnique.mockResolvedValue(null);

  const res = await request(app)
    .patch('/api/cotizaciones/1/reabrir')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`);

  expect(res.status).toBe(404);
});

test('PATCH /:id/reabrir en un rubro sin acceso devuelve 403', async () => {
  mockFindUnique.mockResolvedValue({ id: 1, departamentoId: 1, estado: 'APROBADA' });
  mockUsuarioDepartamentoFindUnique.mockResolvedValueOnce(null);

  const res = await request(app)
    .patch('/api/cotizaciones/1/reabrir')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`);

  expect(res.status).toBe(403);
});

test('PATCH /:id/reabrir sin rol ADMIN/MANAGER devuelve 403', async () => {
  const res = await request(app)
    .patch('/api/cotizaciones/1/reabrir')
    .set('Authorization', `Bearer ${tokenDe('AUDITOR')}`);

  expect(res.status).toBe(403);
});

test('GET /api/cotizaciones/gastos-habituales devuelve la línea base sin suficiente histórico', async () => {
  mockCount.mockResolvedValue(2); // menos de MINIMO_MUESTRAS_HISTORICO

  const res = await request(app)
    .get('/api/cotizaciones/gastos-habituales')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`);

  expect(res.status).toBe(200);
  expect(res.body.origen).toBe('linea_base');
  expect(res.body.gastos.length).toBeGreaterThan(0);
  expect(res.body.gastos[0].frecuencia).toBeNull();
  expect(res.body.estadisticasMonto).toEqual({});
  expect(mockGastoFindMany).not.toHaveBeenCalled();
});

test('GET /api/cotizaciones/gastos-habituales calcula frecuencias y estadísticas de monto (mediana + MAD) con histórico suficiente', async () => {
  mockCount.mockResolvedValue(10);
  mockGastoFindMany.mockResolvedValue([
    ...[100, 102, 98, 101, 99, 103, 97, 100, 150].map((monto) => ({
      concepto: 'Flete de camiones', monto, moneda: 'USD', cotizacion: { tipoCambio: null },
    })),
    { concepto: 'Gasto raro', monto: 50, moneda: 'USD', cotizacion: { tipoCambio: null } },
  ]);

  const res = await request(app)
    .get('/api/cotizaciones/gastos-habituales')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`);

  expect(res.status).toBe(200);
  expect(res.body.origen).toBe('historico');
  expect(res.body.gastos).toEqual([
    { concepto: 'Flete de camiones', frecuencia: 0.9, vecesUsado: 9 },
  ]);
  // mediana de [97,98,99,100,100,101,102,103,150] = 100; MAD de las desviaciones = 2
  expect(res.body.estadisticasMonto['Flete de camiones']).toEqual({ medianaUsd: 100, madUsd: 2, n: 9 });
  // 'Gasto raro' tiene una sola muestra: por debajo de MINIMO_MUESTRAS_HISTORICO, sin estadística
  expect(res.body.estadisticasMonto['Gasto raro']).toBeUndefined();
});

test('GET /api/cotizaciones/gastos-habituales convierte montos PEN con el tipo de cambio de cada cotización y descarta los que no tienen TC', async () => {
  mockCount.mockResolvedValue(5);
  mockGastoFindMany.mockResolvedValue([
    { concepto: 'Alquiler de jabas', monto: 372, moneda: 'PEN', cotizacion: { tipoCambio: 3.72 } }, // 100 USD
    { concepto: 'Alquiler de jabas', monto: 100, moneda: 'USD', cotizacion: { tipoCambio: null } },
    { concepto: 'Alquiler de jabas', monto: 372, moneda: 'PEN', cotizacion: { tipoCambio: 3.72 } }, // 100 USD
    { concepto: 'Alquiler de jabas', monto: 100, moneda: 'USD', cotizacion: { tipoCambio: null } },
    { concepto: 'Alquiler de jabas', monto: 372, moneda: 'PEN', cotizacion: { tipoCambio: null } }, // sin TC: se descarta
  ]);

  const res = await request(app)
    .get('/api/cotizaciones/gastos-habituales')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`);

  expect(res.status).toBe(200);
  // 4 de las 5 filas se pudieron convertir (100 USD c/u) — la 5ª se descartó por no tener TC
  expect(res.body.gastos).toEqual([
    { concepto: 'Alquiler de jabas', frecuencia: 0.8, vecesUsado: 4 },
  ]);
  // 4 muestras < MINIMO_MUESTRAS_HISTORICO (5): todavía sin estadística de monto
  expect(res.body.estadisticasMonto['Alquiler de jabas']).toBeUndefined();
});

test('GET /api/cotizaciones/gastos-habituales sin rol ADMIN/MANAGER devuelve 403', async () => {
  const res = await request(app)
    .get('/api/cotizaciones/gastos-habituales')
    .set('Authorization', `Bearer ${tokenDe('AUDITOR')}`);

  expect(res.status).toBe(403);
});

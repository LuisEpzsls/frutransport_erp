/**
 * Tests de /api/tipo-cambio — proxy cacheado a la API pública de SUNAT.
 * Orden importa: el servicio cachea por fecha en memoria (module-level), así
 * que el caso de fallo va antes de que cualquier consulta exitosa lo cachee.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({})),
}));

const app = require('../server');

const token = jwt.sign(
  { id: 'u-test', email: 'test@frutransport.pe', role: 'ADMIN' },
  process.env.JWT_SECRET
);

afterEach(() => {
  delete global.fetch;
});

test('sin token devuelve 401', async () => {
  const res = await request(app).get('/api/tipo-cambio');
  expect(res.status).toBe(401);
});

test('fecha con formato inválido devuelve 400', async () => {
  const res = await request(app)
    .get('/api/tipo-cambio?fecha=11-07-2026')
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(400);
});

test('si SUNAT falla devuelve 503', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502 });

  const res = await request(app)
    .get('/api/tipo-cambio?fecha=2020-01-01')
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(503);
});

test('rate-limit de SUNAT (429) se traduce a un mensaje claro', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 });

  const res = await request(app)
    .get('/api/tipo-cambio?fecha=2020-01-02')
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(503);
  expect(res.body.detalle).toMatch(/limitó|intenta en unos minutos/i);
});

test('devuelve compra/venta/fecha del día', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ origen: 'SUNAT', compra: 3.388, venta: 3.397, moneda: 'USD', fecha: '2026-07-11' }),
  });

  const res = await request(app)
    .get('/api/tipo-cambio')
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ compra: 3.388, venta: 3.397, fecha: '2026-07-11', fuente: 'SUNAT' });
});

test('consulta una fecha histórica distinta a la del día', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ origen: 'SUNAT', compra: 3.354, venta: 3.367, moneda: 'USD', fecha: '2026-01-15' }),
  });

  const res = await request(app)
    .get('/api/tipo-cambio?fecha=2026-01-15')
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ venta: 3.367, fecha: '2026-01-15' });
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('fecha=2026-01-15'));
});

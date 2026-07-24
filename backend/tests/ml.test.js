/**
 * Tests de /api/ml/predict — el fetch al motor ML se mockea siempre.
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

const payloadValido = {
  producto: 'Palta Hass',
  destino: 'España',
  precio_mp_kg: 4.2,
  peso_neto_caja: 4.0,
  cajas_contenedor: 1200,
  kg_cosecha_comprados: 5500,
  costo_maquila: 8.5,
  tipo_cambio: 3.72,
  costo_agenciamiento: 1800,
  costo_sli: 2200,
  utilidad_pct: 0.08,
};

afterEach(() => {
  delete global.fetch;
});

test('bloquea operaciones con descarte >= 60%', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ porcentaje_descarte: 0.65, mae: 0.004, r2: 0.97, modelo_nombre: 'RF' }),
  });

  const res = await request(app)
    .post('/api/ml/predict')
    .set('Authorization', `Bearer ${token}`)
    .send(payloadValido);

  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/demasiado alta/);
});

test('campos faltantes devuelve 400', async () => {
  const res = await request(app)
    .post('/api/ml/predict')
    .set('Authorization', `Bearer ${token}`)
    .send({ producto: 'Palta Hass', destino: 'España' });

  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/faltantes o inválidos/i);
});

test('predicción válida responde con estimación y cotizacion_sugerida', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ porcentaje_descarte: 0.12, mae: 0.005, r2: 0.97, modelo_nombre: 'Random Forest' }),
  });

  const res = await request(app)
    .post('/api/ml/predict')
    .set('Authorization', `Bearer ${token}`)
    .send(payloadValido);

  expect(res.status).toBe(200);
  expect(res.body.estimacion_pre_compra.costo_total_estimado).toBeGreaterThan(0);
  expect(res.body.metadatos_ml.porcentaje_descarte_estimado).toBe(0.12);
  expect(res.body.cotizacion_sugerida).toMatchObject({
    producto: 'Palta Hass',
    destino: 'España',
    precioMpKg: 4.2,
  });
});

test('sin token devuelve 401', async () => {
  const res = await request(app).post('/api/ml/predict').send(payloadValido);
  expect(res.status).toBe(401);
});

test('gastos adicionales se suman al costo total (PEN convertido por tipo de cambio)', async () => {
  const mockML = () => jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ porcentaje_descarte: 0.12, mae: 0.005, r2: 0.97, modelo_nombre: 'GB' }),
  });

  global.fetch = mockML();
  const sinGastos = await request(app)
    .post('/api/ml/predict')
    .set('Authorization', `Bearer ${token}`)
    .send(payloadValido);

  global.fetch = mockML();
  const conGastos = await request(app)
    .post('/api/ml/predict')
    .set('Authorization', `Bearer ${token}`)
    .send({
      ...payloadValido,
      // 744 PEN / 3.72 = 200 USD · recupero de -50 USD → neto +150 USD
      gastos_adicionales: [
        { concepto: 'Flete de camiones', monto: 744, moneda: 'PEN' },
        { concepto: 'Recupero venta de descarte', monto: -50, moneda: 'USD' },
      ],
    });

  expect(conGastos.status).toBe(200);
  const delta = conGastos.body.estimacion_pre_compra.costo_total_estimado -
                sinGastos.body.estimacion_pre_compra.costo_total_estimado;
  expect(delta).toBeCloseTo(150, 1);
  expect(conGastos.body.estimacion_pre_compra.desglose.gastos_adicionales_total).toBeCloseTo(150, 1);
  expect(conGastos.body.cotizacion_sugerida.gastos).toHaveLength(2);
});

test('recupero_descarte (campo dedicado) se resta del costo total', async () => {
  const mockML = () => jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ porcentaje_descarte: 0.0585, mae: 0.005, r2: 0.97, modelo_nombre: 'GB' }),
  });

  global.fetch = mockML();
  const sinRecupero = await request(app)
    .post('/api/ml/predict')
    .set('Authorization', `Bearer ${token}`)
    .send(payloadValido);

  global.fetch = mockML();
  const conRecupero = await request(app)
    .post('/api/ml/predict')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...payloadValido, recupero_descarte: 164.99, recupero_descarte_moneda: 'USD' });

  expect(conRecupero.status).toBe(200);
  const delta = sinRecupero.body.estimacion_pre_compra.costo_total_estimado -
                conRecupero.body.estimacion_pre_compra.costo_total_estimado;
  expect(delta).toBeCloseTo(164.99, 1);
  expect(conRecupero.body.estimacion_pre_compra.desglose.recupero_descarte).toBeCloseTo(-164.99, 1);
  expect(conRecupero.body.cotizacion_sugerida.recuperoDescarte).toBe(164.99);
  // Sin recupero: no debe aparecer la línea en el desglose (tabla limpia)
  expect(sinRecupero.body.estimacion_pre_compra.desglose.recupero_descarte).toBeUndefined();
});

test('recupero_descarte en PEN se convierte con el tipo de cambio', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ porcentaje_descarte: 0.0585, mae: 0.005, r2: 0.97, modelo_nombre: 'GB' }),
  });

  const res = await request(app)
    .post('/api/ml/predict')
    .set('Authorization', `Bearer ${token}`)
    // 613.68 PEN / 3.72 = 165 USD
    .send({ ...payloadValido, recupero_descarte: 613.68, recupero_descarte_moneda: 'PEN' });

  expect(res.status).toBe(200);
  expect(res.body.estimacion_pre_compra.desglose.recupero_descarte).toBeCloseTo(-165, 1);
});

test('gasto adicional con monto 0 devuelve 400', async () => {
  const res = await request(app)
    .post('/api/ml/predict')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...payloadValido, gastos_adicionales: [{ concepto: 'X', monto: 0 }] });

  expect(res.status).toBe(400);
});

test('costo_agenciamiento por defecto se interpreta en USD (sin convertir)', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ porcentaje_descarte: 0.12, mae: 0.005, r2: 0.97, modelo_nombre: 'GB' }),
  });

  const res = await request(app)
    .post('/api/ml/predict')
    .set('Authorization', `Bearer ${token}`)
    .send(payloadValido); // costo_agenciamiento: 1800, sin moneda explícita

  expect(res.status).toBe(200);
  expect(res.body.estimacion_pre_compra.desglose.agenciamiento).toBeCloseTo(1800, 1);
});

test('costo_agenciamiento en PEN se convierte con el tipo de cambio', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ porcentaje_descarte: 0.12, mae: 0.005, r2: 0.97, modelo_nombre: 'GB' }),
  });

  const res = await request(app)
    .post('/api/ml/predict')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...payloadValido, costo_agenciamiento_moneda: 'PEN' }); // 1800 / 3.72

  expect(res.status).toBe(200);
  expect(res.body.estimacion_pre_compra.desglose.agenciamiento).toBeCloseTo(1800 / 3.72, 1);
});

test('no existe campo de flete maritimo en el desglose (ventas FOB)', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ porcentaje_descarte: 0.12, mae: 0.005, r2: 0.97, modelo_nombre: 'GB' }),
  });

  const res = await request(app)
    .post('/api/ml/predict')
    .set('Authorization', `Bearer ${token}`)
    .send(payloadValido);

  expect(res.body.estimacion_pre_compra.desglose).not.toHaveProperty('flete');
});

test('GET /api/ml/categorias devuelve las clases entrenadas del motor', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ producto: ['Palta Hass', 'Mandarina Malvacea'], destino: ['España', 'Nacional'] }),
  });

  const res = await request(app).get('/api/ml/categorias').set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
  expect(res.body.producto).toContain('Palta Hass');
});

test('GET /api/ml/categorias sin token devuelve 401', async () => {
  const res = await request(app).get('/api/ml/categorias');
  expect(res.status).toBe(401);
});

test('GET /api/ml/categorias con motor caído devuelve 503', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

  const res = await request(app).get('/api/ml/categorias').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(503);
});

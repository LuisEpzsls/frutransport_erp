/**
 * Tests de /api/productos y /api/destinos — catálogo simple (factory
 * compartida en services/catalogoSimple.js). Se prueba una sola vez con
 * /api/productos; la lógica de /api/destinos es idéntica (misma factory).
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    producto: { findMany: mockFindMany, findUnique: mockFindUnique, create: mockCreate, update: mockUpdate },
    destino: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  })),
}));

const app = require('../server');

const tokenDe = (role) =>
  jwt.sign({ id: 'u-test', email: `${role.toLowerCase()}@frutransport.pe`, role }, process.env.JWT_SECRET);

test('cualquier rol autenticado puede listar productos', async () => {
  mockFindMany.mockResolvedValue([{ id: 1, nombre: 'Palta Hass', activo: true }]);
  const res = await request(app).get('/api/productos').set('Authorization', `Bearer ${tokenDe('MANAGER')}`);
  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(1);
});

test('sin token devuelve 401', async () => {
  const res = await request(app).get('/api/productos');
  expect(res.status).toBe(401);
});

test('MANAGER no puede crear productos (403)', async () => {
  const res = await request(app)
    .post('/api/productos')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({ nombre: 'Uva Red Globe' });
  expect(res.status).toBe(403);
});

test('ADMIN crea un producto nuevo', async () => {
  mockFindUnique.mockResolvedValue(null);
  mockCreate.mockResolvedValue({ id: 5, nombre: 'Uva Red Globe', activo: true });

  const res = await request(app)
    .post('/api/productos')
    .set('Authorization', `Bearer ${tokenDe('ADMIN')}`)
    .send({ nombre: 'Uva Red Globe' });

  expect(res.status).toBe(201);
  expect(res.body.data.nombre).toBe('Uva Red Globe');
});

test('crear producto duplicado devuelve 409', async () => {
  mockFindUnique.mockResolvedValue({ id: 1, nombre: 'Palta Hass' });

  const res = await request(app)
    .post('/api/productos')
    .set('Authorization', `Bearer ${tokenDe('ADMIN')}`)
    .send({ nombre: 'Palta Hass' });

  expect(res.status).toBe(409);
});

test('crear producto sin nombre devuelve 400', async () => {
  const res = await request(app)
    .post('/api/productos')
    .set('Authorization', `Bearer ${tokenDe('ADMIN')}`)
    .send({});
  expect(res.status).toBe(400);
});

test('ADMIN desactiva un producto', async () => {
  mockUpdate.mockResolvedValue({ id: 1, nombre: 'Palta Hass', activo: false });

  const res = await request(app)
    .patch('/api/productos/1')
    .set('Authorization', `Bearer ${tokenDe('ADMIN')}`)
    .send({ activo: false });

  expect(res.status).toBe(200);
  expect(res.body.data.activo).toBe(false);
});

test('actualizar producto inexistente devuelve 404', async () => {
  mockUpdate.mockRejectedValue({ code: 'P2025' });

  const res = await request(app)
    .patch('/api/productos/999')
    .set('Authorization', `Bearer ${tokenDe('ADMIN')}`)
    .send({ activo: false });

  expect(res.status).toBe(404);
});

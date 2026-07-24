/**
 * Tests de /api/notificaciones — central propia del usuario autenticado.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockUpdateMany = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    notificacion: { findMany: mockFindMany, count: mockCount, updateMany: mockUpdateMany },
  })),
}));

const app = require('../server');

const token = jwt.sign({ id: 'u-1', email: 'admin@frutransport.pe', role: 'ADMIN' }, process.env.JWT_SECRET);

test('sin token devuelve 401', async () => {
  const res = await request(app).get('/api/notificaciones');
  expect(res.status).toBe(401);
});

test('lista notificaciones propias con conteo de no leídas', async () => {
  mockFindMany.mockResolvedValue([{ id: 1, mensaje: 'Nueva cotización #1', leida: false }]);
  mockCount.mockResolvedValue(1);

  const res = await request(app).get('/api/notificaciones').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.body.noLeidas).toBe(1);
  expect(res.body.data).toHaveLength(1);
});

test('marcar una notificación ajena como leída devuelve 404', async () => {
  mockUpdateMany.mockResolvedValue({ count: 0 });

  const res = await request(app).patch('/api/notificaciones/99/leer').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(404);
});

test('marcar todas como leídas responde ok', async () => {
  mockUpdateMany.mockResolvedValue({ count: 3 });

  const res = await request(app).patch('/api/notificaciones/leer-todas').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
});

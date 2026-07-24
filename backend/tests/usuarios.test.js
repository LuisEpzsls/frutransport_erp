/**
 * Tests de /api/usuarios — control de usuarios, exclusivo de ADMIN.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockTransaction = jest.fn((ops) => Promise.all(ops));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    usuario: { findMany: mockFindMany, findUnique: mockFindUnique, create: mockCreate, update: mockUpdate },
    usuarioDepartamento: { deleteMany: jest.fn(), createMany: jest.fn() },
    $transaction: mockTransaction,
  })),
}));

const app = require('../server');

const tokenDe = (role, id = 'u-admin') =>
  jwt.sign({ id, email: `${role.toLowerCase()}@frutransport.pe`, role }, process.env.JWT_SECRET);

test('MANAGER no puede listar usuarios (403)', async () => {
  const res = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${tokenDe('MANAGER')}`);
  expect(res.status).toBe(403);
});

test('ADMIN lista usuarios con sus departamentos', async () => {
  mockFindMany.mockResolvedValue([
    { id: 'u-1', email: 'manager@frutransport.pe', role: 'MANAGER', activo: true, creadoEn: new Date(),
      departamentos: [{ departamento: { id: 1, nombre: 'Agroexportación', slug: 'agroexport' } }] },
  ]);

  const res = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${tokenDe('ADMIN')}`);
  expect(res.status).toBe(200);
  expect(res.body.data[0].departamentos).toEqual([{ id: 1, nombre: 'Agroexportación', slug: 'agroexport' }]);
});

test('crear usuario con password corta devuelve 400', async () => {
  const res = await request(app)
    .post('/api/usuarios')
    .set('Authorization', `Bearer ${tokenDe('ADMIN')}`)
    .send({ email: 'x@frutransport.pe', password: '123', role: 'MANAGER' });

  expect(res.status).toBe(400);
});

test('crear usuario con email duplicado devuelve 409', async () => {
  mockFindUnique.mockResolvedValue({ id: 'existe', email: 'ya@frutransport.pe' });

  const res = await request(app)
    .post('/api/usuarios')
    .set('Authorization', `Bearer ${tokenDe('ADMIN')}`)
    .send({ email: 'ya@frutransport.pe', password: 'Segura1234', role: 'MANAGER' });

  expect(res.status).toBe(409);
});

test('crear usuario válido devuelve 201', async () => {
  mockFindUnique.mockResolvedValue(null);
  mockCreate.mockResolvedValue({
    id: 'u-nuevo', email: 'nuevo@frutransport.pe', role: 'MANAGER', activo: true, creadoEn: new Date(), departamentos: [],
  });

  const res = await request(app)
    .post('/api/usuarios')
    .set('Authorization', `Bearer ${tokenDe('ADMIN')}`)
    .send({ email: 'nuevo@frutransport.pe', password: 'Segura1234', role: 'MANAGER' });

  expect(res.status).toBe(201);
});

test('ADMIN no puede desactivar su propia cuenta', async () => {
  const res = await request(app)
    .patch('/api/usuarios/u-admin')
    .set('Authorization', `Bearer ${tokenDe('ADMIN', 'u-admin')}`)
    .send({ activo: false });

  expect(res.status).toBe(400);
});

test('actualizar usuario inexistente devuelve 404', async () => {
  mockUpdate.mockRejectedValue({ code: 'P2025' });

  const res = await request(app)
    .patch('/api/usuarios/no-existe')
    .set('Authorization', `Bearer ${tokenDe('ADMIN')}`)
    .send({ activo: false });

  expect(res.status).toBe(404);
});

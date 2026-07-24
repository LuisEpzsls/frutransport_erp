/**
 * Tests de /api/auth/login — Prisma mockeado (sin BD real).
 * Cubre tanto `usuarios` (staff ERP) como `clientes` (portal externo).
 */
const request = require('supertest');
const bcrypt = require('bcryptjs');

const mockUsuarioFindUnique = jest.fn();
const mockClienteFindUnique = jest.fn();
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    usuario: { findUnique: mockUsuarioFindUnique },
    cliente: { findUnique: mockClienteFindUnique },
  })),
}));

const app = require('../server');

beforeEach(() => {
  mockUsuarioFindUnique.mockReset();
  mockClienteFindUnique.mockReset();
});

test('login inválido devuelve 401', async () => {
  mockUsuarioFindUnique.mockResolvedValue(null);
  mockClienteFindUnique.mockResolvedValue(null);

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'noexiste@frutransport.pe', password: 'incorrecta' });

  expect(res.status).toBe(401);
  expect(res.body.error).toMatch(/incorrectas/i);
});

test('login sin credenciales devuelve 400', async () => {
  const res = await request(app).post('/api/auth/login').send({});
  expect(res.status).toBe(400);
});

test('login de cliente (no está en usuarios, sí en clientes) devuelve role CLIENTE', async () => {
  mockUsuarioFindUnique.mockResolvedValue(null);
  mockClienteFindUnique.mockResolvedValue({
    id: 'c-1',
    email: 'importador@fresco-asia.com',
    passwordHash: await bcrypt.hash('TestFixturePwd987', 10),
    activo: true,
  });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'importador@fresco-asia.com', password: 'TestFixturePwd987' });

  expect(res.status).toBe(200);
  expect(res.body.user.role).toBe('CLIENTE');
  expect(res.body.token).toBeDefined();
});

test('login de cliente con password incorrecta devuelve 401', async () => {
  mockUsuarioFindUnique.mockResolvedValue(null);
  mockClienteFindUnique.mockResolvedValue({
    id: 'c-1',
    email: 'importador@fresco-asia.com',
    passwordHash: await bcrypt.hash('TestFixturePwd987', 10),
    activo: true,
  });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'importador@fresco-asia.com', password: 'mala' });

  expect(res.status).toBe(401);
});

test('cliente creado sin acceso (passwordHash null) no puede iniciar sesión', async () => {
  mockUsuarioFindUnique.mockResolvedValue(null);
  mockClienteFindUnique.mockResolvedValue({
    id: 'c-2',
    email: 'sinacceso@cliente.com',
    passwordHash: null,
    activo: true,
  });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'sinacceso@cliente.com', password: 'cualquiera' });

  expect(res.status).toBe(401);
});

test('cliente inactivo no puede iniciar sesión', async () => {
  mockUsuarioFindUnique.mockResolvedValue(null);
  mockClienteFindUnique.mockResolvedValue({
    id: 'c-1',
    email: 'baja@cliente.com',
    passwordHash: await bcrypt.hash('TestFixturePwd987', 10),
    activo: false,
  });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'baja@cliente.com', password: 'TestFixturePwd987' });

  expect(res.status).toBe(401);
});

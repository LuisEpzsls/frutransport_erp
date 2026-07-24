/**
 * Tests de /api/clientes — directorio + alta sin acceso + activar acceso.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    cliente: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
    },
  })),
}));

const app = require('../server');

const tokenDe = (role) =>
  jwt.sign({ id: 'u-test', email: `${role.toLowerCase()}@frutransport.pe`, role }, process.env.JWT_SECRET);

beforeEach(() => {
  mockFindMany.mockReset();
  mockFindUnique.mockReset();
  mockCreate.mockReset();
  mockUpdate.mockReset();
});

test('AUDITOR no puede ver el directorio de clientes (403)', async () => {
  const res = await request(app).get('/api/clientes').set('Authorization', `Bearer ${tokenDe('AUDITOR')}`);
  expect(res.status).toBe(403);
});

test('ADMIN lista el directorio de clientes con tieneAcceso derivado', async () => {
  mockFindMany.mockResolvedValue([
    { id: 'c-1', email: 'importador@fresco-asia.com', nombreCompleto: 'Zhang Wei', passwordHash: 'hash-x' },
    { id: 'c-2', email: 'sinacceso@fresco-asia.com', nombreCompleto: 'Ana Ruiz', passwordHash: null },
  ]);

  const res = await request(app).get('/api/clientes').set('Authorization', `Bearer ${tokenDe('ADMIN')}`);
  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(2);
  expect(res.body.data[0].tieneAcceso).toBe(true);
  expect(res.body.data[1].tieneAcceso).toBe(false);
  expect(res.body.data[0].passwordHash).toBeUndefined();
});

test('MANAGER también puede ver el directorio de clientes', async () => {
  mockFindMany.mockResolvedValue([]);
  const res = await request(app).get('/api/clientes').set('Authorization', `Bearer ${tokenDe('MANAGER')}`);
  expect(res.status).toBe(200);
});

test('ADMIN crea un cliente sin password (alta rápida)', async () => {
  mockFindUnique.mockResolvedValue(null);
  mockCreate.mockResolvedValue({
    id: 'c-3', email: 'nuevo@cliente.com', nombreCompleto: 'Nuevo Cliente',
    empresa: null, pais: null, telefono: null, verificado: false, activo: true,
    creadoEn: new Date(), passwordHash: null,
  });

  const res = await request(app)
    .post('/api/clientes')
    .set('Authorization', `Bearer ${tokenDe('ADMIN')}`)
    .send({ nombreCompleto: 'Nuevo Cliente', email: 'nuevo@cliente.com' });

  expect(res.status).toBe(201);
  expect(res.body.data.tieneAcceso).toBe(false);
});

test('crear cliente con email duplicado devuelve 409', async () => {
  mockFindUnique.mockResolvedValue({ id: 'c-existente' });

  const res = await request(app)
    .post('/api/clientes')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({ nombreCompleto: 'Dup', email: 'dup@cliente.com' });

  expect(res.status).toBe(409);
});

test('crear cliente sin email devuelve 400', async () => {
  const res = await request(app)
    .post('/api/clientes')
    .set('Authorization', `Bearer ${tokenDe('ADMIN')}`)
    .send({ nombreCompleto: 'Sin Email' });

  expect(res.status).toBe(400);
});

test('AUDITOR no puede crear clientes (403)', async () => {
  const res = await request(app)
    .post('/api/clientes')
    .set('Authorization', `Bearer ${tokenDe('AUDITOR')}`)
    .send({ nombreCompleto: 'X', email: 'x@x.com' });

  expect(res.status).toBe(403);
});

test('ADMIN activa el acceso al portal de un cliente existente', async () => {
  mockUpdate.mockResolvedValue({
    id: 'c-1', email: 'importador@fresco-asia.com', nombreCompleto: 'Zhang Wei',
    empresa: null, pais: null, telefono: null, verificado: true, activo: true,
    creadoEn: new Date(), passwordHash: 'hash-nuevo',
  });

  const res = await request(app)
    .patch('/api/clientes/c-1/activar-acceso')
    .set('Authorization', `Bearer ${tokenDe('ADMIN')}`)
    .send({ password: 'contrasena-larga' });

  expect(res.status).toBe(200);
  expect(res.body.data.tieneAcceso).toBe(true);
  expect(res.body.data.passwordHash).toBeUndefined();
});

test('MANAGER no puede activar acceso (403)', async () => {
  const res = await request(app)
    .patch('/api/clientes/c-1/activar-acceso')
    .set('Authorization', `Bearer ${tokenDe('MANAGER')}`)
    .send({ password: 'contrasena-larga' });

  expect(res.status).toBe(403);
});

test('activar acceso con password corto devuelve 400', async () => {
  const res = await request(app)
    .patch('/api/clientes/c-1/activar-acceso')
    .set('Authorization', `Bearer ${tokenDe('ADMIN')}`)
    .send({ password: '123' });

  expect(res.status).toBe(400);
});

test('activar acceso de cliente inexistente devuelve 404', async () => {
  mockUpdate.mockRejectedValue({ code: 'P2025' });

  const res = await request(app)
    .patch('/api/clientes/c-no-existe/activar-acceso')
    .set('Authorization', `Bearer ${tokenDe('ADMIN')}`)
    .send({ password: 'contrasena-larga' });

  expect(res.status).toBe(404);
});

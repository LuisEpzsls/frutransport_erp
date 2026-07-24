/**
 * Tests de /api/departamentos — catálogo (ADMIN) y "mios" (rubros propios).
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDepartamentoFindMany = jest.fn();
const mockUsuarioDepartamentoFindMany = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    departamento: { findMany: mockDepartamentoFindMany },
    usuarioDepartamento: { findMany: mockUsuarioDepartamentoFindMany },
  })),
}));

const app = require('../server');

const tokenDe = (role) =>
  jwt.sign({ id: 'u-test', email: `${role.toLowerCase()}@frutransport.pe`, role }, process.env.JWT_SECRET);

test('MANAGER no puede ver el catálogo completo de departamentos (403)', async () => {
  const res = await request(app).get('/api/departamentos').set('Authorization', `Bearer ${tokenDe('MANAGER')}`);
  expect(res.status).toBe(403);
});

test('ADMIN ve el catálogo completo', async () => {
  mockDepartamentoFindMany.mockResolvedValue([{ id: 1, nombre: 'Agroexportación', slug: 'agroexport' }]);
  const res = await request(app).get('/api/departamentos').set('Authorization', `Bearer ${tokenDe('ADMIN')}`);
  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(1);
});

test('MANAGER en /mios solo ve sus rubros asignados (filtra por id)', async () => {
  mockUsuarioDepartamentoFindMany.mockResolvedValue([{ departamentoId: 1 }]);
  mockDepartamentoFindMany.mockImplementation(({ where }) => {
    expect(where.id).toEqual({ in: [1] });
    return Promise.resolve([{ id: 1, nombre: 'Agroexportación', slug: 'agroexport' }]);
  });

  const res = await request(app).get('/api/departamentos/mios').set('Authorization', `Bearer ${tokenDe('MANAGER')}`);
  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(1);
});

test('ADMIN en /mios ve todos (sin filtro de id)', async () => {
  mockDepartamentoFindMany.mockImplementation(({ where }) => {
    expect(where.id).toBeUndefined();
    return Promise.resolve([{ id: 1 }, { id: 2 }]);
  });

  const res = await request(app).get('/api/departamentos/mios').set('Authorization', `Bearer ${tokenDe('ADMIN')}`);
  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(2);
});

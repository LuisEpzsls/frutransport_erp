const { PrismaClient } = require('@prisma/client');
const { departamentosDeUsuario } = require('../services/accesoDepartamento');

const prisma = new PrismaClient();

// GET /api/departamentos — catálogo completo (ADMIN, para la UI de asignación)
const listarTodos = async (_req, res, next) => {
  try {
    const data = await prisma.departamento.findMany({ orderBy: { orden: 'asc' } });
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

// GET /api/departamentos/mios — rubros que el usuario autenticado puede operar
// (ADMIN/AUDITOR: todos los activos; MANAGER: solo los asignados).
const listarMios = async (req, res, next) => {
  try {
    const ids = await departamentosDeUsuario(prisma, req.user);
    const data = await prisma.departamento.findMany({
      where: { activo: true, ...(ids ? { id: { in: ids } } : {}) },
      orderBy: { orden: 'asc' },
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

module.exports = { listarTodos, listarMios };

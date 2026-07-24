const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET /api/notificaciones — propias, no leídas primero, más recientes primero
const listar = async (req, res, next) => {
  try {
    const [data, noLeidas] = await Promise.all([
      prisma.notificacion.findMany({
        where: { usuarioId: req.user.id },
        orderBy: [{ leida: 'asc' }, { creadoEn: 'desc' }],
        take: 30,
      }),
      prisma.notificacion.count({ where: { usuarioId: req.user.id, leida: false } }),
    ]);
    res.json({ data, noLeidas });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/notificaciones/:id/leer
const marcarLeida = async (req, res, next) => {
  try {
    const { count } = await prisma.notificacion.updateMany({
      where: { id: parseInt(req.params.id, 10), usuarioId: req.user.id },
      data: { leida: true },
    });
    if (count === 0) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/notificaciones/leer-todas
const marcarTodasLeidas = async (req, res, next) => {
  try {
    await prisma.notificacion.updateMany({
      where: { usuarioId: req.user.id, leida: false },
      data: { leida: true },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, marcarLeida, marcarTodasLeidas };

const { z } = require('zod');

const schema = z.object({ nombre: z.string().min(1).max(120) });
const schemaActualizar = z.object({
  nombre: z.string().min(1).max(120).optional(),
  activo: z.boolean().optional(),
});

/**
 * Fábrica de controlador CRUD para catálogos simples de una sola columna
 * (Producto, Destino): listar/crear/actualizar. Sin DELETE — desactivar
 * (`activo: false`) es el único camino, igual que en Usuario/Departamento.
 *
 * @param {import('@prisma/client').PrismaClient[keyof import('@prisma/client').PrismaClient]} delegate - p.ej. prisma.producto
 * @param {string} nombreEntidad - para mensajes de error ("producto", "destino")
 */
function crearControladorCatalogo(delegate, nombreEntidad) {
  const listar = async (_req, res, next) => {
    try {
      const data = await delegate.findMany({ orderBy: { nombre: 'asc' } });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  const crear = async (req, res, next) => {
    try {
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
      }
      const existente = await delegate.findUnique({ where: { nombre: parsed.data.nombre } });
      if (existente) {
        return res.status(409).json({ error: `Ya existe un ${nombreEntidad} con ese nombre` });
      }
      const creado = await delegate.create({ data: parsed.data });
      res.status(201).json({ ok: true, data: creado });
    } catch (err) {
      next(err);
    }
  };

  const actualizar = async (req, res, next) => {
    try {
      const parsed = schemaActualizar.safeParse(req.body);
      if (!parsed.success || Object.keys(parsed.data).length === 0) {
        return res.status(400).json({ error: 'Nada válido que actualizar' });
      }
      const actualizado = await delegate.update({
        where: { id: parseInt(req.params.id, 10) },
        data: parsed.data,
      });
      res.json({ ok: true, data: actualizado });
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ error: `${nombreEntidad} no encontrado` });
      if (err.code === 'P2002') return res.status(409).json({ error: `Ya existe un ${nombreEntidad} con ese nombre` });
      next(err);
    }
  };

  return { listar, crear, actualizar };
}

module.exports = { crearControladorCatalogo };

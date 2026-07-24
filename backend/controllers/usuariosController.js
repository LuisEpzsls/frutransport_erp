const { z } = require('zod');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SELECT_PUBLICO = {
  id: true,
  email: true,
  role: true,
  activo: true,
  creadoEn: true,
  departamentos: { select: { departamento: { select: { id: true, nombre: true, slug: true } } } },
};

const aPlano = (u) => ({
  ...u,
  departamentos: u.departamentos.map((d) => d.departamento),
});

const crearSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  role: z.enum(['ADMIN', 'MANAGER', 'AUDITOR']),
  departamentoIds: z.array(z.coerce.number().int().positive()).optional(),
});

const actualizarSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'AUDITOR']).optional(),
  activo: z.boolean().optional(),
});

const departamentosSchema = z.object({
  departamentoIds: z.array(z.coerce.number().int().positive()),
});

// GET /api/usuarios
const listar = async (_req, res, next) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: SELECT_PUBLICO,
      orderBy: { creadoEn: 'asc' },
    });
    res.json({ data: usuarios.map(aPlano) });
  } catch (err) {
    next(err);
  }
};

// POST /api/usuarios
const crear = async (req, res, next) => {
  try {
    const parsed = crearSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    const { email, password, role, departamentoIds } = parsed.data;

    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }

    const usuario = await prisma.usuario.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role,
        ...(departamentoIds?.length
          ? { departamentos: { create: departamentoIds.map((departamentoId) => ({ departamentoId })) } }
          : {}),
      },
      select: SELECT_PUBLICO,
    });
    res.status(201).json({ ok: true, data: aPlano(usuario) });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/usuarios/:id — rol y/o activo (nunca se borra un usuario)
const actualizar = async (req, res, next) => {
  try {
    const parsed = actualizarSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    if (Object.keys(parsed.data).length === 0) {
      return res.status(400).json({ error: 'Nada que actualizar' });
    }

    if (req.params.id === req.user.id && parsed.data.activo === false) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }

    const usuario = await prisma.usuario.update({
      where: { id: req.params.id },
      data: parsed.data,
      select: SELECT_PUBLICO,
    });
    res.json({ ok: true, data: aPlano(usuario) });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' });
    next(err);
  }
};

// PATCH /api/usuarios/:id/departamentos — reemplaza el conjunto de rubros asignados
const asignarDepartamentos = async (req, res, next) => {
  try {
    const parsed = departamentosSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    const { id } = req.params;
    const { departamentoIds } = parsed.data;

    await prisma.$transaction([
      prisma.usuarioDepartamento.deleteMany({ where: { usuarioId: id } }),
      prisma.usuarioDepartamento.createMany({
        data: departamentoIds.map((departamentoId) => ({ usuarioId: id, departamentoId })),
        skipDuplicates: true,
      }),
    ]);

    const usuario = await prisma.usuario.findUnique({ where: { id }, select: SELECT_PUBLICO });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true, data: aPlano(usuario) });
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, crear, actualizar, asignarDepartamentos };

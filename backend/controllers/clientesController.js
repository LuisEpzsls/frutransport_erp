const { z } = require('zod');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SELECT_PUBLICO = {
  id: true, nombreCompleto: true, empresa: true, pais: true,
  telefono: true, email: true, verificado: true, activo: true, creadoEn: true,
  passwordHash: true, // se deriva tieneAcceso y se descarta, nunca se expone
};

const aPlano = ({ passwordHash, ...resto }) => ({ ...resto, tieneAcceso: passwordHash != null });

const crearSchema = z.object({
  nombreCompleto: z.string().min(1).max(160),
  email: z.string().email(),
  empresa: z.string().max(160).nullish(),
  pais: z.string().max(80).nullish(),
  telefono: z.string().max(40).nullish(),
});

const activarAccesoSchema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

// GET /api/clientes — directorio (ADMIN: gestión; MANAGER: selector en el cotizador)
const listar = async (_req, res, next) => {
  try {
    const clientes = await prisma.cliente.findMany({
      select: SELECT_PUBLICO,
      orderBy: { creadoEn: 'desc' },
    });
    res.json({ data: clientes.map(aPlano) });
  } catch (err) {
    next(err);
  }
};

// POST /api/clientes — alta rápida SIN acceso al portal (solo seguimiento;
// se activa después con PATCH /:id/activar-acceso). Pensado para crearse
// desde el propio flujo de cotización.
const crear = async (req, res, next) => {
  try {
    const parsed = crearSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    const { nombreCompleto, email, empresa, pais, telefono } = parsed.data;

    const existente = await prisma.cliente.findUnique({ where: { email } });
    if (existente) {
      return res.status(409).json({ error: 'Ya existe un cliente con ese correo' });
    }

    const cliente = await prisma.cliente.create({
      data: { nombreCompleto, email, empresa: empresa ?? null, pais: pais ?? null, telefono: telefono ?? null },
      select: SELECT_PUBLICO,
    });
    res.status(201).json({ ok: true, data: aPlano(cliente) });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/clientes/:id/activar-acceso — ADMIN asigna contraseña inicial,
// habilitando el login al portal para un cliente creado sin acceso.
const activarAcceso = async (req, res, next) => {
  try {
    const parsed = activarAccesoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }

    const cliente = await prisma.cliente.update({
      where: { id: req.params.id },
      data: { passwordHash: await bcrypt.hash(parsed.data.password, 10), verificado: true },
      select: SELECT_PUBLICO,
    });
    res.json({ ok: true, data: aPlano(cliente) });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Cliente no encontrado' });
    next(err);
  }
};

module.exports = { listar, crear, activarAcceso };

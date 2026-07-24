const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const firmarToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

// POST /api/auth/login
// Body: { email, password } — autentica contra `usuarios` (staff ERP) y,
// si no existe ahí, contra `clientes` (portal externo, role CLIENTE).
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (usuario && usuario.activo) {
      const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
      if (!passwordValida) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
      }
      const token = firmarToken({ id: usuario.id, email: usuario.email, role: usuario.role });
      return res.json({ token, user: { id: usuario.id, email: usuario.email, role: usuario.role } });
    }

    const cliente = await prisma.cliente.findUnique({ where: { email } });
    if (cliente && cliente.activo && cliente.passwordHash) {
      const passwordValida = await bcrypt.compare(password, cliente.passwordHash);
      if (!passwordValida) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
      }
      const token = firmarToken({ id: cliente.id, email: cliente.email, role: 'CLIENTE' });
      return res.json({ token, user: { id: cliente.id, email: cliente.email, role: 'CLIENTE' } });
    }

    return res.status(401).json({ error: 'Credenciales incorrectas' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me  — requiere token válido
router.get('/me', require('../middleware/auth').verifyToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;

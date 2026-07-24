const router = require('express').Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const clientesController = require('../controllers/clientesController');

// Directorio: ADMIN gestiona, MANAGER lo usa como selector en el cotizador
router.get('/', verifyToken, requireRole('ADMIN', 'MANAGER'), clientesController.listar);

// Alta rápida sin acceso al portal (se activa después)
router.post('/', verifyToken, requireRole('ADMIN', 'MANAGER'), clientesController.crear);

// Asigna contraseña inicial, habilitando el login al portal
router.patch('/:id/activar-acceso', verifyToken, requireRole('ADMIN'), clientesController.activarAcceso);

module.exports = router;

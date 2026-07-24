const router = require('express').Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const destinosController = require('../controllers/destinosController');

// Lectura: cualquier autenticado (el cotizador lo necesita). Gestión: ADMIN.
router.get('/', verifyToken, destinosController.listar);
router.post('/', verifyToken, requireRole('ADMIN'), destinosController.crear);
router.patch('/:id', verifyToken, requireRole('ADMIN'), destinosController.actualizar);

module.exports = router;

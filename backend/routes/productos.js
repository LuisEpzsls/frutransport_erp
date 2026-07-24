const router = require('express').Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const productosController = require('../controllers/productosController');

// Lectura: cualquier autenticado (el cotizador lo necesita). Gestión: ADMIN.
router.get('/', verifyToken, productosController.listar);
router.post('/', verifyToken, requireRole('ADMIN'), productosController.crear);
router.patch('/:id', verifyToken, requireRole('ADMIN'), productosController.actualizar);

module.exports = router;

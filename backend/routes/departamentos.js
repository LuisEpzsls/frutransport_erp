const router = require('express').Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const departamentosController = require('../controllers/departamentosController');

router.get('/mios', verifyToken, departamentosController.listarMios);
router.get('/', verifyToken, requireRole('ADMIN'), departamentosController.listarTodos);

module.exports = router;

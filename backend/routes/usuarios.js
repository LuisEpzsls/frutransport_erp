const router = require('express').Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const usuariosController = require('../controllers/usuariosController');

// Control de usuarios: exclusivo de ADMIN.
router.use(verifyToken, requireRole('ADMIN'));

router.get('/', usuariosController.listar);
router.post('/', usuariosController.crear);
router.patch('/:id', usuariosController.actualizar);
router.patch('/:id/departamentos', usuariosController.asignarDepartamentos);

module.exports = router;

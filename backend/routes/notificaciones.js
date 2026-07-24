const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const notificacionesController = require('../controllers/notificacionesController');

router.get('/', verifyToken, notificacionesController.listar);
router.patch('/leer-todas', verifyToken, notificacionesController.marcarTodasLeidas);
router.patch('/:id/leer', verifyToken, notificacionesController.marcarLeida);

module.exports = router;

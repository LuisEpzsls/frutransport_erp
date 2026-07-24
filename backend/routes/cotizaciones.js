const router = require('express').Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const cotizacionesController = require('../controllers/cotizacionesController');

// GET /api/cotizaciones — lista paginada (20/página, filtro ?estado=)
router.get('/', verifyToken, cotizacionesController.listar);

// GET /api/cotizaciones/gastos-habituales — gastos que casi siempre se
// registran en cotizaciones liquidadas (para alertar si faltan en el borrador)
router.get('/gastos-habituales', verifyToken, requireRole('ADMIN', 'MANAGER'), cotizacionesController.gastosHabituales);

// GET /api/cotizaciones/:id — detalle (resumir un borrador, ver liquidada)
router.get('/:id', verifyToken, cotizacionesController.obtener);

// POST /api/cotizaciones — crea un borrador PENDIENTE (autoguardado del cotizador)
router.post('/', verifyToken, requireRole('ADMIN', 'MANAGER'), cotizacionesController.crear);

// PATCH /api/cotizaciones/:id — autoguardado de un borrador PENDIENTE
router.patch('/:id', verifyToken, requireRole('ADMIN', 'MANAGER'), cotizacionesController.editar);

// PATCH /api/cotizaciones/:id/aprobar — PENDIENTE → APROBADA, asigna N° de contenedor
router.patch('/:id/aprobar', verifyToken, requireRole('ADMIN', 'MANAGER'), cotizacionesController.aprobar);

// PATCH /api/cotizaciones/:id/liquidar — registrar valores reales
router.patch('/:id/liquidar', verifyToken, requireRole('ADMIN', 'MANAGER'), cotizacionesController.liquidar);

// PATCH /api/cotizaciones/:id/reabrir — retrocede un paso (LIQUIDADA→APROBADA o APROBADA→PENDIENTE)
router.patch('/:id/reabrir', verifyToken, requireRole('ADMIN', 'MANAGER'), cotizacionesController.reabrir);

module.exports = router;

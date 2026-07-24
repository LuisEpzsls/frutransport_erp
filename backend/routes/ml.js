const router          = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const mlController    = require('../controllers/mlController');

// POST /api/ml/predict — llama al motor FastAPI y devuelve la predicción
router.post('/predict', verifyToken, mlController.predict);

// GET /api/ml/health — verifica que el motor ML esté activo
router.get('/health', mlController.healthCheck);

// GET /api/ml/categorias — producto/destino con los que el modelo fue entrenado
router.get('/categorias', verifyToken, mlController.categorias);

module.exports = router;

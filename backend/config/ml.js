// Configuración centralizada de la conexión con el motor ML (FastAPI)
const ML_BASE_URL = process.env.ML_ENGINE_URL || 'http://localhost:8000';
const ML_INTERNAL_SECRET = process.env.ML_INTERNAL_SECRET || '';

module.exports = { ML_BASE_URL, ML_INTERNAL_SECRET };


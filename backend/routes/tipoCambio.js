const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const { obtenerTipoCambioSunat } = require('../services/tipoCambio');

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/tipo-cambio?fecha=YYYY-MM-DD — tipo de cambio oficial SUNAT
// (sin fecha = tipo de cambio del día). Cacheado en memoria.
router.get('/', verifyToken, async (req, res) => {
  const { fecha } = req.query;
  if (fecha !== undefined && !FECHA_RE.test(fecha)) {
    return res.status(400).json({ error: 'fecha debe tener formato YYYY-MM-DD' });
  }

  try {
    const data = await obtenerTipoCambioSunat(fecha);
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: 'No se pudo obtener el tipo de cambio de SUNAT', detalle: err.message });
  }
});

module.exports = router;

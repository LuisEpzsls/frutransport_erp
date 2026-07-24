// Tipo de cambio oficial SUNAT vía apis.net.pe (proxy público, sin API key).
// Caché en memoria por fecha: el tipo de cambio de un día pasado nunca
// cambia, así que se cachea indefinidamente; el de "hoy" se refresca cada
// 10 min (la SUNAT publica una sola vez al día, pero por si acaso). El
// servicio tiene rate-limit agresivo (visto 429 en pruebas manuales), así
// que cachear también protege contra golpearlo de más.
const SUNAT_URL = 'https://api.apis.net.pe/v1/tipo-cambio-sunat';
const TTL_HOY_MS = 10 * 60 * 1000;

const cache = new Map(); // fecha (YYYY-MM-DD) | 'hoy' -> { data, expiraEn }

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

async function consultarSunat(fecha) {
  const url = fecha ? `${SUNAT_URL}?fecha=${fecha}` : SUNAT_URL;
  const res = await fetch(url);

  if (res.status === 429) {
    throw new Error('SUNAT limitó las consultas por exceso de tráfico. Intenta en unos minutos.');
  }
  if (!res.ok) {
    throw new Error(`SUNAT respondió ${res.status}`);
  }

  const body = await res.json();
  if (body.venta == null || body.compra == null) {
    throw new Error(`Sin tipo de cambio para la fecha solicitada${fecha ? ` (${fecha})` : ''}`);
  }

  return {
    compra: body.compra,
    venta: body.venta,
    fecha: body.fecha,
    fuente: 'SUNAT',
  };
}

/**
 * @param {string|undefined} fecha - YYYY-MM-DD. Sin fecha = tipo de cambio del día.
 */
async function obtenerTipoCambioSunat(fecha) {
  const esHoy = !fecha || fecha === hoyISO();
  const clave = esHoy ? 'hoy' : fecha;

  const cacheado = cache.get(clave);
  if (cacheado && (!esHoy || Date.now() < cacheado.expiraEn)) {
    return cacheado.data;
  }

  const data = await consultarSunat(esHoy ? undefined : fecha);
  cache.set(clave, { data, expiraEn: esHoy ? Date.now() + TTL_HOY_MS : Infinity });
  return data;
}

module.exports = { obtenerTipoCambioSunat };

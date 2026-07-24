/**
 * @fileoverview TipoCambioSunat — Widget del sidebar: tipo de cambio oficial
 * del día (GET /api/tipo-cambio) con un desplegable para consultar cualquier
 * fecha pasada (GET /api/tipo-cambio?fecha=YYYY-MM-DD).
 */
import { useState, useEffect } from 'react';
import api from '../services/api';

const hoyISO = () => new Date().toISOString().slice(0, 10);

export default function TipoCambioSunat() {
  const [hoy, setHoy]             = useState(null); // { venta, compra, fecha } | { error: true }
  const [abierto, setAbierto]     = useState(false);
  const [fecha, setFecha]         = useState(hoyISO());
  const [consulta, setConsulta]   = useState(null); // resultado de la fecha elegida
  const [consultando, setConsultando] = useState(false);

  useEffect(() => {
    api.get('/tipo-cambio')
      .then(({ data }) => setHoy(data))
      .catch(() => setHoy({ error: true }));
  }, []);

  const consultarFecha = async () => {
    setConsultando(true);
    setConsulta(null);
    try {
      const { data } = await api.get('/tipo-cambio', { params: { fecha } });
      setConsulta(data);
    } catch (err) {
      setConsulta({ error: true, mensaje: err.response?.data?.detalle || 'No se pudo consultar esa fecha' });
    } finally {
      setConsultando(false);
    }
  };

  return (
    <div className="tc-widget">
      <button
        type="button"
        className="tc-row"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-label="Tipo de cambio SUNAT, expandir para consultar otra fecha"
      >
        <img src="/sunat-logo.png" alt="" width={16} height={16} className="tc-logo" />
        <span className="tc-label">Tipo de cambio</span>
        <span className="tc-valor">
          {hoy == null ? '…' : hoy.error ? '—' : `S/ ${hoy.venta}`}
        </span>
        <span className={'tc-chev' + (abierto ? ' open' : '')} aria-hidden="true">⌄</span>
      </button>

      {hoy?.error && (
        <p className="tc-hint" style={{ color: 'var(--warn)' }}>SUNAT no disponible</p>
      )}
      {hoy && !hoy.error && (
        <p className="tc-hint">compra {hoy.compra} · {hoy.fecha}</p>
      )}

      {abierto && (
        <div className="tc-panel">
          <label className="erp-label" htmlFor="tc-fecha">Consultar otra fecha</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              id="tc-fecha"
              type="date"
              value={fecha}
              max={hoyISO()}
              onChange={(e) => setFecha(e.target.value)}
              className="erp-input"
              style={{ flex: 1, fontSize: 12.5, padding: '7px 8px' }}
            />
            <button
              type="button"
              onClick={consultarFecha}
              disabled={consultando || !fecha}
              className="erp-btn erp-btn--ghost erp-btn--sm"
            >
              {consultando ? '…' : 'Ver'}
            </button>
          </div>

          {consulta && !consulta.error && (
            <p className="tc-hint" style={{ marginTop: 8 }}>
              <strong style={{ color: 'var(--ink)' }}>{consulta.fecha}</strong>
              {' '}· venta S/ {consulta.venta} · compra S/ {consulta.compra}
            </p>
          )}
          {consulta?.error && (
            <p className="tc-hint" style={{ marginTop: 8, color: 'var(--warn)' }}>
              {consulta.mensaje}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

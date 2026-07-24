/**
 * @fileoverview TablaCotizaciones — Tabla paginada de cotizaciones.
 *
 * Reutilizable en dos modos:
 *  - admin (soloLectura=false): muestra botón "Liquidar" en filas PENDIENTE
 *    (visible solo para ADMIN/MANAGER) que abre un modal con descarte real +
 *    costo real → PATCH /api/cotizaciones/:id/liquidar → refresca.
 *  - auditor (soloLectura=true): misma tabla sin acciones.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import api from '../services/api';
import { useAuth, ROLES } from '../context/AuthContext';

const CLASE_ESTADO = {
  PENDIENTE:   'erp-badge erp-badge--pendiente',
  APROBADA:    'erp-badge erp-badge--neutral',
  EN_TRANSITO: 'erp-badge erp-badge--neutral',
  LIQUIDADA:   'erp-badge erp-badge--liquidada',
  RECHAZADA:   'erp-badge erp-badge--rechazada',
};

const fmtPct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
const fmtUsd = (v) =>
  v == null ? '—' : `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const fmtFecha = (iso) => new Date(iso).toLocaleDateString('es-PE');

// Componentes obligatorios del costo del contenedor — deben estar completos
// antes de liquidar (el backend hace la misma validación, ver
// cotizacionesController.js: CAMPOS_COSTO_OBLIGATORIOS).
const CAMPOS_COSTO_OBLIGATORIOS = ['kgCosechaComprados', 'precioMpKg', 'cajasContenedor', 'costoMaquila', 'costoAgenciamiento', 'costoSli'];
const costoCompleto = (c) => CAMPOS_COSTO_OBLIGATORIOS.every((campo) => c[campo] != null);

/**
 * Origen del registro según la nota del seed:
 *  - "Registro histórico (dataset tesis)"  → dato SINTÉTICO (generado)
 *  - "Operación real (CNT XX)"             → operación REAL del Excel
 *  - cualquier otro / sin nota             → operación REAL creada en el ERP
 */
const origenDe = (c) => {
  if (c.notas === 'Registro histórico (dataset tesis)') {
    return { tipo: 'sintetica', label: 'Sintética', badge: 'erp-badge erp-badge--neutral' };
  }
  const cnt = c.notas?.match(/^Operación real \(CNT ([^)]+)\)/);
  if (cnt) {
    return { tipo: 'real', label: `Real · CNT ${cnt[1]}`, badge: 'erp-badge erp-badge--liquidada' };
  }
  return { tipo: 'real', label: 'Real · ERP', badge: 'erp-badge erp-badge--liquidada' };
};

/** Documento imprimible del detalle (el diálogo de impresión permite "Guardar como PDF"). */
function descargarPdf(c, vistaExterna) {
  const origen = origenDe(c);
  const gastosRows = (c.gastos ?? [])
    .map((g) => `<tr><td>${g.concepto}</td><td class="num">${g.moneda === 'PEN' ? 'S/' : 'USD'} ${g.monto.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td></tr>`)
    .join('');
  const lotesRows = (c.lotesMateriaPrima ?? [])
    .map((l) => `<tr><td>${l.etiqueta}</td><td class="num">${l.kg.toLocaleString('en-US', { maximumFractionDigits: 2 })} kg</td></tr>`)
    .join('');
  const lotesDescarteRows = (c.lotesDescarteVendido ?? [])
    .map((l) => `<tr><td>${l.kg.toLocaleString('en-US', { maximumFractionDigits: 2 })} kg × ${l.moneda === 'PEN' ? 'S/' : '$'} ${l.precioKg}</td><td class="num">${l.moneda === 'PEN' ? 'S/' : '$'} ${(l.kg * l.precioKg).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td></tr>`)
    .join('');

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Cotización #${c.id} — Frutransport</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a160f; margin: 40px 48px; }
  .brand { display: flex; align-items: baseline; gap: 10px; border-bottom: 2px solid #1a160f; padding-bottom: 12px; }
  .brand h1 { font-size: 20px; margin: 0; }
  .brand span { font-family: monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #6b6357; }
  h2 { font-size: 26px; font-weight: 400; margin: 22px 0 2px; }
  .meta { font-family: monospace; font-size: 11px; color: #6b6357; margin-bottom: 20px; }
  .origen { display: inline-block; font-family: monospace; font-size: 10px; text-transform: uppercase;
            letter-spacing: 0.08em; border: 1px solid #1a160f; border-radius: 999px; padding: 3px 10px; margin-left: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0 22px; font-size: 13px; }
  caption { text-align: left; font-family: monospace; font-size: 10px; text-transform: uppercase;
            letter-spacing: 0.1em; color: #6b6357; padding-bottom: 6px; }
  td, th { padding: 7px 10px; border-bottom: 1px solid #d8d2c6; text-align: left; }
  .num { font-family: monospace; text-align: right; }
  .pie { font-family: monospace; font-size: 10px; color: #6b6357; border-top: 1px solid #d8d2c6; padding-top: 10px; margin-top: 28px; }
</style></head><body>
  <div class="brand"><h1>Frutransport</h1><span>Agroexportación · Detalle de cotización</span></div>
  <h2>Cotización #${c.id}<span class="origen">${origen.label}</span></h2>
  <div class="meta">Registrada el ${fmtFecha(c.creadoEn)} · Estado: ${c.estado}${!vistaExterna ? ` · Usuario: ${c.usuario?.email ?? '—'}` : ''}${c.numeroContenedorGeneral != null ? ` · Contenedor N° ${c.numeroContenedorGeneral}` : ''}</div>

  <table><caption>Operación</caption>
    <tr><td>Producto</td><td class="num">${c.producto}${c.variedad ? ` (${c.variedad})` : ''}</td></tr>
    <tr><td>Destino</td><td class="num">${c.destino}</td></tr>
    <tr><td>Tipo de cargamento</td><td class="num">${c.tipoCargamento ?? '—'}</td></tr>
    <tr><td>Volumen</td><td class="num">${c.volumenTon != null ? `${c.volumenTon} t` : '—'}</td></tr>
    <tr><td>Peso neto por caja</td><td class="num">${c.pesoNetoCaja != null ? `${c.pesoNetoCaja} kg` : '—'}</td></tr>
    <tr><td>Cajas por contenedor</td><td class="num">${c.cajasContenedor ?? '—'}</td></tr>
    ${!vistaExterna ? `<tr><td>Precio materia prima negociado</td><td class="num">${c.precioMpKg != null ? `S/ ${c.precioMpKg} · kg` : '—'}</td></tr>` : ''}
    ${!vistaExterna ? `<tr><td>Kg de cosecha comprados</td><td class="num">${c.kgCosechaComprados ?? '—'}</td></tr>` : ''}
    ${!vistaExterna && c.recuperoDescarte != null ? `<tr><td>Recupero por venta de descarte</td><td class="num">${c.recuperoDescarteMoneda === 'PEN' ? 'S/' : '$'} ${c.recuperoDescarte}</td></tr>` : ''}
  </table>

  ${(c.valorVentaOc != null || c.valorVentaFactura != null) ? `<table><caption>${vistaExterna ? 'Venta' : 'Venta real (vs. objetivo costo + utilidad)'}</caption>
    ${c.valorVentaOc != null ? `<tr><td>Venta pactada (orden/contrato)</td><td class="num">${c.valorVentaOcMoneda === 'PEN' ? 'S/' : '$'} ${c.valorVentaOc}</td></tr>` : ''}
    ${c.valorVentaFactura != null ? `<tr><td>Venta real facturada</td><td class="num">${c.valorVentaFacturaMoneda === 'PEN' ? 'S/' : '$'} ${c.valorVentaFactura}</td></tr>` : ''}
    ${!vistaExterna && c.resultadoCostoDirecto != null ? `<tr><td>Resultado (venta real − costo)</td><td class="num">${fmtUsd(c.resultadoCostoDirecto)}</td></tr>` : ''}
    ${!vistaExterna && c.resultadoConUtilidad != null ? `<tr><td>Resultado (venta real − costo con utilidad)</td><td class="num">${fmtUsd(c.resultadoConUtilidad)}</td></tr>` : ''}
  </table>` : ''}

  ${!vistaExterna ? `<table><caption>Estimado vs real</caption>
    <tr><th></th><th class="num">Estimado</th><th class="num">Real</th></tr>
    <tr><td>Porcentaje de descarte</td><td class="num">${fmtPct(c.porcentajeDescarteEstimado)}</td><td class="num">${fmtPct(c.porcentajeDescarteReal)}</td></tr>
    <tr><td>Costo total del contenedor</td><td class="num">${fmtUsd(c.costoTotalEstimado)}</td><td class="num">${fmtUsd(c.costoTotalReal)}</td></tr>
    <tr><td>% de utilidad</td><td class="num">${fmtPct(c.utilidadPct)}</td><td class="num">${fmtPct(c.utilidadRealPct)}</td></tr>
    <tr><td>Precio de venta total</td><td class="num">${fmtUsd(c.precioVentaEstimado)}</td><td class="num">${fmtUsd(c.precioVentaReal)}</td></tr>
    <tr><td>Precio FOB por caja</td><td class="num">${fmtUsd(c.precioFobCajaEstimado)}</td><td class="num">${fmtUsd(c.precioFobCajaReal)}</td></tr>
  </table>` : `<table><caption>Precio</caption>
    <tr><td>Precio FOB por caja</td><td class="num">${fmtUsd(c.precioFobCajaEstimado)} ${c.precioFobCajaReal != null ? `/ ${fmtUsd(c.precioFobCajaReal)} (real)` : ''}</td></tr>
  </table>`}

  ${(c.numeroBooking || c.numeroContenedorLogistica || c.fechaCosechaInicio || c.fechaCosechaFin || c.fechaProcesamiento || c.fechaLlenadoDespacho) ? `<table><caption>Logística y trazabilidad</caption>
    ${c.numeroBooking ? `<tr><td>N° de booking</td><td class="num">${c.numeroBooking}</td></tr>` : ''}
    ${c.numeroContenedorLogistica ? `<tr><td>N° de contenedor (naviera)</td><td class="num">${c.numeroContenedorLogistica}</td></tr>` : ''}
    ${(c.fechaCosechaInicio || c.fechaCosechaFin) ? `<tr><td>Cosecha</td><td class="num">${c.fechaCosechaInicio ? fmtFecha(c.fechaCosechaInicio) : '—'} – ${c.fechaCosechaFin ? fmtFecha(c.fechaCosechaFin) : '—'}</td></tr>` : ''}
    ${c.fechaProcesamiento ? `<tr><td>Fecha de procesamiento</td><td class="num">${fmtFecha(c.fechaProcesamiento)}</td></tr>` : ''}
    ${c.fechaLlenadoDespacho ? `<tr><td>Fecha de llenado/despacho</td><td class="num">${fmtFecha(c.fechaLlenadoDespacho)}</td></tr>` : ''}
  </table>` : ''}

  ${lotesRows ? `<table><caption>Lotes de materia prima</caption>${lotesRows}</table>` : ''}
  ${lotesDescarteRows ? `<table><caption>Lotes de descarte vendido</caption>${lotesDescarteRows}</table>` : ''}
  ${gastosRows ? `<table><caption>Gastos adicionales</caption>${gastosRows}</table>` : ''}
  ${c.notas ? `<div class="meta">Notas: ${c.notas}</div>` : ''}

  <div class="pie">Documento generado por el ERP Frutransport · ${new Date().toLocaleString('es-PE')} ·
  ${origen.tipo === 'sintetica' ? 'Registro sintético del dataset de entrenamiento (no corresponde a una operación comercial).' : 'Operación real.'}</div>
  <script>window.onload = () => window.print();</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=840,height=900');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function ModalLiquidar({ cotizacion, onCerrar, onLiquidada }) {
  const [descarteReal, setDescarteReal] = useState('');
  const [costoReal, setCostoReal]       = useState('');
  const [utilidadReal, setUtilidadReal] = useState(String(cotizacion.utilidadPct ?? 0.08));
  const [ventaFactura, setVentaFactura] = useState('');
  const [ventaFacturaMoneda, setVentaFacturaMoneda] = useState('USD');
  const [error, setError]               = useState(null);
  const [enviando, setEnviando]         = useState(false);

  const precioVentaRealPreview = costoReal !== '' && utilidadReal !== ''
    ? parseFloat(costoReal) * (1 + parseFloat(utilidadReal))
    : null;
  const precioFobCajaRealPreview = precioVentaRealPreview != null && cotizacion.cajasContenedor
    ? precioVentaRealPreview / cotizacion.cajasContenedor
    : null;
  // Resultado real: venta REALMENTE facturada − costo — a diferencia del
  // "precio de venta" de arriba (que es solo el objetivo costo+utilidad),
  // esto dice si la operación ganó o perdió dinero de verdad.
  const ventaFacturaUsd = ventaFactura !== ''
    ? (ventaFacturaMoneda === 'PEN' && cotizacion.tipoCambio ? parseFloat(ventaFactura) / cotizacion.tipoCambio : parseFloat(ventaFactura))
    : null;
  const resultadoPreview = ventaFacturaUsd != null && costoReal !== '' ? ventaFacturaUsd - parseFloat(costoReal) : null;

  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await api.patch(`/cotizaciones/${cotizacion.id}/liquidar`, {
        porcentajeDescarteReal: parseFloat(descarteReal),
        costoTotalReal: parseFloat(costoReal),
        utilidadRealPct: parseFloat(utilidadReal),
        ...(ventaFactura !== '' ? { valorVentaFactura: parseFloat(ventaFactura), valorVentaFacturaMoneda: ventaFacturaMoneda } : {}),
      });
      onLiquidada();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo liquidar');
      setEnviando(false);
    }
  };

  return (
    <div className="erp-scrim">
      <div className="erp-modal">
        <div className="erp-eyebrow">Liquidación · Cierre de operación</div>
        <h3 className="erp-title" style={{ fontSize: 24, marginBottom: 6 }}>
          Cotización #{cotizacion.id}
        </h3>
        <p className="erp-sub" style={{ marginBottom: 18 }}>
          {cotizacion.producto} → {cotizacion.destino} · estimado:{' '}
          <span className="mono" style={{ fontSize: 12 }}>
            {fmtPct(cotizacion.porcentajeDescarteEstimado)} / {fmtUsd(cotizacion.costoTotalEstimado)} / FOB {fmtUsd(cotizacion.precioFobCajaEstimado)}
          </span>
        </p>

        {error && (
          <div className="erp-alert erp-alert--error" style={{ marginBottom: 14 }}>{error}</div>
        )}

        {!costoCompleto(cotizacion) && (
          <div className="erp-alert erp-alert--warn" style={{ marginBottom: 14 }}>
            Esta cotización todavía no tiene completo el costo del contenedor (materia prima, cajas, maquila, agenciamiento o SLI) — complétala desde &quot;Continuar editando&quot; antes de liquidar.
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label className="erp-label">Descarte real (fracción, p. ej. 0.15)</label>
          <input
            type="number" min="0" max="1" step="0.01"
            value={descarteReal}
            onChange={(e) => setDescarteReal(e.target.value)}
            className="erp-input"
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="erp-label">Costo total real (USD)</label>
          <input
            type="number" min="0" step="0.01"
            value={costoReal}
            onChange={(e) => setCostoReal(e.target.value)}
            className="erp-input"
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="erp-label">% de utilidad real (fracción, p. ej. 0.08 = 8%)</label>
          <input
            type="number" min="0" max="1" step="0.01"
            value={utilidadReal}
            onChange={(e) => setUtilidadReal(e.target.value)}
            className="erp-input"
          />
        </div>

        {precioVentaRealPreview != null && (
          <p className="erp-sub" style={{ fontSize: 12, marginBottom: 14 }}>
            Precio de venta objetivo (costo + utilidad): <strong style={{ color: 'var(--ink)' }}>{fmtUsd(precioVentaRealPreview)}</strong>
            {precioFobCajaRealPreview != null && (
              <> · FOB por caja: <strong style={{ color: 'var(--ink)' }}>{fmtUsd(precioFobCajaRealPreview)}</strong></>
            )}
          </p>
        )}

        <div style={{ marginBottom: 8 }}>
          <label className="erp-label">Venta real facturada (opcional)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="number" min="0" step="0.01"
              value={ventaFactura}
              onChange={(e) => setVentaFactura(e.target.value)}
              className="erp-input"
              style={{ flex: 1 }}
            />
            <select value={ventaFacturaMoneda} onChange={(e) => setVentaFacturaMoneda(e.target.value)} className="erp-select" style={{ width: 76 }}>
              <option value="USD">USD</option>
              <option value="PEN">S/</option>
            </select>
          </div>
          <p className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 4 }}>
            Lo que realmente se facturó al cliente — puede ser distinto al objetivo. Es la única forma de saber si el contenedor ganó o perdió dinero de verdad.
          </p>
        </div>

        {resultadoPreview != null && (
          <p className="erp-sub" style={{ fontSize: 13, marginBottom: 22 }}>
            Resultado real (venta facturada − costo):{' '}
            <strong style={{ color: resultadoPreview < 0 ? 'var(--warn)' : 'var(--accent-2)' }}>
              {resultadoPreview < 0 ? '-' : ''}{fmtUsd(Math.abs(resultadoPreview))}
            </strong>
          </p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCerrar} className="erp-btn erp-btn--ghost" style={{ flex: 1 }}>
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={enviando || descarteReal === '' || costoReal === '' || utilidadReal === '' || !costoCompleto(cotizacion)}
            className="erp-btn erp-btn--accent"
            style={{ flex: 1 }}
          >
            {enviando ? 'Liquidando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

ModalLiquidar.propTypes = {
  cotizacion:  PropTypes.object.isRequired,
  onCerrar:    PropTypes.func.isRequired,
  onLiquidada: PropTypes.func.isRequired,
};

// Aprobar: momento en que la cotización deja de ser una estimación editable
// y se vuelve un contenedor real (se asigna su N° de contenedor). El valor
// de venta O/C (pactado en la orden de compra) es opcional acá — todavía no
// es la venta real, esa se registra al liquidar.
function ModalAprobar({ cotizacion, onCerrar, onAprobada }) {
  const [ventaOc, setVentaOc] = useState('');
  const [ventaOcMoneda, setVentaOcMoneda] = useState('USD');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await api.patch(`/cotizaciones/${cotizacion.id}/aprobar`,
        ventaOc !== '' ? { valorVentaOc: parseFloat(ventaOc), valorVentaOcMoneda: ventaOcMoneda } : {});
      onAprobada();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo aprobar');
      setEnviando(false);
    }
  };

  return (
    <div className="erp-scrim">
      <div className="erp-modal">
        <div className="erp-eyebrow">Aprobar · Se vuelve contenedor real</div>
        <h3 className="erp-title" style={{ fontSize: 24, marginBottom: 6 }}>
          Cotización #{cotizacion.id}
        </h3>
        <p className="erp-sub" style={{ marginBottom: 18 }}>
          {cotizacion.producto} → {cotizacion.destino} · asigna el N° de contenedor y ya no se puede editar el estimado.
        </p>

        {error && (
          <div className="erp-alert erp-alert--error" style={{ marginBottom: 14 }}>{error}</div>
        )}

        <div style={{ marginBottom: 8 }}>
          <label className="erp-label">Valor de venta pactado — orden/contrato (opcional)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="number" min="0" step="0.01"
              value={ventaOc}
              onChange={(e) => setVentaOc(e.target.value)}
              className="erp-input"
              style={{ flex: 1 }}
            />
            <select value={ventaOcMoneda} onChange={(e) => setVentaOcMoneda(e.target.value)} className="erp-select" style={{ width: 76 }}>
              <option value="USD">USD</option>
              <option value="PEN">S/</option>
            </select>
          </div>
          <p className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 4 }}>
            Lo pactado con el cliente antes de la venta real — se compara después contra lo realmente facturado (al liquidar).
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onCerrar} className="erp-btn erp-btn--ghost" style={{ flex: 1 }}>
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={enviando}
            className="erp-btn erp-btn--accent"
            style={{ flex: 1 }}
          >
            {enviando ? 'Aprobando…' : 'Confirmar aprobación'}
          </button>
        </div>
      </div>
    </div>
  );
}

ModalAprobar.propTypes = {
  cotizacion: PropTypes.object.isRequired,
  onCerrar:   PropTypes.func.isRequired,
  onAprobada: PropTypes.func.isRequired,
};

export function ModalDetalle({ cotizacion: c, onCerrar, vistaExterna }) {
  const origen = origenDe(c);
  const fila = (k, v) => (
    <tr>
      <td>{k}</td>
      <td className="num">{v}</td>
    </tr>
  );

  return (
    <div className="erp-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="erp-modal" style={{ maxWidth: 520, maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div className="erp-eyebrow">Detalle de cotización</div>
          <span className={origen.badge}>{origen.label}</span>
        </div>
        <h3 className="erp-title" style={{ fontSize: 24, marginBottom: 2 }}>
          Cotización #{c.id}
        </h3>
        <p className="erp-sub" style={{ marginBottom: 14 }}>
          {fmtFecha(c.creadoEn)} · <span className={CLASE_ESTADO[c.estado]}>{c.estado}</span>{!vistaExterna && ` · ${c.usuario?.email ?? '—'}`}
          {c.numeroContenedorGeneral != null && ` · Contenedor N° ${c.numeroContenedorGeneral}${c.numeroContenedorCliente != null ? ` (N° ${c.numeroContenedorCliente} de este cliente)` : ''}`}
        </p>

        <table className="erp-table" style={{ marginBottom: 16 }}>
          <tbody>
            {fila('Producto', c.variedad ? `${c.producto} (${c.variedad})` : c.producto)}
            {fila('Destino', c.destino)}
            {fila('Tipo de cargamento', c.tipoCargamento ?? '—')}
            {fila('Volumen', c.volumenTon != null ? `${c.volumenTon} t` : '—')}
            {fila('Peso neto por caja', c.pesoNetoCaja != null ? `${c.pesoNetoCaja} kg` : '—')}
            {fila('Cajas por contenedor', c.cajasContenedor ?? '—')}
            {!vistaExterna && fila('Precio materia prima negociado', c.precioMpKg != null ? `S/ ${c.precioMpKg} · kg` : '—')}
            {!vistaExterna && fila('Kg de cosecha comprados', c.kgCosechaComprados ?? '—')}
            {!vistaExterna && c.recuperoDescarte != null && fila(
              'Recupero por venta de descarte',
              `${c.recuperoDescarteMoneda === 'PEN' ? 'S/' : '$'} ${c.recuperoDescarte}`
            )}
            {!vistaExterna && fila('Descarte estimado / real', `${fmtPct(c.porcentajeDescarteEstimado)} / ${fmtPct(c.porcentajeDescarteReal)}`)}
            {!vistaExterna && fila('Costo estimado / real', `${fmtUsd(c.costoTotalEstimado)} / ${fmtUsd(c.costoTotalReal)}`)}
            {!vistaExterna && fila('% de utilidad estimado / real', `${fmtPct(c.utilidadPct)} / ${fmtPct(c.utilidadRealPct)}`)}
            {!vistaExterna && fila('Precio de venta estimado / real', `${fmtUsd(c.precioVentaEstimado)} / ${fmtUsd(c.precioVentaReal)}`)}
            {fila('Precio FOB por caja estimado / real', `${fmtUsd(c.precioFobCajaEstimado)} / ${fmtUsd(c.precioFobCajaReal)}`)}
          </tbody>
        </table>

        {(c.valorVentaOc != null || c.valorVentaFactura != null) && (
          <>
            <div className="erp-eyebrow" style={{ marginBottom: 6 }}>{vistaExterna ? 'Venta' : 'Venta real (vs. objetivo costo + utilidad)'}</div>
            <table className="erp-table" style={{ marginBottom: 16 }}>
              <tbody>
                {c.valorVentaOc != null && fila('Venta pactada (orden/contrato)', `${c.valorVentaOcMoneda === 'PEN' ? 'S/' : '$'} ${c.valorVentaOc}`)}
                {c.valorVentaFactura != null && fila('Venta real facturada', `${c.valorVentaFacturaMoneda === 'PEN' ? 'S/' : '$'} ${c.valorVentaFactura}`)}
                {!vistaExterna && c.resultadoCostoDirecto != null && (
                  <tr>
                    <td style={{ fontWeight: 600, color: 'var(--ink)' }}>Resultado (venta real − costo)</td>
                    <td className="num" style={{ fontWeight: 600, color: c.resultadoCostoDirecto < 0 ? 'var(--warn)' : 'var(--accent-2)' }}>
                      {fmtUsd(c.resultadoCostoDirecto)}
                    </td>
                  </tr>
                )}
                {!vistaExterna && c.resultadoConUtilidad != null && (
                  <tr>
                    <td style={{ fontWeight: 600, color: 'var(--ink)' }}>Resultado (venta real − costo con utilidad)</td>
                    <td className="num" style={{ fontWeight: 600, color: c.resultadoConUtilidad < 0 ? 'var(--warn)' : 'var(--accent-2)' }}>
                      {fmtUsd(c.resultadoConUtilidad)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {(c.numeroBooking || c.numeroContenedorLogistica || c.fechaCosechaInicio || c.fechaCosechaFin || c.fechaProcesamiento || c.fechaLlenadoDespacho) && (
          <>
            <div className="erp-eyebrow" style={{ marginBottom: 6 }}>Logística y trazabilidad</div>
            <table className="erp-table" style={{ marginBottom: 16 }}>
              <tbody>
                {c.numeroBooking && fila('N° de booking', c.numeroBooking)}
                {c.numeroContenedorLogistica && fila('N° de contenedor (naviera)', c.numeroContenedorLogistica)}
                {(c.fechaCosechaInicio || c.fechaCosechaFin) && fila(
                  'Cosecha',
                  `${c.fechaCosechaInicio ? fmtFecha(c.fechaCosechaInicio) : '—'} – ${c.fechaCosechaFin ? fmtFecha(c.fechaCosechaFin) : '—'}`
                )}
                {c.fechaProcesamiento && fila('Fecha de procesamiento', fmtFecha(c.fechaProcesamiento))}
                {c.fechaLlenadoDespacho && fila('Fecha de llenado/despacho', fmtFecha(c.fechaLlenadoDespacho))}
              </tbody>
            </table>
          </>
        )}

        {(c.lotesMateriaPrima?.length ?? 0) > 0 && (
          <>
            <div className="erp-eyebrow" style={{ marginBottom: 6 }}>Lotes de materia prima</div>
            <table className="erp-table" style={{ marginBottom: 16 }}>
              <tbody>
                {c.lotesMateriaPrima.map((l) => (
                  <tr key={l.id}>
                    <td>{l.etiqueta}</td>
                    <td className="num">{l.kg.toLocaleString('en-US', { maximumFractionDigits: 2 })} kg</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ fontWeight: 600, color: 'var(--ink)' }}>Total</td>
                  <td className="num" style={{ fontWeight: 600, color: 'var(--ink)' }}>
                    {c.lotesMateriaPrima.reduce((s, l) => s + l.kg, 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} kg
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {(c.lotesDescarteVendido?.length ?? 0) > 0 && (
          <>
            <div className="erp-eyebrow" style={{ marginBottom: 6 }}>Lotes de descarte vendido</div>
            <table className="erp-table" style={{ marginBottom: 16 }}>
              <tbody>
                {c.lotesDescarteVendido.map((l) => (
                  <tr key={l.id}>
                    <td>{l.kg.toLocaleString('en-US', { maximumFractionDigits: 2 })} kg × {l.moneda === 'PEN' ? 'S/' : '$'} {l.precioKg}</td>
                    <td className="num">{l.moneda === 'PEN' ? 'S/' : '$'} {(l.kg * l.precioKg).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {(c.gastos?.length ?? 0) > 0 && (
          <>
            <div className="erp-eyebrow" style={{ marginBottom: 6 }}>Gastos adicionales</div>
            <table className="erp-table" style={{ marginBottom: 16 }}>
              <tbody>
                {c.gastos.map((g, i) => (
                  <tr key={i}>
                    <td>{g.concepto}</td>
                    <td className="num" style={{ color: g.monto < 0 ? 'var(--accent-2)' : undefined }}>
                      {g.moneda === 'PEN' ? 'S/' : 'USD'} {g.monto.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {c.notas && (
          <p className="erp-sub" style={{ fontSize: 12, marginBottom: 16 }}>Notas: {c.notas}</p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCerrar} className="erp-btn erp-btn--ghost" style={{ flex: 1 }}>
            Cerrar
          </button>
          <button onClick={() => descargarPdf(c, vistaExterna)} className="erp-btn erp-btn--primary" style={{ flex: 1, width: 'auto' }}>
            Descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
}

ModalDetalle.propTypes = {
  cotizacion: PropTypes.object.isRequired,
  onCerrar:   PropTypes.func.isRequired,
  vistaExterna: PropTypes.bool,
};
ModalDetalle.defaultProps = { vistaExterna: false };

export default function TablaCotizaciones({ soloLectura, departamentoId, rubroNombre, vistaExterna }) {
  const { user } = useAuth();
  const [pagina, setPagina]         = useState(1);
  const [respuesta, setRespuesta]   = useState(null);
  const [cargando, setCargando]     = useState(true);
  const [error, setError]           = useState(null);
  const [aLiquidar, setALiquidar]   = useState(null);
  const [aAprobar, setAAprobar]     = useState(null);
  const [detalle, setDetalle]       = useState(null);
  const [reabriendo, setReabriendo] = useState(null); // id en vuelo (evita doble clic)

  const puedeLiquidar =
    !soloLectura && [ROLES.ADMIN, ROLES.MANAGER].includes(user?.role);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { data } = await api.get('/cotizaciones', {
        params: { page: pagina, ...(departamentoId ? { departamentoId } : {}) },
      });
      setRespuesta(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar cotizaciones');
    } finally {
      setCargando(false);
    }
  }, [pagina, departamentoId]);

  useEffect(() => { setPagina(1); }, [departamentoId]);
  useEffect(() => { cargar(); }, [cargar]);

  // Reabrir: retrocede un paso (LIQUIDADA→APROBADA o APROBADA→PENDIENTE) —
  // para corregir un error de captura sin recrear la cotización desde cero.
  const reabrir = async (c) => {
    setReabriendo(c.id);
    setError(null);
    try {
      await api.patch(`/cotizaciones/${c.id}/reabrir`);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo reabrir la cotización');
    } finally {
      setReabriendo(null);
    }
  };


  return (
    <div className="erp-page">
      <div className="erp-eyebrow">{rubroNombre ?? 'Todos los rubros'} · Operaciones</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 22 }}>
        <h1 className="erp-title">Historial de cotizaciones.</h1>
        {respuesta && (
          <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {respuesta.total} registros
          </span>
        )}
      </div>

      <div className="erp-card" style={{ overflow: 'hidden' }}>
        {error && (
          <div className="erp-alert erp-alert--error" style={{ margin: 20 }}>{error}</div>
        )}

        {cargando && <p className="erp-sub" style={{ padding: 24 }}>Cargando…</p>}

        {!cargando && respuesta && (
          <div style={{ overflowX: 'auto' }}>
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Destino</th>
                  {!vistaExterna && <th style={{ textAlign: 'right' }}>Descarte est. / real</th>}
                  {!vistaExterna && <th style={{ textAlign: 'right' }}>Costo est. / real</th>}
                  <th style={{ textAlign: 'center' }}>Estado</th>
                  {!vistaExterna && <th style={{ textAlign: 'center' }}>Origen</th>}
                  {!vistaExterna && <th>Usuario</th>}
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {respuesta.data.map((c) => (
                  <tr key={c.id}>
                    <td className="mono" style={{ fontSize: 12 }}>{fmtFecha(c.creadoEn)}</td>
                    <td style={{ color: 'var(--ink)', fontWeight: 500 }}>{c.producto}</td>
                    <td>{c.destino}</td>
                    {!vistaExterna && (
                      <td className="num">
                        <span style={{ color: 'var(--ink-3)' }}>{fmtPct(c.porcentajeDescarteEstimado)}</span>
                        {' / '}
                        <span style={{ color: 'var(--ink)' }}>{fmtPct(c.porcentajeDescarteReal)}</span>
                      </td>
                    )}
                    {!vistaExterna && (
                      <td className="num">
                        <span style={{ color: 'var(--ink-3)' }}>{fmtUsd(c.costoTotalEstimado)}</span>
                        {' / '}
                        <span style={{ color: 'var(--ink)' }}>{fmtUsd(c.costoTotalReal)}</span>
                      </td>
                    )}
                    <td style={{ textAlign: 'center' }}>
                      <span className={CLASE_ESTADO[c.estado] ?? 'erp-badge erp-badge--neutral'}>
                        {c.estado}
                      </span>
                    </td>
                    {!vistaExterna && (
                      <td style={{ textAlign: 'center' }}>
                        <span className={origenDe(c).badge}>{origenDe(c).label}</span>
                      </td>
                    )}
                    {!vistaExterna && (
                      <td style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{c.usuario?.email ?? '—'}</td>
                    )}
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => setDetalle(c)}
                        className="erp-btn erp-btn--ghost erp-btn--sm"
                        style={{ marginRight: puedeLiquidar && c.estado !== 'LIQUIDADA' && c.estado !== 'RECHAZADA' ? 6 : 0 }}
                      >
                        Detalle
                      </button>
                      {puedeLiquidar && c.estado === 'PENDIENTE' && (
                        <Link
                          to={`/admin/ml?borrador=${c.id}`}
                          className="erp-btn erp-btn--ghost erp-btn--sm"
                          style={{ marginRight: 6 }}
                        >
                          Continuar editando
                        </Link>
                      )}
                      {puedeLiquidar && c.estado === 'PENDIENTE' && costoCompleto(c) && (
                        <button
                          onClick={() => setAAprobar(c)}
                          className="erp-btn erp-btn--accent erp-btn--sm"
                          title="Asigna el N° de contenedor y lo pasa a APROBADA — deja de ser editable"
                        >
                          Aprobar
                        </button>
                      )}
                      {puedeLiquidar && c.estado === 'APROBADA' && (
                        <button
                          onClick={() => setALiquidar(c)}
                          className="erp-btn erp-btn--accent erp-btn--sm"
                          style={{ marginRight: 6 }}
                        >
                          Liquidar
                        </button>
                      )}
                      {puedeLiquidar && (c.estado === 'APROBADA' || c.estado === 'LIQUIDADA') && (
                        <button
                          onClick={() => reabrir(c)}
                          disabled={reabriendo === c.id}
                          className="erp-btn erp-btn--ghost erp-btn--sm"
                          title={c.estado === 'LIQUIDADA'
                            ? 'Vuelve a APROBADA — borra los valores reales de cierre (descarte, costo, utilidad, venta facturada)'
                            : 'Vuelve a PENDIENTE — borra el N° de contenedor y la venta pactada, y la deja editable de nuevo'}
                        >
                          {reabriendo === c.id ? 'Reabriendo…' : 'Reabrir'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {respuesta.data.length === 0 && (
                  <tr>
                    <td colSpan={vistaExterna ? 5 : 9} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-3)' }}>
                      Sin cotizaciones registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {respuesta && respuesta.pages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', borderTop: '1px solid var(--line)',
          }}>
            <button
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina <= 1}
              className="erp-btn erp-btn--ghost erp-btn--sm"
            >
              ← Anterior
            </button>
            <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              Página {respuesta.page} de {respuesta.pages}
            </span>
            <button
              onClick={() => setPagina((p) => Math.min(respuesta.pages, p + 1))}
              disabled={pagina >= respuesta.pages}
              className="erp-btn erp-btn--ghost erp-btn--sm"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {aAprobar && (
        <ModalAprobar
          cotizacion={aAprobar}
          onCerrar={() => setAAprobar(null)}
          onAprobada={() => { setAAprobar(null); cargar(); }}
        />
      )}

      {aLiquidar && (
        <ModalLiquidar
          cotizacion={aLiquidar}
          onCerrar={() => setALiquidar(null)}
          onLiquidada={() => { setALiquidar(null); cargar(); }}
        />
      )}

      {detalle && (
        <ModalDetalle cotizacion={detalle} onCerrar={() => setDetalle(null)} vistaExterna={vistaExterna} />
      )}
    </div>
  );
}

TablaCotizaciones.propTypes = {
  soloLectura: PropTypes.bool,
  departamentoId: PropTypes.number,
  rubroNombre: PropTypes.string,
  vistaExterna: PropTypes.bool,
};

TablaCotizaciones.defaultProps = {
  soloLectura: false,
  departamentoId: undefined,
  rubroNombre: undefined,
  vistaExterna: false,
};

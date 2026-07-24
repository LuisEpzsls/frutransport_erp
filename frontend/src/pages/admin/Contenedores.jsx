/**
 * @fileoverview Contenedores — lista de contenedores reales (con numeración
 * asignada al crear, ver mlController/cotizacionesController) y su detalle
 * de logística/trazabilidad. Reemplaza el registro manual en
 * CONTENEDORES.xlsx: cada fila es un contenedor real, no una cotización de
 * prueba ni un registro sintético del dataset de entrenamiento.
 */
import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../../services/api';
import { useRubro } from '../../context/RubroContext';
import { ModalDetalle } from '../../components/TablaCotizaciones';

const CLASE_ESTADO = {
  PENDIENTE:   'erp-badge erp-badge--pendiente',
  APROBADA:    'erp-badge erp-badge--neutral',
  EN_TRANSITO: 'erp-badge erp-badge--neutral',
  LIQUIDADA:   'erp-badge erp-badge--liquidada',
  RECHAZADA:   'erp-badge erp-badge--rechazada',
};

const fmtFecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-PE') : '—');

export default function Contenedores() {
  const { rubroActivo } = useRubro();
  const [clientes, setClientes]   = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [pagina, setPagina]       = useState(1);
  const [respuesta, setRespuesta] = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState(null);
  const [detalle, setDetalle]     = useState(null);

  useEffect(() => {
    api.get('/clientes').then(({ data }) => setClientes(data.data)).catch(() => setClientes([]));
  }, []);

  const cargar = useCallback(async () => {
    if (!rubroActivo?.id) return;
    setCargando(true);
    setError(null);
    try {
      const { data } = await api.get('/cotizaciones', {
        params: {
          page: pagina,
          departamentoId: rubroActivo.id,
          ordenarPor: 'contenedor',
          soloConNumero: 'true',
          ...(clienteId ? { clienteId } : {}),
        },
      });
      setRespuesta(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar contenedores');
    } finally {
      setCargando(false);
    }
  }, [pagina, clienteId, rubroActivo?.id]);

  useEffect(() => { setPagina(1); }, [clienteId]);
  useEffect(() => { cargar(); }, [cargar]);

  if (rubroActivo && rubroActivo.slug !== 'agroexport') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <div className="erp-page">
      <div className="erp-eyebrow">{rubroActivo?.nombre ?? 'Agroexportación'} · Control de contenedores</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <h1 className="erp-title">Contenedores.</h1>
        {respuesta && (
          <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {respuesta.total} contenedores
          </span>
        )}
      </div>
      <p className="erp-sub" style={{ marginBottom: 18 }}>
        Cada fila es un contenedor real (numerado al crearse desde el cotizador), con su cliente y sus datos de logística — booking, contenedor asignado por la naviera, fechas de cosecha y procesamiento.
      </p>

      <div style={{ marginBottom: 16, maxWidth: 320 }}>
        <label className="erp-label">Filtrar por cliente</label>
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="erp-select">
          <option value="">Todos los clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.nombreCompleto}{c.empresa ? ` · ${c.empresa}` : ''}</option>
          ))}
        </select>
      </div>

      <div className="erp-card" style={{ overflow: 'hidden' }}>
        {error && (
          <div className="erp-alert erp-alert--error" style={{ margin: 20 }}>{error}</div>
        )}

        {cargando && <p className="erp-sub" style={{ padding: 24 }}>Cargando…</p>}

        {!cargando && respuesta && respuesta.data.length === 0 && (
          <p className="erp-sub" style={{ padding: 24 }}>
            Todavía no hay contenedores {clienteId ? 'de este cliente' : 'numerados'} — se asignan automáticamente al iniciar una cotización desde el cotizador.
          </p>
        )}

        {!cargando && respuesta && respuesta.data.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="erp-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'right' }}>N° gral.</th>
                  <th style={{ textAlign: 'right' }}>N° cliente</th>
                  <th>Cliente</th>
                  <th>Producto</th>
                  <th>Destino</th>
                  <th>Booking</th>
                  <th>Contenedor (naviera)</th>
                  <th>Cosecha</th>
                  <th>Procesamiento</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {respuesta.data.map((c) => (
                  <tr key={c.id}>
                    <td className="num">{c.numeroContenedorGeneral ?? '—'}</td>
                    <td className="num">{c.numeroContenedorCliente ?? '—'}</td>
                    <td style={{ color: 'var(--ink)', fontWeight: 500 }}>
                      {c.cliente?.nombreCompleto ?? <span style={{ color: 'var(--ink-3)' }}>Sin asociar</span>}
                    </td>
                    <td>{c.producto}</td>
                    <td>{c.destino}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{c.numeroBooking ?? '—'}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{c.numeroContenedorLogistica ?? '—'}</td>
                    <td className="mono" style={{ fontSize: 11.5 }}>
                      {c.fechaCosechaInicio
                        ? `${fmtFecha(c.fechaCosechaInicio)}${c.fechaCosechaFin && c.fechaCosechaFin !== c.fechaCosechaInicio ? ` – ${fmtFecha(c.fechaCosechaFin)}` : ''}`
                        : '—'}
                    </td>
                    <td className="mono" style={{ fontSize: 11.5 }}>{fmtFecha(c.fechaProcesamiento)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={CLASE_ESTADO[c.estado] ?? 'erp-badge erp-badge--neutral'}>{c.estado}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => setDetalle(c)} className="erp-btn erp-btn--ghost erp-btn--sm">
                        Detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {respuesta && respuesta.pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, padding: 16 }}>
            <button
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina <= 1}
              className="erp-btn erp-btn--ghost erp-btn--sm"
            >
              ← Anterior
            </button>
            <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', alignSelf: 'center' }}>
              Página {pagina} / {respuesta.pages}
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

      {detalle && <ModalDetalle cotizacion={detalle} onCerrar={() => setDetalle(null)} />}
    </div>
  );
}

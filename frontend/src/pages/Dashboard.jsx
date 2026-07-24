import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, ROLES } from '../context/AuthContext';
import { useRubro } from '../context/RubroContext';
import api from '../services/api';

/** Panel genérico para rubros que aún no tienen funcionalidad propia. */
function PanelEnConstruccion({ rubro }) {
  return (
    <div className="erp-page">
      <div className="erp-eyebrow">{rubro.nombre}</div>
      <h1 className="erp-title">Este rubro está en construcción.</h1>
      <p className="erp-sub" style={{ marginBottom: 26, maxWidth: 520 }}>
        {rubro.descripcion || `${rubro.nombre} aún no tiene módulos operativos en el ERP.`}
        {' '}Usa el selector de rubro (arriba) para volver a Agroexportación.
      </p>
      <div className="erp-card erp-card-pad" style={{ opacity: 0.7 }}>
        <span className="erp-sub">Próximamente.</span>
      </div>
    </div>
  );
}

// El sidebar lo provee AdminLayout — esta página solo renderiza su contenido.
export default function Dashboard() {
  const { user } = useAuth();
  const { rubroActivo } = useRubro();
  const [health,     setHealth]     = useState(null);
  const [mlHealth,   setMlHealth]   = useState(null);
  const [totales,    setTotales]    = useState(null); // { total, pendientes, liquidadas }

  const esAgroexport = rubroActivo?.slug === 'agroexport';

  useEffect(() => {
    if (!esAgroexport) return;
    api.get('/health').then(r => setHealth(r.data)).catch(() => {});
    api.get('/ml/health').then(r => setMlHealth(r.data)).catch(() => {});
    // KPIs desde consultas reales (además confirman que la BD responde)
    const depto = { departamentoId: rubroActivo.id };
    Promise.all([
      api.get('/cotizaciones', { params: { page: 1, ...depto } }),
      api.get('/cotizaciones', { params: { page: 1, estado: 'PENDIENTE', ...depto } }),
      api.get('/cotizaciones', { params: { page: 1, estado: 'LIQUIDADA', ...depto } }),
    ])
      .then(([todas, pend, liq]) => setTotales({
        total: todas.data.total,
        pendientes: pend.data.total,
        liquidadas: liq.data.total,
      }))
      .catch(() => setTotales({ error: true }));
  }, [esAgroexport, rubroActivo?.id]);

  if (!rubroActivo) return null; // RubroContext aún cargando
  if (!esAgroexport) return <PanelEnConstruccion rubro={rubroActivo} />;

  const servicios = [
    {
      nombre: 'Backend Node.js',
      ok: !!health,
      detalle: health ? `${health.service} · ${health.env}` : 'Sin respuesta',
    },
    {
      nombre: 'Motor ML (FastAPI)',
      ok: mlHealth?.mlEngine === 'ok',
      detalle: mlHealth?.modelo
        ? `${mlHealth.modelo} · MAE ${mlHealth.mae} · R² ${mlHealth.r2}`
        : 'Sin respuesta — ejecuta uvicorn',
    },
    {
      nombre: 'PostgreSQL',
      ok: totales != null && !totales.error,
      detalle: totales == null ? 'Verificando…'
        : totales.error ? 'Sin respuesta'
        : 'Conectada · respondiendo consultas',
    },
  ];

  const modulos = [
    { label: 'Cotizaciones ML', desc: 'Predicción de descarte y costo del contenedor', to: '/admin/ml' },
    { label: 'Historial',       desc: 'Estimado vs real · liquidación de operaciones', to: '/admin/historial' },
    { label: 'Reportes',        desc: 'Consolidados del área', to: '/admin/reportes' },
    ...(user?.role === ROLES.ADMIN
      ? [{ label: 'Usuarios', desc: 'Control de usuarios, clientes y rubros', to: '/admin/usuarios' }]
      : []),
  ];

  return (
    <div className="erp-page">
      {/* Encabezado */}
      <div className="erp-eyebrow">{rubroActivo.nombre} · {user?.role}</div>
      <h1 className="erp-title">Bienvenido, {user?.email?.split('@')[0]}.</h1>
      <p className="erp-sub" style={{ marginBottom: 28 }}>
        Estado de la operación y accesos a los módulos del área de agroexportación.
      </p>

      {/* KPIs de cotizaciones */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 26 }}>
        <div className="erp-card erp-tile">
          <span className="t-label">Cotizaciones registradas</span>
          <span className="t-value">{totales?.total ?? '—'}</span>
          <span className="t-meta">todas las operaciones</span>
        </div>
        <div className="erp-card erp-tile">
          <span className="t-label">Pendientes</span>
          <span className="t-value" style={{ color: 'var(--gold-2)' }}>{totales?.pendientes ?? '—'}</span>
          <span className="t-meta">por liquidar</span>
        </div>
        <div className="erp-card erp-tile">
          <span className="t-label">Liquidadas</span>
          <span className="t-value" style={{ color: 'var(--accent-2)' }}>{totales?.liquidadas ?? '—'}</span>
          <span className="t-meta">alimentan el reentrenamiento</span>
        </div>
        <div className="erp-card erp-tile">
          <span className="t-label">Error del modelo (MAE)</span>
          <span className="t-value">
            {mlHealth?.mae != null ? `±${(mlHealth.mae * 100).toFixed(1)} pts` : '—'}
          </span>
          <span className="t-meta">{mlHealth?.modelo ?? 'motor ML sin respuesta'}</span>
        </div>
      </div>

      {/* Estado de servicios */}
      <div className="erp-card erp-card-pad" style={{ marginBottom: 30 }}>
        <div className="erp-eyebrow" style={{ marginBottom: 12 }}>Servicios</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {servicios.map((s) => (
            <div key={s.nombre}>
              <div className="erp-status" style={{ fontWeight: 500, color: 'var(--ink)' }}>
                <span className={'dot ' + (s.ok ? 'ok' : 'down')} />
                {s.nombre} · {s.ok ? 'operativo' : 'caído'}
              </div>
              <div className="t-meta mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4, paddingLeft: 15 }}>
                {s.detalle}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Módulos */}
      <div className="erp-eyebrow" style={{ marginBottom: 12 }}>Módulos</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {modulos.map((m) => (
          <Link
            key={m.label}
            to={m.to}
            className="erp-card"
            style={{ padding: '18px 20px', display: 'grid', gap: 6, transition: 'border-color 160ms ease, transform 160ms ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; }}
          >
            <span style={{ fontWeight: 600, fontSize: 15 }}>{m.label}</span>
            <span className="erp-sub">{m.desc}</span>
            <span className="erp-eyebrow" style={{ color: 'var(--accent-2)', marginTop: 4 }}>Entrar →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

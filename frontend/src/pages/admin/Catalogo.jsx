/**
 * @fileoverview Catalogo — administración de Productos y Destinos usados en
 * el cotizador. Exclusivo de ADMIN (crear/editar); el modelo ML solo
 * "conoce" las categorías con las que fue entrenado, así que cada fila
 * marca si ya es predecible o si todavía necesita reentrenamiento.
 */
import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import api from '../../services/api';
import { useAuth, ROLES } from '../../context/AuthContext';

function ModalCatalogo({ tipo, item, onCerrar, onGuardado }) {
  const editando = !!item;
  const [nombre, setNombre]     = useState(item?.nombre ?? '');
  const [error, setError]       = useState(null);
  const [enviando, setEnviando] = useState(false);

  const endpoint = tipo === 'productos' ? '/productos' : '/destinos';
  const etiqueta = tipo === 'productos' ? 'producto' : 'destino';

  const guardar = async () => {
    setEnviando(true);
    setError(null);
    try {
      if (editando) {
        await api.patch(`${endpoint}/${item.id}`, { nombre });
      } else {
        await api.post(endpoint, { nombre });
      }
      onGuardado();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar');
      setEnviando(false);
    }
  };

  return (
    <div className="erp-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="erp-modal" style={{ maxWidth: 420 }}>
        <div className="erp-eyebrow">{editando ? `Editar ${etiqueta}` : `Nuevo ${etiqueta}`}</div>
        <h3 className="erp-title" style={{ fontSize: 22, marginBottom: 16 }}>
          {editando ? item.nombre : `Agregar ${etiqueta}`}
        </h3>

        {error && <div className="erp-alert erp-alert--error" style={{ marginBottom: 14 }}>{error}</div>}

        <label className="erp-label">Nombre</label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="erp-input"
          style={{ marginBottom: 20 }}
          placeholder={tipo === 'productos' ? 'Ej. Uva Red Globe' : 'Ej. Alemania'}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCerrar} className="erp-btn erp-btn--ghost" style={{ flex: 1 }}>Cancelar</button>
          <button
            onClick={guardar}
            disabled={enviando || !nombre.trim()}
            className="erp-btn erp-btn--accent"
            style={{ flex: 1 }}
          >
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

ModalCatalogo.propTypes = {
  tipo: PropTypes.oneOf(['productos', 'destinos']).isRequired,
  item: PropTypes.object,
  onCerrar: PropTypes.func.isRequired,
  onGuardado: PropTypes.func.isRequired,
};
ModalCatalogo.defaultProps = { item: null };

function TablaCatalogo({ tipo, categoriasEntrenadas }) {
  const [items, setItems]   = useState(null);
  const [error, setError]   = useState(null);
  const [modal, setModal]   = useState(null); // null | 'nuevo' | item

  const endpoint = tipo === 'productos' ? '/productos' : '/destinos';
  const etiqueta = tipo === 'productos' ? 'producto' : 'destino';

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get(endpoint);
      setItems(data.data);
    } catch (err) {
      setError(err.response?.data?.error || `Error al cargar ${etiqueta}s`);
    }
  }, [endpoint, etiqueta]);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleActivo = async (item) => {
    try {
      await api.patch(`${endpoint}/${item.id}`, { activo: !item.activo });
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo actualizar');
    }
  };

  const esPredecible = (nombre) => categoriasEntrenadas == null || categoriasEntrenadas.includes(nombre);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => setModal('nuevo')} className="erp-btn erp-btn--accent erp-btn--sm">
          + Nuevo {etiqueta}
        </button>
      </div>

      {error && <div className="erp-alert erp-alert--error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="erp-card" style={{ overflow: 'hidden' }}>
        {!items && !error && <p className="erp-sub" style={{ padding: 24 }}>Cargando…</p>}
        {items && (
          <div style={{ overflowX: 'auto' }}>
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th style={{ textAlign: 'center' }}>Modelo ML</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ color: 'var(--ink)', fontWeight: 500 }}>{item.nombre}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className={'erp-badge ' + (esPredecible(item.nombre) ? 'erp-badge--liquidada' : 'erp-badge--pendiente')}
                        title={esPredecible(item.nombre) ? '' : 'El modelo ML todavía no fue entrenado con esta categoría'}
                      >
                        {esPredecible(item.nombre) ? 'Entrenado' : 'Sin entrenar'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={'erp-badge ' + (item.activo ? 'erp-badge--liquidada' : 'erp-badge--rechazada')}>
                        {item.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setModal(item)} className="erp-btn erp-btn--ghost erp-btn--sm" style={{ marginRight: 6 }}>
                        Editar
                      </button>
                      <button onClick={() => toggleActivo(item)} className="erp-btn erp-btn--ghost erp-btn--sm">
                        {item.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-3)' }}>Sin {etiqueta}s registrados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <ModalCatalogo
          tipo={tipo}
          item={modal === 'nuevo' ? null : modal}
          onCerrar={() => setModal(null)}
          onGuardado={() => { setModal(null); cargar(); }}
        />
      )}
    </>
  );
}

TablaCatalogo.propTypes = {
  tipo: PropTypes.oneOf(['productos', 'destinos']).isRequired,
  categoriasEntrenadas: PropTypes.array,
};
TablaCatalogo.defaultProps = { categoriasEntrenadas: null };

export default function Catalogo() {
  const { user } = useAuth();
  const [tab, setTab] = useState('productos');
  const [categorias, setCategorias] = useState(null); // { producto: [], destino: [] } | null si el motor ML no respondió

  useEffect(() => {
    api.get('/ml/categorias')
      .then(({ data }) => setCategorias(data))
      .catch(() => setCategorias({ producto: null, destino: null }));
  }, []);

  if (user?.role !== ROLES.ADMIN) {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <div className="erp-page">
      <div className="erp-eyebrow">Administración</div>
      <h1 className="erp-title">Catálogo.</h1>
      <p className="erp-sub" style={{ marginBottom: 22 }}>
        Productos y destinos disponibles en el cotizador. Un elemento nuevo queda &quot;sin entrenar&quot; hasta el próximo reentrenamiento del modelo ML.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setTab('productos')}
          className={'erp-btn erp-btn--sm ' + (tab === 'productos' ? 'erp-btn--accent' : 'erp-btn--ghost')}
        >
          Productos
        </button>
        <button
          onClick={() => setTab('destinos')}
          className={'erp-btn erp-btn--sm ' + (tab === 'destinos' ? 'erp-btn--accent' : 'erp-btn--ghost')}
        >
          Destinos
        </button>
      </div>

      {tab === 'productos'
        ? <TablaCatalogo tipo="productos" categoriasEntrenadas={categorias?.producto ?? null} />
        : <TablaCatalogo tipo="destinos" categoriasEntrenadas={categorias?.destino ?? null} />}
    </div>
  );
}

/**
 * @fileoverview Usuarios — Control de usuarios ERP, directorio de clientes
 * y asignación de rubros. Exclusivo de ADMIN (guard explícito: la única
 * entrada de navegación ya lo oculta para otros roles, pero la ruta es
 * alcanzable por URL directa).
 */
import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import api from '../../services/api';
import { useAuth, ROLES } from '../../context/AuthContext';

const ETIQUETA_ROL = { ADMIN: 'Administrador', MANAGER: 'Manager', AUDITOR: 'Auditor' };
const fmtFecha = (iso) => new Date(iso).toLocaleDateString('es-PE');

function ModalUsuario({ usuario, departamentos, onCerrar, onGuardado }) {
  const editando = !!usuario;
  const [email, setEmail]       = useState(usuario?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole]         = useState(usuario?.role ?? 'MANAGER');
  const [activo, setActivo]     = useState(usuario?.activo ?? true);
  const [deptIds, setDeptIds]   = useState(() => new Set((usuario?.departamentos ?? []).map((d) => d.id)));
  const [error, setError]       = useState(null);
  const [enviando, setEnviando] = useState(false);

  const toggleDept = (id) => {
    setDeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const guardar = async () => {
    setEnviando(true);
    setError(null);
    try {
      if (editando) {
        await api.patch(`/usuarios/${usuario.id}`, { role, activo });
        await api.patch(`/usuarios/${usuario.id}/departamentos`, { departamentoIds: [...deptIds] });
      } else {
        await api.post('/usuarios', { email, password, role, departamentoIds: [...deptIds] });
      }
      onGuardado();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar');
      setEnviando(false);
    }
  };

  return (
    <div className="erp-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="erp-modal" style={{ maxWidth: 460 }}>
        <div className="erp-eyebrow">{editando ? 'Editar usuario' : 'Nuevo usuario'}</div>
        <h3 className="erp-title" style={{ fontSize: 22, marginBottom: 16 }}>
          {editando ? usuario.email : 'Crear cuenta ERP'}
        </h3>

        {error && <div className="erp-alert erp-alert--error" style={{ marginBottom: 14 }}>{error}</div>}

        {!editando && (
          <>
            <label className="erp-label">Correo</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="erp-input" style={{ marginBottom: 14 }} />
            <label className="erp-label">Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="erp-input" style={{ marginBottom: 14 }} placeholder="Mínimo 8 caracteres" />
          </>
        )}

        <label className="erp-label">Rol</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="erp-select" style={{ marginBottom: 14 }}>
          <option value="ADMIN">Administrador</option>
          <option value="MANAGER">Manager</option>
          <option value="AUDITOR">Auditor</option>
        </select>

        {editando && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13.5 }}>
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            Cuenta activa (desmarcar bloquea el inicio de sesión)
          </label>
        )}

        {role !== 'AUDITOR' && (
          <>
            <label className="erp-label">Rubros que administra</label>
            <div style={{ display: 'grid', gap: 6, marginBottom: 20 }}>
              {departamentos.map((d) => (
                <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
                  <input type="checkbox" checked={deptIds.has(d.id)} onChange={() => toggleDept(d.id)} />
                  {d.nombre}
                </label>
              ))}
            </div>
          </>
        )}
        {role === 'AUDITOR' && (
          <p className="erp-sub" style={{ fontSize: 12, marginBottom: 20 }}>
            AUDITOR audita todos los rubros automáticamente — no requiere asignación.
          </p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCerrar} className="erp-btn erp-btn--ghost" style={{ flex: 1 }}>Cancelar</button>
          <button
            onClick={guardar}
            disabled={enviando || (!editando && (!email || password.length < 8))}
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

ModalUsuario.propTypes = {
  usuario: PropTypes.object,
  departamentos: PropTypes.array.isRequired,
  onCerrar: PropTypes.func.isRequired,
  onGuardado: PropTypes.func.isRequired,
};
ModalUsuario.defaultProps = { usuario: null };

function TabUsuarios() {
  const { user: yo } = useAuth();
  const [usuarios, setUsuarios]         = useState(null);
  const [departamentos, setDepartamentos] = useState([]);
  const [error, setError]               = useState(null);
  const [modal, setModal]               = useState(null); // null | 'nuevo' | usuario

  const cargar = useCallback(async () => {
    try {
      const [{ data: u }, { data: d }] = await Promise.all([
        api.get('/usuarios'),
        api.get('/departamentos'),
      ]);
      setUsuarios(u.data);
      setDepartamentos(d.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar usuarios');
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleActivo = async (u) => {
    try {
      await api.patch(`/usuarios/${u.id}`, { activo: !u.activo });
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo actualizar');
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => setModal('nuevo')} className="erp-btn erp-btn--accent erp-btn--sm">
          + Nuevo usuario
        </button>
      </div>

      {error && <div className="erp-alert erp-alert--error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="erp-card" style={{ overflow: 'hidden' }}>
        {!usuarios && <p className="erp-sub" style={{ padding: 24 }}>Cargando…</p>}
        {usuarios && (
          <div style={{ overflowX: 'auto' }}>
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Rubros</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                  <th>Creado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td style={{ color: 'var(--ink)', fontWeight: 500 }}>{u.email}</td>
                    <td>{ETIQUETA_ROL[u.role] ?? u.role}</td>
                    <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      {u.role === 'AUDITOR' ? 'Todos' : (u.departamentos.map((d) => d.nombre).join(', ') || '—')}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={'erp-badge ' + (u.activo ? 'erp-badge--liquidada' : 'erp-badge--rechazada')}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmtFecha(u.creadoEn)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setModal(u)} className="erp-btn erp-btn--ghost erp-btn--sm" style={{ marginRight: 6 }}>
                        Editar
                      </button>
                      <button
                        onClick={() => toggleActivo(u)}
                        disabled={u.id === yo.id}
                        title={u.id === yo.id ? 'No puedes desactivar tu propia cuenta' : ''}
                        className="erp-btn erp-btn--ghost erp-btn--sm"
                      >
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <ModalUsuario
          usuario={modal === 'nuevo' ? null : modal}
          departamentos={departamentos}
          onCerrar={() => setModal(null)}
          onGuardado={() => { setModal(null); cargar(); }}
        />
      )}
    </>
  );
}

function ModalClienteNuevo({ onCerrar, onGuardado }) {
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [email, setEmail]     = useState('');
  const [empresa, setEmpresa] = useState('');
  const [pais, setPais]       = useState('');
  const [telefono, setTelefono] = useState('');
  const [error, setError]       = useState(null);
  const [enviando, setEnviando] = useState(false);

  const guardar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await api.post('/clientes', {
        nombreCompleto, email,
        empresa: empresa || undefined,
        pais: pais || undefined,
        telefono: telefono || undefined,
      });
      onGuardado();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el cliente');
      setEnviando(false);
    }
  };

  return (
    <div className="erp-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="erp-modal" style={{ maxWidth: 440 }}>
        <div className="erp-eyebrow">Alta rápida</div>
        <h3 className="erp-title" style={{ fontSize: 22, marginBottom: 4 }}>Nuevo cliente</h3>
        <p className="erp-sub" style={{ fontSize: 12, marginBottom: 16 }}>
          Se crea sin acceso al portal — solo para seguimiento. El acceso se activa después.
        </p>

        {error && <div className="erp-alert erp-alert--error" style={{ marginBottom: 14 }}>{error}</div>}

        <label className="erp-label">Nombre completo</label>
        <input type="text" value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} className="erp-input" style={{ marginBottom: 14 }} />
        <label className="erp-label">Correo</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="erp-input" style={{ marginBottom: 14 }} />
        <label className="erp-label">Empresa (opcional)</label>
        <input type="text" value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="erp-input" style={{ marginBottom: 14 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <div>
            <label className="erp-label">País (opcional)</label>
            <input type="text" value={pais} onChange={(e) => setPais(e.target.value)} className="erp-input" />
          </div>
          <div>
            <label className="erp-label">Teléfono (opcional)</label>
            <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="erp-input" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCerrar} className="erp-btn erp-btn--ghost" style={{ flex: 1 }}>Cancelar</button>
          <button
            onClick={guardar}
            disabled={enviando || !nombreCompleto.trim() || !email.trim()}
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

ModalClienteNuevo.propTypes = {
  onCerrar: PropTypes.func.isRequired,
  onGuardado: PropTypes.func.isRequired,
};

function ModalActivarAcceso({ cliente, onCerrar, onGuardado }) {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState(null);
  const [enviando, setEnviando] = useState(false);

  const guardar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await api.patch(`/clientes/${cliente.id}/activar-acceso`, { password });
      onGuardado();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo activar el acceso');
      setEnviando(false);
    }
  };

  return (
    <div className="erp-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="erp-modal" style={{ maxWidth: 420 }}>
        <div className="erp-eyebrow">Activar acceso al portal</div>
        <h3 className="erp-title" style={{ fontSize: 22, marginBottom: 16 }}>{cliente.nombreCompleto}</h3>

        {error && <div className="erp-alert erp-alert--error" style={{ marginBottom: 14 }}>{error}</div>}

        <label className="erp-label">Contraseña inicial</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="erp-input"
          style={{ marginBottom: 20 }}
          placeholder="Mínimo 8 caracteres"
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCerrar} className="erp-btn erp-btn--ghost" style={{ flex: 1 }}>Cancelar</button>
          <button
            onClick={guardar}
            disabled={enviando || password.length < 8}
            className="erp-btn erp-btn--accent"
            style={{ flex: 1 }}
          >
            {enviando ? 'Activando…' : 'Activar acceso'}
          </button>
        </div>
      </div>
    </div>
  );
}

ModalActivarAcceso.propTypes = {
  cliente: PropTypes.object.isRequired,
  onCerrar: PropTypes.func.isRequired,
  onGuardado: PropTypes.func.isRequired,
};

function TabClientes() {
  const [clientes, setClientes] = useState(null);
  const [error, setError]       = useState(null);
  const [modal, setModal]       = useState(null); // null | 'nuevo' | cliente (activar acceso)

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/clientes');
      setClientes(data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar clientes');
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => setModal('nuevo')} className="erp-btn erp-btn--accent erp-btn--sm">
          + Nuevo cliente
        </button>
      </div>

      <div className="erp-card" style={{ overflow: 'hidden' }}>
        {error && <div className="erp-alert erp-alert--error" style={{ margin: 20 }}>{error}</div>}
        {!clientes && !error && <p className="erp-sub" style={{ padding: 24 }}>Cargando…</p>}
        {clientes && (
          <div style={{ overflowX: 'auto' }}>
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Empresa</th>
                  <th>País</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th style={{ textAlign: 'center' }}>Acceso portal</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                  <th>Registrado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id}>
                    <td style={{ color: 'var(--ink)', fontWeight: 500 }}>{c.nombreCompleto}</td>
                    <td>{c.empresa ?? '—'}</td>
                    <td>{c.pais ?? '—'}</td>
                    <td style={{ fontSize: 12.5 }}>{c.email}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{c.telefono ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={'erp-badge ' + (c.tieneAcceso ? 'erp-badge--liquidada' : 'erp-badge--neutral')}>
                        {c.tieneAcceso ? 'Activo' : 'Sin acceso'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={'erp-badge ' + (c.activo ? 'erp-badge--liquidada' : 'erp-badge--rechazada')}>
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmtFecha(c.creadoEn)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {!c.tieneAcceso && (
                        <button onClick={() => setModal(c)} className="erp-btn erp-btn--ghost erp-btn--sm">
                          Activar acceso
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {clientes.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-3)' }}>Sin clientes registrados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal === 'nuevo' && (
        <ModalClienteNuevo
          onCerrar={() => setModal(null)}
          onGuardado={() => { setModal(null); cargar(); }}
        />
      )}
      {modal && modal !== 'nuevo' && (
        <ModalActivarAcceso
          cliente={modal}
          onCerrar={() => setModal(null)}
          onGuardado={() => { setModal(null); cargar(); }}
        />
      )}
    </>
  );
}

export default function Usuarios() {
  const { user } = useAuth();
  const [tab, setTab] = useState('usuarios');

  if (user?.role !== ROLES.ADMIN) {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <div className="erp-page">
      <div className="erp-eyebrow">Administración</div>
      <h1 className="erp-title">Control de usuarios.</h1>
      <p className="erp-sub" style={{ marginBottom: 22 }}>
        Usuarios del ERP, rubros que administran, y directorio de clientes del portal externo.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setTab('usuarios')}
          className={'erp-btn erp-btn--sm ' + (tab === 'usuarios' ? 'erp-btn--accent' : 'erp-btn--ghost')}
        >
          Usuarios ERP
        </button>
        <button
          onClick={() => setTab('clientes')}
          className={'erp-btn erp-btn--sm ' + (tab === 'clientes' ? 'erp-btn--accent' : 'erp-btn--ghost')}
        >
          Clientes
        </button>
      </div>

      {tab === 'usuarios' ? <TabUsuarios /> : <TabClientes />}
    </div>
  );
}

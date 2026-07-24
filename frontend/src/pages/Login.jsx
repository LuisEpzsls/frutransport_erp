import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login }    = useAuth();
  const navigate     = useNavigate();
  const location     = useLocation();
  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * Mapa de rol → ruta de inicio de sesión.
   * Alineado con el árbol de rutas definido en App.jsx.
   * @type {Record<string, string>}
   */
  const HOME_BY_ROLE = {
    ADMIN:   '/admin/dashboard',
    MANAGER: '/admin/dashboard',
    AUDITOR: '/auditor/historial',
    CLIENTE: '/cliente/cotizaciones',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedUser = await login(form.email, form.password);
      // Si venía de una ruta protegida (deep-link), volver a ella; si no,
      // al home del rol. Rol no mapeado (dato inesperado) → inicio.
      const destination =
        location.state?.from?.pathname ?? HOME_BY_ROLE[loggedUser?.role] ?? '/';
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Marca */}
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 26 }}>
          <div className="brand-mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 19V5h12" /><path d="M5 12h9" /><path d="M14 8l5 4-5 4" />
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-name">Frutransport</span>
            <span className="brand-tag">ERP · Acceso interno</span>
          </div>
        </div>

        {/* Card */}
        <div className="erp-card" style={{ padding: '30px 32px' }}>
          <div className="erp-eyebrow">Mi cuenta / Acceso</div>
          <h1 className="erp-title" style={{ fontSize: 28, marginBottom: 20 }}>
            Bienvenido de vuelta.
          </h1>

          {error && (
            <div className="erp-alert erp-alert--error" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label className="erp-label" htmlFor="login-email">Correo corporativo</label>
              <input
                id="login-email"
                type="email"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="usuario@frutransport.pe"
                className="erp-input"
                autoComplete="email"
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label className="erp-label" htmlFor="login-pwd">Contraseña</label>
              <input
                id="login-pwd"
                type="password"
                required
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                className="erp-input"
                autoComplete="current-password"
              />
            </div>
            <button type="submit" disabled={loading} className="erp-btn erp-btn--primary">
              {loading ? 'Ingresando…' : 'Iniciar sesión'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13 }}>
          <Link to="/" style={{ color: 'var(--ink-3)' }}>← Volver al inicio</Link>
        </p>
      </div>
    </div>
  );
}

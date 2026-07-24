/**
 * @fileoverview Unauthorized — Página de acceso denegado.
 *
 * Se muestra cuando un usuario autenticado intenta acceder a una ruta
 * para la cual su rol no tiene permiso. No tiene lógica de negocio.
 */

import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Mapeo de rol a ruta home. */
const HOME_BY_ROLE = {
  ADMIN:   '/admin/dashboard',
  MANAGER: '/admin/dashboard',
  AUDITOR: '/auditor/historial',
  CLIENTE: '/cliente/cotizaciones',
};

export default function Unauthorized() {
  const { user } = useAuth();
  const homeRoute = (user?.role && HOME_BY_ROLE[user.role]) || '/login';

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center', padding: '2rem',
    }}>
      <div className="erp-eyebrow" style={{ marginBottom: 10 }}>Acceso restringido</div>
      <h1 className="erp-title" style={{ fontSize: 36 }}>Esta sección no está disponible para tu rol.</h1>
      <p className="erp-sub" style={{ maxWidth: 420, margin: '10px 0 28px', lineHeight: 1.6 }}>
        Tu cuenta ({user?.email}) con rol{' '}
        <strong style={{ color: 'var(--warn)' }}>{user?.role}</strong>{' '}
        no tiene permiso para acceder a esta sección.
      </p>
      <Link to={homeRoute} className="erp-btn erp-btn--accent" style={{ textDecoration: 'none' }}>
        Volver a mi panel
      </Link>
    </div>
  );
}

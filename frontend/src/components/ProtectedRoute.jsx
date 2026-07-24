/**
 * @fileoverview ProtectedRoute — Guardia de navegación basado en rol.
 *
 * Lógica de intercepción:
 *  1. Si la sesión aún está cargando  → muestra un spinner neutral.
 *  2. Si no hay usuario autenticado   → redirige a /login.
 *  3. Si el rol no está en allowedRoles → redirige a /unauthorized.
 *  4. Si todo es válido               → renderiza children.
 *
 * Uso:
 *  <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
 *    <AdminDashboard />
 *  </ProtectedRoute>
 */

import { Navigate, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '../context/AuthContext';

// ---------------------------------------------------------------------------
// Spinner de carga (sin dependencias externas, sin lógica de UI compleja)
// ---------------------------------------------------------------------------

function LoadingScreen() {
  return (
    <div
      role="status"
      aria-label="Verificando sesión…"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          border: '3px solid var(--line)',
          borderTop: '3px solid var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          display: 'inline-block',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProtectedRoute
// ---------------------------------------------------------------------------

/**
 * @param {Object}   props
 * @param {import('react').ReactNode} props.children    - Contenido protegido.
 * @param {string[]} props.allowedRoles                 - Array de roles permitidos.
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location          = useLocation();

  // 1. Sesión aún cargando
  if (loading) {
    return <LoadingScreen />;
  }

  // 2. No autenticado → /login, preservando la ruta de origen
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Rol no permitido → /unauthorized
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // 4. Todo válido
  return children;
}

ProtectedRoute.propTypes = {
  children:     PropTypes.node.isRequired,
  /** Roles que tienen acceso a esta ruta. Array vacío = cualquier usuario autenticado. */
  allowedRoles: PropTypes.arrayOf(PropTypes.string),
};

ProtectedRoute.defaultProps = {
  allowedRoles: [],
};

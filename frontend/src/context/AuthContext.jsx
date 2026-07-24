/**
 * @fileoverview AuthContext — Proveedor global de autenticación para Frutransport ERP.
 *
 * Responsabilidades:
 *  - Persistir el JWT en localStorage bajo la clave 'erp_token'.
 *  - Hidratar el estado `user` al montar la app (llamada a /auth/me).
 *  - Exponer `login`, `logout` y los flags `user` / `loading`.
 *
 * El objeto `user` que devuelve la API **debe** incluir:
 *   { id, email, role: 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'CLIENTE' }
 * Los roles son los del enum de Prisma (RolERP) + CLIENTE para el portal
 * externo. NUNCA se traducen en el frontend.
 *
 * NOTA DE SEGURIDAD: localStorage es suficiente para MVPs internos, pero
 * en producción se recomienda migrar a httpOnly cookies.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import PropTypes from 'prop-types';
import api from '../services/api';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Clave de almacenamiento del token JWT. */
const TOKEN_KEY = 'erp_token';

/** Roles válidos del sistema (enum RolERP de Prisma + CLIENTE del portal). */
export const ROLES = /** @type {const} */ ({
  ADMIN:   'ADMIN',
  MANAGER: 'MANAGER',
  AUDITOR: 'AUDITOR',
  CLIENTE: 'CLIENTE',
});

// ---------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} AuthUser
 * @property {string} id
 * @property {string} email
 * @property {'ADMIN'|'MANAGER'|'AUDITOR'|'CLIENTE'} role
 */

/**
 * @typedef {Object} AuthContextValue
 * @property {AuthUser|null} user       - Usuario autenticado o null.
 * @property {boolean}       loading    - true mientras se verifica el token al inicio.
 * @property {Function}      login      - (email, password) => Promise<AuthUser>
 * @property {Function}      logout     - () => void
 */

/** @type {import('react').Context<AuthContextValue>} */
const AuthContext = createContext(null);

// ---------------------------------------------------------------------------
// Proveedor
// ---------------------------------------------------------------------------

/**
 * Proveedor de autenticación. Debe envolver toda la aplicación.
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export function AuthProvider({ children }) {
  /** @type {[AuthUser|null, Function]} */
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Al montar: rehidratar sesión desde el token guardado ────────────────
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get('/auth/me')
      .then((r) => setUser(r.data.user))
      .catch(() => {
        // Token inválido o expirado → limpiar
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── login ────────────────────────────────────────────────────────────────
  /**
   * Autentica al usuario y almacena el token JWT.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<AuthUser>}
   */
  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  }, []);

  // ── logout ───────────────────────────────────────────────────────────────
  /**
   * Cierra la sesión del usuario y elimina el token.
   */
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

// ---------------------------------------------------------------------------
// Hook de consumo
// ---------------------------------------------------------------------------

/**
 * Hook para consumir el contexto de autenticación.
 * Lanza un error si se usa fuera de <AuthProvider>.
 *
 * @returns {AuthContextValue}
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() debe usarse dentro de <AuthProvider>.');
  }
  return ctx;
}

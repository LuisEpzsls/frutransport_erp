import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { IconChev } from './icons/index.jsx';

const ETIQUETA_ROL = { ADMIN: 'Administrador', MANAGER: 'Manager', AUDITOR: 'Auditor', CLIENTE: 'Cliente' };

/** Usuario + cerrar sesión, arriba a la derecha (reemplaza el bloque del sidebar). */
export default function UserMenu() {
  const { user, logout } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const inicial = user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu-btn"
        onClick={() => setAbierto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={user?.email ? `Cuenta: ${user.email}` : 'Menú de usuario'}
      >
        <span className="user-avatar">{inicial}</span>
        <span className="user-menu-text">
          <span className="user-menu-mail">{user?.email}</span>
          <span className="user-menu-role">{ETIQUETA_ROL[user?.role] ?? user?.role}</span>
        </span>
        <IconChev />
      </button>

      {abierto && (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-dropdown-head">
            <div className="user-menu-mail">{user?.email}</div>
            <span className="erp-eyebrow">{ETIQUETA_ROL[user?.role] ?? user?.role}</span>
          </div>
          <button type="button" className="user-menu-logout" onClick={logout} role="menuitem">
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

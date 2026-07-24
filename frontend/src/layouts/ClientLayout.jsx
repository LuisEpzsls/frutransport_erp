/**
 * @fileoverview ClientLayout — Shell del portal externo de clientes.
 * Topbar ligera con la identidad de la landing.
 */

import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function ClientLayout() {
  const { user, logout } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
      <header className="nav-shell">
        <div className="nav" style={{ gridTemplateColumns: '1fr auto' }}>
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 19V5h12" /><path d="M5 12h9" /><path d="M14 8l5 4-5 4" />
              </svg>
            </div>
            <div className="brand-text">
              <span className="brand-name">Frutransport</span>
              <span className="brand-tag">Portal Cliente</span>
            </div>
          </div>
          <div className="nav-right" style={{ gap: 16 }}>
            <ThemeToggle />
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{user?.email}</span>
            <button onClick={logout} className="erp-logout">Cerrar sesión</button>
          </div>
        </div>
      </header>

      <main className="erp-main">
        <Outlet />
      </main>
    </div>
  );
}

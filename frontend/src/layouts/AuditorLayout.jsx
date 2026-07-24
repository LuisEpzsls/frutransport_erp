/**
 * @fileoverview AuditorLayout — Shell del ERP para AUDITOR (solo lectura).
 * Mismo lenguaje visual que la landing; el dorado identifica la zona de
 * auditoría. AUDITOR audita todos los rubros sin selector (ve todo).
 */

import { Outlet, NavLink } from 'react-router-dom';
import Topbar from '../components/Topbar';

const AUDITOR_NAV = [
  { to: '/auditor/historial', label: 'Historial' },
  { to: '/auditor/reportes',  label: 'Reportes' },
];

export default function AuditorLayout() {
  return (
    <div className="erp-shell">
      <aside className="erp-side">
        <div className="brand">
          <div className="brand-mark" style={{ background: 'var(--gold-2)' }} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 19V5h12" /><path d="M5 12h9" /><path d="M14 8l5 4-5 4" />
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-name">Frutransport</span>
            <span className="brand-tag" style={{ color: 'var(--gold-2)' }}>Auditoría · Solo lectura</span>
          </div>
        </div>

        <nav className="erp-nav">
          {AUDITOR_NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => 'erp-nav-item' + (isActive ? ' active' : '')}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="erp-main">
        <Topbar />
        <Outlet />
      </main>
    </div>
  );
}

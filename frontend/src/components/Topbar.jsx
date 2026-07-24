import PropTypes from 'prop-types';
import RubroSelector from './RubroSelector';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import UserMenu from './UserMenu';

/**
 * Barra superior de las zonas autenticadas: selector de rubro a la
 * izquierda (opcional — AUDITOR/CLIENTE no lo usan), notificaciones + tema
 * + usuario/cerrar sesión a la derecha.
 */
export default function Topbar({ conRubro }) {
  return (
    <header className="erp-topbar">
      <div className="erp-topbar-left">
        {conRubro && <RubroSelector />}
      </div>
      <div className="erp-topbar-right">
        <NotificationBell />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}

Topbar.propTypes = { conRubro: PropTypes.bool };
Topbar.defaultProps = { conRubro: false };

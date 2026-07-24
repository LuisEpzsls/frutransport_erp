import { NavLink } from 'react-router-dom';
import { useAuth, ROLES } from '../context/AuthContext';
import { useRubro } from '../context/RubroContext';
import TipoCambioSunat from './TipoCambioSunat';

// Agroexportación es el único rubro con funcionalidad de negocio hoy; los
// demás muestran su propio Dashboard "en construcción" (misma ruta /admin/
// dashboard, pero Dashboard.jsx decide el contenido según el rubro activo).
const NAV_AGROEXPORT = [
  { path: '/admin/dashboard', label: 'Dashboard',       end: true },
  { path: '/admin/ml',           label: 'Cotizaciones ML' },
  { path: '/admin/historial',    label: 'Historial' },
  { path: '/admin/contenedores', label: 'Contenedores' },
  { path: '/admin/reportes',     label: 'Reportes' },
];
const NAV_GENERICO = [
  { path: '/admin/dashboard', label: 'Dashboard', end: true },
];

export default function Sidebar() {
  const { user } = useAuth();
  const { rubroActivo } = useRubro();

  const navItems = rubroActivo?.slug === 'agroexport' ? NAV_AGROEXPORT : NAV_GENERICO;

  return (
    <aside className="erp-side">
      {/* Marca — misma identidad que la landing */}
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 19V5h12" /><path d="M5 12h9" /><path d="M14 8l5 4-5 4" />
          </svg>
        </div>
        <div className="brand-text">
          <span className="brand-name">Frutransport</span>
          <span className="brand-tag">ERP · Interno</span>
        </div>
      </div>

      <nav className="erp-nav">
        {navItems.map(({ path, label, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) => 'erp-nav-item' + (isActive ? ' active' : '')}
          >
            {label}
          </NavLink>
        ))}

        {/* Control de usuarios y catálogo: transversal a los rubros, exclusivo de ADMIN */}
        {user?.role === ROLES.ADMIN && (
          <>
            <div className="erp-nav-sep" role="separator" />
            <NavLink
              to="/admin/usuarios"
              className={({ isActive }) => 'erp-nav-item' + (isActive ? ' active' : '')}
            >
              Usuarios
            </NavLink>
            <NavLink
              to="/admin/catalogo"
              className={({ isActive }) => 'erp-nav-item' + (isActive ? ' active' : '')}
            >
              Catálogo
            </NavLink>
          </>
        )}
      </nav>

      <TipoCambioSunat />
    </aside>
  );
}

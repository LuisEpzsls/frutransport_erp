/**
 * @fileoverview App.jsx — Raíz de la aplicación Frutransport ERP.
 *
 * Estrategia de enrutamiento:
 *  - Rutas públicas (/,  /login, /unauthorized): carga inmediata.
 *  - Rutas privadas: React.lazy() + Suspense para code splitting por rol.
 *    · Zona /admin/*   → chunk separado para ADMIN / MANAGER.
 *    · Zona /cliente/* → chunk separado para CLIENTE.
 *    · Zona /auditor/* → chunk separado para AUDITOR.
 *
 * ProtectedRoute recibe `allowedRoles` para validar el rol antes
 * de renderizar el Layout correspondiente.
 */

import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ROLES }        from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute   from './components/ProtectedRoute';

// ── Rutas públicas (carga inmediata) ──────────────────────────────────────
import LandingPage   from './pages/LandingPage';
import Login         from './pages/Login';
import Unauthorized  from './pages/Unauthorized';

// ── Lazy: chunk ADMIN / MANAGER ───────────────────────────────────────────
const AdminLayout   = lazy(() => import('./layouts/AdminLayout'));
const Dashboard     = lazy(() => import('./pages/Dashboard'));
// Stubs: se crearán a medida que el proyecto avance
const MLCotizaciones = lazy(() => import('./pages/admin/MLCotizaciones'));
const Historial      = lazy(() => import('./pages/admin/Historial'));
const Reportes       = lazy(() => import('./pages/admin/Reportes'));
const Usuarios       = lazy(() => import('./pages/admin/Usuarios'));
const Catalogo       = lazy(() => import('./pages/admin/Catalogo'));
const Contenedores   = lazy(() => import('./pages/admin/Contenedores'));

// ── Lazy: chunk CLIENTE ────────────────────────────────────────────────────
const ClientLayout     = lazy(() => import('./layouts/ClientLayout'));
const ClienteCotizaciones = lazy(() => import('./pages/cliente/Cotizaciones'));

// ── Lazy: chunk AUDITOR ────────────────────────────────────────────────────
const AuditorLayout     = lazy(() => import('./layouts/AuditorLayout'));
const AuditorHistorial  = lazy(() => import('./pages/auditor/Historial'));
const AuditorReportes   = lazy(() => import('./pages/auditor/Reportes'));

// ---------------------------------------------------------------------------
// Spinner universal de Suspense (sin lógica de UI, solo presentación)
// ---------------------------------------------------------------------------

function PageLoader() {
  return (
    <div
      role="status"
      aria-label="Cargando módulo…"
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
          width: 36,
          height: 36,
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
// Árbol de rutas
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>

            {/* ── Rutas públicas ───────────────────────────────────────── */}
            <Route path="/"            element={<LandingPage />} />
            <Route path="/login"       element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* ── Zona ADMIN / MANAGER ─────────────────────────────────── */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.MANAGER]}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              {/* /admin → redirige al dashboard */}
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard"    element={<Dashboard />} />
              <Route path="ml"           element={<MLCotizaciones />} />
              <Route path="historial"    element={<Historial />} />
              <Route path="contenedores" element={<Contenedores />} />
              <Route path="reportes"     element={<Reportes />} />
              <Route path="usuarios"     element={<Usuarios />} />
              <Route path="catalogo"     element={<Catalogo />} />
            </Route>

            {/* ── Zona CLIENTE ─────────────────────────────────────────── */}
            <Route
              path="/cliente"
              element={
                <ProtectedRoute allowedRoles={[ROLES.CLIENTE]}>
                  <ClientLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="cotizaciones" replace />} />
              <Route path="cotizaciones" element={<ClienteCotizaciones />} />
            </Route>

            {/* ── Zona AUDITOR ──────────────────────────────────────────── */}
            <Route
              path="/auditor"
              element={
                <ProtectedRoute allowedRoles={[ROLES.AUDITOR]}>
                  <AuditorLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="historial" replace />} />
              <Route path="historial" element={<AuditorHistorial />} />
              <Route path="reportes"  element={<AuditorReportes />} />
            </Route>

            {/* ── Ruta legacy /dashboard (retrocompatibilidad) ─────────── */}
            {/*
              Mientras se migran los links existentes (Sidebar, etc.),
              se mantiene esta redirección temporal.
            */}
            <Route
              path="/dashboard"
              element={<Navigate to="/admin/dashboard" replace />}
            />
            <Route
              path="/dashboard/*"
              element={<Navigate to="/admin/dashboard" replace />}
            />

            {/* ── Catch-all ─────────────────────────────────────────────── */}
            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}

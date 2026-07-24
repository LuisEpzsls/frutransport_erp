/**
 * @fileoverview AdminLayout — Shell del ERP para ADMIN/MANAGER.
 * Mismo lenguaje visual que la landing (tokens de index.css).
 */

import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { RubroProvider } from '../context/RubroContext';

export default function AdminLayout() {
  return (
    <RubroProvider>
      <div className="erp-shell">
        <Sidebar />
        <main className="erp-main">
          <Topbar conRubro />
          <Outlet />
        </main>
      </div>
    </RubroProvider>
  );
}

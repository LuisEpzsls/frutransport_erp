/**
 * @fileoverview Historial — Cotizaciones con liquidación para ADMIN/MANAGER,
 * acotadas al rubro activo (selector del Topbar). Solo Agroexportación tiene
 * cotizaciones hoy; otros rubros vuelven al dashboard.
 */
import { Navigate } from 'react-router-dom';
import TablaCotizaciones from '../../components/TablaCotizaciones';
import { useRubro } from '../../context/RubroContext';

export default function Historial() {
  const { rubroActivo } = useRubro();
  if (rubroActivo && rubroActivo.slug !== 'agroexport') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <TablaCotizaciones departamentoId={rubroActivo?.id} rubroNombre={rubroActivo?.nombre} />;
}

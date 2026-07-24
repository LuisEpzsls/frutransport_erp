/**
 * @fileoverview Cotizaciones — Portal de cotizaciones (Cliente, solo lectura).
 * El backend ya restringe /api/cotizaciones a las del propio cliente
 * (where.clienteId = self cuando el rol es CLIENTE) — misma tabla que
 * admin/auditor, sin columnas internas del ERP (Usuario, Origen).
 */
import TablaCotizaciones from '../../components/TablaCotizaciones';

export default function Cotizaciones() {
  return <TablaCotizaciones soloLectura vistaExterna rubroNombre="Mi cuenta" />;
}

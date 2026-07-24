import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { IconBell } from './icons/index.jsx';

const fmtRelativo = (iso) => {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return 'ahora';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.round(horas / 24)} d`;
};

/** Campana de notificaciones funcional: datos reales de /api/notificaciones. */
export default function NotificationBell() {
  const [datos, setDatos]     = useState({ data: [], noLeidas: 0 });
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const cargar = useCallback(() => {
    api.get('/notificaciones').then(({ data }) => setDatos(data)).catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 60000); // refresco liviano, sin websockets
    return () => clearInterval(id);
  }, [cargar]);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const abrirNotificacion = async (n) => {
    if (!n.leida) {
      await api.patch(`/notificaciones/${n.id}/leer`).catch(() => {});
      setDatos((d) => ({
        data: d.data.map((x) => (x.id === n.id ? { ...x, leida: true } : x)),
        noLeidas: Math.max(0, d.noLeidas - 1),
      }));
    }
    setAbierto(false);
    if (n.link) navigate(n.link);
  };

  const marcarTodas = async () => {
    await api.patch('/notificaciones/leer-todas').catch(() => {});
    setDatos((d) => ({ data: d.data.map((x) => ({ ...x, leida: true })), noLeidas: 0 }));
  };

  return (
    <div className="notif-wrap" ref={ref}>
      <button
        type="button"
        className="notif-btn"
        onClick={() => setAbierto((a) => !a)}
        aria-label={`Notificaciones${datos.noLeidas > 0 ? ` (${datos.noLeidas} sin leer)` : ''}`}
        aria-expanded={abierto}
      >
        <IconBell />
        {datos.noLeidas > 0 && <span className="notif-badge">{datos.noLeidas > 9 ? '9+' : datos.noLeidas}</span>}
      </button>

      {abierto && (
        <div className="notif-menu">
          <div className="notif-menu-head">
            <span className="erp-eyebrow">Notificaciones</span>
            {datos.noLeidas > 0 && (
              <button type="button" className="notif-link" onClick={marcarTodas}>Marcar todas leídas</button>
            )}
          </div>
          <div className="notif-list">
            {datos.data.length === 0 && (
              <p className="notif-empty">Sin notificaciones.</p>
            )}
            {datos.data.map((n) => (
              <button
                key={n.id}
                type="button"
                className={'notif-item' + (n.leida ? '' : ' unread')}
                onClick={() => abrirNotificacion(n)}
              >
                {!n.leida && <span className="notif-dot" aria-hidden="true" />}
                <span className="notif-msg">{n.mensaje}</span>
                <span className="notif-time">{fmtRelativo(n.creadoEn)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

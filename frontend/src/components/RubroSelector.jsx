import { useState, useRef, useEffect } from 'react';
import { useRubro } from '../context/RubroContext';
import { DIV_ICONS, IconChev } from './icons/index.jsx';

// Mismo orden que backend/prisma/seed.js -> departamentos
const ICONO_POR_SLUG = {
  agroexport: DIV_ICONS[0],
  importaciones: DIV_ICONS[1],
  automotriz: DIV_ICONS[2],
  logistica: DIV_ICONS[3],
  transporte: DIV_ICONS[4],
  telecom: DIV_ICONS[5],
};

export default function RubroSelector() {
  const { rubros, rubroActivo, setRubroActivo, cargando } = useRubro();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (cargando || !rubroActivo) return <div className="rubro-selector-placeholder" />;

  const IconoActivo = ICONO_POR_SLUG[rubroActivo.slug];

  return (
    <div className="rubro-selector" ref={ref}>
      <button
        type="button"
        className="rubro-btn"
        onClick={() => setAbierto((a) => !a)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        disabled={rubros.length <= 1}
      >
        <span className="rubro-ico">{IconoActivo && <IconoActivo />}</span>
        <span className="rubro-nombre">{rubroActivo.nombre}</span>
        {rubros.length > 1 && <IconChev />}
      </button>

      {abierto && rubros.length > 1 && (
        <div className="rubro-menu" role="listbox">
          {rubros.map((r) => {
            const Icono = ICONO_POR_SLUG[r.slug];
            return (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={r.id === rubroActivo.id}
                className={'rubro-item' + (r.id === rubroActivo.id ? ' active' : '')}
                onClick={() => { setRubroActivo(r); setAbierto(false); }}
              >
                <span className="rubro-ico">{Icono && <Icono />}</span>
                {r.nombre}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

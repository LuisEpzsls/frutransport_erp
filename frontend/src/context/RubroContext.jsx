/**
 * @fileoverview RubroContext — Rubro (departamento) activo del panel admin.
 *
 * El ERP administra varios rubros dentro de la misma empresa (Agroexportación,
 * Importaciones, Servicios Automotrices, Logística y Mudanzas, Transporte
 * Pesado, Telecomunicaciones). Este contexto:
 *  - Carga los rubros que el usuario autenticado puede operar
 *    (GET /api/departamentos/mios — ADMIN/AUDITOR ven todos, MANAGER solo
 *    los que tenga asignados).
 *  - Persiste el rubro activo elegido (localStorage) y lo restaura al
 *    recargar; si el rubro guardado ya no está disponible, cae al primero.
 *  - Solo aplica a ADMIN/MANAGER (la zona con selector); AUDITOR y CLIENTE
 *    no lo usan.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import api from '../services/api';
import { useAuth, ROLES } from './AuthContext';

const STORAGE_KEY = 'erp_rubro_slug';
const RubroContext = createContext(null);

export function RubroProvider({ children }) {
  const { user } = useAuth();
  const [rubros, setRubros]           = useState([]);
  const [rubroActivo, setRubroActivoState] = useState(null);
  const [cargando, setCargando]       = useState(true);

  const puedeUsarSelector = user && [ROLES.ADMIN, ROLES.MANAGER].includes(user.role);

  useEffect(() => {
    if (!puedeUsarSelector) {
      setRubros([]);
      setRubroActivoState(null);
      setCargando(false);
      return;
    }
    setCargando(true);
    api.get('/departamentos/mios')
      .then(({ data }) => {
        setRubros(data.data);
        const slugGuardado = localStorage.getItem(STORAGE_KEY);
        const encontrado = data.data.find((d) => d.slug === slugGuardado);
        setRubroActivoState(encontrado ?? data.data[0] ?? null);
      })
      .catch(() => setRubros([]))
      .finally(() => setCargando(false));
  }, [puedeUsarSelector, user?.id]);

  const setRubroActivo = useCallback((departamento) => {
    setRubroActivoState(departamento);
    if (departamento) localStorage.setItem(STORAGE_KEY, departamento.slug);
  }, []);

  return (
    <RubroContext.Provider value={{ rubros, rubroActivo, setRubroActivo, cargando }}>
      {children}
    </RubroContext.Provider>
  );
}

RubroProvider.propTypes = { children: PropTypes.node.isRequired };

export function useRubro() {
  const ctx = useContext(RubroContext);
  if (!ctx) throw new Error('useRubro() debe usarse dentro de <RubroProvider>.');
  return ctx;
}

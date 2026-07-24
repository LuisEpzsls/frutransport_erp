/**
 * @fileoverview ThemeContext — Modo claro/oscuro para toda la app (landing + ERP).
 *
 * Los tokens en sí viven en index.css (:root vs [data-theme="dark"]); este
 * contexto solo decide y persiste CUÁL corresponde mostrar:
 *  - Sin preferencia guardada: sigue prefers-color-scheme del sistema en vivo.
 *  - Con preferencia guardada (el usuario tocó el toggle): esa gana siempre,
 *    hasta que se borre o se cambie de nuevo.
 *
 * index.html tiene un script inline que aplica data-theme ANTES de que React
 * monte, para no parpadear del tema equivocado al cargar.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

const STORAGE_KEY = 'erp_theme';

const ThemeContext = createContext(null);

const temaDelSistema = () =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || temaDelSistema()
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Sin preferencia explícita: seguir los cambios del sistema en vivo.
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setThemeState(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((t) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

ThemeProvider.propTypes = { children: PropTypes.node.isRequired };

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme() debe usarse dentro de <ThemeProvider>.');
  return ctx;
}

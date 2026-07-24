import { useTheme } from '../context/ThemeContext';
import { IconSun, IconMoon } from './icons/index.jsx';

/** Botón compacto para alternar claro/oscuro. Reutilizable en cualquier header. */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const esOscuro = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={esOscuro ? 'Modo claro' : 'Modo oscuro'}
      className="theme-toggle"
    >
      {esOscuro ? <IconSun /> : <IconMoon />}
    </button>
  );
}

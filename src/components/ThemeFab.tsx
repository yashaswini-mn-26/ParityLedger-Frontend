import { useTheme } from '../context/ThemeContext';

export default function ThemeFab() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className="theme-fab"
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
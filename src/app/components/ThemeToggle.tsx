import { useThemePreference } from '../hooks/useThemePreference';

function toThemeLabel(theme: 'day' | 'night') {
  return theme === 'day' ? 'Day' : 'Night';
}

export default function ThemeToggle() {
  const { theme, toggleTheme } = useThemePreference();
  const currentLabel = toThemeLabel(theme);
  const nextLabel = toThemeLabel(theme === 'day' ? 'night' : 'day');

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`현재 테마: ${currentLabel}. ${nextLabel} 테마로 전환`}
      aria-pressed={theme === 'night'}
      onClick={toggleTheme}
    >
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb" />
      </span>
      <span className="theme-toggle__label">{currentLabel}</span>
    </button>
  );
}

import { useCallback, useEffect, useState } from 'react';
import {
  applyTheme,
  getStoredTheme,
  getThemeMediaQuery,
  resolveInitialTheme,
  storeTheme,
  type ThemeMode,
} from '../theme/theme';

function getNextTheme(theme: ThemeMode): ThemeMode {
  return theme === 'day' ? 'night' : 'day';
}

export function useThemePreference() {
  const [theme, setTheme] = useState<ThemeMode>(() => resolveInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = getThemeMediaQuery();
    if (!mediaQuery) {
      return undefined;
    }

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      if (getStoredTheme() !== null) {
        return;
      }
      setTheme(event.matches ? 'night' : 'day');
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => {
      const nextTheme = getNextTheme(currentTheme);
      storeTheme(nextTheme);
      return nextTheme;
    });
  }, []);

  return { theme, toggleTheme };
}

export type ThemeMode = 'day' | 'night';

export const THEME_STORAGE_KEY = 'pdfwizard.theme';
export const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)';

export function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'day' || value === 'night';
}

export function getStoredTheme(): ThemeMode | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

export function getThemeMediaQuery(): MediaQueryList | null {
  if (typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia(SYSTEM_THEME_QUERY);
}

export function getSystemTheme(): ThemeMode {
  return getThemeMediaQuery()?.matches ? 'night' : 'day';
}

export function resolveInitialTheme(): ThemeMode {
  return getStoredTheme() ?? getSystemTheme();
}

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme === 'night' ? 'dark' : 'light';
}

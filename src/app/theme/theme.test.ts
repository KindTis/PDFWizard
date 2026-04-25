import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyTheme,
  getStoredTheme,
  getSystemTheme,
  resolveInitialTheme,
  THEME_STORAGE_KEY,
} from './theme';

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function mockLocalStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
    removeItem: vi.fn((key: string) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    get length() {
      return store.size;
    },
  };

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  });
}

describe('theme preferences', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it('resolves night from the system dark preference when no stored theme exists', () => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    mockMatchMedia(true);

    expect(getSystemTheme()).toBe('night');
    expect(resolveInitialTheme()).toBe('night');
  });

  it('keeps a stored day preference ahead of the system dark preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'day');
    mockMatchMedia(true);

    expect(getStoredTheme()).toBe('day');
    expect(resolveInitialTheme()).toBe('day');
  });

  it('applies the selected theme to the document root', () => {
    applyTheme('night');

    expect(document.documentElement).toHaveAttribute('data-theme', 'night');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { THEME_STORAGE_KEY } from '../theme/theme';

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

describe('ThemeToggle', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it('shows the system night theme on first render and persists a manual day selection', () => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    mockMatchMedia(true);

    render(<App />);

    expect(document.documentElement).toHaveAttribute('data-theme', 'night');
    expect(screen.getByRole('button', { name: '현재 테마: Night. Day 테마로 전환' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '현재 테마: Night. Day 테마로 전환' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'day');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('day');
    expect(screen.getByRole('button', { name: '현재 테마: Day. Night 테마로 전환' })).toBeInTheDocument();
  });
});

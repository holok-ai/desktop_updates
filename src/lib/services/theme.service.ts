import { APP_THEME_MODE, APP_THEME_MODE_STORAGE_KEY } from '$lib/constants/app.constant';
import type { AppThemeMode } from '$lib/types/app.type';

/**
 * Apply theme by toggling the root .dark class.
 * Handles 'system' preference changes reactively.
 */
export function applyTheme(theme: AppThemeMode): void {
  const html = document.documentElement;
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');

  const setDark = (dark: boolean): void => {
    if (dark) {
      html.classList.add(APP_THEME_MODE.DARK);
    } else {
      html.classList.remove(APP_THEME_MODE.DARK);
    }
  };

  systemPrefersDark.onchange = null as unknown as never;
  setDark(theme === APP_THEME_MODE.DARK);
}

/**
 * Persist theme to localStorage for instant application on next launch.
 */
export function persistTheme(theme: AppThemeMode): void {
  try {
    localStorage.setItem(APP_THEME_MODE_STORAGE_KEY, theme);
  } catch {
    // ignore storage failures
  }
}

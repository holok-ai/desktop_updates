import './app.css';
import 'primeicons/primeicons.css';
import { mount } from 'svelte';
import { applyTheme } from '$lib/services/theme.service';
import { APP_THEME_MODE, APP_THEME_MODE_STORAGE_KEY } from '$lib/constants/app.constant';
import type { AppThemeMode } from '$lib/types/app.type';
import App from './App.svelte';

// Apply persisted theme before mounting to avoid flash
async function bootstrap(): Promise<void> {
  try {
    const ls = localStorage.getItem(APP_THEME_MODE_STORAGE_KEY) as AppThemeMode | null;
    if (ls === APP_THEME_MODE.DARK || ls === APP_THEME_MODE.LIGHT) {
      applyTheme(ls);
    }
  } catch {
    // ignore
  }

  // Authoritative theme from settings (await before mount)
  try {
    const value = (await window.electronAPI.settings.get('theme')) as AppThemeMode | undefined;
    applyTheme((value as AppThemeMode) ?? APP_THEME_MODE.LIGHT);
  } catch {
    applyTheme(APP_THEME_MODE.LIGHT);
  }

  const appElement = document.getElementById('app');
  if (appElement === null) {
    throw new Error('App mount point not found');
  }

  const app = mount(App, {
    target: appElement,
  });
  // expose for HMR or tests if needed
  // @ts-expect-error attach for debugging
  window.__app__ = app;
}

void bootstrap();

export {};

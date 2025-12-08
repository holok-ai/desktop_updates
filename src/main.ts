import './app.css';
import 'primeng/resources/themes/lara-light-blue/theme.css';
import 'primeng/resources/primeng.min.css';
import 'primeicons/primeicons.css';
import { mount } from 'svelte';
import { applyTheme } from '$lib/services/theme.service';
import { APP_THEME_MODE } from '$lib/constants/app.constant';
import type { AppThemeMode } from '$lib/types/app.type';
import { initTitleGenerationListeners } from '$lib/stores/titleGeneration.store';
import { storageService } from '$lib/services/storage.service';
import App from './App.svelte';

// Apply persisted theme before mounting to avoid flash
async function bootstrap(): Promise<void> {
  try {
    const ls = storageService.getThemeMode();
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

  // Initialize title generation event listeners
  initTitleGenerationListeners();

  // Reset comments visibility to hidden on app startup
  // (preference can be stored across threads, but always start hidden)
  try {
    storageService.setShowComments(false);
  } catch {
    // ignore if storage unavailable
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

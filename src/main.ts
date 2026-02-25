import './app.css';
import '$lib/styles/buttons.css';
import '$lib/styles/animations.css';
import 'primeicons/primeicons.css';
import { mount } from 'svelte';
import { applyTheme } from '$lib/services/theme.service';
import { APP_THEME_MODE } from '$lib/constants/app.constant';
import type { AppThemeMode } from '$lib/types/app.type';
import { initTitleGenerationListeners } from '$lib/stores/titleGeneration.store';
import { initThreadObserver } from '$lib/observer/thread-observer';
import App from './App.svelte';

// Apply persisted theme before mounting to avoid flash
async function bootstrap(): Promise<void> {
  // Authoritative theme from settings (await before mount)
  try {
    const value = (await window.electronAPI.settings.get('theme')) as AppThemeMode | undefined;
    applyTheme((value as AppThemeMode) ?? APP_THEME_MODE.LIGHT);
  } catch {
    applyTheme(APP_THEME_MODE.LIGHT);
  }

  // Initialize title generation event listeners
  initTitleGenerationListeners();

  // Initialize thread observer with background tasks
  initThreadObserver();

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

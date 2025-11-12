import type { APP_THEME_MODE } from '../constants/app.constant.js';

export type AppThemeMode = (typeof APP_THEME_MODE)[keyof typeof APP_THEME_MODE];

export interface AppSettings {
  mokuWebUrl: string;
  mokuApiUrl: string;
  theme: AppThemeMode;
  autoUpdate: boolean;

  updateAvailable?: boolean;
  latestVersion?: string;
}

export type GUID = ReturnType<typeof crypto.randomUUID>;

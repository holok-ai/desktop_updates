import { APP_THEME_MODE } from '../constants/app.constant.js';
import { DEFAULT_HOLO_API_URL } from '../../../src-shared/constants/api.constant.js';

export type AppThemeMode = (typeof APP_THEME_MODE)[keyof typeof APP_THEME_MODE];

export interface AppSettings {
  mokuWebUrl: string;
  mokuApiUrl: string;
  holoApiUrl: string;
  theme: AppThemeMode;
  autoUpdate: boolean;

  updateAvailable?: boolean;
  latestVersion?: string;
}

// Runtime helper (used by tests and runtime defaults)
export const defaultAppSettings: AppSettings = {
  mokuWebUrl: '',
  mokuApiUrl: '',
  holoApiUrl: DEFAULT_HOLO_API_URL,
  theme: APP_THEME_MODE.LIGHT as AppThemeMode,
  autoUpdate: false,
};

export type GUID = ReturnType<typeof crypto.randomUUID>;

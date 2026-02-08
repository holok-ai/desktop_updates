import {
  APP_THEME_MODE,
  STARTING_PAGE,
  THREAD_LAYOUT,
  CHAT_LAYOUT,
  CHAT_FONT_SIZE_DEFAULT,
} from '../constants/app.constant.js';
import { DEFAULT_HOLO_API_URL } from '../../../src-shared/constants/api.constant.js';

export type AppThemeMode = (typeof APP_THEME_MODE)[keyof typeof APP_THEME_MODE];
export type StartingPage = (typeof STARTING_PAGE)[keyof typeof STARTING_PAGE];
export type ThreadLayout = (typeof THREAD_LAYOUT)[keyof typeof THREAD_LAYOUT];
export type ChatLayout = (typeof CHAT_LAYOUT)[keyof typeof CHAT_LAYOUT];

/** Tool descriptor provided to the settings tools list */
export interface Tool {
  toolId: string;
  toolTitle: string;
}

export interface AppSettings {
  mokuWebUrl: string;
  mokuApiUrl: string;
  holoApiUrl: string;
  directoryWhitelist: string[];
  theme: AppThemeMode;

  // Appearance
  startingPage: StartingPage;
  showRecentList: boolean;
  showFavoritesList: boolean;
  threadLayout: ThreadLayout;
  chatFontSize: number;
  chatLayout: ChatLayout;

  // Tools
  enabledTools: string[];
  shellCommands: string;
  windowsCommands: string;
  unixCommands: string;

  // Updates
  autoCheckUpdates: boolean;
  autoInstallUpdates: boolean;

  /** @deprecated Use autoCheckUpdates instead */
  autoUpdate: boolean;

  updateAvailable?: boolean;
  latestVersion?: string;
}

// Runtime helper (used by tests and runtime defaults)
export const defaultAppSettings: AppSettings = {
  mokuWebUrl: '',
  mokuApiUrl: '',
  holoApiUrl: DEFAULT_HOLO_API_URL,
  directoryWhitelist: [],
  theme: APP_THEME_MODE.LIGHT as AppThemeMode,
  startingPage: STARTING_PAGE.CREATE_CHAT as StartingPage,
  showRecentList: true,
  showFavoritesList: true,
  threadLayout: THREAD_LAYOUT.SINGLE_COL as ThreadLayout,
  chatFontSize: CHAT_FONT_SIZE_DEFAULT,
  chatLayout: CHAT_LAYOUT.LEFT_RIGHT as ChatLayout,
  enabledTools: [],
  shellCommands: '',
  windowsCommands: '',
  unixCommands: '',
  autoCheckUpdates: true,
  autoInstallUpdates: false,
  autoUpdate: false,
};

export type GUID = ReturnType<typeof crypto.randomUUID>;

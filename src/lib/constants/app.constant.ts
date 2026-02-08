export const APP_THEME_MODE_STORAGE_KEY = 'holokai-app-color-mode';

export const APP_THEME_MODE = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;

export const STARTING_PAGE = {
  CREATE_CHAT: 'create-chat',
  THREADS: 'threads',
  LAST_PAGE: 'last-page',
  DASHBOARD: 'dashboard',
} as const;

export const STARTING_PAGE_LABELS = new Map<string, string>([
  ['create-chat', 'Create a chat'],
  ['threads', 'Threads'],
  ['last-page', 'Last Page'],
  ['dashboard', 'Dashboard'],
]);

export const THREAD_LAYOUT = {
  SINGLE_COL: 'single-col',
  VERTICAL_SPLIT: 'vertical-split',
  COL_LEFT_SPLIT: 'col-left-split',
  COL_RIGHT_SPLIT: 'col-right-split',
  QUAD_SPLIT: 'quad-split',
} as const;

export const THREAD_LAYOUT_OPTIONS = [
  { value: 'single-col', icon: '≡', label: 'Single', description: 'Full-width view' },
  { value: 'vertical-split', icon: '⬌', label: 'Split', description: 'Left-right split' },
  { value: 'col-left-split', icon: '⬅', label: 'Left', description: 'Left tall, right split' },
  { value: 'col-right-split', icon: '➡', label: 'Right', description: 'Left split, right tall' },
  { value: 'quad-split', icon: '▦', label: 'Grid', description: '2×2 grid' },
] as const;

export const CHAT_LAYOUT = {
  LEFT_LEFT: 'left-left',
  LEFT_RIGHT: 'left-right',
  RIGHT_LEFT: 'right-left',
} as const;

export const CHAT_LAYOUT_LABELS = new Map<string, string>([
  ['left-left', 'Left / Left indent'],
  ['left-right', 'Left / Right'],
  ['right-left', 'Right / Left'],
]);

export const CHAT_FONT_SIZE_MIN = 7;
export const CHAT_FONT_SIZE_MAX = 20;
export const CHAT_FONT_SIZE_DEFAULT = 14;

export const LOG_LEVEL = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
} as const;

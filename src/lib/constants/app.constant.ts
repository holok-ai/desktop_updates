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

export const THEME_OPTIONS = [
  { value: 'light', icon: '☀️', label: 'Light' },
  { value: 'dark', icon: '🌙', label: 'Dark' },
] as const;

export const STARTING_PAGE_OPTIONS = [
  { value: 'create-chat', icon: '💬', label: 'New Chat' },
  { value: 'threads', icon: '📋', label: 'Threads' },
  { value: 'last-page', icon: '🕘', label: 'Last Page' },
  { value: 'dashboard', icon: '📊', label: 'Dashboard' },
] as const;

export const CHAT_LAYOUT_OPTIONS = [
  { value: 'left-left', icon: '⫷', label: 'Left / Left' },
  { value: 'left-right', icon: '⬌', label: 'Left / Right' },
  { value: 'right-left', icon: '⫸', label: 'Right / Left' },
] as const;

export const CHAT_FONT_SIZE_MIN = 7;
export const CHAT_FONT_SIZE_MAX = 20;
export const CHAT_FONT_SIZE_DEFAULT = 14;

/* ── Avatar ── */

export const AVATAR_TYPE = {
  LETTERS: 'letters',
  ICON: 'icon',
  IMAGE: 'image',
} as const;

export const AVATAR_COLORS = [
  { value: 'blue', bg: '#7c9cbf', label: 'Blue' },
  { value: 'green', bg: '#7dab8e', label: 'Green' },
  { value: 'red', bg: '#bf7c7c', label: 'Red' },
  { value: 'purple', bg: '#9b8abf', label: 'Purple' },
  { value: 'yellow', bg: '#c4b57a', label: 'Yellow' },
  { value: 'orange', bg: '#c4a07a', label: 'Orange' },
  { value: 'grey', bg: '#9e9e9e', label: 'Grey' },
] as const;

export const AVATAR_ICONS = [
  { value: 'pi-user', label: 'Person' },
  { value: 'pi-briefcase', label: 'Briefcase' },
  { value: 'pi-building', label: 'Building' },
  { value: 'pi-chart-line', label: 'Chart' },
  { value: 'pi-cog', label: 'Gear' },
  { value: 'pi-star', label: 'Star' },
  { value: 'pi-bolt', label: 'Bolt' },
  { value: 'pi-globe', label: 'Globe' },
] as const;

export const LOG_LEVEL = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
} as const;

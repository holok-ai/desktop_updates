/**
 * Project Validation Constants (Renderer)
 * Mirrors validation rules from src-electron/constants/project-validation.ts
 */

/**
 * Moku 12-color palette for project UI (subtle tones)
 */
export const MOKU_COLOR_PALETTE = [
  '#7BA3E0', // Blue (softer)
  '#A78BDB', // Purple (softer)
  '#E893B8', // Pink (softer)
  '#E8B567', // Amber (softer)
  '#6BC9A3', // Emerald (softer)
  '#66C7BC', // Teal (softer)
  '#8B8FDB', // Indigo (softer)
  '#E88484', // Red (softer)
  '#A3D66E', // Lime (softer)
  '#E89B68', // Orange (softer)
  '#61C7DB', // Cyan (softer)
  '#BB82E0', // Violet (softer)
] as const;

/**
 * Valid Lucide icon IDs for projects
 */
export const VALID_PROJECT_ICONS = [
  'folder',
  'folder-open',
  'briefcase',
  'rocket',
  'star',
  'heart',
  'zap',
  'target',
  'flag',
  'bookmark',
  'box',
  'package',
  'layers',
  'grid',
  'archive',
  'file-box',
  'inbox',
  'clipboard',
] as const;

/**
 * Project title validation
 */
export const PROJECT_TITLE_MIN_LENGTH = 1;
export const PROJECT_TITLE_MAX_LENGTH = 100;
export const PROJECT_TITLE_REGEX = /^[a-zA-Z0-9\s\\-]+$/;

/**
 * Project description validation
 */
export const PROJECT_DESCRIPTION_MAX_LENGTH = 500;

export type MokuColor = (typeof MOKU_COLOR_PALETTE)[number];
export type ProjectIcon = (typeof VALID_PROJECT_ICONS)[number];

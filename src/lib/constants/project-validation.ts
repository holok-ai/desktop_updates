/**
 * Project Validation Constants (Renderer)
 * Mirrors validation rules from src-electron/constants/project-validation.ts
 */

/**
 * Moku 12-color palette for project UI
 */
export const MOKU_COLOR_PALETTE = [
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#EF4444', // Red
  '#84CC16', // Lime
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#A855F7', // Violet
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

/**
 * Project Validation Constants
 * Color palette, icon IDs, and validation rules
 */

import { ProjectPermission, type ProjectRole } from '../types/project.types.js';

/**
 * Moku 12-color palette for project UI
 * TODO: Confirm these are the official Moku colors
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
 * TODO: Get full list from design team or Lucide docs
 * For now, using common project-related icons
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
 * Project name validation
 */
export const PROJECT_NAME_MIN_LENGTH = 1;
export const PROJECT_NAME_MAX_LENGTH = 100;

/**
 * Project description validation
 */
export const PROJECT_DESCRIPTION_MAX_LENGTH = 500;

/**
 * Role-Permission Matrix
 * Defines which permissions each role has
 */
export const ROLE_PERMISSION_MATRIX: Record<ProjectRole, Set<ProjectPermission>> = {
  owner: new Set([
    // All view permissions
    ProjectPermission.VIEW_PROJECT,
    ProjectPermission.VIEW_THREADS,
    ProjectPermission.VIEW_FILES,
    ProjectPermission.VIEW_MEMBERS,
    // All thread permissions
    ProjectPermission.CREATE_THREADS,
    ProjectPermission.EDIT_THREADS,
    ProjectPermission.DELETE_THREADS,
    // All file permissions
    ProjectPermission.UPLOAD_FILES,
    ProjectPermission.DELETE_FILES,
    // All member permissions
    ProjectPermission.INVITE_MEMBERS,
    ProjectPermission.REMOVE_MEMBERS,
    ProjectPermission.CHANGE_MEMBER_ROLES,
    // All project permissions
    ProjectPermission.UPDATE_PROJECT,
    ProjectPermission.DELETE_PROJECT,
  ]),
  editor: new Set([
    // View permissions
    ProjectPermission.VIEW_PROJECT,
    ProjectPermission.VIEW_THREADS,
    ProjectPermission.VIEW_FILES,
    ProjectPermission.VIEW_MEMBERS,
    // Thread permissions
    ProjectPermission.CREATE_THREADS,
    ProjectPermission.EDIT_THREADS,
    ProjectPermission.DELETE_THREADS,
    // File permissions
    ProjectPermission.UPLOAD_FILES,
    ProjectPermission.DELETE_FILES,
    // NO member management
    // NO project management
  ]),
  viewer: new Set([
    // Only view permissions
    ProjectPermission.VIEW_PROJECT,
    ProjectPermission.VIEW_THREADS,
    ProjectPermission.VIEW_FILES,
    ProjectPermission.VIEW_MEMBERS,
    // NO write permissions
  ]),
};

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: ProjectRole, permission: ProjectPermission): boolean {
  // eslint-disable-next-line security/detect-object-injection
  return ROLE_PERMISSION_MATRIX[role].has(permission);
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: ProjectRole): ProjectPermission[] {
  // eslint-disable-next-line security/detect-object-injection
  return Array.from(ROLE_PERMISSION_MATRIX[role]);
}

/**
 * Check if a color is in the Moku palette
 */
export function isValidMokuColor(color: string): boolean {
  return MOKU_COLOR_PALETTE.includes(color as (typeof MOKU_COLOR_PALETTE)[number]);
}

/**
 * Check if an icon ID is valid
 */
export function isValidProjectIcon(icon: string): boolean {
  return VALID_PROJECT_ICONS.includes(icon as (typeof VALID_PROJECT_ICONS)[number]);
}

/**
 * Validate project name
 */
export function validateProjectName(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return 'Project name is required';
  }

  if (name.length < PROJECT_NAME_MIN_LENGTH) {
    return `Project name must be at least ${PROJECT_NAME_MIN_LENGTH} character`;
  }

  if (name.length > PROJECT_NAME_MAX_LENGTH) {
    return `Project name must be at most ${PROJECT_NAME_MAX_LENGTH} characters`;
  }

  return null; // Valid
}

/**
 * Validate project description
 */
export function validateProjectDescription(description: string | null | undefined): string | null {
  if (!description) {
    return null; // Optional field
  }

  if (description.length > PROJECT_DESCRIPTION_MAX_LENGTH) {
    return `Project description must be at most ${PROJECT_DESCRIPTION_MAX_LENGTH} characters`;
  }

  return null; // Valid
}

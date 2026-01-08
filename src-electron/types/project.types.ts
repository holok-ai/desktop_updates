/**
 * Project Domain Types
 * Desktop-side models for project collaboration features
 * These types use 'name' to match API conventions
 */

/**
 * Project role in RBAC system
 */
export type ProjectRole = 'owner' | 'editor' | 'viewer';

/**
 * Project type
 */
export type ProjectType = 'personal' | 'shared';

/**
 * Project status
 */
export type ProjectStatus = 'active' | 'archived' | 'deleted';

/**
 * Project permissions for RBAC
 */
export enum ProjectPermission {
  // Read permissions
  VIEW_PROJECT = 'view_project',
  VIEW_THREADS = 'view_threads',
  VIEW_FILES = 'view_files',
  VIEW_MEMBERS = 'view_members',

  // Write permissions (threads)
  CREATE_THREADS = 'create_threads',
  EDIT_THREADS = 'edit_threads',
  DELETE_THREADS = 'delete_threads',

  // Write permissions (files)
  UPLOAD_FILES = 'upload_files',
  DELETE_FILES = 'delete_files',

  // Admin permissions (members)
  INVITE_MEMBERS = 'invite_members',
  REMOVE_MEMBERS = 'remove_members',
  CHANGE_MEMBER_ROLES = 'change_member_roles',

  // Admin permissions (project)
  UPDATE_PROJECT = 'update_project',
  DELETE_PROJECT = 'delete_project',
}

/**
 * Project entity (desktop model)
 * Uses 'name' as canonical display name (matching API)
 */
export interface Project {
  id: string;
  name: string; // Canonical display name
  description: string | null;
  type: ProjectType;
  createdBy: string;
  organizationId: string;
  active: boolean;
  metadata: ProjectMetadata | null;
  memberCount: number;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
  userRole: ProjectRole; // Current user's role
}

/**
 * Project metadata
 * Color and icon for UI display
 */
export interface ProjectMetadata {
  /** Hex color from Moku 12-color palette (e.g., '#3B82F6') */
  color?: string;
  /** Lucide icon ID (e.g., 'folder', 'briefcase') */
  icon?: string;
  /** Thread count (updated by API) */
  threadCount?: number;
  /** Any other metadata */
  [key: string]: unknown;
}

/**
 * Project member
 */
export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  email: string;
  displayName: string | null;
  role: ProjectRole;
  joinedAt: string; // ISO-8601
}

/**
 * Input for creating a new project
 */
export interface CreateProjectInput {
  name: string; // 1-100 characters
  description?: string | null;
  type?: ProjectType;
  metadata?: ProjectMetadata;
}

/**
 * Input for updating a project
 */
export interface UpdateProjectInput {
  name?: string; // 1-100 characters
  description?: string | null;
  metadata?: ProjectMetadata;
}

/**
 * Input for adding a member to a project
 */
export interface AddMemberInput {
  email: string;
  role: ProjectRole; // 'editor' or 'viewer' (owner set automatically on create)
}

/**
 * Input for updating a member's role
 */
export interface UpdateMemberRoleInput {
  role: ProjectRole;
}

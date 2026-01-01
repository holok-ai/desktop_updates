/**
 * Project Service
 * High-level service for project collaboration features
 * Wraps ProjectApiService with caching, retry logic, and permission checks
 */

import log from 'electron-log';
import { projectApiService } from './mokuapi/project-api.service.js';
import { projectCache } from '../cache/ProjectCache.js';
import type { ProjectDetailDTO } from './mokuapi/project.types.js';
import type {
  Project,
  ProjectRole,
  ProjectPermission,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectMember,
  AddMemberInput,
  UpdateMemberRoleInput,
} from '../types/project.types.js';
import { ValidationError, ForbiddenError, NotFoundError } from '../types/errors.js';
import {
  validateProjectTitle,
  validateProjectDescription,
  isValidMokuColor,
  isValidProjectIcon,
  roleHasPermission,
} from '../constants/project-validation.js';
import { ApiRetry, DEFAULT_RETRY_CONFIG } from '../utils/apiretry.js';

/**
 * DTO Mapping Functions
 */

/**
 * Map API DTO to desktop Project model
 * Converts 'name' → 'title' as per project conventions
 */
function mapDTOToProject(dto: ProjectDetailDTO): Project {
  return {
    id: dto.id,
    title: dto.name, // API uses 'name', we use 'title'
    description: dto.description,
    type: dto.type as 'personal' | 'shared',
    createdBy: dto.createdBy,
    organizationId: dto.organizationId,
    status: dto.status as 'active' | 'archived' | 'deleted',
    metadata: dto.metadata as Project['metadata'],
    memberCount: dto.memberCount,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    userRole: dto.userRole as ProjectRole,
  };
}

/**
 * Map CreateProjectInput to API request
 * Converts 'title' → 'name' for API
 */
function mapCreateInputToDTO(input: CreateProjectInput): {
  name: string;
  description?: string | null;
  type?: string | null;
  metadata?: Record<string, unknown> | null;
} {
  return {
    name: input.title, // We use 'title', API expects 'name'
    description: input.description,
    type: input.type,
    metadata: input.metadata,
  };
}

/**
 * Map UpdateProjectInput to API request
 * Converts 'title' → 'name' for API
 */
function mapUpdateInputToDTO(input: UpdateProjectInput): {
  name?: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
} {
  return {
    name: input.title, // We use 'title', API expects 'name'
    description: input.description,
    metadata: input.metadata,
  };
}

/**
 * Project Service
 * Coordinates project operations with caching, retry, and permissions
 */
export class ProjectService {
  /**
   * Create a new project
   * AC-1: Validates title, color (Moku palette), and icon (Lucide ID)
   */
  async create(input: CreateProjectInput): Promise<Project> {
    const startTime = Date.now();
    log.info('[ProjectService] Creating project:', input.title);

    // Validate title
    const titleError = validateProjectTitle(input.title);
    if (titleError) {
      throw new ValidationError(titleError, 'title');
    }

    // Validate description
    const descError = validateProjectDescription(input.description);
    if (descError) {
      throw new ValidationError(descError, 'description');
    }

    // Validate metadata if provided
    if (input.metadata) {
      if (input.metadata.color && !isValidMokuColor(input.metadata.color)) {
        throw new ValidationError(`Invalid color. Must be from Moku palette`, 'metadata.color');
      }

      if (input.metadata.icon && !isValidProjectIcon(input.metadata.icon)) {
        throw new ValidationError(`Invalid icon. Must be a valid Lucide icon ID`, 'metadata.icon');
      }
    }

    // Create via API with retry
    const dto = await ApiRetry.execute(
      () => projectApiService.createProject(mapCreateInputToDTO(input)),
      DEFAULT_RETRY_CONFIG,
      'ProjectService.create',
    );

    // Cache the created project
    await projectCache.set(dto.id, dto);

    const duration = Date.now() - startTime;
    log.info(`[ProjectService] Created project ${dto.id} in ${duration}ms`);

    return mapDTOToProject(dto);
  }

  /**
   * List all projects for current user
   * AC-2: Returns owned and shared projects
   */
  async list(): Promise<Project[]> {
    const startTime = Date.now();
    log.info('[ProjectService] Listing projects');

    // Fetch from API with retry
    const response = await ApiRetry.execute(
      () => projectApiService.getProjects({ size: 1000 }), // TODO: Handle pagination
      DEFAULT_RETRY_CONFIG,
      'ProjectService.list',
    );

    // Cache all projects
    const projects: Project[] = [];
    for (const dto of response.content) {
      // Map to full ProjectDetailDTO for caching
      const detailDTO: ProjectDetailDTO = {
        ...dto,
        createdBy: '', // Not in list view
        organizationId: '', // Not in list view
        metadata: null, // Not in list view
        userRole: 'viewer', // Default, will be overwritten on detail fetch
      };

      await projectCache.set(dto.id, detailDTO);
      projects.push(mapDTOToProject(detailDTO));
    }

    const duration = Date.now() - startTime;
    log.info(`[ProjectService] Listed ${projects.length} projects in ${duration}ms`);

    return projects;
  }

  /**
   * Get a single project by ID
   * AC-3: Cache read-through (invalidation-based, no TTL)
   */
  async get(id: string): Promise<Project> {
    const startTime = Date.now();
    log.debug('[ProjectService] Getting project:', id);

    // Try cache first
    let project: Project | null = await projectCache.get(id);
    let cacheHit = false;

    if (project) {
      cacheHit = true;
      log.debug(`[ProjectService] Cache hit for project: ${id}`);
    } else {
      // Cache miss - fetch from API
      log.debug(`[ProjectService] Cache miss for project: ${id}, fetching from API`);

      const dto = await ApiRetry.execute(
        () => projectApiService.getProject(id),
        DEFAULT_RETRY_CONFIG,
        'ProjectService.get',
      );

      // Map and cache
      project = mapDTOToProject(dto);
      await projectCache.set(id, dto);
    }

    const duration = Date.now() - startTime;
    log.info(
      `[ProjectService] Got project ${id} in ${duration}ms (cache: ${cacheHit ? 'hit' : 'miss'})`,
    );

    return project;
  }

  /**
   * Update a project
   * AC-4: Invalidates cache immediately after update
   */
  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const startTime = Date.now();
    log.info('[ProjectService] Updating project:', id);

    // Validate title if provided
    if (input.title) {
      const titleError = validateProjectTitle(input.title);
      if (titleError) {
        throw new ValidationError(titleError, 'title');
      }
    }

    // Validate description if provided
    if (input.description !== undefined) {
      const descError = validateProjectDescription(input.description);
      if (descError) {
        throw new ValidationError(descError, 'description');
      }
    }

    // Validate metadata if provided
    if (input.metadata) {
      if (input.metadata.color && !isValidMokuColor(input.metadata.color)) {
        throw new ValidationError(`Invalid color. Must be from Moku palette`, 'metadata.color');
      }

      if (input.metadata.icon && !isValidProjectIcon(input.metadata.icon)) {
        throw new ValidationError(`Invalid icon. Must be a valid Lucide icon ID`, 'metadata.icon');
      }
    }

    // Update via API with retry
    const dto = await ApiRetry.execute(
      () => projectApiService.updateProject(id, mapUpdateInputToDTO(input)),
      DEFAULT_RETRY_CONFIG,
      'ProjectService.update',
    );

    // Invalidate and refresh cache
    await projectCache.invalidateProject(id);
    await projectCache.set(id, dto);

    const duration = Date.now() - startTime;
    log.info(`[ProjectService] Updated project ${id} in ${duration}ms`);

    return mapDTOToProject(dto);
  }

  /**
   * Delete a project
   * AC-5: Cascade cache purge
   */
  async delete(id: string): Promise<void> {
    const startTime = Date.now();
    log.info('[ProjectService] Deleting project:', id);

    // Delete via API with retry
    await ApiRetry.execute(
      () => projectApiService.deleteProject(id),
      DEFAULT_RETRY_CONFIG,
      'ProjectService.delete',
    );

    // Purge from cache
    await projectCache.invalidateProject(id);

    const duration = Date.now() - startTime;
    log.info(`[ProjectService] Deleted project ${id} in ${duration}ms`);
  }

  /**
   * Check if current user has permission for a project action
   * AC-9: Provides role-based permission checking
   *
   * @throws ForbiddenError if user lacks permission
   */
  async hasPermission(projectId: string, permission: ProjectPermission): Promise<void> {
    const project = await this.get(projectId);

    if (!roleHasPermission(project.userRole, permission)) {
      throw new ForbiddenError(
        `Access denied. ${project.userRole} role does not have '${permission}' permission`,
      );
    }
  }

  /**
   * Check permission without throwing
   * Returns true if user has permission
   */
  async checkPermission(projectId: string, permission: ProjectPermission): Promise<boolean> {
    try {
      await this.hasPermission(projectId, permission);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return false;
      }
      throw error; // Re-throw other errors
    }
  }

  /**
   * Get current user's role in a project
   * AC-9: For UI to check roles explicitly
   */
  async getUserRole(projectId: string): Promise<ProjectRole> {
    const project = await this.get(projectId);
    return project.userRole;
  }

  /**
   * Get project members
   * AC-6: No caching in E3-S1 (always fetch from API)
   * TODO: Member API endpoints not yet implemented
   */
  async getMembers(projectId: string): Promise<ProjectMember[]> {
    log.info('[ProjectService] Getting members for project:', projectId);

    // Check permission
    await this.hasPermission(projectId, 'view_members' as ProjectPermission);

    // TODO: Implement when member API endpoints are available
    // const members = await withRetry(
    //   () => projectApiService.getMembers(projectId),
    //   DEFAULT_RETRY_CONFIG,
    //   'ProjectService.getMembers',
    // );

    log.warn('[ProjectService] Member API not yet implemented');
    return [];
  }

  /**
   * Add a member to a project
   * AC-7: Requires invite_members permission (owner only)
   */
  async addMember(projectId: string, input: AddMemberInput): Promise<ProjectMember> {
    log.info('[ProjectService] Adding member to project:', projectId, input.email);

    // Check permission
    await this.hasPermission(projectId, 'invite_members' as ProjectPermission);

    // Validate email
    if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      throw new ValidationError('Invalid email address', 'email');
    }

    // TODO: Implement when member API endpoints are available
    // const member = await withRetry(
    //   () => projectApiService.addMember(projectId, input),
    //   DEFAULT_RETRY_CONFIG,
    //   'ProjectService.addMember',
    // );

    log.warn('[ProjectService] Member API not yet implemented');
    throw new NotFoundError('API endpoint', '/projects/{id}/members');
  }

  /**
   * Remove a member from a project
   * AC-8: Requires owner role
   */
  async removeMember(projectId: string, memberId: string): Promise<void> {
    log.info('[ProjectService] Removing member from project:', projectId, memberId);

    // Check permission (only owner can remove members)
    await this.hasPermission(projectId, 'remove_members' as ProjectPermission);

    // TODO: Implement when member API endpoints are available
    // await withRetry(
    //   () => projectApiService.removeMember(projectId, memberId),
    //   DEFAULT_RETRY_CONFIG,
    //   'ProjectService.removeMember',
    // );

    log.warn('[ProjectService] Member API not yet implemented');
    throw new NotFoundError('API endpoint', `/projects/{id}/members/{memberId}`);
  }

  /**
   * Update a member's role
   * Requires change_member_roles permission (owner only)
   */
  async updateMemberRole(
    projectId: string,
    memberId: string,
    input: UpdateMemberRoleInput,
  ): Promise<ProjectMember> {
    log.info('[ProjectService] Updating member role:', projectId, memberId, input.role);

    // Check permission
    await this.hasPermission(projectId, 'change_member_roles' as ProjectPermission);

    // TODO: Implement when member API endpoints are available
    // const member = await withRetry(
    //   () => projectApiService.updateMemberRole(projectId, memberId, input),
    //   DEFAULT_RETRY_CONFIG,
    //   'ProjectService.updateMemberRole',
    // );

    log.warn('[ProjectService] Member API not yet implemented');
    throw new NotFoundError('API endpoint', `/projects/{id}/members/{memberId}`);
  }
}

/**
 * Singleton instance
 */
export const projectService = new ProjectService();

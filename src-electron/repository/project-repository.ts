/**
 * Project Repository
 * Single source of truth for all project operations
 * Handles API access, caching, validation, permissions, and retry logic
 */

import log from 'electron-log';
import type {
  ProjectDTO,
  ProjectDetailDTO,
  ProjectCreateRequest,
} from '../services/mokuapi/project.types.js';
import { projectApiService } from '../services/mokuapi/project-api.service.js';
import { userApiService } from '../services/mokuapi/user-api.service.js';
import type { UserSummaryDTO } from '../services/mokuapi/user.types.js';
import { projectMemberApiService } from '../services/mokuapi/project-member-api.service.js';
import type { MemberDTO } from '../services/mokuapi/project-member-api.service.js';
import type { GUID } from '../../src/lib/types/app.type.js';
import { ApiRetry, DEFAULT_RETRY_CONFIG } from '../utils/apiretry.js';
import {
  validateProjectName,
  validateProjectDescription,
  isValidMokuColor,
  isValidProjectIcon,
  roleHasPermission,
} from '../constants/project-validation.js';
import type {
  Project,
  ProjectRole,
  ProjectPermission,
  ProjectMember,
  AddMemberInput,
  UpdateMemberRoleInput,
} from '../types/project.types.js';
import { ValidationError, ForbiddenError, NotFoundError } from '../types/errors.js';

export class ProjectRepository {
  private readonly projectsById: Map<GUID, Project> = new Map();
  private lastLoadTime: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache TTL

  /**
   * Load all projects from API
   * Returns cached results if they are fresh enough
   */
  public async loadProjects(forceRefresh: boolean = false): Promise<Project[]> {
    const now = Date.now();

    // Return cached if not forcing refresh and cache is fresh
    if (!forceRefresh && now - this.lastLoadTime < this.CACHE_TTL && this.projectsById.size > 0) {
      log.debug('[ProjectRepository] Returning cached projects');
      return this.listProjects();
    }

    try {
      log.info('[ProjectRepository] Loading projects from API');
      const response = await ApiRetry.execute(
        () => projectApiService.getProjects({ size: 1000 }),
        DEFAULT_RETRY_CONFIG,
        'ProjectRepository.loadProjects',
      );

      // Clear cache and rebuild
      this.projectsById.clear();

      for (const dto of response.content) {
        const project = this.mapDTOToProject(dto);
        this.projectsById.set(project.id as GUID, project);
      }

      this.lastLoadTime = now;
      log.info('[ProjectRepository] Loaded', this.projectsById.size, 'projects');

      return this.listProjects();
    } catch (error) {
      log.error('[ProjectRepository] Failed to load projects:', error);
      // Return cached projects if available, otherwise empty array
      return this.listProjects();
    }
  }

  /**
   * Get a single project by ID
   * Always fetches fresh from API with members
   */
  public async getProject(projectId: GUID): Promise<Project | null> {
    try {
      log.info('[ProjectRepository] Fetching project from API:', projectId);
      const dto = await ApiRetry.execute(
        () => projectApiService.getProject(projectId),
        DEFAULT_RETRY_CONFIG,
        'ProjectRepository.getProject',
      );

      // Fetch members for the project
      let members: MemberDTO[] = [];
      try {
        members = await ApiRetry.execute(
          () => projectMemberApiService.getProjectMembers(projectId),
          DEFAULT_RETRY_CONFIG,
          'ProjectRepository.getProject.members',
        );
        log.info('[ProjectRepository] Loaded', members.length, 'members for project:', projectId);
      } catch (error) {
        log.warn('[ProjectRepository] Failed to load members for project:', projectId, error);
        // Continue with empty members array
      }

      const project = this.mapDetailDTOToProject(dto, members);

      // Update cache with fresh data
      this.projectsById.set(project.id as GUID, project);

      return this.cloneProject(project);
    } catch (error) {
      log.error('[ProjectRepository] Failed to load project:', projectId, error);
      return null;
    }
  }

  /**
   * List all cached projects sorted by name
   */
  public listProjects(): Project[] {
    return Array.from(this.projectsById.values()).map((p) => this.cloneProject(p));
  }

  /**
   * List personal projects (type="personal")
   * Note: API already filters to only return personal projects created by user
   */
  public listPersonalProjects(): Project[] {
    return Array.from(this.projectsById.values())
      .filter((p) => p.type === 'personal')
      .map((p) => this.cloneProject(p));
  }

  /**
   * List shared projects (type="shared")
   * Note: API already filters to only return shared projects where user is a member
   */
  public listSharedProjects(): Project[] {
    return Array.from(this.projectsById.values())
      .filter((p) => p.type === 'shared')
      .map((p) => this.cloneProject(p));
  }

  /**
   * Create a new project via API
   * Validates input before creating
   */
  public async createProject(
    title: string,
    description?: string | null,
    type?: 'personal' | 'shared',
    metadata?: Record<string, unknown> | null,
  ): Promise<Project> {
    const startTime = Date.now();
    log.info('[ProjectRepository] Creating project:', title);

    // Validate title
    const titleError = validateProjectName(title);
    if (titleError) {
      throw new ValidationError(titleError, 'title');
    }

    // Validate description
    const descError = validateProjectDescription(description);
    if (descError) {
      throw new ValidationError(descError, 'description');
    }

    // Validate metadata if provided
    if (metadata) {
      if (metadata.color && !isValidMokuColor(metadata.color as string)) {
        throw new ValidationError('Invalid color. Must be from Moku palette', 'metadata.color');
      }

      if (metadata.icon && !isValidProjectIcon(metadata.icon as string)) {
        throw new ValidationError('Invalid icon. Must be a valid Lucide icon ID', 'metadata.icon');
      }
    }

    try {
      const createRequest: ProjectCreateRequest = {
        name: title, // API expects 'name'
        description: description ?? null,
        type: type ?? 'personal',
        metadata: metadata ?? null,
        userRole: 'owner', // Creator is always owner
        active: true,
        status: 'active',
      };

      const dto = await ApiRetry.execute(
        () => projectApiService.createProject(createRequest),
        DEFAULT_RETRY_CONFIG,
        'ProjectRepository.createProject',
      );

      // Fetch members for the newly created project
      let members: MemberDTO[] = [];
      try {
        members = await ApiRetry.execute(
          () => projectMemberApiService.getProjectMembers(dto.id),
          DEFAULT_RETRY_CONFIG,
          'ProjectRepository.createProject.members',
        );
      } catch (error) {
        log.warn('[ProjectRepository] Failed to load members for new project:', dto.id, error);
      }

      const project = this.mapDetailDTOToProject(dto, members);

      // Add to cache
      this.projectsById.set(project.id as GUID, project);

      const duration = Date.now() - startTime;
      log.info(`[ProjectRepository] Created project ${dto.id} in ${duration}ms`);

      return this.cloneProject(project);
    } catch (error) {
      log.error('[ProjectRepository] Failed to create project:', error);
      throw error;
    }
  }

  /**
   * Update an existing project via API
   * Validates input before updating
   */
  public async updateProject(
    projectId: GUID,
    updates: {
      title?: string;
      description?: string | null;
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<Project> {
    const startTime = Date.now();
    log.info('[ProjectRepository] Updating project:', projectId);

    // Validate title if provided
    if (updates.title) {
      const titleError = validateProjectName(updates.title);
      if (titleError) {
        throw new ValidationError(titleError, 'title');
      }
    }

    // Validate description if provided
    if (updates.description !== undefined) {
      const descError = validateProjectDescription(updates.description);
      if (descError) {
        throw new ValidationError(descError, 'description');
      }
    }

    // Validate metadata if provided
    if (updates.metadata) {
      if (updates.metadata.color && !isValidMokuColor(updates.metadata.color as string)) {
        throw new ValidationError('Invalid color. Must be from Moku palette', 'metadata.color');
      }

      if (updates.metadata.icon && !isValidProjectIcon(updates.metadata.icon as string)) {
        throw new ValidationError('Invalid icon. Must be a valid Lucide icon ID', 'metadata.icon');
      }
    }

    try {
      const dto = await ApiRetry.execute(
        () =>
          projectApiService.updateProject(projectId, {
            name: updates.title,
            description: updates.description,
            metadata: updates.metadata,
          }),
        DEFAULT_RETRY_CONFIG,
        'ProjectRepository.updateProject',
      );

      // Always fetch fresh members
      let members: MemberDTO[] = [];
      try {
        members = await ApiRetry.execute(
          () => projectMemberApiService.getProjectMembers(projectId),
          DEFAULT_RETRY_CONFIG,
          'ProjectRepository.updateProject.members',
        );
        log.info(
          '[ProjectRepository] Loaded',
          members.length,
          'members for updated project:',
          projectId,
        );
      } catch (error) {
        log.warn(
          '[ProjectRepository] Failed to load members for updated project:',
          projectId,
          error,
        );
      }

      const project = this.mapDetailDTOToProject(dto, members);

      // Update cache
      this.projectsById.set(project.id as GUID, project);

      const duration = Date.now() - startTime;
      log.info(`[ProjectRepository] Updated project ${projectId} in ${duration}ms`);

      return this.cloneProject(project);
    } catch (error) {
      log.error('[ProjectRepository] Failed to update project:', error);
      throw error;
    }
  }

  /**
   * Delete a project via API (soft delete)
   */
  public async deleteProject(projectId: GUID): Promise<boolean> {
    const startTime = Date.now();
    log.info('[ProjectRepository] Deleting project:', projectId);

    try {
      await ApiRetry.execute(
        () => projectApiService.deleteProject(projectId),
        DEFAULT_RETRY_CONFIG,
        'ProjectRepository.deleteProject',
      );

      // Remove from cache
      this.projectsById.delete(projectId);

      const duration = Date.now() - startTime;
      log.info(`[ProjectRepository] Deleted project ${projectId} in ${duration}ms`);
      return true;
    } catch (error) {
      log.error('[ProjectRepository] Failed to delete project:', error);
      return false;
    }
  }

  /**
   * Clear all cached projects
   */
  public clearCache(): void {
    this.projectsById.clear();
    this.lastLoadTime = 0;
    log.info('[ProjectRepository] Cache cleared');
  }

  /**
   * Map ProjectDTO (list view) to Project domain model
   * Maps API 'name' to desktop 'title' and derives 'status' from 'active'
   */
  private mapDTOToProject(dto: ProjectDTO): Project {
    return {
      id: dto.id,
      title: dto.name, // API uses 'name', desktop uses 'title'
      description: dto.description ?? null,
      type: dto.type,
      createdBy: '', // Not available in list DTO
      organizationId: '', // Not available in list DTO
      active: dto.active,
      status: dto.active ? 'active' : 'archived', // Derive status from active boolean
      metadata: null, // Not available in list DTO
      memberCount: dto.memberCount,
      createdAt: dto.createdAt, // Already ISO-8601 string
      updatedAt: dto.updatedAt,
      userRole: dto.type === 'personal' ? 'owner' : 'viewer', // Best-effort for list view
    };
  }

  /**
   * Map ProjectDetailDTO (detail view) to Project domain model
   * Maps API 'name' to desktop 'title'
   */
  private mapDetailDTOToProject(dto: ProjectDetailDTO, members: MemberDTO[] = []): Project {
    const memberCount = members.length;
    // Map API members to frontend format (userName, email, memberRole)
    const mappedMembers = members.map(m => ({
      id: m.id,
      userId: m.userId,
      userName: m.userName,
      email: m.userEmail, // API uses userEmail, frontend uses email
      memberRole: m.role, // API uses role, frontend uses memberRole
    }));

    return {
      id: dto.id,
      title: dto.name, // API uses 'name', desktop uses 'title'
      description: dto.description,
      type: dto.type,
      createdBy: dto.createdBy,
      organizationId: dto.organizationId,
      active: dto.active,
      status: dto.status, // Detail DTO has status directly
      metadata: dto.metadata,
      memberCount: dto.memberCount ?? memberCount,
      createdAt: dto.createdAt, // Already ISO-8601 string
      updatedAt: dto.updatedAt,
      userRole: dto.userRole as ProjectRole, // API is string; cast to domain union
      members: mappedMembers,
    };
  }

  /**
   * Clone a project object for immutability
   */
  private cloneProject(project: Project): Project {
    return {
      id: project.id,
      title: project.title,
      description: project.description,
      type: project.type,
      createdBy: project.createdBy,
      organizationId: project.organizationId,
      active: project.active,
      status: project.status,
      metadata: project.metadata ? { ...project.metadata } : null,
      memberCount: project.memberCount,
      createdAt: project.createdAt, // Already ISO-8601 string
      updatedAt: project.updatedAt,
      userRole: project.userRole,
      members: project.members ? [...project.members] : undefined,
    };
  }

  /**
   * Search users in the organization
   * @param searchTerm Optional search term for name/email (null/undefined returns all active users)
   * @returns Array of user summaries
   */
  public async searchUsers(searchTerm?: string | null): Promise<UserSummaryDTO[]> {
    try {
      log.info('[ProjectRepository] Searching users', { searchTerm });
      const response = await ApiRetry.execute(
        () => userApiService.searchUsers(searchTerm),
        DEFAULT_RETRY_CONFIG,
        'ProjectRepository.searchUsers',
      );
      log.info('[ProjectRepository] Found', response.content.length, 'users');
      return response.content;
    } catch (error) {
      log.error('[ProjectRepository] Failed to search users:', error);
      throw error;
    }
  }

  /**
   * Get project members
   * @param projectId The project ID
   * @returns Array of member DTOs with user information
   */
  public async getProjectMembers(projectId: GUID): Promise<MemberDTO[]> {
    try {
      log.info('[ProjectRepository] Getting members for project', { projectId });
      const members = await ApiRetry.execute(
        () => projectMemberApiService.getProjectMembers(projectId),
        DEFAULT_RETRY_CONFIG,
        'ProjectRepository.getProjectMembers',
      );
      log.info('[ProjectRepository] Retrieved', members.length, 'members');
      return members;
    } catch (error) {
      log.error('[ProjectRepository] Failed to get project members:', error);
      throw error;
    }
  }

  // ==================== Permission Methods ====================

  /**
   * Check if current user has permission for a project action
   * @throws ForbiddenError if user lacks permission
   */
  public async hasPermission(projectId: string, permission: ProjectPermission): Promise<void> {
    const project = await this.getProject(projectId as GUID);
    if (!project) {
      throw new NotFoundError('Project', projectId);
    }

    if (!roleHasPermission(project.userRole, permission)) {
      throw new ForbiddenError(
        `Access denied. ${project.userRole} role does not have '${permission}' permission`,
      );
    }
  }

  /**
   * Check permission without throwing
   * Returns true if user has permission, false otherwise
   */
  public async checkPermission(projectId: string, permission: ProjectPermission): Promise<boolean> {
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
   */
  public async getUserRole(projectId: string): Promise<ProjectRole> {
    const project = await this.getProject(projectId as GUID);
    if (!project) {
      throw new NotFoundError('Project', projectId);
    }
    return project.userRole;
  }

  // ==================== Member Management ====================

  /**
   * Get members for a project
   * Requires view_members permission
   */
  public async getMembers(projectId: string): Promise<ProjectMember[]> {
    log.info('[ProjectRepository] Getting members for project:', projectId);

    // Check permission
    await this.hasPermission(projectId, 'view_members' as ProjectPermission);

    // TODO: Implement when member API endpoints are available
    log.warn('[ProjectRepository] Member API not yet implemented');
    return [];
  }

  /**
   * Add a member to a project
   * Requires invite_members permission (owner only)
   */
  public async addMember(projectId: string, input: AddMemberInput): Promise<ProjectMember> {
    log.info('[ProjectRepository] Adding member to project:', projectId, input.userId);

    // Check permission
    await this.hasPermission(projectId, 'invite_members' as ProjectPermission);

    // Validate userId
    if (!input.userId) {
      throw new ValidationError('User ID is required', 'userId');
    }

    try {
      const memberDTO = await ApiRetry.execute(
        () => projectMemberApiService.addProjectMember(projectId, input.userId, input.role),
        DEFAULT_RETRY_CONFIG,
        'ProjectRepository.addMember',
      );

      // Map DTO to ProjectMember
      const member: ProjectMember = {
        id: memberDTO.id,
        projectId: projectId,
        userId: memberDTO.userId,
        email: memberDTO.userEmail,
        displayName: memberDTO.userName,
        role: memberDTO.role as ProjectRole,
        joinedAt: memberDTO.createdAt,
      };

      log.info('[ProjectRepository] Successfully added member:', member.email);
      return member;
    } catch (error) {
      log.error('[ProjectRepository] Failed to add member:', error);
      throw error;
    }
  }

  /**
   * Remove a member from a project
   * Requires remove_members permission (owner only)
   */
  public async removeMember(projectId: string, memberId: string): Promise<void> {
    log.info('[ProjectRepository] Removing member from project:', projectId, memberId);

    // Check permission (only owner can remove members)
    await this.hasPermission(projectId, 'remove_members' as ProjectPermission);

    try {
      await ApiRetry.execute(
        () => projectMemberApiService.removeProjectMember(projectId, memberId),
        DEFAULT_RETRY_CONFIG,
        'ProjectRepository.removeMember',
      );

      log.info('[ProjectRepository] Successfully removed member:', memberId);
    } catch (error) {
      log.error('[ProjectRepository] Failed to remove member:', error);
      throw error;
    }
  }

  /**
   * Update a member's role
   * Requires change_member_roles permission (owner only)
   */
  public async updateMemberRole(
    projectId: string,
    memberId: string,
    input: UpdateMemberRoleInput,
  ): Promise<ProjectMember> {
    log.info('[ProjectRepository] Updating member role:', projectId, memberId, input.role);

    // Check permission
    await this.hasPermission(projectId, 'change_member_roles' as ProjectPermission);

    // TODO: Implement when member API endpoints are available
    log.warn('[ProjectRepository] Member API not yet implemented');
    throw new NotFoundError('API endpoint', `/projects/{id}/members/{memberId}`);
  }
}

export const projectRepository = new ProjectRepository();
export default ProjectRepository;

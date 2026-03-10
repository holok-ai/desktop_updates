/**
 * Project Repository
 * Single source of truth for all project operations
 * Handles API access, caching, validation, permissions, and error handling.
 * All public async methods return ApiResponse<T>.
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
import { apiOk, apiFail, type ApiResponse } from '../types/api-response.js';
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

export class ProjectRepository {
  private readonly projectsById: Map<GUID, Project> = new Map();
  private lastLoadTime: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache TTL

  /**
   * Clear in-memory project cache.
   * Called on logout to prevent cross-user state leakage.
   */
  public clearCache(): void {
    this.projectsById.clear();
    this.lastLoadTime = 0;
  }

  /**
   * Load all projects from API
   * Returns cached results if they are fresh enough
   */
  public async loadProjects(forceRefresh: boolean = false): Promise<ApiResponse<Project[]>> {
    const now = Date.now();

    // Return cached if not forcing refresh and cache is fresh
    if (!forceRefresh && now - this.lastLoadTime < this.CACHE_TTL && this.projectsById.size > 0) {
      return apiOk(this.listProjects());
    }

    const result = await projectApiService.getProjects({ size: 1000 });

    if (!result.success) {
      log.error('[ProjectRepository] Failed to load projects:', result.errorText);
      // Return cached projects if available, otherwise empty array
      return apiOk(this.listProjects());
    }

    // Clear cache and rebuild
    this.projectsById.clear();

    for (const dto of result.data.content) {
      const project = this.mapDTOToProject(dto);
      this.projectsById.set(project.id as GUID, project);
    }

    this.lastLoadTime = now;

    return apiOk(this.listProjects());
  }

  /**
   * Get a single project by ID
   * Always fetches fresh from API with members
   */
  public async getProject(projectId: GUID): Promise<ApiResponse<Project | null>> {
    const result = await projectApiService.getProject(projectId);

    if (!result.success) {
      log.error('[ProjectRepository] Failed to load project:', projectId, result.errorText);
      return apiOk(null);
    }

    // Fetch members for the project (best-effort)
    let members: MemberDTO[] = [];
    const membersResult = await projectMemberApiService.getProjectMembers(projectId);
    if (membersResult.success) {
      members = membersResult.data;
    } else {
      log.warn(
        '[ProjectRepository] Failed to load members for project:',
        projectId,
        membersResult.errorText,
      );
    }

    const project = this.mapDetailDTOToProject(result.data, members);

    // Update cache with fresh data
    this.projectsById.set(project.id as GUID, project);

    return apiOk(this.cloneProject(project));
  }

  /**
   * List all cached projects sorted by name
   */
  public listProjects(): Project[] {
    return Array.from(this.projectsById.values()).map((p) => this.cloneProject(p));
  }

  /**
   * List personal projects (type="personal")
   */
  public listPersonalProjects(): Project[] {
    return Array.from(this.projectsById.values())
      .filter((p) => p.type === 'personal')
      .map((p) => this.cloneProject(p));
  }

  /**
   * List shared projects (type="shared")
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
  ): Promise<ApiResponse<Project>> {
    // Validate title
    const titleError = validateProjectName(title);
    if (titleError) {
      return apiFail(-1, titleError);
    }

    // Validate description
    const descError = validateProjectDescription(description);
    if (descError) {
      return apiFail(-1, descError);
    }

    // Validate metadata if provided
    if (metadata) {
      if (metadata.color && !isValidMokuColor(metadata.color as string)) {
        return apiFail(-1, 'Invalid color. Color must be a non-empty string');
      }

      if (metadata.icon && !isValidProjectIcon(metadata.icon as string)) {
        return apiFail(-1, 'Invalid icon. Must be a valid Lucide icon ID');
      }
    }

    const createRequest: ProjectCreateRequest = {
      name: title, // API expects 'name'
      description: description ?? null,
      type: type ?? 'personal',
      metadata: metadata ?? null,
      userRole: 'owner', // Creator is always owner
      active: true,
      status: 'active',
    };

    const result = await projectApiService.createProject(createRequest);

    if (!result.success) {
      log.error('[ProjectRepository] Failed to create project:', result.errorText);
      return apiFail(result.errorCode, result.errorText);
    }

    // Fetch members for the newly created project (best-effort)
    let members: MemberDTO[] = [];
    const membersResult = await projectMemberApiService.getProjectMembers(result.data.id);
    if (membersResult.success) {
      members = membersResult.data;
    } else {
      log.warn(
        '[ProjectRepository] Failed to load members for new project:',
        result.data.id,
        membersResult.errorText,
      );
    }

    const project = this.mapDetailDTOToProject(result.data, members);

    // Add to cache
    this.projectsById.set(project.id as GUID, project);

    return apiOk(this.cloneProject(project));
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
  ): Promise<ApiResponse<Project>> {
    // Validate title if provided
    if (updates.title) {
      const titleError = validateProjectName(updates.title);
      if (titleError) {
        return apiFail(-1, titleError);
      }
    }

    // Validate description if provided
    if (updates.description !== undefined) {
      const descError = validateProjectDescription(updates.description);
      if (descError) {
        return apiFail(-1, descError);
      }
    }

    // Validate metadata if provided
    if (updates.metadata) {
      if (updates.metadata.color && !isValidMokuColor(updates.metadata.color as string)) {
        return apiFail(-1, 'Invalid color. Color must be a non-empty string');
      }

      if (updates.metadata.icon && !isValidProjectIcon(updates.metadata.icon as string)) {
        return apiFail(-1, 'Invalid icon. Must be a valid Lucide icon ID');
      }
    }

    const result = await projectApiService.updateProject(projectId, {
      name: updates.title,
      description: updates.description,
      metadata: updates.metadata,
    });

    if (!result.success) {
      log.error('[ProjectRepository] Failed to update project:', result.errorText);
      return apiFail(result.errorCode, result.errorText);
    }

    // Always fetch fresh members (best-effort)
    let members: MemberDTO[] = [];
    const membersResult = await projectMemberApiService.getProjectMembers(projectId);
    if (membersResult.success) {
      members = membersResult.data;
    } else {
      log.warn(
        '[ProjectRepository] Failed to load members for updated project:',
        projectId,
        membersResult.errorText,
      );
    }

    const project = this.mapDetailDTOToProject(result.data, members);

    // Update cache
    this.projectsById.set(project.id as GUID, project);

    return apiOk(this.cloneProject(project));
  }

  /**
   * Delete a project via API (soft delete)
   */
  public async deleteProject(projectId: GUID): Promise<ApiResponse<boolean>> {
    const result = await projectApiService.deleteProject(projectId);

    if (!result.success) {
      log.error('[ProjectRepository] Failed to delete project:', result.errorText);
      return apiOk(false);
    }

    // Remove from cache
    this.projectsById.delete(projectId);

    return apiOk(true);
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
    const mappedMembers = members.map((m) => ({
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
   */
  public async searchUsers(searchTerm?: string | null): Promise<ApiResponse<UserSummaryDTO[]>> {
    try {
      const response = await userApiService.searchUsers(searchTerm);
      return apiOk(response.content);
    } catch (error) {
      log.error('[ProjectRepository] Failed to search users:', error);
      const message = error instanceof Error ? error.message : String(error);
      return apiFail(-1, message);
    }
  }

  // ==================== Permission Methods ====================

  /**
   * Check if current user has permission for a project action
   * Returns ApiResponse with void on success, or error if no permission
   */
  public async hasPermission(
    projectId: string,
    permission: ProjectPermission,
  ): Promise<ApiResponse<void>> {
    const projectResult = await this.getProject(projectId as GUID);
    if (!projectResult.success) {
      return apiFail(projectResult.errorCode, projectResult.errorText);
    }

    const project = projectResult.data;
    if (!project) {
      return apiFail(404, `Project not found: ${projectId}`);
    }

    if (!roleHasPermission(project.userRole, permission)) {
      return apiFail(
        403,
        `Access denied. ${project.userRole} role does not have '${permission}' permission`,
      );
    }

    return apiOk(undefined) as ApiResponse<void>;
  }

  /**
   * Check permission without failing
   * Returns true if user has permission, false otherwise
   */
  public async checkPermission(projectId: string, permission: ProjectPermission): Promise<boolean> {
    const result = await this.hasPermission(projectId, permission);
    return result.success;
  }

  /**
   * Get current user's role in a project
   */
  public async getUserRole(projectId: string): Promise<ApiResponse<ProjectRole>> {
    const projectResult = await this.getProject(projectId as GUID);
    if (!projectResult.success) {
      return apiFail(projectResult.errorCode, projectResult.errorText);
    }

    const project = projectResult.data;
    if (!project) {
      return apiFail(404, `Project not found: ${projectId}`);
    }

    return apiOk(project.userRole);
  }

  // ==================== Member Management ====================

  /**
   * Get members for a project
   * Requires view_members permission
   */
  public async getMembers(projectId: string): Promise<ApiResponse<ProjectMember[]>> {
    // Check permission
    const permResult = await this.hasPermission(projectId, 'view_members' as ProjectPermission);
    if (!permResult.success) {
      return apiFail(permResult.errorCode, permResult.errorText);
    }

    // TODO: Implement when member API endpoints are available
    return apiOk([]);
  }

  /**
   * Add a member to a project
   * Requires invite_members permission (owner only)
   */
  public async addMember(
    projectId: string,
    input: AddMemberInput,
  ): Promise<ApiResponse<ProjectMember>> {
    // Check permission
    const permResult = await this.hasPermission(projectId, 'invite_members' as ProjectPermission);
    if (!permResult.success) {
      return apiFail(permResult.errorCode, permResult.errorText);
    }

    // Validate userId
    if (!input.userId) {
      return apiFail(-1, 'User ID is required');
    }

    const result = await projectMemberApiService.addProjectMember(
      projectId,
      input.userId,
      input.role,
    );

    if (!result.success) {
      log.error('[ProjectRepository] Failed to add member:', result.errorText);
      return apiFail(result.errorCode, result.errorText);
    }

    // Map DTO to ProjectMember
    const member: ProjectMember = {
      id: result.data.id,
      projectId: projectId,
      userId: result.data.userId,
      email: result.data.userEmail,
      displayName: result.data.userName,
      role: result.data.role as ProjectRole,
      joinedAt: result.data.createdAt,
    };

    return apiOk(member);
  }

  /**
   * Remove a member from a project
   * Requires remove_members permission (owner only)
   */
  public async removeMember(projectId: string, memberId: string): Promise<ApiResponse<void>> {
    // Check permission (only owner can remove members)
    const permResult = await this.hasPermission(projectId, 'remove_members' as ProjectPermission);
    if (!permResult.success) {
      return apiFail(permResult.errorCode, permResult.errorText);
    }

    const result = await projectMemberApiService.removeProjectMember(projectId, memberId);

    if (!result.success) {
      log.error('[ProjectRepository] Failed to remove member:', result.errorText);
      return apiFail(result.errorCode, result.errorText);
    }

    return apiOk(undefined) as ApiResponse<void>;
  }

  /**
   * Update a member's role
   * Requires change_member_roles permission (owner only)
   */
  public async updateMemberRole(
    projectId: string,
    _memberId: string,
    _input: UpdateMemberRoleInput,
  ): Promise<ApiResponse<ProjectMember>> {
    // Check permission
    const permResult = await this.hasPermission(
      projectId,
      'change_member_roles' as ProjectPermission,
    );
    if (!permResult.success) {
      return apiFail(permResult.errorCode, permResult.errorText);
    }

    // TODO: Implement when member API endpoints are available
    return apiFail(404, 'API endpoint not implemented: /projects/{id}/members/{memberId}');
  }
}

export const projectRepository = new ProjectRepository();
export default ProjectRepository;

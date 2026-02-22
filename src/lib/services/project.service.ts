import type { GUID } from '$lib/types/app.type';
import type { ApiResponse } from '../../../src-electron/preload.js';
import { projects } from '../stores/project.store';
import type { Project, UserSummaryDTO } from '../types/project.type.js';
import { BaseElectronService } from './base-electron.service';

/**
 * Input for creating a new project
 * Matches the structure expected by E3-S1 API
 */
export interface CreateProjectInput {
  title: string;
  description?: string;
  type?: 'personal' | 'shared';
  metadata?: {
    color?: string;
    icon?: string;
    [key: string]: unknown;
  };
}

/**
 * Normalize backend Project into renderer-safe shape.
 * Ensures createdAt/updatedAt are Date objects.
 */
function mapBackendToFrontendProject(backendProject: Project): Project {
  const {
    title: backendTitle,
    createdAt: backendCreatedAt,
    updatedAt: backendUpdatedAt,
  } = backendProject;

  const title: string = typeof backendTitle === 'string' ? backendTitle : '';

  let createdAt: Date;
  if (typeof backendCreatedAt === 'string') {
    createdAt = new Date(backendCreatedAt);
  } else if (backendCreatedAt instanceof Date) {
    createdAt = backendCreatedAt;
  } else {
    createdAt = new Date();
  }

  let updatedAt: Date;
  if (typeof backendUpdatedAt === 'string') {
    updatedAt = new Date(backendUpdatedAt);
  } else if (backendUpdatedAt instanceof Date) {
    updatedAt = backendUpdatedAt;
  } else {
    updatedAt = new Date();
  }

  return {
    ...backendProject,
    title,
    createdAt,
    updatedAt,
  };
}

export class ProjectService extends BaseElectronService {
  private constructor() {
    super();
  }

  public static getInstance(): ProjectService {
    return this.getSingletonInstance();
  }

  protected initializeEventListeners(): void {
    // Listen for project created events
    const unsubCreated = window.electronAPI.project.onProjectCreated((backendProject: Project) => {
      const frontendProject = mapBackendToFrontendProject(backendProject);
      projects.addProject(frontendProject);
    });
    this.registerCleanup(unsubCreated);

    // Listen for project updated events
    const unsubUpdated = window.electronAPI.project.onProjectUpdated((backendProject: Project) => {
      const frontendProject = mapBackendToFrontendProject(backendProject);
      projects.updateProject(frontendProject);
    });
    this.registerCleanup(unsubUpdated);

    // Listen for project deleted events
    const unsubDeleted = window.electronAPI.project.onProjectDeleted((projectId: GUID) => {
      projects.deleteProject(projectId);
    });
    this.registerCleanup(unsubDeleted);
  }

  public async loadProjects(forceRefresh = false): Promise<ApiResponse<void>> {
    // Ensure project repository cache is loaded/refreshed first
    const loadResult = await window.electronAPI.project.loadProjects(forceRefresh);
    if (!loadResult.success) {
      return { success: false, data: null, errorCode: loadResult.errorCode, errorText: loadResult.errorText };
    }

    // Fetch grouped lists from cache
    const [personalResult, sharedResult] = await Promise.all([
      window.electronAPI.project.listPersonalProjects(),
      window.electronAPI.project.listSharedProjects(),
    ]);

    const personal = personalResult.success ? personalResult.data : [];
    const shared = sharedResult.success ? sharedResult.data : [];

    const combined = [...personal, ...shared].map((p) => mapBackendToFrontendProject(p));
    projects.setProjects(combined);

    return { success: true, data: undefined as unknown as void, errorCode: 0, errorText: '' } as ApiResponse<void>;
  }

  public async createProject(input: CreateProjectInput): Promise<ApiResponse<Project>> {
    return window.electronAPI.project.create(input);
  }

  public async updateProject(
    id: GUID,
    updates: {
      title?: string;
      description?: string;
      metadata?: {
        color?: string;
        icon?: string;
        [key: string]: unknown;
      };
    },
  ): Promise<ApiResponse<Project>> {
    return window.electronAPI.project.update(id, updates);
  }

  public async deleteProject(id: GUID, deleteThreads = false): Promise<ApiResponse<boolean>> {
    return window.electronAPI.project.delete(id, { deleteThreads });
  }

  public async getThreadCount(projectId: GUID): Promise<number> {
    const result = await window.electronAPI.project.getThreads(projectId);
    return result.success ? result.data.length : 0;
  }

  public async searchUsers(searchTerm?: string | null): Promise<ApiResponse<UserSummaryDTO[]>> {
    return window.electronAPI.project.searchUsers(searchTerm);
  }

  public async getProjectById(id: GUID): Promise<ApiResponse<Project | null>> {
    const result = await window.electronAPI.project.getById(id);

    if (result.success && result.data !== null) {
      const frontendProject = mapBackendToFrontendProject(result.data);
      // Update store so UI can display the full project details
      projects.updateProject(frontendProject);
      return { success: true, data: frontendProject, errorCode: 0, errorText: '' };
    }

    return result;
  }

  /**
   * Add multiple members to a project with the specified role
   * @param projectId The project ID
   * @param userIds Array of user IDs (UUIDs) to add
   * @param role The role to assign ('viewer' or 'editor')
   * @returns Array of results with success/error for each user
   */
  public async addMembers(
    projectId: GUID,
    userIds: string[],
    role: 'viewer' | 'editor',
  ): Promise<Array<{ userId: string; success: boolean; error?: string }>> {
    const results = await Promise.allSettled(
      userIds.map((userId) =>
        window.electronAPI.project.addMember(projectId, { userId, role }),
      ),
    );

    return results.map((result, index) => {
      const userId = userIds.at(index) ?? '';
      if (result.status === 'fulfilled' && result.value.success) {
        return { userId, success: true };
      } else if (result.status === 'fulfilled' && !result.value.success) {
        return { userId, success: false, error: result.value.errorText };
      } else {
        return {
          userId,
          success: false,
          error: result.status === 'rejected'
            ? (result.reason instanceof Error ? result.reason.message : 'Unknown error')
            : 'Unknown error',
        };
      }
    });
  }

  /**
   * Remove a member from a project
   * @param projectId The project ID
   * @param memberId The member ID to remove
   */
  public async removeMember(projectId: GUID, memberId: string): Promise<ApiResponse<void>> {
    return window.electronAPI.project.removeMember(projectId, memberId);
  }
}

export const projectService = ProjectService.getInstance();

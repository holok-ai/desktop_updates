import type { GUID } from '$lib/types/app.type';
import { wrapElectronCall, wrapElectronCallWithFallback } from '$lib/utils/apiWrapper';
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
 * Map backend Project (uses 'title') to frontend Project (uses 'name')
 */
function mapBackendToFrontendProject(backendProject: Project): Project {
  const backendTitle =
    'title' in backendProject ? (backendProject as { title?: string }).title : undefined;
  return {
    ...backendProject,
    name: backendTitle ?? backendProject.name ?? '',
    // Ensure createdAt/updatedAt are Date objects
    createdAt:
      typeof backendProject.createdAt === 'string'
        ? new Date(backendProject.createdAt)
        : backendProject.createdAt,
    updatedAt:
      typeof backendProject.updatedAt === 'string'
        ? new Date(backendProject.updatedAt)
        : backendProject.updatedAt,
  };
}

export class ProjectService extends BaseElectronService {
  private constructor() {
    super();
  }

  public static getInstance(): ProjectService {
    return BaseElectronService.getSingletonInstance.call(this);
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

  public async loadProjects(forceRefresh = false): Promise<void> {
    // Ensure project repository cache is loaded/refreshed first
    await wrapElectronCall(
      () => window.electronAPI.project.loadProjects(forceRefresh),
      'Failed to load projects',
    );

    // Fetch grouped lists from cache
    const [personal, shared] = await Promise.all([
      wrapElectronCall(
        () => window.electronAPI.project.listPersonalProjects(),
        'Failed to load personal projects',
      ),
      wrapElectronCall(
        () => window.electronAPI.project.listSharedProjects(),
        'Failed to load shared projects',
      ),
    ]);

    const combined = [...personal, ...shared].map((p) => mapBackendToFrontendProject(p));
    projects.setProjects(combined);
  }

  public async createProject(input: CreateProjectInput): Promise<Project> {
    return wrapElectronCall(
      () => window.electronAPI.project.create(input),
      'Failed to create project',
    );
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
  ): Promise<Project> {
    return wrapElectronCall(
      () => window.electronAPI.project.update(id, updates),
      'Failed to update project',
    );
  }

  public async deleteProject(id: GUID, deleteThreads = false): Promise<boolean> {
    return wrapElectronCall(
      () => window.electronAPI.project.delete(id, { deleteThreads }),
      'Failed to delete project',
    );
  }

  public async getThreadCount(projectId: GUID): Promise<number> {
    return wrapElectronCallWithFallback(
      () => window.electronAPI.project.getThreads(projectId),
      'Failed to get thread count',
      0,
    );
  }

  public async searchUsers(searchTerm?: string | null): Promise<UserSummaryDTO[]> {
    return wrapElectronCall(
      () => window.electronAPI.project.searchUsers(searchTerm),
      'Failed to search users',
    );
  }

  public async getProjectById(id: GUID): Promise<Project | null> {
    const backendProject = await wrapElectronCall(
      () => window.electronAPI.project.getById(id),
      'Failed to get project',
    );

    if (backendProject !== null) {
      const frontendProject = mapBackendToFrontendProject(backendProject);
      // Update store so UI can display the full project details
      // This is safe because it's only called once per project selection
      projects.updateProject(frontendProject);
      return frontendProject;
    }
    return null;
  }
}

export const projectService = ProjectService.getInstance();

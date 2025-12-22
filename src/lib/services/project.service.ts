import type { GUID } from '$lib/types/app.type';
import { wrapElectronCall, wrapElectronCallWithFallback } from '$lib/utils/apiWrapper';
import { projects } from '../stores/project.store';
import type { Project, ProjectPrivacyMode, UserSummaryDTO } from '../types/project.type.js';

export class ProjectService {
  private static instance: ProjectService | null = null;
  private unsubscribes: (() => void)[] = [];

  private constructor() {
    this.initializeEventListeners();
  }

  public static getInstance(): ProjectService {
    ProjectService.instance ??= new ProjectService();
    return ProjectService.instance;
  }

  private initializeEventListeners(): void {
    // Listen for project created events
    const unsubCreated = window.electronAPI.project.onProjectCreated((project: Project) => {
      projects.addProject(project);
    });
    this.unsubscribes.push(unsubCreated);

    // Listen for project updated events
    const unsubUpdated = window.electronAPI.project.onProjectUpdated((project: Project) => {
      projects.updateProject(project);
    });
    this.unsubscribes.push(unsubUpdated);

    // Listen for project deleted events
    const unsubDeleted = window.electronAPI.project.onProjectDeleted((projectId: GUID) => {
      projects.deleteProject(projectId);
    });
    this.unsubscribes.push(unsubDeleted);
  }

  public async loadProjects(): Promise<void> {
    const allProjects = await wrapElectronCall(
      () => window.electronAPI.project.getAll(),
      'Failed to load projects',
    );
    projects.setProjects(allProjects);
  }

  public async createProject(
    title: string,
    description?: string,
    privacyMode?: ProjectPrivacyMode,
    type?: string,
  ): Promise<Project> {
    return wrapElectronCall(
      () => window.electronAPI.project.create({ title, description, privacyMode, type }),
      'Failed to create project',
    );
  }

  public async updateProject(
    id: GUID,
    updates: { title?: string; description?: string; privacyMode?: ProjectPrivacyMode },
  ): Promise<Project> {
    return wrapElectronCall(
      () => window.electronAPI.project.update(id, updates),
      'Failed to update project',
    );
  }

  public async setPrivacyMode(id: GUID, mode: ProjectPrivacyMode): Promise<Project> {
    return wrapElectronCall(
      () => window.electronAPI.project.update(id, { privacyMode: mode }),
      'Failed to set privacy mode',
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
    const project = await wrapElectronCall(
      () => window.electronAPI.project.getById(id),
      'Failed to get project',
    );
    if (project) {
      projects.updateProject(project);
    }
    return project;
  }

  public cleanup(): void {
    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes = [];
  }
}

export const projectService = ProjectService.getInstance();

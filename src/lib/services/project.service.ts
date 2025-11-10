import { projects } from '../stores/project.store';
import type { Project } from '../../../src-electron/preload';

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
    const unsubDeleted = window.electronAPI.project.onProjectDeleted((projectId: string) => {
      projects.deleteProject(projectId);
    });
    this.unsubscribes.push(unsubDeleted);
  }

  public async loadProjects(): Promise<void> {
    try {
      const allProjects = await window.electronAPI.project.getAll();
      projects.setProjects(allProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
      throw error;
    }
  }

  public async createProject(name: string, description?: string): Promise<Project> {
    try {
      const project = await window.electronAPI.project.create({ name, description });
      return project;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  }

  public async updateProject(
    id: string,
    updates: { name?: string; description?: string }
  ): Promise<Project> {
    try {
      const project = await window.electronAPI.project.update(id, updates);
      return project;
    } catch (error) {
      console.error('Failed to update project:', error);
      throw error;
    }
  }

  public async deleteProject(id: string, deleteThreads = false): Promise<boolean> {
    try {
      const isprojectDeleted = await window.electronAPI.project.delete(id, { deleteThreads });
      return isprojectDeleted;
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  }

  public async getThreadCount(projectId: string): Promise<number> {
    try {
      const count = await window.electronAPI.project.getThreads(projectId);
      return count;
    } catch (error) {
      console.error('Failed to get thread count:', error);
      return 0;
    }
  }

  public cleanup(): void {
    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes = [];
  }
}

export const projectService = ProjectService.getInstance();


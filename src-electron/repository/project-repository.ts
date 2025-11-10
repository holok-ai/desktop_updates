import { randomUUID } from 'node:crypto';
import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
  metadata?: Record<string, unknown>;
}

function generateId(prefix = ''): string {
  return `${prefix}${randomUUID()}`;
}

export class ProjectRepository {
  private readonly projectsById: Map<string, Project> = new Map();

  constructor() {
    this.loadFromDisk();
  }

  public createProject(
    name: string,
    description?: string,
    metadata?: Record<string, unknown>,
  ): Project {
    const now = Date.now();
    const project: Project = {
      id: generateId('proj_'),
      name,
      description,
      metadata: metadata ? { ...metadata } : undefined,
      createdAt: now,
      updatedAt: now,
    };
    this.projectsById.set(project.id, project);
    this.saveToDisk();
    return this.cloneProject(project);
  }

  public getProject(projectId: string): Project | null {
    const project = this.projectsById.get(projectId);
    return project ? this.cloneProject(project) : null;
  }

  public listProjects(): Project[] {
    return Array.from(this.projectsById.values())
      .filter((p) => !p.deletedAt)
      .map((p) => this.cloneProject(p))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public updateProject(
    projectId: string,
    updates: Partial<Pick<Project, 'name' | 'description' | 'metadata'>>,
  ): Project {
    const project = this.projectsById.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    if (updates.name !== undefined) project.name = updates.name;
    if (updates.description !== undefined) project.description = updates.description;
    if (updates.metadata !== undefined) {
      project.metadata = { ...project.metadata, ...updates.metadata };
    }

    project.updatedAt = Date.now();
    this.projectsById.set(project.id, project);
    this.saveToDisk();
    return this.cloneProject(project);
  }

  public deleteProject(projectId: string): boolean {
    const deleted = this.projectsById.delete(projectId);
    if (deleted) this.saveToDisk();
    return deleted;
  }

  public softDeleteProject(projectId: string): boolean {
    const project = this.projectsById.get(projectId);
    if (!project) return false;

    project.deletedAt = Date.now();
    project.updatedAt = Date.now();
    this.projectsById.set(project.id, project);
    this.saveToDisk();
    return true;
  }

  public clearAll(): void {
    this.projectsById.clear();
    this.saveToDisk();
  }

  private cloneProject(project: Project): Project {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      deletedAt: project.deletedAt ?? null,
      metadata: project.metadata ? { ...project.metadata } : undefined,
    };
  }

  private getStorePath(): string | null {
    try {
      const userData = app.getPath('userData');
      return path.join(userData, 'projects-storage.json');
    } catch {
      return null;
    }
  }

  private saveToDisk(): void {
    try {
      const storePath = this.getStorePath();
      if (!storePath) return;
      const payload = { version: 1, projects: Array.from(this.projectsById.values()) };
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.writeFileSync(storePath, JSON.stringify(payload), 'utf-8');
    } catch {
      // ignore IO errors
    }
  }

  private loadFromDisk(): void {
    try {
      const storePath = this.getStorePath();
      if (!storePath) return;
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!fs.existsSync(storePath)) return;
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const data = fs.readFileSync(storePath, 'utf-8');
      const parsed = JSON.parse(data) as { version?: number; projects?: Project[] };
      const projects = Array.isArray(parsed.projects) ? parsed.projects : [];
      this.projectsById.clear();
      for (const p of projects) {
        if (typeof p.id !== 'string' || typeof p.name !== 'string') continue;
        this.projectsById.set(p.id, {
          id: p.id,
          name: p.name,
          description: p.description,
          metadata: p.metadata ? { ...p.metadata } : undefined,
          createdAt: p.createdAt ?? Date.now(),
          updatedAt: p.updatedAt ?? Date.now(),
          deletedAt: p.deletedAt ?? null,
        });
      }
    } catch {
      // ignore malformed store
    }
  }
}

export const projectRepository = new ProjectRepository();
export default ProjectRepository;

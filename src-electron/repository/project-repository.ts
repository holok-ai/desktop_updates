import { randomUUID } from 'node:crypto';
import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GUID } from '../../src/lib/types/app.type.js';
import type { Project, ProjectPrivacyMode } from '../../src/lib/types/project.type.js';

export class ProjectRepository {
  private readonly projectsById: Map<GUID, Project> = new Map();

  constructor() {
    this.loadFromDisk();
  }

  public createProject(
    title: string,
    description?: string,
    metadata?: Record<string, unknown>,
    privacyMode?: ProjectPrivacyMode,
  ): Project {
    const project: Project = {
      id: randomUUID(),
      title,
      description,
      metadata: metadata ? { ...metadata } : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      privacyMode: privacyMode ?? 'default',
    };
    this.projectsById.set(project.id, project);
    this.saveToDisk();
    return this.cloneProject(project);
  }

  public getProject(projectId: GUID): Project | null {
    const project = this.projectsById.get(projectId);
    return project ? this.cloneProject(project) : null;
  }

  public listProjects(): Project[] {
    return Array.from(this.projectsById.values())
      .filter((p) => !p.deletedAt)
      .map((p) => this.cloneProject(p))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  public updateProject(
    projectId: GUID,
    updates: Partial<Pick<Project, 'title' | 'description' | 'metadata' | 'privacyMode'>>,
  ): Project {
    const project = this.projectsById.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    if (updates.title !== undefined) project.title = updates.title;
    if (updates.description !== undefined) project.description = updates.description;
    if (updates.metadata !== undefined) {
      project.metadata = { ...project.metadata, ...updates.metadata };
    }
    if (updates.privacyMode !== undefined) {
      project.privacyMode = updates.privacyMode;
    }

    project.updatedAt = new Date();
    this.projectsById.set(projectId, project);
    this.saveToDisk();
    return this.cloneProject(project);
  }

  public deleteProject(projectId: GUID): boolean {
    const deleted = this.projectsById.delete(projectId);
    if (deleted) this.saveToDisk();
    return deleted;
  }

  public softDeleteProject(projectId: GUID): boolean {
    const project = this.projectsById.get(projectId);
    if (!project) return false;

    project.deletedAt = new Date();
    project.updatedAt = new Date();
    this.projectsById.set(projectId, project);
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
      title: project.title,
      description: project.description,
      createdAt:
        project.createdAt instanceof Date ? project.createdAt : new Date(project.createdAt),
      updatedAt:
        project.updatedAt instanceof Date ? project.updatedAt : new Date(project.updatedAt),
      deletedAt: project.deletedAt ?? null,
      metadata: project.metadata ? { ...project.metadata } : undefined,
      privacyMode: project.privacyMode ?? 'default',
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
      const payload = { version: 2, projects: Array.from(this.projectsById.values()) };
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
        if (typeof p.id !== 'string' || typeof p.title !== 'string') continue;
        let deletedAt: Date | null = null;
        if (p.deletedAt instanceof Date) {
          deletedAt = p.deletedAt;
        } else if (p.deletedAt) {
          deletedAt = new Date(p.deletedAt);
        }
        this.projectsById.set(p.id, {
          id: p.id,
          title: p.title,
          description: p.description,
          metadata: p.metadata ? { ...p.metadata } : undefined,
          createdAt:
            p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt ?? Date.now()),
          updatedAt:
            p.updatedAt instanceof Date ? p.updatedAt : new Date(p.updatedAt ?? Date.now()),
          deletedAt: deletedAt,
          privacyMode: p.privacyMode ?? 'default',
        });
      }
    } catch {
      // ignore malformed store
    }
  }
}

export const projectRepository = new ProjectRepository();
export default ProjectRepository;

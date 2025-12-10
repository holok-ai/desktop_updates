import { ipcMain, BrowserWindow } from 'electron';
import { projectRepository } from '../repository/project-repository.js';
import { threadRepository } from '../repository/thread-repository.js';
import { createScopedLogger, logPerformance } from '../utils/logger.js';
import { getAuthService } from './auth-handler.js';

import type { Project, ProjectPrivacyMode } from '../../src/lib/types/project.type.js';
import { GUID } from '../../src/lib/types/app.type.js';

const projectLog = createScopedLogger('project');

function toRendererProject(p: Project | null): Project | null {
  if (!p) return null;

  const projectId = p.id;
  return {
    id: projectId,
    title: p.title,
    description: p.description,
    createdAt: new Date(p.createdAt.toISOString()),
    updatedAt: new Date(p.updatedAt.toISOString()),
    deletedAt: p.deletedAt ? new Date(p.deletedAt.toISOString()) : null,
    metadata: p.metadata ? { ...p.metadata } : undefined,
    privacyMode: p.privacyMode ?? 'default',
  };
}

function broadcast(channel: string, ...args: unknown[]): void {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    window.webContents.send(channel, ...(args as [unknown]));
  }
}

export function registerProjectHandlers(): void {
  // Get all projects
  ipcMain.handle('project:getAll', (): Promise<Project[]> => {
    const perfLog = logPerformance('project:getAll');
    const list = projectRepository.listProjects();
    const mapped = list.map((p) => toRendererProject(p)).filter((x): x is Project => x !== null);
    perfLog.end({ count: mapped.length });
    return Promise.resolve(mapped);
  });

  // Get project by ID
  ipcMain.handle('project:getById', (_event, id: GUID): Promise<Project | null> => {
    projectLog.info('Get project by id', { projectId: String(id) });
    const project = projectRepository.getProject(id);
    return Promise.resolve(toRendererProject(project));
  });

  // Create project
  ipcMain.handle(
    'project:create',
    (
      _event,
      data: {
        title: string;
        description?: string;
        metadata?: Record<string, unknown>;
        privacyMode?: ProjectPrivacyMode;
      },
    ): Promise<Project> => {
      const perfLog = logPerformance('project:create');
      projectLog.info('Create called', { title: data.title });

      const auth = getAuthService();
      if (!auth.isAuthenticated()) {
        throw new Error('Authentication required');
      }

      if (!data.title || data.title.trim().length === 0) {
        throw new Error('Project title is required');
      }

      const project = projectRepository.createProject(
        data.title.trim(),
        data.description?.trim(),
        data.metadata,
        data.privacyMode,
      );
      const rp = toRendererProject(project);
      if (!rp) throw new Error('Failed to convert created project');

      broadcast('project:created', rp);
      perfLog.end({ projectId: project.id });
      return Promise.resolve(rp);
    },
  );

  // Update/rename project
  ipcMain.handle(
    'project:update',
    (
      _event,
      id: GUID,
      updates: {
        title?: string;
        description?: string;
        metadata?: Record<string, unknown>;
        privacyMode?: ProjectPrivacyMode;
      },
    ): Promise<Project> => {
      const perfLog = logPerformance('project:update');
      projectLog.info('Update called');

      const auth = getAuthService();
      if (!auth.isAuthenticated()) {
        throw new Error('Authentication required');
      }

      if (updates.title !== undefined && updates.title.trim().length === 0) {
        throw new Error('Project title cannot be empty');
      }

      const updateData: Parameters<typeof projectRepository.updateProject>[1] = {};
      if (updates.title !== undefined) updateData.title = updates.title.trim();
      if (updates.description !== undefined) updateData.description = updates.description.trim();
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
      if (updates.privacyMode !== undefined) updateData.privacyMode = updates.privacyMode;

      const before = projectRepository.getProject(id);
      const updated = projectRepository.updateProject(id, updateData);
      const rp = toRendererProject(updated);
      if (!rp) throw new Error('Failed to convert updated project');

      broadcast('project:updated', rp);
      if (
        before &&
        updates.privacyMode !== undefined &&
        updates.privacyMode !== before.privacyMode
      ) {
        projectLog.info('Privacy mode changed', {
          projectId: String(id),
          from: before.privacyMode,
          to: updates.privacyMode,
          event: 'privacy_mode_changed',
        });
      }
      perfLog.end({ projectId: id });
      return Promise.resolve(rp);
    },
  );

  // Delete project
  ipcMain.handle(
    'project:delete',
    async (_event, id: GUID, options?: { deleteThreads?: boolean }): Promise<boolean> => {
      const perfLog = logPerformance('project:delete');
      projectLog.info('Delete called', { projectId: String(id), options });

      const auth = getAuthService();
      if (!auth.isAuthenticated()) {
        throw new Error('Authentication required');
      }

      const project = projectRepository.getProject(id);
      if (!project) {
        return false;
      }

      // Handle thread deletion/reassignment
      if (options?.deleteThreads) {
        // Delete all threads associated with this project
        const threads = await threadRepository.listThreads();
        const projectThreads = threads.filter((t) => t.metadata?.projectId === id);

        for (const thread of projectThreads) {
          await threadRepository.softDeleteThread(thread.id);
        }
        projectLog.info('Deleted associated threads', {
          projectId: String(id),
          threadCount: projectThreads.length,
        });
      } else {
        // Unassign threads from project (set projectId to undefined)
        const threads = await threadRepository.listThreads();
        const projectThreads = threads.filter((t) => t.metadata?.projectId === id);

        for (const thread of projectThreads) {
          const newMetadata = { ...thread.metadata };
          delete newMetadata.projectId;
          await threadRepository.updateThreadMetadata(thread.id, newMetadata);
        }
        projectLog.info('Unassigned threads from project', {
          projectId: String(id),
          threadCount: projectThreads.length,
        });
      }

      const deleted = projectRepository.softDeleteProject(id);
      if (deleted) {
        broadcast('project:deleted', id);
      }
      perfLog.end({ projectId: id, deleted });
      return deleted;
    },
  );

  // Get threads for a project
  ipcMain.handle('project:getThreads', async (_event, projectId: GUID): Promise<number> => {
    const threads = await threadRepository.listThreads();
    const projectThreads = threads.filter((t) => t.metadata?.projectId === projectId);
    return projectThreads.length;
  });

  projectLog.info('Handlers registered');
}

export function unregisterProjectHandlers(): void {
  ipcMain.removeHandler('project:getAll');
  ipcMain.removeHandler('project:getById');
  ipcMain.removeHandler('project:create');
  ipcMain.removeHandler('project:update');
  ipcMain.removeHandler('project:delete');
  ipcMain.removeHandler('project:getThreads');
  projectLog.info('Handlers unregistered');
}

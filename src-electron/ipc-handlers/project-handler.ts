import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';
import { projectRepository } from '../repository/project-repository.js';
import { threadRepository } from '../repository/thread-repository.js';
import type { GUID } from '../../src/lib/types/app.type.js';
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectMember,
  AddMemberInput,
} from '../types/project.types.js';

import type { Thread as RendererThread } from '../preload.js';
import type { Thread as InternalThread } from '../types/thread.types.js';

/**
 * Helper to convert internal thread representation to renderer-friendly shape
 */
function toRendererThread(t: InternalThread): RendererThread {
  return {
    id: t.id,
    type: t.type,
    projectId: t.projectId,
    createdUserId: t.createdUserId,
    title: t.title && t.title.length > 0 ? t.title : '',
    description: t.description ?? '',
    status: t.status,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt ?? t.createdAt,
    messages: t.messages || [],
    metadata: t.metadata ?? {},
  } as RendererThread;
}

/**
 * Broadcast an event to all renderer windows
 */
function broadcast(channel: string, ...args: unknown[]): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send(channel, ...args);
  });
}

/**
 * Register IPC handlers for project operations
 */
export function registerProjectHandlers(): void {
  // ==================== CRUD Operations ====================

  /**
   * Create a new project
   */
  ipcMain.handle('project:create', async (_, input: CreateProjectInput): Promise<Project> => {
    log.info('[IPC:project:create]', input.title);
    const project = await projectRepository.createProject(
      input.title,
      input.description,
      input.type,
      input.metadata,
    );

    // Broadcast creation event
    broadcast('project:created', project);

    return project;
  });

  /**
   * List all projects for current user
   * Uses ProjectRepository cache.
   */
  ipcMain.handle('project:list', async (): Promise<unknown[]> => {
    log.info('[IPC:project:list]');
    await projectRepository.loadProjects(false);
    return projectRepository.listProjects();
  });

  /**
   * Load projects (cached with TTL) - can be forced to refresh.
   */
  ipcMain.handle('project:loadProjects', async (_event, forceRefresh?: boolean): Promise<void> => {
    log.info('[IPC:project:loadProjects]', { forceRefresh: forceRefresh === true });
    await projectRepository.loadProjects(forceRefresh === true);
  });

  /**
   * List personal projects from cache
   */
  ipcMain.handle('project:listPersonalProjects', (): unknown[] => {
    log.info('[IPC:project:listPersonalProjects]');
    return projectRepository.listPersonalProjects();
  });

  /**
   * List shared projects from cache
   */
  ipcMain.handle('project:listSharedProjects', (): unknown[] => {
    log.info('[IPC:project:listSharedProjects]');
    return projectRepository.listSharedProjects();
  });

  /**
   * Get a single project by ID
   */
  ipcMain.handle('project:get', async (_, projectId: string): Promise<Project | null> => {
    log.info('[IPC:project:get]', projectId);
    return await projectRepository.getProject(projectId as GUID);
  });

  /**
   * Get threads for a project
   */
  ipcMain.handle('project:getThreads', async (_, projectId: string): Promise<RendererThread[]> => {
    log.info('[IPC:project:getThreads]', projectId);
    const threads = await threadRepository.listThreads({ projectId });
    return threads.map(toRendererThread).filter((t): t is RendererThread => t !== null);
  });

  /**
   * Update a project
   */
  ipcMain.handle(
    'project:update',
    async (_, projectId: string, input: UpdateProjectInput): Promise<Project> => {
      log.info('[IPC:project:update]', projectId);

      const project = await projectRepository.updateProject(projectId as GUID, input);

      // Broadcast update event
      broadcast('project:updated', project);

      return project;
    },
  );

  /**
   * Delete a project
   */
  ipcMain.handle(
    'project:delete',
    async (_, projectId: string, options?: { deleteThreads?: boolean }): Promise<boolean> => {
      log.info('[IPC:project:delete]', projectId, options);

      const pid = projectId as GUID;
      const deleteThreads = options?.deleteThreads === true;

      // Best-effort: handle threads in project before deleting project
      try {
        const projectThreads = await threadRepository.listThreads({ projectId });
        if (deleteThreads) {
          await Promise.all(projectThreads.map((t) => threadRepository.deleteThread(t.id)));
        } else {
          await Promise.all(
            projectThreads.map((t) => threadRepository.setThreadProjectId(t.id, null)),
          );
        }
      } catch (error) {
        log.warn('[IPC:project:delete] Failed to handle project threads before deletion:', error);
      }

      const ok = await projectRepository.deleteProject(pid);
      if (ok) {
        // Broadcast deletion event
        broadcast('project:deleted', projectId);
      }
      return ok;
    },
  );

  // ==================== Member Management ====================

  /**
   * Search users in the organization
   */
  ipcMain.handle(
    'project:searchUsers',
    async (_, searchTerm?: string | null): Promise<unknown[]> => {
      log.info('[IPC:project:searchUsers]', { searchTerm });
      return await projectRepository.searchUsers(searchTerm);
    },
  );

  /**
   * Add a member to a project
   */
  ipcMain.handle(
    'project:addMember',
    async (_, projectId: string, input: AddMemberInput): Promise<ProjectMember> => {
      log.info('[IPC:project:addMember]', projectId, input.userId);
      const member = await projectRepository.addMember(projectId, input);

      // Broadcast member added event
      broadcast('project:memberAdded', projectId, member);

      return member;
    },
  );

  /**
   * Remove a member from a project
   */
  ipcMain.handle(
    'project:removeMember',
    async (_, projectId: string, memberId: string): Promise<void> => {
      log.info('[IPC:project:removeMember]', projectId, memberId);
      await projectRepository.removeMember(projectId, memberId);

      // Broadcast member removed event
      broadcast('project:memberRemoved', projectId, memberId);
    },
  );

  log.info('[ProjectHandler] All project IPC handlers registered');
}

/**
 * Clean up handlers on app quit
 */
export function unregisterProjectHandlers(): void {
  ipcMain.removeHandler('project:create');
  ipcMain.removeHandler('project:list');
  ipcMain.removeHandler('project:loadProjects');
  ipcMain.removeHandler('project:listPersonalProjects');
  ipcMain.removeHandler('project:listSharedProjects');
  ipcMain.removeHandler('project:get');
  ipcMain.removeHandler('project:getThreads');
  ipcMain.removeHandler('project:update');
  ipcMain.removeHandler('project:delete');
  ipcMain.removeHandler('project:searchUsers');
  ipcMain.removeHandler('project:addMember');
  ipcMain.removeHandler('project:removeMember');

  log.info('[ProjectHandler] All project IPC handlers unregistered');
}

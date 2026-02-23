import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';
import { projectRepository } from '../repository/project-repository.js';
import { threadRepository } from '../repository/thread-repository.js';
import type { GUID } from '../../src/lib/types/app.type.js';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  AddMemberInput,
} from '../types/project.types.js';
import { apiOk, apiFail } from '../types/api-response.js';

import type { Thread as RendererThread } from '../preload.js';
import type { Thread as InternalThread } from '../types/thread.types.js';
import { DeleteProjectCommand } from '../commands/project.delete.js';

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
 * All handlers return ApiResponse<T>.
 */
export function registerProjectHandlers(): void {
  // ==================== CRUD Operations ====================

  /**
   * Create a new project
   */
  ipcMain.handle('project:create', async (_, input: CreateProjectInput) => {
    log.info('[IPC:project:create]', input.title);
    const result = await projectRepository.createProject(
      input.title,
      input.description,
      input.type,
      input.metadata,
    );

    // Broadcast creation event on success
    if (result.success) {
      broadcast('project:created', result.data);
    }

    return result;
  });

  /**
   * List all projects for current user
   * Uses ProjectRepository cache.
   */
  ipcMain.handle('project:list', async () => {
    log.info('[IPC:project:list]');
    return await projectRepository.loadProjects(false);
  });

  /**
   * Load projects (cached with TTL) - can be forced to refresh.
   */
  ipcMain.handle('project:loadProjects', async (_event, forceRefresh?: boolean) => {
    log.info('[IPC:project:loadProjects]', { forceRefresh: forceRefresh === true });
    return await projectRepository.loadProjects(forceRefresh === true);
  });

  /**
   * List personal projects from cache
   */
  ipcMain.handle('project:listPersonalProjects', () => {
    log.info('[IPC:project:listPersonalProjects]');
    return apiOk(projectRepository.listPersonalProjects());
  });

  /**
   * List shared projects from cache
   */
  ipcMain.handle('project:listSharedProjects', () => {
    log.info('[IPC:project:listSharedProjects]');
    return apiOk(projectRepository.listSharedProjects());
  });

  /**
   * Get a single project by ID
   */
  ipcMain.handle('project:get', async (_, projectId: string) => {
    log.info('[IPC:project:get]', projectId);
    return await projectRepository.getProject(projectId as GUID);
  });

  /**
   * Get threads for a project
   */
  ipcMain.handle('project:getThreads', async (_, projectId: string) => {
    log.info('[IPC:project:getThreads]', projectId);
    try {
      const threads = await threadRepository.listThreads({ projectId });
      const rendererThreads = threads
        .map(toRendererThread)
        .filter((t): t is RendererThread => t !== null);
      return apiOk(rendererThreads);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('[IPC:project:getThreads] Failed:', message);
      return apiFail(-1, message);
    }
  });

  /**
   * Update a project
   */
  ipcMain.handle('project:update', async (_, projectId: string, input: UpdateProjectInput) => {
    log.info('[IPC:project:update]', projectId);

    const result = await projectRepository.updateProject(projectId as GUID, input);

    // Broadcast update event on success
    if (result.success) {
      broadcast('project:updated', result.data);
    }

    return result;
  });

  /**
   * Delete a project
   */
  ipcMain.handle(
    'project:delete',
    async (_, projectId: string, options?: { deleteThreads?: boolean }) => {
      log.info('[IPC:project:delete]', projectId, options);

      const cmd = new DeleteProjectCommand();
      const result = await cmd.execute(projectId, options);
      if (result.success && result.data) {
        broadcast('project:deleted', projectId);
      }
      return result;
    },
  );

  // ==================== Member Management ====================

  /**
   * Search users in the organization
   */
  ipcMain.handle('project:searchUsers', async (_, searchTerm?: string | null) => {
    log.info('[IPC:project:searchUsers]', { searchTerm });
    return await projectRepository.searchUsers(searchTerm);
  });

  /**
   * Add a member to a project
   */
  ipcMain.handle('project:addMember', async (_, projectId: string, input: AddMemberInput) => {
    log.info('[IPC:project:addMember]', projectId, input.userId);
    const result = await projectRepository.addMember(projectId, input);

    // Broadcast member added event on success
    if (result.success) {
      broadcast('project:memberAdded', projectId, result.data);
    }

    return result;
  });

  /**
   * Remove a member from a project
   */
  ipcMain.handle('project:removeMember', async (_, projectId: string, memberId: string) => {
    log.info('[IPC:project:removeMember]', projectId, memberId);
    const result = await projectRepository.removeMember(projectId, memberId);

    // Broadcast member removed event on success
    if (result.success) {
      broadcast('project:memberRemoved', projectId, memberId);
    }

    return result;
  });

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

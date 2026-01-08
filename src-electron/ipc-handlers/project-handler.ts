/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
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
  UpdateMemberRoleInput,
  ProjectPermission,
  ProjectRole,
} from '../types/project.types.js';
import type { Thread as RendererThread } from '../preload.js';
import type { Thread as InternalThread } from '../repository/thread-repository.js';

/**
 * Helper to convert internal thread representation to renderer-friendly shape
 */
function toRendererThread(t: InternalThread): RendererThread {
  return {
    id: t.id,
    title: t.title && t.title.length > 0 ? t.title : ((t.metadata?.title as string) ?? ''),
    description: (t.metadata?.description as string) ?? '',
    status: (() => {
      const s = t.metadata?.status;
      if (typeof s === 'string') {
        if (s === 'active' || s === 'archived' || s === 'deleted') return s;
      }
      return 'active';
    })(),
    createdAt: new Date(t.createdAt),
    updatedAt: new Date(t.updatedAt ?? t.createdAt),
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
   * Alias for project:list (backward compatibility)
   */
  ipcMain.handle('project:getAll', async (): Promise<Project[]> => {
    log.info('[IPC:project:getAll]');
    await projectRepository.loadProjects(false);
    return projectRepository.listProjects();
  });

  /**
   * Get a single project by ID
   */
  ipcMain.handle('project:get', async (_, projectId: string): Promise<Project | null> => {
    log.info('[IPC:project:get]', projectId);
    return await projectRepository.getProject(projectId as GUID);
  });

  /**
   * Get thread count for a project
   * Uses ThreadRepository (API access is encapsulated there).
   */
  ipcMain.handle('project:getThreadsCount', async (_, projectId: string): Promise<number> => {
    log.info('[IPC:project:getThreadsCount]', projectId);
    const count = await threadRepository.getProjectThreadCount(projectId);
    log.debug(`[IPC:project:getThreadsCount] Found ${count} threads for project ${projectId}`);
    return count;
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
   * Alias for project:get (backward compatibility)
   */
  ipcMain.handle('project:getById', async (_, projectId: string): Promise<Project | null> => {
    log.info('[IPC:project:getById]', projectId);
    return await projectRepository.getProject(projectId as GUID);
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

  // ==================== Permission Checks ====================

  /**
   * Check if user has permission (throws on failure)
   */
  ipcMain.handle(
    'project:hasPermission',
    async (_, projectId: string, permission: ProjectPermission): Promise<void> => {
      log.debug('[IPC:project:hasPermission]', projectId, permission);
      await projectRepository.hasPermission(projectId, permission);
    },
  );

  /**
   * Check permission without throwing (returns boolean)
   */
  ipcMain.handle(
    'project:checkPermission',
    async (_, projectId: string, permission: ProjectPermission): Promise<boolean> => {
      log.debug('[IPC:project:checkPermission]', projectId, permission);
      return await projectRepository.checkPermission(projectId, permission);
    },
  );

  /**
   * Get user's role in a project
   */
  ipcMain.handle('project:getUserRole', async (_, projectId: string): Promise<ProjectRole> => {
    log.debug('[IPC:project:getUserRole]', projectId);
    return await projectRepository.getUserRole(projectId);
  });

  // ==================== Member Management ====================

  /**
   * Get project members
   */
  ipcMain.handle('project:getMembers', async (_, projectId: string): Promise<ProjectMember[]> => {
    log.info('[IPC:project:getMembers]', projectId);
    return await projectRepository.getMembers(projectId);
  });

  /**
   * Add a member to a project
   */
  ipcMain.handle(
    'project:addMember',
    async (_, projectId: string, input: AddMemberInput): Promise<ProjectMember> => {
      log.info('[IPC:project:addMember]', projectId, input.email);
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

  /**
   * Update a member's role
   */
  ipcMain.handle(
    'project:updateMemberRole',
    async (
      _,
      projectId: string,
      memberId: string,
      input: UpdateMemberRoleInput,
    ): Promise<ProjectMember> => {
      log.info('[IPC:project:updateMemberRole]', projectId, memberId, input.role);
      const member = await projectRepository.updateMemberRole(projectId, memberId, input);

      // Broadcast member role updated event
      broadcast('project:memberRoleUpdated', projectId, member);

      return member;
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
  ipcMain.removeHandler('project:getAll');
  ipcMain.removeHandler('project:get');
  ipcMain.removeHandler('project:getThreadsCount');
  ipcMain.removeHandler('project:getThreads');
  ipcMain.removeHandler('project:getById');
  ipcMain.removeHandler('project:update');
  ipcMain.removeHandler('project:delete');
  ipcMain.removeHandler('project:hasPermission');
  ipcMain.removeHandler('project:checkPermission');
  ipcMain.removeHandler('project:getUserRole');
  ipcMain.removeHandler('project:getMembers');
  ipcMain.removeHandler('project:addMember');
  ipcMain.removeHandler('project:removeMember');
  ipcMain.removeHandler('project:updateMemberRole');

  log.info('[ProjectHandler] All project IPC handlers unregistered');
}

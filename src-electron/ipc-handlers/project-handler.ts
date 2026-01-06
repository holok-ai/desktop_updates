/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';
import { projectService } from '../services/ProjectService.js';
import { projectRepository } from '../repository/project-repository.js';
import { threadRepository } from '../repository/thread-repository.js';
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
    const project = await projectService.create(input);

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
  ipcMain.handle('project:get', async (_, projectId: string): Promise<Project> => {
    log.info('[IPC:project:get]', projectId);
    return await projectService.get(projectId);
  });

  /**
   * Get thread count for a project
   * Uses ThreadRepository (API access is encapsulated there).
   */
  ipcMain.handle('project:getThreads', async (_, projectId: string): Promise<number> => {
    log.info('[IPC:project:getThreads]', projectId);
    const count = await threadRepository.getProjectThreadCount(projectId);
    log.debug(`[IPC:project:getThreads] Found ${count} threads for project ${projectId}`);
    return count;
  });

  /**
   * Update a project
   */
  ipcMain.handle(
    'project:update',
    async (_, projectId: string, input: UpdateProjectInput): Promise<Project> => {
      log.info('[IPC:project:update]', projectId);
      const project = await projectService.update(projectId, input);

      // Broadcast update event
      broadcast('project:updated', project);

      return project;
    },
  );

  /**
   * Delete a project
   */
  ipcMain.handle('project:delete', async (_, projectId: string): Promise<void> => {
    log.info('[IPC:project:delete]', projectId);
    await projectService.delete(projectId);

    // Broadcast deletion event
    broadcast('project:deleted', projectId);
  });

  // ==================== Permission Checks ====================

  /**
   * Check if user has permission (throws on failure)
   */
  ipcMain.handle(
    'project:hasPermission',
    async (_, projectId: string, permission: ProjectPermission): Promise<void> => {
      log.debug('[IPC:project:hasPermission]', projectId, permission);
      await projectService.hasPermission(projectId, permission);
    },
  );

  /**
   * Check permission without throwing (returns boolean)
   */
  ipcMain.handle(
    'project:checkPermission',
    async (_, projectId: string, permission: ProjectPermission): Promise<boolean> => {
      log.debug('[IPC:project:checkPermission]', projectId, permission);
      return await projectService.checkPermission(projectId, permission);
    },
  );

  /**
   * Get user's role in a project
   */
  ipcMain.handle('project:getUserRole', async (_, projectId: string): Promise<ProjectRole> => {
    log.debug('[IPC:project:getUserRole]', projectId);
    return await projectService.getUserRole(projectId);
  });

  // ==================== Member Management ====================

  /**
   * Get project members
   */
  ipcMain.handle('project:getMembers', async (_, projectId: string): Promise<ProjectMember[]> => {
    log.info('[IPC:project:getMembers]', projectId);
    return await projectService.getMembers(projectId);
  });

  /**
   * Add a member to a project
   */
  ipcMain.handle(
    'project:addMember',
    async (_, projectId: string, input: AddMemberInput): Promise<ProjectMember> => {
      log.info('[IPC:project:addMember]', projectId, input.email);
      const member = await projectService.addMember(projectId, input);

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
      await projectService.removeMember(projectId, memberId);

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
      const member = await projectService.updateMemberRole(projectId, memberId, input);

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
  ipcMain.removeHandler('project:get');
  ipcMain.removeHandler('project:getThreads');
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

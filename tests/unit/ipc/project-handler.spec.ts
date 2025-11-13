import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ipcMain } from 'electron';
import {
  registerProjectHandlers,
  unregisterProjectHandlers,
} from '../../../src-electron/ipc-handlers/project-handler';
import { projectRepository } from '../../../src-electron/repository/project-repository';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/appData'),
    quit: vi.fn(),
    on: vi.fn(),
    whenReady: () => Promise.resolve(),
  },
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

vi.mock('../../../src-electron/utils/logger', () => ({
  createScopedLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
  logPerformance: vi.fn(() => ({
    end: vi.fn(),
  })),
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  __esModule: true,
}));

vi.mock('../../../src-electron/ipc-handlers/auth-handler', () => ({
  getAuthService: vi.fn(() => ({
    isAuthenticated: vi.fn(() => true),
    getUser: vi.fn(() => ({ id: 'user-123' })),
  })),
}));

describe('Project IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectRepository.clearAll();
    registerProjectHandlers();
  });

  afterEach(() => {
    unregisterProjectHandlers();
  });

  it('should register all project handlers', () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('project:getAll', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('project:getById', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('project:create', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('project:update', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('project:delete', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('project:getThreads', expect.any(Function));
  });

  it('should unregister all handlers', () => {
    unregisterProjectHandlers();

    expect(ipcMain.removeHandler).toHaveBeenCalledWith('project:getAll');
    expect(ipcMain.removeHandler).toHaveBeenCalledWith('project:getById');
    expect(ipcMain.removeHandler).toHaveBeenCalledWith('project:create');
    expect(ipcMain.removeHandler).toHaveBeenCalledWith('project:update');
    expect(ipcMain.removeHandler).toHaveBeenCalledWith('project:delete');
    expect(ipcMain.removeHandler).toHaveBeenCalledWith('project:getThreads');
  });

  describe('project:getAll handler', () => {
    it('should return all projects', async () => {
      const handleCall = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'project:getAll',
      );
      const handler = handleCall[1];

      projectRepository.createProject('Project 1');
      projectRepository.createProject('Project 2');

      const result = await handler();

      expect(result).toHaveLength(2);
      expect(result[0].title).toBeDefined();
      expect(result[0].createdAt).toBeInstanceOf(Date);
    });
  });

  describe('project:create handler', () => {
    it('should create a new project', async () => {
      const handleCall = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'project:create',
      );
      const handler = handleCall[1];

      const result = await handler(null, {
        title: 'New Project',
        description: 'Test description',
      });

      expect(typeof result.id).toBe('string');
      expect(result.title).toBe('New Project');
      expect(result.description).toBe('Test description');
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should throw error if name is missing', () => {
      const handleCall = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'project:create',
      );
      const handler = handleCall[1];

      expect(() => handler(null, { title: '' })).toThrow('Project title is required');
    });
  });

  describe('project:update handler', () => {
    it('should update a project', async () => {
      const handleCall = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'project:update',
      );
      const handler = handleCall[1];

      const project = projectRepository.createProject('Original Name');

      const result = await handler(null, project.id, { title: 'Updated Name' });

      expect(result.title).toBe('Updated Name');
    });

    it('should throw error if name is empty', () => {
      const handleCall = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'project:update',
      );
      const handler = handleCall[1];

      const project = projectRepository.createProject('Test Project');

      expect(() => handler(null, project.id, { title: '' })).toThrow(
        'Project title cannot be empty',
      );
    });
  });

  describe('project:delete handler', () => {
    it('should soft delete a project', async () => {
      const handleCall = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'project:delete',
      );
      const handler = handleCall[1];

      const project = projectRepository.createProject('Test Project');

      const result = await handler(null, project.id, { deleteThreads: false });

      expect(result).toBe(true);
      expect(projectRepository.listProjects()).toHaveLength(0);
    });

    it('should return false for non-existent project', async () => {
      const handleCall = (ipcMain.handle as any).mock.calls.find(
        (call: any) => call[0] === 'project:delete',
      );
      const handler = handleCall[1];

      const result = await handler(null, 'non-existent-id', { deleteThreads: false });

      expect(result).toBe(false);
    });
  });
});

/**
 * Project IPC Handler Tests
 *
 * Tests at the IPC handler boundary: handler → repository → (mocked) API service.
 * Verifies every handler returns the correct ApiResponse<T> shape.
 * Mocks: projectRepository (async methods), threadRepository (for getThreads/delete).
 * Does NOT mock fetch, auth, or settings — those are service-level concerns.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiOk, apiFail } from '../../../src-electron/types/api-response';
import {
  expectApiSuccess,
  expectApiFail,
  expectApiSuccessVoid,
} from '../../helpers/api-response.helpers';
import type { Project } from '../../../src-electron/types/project.types';

// ── Capture IPC handlers ──────────────────────────────────────────

let handlers: Record<string, Function> = {};

// Stable spy for broadcast assertions — same reference every call
const sendSpy = vi.fn();
const fakeWindow = { webContents: { send: sendSpy } };

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/mock'), on: vi.fn(), whenReady: () => Promise.resolve() },
  ipcMain: {
    handle: (channel: string, fn: Function) => {
      handlers[channel] = fn;
    },
    removeHandler: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [fakeWindow]),
  },
}));

// ── Mock logger ────────────────────────────────────────────────────

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Mock projectRepository ─────────────────────────────────────────

const mockProjectRepo = {
  loadProjects: vi.fn(),
  getProject: vi.fn(),
  listProjects: vi.fn(() => []),
  listPersonalProjects: vi.fn(() => []),
  listSharedProjects: vi.fn(() => []),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  searchUsers: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
  clearAll: vi.fn(),
};

vi.mock('../../../src-electron/repository/project-repository', () => ({
  projectRepository: mockProjectRepo,
}));

// ── Mock threadRepository (used by getThreads and delete) ──────────

const mockThreadRepo = {
  listThreads: vi.fn(async () => []),
  deleteThread: vi.fn(async () => true),
  setThreadProjectId: vi.fn(async () => ({})),
};

vi.mock('../../../src-electron/repository/thread-repository', () => ({
  threadRepository: mockThreadRepo,
}));

// ── Test data ──────────────────────────────────────────────────────

const fakeProject: Project = {
  id: 'proj-1',
  title: 'Test Project',
  description: 'A test project',
  type: 'personal',
  createdBy: 'user-1',
  organizationId: 'org-1',
  active: true,
  status: 'active',
  metadata: null,
  memberCount: 1,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  userRole: 'owner',
};

// ── Setup / Teardown ───────────────────────────────────────────────

beforeEach(async () => {
  handlers = {};
  vi.clearAllMocks();

  const mod = await import('../../../src-electron/ipc-handlers/project-handler');
  mod.registerProjectHandlers();
});

afterEach(async () => {
  const mod = await import('../../../src-electron/ipc-handlers/project-handler');
  mod.unregisterProjectHandlers();
});

// ── Tests ──────────────────────────────────────────────────────────

describe('Project IPC Handlers — ApiResponse<T> contract', () => {
  describe('handler registration', () => {
    it('registers all expected channels', () => {
      const expected = [
        'project:create',
        'project:list',
        'project:loadProjects',
        'project:listPersonalProjects',
        'project:listSharedProjects',
        'project:get',
        'project:getThreads',
        'project:update',
        'project:delete',
        'project:searchUsers',
        'project:addMember',
        'project:removeMember',
      ];
      for (const channel of expected) {
        expect(handlers[channel], `missing handler for ${channel}`).toBeDefined();
      }
    });
  });

  // ── CRUD ───────────────────────────────────────────────────────

  describe('project:create', () => {
    it('returns ApiResponse<Project> on success', async () => {
      mockProjectRepo.createProject.mockResolvedValue(apiOk(fakeProject));

      const result = await handlers['project:create'](null, { title: 'Test Project' });

      expectApiSuccess(result);
      expect(result.data.title).toBe('Test Project');
      expect(result.data.id).toBe('proj-1');
    });

    it('returns apiFail when repository fails', async () => {
      mockProjectRepo.createProject.mockResolvedValue(apiFail(-1, 'Title is required'));

      const result = await handlers['project:create'](null, { title: '' });

      expectApiFail(result, -1);
      expect(result.errorText).toContain('Title is required');
    });

    it('broadcasts project:created on success', async () => {
      mockProjectRepo.createProject.mockResolvedValue(apiOk(fakeProject));
      await handlers['project:create'](null, { title: 'Test' });

      expect(sendSpy).toHaveBeenCalledWith('project:created', fakeProject);
    });

    it('does not broadcast on failure', async () => {
      mockProjectRepo.createProject.mockResolvedValue(apiFail(-1, 'error'));
      await handlers['project:create'](null, { title: '' });

      expect(sendSpy).not.toHaveBeenCalled();
    });
  });

  describe('project:list', () => {
    it('returns ApiResponse<Project[]> on success', async () => {
      mockProjectRepo.loadProjects.mockResolvedValue(apiOk([fakeProject]));

      const result = await handlers['project:list']();

      expectApiSuccess(result);
      expect(result.data).toHaveLength(1);
    });

    it('returns apiFail when API is down', async () => {
      mockProjectRepo.loadProjects.mockResolvedValue(apiFail(500, 'Server error'));

      const result = await handlers['project:list']();

      expectApiFail(result, 500);
    });
  });

  describe('project:loadProjects', () => {
    it('passes forceRefresh to repository', async () => {
      mockProjectRepo.loadProjects.mockResolvedValue(apiOk([]));

      await handlers['project:loadProjects'](null, true);

      expect(mockProjectRepo.loadProjects).toHaveBeenCalledWith(true);
    });

    it('defaults forceRefresh to false', async () => {
      mockProjectRepo.loadProjects.mockResolvedValue(apiOk([]));

      await handlers['project:loadProjects'](null);

      expect(mockProjectRepo.loadProjects).toHaveBeenCalledWith(false);
    });
  });

  describe('project:listPersonalProjects', () => {
    it('returns ApiResponse wrapping sync call', () => {
      mockProjectRepo.listPersonalProjects.mockReturnValue([fakeProject]);

      const result = handlers['project:listPersonalProjects']();

      expectApiSuccess(result);
      expect(result.data).toHaveLength(1);
    });

    it('returns empty array when no personal projects', () => {
      mockProjectRepo.listPersonalProjects.mockReturnValue([]);

      const result = handlers['project:listPersonalProjects']();

      expectApiSuccess(result);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('project:listSharedProjects', () => {
    it('returns ApiResponse wrapping sync call', () => {
      mockProjectRepo.listSharedProjects.mockReturnValue([fakeProject]);

      const result = handlers['project:listSharedProjects']();

      expectApiSuccess(result);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('project:get', () => {
    it('returns ApiResponse<Project> on success', async () => {
      mockProjectRepo.getProject.mockResolvedValue(apiOk(fakeProject));

      const result = await handlers['project:get'](null, 'proj-1');

      expectApiSuccess(result);
      expect(result.data.id).toBe('proj-1');
    });

    it('returns apiFail when project not found', async () => {
      mockProjectRepo.getProject.mockResolvedValue(apiFail(404, 'Not found'));

      const result = await handlers['project:get'](null, 'nonexistent');

      expectApiFail(result, 404);
    });
  });

  describe('project:update', () => {
    it('returns ApiResponse<Project> on success', async () => {
      const updated = { ...fakeProject, title: 'Updated Title' };
      mockProjectRepo.updateProject.mockResolvedValue(apiOk(updated));

      const result = await handlers['project:update'](null, 'proj-1', { title: 'Updated Title' });

      expectApiSuccess(result);
      expect(result.data.title).toBe('Updated Title');
    });

    it('broadcasts project:updated on success', async () => {
      const updated = { ...fakeProject, title: 'Updated' };
      mockProjectRepo.updateProject.mockResolvedValue(apiOk(updated));
      await handlers['project:update'](null, 'proj-1', { title: 'Updated' });

      expect(sendSpy).toHaveBeenCalledWith('project:updated', updated);
    });

    it('returns apiFail on validation error', async () => {
      mockProjectRepo.updateProject.mockResolvedValue(apiFail(-1, 'Title cannot be empty'));

      const result = await handlers['project:update'](null, 'proj-1', { title: '' });

      expectApiFail(result, -1);
    });
  });

  describe('project:delete', () => {
    it('returns ApiResponse<boolean> on success', async () => {
      mockProjectRepo.deleteProject.mockResolvedValue(apiOk(true));

      const result = await handlers['project:delete'](null, 'proj-1', { deleteThreads: false });

      expectApiSuccess(result);
      expect(result.data).toBe(true);
    });

    it('unlinks threads from project when deleteThreads is false', async () => {
      const fakeThread = { id: 'thread-1', projectId: 'proj-1' };
      mockThreadRepo.listThreads.mockResolvedValue([fakeThread]);
      mockProjectRepo.deleteProject.mockResolvedValue(apiOk(true));

      await handlers['project:delete'](null, 'proj-1', { deleteThreads: false });

      expect(mockThreadRepo.setThreadProjectId).toHaveBeenCalledWith('thread-1', null);
      expect(mockThreadRepo.deleteThread).not.toHaveBeenCalled();
    });

    it('deletes threads when deleteThreads is true', async () => {
      const fakeThread = { id: 'thread-1', projectId: 'proj-1' };
      mockThreadRepo.listThreads.mockResolvedValue([fakeThread]);
      mockProjectRepo.deleteProject.mockResolvedValue(apiOk(true));

      await handlers['project:delete'](null, 'proj-1', { deleteThreads: true });

      expect(mockThreadRepo.deleteThread).toHaveBeenCalledWith('thread-1');
      expect(mockThreadRepo.setThreadProjectId).not.toHaveBeenCalled();
    });

    it('broadcasts project:deleted on success', async () => {
      mockProjectRepo.deleteProject.mockResolvedValue(apiOk(true));
      await handlers['project:delete'](null, 'proj-1', { deleteThreads: false });

      expect(sendSpy).toHaveBeenCalledWith('project:deleted', 'proj-1');
    });

    it('returns apiFail when repository fails', async () => {
      mockProjectRepo.deleteProject.mockResolvedValue(apiFail(404, 'Not found'));

      const result = await handlers['project:delete'](null, 'nonexistent', {
        deleteThreads: false,
      });

      expectApiFail(result, 404);
    });
  });

  // ── Threads ────────────────────────────────────────────────────

  describe('project:getThreads', () => {
    it('returns ApiResponse<Thread[]> on success', async () => {
      const fakeThread = {
        id: 'thread-1',
        type: 'chat',
        projectId: 'proj-1',
        createdUserId: 'user-1',
        title: 'Test Thread',
        description: '',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        metadata: {},
      };
      mockThreadRepo.listThreads.mockResolvedValue([fakeThread]);

      const result = await handlers['project:getThreads'](null, 'proj-1');

      expectApiSuccess(result);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('thread-1');
    });

    it('returns apiFail when threadRepository throws', async () => {
      mockThreadRepo.listThreads.mockRejectedValue(new Error('DB error'));

      const result = await handlers['project:getThreads'](null, 'proj-1');

      expectApiFail(result, -1);
      expect(result.errorText).toBe('DB error');
    });
  });

  // ── Members ────────────────────────────────────────────────────

  describe('project:searchUsers', () => {
    it('returns ApiResponse<UserSummaryDTO[]> on success', async () => {
      const users = [{ id: 'u1', email: 'a@b.com', displayName: 'A' }];
      mockProjectRepo.searchUsers.mockResolvedValue(apiOk(users));

      const result = await handlers['project:searchUsers'](null, 'test');

      expectApiSuccess(result);
      expect(result.data).toHaveLength(1);
    });

    it('returns apiFail on API error', async () => {
      mockProjectRepo.searchUsers.mockResolvedValue(apiFail(500, 'Server error'));

      const result = await handlers['project:searchUsers'](null, 'test');

      expectApiFail(result, 500);
    });
  });

  describe('project:addMember', () => {
    it('returns ApiResponse on success', async () => {
      const member = { id: 'm1', userId: 'u1', role: 'editor' };
      mockProjectRepo.addMember.mockResolvedValue(apiOk(member));

      const result = await handlers['project:addMember'](null, 'proj-1', {
        userId: 'u1',
        role: 'editor',
      });

      expectApiSuccess(result);
      expect(result.data.userId).toBe('u1');
    });

    it('broadcasts project:memberAdded on success', async () => {
      const member = { id: 'm1', userId: 'u1', role: 'editor' };
      mockProjectRepo.addMember.mockResolvedValue(apiOk(member));
      await handlers['project:addMember'](null, 'proj-1', { userId: 'u1', role: 'editor' });

      expect(sendSpy).toHaveBeenCalledWith('project:memberAdded', 'proj-1', member);
    });

    it('returns apiFail on permission error', async () => {
      mockProjectRepo.addMember.mockResolvedValue(apiFail(403, 'Forbidden'));

      const result = await handlers['project:addMember'](null, 'proj-1', {
        userId: 'u1',
        role: 'editor',
      });

      expectApiFail(result, 403);
    });
  });

  describe('project:removeMember', () => {
    it('returns ApiResponse on success', async () => {
      mockProjectRepo.removeMember.mockResolvedValue(apiOk(undefined));

      const result = await handlers['project:removeMember'](null, 'proj-1', 'member-1');

      expectApiSuccessVoid(result);
    });

    it('broadcasts project:memberRemoved on success', async () => {
      mockProjectRepo.removeMember.mockResolvedValue(apiOk(undefined));
      await handlers['project:removeMember'](null, 'proj-1', 'member-1');

      expect(sendSpy).toHaveBeenCalledWith('project:memberRemoved', 'proj-1', 'member-1');
    });

    it('returns apiFail when member not found', async () => {
      mockProjectRepo.removeMember.mockResolvedValue(apiFail(404, 'Member not found'));

      const result = await handlers['project:removeMember'](null, 'proj-1', 'nonexistent');

      expectApiFail(result, 404);
    });
  });

  // ── Unregister ─────────────────────────────────────────────────

  describe('unregisterProjectHandlers', () => {
    it('removes all registered handlers', async () => {
      const { ipcMain } = await import('electron');
      const mod = await import('../../../src-electron/ipc-handlers/project-handler');

      mod.unregisterProjectHandlers();

      const expectedChannels = [
        'project:create',
        'project:list',
        'project:loadProjects',
        'project:listPersonalProjects',
        'project:listSharedProjects',
        'project:get',
        'project:getThreads',
        'project:update',
        'project:delete',
        'project:searchUsers',
        'project:addMember',
        'project:removeMember',
      ];
      for (const channel of expectedChannels) {
        expect(ipcMain.removeHandler).toHaveBeenCalledWith(channel);
      }
    });
  });
});

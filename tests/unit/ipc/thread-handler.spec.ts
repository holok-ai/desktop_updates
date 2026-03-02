/**
 * Thread IPC Handler Tests
 *
 * Tests at the IPC handler boundary: handler → repository (mocked).
 * Verifies every handler returns the correct ApiResponse<T> shape.
 * Mocks: threadRepository, modelRepository, threadApiService, titleValidationService, authService.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiOk, apiFail } from '../../../src-electron/types/api-response';
import {
  expectApiSuccess,
  expectApiFail,
  expectApiSuccessVoid,
} from '../../helpers/api-response.helpers';

// ── Capture IPC handlers ──────────────────────────────────────────

let handlers: Record<string, Function> = {};

// Stable spy for broadcast assertions
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

vi.mock('../../../src-electron/utils/logger', () => ({
  createScopedLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
  logPerformance: vi.fn(() => ({ end: vi.fn() })),
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  __esModule: true,
}));

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Mock threadRepository ──────────────────────────────────────────

const mockThreadRepo = {
  listThreads: vi.fn(),
  loadThread: vi.fn(),
  loadThreadMessages: vi.fn(),
  createThread: vi.fn(),
  saveThread: vi.fn(),
  deleteThread: vi.fn(),
  softDeleteThread: vi.fn(),
  deleteBranch: vi.fn(),
  appendMessage: vi.fn(),
  addAssistantResponse: vi.fn(),
  renameThread: vi.fn(),
  updateMessage: vi.fn(),
  setThreadProjectId: vi.fn(),
  addMessage: vi.fn(),
};

vi.mock('../../../src-electron/repository/thread-repository', () => ({
  threadRepository: mockThreadRepo,
}));

// ── Mock modelRepository ───────────────────────────────────────────

const mockModelRepo = {
  listAllModels: vi.fn(),
};

vi.mock('../../../src-electron/repository/model-repository', () => ({
  modelRepository: mockModelRepo,
}));

// ── Mock threadApiService ──────────────────────────────────────────

const mockThreadApi = {
  updateRequestBranch: vi.fn(),
  updateRequestDesktopOptions: vi.fn(),
};

vi.mock('../../../src-electron/services/mokuapi/thread-api.service', () => ({
  threadApiService: mockThreadApi,
}));

// ── Mock titleValidationService ────────────────────────────────────

const mockTitleValidation = {
  validate: vi.fn(() => ({ valid: true, sanitizedTitle: 'Sanitized Title' })),
};

vi.mock('../../../src-electron/services/title-validation.service', () => ({
  titleValidationService: mockTitleValidation,
}));

// ── Mock auth-handler ──────────────────────────────────────────────

const mockAuth = {
  isAuthenticated: vi.fn(() => true),
  getUser: vi.fn(() => ({ id: 'user-1' })),
};

vi.mock('../../../src-electron/ipc-handlers/auth-handler', () => ({
  getAuthService: vi.fn(() => mockAuth),
}));

// ── Fake data ──────────────────────────────────────────────────────

function fakeInternalThread(overrides: Record<string, unknown> = {}) {
  return {
    id: 'thread-1',
    type: 'chat',
    projectId: null,
    createdUserId: 'user-1',
    title: 'Test Thread',
    description: '',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    metadata: {},
    ...overrides,
  };
}

function fakeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello',
    createdAt: Date.now(),
    branchId: '1.0.0',
    ...overrides,
  };
}

// ── Setup / Teardown ───────────────────────────────────────────────

beforeEach(async () => {
  handlers = {};
  vi.clearAllMocks();

  // Default: authenticated user
  mockAuth.isAuthenticated.mockReturnValue(true);
  mockAuth.getUser.mockReturnValue({ id: 'user-1' });

  // Default: thread exists
  mockThreadRepo.loadThread.mockResolvedValue(fakeInternalThread());
  mockThreadRepo.listThreads.mockResolvedValue([fakeInternalThread()]);
  mockModelRepo.listAllModels.mockResolvedValue(apiOk([]));

  const mod = await import('../../../src-electron/ipc-handlers/thread-handler');
  mod.registerThreadHandlers();
});

afterEach(async () => {
  const mod = await import('../../../src-electron/ipc-handlers/thread-handler');
  mod.unregisterThreadHandlers();
});

// ── Tests ──────────────────────────────────────────────────────────

describe('Thread IPC Handlers — ApiResponse<T> contract', () => {
  describe('handler registration', () => {
    it('registers all expected channels', () => {
      const expected = [
        'thread:getAll',
        'thread:getById',
        'thread:getMessages',
        'thread:create',
        'thread:update',
        'thread:renameThread',
        'thread:delete',
        'thread:softDelete',
        'thread:deleteBranch',
        'thread:appendMessage',
        'thread:addAssistantResponse',
        'thread:moveToProject',
        'thread:updateMessage',
        'thread:updateMessageBranch',
        'thread:updateMessageDesktopOptions',
      ];
      for (const channel of expected) {
        expect(handlers[channel], `missing handler for ${channel}`).toBeDefined();
      }
    });
  });

  // ── List & Get ─────────────────────────────────────────────────

  describe('thread:getAll', () => {
    it('returns ApiResponse<Thread[]> on success', async () => {
      const result = await handlers['thread:getAll'](null);

      expectApiSuccess(result);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('filters by projectId when provided', async () => {
      const t1 = fakeInternalThread({ id: 't1', projectId: 'proj-1' });
      const t2 = fakeInternalThread({ id: 't2', projectId: null });
      mockThreadRepo.listThreads.mockResolvedValue([t1, t2]);

      const result = await handlers['thread:getAll'](null, { projectId: 'proj-1' });

      expectApiSuccess(result);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('t1');
    });

    it('excludes project threads when no projectId', async () => {
      const t1 = fakeInternalThread({ id: 't1', projectId: 'proj-1' });
      const t2 = fakeInternalThread({ id: 't2', projectId: null });
      mockThreadRepo.listThreads.mockResolvedValue([t1, t2]);

      const result = await handlers['thread:getAll'](null);

      expectApiSuccess(result);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('t2');
    });

    it('returns apiFail when repository throws', async () => {
      mockThreadRepo.listThreads.mockRejectedValue(new Error('DB failure'));

      const result = await handlers['thread:getAll'](null);

      expectApiFail(result, -1);
      expect(result.errorText).toBe('DB failure');
    });
  });

  describe('thread:getById', () => {
    it('returns ApiResponse<Thread> on success', async () => {
      const result = await handlers['thread:getById'](null, 'thread-1');

      expectApiSuccess(result);
      expect(result.data.id).toBe('thread-1');
    });

    it('returns ApiResponse with null data when not found', async () => {
      mockThreadRepo.loadThread.mockResolvedValue(null);

      const result = await handlers['thread:getById'](null, 'nonexistent');

      // apiOk(null) — toRendererThread returns null for null input
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('returns apiFail on error', async () => {
      mockThreadRepo.loadThread.mockRejectedValue(new Error('Load failed'));

      const result = await handlers['thread:getById'](null, 'thread-1');

      expectApiFail(result, -1);
    });
  });

  describe('thread:getMessages', () => {
    it('returns ApiResponse<Message[]> on success', async () => {
      const messages = [
        fakeMessage({ id: 'm1', createdAt: 100 }),
        fakeMessage({ id: 'm2', createdAt: 200 }),
      ];
      mockThreadRepo.loadThreadMessages.mockResolvedValue(messages);

      const result = await handlers['thread:getMessages'](null, 'thread-1');

      expectApiSuccess(result);
      expect(result.data).toHaveLength(2);
      // Should be sorted by createdAt ascending
      expect(result.data[0].id).toBe('m1');
      expect(result.data[1].id).toBe('m2');
    });

    it('filters out soft-deleted messages', async () => {
      const messages = [
        fakeMessage({ id: 'm1' }),
        fakeMessage({ id: 'm2', deletedAt: Date.now() }),
      ];
      mockThreadRepo.loadThreadMessages.mockResolvedValue(messages);

      const result = await handlers['thread:getMessages'](null, 'thread-1');

      expectApiSuccess(result);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('m1');
    });

    it('returns empty array when thread not found', async () => {
      mockThreadRepo.loadThreadMessages.mockResolvedValue([]);

      const result = await handlers['thread:getMessages'](null, 'nonexistent');

      expectApiSuccess(result);
      expect(result.data).toHaveLength(0);
    });
  });

  // ── Create ─────────────────────────────────────────────────────

  describe('thread:create', () => {
    it('returns ApiResponse<Thread> on success', async () => {
      const created = fakeInternalThread({ title: 'New Thread' });
      mockThreadRepo.createThread.mockResolvedValue(created);

      const result = await handlers['thread:create'](null, { title: 'New Thread' });

      expectApiSuccess(result);
      expect(result.data.title).toBe('New Thread');
    });

    it('validates model when initalModel is provided', async () => {
      mockModelRepo.listAllModels.mockResolvedValue(
        apiOk([{ id: 'model-1', accessName: 'gpt-4' }]),
      );
      const created = fakeInternalThread();
      mockThreadRepo.createThread.mockResolvedValue(created);

      const result = await handlers['thread:create'](null, {
        title: 'Test',
        initalModel: 'gpt-4',
      });

      expectApiSuccess(result);
    });

    it('returns apiFail(400) when model unavailable', async () => {
      mockModelRepo.listAllModels.mockResolvedValue(
        apiOk([{ id: 'model-1', accessName: 'gpt-4' }]),
      );

      const result = await handlers['thread:create'](null, {
        title: 'Test',
        initalModel: 'nonexistent-model',
      });

      expectApiFail(result, 400);
      expect(result.errorText).toContain('unavailable');
    });

    it('returns apiFail when model list fails', async () => {
      mockModelRepo.listAllModels.mockResolvedValue(apiFail(500, 'API error'));

      const result = await handlers['thread:create'](null, {
        title: 'Test',
        initalModel: 'gpt-4',
      });

      expectApiFail(result, -1);
    });

    it('broadcasts thread:created on success', async () => {
      const created = fakeInternalThread();
      mockThreadRepo.createThread.mockResolvedValue(created);

      await handlers['thread:create'](null, { title: 'Test' });

      expect(sendSpy).toHaveBeenCalledWith(
        'thread:created',
        expect.objectContaining({ id: 'thread-1' }),
      );
    });
  });

  // ── Update ─────────────────────────────────────────────────────

  describe('thread:update', () => {
    it('returns ApiResponse<Thread> on success', async () => {
      const existing = fakeInternalThread();
      mockThreadRepo.loadThread.mockResolvedValue(existing);
      mockThreadRepo.saveThread.mockReturnValue({ ...existing, title: 'Updated' });

      const result = await handlers['thread:update'](null, 'thread-1', { title: 'Updated' });

      expectApiSuccess(result);
    });

    it('returns apiFail(404) when thread not found', async () => {
      mockThreadRepo.loadThread.mockResolvedValue(null);

      const result = await handlers['thread:update'](null, 'nonexistent', { title: 'X' });

      expectApiFail(result, 404);
    });
  });

  // ── Rename ─────────────────────────────────────────────────────

  describe('thread:renameThread', () => {
    it('returns ApiResponse<Thread> on success', async () => {
      const renamed = fakeInternalThread({ title: 'Sanitized Title' });
      mockThreadRepo.renameThread.mockResolvedValue(renamed);

      const result = await handlers['thread:renameThread'](null, 'thread-1', 'New Title');

      expectApiSuccess(result);
      expect(result.data.title).toBe('Sanitized Title');
    });

    it('returns apiFail(403) when not authenticated', async () => {
      mockAuth.isAuthenticated.mockReturnValue(false);

      const result = await handlers['thread:renameThread'](null, 'thread-1', 'New');

      expectApiFail(result, 403);
      expect(result.errorText).toBe('THREAD_ACCESS_DENIED');
    });

    it('returns apiFail(404) when thread not found', async () => {
      mockThreadRepo.loadThread.mockResolvedValue(null);

      const result = await handlers['thread:renameThread'](null, 'nonexistent', 'New');

      expectApiFail(result, 404);
      expect(result.errorText).toBe('THREAD_NOT_FOUND');
    });

    it('returns apiFail(400) when title validation fails', async () => {
      mockTitleValidation.validate.mockReturnValue({ valid: false, error: 'Title too long' });

      const result = await handlers['thread:renameThread'](null, 'thread-1', 'X'.repeat(300));

      expectApiFail(result, 400);
      expect(result.errorText).toBe('Title too long');
    });

    it('returns apiFail(400) for TITLE_EMPTY error from repository', async () => {
      mockTitleValidation.validate.mockReturnValue({ valid: true, sanitizedTitle: '' });
      mockThreadRepo.renameThread.mockRejectedValue(new Error('TITLE_EMPTY'));

      const result = await handlers['thread:renameThread'](null, 'thread-1', '  ');

      expectApiFail(result, 400);
    });
  });

  // ── Delete ─────────────────────────────────────────────────────

  describe('thread:delete', () => {
    it('returns ApiResponse<boolean> on success', async () => {
      mockThreadRepo.deleteThread.mockResolvedValue(true);

      const result = await handlers['thread:delete'](null, 'thread-1');

      expectApiSuccess(result);
      expect(result.data).toBe(true);
    });

    it('broadcasts thread:deleted when successful', async () => {
      mockThreadRepo.deleteThread.mockResolvedValue(true);

      await handlers['thread:delete'](null, 'thread-1');

      expect(sendSpy).toHaveBeenCalledWith('thread:deleted', 'thread-1');
    });

    it('does not broadcast when delete returns false', async () => {
      mockThreadRepo.deleteThread.mockResolvedValue(false);

      await handlers['thread:delete'](null, 'nonexistent');

      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('returns apiFail on error', async () => {
      mockThreadRepo.deleteThread.mockRejectedValue(new Error('Delete failed'));

      const result = await handlers['thread:delete'](null, 'thread-1');

      expectApiFail(result, -1);
    });
  });

  describe('thread:softDelete', () => {
    it('returns ApiResponse<boolean> on success', async () => {
      mockThreadRepo.softDeleteThread.mockResolvedValue(true);

      const result = await handlers['thread:softDelete'](null, 'thread-1');

      expectApiSuccess(result);
      expect(result.data).toBe(true);
    });
  });

  // ── Branch operations ──────────────────────────────────────────

  describe('thread:deleteBranch', () => {
    it('returns ApiResponse<void> on success', async () => {
      mockThreadRepo.deleteBranch.mockReturnValue(undefined);

      const result = await handlers['thread:deleteBranch'](null, 'thread-1', 'branch-1');

      expectApiSuccessVoid(result);
    });

    it('returns apiFail when branch deletion throws', async () => {
      mockThreadRepo.deleteBranch.mockImplementation(() => {
        throw new Error('Branch not found');
      });

      const result = await handlers['thread:deleteBranch'](null, 'thread-1', 'bad-branch');

      expectApiFail(result, -1);
      expect(result.errorText).toBe('Branch not found');
    });
  });

  // ── Messages ───────────────────────────────────────────────────

  describe('thread:appendMessage', () => {
    it('returns ApiResponse with message and thread on success', async () => {
      const msg = fakeMessage();
      mockThreadRepo.appendMessage.mockResolvedValue(msg);

      const result = await handlers['thread:appendMessage'](null, 'thread-1', {
        role: 'user',
        content: 'Hello',
      });

      expectApiSuccess(result);
      expect(result.data.message).toBeDefined();
      expect(result.data.message.id).toBe('msg-1');
      expect(result.data.thread).toBeDefined();
    });

    it('returns apiFail(403) when not authenticated', async () => {
      mockAuth.isAuthenticated.mockReturnValue(false);

      const result = await handlers['thread:appendMessage'](null, 'thread-1', {
        role: 'user',
        content: 'Hello',
      });

      expectApiFail(result, 403);
    });

    it('returns apiFail(404) when thread not found', async () => {
      mockThreadRepo.loadThread.mockResolvedValue(null);

      const result = await handlers['thread:appendMessage'](null, 'nonexistent', {
        role: 'user',
        content: 'Hello',
      });

      expectApiFail(result, 404);
    });

    it('returns apiFail(413) for MESSAGE_TOO_LARGE', async () => {
      mockThreadRepo.appendMessage.mockRejectedValue(new Error('MESSAGE_TOO_LARGE'));

      const result = await handlers['thread:appendMessage'](null, 'thread-1', {
        role: 'user',
        content: 'x'.repeat(1000000),
      });

      expectApiFail(result, 413);
    });
  });

  describe('thread:addAssistantResponse', () => {
    it('returns ApiResponse with message data on success', async () => {
      const msg = fakeMessage({ role: 'assistant', content: 'Hi there' });
      mockThreadRepo.addAssistantResponse.mockResolvedValue(msg);

      const result = await handlers['thread:addAssistantResponse'](
        null,
        'thread-1',
        'Hi there',
        'gpt-4',
      );

      expectApiSuccess(result);
      expect(result.data.role).toBe('assistant');
      expect(result.data.content).toBe('Hi there');
    });

    it('returns apiFail on error', async () => {
      mockThreadRepo.addAssistantResponse.mockRejectedValue(new Error('Storage full'));

      const result = await handlers['thread:addAssistantResponse'](null, 'thread-1', 'Hi');

      expectApiFail(result, -1);
    });
  });

  // ── Move to project ────────────────────────────────────────────

  describe('thread:moveToProject', () => {
    it('returns ApiResponse<Thread> on success', async () => {
      const result = await handlers['thread:moveToProject'](null, 'thread-1', 'proj-1');

      expectApiSuccess(result);
      expect(result.data.id).toBe('thread-1');
    });

    it('returns apiFail(401) when not authenticated', async () => {
      mockAuth.isAuthenticated.mockReturnValue(false);

      const result = await handlers['thread:moveToProject'](null, 'thread-1', 'proj-1');

      expectApiFail(result, 401);
    });

    it('returns apiFail(404) when thread not found', async () => {
      mockThreadRepo.loadThread.mockResolvedValue(null);

      const result = await handlers['thread:moveToProject'](null, 'nonexistent', 'proj-1');

      expectApiFail(result, 404);
    });
  });

  // ── Update message ─────────────────────────────────────────────

  describe('thread:updateMessage', () => {
    it('returns ApiResponse with message and thread on success', async () => {
      const updatedMsg = fakeMessage({ content: 'Edited', editedAt: Date.now() });
      mockThreadRepo.updateMessage.mockReturnValue(updatedMsg);

      const result = await handlers['thread:updateMessage'](null, 'thread-1', 'msg-1', 'Edited');

      expectApiSuccess(result);
      expect(result.data.message.content).toBe('Edited');
      expect(result.data.thread).toBeDefined();
    });

    it('returns apiFail when message not found', async () => {
      mockThreadRepo.updateMessage.mockImplementation(() => {
        throw new Error('Message not found');
      });

      const result = await handlers['thread:updateMessage'](null, 'thread-1', 'bad-msg', 'X');

      expectApiFail(result, -1);
    });
  });

  // ── API passthrough handlers ───────────────────────────────────

  describe('thread:updateMessageBranch', () => {
    it('passes through ApiResponse from threadApiService', async () => {
      const dto = { id: 'msg-1', branchId: '2.0.0' };
      mockThreadApi.updateRequestBranch.mockResolvedValue(apiOk(dto));

      const result = await handlers['thread:updateMessageBranch'](
        null,
        'thread-1',
        'msg-1',
        '2.0.0',
      );

      expectApiSuccess(result);
      expect(result.data.branchId).toBe('2.0.0');
    });

    it('passes through apiFail from threadApiService', async () => {
      mockThreadApi.updateRequestBranch.mockResolvedValue(apiFail(404, 'Not found'));

      const result = await handlers['thread:updateMessageBranch'](
        null,
        'thread-1',
        'msg-1',
        '2.0.0',
      );

      expectApiFail(result, 404);
    });
  });

  describe('thread:updateMessageDesktopOptions', () => {
    it('passes through ApiResponse from threadApiService', async () => {
      const dto = { id: 'msg-1', desktopOptions: { key: 'value' } };
      mockThreadApi.updateRequestDesktopOptions.mockResolvedValue(apiOk(dto));

      const result = await handlers['thread:updateMessageDesktopOptions'](
        null,
        'thread-1',
        'msg-1',
        { key: 'value' },
      );

      expectApiSuccess(result);
    });
  });

  // ── Unregister ─────────────────────────────────────────────────

  describe('unregisterThreadHandlers', () => {
    it('removes all registered handlers', async () => {
      const { ipcMain } = await import('electron');
      const mod = await import('../../../src-electron/ipc-handlers/thread-handler');

      mod.unregisterThreadHandlers();

      const expected = [
        'thread:getAll',
        'thread:getById',
        'thread:create',
        'thread:update',
        'thread:renameThread',
        'thread:delete',
        'thread:moveToProject',
        'thread:updateMessage',
        'thread:updateMessageBranch',
        'thread:updateMessageDesktopOptions',
      ];
      for (const channel of expected) {
        expect(ipcMain.removeHandler).toHaveBeenCalledWith(channel);
      }
    });
  });
});

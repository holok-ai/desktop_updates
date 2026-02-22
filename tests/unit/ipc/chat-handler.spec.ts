/**
 * Chat IPC Handler Tests
 *
 * Tests at the IPC handler boundary.
 * Mocks: DesktopChatService, ToolOrchestrator, threadRepository, modelRepository, AuthService.
 * Verifies every handler returns ApiResponse<T>.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { expectApiSuccessVoid, expectApiFail, expectApiSuccess } from '../../helpers/api-response.helpers';

// ── Capture IPC handlers ──────────────────────────────────────────

let handlers: Record<string, Function> = {};

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/mock'), on: vi.fn(), whenReady: () => Promise.resolve() },
  ipcMain: {
    handle: (channel: string, fn: Function) => { handlers[channel] = fn; },
    removeHandler: vi.fn(),
  },
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}));

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Mock DesktopChatService class ──────────────────────────────────

const mockChatFn = vi.fn();
const mockGetAuditLogs = vi.fn(() => [{ requestId: 'r1' }]);

vi.mock('../../../src-electron/services/chat/index', () => ({
  DesktopChatService: class MockDesktopChatService {
    chat = mockChatFn;
    getAuditLogs = mockGetAuditLogs;
  },
  ToolOrchestrator: {
    getInstance: vi.fn(() => ({
      getToolDefinitions: vi.fn(() => []),
      setAllowedPaths: vi.fn(),
    })),
  },
}));

// ── Mock repositories ──────────────────────────────────────────────

const mockThreadRepo = {
  loadThread: vi.fn(),
};

vi.mock('../../../src-electron/repository/thread-repository', () => ({
  threadRepository: mockThreadRepo,
}));

const mockModelRepo = {
  getAgentById: vi.fn(),
};

vi.mock('../../../src-electron/repository/model-repository', () => ({
  modelRepository: mockModelRepo,
}));

// ── Mock settings-handler ──────────────────────────────────────────

vi.mock('../../../src-electron/ipc-handlers/settings-handler', () => ({
  getSettingsService: vi.fn(() => ({
    getDirectoryWhitelist: vi.fn(() => []),
  })),
}));

// ── Mock auth-handler ──────────────────────────────────────────────

vi.mock('../../../src-electron/ipc-handlers/auth-handler', () => ({
  getAuthService: vi.fn(() => ({
    isAuthenticated: () => true,
    getAccessToken: async () => 'test-token',
    getUser: () => ({ id: 'user-1' }),
  })),
}));

// ── Fake data ──────────────────────────────────────────────────────

const fakeThread = {
  id: 'thread-1',
  title: 'Test',
  metadata: { agentId: 'agent-1' },
  messages: [],
};

const fakeAgent = {
  id: 'agent-1',
  url: 'https://api.test.com',
  provider: 'openai',
  title: 'Test Agent',
};

// ── Setup / Teardown ───────────────────────────────────────────────

beforeEach(async () => {
  handlers = {};
  vi.clearAllMocks();

  // Default mocks for successful createServiceForThread
  mockThreadRepo.loadThread.mockResolvedValue(fakeThread);
  mockModelRepo.getAgentById.mockResolvedValue({ success: true, data: fakeAgent, errorCode: 0, errorText: '' });
  mockChatFn.mockResolvedValue(undefined);

  const mod = await import('../../../src-electron/ipc-handlers/chat-handler');
  const { AuthService } = await import('../../../src-electron/services/auth.service');
  mod.registerChatHandlers();
});

afterEach(async () => {
  const mod = await import('../../../src-electron/ipc-handlers/chat-handler');
  mod.unregisterChatHandlers();
});

// ── Tests ──────────────────────────────────────────────────────────

describe('Chat IPC Handlers — ApiResponse<T> contract', () => {
  describe('handler registration', () => {
    it('registers all expected channels', () => {
      expect(handlers['chat:createServiceForThread']).toBeDefined();
      expect(handlers['chat:send']).toBeDefined();
      expect(handlers['chat:getAuditLogs']).toBeDefined();
    });
  });

  describe('chat:createServiceForThread', () => {
    it('returns ApiResponse<void> on success', async () => {
      const result = await handlers['chat:createServiceForThread'](
        null, 'thread-1', 'branch-1', 'gpt-4', '/work/dir',
      );

      expectApiSuccessVoid(result);
    });

    it('returns apiFail when thread not found', async () => {
      mockThreadRepo.loadThread.mockResolvedValue(null);

      const result = await handlers['chat:createServiceForThread'](
        null, 'nonexistent', 'branch-1', 'gpt-4',
      );

      expectApiFail(result, -1);
      expect(result.errorText).toContain('thread');
    });

    it('returns apiFail when agent not found', async () => {
      mockModelRepo.getAgentById.mockResolvedValue({
        success: false, data: null, errorCode: -1, errorText: 'Agent not found',
      });

      const result = await handlers['chat:createServiceForThread'](
        null, 'thread-1', 'branch-1', 'gpt-4',
      );

      expectApiFail(result, -1);
      expect(result.errorText).toContain('agent');
    });
  });

  describe('chat:send', () => {
    it('returns ApiResponse<void> on success', async () => {
      // First create the service
      await handlers['chat:createServiceForThread'](
        null, 'thread-1', 'branch-1', 'gpt-4', '/work',
      );

      const event = { sender: { send: vi.fn() } };
      const request = { branch_id: 'branch-1', messages: [], model: 'gpt-4' };

      const result = await handlers['chat:send'](event, 'thread-1', request);

      expectApiSuccessVoid(result);
    });

    it('returns apiFail when branch_id missing', async () => {
      const event = { sender: { send: vi.fn() } };
      const request = { messages: [], model: 'gpt-4' }; // no branch_id

      const result = await handlers['chat:send'](event, 'thread-1', request);

      expectApiFail(result, -1);
      expect(result.errorText).toContain('branch_id');
    });

    it('returns apiFail when service not initialized', async () => {
      const event = { sender: { send: vi.fn() } };
      const request = { branch_id: 'branch-1', messages: [] };

      const result = await handlers['chat:send'](event, 'nonexistent', request);

      expectApiFail(result, -1);
      expect(result.errorText).toContain('not initialized');
    });

    it('streams tokens to sender', async () => {
      // Mock chat to call the onToken callback
      mockChatFn.mockImplementation(async (req: unknown, onToken: (t: string) => void) => {
        onToken('hello');
        onToken(' world');
      });

      await handlers['chat:createServiceForThread'](
        null, 'thread-1', 'branch-1', 'gpt-4', '/work',
      );

      const sendSpy = vi.fn();
      const event = { sender: { send: sendSpy } };
      const request = { branch_id: 'branch-1', messages: [] };

      await handlers['chat:send'](event, 'thread-1', request);

      expect(sendSpy).toHaveBeenCalledWith('chat:token', {
        threadId: 'thread-1', branchId: 'branch-1', token: 'hello',
      });
      expect(sendSpy).toHaveBeenCalledWith('chat:token', {
        threadId: 'thread-1', branchId: 'branch-1', token: ' world',
      });
    });

    it('returns apiFail when chat throws', async () => {
      mockChatFn.mockRejectedValue(new Error('Provider timeout'));

      await handlers['chat:createServiceForThread'](
        null, 'thread-1', 'branch-1', 'gpt-4', '/work',
      );

      const event = { sender: { send: vi.fn() } };
      const request = { branch_id: 'branch-1', messages: [] };

      const result = await handlers['chat:send'](event, 'thread-1', request);

      expectApiFail(result, -1);
      expect(result.errorText).toBe('Provider timeout');
    });
  });

  describe('chat:getAuditLogs', () => {
    it('returns ApiResponse<unknown[]> on success', async () => {
      // Create service first
      await handlers['chat:createServiceForThread'](
        null, 'thread-1', 'branch-1', 'gpt-4', '/work',
      );

      const result = handlers['chat:getAuditLogs'](null, 'thread-1', 'branch-1');

      expectApiSuccess(result);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('returns apiFail when threadId or branchId missing', () => {
      const result = handlers['chat:getAuditLogs'](null, '', '');

      expectApiFail(result, -1);
    });

    it('returns apiFail when service not found', () => {
      const result = handlers['chat:getAuditLogs'](null, 'nonexistent', 'branch-1');

      expectApiFail(result, -1);
      expect(result.errorText).toContain('not found');
    });
  });

  describe('unregisterChatHandlers', () => {
    it('removes all registered handlers', async () => {
      const { ipcMain } = await import('electron');
      const mod = await import('../../../src-electron/ipc-handlers/chat-handler');

      mod.unregisterChatHandlers();

      expect(ipcMain.removeHandler).toHaveBeenCalledWith('chat:createServiceForThread');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('chat:send');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('chat:getAuditLogs');
    });
  });
});

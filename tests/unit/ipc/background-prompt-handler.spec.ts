/**
 * Background Prompt IPC Handler Tests
 *
 * Tests the IPC handler boundary: registration, submit, cancel, cancelAllForThread.
 * Mocks: BackgroundPromptService, AuthService.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { expectApiSuccessVoid, expectApiFail } from '../../helpers/api-response.helpers';

// ── Capture IPC handlers ──────────────────────────────────────────

let handlers: Record<string, Function> = {};

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/mock'), on: vi.fn(), whenReady: () => Promise.resolve() },
  ipcMain: {
    handle: (channel: string, fn: Function) => {
      handlers[channel] = fn;
    },
    removeHandler: vi.fn(),
  },
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}));

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Mock BackgroundPromptService ──────────────────────────────────

const mockSubmit = vi.fn();
const mockCancel = vi.fn();
const mockCancelAllForThread = vi.fn();
const mockSetBroadcastFn = vi.fn();
const mockSetAuthService = vi.fn();
const mockCleanup = vi.fn();

vi.mock('../../../src-electron/services/background-prompt.service', () => ({
  BackgroundPromptService: class {
    submit = mockSubmit;
    cancel = mockCancel;
    cancelAllForThread = mockCancelAllForThread;
    setBroadcastFn = mockSetBroadcastFn;
    setAuthService = mockSetAuthService;
    cleanup = mockCleanup;
  },
}));

// ── Import after mocks ────────────────────────────────────────────

import {
  registerBackgroundPromptHandlers,
  unregisterBackgroundPromptHandlers,
  getBackgroundPromptService,
} from '../../../src-electron/ipc-handlers/background-prompt-handler';
import {
  BackgroundPromptType,
  type BackgroundPromptRequest,
} from '../../../src-shared/types/background-prompt.types';

// ── Helpers ───────────────────────────────────────────────────────

function makeRequest(overrides: Partial<BackgroundPromptRequest> = {}): BackgroundPromptRequest {
  return {
    taskId: 'test-task-1',
    type: BackgroundPromptType.AutoTitle,
    threadId: 'thread-1',
    messages: [{ role: 'user', content: 'Hello' }],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('Background Prompt IPC Handlers', () => {
  beforeEach(() => {
    handlers = {};
    vi.clearAllMocks();
    registerBackgroundPromptHandlers();
  });

  afterEach(() => {
    unregisterBackgroundPromptHandlers();
  });

  describe('handler registration', () => {
    it('registers all expected channels', () => {
      expect(handlers['bgprompt:submit']).toBeDefined();
      expect(handlers['bgprompt:cancel']).toBeDefined();
      expect(handlers['bgprompt:cancelAllForThread']).toBeDefined();
    });

    it('sets up the broadcast function', () => {
      expect(mockSetBroadcastFn).toHaveBeenCalledOnce();
      expect(typeof mockSetBroadcastFn.mock.calls[0][0]).toBe('function');
    });
  });

  describe('bgprompt:submit', () => {
    it('returns ApiResponse<void> on success', async () => {
      mockSubmit.mockResolvedValue(undefined);

      const request = makeRequest();
      const result = await handlers['bgprompt:submit'](null, request);

      expectApiSuccessVoid(result);
      expect(mockSubmit).toHaveBeenCalledWith(request);
    });

    it('returns apiFail when service throws', () => {
      mockSubmit.mockImplementation(() => {
        throw new Error('Queue full');
      });

      const request = makeRequest();
      const result = handlers['bgprompt:submit'](null, request);

      expectApiFail(result, -1);
      expect(result.errorText).toBe('Queue full');
    });
  });

  describe('bgprompt:cancel', () => {
    it('returns ApiResponse<void> on success', () => {
      mockCancel.mockReturnValue(true);

      const result = handlers['bgprompt:cancel'](null, 'test-task-1');

      expectApiSuccessVoid(result);
      expect(mockCancel).toHaveBeenCalledWith('test-task-1');
    });
  });

  describe('bgprompt:cancelAllForThread', () => {
    it('returns ApiResponse<void> on success', () => {
      const result = handlers['bgprompt:cancelAllForThread'](null, 'thread-1');

      expectApiSuccessVoid(result);
      expect(mockCancelAllForThread).toHaveBeenCalledWith('thread-1');
    });
  });

  describe('getBackgroundPromptService', () => {
    it('returns the service instance after registration', () => {
      const service = getBackgroundPromptService();
      expect(service).not.toBeNull();
    });

    it('returns null after unregistration', () => {
      unregisterBackgroundPromptHandlers();

      const service = getBackgroundPromptService();
      expect(service).toBeNull();
    });
  });

  describe('unregisterBackgroundPromptHandlers', () => {
    it('removes all registered handlers', async () => {
      const { ipcMain } = await import('electron');

      unregisterBackgroundPromptHandlers();

      expect(ipcMain.removeHandler).toHaveBeenCalledWith('bgprompt:submit');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('bgprompt:cancel');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('bgprompt:cancelAllForThread');
    });

    it('calls cleanup on the service', () => {
      unregisterBackgroundPromptHandlers();

      expect(mockCleanup).toHaveBeenCalledOnce();
    });
  });

  describe('broadcast wiring', () => {
    it('broadcasts result to all windows via BrowserWindow.getAllWindows', async () => {
      const { BrowserWindow } = await import('electron');
      const mockSend = vi.fn();
      (BrowserWindow.getAllWindows as ReturnType<typeof vi.fn>).mockReturnValue([
        { webContents: { send: mockSend } },
      ]);

      // Get the broadcast function that was passed to the service
      const broadcastFn = mockSetBroadcastFn.mock.calls[0][0];

      const result = {
        taskId: 'task-1',
        type: BackgroundPromptType.AutoTitle,
        threadId: 'thread-1',
        status: 'completed',
        result: 'My Title',
      };

      broadcastFn(result);

      expect(mockSend).toHaveBeenCalledWith('bgprompt:result', result);
    });
  });
});

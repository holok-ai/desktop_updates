/**
 * ThreadBranchService — unit tests for branch domain
 *
 * Tests cover:
 *   - selectBranchLane: iterates lanes and sets isSelectedBranch
 *   - deleteBranch: delegates to electronAPI
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Message } from '$lib/types/thread.type';
import type { ApiResponse } from '../../../src-electron/preload';

// ── Helpers ───────────────────────────────────────────────────────

function apiOk<T>(data: T): ApiResponse<T> {
  return { success: true, data, errorCode: 0, errorText: '' };
}
function apiFail<T>(errorCode: number, errorText: string): ApiResponse<T> {
  return { success: false, data: null, errorCode, errorText } as ApiResponse<T>;
}

function msg(
  overrides: Partial<Message> & { id: string; branchId: string; role: Message['role'] },
): Message {
  return {
    threadId: 'thread-1',
    content: `content-${overrides.id}`,
    createdAt: Date.now(),
    ...overrides,
  };
}

// ── Mock electronAPI ──────────────────────────────────────────────

const mockThreadApi = {
  getAll: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  softDelete: vi.fn(),
  renameThread: vi.fn(),
  getMessages: vi.fn(),
  moveToProject: vi.fn(),
  appendMessage: vi.fn(),
  updateMessage: vi.fn(),
  updateMessageBranch: vi.fn(),
  updateMessageDesktopOptions: vi.fn(),
  deleteBranch: vi.fn(),
  onThreadCreated: vi.fn(() => vi.fn()),
  onThreadUpdated: vi.fn(() => vi.fn()),
  onThreadDeleted: vi.fn(() => vi.fn()),
};

Object.defineProperty(window, 'electronAPI', {
  value: {
    thread: mockThreadApi,
    chat: {
      createServiceForThread: vi.fn(),
      chat: vi.fn(),
      onToken: vi.fn(() => vi.fn()),
      onToolUse: vi.fn(() => vi.fn()),
      onToolStatus: vi.fn(() => vi.fn()),
      getAuditLogs: vi.fn(),
    },
    models: {},
    auth: {},
    settings: {},
    system: {},
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    onMenuCommand: vi.fn(),
  },
  writable: true,
  configurable: true,
});

vi.mock('$lib/stores/thread.store', () => ({
  threads: {
    setThreads: vi.fn(),
    addThread: vi.fn(),
    updateThread: vi.fn(),
    deleteThread: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

let branchService: import('$lib/services/thread-branch.service').ThreadBranchService;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();

  const mod = await import('$lib/services/thread-branch.service');
  branchService = mod.ThreadBranchService.getInstance();
});

// ═══════════════════════════════════════════════════════════════════
// selectBranchLane
// ═══════════════════════════════════════════════════════════════════

describe('selectBranchLane', () => {
  it('sets isSelectedBranch=true on the selected lane and false on others', async () => {
    mockThreadApi.updateMessageDesktopOptions.mockResolvedValue(apiOk({}));

    const messages = [
      msg({ id: 'u1', branchId: '2.1.0', role: 'user' }),
      msg({ id: 'u2', branchId: '2.2.0', role: 'user' }),
      msg({ id: 'u3', branchId: '2.3.0', role: 'user' }),
    ];

    await branchService.selectBranchLane('thread-1', '2.2', messages);

    expect(mockThreadApi.updateMessageDesktopOptions).toHaveBeenCalledTimes(3);
    expect(mockThreadApi.updateMessageDesktopOptions).toHaveBeenCalledWith('thread-1', 'u1', {
      isSelectedBranch: false,
    });
    expect(mockThreadApi.updateMessageDesktopOptions).toHaveBeenCalledWith('thread-1', 'u2', {
      isSelectedBranch: true,
    });
    expect(mockThreadApi.updateMessageDesktopOptions).toHaveBeenCalledWith('thread-1', 'u3', {
      isSelectedBranch: false,
    });
  });

  it('stops iterating when no user message found for a lane number', async () => {
    mockThreadApi.updateMessageDesktopOptions.mockResolvedValue(apiOk({}));

    const messages = [msg({ id: 'u1', branchId: '2.1.0', role: 'user' })];

    await branchService.selectBranchLane('thread-1', '2.1', messages);

    expect(mockThreadApi.updateMessageDesktopOptions).toHaveBeenCalledTimes(1);
    expect(mockThreadApi.updateMessageDesktopOptions).toHaveBeenCalledWith('thread-1', 'u1', {
      isSelectedBranch: true,
    });
  });

  it('handles API failure gracefully (logs error, continues)', async () => {
    mockThreadApi.updateMessageDesktopOptions
      .mockResolvedValueOnce(apiFail(-1, 'network error'))
      .mockResolvedValueOnce(apiOk({}));

    const messages = [
      msg({ id: 'u1', branchId: '2.1.0', role: 'user' }),
      msg({ id: 'u2', branchId: '2.2.0', role: 'user' }),
    ];

    await branchService.selectBranchLane('thread-1', '2.2', messages);
    expect(mockThreadApi.updateMessageDesktopOptions).toHaveBeenCalledTimes(2);
  });

  it('only considers user messages when finding first message in lane', async () => {
    mockThreadApi.updateMessageDesktopOptions.mockResolvedValue(apiOk({}));

    const messages = [
      msg({ id: 'a1', branchId: '2.1.0', role: 'assistant' }),
      msg({ id: 'u1', branchId: '2.1.1', role: 'user' }),
    ];

    await branchService.selectBranchLane('thread-1', '2.1', messages);

    expect(mockThreadApi.updateMessageDesktopOptions).toHaveBeenCalledWith('thread-1', 'u1', {
      isSelectedBranch: true,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// deleteBranch
// ═══════════════════════════════════════════════════════════════════

describe('deleteBranch', () => {
  it('delegates to electronAPI', async () => {
    mockThreadApi.deleteBranch.mockResolvedValue(apiOk(undefined));

    const result = await branchService.deleteBranch('t1', '1.1.0');

    expect(mockThreadApi.deleteBranch).toHaveBeenCalledWith('t1', '1.1.0');
    expect(result.success).toBe(true);
  });
});

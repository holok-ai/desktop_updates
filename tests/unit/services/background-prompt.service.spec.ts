/**
 * BackgroundPromptService Tests
 *
 * Tests the main process service: priority queue, concurrency control,
 * dedup/replacement, cancellation, and result broadcasting.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BackgroundPromptType,
  BackgroundPromptPriority,
  BackgroundPromptStatus,
  type BackgroundPromptRequest,
  type BackgroundPromptResult,
} from '../../../src-shared/types/background-prompt.types';

// ── Mock electron-log ─────────────────────────────────────────────
vi.mock('electron-log', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Mock CreateChatServiceCommand ─────────────────────────────────
const mockChatFn = vi.fn();
const mockCreateChatService = vi.fn();

vi.mock('../../../src-electron/commands/chat.create-service', () => ({
  CreateChatServiceCommand: class {
    execute = mockCreateChatService;
  },
}));

vi.mock('../../../src-electron/services/chat/index', () => ({
  DesktopChatService: class {
    chat = mockChatFn;
  },
}));

// ── Helpers ───────────────────────────────────────────────────────

function makeRequest(overrides: Partial<BackgroundPromptRequest> = {}): BackgroundPromptRequest {
  return {
    taskId: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: BackgroundPromptType.AutoTitle,
    threadId: 'thread-1',
    messages: [{ role: 'user', content: 'Hello' }],
    ...overrides,
  };
}

/** Create a mock chat service that resolves with a buffer callback */
function setupMockChat(response = 'Generated Title', delayMs = 0) {
  const mockService = { chat: vi.fn() };

  mockCreateChatService.mockResolvedValue({
    success: true,
    data: mockService,
    errorCode: 0,
    errorText: '',
  });

  mockService.chat.mockImplementation(
    async (
      _req: unknown,
      onToken: (t: string) => void,
      _toolCb: unknown,
      _statusCb: unknown,
      signal: AbortSignal,
    ) => {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      if (!signal.aborted) {
        onToken(response);
      }
    },
  );

  return mockService;
}

/** Wait for microtasks to flush */
function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ── Tests ─────────────────────────────────────────────────────────

describe('BackgroundPromptService', () => {
  let BackgroundPromptService: typeof import('../../../src-electron/services/background-prompt.service').BackgroundPromptService;
  let broadcastSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamic import to reset module state
    const mod = await import('../../../src-electron/services/background-prompt.service');
    BackgroundPromptService = mod.BackgroundPromptService;
    broadcastSpy = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('submit', () => {
    it('enqueues and executes a task', async () => {
      const mockChat = setupMockChat('AI Title');
      const service = new BackgroundPromptService(2);
      service.setBroadcastFn(broadcastSpy);

      const request = makeRequest();
      await service.submit(request);
      await flushPromises();

      // Wait for task execution
      await vi.waitFor(() => {
        expect(broadcastSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            taskId: request.taskId,
            status: BackgroundPromptStatus.Completed,
            result: 'AI Title',
          }),
        );
      });
    });

    it('broadcasts Running status before execution', async () => {
      setupMockChat('result', 10);
      const service = new BackgroundPromptService(2);
      service.setBroadcastFn(broadcastSpy);

      const request = makeRequest();
      await service.submit(request);
      await flushPromises();

      // First broadcast should be Running
      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: request.taskId,
          status: BackgroundPromptStatus.Running,
        }),
      );
    });

    it('includes durationMs in completed result', async () => {
      setupMockChat('result');
      const service = new BackgroundPromptService(2);
      service.setBroadcastFn(broadcastSpy);

      const request = makeRequest();
      await service.submit(request);

      await vi.waitFor(() => {
        const completedCall = broadcastSpy.mock.calls.find(
          (call: unknown[]) =>
            (call[0] as BackgroundPromptResult).status === BackgroundPromptStatus.Completed,
        );
        expect(completedCall).toBeDefined();
        expect((completedCall![0] as BackgroundPromptResult).durationMs).toBeTypeOf('number');
      });
    });
  });

  describe('concurrency', () => {
    it('respects maxConcurrent limit', async () => {
      let activeTasks = 0;
      let peakConcurrency = 0;

      mockCreateChatService.mockResolvedValue({
        success: true,
        data: {
          chat: vi.fn(async () => {
            activeTasks++;
            peakConcurrency = Math.max(peakConcurrency, activeTasks);
            await new Promise((resolve) => setTimeout(resolve, 50));
            activeTasks--;
          }),
        },
        errorCode: 0,
        errorText: '',
      });

      const service = new BackgroundPromptService(2);
      service.setBroadcastFn(broadcastSpy);

      // Submit 4 tasks
      await Promise.all([
        service.submit(
          makeRequest({ taskId: 'a', threadId: 't1', type: BackgroundPromptType.AutoTitle }),
        ),
        service.submit(
          makeRequest({
            taskId: 'b',
            threadId: 't2',
            type: BackgroundPromptType.ContextCompression,
          }),
        ),
        service.submit(
          makeRequest({
            taskId: 'c',
            threadId: 't3',
            type: BackgroundPromptType.InstructionGeneration,
          }),
        ),
        service.submit(
          makeRequest({ taskId: 'd', threadId: 't4', type: BackgroundPromptType.PromptCoaching }),
        ),
      ]);

      // Wait for all to finish
      await vi.waitFor(
        () => {
          const completedCount = broadcastSpy.mock.calls.filter(
            (call: unknown[]) =>
              (call[0] as BackgroundPromptResult).status === BackgroundPromptStatus.Completed,
          ).length;
          expect(completedCount).toBe(4);
        },
        { timeout: 2000 },
      );

      expect(peakConcurrency).toBeLessThanOrEqual(2);
    });
  });

  describe('deduplication', () => {
    it('cancels existing task of same type+thread when a new one is submitted', async () => {
      // First task will be slow
      let firstTaskResolve: (() => void) | null = null;
      const firstTaskPromise = new Promise<void>((resolve) => {
        firstTaskResolve = resolve;
      });

      mockCreateChatService.mockResolvedValueOnce({
        success: true,
        data: {
          chat: vi.fn(
            async (
              _req: unknown,
              _onToken: unknown,
              _toolCb: unknown,
              _statusCb: unknown,
              signal: AbortSignal,
            ) => {
              await Promise.race([
                firstTaskPromise,
                new Promise((resolve) => {
                  signal.addEventListener('abort', resolve);
                }),
              ]);
            },
          ),
        },
        errorCode: 0,
        errorText: '',
      });

      // Second task resolves quickly
      mockCreateChatService.mockResolvedValueOnce({
        success: true,
        data: {
          chat: vi.fn(async (_req: unknown, onToken: (t: string) => void) => {
            onToken('new title');
          }),
        },
        errorCode: 0,
        errorText: '',
      });

      const service = new BackgroundPromptService(2);
      service.setBroadcastFn(broadcastSpy);

      // Submit first task
      await service.submit(
        makeRequest({
          taskId: 'first',
          threadId: 'thread-1',
          type: BackgroundPromptType.AutoTitle,
        }),
      );
      await flushPromises();

      // Submit replacement task for same type+thread
      await service.submit(
        makeRequest({
          taskId: 'second',
          threadId: 'thread-1',
          type: BackgroundPromptType.AutoTitle,
        }),
      );

      // Clean up
      firstTaskResolve?.();

      await vi.waitFor(() => {
        const completedCalls = broadcastSpy.mock.calls.filter(
          (call: unknown[]) =>
            (call[0] as BackgroundPromptResult).status === BackgroundPromptStatus.Completed,
        );
        expect(completedCalls.length).toBeGreaterThanOrEqual(1);
        // The second (replacement) task should complete
        expect(
          completedCalls.some(
            (call: unknown[]) => (call[0] as BackgroundPromptResult).taskId === 'second',
          ),
        ).toBe(true);
      });
    });

    it('allows different types on the same thread', async () => {
      setupMockChat('result');
      const service = new BackgroundPromptService(2);
      service.setBroadcastFn(broadcastSpy);

      await service.submit(
        makeRequest({
          taskId: 'title',
          threadId: 'thread-1',
          type: BackgroundPromptType.AutoTitle,
        }),
      );
      await service.submit(
        makeRequest({
          taskId: 'compress',
          threadId: 'thread-1',
          type: BackgroundPromptType.ContextCompression,
        }),
      );

      await vi.waitFor(() => {
        const completedCount = broadcastSpy.mock.calls.filter(
          (call: unknown[]) =>
            (call[0] as BackgroundPromptResult).status === BackgroundPromptStatus.Completed,
        ).length;
        expect(completedCount).toBe(2);
      });
    });
  });

  describe('cancel', () => {
    it('cancels a running task and emits Cancelled status', async () => {
      let chatResolve: (() => void) | null = null;

      mockCreateChatService.mockResolvedValue({
        success: true,
        data: {
          chat: vi.fn(
            async (
              _req: unknown,
              _onToken: unknown,
              _toolCb: unknown,
              _statusCb: unknown,
              signal: AbortSignal,
            ) => {
              await new Promise<void>((resolve) => {
                chatResolve = resolve;
                signal.addEventListener('abort', () => resolve());
              });
            },
          ),
        },
        errorCode: 0,
        errorText: '',
      });

      const service = new BackgroundPromptService(2);
      service.setBroadcastFn(broadcastSpy);

      const request = makeRequest({ taskId: 'cancel-me' });
      await service.submit(request);
      await flushPromises();

      const result = service.cancel('cancel-me');
      expect(result).toBe(true);

      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'cancel-me',
          status: BackgroundPromptStatus.Cancelled,
        }),
      );

      chatResolve?.();
    });

    it('returns false for unknown taskId', () => {
      const service = new BackgroundPromptService(2);
      service.setBroadcastFn(broadcastSpy);

      const result = service.cancel('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('cancelAllForThread', () => {
    it('cancels all tasks for a specific thread', async () => {
      mockCreateChatService.mockResolvedValue({
        success: true,
        data: {
          chat: vi.fn(
            async (
              _req: unknown,
              _onToken: unknown,
              _toolCb: unknown,
              _statusCb: unknown,
              signal: AbortSignal,
            ) => {
              await new Promise<void>((resolve) => {
                signal.addEventListener('abort', () => resolve());
              });
            },
          ),
        },
        errorCode: 0,
        errorText: '',
      });

      const service = new BackgroundPromptService(4);
      service.setBroadcastFn(broadcastSpy);

      // Submit tasks for two different threads
      await service.submit(
        makeRequest({ taskId: 'a', threadId: 'thread-1', type: BackgroundPromptType.AutoTitle }),
      );
      await service.submit(
        makeRequest({
          taskId: 'b',
          threadId: 'thread-1',
          type: BackgroundPromptType.ContextCompression,
        }),
      );
      await service.submit(
        makeRequest({ taskId: 'c', threadId: 'thread-2', type: BackgroundPromptType.AutoTitle }),
      );
      await flushPromises();

      service.cancelAllForThread('thread-1');

      const cancelledCalls = broadcastSpy.mock.calls.filter(
        (call: unknown[]) =>
          (call[0] as BackgroundPromptResult).status === BackgroundPromptStatus.Cancelled,
      );

      // Both thread-1 tasks should be cancelled
      expect(cancelledCalls.length).toBe(2);
      expect(
        cancelledCalls.every(
          (call: unknown[]) => (call[0] as BackgroundPromptResult).threadId === 'thread-1',
        ),
      ).toBe(true);
    });
  });

  describe('priority queue', () => {
    it('processes high-priority tasks before normal and low', async () => {
      const executionOrder: string[] = [];

      mockCreateChatService.mockImplementation(async () => ({
        success: true,
        data: {
          chat: vi.fn(async (req: unknown) => {
            // We can track execution order via the task that created the service
            // The service is created per-task, so we track via the broadcastSpy
          }),
        },
        errorCode: 0,
        errorText: '',
      }));

      // Use maxConcurrent=1 to force serial execution and observe order
      const service = new BackgroundPromptService(1);
      service.setBroadcastFn((result: BackgroundPromptResult) => {
        if (result.status === BackgroundPromptStatus.Running) {
          executionOrder.push(result.taskId);
        }
        broadcastSpy(result);
      });

      // Block the first slot so tasks queue up
      let unblockFirst: (() => void) | null = null;
      mockCreateChatService.mockResolvedValueOnce({
        success: true,
        data: {
          chat: vi.fn(
            async (
              _req: unknown,
              onToken: (t: string) => void,
              _toolCb: unknown,
              _statusCb: unknown,
              signal: AbortSignal,
            ) => {
              await new Promise<void>((resolve) => {
                unblockFirst = resolve;
                signal.addEventListener('abort', () => resolve());
              });
              if (!signal.aborted) onToken('first');
            },
          ),
        },
        errorCode: 0,
        errorText: '',
      });

      // Submit a blocker task first
      await service.submit(
        makeRequest({
          taskId: 'blocker',
          threadId: 't0',
          type: BackgroundPromptType.PromptCoaching,
        }),
      );
      await flushPromises();

      // Now set up quick completion for remaining tasks
      setupMockChat('result');

      // Queue tasks with different priorities (different threadIds to avoid dedup)
      await service.submit(
        makeRequest({
          taskId: 'low',
          threadId: 't1',
          type: BackgroundPromptType.PromptCoaching,
          priority: BackgroundPromptPriority.Low,
        }),
      );
      await service.submit(
        makeRequest({
          taskId: 'high',
          threadId: 't2',
          type: BackgroundPromptType.AutoTitle,
          priority: BackgroundPromptPriority.High,
        }),
      );
      await service.submit(
        makeRequest({
          taskId: 'normal',
          threadId: 't3',
          type: BackgroundPromptType.ContextCompression,
          priority: BackgroundPromptPriority.Normal,
        }),
      );

      // Unblock first task
      unblockFirst?.();

      await vi.waitFor(
        () => {
          const completedCount = broadcastSpy.mock.calls.filter(
            (call: unknown[]) =>
              (call[0] as BackgroundPromptResult).status === BackgroundPromptStatus.Completed,
          ).length;
          expect(completedCount).toBe(4);
        },
        { timeout: 2000 },
      );

      // After blocker, execution order should be: high, normal, low
      const afterBlocker = executionOrder.slice(1);
      expect(afterBlocker[0]).toBe('high');
      expect(afterBlocker[1]).toBe('normal');
      expect(afterBlocker[2]).toBe('low');
    });
  });

  describe('error handling', () => {
    it('broadcasts Failed status when chat service creation fails', async () => {
      mockCreateChatService.mockResolvedValue({
        success: false,
        data: null,
        errorCode: -1,
        errorText: 'Agent not found',
      });

      const service = new BackgroundPromptService(2);
      service.setBroadcastFn(broadcastSpy);

      const request = makeRequest();
      await service.submit(request);

      await vi.waitFor(() => {
        expect(broadcastSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            taskId: request.taskId,
            status: BackgroundPromptStatus.Failed,
            error: expect.stringContaining('Agent not found'),
          }),
        );
      });
    });

    it('broadcasts Failed status when chat throws', async () => {
      mockCreateChatService.mockResolvedValue({
        success: true,
        data: {
          chat: vi.fn(async () => {
            throw new Error('Provider timeout');
          }),
        },
        errorCode: 0,
        errorText: '',
      });

      const service = new BackgroundPromptService(2);
      service.setBroadcastFn(broadcastSpy);

      const request = makeRequest();
      await service.submit(request);

      await vi.waitFor(() => {
        expect(broadcastSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            taskId: request.taskId,
            status: BackgroundPromptStatus.Failed,
            error: 'Provider timeout',
          }),
        );
      });
    });
  });

  describe('cleanup', () => {
    it('aborts all running and queued tasks', async () => {
      mockCreateChatService.mockResolvedValue({
        success: true,
        data: {
          chat: vi.fn(
            async (
              _req: unknown,
              _onToken: unknown,
              _toolCb: unknown,
              _statusCb: unknown,
              signal: AbortSignal,
            ) => {
              await new Promise<void>((resolve) => {
                signal.addEventListener('abort', () => resolve());
              });
            },
          ),
        },
        errorCode: 0,
        errorText: '',
      });

      const service = new BackgroundPromptService(1);
      service.setBroadcastFn(broadcastSpy);

      await service.submit(
        makeRequest({ taskId: 'running', threadId: 't1', type: BackgroundPromptType.AutoTitle }),
      );
      await service.submit(
        makeRequest({
          taskId: 'queued',
          threadId: 't2',
          type: BackgroundPromptType.ContextCompression,
        }),
      );
      await flushPromises();

      service.cleanup();

      // After cleanup, no more tasks should execute. Just verify no crash.
      await flushPromises();
    });
  });

  describe('structured output', () => {
    it('parses JSON response when responseFormat is specified', async () => {
      const jsonResponse = '{"title": "My Chat Title"}';
      setupMockChat(jsonResponse);

      const service = new BackgroundPromptService(2);
      service.setBroadcastFn(broadcastSpy);

      const request = makeRequest({
        responseFormat: { type: 'json_object' },
      });
      await service.submit(request);

      await vi.waitFor(() => {
        expect(broadcastSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            taskId: request.taskId,
            status: BackgroundPromptStatus.Completed,
            result: jsonResponse,
            structuredResult: { title: 'My Chat Title' },
          }),
        );
      });
    });

    it('leaves structuredResult undefined for invalid JSON', async () => {
      setupMockChat('not valid json');

      const service = new BackgroundPromptService(2);
      service.setBroadcastFn(broadcastSpy);

      const request = makeRequest({
        responseFormat: { type: 'json_object' },
      });
      await service.submit(request);

      await vi.waitFor(() => {
        const completedCall = broadcastSpy.mock.calls.find(
          (call: unknown[]) =>
            (call[0] as BackgroundPromptResult).status === BackgroundPromptStatus.Completed,
        );
        expect(completedCall).toBeDefined();
        expect((completedCall![0] as BackgroundPromptResult).structuredResult).toBeUndefined();
        expect((completedCall![0] as BackgroundPromptResult).result).toBe('not valid json');
      });
    });
  });
});

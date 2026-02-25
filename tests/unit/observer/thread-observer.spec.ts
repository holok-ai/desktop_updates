import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { ThreadObserver } from '$lib/observer/thread-observer';
import { observerStore } from '$lib/observer/observer.store';
import { ObserverTaskType } from '../../../src-shared/types/observer.types';
import type { ObserverTask, ObserverThread } from '$lib/observer/observer-task.interface';
import type { Message } from '$lib/types/thread.type';

// Helper to create a minimal thread
function makeThread(overrides: Partial<ObserverThread> = {}): ObserverThread {
  return {
    id: 'thread-1',
    title: '',
    messages: [],
    ...overrides,
  };
}

// Helper to create a minimal message
function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    threadId: 'thread-1',
    branchId: '1.0.0',
    role: 'user',
    content: 'Hello',
    createdAt: Date.now(),
    guardExecution: 'none',
    guardMessageId: null,
    guardError: '',
    ...overrides,
  };
}

// Helper to create a mock task
function makeMockTask(
  taskType: ObserverTaskType,
  shouldRunResult = true,
): ObserverTask & { shouldRun: Mock; buildRequest: Mock; onResult: Mock; onError: Mock } {
  return {
    taskType,
    shouldRun: vi.fn().mockReturnValue(shouldRunResult),
    buildRequest: vi.fn().mockReturnValue({
      taskType,
      threadId: 'thread-1',
      messages: [],
      maxTokens: 100,
    }),
    onResult: vi.fn(),
    onError: vi.fn(),
  };
}

describe('ThreadObserver', () => {
  beforeEach(() => {
    // Reset singleton between tests

    (ThreadObserver as any).instance = undefined;
    observerStore.reset();

    // Reset window.electronAPI mock

    (globalThis as any).window = {
      electronAPI: {
        chat: {
          background: vi.fn().mockResolvedValue({ success: true, data: 'mock response' }),
        },
      },
    };
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const a = ThreadObserver.getInstance();
      const b = ThreadObserver.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('register', () => {
    it('should register a task that gets evaluated on observe', () => {
      const observer = ThreadObserver.getInstance();
      const task = makeMockTask(ObserverTaskType.RenameTitle, false);
      observer.register(task);

      const thread = makeThread();
      const messages = [makeMessage()];
      observer.observe(thread, messages);

      expect(task.shouldRun).toHaveBeenCalledWith(thread, messages);
    });
  });

  describe('observe', () => {
    it('should evaluate all registered tasks', () => {
      const observer = ThreadObserver.getInstance();
      const task1 = makeMockTask(ObserverTaskType.RenameTitle, false);
      const task2 = makeMockTask(ObserverTaskType.SuggestPrompt, false);
      observer.register(task1);
      observer.register(task2);

      const thread = makeThread();
      const messages = [makeMessage()];
      observer.observe(thread, messages);

      expect(task1.shouldRun).toHaveBeenCalledOnce();
      expect(task2.shouldRun).toHaveBeenCalledOnce();
    });

    it('should not call buildRequest when shouldRun returns false', () => {
      const observer = ThreadObserver.getInstance();
      const task = makeMockTask(ObserverTaskType.RenameTitle, false);
      observer.register(task);

      observer.observe(makeThread(), [makeMessage()]);

      expect(task.buildRequest).not.toHaveBeenCalled();
    });

    it('should call buildRequest when shouldRun returns true', async () => {
      const observer = ThreadObserver.getInstance();
      const task = makeMockTask(ObserverTaskType.RenameTitle, true);
      observer.register(task);

      const thread = makeThread();
      const messages = [makeMessage()];
      observer.observe(thread, messages);

      // Allow executeTask promise to resolve
      await vi.waitFor(() => {
        expect(task.buildRequest).toHaveBeenCalledWith(thread, messages);
      });
    });

    it('should call onResult when background chat succeeds', async () => {
      const observer = ThreadObserver.getInstance();
      const task = makeMockTask(ObserverTaskType.RenameTitle, true);
      observer.register(task);

      observer.observe(makeThread(), [makeMessage()]);

      await vi.waitFor(() => {
        expect(task.onResult).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'thread-1' }),
          'mock response',
        );
      });
    });

    it('should call onError when background chat returns failure', async () => {
      (globalThis as any).window.electronAPI.chat.background = vi
        .fn()
        .mockResolvedValue({ success: false, errorCode: -1, errorText: 'Chat failed' });

      const observer = ThreadObserver.getInstance();
      const task = makeMockTask(ObserverTaskType.RenameTitle, true);
      observer.register(task);

      observer.observe(makeThread(), [makeMessage()]);

      await vi.waitFor(() => {
        expect(task.onError).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'thread-1' }),
          'Chat failed',
        );
      });
    });

    it('should call onError when background chat throws', async () => {
      (globalThis as any).window.electronAPI.chat.background = vi
        .fn()
        .mockRejectedValue(new Error('Network error'));

      const observer = ThreadObserver.getInstance();
      const task = makeMockTask(ObserverTaskType.RenameTitle, true);
      observer.register(task);

      observer.observe(makeThread(), [makeMessage()]);

      await vi.waitFor(() => {
        expect(task.onError).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'thread-1' }),
          'Network error',
        );
      });
    });
  });

  describe('deduplication', () => {
    it('should skip a task that is already active for the same thread+type', async () => {
      // Use a promise we control to keep the first task "in flight"
      let resolveFirst!: (value: unknown) => void;
      const firstCallPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      (globalThis as any).window.electronAPI.chat.background = vi
        .fn()
        .mockReturnValueOnce(firstCallPromise)
        .mockResolvedValueOnce({ success: true, data: 'second' });

      const observer = ThreadObserver.getInstance();
      const task = makeMockTask(ObserverTaskType.RenameTitle, true);
      observer.register(task);

      const thread = makeThread();
      const messages = [makeMessage()];

      // First observe — starts executing the task
      observer.observe(thread, messages);

      // Second observe — should be deduped (task still in flight)
      observer.observe(thread, messages);

      // Dedup check happens before shouldRun, so shouldRun is only called once
      // (first observe calls shouldRun → true → executes; second observe skips at dedup)
      expect(task.shouldRun).toHaveBeenCalledTimes(1);
      expect(task.buildRequest).toHaveBeenCalledTimes(1);

      // Resolve the first call to clean up
      resolveFirst({ success: true, data: 'first' });

      await vi.waitFor(() => {
        expect(task.onResult).toHaveBeenCalledTimes(1);
      });
    });

    it('should allow the same task to run again after completion', async () => {
      const observer = ThreadObserver.getInstance();
      const task = makeMockTask(ObserverTaskType.RenameTitle, true);
      observer.register(task);

      const thread = makeThread();
      const messages = [makeMessage()];

      // First observe
      observer.observe(thread, messages);

      await vi.waitFor(() => {
        expect(task.onResult).toHaveBeenCalledTimes(1);
      });

      // Second observe — task has completed, should run again
      observer.observe(thread, messages);

      await vi.waitFor(() => {
        expect(task.onResult).toHaveBeenCalledTimes(2);
      });
    });

    it('should allow the same task type on different threads', async () => {
      const observer = ThreadObserver.getInstance();
      const task = makeMockTask(ObserverTaskType.RenameTitle, true);
      observer.register(task);

      const thread1 = makeThread({ id: 'thread-1' });
      const thread2 = makeThread({ id: 'thread-2' });
      const messages = [makeMessage()];

      observer.observe(thread1, messages);
      observer.observe(thread2, messages);

      await vi.waitFor(() => {
        expect(task.buildRequest).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('capacity limit', () => {
    it('should stop submitting tasks when MAX_Q_LENGTH is reached', () => {
      const observer = ThreadObserver.getInstance();

      // Create tasks that never resolve (to keep them "in flight")

      (globalThis as any).window.electronAPI.chat.background = vi
        .fn()
        .mockReturnValue(new Promise(() => {})); // Never resolves

      // Register 11 tasks with different types — we only have 3 ObserverTaskType values
      // So instead, use different threads to fill the queue
      const task = makeMockTask(ObserverTaskType.RenameTitle, true);
      observer.register(task);

      const messages = [makeMessage()];

      // Submit 10 (at the MAX_Q_LENGTH limit)
      for (let i = 0; i < 10; i++) {
        observer.observe(makeThread({ id: `thread-${i}` }), messages);
      }

      expect(task.buildRequest).toHaveBeenCalledTimes(10);

      // 11th should be skipped — at capacity
      observer.observe(makeThread({ id: 'thread-10' }), messages);
      expect(task.buildRequest).toHaveBeenCalledTimes(10);
    });
  });

  describe('observer store integration', () => {
    it('should set running state when task starts and clear when done', async () => {
      const observer = ThreadObserver.getInstance();
      const task = makeMockTask(ObserverTaskType.RenameTitle, true);
      observer.register(task);

      observer.observe(makeThread(), [makeMessage()]);

      await vi.waitFor(() => {
        expect(task.onResult).toHaveBeenCalled();
      });

      // After completion, running should be cleared
      let state: unknown;
      const unsub = observerStore.subscribe((s) => {
        state = s;
      });

      const running = (state as any).running.get('thread-1');
      // Should either be undefined or an empty set (running cleared)
      expect(running === undefined || running.size === 0).toBe(true);
      unsub();
    });
  });

  describe('electronAPI unavailable', () => {
    it('should not throw when electronAPI is not available', () => {
      (globalThis as any).window = {};

      const observer = ThreadObserver.getInstance();
      const task = makeMockTask(ObserverTaskType.RenameTitle, true);
      observer.register(task);

      // Should not throw
      expect(() => {
        observer.observe(makeThread(), [makeMessage()]);
      }).not.toThrow();
    });
  });
});

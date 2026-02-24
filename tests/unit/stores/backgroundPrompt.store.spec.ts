/**
 * backgroundPrompt.store Tests
 *
 * Tests the renderer-side store: state management, handleResult,
 * pending actions, derived stores, and cleanup.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  BackgroundPromptType,
  BackgroundPromptStatus,
  type BackgroundPromptResult,
} from '../../../src-shared/types/background-prompt.types';

// ── Mock window.electronAPI ──────────────────────────────────────
const mockSubmit = vi.fn().mockResolvedValue({ success: true });
const mockCancel = vi.fn().mockResolvedValue({ success: true });
const mockOnResult = vi.fn().mockReturnValue(() => {});

vi.stubGlobal('window', {
  ...globalThis.window,
  electronAPI: {
    bgprompt: {
      submit: mockSubmit,
      cancel: mockCancel,
      cancelAllForThread: vi.fn(),
      onResult: mockOnResult,
    },
  },
});

// Import after mocking window
import {
  backgroundPromptStore,
  isThreadRunningBgTasks,
  pendingAutoTitle,
  initBackgroundPromptListeners,
} from '../../../src/lib/stores/backgroundPrompt.store';

// ── Helpers ───────────────────────────────────────────────────────

function makeResult(overrides: Partial<BackgroundPromptResult> = {}): BackgroundPromptResult {
  return {
    taskId: 'task-1',
    type: BackgroundPromptType.AutoTitle,
    threadId: 'thread-1',
    status: BackgroundPromptStatus.Completed,
    result: 'Generated Title',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('backgroundPrompt.store', () => {
  beforeEach(() => {
    backgroundPromptStore.reset();
    vi.clearAllMocks();
  });

  describe('handleResult', () => {
    it('adds a Running task to tasks and runningByThread', () => {
      backgroundPromptStore.handleResult(makeResult({ status: BackgroundPromptStatus.Running }));

      const state = get(backgroundPromptStore);
      expect(state.tasks.has('task-1')).toBe(true);
      expect(state.runningByThread.get('thread-1')?.has('task-1')).toBe(true);
      expect(state.pendingActions.has('task-1')).toBe(false);
    });

    it('moves a Completed task from running to pendingActions', () => {
      // First set as running
      backgroundPromptStore.handleResult(makeResult({ status: BackgroundPromptStatus.Running }));

      // Then complete
      backgroundPromptStore.handleResult(makeResult({ status: BackgroundPromptStatus.Completed }));

      const state = get(backgroundPromptStore);
      expect(state.pendingActions.has('task-1')).toBe(true);
      expect(state.runningByThread.get('thread-1')).toBeUndefined();
    });

    it('does not add Failed tasks to pendingActions', () => {
      backgroundPromptStore.handleResult(makeResult({ status: BackgroundPromptStatus.Running }));

      backgroundPromptStore.handleResult(
        makeResult({ status: BackgroundPromptStatus.Failed, error: 'timeout' }),
      );

      const state = get(backgroundPromptStore);
      expect(state.pendingActions.has('task-1')).toBe(false);
      expect(state.tasks.has('task-1')).toBe(true);
    });

    it('does not add Cancelled tasks to pendingActions', () => {
      backgroundPromptStore.handleResult(makeResult({ status: BackgroundPromptStatus.Running }));

      backgroundPromptStore.handleResult(makeResult({ status: BackgroundPromptStatus.Cancelled }));

      const state = get(backgroundPromptStore);
      expect(state.pendingActions.has('task-1')).toBe(false);
    });

    it('replaces previous InstructionGeneration pending result for same thread', () => {
      // First instruction generation completes
      backgroundPromptStore.handleResult(
        makeResult({
          taskId: 'instr-1',
          type: BackgroundPromptType.InstructionGeneration,
          status: BackgroundPromptStatus.Completed,
          result: 'First instructions',
        }),
      );

      // Second instruction generation completes for same thread
      backgroundPromptStore.handleResult(
        makeResult({
          taskId: 'instr-2',
          type: BackgroundPromptType.InstructionGeneration,
          status: BackgroundPromptStatus.Completed,
          result: 'Updated instructions',
        }),
      );

      const state = get(backgroundPromptStore);
      // Only the latest should be pending
      expect(state.pendingActions.has('instr-1')).toBe(false);
      expect(state.pendingActions.has('instr-2')).toBe(true);
      // Old task should also be removed from tasks map
      expect(state.tasks.has('instr-1')).toBe(false);
    });

    it('does NOT replace pending results for different types', () => {
      backgroundPromptStore.handleResult(
        makeResult({
          taskId: 'title-1',
          type: BackgroundPromptType.AutoTitle,
          status: BackgroundPromptStatus.Completed,
        }),
      );

      backgroundPromptStore.handleResult(
        makeResult({
          taskId: 'coaching-1',
          type: BackgroundPromptType.PromptCoaching,
          status: BackgroundPromptStatus.Completed,
        }),
      );

      const state = get(backgroundPromptStore);
      expect(state.pendingActions.has('title-1')).toBe(true);
      expect(state.pendingActions.has('coaching-1')).toBe(true);
    });
  });

  describe('dismiss', () => {
    it('removes task from both pendingActions and tasks', () => {
      backgroundPromptStore.handleResult(makeResult({ status: BackgroundPromptStatus.Completed }));

      backgroundPromptStore.dismiss('task-1');

      const state = get(backgroundPromptStore);
      expect(state.pendingActions.has('task-1')).toBe(false);
      expect(state.tasks.has('task-1')).toBe(false);
    });
  });

  describe('accept', () => {
    it('removes task from pendingActions but keeps in tasks', () => {
      backgroundPromptStore.handleResult(makeResult({ status: BackgroundPromptStatus.Completed }));

      backgroundPromptStore.accept('task-1');

      const state = get(backgroundPromptStore);
      expect(state.pendingActions.has('task-1')).toBe(false);
      // Task remains in the tasks map
      expect(state.tasks.has('task-1')).toBe(true);
    });
  });

  describe('getPendingForThread', () => {
    it('returns only pending results for the specified thread', () => {
      backgroundPromptStore.handleResult(
        makeResult({ taskId: 'a', threadId: 'thread-1', status: BackgroundPromptStatus.Completed }),
      );
      backgroundPromptStore.handleResult(
        makeResult({ taskId: 'b', threadId: 'thread-2', status: BackgroundPromptStatus.Completed }),
      );
      backgroundPromptStore.handleResult(
        makeResult({
          taskId: 'c',
          threadId: 'thread-1',
          type: BackgroundPromptType.PromptCoaching,
          status: BackgroundPromptStatus.Completed,
        }),
      );

      const results = backgroundPromptStore.getPendingForThread('thread-1');
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.threadId === 'thread-1')).toBe(true);
    });

    it('returns empty array when no pending results exist', () => {
      const results = backgroundPromptStore.getPendingForThread('thread-1');
      expect(results).toEqual([]);
    });
  });

  describe('getPendingByType', () => {
    it('returns the pending result matching thread and type', () => {
      backgroundPromptStore.handleResult(
        makeResult({
          taskId: 'title-1',
          threadId: 'thread-1',
          type: BackgroundPromptType.AutoTitle,
          status: BackgroundPromptStatus.Completed,
          result: 'My Title',
        }),
      );

      const result = backgroundPromptStore.getPendingByType(
        'thread-1',
        BackgroundPromptType.AutoTitle,
      );
      expect(result).toBeDefined();
      expect(result!.taskId).toBe('title-1');
      expect(result!.result).toBe('My Title');
    });

    it('returns undefined when no match exists', () => {
      const result = backgroundPromptStore.getPendingByType(
        'thread-1',
        BackgroundPromptType.AutoTitle,
      );
      expect(result).toBeUndefined();
    });
  });

  describe('isRunningForThread', () => {
    it('returns true when tasks are running for the thread', () => {
      backgroundPromptStore.handleResult(makeResult({ status: BackgroundPromptStatus.Running }));

      expect(backgroundPromptStore.isRunningForThread('thread-1')).toBe(true);
    });

    it('returns false when no tasks are running', () => {
      expect(backgroundPromptStore.isRunningForThread('thread-1')).toBe(false);
    });

    it('returns false after running task completes', () => {
      backgroundPromptStore.handleResult(makeResult({ status: BackgroundPromptStatus.Running }));

      backgroundPromptStore.handleResult(makeResult({ status: BackgroundPromptStatus.Completed }));

      expect(backgroundPromptStore.isRunningForThread('thread-1')).toBe(false);
    });
  });

  describe('reset', () => {
    it('clears all state', () => {
      backgroundPromptStore.handleResult(makeResult({ status: BackgroundPromptStatus.Running }));
      backgroundPromptStore.handleResult(
        makeResult({ taskId: 'task-2', status: BackgroundPromptStatus.Completed }),
      );

      backgroundPromptStore.reset();

      const state = get(backgroundPromptStore);
      expect(state.tasks.size).toBe(0);
      expect(state.pendingActions.size).toBe(0);
      expect(state.runningByThread.size).toBe(0);
    });
  });

  describe('derived stores', () => {
    describe('isThreadRunningBgTasks', () => {
      it('returns a function that checks running state', () => {
        backgroundPromptStore.handleResult(makeResult({ status: BackgroundPromptStatus.Running }));

        const fn = get(isThreadRunningBgTasks);
        expect(fn('thread-1')).toBe(true);
        expect(fn('thread-2')).toBe(false);
      });
    });

    describe('pendingAutoTitle', () => {
      it('returns completed auto-title result for thread', () => {
        backgroundPromptStore.handleResult(
          makeResult({
            type: BackgroundPromptType.AutoTitle,
            status: BackgroundPromptStatus.Completed,
            result: 'AI Generated Title',
          }),
        );

        const fn = get(pendingAutoTitle);
        const result = fn('thread-1');
        expect(result).toBeDefined();
        expect(result!.result).toBe('AI Generated Title');
      });

      it('returns undefined for non-matching thread', () => {
        backgroundPromptStore.handleResult(
          makeResult({
            type: BackgroundPromptType.AutoTitle,
            status: BackgroundPromptStatus.Completed,
          }),
        );

        const fn = get(pendingAutoTitle);
        expect(fn('thread-other')).toBeUndefined();
      });

      it('returns undefined for non-AutoTitle types', () => {
        backgroundPromptStore.handleResult(
          makeResult({
            type: BackgroundPromptType.PromptCoaching,
            status: BackgroundPromptStatus.Completed,
          }),
        );

        const fn = get(pendingAutoTitle);
        expect(fn('thread-1')).toBeUndefined();
      });
    });
  });

  describe('initBackgroundPromptListeners', () => {
    it('subscribes to bgprompt.onResult', () => {
      mockOnResult.mockClear();

      initBackgroundPromptListeners();

      expect(mockOnResult).toHaveBeenCalledOnce();
      expect(typeof mockOnResult.mock.calls[0][0]).toBe('function');
    });
  });
});

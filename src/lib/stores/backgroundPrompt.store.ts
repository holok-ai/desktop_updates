/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import { writable, derived, type Readable } from 'svelte/store';
import {
  BackgroundPromptStatus,
  BackgroundPromptType,
  type BackgroundPromptRequest,
  type BackgroundPromptResult,
} from '../../../src-shared/types/background-prompt.types';

/**
 * Background Prompt Store
 *
 * Manages state for background AI prompt tasks. Tracks active/completed tasks,
 * pending user actions (keep/discard), and running state per thread.
 *
 * Follows the pattern established by titleGeneration.store.ts.
 */

interface BackgroundPromptState {
  /** All active/completed tasks by taskId */
  tasks: Map<string, BackgroundPromptResult>;
  /** Tasks awaiting user decision (keep/discard/apply) by taskId */
  pendingActions: Map<string, BackgroundPromptResult>;
  /** Running task IDs by threadId for quick lookups */
  runningByThread: Map<string, Set<string>>;
}

interface BackgroundPromptStore {
  subscribe: (run: (value: BackgroundPromptState) => void) => () => void;
  /** Submit a background prompt task via IPC */
  submit: (request: BackgroundPromptRequest) => Promise<void>;
  /** Cancel a specific task by taskId */
  cancel: (taskId: string) => Promise<void>;
  /** Dismiss a pending action result (user chose to discard) */
  dismiss: (taskId: string) => void;
  /** Accept a pending action result (user chose to keep) */
  accept: (taskId: string) => void;
  /** Get all pending results for a specific thread */
  getPendingForThread: (threadId: string) => BackgroundPromptResult[];
  /** Get pending results for a thread filtered by type */
  getPendingByType: (
    threadId: string,
    type: BackgroundPromptType,
  ) => BackgroundPromptResult | undefined;
  /** Check if any tasks are running for a thread */
  isRunningForThread: (threadId: string) => boolean;
  /** Handle a result from the main process (called by the renderer service) */
  handleResult: (result: BackgroundPromptResult) => void;
  /** Reset all state */
  reset: () => void;
}

function createBackgroundPromptStore(): BackgroundPromptStore {
  const initialState: BackgroundPromptState = {
    tasks: new Map(),
    pendingActions: new Map(),
    runningByThread: new Map(),
  };

  const { subscribe, set, update } = writable<BackgroundPromptState>(initialState);

  // Track current state for synchronous reads
  let currentState = initialState;
  subscribe((state) => {
    currentState = state;
  });

  return {
    subscribe,

    submit: async (request: BackgroundPromptRequest): Promise<void> => {
      if (!window.electronAPI?.bgprompt) {
        console.warn('[backgroundPromptStore] Electron API not available');
        return;
      }

      const response = await window.electronAPI.bgprompt.submit(request);
      if (!response.success) {
        console.error('[backgroundPromptStore] Failed to submit task:', response.errorText);
      }
    },

    cancel: async (taskId: string): Promise<void> => {
      if (!window.electronAPI?.bgprompt) {
        console.warn('[backgroundPromptStore] Electron API not available');
        return;
      }

      await window.electronAPI.bgprompt.cancel(taskId);
    },

    dismiss: (taskId: string): void => {
      update((state) => {
        const newPending = new Map(state.pendingActions);
        newPending.delete(taskId);

        const newTasks = new Map(state.tasks);
        newTasks.delete(taskId);

        return { ...state, tasks: newTasks, pendingActions: newPending };
      });
    },

    accept: (taskId: string): void => {
      update((state) => {
        const newPending = new Map(state.pendingActions);
        newPending.delete(taskId);

        return { ...state, pendingActions: newPending };
      });
    },

    getPendingForThread: (threadId: string): BackgroundPromptResult[] => {
      const results: BackgroundPromptResult[] = [];
      for (const result of currentState.pendingActions.values()) {
        if (result.threadId === threadId) {
          results.push(result);
        }
      }
      return results;
    },

    getPendingByType: (
      threadId: string,
      type: BackgroundPromptType,
    ): BackgroundPromptResult | undefined => {
      for (const result of currentState.pendingActions.values()) {
        if (result.threadId === threadId && result.type === type) {
          return result;
        }
      }
      return undefined;
    },

    isRunningForThread: (threadId: string): boolean => {
      const running = currentState.runningByThread.get(threadId);
      return running !== undefined && running.size > 0;
    },

    handleResult: (result: BackgroundPromptResult): void => {
      update((state) => {
        const newTasks = new Map(state.tasks);
        const newPending = new Map(state.pendingActions);
        const newRunning = new Map(state.runningByThread);

        newTasks.set(result.taskId, result);

        if (result.status === BackgroundPromptStatus.Running) {
          // Track as running
          const threadRunning = new Set(newRunning.get(result.threadId) ?? []);
          threadRunning.add(result.taskId);
          newRunning.set(result.threadId, threadRunning);
        } else {
          // Remove from running
          const threadRunning = newRunning.get(result.threadId);
          if (threadRunning) {
            threadRunning.delete(result.taskId);
            if (threadRunning.size === 0) {
              newRunning.delete(result.threadId);
            } else {
              newRunning.set(result.threadId, new Set(threadRunning));
            }
          }

          if (result.status === BackgroundPromptStatus.Completed) {
            // For instruction-generation: replace any previous pending result of the same type+thread
            if (result.type === BackgroundPromptType.InstructionGeneration) {
              for (const [existingId, existing] of newPending.entries()) {
                if (
                  existing.threadId === result.threadId &&
                  existing.type === BackgroundPromptType.InstructionGeneration
                ) {
                  newPending.delete(existingId);
                  newTasks.delete(existingId);
                }
              }
            }

            // Add to pending actions for user to keep/discard
            newPending.set(result.taskId, result);
          }

          // For failed/cancelled, clean up the task after a short delay (let UI react first)
          if (
            result.status === BackgroundPromptStatus.Failed ||
            result.status === BackgroundPromptStatus.Cancelled
          ) {
            // Keep in tasks map briefly for UI to read the error, but don't add to pendingActions
          }
        }

        return {
          tasks: newTasks,
          pendingActions: newPending,
          runningByThread: newRunning,
        };
      });
    },

    reset: (): void => {
      set({
        tasks: new Map(),
        pendingActions: new Map(),
        runningByThread: new Map(),
      });
    },
  };
}

export const backgroundPromptStore = createBackgroundPromptStore();

/**
 * Derived store: check if a thread has any running background tasks
 * Usage: $isThreadRunningBgTasks('thread-123')
 */
export const isThreadRunningBgTasks: Readable<(threadId: string) => boolean> = derived(
  backgroundPromptStore,
  ($store) => (threadId: string) => {
    const running = $store.runningByThread.get(threadId);
    return running !== undefined && running.size > 0;
  },
);

/**
 * Derived store: get pending auto-title suggestion for a thread
 * Usage: $pendingAutoTitle('thread-123')
 */
export const pendingAutoTitle: Readable<(threadId: string) => BackgroundPromptResult | undefined> =
  derived(backgroundPromptStore, ($store) => (threadId: string) => {
    for (const result of $store.pendingActions.values()) {
      if (
        result.threadId === threadId &&
        result.type === BackgroundPromptType.AutoTitle &&
        result.status === BackgroundPromptStatus.Completed
      ) {
        return result;
      }
    }
    return undefined;
  });

/**
 * Initialize background prompt event listeners.
 * Call once at app startup to connect the store to Electron IPC events.
 */
export function initBackgroundPromptListeners(): void {
  if (!window.electronAPI?.bgprompt) {
    console.warn('[backgroundPromptStore] Electron API not available');
    return;
  }

  const unsubResult = window.electronAPI.bgprompt.onResult((result: BackgroundPromptResult) => {
    backgroundPromptStore.handleResult(result);
  });

  // Store cleanup function for potential future use
  if (typeof window !== 'undefined') {
    (window as unknown as { backgroundPromptCleanup?: () => void }).backgroundPromptCleanup =
      () => {
        unsubResult();
      };
  }
}

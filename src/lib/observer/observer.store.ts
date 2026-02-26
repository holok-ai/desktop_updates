/**
 * Observer Store
 *
 * Simple Svelte store for tracking Thread Observer UI state:
 * running tasks, suggestions, context summaries, and context status.
 */

import { writable, derived, type Readable } from 'svelte/store';
import { ObserverTaskType } from '../../../src-shared/types/observer.types';
import type { ContextStatus } from '$lib/types/context.type';

interface ObserverState {
  /** threadId → Set<ObserverTaskType> of currently running tasks */
  running: Map<string, Set<ObserverTaskType>>;
  /** key: `${threadId}:${taskType}` → suggestion string */
  suggestions: Map<string, string>;
  /** threadId → parsed context summary */
  contextSummaries: Map<string, unknown>;
  /** threadId → computed context status (token usage, max, threshold) */
  contextStatus: Map<string, ContextStatus>;
}

const initialState: ObserverState = {
  running: new Map(),
  suggestions: new Map(),
  contextSummaries: new Map(),
  contextStatus: new Map(),
};

const { subscribe, update } = writable<ObserverState>(initialState);

function makeKey(threadId: string, taskType: ObserverTaskType): string {
  return `${threadId}:${taskType}`;
}

export const observerStore = {
  subscribe,

  /** Mark a task as running or not running for a thread */
  setRunning(threadId: string, taskType: ObserverTaskType, isRunning: boolean): void {
    update((state) => {
      const newRunning = new Map(state.running);
      const threadSet = new Set(newRunning.get(threadId) ?? []);

      if (isRunning) {
        threadSet.add(taskType);
      } else {
        threadSet.delete(taskType);
      }

      if (threadSet.size > 0) {
        newRunning.set(threadId, threadSet);
      } else {
        newRunning.delete(threadId);
      }

      return { ...state, running: newRunning };
    });
  },

  /** Store a suggestion result for a thread+taskType */
  setSuggestion(threadId: string, taskType: ObserverTaskType, value: string): void {
    update((state) => {
      const newSuggestions = new Map(state.suggestions);
      newSuggestions.set(makeKey(threadId, taskType), value);
      return { ...state, suggestions: newSuggestions };
    });
  },

  /** Dismiss (discard) a suggestion */
  dismissSuggestion(threadId: string, taskType: ObserverTaskType): void {
    update((state) => {
      const newSuggestions = new Map(state.suggestions);
      newSuggestions.delete(makeKey(threadId, taskType));
      return { ...state, suggestions: newSuggestions };
    });
  },

  /** Accept a suggestion (remove from pending) */
  acceptSuggestion(threadId: string, taskType: ObserverTaskType): void {
    update((state) => {
      const newSuggestions = new Map(state.suggestions);
      newSuggestions.delete(makeKey(threadId, taskType));
      return { ...state, suggestions: newSuggestions };
    });
  },

  /** Store a context summary for a thread */
  setContextSummary(threadId: string, summary: unknown): void {
    update((state) => {
      const newSummaries = new Map(state.contextSummaries);
      newSummaries.set(threadId, summary);
      return { ...state, contextSummaries: newSummaries };
    });
  },

  /** Store the computed context status for a thread */
  setContextStatus(threadId: string, status: ContextStatus): void {
    update((state) => {
      const newMap = new Map(state.contextStatus);
      newMap.set(threadId, status);
      return { ...state, contextStatus: newMap };
    });
  },

  /** Stamp the last compact timestamp on the existing context status for a thread */
  setLastCompactTimestamp(threadId: string, timestamp: number): void {
    update((state) => {
      const existing = state.contextStatus.get(threadId);
      if (existing === undefined) {
        return state;
      }
      const newMap = new Map(state.contextStatus);
      newMap.set(threadId, { ...existing, lastCompactTimestamp: timestamp });
      return { ...state, contextStatus: newMap };
    });
  },

  /** Remove context status for a thread */
  clearContextStatus(threadId: string): void {
    update((state) => {
      const newMap = new Map(state.contextStatus);
      newMap.delete(threadId);
      return { ...state, contextStatus: newMap };
    });
  },

  /** Reset all state */
  reset(): void {
    update(() => ({
      running: new Map(),
      suggestions: new Map(),
      contextSummaries: new Map(),
      contextStatus: new Map(),
    }));
  },
};

/**
 * Derived store: check if a specific task type is running for a thread
 */
export const isTaskRunning: Readable<(threadId: string, taskType: ObserverTaskType) => boolean> =
  derived(observerStore, ($store) => (threadId: string, taskType: ObserverTaskType) => {
    const threadSet = $store.running.get(threadId);
    return threadSet?.has(taskType) ?? false;
  });

/**
 * Derived store: get a suggestion for a thread+taskType
 */
export const getSuggestion: Readable<
  (threadId: string, taskType: ObserverTaskType) => string | undefined
> = derived(
  observerStore,
  ($store) => (threadId: string, taskType: ObserverTaskType) =>
    $store.suggestions.get(makeKey(threadId, taskType)),
);

/**
 * Derived store: check if a thread has any pending suggestions
 */
export const hasAnySuggestion: Readable<(threadId: string) => boolean> = derived(
  observerStore,
  ($store) => (threadId: string) => {
    for (const key of $store.suggestions.keys()) {
      if (key.startsWith(`${threadId}:`)) {
        return true;
      }
    }
    return false;
  },
);

/**
 * Derived store: get the context status for a thread
 */
export const getContextStatus: Readable<(threadId: string) => ContextStatus | undefined> = derived(
  observerStore,
  ($store) => (threadId: string) => $store.contextStatus.get(threadId),
);

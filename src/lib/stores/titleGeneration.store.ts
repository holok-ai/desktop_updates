/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import { writable, derived, type Readable } from 'svelte/store';

/**
 * Title Generation State
 *
 * Tracks which threads are currently generating titles.
 * Used to display "Generating title..." indicators in the UI.
 */
interface TitleGenerationState {
  /** Map of threadId to generation status */
  generatingThreads: Map<string, boolean>;
  /** Last generated title for a thread (for UI updates) */
  lastGeneratedTitles: Map<string, string>;
}

interface TitleGenerationStore {
  subscribe: (run: (value: TitleGenerationState) => void) => () => void;
  /** Mark a thread as starting title generation */
  startGeneration: (threadId: string) => void;
  /** Mark a thread as finished title generation */
  finishGeneration: (threadId: string, title: string) => void;
  /** Check if a specific thread is generating a title */
  isGenerating: (threadId: string) => boolean;
  /** Clear generation state for a thread */
  clearThread: (threadId: string) => void;
  /** Reset all generation state */
  reset: () => void;
}

function createTitleGenerationStore(): TitleGenerationStore {
  const initialState: TitleGenerationState = {
    generatingThreads: new Map(),
    lastGeneratedTitles: new Map(),
  };

  const { subscribe, set, update } = writable<TitleGenerationState>(initialState);

  // Track current state for synchronous reads
  let currentState = initialState;
  subscribe((state) => {
    currentState = state;
  });

  return {
    subscribe,

    startGeneration: (threadId: string): void => {
      update((state) => {
        const newGenerating = new Map(state.generatingThreads);
        newGenerating.set(threadId, true);
        return {
          ...state,
          generatingThreads: newGenerating,
        };
      });
    },

    finishGeneration: (threadId: string, title: string): void => {
      update((state) => {
        const newGenerating = new Map(state.generatingThreads);
        newGenerating.delete(threadId);

        const newTitles = new Map(state.lastGeneratedTitles);
        newTitles.set(threadId, title);

        return {
          generatingThreads: newGenerating,
          lastGeneratedTitles: newTitles,
        };
      });
    },

    isGenerating: (threadId: string): boolean => currentState.generatingThreads.has(threadId),

    clearThread: (threadId: string): void => {
      update((state) => {
        const newGenerating = new Map(state.generatingThreads);
        newGenerating.delete(threadId);

        const newTitles = new Map(state.lastGeneratedTitles);
        newTitles.delete(threadId);

        return {
          generatingThreads: newGenerating,
          lastGeneratedTitles: newTitles,
        };
      });
    },

    reset: (): void => {
      set({
        generatingThreads: new Map(),
        lastGeneratedTitles: new Map(),
      });
    },
  };
}

export const titleGenerationStore = createTitleGenerationStore();

/**
 * Derived store that returns a function to check if a thread is generating
 * Usage: $isThreadGeneratingTitle('thread-123')
 */
export const isThreadGeneratingTitle: Readable<(threadId: string) => boolean> = derived(
  titleGenerationStore,
  ($titleGen) => (threadId: string) => $titleGen.generatingThreads.has(threadId),
);

/**
 * Derived helper to read the last generated title for a thread (if any)
 * Usage: const last = $lastGeneratedTitle(threadId)
 */
export const lastGeneratedTitle: Readable<(threadId: string) => string | undefined> = derived(
  titleGenerationStore,
  ($titleGen) => (threadId: string) => $titleGen.lastGeneratedTitles.get(threadId),
);

/**
 * Initialize title generation event listeners
 * Call this once at app startup to connect the store to Electron events
 */
export function initTitleGenerationListeners(): void {
  if (!window.electronAPI?.thread) {
    console.warn('[titleGenerationStore] Electron API not available');
    return;
  }

  // Listen for title generation started
  const unsubStarted = window.electronAPI.thread.onTitleGenerationStarted(
    (data: { threadId: string }) => {
      titleGenerationStore.startGeneration(data.threadId);
    },
  );

  // Listen for title generation finished
  const unsubFinished = window.electronAPI.thread.onTitleGenerationFinished(
    (data: { threadId: string; title: string }) => {
      titleGenerationStore.finishGeneration(data.threadId, data.title);
    },
  );

  // Store cleanup functions for potential future use
  if (typeof window !== 'undefined') {
    (window as unknown as { titleGenerationCleanup?: () => void }).titleGenerationCleanup = () => {
      unsubStarted();
      unsubFinished();
    };
  }
}

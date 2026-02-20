/**
 * Store for branch selection state per thread
 */

import { writable, derived, get } from 'svelte/store';

interface BranchState {
  /** Map of forkPointId -> selected branchIndex */
  selections: Map<string, number>;
  /** Map of forkPointId -> collapsed state */
  collapsed: Map<string, boolean>;
  /** Currently visible branch boxes at fork point */
  showingBranchesAt: string | null;
}

interface ThreadBranchStates {
  [threadId: string]: BranchState;
}

function createBranchStore(): {
  subscribe: ReturnType<typeof writable<ThreadBranchStates>>['subscribe'];
  init: () => void;
  selectBranch: (threadId: string, forkPointId: string, branchIndex: number) => void;
  getSelectedBranch: (threadId: string, forkPointId: string) => number;
  toggleCollapsed: (threadId: string, forkPointId: string) => void;
  isCollapsed: (threadId: string, forkPointId: string) => boolean;
  showBranchesAt: (threadId: string, forkPointId: string | null) => void;
  getShowingBranchesAt: (threadId: string) => string | null;
  clearThread: (threadId: string) => void;
  getSelections: (threadId: string) => Map<string, number>;
} {
  const { subscribe, update, set } = writable<ThreadBranchStates>({});

  // Load from localStorage on init
  function init(): void {
    try {
      const saved = localStorage.getItem('branch-states');
      if (typeof saved === 'string' && saved.length > 0) {
        const parsed: unknown = JSON.parse(saved);
        // Convert arrays back to Maps
        const states: ThreadBranchStates = {};
        if (typeof parsed === 'object' && parsed !== null) {
          for (const [threadId, state] of Object.entries(parsed)) {
            const s = state as {
              selections?: [string, number][];
              collapsed?: [string, boolean][];
            } | null;
            if (s !== null && typeof s === 'object') {
              // eslint-disable-next-line security/detect-object-injection
              states[threadId] = {
                selections: new Map(s.selections ?? []),
                collapsed: new Map(s.collapsed ?? []),
                showingBranchesAt: null,
              };
            }
          }
        }
        set(states);
      }
    } catch {
      // Ignore parse errors
    }
  }

  function save(states: ThreadBranchStates): void {
    try {
      const serializable: Record<
        string,
        { selections: [string, number][]; collapsed: [string, boolean][] }
      > = {};
      for (const [threadId, state] of Object.entries(states)) {
        // eslint-disable-next-line security/detect-object-injection
        serializable[threadId] = {
          selections: Array.from(state.selections.entries()),
          collapsed: Array.from(state.collapsed.entries()),
        };
      }
      localStorage.setItem('branch-states', JSON.stringify(serializable));
    } catch {
      // Ignore storage errors
    }
  }

  function getState(states: ThreadBranchStates, threadId: string): BranchState {
    // eslint-disable-next-line security/detect-object-injection
    const existingState = states[threadId];
    if (
      existingState === null ||
      existingState === undefined ||
      typeof existingState !== 'object'
    ) {
      const newState: BranchState = {
        selections: new Map(),
        collapsed: new Map(),
        showingBranchesAt: null,
      };
      // eslint-disable-next-line security/detect-object-injection
      states[threadId] = newState;
      return newState;
    }
    return existingState;
  }

  return {
    subscribe,

    init,

    /** Select a branch at a fork point */
    selectBranch(threadId: string, forkPointId: string, branchIndex: number) {
      update((states) => {
        const state = getState(states, threadId);
        state.selections.set(forkPointId, branchIndex);
        state.showingBranchesAt = null; // Hide branch boxes after selection
        save(states);
        return { ...states };
      });
    },

    /** Get selected branch index at a fork point */
    getSelectedBranch(threadId: string, forkPointId: string): number {
      const states = get({ subscribe });
      // eslint-disable-next-line security/detect-object-injection
      const threadState = states[threadId];
      if (threadState === null || threadState === undefined || typeof threadState !== 'object') {
        return 0;
      }
      return threadState.selections.get(forkPointId) ?? 0;
    },

    /** Toggle collapsed state for a branch */
    toggleCollapsed(threadId: string, forkPointId: string): void {
      update((states) => {
        const state = getState(states, threadId);
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const wasCollapsed = state.collapsed.get(forkPointId) ?? false;
        state.collapsed.set(forkPointId, !wasCollapsed);
        save(states);
        return { ...states };
      });
    },

    /** Check if a branch is collapsed */
    isCollapsed(threadId: string, forkPointId: string): boolean {
      const states = get({ subscribe });
      // eslint-disable-next-line security/detect-object-injection
      return states[threadId]?.collapsed.get(forkPointId) ?? false;
    },

    /** Show branch boxes at a fork point */
    showBranchesAt(threadId: string, forkPointId: string | null) {
      update((states) => {
        const state = getState(states, threadId);
        state.showingBranchesAt = forkPointId;
        return { ...states };
      });
    },

    /** Get the fork point where branches are currently shown */
    getShowingBranchesAt(threadId: string): string | null {
      const states = get({ subscribe });
      // eslint-disable-next-line security/detect-object-injection
      return states[threadId]?.showingBranchesAt ?? null;
    },

    /** Clear state for a thread */
    clearThread(threadId: string): void {
      update((states) => {
        const newStates: ThreadBranchStates = {};
        for (const [id, state] of Object.entries(states)) {
          if (id !== threadId) {
            // eslint-disable-next-line security/detect-object-injection
            newStates[id] = state;
          }
        }
        save(newStates);
        return newStates;
      });
    },

    /** Get all selections for a thread */
    getSelections(threadId: string): Map<string, number> {
      const states = get({ subscribe });
      // eslint-disable-next-line security/detect-object-injection
      return states[threadId]?.selections ?? new Map();
    },
  };
}

export const branchStore = createBranchStore();

/** Derived store for getting branch state for current thread */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function getBranchStateForThread(threadId: string) {
  return derived(branchStore, ($states) => {
    // eslint-disable-next-line security/detect-object-injection
    const threadState = $states[threadId];
    if (threadState === null || threadState === undefined || typeof threadState !== 'object') {
      return {
        selections: new Map(),
        collapsed: new Map(),
        showingBranchesAt: null,
      };
    }
    return threadState;
  });
}

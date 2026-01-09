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

function createBranchStore() {
  const { subscribe, update, set } = writable<ThreadBranchStates>({});

  // Load from localStorage on init
  function init() {
    try {
      const saved = localStorage.getItem('branch-states');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Convert arrays back to Maps
        const states: ThreadBranchStates = {};
        for (const [threadId, state] of Object.entries(parsed)) {
          const s = state as { selections?: [string, number][]; collapsed?: [string, boolean][] };
          states[threadId] = {
            selections: new Map(s.selections || []),
            collapsed: new Map(s.collapsed || []),
            showingBranchesAt: null,
          };
        }
        set(states);
      }
    } catch {
      // Ignore parse errors
    }
  }

  function save(states: ThreadBranchStates) {
    try {
      const serializable: Record<string, { selections: [string, number][]; collapsed: [string, boolean][] }> = {};
      for (const [threadId, state] of Object.entries(states)) {
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
    if (!states[threadId]) {
      states[threadId] = {
        selections: new Map(),
        collapsed: new Map(),
        showingBranchesAt: null,
      };
    }
    return states[threadId];
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
      return states[threadId]?.selections.get(forkPointId) ?? 0;
    },

    /** Toggle collapsed state for a branch */
    toggleCollapsed(threadId: string, forkPointId: string) {
      update((states) => {
        const state = getState(states, threadId);
        const current = state.collapsed.get(forkPointId) ?? false;
        state.collapsed.set(forkPointId, !current);
        save(states);
        return { ...states };
      });
    },

    /** Check if a branch is collapsed */
    isCollapsed(threadId: string, forkPointId: string): boolean {
      const states = get({ subscribe });
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
      return states[threadId]?.showingBranchesAt ?? null;
    },

    /** Clear state for a thread */
    clearThread(threadId: string) {
      update((states) => {
        delete states[threadId];
        save(states);
        return { ...states };
      });
    },

    /** Get all selections for a thread */
    getSelections(threadId: string): Map<string, number> {
      const states = get({ subscribe });
      return states[threadId]?.selections ?? new Map();
    },
  };
}

export const branchStore = createBranchStore();

/** Derived store for getting branch state for current thread */
export function getBranchStateForThread(threadId: string) {
  return derived(branchStore, ($states) => {
    return $states[threadId] ?? {
      selections: new Map(),
      collapsed: new Map(),
      showingBranchesAt: null,
    };
  });
}





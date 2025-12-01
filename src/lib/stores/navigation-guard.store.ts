import { get, writable } from 'svelte/store';

export type UnsavedContext = 'add-thread' | 'add-project';

interface GuardState {
  isDirty: boolean;
  context: UnsavedContext | null;
  message: string;
}

const WARNING_MESSAGE =
  'You have entered data for a new thread.\n\nPress OK to stay on this page and finish.\nPress Cancel to discard changes.';

const guardStore = writable<GuardState>({
  isDirty: false,
  context: null,
  message: WARNING_MESSAGE,
});

export const navigationGuard = {
  subscribe: guardStore.subscribe,
};

export function setUnsavedChanges(context: UnsavedContext, isDirty: boolean): void {
  guardStore.update((state) => {
    if (!isDirty && state.context === context) {
      return { ...state, isDirty: false, context: null };
    }
    if (isDirty) {
      return { ...state, isDirty: true, context };
    }
    return state;
  });
}

export function clearUnsavedChanges(context?: UnsavedContext): void {
  guardStore.update((state) => {
    if (!state.isDirty) {
      return state;
    }
    if (context === undefined || state.context === context) {
      return { ...state, isDirty: false, context: null };
    }
    return state;
  });
}

export function confirmNavigation(): boolean {
  const state = get(guardStore);
  if (!state.isDirty) {
    return true;
  }

  const confirmFn = globalThis.confirm;
  // OK = stay on page (return false to block navigation)
  // Cancel = discard changes and continue (return true to allow navigation)
  if (confirmFn === undefined) {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const userClickedOK = confirmFn(state.message);
  if (userClickedOK) {
    // User wants to stay on the page and finish
    return false;
  } else {
    // User wants to discard changes and navigate away
    guardStore.set({
      isDirty: false,
      context: null,
      message: WARNING_MESSAGE,
    });
    return true;
  }
}

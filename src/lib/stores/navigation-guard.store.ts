import { get, writable } from 'svelte/store';

export type UnsavedContext = 'add-thread' | 'add-project';

interface GuardState {
  isDirty: boolean;
  context: UnsavedContext | null;
  message: string;
}

const WARNING_MESSAGE =
  'You have entered data. Continue and lose it, or stay on this page to finish?';

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
  if (confirmFn === undefined || confirmFn(state.message)) {
    guardStore.set({
      isDirty: false,
      context: null,
      message: WARNING_MESSAGE,
    });
    return true;
  }

  return false;
}

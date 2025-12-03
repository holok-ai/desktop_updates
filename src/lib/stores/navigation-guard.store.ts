/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import { get, writable } from 'svelte/store';

export type UnsavedContext = 'add-thread' | 'add-project';

interface GuardState {
  isDirty: boolean;
  context: UnsavedContext | null;
  message: string;
}

// Modal state for the custom confirmation dialog
export interface ConfirmModalState {
  show: boolean;
  message: string;
  onStay: (() => void) | null;
  onDiscard: (() => void) | null;
}

const WARNING_MESSAGE =
  'You have entered data for a new thread.\n\nPress OK to stay on this page and finish.\nPress Cancel to discard changes.';

const guardStore = writable<GuardState>({
  isDirty: false,
  context: null,
  message: WARNING_MESSAGE,
});

// Store for the confirmation modal state
export const confirmModalStore = writable<ConfirmModalState>({
  show: false,
  message: '',
  onStay: null,
  onDiscard: null,
});

// Cleanup callbacks registered by consumers (keyed by context)
const cleanupCallbacks = new Map<UnsavedContext, () => void>();

export const navigationGuard = {
  subscribe: guardStore.subscribe,
};

/**
 * Register a cleanup callback to be called when user discards changes for a specific context.
 * Returns an unsubscribe function.
 */
export function registerDiscardCallback(context: UnsavedContext, callback: () => void): () => void {
  cleanupCallbacks.set(context, callback);
  return () => {
    cleanupCallbacks.delete(context);
  };
}

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

/**
 * Hide the confirmation modal
 */
export function hideConfirmModal(): void {
  confirmModalStore.set({
    show: false,
    message: '',
    onStay: null,
    onDiscard: null,
  });
}

/**
 * Request navigation - if there are unsaved changes, shows a custom modal.
 * Returns true if navigation can proceed immediately, false if modal was shown.
 *
 * @param onProceed - Callback to execute if user confirms navigation (discards changes)
 */
export function requestNavigation(onProceed: () => void): boolean {
  const state = get(guardStore);

  if (!state.isDirty) {
    // No unsaved changes, proceed immediately
    return true;
  }

  // Show the custom confirmation modal
  confirmModalStore.set({
    show: true,
    message: state.message,
    onStay: () => {
      // User wants to stay - just hide the modal
      hideConfirmModal();
    },
    onDiscard: () => {
      // User wants to discard changes and navigate
      // Call the cleanup callback for this context if registered
      const contextToClean = state.context;
      if (contextToClean) {
        const cleanup = cleanupCallbacks.get(contextToClean);
        if (cleanup) {
          cleanup();
        }
      }

      guardStore.set({
        isDirty: false,
        context: null,
        message: WARNING_MESSAGE,
      });

      hideConfirmModal();

      // Execute the navigation callback
      onProceed();
    },
  });

  // Return false to indicate navigation was blocked (modal shown)
  return false;
}

/**
 * @deprecated Use requestNavigation() instead to avoid native dialog focus issues.
 * Synchronous check - only use for cases where async modal isn't possible.
 */
export function confirmNavigation(): boolean {
  const state = get(guardStore);
  if (!state.isDirty) {
    return true;
  }

  // Fallback to native confirm - but this causes focus issues in Electron
  // Prefer using requestNavigation() with the custom modal
  const confirmFn = globalThis.confirm;
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
    const contextToClean = state.context;
    if (contextToClean) {
      const cleanup = cleanupCallbacks.get(contextToClean);
      if (cleanup) {
        cleanup();
      }
    }

    guardStore.set({
      isDirty: false,
      context: null,
      message: WARNING_MESSAGE,
    });
    return true;
  }
}

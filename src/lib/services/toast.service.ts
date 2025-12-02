import { writable } from 'svelte/store';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  duration?: number;
  variant?: ToastVariant;
}

interface ToastOptions {
  duration?: number;
  variant?: ToastVariant;
}

interface ToastStore {
  subscribe: (run: (value: ToastMessage | null) => void) => () => void;
  show: (message: string, options?: ToastOptions) => void;
  hide: () => void;
}

function createToastStore(): ToastStore {
  const { subscribe, set } = writable<ToastMessage | null>(null);

  return {
    subscribe,
    show: (message: string, options?: ToastOptions): void => {
      let duration = 4000;
      let variant: ToastVariant | undefined;

      if (options !== null && options !== undefined) {
        const { duration: optDuration, variant: optVariant } = options;
        duration = optDuration ?? duration;
        variant = optVariant;
      }

      const id = `${Date.now()}-${Math.random()}`;
      set({ id, message, duration, variant });

      if (duration > 0) {
        setTimeout(() => {
          set(null);
        }, duration);
      }
    },
    hide: (): void => {
      set(null);
    },
  };
}

export const toastStore = createToastStore();

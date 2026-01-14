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
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

function createToastStore(): ToastStore {
  const { subscribe, set } = writable<ToastMessage | null>(null);

  const store: ToastStore = {
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
    success: (message: string, duration?: number): void => {
      store.show(message, { variant: 'success', duration });
    },
    error: (message: string, duration?: number): void => {
      store.show(message, { variant: 'error', duration });
    },
    warning: (message: string, duration?: number): void => {
      store.show(message, { variant: 'warning', duration });
    },
    info: (message: string, duration?: number): void => {
      store.show(message, { variant: 'info', duration });
    },
  };

  return store;
}

export const toastStore = createToastStore();

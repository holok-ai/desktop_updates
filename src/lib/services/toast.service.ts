import { writable } from 'svelte/store';

export interface ToastMessage {
  id: string;
  message: string;
  duration?: number;
}

interface ToastStore {
  subscribe: (run: (value: ToastMessage | null) => void) => () => void;
  show: (message: string, duration?: number) => void;
  hide: () => void;
}

function createToastStore(): ToastStore {
  const { subscribe, set } = writable<ToastMessage | null>(null);

  return {
    subscribe,
    show: (message: string, duration = 4000): void => {
      const id = `${Date.now()}-${Math.random()}`;
      set({ id, message, duration });

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

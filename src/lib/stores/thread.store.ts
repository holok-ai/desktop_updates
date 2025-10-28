import { writable } from 'svelte/store';
import type { Thread } from '../../../src-electron/preload';

interface ThreadStore {
  subscribe: (run: (value: Thread[]) => void) => () => void;
  setThreads: (threads: Thread[]) => void;
  addThread: (thread: Thread) => void;
  updateThread: (updatedThread: Thread) => void;
  deleteThread: (threadId: string) => void;
}

function createThreadStore(): ThreadStore {
  const { subscribe, set, update } = writable<Thread[]>([]);

  return {
    subscribe,
    setThreads: (threads: Thread[]): void => set(threads),
    addThread: (thread: Thread): void => {
      update((threads) => [...threads, thread]);
    },
    updateThread: (updatedThread: Thread): void => {
      update((threads) => threads.map((t) => (t.id === updatedThread.id ? updatedThread : t)));
    },
    deleteThread: (threadId: string): void => {
      update((threads) => threads.filter((t) => t.id !== threadId));
    },
  };
}

export const threads = createThreadStore();

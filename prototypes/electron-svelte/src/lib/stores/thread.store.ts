import { writable } from 'svelte/store';
import type { Thread } from '../../../src-electron/preload';

function createThreadStore() {
  const { subscribe, set, update } = writable<Thread[]>([]);

  return {
    subscribe,
    setThreads: (threads: Thread[]) => set(threads),
    addThread: (thread: Thread) => {
      update(threads => [...threads, thread]);
    },
    updateThread: (updatedThread: Thread) => {
      update(threads =>
        threads.map(t => t.id === updatedThread.id ? updatedThread : t)
      );
    },
    deleteThread: (threadId: string) => {
      update(threads => threads.filter(t => t.id !== threadId));
    }
  };
}

export const threads = createThreadStore();

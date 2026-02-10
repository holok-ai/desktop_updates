import { writable } from 'svelte/store';
import type { Thread } from '../../../src-electron/preload.js';

interface ThreadStore {
  subscribe: (run: (value: Thread[]) => void) => () => void;
  setThreads: (threads: Thread[]) => void;
  addThread: (thread: Thread) => void;
  updateThread: (updatedThread: Thread) => void;
  deleteThread: (threadId: string) => void;
}

function createThreadStore(): ThreadStore {
  const { subscribe, set: _set, update } = writable<Thread[]>([]);

  return {
    subscribe,
    setThreads: (newThreads: Thread[]): void => {
      update((currentThreads) => {
        // Merge new threads with existing, preferring newer data
        const threadMap = new Map<string, Thread>();

        // Add existing threads first
        currentThreads.forEach((t) => threadMap.set(t.id, t));

        // Update/add new threads (overwrites existing with same id)
        newThreads.forEach((t) => threadMap.set(t.id, t));

        // Convert back to array and sort
        const merged = Array.from(threadMap.values());
        return merged.sort((a, b) => {
          const aTime =
            typeof a.createdAt === 'number' ? a.createdAt : new Date(a.createdAt).getTime();
          const bTime =
            typeof b.createdAt === 'number' ? b.createdAt : new Date(b.createdAt).getTime();
          return bTime - aTime;
        });
      });
    },
    addThread: (thread: Thread): void => {
      update((threads) => {
        // Check if thread already exists to avoid duplicates
        const existingIndex = threads.findIndex((t) => t.id === thread.id);
        let updated: Thread[];

        if (existingIndex >= 0) {
          // Update existing thread
          updated = [...threads];
          // eslint-disable-next-line security/detect-object-injection
          updated[existingIndex] = thread;
        } else {
          // Add new thread
          updated = [...threads, thread];
        }

        // Sort by createdAt, newest first (matching server-side sort)
        return updated.sort((a, b) => {
          const aTime =
            typeof a.createdAt === 'number' ? a.createdAt : new Date(a.createdAt).getTime();
          const bTime =
            typeof b.createdAt === 'number' ? b.createdAt : new Date(b.createdAt).getTime();
          return bTime - aTime;
        });
      });
    },
    updateThread: (updatedThread: Thread): void => {
      update((threads) => {
        const updated = threads.map((t) => {
          if (t.id === updatedThread.id) {
            return updatedThread;
          }
          return t;
        });
        return updated;
      });
    },
    deleteThread: (threadId: string): void => {
      update((threads) => threads.filter((t) => t.id !== threadId));
    },
  };
}

export const threads = createThreadStore();

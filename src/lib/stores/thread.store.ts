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
  const { subscribe, set, update } = writable<Thread[]>([]);

  return {
    subscribe,
    setThreads: (threads: Thread[]): void => set(threads),
    addThread: (thread: Thread): void => {
      update((threads) => {
        const updated = [...threads, thread];
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

// Initialize listener for backend thread updates
export function initThreadUpdateListener(): () => void {
  try {
    if (typeof window.electronAPI?.thread?.onThreadUpdated === 'function') {
      return window.electronAPI.thread.onThreadUpdated((updatedThread) => {
        threads.updateThread(updatedThread);
      });
    } else {
      console.warn('[thread.store] onThreadUpdated function not available');
    }
  } catch (e) {
    console.error('Failed to initialize thread update listener:', e);
  }
  return () => {}; // Return no-op cleanup function
}

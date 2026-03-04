import { writable, get } from 'svelte/store';

export interface BreadcrumbEntry {
  label: string;
  route: string;
  /** If this entry represents a thread, store its ID for dynamic title lookup */
  threadId?: string;
  /** If this entry represents a project, store its ID for dynamic title lookup */
  projectId?: string;
}

interface BreadcrumbStore {
  subscribe: (run: (value: BreadcrumbEntry[]) => void) => () => void;
  clearAndPush: (entry: BreadcrumbEntry) => void;
  clearAndSet: (entries: BreadcrumbEntry[]) => void;
  push: (entry: BreadcrumbEntry) => void;
  popTo: (index: number) => void;
  get: () => BreadcrumbEntry[];
}

function createBreadcrumbStore(): BreadcrumbStore {
  const { subscribe, set, update } = writable<BreadcrumbEntry[]>([]);

  return {
    subscribe,

    /** Clear the queue and push a single entry (for primary routes). */
    clearAndPush(entry: BreadcrumbEntry): void {
      set([entry]);
    },

    /** Clear the queue and set multiple entries at once. */
    clearAndSet(entries: BreadcrumbEntry[]): void {
      set(entries);
    },

    /** Push an entry onto the end of the queue. */
    push(entry: BreadcrumbEntry): void {
      update((q) => [...q, entry]);
    },

    /** Pop everything after the given index (navigate back to that breadcrumb). */
    popTo(index: number): void {
      update((q) => q.slice(0, index + 1));
    },

    /** Get the current queue snapshot. */
    get(): BreadcrumbEntry[] {
      return get({ subscribe });
    },
  };
}

export const breadcrumbStore = createBreadcrumbStore();

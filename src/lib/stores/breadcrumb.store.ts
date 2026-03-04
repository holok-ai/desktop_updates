import { writable, get } from 'svelte/store';
import { push } from 'svelte-spa-router';

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
  /** Primary nav (sidebar buttons, menu commands): clear queue, push entry, navigate. */
  navigatePrimary: (entry: BreadcrumbEntry) => void;
  /** Secondary nav (clicking a thread/project): push entry onto existing trail, navigate. */
  navigateForward: (entry: BreadcrumbEntry) => void;
  /** Full-trail nav (favorites/recent with known ancestry): clear queue, set all entries, navigate to last. */
  navigateWithTrail: (entries: BreadcrumbEntry[]) => void;
  /** Breadcrumb click: pop queue back to index, navigate to that entry's route. */
  navigateBack: (index: number) => void;
  /** Get the current queue snapshot. */
  get: () => BreadcrumbEntry[];
}

function createBreadcrumbStore(): BreadcrumbStore {
  const { subscribe, set, update } = writable<BreadcrumbEntry[]>([]);

  return {
    subscribe,

    navigatePrimary(entry: BreadcrumbEntry): void {
      set([entry]);
      void push(entry.route);
    },

    navigateForward(entry: BreadcrumbEntry): void {
      update((q) => [...q, entry]);
      void push(entry.route);
    },

    navigateWithTrail(entries: BreadcrumbEntry[]): void {
      set(entries);
      void push(entries[entries.length - 1].route);
    },

    navigateBack(index: number): void {
      const q = get({ subscribe });
      // index is always bounds-checked by the caller (Header breadcrumb click)
      // eslint-disable-next-line security/detect-object-injection
      const entry = q[index];
      update((current) => current.slice(0, index + 1));
      void push(entry.route);
    },

    get(): BreadcrumbEntry[] {
      return get({ subscribe });
    },
  };
}

export const breadcrumbStore = createBreadcrumbStore();

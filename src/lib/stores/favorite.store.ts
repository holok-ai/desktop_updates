import { writable, get } from 'svelte/store';
import { storageService } from '$lib/services/storage.service';

export type FavoriteType = 'thread' | 'project';

export interface FavoriteEntry {
  id: string;
  type: FavoriteType;
  title: string;
  route: string;
  addedAt: number;
}

interface FavoriteStore {
  subscribe: (run: (value: FavoriteEntry[]) => void) => () => void;
  addFavorite: (id: string, type: FavoriteType, title: string, route: string) => void;
  removeFavorite: (id: string) => void;
  toggleFavorite: (id: string, type: FavoriteType, title: string, route: string) => void;
  isFavorite: (id: string) => boolean;
  clearFavorites: () => void;
}

function createFavoriteStore(): FavoriteStore {
  const initial = storageService.getFavorites<FavoriteEntry>();
  const { subscribe, update } = writable<FavoriteEntry[]>(initial);

  function persist(entries: FavoriteEntry[]): void {
    storageService.setFavorites(entries);
  }

  return {
    subscribe,

    addFavorite: (id: string, type: FavoriteType, title: string, route: string): void => {
      update((entries) => {
        if (entries.some((e) => e.id === id)) {
          return entries;
        }
        const next = [...entries, { id, type, title, route, addedAt: Date.now() }];
        persist(next);
        return next;
      });
    },

    removeFavorite: (id: string): void => {
      update((entries) => {
        const next = entries.filter((e) => e.id !== id);
        persist(next);
        return next;
      });
    },

    toggleFavorite: (id: string, type: FavoriteType, title: string, route: string): void => {
      update((entries) => {
        const next = entries.some((e) => e.id === id)
          ? entries.filter((e) => e.id !== id)
          : [...entries, { id, type, title, route, addedAt: Date.now() }];
        persist(next);
        return next;
      });
    },

    isFavorite: (id: string): boolean => get({ subscribe }).some((e) => e.id === id),
    clearFavorites: (): void => {
      persist([]);
      update(() => []);
    },
  };
}

export const favorites = createFavoriteStore();

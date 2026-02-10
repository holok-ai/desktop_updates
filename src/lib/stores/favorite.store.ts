import { writable, get } from 'svelte/store';

export type FavoriteType = 'thread' | 'project';

export interface FavoriteEntry {
  id: string;
  type: FavoriteType;
  addedAt: number;
}

interface FavoriteStore {
  subscribe: (run: (value: FavoriteEntry[]) => void) => () => void;
  addFavorite: (id: string, type: FavoriteType) => void;
  removeFavorite: (id: string) => void;
  toggleFavorite: (id: string, type: FavoriteType) => void;
  isFavorite: (id: string) => boolean;
}

function createFavoriteStore(): FavoriteStore {
  const { subscribe, update } = writable<FavoriteEntry[]>([]);

  return {
    subscribe,

    addFavorite: (id: string, type: FavoriteType): void => {
      update((entries) => {
        if (entries.some((e) => e.id === id)) {
          return entries;
        }
        return [...entries, { id, type, addedAt: Date.now() }];
      });
    },

    removeFavorite: (id: string): void => {
      update((entries) => entries.filter((e) => e.id !== id));
    },

    toggleFavorite: (id: string, type: FavoriteType): void => {
      update((entries) => {
        if (entries.some((e) => e.id === id)) {
          return entries.filter((e) => e.id !== id);
        }
        return [...entries, { id, type, addedAt: Date.now() }];
      });
    },

    isFavorite: (id: string): boolean =>
      get({ subscribe }).some((e) => e.id === id),
  };
}

export const favorites = createFavoriteStore();

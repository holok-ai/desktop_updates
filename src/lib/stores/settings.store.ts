import { writable, derived } from 'svelte/store';
import { defaultAppSettings, type AppSettings, type UserAvatar } from '../types/app.type.js';

interface SettingsStore {
  subscribe: (run: (value: AppSettings) => void) => () => void;
  set: (value: AppSettings) => void;
  update: (updater: (value: AppSettings) => AppSettings) => void;
  setAvatar: (avatar: UserAvatar) => void;
}

function createSettingsStore(): SettingsStore {
  const { subscribe, set, update } = writable<AppSettings>({ ...defaultAppSettings });

  return {
    subscribe,
    set,
    update,
    setAvatar: (avatar: UserAvatar): void => {
      update((s) => ({ ...s, avatar: { ...avatar } }));
    },
  };
}

export const settingsStore = createSettingsStore();
export const avatarSettings = derived(settingsStore, ($s) => $s.avatar);

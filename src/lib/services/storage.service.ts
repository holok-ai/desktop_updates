import type { AppThemeMode } from '$lib/types/app.type';
import type { SidebarActivity } from '$lib/types/sidebar.type';
import { APP_THEME_MODE, APP_THEME_MODE_STORAGE_KEY } from '$lib/constants/app.constant';
import {
  SIDEBAR_STORAGE_KEY,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
} from '$lib/constants/sidebar.constant';

type GetOptions<T> = {
  coerce?: (value: string) => T | null;
  migrate?: boolean;
};

class StorageService {
  private readonly KEYS = {
    LAST_THREAD_ID: 'lastThreadId',
    LAST_PROJECT_ID: 'lastProjectId',
    SIDEBAR_ACTIVITY: SIDEBAR_STORAGE_KEY,
    SIDEBAR_COLLAPSED: SIDEBAR_COLLAPSED_STORAGE_KEY,
    THEME_MODE: APP_THEME_MODE_STORAGE_KEY,
  } as const;

  private get<T>(key: string, defaultValue: T, options?: GetOptions<T>): T {
    let raw: string | null;
    try {
      raw = globalThis.localStorage.getItem(key);
    } catch (error) {
      console.error(`Failed to get ${key}:`, error);
      return defaultValue;
    }

    if (raw === null || raw === undefined || raw === '') {
      return defaultValue;
    }

    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      const coerceFn = options?.coerce ?? null;
      if (coerceFn !== null) {
        const coerced = coerceFn(raw);
        if (coerced !== null) {
          if (options?.migrate !== false) {
            this.set(key, coerced as unknown as T);
          }
          return coerced;
        }
      }
      console.error(`Failed to get ${key}:`, error);
      return defaultValue;
    }
  }

  private set<T>(key: string, value: T): boolean {
    try {
      globalThis.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Failed to set ${key}:`, error);
      return false;
    }
  }

  private remove(key: string): boolean {
    try {
      globalThis.localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Failed to remove ${key}:`, error);
      return false;
    }
  }

  getLastThreadId(): string | null {
    return this.get(this.KEYS.LAST_THREAD_ID, null, {
      coerce: (raw) => raw,
    });
  }

  setLastThreadId(id: string): boolean {
    return this.set(this.KEYS.LAST_THREAD_ID, id);
  }

  removeLastThreadId(): boolean {
    return this.remove(this.KEYS.LAST_THREAD_ID);
  }

  getLastProjectId(): string | null {
    return this.get(this.KEYS.LAST_PROJECT_ID, null, {
      coerce: (raw) => raw,
    });
  }

  setLastProjectId(id: string): boolean {
    return this.set(this.KEYS.LAST_PROJECT_ID, id);
  }

  removeLastProjectId(): boolean {
    return this.remove(this.KEYS.LAST_PROJECT_ID);
  }

  getThemeMode(): AppThemeMode {
    return this.get(this.KEYS.THEME_MODE, APP_THEME_MODE.LIGHT as AppThemeMode, {
      coerce: (raw) => {
        if (raw === APP_THEME_MODE.DARK || raw === APP_THEME_MODE.LIGHT) {
          return raw as AppThemeMode;
        }
        return null;
      },
    });
  }

  setThemeMode(mode: AppThemeMode): boolean {
    return this.set(this.KEYS.THEME_MODE, mode);
  }

  getSidebarCollapsed(): boolean {
    return this.get(this.KEYS.SIDEBAR_COLLAPSED, false, {
      coerce: (raw) => {
        if (raw === 'true') {
          return true;
        }
        if (raw === 'false') {
          return false;
        }
        return null;
      },
    });
  }

  setSidebarCollapsed(collapsed: boolean): boolean {
    return this.set(this.KEYS.SIDEBAR_COLLAPSED, collapsed);
  }

  getSidebarActivity(): SidebarActivity | null {
    return this.get(this.KEYS.SIDEBAR_ACTIVITY, null);
  }

  setSidebarActivity(activity: SidebarActivity): boolean {
    return this.set(this.KEYS.SIDEBAR_ACTIVITY, activity);
  }
}

export const storageService = new StorageService();

import type { AppThemeMode } from '$lib/types/app.type';
import { APP_THEME_MODE, APP_THEME_MODE_STORAGE_KEY } from '$lib/constants/app.constant';

type GetOptions<T> = {
  coerce?: (value: string) => T | null;
  migrate?: boolean;
};

class StorageService {
  private readonly KEYS = {
    SIDEBAR_COLLAPSED: 'sidebarCollapsed',
    THEME_MODE: APP_THEME_MODE_STORAGE_KEY,
    FAVORITES: 'favorites',
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

  /**
   * Get the collapsed state for main sidebar
   */
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

  /**
   * Set the collapsed state for main sidebar
   */
  setSidebarCollapsed(collapsed: boolean): boolean {
    return this.set(this.KEYS.SIDEBAR_COLLAPSED, collapsed);
  }

  getFavorites<T>(): T[] {
    return this.get<T[]>(this.KEYS.FAVORITES, []);
  }

  setFavorites<T>(favorites: T[]): boolean {
    return this.set(this.KEYS.FAVORITES, favorites);
  }
}

export const storageService = new StorageService();

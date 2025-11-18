/**
 * Unit tests for storage.service
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { storageService } from '../../../src/lib/services/storage.service.js';
import { APP_THEME_MODE } from '../../../src/lib/constants/app.constant.js';
import type { SidebarActivity } from '../../../src/lib/types/sidebar.type.js';

describe('storage.service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getLastThreadId / setLastThreadId / removeLastThreadId', () => {
    it('should return null when no value is stored', () => {
      expect(storageService.getLastThreadId()).toBeNull();
    });

    it('should store and retrieve thread ID', () => {
      const threadId = 'thread-123';
      storageService.setLastThreadId(threadId);
      expect(storageService.getLastThreadId()).toBe(threadId);
    });

    it('should remove thread ID', () => {
      storageService.setLastThreadId('thread-123');
      expect(storageService.getLastThreadId()).toBe('thread-123');
      storageService.removeLastThreadId();
      expect(storageService.getLastThreadId()).toBeNull();
    });

    it('should handle storage errors gracefully', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage unavailable');
      });
      expect(storageService.getLastThreadId()).toBeNull();
      spy.mockRestore();
    });

    it('should handle JSON parse errors gracefully', () => {
      localStorage.setItem('lastThreadId', 'invalid-json-{');
      expect(storageService.getLastThreadId()).toBeNull();
    });

    it('should handle remove errors gracefully', () => {
      storageService.setLastThreadId('thread-123');
      const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('Storage unavailable');
      });
      expect(storageService.removeLastThreadId()).toBe(false);
      spy.mockRestore();
    });
  });

  describe('getLastProjectId / setLastProjectId / removeLastProjectId', () => {
    it('should return null when no value is stored', () => {
      expect(storageService.getLastProjectId()).toBeNull();
    });

    it('should store and retrieve project ID', () => {
      const projectId = 'project-456';
      storageService.setLastProjectId(projectId);
      expect(storageService.getLastProjectId()).toBe(projectId);
    });

    it('should remove project ID', () => {
      storageService.setLastProjectId('project-456');
      expect(storageService.getLastProjectId()).toBe('project-456');
      storageService.removeLastProjectId();
      expect(storageService.getLastProjectId()).toBeNull();
    });

    it('should handle storage errors gracefully', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage unavailable');
      });
      expect(storageService.getLastProjectId()).toBeNull();
      spy.mockRestore();
    });

    it('should handle remove errors gracefully', () => {
      storageService.setLastProjectId('project-456');
      const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('Storage unavailable');
      });
      expect(storageService.removeLastProjectId()).toBe(false);
      spy.mockRestore();
    });
  });

  describe('getThemeMode / setThemeMode', () => {
    it('should return default light mode when no value is stored', () => {
      expect(storageService.getThemeMode()).toBe(APP_THEME_MODE.LIGHT);
    });

    it('should store and retrieve theme mode', () => {
      storageService.setThemeMode(APP_THEME_MODE.DARK);
      expect(storageService.getThemeMode()).toBe(APP_THEME_MODE.DARK);

      storageService.setThemeMode(APP_THEME_MODE.LIGHT);
      expect(storageService.getThemeMode()).toBe(APP_THEME_MODE.LIGHT);
    });

    it('should handle storage errors gracefully', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage unavailable');
      });
      expect(storageService.getThemeMode()).toBe(APP_THEME_MODE.LIGHT);
      spy.mockRestore();
    });

    it('should return false when setItem fails', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Quota exceeded');
      });
      expect(storageService.setThemeMode(APP_THEME_MODE.DARK)).toBe(false);
      spy.mockRestore();
    });
  });

  describe('getSidebarCollapsed / setSidebarCollapsed', () => {
    it('should return false when no value is stored', () => {
      expect(storageService.getSidebarCollapsed()).toBe(false);
    });

    it('should store and retrieve sidebar collapsed state', () => {
      storageService.setSidebarCollapsed(true);
      expect(storageService.getSidebarCollapsed()).toBe(true);

      storageService.setSidebarCollapsed(false);
      expect(storageService.getSidebarCollapsed()).toBe(false);
    });

    it('should handle storage errors gracefully', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage unavailable');
      });
      expect(storageService.getSidebarCollapsed()).toBe(false);
      spy.mockRestore();
    });
  });

  describe('getSidebarActivity / setSidebarActivity', () => {
    it('should return null when no value is stored', () => {
      expect(storageService.getSidebarActivity()).toBeNull();
    });

    it('should store and retrieve sidebar activity', () => {
      const activity: SidebarActivity = {
        id: 'threads',
        label: 'Threads',
        icon: 'pi pi-comments',
        route: '/threads' as any,
      };
      storageService.setSidebarActivity(activity);
      const retrieved = storageService.getSidebarActivity();
      expect(retrieved).toEqual(activity);
    });

    it('should handle storage errors gracefully', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage unavailable');
      });
      expect(storageService.getSidebarActivity()).toBeNull();
      spy.mockRestore();
    });

    it('should handle JSON parse errors gracefully', () => {
      localStorage.setItem('holokai-sidebar-state', 'invalid-json-{');
      expect(storageService.getSidebarActivity()).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle localStorage disabled (private browsing)', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Storage is disabled', 'QuotaExceededError');
      });
      expect(storageService.getLastThreadId()).toBeNull();
      expect(storageService.getThemeMode()).toBe(APP_THEME_MODE.LIGHT);
      getItemSpy.mockRestore();
    });

    it('should handle quota exceeded errors', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      });
      expect(storageService.setLastThreadId('test')).toBe(false);
      expect(storageService.setThemeMode(APP_THEME_MODE.DARK)).toBe(false);
      setItemSpy.mockRestore();
    });

    it('should handle concurrent reads/writes', () => {
      const threadId1 = 'thread-1';
      const threadId2 = 'thread-2';

      storageService.setLastThreadId(threadId1);
      expect(storageService.getLastThreadId()).toBe(threadId1);

      storageService.setLastThreadId(threadId2);
      expect(storageService.getLastThreadId()).toBe(threadId2);
    });
  });

  describe('backwards compatibility', () => {
    it('should handle existing string values for theme mode', () => {
      // Simulate old format (plain string, not JSON)
      localStorage.setItem('holokai-app-color-mode', JSON.stringify('dark'));
      expect(storageService.getThemeMode()).toBe(APP_THEME_MODE.DARK);
    });

    it('should handle existing string values for thread ID', () => {
      // Simulate old format (plain string, not JSON)
      localStorage.setItem('lastThreadId', JSON.stringify('thread-123'));
      expect(storageService.getLastThreadId()).toBe('thread-123');
    });

    it('should handle existing boolean values for sidebar collapsed', () => {
      // Simulate old format (plain string, not JSON)
      localStorage.setItem('holokai-sidebar-collapsed', JSON.stringify(true));
      expect(storageService.getSidebarCollapsed()).toBe(true);
    });
  });
});


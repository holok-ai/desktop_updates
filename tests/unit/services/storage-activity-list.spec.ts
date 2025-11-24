import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storageService } from '../../../src/lib/services/storage.service';

describe('StorageService - Activity List', () => {
  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  })();

  beforeEach(() => {
    // Setup localStorage mock
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    localStorageMock.clear();
  });

  describe('getActivityListWidth', () => {
    it('should return default width of 280 when not set', () => {
      const width = storageService.getActivityListWidth();
      expect(width).toBe(280);
    });

    it('should return stored width', () => {
      storageService.setActivityListWidth(350);
      const width = storageService.getActivityListWidth();
      expect(width).toBe(350);
    });

    it('should clamp width below minimum (200)', () => {
      localStorage.setItem('activityListWidth', JSON.stringify(150));
      const width = storageService.getActivityListWidth();
      expect(width).toBe(280); // Returns default for invalid value
    });

    it('should clamp width above maximum (600)', () => {
      localStorage.setItem('activityListWidth', JSON.stringify(800));
      const width = storageService.getActivityListWidth();
      expect(width).toBe(280); // Returns default for invalid value
    });

    it('should return default for invalid stored value', () => {
      localStorage.setItem('activityListWidth', 'invalid');
      const width = storageService.getActivityListWidth();
      expect(width).toBe(280);
    });
  });

  describe('setActivityListWidth', () => {
    it('should store valid width', () => {
      const result = storageService.setActivityListWidth(350);
      expect(result).toBe(true);
      expect(storageService.getActivityListWidth()).toBe(350);
    });

    it('should clamp width to minimum (200)', () => {
      storageService.setActivityListWidth(150);
      expect(storageService.getActivityListWidth()).toBe(200);
    });

    it('should clamp width to maximum (600)', () => {
      storageService.setActivityListWidth(800);
      expect(storageService.getActivityListWidth()).toBe(600);
    });

    it('should store width at minimum boundary', () => {
      storageService.setActivityListWidth(200);
      expect(storageService.getActivityListWidth()).toBe(200);
    });

    it('should store width at maximum boundary', () => {
      storageService.setActivityListWidth(600);
      expect(storageService.getActivityListWidth()).toBe(600);
    });
  });

  describe('getActivityListCollapsed', () => {
    it('should return false when not set', () => {
      const collapsed = storageService.getActivityListCollapsed();
      expect(collapsed).toBe(false);
    });

    it('should return stored collapsed state (true)', () => {
      storageService.setActivityListCollapsed(true);
      const collapsed = storageService.getActivityListCollapsed();
      expect(collapsed).toBe(true);
    });

    it('should return stored collapsed state (false)', () => {
      storageService.setActivityListCollapsed(false);
      const collapsed = storageService.getActivityListCollapsed();
      expect(collapsed).toBe(false);
    });

    it('should coerce string "true" to boolean true', () => {
      localStorage.setItem('activityListCollapsed', 'true');
      const collapsed = storageService.getActivityListCollapsed();
      expect(collapsed).toBe(true);
    });

    it('should coerce string "false" to boolean false', () => {
      localStorage.setItem('activityListCollapsed', 'false');
      const collapsed = storageService.getActivityListCollapsed();
      expect(collapsed).toBe(false);
    });

    it('should return default for invalid stored value', () => {
      localStorage.setItem('activityListCollapsed', 'invalid');
      const collapsed = storageService.getActivityListCollapsed();
      expect(collapsed).toBe(false);
    });
  });

  describe('setActivityListCollapsed', () => {
    it('should store collapsed state (true)', () => {
      const result = storageService.setActivityListCollapsed(true);
      expect(result).toBe(true);
      expect(storageService.getActivityListCollapsed()).toBe(true);
    });

    it('should store collapsed state (false)', () => {
      const result = storageService.setActivityListCollapsed(false);
      expect(result).toBe(true);
      expect(storageService.getActivityListCollapsed()).toBe(false);
    });

    it('should toggle collapsed state correctly', () => {
      storageService.setActivityListCollapsed(true);
      expect(storageService.getActivityListCollapsed()).toBe(true);

      storageService.setActivityListCollapsed(false);
      expect(storageService.getActivityListCollapsed()).toBe(false);
    });
  });

  describe('Width persistence after collapse/expand', () => {
    it('should preserve custom width after collapse and expand', () => {
      // Set custom width
      storageService.setActivityListWidth(350);
      expect(storageService.getActivityListWidth()).toBe(350);

      // Collapse
      storageService.setActivityListCollapsed(true);
      expect(storageService.getActivityListCollapsed()).toBe(true);

      // Width should still be stored
      expect(storageService.getActivityListWidth()).toBe(350);

      // Expand
      storageService.setActivityListCollapsed(false);
      expect(storageService.getActivityListCollapsed()).toBe(false);

      // Width should be preserved
      expect(storageService.getActivityListWidth()).toBe(350);
    });

    it('should handle multiple resize and collapse cycles', () => {
      // Resize to 300px
      storageService.setActivityListWidth(300);

      // Collapse
      storageService.setActivityListCollapsed(true);

      // Expand - should restore to 300px
      storageService.setActivityListCollapsed(false);
      expect(storageService.getActivityListWidth()).toBe(300);

      // Resize to 450px
      storageService.setActivityListWidth(450);

      // Collapse
      storageService.setActivityListCollapsed(true);

      // Expand - should restore to 450px
      storageService.setActivityListCollapsed(false);
      expect(storageService.getActivityListWidth()).toBe(450);
    });
  });
});

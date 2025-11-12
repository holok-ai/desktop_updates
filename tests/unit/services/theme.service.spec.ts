/**
 * Unit tests for theme.service
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { applyTheme, persistTheme } from '../../../src/lib/services/theme.service.js';
import {
  APP_THEME_MODE,
  APP_THEME_MODE_STORAGE_KEY,
} from '../../../src/lib/constants/app.constant.js';

describe('theme.service', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    // reset document element classes
    document.documentElement.className = '';

    // mock matchMedia to return a mutable object
    originalMatchMedia = window.matchMedia;
    const mediaObj: any = { matches: false, onchange: 'initial' };
    window.matchMedia = vi.fn(() => mediaObj) as any;
  });

  afterEach(() => {
    // restore
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it('applyTheme adds dark class when theme is DARK and removes when LIGHT', () => {
    applyTheme(APP_THEME_MODE.DARK);
    expect(document.documentElement.classList.contains(APP_THEME_MODE.DARK)).toBe(true);

    applyTheme(APP_THEME_MODE.LIGHT);
    expect(document.documentElement.classList.contains(APP_THEME_MODE.DARK)).toBe(false);
  });

  it('applyTheme clears system preference onchange handler', () => {
    // prepare a specific media object so we can inspect onchange
    const mediaObj: any = { matches: false, onchange: () => {} };
    window.matchMedia = vi.fn(() => mediaObj) as any;

    applyTheme(APP_THEME_MODE.LIGHT);
    expect(mediaObj.onchange).toBeNull();
  });

  it('persistTheme stores theme in localStorage and swallows errors', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');

    persistTheme(APP_THEME_MODE.DARK);
    expect(spy).toHaveBeenCalledWith(APP_THEME_MODE_STORAGE_KEY, APP_THEME_MODE.DARK);

    // simulate storage failure - should not throw
    spy.mockImplementationOnce(() => {
      throw new Error('disk full');
    });

    expect(() => persistTheme(APP_THEME_MODE.LIGHT)).not.toThrow();

    spy.mockRestore();
  });
});

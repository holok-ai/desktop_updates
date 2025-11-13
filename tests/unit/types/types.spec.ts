/**
 * Unit tests for type / constant mappings in src/lib/types
 */
import { describe, it, expect } from 'vitest';

import { APP_THEME_MODE, LOG_LEVEL } from '../../../src/lib/constants/app.constant.js';
import { ROUTE } from '../../../src/lib/constants/route.constant.js';
import { THREAD_STATUS } from '../../../src/lib/constants/status.constant.js';

// Importing the types (this is a compile-time import only; kept for clarity)
import type { AppSettings } from '../../../src/lib/types/app.type.js';
import { DEFAULT_LOG_LEVEL, getAvailableLogLevels } from '../../../src/lib/types/logger.type.js';
import type { RoutePath } from '../../../src/lib/types/route.type.js';
import { DEFAULT_ROUTE, getAvailableRoutes } from '../../../src/lib/types/route.type.js';
import type { SidebarActivity } from '../../../src/lib/types/sidebar.type.js';
import type { Message } from '../../../src/lib/types/thread.type.js';
import {
  DEFAULT_SIDEBAR_ACTIVITY,
  createSidebarActivity,
} from '../../../src/lib/types/sidebar.type.js';
import { defaultAppSettings } from '../../../src/lib/types/app.type.js';

describe('types and constants sanity checks', () => {
  it('APP_THEME_MODE contains light and dark', () => {
    expect(APP_THEME_MODE).toBeDefined();
    expect(APP_THEME_MODE.LIGHT).toBe('light');
    expect(APP_THEME_MODE.DARK).toBe('dark');
  });

  it('LOG_LEVEL contains expected levels', () => {
    expect(LOG_LEVEL).toBeDefined();
    expect(LOG_LEVEL.ERROR).toBe('error');
    expect(LOG_LEVEL.WARN).toBe('warn');
    expect(LOG_LEVEL.INFO).toBe('info');
    expect(LOG_LEVEL.DEBUG).toBe('debug');
  });

  it('ROUTE contains core route paths', () => {
    expect(ROUTE).toBeDefined();
    expect(ROUTE.HOME).toBe('/');
    expect(ROUTE.THREADS).toBe('/threads');
    expect(ROUTE.SETTINGS).toBe('/settings');
    expect(ROUTE.LOGIN).toBe('/login');
  });

  it('THREAD_STATUS contains expected values', () => {
    expect(THREAD_STATUS).toBeDefined();
    expect(THREAD_STATUS.ACTIVE).toBe('active');
    expect(THREAD_STATUS.ARCHIVED).toBe('archived');
    expect(THREAD_STATUS.DELETED).toBe('deleted');
  });

  it('can construct a valid AppSettings-like object', () => {
    const sample: AppSettings = {
      mokuWebUrl: 'https://example.com',
      mokuApiUrl: 'https://api.example.com',
      theme: APP_THEME_MODE.LIGHT as unknown as AppSettings['theme'],
      autoUpdate: true,
      updateAvailable: false,
      latestVersion: '1.0.0',
    };

    expect(typeof sample.mokuWebUrl).toBe('string');
    expect(typeof sample.mokuApiUrl).toBe('string');
    expect(typeof sample.autoUpdate).toBe('boolean');
    expect(sample.theme === APP_THEME_MODE.LIGHT || sample.theme === APP_THEME_MODE.DARK).toBe(
      true,
    );
  });

  it('defaultAppSettings is exported and has expected shape', () => {
    expect(defaultAppSettings).toBeDefined();
    expect(defaultAppSettings.mokuWebUrl).toBe('');
    expect(defaultAppSettings.mokuApiUrl).toBe('');
    expect(typeof defaultAppSettings.autoUpdate).toBe('boolean');
    expect(
      defaultAppSettings.theme === APP_THEME_MODE.LIGHT ||
        defaultAppSettings.theme === APP_THEME_MODE.DARK,
    ).toBe(true);
  });

  it('can create a SidebarActivity object', () => {
    const activity: SidebarActivity = {
      id: 'inbox',
      label: 'Inbox',
      shortLabel: 'Inb',
      icon: 'inbox-icon',
      route: ROUTE.THREADS as unknown as RoutePath,
      badge: 5,
      onClick: () => {
        /* no-op */
      },
    };

    expect(activity.id).toBe('inbox');
    expect(activity.label).toBe('Inbox');
    expect(activity.route).toBe(ROUTE.THREADS);
    expect(typeof activity.onClick).toBe('function');
  });

  it('can create a Message object shape', () => {
    const msg: Message = {
      id: 'msg_1',
      role: 'user',
      content: 'hello',
      createdAt: Date.now(),
      status: undefined,
      retryCount: 0,
    };

    expect(msg.id).toMatch(/^msg_/);
    expect(msg.role).toBe('user');
    expect(typeof msg.content).toBe('string');
    expect(typeof msg.createdAt).toBe('number');
  });

  it('logger defaults and available levels', () => {
    expect(DEFAULT_LOG_LEVEL).toBeDefined();
    const levels = getAvailableLogLevels();
    expect(Array.isArray(levels)).toBe(true);
    expect(levels).toContain('error');
    expect(levels).toContain('info');
  });

  it('route defaults and available routes', () => {
    expect(DEFAULT_ROUTE).toBe('/');
    const routes = getAvailableRoutes();
    expect(Array.isArray(routes)).toBe(true);
    expect(routes).toContain('/');
    expect(routes).toContain('/threads');
  });

  it('sidebar defaults and factory', () => {
    expect(DEFAULT_SIDEBAR_ACTIVITY).toBeDefined();
    const custom = createSidebarActivity({ id: 'inbox', label: 'Inbox' });
    expect(custom.id).toBe('inbox');
    expect(custom.label).toBe('Inbox');
  });
});

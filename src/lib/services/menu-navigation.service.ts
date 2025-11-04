import { ROUTE } from '../constants/route.constant';
import type { RoutePath } from '../types/route.type';

export class MenuNavigationService {
  private static instance: MenuNavigationService | null = null;
  private cleanupFunctions: Array<() => void> = [];

  private constructor() {
    this.setupListeners();
  }

  public static getInstance(): MenuNavigationService {
    MenuNavigationService.instance ??= new MenuNavigationService();
    return MenuNavigationService.instance;
  }

  private setupListeners(): void {
    const { electronAPI } = globalThis as unknown as {
      electronAPI: { onMenuCommand: (channel: string, handler: () => void) => () => void } | null;
    };
    if (electronAPI === null || electronAPI === undefined) {
      return;
    }

    const routePaths = ROUTE as Record<string, RoutePath>;

    const commands = [
      {
        channel: 'menu:new-thread',
        handler: () => {
          // Navigate to threads create using the existing navigate helper so tests
          // can intercept via `globalThis.__routerPush` without requiring the
          // SPA router to be present during unit tests.
          void this.navigate(routePaths.THREADS, { create: '' });
        },
      },
      {
        channel: 'menu:refresh',
        handler: () => {
          globalThis.location.reload();
        },
      },
      {
        channel: 'menu:settings',
        handler: () => {
          void this.navigate(routePaths.SETTINGS);
        },
      },
      {
        channel: 'menu:getting-started',
        handler: () => {
          void this.navigate(routePaths.HOME);
        },
      },
      {
        channel: 'menu:users-guide',
        handler: () => {
          void this.navigate(routePaths.GUIDE);
        },
      },
    ];

    for (const { channel, handler } of commands) {
      this.cleanupFunctions.push(electronAPI.onMenuCommand(channel, handler));
    }
  }

  public navigate(path: RoutePath, params?: Record<string, string>): void {
    const search =
      params !== undefined && params !== null && Object.keys(params).length > 0
        ? `?${new URLSearchParams(params).toString()}`
        : '';
    // Prefer a global router push helper in tests/environments to avoid bundler
    // static resolution of optional router dependencies during test transforms.
    const globalObj = globalThis as unknown as Record<string, unknown>;
    // allow bracket access because property may be injected in tests as __routerPush
    // eslint-disable-next-line dot-notation
    const maybePush = globalObj['__routerPush'] ?? globalObj['routerPush'];
    if (typeof maybePush === 'function') {
      (maybePush as (p: string) => void)(`${path}${search}`);
      return;
    }

    // If no global helper is available, log a warning. The real app should
    // provide routing through the SPA router; in unit tests we set
    // `globalThis.__routerPush = vi.fn()` to capture navigation calls.
    // Avoid importing 'svelte-spa-router' here to prevent Vite from trying to
    // resolve it in the test environment.
    console.warn('[MenuNavigationService] router push not available');
  }

  public destroy(): void {
    for (const cleanup of this.cleanupFunctions) {
      cleanup();
    }
    this.cleanupFunctions = [];
  }
}

export const menuNavigationService = MenuNavigationService.getInstance();

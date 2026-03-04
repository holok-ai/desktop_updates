import { ROUTE } from '../constants/route.constant';
import type { RoutePath } from '../types/route.type';
import { breadcrumbStore } from '../stores/breadcrumb.store';

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
          breadcrumbStore.clearAndPush({ label: 'New Thread', route: routePaths.NEW_THREAD });
          this.navigate(routePaths.THREADS, { createThread: '' });
        },
      },
      {
        channel: 'menu:new-project',
        handler: () => {
          breadcrumbStore.clearAndPush({ label: 'Projects', route: routePaths.PROJECTS });
          this.navigate(routePaths.PROJECTS, { createProject: '' });
        },
      },
      {
        channel: 'menu:refresh',
        handler: async () => {
          // Force reload from API before reloading the renderer
          await window.electronAPI.models.listAllApplications(true);
          globalThis.location.reload();
        },
      },
      {
        channel: 'menu:settings',
        handler: () => {
          breadcrumbStore.clearAndPush({ label: 'Settings', route: routePaths.SETTINGS });
          this.navigate(routePaths.SETTINGS);
        },
      },
      {
        channel: 'menu:getting-started',
        handler: () => {
          breadcrumbStore.clearAndPush({ label: 'New Thread', route: routePaths.HOME });
          this.navigate(routePaths.HOME);
        },
      },
      {
        channel: 'menu:users-guide',
        handler: () => {
          this.navigate(routePaths.GUIDE);
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

    // Fallback for hash-based routing used by svelte-spa-router
    // This ensures navigation works without a global router helper.
    const href = `#${path}${search}`;
    if (globalThis.location.hash !== href) {
      globalThis.location.hash = href;
    } else {
      // trigger route reload if already on same hash
      globalThis.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }

  public destroy(): void {
    for (const cleanup of this.cleanupFunctions) {
      cleanup();
    }
    this.cleanupFunctions = [];
  }
}

export const menuNavigationService = MenuNavigationService.getInstance();

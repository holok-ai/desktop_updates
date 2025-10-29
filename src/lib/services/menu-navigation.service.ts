import { ROUTE, type RoutePath } from '../constants/route.constant';
import { push } from 'svelte-spa-router';

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
    const { electronAPI } = (globalThis as unknown as { electronAPI: { onMenuCommand: (channel: string, handler: () => void) => () => void } | null });
    if (electronAPI === null || electronAPI === undefined) {
      return;
    }

    const routePaths = ROUTE as Record<string, RoutePath>;

    const commands = [
      {
        channel: 'menu:new-thread',
        handler: () => {
          void push(`${routePaths.THREADS}?create`);
        }
      },
      {
        channel: 'menu:refresh',
        handler: () => {
          globalThis.location.reload();
        }
      },
      {
        channel: 'menu:settings',
        handler: () => {
          this.navigate(routePaths.SETTINGS);
        }
      },
      {
        channel: 'menu:getting-started',
        handler: () => {
          this.navigate(routePaths.HOME);
        }
      },
      {
        channel: 'menu:users-guide',
        handler: () => {
          this.navigate(routePaths.GUIDE);
        }
      }
    ];

    for (const { channel, handler } of commands) {
      this.cleanupFunctions.push(electronAPI.onMenuCommand(channel, handler));
    }
  }

  public navigate(path: RoutePath, params?: Record<string, string>): void {
    const search = params !== undefined && params !== null && Object.keys(params).length > 0
      ? `?${new URLSearchParams(params).toString()}`
      : '';
    void push(`${path}${search}`);
  }

  public destroy(): void {
    for (const cleanup of this.cleanupFunctions) {
      cleanup();
    };
    this.cleanupFunctions = [];
  }
}

export const menuNavigationService = MenuNavigationService.getInstance();

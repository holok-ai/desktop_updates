import { ROUTE, type RoutePath } from '../constants/route.constant';
import { router } from './router.service';

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
          this.navigate(routePaths.THREADS, { openCreateDialog: 'true' });
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
    router.navigate(path, params);
  }

  public destroy(): void {
    for (const cleanup of this.cleanupFunctions) {
      cleanup();
    };
    this.cleanupFunctions = [];
  }
}

export const menuNavigationService = MenuNavigationService.getInstance();

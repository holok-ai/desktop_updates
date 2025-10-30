import { describe, it, expect, vi } from 'vitest';

describe('MenuNavigationService extra branches', () => {
  it('initializes without electronAPI (no-op)', async () => {
    vi.resetModules();
    // ensure no electronAPI
    // @ts-ignore
    delete (globalThis as any).electronAPI;

    const mod = await import('../../../src/lib/services/menu-navigation.service');
    // import should not throw even if electronAPI is missing
    expect(mod.menuNavigationService).toBeTruthy();
  });

  it('registers commands and invoked handlers call router and reload', async () => {
    vi.resetModules();

    const registered: Record<string, Function> = {};
    // provide a global router push helper
    // @ts-ignore
    globalThis.__routerPush = vi.fn();
    // mock location.reload
    // @ts-ignore
    globalThis.location = { reload: vi.fn() };

    // @ts-ignore
    globalThis.electronAPI = {
      onMenuCommand: (channel: string, handler: () => void) => {
        registered[channel] = handler;
        return () => {
          delete registered[channel];
        };
      },
    };

    const mod = await import('../../../src/lib/services/menu-navigation.service');
    const { menuNavigationService } = mod;

    // simulate menu events
    // new thread -> should call navigate -> __routerPush
    registered['menu:new-thread']();
    // refresh -> should call location.reload
    registered['menu:refresh']();
    // settings/getting-started/users-guide -> call navigate which uses __routerPush
    registered['menu:settings']();
    registered['menu:getting-started']();
    registered['menu:users-guide']();

    // assertions
    // @ts-ignore
    expect((globalThis as any).__routerPush).toHaveBeenCalled();
    // @ts-ignore
    expect(globalThis.location.reload).toHaveBeenCalled();

    // cleanup
    menuNavigationService.destroy();
  });
});

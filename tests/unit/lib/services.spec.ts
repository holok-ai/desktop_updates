import { describe, it, expect, beforeEach, vi } from 'vitest';

// Provide a global router push helper for tests (set per-test as needed)

describe('lib services', () => {
  beforeEach(() => {
    vi.resetModules();
    // ensure window exists for tests
    // @ts-ignore
    global.window = global.window || {};
  });

  it('electronService.api throws when electronAPI missing and works when present', async () => {
    const { electronService } = await import('../../../src/lib/services/electron.service');

    // ensure electronAPI undefined
    // @ts-ignore
    delete (global.window as any).electronAPI;
    expect(() => (electronService as any).api).toThrow('Electron API not available');

    // provide minimal electronAPI
    // @ts-ignore
    global.window.electronAPI = {
      system: { platform: () => 'darwin', version: () => '1.0.0' },
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };

    expect(await electronService.getPlatform()).toBe('darwin');
    expect(await electronService.getVersion()).toBe('1.0.0');
    electronService.log.info('x');
    electronService.log.warn('y');
    electronService.log.error('z');
    expect((global.window as any).electronAPI.log.info).toHaveBeenCalled();
  });

  it('menuNavigationService registers commands and navigate works', async () => {
    // provide a global router push helper used by MenuNavigationService in tests
    // @ts-ignore
    globalThis.__routerPush = vi.fn();

    // prepare electronAPI with onMenuCommand
    let registered: Record<string, Function> = {};
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

    // navigate should call the global router push helper
    // @ts-ignore
    await menuNavigationService.navigate('/test', { a: 'b' });
    // @ts-ignore
    expect((globalThis as any).__routerPush).toHaveBeenCalled();

    // cleanup
    menuNavigationService.destroy();
  });

  it('threadService calls thread API and updates store', async () => {
    // mock thread store (create mocked functions inside factory to avoid vi.mock hoisting issues)
    vi.mock('../../../src/lib/stores/thread.store', () => ({
      threads: {
        addThread: vi.fn(),
        setThreads: vi.fn(),
        updateThread: vi.fn(),
        deleteThread: vi.fn(),
      },
    }));

    // mock electron API thread
    // @ts-ignore
    global.window.electronAPI = {
      thread: {
        onThreadCreated: (cb: Function) => {},
        onThreadUpdated: (cb: Function) => {},
        onThreadDeleted: (cb: Function) => {},
        getAll: async () => [{ id: 't1' }],
        create: async (d: any) => ({ id: 't2', ...d }),
        update: async (id: string, u: any) => ({ id, ...u }),
        delete: async (id: string) => true,
      },
    };

    const mod = await import('../../../src/lib/services/thread.service');
    const { threadService } = mod;

    const all = await threadService.getAll();
    const mockedStore = await vi.importMock('../../../src/lib/stores/thread.store');
    expect(mockedStore.threads.setThreads).toHaveBeenCalled();
    expect(all).toHaveLength(1);

    const created = await threadService.create({ title: 'x', metadata: {}, messages: [] } as any);
    expect(created.id).toBe('t2');

    const updated = await threadService.update('t2', { title: 'y' } as any);
    expect(updated.id).toBe('t2');

    const deleted = await threadService.delete('t2');
    expect(deleted).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';

describe('main.ts branch combinations', () => {
  const originalPlatform = process.platform;
  const originalArgv = process.argv.slice();
  const originalDefaultApp = (process as any).defaultApp;

  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    process.argv = originalArgv.slice();
    (process as any).defaultApp = originalDefaultApp;
  });

  it('registers protocol in production (defaultApp=false)', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    (process as any).defaultApp = false;

    const captured: { called: boolean; args: any[] } = { called: false, args: [] };
    const electronMock: any = {
      app: {
        getPath: () => '/mock',
        setAsDefaultProtocolClient: (...args: any[]) => {
          captured.called = true;
          captured.args = args;
        },
        on: vi.fn(),
        whenReady: () => Promise.resolve(),
        requestSingleInstanceLock: vi.fn(() => true),
        quit: vi.fn(),
      },
      BrowserWindow: class {
        webContents: any = { send: vi.fn() };
        constructor() {
          (this as any).loadURL = async (_u: string) => Promise.resolve();
          (this as any).loadFile = async (_f: string) => Promise.resolve();
        }
        on(_ev: string, _cb: any) {}
        static getAllWindows() {
          return [];
        }
      },
      Menu: { buildFromTemplate: vi.fn(() => ({})), setApplicationMenu: vi.fn() },
      dialog: { showMessageBox: vi.fn(() => Promise.resolve({})) },
      ipcMain: { handle: vi.fn(), on: vi.fn() },
    };

    vi.doMock('electron', () => electronMock);
    vi.doMock('electron-log', () => ({
      default: { info: vi.fn(), transports: { file: {}, console: {} } },
    }));
    vi.doMock('../../../src-electron/ipc-handlers/auth-handler', () => ({
      registerAuthHandlers: vi.fn(),
      handleOAuthCallback: vi.fn(),
    }));
    vi.doMock('../../../src-electron/ipc-handlers/settings-handler', () => ({
      registerSettingsHandlers: vi.fn(),
    }));
    vi.doMock('../../../src-electron/ipc-handlers/thread-handler', () => ({
      registerThreadHandlers: vi.fn(),
    }));
    vi.doMock('../../../src-electron/ipc-handlers/system-handler', () => ({
      registerSystemHandlers: vi.fn(),
    }));
    vi.doMock('../../../src-electron/main-utils', () => ({
      registerProtocol: vi.fn(),
      createWindowFactory: vi.fn(() => () => new electronMock.BrowserWindow()),
      handleOpenUrl: vi.fn(),
      windowsProtocolStartupHandler: vi.fn(),
      registerActivateHandler: vi.fn(),
      registerSecondInstanceHandler: vi.fn(() => true),
    }));

    await import('../../../src-electron/main');

    expect(captured.called).toBe(true);
    expect(typeof captured.args[0]).toBe('string');
  });

  it('registers protocol when defaultApp=true and argv provided', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    (process as any).defaultApp = true;
    process.argv = ['/node', '/path/to/app'];

    const called: { v: boolean; args: any[] } = { v: false, args: [] };
    const electronMock: any = {
      app: {
        getPath: () => '/mock',
        setAsDefaultProtocolClient: (...a: any[]) => {
          called.v = true;
          called.args = a;
        },
        on: vi.fn(),
        whenReady: () => Promise.resolve(),
        requestSingleInstanceLock: vi.fn(() => true),
        quit: vi.fn(),
      },
      BrowserWindow: class {
        webContents: any = { send: vi.fn() };
        constructor() {
          (this as any).loadURL = async (_u: string) => Promise.resolve();
          (this as any).loadFile = async (_f: string) => Promise.resolve();
        }
        on(_ev: string, _cb: any) {}
        static getAllWindows() {
          return [];
        }
      },
      Menu: { buildFromTemplate: vi.fn(() => ({})), setApplicationMenu: vi.fn() },
      dialog: { showMessageBox: vi.fn(() => Promise.resolve({})) },
      ipcMain: { handle: vi.fn(), on: vi.fn() },
    };

    vi.doMock('electron', () => electronMock);
    vi.doMock('electron-log', () => ({
      default: { info: vi.fn(), transports: { file: {}, console: {} } },
    }));
    vi.doMock('../../../src-electron/ipc-handlers/auth-handler', () => ({
      registerAuthHandlers: vi.fn(),
      handleOAuthCallback: vi.fn(),
    }));
    vi.doMock('../../../src-electron/ipc-handlers/settings-handler', () => ({
      registerSettingsHandlers: vi.fn(),
    }));
    vi.doMock('../../../src-electron/ipc-handlers/thread-handler', () => ({
      registerThreadHandlers: vi.fn(),
    }));
    vi.doMock('../../../src-electron/ipc-handlers/system-handler', () => ({
      registerSystemHandlers: vi.fn(),
    }));
    vi.doMock('../../../src-electron/main-utils', () => ({
      registerProtocol: vi.fn(),
      createWindowFactory: vi.fn(() => () => new electronMock.BrowserWindow()),
      handleOpenUrl: vi.fn(),
      windowsProtocolStartupHandler: vi.fn(),
      registerActivateHandler: vi.fn(),
      registerSecondInstanceHandler: vi.fn(() => true),
    }));

    await import('../../../src-electron/main');

    expect(called.v).toBe(true);
    expect(called.args.length).toBeGreaterThan(0);
  });

  it('windows startup protocol triggers handleOAuthCallback via ready handler', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.argv = ['/exe', 'holokai://home?code=1'];
    vi.useFakeTimers();

    const electronMock: any = {
      app: {
        getPath: () => '/mock',
        setAsDefaultProtocolClient: vi.fn(),
        on: vi.fn((ev: string, cb: Function) => {
          if (ev === 'ready') setTimeout(cb, 0);
        }),
        whenReady: () => Promise.resolve(),
        requestSingleInstanceLock: vi.fn(() => true),
        quit: vi.fn(),
      },
      BrowserWindow: class {
        webContents: any = { send: vi.fn() };
        constructor() {
          (this as any).loadURL = async (_u: string) => Promise.resolve();
          (this as any).loadFile = async (_f: string) => Promise.resolve();
        }
        on(_ev: string, _cb: any) {}
        static getAllWindows() {
          return [];
        }
      },
      Menu: { buildFromTemplate: vi.fn(() => ({})), setApplicationMenu: vi.fn() },
      dialog: { showMessageBox: vi.fn(() => Promise.resolve({})) },
      ipcMain: { handle: vi.fn(), on: vi.fn() },
    };

    const handleOAuthCallback = vi.fn();
    vi.doMock('electron', () => electronMock);
    vi.doMock('electron-log', () => ({
      default: { info: vi.fn(), transports: { file: {}, console: {} } },
    }));
    vi.doMock('../../../src-electron/ipc-handlers/auth-handler', () => ({
      registerAuthHandlers: vi.fn(),
      handleOAuthCallback,
    }));
    vi.doMock('../../../src-electron/ipc-handlers/settings-handler', () => ({
      registerSettingsHandlers: vi.fn(),
    }));
    vi.doMock('../../../src-electron/ipc-handlers/thread-handler', () => ({
      registerThreadHandlers: vi.fn(),
    }));
    vi.doMock('../../../src-electron/ipc-handlers/system-handler', () => ({
      registerSystemHandlers: vi.fn(),
    }));
    vi.doMock('../../../src-electron/main-utils', () => ({
      registerProtocol: vi.fn(),
      createWindowFactory: vi.fn(() => () => new electronMock.BrowserWindow()),
      handleOpenUrl: vi.fn(),
      windowsProtocolStartupHandler: vi.fn(),
      registerActivateHandler: vi.fn(),
      registerSecondInstanceHandler: vi.fn(() => true),
    }));

    await import('../../../src-electron/main');
    // advance timers to let ready handler timeouts run
    await vi.runAllTimersAsync();
    expect(handleOAuthCallback).toHaveBeenCalledWith(
      expect.stringContaining('holokai://home'),
      expect.anything(),
    );
    vi.useRealTimers();
  });
});

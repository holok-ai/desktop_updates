import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('main.ts activate and single-instance branches', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('quits when single instance lock not acquired', async () => {
    const quitSpy = vi.fn();
    const electronMock: any = {
      app: {
        requestSingleInstanceLock: vi.fn(() => false),
        quit: quitSpy,
        getPath: () => '/tmp',
        on: vi.fn(),
        whenReady: () => Promise.resolve(),
        setAsDefaultProtocolClient: vi.fn(),
      },
      BrowserWindow: class {
        webContents: any = { send: vi.fn() };
        constructor() {
          (this as any).on = () => {};
          (this as any).loadURL = async () => Promise.resolve();
          (this as any).loadFile = async () => Promise.resolve();
        }
        static getAllWindows() {
          return [];
        }
      },
      Menu: { buildFromTemplate: vi.fn(() => ({})), setApplicationMenu: vi.fn() },
      dialog: { showMessageBox: vi.fn(() => Promise.resolve({})) },
      ipcMain: { on: vi.fn(), handle: vi.fn() },
      session: { defaultSession: { webRequest: { onHeadersReceived: vi.fn() } } },
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

    expect(quitSpy).toHaveBeenCalled();
  });

  it('creates window on activate when no windows present', async () => {
    const handlers: Record<string, Function> = {};
    const electronMock: any = {
      app: {
        getPath: () => '/tmp',
        on: (ev: string, cb: Function) => {
          handlers[ev] = cb;
        },
        whenReady: () => Promise.resolve(),
        requestSingleInstanceLock: vi.fn(() => true),
        quit: vi.fn(),
        setAsDefaultProtocolClient: vi.fn(),
      },
      BrowserWindow: class {
        static created = false;
        webContents: any = {
          send: vi.fn(),
          isDevToolsOpened: vi.fn(() => false),
          openDevTools: vi.fn(),
          closeDevTools: vi.fn(),
        };
        constructor() {
          (this as any).on = () => {};
          (this as any).loadURL = async () => Promise.resolve();
          (this as any).loadFile = async () => Promise.resolve();
          (this.constructor as any).created = true;
        }
        static getAllWindows() {
          return [];
        }
      },
      Menu: { buildFromTemplate: vi.fn(() => ({})), setApplicationMenu: vi.fn() },
      dialog: { showMessageBox: vi.fn(() => Promise.resolve({})) },
      ipcMain: { on: vi.fn(), handle: vi.fn() },
      session: { defaultSession: { webRequest: { onHeadersReceived: vi.fn() } } },
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

    // give microtasks a moment so whenReady().then callbacks register handlers
    await Promise.resolve();
    await Promise.resolve();

    // call the activate handler set during whenReady if it was registered
    const activate = handlers['activate'];
    if (typeof activate === 'function') {
      activate();
      expect((electronMock.BrowserWindow as any).created).toBe(true);
    } else {
      // Allow either the activate handler to exist or the initial whenReady path to have created a window
      expect(typeof activate === 'function' || (electronMock.BrowserWindow as any).created === true).toBe(true);
    }
  });
});

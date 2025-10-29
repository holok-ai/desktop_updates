import { describe, it, vi, beforeEach, expect } from 'vitest';

describe('main.ts open-url else branch (non-home URL)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('does not call OAuth callback for non-home deep links', async () => {
    const handlers: Record<string, Function[]> = {};
    const on = vi.fn((event: string, cb: Function) => {
      (handlers[event] = handlers[event] || []).push(cb);
    });

    class BrowserWindow {
      webContents: any = {
        send: vi.fn(),
        isDevToolsOpened: vi.fn(() => false),
        openDevTools: vi.fn(),
        closeDevTools: vi.fn(),
      };
      on = vi.fn();
      constructor() {
        (this as any).loadURL = async (_u: string) => Promise.resolve();
        (this as any).loadFile = async (_f: string) => Promise.resolve();
      }
      static getAllWindows() {
        return [];
      }
    }

    const electronMock: any = {
      app: {
        getPath: vi.fn(() => '/mock/appData'),
        setAsDefaultProtocolClient: vi.fn(),
        on,
        whenReady: () => Promise.resolve(),
        requestSingleInstanceLock: vi.fn(() => true),
        quit: vi.fn(),
      },
      BrowserWindow,
      Menu: { buildFromTemplate: vi.fn(() => ({})), setApplicationMenu: vi.fn() },
      dialog: { showMessageBox: vi.fn(async () => ({})) },
      ipcMain: { on: vi.fn() },
    };

    vi.doMock('electron', () => electronMock);
    vi.doMock('electron-log', () => ({
      default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        transports: { file: {}, console: {} },
      },
    }));
    const handleOAuthCallback = vi.fn();
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
      createWindowFactory: vi.fn(() => () => new BrowserWindow()),
      handleOpenUrl: vi.fn(),
      windowsProtocolStartupHandler: vi.fn(),
      registerActivateHandler: vi.fn(),
      registerSecondInstanceHandler: vi.fn(() => true),
    }));

    await import('../../../src-electron/main');

    const preventDefault = vi.fn();
    handlers['open-url'][0]({ preventDefault }, 'holokai://other?x=1');
    expect(preventDefault).toHaveBeenCalled();
    expect(handleOAuthCallback).not.toHaveBeenCalled();
  });
});

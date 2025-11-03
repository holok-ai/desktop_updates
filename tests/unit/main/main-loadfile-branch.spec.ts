import { describe, it, expect, vi } from 'vitest';

describe('main.ts loadFile fallback branch', () => {
  it('falls back to loadFile when dev server not available', async () => {
    vi.resetModules();

    const fileLoaded = { v: false };

    const electronMock: any = {
      app: {
        getPath: () => '/mock',
        whenReady: () => Promise.resolve(),
        on: vi.fn(),
        requestSingleInstanceLock: vi.fn(() => true),
        quit: vi.fn(),
        setAsDefaultProtocolClient: vi.fn(),
      },
      BrowserWindow: class {
        webContents: any = {
          send: vi.fn(),
          isDevToolsOpened: vi.fn(() => false),
          openDevTools: vi.fn(),
          closeDevTools: vi.fn(),
        };
        constructor() {
          // simulate dev server not available
          (this as any).loadURL = async (_u: string) => {
            throw new Error('dev not available');
          };
          (this as any).loadFile = async (_f: string) => {
            fileLoaded.v = true;
          };
        }
        on(_ev: string, _cb: any) {}
        static getAllWindows() {
          return [];
        }
      },
      Menu: { buildFromTemplate: vi.fn(() => ({})), setApplicationMenu: vi.fn() },
      dialog: { showMessageBox: vi.fn(() => Promise.resolve({})) },
      ipcMain: { handle: vi.fn(), on: vi.fn() },
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

    expect(fileLoaded.v).toBe(true);
  });
});

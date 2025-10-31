import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('main.ts log resolvePathFn', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('assigns and invokes resolvePathFn to compute log file path', async () => {
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
        on: vi.fn(),
        whenReady: () => Promise.resolve(),
        requestSingleInstanceLock: vi.fn(() => true),
        quit: vi.fn(),
      },
      BrowserWindow,
      Menu: { buildFromTemplate: vi.fn(() => ({})), setApplicationMenu: vi.fn() },
      dialog: { showMessageBox: vi.fn(async () => ({})) },
      ipcMain: { on: vi.fn() },
      session: { defaultSession: { webRequest: { onHeadersReceived: vi.fn() } } },
    };

    vi.doMock('electron', () => electronMock);

    const logObj = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      transports: { file: {}, console: {} },
    } as any;
    vi.doMock('electron-log', () => ({ default: logObj }));

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
      createWindowFactory: vi.fn(() => () => new BrowserWindow()),
      handleOpenUrl: vi.fn(),
      windowsProtocolStartupHandler: vi.fn(),
      registerActivateHandler: vi.fn(),
      registerSecondInstanceHandler: vi.fn(() => true),
    }));

    await import('../../../src-electron/main');

    expect(typeof logObj.transports.file.resolvePathFn).toBe('function');
    const p = logObj.transports.file.resolvePathFn();
    expect(p).toContain('/mock/appData');
    expect(p).toMatch(/desktop_\d{8}\.log$/);
  });
});

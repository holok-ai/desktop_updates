import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('main.ts ipc log channels', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('registers log channels and they call logger correctly', async () => {
    const handlers: Record<string, Function> = {} as any;
    const on = vi.fn((ch: string, cb: Function) => { handlers[ch] = cb as any; });
    const invokeHandler = (channel: string, ...args: any[]) => {
      const cb = handlers[channel];
      return cb?.({}, ...args);
    };

    class BrowserWindow {
      webContents: any;
      constructor() {
        this.webContents = { send: vi.fn(), isDevToolsOpened: vi.fn(() => false), openDevTools: vi.fn(), closeDevTools: vi.fn() };
        (this as any).loadURL = vi.fn(async () => Promise.resolve());
        (this as any).loadFile = vi.fn(async () => Promise.resolve());
        (this as any).on = vi.fn();
      }
      static getAllWindows() { return []; }
    }

    const app = {
      getPath: vi.fn(() => '/mock/appData'),
      setAsDefaultProtocolClient: vi.fn(),
      on: vi.fn(),
      whenReady: () => Promise.resolve(),
      requestSingleInstanceLock: vi.fn(() => true),
      quit: vi.fn(),
    } as any;

    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), transports: { file: {}, console: {} } } as any;

    const session = { defaultSession: { webRequest: { onHeadersReceived: vi.fn() } } };

    vi.doMock('electron', () => ({ app, BrowserWindow, Menu: { buildFromTemplate: vi.fn(() => ({})), setApplicationMenu: vi.fn() }, dialog: { showMessageBox: vi.fn(async () => ({})) }, ipcMain: { on }, session, contextBridge: { exposeInMainWorld: vi.fn() }, ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() } }));
    vi.doMock('electron-log', () => ({ default: log }));
    vi.doMock('../../../src-electron/ipc-handlers/auth-handler', () => ({ registerAuthHandlers: vi.fn(), handleOAuthCallback: vi.fn() }));
    vi.doMock('../../../src-electron/ipc-handlers/settings-handler', () => ({ registerSettingsHandlers: vi.fn() }));
    vi.doMock('../../../src-electron/ipc-handlers/thread-handler', () => ({ registerThreadHandlers: vi.fn() }));
    vi.doMock('../../../src-electron/ipc-handlers/system-handler', () => ({ registerSystemHandlers: vi.fn() }));
    vi.doMock('../../../src-electron/main-utils', () => ({ registerProtocol: vi.fn(), createWindowFactory: vi.fn(() => () => new BrowserWindow()), handleOpenUrl: vi.fn(), windowsProtocolStartupHandler: vi.fn(), registerActivateHandler: vi.fn(), registerSecondInstanceHandler: vi.fn(() => true) }));

    await import('../../../src-electron/main');

    // Invoke channels
    invokeHandler('log:info', 'i', 1);
    expect(log.info).toHaveBeenCalledWith('[Renderer]', 'i', 1);
    invokeHandler('log:warn', 'w');
    expect(log.warn).toHaveBeenCalledWith('[Renderer]', 'w');
    invokeHandler('log:error', 'e', { a: 1 });
    expect(log.error).toHaveBeenCalledWith('[Renderer]', 'e', { a: 1 });
    invokeHandler('log:debug', 'd');
    expect(log.debug).toHaveBeenCalledWith('[Renderer]', 'd');
  });
});



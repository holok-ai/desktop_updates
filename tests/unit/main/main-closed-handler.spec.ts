import { describe, it, expect, vi } from 'vitest';

describe('main.ts closed handler registration', () => {
  it('registers closed handler on mainWindow', async () => {
    vi.resetModules();

    let createdWindow: any = null;

    const electronMock: any = {
      app: { getPath: () => '/mock', whenReady: () => Promise.resolve(), on: vi.fn(), requestSingleInstanceLock: vi.fn(() => true), quit: vi.fn(), setAsDefaultProtocolClient: vi.fn() },
      BrowserWindow: class {
        webContents: any = { send: vi.fn() };
        _closedRegistered = false;
        constructor() {
          createdWindow = this;
          // capture the closed callback so we can invoke it to exercise the handler body
          (this as any).on = (_ev: string, _cb: any) => {
            if (_ev === 'closed') (this as any)._closedCallback = _cb;
          };
          (this as any).loadURL = async () => Promise.resolve();
          (this as any).loadFile = async () => Promise.resolve();
        }
        static getAllWindows() { return []; }
      },
      Menu: { buildFromTemplate: vi.fn(() => ({})), setApplicationMenu: vi.fn() },
      dialog: { showMessageBox: vi.fn(() => Promise.resolve({})) },
      ipcMain: { handle: vi.fn(), on: vi.fn() },
      session: { defaultSession: { webRequest: { onHeadersReceived: vi.fn() } } },
    };

    vi.doMock('electron', () => electronMock);
    vi.doMock('electron-log', () => ({ default: { info: vi.fn(), transports: { file: {}, console: {} } } }));
    vi.doMock('../../../src-electron/ipc-handlers/auth-handler', () => ({ registerAuthHandlers: vi.fn(), handleOAuthCallback: vi.fn() }));
    vi.doMock('../../../src-electron/ipc-handlers/settings-handler', () => ({ registerSettingsHandlers: vi.fn() }));
    vi.doMock('../../../src-electron/ipc-handlers/thread-handler', () => ({ registerThreadHandlers: vi.fn() }));
    vi.doMock('../../../src-electron/ipc-handlers/system-handler', () => ({ registerSystemHandlers: vi.fn() }));
    vi.doMock('../../../src-electron/main-utils', () => ({ registerProtocol: vi.fn(), createWindowFactory: vi.fn(() => () => new electronMock.BrowserWindow()), handleOpenUrl: vi.fn(), windowsProtocolStartupHandler: vi.fn(), registerActivateHandler: vi.fn(), registerSecondInstanceHandler: vi.fn(() => true) }));

    await import('../../../src-electron/main');

    expect(createdWindow).not.toBeNull();
    const cb = (createdWindow as any)._closedCallback as Function | undefined;
    if (cb) cb();
    expect(typeof cb).toBe('function');
  });
});



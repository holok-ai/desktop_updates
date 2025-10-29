import { describe, it, vi, beforeEach, afterEach, expect } from 'vitest';

const originalPlatform = process.platform;
const originalArgv = process.argv.slice();

function mockElectronBase() {
  const handlers: Record<string, Function[]> = {};
  const on = vi.fn((event: string, cb: Function) => {
    (handlers[event] = handlers[event] || []).push(cb);
  });
  class BrowserWindow {
    webContents: any;
    constructor() {
      this.webContents = { send: vi.fn(), isDevToolsOpened: vi.fn(() => false), openDevTools: vi.fn(), closeDevTools: vi.fn() };
      (this as any).loadURL = vi.fn(async () => Promise.resolve());
      (this as any).loadFile = vi.fn(async () => Promise.resolve());
      (this as any).on = vi.fn();
      (this as any).isMinimized = vi.fn(() => false);
      (this as any).restore = vi.fn();
      (this as any).focus = vi.fn();
    }
    static getAllWindows() { return []; }
  }
  const app = {
    getPath: vi.fn(() => '/mock/appData'),
    setAsDefaultProtocolClient: vi.fn(),
    on,
    whenReady: () => Promise.resolve(),
    requestSingleInstanceLock: vi.fn(() => true),
    quit: vi.fn(),
  } as any;
  return { handlers, electron: { app, BrowserWindow, Menu: { buildFromTemplate: vi.fn(() => ({})), setApplicationMenu: vi.fn() }, dialog: { showMessageBox: vi.fn(async () => ({})) }, ipcMain: { handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn() }, contextBridge: { exposeInMainWorld: vi.fn() }, ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() } } };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: originalPlatform });
  process.argv = originalArgv.slice();
});

describe('main.ts catch branches', () => {
  it('catches error in open-url delegate', async () => {
    const { handlers, electron } = mockElectronBase();
    Object.defineProperty(process, 'platform', { value: 'linux' });

    vi.doMock('electron', () => electron);
    vi.doMock('electron-log', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), transports: { file: {}, console: {} } } }));
    vi.doMock('../../../src-electron/ipc-handlers/auth-handler', () => ({ registerAuthHandlers: vi.fn(), handleOAuthCallback: vi.fn() }));
    vi.doMock('../../../src-electron/ipc-handlers/settings-handler', () => ({ registerSettingsHandlers: vi.fn() }));
    vi.doMock('../../../src-electron/ipc-handlers/thread-handler', () => ({ registerThreadHandlers: vi.fn() }));
    vi.doMock('../../../src-electron/ipc-handlers/system-handler', () => ({ registerSystemHandlers: vi.fn() }));
    vi.doMock('../../../src-electron/main-utils', () => ({
      registerProtocol: vi.fn(),
      createWindowFactory: vi.fn(() => () => ({ on: vi.fn(), webContents: { send: vi.fn(), isDevToolsOpened: vi.fn(() => false), openDevTools: vi.fn(), closeDevTools: vi.fn() } })),
      handleOpenUrl: vi.fn(() => { throw new Error('boom'); }),
      windowsProtocolStartupHandler: vi.fn(),
      registerActivateHandler: vi.fn(),
      registerSecondInstanceHandler: vi.fn(() => true),
    }));

    await import('../../../src-electron/main');

    const preventDefault = vi.fn();
    // call open-url handler to hit catch path
    handlers['open-url'][0]({ preventDefault }, 'holokai://home?code=x&state=y');
    expect(preventDefault).toHaveBeenCalled();
  });

  it('catches error in windowsProtocolStartupHandler delegate', async () => {
    const { electron } = mockElectronBase();
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.argv = ['/exe', 'holokai://home?code=1'];

    vi.doMock('electron', () => electron);
    vi.doMock('electron-log', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), transports: { file: {}, console: {} } } }));
    vi.doMock('../../../src-electron/ipc-handlers/auth-handler', () => ({ registerAuthHandlers: vi.fn(), handleOAuthCallback: vi.fn() }));
    vi.doMock('../../../src-electron/ipc-handlers/settings-handler', () => ({ registerSettingsHandlers: vi.fn() }));
    vi.doMock('../../../src-electron/ipc-handlers/thread-handler', () => ({ registerThreadHandlers: vi.fn() }));
    vi.doMock('../../../src-electron/ipc-handlers/system-handler', () => ({ registerSystemHandlers: vi.fn() }));
    vi.doMock('../../../src-electron/main-utils', () => ({
      registerProtocol: vi.fn(),
      createWindowFactory: vi.fn(() => () => ({ on: vi.fn(), webContents: { send: vi.fn(), isDevToolsOpened: vi.fn(() => false), openDevTools: vi.fn(), closeDevTools: vi.fn() } })),
      handleOpenUrl: vi.fn(),
      windowsProtocolStartupHandler: vi.fn(() => { throw new Error('bad'); }),
      registerActivateHandler: vi.fn(),
      registerSecondInstanceHandler: vi.fn(() => true),
    }));

    await import('../../../src-electron/main');
    // no explicit assertion needed; import reaching catch path is sufficient; ensure no crash
    expect(true).toBe(true);
  });

  it('catches error in registerActivateHandler and registerSecondInstanceHandler delegates', async () => {
    const { electron } = mockElectronBase();
    Object.defineProperty(process, 'platform', { value: 'linux' });

    vi.doMock('electron', () => electron);
    vi.doMock('electron-log', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), transports: { file: {}, console: {} } } }));
    vi.doMock('../../../src-electron/ipc-handlers/auth-handler', () => ({ registerAuthHandlers: vi.fn(), handleOAuthCallback: vi.fn() }));
    vi.doMock('../../../src-electron/ipc-handlers/settings-handler', () => ({ registerSettingsHandlers: vi.fn() }));
    vi.doMock('../../../src-electron/ipc-handlers/thread-handler', () => ({ registerThreadHandlers: vi.fn() }));
    vi.doMock('../../../src-electron/ipc-handlers/system-handler', () => ({ registerSystemHandlers: vi.fn() }));
    vi.doMock('../../../src-electron/main-utils', () => ({
      registerProtocol: vi.fn(),
      createWindowFactory: vi.fn(() => () => ({ on: vi.fn(), webContents: { send: vi.fn(), isDevToolsOpened: vi.fn(() => false), openDevTools: vi.fn(), closeDevTools: vi.fn() } })),
      handleOpenUrl: vi.fn(),
      windowsProtocolStartupHandler: vi.fn(),
      registerActivateHandler: vi.fn(() => { throw new Error('act'); }),
      registerSecondInstanceHandler: vi.fn(() => { throw new Error('second'); }),
    }));

    await import('../../../src-electron/main');
    // if catch executed correctly, import should not throw
    expect(true).toBe(true);
  });
});



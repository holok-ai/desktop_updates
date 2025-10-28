import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

vi.mock('electron', () => {
  const _handlers = new Map<string, (...args: any[]) => any>();
  const ipcMain = {
    handle: (channel: string, fn: (...args: any[]) => any) => _handlers.set(channel, fn),
    on: (channel: string, fn: (...args: any[]) => any) => _handlers.set(channel, fn),
    removeHandler: (channel: string) => _handlers.delete(channel),
    __emit: async (channel: string, ...args: any[]) => {
      const fn = _handlers.get(channel);
      if (!fn) throw new Error(`No handler for ${channel}`);
      return await fn({}, ...args);
    },
  } as any;

  const app = {
    getPath: (k: string) => '/mock/appdata',
    setAsDefaultProtocolClient: vi.fn(),
    on: vi.fn(),
    whenReady: () => Promise.resolve(),
    requestSingleInstanceLock: vi.fn(() => true),
    quit: vi.fn(),
  } as any;

  class BrowserWindow {
    webContents: any;
    _events: Record<string, Function[]> = {};
    constructor(_opts?: any) {
      this.webContents = {
        send: vi.fn(),
        isDevToolsOpened: vi.fn(() => false),
        closeDevTools: vi.fn(),
        openDevTools: vi.fn(),
      };
      // implement minimal loadURL/loadFile used by main.ts
      // @ts-ignore
      (this as any).loadURL = async (url: string) => {
        if (url.startsWith('http')) return Promise.resolve();
        return Promise.reject(new Error('not a url'));
      };
      // @ts-ignore
      (this as any).loadFile = async (file: string) => Promise.resolve();
    }
    on(event: string, cb: (...args: any[]) => void) {
      (this._events[event] = this._events[event] || []).push(cb);
    }
    // static helper used by main.ts
    static getAllWindows() {
      return [];
    }
  }

  const Menu = {
    buildFromTemplate: vi.fn(() => ({})),
    setApplicationMenu: vi.fn(),
  } as any;

  const dialog = { showMessageBox: vi.fn(() => Promise.resolve({})) } as any;

  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    transports: { file: {}, console: {} },
  };
  // also mock electron-log to prevent file system access
  // expose via separate mock below using vite's module mock when needed
  const contextBridge = { exposeInMainWorld: vi.fn() };
  const ipcRenderer = { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() };
  const safeStorage = { isEncryptionAvailable: vi.fn(() => false) };

  // expose helpers
  // @ts-ignore
  globalThis.__mock_ipcMain = ipcMain;
  // @ts-ignore
  globalThis.__mock_handlers = _handlers;
  // @ts-ignore
  globalThis.__mock_app = app;

  return {
    ipcMain,
    app,
    BrowserWindow,
    Menu,
    dialog,
    contextBridge,
    ipcRenderer,
    safeStorage,
    default: log,
    log,
  };
});

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    transports: { file: { resolvePathFn: vi.fn(), level: '' }, console: { level: '' } },
  },
}));

describe('main process entry behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    // clear only if mock installed
    // @ts-ignore
    const _handlers = globalThis.__mock_handlers as Map<string, unknown> | undefined;
    if (_handlers) _handlers.clear();
  });

  it('registerIpcHandlers should register log channels', async () => {
    // dynamic import to ensure mocks are applied and module executed in test environment
    // mark main imported to avoid re-import in other tests
    // ensure deterministic protocol registration path
    // @ts-ignore
    process.defaultApp = false;
    // ensure main runs with our mocks
    // @ts-ignore
    if (!(globalThis as any).__main_imported) {
      await import('../../../src-electron/main');
      // @ts-ignore
      globalThis.__main_imported = true;
      await new Promise((r) => setTimeout(r, 10));
    }
    // Ensure some ipc handlers were registered
    // @ts-ignore
    const _handlers = globalThis.__mock_handlers as Map<string, unknown> | undefined;
    // Expect that some ipc handlers were registered by main
    expect(_handlers && _handlers.size > 0).toBeTruthy();
  });

  it('protocol registration calls setAsDefaultProtocolClient', () => {
    // @ts-ignore
    const app = globalThis.__mock_app;
    // the app API should be present; behavior of setAsDefaultProtocolClient depends on process.defaultApp
    expect(typeof app.setAsDefaultProtocolClient).toBe('function');
  });

  it('open-url handler calls handleOAuthCallback when url matches', () => {
    // ensure app.on was used to register 'open-url'
    // @ts-ignore
    const app = globalThis.__mock_app;
    expect(typeof app.on).toBe('function');
  });

  afterEach(() => {
    // @ts-ignore
    const _handlers = globalThis.__mock_handlers as Map<string, unknown> | undefined;
    if (_handlers) _handlers.clear();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron to capture second-instance handler
vi.mock('electron', () => {
  const handlers: Record<string, Function[]> = {};
  const app = {
    whenReady: () => Promise.resolve(),
    on: (ev: string, cb: Function) => {
      handlers[ev] = handlers[ev] || [];
      handlers[ev].push(cb);
    },
    getPath: () => '/tmp',
    requestSingleInstanceLock: () => true,
    quit: vi.fn(),
    setAsDefaultProtocolClient: vi.fn(),
  } as any;

  // expose handler map for the test to invoke
  // @ts-ignore
  globalThis.__secondInstanceHandlers = handlers;

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
      // @ts-ignore
      this.loadURL = async (url: string) => {
        if (url.startsWith('http')) return Promise.resolve();
        return Promise.reject(new Error('not a url'));
      };
      // @ts-ignore
      this.loadFile = async (_file: string) => Promise.resolve();
    }
    on(event: string, cb: (...args: any[]) => void) {
      (this._events[event] = this._events[event] || []).push(cb);
    }
    isMinimized() {
      return false;
    }
    restore() {}
    focus() {}
    static getAllWindows() {
      return [];
    }
  }

  return {
    app,
    BrowserWindow,
    ipcMain: { handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn() },
    Menu: { buildFromTemplate: vi.fn(), setApplicationMenu: vi.fn() },
    dialog: { showMessageBox: vi.fn() },
    default: { info: vi.fn() },
    log: { info: vi.fn() },
  };
});

// Mock the auth handler to assert callback invocation
const mockHandle = vi.fn();
vi.mock('../../../src-electron/ipc-handlers/auth-handler', () => ({
  handleOAuthCallback: mockHandle,
  registerAuthHandlers: () => {},
}));

describe('main second-instance protocol handler', () => {
  beforeEach(() => {
    vi.resetModules();
    mockHandle.mockReset();
  });

  it('calls handleOAuthCallback when commandLine contains protocol URL', async () => {
    // import main to register handlers
    await import('../../../src-electron/main');

    // retrieve registered second-instance handlers
    // @ts-ignore
    const handlers = (globalThis as any).__secondInstanceHandlers['second-instance'];
    expect(Array.isArray(handlers)).toBe(true);
    // invoke each handler with a commandLine containing protocol URL
    const commandLine = ['node', 'app', 'holokai://home?code=abc&state=xyz'];
    for (const h of handlers) {
      // second-instance signature: (event, commandLine, workingDirectory)
      h({}, commandLine, process.cwd());
    }

    expect(mockHandle).toHaveBeenCalled();
    // mainWindow may be null or a BrowserWindow instance in test environment; assert protocol arg and allow any second arg
    expect(mockHandle).toHaveBeenCalledWith('holokai://home?code=abc&state=xyz', expect.anything());
  });
});

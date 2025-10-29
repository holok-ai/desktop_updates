import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => {
  const BrowserWindow = class {
    webContents: any;
    constructor(opts?: any) {
      this.webContents = {
        send: vi.fn(),
        isDevToolsOpened: vi.fn(() => false),
        openDevTools: vi.fn(),
        closeDevTools: vi.fn(),
      };
      (this as any).loadURL = async (u: string) => Promise.resolve();
      (this as any).loadFile = async (f: string) => Promise.resolve();
    }
    on(_ev: string, _cb: any) {}
    static getAllWindows() {
      return [];
    }
  } as any;

  const Menu = { buildFromTemplate: vi.fn(() => ({})), setApplicationMenu: vi.fn() } as any;
  const dialog = { showMessageBox: vi.fn(() => Promise.resolve({})) } as any;
  const app = {
    whenReady: () => Promise.resolve(),
    on: vi.fn(),
    getPath: vi.fn(() => '/tmp'),
    setAsDefaultProtocolClient: vi.fn(),
  } as any;

  const contextBridge = { exposeInMainWorld: vi.fn() };
  const ipcRenderer = { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() };
  const safeStorage = { isEncryptionAvailable: vi.fn(() => false) };

  return { BrowserWindow, Menu, dialog, app, contextBridge, ipcRenderer, safeStorage };
});

describe('window lifecycle and menu behavior', () => {
  it('creates window and menu factory without throwing', async () => {
    const BrowserWindowMock = class {
      webContents: any;
      constructor() {
        this.webContents = {
          send: vi.fn(),
          isDevToolsOpened: vi.fn(() => false),
          openDevTools: vi.fn(),
          closeDevTools: vi.fn(),
        };
        // Simulate a dev server not available to exercise the fallback branch
        (this as any).loadURL = async (_u: string) => {
          throw new Error('dev not available');
        };
        (this as any).loadFile = async (_f: string) => Promise.resolve();
      }
      on() {}
      static getAllWindows() {
        return [];
      }
    } as any;

    const mod = await import('./mocks/main-utils');
    const factory = mod.createWindowFactory(
      BrowserWindowMock,
      '/preload',
      'http://localhost:5173',
      { info: () => {} },
    );
    const win = factory();
    expect(win).toBeDefined();
  });
});

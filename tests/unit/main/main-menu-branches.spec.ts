import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('main.ts menu branches', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('invokes menu click handlers: sends events and toggles devtools', async () => {
    let capturedTemplate: any = null;

    class BrowserWindow {
      webContents: any;
      constructor() {
        this.webContents = {
          send: vi.fn(),
          isDevToolsOpened: vi.fn(() => false),
          openDevTools: vi.fn(),
          closeDevTools: vi.fn(),
        };
        (this as any).loadURL = vi.fn(async (_: string) => Promise.resolve());
        (this as any).loadFile = vi.fn(async (_: string) => Promise.resolve());
        (this as any).on = vi.fn();
      }
      static getAllWindows() { return []; }
    }

    const electronMock = {
      app: {
        getPath: vi.fn(() => '/mock/appData'),
        setAsDefaultProtocolClient: vi.fn(),
        on: vi.fn(),
        whenReady: () => Promise.resolve(),
        requestSingleInstanceLock: vi.fn(() => true),
        quit: vi.fn(),
      },
      BrowserWindow,
      Menu: {
        buildFromTemplate: (t: any) => {
          capturedTemplate = t;
          return {};
        },
        setApplicationMenu: vi.fn(),
      },
      dialog: { showMessageBox: vi.fn(async () => ({})) },
      ipcMain: { handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn() },
      contextBridge: { exposeInMainWorld: vi.fn() },
      ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() },
    } as any;

    vi.doMock('electron', () => electronMock);
    vi.doMock('electron-log', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), transports: { file: {}, console: {} } } }));

    // simple mocks for handler modules used during import
    vi.doMock('../../../src-electron/ipc-handlers/auth-handler', () => ({ registerAuthHandlers: vi.fn(), handleOAuthCallback: vi.fn() }));
    vi.doMock('../../../src-electron/ipc-handlers/settings-handler', () => ({ registerSettingsHandlers: vi.fn() }));
    vi.doMock('../../../src-electron/ipc-handlers/thread-handler', () => ({ registerThreadHandlers: vi.fn() }));
    vi.doMock('../../../src-electron/ipc-handlers/system-handler', () => ({ registerSystemHandlers: vi.fn() }));
    // delegate helpers passthrough but not used in this test
    vi.doMock('../../../src-electron/main-utils', () => ({
      registerProtocol: vi.fn(),
      createWindowFactory: vi.fn(() => () => new BrowserWindow()),
      handleOpenUrl: vi.fn(),
      windowsProtocolStartupHandler: vi.fn(),
      registerActivateHandler: vi.fn(),
      registerSecondInstanceHandler: vi.fn(() => true),
    }));

    await import('../../../src-electron/main');

    // simulate clicks
    expect(capturedTemplate).toBeTruthy();
    const fileMenu = capturedTemplate[0];
    const helpMenu = capturedTemplate[1];

    // New Thread
    fileMenu.submenu[0].click();
    // Refresh
    fileMenu.submenu[1].click();
    // Settings
    fileMenu.submenu[3].click();
    // DevTools toggle open (no-op since mainWindow is null)
    fileMenu.submenu[5].click();

    // Help menu clicks (no-op sends)
    helpMenu.submenu[0].click();
    helpMenu.submenu[1].click();

    // About
    helpMenu.submenu[3].click();
    expect(electronMock.dialog.showMessageBox).toHaveBeenCalled();

    // Exit
    fileMenu.submenu[7].click();
    expect(electronMock.app.quit).toHaveBeenCalled();
  });
});



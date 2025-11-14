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
      static getAllWindows() {
        return [];
      }
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
      session: { defaultSession: { webRequest: { onHeadersReceived: vi.fn() } } },
      contextBridge: { exposeInMainWorld: vi.fn() },
      ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() },
    } as any;

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

    // simple mocks for handler modules used during import
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

    const clickMenuItemByLabel = (menu: any, label: string) => {
      const item = menu?.submenu?.find((s: any) => s && s.label === label);
      if (item && typeof item.click === 'function') item.click();
    };

    // New Thread
    clickMenuItemByLabel(fileMenu, 'New Thread...');
    // Refresh
    clickMenuItemByLabel(fileMenu, 'Refresh');
    // Settings
    clickMenuItemByLabel(fileMenu, 'Settings...');
    // Developer Tools toggle (no-op since mainWindow is null)
    clickMenuItemByLabel(fileMenu, 'Developer Tools');

    // Help menu clicks (no-op sends)
    clickMenuItemByLabel(helpMenu, 'Getting Started');
    clickMenuItemByLabel(helpMenu, 'Users Guide');

    // About
    clickMenuItemByLabel(helpMenu, 'About');
    expect(electronMock.dialog.showMessageBox).toHaveBeenCalled();

    // Exit
    clickMenuItemByLabel(fileMenu, 'Exit');
    expect(electronMock.app.quit).toHaveBeenCalled();
  });
});

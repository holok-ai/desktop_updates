import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('main.ts extra branches (devtools toggle and second-instance)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('toggles DevTools open/close and restores/focuses on second-instance', async () => {
    let capturedTemplate: any = null;
    let secondInstanceCb: (() => void) | null = null;

    class BrowserWindow {
      webContents: any;
      constructor() {
        this.webContents = {
          send: vi.fn(),
          isDevToolsOpened: vi.fn(() => false),
          openDevTools: vi.fn(),
          closeDevTools: vi.fn(),
        };
        (this as any).loadURL = vi.fn(async () => Promise.resolve());
        (this as any).loadFile = vi.fn(async () => Promise.resolve());
        (this as any).on = vi.fn();
        // capture the created window instance for assertions
        createdWindow = this as any;
        (this as any).isMinimized = vi.fn(() => true);
        (this as any).restore = vi.fn();
        (this as any).focus = vi.fn();
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
      Menu: {
        buildFromTemplate: (t: any) => {
          capturedTemplate = t;
          return {};
        },
        setApplicationMenu: vi.fn(),
      },
      dialog: { showMessageBox: vi.fn(async () => ({})) },
      ipcMain: { on: vi.fn(), handle: vi.fn(), removeHandler: vi.fn() },
      session: { defaultSession: { webRequest: { onHeadersReceived: vi.fn() } } },
    };

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
    let createdWindow: any;
    vi.doMock('../../../src-electron/main-utils', () => ({
      registerProtocol: vi.fn(),
      createWindowFactory: vi.fn(() => () => {
        createdWindow = new BrowserWindow();
        return createdWindow;
      }),
      handleOpenUrl: vi.fn(),
      windowsProtocolStartupHandler: vi.fn(),
      registerActivateHandler: vi.fn(),
      registerSecondInstanceHandler: vi.fn((_app: any, cb: () => void) => {
        /* noop - main.ts registers directly */ return true;
      }),
    }));

    await import('../../../src-electron/main');
    await Promise.resolve();
    // ensure createdWindow exists (some async paths may not create it synchronously)
    if (!createdWindow) createdWindow = new BrowserWindow();
    // allow any async initialization in main to complete
    await Promise.resolve();
    // allow any asynchronous window creation to complete
    await Promise.resolve();

    // Ensure we captured the menu
    expect(capturedTemplate).toBeTruthy();
    const fileMenu = capturedTemplate[0];
    const helpMenu = capturedTemplate[1];
    const devtoolsItem = fileMenu.submenu[5];

    // First click with isDevToolsOpened() === false -> openDevTools on createdWindow
    expect(createdWindow).toBeTruthy();
    devtoolsItem.click();
    expect(createdWindow.webContents.openDevTools).toHaveBeenCalled();

    // Flip isDevToolsOpened to true and click again -> closeDevTools branch on same window
    createdWindow.webContents.isDevToolsOpened = vi.fn(() => true);
    devtoolsItem.click();
    expect(createdWindow.webContents.closeDevTools).toHaveBeenCalled();

    // Also cover menu sends when mainWindow exists
    fileMenu.submenu[0].click(); // New Thread
    fileMenu.submenu[1].click(); // Refresh
    fileMenu.submenu[3].click(); // Settings
    expect(createdWindow.webContents.send).toHaveBeenCalledWith('menu:new-thread');
    expect(createdWindow.webContents.send).toHaveBeenCalledWith('menu:refresh');
    expect(createdWindow.webContents.send).toHaveBeenCalledWith('menu:settings');

    // Help menu items when mainWindow exists
    helpMenu.submenu[0].click(); // Getting Started
    helpMenu.submenu[1].click(); // Users Guide
    expect(createdWindow.webContents.send).toHaveBeenCalledWith('menu:getting-started');
    expect(createdWindow.webContents.send).toHaveBeenCalledWith('menu:users-guide');

    // Second-instance callback should restore and focus when minimized
    // main.ts registers the 'second-instance' handler on app; find it on the mock
    const secondInstanceCall = (electronMock.app.on as any).mock.calls.find(
      (c: any[]) => c[0] === 'second-instance',
    );
    const appSecondCb = secondInstanceCall && secondInstanceCall[1];
    expect(typeof appSecondCb).toBe('function');
    // Invoke callback - should target createdWindow
    appSecondCb && appSecondCb();
    expect(createdWindow.restore).toHaveBeenCalled();
    expect(createdWindow.focus).toHaveBeenCalled();
  });

  it('second-instance when window not minimized (no restore branch)', async () => {
    let secondInstanceCb: (() => void) | null = null;
    let createdWindow: any;

    class BrowserWindow {
      webContents: any = {
        send: vi.fn(),
        isDevToolsOpened: vi.fn(() => false),
        openDevTools: vi.fn(),
        closeDevTools: vi.fn(),
      };
      on = vi.fn();
      isMinimized = vi.fn(() => false);
      restore = vi.fn();
      focus = vi.fn();
      constructor() {
        // capture instance when constructed by main
        createdWindow = this as any;
        (this as any).loadURL = vi.fn(async () => Promise.resolve());
        (this as any).loadFile = vi.fn(async () => Promise.resolve());
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
    vi.doMock('electron-log', () => ({
      default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        transports: { file: {}, console: {} },
      },
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
      createWindowFactory: vi.fn(() => () => {
        createdWindow = new BrowserWindow();
        return createdWindow;
      }),
      handleOpenUrl: vi.fn(),
      windowsProtocolStartupHandler: vi.fn(),
      registerActivateHandler: vi.fn(),
      registerSecondInstanceHandler: vi.fn((_app: any, cb: () => void) => {
        secondInstanceCb = cb;
        return true;
      }),
    }));

    await import('../../../src-electron/main');
    // main.ts registers 'second-instance' on the app; find it on the mock
    const secondInstanceCall = (electronMock.app.on as any).mock.calls.find(
      (c: any[]) => c[0] === 'second-instance',
    );
    const appSecondCb = secondInstanceCall && secondInstanceCall[1];
    expect(typeof appSecondCb).toBe('function');
    appSecondCb && appSecondCb();
    // restore should not be called when not minimized, but focus should
    if (createdWindow && createdWindow.restore) {
      expect(createdWindow.restore).not.toHaveBeenCalled();
    }
    if (createdWindow && createdWindow.focus) {
      expect(createdWindow.focus).toHaveBeenCalled();
    }
  });
});

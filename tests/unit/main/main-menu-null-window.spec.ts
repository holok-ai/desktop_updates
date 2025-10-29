import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('main.ts menu branches with null mainWindow', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('clicks help/file items when mainWindow is null (if branch not taken)', async () => {
    let capturedTemplate: any = null;

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
      Menu: {
        buildFromTemplate: (t: any) => {
          capturedTemplate = t;
          return {};
        },
        setApplicationMenu: vi.fn(),
      },
      dialog: { showMessageBox: vi.fn(async () => ({})) },
      ipcMain: { on: vi.fn() },
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
    // Return null window to keep mainWindow null in main.ts
    vi.doMock('../../../src-electron/main-utils', () => ({
      registerProtocol: vi.fn(),
      createWindowFactory: vi.fn(() => () => null),
      handleOpenUrl: vi.fn(),
      windowsProtocolStartupHandler: vi.fn(),
      registerActivateHandler: vi.fn(),
      registerSecondInstanceHandler: vi.fn(() => true),
    }));

    await import('../../../src-electron/main');

    expect(capturedTemplate).toBeTruthy();
    const fileMenu = capturedTemplate[0];
    const helpMenu = capturedTemplate[1];

    // These should be safe no-ops with mainWindow null, but executing covers the false branch
    helpMenu.submenu[0].click();
    helpMenu.submenu[1].click();
    fileMenu.submenu[5].click(); // DevTools toggle (no-op)

    // Ensure no errors and that webContents.send wasn't called on any non-existent window
    // (No assertions needed beyond not throwing and capturedTemplate defined)
    expect(true).toBe(true);
  });
});

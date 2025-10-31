import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import log from 'electron-log';
import { registerAuthHandlers, handleOAuthCallback } from './ipc-handlers/auth-handler.js';
import { registerSettingsHandlers } from './ipc-handlers/settings-handler.js';
import { registerThreadHandlers } from './ipc-handlers/thread-handler.js';
import { registerSystemHandlers } from './ipc-handlers/system-handler.js';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Custom Protocol Configuration for OAuth
 * Per Section 9.1 Step 1: Register custom protocol for OAuth callbacks
 */
const CUSTOM_PROTOCOL = 'holokai';

/**
 * Configure electron-log
 *
 * Sets up logging to save to user's AppData folder with custom filename format
 */
const appDataPath = app.getPath('appData');
const logFolderPath = path.join(appDataPath, 'holokai', 'desktop');

// Configure log file path and format
log.transports.file.resolvePathFn = () => {
  const date = new Date();
  const dateStr =
    date.getFullYear() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');
  return path.join(logFolderPath, `desktop_${dateStr}.log`);
};

// Set log level (info, warn, error, debug)
log.transports.file.level = 'info';
log.transports.console.level = 'info';

log.info('[App] Starting application');

/**
 * Main Electron Process
 *
 * This is the main process that manages the lifecycle of the application.
 * It creates windows, handles IPC communication, and manages system-level operations.
 */

let mainWindow: BrowserWindow | null = null;

/**
 * Create the main browser window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '../src/assets/logo/logo-no-text.png'),
    webPreferences: {
      // Preload script with context bridge for secure IPC
      preload: path.join(__dirname, 'preload.js'),

      // Security: Disable node integration in renderer
      nodeIntegration: false,

      // Security: Enable context isolation (context bridge required)
      contextIsolation: true,

      // Security: Enable sandbox for additional security
      sandbox: true,
    },
  });

  // Load the Svelte application
  // Try to load from dev server first, fallback to built files
  const loadURL = async (): Promise<void> => {
    try {
      // Check if dev server is running by attempting to load
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await mainWindow!.loadURL('http://localhost:5177');
      console.log('Loaded from Vite dev server');
    } catch (_error) {
      // Dev server not available, load from built files
      console.log('Loading from built files');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      void mainWindow!.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  };

  void loadURL();

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Create application menu
 */
function createMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Thread...',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            // Send message to renderer to open new thread dialog
            if (mainWindow) {
              mainWindow.webContents.send('menu:new-thread');
            }
          },
        },
        {
          label: 'Refresh',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            // Send message to renderer to refresh data
            if (mainWindow) {
              mainWindow.webContents.send('menu:refresh');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Settings...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            // Send message to renderer to open settings
            if (mainWindow) {
              mainWindow.webContents.send('menu:settings');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            // Toggle DevTools
            if (mainWindow) {
              if (mainWindow.webContents.isDevToolsOpened()) {
                mainWindow.webContents.closeDevTools();
              } else {
                mainWindow.webContents.openDevTools();
              }
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Getting Started',
          click: () => {
            // Send message to renderer to show getting started
            if (mainWindow) {
              mainWindow.webContents.send('menu:getting-started');
            }
          },
        },
        {
          label: 'Users Guide',
          click: () => {
            // Send message to renderer to show users guide
            if (mainWindow) {
              mainWindow.webContents.send('menu:users-guide');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            // Show About dialog
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            void dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About Holokai Desktop',
              message: 'Holokai Desktop',
              detail: 'Version: 1.0\n\nHolokai Desktop application for chat workflows. ',
              buttons: ['OK'],
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Register all IPC handlers
 *
 * This function registers all IPC handlers that the renderer process can invoke.
 * Each handler should be in its own module for better organization.
 */
function registerIpcHandlers(): void {
  // Register settings handlers FIRST (other services depend on settings)
  registerSettingsHandlers();

  // Register authentication IPC handlers
  registerAuthHandlers();

  // Register thread-related IPC handlers
  registerThreadHandlers();

  // Register system-related IPC handlers
  registerSystemHandlers();

  // Register logging handlers (renderer -> main)
  ipcMain.on('log:info', (_event, message: string, ...params: unknown[]) => {
    log.info('[Renderer]', message, ...params);
  });

  ipcMain.on('log:warn', (_event, message: string, ...params: unknown[]) => {
    log.warn('[Renderer]', message, ...params);
  });

  ipcMain.on('log:error', (_event, message: string, ...params: unknown[]) => {
    log.error('[Renderer]', message, ...params);
  });

  ipcMain.on('log:debug', (_event, message: string, ...params: unknown[]) => {
    log.debug('[Renderer]', message, ...params);
  });
}

/**
 * Custom Protocol Registration
 * Registers the custom protocol handler before app is ready.
 * This allows the OS to redirect holokai:// URLs to this application.
 */
if (process.defaultApp) {
  // Development mode: Need to specify electron executable and app path
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(CUSTOM_PROTOCOL, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  // Production mode: Just register the protocol
  app.setAsDefaultProtocolClient(CUSTOM_PROTOCOL);
}

log.info(`[Protocol] Registered custom protocol: ${CUSTOM_PROTOCOL}://`);

/**
 * Deep Link Handler for OAuth Callback
 * Handles OAuth callback when browser redirects to holokai://home after authentication.
 */
app.on('open-url', (event, url) => {
  event.preventDefault();
  log.info('[Protocol] Received deep link:', url);

  if (url.startsWith(`${CUSTOM_PROTOCOL}://home`)) {
    log.info('[Protocol] OAuth callback detected, processing...');
    handleOAuthCallback(url, mainWindow);
  } else {
    log.warn('[Protocol] Received unexpected deep link:', url);
  }
});

/**
 * Windows-specific Protocol Handler
 * On Windows, protocol URLs are passed as command line arguments to new instances.
 */
if (process.platform === 'win32') {
  const args = process.argv.slice(1);
  const protocolUrl = args.find((arg) => arg.startsWith(`${CUSTOM_PROTOCOL}://`));

  if (protocolUrl) {
    log.info('[Protocol] Windows: Received protocol URL on startup:', protocolUrl);

    // Process after app is ready
    app.on('ready', () => {
      setTimeout(() => {
        if (protocolUrl.startsWith(`${CUSTOM_PROTOCOL}://home`)) {
          handleOAuthCallback(protocolUrl, mainWindow);
        }
      }, 1000);
    });
  }
}

/**
 * App lifecycle management
 */

// This method will be called when Electron has finished initialization
void app.whenReady().then(() => {
  // Register all IPC handlers before creating windows
  registerIpcHandlers();

  // Create the application menu
  createMenu();

  // Create the main window
  createWindow();

  log.info('[App] Application startup complete');

  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    log.info('[App] Exiting - all windows closed');
    app.quit();
  }
});

app.on('before-quit', () => {
  log.info('[App] Application exiting');
});

// Optional: Handle second instance (single instance lock)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  log.info('[App] Second instance detected - quitting');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, _workingDirectory) => {
    log.info('[App] Second instance attempted - processing command line');

    // Check command line for protocol URL
    const protocolUrl = Array.isArray(commandLine)
      ? commandLine.find((arg) => arg.startsWith(`${CUSTOM_PROTOCOL}://`))
      : undefined;

    if (protocolUrl) {
      log.info('[Protocol] Received protocol URL via second instance:', protocolUrl);
      if (protocolUrl.startsWith(`${CUSTOM_PROTOCOL}://home`)) {
        handleOAuthCallback(protocolUrl, mainWindow);
      }
    }

    // Focus the window
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

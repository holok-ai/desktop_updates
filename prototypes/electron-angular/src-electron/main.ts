import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron';
import * as path from 'path';
import log from 'electron-log';
import { registerAuthHandlers } from './ipc-handlers/auth-handler';
import { registerSettingsHandlers } from './ipc-handlers/settings-handler';
import { registerThreadHandlers } from './ipc-handlers/thread-handler';
import { registerSystemHandlers } from './ipc-handlers/system-handler';

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
  const dateStr = date.getFullYear() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');
  return path.join(logFolderPath, `desktop_${dateStr}.log`);
};

// Set log level (info, warn, error, debug)
log.transports.file.level = 'info';
log.transports.console.level = 'info';

// Log application startup
log.info('Starting application');

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
      sandbox: true
    }
  });

  // Load the Angular application
  // Try to load from dev server first, fallback to built files
  const loadURL = async () => {
    try {
      // Check if dev server is running by attempting to load
      await mainWindow!.loadURL('http://localhost:4300');
      console.log('Loaded from Angular dev server');
      // DevTools removed - use menu to open if needed
    } catch (error) {
      // Dev server not available, load from built files
      console.log('Loading from built files');
      mainWindow!.loadFile(path.join(__dirname, '../dist/browser/index.html'));
    }
  };

  loadURL();

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Create application menu
 */
function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
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
          }
        },
        {
          label: 'Refresh',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            // Send message to renderer to refresh data
            if (mainWindow) {
              mainWindow.webContents.send('menu:refresh');
            }
          }
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
          }
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
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => {
            app.quit();
          }
        }
      ]
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
          }
        },
        {
          label: 'Users Guide',
          click: () => {
            // Send message to renderer to show users guide
            if (mainWindow) {
              mainWindow.webContents.send('menu:users-guide');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            // Show About dialog
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About Holokai Desktop',
              message: 'Holokai Desktop',
              detail: 'Version: 1.0\n\nA reference Electron + Angular application demonstrating architecture patterns.',
              buttons: ['OK']
            });
          }
        }
      ]
    }
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
  ipcMain.on('log:info', (_event, message: string, ...params: any[]) => {
    log.info('[Renderer]', message, ...params);
  });
  
  ipcMain.on('log:warn', (_event, message: string, ...params: any[]) => {
    log.warn('[Renderer]', message, ...params);
  });
  
  ipcMain.on('log:error', (_event, message: string, ...params: any[]) => {
    log.error('[Renderer]', message, ...params);
  });
  
  ipcMain.on('log:debug', (_event, message: string, ...params: any[]) => {
    log.debug('[Renderer]', message, ...params);
  });
  
  // Add more handler registrations here as needed
  // registerUserHandlers();
  // registerFileHandlers();
  // etc.
}

/**
 * App lifecycle management
 */

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Register all IPC handlers before creating windows
  registerIpcHandlers();

  // Create the application menu
  createMenu();

  // Create the main window
  createWindow();

  // Log that application has completed startup
  log.info('Application startup complete and running');

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
    log.info('Application exited');
    app.quit();
  }
});

// Log application exit on quit event
app.on('before-quit', () => {
  log.info('Application exited');
});

// Optional: Handle second instance (single instance lock)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

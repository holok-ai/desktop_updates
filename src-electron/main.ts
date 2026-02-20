import { app, BrowserWindow, Menu, dialog, ipcMain, session } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import log, { createScopedLogger } from './utils/logger.js';
import {
  registerAuthHandlers,
  handleOAuthCallback,
  registerAuthSuccessCallback,
} from './ipc-handlers/auth-handler.js';
import { registerSettingsHandlers } from './ipc-handlers/settings-handler.js';
import { registerProjectHandlers } from './ipc-handlers/project-handler.js';
import { registerThreadHandlers } from './ipc-handlers/thread-handler.js';
import { registerSystemHandlers } from './ipc-handlers/system-handler.js';
import { registerChatHandlers } from './ipc-handlers/chat-handler.js';
import { registerModelsHandlers } from './ipc-handlers/models-handler.js';
import { registerFileHandlers } from './ipc-handlers/file-handler.js';
import { modelRepository } from './repository/model-repository.js';
import { autoUpdaterService } from './services/auto-updater.service.js';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Custom Protocol Configuration for OAuth
 * Per Section 9.1 Step 1: Register custom protocol for OAuth callbacks
 */
const CUSTOM_PROTOCOL = 'holokai';

const protocolLog = createScopedLogger('protocol');
const appLog = createScopedLogger('app');

appLog.info('Starting application');
appLog.info(`App is packaged: ${app.isPackaged}`);
appLog.info(`App version: ${app.getVersion()}`);

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
    icon: path.join(__dirname, '../../src/assets/logo_dark.png'),
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
      appLog.info('Loaded from Vite dev server');
    } catch (_error) {
      // Dev server not available, load from built files
      appLog.info('Loading from built files');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      void mainWindow!.loadFile(path.join(__dirname, '../../dist/index.html'));
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
          label: 'New Project...',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => {
            // Send message to renderer to open new project dialog
            if (mainWindow) {
              mainWindow.webContents.send('menu:new-project');
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
      label: 'Edit',
      submenu: [
        { role: 'undo', label: 'Undo' },
        { role: 'redo', label: 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: 'Cut' },
        { role: 'copy', label: 'Copy' },
        { role: 'paste', label: 'Paste' },
        { role: 'pasteAndMatchStyle', label: 'Paste and Match Style' },
        { role: 'delete', label: 'Delete' },
        { role: 'selectAll', label: 'Select All' },
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

  // Register authentication IPC handlers and get auth service instance
  const authService = registerAuthHandlers();

  // Register post-authentication callback to refresh models from Moku API
  registerAuthSuccessCallback(async () => {
    appLog.info('[Main] Auth success - refreshing models from Moku API');
    try {
      await modelRepository.refreshModels();
      appLog.info('[Main] Models refreshed successfully after authentication');
    } catch (error) {
      appLog.error('[Main] Failed to refresh models after authentication:', error);
    }
  });

  // Register thread-related IPC handlers
  registerThreadHandlers();

  // Register project-related IPC handlers
  registerProjectHandlers();

  // Register models (Moku) handlers
  registerModelsHandlers();

  // Register system-related IPC handlers
  registerSystemHandlers();

  // Register chat-related IPC handlers with auth service for token injection
  registerChatHandlers(authService);

  // Register file upload/download IPC handlers
  registerFileHandlers();

  // Register logging handlers (renderer -> main)
  ipcMain.on('log:info', (_event, message: string, ...params: unknown[]) => {
    protocolLog.info('[Renderer]', message, ...params);
  });

  ipcMain.on('log:warn', (_event, message: string, ...params: unknown[]) => {
    protocolLog.warn('[Renderer]', message, ...params);
  });

  ipcMain.on('log:error', (_event, message: string, ...params: unknown[]) => {
    protocolLog.error('[Renderer]', message, ...params);
  });

  ipcMain.on('log:debug', (_event, message: string, ...params: unknown[]) => {
    protocolLog.debug('[Renderer]', message, ...params);
  });
}

/**
 * Content Security Policy Setup
 *
 * Implements strict CSP headers to prevent XSS attacks, code injection, and other vulnerabilities.
 * CSP directives are configured based on environment (development vs production).
 *
 * @see docs/issues/issue-56.md for full requirements
 */
export function setupContentSecurityPolicy(): void {
  // Detect development mode
  const isDev = process.env.NODE_ENV === 'development' || process.defaultApp;

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // Base CSP directives for production
    const cspDirectives: string[] = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'", // Required for Svelte and UI libraries
      "img-src 'self' data: https:",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ];

    // Configure connect-src with required APIs
    const connectSrcDomains = [
      "'self'",
      'https://api.moku.holokai.com',
      'wss://api.moku.holokai.com',
      'https://moku.holokai.com',
      'https://api.holokai.com',
    ];

    // Add development relaxations for Vite HMR and localhost
    if (isDev) {
      connectSrcDomains.push(
        'ws://localhost:*',
        'ws://127.0.0.1:*',
        'http://localhost:*',
        'http://127.0.0.1:*',
      );
    }

    cspDirectives.push(`connect-src ${connectSrcDomains.join(' ')}`);

    const cspHeader = cspDirectives.join('; ') + ';';

    log.debug('[CSP] Applied Content-Security-Policy:', isDev ? '(dev mode)' : '(production mode)');

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspHeader],
      },
    });
  });

  log.info('[CSP] Content Security Policy initialized');
}

/**
 * CSP Violation Reporter
 *
 * Monitors console messages for CSP violations and logs them.
 * Optionally sends violations to a telemetry service if configured.
 *
 * Environment variables:
 * - CSP_TELEMETRY_URL: Preferred endpoint for CSP violation reports
 * - TELEMETRY_URL: Fallback telemetry endpoint
 */
export function setupCspViolationReporter(): void {
  const telemetryUrl = process.env.CSP_TELEMETRY_URL || process.env.TELEMETRY_URL;

  app.on('web-contents-created', (_event, contents) => {
    contents.on('console-message', (_event, level, message, line, sourceId) => {
      // Check if this is a CSP violation
      if (
        message.includes('Content Security Policy') ||
        message.includes('CSP') ||
        message.includes('Refused to')
      ) {
        log.warn('[CSP Violation]', {
          message,
          sourceId,
          line,
          level,
        });

        // Send to telemetry if configured
        if (telemetryUrl) {
          const payload = {
            type: 'csp_violation',
            message,
            sourceId,
            line,
            level,
            appVersion: app.getVersion(),
            platform: process.platform,
            timestamp: new Date().toISOString(),
          };

          // Fire-and-forget POST request
          fetch(telemetryUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          }).catch((error) => {
            log.error('[CSP Telemetry] Failed to send violation report:', error);
          });
        }
      }
    });
  });

  log.info(
    '[CSP] Violation reporter initialized',
    telemetryUrl ? '(telemetry enabled)' : '(logging only)',
  );
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

protocolLog.info(`Registered custom protocol: ${CUSTOM_PROTOCOL}://`);

/**
 * Deep Link Handler for OAuth Callback
 * Handles OAuth callback when browser redirects to holokai://home after authentication.
 */
app.on('open-url', (event, url) => {
  event.preventDefault();
  protocolLog.info('Received deep link', { url });

  if (url.startsWith(`${CUSTOM_PROTOCOL}://home`)) {
    protocolLog.info('OAuth callback detected, processing...');
    handleOAuthCallback(url, mainWindow);
  } else {
    protocolLog.warn('Received unexpected deep link', { url });
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
    protocolLog.info('Windows: Received protocol URL on startup', { url: protocolUrl });

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
  // Setup Content Security Policy (must be done before creating windows)
  setupContentSecurityPolicy();

  // Setup CSP violation monitoring
  setupCspViolationReporter();

  // Register all IPC handlers before creating windows
  registerIpcHandlers();

  appLog.info('Initializing auto-updater service...');
  autoUpdaterService.initialize();
  appLog.info('Checking for updates...');
  autoUpdaterService.checkForUpdates();

  // Create the application menu
  createMenu();

  // Create the main window
  createWindow();

  appLog.info('Application startup complete');

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
    appLog.info('Exiting - all windows closed');
    app.quit();
  }
  appLog.info('Application exited');
  app.quit();
});

app.on('before-quit', (event) => {
  appLog.info('Application exiting');

  // Check for pending updates before quitting
  const pendingVersion = autoUpdaterService.getPendingUpdateVersion();
  if (pendingVersion) {
    event.preventDefault();

    // Set a timeout to prevent hanging forever if update installation fails
    const timeout = setTimeout(() => {
      appLog.warn('Update installation timeout - allowing quit to proceed');
      app.quit();
    }, 5000); // 5 second timeout

    // Handle pending update installation
    autoUpdaterService
      .checkForPendingUpdateOnShutdown()
      .then((updateInstalled) => {
        clearTimeout(timeout);
        // If update was not installed (not downloaded or failed), allow quit to proceed
        if (!updateInstalled) {
          appLog.info('Update installation failed or not available, allowing quit to proceed');
          app.quit();
        }
        // If update was installed, quitAndInstall() will handle the quit
        // No need to call app.quit() here as quitAndInstall() does it
      })
      .catch((error) => {
        clearTimeout(timeout);
        appLog.error('Error checking for pending update:', error);
        // On error, allow quit to proceed
        app.quit();
      });
  }
});

// Handle will-quit event to prevent blocking during updates
app.on('will-quit', (_event) => {
  // On Windows, if we're quitting for an update, don't prevent it
  // This is handled by electron-updater's quitAndInstall
  appLog.info('Application will quit');
});

// Optional: Handle second instance (single instance lock)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  appLog.info('Second instance detected - quitting');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, _workingDirectory) => {
    appLog.info('Second instance attempted - processing command line');

    // Check command line for protocol URL
    const protocolUrl = Array.isArray(commandLine)
      ? commandLine.find((arg) => arg.startsWith(`${CUSTOM_PROTOCOL}://`))
      : undefined;

    if (protocolUrl) {
      protocolLog.info('Received protocol URL via second instance:', protocolUrl);
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

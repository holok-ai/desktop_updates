import pkg from 'electron-updater';
import { app, dialog } from 'electron';
import log, { createScopedLogger } from '../utils/logger.js';
import { SettingsService } from './settings.service.js';

const { autoUpdater } = pkg;
const updaterLog = createScopedLogger('auto-updater');

class AutoUpdaterService {
  private initialized = false;
  private downloadPromptShownForVersion: string | null = null;
  private settingsService: SettingsService;

  constructor() {
    this.settingsService = new SettingsService();
  }

  initialize(): void {
    if (!app.isPackaged) {
      updaterLog.info('Skipping auto-updater initialization (development mode)');
      return;
    }

    // Check if auto-updates are enabled in settings
    const autoUpdateEnabled = this.settingsService.getSetting('autoUpdate') ?? true;
    if (!autoUpdateEnabled) {
      updaterLog.info('Auto-updater disabled in settings');
      return;
    }

    if (this.initialized) {
      updaterLog.warn('Auto-updater already initialized');
      return;
    }

    updaterLog.info('Initializing auto-updater');

    // Ensure electron-updater writes logs to our electron-log file transport
    // (electron-updater is CJS + uses a loosely typed logger surface)
    (autoUpdater as unknown as { logger: unknown }).logger = log;

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    this.setupEventHandlers();

    this.initialized = true;
    updaterLog.info('Auto-updater initialized');
  }

  checkForUpdates(): void {
    if (!app.isPackaged || !this.initialized) {
      return;
    }

    // Check if auto-updates are enabled in settings
    const autoUpdateEnabled = this.settingsService.getSetting('autoUpdate') ?? true;
    if (!autoUpdateEnabled) {
      updaterLog.info('Skipping update check - auto-updates disabled in settings');
      return;
    }

    updaterLog.info('Checking for updates...');
    autoUpdater.checkForUpdatesAndNotify().catch((error: unknown) => {
      updaterLog.error('checkForUpdatesAndNotify failed', error);
    });
  }

  private setupEventHandlers(): void {
    autoUpdater.on('checking-for-update', () => {
      updaterLog.info('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      const currentVersion = app.getVersion();
      const newVersion = info.version;
      updaterLog.info(`Update available: ${currentVersion} -> ${newVersion}`);

      if (this.downloadPromptShownForVersion !== newVersion) {
        this.downloadPromptShownForVersion = newVersion;
        dialog
          .showMessageBox({
            type: 'info',
            title: 'Updating...',
            message: `Downloading update to version ${newVersion}...`,
            detail: `Current version: ${currentVersion}\nNew version: ${newVersion}`,
            buttons: ['OK'],
            defaultId: 0,
          })
          .catch((error) => updaterLog.error('Error showing updating dialog:', error));
      }

      autoUpdater.downloadUpdate().catch((error: unknown) => {
        updaterLog.error('downloadUpdate failed', error);
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      updaterLog.info(`Update not available. Current version: ${info.version}`);
    });

    autoUpdater.on('error', (error) => {
      updaterLog.error('Auto-updater error:', error);
    });

    autoUpdater.on('download-progress', (progress) => {
      updaterLog.debug(`Download progress: ${progress.percent.toFixed(2)}%`);
    });

    autoUpdater.on('update-downloaded', (info) => {
      const currentVersion = app.getVersion();
      const newVersion = info.version;

      updaterLog.info(`Update downloaded: ${newVersion}`);

      dialog
        .showMessageBox({
          type: 'info',
          title: 'Update Ready to Install',
          message: `Update to version ${newVersion} has been downloaded and is ready to install.`,
          detail: `Current version: ${currentVersion}\nNew version: ${newVersion}\n\nThe update will be installed automatically when you close the application.\n\nWould you like to restart now?`,
          buttons: ['Restart Now', 'Restart Later'],
          defaultId: 0,
          cancelId: 1,
        })
        .then((result) => {
          if (result.response === 0) {
            updaterLog.info('User chose to restart now - quitting app to trigger installation');
            // With autoInstallOnAppQuit = true, just quit the app
            // The installer will run automatically
            setImmediate(() => {
              app.quit();
            });
          } else {
            updaterLog.info('User chose to restart later - update will install on next quit');
          }
        })
        .catch((error) => {
          updaterLog.error('Error showing update dialog:', error);
        });
    });
  }
}

export const autoUpdaterService = new AutoUpdaterService();


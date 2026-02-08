import pkg from 'electron-updater';
import { app, dialog, BrowserWindow } from 'electron';
import log, { createScopedLogger } from '../utils/logger.js';
import { SettingsService } from './settings.service.js';

const { autoUpdater } = pkg;
const updaterLog = createScopedLogger('auto-updater');

class AutoUpdaterService {
  private initialized = false;
  private downloadPromptShownForVersion: string | null = null;
  private settingsService: SettingsService;
  private ghTokenWarningShown = false;

  constructor() {
    this.settingsService = new SettingsService();
  }

  initialize(): void {
    if (!app.isPackaged) {
      updaterLog.info('Skipping auto-updater initialization (development mode)');
      return;
    }

    // Check if auto-check for updates is enabled in settings
    const autoCheckEnabled =
      this.settingsService.getSetting('autoCheckUpdates') ??
      this.settingsService.getSetting('autoUpdate') ??
      true;
    if (!autoCheckEnabled) {
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

    // Auto-download only if autoInstallUpdates is enabled
    const autoInstall = this.settingsService.getSetting('autoInstallUpdates') ?? false;
    autoUpdater.autoDownload = autoInstall;
    autoUpdater.autoInstallOnAppQuit = autoInstall;

    this.setupEventHandlers();

    this.initialized = true;
    updaterLog.info('Auto-updater initialized');
  }

  /**
   * Check for updates (automatic — respects autoCheckUpdates setting)
   */
  checkForUpdates(): void {
    if (!app.isPackaged || !this.initialized) {
      return;
    }

    // Check if auto-check for updates is enabled in settings
    const autoCheckEnabled =
      this.settingsService.getSetting('autoCheckUpdates') ??
      this.settingsService.getSetting('autoUpdate') ??
      true;
    if (!autoCheckEnabled) {
      updaterLog.info('Skipping update check - auto-check disabled in settings');
      return;
    }

    updaterLog.info('Checking for updates...');
    autoUpdater.checkForUpdatesAndNotify().catch((error: unknown) => {
      updaterLog.error('checkForUpdatesAndNotify failed', error);
    });
  }

  /**
   * Check for updates (manual — always runs regardless of settings)
   */
  checkForUpdatesManual(): void {
    if (!app.isPackaged) {
      updaterLog.info('Skipping manual update check (development mode)');
      return;
    }

    // Ensure updater is initialized for manual checks
    if (!this.initialized) {
      updaterLog.info('Initializing auto-updater for manual check');
      (autoUpdater as unknown as { logger: unknown }).logger = log;
      autoUpdater.autoDownload = false;
      autoUpdater.autoInstallOnAppQuit = false;
      this.setupEventHandlers();
      this.initialized = true;
    }

    updaterLog.info('Manual update check triggered');
    autoUpdater.checkForUpdatesAndNotify().catch((error: unknown) => {
      updaterLog.error('Manual checkForUpdatesAndNotify failed', error);
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

      const message =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : typeof error === 'string'
            ? error
            : JSON.stringify(error);

      const isAuthError =
        message.includes('Bad credentials') ||
        message.includes('status:\\"401\\"') ||
        message.includes('HttpError: 401') ||
        message.includes('status":401');

      const ghTokenMissing = !process.env.GH_TOKEN;

      if (isAuthError || ghTokenMissing) {
        if (this.ghTokenWarningShown) {
          return;
        }
        this.ghTokenWarningShown = true;

        const detailLines: string[] = [];
        if (ghTokenMissing) {
          detailLines.push('Environment variable GH_TOKEN is not set.');
        } else {
          detailLines.push('GitHub reported "Bad credentials" (HTTP 401).');
        }
        detailLines.push(
          'Auto-updates require a valid GitHub Personal Access Token (GH_TOKEN) with access to the holok-ai/desktop repository.',
        );

        dialog
          .showMessageBox({
            type: 'warning',
            title: 'Auto-Update Configuration Problem',
            message: 'The application could not check for updates.',
            detail: detailLines.join('\n'),
            buttons: ['OK'],
            defaultId: 0,
          })
          .catch((dialogError) => {
            updaterLog.error('Error showing GH_TOKEN warning dialog:', dialogError);
          });
      }
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
          title: 'Update Downloaded',
          message: `Update to version ${newVersion} has been downloaded.`,
          detail: `Current version: ${currentVersion}\nNew version: ${newVersion}\n\nRestart the application to install the update?`,
          buttons: ['Restart', 'Later'],
          defaultId: 0,
          cancelId: 1,
        })
        .then((result) => {
          if (result.response === 0) {
            updaterLog.info('User chose to restart and install update');

            try {
              // On Windows, quitAndInstall will handle closing windows and quitting the app
              // Parameters: isSilent=false (show installer UI), isForceRunAfter=true (restart after install)
              // Don't manually close windows - let electron-updater handle the quit process
              autoUpdater.quitAndInstall(false, true);
              updaterLog.info('quitAndInstall called successfully');
            } catch (error) {
              updaterLog.error('Error calling quitAndInstall:', error);
              // Fallback: close windows and quit manually
              BrowserWindow.getAllWindows().forEach((window) => {
                window.close();
              });
              setTimeout(() => {
                app.quit();
              }, 100);
            }
          } else {
            updaterLog.info('User chose to install update later');
          }
        })
        .catch((error) => {
          updaterLog.error('Error showing update dialog:', error);
        });
    });
  }
}

export const autoUpdaterService = new AutoUpdaterService();

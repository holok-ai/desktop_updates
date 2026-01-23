import pkg from 'electron-updater';
import { app, dialog } from 'electron';
import { createScopedLogger } from '../utils/logger.js';

const { autoUpdater } = pkg;
const updaterLog = createScopedLogger('auto-updater');

class AutoUpdaterService {
  private initialized = false;

  initialize(): void {
    if (!app.isPackaged) {
      updaterLog.info('Skipping auto-updater initialization (development mode)');
      return;
    }

    if (this.initialized) {
      updaterLog.warn('Auto-updater already initialized');
      return;
    }

    updaterLog.info('Initializing auto-updater');

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;

    this.setupEventHandlers();

    this.initialized = true;
    updaterLog.info('Auto-updater initialized');
  }

  checkForUpdates(): void {
    if (!app.isPackaged || !this.initialized) {
      return;
    }

    updaterLog.info('Checking for updates...');
    autoUpdater.checkForUpdatesAndNotify();
  }

  private setupEventHandlers(): void {
    autoUpdater.on('checking-for-update', () => {
      updaterLog.info('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      const currentVersion = app.getVersion();
      const newVersion = info.version;
      updaterLog.info(`Update available: ${currentVersion} -> ${newVersion}`);
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
            autoUpdater.quitAndInstall();
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


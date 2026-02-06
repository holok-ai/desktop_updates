import pkg from 'electron-updater';
import { app, dialog, BrowserWindow } from 'electron';
import log, { createScopedLogger } from '../utils/logger.js';
import { SettingsService } from './settings.service.js';

const { autoUpdater } = pkg;
const updaterLog = createScopedLogger('auto-updater');

interface UpdateMetadata {
  version: string;
  releaseDate?: string;
  mandatory: boolean;
  releaseNotes?: string;
}

class AutoUpdaterService {
  private initialized = false;
  private downloadPromptShownForVersion: string | null = null;
  private settingsService: SettingsService;
  private ghTokenWarningShown = false;
  private currentUpdateMetadata: UpdateMetadata | null = null;
  private updatingModal: BrowserWindow | null = null;

  constructor() {
    this.settingsService = new SettingsService();
  }

  initialize(): void {
    if (!app.isPackaged) {
      updaterLog.info('Skipping auto-updater initialization (development mode)');
      return;
    }

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

    (autoUpdater as unknown as { logger: unknown }).logger = log;

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

  getPendingUpdateVersion(): string | undefined {
    return this.settingsService.getSetting('pendingUpdateVersion');
  }

  async checkForPendingUpdateOnShutdown(): Promise<boolean> {
    const pendingVersion = this.getPendingUpdateVersion();
    if (!pendingVersion) {
      return false;
    }

    updaterLog.info(`Pending update found: ${pendingVersion}. Installing before shutdown...`);

    try {
      const result = await dialog.showMessageBox({
        type: 'info',
        title: 'Installing Update',
        message: 'Installing update before closing...',
        detail: `Update to version ${pendingVersion} will be installed now.`,
        buttons: ['OK'],
        defaultId: 0,
      });

      if (result.response === 0) {
        this.settingsService.setSetting('pendingUpdateVersion', undefined);
        autoUpdater.quitAndInstall(false, true);
        return true;
      }
      return false;
    } catch (error) {
      updaterLog.error('Error installing pending update:', error);
      return false;
    }
  }

  private async fetchUpdateMetadata(version: string): Promise<UpdateMetadata | null> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/holok-ai/desktop_updates/releases/tags/v${version}`,
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      if (!response.ok) {
        updaterLog.warn(`Failed to fetch release metadata for v${version}: ${response.statusText}`);
        return null;
      }

      const release = (await response.json()) as {
        tag_name: string;
        published_at: string;
        body: string;
      };

      const releaseNotes = release.body || '';
      const mandatory = this.isMandatoryUpdate(releaseNotes);

      return {
        version,
        releaseDate: release.published_at,
        mandatory,
        releaseNotes,
      };
    } catch (error) {
      updaterLog.error('Error fetching update metadata:', error);
      return null;
    }
  }

  private isMandatoryUpdate(releaseNotes: string): boolean {
    if (!releaseNotes) {
      return false;
    }

    const normalized = releaseNotes.toLowerCase();
    return (
      normalized.includes('[mandatory]') ||
      normalized.includes('mandatory: true') ||
      normalized.includes('"mandatory": true') ||
      normalized.includes('mandatory update') ||
      normalized.includes('critical security') ||
      normalized.includes('security update')
    );
  }

  private showUpdatingModal(version: string): void {
    if (this.updatingModal) {
      return;
    }

    this.updatingModal = new BrowserWindow({
      width: 400,
      height: 200,
      resizable: false,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    this.updatingModal.setTitle('Updating...');
    const htmlContent = String.raw`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
        background: #f5f5f5;
      }
      .message {
        font-size: 16px;
        color: #333;
        margin-top: 20px;
      }
    </style>
  </head>
  <body>
    <div class="message">System is updating. Please wait...</div>
    <div class="message" style="font-size: 14px; color: #666; margin-top: 10px;">Updating to version ${version}</div>
  </body>
</html>`;
    this.updatingModal
      .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)
      .catch((error) => {
        updaterLog.error('Error loading updating modal:', error);
      });

    this.updatingModal.center();
  }

  private closeUpdatingModal(): void {
    if (this.updatingModal) {
      this.updatingModal.close();
      this.updatingModal = null;
    }
  }

  private setupEventHandlers(): void {
    autoUpdater.on('checking-for-update', () => {
      updaterLog.info('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      this.handleUpdateAvailable(info).catch((error) => {
        updaterLog.error('Error handling update available:', error);
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      updaterLog.info(`Update not available. Current version: ${info.version}`);
    });

    autoUpdater.on('error', (error) => {
      updaterLog.error('Auto-updater error:', error);
      this.closeUpdatingModal();

      let message: string;
      if (error instanceof Error) {
        message = `${error.name}: ${error.message}`;
      } else if (typeof error === 'string') {
        message = error;
      } else {
        message = JSON.stringify(error);
      }

      const isAuthError =
        message.includes('Bad credentials') ||
        message.includes(String.raw`status:\"401\"`) ||
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
          'Auto-updates require a valid GitHub Personal Access Token (GH_TOKEN) with access to the holok-ai/desktop_updates repository.',
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

      if (this.currentUpdateMetadata?.mandatory) {
        updaterLog.info('Mandatory update downloaded - installing automatically');
        this.closeUpdatingModal();

        try {
          autoUpdater.quitAndInstall(false, true);
          updaterLog.info('quitAndInstall called successfully for mandatory update');
        } catch (error) {
          updaterLog.error('Error calling quitAndInstall:', error);
          BrowserWindow.getAllWindows().forEach((window) => {
            window.close();
          });
          setTimeout(() => {
            app.quit();
          }, 100);
        }
      } else {
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
                autoUpdater.quitAndInstall(false, true);
                updaterLog.info('quitAndInstall called successfully');
              } catch (error) {
                updaterLog.error('Error calling quitAndInstall:', error);
                BrowserWindow.getAllWindows().forEach((window) => {
                  window.close();
                });
                setTimeout(() => {
                  app.quit();
                }, 100);
              }
            } else {
              updaterLog.info('User chose to install update later - scheduling for shutdown');
              this.settingsService.setSetting('pendingUpdateVersion', newVersion);
            }
          })
          .catch((error) => {
            updaterLog.error('Error showing update dialog:', error);
          });
      }
    });
  }

  private async handleUpdateAvailable(info: { version: string }): Promise<void> {
    const currentVersion = app.getVersion();
    const newVersion = info.version;
    updaterLog.info(`Update available: ${currentVersion} -> ${newVersion}`);

    const metadata = await this.fetchUpdateMetadata(newVersion);
    this.currentUpdateMetadata = metadata || {
      version: newVersion,
      mandatory: false,
    };

    if (this.currentUpdateMetadata.mandatory) {
      updaterLog.info(`Mandatory update detected: ${newVersion}`);
      this.showUpdatingModal(newVersion);
      autoUpdater.downloadUpdate().catch((error: unknown) => {
        updaterLog.error('downloadUpdate failed', error);
        this.closeUpdatingModal();
      });
    } else {
      updaterLog.info(`Optional update available: ${newVersion}`);
      if (this.downloadPromptShownForVersion !== newVersion) {
        this.downloadPromptShownForVersion = newVersion;
        const releaseNotes =
          this.currentUpdateMetadata.releaseNotes || 'No release notes available.';
        const releaseDate = this.currentUpdateMetadata.releaseDate
          ? new Date(this.currentUpdateMetadata.releaseDate).toLocaleDateString()
          : '';

        const detailPrefix = releaseDate ? `Released: ${releaseDate}\n\n` : '';
        const notesPreview = releaseNotes.substring(0, 500);
        const notesSuffix = releaseNotes.length > 500 ? '...' : '';
        const detailText = `${detailPrefix}${notesPreview}${notesSuffix}\n\nWould you like to update now?`;

        dialog
          .showMessageBox({
            type: 'info',
            title: 'Update Available',
            message: `A new version (${newVersion}) is available.`,
            detail: detailText,
            buttons: ['Update Now', 'Later'],
            defaultId: 0,
            cancelId: 1,
          })
          .then((result) => {
            if (result.response === 0) {
              updaterLog.info('User chose to update now');
              autoUpdater.downloadUpdate().catch((error: unknown) => {
                updaterLog.error('downloadUpdate failed', error);
              });
            } else {
              updaterLog.info('User chose to update later');
            }
          })
          .catch((error) => {
            updaterLog.error('Error showing update dialog:', error);
          });
      }
    }
  }
}

export const autoUpdaterService = new AutoUpdaterService();

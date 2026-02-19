import pkg from 'electron-updater';
import { app, dialog, BrowserWindow } from 'electron';
import log, { createScopedLogger } from '../utils/logger.js';
import { SettingsService } from './settings.service.js';
import packageJson from '../../package.json' with { type: 'json' };

const { autoUpdater } = pkg;
const updaterLog = createScopedLogger('auto-updater');

// Log immediately when module loads to verify logger is working
updaterLog.info('Auto-updater service module loaded');

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
  private downloadedUpdateVersion: string | null = null;

  constructor() {
    this.settingsService = new SettingsService();
  }

  /**
   * Get GitHub repository info from package.json build configuration
   */
  private getUpdateRepoInfo(): { owner: string; repo: string; provider: string } {
    const publishConfig = packageJson.build?.publish?.[0];

    if (!publishConfig) {
      throw new Error('No publish configuration found in package.json');
    }

    return {
      owner: publishConfig.owner,
      repo: publishConfig.repo,
      provider: publishConfig.provider,
    };
  }

  initialize(): void {
    updaterLog.info(`Initializing auto-updater (isPackaged: ${app.isPackaged})`);

    if (!app.isPackaged) {
      updaterLog.info('Skipping auto-updater initialization (development mode)');
      return;
    }

    if (this.initialized) {
      updaterLog.warn('Auto-updater already initialized');
      return;
    }

    updaterLog.info('Initializing auto-updater');

    (autoUpdater as unknown as { logger: unknown }).logger = log;

    // Do NOT auto-download updates by default.
    // We control download behavior manually:
    // - Mandatory updates: always download.
    // - Optional updates: only download when autoUpdate is enabled and user chooses \"Update Now\".
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;

    this.setupEventHandlers();

    this.initialized = true;
    updaterLog.info('Auto-updater initialized successfully');
  }

  /**
   * Check for updates (automatic — respects autoCheckUpdates setting)
   */
  checkForUpdates(): void {
    updaterLog.info(
      `checkForUpdates called (isPackaged: ${app.isPackaged}, initialized: ${this.initialized})`,
    );

    if (!app.isPackaged) {
      updaterLog.info('Skipping update check - not packaged');
      return;
    }

    if (!this.initialized) {
      updaterLog.warn('Skipping update check - auto-updater not initialized');
      return;
    }

    // Always check for updates (mandatory updates should install even if auto-update is disabled)
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
      // Check if update is actually downloaded before trying to install
      if (!this.downloadedUpdateVersion || this.downloadedUpdateVersion !== pendingVersion) {
        updaterLog.warn(
          `Update ${pendingVersion} not downloaded yet. Clearing pending update and allowing quit.`,
        );
        this.settingsService.clearSetting('pendingUpdateVersion');
        this.downloadedUpdateVersion = null;
        return false;
      }

      // Clear the pending update flag immediately to prevent loops
      this.settingsService.clearSetting('pendingUpdateVersion');

      // Install update automatically without showing dialog
      // The user already chose "Later" which means install on shutdown
      updaterLog.info(`Installing update ${pendingVersion} before shutdown (automatic)...`);

      try {
        autoUpdater.quitAndInstall(false, true);
        updaterLog.info('quitAndInstall called successfully');
        this.downloadedUpdateVersion = null;

        // Give it a moment to start the install process
        // If quitAndInstall works, the app will quit immediately
        // This timeout just prevents hanging if something goes wrong
        await new Promise((resolve) => setTimeout(resolve, 1000));

        return true;
      } catch (installError) {
        updaterLog.error('Error calling quitAndInstall:', installError);
        this.downloadedUpdateVersion = null;
        // If quitAndInstall fails, allow normal quit
        return false;
      }
    } catch (error) {
      updaterLog.error('Error installing pending update:', error);
      // Clear the pending update on error to prevent getting stuck
      this.settingsService.clearSetting('pendingUpdateVersion');
      this.downloadedUpdateVersion = null;
      return false;
    }
  }

  private async fetchUpdateMetadata(version: string): Promise<UpdateMetadata | null> {
    try {
      const { owner, repo } = this.getUpdateRepoInfo();
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/releases/tags/v${version}`,
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
      // Clear update available flag in settings
      this.settingsService.setSetting('updateAvailable', false);
      this.settingsService.setSetting('latestVersion', '');
    });

    autoUpdater.on('error', (error) => {
      updaterLog.error('Auto-updater error:', error);

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

      const isCodeSignatureError =
        message.includes('Code signature') ||
        message.includes('code signature') ||
        message.includes('signature validation');

      // Only show error dialog for actual authentication errors (401)
      // GH_TOKEN is NOT required for downloading from public repos - only for publishing
      // Code signature errors are non-fatal for unsigned apps - log but don't block
      // Don't close modal for download errors during mandatory updates - let it retry
      if (isAuthError) {
        this.closeUpdatingModal();

        if (this.ghTokenWarningShown) {
          return;
        }
        this.ghTokenWarningShown = true;

        dialog
          .showMessageBox({
            type: 'warning',
            title: 'Auto-Update Configuration Problem',
            message: 'The application could not check for updates.',
            detail:
              'GitHub reported "Bad credentials" (HTTP 401).\n\nThis may indicate a problem with the update repository configuration. Please contact support if this persists.',
            buttons: ['OK'],
            defaultId: 0,
          })
          .catch((dialogError) => {
            updaterLog.error('Error showing warning dialog:', dialogError);
          });
      } else if (isCodeSignatureError) {
        // Code signature errors are expected for unsigned apps
        // Log but don't block - the update can still proceed
        updaterLog.warn(
          'Code signature validation error (app not code signed - this is expected):',
          message,
        );
        updaterLog.warn(
          'Update will proceed despite signature error. For production, enable code signing in package.json.',
        );
      } else {
        // For other errors (network, download issues), log but don't close modal
        // The modal should stay open during mandatory updates to show progress
        updaterLog.warn('Non-fatal auto-updater error (keeping modal open):', message);
      }
    });

    autoUpdater.on('download-progress', (progress) => {
      const percent = progress.percent.toFixed(2);
      updaterLog.info(`Download progress: ${percent}%`);
      // Keep modal open during download - it will close when update is downloaded and installed
    });

    autoUpdater.on('update-downloaded', (info) => {
      void (async () => {
        const currentVersion = app.getVersion();
        const newVersion = info.version;

        updaterLog.info(`Update downloaded: ${newVersion}`);
        this.downloadedUpdateVersion = newVersion;

        // Fetch metadata again to ensure we have the correct mandatory flag
        // This is important because the metadata might not have been fetched earlier
        // or might have been lost between events
        const metadata = await this.fetchUpdateMetadata(newVersion);
        const isMandatory = metadata?.mandatory ?? this.currentUpdateMetadata?.mandatory ?? false;

        updaterLog.info(
          `Update downloaded metadata check: mandatory=${isMandatory}, version=${newVersion}`,
        );

        if (isMandatory) {
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
      })().catch((error) => {
        updaterLog.error('Error in update-downloaded handler:', error);
      });
    });
  }

  private async handleUpdateAvailable(info: { version: string }): Promise<void> {
    const currentVersion = app.getVersion();
    const newVersion = info.version;
    updaterLog.info(`Update available: ${currentVersion} -> ${newVersion}`);

    // Update settings to reflect that an update is available
    this.settingsService.setSetting('updateAvailable', true);
    this.settingsService.setSetting('latestVersion', newVersion);

    const metadata = await this.fetchUpdateMetadata(newVersion);
    this.currentUpdateMetadata = metadata || {
      version: newVersion,
      mandatory: false,
    };

    if (this.currentUpdateMetadata.mandatory) {
      updaterLog.info(`Mandatory update detected: ${newVersion}`);
      this.showUpdatingModal(newVersion);

      // Start download - keep modal open even if there are errors
      // The error handler will only close it for fatal errors (auth issues)
      autoUpdater.downloadUpdate().catch((error: unknown) => {
        updaterLog.error('downloadUpdate failed', error);
        // Don't close modal here - let the error handler decide
        // For mandatory updates, we want to keep trying
      });
    } else {
      // Optional update - only show prompt if auto-update is enabled
      const autoUpdateEnabled = this.settingsService.getSetting('autoUpdate') ?? true;
      if (!autoUpdateEnabled) {
        updaterLog.info(
          `Optional update available: ${newVersion}, but auto-updates are disabled. Skipping prompt.`,
        );
        return;
      }

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

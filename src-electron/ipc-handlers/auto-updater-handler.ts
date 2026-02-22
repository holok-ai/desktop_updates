import { ipcMain } from 'electron';
import { autoUpdaterService } from '../services/auto-updater.service.js';
import { createScopedLogger } from '../utils/logger.js';

const updaterLog = createScopedLogger('auto-updater-handler');

/**
 * Register all auto-updater IPC handlers
 */
export function registerAutoUpdaterHandlers(): void {
  /**
   * Check whether an update is available and return a human-readable status string.
   */
  ipcMain.handle('updater:getUpdateAvailability', (): Promise<string> => {
    updaterLog.info('getUpdateAvailability called');
    return autoUpdaterService.getUpdateAvailability();
  });

  /**
   * Manually trigger an update check (fire-and-forget, legacy settings channel).
   */
  ipcMain.handle('updater:checkForUpdates', (): Promise<{ success: boolean; error?: string }> => {
    updaterLog.info('CheckForUpdates called (manual)');
    try {
      autoUpdaterService.checkForUpdates();
      return Promise.resolve({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check for updates';
      updaterLog.error('CheckForUpdates failed', { error: message });
      return Promise.resolve({ success: false, error: message });
    }
  });

  /**
   * Trigger an immediate download of the available update.
   */
  ipcMain.handle('updater:updateNow', (): Promise<{ success: boolean; error?: string }> => {
    updaterLog.info('updateNow called');
    return autoUpdaterService.updateNow();
  });

  /**
   * Returns whether the app is running as a development (unpackaged) build.
   */
  ipcMain.handle('updater:isDevelopmentBuild', (): boolean => {
    return autoUpdaterService.isDevelopmentBuild();
  });

  updaterLog.info('Handlers registered');
}

/**
 * Clean up handlers (called when app is closing)
 */
export function unregisterAutoUpdaterHandlers(): void {
  ipcMain.removeHandler('updater:checkForUpdates');
  ipcMain.removeHandler('updater:getUpdateAvailability');
  ipcMain.removeHandler('updater:updateNow');
  ipcMain.removeHandler('updater:isDevelopmentBuild');

  updaterLog.info('Handlers unregistered');
}

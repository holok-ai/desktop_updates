import { ipcMain, dialog, app, shell } from 'electron';
import { SettingsService, type AppSettings } from '../services/settings.service.js';
import { createScopedLogger } from '../utils/logger.js';
import { DEFAULT_HOLO_API_URL } from '../../src-shared/constants/api.constant.js';
import path from 'node:path';

/**
 * Settings IPC Handlers
 *
 * Handles all settings-related IPC communication between
 * renderer and main process.
 */

const settingsLog = createScopedLogger('settings');

let settingsService: SettingsService;

/**
 * Register all settings IPC handlers
 */
export function registerSettingsHandlers(): void {
  // Initialize settings service. If initialization fails (e.g. in test env
  // where electron/app paths are not available), fall back to a safe
  // in-memory stub so IPC handlers can still be registered.
  try {
    settingsService = new SettingsService();
  } catch (err) {
    settingsLog.error(
      '[IPC] Failed to initialize SettingsService, falling back to in-memory stub',
      err,
    );
    // Minimal stub implementing the same API used by handlers
    settingsService = {
      getAllSettings: () =>
        ({
          mokuWebUrl: 'http://localhost:4200',
          mokuApiUrl: 'http://localhost:8080',
          holoApiUrl: DEFAULT_HOLO_API_URL,
          directoryWhitelist: [],
          theme: 'light',
          logLevel: 'info',
        }) as AppSettings,
      getSetting: (_key: keyof AppSettings) => undefined,
      setSetting: (_k: keyof AppSettings, _v: AppSettings[keyof AppSettings]) => {},
      setSettings: (_s: Partial<AppSettings>) => {},
      resetToDefaults: () => {},
      getMokuWebUrl: () => 'http://localhost:4200',
      getMokuApiUrl: () => 'http://localhost:8080',
      getHoloApiUrl: () => DEFAULT_HOLO_API_URL,
      getStorePath: () => '',
      getDirectoryWhitelist: () => [],
      addWhitelistPath: (_p: string) => {},
      removeWhitelistPath: (_p: string) => {},
      setDirectoryWhitelist: (_p: string[]) => {},
    } as unknown as SettingsService;
  }

  /**
   * Get all settings
   */
  ipcMain.handle('settings:getAll', (): Promise<AppSettings> => {
    settingsLog.info('GetAll called');
    return Promise.resolve(settingsService.getAllSettings());
  });

  /**
   * Get a specific setting
   */
  ipcMain.handle('settings:get', (_event, key: keyof AppSettings): Promise<unknown> => {
    settingsLog.info('Get called', { key });
    return Promise.resolve(settingsService.getSetting(key));
  });

  /**
   * Set a specific setting
   */
  ipcMain.handle(
    'settings:set',
    (_event, key: keyof AppSettings, value: unknown): Promise<void> => {
      settingsLog.info('Set called', { key, value });
      settingsService.setSetting(key, value as AppSettings[keyof AppSettings]);
      return Promise.resolve();
    },
  );

  /**
   * Set multiple settings
   */
  ipcMain.handle(
    'settings:setMultiple',
    (_event, settings: Partial<AppSettings>): Promise<void> => {
      settingsLog.info('SetMultiple called', { settings });
      settingsService.setSettings(settings);
      return Promise.resolve();
    },
  );

  /**
   * Reset settings to defaults
   */
  ipcMain.handle('settings:reset', (): Promise<void> => {
    settingsLog.info('Reset called');
    settingsService.resetToDefaults();
    return Promise.resolve();
  });

  /**
   * Get Moku Web URL
   */
  ipcMain.handle('settings:getMokuWebUrl', (): Promise<string> => {
    settingsLog.info('GetMokuWebUrl called');
    return Promise.resolve(settingsService.getMokuWebUrl());
  });

  /**
   * Get Moku API URL
   */
  ipcMain.handle('settings:getMokuApiUrl', (): Promise<string> => {
    settingsLog.info('GetMokuApiUrl called');
    return Promise.resolve(settingsService.getMokuApiUrl());
  });

  /**
   * Get settings file path
   */
  ipcMain.handle('settings:getStorePath', (): Promise<string> => {
    settingsLog.info('GetStorePath called');
    return Promise.resolve(settingsService.getStorePath());
  });

  /**
   * Get directory whitelist
   */
  ipcMain.handle('settings:getDirectoryWhitelist', (): Promise<string[]> => {
    settingsLog.info('GetDirectoryWhitelist called');
    return Promise.resolve(settingsService.getDirectoryWhitelist());
  });

  /**
   * Add path to file tools whitelist
   */
  ipcMain.handle('settings:addWhitelistPath', (_event, filePath: string): Promise<void> => {
    settingsLog.info('AddWhitelistPath called', { filePath });
    try {
      settingsService.addWhitelistPath(filePath);
      return Promise.resolve();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      settingsLog.error('AddWhitelistPath failed', { filePath, error: message });
      return Promise.reject(new Error(message));
    }
  });

  /**
   * Remove path from file tools whitelist
   */
  ipcMain.handle('settings:removeWhitelistPath', (_event, filePath: string): Promise<void> => {
    settingsLog.info('RemoveWhitelistPath called', { filePath });
    settingsService.removeWhitelistPath(filePath);
    return Promise.resolve();
  });

  /**
   * Select folder using native dialog
   */
  ipcMain.handle('settings:selectFolder', async (): Promise<string | null> => {
    settingsLog.info('SelectFolder called');
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Folder for File Tools Whitelist',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  /**
   * Open log file in default application
   */
  ipcMain.handle(
    'settings:openLogInVSCode',
    async (): Promise<{ success: boolean; error?: string }> => {
      settingsLog.info('OpenLogInVSCode called');
      try {
        const logPath = path.join(app.getPath('userData'), 'logs', 'main.log');

        // Check if log file exists
        const fs = await import('node:fs');
        if (!fs.existsSync(logPath)) {
          settingsLog.warn('Log file does not exist:', logPath);
          return { success: false, error: 'Log file does not exist yet' };
        }

        // Use shell.openPath to open with default application (works on all platforms)
        await shell.openPath(logPath);
        settingsLog.info('Log file opened successfully:', logPath);
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to open log file';
        settingsLog.error('OpenLogInVSCode failed', { error: message });
        return { success: false, error: message };
      }
    },
  );

  settingsLog.info('Handlers registered');
}

/**
 * Get settings service instance
 * Used by other services (like AuthService) to access settings
 */
export function getSettingsService(): SettingsService {
  if (!settingsService) {
    settingsService = new SettingsService();
  }
  return settingsService;
}

/**
 * Clean up handlers (called when app is closing)
 */
export function unregisterSettingsHandlers(): void {
  ipcMain.removeHandler('settings:getAll');
  ipcMain.removeHandler('settings:get');
  ipcMain.removeHandler('settings:set');
  ipcMain.removeHandler('settings:setMultiple');
  ipcMain.removeHandler('settings:reset');
  ipcMain.removeHandler('settings:getMokuWebUrl');
  ipcMain.removeHandler('settings:getMokuApiUrl');
  ipcMain.removeHandler('settings:getStorePath');
  ipcMain.removeHandler('settings:getDirectoryWhitelist');
  ipcMain.removeHandler('settings:addWhitelistPath');
  ipcMain.removeHandler('settings:removeWhitelistPath');
  ipcMain.removeHandler('settings:selectFolder');
  ipcMain.removeHandler('settings:openLogInVSCode');

  settingsLog.info('Handlers unregistered');
}

import { ipcMain } from 'electron';
import { SettingsService, type AppSettings } from '../services/settings.service.js';
import { createScopedLogger } from '../utils/logger.js';

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
  // Initialize settings service
  settingsService = new SettingsService();

  /**
   * Get all settings
   */
  ipcMain.handle('settings:getAll', (): Promise<AppSettings> => {
    settingsLog.info('settings:getAll called');
    return Promise.resolve(settingsService.getAllSettings());
  });

  /**
   * Get a specific setting
   */
  ipcMain.handle('settings:get', (_event, key: keyof AppSettings): Promise<unknown> => {
    settingsLog.info('settings:get called', { key });
    return Promise.resolve(settingsService.getSetting(key));
  });

  /**
   * Set a specific setting
   */
  ipcMain.handle(
    'settings:set',
    (_event, key: keyof AppSettings, value: unknown): Promise<void> => {
      settingsLog.info('settings:set called', { key, value });
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
      settingsLog.info('settings:setMultiple called', { settings });
      settingsService.setSettings(settings);
      return Promise.resolve();
    },
  );

  /**
   * Reset settings to defaults
   */
  ipcMain.handle('settings:reset', (): Promise<void> => {
    settingsLog.info('settings:reset called');
    settingsService.resetToDefaults();
    return Promise.resolve();
  });

  /**
   * Get Moku Web URL
   */
  ipcMain.handle('settings:getMokuWebUrl', (): Promise<string> => {
    settingsLog.info('settings:getMokuWebUrl called');
    return Promise.resolve(settingsService.getMokuWebUrl());
  });

  /**
   * Get Moku API URL
   */
  ipcMain.handle('settings:getMokuApiUrl', (): Promise<string> => {
    settingsLog.info('settings:getMokuApiUrl called');
    return Promise.resolve(settingsService.getMokuApiUrl());
  });

  /**
   * Get settings file path
   */
  ipcMain.handle('settings:getStorePath', (): Promise<string> => {
    settingsLog.info('settings:getStorePath called');
    return Promise.resolve(settingsService.getStorePath());
  });

  settingsLog.info('Settings handlers registered');
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

  settingsLog.info('Settings handlers unregistered');
}

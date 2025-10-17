import { ipcMain } from 'electron';
import { SettingsService, AppSettings } from '../services/settings.service';
import log from 'electron-log';

/**
 * Settings IPC Handlers
 * 
 * Handles all settings-related IPC communication between
 * renderer and main process.
 */

let settingsService: SettingsService;

/**
 * Register all settings IPC handlers
 */
export function registerSettingsHandlers() {
  // Initialize settings service
  settingsService = new SettingsService();

  /**
   * Get all settings
   */
  ipcMain.handle('settings:getAll', async (): Promise<AppSettings> => {
    log.info('[IPC] settings:getAll called');
    return settingsService.getAllSettings();
  });

  /**
   * Get a specific setting
   */
  ipcMain.handle('settings:get', async (_event, key: keyof AppSettings): Promise<any> => {
    log.info('[IPC] settings:get called with key:', key);
    return settingsService.getSetting(key);
  });

  /**
   * Set a specific setting
   */
  ipcMain.handle('settings:set', async (_event, key: keyof AppSettings, value: any): Promise<void> => {
    log.info('[IPC] settings:set called with key:', key, 'value:', value);
    settingsService.setSetting(key, value);
  });

  /**
   * Set multiple settings
   */
  ipcMain.handle('settings:setMultiple', async (_event, settings: Partial<AppSettings>): Promise<void> => {
    log.info('[IPC] settings:setMultiple called with:', settings);
    settingsService.setSettings(settings);
  });

  /**
   * Reset settings to defaults
   */
  ipcMain.handle('settings:reset', async (): Promise<void> => {
    log.info('[IPC] settings:reset called');
    settingsService.resetToDefaults();
  });

  /**
   * Get Moku Web URL
   */
  ipcMain.handle('settings:getMokuWebUrl', async (): Promise<string> => {
    log.info('[IPC] settings:getMokuWebUrl called');
    return settingsService.getMokuWebUrl();
  });

  /**
   * Get Moku API URL
   */
  ipcMain.handle('settings:getMokuApiUrl', async (): Promise<string> => {
    log.info('[IPC] settings:getMokuApiUrl called');
    return settingsService.getMokuApiUrl();
  });

  /**
   * Get settings file path
   */
  ipcMain.handle('settings:getStorePath', async (): Promise<string> => {
    log.info('[IPC] settings:getStorePath called');
    return settingsService.getStorePath();
  });

  log.info('[IPC] Settings handlers registered');
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
export function unregisterSettingsHandlers() {
  ipcMain.removeHandler('settings:getAll');
  ipcMain.removeHandler('settings:get');
  ipcMain.removeHandler('settings:set');
  ipcMain.removeHandler('settings:setMultiple');
  ipcMain.removeHandler('settings:reset');
  ipcMain.removeHandler('settings:getMokuWebUrl');
  ipcMain.removeHandler('settings:getMokuApiUrl');
  ipcMain.removeHandler('settings:getStorePath');
  
  log.info('[IPC] Settings handlers unregistered');
}

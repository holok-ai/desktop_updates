import { ipcMain, app } from 'electron';
import { createScopedLogger } from '../utils/logger.js';

/**
 * System IPC Handlers
 *
 * This module contains IPC handlers for system-level operations.
 */

const systemLog = createScopedLogger('system');

/**
 * Register all system-related IPC handlers
 */
export function registerSystemHandlers(): void {
  /**
   * Get platform information
   */
  ipcMain.handle('system:platform', (): Promise<string> => {
    systemLog.info('system:platform called');
    return Promise.resolve(process.platform);
  });

  /**
   * Get Electron version
   */
  ipcMain.handle('system:version', (): Promise<string> => {
    systemLog.info('system:version called');
    return Promise.resolve(process.versions.electron);
  });

  /**
   * Get system path
   */
  ipcMain.handle(
    'system:getPath',
    (
      _event,
      name: 'home' | 'appData' | 'userData' | 'temp' | 'desktop' | 'documents' | 'downloads',
    ): Promise<string> => {
      systemLog.info('system:getPath called', { name });
      return Promise.resolve(app.getPath(name));
    },
  );

  systemLog.info('System handlers registered');
}

/**
 * Clean up handlers (called when app is closing)
 */
export function unregisterSystemHandlers(): void {
  ipcMain.removeHandler('system:platform');
  ipcMain.removeHandler('system:version');
  ipcMain.removeHandler('system:getPath');
  systemLog.info('System handlers unregistered');
}

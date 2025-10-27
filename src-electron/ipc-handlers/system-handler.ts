import { ipcMain, app } from 'electron';

/**
 * System IPC Handlers
 * 
 * This module contains IPC handlers for system-level operations.
 */

/**
 * Register all system-related IPC handlers
 */
export function registerSystemHandlers(): void {
  /**
   * Get platform information
   */
  ipcMain.handle('system:platform', (): Promise<string> => {
    console.log('[IPC] system:platform called');
    return Promise.resolve(process.platform);
  });

  /**
   * Get Electron version
   */
  ipcMain.handle('system:version', (): Promise<string> => {
    console.log('[IPC] system:version called');
    return Promise.resolve(process.versions.electron);
  });

  /**
   * Get system path
   */
  ipcMain.handle('system:getPath', (_event, name: 'home' | 'appData' | 'userData' | 'temp' | 'desktop' | 'documents' | 'downloads'): Promise<string> => {
    console.log('[IPC] system:getPath called with name:', name);
    return Promise.resolve(app.getPath(name));
  });

  console.log('[IPC] System handlers registered');
}

/**
 * Clean up handlers (called when app is closing)
 */
export function unregisterSystemHandlers(): void {
  ipcMain.removeHandler('system:platform');
  ipcMain.removeHandler('system:version');
  ipcMain.removeHandler('system:getPath');
  console.log('[IPC] System handlers unregistered');
}

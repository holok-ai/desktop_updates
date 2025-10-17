import { ipcMain, app } from 'electron';

/**
 * System IPC Handlers
 * 
 * This module contains IPC handlers for system-level operations.
 */

/**
 * Register all system-related IPC handlers
 */
export function registerSystemHandlers() {
  /**
   * Get platform information
   */
  ipcMain.handle('system:platform', async (): Promise<string> => {
    console.log('[IPC] system:platform called');
    return process.platform;
  });

  /**
   * Get Electron version
   */
  ipcMain.handle('system:version', async (): Promise<string> => {
    console.log('[IPC] system:version called');
    return process.versions.electron;
  });

  /**
   * Get system path
   */
  ipcMain.handle('system:getPath', async (_event, name: string): Promise<string> => {
    console.log('[IPC] system:getPath called with name:', name);
    return app.getPath(name as any);
  });

  console.log('[IPC] System handlers registered');
}

/**
 * Clean up handlers (called when app is closing)
 */
export function unregisterSystemHandlers() {
  ipcMain.removeHandler('system:platform');
  ipcMain.removeHandler('system:version');
  ipcMain.removeHandler('system:getPath');
  console.log('[IPC] System handlers unregistered');
}

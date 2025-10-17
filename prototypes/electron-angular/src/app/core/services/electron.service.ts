import { Injectable } from '@angular/core';
import { ElectronAPI } from '../../../../src-electron/preload';

/**
 * Electron Service
 * 
 * This service provides a type-safe wrapper around the Electron IPC API
 * exposed through the context bridge. It's the central point for all
 * renderer-to-main process communication.
 * 
 * Usage in components/services:
 * ```typescript
 * constructor(private electronService: ElectronService) {
 *   if (this.electronService.isElectron) {
 *     // Use Electron APIs
 *   }
 * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class ElectronService {
  /**
   * Check if the app is running in Electron
   */
  get isElectron(): boolean {
    return !!(window && window.electronAPI);
  }

  /**
   * Get the Electron API
   * Throws an error if not running in Electron
   */
  get api(): ElectronAPI {
    if (!this.isElectron) {
      throw new Error('Not running in Electron environment');
    }
    return window.electronAPI;
  }

  /**
   * Get the Electron API safely (returns undefined if not in Electron)
   */
  get apiSafe(): ElectronAPI | undefined {
    return this.isElectron ? window.electronAPI : undefined;
  }

  constructor() {
    if (this.isElectron) {
      console.log('✓ Electron API is available');
    } else {
      console.warn('⚠ Not running in Electron - some features may not be available');
    }
  }
}

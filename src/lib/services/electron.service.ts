/**
 * Electron Service
 * Provides access to Electron APIs with error handling
 */
class ElectronService {
  get api(): typeof window.electronAPI {
    if (typeof window.electronAPI === 'undefined') {
      throw new Error('Electron API not available');
    }
    return window.electronAPI;
  }

  // System operations
  async getPlatform(): Promise<string> {
    return this.api.system.platform();
  }

  async getVersion(): Promise<string> {
    return this.api.system.version();
  }

  // Logging
  log = {
    info: (message: string, ...params: unknown[]): void => {
      this.api.log.info(message, ...params);
    },
    warn: (message: string, ...params: unknown[]): void => {
      this.api.log.warn(message, ...params);
    },
    error: (message: string, ...params: unknown[]): void => {
      this.api.log.error(message, ...params);
    },
  };
}

export const electronService = new ElectronService();

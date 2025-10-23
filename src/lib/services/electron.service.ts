/**
 * Electron Service
 * Provides access to Electron APIs with error handling
 */
class ElectronService {
  get api() {
    if (!window.electronAPI) {
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
    info: (message: string, ...params: any[]) => {
      this.api.log.info(message, ...params);
    },
    warn: (message: string, ...params: any[]) => {
      this.api.log.warn(message, ...params);
    },
    error: (message: string, ...params: any[]) => {
      this.api.log.error(message, ...params);
    }
  };
}

export const electronService = new ElectronService();

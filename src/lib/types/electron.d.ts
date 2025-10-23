import type { ElectronAPI } from '../../../src-electron/preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};

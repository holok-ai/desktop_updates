import { writable, derived, type Readable } from 'svelte/store';

class NetworkService {
  private onlineStore = writable(navigator.onLine);
  
  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  private handleOnline = (): void => {
    this.onlineStore.set(true);
  };

  private handleOffline = (): void => {
    this.onlineStore.set(false);
  };

  get isOnline(): Readable<boolean> {
    return derived(this.onlineStore, ($online) => $online);
  }

  get isOffline(): Readable<boolean> {
    return derived(this.onlineStore, ($online) => !$online);
  }

  getCurrentStatus(): boolean {
    return navigator.onLine;
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
  }
}

export const networkService = new NetworkService();


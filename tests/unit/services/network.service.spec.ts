import { describe, it, expect, vi, beforeEach } from 'vitest';
import { networkService } from '$lib/services/network.service';

describe('NetworkService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect online status', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    expect(networkService.getCurrentStatus()).toBe(true);
  });

  it('should detect offline status', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    expect(networkService.getCurrentStatus()).toBe(false);
  });

  it('should emit online event when connection restored', async () => {
    const onlineEvent = new Event('online');

    let isOnlineValue = false;
    networkService.isOnline.subscribe((value) => {
      isOnlineValue = value;
    });

    window.dispatchEvent(onlineEvent);

    // Wait for event to propagate
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(isOnlineValue).toBe(true);
  });

  it('should emit offline event when connection lost', async () => {
    const offlineEvent = new Event('offline');

    let isOfflineValue = false;
    networkService.isOffline.subscribe((value) => {
      isOfflineValue = value;
    });

    window.dispatchEvent(offlineEvent);

    // Wait for event to propagate
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(isOfflineValue).toBe(true);
  });
});

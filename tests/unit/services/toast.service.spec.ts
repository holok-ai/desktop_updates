import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ToastMessage } from '../../../src/lib/services/toast.service.js';
import { toastStore } from '../../../src/lib/services/toast.service.js';

describe('toast.service', () => {
  let lastToast: ToastMessage | null;
  let unsubscribe: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    lastToast = null;
    unsubscribe = toastStore.subscribe((value) => {
      lastToast = value;
    });
  });

  afterEach(() => {
    unsubscribe();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('show sets toast message with id and clears after duration', () => {
    toastStore.show('Hello world', 1000);

    expect(lastToast).not.toBeNull();
    expect(lastToast?.message).toBe('Hello world');
    expect(typeof lastToast?.id).toBe('string');
    expect(lastToast?.duration).toBe(1000);

    vi.advanceTimersByTime(1000);

    expect(lastToast).toBeNull();
  });

  it('hide clears toast immediately', () => {
    toastStore.show('Will be cleared', 5000);
    expect(lastToast).not.toBeNull();

    toastStore.hide();

    expect(lastToast).toBeNull();
  });

  it('show with zero duration does not auto-clear', () => {
    toastStore.show('Persistent', 0);

    expect(lastToast).not.toBeNull();
    expect(lastToast?.message).toBe('Persistent');

    vi.advanceTimersByTime(10_000);

    expect(lastToast).not.toBeNull();
    expect(lastToast?.message).toBe('Persistent');
  });
});



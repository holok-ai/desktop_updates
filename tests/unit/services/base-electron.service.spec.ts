import { describe, it, expect, beforeEach } from 'vitest';
import { BaseElectronService } from '../../../src/lib/services/base-electron.service.js';

function resetSingletons() {
  // BaseElectronService stores instances in a private static Map; clear between tests
  const ctor = BaseElectronService as unknown as {
    instances?: Map<string, BaseElectronService>;
  };
  ctor.instances?.clear();
}

describe('BaseElectronService', () => {
  beforeEach(() => {
    resetSingletons();
  });

  it('reuses the same singleton instance across multiple getInstance calls', () => {
    class ExampleService extends BaseElectronService {
      static getInstance(): ExampleService {
        return BaseElectronService.getSingletonInstance.call(this);
      }
      protected initializeEventListeners(): void {
        // no-op
      }
    }

    const a = ExampleService.getInstance();
    const b = ExampleService.getInstance();
    expect(a).toBe(b);
  });

  it('registerCleanup() adds unsubscribe functions and cleanup() calls them all', () => {
    class CleanupService extends BaseElectronService {
      public initializeCount = 0;
      static getInstance(): CleanupService {
        return BaseElectronService.getSingletonInstance.call(this);
      }
      protected initializeEventListeners(): void {
        this.initializeCount += 1;
        this.registerCleanup(() => {
          // no-op unsub #1
        });
        this.registerCleanup(() => {
          // no-op unsub #2
        });
      }
    }

    const svc = CleanupService.getInstance();
    expect(svc.initializeCount).toBe(1);

    const calls: string[] = [];
    // add dynamic cleanup hooks for test
    (svc as unknown as { registerCleanup: (fn: () => void) => void }).registerCleanup(() =>
      calls.push('a'),
    );
    (svc as unknown as { registerCleanup: (fn: () => void) => void }).registerCleanup(() =>
      calls.push('b'),
    );

    svc.cleanup();
    expect(calls).toEqual(['a', 'b']);

    // calling cleanup again should not re-run callbacks
    svc.cleanup();
    expect(calls).toEqual(['a', 'b']);
  });

  it('requires subclasses to implement initializeEventListeners (compile-time)', () => {
    // @ts-expect-error - abstract method must be implemented
    class BadService extends BaseElectronService {}

    // Runtime: nothing to assert; presence of @ts-expect-error is the check.
    expect(true).toBe(true);
  });
});

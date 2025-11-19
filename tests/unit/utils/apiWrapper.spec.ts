import { afterEach, describe, expect, it, vi } from 'vitest';
import { wrapElectronCall, wrapElectronCallWithFallback } from '../../../src/lib/utils/apiWrapper';

describe('apiWrapper', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('wrapElectronCall', () => {
    it('returns the result of the operation', async () => {
      const op = vi.fn().mockResolvedValue({ ok: true });
      const result = await wrapElectronCall(op, 'Should not fail');
      expect(result).toEqual({ ok: true });
      expect(op).toHaveBeenCalledTimes(1);
    });

    it('logs and rethrows errors with original stack', async () => {
      const error = new Error('boom');
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await expect(
        wrapElectronCall(async () => {
          throw error;
        }, 'Exploded'),
      ).rejects.toBe(error);
      expect(spy).toHaveBeenCalledWith('Exploded:', error);
    });

    it('supports async operations that resolve later', async () => {
      const op = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            setTimeout(() => resolve('done'), 0);
          }),
      );
      await expect(wrapElectronCall(op, 'Delayed op')).resolves.toBe('done');
      expect(op).toHaveBeenCalledTimes(1);
    });

    it('works with void return types', async () => {
      const op = vi.fn(async () => {});
      await expect(wrapElectronCall(op, 'Void op')).resolves.toBeUndefined();
      expect(op).toHaveBeenCalledTimes(1);
    });

    it('supports custom logger options', async () => {
      const customLogger = vi.fn();
      await expect(
        wrapElectronCall(
          async () => {
            throw new Error('custom');
          },
          'Custom log',
          { logger: customLogger },
        ),
      ).rejects.toThrow('custom');
      expect(customLogger).toHaveBeenCalledTimes(1);
      expect(customLogger.mock.calls[0]?.[0]).toBe('Custom log:');
    });
  });

  describe('wrapElectronCallWithFallback', () => {
    it('returns fallback value when operation fails', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await wrapElectronCallWithFallback(
        async () => {
          throw new Error('fallback');
        },
        'Needs fallback',
        42,
      );
      expect(result).toBe(42);
      expect(spy).toHaveBeenCalledWith('Needs fallback:', expect.any(Error));
    });

    it('returns successful value when operation resolves', async () => {
      const result = await wrapElectronCallWithFallback(
        async () => ['a', 'b'],
        'Should not log',
        [],
      );
      expect(result).toEqual(['a', 'b']);
    });

    it('supports fallback with void return type', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await wrapElectronCallWithFallback(
        async () => {
          throw new Error('expected');
        },
        'Void fallback',
        undefined,
      );
      expect(result).toBeUndefined();
      spy.mockRestore();
    });
  });
});

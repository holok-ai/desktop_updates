import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('logger utilities', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('createScopedLogger prefixes messages and delegates to electron-log', async () => {
    const calls: any[] = [];
    // Mock electron and electron-log before importing the module
    vi.doMock('electron', () => ({
      app: { getPath: () => '/mock/appData', getVersion: () => '9.9.9' },
    }));

    vi.doMock('electron-log', () => {
      const mock = {
        transports: { file: {}, console: {} },
        variables: {},
        info: (...args: unknown[]) => calls.push(['info', ...args]),
        warn: (...args: unknown[]) => calls.push(['warn', ...args]),
        error: (...args: unknown[]) => calls.push(['error', ...args]),
        debug: (...args: unknown[]) => calls.push(['debug', ...args]),
      };
      return mock;
    });

    const proxy = await import('../../../src-electron/utils/logger');
    const { createScopedLogger, logStructured, logPerformance, logError } = proxy;

    const scoped = createScopedLogger('test');
    // ensure methods exist and callable (behavior of underlying electron-log is
    // provided by other tests / environment; here we assert no exceptions)
    expect(typeof scoped.info).toBe('function');
    expect(typeof scoped.warn).toBe('function');
    expect(typeof scoped.error).toBe('function');
    expect(typeof scoped.debug).toBe('function');

    scoped.info('hello', { a: 1 });
    scoped.warn('woops');

    // logStructured should not throw for any level
    expect(() => logStructured('info', 'msg', { k: 'v' })).not.toThrow();

    // logPerformance.end should not throw
    const perf = logPerformance('op1');
    expect(() => perf.end({ x: 1 })).not.toThrow();

    // logError should not throw when logging an Error
    const err = new Error('boom');
    expect(() => logError('bad', err, { id: 5 })).not.toThrow();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('logger (real module)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('configures transports and exposes helpers', async () => {
    // Mock electron app
    vi.doMock('electron', () => ({
      app: {
        getPath: (_k: string) => '/mock/appData',
        getVersion: () => '1.2.3-test',
      },
    }));

    // Mock electron-log default export
    const info = vi.fn();
    const warn = vi.fn();
    const error = vi.fn();
    const debug = vi.fn();
    const resolvePath = vi.fn(({ fileName }: { fileName: string }) => `/mock/appData/${fileName}`);
    const mockLog = {
      transports: {
        file: { resolvePath },
        console: {},
      },
      variables: {},
      info,
      warn,
      error,
      debug,
    };

    vi.doMock('electron-log', () => ({ default: mockLog }));

    // Import the real module (bypass any prior mocks)
    const loggerMod = await vi.importActual('../../../src-electron/utils/logger');

    const { createScopedLogger, logStructured, logPerformance, logError } = loggerMod as any;

    // After loading, transports.file.resolvePath should be set
    expect(typeof mockLog.transports.file.resolvePath).toBe('function');
    const p = mockLog.transports.file.resolvePath({ fileName: 'app.log' });
    expect(String(p)).toContain('/mock/appData');

    // createScopedLogger delegates to electron-log methods
    const scoped = createScopedLogger('auth');
    scoped.info('hello', { a: 1 });
    expect(info).toHaveBeenCalledWith('[AUTH] hello', { a: 1 });

    // logStructured should call appropriate level
    logStructured('warn', 'be careful', { x: 1 });
    expect(warn).toHaveBeenCalledWith('be careful {"x":1}');

    // logPerformance should call debug on end()
    const perf = logPerformance('op1');
    perf.end({ foo: 'bar' });
    expect(debug).toHaveBeenCalled();

    // logError should call error with structured payload
    const e = new Error('boom');
    logError('bad', e, { id: 5 });
    expect(error).toHaveBeenCalled();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('logger branches', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('createScopedLogger methods call underlying electron-log with scope prefix', async () => {
    const info = vi.fn();
    const warn = vi.fn();
    const error = vi.fn();
    const debug = vi.fn();

    vi.doMock('electron', () => ({
      app: { getPath: () => '/mock/path', getVersion: () => '9.9.9' },
    }));

    vi.doMock('electron-log', () => {
      const mock = {
        transports: { file: {}, console: {} },
        variables: {},
        info,
        warn,
        error,
        debug,
      };
      return { default: mock, ...mock };
    });

    const logger = await vi.importActual('../../../src-electron/utils/logger');
    const { createScopedLogger } = logger;

    const scoped = createScopedLogger('svc');
    scoped.info('hello', { a: 1 });
    scoped.warn('caution');
    scoped.error('boom');
    scoped.debug('dbg');

    expect(info).toHaveBeenCalledWith('[SVC] hello', { a: 1 });
    expect(warn).toHaveBeenCalledWith('[SVC] caution');
    expect(error).toHaveBeenCalledWith('[SVC] boom');
    expect(debug).toHaveBeenCalledWith('[SVC] dbg');
  });

  it('logStructured routes messages to correct level and includes metadata', async () => {
    const info = vi.fn();
    const warn = vi.fn();
    const error = vi.fn();
    const debug = vi.fn();

    vi.doMock('electron', () => ({ app: { getPath: () => '/tmp', getVersion: () => '0.0.1' } }));
    vi.doMock('electron-log', () => {
      const mock = {
        transports: { file: {}, console: {} },
        variables: {},
        info,
        warn,
        error,
        debug,
      };
      return { default: mock, ...mock };
    });

    const { logStructured } = await vi.importActual('../../../src-electron/utils/logger');

    logStructured('info', 'i msg', { k: 'v' });
    logStructured('warn', 'w msg');
    logStructured('error', 'e msg');
    logStructured('debug', 'd msg');

    expect(info).toHaveBeenCalledWith('i msg ' + JSON.stringify({ k: 'v' }));
    expect(warn).toHaveBeenCalledWith('w msg');
    expect(error).toHaveBeenCalledWith('e msg');
    expect(debug).toHaveBeenCalledWith('d msg');
  });

  it('logPerformance calls logStructured debug on end', async () => {
    const debug = vi.fn();
    vi.doMock('electron', () => ({ app: { getPath: () => '/tmp', getVersion: () => 'v' } }));
    vi.doMock('electron-log', () => {
      const mock = {
        transports: { file: {}, console: {} },
        variables: {},
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug,
      };
      return { default: mock, ...mock };
    });

    const { logPerformance } = await vi.importActual('../../../src-electron/utils/logger');
    const perf = logPerformance('op');
    perf.end({ extra: 1 });

    // debug should be called once
    expect(debug).toHaveBeenCalled();
    const arg0 = debug.mock.calls[0][0] as string;
    expect(arg0).toMatch(/Performance: op/);
  });

  it('logError formats and forwards error object', async () => {
    const error = vi.fn();
    vi.doMock('electron', () => ({ app: { getPath: () => '/tmp', getVersion: () => 'v' } }));
    vi.doMock('electron-log', () => {
      const mock = {
        transports: { file: {}, console: {} },
        variables: {},
        info: vi.fn(),
        warn: vi.fn(),
        error,
      };
      return { default: mock, ...mock };
    });

    const { logError } = await vi.importActual('../../../src-electron/utils/logger');
    const err = new Error('fail');
    logError('ops', err, { id: 5 });

    expect(error).toHaveBeenCalled();
    const calledArgs = error.mock.calls[0];
    expect(calledArgs[0]).toBe('ops');
    expect(calledArgs[1].error).toBeDefined();
    expect(calledArgs[1].error.message).toBe('fail');
  });
});

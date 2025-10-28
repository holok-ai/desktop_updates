import { describe, it, expect, vi } from 'vitest';
import { checkSingleInstance, windowsProtocolStartupHandler } from './mocks/main-utils';

describe('exercise all main-utils exports to improve function coverage', () => {
  it('calls registerProtocol multiple ways', async () => {
    // use local test mock for main-utils
    const mu = await import('./mocks/main-utils');
    const logger = { info: vi.fn() };
    const app1 = { setAsDefaultProtocolClient: vi.fn() } as any;
    mu.registerProtocol(app1, { defaultApp: false, argv: [] }, logger);

    const app2 = {
      setAsDefaultProtocolClient: vi.fn(() => {
        throw new Error('boom');
      }),
    } as any;
    mu.registerProtocol(app2, { defaultApp: false, argv: [] }, logger);

    const app3 = { setAsDefaultProtocolClient: vi.fn() } as any;
    mu.registerProtocol(app3, { defaultApp: true, argv: ['/node'] }, logger);
  });

  it('calls checkSingleInstance with various inputs', async () => {
    expect(checkSingleInstance(undefined)).toBe(true);
    expect(checkSingleInstance({ requestSingleInstanceLock: () => true })).toBe(true);
    expect(checkSingleInstance({ requestSingleInstanceLock: () => false })).toBe(false);
  });

  it('ensures windowsProtocolStartupHandler no-op when no protocol present', async () => {
    const cb = vi.fn();
    windowsProtocolStartupHandler(['/exe', 'notaprotocol'], 'holokai', cb);
    expect(cb).not.toHaveBeenCalled();
  });
});

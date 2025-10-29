import { describe, it, expect, vi } from 'vitest';

describe('registerProtocol extra branches', () => {
  it('registers a custom protocol with execPath when defaultApp true', async () => {
    const mod = await import('./mocks/main-utils');
    const registerProtocol = mod.registerProtocol as typeof mod.registerProtocol;
    const app = { setAsDefaultProtocolClient: vi.fn() } as any;
    const logger = { info: vi.fn() } as any;

    registerProtocol(
      app,
      {
        defaultApp: true,
        argv: ['/node', '/app/path'],
        execPath: '/node',
        customProtocol: 'testproto',
      },
      logger,
    );

    expect(app.setAsDefaultProtocolClient).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('[Protocol] Registered custom protocol: testproto://');
  });

  it('swallows errors from setAsDefaultProtocolClient and still logs', async () => {
    const mod = await import('./mocks/main-utils');
    const registerProtocol = mod.registerProtocol as typeof mod.registerProtocol;
    const app = {
      setAsDefaultProtocolClient: () => {
        throw new Error('fail');
      },
    } as any;
    const logger = { info: vi.fn() } as any;

    expect(() => registerProtocol(app, { defaultApp: false, argv: [] }, logger)).not.toThrow();
    expect(logger.info).toHaveBeenCalled();
  });
});

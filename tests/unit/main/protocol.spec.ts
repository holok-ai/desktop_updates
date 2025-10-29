import { describe, it, expect, vi } from 'vitest';
describe('main protocol registration', () => {
  it('calls setAsDefaultProtocolClient in production path', async () => {
    const mod = await import('./mocks/main-utils');
    const registerProtocol = mod.registerProtocol as typeof mod.registerProtocol;
    const app = {
      setAsDefaultProtocolClient: vi.fn(),
      getPath: (n: string) => `/mock/${n}`,
    } as any;
    registerProtocol(
      app,
      { defaultApp: false, argv: [], execPath: '', customProtocol: 'holokai' },
      { info: () => {} },
    );
    expect(app.setAsDefaultProtocolClient).toHaveBeenCalled();
  });

  it('calls setAsDefaultProtocolClient with execPath when defaultApp true and argv', async () => {
    const mod = await import('./mocks/main-utils');
    const registerProtocol = mod.registerProtocol as typeof mod.registerProtocol;
    const app = {
      setAsDefaultProtocolClient: vi.fn(),
      getPath: (n: string) => `/mock/${n}`,
    } as any;
    registerProtocol(
      app,
      { defaultApp: true, argv: ['/node', '/app'], execPath: '/node' },
      { info: () => {} },
    );
    expect(app.setAsDefaultProtocolClient).toHaveBeenCalled();
  });
});

import { describe, it, expect, vi } from 'vitest';
describe('registerSecondInstanceHandler positive lock', () => {
  it('registers second-instance listener when lock acquired', async () => {
    const mod = await import('./mocks/main-utils');
    const registerSecondInstanceHandler =
      mod.registerSecondInstanceHandler as typeof mod.registerSecondInstanceHandler;
    const on = vi.fn();
    const app = { requestSingleInstanceLock: vi.fn(() => true), on, quit: vi.fn() } as any;

    const res = registerSecondInstanceHandler(app, () => {});
    expect(res).toBe(true);
    expect(app.requestSingleInstanceLock).toHaveBeenCalled();
    expect(on).toHaveBeenCalledWith('second-instance', expect.any(Function));
  });
});

import { describe, it, expect, vi } from 'vitest';
describe('handleOpenUrl error branch', () => {
  it('logs warning when handleOAuthCallback throws', async () => {
    const mu = await import('./mocks/main-utils');
    const badCallback = vi.fn(() => {
      throw new Error('boom');
    });
    const warn = vi.fn();
    mu.handleOpenUrl('holokai://home?code=1', 'holokai', null, badCallback, {
      info: vi.fn(),
      warn,
    });
    expect(warn).toHaveBeenCalled();
  });
});

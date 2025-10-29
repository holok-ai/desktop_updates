import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron primitives used by AuthService (must be declared before importing the service)
vi.mock('electron', () => {
  return {
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (s: string) => Buffer.from(s),
      decryptString: (b: Buffer) => b.toString(),
    },
    app: {
      getPath: () => '/tmp',
    },
    shell: {
      openExternal: vi.fn().mockResolvedValue(undefined),
    },
  };
});

// Mock settings service used by AuthService
vi.mock('../../../src-electron/ipc-handlers/settings-handler', () => ({
  getSettingsService: () => ({
    getMokuWebUrl: () => 'http://localhost:5173',
    getMokuApiUrl: () => 'http://localhost:3000',
  }),
}));

describe('AuthService additional branch coverage', () => {
  // Provide a configurable fs mock so tests can change behavior per-case
  const fsMocks: {
    existsSync: () => boolean;
    readFileSync: () => string;
    writeFileSync: (p?: any, d?: any) => void;
  } = {
    existsSync: () => false,
    readFileSync: () => '{}',
    writeFileSync: () => {},
  };

  vi.mock('fs', () => ({
    existsSync: () => fsMocks.existsSync(),
    readFileSync: () => fsMocks.readFileSync(),
    writeFileSync: (p: any, d: any) => fsMocks.writeFileSync(p, d),
  }));

  beforeEach(() => {
    vi.resetModules();
    // reset default fs mock behavior
    fsMocks.existsSync = () => false;
    fsMocks.readFileSync = () => '{}';
    fsMocks.writeFileSync = () => {};
  });

  it('handles expired tokens with apiKey (keeps tokens for refresh)', async () => {
    const { AuthService } = await import('../../../src-electron/services/auth.service');

    // Mock getFromStorage to return expired tokens containing apiKey and no user
    const svc = new AuthService();
    const tokens = { accessToken: 'old', apiKey: 'k', expiresAt: Date.now() - 1000 };

    const spyGet = vi
      .spyOn<any, any>(svc as any, 'getFromStorage')
      .mockImplementationOnce(() => Buffer.from(JSON.stringify(tokens)))
      .mockImplementationOnce(() => undefined);

    // Call private loadStoredAuth via constructor logic already ran; call explicitly to ensure branch
    (svc as any).loadStoredAuth();

    // Expect tokens kept for future refresh
    // @ts-ignore access internal state
    expect((svc as any).currentAuthState.tokens).toBeTruthy();
    spyGet.mockRestore();
  });

  it('saveToStorage swallows write errors gracefully', async () => {
    const { AuthService } = await import('../../../src-electron/services/auth.service');
    const svc = new AuthService();
    const getPathSpy = vi
      .spyOn<any, any>(svc as any, 'getStoragePath')
      .mockReturnValue('/tmp/auth.json');

    // Make writeFileSync throw by mutating fsMocks so saveToStorage's catch path executes
    // @ts-ignore access module-scoped fsMocks
    fsMocks.existsSync = () => true;
    // @ts-ignore
    fsMocks.readFileSync = () => JSON.stringify({});
    // @ts-ignore
    fsMocks.writeFileSync = () => {
      throw new Error('disk full');
    };

    // Call saveToStorage which should not throw despite underlying write failure
    expect(() => (svc as any).saveToStorage('k', Buffer.from('v'))).not.toThrow();
    getPathSpy.mockRestore();
  });

  it('removeFromStorage swallows read/write errors', async () => {
    const { AuthService } = await import('../../../src-electron/services/auth.service');
    const svc = new AuthService();
    const getPathSpy = vi
      .spyOn<any, any>(svc as any, 'getStoragePath')
      .mockReturnValue('/tmp/auth.json');

    // Use our fsMocks to simulate exists and read errors
    // @ts-ignore access module-scoped fsMocks
    fsMocks.existsSync = () => true;
    // @ts-ignore
    fsMocks.readFileSync = () => {
      throw new Error('io');
    };

    expect(() => (svc as any).removeFromStorage('k')).not.toThrow();
    getPathSpy.mockRestore();
  });

  it('startOAuthFlow timeout clears waitingForCallback', async () => {
    const { AuthService } = await import('../../../src-electron/services/auth.service');
    const electron = await vi.importMock('electron');

    // Ensure shell.openExternal resolves
    electron.shell.openExternal = vi.fn().mockResolvedValue(undefined);

    const svc = new AuthService();

    vi.useFakeTimers();
    const res = await svc.startOAuthFlow();
    // waitingForCallback should be true right after start
    // @ts-ignore
    expect((svc as any).waitingForCallback).toBe(true);

    // Fast-forward past CALLBACK_TIMEOUT_MS (5 minutes)
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1000);

    // After timeout, waitingForCallback should be false
    // @ts-ignore
    expect((svc as any).waitingForCallback).toBe(false);
    vi.useRealTimers();
  });

  it('storeAuthData throws when encryption fails', async () => {
    const { AuthService } = await import('../../../src-electron/services/auth.service');
    const electron = await vi.importMock('electron');
    // make encryptString throw to exercise storeAuthData catch
    electron.safeStorage.encryptString = vi.fn(() => {
      throw new Error('encrypt fail');
    });

    const svc = new AuthService();
    const tokens = { accessToken: 't', apiKey: 'k', expiresAt: Date.now() + 1000 };
    const user = { id: 'u', email: 'e', name: 'n' };

    await expect(() => (svc as any).storeAuthData(tokens, user)).toThrow();
  });
});

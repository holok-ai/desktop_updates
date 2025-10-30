import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../../../src-electron/services/auth.service';

// Mock electron primitives used by AuthService
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

// Mock fs to avoid disk IO
vi.mock('fs', () => ({
  existsSync: () => false,
  readFileSync: () => '{}',
  writeFileSync: () => undefined,
}));

import * as fs from 'fs';

describe('AuthService (unit)', () => {
  let service: AuthService;

  beforeEach(() => {
    // Reset fetch mock
    vi.restoreAllMocks();
    service = new AuthService();
  });

  it('extractUserFromToken parses valid JWT payload', () => {
    const payload = { sub: 'uid', email: 'u@e.com', name: 'U' };
    const token = ['h', Buffer.from(JSON.stringify(payload)).toString('base64'), 's'].join('.');
    // access private via cast
    // @ts-ignore
    const user = (service as any).extractUserFromToken(token);
    expect(user.id).toBe('uid');
    expect(user.email).toBe('u@e.com');
  });

  it('extractUserFromToken returns minimal profile for malformed token', () => {
    // @ts-ignore
    const user = (service as any).extractUserFromToken('not.a.jwt');
    expect(user.id).toBe('unknown');
    expect(user.email).toBe('user@example.com');
  });

  it('exchangeCodeForTokens succeeds on happy path', async () => {
    // stub fetch: first call exchange-code -> returns apiKey, second -> token
    const fetchMock = vi
      .spyOn(globalThis as any, 'fetch')
      .mockImplementationOnce(async () => ({ ok: true, json: async () => ({ apiKey: 'k1' }) }))
      .mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ accessToken: 'tok', expires_in: 3600 }),
      }));

    const state = await service.exchangeCodeForTokens('code-123');
    expect(state.isAuthenticated).toBe(true);
    // @ts-ignore
    expect((service as any).currentAuthState.tokens?.accessToken).toBe('tok');
    fetchMock.mockRestore();
  });

  it('exchangeCodeForTokens throws on 401 from exchange', async () => {
    vi.spyOn(globalThis as any, 'fetch').mockImplementationOnce(async () => ({
      ok: false,
      status: 401,
      text: async () => 'unauth',
    }));
    await expect(service.exchangeCodeForTokens('bad')).rejects.toThrow(
      'Invalid or expired exchange code',
    );
  });

  it('exchangeCodeForTokens throws on non-401 exchange failure', async () => {
    vi.spyOn(globalThis as any, 'fetch').mockImplementationOnce(async () => ({
      ok: false,
      status: 500,
      text: async () => 'server error',
    }));

    await expect(service.exchangeCodeForTokens('bad')).rejects.toThrow(
      'Failed to exchange code: 500',
    );
  });

  it('processOAuthCallback cancels waiting flag and delegates to exchangeCodeForTokens', async () => {
    // Arrange: ensure we are marked as waiting
    (service as any).waitingForCallback = true;

    const mockedState = { user: null, tokens: null, isAuthenticated: false };
    const spyExchange = vi
      .spyOn<any, any>(service as any, 'exchangeCodeForTokens')
      .mockResolvedValue(mockedState);

    // Act
    const res = await service.processOAuthCallback('code-x');

    // Assert
    expect(spyExchange).toHaveBeenCalledWith('code-x');
    // @ts-ignore
    expect((service as any).waitingForCallback).toBe(false);
    expect(res).toBe(mockedState);

    spyExchange.mockRestore();
  });

  it('mockLogin returns authenticated state and stores tokens', async () => {
    const spySave = vi.spyOn<any, any>(service as any, 'storeAuthData');
    const state = await service.mockLogin();
    expect(state.isAuthenticated).toBe(true);
    expect(spySave).toHaveBeenCalled();
  });

  it('refreshAccessToken updates tokens on success', async () => {
    // Prepare expired tokens with apiKey
    (service as any).currentAuthState = {
      user: { id: 'u', email: 'a@b.c', name: 'U' },
      tokens: { accessToken: 'old', apiKey: 'k', expiresAt: Date.now() - 1000 },
      isAuthenticated: true,
    };

    // Mock fetch to return refreshed token
    const fetchMock = vi.spyOn(globalThis as any, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accessToken: 'new', expires_in: 3600 }),
    });
    const spyStore = vi.spyOn<any, any>(service as any, 'storeAuthData');

    const tokens = await service.refreshAccessToken();
    expect(tokens.accessToken).toBe('new');
    expect(spyStore).toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('refreshAccessToken throws when no apiKey available', async () => {
    (service as any).currentAuthState = { user: null, tokens: null, isAuthenticated: false };
    await expect(service.refreshAccessToken()).rejects.toThrow('Re-authentication required');
  });

  it('getAccessToken throws when not authenticated', async () => {
    (service as any).currentAuthState = { user: null, tokens: null, isAuthenticated: false };
    await expect(service.getAccessToken()).rejects.toThrow('Not authenticated');
  });

  it('getAccessToken refreshes when token expired', async () => {
    (service as any).currentAuthState = {
      user: { id: 'u', email: 'a@b.c', name: 'U' },
      tokens: { accessToken: 'old', apiKey: 'k', expiresAt: Date.now() - 1000 },
      isAuthenticated: true,
    };
    const refreshed = { accessToken: 'r', apiKey: 'k', expiresAt: Date.now() + 1000 };
    const spyRefresh = vi
      .spyOn(service as any, 'refreshAccessToken')
      .mockImplementation(async () => {
        // mimic real refreshAccessToken side-effect of updating currentAuthState
        (service as any).currentAuthState.tokens = refreshed;
        return refreshed;
      });
    const token = await service.getAccessToken();
    expect(spyRefresh).toHaveBeenCalled();
    expect(token).toBe('r');
  });

  it('startOAuthFlow throws when shell.openExternal fails', async () => {
    // make shell.openExternal throw
    const electron = await vi.importMock('electron');
    electron.shell.openExternal = vi.fn().mockRejectedValue(new Error('no browser'));
    const svc = new AuthService();
    await expect(svc.startOAuthFlow()).rejects.toThrow('Unable to open browser');
  });

  it('storeAuthData calls saveToStorage twice', () => {
    const tokens = { accessToken: 't', apiKey: 'k', expiresAt: Date.now() + 1000 };
    const user = { id: 'u', email: 'e@e', name: 'N' };
    const spySave = vi
      .spyOn<any, any>(service as any, 'saveToStorage')
      .mockImplementation(() => {});
    (service as any).storeAuthData(tokens, user);
    expect(spySave).toHaveBeenCalledTimes(2);
  });

  it('exchangeCodeForTokens throws when token endpoint fails', async () => {
    // first call exchange ok
    vi.spyOn(globalThis as any, 'fetch')
      .mockImplementationOnce(async () => ({ ok: true, json: async () => ({ apiKey: 'k1' }) }))
      .mockImplementationOnce(async () => ({ ok: false, status: 500, text: async () => 'err' }));

    await expect(service.exchangeCodeForTokens('code')).rejects.toThrow(
      'Failed to get access token',
    );
  });

  it('loadStoredAuth returns early when safeStorage not available', async () => {
    // make safeStorage unavailable
    const electronMock = await import('electron');
    const orig = electronMock.safeStorage.isEncryptionAvailable;
    electronMock.safeStorage.isEncryptionAvailable = () => false;
    const svc = new AuthService();
    // no throw, just ensures early return path executed
    expect(svc.getAuthState().isAuthenticated).toBe(false);
    // restore
    electronMock.safeStorage.isEncryptionAvailable = orig;
  });

  it('getAccessToken returns current token when valid', async () => {
    (service as any).currentAuthState = {
      user: { id: 'u', email: 'e', name: 'N' },
      tokens: { accessToken: 'valid', apiKey: 'k', expiresAt: Date.now() + 10000 },
      isAuthenticated: true,
    };
    const t = await service.getAccessToken();
    expect(t).toBe('valid');
  });

  it('loadStoredAuth restores tokens and user when present', () => {
    const tokens = { accessToken: 't', apiKey: 'k', expiresAt: Date.now() + 10000 };
    const user = { id: 'u', email: 'e@e', name: 'N' };
    const bufTokens = Buffer.from(JSON.stringify(tokens));
    const bufUser = Buffer.from(JSON.stringify(user));
    const getFromStorage = vi
      .spyOn<any, any>(service as any, 'getFromStorage')
      .mockImplementationOnce(() => bufTokens)
      .mockImplementationOnce(() => bufUser);

    // call private method
    (service as any).loadStoredAuth();
    const state = service.getAuthState();
    expect(state.tokens).toBeTruthy();
    expect(state.user).toBeTruthy();
    getFromStorage.mockRestore();
  });

  it('logout clears auth state', () => {
    (service as any).currentAuthState = {
      user: { id: 'u', email: 'a@b', name: 'U' },
      tokens: { accessToken: 'x', apiKey: 'k', expiresAt: Date.now() + 1000 },
      isAuthenticated: true,
    };
    service.logout();
    const state = service.getAuthState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it('extractUserFromToken handles different subject fields', () => {
    const payload1 = { subject: 's1', email: 'a@b', name: 'A' };
    const token1 = ['h', Buffer.from(JSON.stringify(payload1)).toString('base64'), 's'].join('.');
    // @ts-ignore
    const u1 = (service as any).extractUserFromToken(token1);
    expect(u1.id).toBe('s1');

    const payload2 = { sub: 's2', userId: 'u2', email: 'b@c' };
    const token2 = ['h', Buffer.from(JSON.stringify(payload2)).toString('base64'), 's'].join('.');
    // @ts-ignore
    const u2 = (service as any).extractUserFromToken(token2);
    expect(u2.id).toBe('s2');
  });

  it('startOAuthFlow sets waitingForCallback on success', async () => {
    const electron = await import('electron');
    electron.shell.openExternal = vi.fn().mockResolvedValue(undefined);
    const svc = new AuthService();
    // spy on setTimeout to avoid real timer
    const stub = vi.spyOn(globalThis, 'setTimeout');
    const res = await svc.startOAuthFlow();
    expect(res).toHaveProperty('authUrl');
    // @ts-ignore access private
    expect((svc as any).waitingForCallback).toBe(true);
    stub.mockRestore();
  });

  it('refreshAccessToken throws and cleans up on non-ok response', async () => {
    (service as any).currentAuthState = {
      user: { id: 'u', email: 'e', name: 'N' },
      tokens: { accessToken: 'old', apiKey: 'k', expiresAt: Date.now() - 1000 },
      isAuthenticated: true,
    };
    vi.spyOn(globalThis as any, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'err',
    });
    const spyCleanup = vi.spyOn(service as any, 'cleanup').mockImplementation(() => {});
    await expect(service.refreshAccessToken()).rejects.toThrow('Token refresh failed');
    expect(spyCleanup).toHaveBeenCalled();
    spyCleanup.mockRestore();
  });

  it('saveToStorage writes base64 to storage file', () => {
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    const getPathSpy = vi
      .spyOn(service as any, 'getStoragePath')
      .mockReturnValue('/tmp/auth-storage.json');

    const buf = Buffer.from('hello');
    // call private method
    (service as any).saveToStorage('k', buf);

    expect(writeSpy).toHaveBeenCalled();
    getPathSpy.mockRestore();
    writeSpy.mockRestore();
  });

  it('getFromStorage returns buffer when key present', () => {
    const store = { k: Buffer.from('hello').toString('base64') };
    const readSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(store));
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const res = (service as any).getFromStorage('k');
    expect(res).toBeInstanceOf(Buffer);
    readSpy.mockRestore();
    existsSpy.mockRestore();
  });

  it('getFromStorage returns undefined when readFileSync throws', () => {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('io');
    });
    const res = (service as any).getFromStorage('k');
    expect(res).toBeUndefined();
    readSpy.mockRestore();
    existsSpy.mockRestore();
  });

  it('loadStoredAuth clears storage when decrypt throws', async () => {
    // make safeStorage.decryptString throw when reading tokens
    const electron = await import('electron');
    const origDecrypt = (electron.safeStorage as any).decryptString;
    (electron.safeStorage as any).decryptString = vi.fn(() => {
      throw new Error('bad decrypt');
    });

    const getFromStorage = vi
      .spyOn<any, any>(service as any, 'getFromStorage')
      .mockImplementationOnce(() =>
        Buffer.from(
          JSON.stringify({ accessToken: 't', apiKey: 'k', expiresAt: Date.now() + 1000 }),
        ),
      )
      .mockImplementationOnce(() => undefined);
    const clearSpy = vi
      .spyOn<any, any>(service as any, 'clearStoredAuth')
      .mockImplementation(() => {});

    (service as any).loadStoredAuth();
    expect(clearSpy).toHaveBeenCalled();

    // restore
    (electron.safeStorage as any).decryptString = origDecrypt;
    getFromStorage.mockRestore();
    clearSpy.mockRestore();
  });

  it('storeAuthData still stores when encryption unavailable (warn path)', async () => {
    const electron = await import('electron');
    const origIsAvailable = (electron.safeStorage as any).isEncryptionAvailable;
    (electron.safeStorage as any).isEncryptionAvailable = () => false;

    const spySave = vi
      .spyOn<any, any>(service as any, 'saveToStorage')
      .mockImplementation(() => {});
    const tokens = { accessToken: 't', apiKey: 'k', expiresAt: Date.now() + 1000 };
    const user = { id: 'u', email: 'e', name: 'n' };
    (service as any).storeAuthData(tokens, user);
    expect(spySave).toHaveBeenCalledTimes(2);

    spySave.mockRestore();
    (electron.safeStorage as any).isEncryptionAvailable = origIsAvailable;
  });

  it('removeFromStorage removes given key', () => {
    const data = { k: 'v', other: 'x' };
    const readSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(data));
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    (service as any).removeFromStorage('k');

    expect(writeSpy).toHaveBeenCalled();
    readSpy.mockRestore();
    existsSpy.mockRestore();
    writeSpy.mockRestore();
  });
});

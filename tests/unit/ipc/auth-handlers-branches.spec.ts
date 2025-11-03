import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

describe('auth ipc handlers branches', () => {
  it('auth:startOAuthFlow returns authUrl and mockData on success', async () => {
    const handlers = new Map<string, any>();
    const ipcMain = {
      handle: (ch: string, fn: any) => handlers.set(ch, fn),
      removeHandler: (ch: string) => handlers.delete(ch),
      __emit: async (ch: string, ...args: any[]) => {
        const fn = handlers.get(ch);
        if (!fn) throw new Error(`no handler ${ch}`);
        return await fn({}, ...args);
      },
    } as any;

    vi.doMock('electron', () => ({ ipcMain }));

    const mockStart = vi.fn(async () => ({ authUrl: 'http://x', mockData: { a: 1 } }));
    const mockAuth = vi.fn();
    vi.doMock('../../../src-electron/services/auth.service', () => ({
      AuthService: class {
        startOAuthFlow = mockStart;
        exchangeCodeForTokens = vi.fn();
        mockLogin = vi.fn();
        getAuthState = vi.fn();
        getUser = vi.fn();
        isAuthenticated = vi.fn();
        logout = mockAuth;
        refreshAccessToken = vi.fn();
      },
    }));

    const { registerAuthHandlers } = await import(
      '../../../src-electron/ipc-handlers/auth-handler'
    );
    registerAuthHandlers();

    const res = await (ipcMain as any).__emit('auth:startOAuthFlow');
    expect(res).toHaveProperty('authUrl', 'http://x');
    expect(res).toHaveProperty('_mockData');
  });

  it('auth:startOAuthFlow throws on authService error', async () => {
    const handlers = new Map<string, any>();
    const ipcMain = {
      handle: (ch: string, fn: any) => handlers.set(ch, fn),
      __emit: async (ch: string, ...args: any[]) => {
        const fn = handlers.get(ch);
        if (!fn) throw new Error(`no handler ${ch}`);
        return await fn({}, ...args);
      },
    } as any;

    vi.doMock('electron', () => ({ ipcMain }));

    vi.doMock('../../../src-electron/services/auth.service', () => ({
      AuthService: class {
        startOAuthFlow = vi.fn(async () => {
          throw new Error('nope');
        });
      },
    }));

    const { registerAuthHandlers } = await import(
      '../../../src-electron/ipc-handlers/auth-handler'
    );
    registerAuthHandlers();

    await expect((ipcMain as any).__emit('auth:startOAuthFlow')).rejects.toThrow();
  });

  it('auth:exchangeCode returns limited authState on success', async () => {
    vi.resetModules();
    const handlers = new Map<string, any>();
    const ipcMain = {
      handle: (ch: string, fn: any) => handlers.set(ch, fn),
      __emit: async (ch: string, ...args: any[]) => {
        const fn = handlers.get(ch);
        if (!fn) throw new Error(`no handler ${ch}`);
        return await fn({}, ...args);
      },
    } as any;

    vi.doMock('electron', () => ({ ipcMain }));

    const authState = { user: { id: 'u' }, isAuthenticated: true };
    vi.doMock('../../../src-electron/services/auth.service', () => ({
      AuthService: class {
        exchangeCodeForTokens = vi.fn(async () => authState);
      },
    }));

    const { registerAuthHandlers } = await import(
      '../../../src-electron/ipc-handlers/auth-handler'
    );
    registerAuthHandlers();

    const result = await (ipcMain as any).__emit('auth:exchangeCode', 'code');
    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('tokens', null);
  });

  it('auth:exchangeCode throws on failure', async () => {
    vi.resetModules();
    const handlers2 = new Map<string, any>();
    const ipcMain2 = {
      handle: (ch: string, fn: any) => handlers2.set(ch, fn),
      __emit: async (ch: string, ...a: any[]) => {
        const fn = handlers2.get(ch);
        return await fn({}, ...a);
      },
    } as any;
    vi.doMock('electron', () => ({ ipcMain: ipcMain2 }));
    vi.doMock('../../../src-electron/services/auth.service', () => ({
      AuthService: class {
        exchangeCodeForTokens = vi.fn(async () => {
          throw new Error('bad');
        });
      },
    }));
    const { registerAuthHandlers: r2 } = await import(
      '../../../src-electron/ipc-handlers/auth-handler'
    );
    r2();
    await expect((ipcMain2 as any).__emit('auth:exchangeCode', 'x')).rejects.toThrow();
  });
});

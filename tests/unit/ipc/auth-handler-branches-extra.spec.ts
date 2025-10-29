import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Typed channel map for handlers
type Handler = (...args: any[]) => any;

describe('auth-handler extra branches', () => {
  const handlers: Record<string, Handler> = {};

  // Mocks for ipcMain
  const mockIpcMain = {
    handle: vi.fn((channel: string, fn: Handler) => {
      handlers[channel] = fn;
    }),
    removeHandler: vi.fn(),
    on: vi.fn(),
  } as any;

  // Mock electron and electron-log before each test
  beforeEach(() => {
    vi.resetModules();
    for (const k of Object.keys(handlers)) delete handlers[k];

    vi.doMock('electron', () => ({
      ipcMain: mockIpcMain,
      BrowserWindow: class {},
    }));

    vi.doMock('electron-log', () => ({
      default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    }));
  });

  it('handleOAuthCallback error param without description falls back to Unknown error', async () => {
    // Minimal mocks so registerAuthHandlers succeeds
    vi.doMock('../../../src-electron/services/auth.service', () => ({
      AuthService: class {
        processOAuthCallback = vi.fn();
        startOAuthFlow = vi.fn();
        exchangeCodeForTokens = vi.fn();
        mockLogin = vi.fn();
        getAuthState = vi.fn(() => ({ user: null, tokens: null, isAuthenticated: false }));
        getUser = vi.fn(() => null);
        isAuthenticated = vi.fn(() => false);
        logout = vi.fn();
        refreshAccessToken = vi.fn();
      },
    }));

    const { registerAuthHandlers, handleOAuthCallback } = await import('../../../src-electron/ipc-handlers/auth-handler');
    registerAuthHandlers();

    const send = vi.fn();
    const win = { webContents: { send } } as any;
    handleOAuthCallback('holokai://home?error=access_denied', win);
    expect(send).toHaveBeenCalledWith('auth:callback-error', {
      error: 'access_denied',
      description: 'Unknown error',
    });
  });

  it('handleOAuthCallback branches with mainWindow null (error, missing, success, invalid_url)', async () => {
    vi.useFakeTimers();
    // Mock service resolve path
    const proc = vi.fn().mockResolvedValue({ user: null, isAuthenticated: true });
    vi.doMock('../../../src-electron/services/auth.service', () => ({
      AuthService: class {
        processOAuthCallback = proc;
        startOAuthFlow = vi.fn();
        exchangeCodeForTokens = vi.fn();
        mockLogin = vi.fn();
        getAuthState = vi.fn(() => ({ user: null, tokens: null, isAuthenticated: false }));
        getUser = vi.fn(() => null);
        isAuthenticated = vi.fn(() => false);
        logout = vi.fn();
        refreshAccessToken = vi.fn();
      },
    }));

    const { registerAuthHandlers, handleOAuthCallback } = await import('../../../src-electron/ipc-handlers/auth-handler');
    registerAuthHandlers();

    // error param, null window
    handleOAuthCallback('holokai://home?error=access_denied', null);

    // missing params, null window
    handleOAuthCallback('holokai://home?code=only', null);

    // success path, null window
    handleOAuthCallback('holokai://home?code=abc&state=xyz', null);
    await vi.runAllTimersAsync();
    expect(proc).toHaveBeenCalledWith('abc');

    // invalid URL parse, null window
    handleOAuthCallback(':::::', null);
  });

  it('handleOAuthCallback Error rejection path uses error.message', async () => {
    vi.useFakeTimers();
    const proc = vi.fn().mockRejectedValue(new Error('boom'));
    vi.doMock('../../../src-electron/services/auth.service', () => ({
      AuthService: class {
        processOAuthCallback = proc;
        startOAuthFlow = vi.fn();
        exchangeCodeForTokens = vi.fn();
        mockLogin = vi.fn();
        getAuthState = vi.fn(() => ({ user: null, tokens: null, isAuthenticated: false }));
        getUser = vi.fn(() => null);
        isAuthenticated = vi.fn(() => false);
        logout = vi.fn();
        refreshAccessToken = vi.fn();
      },
    }));

    const { registerAuthHandlers, handleOAuthCallback } = await import('../../../src-electron/ipc-handlers/auth-handler');
    registerAuthHandlers();

    const send = vi.fn();
    const win = { webContents: { send } } as any;
    handleOAuthCallback('holokai://home?code=abc&state=xyz', win);
    await vi.runAllTimersAsync();
    expect(send).toHaveBeenCalledWith('auth:callback-error', {
      error: 'exchange_failed',
      description: 'boom',
    });
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('handleOAuthCallback sends invalid_url on parse failure', async () => {
    const { handleOAuthCallback, registerAuthHandlers } = await import('../../../src-electron/ipc-handlers/auth-handler');

    // Mock AuthService minimally for init
    const mockProcessOAuthCallback = vi.fn();
    vi.doMock('../../../src-electron/services/auth.service', () => ({
      AuthService: vi.fn(() => ({
        processOAuthCallback: mockProcessOAuthCallback,
        startOAuthFlow: vi.fn(),
        exchangeCodeForTokens: vi.fn(),
        mockLogin: vi.fn(),
        getAuthState: vi.fn(() => ({ user: null, tokens: null, isAuthenticated: false })),
        getUser: vi.fn(() => null),
        isAuthenticated: vi.fn(() => false),
        logout: vi.fn(),
        refreshAccessToken: vi.fn(),
      })),
    }));

    // Re-import after mocking AuthService
    const mod = await import('../../../src-electron/ipc-handlers/auth-handler');
    const handleOAuthCallbackReal = mod.handleOAuthCallback;
    const registerAuthHandlersReal = mod.registerAuthHandlers;

    registerAuthHandlersReal();

    const send = vi.fn();
    const win = { webContents: { send } } as any;

    handleOAuthCallbackReal(':::::', win);
    expect(send).toHaveBeenCalledWith('auth:callback-error', {
      error: 'invalid_url',
      description: 'Failed to parse callback URL',
    });
  });

  it('handleOAuthCallback with non-Error rejection sends generic message', async () => {
    vi.useFakeTimers();

    const processOAuthCallback = vi.fn().mockRejectedValue('oops');
    vi.doMock('../../../src-electron/services/auth.service', () => ({
      AuthService: class {
        processOAuthCallback = processOAuthCallback;
        startOAuthFlow = vi.fn();
        exchangeCodeForTokens = vi.fn();
        mockLogin = vi.fn();
        getAuthState = vi.fn(() => ({ user: null, tokens: null, isAuthenticated: false }));
        getUser = vi.fn(() => null);
        isAuthenticated = vi.fn(() => false);
        logout = vi.fn();
        refreshAccessToken = vi.fn();
      },
    }));

    const { registerAuthHandlers, handleOAuthCallback } = await import('../../../src-electron/ipc-handlers/auth-handler');
    registerAuthHandlers();

    const send = vi.fn();
    const win = { webContents: { send } } as any;
    handleOAuthCallback('holokai://home?code=abc&state=xyz', win);
    await vi.runAllTimersAsync();

    expect(send).toHaveBeenCalledWith('auth:callback-error', {
      error: 'exchange_failed',
      description: 'Failed to exchange authorization code',
    });
  });

  it('auth:mockLogin handler throws on service error; logout and refreshToken error branches', async () => {
    const mockStart = vi.fn();
    const mockExchange = vi.fn();
    const mockLogin = vi.fn().mockRejectedValue(new Error('mock failed'));
    const mockGetAuth = vi.fn(() => ({ user: null, tokens: null, isAuthenticated: false }));
    const mockGetUser = vi.fn(() => null);
    const mockIsAuth = vi.fn(() => false);
    const mockLogout = vi.fn(() => { throw new Error('logout failed'); });
    const mockRefresh = vi.fn().mockRejectedValue(new Error('refresh failed'));

    vi.doMock('../../../src-electron/services/auth.service', () => ({
      AuthService: class {
        startOAuthFlow = mockStart;
        exchangeCodeForTokens = mockExchange;
        mockLogin = mockLogin;
        getAuthState = mockGetAuth;
        getUser = mockGetUser;
        isAuthenticated = mockIsAuth;
        logout = mockLogout;
        refreshAccessToken = mockRefresh;
      },
    }));

    const { registerAuthHandlers } = await import('../../../src-electron/ipc-handlers/auth-handler');
    registerAuthHandlers();

    await expect(handlers['auth:mockLogin']({})).rejects.toThrow('mock failed');
    await expect(handlers['auth:refreshToken']({})).rejects.toThrow('refresh failed');
    expect(() => handlers['auth:logout']({})).toThrow('logout failed');
  });
});



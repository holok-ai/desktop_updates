import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron ipcMain and BrowserWindow
vi.mock('electron', () => {
  const ipcMain = { handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn() };
  class BrowserWindow {}
  return { ipcMain, BrowserWindow };
});

// Mock AuthService used in registerAuthHandlers to control processOAuthCallback
const mockProcess = vi.fn();
vi.mock('../../../src-electron/services/auth.service', () => {
  return {
    AuthService: class {
      processOAuthCallback = mockProcess;
      startOAuthFlow = vi.fn();
      exchangeCodeForTokens = vi.fn();
      mockLogin = vi.fn();
      getAuthState = vi.fn();
      getUser = vi.fn();
      isAuthenticated = vi.fn();
      logout = vi.fn();
      refreshAccessToken = vi.fn();
    },
  };
});

describe('auth-handler.handleOAuthCallback', () => {
  beforeEach(() => {
    vi.resetModules();
    mockProcess.mockReset();
  });

  it('sends error when url contains error param', async () => {
    const { handleOAuthCallback } = await import('../../../src-electron/ipc-handlers/auth-handler');
    const mainWindow = { webContents: { send: vi.fn() } } as any;

    handleOAuthCallback('holokai://home?error=access_denied&error_description=denied', mainWindow);

    expect(mainWindow.webContents.send).toHaveBeenCalledWith('auth:callback-error', expect.objectContaining({ error: 'access_denied' }));
  });

  it('sends invalid_callback when missing params', async () => {
    const { handleOAuthCallback, registerAuthHandlers } = await import('../../../src-electron/ipc-handlers/auth-handler');
    // call registerAuthHandlers to initialize authService (uses our mocked AuthService)
    registerAuthHandlers();
    const mainWindow = { webContents: { send: vi.fn() } } as any;

    handleOAuthCallback('holokai://home?code=onlycode', mainWindow);

    expect(mainWindow.webContents.send).toHaveBeenCalledWith('auth:callback-error', expect.objectContaining({ error: 'invalid_callback' }));
  });

  it('on success sends callback-success', async () => {
    const { handleOAuthCallback, registerAuthHandlers } = await import('../../../src-electron/ipc-handlers/auth-handler');
    // make processOAuthCallback resolve
    mockProcess.mockResolvedValue({ user: { id: 'u' }, isAuthenticated: true });
    registerAuthHandlers();

    const mainWindow = { webContents: { send: vi.fn() } } as any;

    handleOAuthCallback('holokai://home?code=abc&state=xyz', mainWindow);

    // wait for promise microtasks
    await new Promise((r) => setTimeout(r, 0));

    expect(mainWindow.webContents.send).toHaveBeenCalledWith('auth:callback-success', expect.objectContaining({ user: { id: 'u' } }));
  });

  it('on process failure sends callback-error', async () => {
    const { handleOAuthCallback, registerAuthHandlers } = await import('../../../src-electron/ipc-handlers/auth-handler');
    mockProcess.mockRejectedValue(new Error('exchange failed'));
    registerAuthHandlers();

    const mainWindow = { webContents: { send: vi.fn() } } as any;

    handleOAuthCallback('holokai://home?code=abc&state=xyz', mainWindow);
    await new Promise((r) => setTimeout(r, 0));

    expect(mainWindow.webContents.send).toHaveBeenCalledWith('auth:callback-error', expect.objectContaining({ error: 'exchange_failed' }));
  });
});



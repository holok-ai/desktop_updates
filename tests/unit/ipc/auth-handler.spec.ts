import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let handlers: Record<string, Function> = {};

const mockAuthService = {
  startOAuthFlow: vi.fn().mockResolvedValue({ authUrl: 'https://example.test/login' }),
  getAuthState: vi.fn().mockReturnValue({
    user: { id: 'u1', email: 'u1@example.com', name: 'User One' },
    tokens: { accessToken: 'secret', expiresAt: Date.now() + 60_000 },
    isAuthenticated: true,
  }),
  processOAuthCallback: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'u1@example.com', name: 'User One' },
    tokens: null,
    isAuthenticated: true,
  }),
  logout: vi.fn(),
};

const mockThreadRepository = {
  clearCache: vi.fn(),
};

const mockProjectRepository = {
  clearCache: vi.fn(),
};

const mockModelRepository = {
  clearCache: vi.fn(),
};

const mockInterfaceStatusRegistry = {
  resetAll: vi.fn(),
};

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: Function) => {
      handlers[channel] = fn;
    },
    removeHandler: vi.fn(),
  },
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}));

vi.mock('../../../src-electron/services/auth.service', () => ({
  AuthService: class {
    startOAuthFlow = mockAuthService.startOAuthFlow;
    getAuthState = mockAuthService.getAuthState;
    processOAuthCallback = mockAuthService.processOAuthCallback;
    logout = mockAuthService.logout;
  },
}));

vi.mock('../../../src-electron/repository/thread-repository', () => ({
  threadRepository: mockThreadRepository,
}));

vi.mock('../../../src-electron/repository/project-repository', () => ({
  projectRepository: mockProjectRepository,
}));

vi.mock('../../../src-electron/repository/model-repository', () => ({
  modelRepository: mockModelRepository,
}));

vi.mock('../../../src-electron/services/reliability/interface-status-registry', () => ({
  interfaceStatusRegistry: mockInterfaceStatusRegistry,
}));

vi.mock('../../../src-electron/utils/logger', () => ({
  createScopedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('auth IPC handlers', () => {
  beforeEach(async () => {
    handlers = {};
    vi.clearAllMocks();
    vi.resetModules();

    const mod = await import('../../../src-electron/ipc-handlers/auth-handler');
    mod.registerAuthHandlers();
  });

  afterEach(async () => {
    const mod = await import('../../../src-electron/ipc-handlers/auth-handler');
    mod.unregisterAuthHandlers();
  });

  it('registers auth:logout handler', () => {
    expect(handlers['auth:logout']).toBeDefined();
  });

  it('clears all session caches on logout', async () => {
    await handlers['auth:logout']();

    expect(mockAuthService.logout).toHaveBeenCalledOnce();
    expect(mockThreadRepository.clearCache).toHaveBeenCalledOnce();
    expect(mockProjectRepository.clearCache).toHaveBeenCalledOnce();
    expect(mockModelRepository.clearCache).toHaveBeenCalledOnce();
    expect(mockInterfaceStatusRegistry.resetAll).toHaveBeenCalledOnce();
  });

  it('propagates logout errors and does not clear caches after failure', async () => {
    mockAuthService.logout.mockImplementationOnce(() => {
      throw new Error('logout failed');
    });

    expect(() => handlers['auth:logout']()).toThrow('logout failed');
    expect(mockThreadRepository.clearCache).not.toHaveBeenCalled();
    expect(mockProjectRepository.clearCache).not.toHaveBeenCalled();
    expect(mockModelRepository.clearCache).not.toHaveBeenCalled();
    expect(mockInterfaceStatusRegistry.resetAll).not.toHaveBeenCalled();
  });
});

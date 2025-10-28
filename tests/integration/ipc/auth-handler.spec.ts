import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock electron-log to no-op
vi.mock('electron-log', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

// Minimal ipcMain/BrowserWindow test double with invoke support
const sentEvents: Array<{ channel: string; args: unknown[] }> = [];

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;
const handlers = new Map<string, IpcHandler>();

interface MockIpcMain {
  handle(channel: string, fn: IpcHandler): void;
  removeHandler(channel: string): void;
  __invoke(channel: string, ...args: unknown[]): Promise<unknown>;
}

interface MockIpcRenderer {
  invoke(...args: unknown[]): Promise<unknown>;
  on(channel: string, listener: (...args: unknown[]) => void): void;
  removeListener(channel: string, listener: (...args: unknown[]) => void): void;
  send(channel: string, ...args: unknown[]): void;
}

interface MockContextBridge {
  exposeInMainWorld(name: string, obj: unknown): void;
}

interface MockBrowserWindow {
  getAllWindows(): Array<{ webContents: { send(channel: string, ...args: unknown[]): void } }>;
}

vi.mock('electron', () => {
  const ipcMain: MockIpcMain = {
    handle: (channel: string, fn: IpcHandler) => {
      handlers.set(channel, fn);
    },
    removeHandler: (channel: string) => {
      handlers.delete(channel);
    },
    __invoke: async (channel: string, ...args: unknown[]) => {
      const fn = handlers.get(channel);
      if (!fn) throw new Error(`No handler for ${channel}`);
      return await Promise.resolve(fn({}, ...args));
    },
  };

  // expose helper for test access on globalThis
  (globalThis as unknown as Record<string, unknown>).__mock_ipcMain = ipcMain;

  const ipcRenderer: MockIpcRenderer = {
    invoke: async () => undefined,
    on: () => undefined,
    removeListener: () => undefined,
    send: () => undefined,
  };

  const contextBridge: MockContextBridge = {
    exposeInMainWorld: (name: string, obj: unknown) => {
      if (typeof window !== 'undefined') (window as unknown as Record<string, unknown>)[name] = obj;
      (globalThis as unknown as Record<string, unknown>)[name] = obj;
    },
  };

  const BrowserWindow: MockBrowserWindow = {
    getAllWindows: () => [
      {
        webContents: {
          send: (channel: string, ...args: unknown[]) => sentEvents.push({ channel, args }),
        },
      },
    ],
  };

  return { ipcMain, ipcRenderer, contextBridge, BrowserWindow };
});

// Mock AuthService used by the handler
vi.mock('/Users/kong/Public/NKK/desktop/src-electron/services/auth.service', () => {
  class AuthService {
    async startOAuthFlow() {
      return { authUrl: 'http://example.com/login/desktop' };
    }
    async exchangeCodeForTokens(_code: string) {
      return {
        user: { id: '1', email: 'a@b.com', name: 'A' },
        tokens: { accessToken: 't', expiresAt: Date.now() + 100000 },
        isAuthenticated: true,
      };
    }
    async mockLogin() {
      return {
        user: { id: '2', email: 'b@c.com', name: 'B' },
        tokens: { accessToken: 'x', expiresAt: Date.now() + 100000 },
        isAuthenticated: true,
      };
    }
    getAuthState() {
      return {
        user: { id: '3', email: 'c@d.com', name: 'C' },
        tokens: { accessToken: 'y', expiresAt: Date.now() + 100000 },
        isAuthenticated: true,
      };
    }
    getUser() {
      return { id: '3', email: 'c@d.com', name: 'C' };
    }
    isAuthenticated() {
      return true;
    }
    logout() {
      /* noop */
    }
    async refreshAccessToken() {
      /* noop */
    }
    async processOAuthCallback(_code: string) {
      return {
        user: { id: '9', email: 'z@y.com', name: 'Z' },
        tokens: { accessToken: 'z', expiresAt: Date.now() + 100000 },
        isAuthenticated: true,
      };
    }
  }
  return { AuthService };
});

// Import after mocks
import {
  registerAuthHandlers,
  unregisterAuthHandlers,
  handleOAuthCallback,
} from 'src-electron/ipc-handlers/auth-handler';
// Access mocked electron.ipcMain to use __invoke helper
// Access mocked ipcMain helper attached to global
 
// @ts-ignore
const ipcMain = globalThis.__mock_ipcMain;

describe('IPC: auth-handler', () => {
  beforeEach(() => {
    unregisterAuthHandlers();
    // clear previous events
    sentEvents.length = 0;
    // re-register
    registerAuthHandlers();
  });

  it('auth:startOAuthFlow returns authUrl', async () => {
    const res = await ipcMain.__invoke('auth:startOAuthFlow');
    expect(res).toHaveProperty('authUrl');
  });

  it('auth:exchangeCode returns redacted tokens (null to renderer)', async () => {
    const res = await ipcMain.__invoke('auth:exchangeCode', 'code-123');
    expect(res).toMatchObject({ isAuthenticated: true, tokens: null });
  });

  it('auth:mockLogin returns redacted tokens (null to renderer)', async () => {
    const res = await ipcMain.__invoke('auth:mockLogin');
    expect(res).toMatchObject({ isAuthenticated: true, tokens: null });
  });

  it('auth:getAuthState returns redacted tokens (null to renderer)', async () => {
    const state = await ipcMain.__invoke('auth:getAuthState');
    expect(state.tokens).toBeNull();
    expect(state.isAuthenticated).toBe(true);
  });

  it('auth:getUser returns user profile', async () => {
    const user = await ipcMain.__invoke('auth:getUser');
    expect(user).toHaveProperty('email');
  });

  it('auth:isAuthenticated returns boolean', async () => {
    const ok = await ipcMain.__invoke('auth:isAuthenticated');
    expect(ok).toBe(true);
  });

  it('auth:logout resolves without error', async () => {
    await expect(ipcMain.__invoke('auth:logout')).resolves.toBeUndefined();
  });

  it('auth:refreshToken resolves without error', async () => {
    await expect(ipcMain.__invoke('auth:refreshToken')).resolves.toBeUndefined();
  });

  it('handleOAuthCallback sends error for invalid URL', async () => {
    // @ts-expect-error pass minimal window with webContents
    const win = {
      webContents: {
        send: (channel: string, ...args: unknown[]) => sentEvents.push({ channel, args }),
      },
    };
    handleOAuthCallback('not-a-url', win);
    const evt = sentEvents.find((e) => e.channel === 'auth:callback-error');
    expect(evt).toBeTruthy();
  });

  it('handleOAuthCallback sends success when code valid', async () => {
    // @ts-expect-error pass minimal window with webContents
    const win = {
      webContents: {
        send: (channel: string, ...args: unknown[]) => sentEvents.push({ channel, args }),
      },
    };
    const url = 'holokai://home?code=abc&state=xyz';
    handleOAuthCallback(url, win);
    // allow async then to resolve
    await new Promise((r) => setTimeout(r, 0));
    const evt = sentEvents.find((e) => e.channel === 'auth:callback-success');
    expect(evt).toBeTruthy();
  });
});

/*
 * Global test setup for Vitest (jsdom)
 * - Stubs window.electronAPI exposed by preload
 * - Provides minimal JSDOM polyfills used by Svelte/components
 */

import { afterEach, vi } from 'vitest';
import type { ElectronAPI, Thread, AuthState, UserProfile } from 'src-electron/preload';

// Strongly-typed global helper for test environment
interface TestGlobals {
  TextEncoder?: typeof TextEncoder;
  TextDecoder?: typeof TextDecoder;
  ResizeObserver?: typeof ResizeObserver;
  electronAPI?: ElectronAPI;
}
const G = globalThis as unknown as TestGlobals & typeof globalThis;

// -------------------------------------------------------------
// Common polyfills for jsdom
// -------------------------------------------------------------

// TextEncoder/TextDecoder for libraries expecting Web APIs
 
// @ts-ignore - node util provides these in runtime; types are fine
import { TextEncoder, TextDecoder } from 'util';
if (typeof G.TextEncoder === 'undefined') {
  G.TextEncoder = TextEncoder;
}
if (typeof G.TextDecoder === 'undefined') {
  G.TextDecoder = TextDecoder as unknown as typeof TextDecoder;
}

// ResizeObserver stub for components/tests that might use it
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (typeof G.ResizeObserver === 'undefined') {
  G.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// -------------------------------------------------------------
// window.electronAPI stub (Context Bridge)
// -------------------------------------------------------------

const now = (): Date => new Date();

const defaultUser: UserProfile = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  provider: 'oauth2',
};

const unauthenticatedState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
};

const authenticatedState: AuthState = {
  user: defaultUser,
  tokens: null,
  isAuthenticated: true,
};

const createThread = (data: Omit<Thread, 'id' | 'createdAt' | 'updatedAt'>): Thread => ({
  id: 'thread-1',
  createdAt: now(),
  updatedAt: now(),
  ...data,
});

const electronAPIStub: ElectronAPI = {
  auth: {
    startOAuthFlow: async () => ({ authUrl: 'http://localhost/mock-auth' }),
    exchangeCode: async () => authenticatedState,
    mockLogin: async () => authenticatedState,
    getAuthState: async () => unauthenticatedState,
    getUser: async () => null,
    isAuthenticated: async () => false,
    logout: async () => {},
    refreshToken: async () => {},
  },
  settings: {
    getAll: async () => ({
      mokuWebUrl: 'http://localhost:5173',
      mokuApiUrl: 'http://localhost:3000',
    }),
    get: async () => null,
    set: async () => {},
    setMultiple: async () => {},
    reset: async () => {},
    getMokuWebUrl: async () => 'http://localhost:5173',
    getMokuApiUrl: async () => 'http://localhost:3000',
    getStorePath: async () => '/tmp/holokai-store.json',
  },
  thread: {
    getAll: async () => [],
    getById: async () => null,
    create: async (data) => createThread(data),
    update: async (_id: string, updates: Partial<Thread>) => {
      const base: Omit<Thread, 'id' | 'createdAt' | 'updatedAt'> = {
        title: 'updated',
        description: '',
        status: 'active',
        metadata: {},
      };
      const merged: Omit<Thread, 'id' | 'createdAt' | 'updatedAt'> = {
        ...base,
        // only copy known fields from updates
        ...(('title' in updates ? { title: updates.title as string } : {}) as object),
        ...(('description' in updates ? { description: updates.description as string } : {}) as object),
        ...(('status' in updates ? { status: updates.status as 'active' | 'archived' | 'deleted' } : {}) as object),
        ...(('metadata' in updates ? { metadata: updates.metadata as Record<string, unknown> } : {}) as object),
      };
      return createThread(merged);
    },
    delete: async () => true,
    onThreadCreated: (_cb) => () => {},
    onThreadUpdated: (_cb) => () => {},
    onThreadDeleted: (_cb) => () => {},
  },
  system: {
    platform: async () => 'test',
    version: async () => '0.0.0-test',
    getPath: async () => '/tmp',
  },
  log: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
  onMenuCommand: (_channel: string, _callback: () => void) => () => {},
};

// Install the stub globally for tests
const win = window as unknown as Window & { electronAPI: ElectronAPI };
Object.defineProperty(win, 'electronAPI', {
  value: electronAPIStub,
  writable: true,
  configurable: true,
});
// mirror to global helper
G.electronAPI = electronAPIStub;

// Helper to allow tests to override parts of the stub when needed
export const setElectronAPIMocks = (overrides: Partial<ElectronAPI>): void => {
  const w = window as unknown as Window & { electronAPI: ElectronAPI };
  w.electronAPI = {
    ...w.electronAPI,
    ...overrides,
    auth: { ...w.electronAPI.auth, ...(overrides.auth || {}) },
    settings: { ...w.electronAPI.settings, ...(overrides.settings || {}) },
    thread: { ...w.electronAPI.thread, ...(overrides.thread || {}) },
    system: { ...w.electronAPI.system, ...(overrides.system || {}) },
    log: { ...w.electronAPI.log, ...(overrides.log || {}) },
  };
  G.electronAPI = w.electronAPI;
};

// Reset spies/mocks between tests
afterEach(() => {
  vi.clearAllMocks();
});

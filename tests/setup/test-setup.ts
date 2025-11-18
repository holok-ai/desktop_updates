/*
 * Global test setup for Vitest (jsdom)
 * - Stubs window.electronAPI exposed by preload
 * - Provides minimal JSDOM polyfills used by Svelte/components
 */

import { afterEach, vi } from 'vitest';
import type { ElectronAPI, Thread, AuthState, UserProfile } from '../../src-electron/preload';
import type { Project } from '../../src/lib/types/project.type';
import type { GUID } from '../../src/lib/types/app.type';

// Strongly-typed global helper for test environment
interface ResizeObserverConstructorLike {
  new (...args: unknown[]): { observe(): void; unobserve(): void; disconnect(): void };
}

interface TestGlobals {
  TextEncoder?: typeof globalThis.TextEncoder;
  TextDecoder?: typeof globalThis.TextDecoder;
  // Minimal ResizeObserver constructor shape for tests
  ResizeObserver?: ResizeObserverConstructorLike;
  electronAPI?: ElectronAPI;
}
const G = globalThis as unknown as TestGlobals & typeof globalThis;

// Catch and suppress specific unhandled rejections that arise from tests where
// electron mocks may not include the full `ipcMain.handle` API. We only
// suppress the known test-environment error to avoid failing the test run due
// to harmless import-time registration attempts in some mocks.
process.on('unhandledRejection', (reason: unknown) => {
  try {
    const maybe = reason as { message?: unknown } | undefined;
    const msg =
      maybe && typeof maybe.message !== 'undefined' ? String(maybe.message) : String(reason);
    if (typeof msg === 'string' && msg.includes('ipcMain.handle is not a function')) {
      // swallow this specific known issue in test env
      console.warn('[TEST-SETUP] Suppressed unhandled rejection:', msg);
      return;
    }
  } catch (_err) {
    // ignore
  }
  // Allow other unhandled rejections to surface normally (they will fail tests)
});

// -------------------------------------------------------------
// Common polyfills for jsdom
// -------------------------------------------------------------

// TextEncoder/TextDecoder for libraries expecting Web APIs

// @ts-ignore - node util provides these in runtime; types are fine
import { TextEncoder, TextDecoder } from 'util';
if (typeof G.TextEncoder === 'undefined') {
  G.TextEncoder = TextEncoder as unknown as typeof globalThis.TextEncoder;
}
if (typeof G.TextDecoder === 'undefined') {
  G.TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;
}

// ResizeObserver stub for components/tests that might use it
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (typeof G.ResizeObserver === 'undefined') {
  G.ResizeObserver = ResizeObserverStub as unknown as ResizeObserverConstructorLike;
}

// Lightweight in-memory IndexedDB polyfill for unit tests
// Provides minimal API used by services: open, onupgradeneeded, onsuccess,
// transaction(...).objectStore(...).{put,getAll,delete,clear}
if (typeof (globalThis as any).indexedDB === 'undefined') {
  (globalThis as any).indexedDB = (() => {
    type Store = Map<any, any>;
    const dbs = new Map<string, { version: number; stores: Map<string, Store> }>();

    function open(name: string, version = 1) {
      const request: any = {};
      // emulate async behavior
      Promise.resolve().then(() => {
        let entry = dbs.get(name);
        const isNew = !entry;
        if (!entry) {
          entry = { version, stores: new Map() };
          dbs.set(name, entry);
        } else if (version > entry.version) {
          // upgrade path
          entry.version = version;
          if (typeof request.onupgradeneeded === 'function') {
            request.result = makeDB(name);
            request.onupgradeneeded({ target: request });
          }
        }

        request.result = makeDB(name);
        if (typeof request.onsuccess === 'function') request.onsuccess({ target: request });
      });
      return request;
    }

    function makeDB(name: string) {
      const entry = dbs.get(name)!;
      return {
        name,
        version: entry.version,
        objectStoreNames: {
          contains: (s: string) => entry.stores.has(s),
        },
        createObjectStore: (storeName: string, _opts?: any) => {
          if (!entry.stores.has(storeName)) entry.stores.set(storeName, new Map());
        },
        transaction: (storeName: string, _mode: 'readonly' | 'readwrite') => {
          const store = entry.stores.get(storeName) ?? new Map();
          return {
            objectStore: () => {
              return {
                put: (val: any) => {
                  const key = val?.message?.id ?? val?.id;
                  store.set(key, val);
                  const req: any = {};
                  Promise.resolve().then(() => req.onsuccess && req.onsuccess());
                  return req;
                },
                getAll: () => {
                  const req: any = {};
                  Promise.resolve().then(() => {
                    req.result = Array.from(store.values());
                    req.onsuccess && req.onsuccess();
                  });
                  return req;
                },
                delete: (key: any) => {
                  const req: any = {};
                  Promise.resolve().then(() => {
                    store.delete(key);
                    req.onsuccess && req.onsuccess();
                  });
                  return req;
                },
                clear: () => {
                  const req: any = {};
                  Promise.resolve().then(() => {
                    store.clear();
                    req.onsuccess && req.onsuccess();
                  });
                  return req;
                },
              };
            },
          };
        },
      };
    }

    return { open };
  })();
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

const createProjectStub = (data?: Partial<Project>): Project => ({
  id: (data?.id as GUID) ?? 'project-1',
  title: data?.title ?? 'Test Project',
  description: data?.description ?? '',
  createdAt: data?.createdAt ?? now(),
  updatedAt: data?.updatedAt ?? now(),
  deletedAt: data?.deletedAt ?? null,
  metadata: data?.metadata ?? {},
  privacyMode: data?.privacyMode ?? 'default',
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
    onAuthCallbackSuccess:
      (_cb: (data: { user: UserProfile; isAuthenticated: boolean }) => void) => () => {},
    onAuthCallbackError: (_cb: (error: { error: string; description: string }) => void) => () => {},
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
        ...(('description' in updates
          ? { description: updates.description as string }
          : {}) as object),
        ...(('status' in updates
          ? { status: updates.status as 'active' | 'archived' | 'deleted' }
          : {}) as object),
        ...(('metadata' in updates
          ? { metadata: updates.metadata as Record<string, unknown> }
          : {}) as object),
      };
      return createThread(merged);
    },
    delete: async () => true,
    onThreadCreated: (_cb) => () => {},
    onThreadUpdated: (_cb) => () => {},
    onThreadDeleted: (_cb) => () => {},
    addUserPrompt: async (
      threadId: string | null,
      prompt: string,
      opts?: { title?: string; description?: string; model?: string },
    ) => {
      const th = threadId
        ? createThread({ title: 'from-prompt', description: '', status: 'active' })
        : createThread({
            title: opts?.title ?? 'new',
            description: opts?.description ?? '',
            status: 'active',
          });
      const msg = { id: 'm1', role: 'user', content: prompt, createdAt: Date.now() };
      return { thread: th, message: msg };
    },
    addAssistantResponse: async (threadId: string, response: string, model?: string) => {
      return { id: 'a1', role: 'assistant', content: response, createdAt: Date.now() };
    },
    savePromptAndResponses: async (
      threadId: string | null,
      prompt: string,
      responses: { text: string; model?: string }[],
      opts?: { title?: string; description?: string },
    ) => {
      const th = threadId
        ? createThread({ title: 'saved', description: opts?.description ?? '', status: 'active' })
        : createThread({
            title: opts?.title ?? 'new',
            description: opts?.description ?? '',
            status: 'active',
          });
      const promptMessage = { id: 'p1', role: 'user', content: prompt, createdAt: Date.now() };
      const responseMessages = responses.map((r, i) => ({
        id: `r${i}`,
        role: 'assistant',
        content: r.text,
        createdAt: Date.now(),
      }));
      return { thread: th, promptMessage, responseMessages };
    },
  },
  project: {
    getAll: async () => [createProjectStub()],
    getById: async (id: GUID) => createProjectStub({ id }),
    create: async (data: {
      title: string;
      description?: string;
      metadata?: Record<string, unknown>;
      privacyMode?: string;
    }) =>
      createProjectStub({
        id: crypto.randomUUID(),
        title: data.title,
        description: data.description,
        metadata: data.metadata,
        privacyMode: (data.privacyMode as Project['privacyMode']) ?? 'default',
      }),
    update: async (
      id: GUID,
      updates: {
        title?: string;
        description?: string;
        metadata?: Record<string, unknown>;
        privacyMode?: string;
      },
    ) =>
      createProjectStub({
        id,
        ...updates,
        privacyMode: (updates.privacyMode as Project['privacyMode']) ?? 'default',
      }),
    delete: async () => true,
    getThreads: async () => 0,
    onProjectCreated: (_cb: (project: Project) => void) => () => {},
    onProjectUpdated: (_cb: (project: Project) => void) => () => {},
    onProjectDeleted: (_cb: (projectId: GUID) => void) => () => {},
  },
  chat: {
    createProvider: async () => ({ success: true }),
    chat: async () => ({ success: true }),
    chatWithOptions: async () => ({ success: true }),
    onToken: (_cb: (token: string) => void) => {},
    offToken: () => {},
    getMetrics: async () => ({}),
    close: async () => ({ success: true }),
  },
  models: {
    listAvailable: async () => [],
    listAll: async () => [],
    get: async () => null,
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
type DeepObjectPartial<T> = {
  [K in keyof T]?: T[K] extends (...args: never[]) => unknown
    ? T[K]
    : T[K] extends object
      ? DeepObjectPartial<T[K]>
      : T[K];
};

type ElectronAPIPartial = DeepObjectPartial<ElectronAPI>;

export const setElectronAPIMocks = (overrides: ElectronAPIPartial): void => {
  const w = window as unknown as Window & { electronAPI: ElectronAPI };
  w.electronAPI = {
    ...w.electronAPI,
    ...overrides,
    auth: { ...w.electronAPI.auth, ...(overrides.auth || {}) },
    settings: { ...w.electronAPI.settings, ...(overrides.settings || {}) },
    thread: { ...w.electronAPI.thread, ...(overrides.thread || {}) },
    project: { ...w.electronAPI.project, ...(overrides.project || {}) },
    system: { ...w.electronAPI.system, ...(overrides.system || {}) },
    log: { ...w.electronAPI.log, ...(overrides.log || {}) },
  };
  G.electronAPI = w.electronAPI;
};

// Reset spies/mocks between tests
afterEach(() => {
  vi.clearAllMocks();
});

// Provide a lightweight stub for Svelte-only components that cause Vite import-analysis
// to attempt parsing `.svelte` files in unit tests. This avoids needing Svelte transforms
// during unit tests by mocking the module path to a simple JS class.
// Note: keep this here so it's applied before any test imports modules that may import the
// Svelte component.
vi.mock('src/lib/components/ModelChooser.svelte', () => {
  return {
    default: class ModelChooserStub {
      target: HTMLElement;
      props: Record<string, unknown> | undefined;
      constructor(opts: { target: HTMLElement; props?: Record<string, unknown> }) {
        this.target = opts.target;
        this.props = opts.props;
        // Render minimal DOM so tests querying '#model-select' still find elements if they
        // mount this stub directly (most tests mock the component anyway).
        const container = document.createElement('div');
        container.innerHTML =
          '<select id="model-select"><option value="">-- Select a model --</option></select><button class="confirm">Use</button>';
        this.target.appendChild(container);
      }
      $on(_ev: string, _cb: Function) {
        return () => {};
      }
      $destroy() {
        if (this.target && this.target.firstChild) this.target.removeChild(this.target.firstChild);
      }
    },
  };
});

// Provide a default minimal mock for the 'electron' module so tests that import
// `src-electron/main.ts` and expect ipcMain handlers to be registered do not throw
// if they don't explicitly mock 'electron'. Individual tests may override this
// using `vi.doMock('electron', ...)` as needed.
// Mock the internal logger module used by main process code so it doesn't
// attempt to call Electron `app.getVersion()` at import time in the test
// environment. Tests can still spy on the exposed functions if needed.
vi.doMock('src-electron/utils/logger', () => {
  // Lazy proxy to the (possibly mocked) `electron-log` default export so
  // per-test `vi.doMock('electron-log', ...)` calls are respected.
  type ElectronLogShape = {
    info: (...args: unknown[]) => unknown;
    warn: (...args: unknown[]) => unknown;
    error: (...args: unknown[]) => unknown;
    debug: (...args: unknown[]) => unknown;
    transports: Record<string, unknown>;
    variables: Record<string, unknown>;
  };

  function getElectronLog(): ElectronLogShape | null {
    try {
      const mod = require('electron-log');
      return (mod && (mod.default || mod)) as ElectronLogShape;
    } catch (_e) {
      return null;
    }
  }

  const proxy = {
    get log(): ElectronLogShape {
      return (
        getElectronLog() ?? {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
          transports: { file: {}, console: {} },
          variables: {},
        }
      );
    },
    createScopedLogger: (scope: string) => {
      return {
        info: (...args: unknown[]) =>
          (getElectronLog()?.info ?? vi.fn())(
            `[${scope.toUpperCase()}] ${args[0]}`,
            ...args.slice(1),
          ),
        warn: (...args: unknown[]) =>
          (getElectronLog()?.warn ?? vi.fn())(
            `[${scope.toUpperCase()}] ${args[0]}`,
            ...args.slice(1),
          ),
        error: (...args: unknown[]) =>
          (getElectronLog()?.error ?? vi.fn())(
            `[${scope.toUpperCase()}] ${args[0]}`,
            ...args.slice(1),
          ),
        debug: (...args: unknown[]) =>
          (getElectronLog()?.debug ?? vi.fn())(
            `[${scope.toUpperCase()}] ${args[0]}`,
            ...args.slice(1),
          ),
      };
    },
    logStructured: (...args: unknown[]) => (getElectronLog()?.info ?? vi.fn())(...args),
    logPerformance: (_op: string) => ({
      end: (m?: unknown) => (getElectronLog()?.debug ?? vi.fn())('perf', m),
    }),
    logError: (...args: unknown[]) => (getElectronLog()?.error ?? vi.fn())(...args),
    __esModule: true,
    default: undefined,
  };

  // Provide a live default getter that proxies to electron-log when available
  Object.defineProperty(proxy, 'default', {
    get() {
      return (
        getElectronLog() ?? {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
          transports: { file: {}, console: {} },
          variables: {},
        }
      );
    },
  });

  return proxy;
});

vi.doMock('electron', () => {
  return {
    app: {
      getVersion: () => '0.0.0-test',
      getPath: () => '/tmp',
      on: vi.fn(),
      whenReady: () => Promise.resolve(),
      requestSingleInstanceLock: vi.fn(() => true),
      quit: vi.fn(),
      setAsDefaultProtocolClient: vi.fn(),
    },
    BrowserWindow: class {
      static getAllWindows() {
        return [];
      }
      webContents: { send: (...args: unknown[]) => void } = { send: vi.fn() };
      on = vi.fn();
      constructor() {
        /* minimal */
      }
    },
    Menu: { buildFromTemplate: vi.fn(() => ({})), setApplicationMenu: vi.fn() },
    dialog: { showMessageBox: vi.fn(async () => ({})) },
    ipcMain: { on: vi.fn(), handle: vi.fn(), removeHandler: vi.fn() },
    session: { defaultSession: { webRequest: { onHeadersReceived: vi.fn() } } },
    contextBridge: { exposeInMainWorld: vi.fn() },
    ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() },
  };
});

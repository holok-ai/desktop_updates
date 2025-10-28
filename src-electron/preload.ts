import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

/**
 * Preload Script with Context Bridge
 *
 * This script runs before the renderer process loads and has access to both
 * Node.js APIs and the renderer's window object. It uses contextBridge to
 * safely expose IPC functionality to the renderer process.
 *
 * Security: Only expose specific, whitelisted APIs to the renderer.
 */

/**
 * Thread API
 *
 * Example API group for thread-related operations.
 * Each API group should have a clear, limited set of functions.
 */
export interface ThreadAPI {
  // Get all threads
  getAll: () => Promise<Thread[]>;

  // Get a single thread by ID
  getById: (id: string) => Promise<Thread | null>;

  // Create a new thread
  create: (thread: Omit<Thread, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Thread>;

  // Update an existing thread
  update: (id: string, updates: Partial<Thread>) => Promise<Thread>;

  // Delete a thread
  delete: (id: string) => Promise<boolean>;

  // Listen to thread events
  onThreadCreated: (callback: (thread: Thread) => void) => () => void;
  onThreadUpdated: (callback: (thread: Thread) => void) => () => void;
  onThreadDeleted: (callback: (threadId: string) => void) => () => void;
}

/**
 * Thread Interface
 *
 * Defines the structure of a thread object.
 */
export interface Thread {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'archived' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Settings API
 *
 * Application settings management.
 */
export interface SettingsAPI {
  // Get all settings
  getAll: () => Promise<AppSettings>;

  // Get specific setting
  get: (key: string) => Promise<unknown>;

  // Set specific setting
  set: (key: string, value: unknown) => Promise<void>;

  // Set multiple settings
  setMultiple: (settings: Partial<AppSettings>) => Promise<void>;

  // Reset to defaults
  reset: () => Promise<void>;

  // Get Moku Web URL
  getMokuWebUrl: () => Promise<string>;

  // Get Moku API URL
  getMokuApiUrl: () => Promise<string>;

  // Get settings file path
  getStorePath: () => Promise<string>;
}

/**
 * App Settings Interface
 */
export interface AppSettings {
  mokuWebUrl: string;
  mokuApiUrl: string;
  theme?: 'light' | 'dark';
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Auth API
 *
 * Authentication and authorization operations.
 */
export interface AuthAPI {
  // Start OAuth flow (Steps 1-2 of SSO)
  startOAuthFlow: () => Promise<{ authUrl: string }>;

  // Exchange authorization code for tokens (Step 5 of SSO)
  exchangeCode: (code: string, codeVerifier: string) => Promise<AuthState>;

  // Mock login for testing
  mockLogin: (provider: 'microsoft' | 'google' | 'oauth2') => Promise<AuthState>;

  // Get authentication state
  getAuthState: () => Promise<AuthState>;

  // Get current user
  getUser: () => Promise<UserProfile | null>;

  // Check if authenticated
  isAuthenticated: () => Promise<boolean>;

  // Logout
  logout: () => Promise<void>;

  // Refresh access token
  refreshToken: () => Promise<void>;
}

/**
 * User Profile Interface
 */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: 'microsoft' | 'google' | 'oauth2';
}

/**
 * Authentication State Interface
 */
export interface AuthState {
  user: UserProfile | null;
  tokens: null; // Tokens never exposed to renderer
  isAuthenticated: boolean;
}

/**
 * System API
 *
 * Example API for system-level operations.
 */
export interface SystemAPI {
  platform: () => Promise<string>;
  version: () => Promise<string>;
  getPath: (
    name: 'home' | 'appData' | 'userData' | 'temp' | 'desktop' | 'documents' | 'downloads',
  ) => Promise<string>;
}

/**
 * Logging API
 *
 * Provides logging functionality to the renderer process.
 */
export interface LogAPI {
  info: (message: string, ...params: unknown[]) => void;
  warn: (message: string, ...params: unknown[]) => void;
  error: (message: string, ...params: unknown[]) => void;
  debug: (message: string, ...params: unknown[]) => void;
}

/**
 * Complete Electron API exposed to renderer
 */
export interface ElectronAPI {
  auth: AuthAPI;
  settings: SettingsAPI;
  thread: ThreadAPI;
  system: SystemAPI;
  log: LogAPI;
  // Menu event listeners
  onMenuCommand: (channel: string, callback: () => void) => () => void;
}

// Expose protected methods via context bridge
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Auth API Implementation
   */
  auth: {
    startOAuthFlow: () => ipcRenderer.invoke('auth:startOAuthFlow'),

    exchangeCode: (code: string, codeVerifier: string) =>
      ipcRenderer.invoke('auth:exchangeCode', code, codeVerifier),

    mockLogin: (provider: 'microsoft' | 'google' | 'oauth2') =>
      ipcRenderer.invoke('auth:mockLogin', provider),

    getAuthState: () => ipcRenderer.invoke('auth:getAuthState'),

    getUser: () => ipcRenderer.invoke('auth:getUser'),

    isAuthenticated: () => ipcRenderer.invoke('auth:isAuthenticated'),

    logout: () => ipcRenderer.invoke('auth:logout'),

    refreshToken: () => ipcRenderer.invoke('auth:refreshToken'),
  } as AuthAPI,

  /**
   * Settings API Implementation
   */
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),

    get: (key: string) => ipcRenderer.invoke('settings:get', key),

    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),

    setMultiple: (settings: Partial<AppSettings>) =>
      ipcRenderer.invoke('settings:setMultiple', settings),

    reset: () => ipcRenderer.invoke('settings:reset'),

    getMokuWebUrl: () => ipcRenderer.invoke('settings:getMokuWebUrl'),

    getMokuApiUrl: () => ipcRenderer.invoke('settings:getMokuApiUrl'),

    getStorePath: () => ipcRenderer.invoke('settings:getStorePath'),
  } as SettingsAPI,

  /**
   * Thread API Implementation
   */
  thread: {
    getAll: () => ipcRenderer.invoke('thread:getAll'),

    getById: (id: string) => ipcRenderer.invoke('thread:getById', id),

    create: (thread: Omit<Thread, 'id' | 'createdAt' | 'updatedAt'>) =>
      ipcRenderer.invoke('thread:create', thread),

    update: (id: string, updates: Partial<Thread>) =>
      ipcRenderer.invoke('thread:update', id, updates),

    delete: (id: string) => ipcRenderer.invoke('thread:delete', id),

    // Event listeners with cleanup function
    onThreadCreated: (callback: (thread: Thread) => void): (() => void) => {
      const subscription = (_event: IpcRendererEvent, thread: Thread): void => callback(thread);
      ipcRenderer.on('thread:created', subscription);

      // Return cleanup function
      return (): void => {
        ipcRenderer.removeListener('thread:created', subscription);
      };
    },

    onThreadUpdated: (callback: (thread: Thread) => void): (() => void) => {
      const subscription = (_event: IpcRendererEvent, thread: Thread): void => callback(thread);
      ipcRenderer.on('thread:updated', subscription);

      return (): void => {
        ipcRenderer.removeListener('thread:updated', subscription);
      };
    },

    onThreadDeleted: (callback: (threadId: string) => void): (() => void) => {
      const subscription = (_event: IpcRendererEvent, threadId: string): void => callback(threadId);
      ipcRenderer.on('thread:deleted', subscription);

      return (): void => {
        ipcRenderer.removeListener('thread:deleted', subscription);
      };
    },
  } as ThreadAPI,

  /**
   * System API Implementation
   */
  system: {
    platform: () => ipcRenderer.invoke('system:platform'),
    version: () => ipcRenderer.invoke('system:version'),
    getPath: (name: string) => ipcRenderer.invoke('system:getPath', name),
  } as SystemAPI,

  /**
   * Logging API Implementation
   * Sends log messages to main process via IPC
   */
  log: {
    info: (message: string, ...params: unknown[]): void =>
      ipcRenderer.send('log:info', message, ...params),
    warn: (message: string, ...params: unknown[]): void =>
      ipcRenderer.send('log:warn', message, ...params),
    error: (message: string, ...params: unknown[]): void =>
      ipcRenderer.send('log:error', message, ...params),
    debug: (message: string, ...params: unknown[]): void =>
      ipcRenderer.send('log:debug', message, ...params),
  } as LogAPI,

  /**
   * Menu Command Listener
   *
   * Allows renderer to listen for menu commands from the main process
   */
  onMenuCommand: (channel: string, callback: () => void): (() => void) => {
    const subscription = (_event: IpcRendererEvent): void => callback();
    ipcRenderer.on(channel, subscription);

    // Return cleanup function
    return (): void => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
} as ElectronAPI);

/**
 * TypeScript declarations for window.electronAPI
 *
 * This makes TypeScript aware of the electronAPI on the window object.
 */
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

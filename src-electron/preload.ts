import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  ChatRequest,
  ChatRequestWithOptions,
} from './services/chat/interfaces/ChatMessage.js';
import type { ProviderConfig } from './services/chat/factories/ChatProviderFactory.js';
import type { ThreadStatus } from '$lib/types/status.type.js';
import type { AppThemeMode } from '$lib/types/app.type.js';
import type { Message } from '$lib/types/thread.type.js';

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

  // Soft delete a thread (deletedAt timestamp)
  softDelete: (id: string) => Promise<boolean>;

  // Get messages for a thread (persisted)
  getMessages: (id: string) => Promise<Message[]>;

  // Listen to thread events
  onThreadCreated: (callback: (thread: Thread) => void) => () => void;
  onThreadUpdated: (callback: (thread: Thread) => void) => () => void;
  onThreadDeleted: (callback: (threadId: string) => void) => () => void;
  // Add user prompt (creates thread if id null)
  addUserPrompt: (
    threadId: string | null,
    prompt: string,
    opts?: { title?: string; description?: string; model?: string },
  ) => Promise<{
    thread: Thread;
    message: { id: string; role: string; content: string; createdAt: number };
  }>;

  // Add assistant response to a thread
  addAssistantResponse: (
    threadId: string,
    response: string,
    model?: string,
  ) => Promise<{ id: string; role: string; content: string; createdAt: number }>;

  // Save prompt and multiple responses in a single operation
  savePromptAndResponses: (
    threadId: string | null,
    prompt: string,
    responses: { text: string; model?: string }[],
    opts?: { title?: string; description?: string },
  ) => Promise<{
    thread: Thread;
    promptMessage: { id: string; role: string; content: string; createdAt: number };
    responseMessages: { id: string; role: string; content: string; createdAt: number }[];
  }>;

  // Append a message with idempotency support
  appendMessage: (
    threadId: string,
    payload: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      metadata?: Record<string, unknown>;
      client_message_id?: string;
    },
  ) => Promise<
    | {
        success: true;
        message: Message;
        thread: Thread;
      }
    | { success: false; status: number; error: string; thread_id?: string }
  >;

  // Telemetry: listen for message.persisted audit events
  onMessagePersisted: (
    callback: (evt: { thread_id: string; message_id: string; timestamp: string }) => void,
  ) => () => void;
  // Listen for message error events (e.g., delivery/provider errors)
  onMessageError: (
    callback: (evt: {
      thread_id?: string;
      message_id?: string;
      client_message_id?: string;
      timestamp?: string;
      error?: Record<string, unknown>;
    }) => void,
  ) => () => void;
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
  status: ThreadStatus;
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
  theme?: AppThemeMode;
  autoUpdate?: boolean;
  updateAvailable?: boolean;
  latestVersion?: string;
}

/**
 * Models (Moku) API types
 */
export interface MokuModel {
  provider: string;
  id: string;
  title: string;
  description?: string;
  available: boolean;
  default?: boolean;
  createdAt: number;
}

/**
 * Models API
 */
export interface ModelsAPI {
  listAvailable: (userId?: string) => Promise<MokuModel[]>;
  listAll: (userId?: string) => Promise<MokuModel[]>;
  get: (provider: string, id: string) => Promise<MokuModel | null>;
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

  // OAuth callback event listeners
  onAuthCallbackSuccess: (
    callback: (data: { user: UserProfile; isAuthenticated: boolean }) => void,
  ) => () => void;
  onAuthCallbackError: (
    callback: (error: { error: string; description: string }) => void,
  ) => () => void;
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
 * Chat API
 *
 * Chat service operations for interacting with LLM providers.
 */
export interface ChatAPI {
  // Initialize/Create a chat service instance
  createProvider: (
    providerType: string,
    config: ProviderConfig,
  ) => Promise<{ success: boolean; error?: string }>;

  // Send a chat message (with streaming support)
  chat: (request: ChatRequest) => Promise<{ success: boolean; error?: string }>;

  // Send a chat message with advanced options
  chatWithOptions: (
    request: ChatRequestWithOptions,
  ) => Promise<{ success: boolean; error?: string }>;

  // Listen for streaming tokens (event-based)
  onToken: (callback: (token: string) => void) => void;

  // Stop listening to token events
  offToken: () => void;

  // Get audit/performance metrics
  getMetrics: () => Promise<unknown>;

  // Cleanup/close the provider
  close: () => Promise<{ success: boolean }>;
}

/**
 * Complete Electron API exposed to renderer
 */
export interface ElectronAPI {
  auth: AuthAPI;
  chat: ChatAPI;
  settings: SettingsAPI;
  models: ModelsAPI;
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

    // OAuth callback event listeners
    onAuthCallbackSuccess: (
      callback: (data: { user: UserProfile; isAuthenticated: boolean }) => void,
    ): (() => void) => {
      const subscription = (
        _event: IpcRendererEvent,
        data: { user: UserProfile; isAuthenticated: boolean },
      ): void => callback(data);
      ipcRenderer.on('auth:callback-success', subscription);

      // Return cleanup function
      return (): void => {
        ipcRenderer.removeListener('auth:callback-success', subscription);
      };
    },

    onAuthCallbackError: (
      callback: (error: { error: string; description: string }) => void,
    ): (() => void) => {
      const subscription = (
        _event: IpcRendererEvent,
        error: { error: string; description: string },
      ): void => callback(error);
      ipcRenderer.on('auth:callback-error', subscription);

      // Return cleanup function
      return (): void => {
        ipcRenderer.removeListener('auth:callback-error', subscription);
      };
    },
  } as AuthAPI,
  /**
   * Chat API Implementation
   */
  chat: {
    // 1. Initialize/Create a chat service instance
    createProvider: (providerType: string, config: ProviderConfig) =>
      ipcRenderer.invoke('chat:createProvider', providerType, config),

    // 2. Send a chat message (with streaming support)
    chat: (request: ChatRequest) => ipcRenderer.invoke('chat:send', request),

    // 3. Listen for streaming tokens (event-based)
    onToken: (callback: (token: string) => void) => {
      ipcRenderer.on('chat:token', (_, token: string) => callback(token));
    },

    // 4. Stop listening to token events
    offToken: () => {
      ipcRenderer.removeAllListeners('chat:token');
    },

    // 5. Get audit/performance metrics
    getMetrics: () => ipcRenderer.invoke('chat:getMetrics'),

    // 6. Cleanup/close the provider
    close: () => ipcRenderer.invoke('chat:close'),

    // 7. Optional: Chat with advanced options
    chatWithOptions: (request: ChatRequestWithOptions) =>
      ipcRenderer.invoke('chat:sendWithOptions', request),
  },

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
   * Models (Moku) API Implementation
   */
  models: {
    listAvailable: (userId?: string) => ipcRenderer.invoke('models:listAvailable', userId),
    listAll: (userId?: string) => ipcRenderer.invoke('models:listAll', userId),
    get: (provider: string, id: string) => ipcRenderer.invoke('models:get', provider, id),
  } as ModelsAPI,

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

    softDelete: (id: string) => ipcRenderer.invoke('thread:softDelete', id),

    getMessages: (id: string) => ipcRenderer.invoke('thread:getMessages', id),

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
    addUserPrompt: (
      threadId: string | null,
      prompt: string,
      opts: { title?: string; description?: string; model?: string } | undefined,
    ) => ipcRenderer.invoke('thread:addUserPrompt', threadId, prompt, opts),

    addAssistantResponse: (threadId: string, response: string, model?: string) =>
      ipcRenderer.invoke('thread:addAssistantResponse', threadId, response, model),

    savePromptAndResponses: (
      threadId: string | null,
      prompt: string,
      responses: { text: string; model?: string }[],
      opts?: { title?: string; description?: string },
    ) => ipcRenderer.invoke('thread:savePromptAndResponses', threadId, prompt, responses, opts),

    appendMessage: (
      threadId: string,
      payload: {
        role: 'user' | 'assistant' | 'system';
        content: string;
        metadata?: Record<string, unknown>;
        client_message_id?: string;
      },
    ) => ipcRenderer.invoke('thread:appendMessage', threadId, payload),

    onMessagePersisted: (
      callback: (evt: { thread_id: string; message_id: string; timestamp: string }) => void,
    ) => {
      const subscription = (
        _event: IpcRendererEvent,
        data: { thread_id: string; message_id: string; timestamp: string },
      ): void => callback(data);
      ipcRenderer.on('message:persisted', subscription);
      return (): void => {
        ipcRenderer.removeListener('message:persisted', subscription);
      };
    },
    // Listen for message error events forwarded from main process
    onMessageError: (
      callback: (evt: {
        thread_id?: string;
        message_id?: string;
        client_message_id?: string;
        timestamp?: string;
        error?: Record<string, unknown>;
      }) => void,
    ): (() => void) => {
      const subscription = (
        _event: IpcRendererEvent,
        data: {
          thread_id?: string;
          message_id?: string;
          client_message_id?: string;
          timestamp?: string;
          error?: Record<string, unknown>;
        },
      ): void => callback(data);
      ipcRenderer.on('message:error', subscription);
      return (): void => {
        ipcRenderer.removeListener('message:error', subscription);
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

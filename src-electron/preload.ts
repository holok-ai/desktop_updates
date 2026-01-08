import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  ChatRequest,
  ChatRequestWithOptions,
} from './services/chat/interfaces/ChatMessage.js';
import type { ProviderConfig } from './services/chat/factories/ChatProviderFactory.js';
import type { ThreadStatus } from '$lib/types/status.type.js';
import type { AppThemeMode, GUID } from '$lib/types/app.type.js';
import type { Message } from '$lib/types/thread.type.js';
import type { Attachment, FileValidationResult } from '../src-shared/types/attachment.types.js';
import type { Project, ProjectPrivacyMode, UserSummaryDTO } from '$lib/types/project.type.js';

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
type AuthProvider = 'microsoft' | 'google' | 'oauth2';

export interface ThreadAPI {
  // Get all threads with optional privacy filtering
  getAll: (options?: {
    projectId?: string | null;
    includeProjectOnly?: boolean;
  }) => Promise<Thread[]>;

  // Get a single thread by ID
  getById: (id: string) => Promise<Thread | null>;

  // Create a new thread
  create: (thread: Omit<Thread, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Thread>;

  // Update an existing thread
  update: (id: string, updates: Partial<Thread>) => Promise<Thread>;

  // Rename a thread with validation and title history tracking
  renameThread: (
    threadId: string,
    newTitle: string,
  ) => Promise<
    | { success: true; thread: Thread }
    | { success: false; status: number; error: string; code?: string }
  >;

  // Undo the most recent rename operation
  undoRename: (
    threadId: string,
  ) => Promise<
    | { success: true; thread: Thread }
    | { success: false; status: number; error: string; code?: string }
  >;

  // Delete a thread
  delete: (id: string) => Promise<boolean>;

  // Soft delete a thread (deletedAt timestamp)
  softDelete: (id: string) => Promise<boolean>;

  // Move thread to/from a project
  moveToProject: (
    threadId: string,
    targetProjectId: string | null,
    options?: { privacyMode?: string; contextHandling?: string },
  ) => Promise<Thread>;

  // Get messages for a thread (persisted)
  getMessages: (id: string) => Promise<Message[]>;

  // Listen to thread events
  onThreadCreated: (callback: (thread: Thread) => void) => () => void;
  onThreadUpdated: (callback: (thread: Thread) => void) => () => void;
  onThreadDeleted: (callback: (threadId: string) => void) => () => void;
  // Listen to title generation events
  onTitleGenerationStarted: (callback: (data: { threadId: string }) => void) => () => void;
  onTitleGenerationFinished: (
    callback: (data: { threadId: string; title: string }) => void,
  ) => () => void;
  // Add user prompt (creates thread if id null)
  addUserPrompt: (
    threadId: string | null,
    prompt: string,
    opts?: {
      title?: string;
      description?: string;
      model?: string;
      metadata?: Record<string, unknown>;
    },
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

  // Update message (edit)
  updateMessage: (
    threadId: string,
    messageId: string,
    newContent: string,
  ) => Promise<
    { success: true; message: Message; thread: Thread } | { success: false; error: string }
  >;

  // Update message metadata (e.g., for comments)
  updateMessageMetadata: (
    threadId: string,
    messageId: string,
    metadataUpdates: Record<string, unknown>,
  ) => Promise<
    { success: true; message: Message; thread: Thread } | { success: false; error: string }
  >;

  // Get message versions
  getMessageVersions: (
    threadId: string,
    messageId: string,
  ) => Promise<
    | { success: true; versions: Array<{ content: string; editedAt: number }> }
    | { success: false; error: string }
  >;

  // Delete messages after a specific message
  deleteMessagesAfter: (
    threadId: string,
    messageId: string,
  ) => Promise<{ success: true; thread: Thread } | { success: false; error: string }>;

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
 * Project API
 *
 * Project-related operations for organizing threads.
 */
export interface ProjectAPI {
  // Get all projects
  getAll: () => Promise<Project[]>;

  // Get a single project by ID
  getById: (id: GUID) => Promise<Project | null>;

  // Create a new project
  create: (data: {
    title: string;
    description?: string;
    metadata?: Record<string, unknown>;
    privacyMode?: ProjectPrivacyMode;
  }) => Promise<Project>;

  // Update an existing project
  update: (
    id: GUID,
    updates: {
      title?: string;
      description?: string;
      metadata?: Record<string, unknown>;
      privacyMode?: ProjectPrivacyMode;
    },
  ) => Promise<Project>;

  // Delete a project
  delete: (id: GUID, options?: { deleteThreads?: boolean }) => Promise<boolean>;

  // Get thread count for a project
  getThreads: (projectId: GUID) => Promise<number>;

  // Search users in organization
  searchUsers: (searchTerm?: string | null) => Promise<UserSummaryDTO[]>;

  // Listen to project events
  onProjectCreated: (callback: (project: Project) => void) => () => void;
  onProjectUpdated: (callback: (project: Project) => void) => () => void;
  onProjectDeleted: (callback: (projectId: GUID) => void) => () => void;
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

  // Directory whitelist management
  getDirectoryWhitelist: () => Promise<string[]>;
  addWhitelistPath: (path: string) => Promise<void>;
  removeWhitelistPath: (path: string) => Promise<void>;
  selectFolder: () => Promise<string | null>;
}

/**
 * App Settings Interface
 */
export interface AppSettings {
  mokuWebUrl: string;
  mokuApiUrl: string;
  holoApiUrl: string;
  directoryWhitelist?: string[];
  theme?: AppThemeMode;
  autoUpdate?: boolean;
  updateAvailable?: boolean;
  latestVersion?: string;
}

/**
 * ModelDetails - Full model configuration from Moku API
 * Used by ModelRepository to store complete model information
 */
export interface ModelDetails {
  id: string;
  title: string;
  accessName: string;
  provider: string;
  slug: string;
  url: string;
}

/**
 * Models API
 */
export interface ModelsAPI {
  listAll: () => Promise<ModelDetails[]>;
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
  mockLogin: (provider: AuthProvider) => Promise<AuthState>;

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
  provider: AuthProvider;
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
export type ToolUseEventPayload = {
  toolName: string;
  input: unknown;
  stage: 'start' | 'complete';
  toolCallId: string;
  result?: unknown;
};

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

  // Send a chat message with file tools enabled
  chatWithFileTools: (
    request: ChatRequest,
    workingDirectory?: string,
  ) => Promise<{ success: boolean; error?: string }>;

  // Set working directory for file tools
  setFileToolsWorkingDirectory: (dir: string) => Promise<{ success: boolean; error?: string }>;

  // Listen for streaming tokens (event-based)
  onToken: (callback: (token: string) => void) => void;

  // Stop listening to token events
  offToken: () => void;

  // Listen for tool use events (event-based)
  onToolUse: (callback: (data: ToolUseEventPayload) => void) => () => void;

  // Listen for tool status events (for UI feedback during long operations)
  onToolStatus: (
    callback: (status: {
      toolName: string;
      state: 'in_progress' | 'complete';
      message?: string;
    }) => void,
  ) => () => void;

  // Get audit/performance metrics
  getMetrics: () => Promise<unknown>;

  // Get audit logs with detailed metrics
  getAuditLogs: () => Promise<unknown[]>;

  // Cleanup/close the provider
  close: () => Promise<{ success: boolean }>;
}

/**
 * File API for file upload and management
 */
export interface FileAPI {
  // Upload file to storage
  upload: (payload: {
    threadId: string;
    fileBuffer: Buffer;
    filename: string;
    mimeType: string;
  }) => Promise<{
    success: boolean;
    attachment?: Attachment;
    error?: string;
  }>;

  // Get file by ID
  get: (payload: {
    threadId: string;
    fileId: string;
  }) => Promise<{ success: boolean; buffer?: Buffer; error?: string }>;

  // Delete file
  delete: (payload: {
    threadId: string;
    fileId: string;
  }) => Promise<{ success: boolean; error?: string }>;

  // Validate file before upload
  validate: (payload: {
    filename: string;
    mimeType: string;
    size: number;
  }) => Promise<FileValidationResult>;

  // Request preview token for secure file access
  preview: (payload: { threadId: string; fileId: string; userId: string }) => Promise<{
    success: boolean;
    token?: string;
    fileInfo?: {
      filename: string;
      mimeType: string;
      size: number;
      isPreviewable: boolean;
      canInlinePreview: boolean;
    };
    error?: string;
  }>;

  // Request download token for secure file access
  download: (payload: { threadId: string; fileId: string; userId: string }) => Promise<{
    success: boolean;
    token?: string;
    fileInfo?: {
      filename: string;
      mimeType: string;
      size: number;
    };
    error?: string;
  }>;

  // Get file with token (secure retrieval)
  getWithToken: (payload: { token: string }) => Promise<{
    success: boolean;
    buffer?: Buffer;
    filename?: string;
    mimeType?: string;
    error?: string;
  }>;

  // Listen for upload progress events
  onUploadProgress: (callback: (data: { fileId: string; progress: number }) => void) => () => void;
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
  project: ProjectAPI;
  system: SystemAPI;
  log: LogAPI;
  file: FileAPI;
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

    mockLogin: (provider: AuthProvider) => ipcRenderer.invoke('auth:mockLogin', provider),

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

    // 5a. Get audit logs with detailed metrics
    getAuditLogs: () => ipcRenderer.invoke('chat:getAuditLogs'),

    // 6. Cleanup/close the provider
    close: () => ipcRenderer.invoke('chat:close'),

    // 7. Optional: Chat with advanced options
    chatWithOptions: (request: ChatRequestWithOptions) =>
      ipcRenderer.invoke('chat:sendWithOptions', request),

    // 8. Chat with file tools enabled
    chatWithFileTools: (request: ChatRequest, workingDirectory?: string) =>
      ipcRenderer.invoke('chat:sendWithFileTools', request, workingDirectory),

    // 9. Set working directory for file tools
    setFileToolsWorkingDirectory: (dir: string) =>
      ipcRenderer.invoke('chat:setFileToolsWorkingDirectory', dir),

    // 10. Listen for tool use events
    onToolUse: (callback: (data: ToolUseEventPayload) => void): (() => void) => {
      const subscription = (
        _event: IpcRendererEvent,
        data: ToolUseEventPayload,
      ): void => callback(data);
      ipcRenderer.on('chat:toolUse', subscription);

      // Return cleanup function
      return (): void => {
        ipcRenderer.removeListener('chat:toolUse', subscription);
      };
    },

    // 11. Listen for tool status events (for UI feedback during long operations)
    onToolStatus: (
      callback: (status: {
        toolName: string;
        state: 'in_progress' | 'complete';
        message?: string;
      }) => void,
    ): (() => void) => {
      const subscription = (
        _event: IpcRendererEvent,
        status: { toolName: string; state: 'in_progress' | 'complete'; message?: string },
      ): void => callback(status);
      ipcRenderer.on('chat:toolStatus', subscription);

      // Return cleanup function
      return (): void => {
        ipcRenderer.removeListener('chat:toolStatus', subscription);
      };
    },
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

    getDirectoryWhitelist: () => ipcRenderer.invoke('settings:getDirectoryWhitelist'),

    addWhitelistPath: (path: string) => ipcRenderer.invoke('settings:addWhitelistPath', path),

    removeWhitelistPath: (path: string) => ipcRenderer.invoke('settings:removeWhitelistPath', path),

    selectFolder: () => ipcRenderer.invoke('settings:selectFolder'),
  } as SettingsAPI,

  /**
   * Models API Implementation
   */
  models: {
    listAll: () => ipcRenderer.invoke('models:listAll'),
  } as ModelsAPI,

  /**
   * Thread API Implementation
   */
  thread: {
    getAll: (options?: { projectId?: string | null; includeProjectOnly?: boolean }) =>
      ipcRenderer.invoke('thread:getAll', options),

    getById: (id: string) => ipcRenderer.invoke('thread:getById', id),

    create: (thread: Omit<Thread, 'id' | 'createdAt' | 'updatedAt'>) =>
      ipcRenderer.invoke('thread:create', thread),

    update: (id: string, updates: Partial<Thread>) =>
      ipcRenderer.invoke('thread:update', id, updates),

    renameThread: (threadId: string, newTitle: string) =>
      ipcRenderer.invoke('thread:renameThread', threadId, newTitle),

    undoRename: (threadId: string) => ipcRenderer.invoke('thread:undoRename', threadId),

    delete: (id: string) => ipcRenderer.invoke('thread:delete', id),

    moveToProject: (
      threadId: string,
      targetProjectId: string | null,
      options?: { privacyMode?: string; contextHandling?: string },
    ) => ipcRenderer.invoke('thread:moveToProject', threadId, targetProjectId, options),

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

    onTitleGenerationStarted: (callback: (data: { threadId: string }) => void): (() => void) => {
      const subscription = (_event: IpcRendererEvent, data: { threadId: string }): void =>
        callback(data);
      ipcRenderer.on('thread:titleGenerationStarted', subscription);

      return (): void => {
        ipcRenderer.removeListener('thread:titleGenerationStarted', subscription);
      };
    },

    onTitleGenerationFinished: (
      callback: (data: { threadId: string; title: string }) => void,
    ): (() => void) => {
      const subscription = (
        _event: IpcRendererEvent,
        data: { threadId: string; title: string },
      ): void => callback(data);
      ipcRenderer.on('thread:titleGenerationFinished', subscription);

      return (): void => {
        ipcRenderer.removeListener('thread:titleGenerationFinished', subscription);
      };
    },

    addUserPrompt: (
      threadId: string | null,
      prompt: string,
      opts:
        | {
            title?: string;
            description?: string;
            model?: string;
            metadata?: Record<string, unknown>;
          }
        | undefined,
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

    updateMessage: (threadId: string, messageId: string, newContent: string) =>
      ipcRenderer.invoke('thread:updateMessage', threadId, messageId, newContent),

    updateMessageMetadata: (
      threadId: string,
      messageId: string,
      metadataUpdates: Record<string, unknown>,
    ) => ipcRenderer.invoke('thread:updateMessageMetadata', threadId, messageId, metadataUpdates),

    getMessageVersions: (threadId: string, messageId: string) =>
      ipcRenderer.invoke('thread:getMessageVersions', threadId, messageId),

    deleteMessagesAfter: (threadId: string, messageId: string) =>
      ipcRenderer.invoke('thread:deleteMessagesAfter', threadId, messageId),

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
   * File API Implementation
   * Handles file upload, download, and validation
   */
  file: {
    upload: (payload: {
      threadId: string;
      fileBuffer: Buffer;
      filename: string;
      mimeType: string;
    }) => ipcRenderer.invoke('file:upload', payload),

    get: (payload: { threadId: string; fileId: string }) => ipcRenderer.invoke('file:get', payload),

    delete: (payload: { threadId: string; fileId: string }) =>
      ipcRenderer.invoke('file:delete', payload),

    validate: (payload: { filename: string; mimeType: string; size: number }) =>
      ipcRenderer.invoke('file:validate', payload),

    preview: (payload: { threadId: string; fileId: string; userId: string }) =>
      ipcRenderer.invoke('file:preview', payload),

    download: (payload: { threadId: string; fileId: string; userId: string }) =>
      ipcRenderer.invoke('file:download', payload),

    getWithToken: (payload: { token: string }) => ipcRenderer.invoke('file:getWithToken', payload),

    onUploadProgress: (
      callback: (data: { fileId: string; progress: number }) => void,
    ): (() => void) => {
      const subscription = (
        _event: IpcRendererEvent,
        data: { fileId: string; progress: number },
      ): void => callback(data);
      ipcRenderer.on('file:uploadProgress', subscription);

      // Return cleanup function
      return (): void => {
        ipcRenderer.removeListener('file:uploadProgress', subscription);
      };
    },
  } as FileAPI,

  /**
   * Project API Implementation
   */
  project: {
    getAll: () => ipcRenderer.invoke('project:getAll'),

    getById: (id: GUID) => ipcRenderer.invoke('project:getById', id),

    create: (data: { title: string; description?: string; metadata?: Record<string, unknown> }) =>
      ipcRenderer.invoke('project:create', data),

    update: (
      id: GUID,
      updates: { title?: string; description?: string; metadata?: Record<string, unknown> },
    ) => ipcRenderer.invoke('project:update', id, updates),

    delete: (id: GUID, options?: { deleteThreads?: boolean }) =>
      ipcRenderer.invoke('project:delete', id, options),

    getThreads: (projectId: GUID) => ipcRenderer.invoke('project:getThreads', projectId),

    searchUsers: (searchTerm?: string | null) =>
      ipcRenderer.invoke('project:searchUsers', searchTerm),

    // Event listeners with cleanup function
    onProjectCreated: (callback: (project: Project) => void): (() => void) => {
      const subscription = (_event: IpcRendererEvent, project: Project): void => callback(project);
      ipcRenderer.on('project:created', subscription);

      return (): void => {
        ipcRenderer.removeListener('project:created', subscription);
      };
    },

    onProjectUpdated: (callback: (project: Project) => void): (() => void) => {
      const subscription = (_event: IpcRendererEvent, project: Project): void => callback(project);
      ipcRenderer.on('project:updated', subscription);

      return (): void => {
        ipcRenderer.removeListener('project:updated', subscription);
      };
    },

    onProjectDeleted: (callback: (projectId: GUID) => void): (() => void) => {
      const subscription = (_event: IpcRendererEvent, projectId: GUID): void => callback(projectId);
      ipcRenderer.on('project:deleted', subscription);

      return (): void => {
        ipcRenderer.removeListener('project:deleted', subscription);
      };
    },
  } as ProjectAPI,

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

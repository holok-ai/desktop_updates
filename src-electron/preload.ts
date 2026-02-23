import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { DesktopChatRequest } from './services/chat/index.js';
import type { ToolDefinition } from './services/tool-calling/tool-types.js';

import type { AppThemeMode, GUID } from '$lib/types/app.type.js';
import type { Message } from '$lib/types/thread.type.js';
import type { Attachment, FileValidationResult } from '../src-shared/types/attachment.types.js';
import type { Project, ProjectPrivacyMode, UserSummaryDTO } from '$lib/types/project.type.js';

import type {
  Thread,
  JsonValue,
  JsonObject,
  JsonArray,
  JsonPrimitive,
} from './types/thread.types.js';
import type {
  CreateThreadRequest,
  MessageDTO,
  RequestOptionsDTO,
} from './services/mokuapi/thread.types.js';
import type { ApiResponse } from './types/api-response.js';

// Re-export types for use by other modules
export type { Thread, CreateThreadRequest, JsonValue, JsonObject, JsonArray, JsonPrimitive };
export type { ApiResponse };
export type { MessageDTO, RequestOptionsDTO };

/**
 * OLD Thread Interface (commented out - now imported from thread.types.ts)
 *
 * export interface Thread {
 *   messages: any;
 *   id: string;
 *   title: string;
 *   description: string;
 *   status: ThreadStatus;
 *   createdAt: Date;
 *   updatedAt: Date;
 *   metadata?: Record<string, unknown>;
 *   currentBranchId: string;
 * }
 */

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
  // Get all threads with optional project filtering
  getAll: (options?: {
    projectId?: string | null;
    includeProjectOnly?: boolean;
  }) => Promise<ApiResponse<Thread[]>>;

  // Get a single thread by ID
  getById: (id: string) => Promise<ApiResponse<Thread | null>>;

  // Create a new thread (optionally within a project context)
  create: (request: CreateThreadRequest) => Promise<ApiResponse<Thread>>;

  // Update an existing thread
  update: (id: string, updates: Partial<Thread>) => Promise<ApiResponse<Thread>>;

  // Rename a thread with validation and title history tracking
  renameThread: (threadId: string, newTitle: string) => Promise<ApiResponse<Thread>>;

  // Delete a thread
  delete: (id: string) => Promise<ApiResponse<boolean>>;

  // Soft delete a thread (deletedAt timestamp)
  softDelete: (id: string) => Promise<ApiResponse<boolean>>;

  // Move thread to/from a project
  moveToProject: (
    threadId: string,
    targetProjectId: string | null,
    options?: { privacyMode?: string; contextHandling?: string },
  ) => Promise<ApiResponse<Thread>>;

  // Get messages for a thread (persisted)
  getMessages: (id: string) => Promise<ApiResponse<Message[]>>;

  // Listen to thread events
  onThreadCreated: (callback: (thread: Thread) => void) => () => void;
  onThreadUpdated: (callback: (thread: Thread) => void) => () => void;
  onThreadDeleted: (callback: (threadId: string) => void) => () => void;
  // Listen to title generation events
  onTitleGenerationStarted: (callback: (data: { threadId: string }) => void) => () => void;
  onTitleGenerationFinished: (
    callback: (data: { threadId: string; title: string }) => void,
  ) => () => void;

  // Add assistant response to a thread
  addAssistantResponse: (
    threadId: string,
    response: string,
    model?: string,
  ) => Promise<ApiResponse<{ id: string; role: string; content: string; createdAt: number }>>;

  // Append a message with idempotency support
  appendMessage: (
    threadId: string,
    payload: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      metadata?: Record<string, unknown>;
      client_message_id?: string;
    },
  ) => Promise<ApiResponse<{ message: Message; thread: Thread }>>;

  // Update message (edit)
  updateMessage: (
    threadId: string,
    messageId: string,
    newContent: string,
  ) => Promise<ApiResponse<{ message: Message; thread: Thread }>>;

  // Delete a branch
  deleteBranch: (threadId: string, branchId: string) => Promise<ApiResponse<void>>;

  // Update message branch ID via Moku API
  updateMessageBranch: (
    threadId: string,
    messageId: string,
    branchId: string,
  ) => Promise<ApiResponse<MessageDTO>>;

  // Update message desktop options via Moku API
  updateMessageDesktopOptions: (
    threadId: string,
    messageId: string,
    desktopOptions: RequestOptionsDTO,
  ) => Promise<ApiResponse<MessageDTO>>;
}

/**
 * Project API
 *
 * Project-related operations for organizing threads.
 */
export interface ProjectAPI {
  // Get all projects
  getAll: () => Promise<ApiResponse<Project[]>>;

  // Load projects into cache (TTL). If forceRefresh=true, bypass cache.
  loadProjects: (forceRefresh?: boolean) => Promise<ApiResponse<Project[]>>;

  // List cached personal projects
  listPersonalProjects: () => Promise<ApiResponse<Project[]>>;

  // List cached shared projects
  listSharedProjects: () => Promise<ApiResponse<Project[]>>;

  // Get a single project by ID
  getById: (id: GUID) => Promise<ApiResponse<Project | null>>;

  // Create a new project
  create: (data: {
    title: string;
    description?: string;
    metadata?: Record<string, unknown>;
    privacyMode?: ProjectPrivacyMode;
  }) => Promise<ApiResponse<Project>>;

  // Update an existing project
  update: (
    id: GUID,
    updates: {
      title?: string;
      description?: string;
      metadata?: Record<string, unknown>;
      privacyMode?: ProjectPrivacyMode;
    },
  ) => Promise<ApiResponse<Project>>;

  // Delete a project
  delete: (id: GUID, options?: { deleteThreads?: boolean }) => Promise<ApiResponse<boolean>>;

  // Get threads for a project
  getThreads: (projectId: GUID) => Promise<ApiResponse<Thread[]>>;

  // Search users in organization
  searchUsers: (searchTerm?: string | null) => Promise<ApiResponse<UserSummaryDTO[]>>;

  // Add a member to a project
  addMember: (
    projectId: GUID,
    input: { userId: string; role: string },
  ) => Promise<ApiResponse<unknown>>;

  // Remove a member from a project
  removeMember: (projectId: GUID, memberId: string) => Promise<ApiResponse<void>>;

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

  // Select folder using native dialog
  selectFolder: () => Promise<string | null>;

  // Updates
  checkForUpdates: () => Promise<{ success: boolean; error?: string }>;

  // Diagnostics
  openLogInVSCode: () => Promise<{ success: boolean; error?: string }>;
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
  startingPage?: string;
  showRecentList?: boolean;
  threadLayout?: string;
  chatFontSize?: number;
  chatLayout?: string;
  enabledTools?: string[];
  shellCommands?: string;
  autoCheckUpdates?: boolean;
  autoInstallUpdates?: boolean;
  updateAvailable?: boolean;
  latestVersion?: string;
  /* ToolOrchestrator data need to load the UI  */
  config_windowsCommands: string;
  config_unixCommands: string;
  static_toolList?: ToolDefinition[];
}

/**
 * ApplicationSuammry - Chat application from Moku API
 * ModelDetails - Full model configuration from Moku API
 * Used by ModelRepository to store complete model information
 */
export interface ApplicationSummary {
  id: string;
  description: string;
  title: string;
  models?: ModelDetails[];
  provider: string;
  slug: string;
  url: string;
}

export interface ModelDetails {
  id: string;
  title: string;
  accessName: string;
  provider: string;
  applicationName: string;
  applicationSlug: string;
  slug: string;
  url: string;
  isPublic: boolean; // Model visibility flag (defaults to true)
  intendedUse?: string; // Optional description of intended use case}
}

/**
 * Updater API
 *
 * Auto-update operations exposed to the renderer.
 */
export interface UpdaterAPI {
  // Check whether an update is available; resolves to a human-readable status string
  getUpdateAvailability: () => Promise<string>;

  // Trigger an immediate download of the available update
  updateNow: () => Promise<{ success: boolean; error?: string }>;

  // Returns true if running in a development (unpackaged) build
  isDevelopmentBuild: () => Promise<boolean>;

  // Listen for update check completion
  onUpdateCheckComplete: (
    callback: (result: { updateAvailable: boolean; version?: string }) => void,
  ) => () => void;
}

/**
 * Models API
 */
export interface ModelsAPI {
  listAllModels: () => Promise<ApiResponse<ModelDetails[]>>;
  listAllApplications: (reloadFromApi?: boolean) => Promise<ApiResponse<ApplicationSummary[]>>;
  getModelsForApplication: (applicationId: string) => Promise<ApiResponse<ModelDetails[]>>;
  getAgent: (agentId: string) => Promise<ApiResponse<ApplicationSummary>>;
}

/**
 * Auth API
 *
 * Authentication and authorization operations.
 */
export interface AuthAPI {
  // Start OAuth flow (Steps 1-2 of SSO)
  startOAuthFlow: () => Promise<{ authUrl: string }>;

  // Get authentication state
  getAuthState: () => Promise<AuthState>;

  // Logout
  logout: () => Promise<void>;

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
  isTestMode?: boolean; // Flag to indicate test tokens are being used
}

/**
 * System API
 *
 * Example API for system-level operations.
 */
export interface SystemAPI {
  platform: () => Promise<string>;
  version: () => Promise<string>;
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
  // Initialize/Create a chat service instance for a thread+branch
  createServiceForThread: (
    threadId: string,
    branchId: string,
    modelAccessName: string,
    workingDirectory?: string,
  ) => Promise<ApiResponse<void>>;

  // Send a chat message (with streaming support) for a specific thread
  chat: (threadId: string, request: DesktopChatRequest) => Promise<ApiResponse<void>>;

  // Cancel an in-flight streaming response for a specific thread+branch
  cancelStream: (threadId: string, branchId: string) => Promise<ApiResponse<void>>;

  // Listen for streaming tokens (event-based)
  onToken: (
    callback: (data: { threadId: string; branchId: string; token: string }) => void,
  ) => () => void;

  // Stop listening to token events
  offToken: () => void;

  // Get audit logs with detailed metrics for a thread+branch
  getAuditLogs: (threadId: string, branchId: string) => Promise<ApiResponse<unknown[]>>;
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

  // Validate file before upload
  validate: (payload: {
    filename: string;
    mimeType: string;
    size: number;
  }) => Promise<FileValidationResult>;
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
  updater: UpdaterAPI;
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

    getAuthState: () => ipcRenderer.invoke('auth:getAuthState'),

    logout: () => ipcRenderer.invoke('auth:logout'),

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
    // 1. Initialize/Create a chat service instance for a thread+branch
    createServiceForThread: (
      threadId: string,
      branchId: string,
      modelAccessName: string,
      workingDirectory?: string,
    ) =>
      ipcRenderer.invoke(
        'chat:createServiceForThread',
        threadId,
        branchId,
        modelAccessName,
        workingDirectory,
      ),

    // 2. Send a chat message (with streaming support) for a specific thread
    chat: (threadId: string, request: DesktopChatRequest) =>
      ipcRenderer.invoke('chat:send', threadId, request),

    // 2b. Cancel an in-flight streaming response
    cancelStream: (threadId: string, branchId: string) =>
      ipcRenderer.invoke('chat:cancel', threadId, branchId),

    // 3. Listen for streaming tokens (event-based)
    onToken: (
      callback: (data: { threadId: string; branchId: string; token: string }) => void,
    ): (() => void) => {
      const subscription = (
        _event: IpcRendererEvent,
        data: { threadId: string; branchId: string; token: string },
      ): void => callback(data);
      ipcRenderer.on('chat:token', subscription);

      // Return cleanup function
      return (): void => {
        ipcRenderer.off('chat:token', subscription);
      };
    },

    // 4. Stop listening to token events
    offToken: () => {
      ipcRenderer.removeAllListeners('chat:token');
    },

    // 5. Get audit logs with detailed metrics for a thread
    getAuditLogs: (threadId: string, branchId: string) =>
      ipcRenderer.invoke('chat:getAuditLogs', threadId, branchId),
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

    selectFolder: () => ipcRenderer.invoke('settings:selectFolder'),

    checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),

    openLogInVSCode: () => ipcRenderer.invoke('settings:openLogInVSCode'),
  } as SettingsAPI,

  /**
   * Models API Implementation
   */
  models: {
    listAllModels: () => ipcRenderer.invoke('models:listAll'),
    listAllApplications: (reloadFromApi?: boolean) =>
      ipcRenderer.invoke('models:listAllApplications', reloadFromApi),
    getModelsForApplication: (applicationId: string) =>
      ipcRenderer.invoke('models:getModelsForApplication', applicationId),
    getAgent: (agentId: string) => ipcRenderer.invoke('models:getAgent', agentId),
  } as ModelsAPI,

  /**
   * Thread API Implementation
   */
  thread: {
    getAll: (options?: { projectId?: string | null; includeProjectOnly?: boolean }) =>
      ipcRenderer.invoke('thread:getAll', options),

    getById: (id: string) => ipcRenderer.invoke('thread:getById', id),

    create: (request: CreateThreadRequest) => ipcRenderer.invoke('thread:create', request),

    update: (id: string, updates: Partial<Thread>) =>
      ipcRenderer.invoke('thread:update', id, updates),

    renameThread: (threadId: string, newTitle: string) =>
      ipcRenderer.invoke('thread:renameThread', threadId, newTitle),

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

    addAssistantResponse: (threadId: string, response: string, model?: string) =>
      ipcRenderer.invoke('thread:addAssistantResponse', threadId, response, model),

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

    deleteBranch: (threadId: string, branchId: string) =>
      ipcRenderer.invoke('thread:deleteBranch', threadId, branchId),

    updateMessageBranch: (threadId: string, messageId: string, branchId: string) =>
      ipcRenderer.invoke('thread:updateMessageBranch', threadId, messageId, branchId),

    updateMessageDesktopOptions: (
      threadId: string,
      messageId: string,
      desktopOptions: RequestOptionsDTO,
    ) =>
      ipcRenderer.invoke('thread:updateMessageDesktopOptions', threadId, messageId, desktopOptions),
  } as ThreadAPI,

  /**
   * System API Implementation
   */
  system: {
    platform: () => ipcRenderer.invoke('system:platform'),
    version: () => ipcRenderer.invoke('system:version'),
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

    validate: (payload: { filename: string; mimeType: string; size: number }) =>
      ipcRenderer.invoke('file:validate', payload),
  } as FileAPI,

  /**
   * Project API Implementation
   */
  project: {
    getAll: () => ipcRenderer.invoke('project:list'),

    loadProjects: (forceRefresh?: boolean) =>
      ipcRenderer.invoke('project:loadProjects', forceRefresh),

    listPersonalProjects: () => ipcRenderer.invoke('project:listPersonalProjects'),

    listSharedProjects: () => ipcRenderer.invoke('project:listSharedProjects'),

    getById: (id: GUID) => ipcRenderer.invoke('project:get', id),

    create: (data: {
      title: string;
      description?: string;
      type?: 'personal' | 'shared';
      metadata?: Record<string, unknown>;
      privacyMode?: string; // Legacy field, will be ignored
    }) => ipcRenderer.invoke('project:create', data),

    update: (
      id: GUID,
      updates: {
        title?: string;
        description?: string;
        metadata?: Record<string, unknown>;
        privacyMode?: string; // Legacy field, will be ignored
      },
    ) => ipcRenderer.invoke('project:update', id, updates),

    delete: (id: GUID, options?: { deleteThreads?: boolean }) =>
      ipcRenderer.invoke('project:delete', id, options),

    getThreads: (projectId: GUID) => ipcRenderer.invoke('project:getThreads', projectId),

    searchUsers: (searchTerm?: string | null) =>
      ipcRenderer.invoke('project:searchUsers', searchTerm),

    addMember: (projectId: GUID, input: { userId: string; role: string }) =>
      ipcRenderer.invoke('project:addMember', projectId, input),

    removeMember: (projectId: GUID, memberId: string) =>
      ipcRenderer.invoke('project:removeMember', projectId, memberId),

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
   * Updater API Implementation
   */
  updater: {
    getUpdateAvailability: () => ipcRenderer.invoke('updater:getUpdateAvailability'),
    updateNow: () => ipcRenderer.invoke('updater:updateNow'),
    isDevelopmentBuild: () => ipcRenderer.invoke('updater:isDevelopmentBuild'),
    onUpdateCheckComplete: (callback): (() => void) => {
      const subscription = (
        _event: IpcRendererEvent,
        result: { updateAvailable: boolean; version?: string },
      ): void => callback(result);
      ipcRenderer.on('updater:checkComplete', subscription);
      return (): void => {
        ipcRenderer.removeListener('updater:checkComplete', subscription);
      };
    },
  } as UpdaterAPI,

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

/**
 * Re-export chat types for frontend use
 * This allows frontend components to import these types directly from preload
 */
export type { DesktopChatRequest, DesktopChatMessage } from './services/chat/index.js';

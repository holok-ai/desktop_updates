# Chat Connection Manager - Design Document

## Executive Summary

This document describes the design and implementation plan for a Chat Connection Manager that enables multiple concurrent chat operations in the Holokai Desktop application. The manager will pool and reuse `DesktopChatService` instances, allowing the UI to support multiple active prompts simultaneously across different threads and branches.

## 1. Current State Analysis

### 1.1 Current Architecture

The current implementation has significant limitations for concurrent chat operations:

**chat-handler.ts (Lines 15-16, 64)**
```typescript
let chatService: DesktopChatService | null = null;

// In chat:createProvider handler
chatService = new DesktopChatService(providerType, newConfig, toolOrchestrator);
```

**Problems:**
- **Single Instance**: Only one global `chatService` instance exists
- **No Concurrency**: Each `chat:createProvider` call replaces the previous instance
- **Resource Waste**: Services are recreated for every provider/model switch
- **Lost State**: Previous service state is discarded without cleanup
- **No Multi-Threading**: Cannot handle concurrent chats in different threads or branches

### 1.2 Current Flow

```
Renderer Process                IPC Handler                  Main Process
     |                               |                            |
     |--chat:createProvider--------->|                            |
     |                               |--new DesktopChatService--->|
     |                               |<--instance-----------------|
     |                               | (replaces previous)        |
     |<-----success------------------|                            |
     |                               |                            |
     |--chat:send------------------->|                            |
     |                               |--chatService.chat()------->|
     |<-----tokens (streaming)-------|                            |
```

### 1.3 Dependencies

**DesktopChatService** (desktop-chat-service.ts):
- Wraps `ChatService` from `@holokai/chat-component`
- Manages: workingDirectory, toolOrchestra, providerType, model
- Key methods: `chat()`, `getAuditLogs()`, `setWorkingDirectory()`

**ToolOrchestrator** (orchestrator.ts):
- Currently instantiated per chat service (chat-handler.ts:56)
- Manages tool definitions and execution
- Configured with directory whitelist from settings

**Integration Points**:
- main.ts: `registerIpcHandlers()` called on app ready
- chat-handler.ts: IPC handlers for chat operations
- No explicit cleanup on app shutdown

## 2. Requirements

### 2.1 Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-1 | Pool multiple DesktopChatService instances | MUST | Core functionality |
| FR-2 | Key services by (appSlug, provider, model) tuple | MUST | Unique identification |
| FR-3 | Reuse existing service if tuple matches | MUST | Efficiency |
| FR-4 | Support configurable pool size limit | MUST | Resource management |
| FR-5 | Initialize manager on app startup | MUST | Lifecycle integration |
| FR-6 | Close all services on app shutdown | MUST | Cleanup |
| FR-7 | Provide status reporting (count, access times, call counts) | SHOULD | Monitoring |
| FR-8 | Support unlimited pool size (MAXIMUM_POOL_SIZE = 0) | SHOULD | Flexibility |


### 2.2 Non-Functional Requirements

| ID | Requirement | Target | Notes |
|----|-------------|--------|-------|
| NFR-1 | Service retrieval latency | < 10ms | get() should be fast |
| NFR-2 | Memory overhead per service | < 50MB | Monitor ChatService memory |
| NFR-3 | Concurrent chat sessions | 10+ | Support multiple branches |
| NFR-4 | Service cleanup time | < 1s | Fast shutdown |

### 2.3 Design Constraints

- Must not break existing chat functionality
- Must integrate with current IPC handler pattern
- Must work with existing DesktopChatService interface
- Must support both development and production builds
- Must maintain thread safety (though Electron main process is single-threaded)

## 3. Proposed Architecture

### 3.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        Renderer Process                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Thread 1 │  │ Thread 2 │  │ Thread 3 │  │ Thread N │       │
│  │ Branch A │  │ Branch A │  │ Branch B │  │ Branch C │       │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘       │
└────────┼─────────────┼─────────────┼─────────────┼─────────────┘
         │             │             │             │
         │  IPC        │  IPC        │  IPC        │  IPC
         ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Main Process                            │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │               ChatConnectionManager                       │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │  Service Pool (Map<string, ServiceEntry>)          │ │ │
│  │  │  ┌────────────────┐  ┌────────────────┐            │ │ │
│  │  │  │ Service Entry  │  │ Service Entry  │   ...      │ │ │
│  │  │  │ key: "app::    │  │ key: "app::    │            │ │ │
│  │  │  │   anthropic::  │  │   openai::     │            │ │ │
│  │  │  │   claude-3"    │  │   gpt-4"       │            │ │ │
│  │  │  │ ┌────────────┐ │  │ ┌────────────┐ │            │ │ │
│  │  │  │ │  Desktop   │ │  │ │  Desktop   │ │            │ │ │
│  │  │  │ │   Chat     │ │  │ │   Chat     │ │            │ │ │
│  │  │  │ │  Service   │ │  │ │  Service   │ │            │ │ │
│  │  │  │ └────────────┘ │  │ └────────────┘ │            │ │ │
│  │  │  │ lastAccess: ts │  │ lastAccess: ts │            │ │ │
│  │  │  │ callCount: 5   │  │ callCount: 12  │            │ │ │
│  │  │  └────────────────┘  └────────────────┘            │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                                                           │ │
│  │  - init(): void                                          │ │
│  │  - close(): Promise<void>                               │ │
│  │  - status(): ConnectionManagerStatus                    │ │
│  │  - get(appSlug, provider, model): DesktopChatService   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    IPC Handlers                          │ │
│  │  chat:createProvider → manager.get(...)                 │ │
│  │  chat:send → service.chat(...)                          │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Singleton Manager** | Only one manager needed per application lifecycle |
| **Map-based Pool** | O(1) lookup by tuple key |
| **Lazy Service Creation** | Create services only when needed |
| **LRU Eviction** | Remove least recently used when pool full |
| **Synchronous get()** | Service creation is fast enough for sync API |
| **Async close()** | Allow graceful cleanup of services |
| **Per-Service Statistics** | Track lastAccess and callCount for monitoring |

## 4. Detailed Design

### 4.1 ChatConnectionManager Class

**File**: `src-electron/services/chat/chat-connection-manager.ts`

```typescript
import { DesktopChatService } from './desktop-chat-service.js';
import type { ProviderConfig } from '@holokai/chat-component';
import type { ToolOrchestrator } from '../tool-calling/orchestrator.js';
import log from 'electron-log';

/**
 * Configuration for the connection manager
 */
export interface ChatConnectionManagerConfig {
  /**
   * Maximum number of services to pool
   * 0 = unlimited
   */
  maxPoolSize: number;
}

/**
 * Entry in the service pool
 */
interface ServiceEntry {
  service: DesktopChatService;
  lastAccess: number;  // Timestamp of last access
  callCount: number;   // Number of chat() calls made
}

/**
 * Status information for the connection manager
 */
export interface ConnectionManagerStatus {
  activeServices: number;
  maxPoolSize: number;
  services: Array<{
    key: string;
    lastAccessAgo: number;  // Milliseconds since last access
    callCount: number;
  }>;
}

/**
 * Parameters for getting a service
 */
export interface GetServiceParams {
  appSlug: string;
  provider: string;
  model: string;
  config: ProviderConfig;
  toolOrchestrator?: ToolOrchestrator;
}

/**
 * Chat Connection Manager
 *
 * Manages a pool of DesktopChatService instances to enable multiple concurrent
 * chat operations across different threads and branches.
 *
 * Services are keyed by (appSlug, provider, model) tuple and reused when possible.
 * Implements LRU eviction when pool size limit is reached.
 */
export class ChatConnectionManager {
  private static instance: ChatConnectionManager | null = null;

  private pool: Map<string, ServiceEntry> = new Map();
  private config: ChatConnectionManagerConfig;
  private isInitialized = false;

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor(config?: Partial<ChatConnectionManagerConfig>) {
    this.config = {
      maxPoolSize: config?.maxPoolSize ?? 0, // 0 = unlimited
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<ChatConnectionManagerConfig>): ChatConnectionManager {
    if (!ChatConnectionManager.instance) {
      ChatConnectionManager.instance = new ChatConnectionManager(config);
    }
    return ChatConnectionManager.instance;
  }

  /**
   * Initialize the connection manager
   * Should be called once on application startup
   */
  public init(): void {
    if (this.isInitialized) {
      log.warn('[ChatConnectionManager] Already initialized');
      return;
    }

    log.info('[ChatConnectionManager] Initializing', {
      maxPoolSize: this.config.maxPoolSize === 0 ? 'unlimited' : this.config.maxPoolSize,
    });

    this.pool.clear();
    this.isInitialized = true;

    log.info('[ChatConnectionManager] Initialized successfully');
  }

  /**
   * Close all chat services and cleanup
   * Should be called once on application shutdown
   */
  public async close(): Promise<void> {
    log.info('[ChatConnectionManager] Closing all services', {
      serviceCount: this.pool.size,
    });

    // Currently DesktopChatService doesn't have a close method
    // If one is added in the future, call it here
    // for (const entry of this.pool.values()) {
    //   await entry.service.close();
    // }

    this.pool.clear();
    this.isInitialized = false;

    log.info('[ChatConnectionManager] All services closed');
  }

  /**
   * Get status information about the connection manager
   */
  public status(): ConnectionManagerStatus {
    const now = Date.now();

    return {
      activeServices: this.pool.size,
      maxPoolSize: this.config.maxPoolSize,
      services: Array.from(this.pool.entries()).map(([key, entry]) => ({
        key,
        lastAccessAgo: now - entry.lastAccess,
        callCount: entry.callCount,
      })),
    };
  }

  /**
   * Get or create a DesktopChatService for the given parameters
   *
   * Services are cached by (appSlug, provider, model) tuple.
   * If a service already exists for this tuple, it is returned.
   * Otherwise, a new service is created and added to the pool.
   *
   * If the pool is at maximum capacity, the least recently used service is evicted.
   */
  public get(params: GetServiceParams): DesktopChatService {
    if (!this.isInitialized) {
      throw new Error('ChatConnectionManager not initialized. Call init() first.');
    }

    const key = this.makeKey(params.appSlug, params.provider, params.model);

    // Check if service already exists
    const existing = this.pool.get(key);
    if (existing) {
      log.debug('[ChatConnectionManager] Reusing existing service', { key });
      existing.lastAccess = Date.now();
      return existing.service;
    }

    // Check if we need to evict before creating new service
    if (this.config.maxPoolSize > 0 && this.pool.size >= this.config.maxPoolSize) {
      this.evictLRU();
    }

    // Create new service
    log.info('[ChatConnectionManager] Creating new service', { key });
    const service = new DesktopChatService(
      params.provider,
      params.config,
      params.toolOrchestrator,
    );

    // Add to pool
    this.pool.set(key, {
      service,
      lastAccess: Date.now(),
      callCount: 0,
    });

    log.info('[ChatConnectionManager] Service created', {
      key,
      poolSize: this.pool.size,
    });

    return service;
  }

  /**
   * Increment call count for a service
   * Should be called after each chat() invocation
   */
  public incrementCallCount(appSlug: string, provider: string, model: string): void {
    const key = this.makeKey(appSlug, provider, model);
    const entry = this.pool.get(key);

    if (entry) {
      entry.callCount++;
      entry.lastAccess = Date.now();
    }
  }

  /**
   * Create a unique key for the service tuple
   */
  private makeKey(appSlug: string, provider: string, model: string): string {
    return `${appSlug}::${provider}::${model}`;
  }

  /**
   * Evict the least recently used service from the pool
   */
  private evictLRU(): void {
    if (this.pool.size === 0) {
      return;
    }

    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.pool.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      log.info('[ChatConnectionManager] Evicting LRU service', {
        key: oldestKey,
        lastAccessAgo: Date.now() - oldestTime,
      });

      this.pool.delete(oldestKey);
    }
  }

  /**
   * For testing: Reset singleton instance
   * @internal
   */
  public static resetInstance(): void {
    ChatConnectionManager.instance = null;
  }
}
```

### 4.2 Type Definitions

**File**: `src-electron/services/chat/index.ts` (update exports)

```typescript
// Add these exports
export { ChatConnectionManager } from './chat-connection-manager.js';
export type {
  ChatConnectionManagerConfig,
  ConnectionManagerStatus,
  GetServiceParams,
} from './chat-connection-manager.js';
```

### 4.3 Chat Handler Changes

**File**: `src-electron/ipc-handlers/chat-handler.ts`

**Before** (Lines 15-16):
```typescript
let chatService: DesktopChatService | null = null;
let authService: AuthService | null = null;
```

**After**:
```typescript
import { ChatConnectionManager } from '../services/chat/index.js';
import type { GetServiceParams } from '../services/chat/index.js';

// Track current service parameters for incrementing call count
interface CurrentServiceParams {
  appSlug: string;
  provider: string;
  model: string;
}

let authService: AuthService | null = null;
let currentServiceParams: CurrentServiceParams | null = null;

// Get manager instance (will be initialized in main.ts)
const getManager = (): ChatConnectionManager => {
  return ChatConnectionManager.getInstance();
};
```

**chat:createProvider Handler Changes** (Lines 30-76):

```typescript
ipcMain.handle(
  'chat:createProvider',
  async (
    _event,
    providerType: string,
    config: ProviderConfig,
    appSlug = 'desktop', // Add appSlug parameter with default
  ): Promise<{ success: boolean; error?: string }> => {
    log.info('[IPC] chat:createProvider called', { appSlug, providerType, model: config.model });

    try {
      // Inject access token from auth service if available
      if (authService) {
        try {
          const accessToken = await authService.getAccessToken();
          config.apiKey = accessToken;
          log.info('[IPC] Access token injected into chat provider config');
        } catch (error) {
          log.warn('[IPC] Could not get access token, using provided apiKey:', error);
        }
      }

      // Get whitelist from settings
      const settingsService = getSettingsService();
      const allowedPaths = settingsService.getDirectoryWhitelist();

      // Create ToolOrchestrator for file tools
      const toolOrchestrator = new ToolOrchestrator(undefined, allowedPaths);

      // Get or create service from connection manager
      const manager = getManager();
      const getParams: GetServiceParams = {
        appSlug,
        provider: providerType,
        model: config.model,
        config: {
          url: (config as any).url || '',
          apiKey: config.apiKey || '',
          model: config.model,
        },
        toolOrchestrator,
      };

      const chatService = manager.get(getParams);

      // Store current service params for call count tracking
      currentServiceParams = {
        appSlug,
        provider: providerType,
        model: config.model,
      };

      log.info('[IPC] DesktopChatService retrieved from manager', {
        appSlug,
        provider: providerType,
        model: config.model,
        whitelistCount: allowedPaths.length,
      });

      return { success: true };
    } catch (error) {
      log.error('[IPC] Error creating chat provider:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  },
);
```

**chat:send Handler Changes** (Lines 81-123):

```typescript
ipcMain.handle(
  'chat:send',
  async (
    event: IpcMainInvokeEvent,
    request: DesktopChatRequest,
  ): Promise<{ success: boolean; error?: string }> => {
    log.info('[IPC] chat:send called');

    if (!currentServiceParams) {
      const errorMessage = 'Chat service not initialized. Call createProvider first.';
      log.error('[IPC]', errorMessage);
      throw new Error(errorMessage);
    }

    try {
      // Get service from manager using current params
      const manager = getManager();
      const getParams: GetServiceParams = {
        appSlug: currentServiceParams.appSlug,
        provider: currentServiceParams.provider,
        model: currentServiceParams.model,
        config: {} as ProviderConfig, // Config not needed for retrieval
      };

      const chatService = manager.get(getParams);

      await chatService.chat(
        request,
        (token: string) => {
          event.sender.send('chat:token', token);
        },
        (toolName, input, notification) => {
          event.sender.send('chat:toolUse', {
            toolName,
            input,
            ...notification,
          });
        },
        (status: ToolStatus) => {
          event.sender.send('chat:toolStatus', status);
        }
      );

      // Increment call count after successful chat
      manager.incrementCallCount(
        currentServiceParams.appSlug,
        currentServiceParams.provider,
        currentServiceParams.model,
      );

      log.info('[IPC] Chat message sent successfully');
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error sending chat message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  },
);
```

**chat:getAuditLogs Handler Changes** (Lines 128-145):

```typescript
ipcMain.handle('chat:getAuditLogs', () => {
  log.info('[IPC] chat:getAuditLogs called');

  if (!currentServiceParams) {
    const errorMessage = 'Chat service not initialized. Call createProvider first.';
    log.error('[IPC]', errorMessage);
    throw new Error(errorMessage);
  }

  try {
    const manager = getManager();
    const getParams: GetServiceParams = {
      appSlug: currentServiceParams.appSlug,
      provider: currentServiceParams.provider,
      model: currentServiceParams.model,
      config: {} as ProviderConfig,
    };

    const chatService = manager.get(getParams);
    const logs = chatService.getAuditLogs();

    log.info('[IPC] Audit logs retrieved successfully');
    return logs;
  } catch (error) {
    log.error('[IPC] Error retrieving audit logs:', error);
    throw error;
  }
});
```

**chat:destroy and chat:close Handler Changes** (Lines 150-177):

```typescript
ipcMain.handle('chat:destroy', (): { success: boolean } => {
  log.info('[IPC] chat:destroy called');

  try {
    // Clear current service params
    currentServiceParams = null;
    log.info('[IPC] Current chat service reference cleared');
    return { success: true };
  } catch (error) {
    log.error('[IPC] Error destroying chat service:', error);
    throw error;
  }
});

ipcMain.handle('chat:close', (): { success: boolean } => {
  log.info('[IPC] chat:close called');

  try {
    // Clear current service params
    currentServiceParams = null;
    log.info('[IPC] Current chat service reference cleared');
    return { success: true };
  } catch (error) {
    log.error('[IPC] Error closing chat service:', error);
    throw error;
  }
});
```

**Add New Status Handler**:

```typescript
/**
 * Get Connection Manager Status - Retrieve current pool status
 */
ipcMain.handle('chat:managerStatus', () => {
  log.info('[IPC] chat:managerStatus called');

  try {
    const manager = getManager();
    const status = manager.status();
    log.info('[IPC] Manager status retrieved successfully', status);
    return status;
  } catch (error) {
    log.error('[IPC] Error retrieving manager status:', error);
    throw error;
  }
});
```

**unregisterChatHandlers Changes** (Lines 185-196):

```typescript
export function unregisterChatHandlers(): void {
  ipcMain.removeHandler('chat:createProvider');
  ipcMain.removeHandler('chat:send');
  ipcMain.removeHandler('chat:getAuditLogs');
  ipcMain.removeHandler('chat:destroy');
  ipcMain.removeHandler('chat:close');
  ipcMain.removeHandler('chat:managerStatus');

  // Clear current service params
  currentServiceParams = null;

  log.info('[IPC] Chat handlers unregistered');
}
```

### 4.4 Main Process Integration

**File**: `src-electron/main.ts`

**Add Import** (After line 7):
```typescript
import { ChatConnectionManager } from './services/chat/chat-connection-manager.js';
```

**Initialize Manager in registerIpcHandlers()** (Lines 229-263):

```typescript
function registerIpcHandlers(): void {
  // Initialize ChatConnectionManager FIRST
  const chatManager = ChatConnectionManager.getInstance({
    maxPoolSize: 10, // Configure based on system resources
  });
  chatManager.init();
  appLog.info('[Main] ChatConnectionManager initialized');

  // Register settings handlers FIRST (other services depend on settings)
  registerSettingsHandlers();

  // ... rest of the handlers
}
```

**Cleanup Manager on Shutdown** (After line 512):

```typescript
app.on('before-quit', async () => {
  appLog.info('Application exiting');

  // Close connection manager
  try {
    const manager = ChatConnectionManager.getInstance();
    await manager.close();
    appLog.info('[Main] ChatConnectionManager closed successfully');
  } catch (error) {
    appLog.error('[Main] Error closing ChatConnectionManager:', error);
  }
});
```

### 4.5 Preload API Changes (Optional)

**File**: `src-electron/preload.ts`

Add type-safe API for manager status:

```typescript
// Add to chat namespace
const electronAPI = {
  // ... existing APIs

  chat: {
    // ... existing methods

    /**
     * Get connection manager status
     */
    getManagerStatus: (): Promise<ConnectionManagerStatus> =>
      ipcRenderer.invoke('chat:managerStatus'),
  },
};
```

## 5. Configuration

### 5.1 Pool Size Configuration

**Recommended Defaults**:
- **Development**: `maxPoolSize: 0` (unlimited) for maximum flexibility
- **Production**: `maxPoolSize: 10` for typical desktop usage
- **High Memory Systems**: `maxPoolSize: 20` for power users

**Configuration Options**:

**Option 1: Environment Variable**
```typescript
// In main.ts
const maxPoolSize = process.env.CHAT_POOL_SIZE
  ? parseInt(process.env.CHAT_POOL_SIZE, 10)
  : 10;

chatManager.init({ maxPoolSize });
```

**Option 2: Settings File**
```typescript
// Add to settings service
interface AppSettings {
  // ... existing settings
  chatPoolSize?: number;
}

// In main.ts
const settings = getSettingsService();
const maxPoolSize = settings.get('chatPoolSize') ?? 10;
```

**Option 3: Hardcoded** (Simplest for MVP)
```typescript
chatManager.init({ maxPoolSize: 10 });
```

**Recommendation**: Start with Option 3 (hardcoded) for MVP, add Option 2 (settings) in future release.

## 6. Migration Path

### Phase 1: Implementation (Week 1)
1. Create `chat-connection-manager.ts` with full implementation
2. Add exports to `src-electron/services/chat/index.ts`
3. Write unit tests for ChatConnectionManager

### Phase 2: Integration (Week 1-2)
1. Update `chat-handler.ts` with new implementation
2. Add manager initialization to `main.ts`
3. Add cleanup to `app.on('before-quit')`
4. Update preload API (optional)

### Phase 3: Testing (Week 2)
1. Manual testing with single thread/branch (verify no regression)
2. Manual testing with multiple threads (verify pooling works)
3. Manual testing with pool eviction (create 11 services with maxPoolSize=10)
4. Integration tests for IPC handlers
5. Load testing (multiple concurrent chats)

### Phase 4: Deployment (Week 3)
1. Deploy to beta testers
2. Monitor logs for issues
3. Gather feedback on performance
4. Iterate on pool size configuration

## 7. Testing Strategy

### 7.1 Unit Tests

**File**: `src-electron/services/chat/__tests__/chat-connection-manager.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChatConnectionManager } from '../chat-connection-manager';

describe('ChatConnectionManager', () => {
  let manager: ChatConnectionManager;

  beforeEach(() => {
    ChatConnectionManager.resetInstance();
    manager = ChatConnectionManager.getInstance({ maxPoolSize: 2 });
    manager.init();
  });

  afterEach(async () => {
    await manager.close();
    ChatConnectionManager.resetInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = ChatConnectionManager.getInstance();
      const instance2 = ChatConnectionManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      const status = manager.status();
      expect(status.activeServices).toBe(0);
    });

    it('should warn on double initialization', () => {
      // init() called in beforeEach
      manager.init(); // Should log warning
      const status = manager.status();
      expect(status.activeServices).toBe(0);
    });
  });

  describe('Service Creation', () => {
    it('should create new service for unique tuple', () => {
      const service = manager.get({
        appSlug: 'test',
        provider: 'anthropic',
        model: 'claude-3',
        config: { model: 'claude-3', apiKey: 'test' },
      });

      expect(service).toBeDefined();
      const status = manager.status();
      expect(status.activeServices).toBe(1);
    });

    it('should reuse existing service for same tuple', () => {
      const params = {
        appSlug: 'test',
        provider: 'anthropic',
        model: 'claude-3',
        config: { model: 'claude-3', apiKey: 'test' },
      };

      const service1 = manager.get(params);
      const service2 = manager.get(params);

      expect(service1).toBe(service2);
      const status = manager.status();
      expect(status.activeServices).toBe(1);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict LRU service when pool is full', () => {
      // maxPoolSize is 2
      const service1 = manager.get({
        appSlug: 'test',
        provider: 'anthropic',
        model: 'claude-3',
        config: { model: 'claude-3', apiKey: 'test' },
      });

      const service2 = manager.get({
        appSlug: 'test',
        provider: 'openai',
        model: 'gpt-4',
        config: { model: 'gpt-4', apiKey: 'test' },
      });

      // Access service2 again to make service1 the LRU
      const service2again = manager.get({
        appSlug: 'test',
        provider: 'openai',
        model: 'gpt-4',
        config: { model: 'gpt-4', apiKey: 'test' },
      });
      expect(service2again).toBe(service2);

      // Create third service - should evict service1
      const service3 = manager.get({
        appSlug: 'test',
        provider: 'google',
        model: 'gemini-pro',
        config: { model: 'gemini-pro', apiKey: 'test' },
      });

      const status = manager.status();
      expect(status.activeServices).toBe(2);

      // Verify service1 was evicted by trying to get it again
      const service1retry = manager.get({
        appSlug: 'test',
        provider: 'anthropic',
        model: 'claude-3',
        config: { model: 'claude-3', apiKey: 'test' },
      });
      expect(service1retry).not.toBe(service1); // New instance
    });
  });

  describe('Status Reporting', () => {
    it('should report correct status with multiple services', () => {
      manager.get({
        appSlug: 'test',
        provider: 'anthropic',
        model: 'claude-3',
        config: { model: 'claude-3', apiKey: 'test' },
      });

      manager.incrementCallCount('test', 'anthropic', 'claude-3');
      manager.incrementCallCount('test', 'anthropic', 'claude-3');

      const status = manager.status();
      expect(status.activeServices).toBe(1);
      expect(status.maxPoolSize).toBe(2);
      expect(status.services[0].callCount).toBe(2);
      expect(status.services[0].lastAccessAgo).toBeLessThan(100);
    });
  });

  describe('Cleanup', () => {
    it('should clear all services on close', async () => {
      manager.get({
        appSlug: 'test',
        provider: 'anthropic',
        model: 'claude-3',
        config: { model: 'claude-3', apiKey: 'test' },
      });

      await manager.close();

      const status = manager.status();
      expect(status.activeServices).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw if get() called before init()', () => {
      ChatConnectionManager.resetInstance();
      const uninitializedManager = ChatConnectionManager.getInstance();

      expect(() => {
        uninitializedManager.get({
          appSlug: 'test',
          provider: 'anthropic',
          model: 'claude-3',
          config: { model: 'claude-3', apiKey: 'test' },
        });
      }).toThrow('ChatConnectionManager not initialized');
    });
  });
});
```

### 7.2 Integration Tests

**File**: `src-electron/ipc-handlers/__tests__/chat-handler.integration.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChatConnectionManager } from '../../services/chat/chat-connection-manager';
// Mock IPC and test handler behavior

describe('Chat Handler Integration', () => {
  beforeEach(() => {
    // Initialize manager
    const manager = ChatConnectionManager.getInstance({ maxPoolSize: 10 });
    manager.init();
  });

  afterEach(async () => {
    const manager = ChatConnectionManager.getInstance();
    await manager.close();
    ChatConnectionManager.resetInstance();
  });

  it('should create provider and retrieve service from manager', async () => {
    // Test createProvider IPC handler
    // Verify service is added to manager pool
  });

  it('should reuse service for same provider/model', async () => {
    // Call createProvider twice with same params
    // Verify same service instance is used
  });

  it('should handle multiple concurrent chat sessions', async () => {
    // Create multiple providers
    // Send concurrent chat requests
    // Verify all complete successfully
  });
});
```

### 7.3 Manual Testing Checklist

- [ ] Single thread, single branch - no regression
- [ ] Single thread, multiple branches - verify pooling
- [ ] Multiple threads, single branch each - verify isolation
- [ ] Multiple threads, multiple branches - stress test
- [ ] Create 11 services with maxPoolSize=10 - verify LRU eviction
- [ ] Switch between models - verify reuse
- [ ] Close app - verify cleanup in logs
- [ ] Restart app - verify initialization
- [ ] Check memory usage with 10 active services
- [ ] Verify logs show service creation, reuse, and eviction

## 8. Performance Considerations

### 8.1 Memory Usage

**Current State** (Single Service):
- 1 DesktopChatService: ~40-50MB
- 1 ToolOrchestrator: ~5-10MB
- Total: ~50-60MB

**With Connection Manager** (10 Services):
- 10 DesktopChatService: ~400-500MB
- 10 ToolOrchestrator: ~50-100MB
- Manager overhead: ~1MB
- Total: ~450-600MB

**Recommendation**:
- For systems with 8GB RAM: maxPoolSize = 5
- For systems with 16GB+ RAM: maxPoolSize = 10

### 8.2 Lookup Performance

- Map lookup: O(1) - negligible overhead
- Service creation: 10-20ms (unchanged from current)
- Service reuse: < 1ms

### 8.3 Concurrency

- Electron main process is single-threaded (Node.js event loop)
- No race conditions between service accesses
- ToolOrchestrator already supports per-execution context (see tool-orchestrator-design.md)

## 9. Security Considerations

### 9.1 Isolation

- Each service maintains separate ChatService instance
- Tool orchestrator context isolation (per tool-orchestrator-design.md)
- Working directory isolation per chat session

### 9.2 Resource Limits

- Pool size limit prevents memory exhaustion
- LRU eviction prevents unbounded growth
- No persistent state between app restarts

### 9.3 API Keys

- API keys stored per-service in ProviderConfig
- Keys not shared between services
- Keys injected from AuthService on createProvider

## 10. Logging and Monitoring

### 10.1 Log Events

| Event | Level | Message |
|-------|-------|---------|
| Manager init | INFO | `[ChatConnectionManager] Initializing { maxPoolSize }` |
| Service created | INFO | `[ChatConnectionManager] Creating new service { key }` |
| Service reused | DEBUG | `[ChatConnectionManager] Reusing existing service { key }` |
| LRU eviction | INFO | `[ChatConnectionManager] Evicting LRU service { key, lastAccessAgo }` |
| Manager close | INFO | `[ChatConnectionManager] Closing all services { serviceCount }` |

### 10.2 Status Monitoring

Add IPC handler for status monitoring (already included in design):

```typescript
// In renderer
const status = await window.electronAPI.chat.getManagerStatus();
console.log('Active services:', status.activeServices);
console.log('Services:', status.services);
```

**UI Integration** (Future):
- Add developer tools panel showing active services
- Show service key, last access time, call count
- Add manual eviction button for debugging

## 11. Future Enhancements

### 11.1 Service Health Monitoring

```typescript
interface ServiceEntry {
  service: DesktopChatService;
  lastAccess: number;
  callCount: number;
  errorCount: number;      // NEW
  lastError?: Error;       // NEW
  createdAt: number;       // NEW
}
```

### 11.2 Automatic Cleanup

```typescript
// Evict services idle for > 30 minutes
setInterval(() => {
  const now = Date.now();
  const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  for (const [key, entry] of this.pool.entries()) {
    if (now - entry.lastAccess > IDLE_TIMEOUT) {
      log.info('[ChatConnectionManager] Evicting idle service', { key });
      this.pool.delete(key);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes
```

### 11.3 Service Metrics

```typescript
interface ServiceMetrics {
  averageResponseTime: number;
  totalTokens: number;
  totalCost: number;
  successRate: number;
}
```

### 11.4 Dynamic Pool Sizing

```typescript
// Adjust pool size based on system memory
const totalMem = os.totalmem();
const freeMem = os.freemem();
const memoryPressure = 1 - (freeMem / totalMem);

if (memoryPressure > 0.8) {
  // Reduce pool size under memory pressure
  this.config.maxPoolSize = Math.max(1, Math.floor(this.config.maxPoolSize / 2));
}
```

### 11.5 Pre-warming

```typescript
// Pre-create services for common providers on startup
public prewarm(providers: Array<{ provider: string; model: string }>): void {
  for (const { provider, model } of providers) {
    this.get({
      appSlug: 'desktop',
      provider,
      model,
      config: { model, apiKey: '' }, // Will be injected later
    });
  }
}
```

## 12. Implementation Checklist

### Code Changes
- [ ] Create `chat-connection-manager.ts`
- [ ] Update `src-electron/services/chat/index.ts` exports
- [ ] Update `chat-handler.ts` with manager integration
- [ ] Update `main.ts` with manager initialization
- [ ] Update `main.ts` with manager cleanup on shutdown
- [ ] Update preload API (optional)

### Testing
- [ ] Write unit tests for ChatConnectionManager
- [ ] Write integration tests for chat-handler
- [ ] Manual testing checklist completed
- [ ] Load testing with 10 concurrent chats
- [ ] Memory profiling with full pool

### Documentation
- [ ] Update API documentation
- [ ] Update architecture diagrams
- [ ] Add troubleshooting guide
- [ ] Add performance tuning guide

### Deployment
- [ ] Code review
- [ ] Merge to main branch
- [ ] Deploy to beta
- [ ] Monitor logs for issues
- [ ] Gather user feedback

## 13. Rollback Plan

If critical issues are discovered:

1. **Immediate Rollback**:
   - Revert `chat-handler.ts` changes
   - Remove manager initialization from `main.ts`
   - Restore single `chatService` variable

2. **Partial Rollback**:
   - Set `maxPoolSize: 1` to disable pooling
   - Keeps infrastructure in place for debugging

3. **Investigation**:
   - Review logs for error patterns
   - Check memory usage
   - Verify service isolation

## 14. Success Criteria

The implementation will be considered successful when:

1. **Functional Requirements Met**:
   - Multiple concurrent chats work without errors
   - Services are properly pooled and reused
   - LRU eviction works when pool is full
   - Clean startup and shutdown

2. **Performance Requirements Met**:
   - Service retrieval < 10ms
   - Memory overhead < 600MB for 10 services
   - No performance regression for single chat

3. **Quality Requirements Met**:
   - All unit tests pass
   - All integration tests pass
   - Manual testing checklist completed
   - No critical bugs in beta testing

4. **User Experience**:
   - No user-facing changes (transparent upgrade)
   - Improved responsiveness with multiple branches
   - No chat failures or data loss

## Appendix A: Related Documents

- `tool-orchestrator-design.md` - Tool orchestrator refactoring (context isolation)
- `issue-56.md` - Content Security Policy implementation
- `chat-connection-manager.md` - Original requirements

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Service Tuple** | (appSlug, provider, model) unique identifier for a chat service |
| **Pool** | Collection of managed DesktopChatService instances |
| **LRU** | Least Recently Used - eviction strategy for full pool |
| **Working Directory** | Directory context for file operations in tools |
| **ToolOrchestrator** | Manages tool definitions and execution |
| **IPC** | Inter-Process Communication between renderer and main |

## Appendix C: API Summary

### ChatConnectionManager API

```typescript
// Singleton access
static getInstance(config?: Partial<ChatConnectionManagerConfig>): ChatConnectionManager

// Lifecycle
init(): void
close(): Promise<void>

// Service management
get(params: GetServiceParams): DesktopChatService
incrementCallCount(appSlug: string, provider: string, model: string): void

// Monitoring
status(): ConnectionManagerStatus
```

### IPC Handler Changes

```typescript
// Updated signatures
'chat:createProvider': (providerType, config, appSlug?) => { success, error? }
'chat:send': (request) => { success, error? }
'chat:getAuditLogs': () => logs
'chat:destroy': () => { success }
'chat:close': () => { success }

// New handler
'chat:managerStatus': () => ConnectionManagerStatus
```

---

**Document Version**: 1.0
**Last Updated**: 2026-01-22
**Author**: Claude Sonnet 4.5
**Status**: Ready for Implementation

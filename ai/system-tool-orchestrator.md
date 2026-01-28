# Tool Orchestrator Refactoring Design

## Overview

This document describes the refactoring of the Tool Orchestrator to support multi-threaded chat sessions by converting it to a singleton pattern and externalizing context data.

---

## Current Architecture Limitations

### Problem Statement

The current architecture creates a **new ToolOrchestrator instance per chat session**:

```typescript
// chat-handler.ts
const toolOrchestrator = new ToolOrchestrator(undefined, allowedPaths);
chatService = new DesktopChatService(providerType, newConfig, toolOrchestrator);
```

**Limitations:**

1. **Single Session Only**: One global `chatService` variable means only one active chat session
2. **Instance-Level Context**: Working directory is tied to orchestrator instance
3. **Redundant Initialization**: Each session recreates all 8 tools unnecessarily
4. **Memory Overhead**: Multiple orchestrators if supporting multiple threads
5. **Context Confusion**: Each thread's working directory overwrites the previous

### Current Context Flow

```
Chat Message (Thread A, working_dir: /project-a)
    ↓
DesktopChatService.chat()
    ↓
Sets orchestrator.setWorkingDirectory('/project-a')
    ↓
Tool executes with /project-a context
```

**Problem**: If Thread B sends a message while Thread A is still processing:
- Thread B's working directory overwrites Thread A's
- Thread A's tool operations use wrong context
- Race condition on shared state

---

## Requirements

### Functional Requirements

1. **FR-1**: Single ToolOrchestrator instance shared across all chat sessions
2. **FR-2**: Support concurrent chat sessions with isolated contexts
3. **FR-3**: Each tool execution receives context for that specific operation
4. **FR-4**: Maintain security (blacklist/whitelist) across all sessions
5. **FR-5**: Preserve existing tool functionality and API
6. **FR-6**: Support dynamic working directory per tool execution

### Non-Functional Requirements

1. **NFR-1**: No breaking changes to tool interface
2. **NFR-2**: Thread-safe context management
3. **NFR-3**: Minimal memory overhead
4. **NFR-4**: Backward compatible with existing tools

---

## Proposed Architecture

### Design Principles

1. **Singleton Pattern**: One orchestrator instance for application lifetime
2. **Context Externalization**: Pass context per tool execution, not per session
3. **Immutable Security State**: Blacklist/whitelist set once at startup
4. **Stateless Tools**: Tools remain stateless, receive all context on execution

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Main Process                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         ToolOrchestrator (Singleton)                    │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  FileToolsService (NO working directory state)   │  │ │
│  │  │  - blacklistedPaths (static)                     │  │ │
│  │  │  - allowedPaths (static)                         │  │ │
│  │  │  - maxFileSize (constant)                        │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │  - tools: Map<string, ITool> (static, initialized once)│ │
│  └────────────────────────────────────────────────────────┘ │
│                            ▲                                 │
│                            │ getInstance()                   │
│                            │                                 │
│  ┌─────────────────────┐  │  ┌─────────────────────┐        │
│  │ DesktopChatService  │──┘  │ DesktopChatService  │        │
│  │    (Thread A)       │     │    (Thread B)       │        │
│  │  - threadContext    │     │  - threadContext    │        │
│  └─────────────────────┘     └─────────────────────┘        │
│           │                            │                     │
│           └────────┬───────────────────┘                     │
│                    │ executeTool(name, input, context)       │
│                    ▼                                         │
│         ┌─────────────────────┐                             │
│         │   Tool Execution    │                             │
│         │  (with context)     │                             │
│         └─────────────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Detailed Design Changes

### 1. ToolOrchestrator - Singleton Pattern

**File**: `src-electron/services/tool-calling/orchestrator.ts`

#### Changes

```typescript
/**
 * Singleton Tool Orchestrator
 * Manages all tool execution with per-request context
 */
export class ToolOrchestrator implements ToolOrchestra {
  private static instance: ToolOrchestrator | null = null;
  private fileToolsService: FileToolsService;
  private tools: Map<string, ITool>;

  /**
   * Private constructor - use getInstance()
   */
  private constructor(allowedPaths?: string[]) {
    log.info('[ToolOrchestrator] Initializing singleton');

    // FileToolsService now manages only security state
    this.fileToolsService = new FileToolsService(allowedPaths);

    // Initialize tools once
    this.tools = new Map();
    const context = { service: this.fileToolsService };
    for (const factory of TOOL_FACTORIES) {
      const tool = factory(context);
      this.tools.set(tool.getName(), tool);
    }

    log.info(`[ToolOrchestrator] Initialized tools (${this.tools.size}):`,
             Array.from(this.tools.keys()).join(', '));
  }

  /**
   * Get singleton instance
   * @param allowedPaths - Only used on first initialization
   */
  public static getInstance(allowedPaths?: string[]): ToolOrchestrator {
    if (!ToolOrchestrator.instance) {
      ToolOrchestrator.instance = new ToolOrchestrator(allowedPaths);
    }
    return ToolOrchestrator.instance;
  }

  /**
   * Reset singleton (for testing only)
   */
  public static resetInstance(): void {
    ToolOrchestrator.instance = null;
  }

  /**
   * Execute tool with provided execution context
   * @param name - Tool name
   * @param input - Tool input parameters
   * @param executionContext - Context for this execution (working directory, etc.)
   */
  async executeTool(
    name: string,
    input: Record<string, unknown>,
    executionContext: ToolExecutionContext
  ): Promise<ToolResult> {
    log.info('[ToolOrchestrator] Executing tool:', name,
             'with context:', JSON.stringify(executionContext));

    const tool = this.tools.get(name);
    if (!tool) {
      const error = `Unknown tool: ${name}`;
      log.error('[ToolOrchestrator]', error);
      return { success: false, error };
    }

    // Execute tool with context
    return await tool.execute(input, executionContext);
  }

  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => tool.getDefinition());
  }

  supportsToolCalling(provider: string, model: string): boolean {
    // Same logic as before
    if (provider.toLowerCase() === 'ollama') {
      const toolSupportedModels = ['qwen2.5:7b'];
      return toolSupportedModels.some(supportedModel =>
        model.toLowerCase().includes(supportedModel.toLowerCase())
      );
    }
    return true;
  }

  /**
   * Update allowed paths (affects all future tool executions)
   */
  setAllowedPaths(paths: string[]): void {
    this.fileToolsService.setAllowedPaths(paths);
  }

  getAllowedPaths(): string[] {
    return this.fileToolsService.getAllowedPaths();
  }

  // Remove methods that no longer make sense:
  // - setWorkingDirectory() - now per-execution
  // - getWorkingDirectory() - now per-execution
  // - setStatusCallback() - move to DesktopChatService
}
```

---

### 2. ToolExecutionContext - New Type

**File**: `src-electron/services/tool-calling/orchestrator-types.ts`

#### New Interface

```typescript
/**
 * Context provided for each tool execution
 * Isolated per thread/message
 */
export interface ToolExecutionContext {
  /**
   * Working directory for this execution
   * Used to resolve relative paths
   */
  workingDirectory: string;

  /**
   * Thread ID for this execution (required)
   */
  threadId: string;

  /**
   * Branch ID for this execution (required)
   */
  branchId: string;

  /**
   * Status callback for this execution (optional)
   * Called for progress updates
   */
  statusCallback?: ToolStatusCallback;
}
```

#### Updated Interface

```typescript
/**
 * Tool orchestra interface - provides tool definitions and execution
 */
export interface ToolOrchestra {
  /**
   * Get all available tool definitions
   */
  getToolDefinitions(): ToolDefinition[];

  /**
   * Execute a tool by name with input parameters and execution context
   * @param name - Tool name
   * @param input - Tool input parameters
   * @param context - Execution context (working directory, callbacks, etc.)
   */
  executeTool(
    name: string,
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult>;

  /**
   * Determines if a provider/model combination supports tool calling
   */
  supportsToolCalling(provider: string, model: string): boolean;

  /**
   * Update allowed paths (global setting)
   */
  setAllowedPaths(paths: string[]): void;

  /**
   * Get current allowed paths
   */
  getAllowedPaths(): string[];
}
```

---

### 3. FileToolsService - Remove State

**File**: `src-electron/services/tool-calling/file-tools.service.ts`

#### Changes

```typescript
/**
 * File Tools Service
 * Provides security and utility methods for file operations
 * NO LONGER STORES WORKING DIRECTORY STATE
 */
export class FileToolsService {
  private blacklistedPaths: Set<string>;
  private allowedPaths: Set<string>;
  private readonly maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private readonly maxFolderFiles: number = 1000;

  // REMOVED: private workingDirectory: string;
  // REMOVED: private statusCallback: ToolStatusCallback | null = null;

  constructor(allowedPaths?: string[]) {
    this.blacklistedPaths = this.initializeBlacklist();
    this.allowedPaths = new Set((allowedPaths || []).map((p) =>
      path.normalize(path.resolve(p))
    ));

    log.info('[FileToolsService] Initialized', JSON.stringify({
      blacklistedPathsCount: this.blacklistedPaths.size,
      allowedPathsCount: this.allowedPaths.size,
      allowedPaths: Array.from(this.allowedPaths),
    }));
  }

  /**
   * Resolve path relative to provided working directory
   * @param userPath - User-provided path (relative or absolute)
   * @param workingDirectory - Context working directory
   */
  public resolvePath(userPath: string, workingDirectory: string): string {
    let resolved = userPath;

    // Expand home directory
    if (resolved.startsWith('~')) {
      const homedir = os.homedir();
      resolved = path.join(homedir, resolved.slice(1));
    }

    // Resolve relative paths against working directory
    if (!path.isAbsolute(resolved)) {
      resolved = path.resolve(workingDirectory, resolved);
    }

    return path.normalize(resolved);
  }

  /**
   * Check if path is allowed (security check)
   */
  public checkPathAccess(resolvedPath: string): PathAccessResult {
    // Same logic, but no longer uses instance workingDirectory
    const normalized = path.normalize(resolvedPath);

    // Check blacklist
    for (const blacklisted of this.blacklistedPaths) {
      if (normalized.startsWith(blacklisted)) {
        return { allowed: false, reason: 'blacklist' };
      }
    }

    // Check whitelist if configured
    if (this.allowedPaths.size > 0) {
      let isAllowed = false;
      for (const allowed of this.allowedPaths) {
        if (normalized.startsWith(allowed)) {
          isAllowed = true;
          break;
        }
      }
      if (!isAllowed) {
        return { allowed: false, reason: 'whitelist' };
      }
    }

    return { allowed: true };
  }

  // REMOVED: setWorkingDirectory()
  // REMOVED: getWorkingDirectory()
  // REMOVED: setStatusCallback()
  // REMOVED: emitStatus() - move to tool execution layer

  // Keep security and utility methods:
  // - initializeBlacklist()
  // - setAllowedPaths()
  // - getAllowedPaths()
  // - getMaxFileSize()
  // - isTextFile()
  // etc.
}
```

---

### 4. ITool Interface - Add Context Parameter

**File**: `src-electron/services/tool-calling/tools/base-tool.ts`

#### Updated Interface

```typescript
/**
 * Base interface that all tools must implement
 */
export interface ITool {
  /**
   * Get the tool's name
   */
  getName(): string;

  /**
   * Get the tool's definition for LLM
   */
  getDefinition(): ToolDefinition;

  /**
   * Execute the tool with given input and execution context
   * @param input - Tool-specific input parameters
   * @param context - Execution context (working directory, callbacks, etc.)
   */
  execute(
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult>;
}
```

#### Updated ToolContext

```typescript
/**
 * Tool execution context - dependencies passed to tool factories
 * Tools are initialized once and reused
 */
export interface ToolContext {
  /**
   * Reference to FileToolsService for security checks and utilities
   */
  service: FileToolsService;
}
```

---

### 5. Tool Implementation Updates

**Example**: `src-electron/services/tool-calling/tools/file-read.tool.ts`

#### Changes

```typescript
export class FileReadTool implements ITool {
  constructor(private context: ToolContext) {}

  getName(): string {
    return 'read_file';
  }

  getDefinition(): ToolDefinition {
    // Same as before
  }

  async execute(
    params: Record<string, unknown>,
    executionContext: ToolExecutionContext  // NEW PARAMETER
  ): Promise<ToolResult> {
    const userPath = params.file_path as string;

    // Use executionContext.workingDirectory instead of service's state
    const resolvedPath = this.context.service.resolvePath(
      userPath,
      executionContext.workingDirectory  // Context-specific!
    );

    // Security check (uses service's global allowed/blacklisted paths)
    const pathCheck = this.context.service.checkPathAccess(resolvedPath);
    if (!pathCheck.allowed) {
      return {
        success: false,
        error: pathCheck.reason === 'blacklist'
          ? `The file ${userPath} is in a folder I cannot access.`
          : `I cannot read file ${userPath}. To allow this, add to settings.`,
      };
    }

    // Emit status using executionContext callback (if provided)
    if (executionContext.statusCallback) {
      executionContext.statusCallback({
        toolName: 'read_file',
        state: 'in_progress',
        message: `Reading file: ${userPath}`,
      });
    }

    // Execute file read operation
    // ... (same logic as before)

    // Emit completion status
    if (executionContext.statusCallback) {
      executionContext.statusCallback({
        toolName: 'read_file',
        state: 'complete',
      });
    }

    return result;
  }
}
```

**Key Changes:**
1. Added `executionContext` parameter to `execute()`
2. Use `executionContext.workingDirectory` for path resolution
3. Use `executionContext.statusCallback` for progress updates
4. Security checks still use service's global allowed/blacklisted paths

**Similar changes needed for:**
- `folder-read.tool.ts`
- `file-write.tool.ts`
- `windows-shell.tool.ts`
- `unix-shell.tool.ts`
- `read-word.tool.ts`
- `read-excel.tool.ts`
- `read-pdf.tool.ts`

---

### 6. DesktopChatService - Use Singleton

**File**: `src-electron/services/chat/desktop-chat-service.ts`

#### Changes

```typescript
/**
 * Desktop wrapper around ChatService from @holokai/chat-component
 * Handles desktop-specific concerns like thread tracking and tool orchestration
 */
export class DesktopChatService {
  private chatService: ChatService;
  private toolOrchestra: ToolOrchestra;
  private providerType: string;
  private model: string;

  // NEW: Thread-specific context
  private threadContext: ToolExecutionContext;

  constructor(
    providerType: string,
    config: ProviderConfig,
    workingDirectory?: string  // NEW: Per-service working directory
  ) {
    this.providerType = providerType;
    this.model = config.model;

    // Get singleton orchestrator
    this.toolOrchestra = ToolOrchestrator.getInstance();

    // Initialize thread context
    this.threadContext = {
      workingDirectory: workingDirectory || process.cwd(),
    };

    log.info('[DesktopChatService] Initializing', {
      provider: providerType,
      model: config.model,
      workingDirectory: this.threadContext.workingDirectory,
    });

    // Check tool support
    const canUseTools = this.toolOrchestra.supportsToolCalling(
      providerType,
      config.model
    );

    // Get tool definitions and create execution adapter
    const tools = canUseTools ? this.toolOrchestra.getToolDefinitions() : undefined;
    const onToolUse = canUseTools
      ? async (toolUse: ChatComponentToolUse) => {
          // Execute with this service's context
          return await this.toolOrchestra.executeTool(
            toolUse.name,
            toolUse.input,
            this.threadContext  // Pass thread context!
          );
        }
      : undefined;

    this.chatService = new ChatService(
      providerType,
      config,
      true,
      tools,
      onToolUse
    );
  }

  /**
   * Send chat message with desktop-specific request handling
   */
  async chat(
    request: DesktopChatRequest,
    onToken: (token: string) => void,
    onToolUse?: ToolUseCallback,
    onToolStatus?: ToolStatusCallback
  ): Promise<void> {
    const { thread_guid, branch_id, working_directory, ...chatRequest } = request;

    log.info('[DesktopChatService] chat called', {
      thread_guid,
      branch_id,
      messageCount: request.messages.length,
      working_directory,
    });

    // Update thread context for this message
    if (working_directory) {
      this.threadContext.workingDirectory = working_directory;
    }

    // Set context metadata for logging
    this.threadContext.threadId = thread_guid;
    this.threadContext.branchId = branch_id;

    // Set status callback for this message
    this.threadContext.statusCallback = onToolStatus || null;

    try {
      const thread_id = formatThreadId(thread_guid, branch_id);

      await this.chatService.chat({
        ...chatRequest,
        streaming: false,
        ...(thread_id && { thread_id })
      }, onToken);
    } finally {
      // Clear status callback after message completes
      this.threadContext.statusCallback = null;
    }
  }

  /**
   * Update working directory for this chat service instance
   */
  setWorkingDirectory(directory: string): void {
    log.info('[DesktopChatService] Setting working directory:', directory);
    this.threadContext.workingDirectory = directory;
  }

  getWorkingDirectory(): string {
    return this.threadContext.workingDirectory;
  }

  getAuditLogs(): any[] {
    return this.chatService.getAuditLogs();
  }
}
```

---

### 7. IPC Handler Updates

**File**: `src-electron/ipc-handlers/chat-handler.ts`

#### Changes

```typescript
// REMOVED: Global singleton chatService variable
// NEW: Map of chat services per thread
const chatServices: Map<string, DesktopChatService> = new Map();

/**
 * Register all chat IPC handlers
 */
export function registerChatHandlers(auth?: AuthService): void {
  if (auth) {
    authService = auth;
  }

  // Initialize ToolOrchestrator singleton once at startup
  const settingsService = getSettingsService();
  const allowedPaths = settingsService.getDirectoryWhitelist();
  ToolOrchestrator.getInstance(allowedPaths);

  /**
   * Create Chat Provider - Initialize ChatService for a thread
   */
  ipcMain.handle(
    'chat:createProvider',
    async (
      _event,
      threadId: string,  // NEW: Identify which thread
      providerType: string,
      config: ProviderConfig,
      workingDirectory?: string  // NEW: Thread's working directory
    ): Promise<{ success: boolean; error?: string }> => {
      log.info('[IPC] chat:createProvider called', {
        threadId,
        providerType,
        workingDirectory
      });

      try {
        // Inject access token
        if (authService) {
          try {
            const accessToken = await authService.getAccessToken();
            config.apiKey = accessToken;
          } catch (error) {
            log.warn('[IPC] Could not get access token:', error);
          }
        }

        // Remap URL
        const newConfig: ProviderConfig = {
          url: (config as any).url || '',
          apiKey: config.apiKey || '',
          model: config.model
        };

        // Create DesktopChatService for this thread
        const chatService = new DesktopChatService(
          providerType,
          newConfig,
          workingDirectory  // Thread-specific working directory
        );

        // Store in map
        chatServices.set(threadId, chatService);

        log.info('[IPC] DesktopChatService created for thread:', threadId);
        return { success: true };
      } catch (error) {
        log.error('[IPC] Error creating chat provider:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },
  );

  /**
   * Send Chat Message - Send message for a specific thread
   */
  ipcMain.handle(
    'chat:send',
    async (
      event: IpcMainInvokeEvent,
      threadId: string,  // NEW: Identify which thread
      request: DesktopChatRequest,
    ): Promise<{ success: boolean; error?: string }> => {
      log.info('[IPC] chat:send called for thread:', threadId);

      const chatService = chatServices.get(threadId);
      if (!chatService) {
        const errorMessage = `Chat service not initialized for thread: ${threadId}`;
        log.error('[IPC]', errorMessage);
        throw new Error(errorMessage);
      }

      try {
        await chatService.chat(
          request,
          (token: string) => {
            event.sender.send('chat:token', { threadId, token });
          },
          (toolName, input, notification) => {
            event.sender.send('chat:toolUse', {
              threadId,
              toolName,
              input,
              ...notification
            });
          },
          (status: ToolStatus) => {
            event.sender.send('chat:toolStatus', { threadId, ...status });
          }
        );
        return { success: true };
      } catch (error) {
        log.error('[IPC] Error sending chat message:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },
  );

  /**
   * Destroy Chat Service - Clean up when thread is closed
   */
  ipcMain.handle(
    'chat:destroyProvider',
    async (_event, threadId: string): Promise<{ success: boolean }> => {
      log.info('[IPC] chat:destroyProvider called for thread:', threadId);
      chatServices.delete(threadId);
      return { success: true };
    }
  );

  // Update settings handler to refresh orchestrator's allowed paths
  ipcMain.handle(
    'chat:updateAllowedPaths',
    async (_event, allowedPaths: string[]): Promise<{ success: boolean }> => {
      log.info('[IPC] chat:updateAllowedPaths called');
      const orchestrator = ToolOrchestrator.getInstance();
      orchestrator.setAllowedPaths(allowedPaths);
      return { success: true };
    }
  );
}
```

---

## Migration Path

### Phase 1: Add Context Parameter (Backward Compatible)

1. Update `ITool.execute()` signature to accept optional context:
   ```typescript
   execute(input: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolResult>
   ```

2. Update all tool implementations to accept context parameter (default to service state if not provided)

3. Update `ToolOrchestra.executeTool()` to accept optional context

4. Test with existing code (context not provided)

### Phase 2: Implement Singleton

1. Add `getInstance()` static method to `ToolOrchestrator`
2. Make constructor private
3. Update initialization in `chat-handler.ts` to use singleton
4. Test with single thread

### Phase 3: Externalize Context

1. Remove `workingDirectory` state from `FileToolsService`
2. Update `resolvePath()` to require working directory parameter
3. Update all tools to require context parameter
4. Test with single thread

### Phase 4: Multi-Thread Support

1. Update IPC handlers to support thread-specific chat services
2. Create `Map<threadId, DesktopChatService>`
3. Update renderer to pass thread ID in IPC calls
4. Test with multiple threads

---

## Impact Analysis

### Components Affected

| Component | Impact | Effort |
|-----------|--------|--------|
| `orchestrator.ts` | Major - Singleton pattern | High |
| `file-tools.service.ts` | Major - Remove state | High |
| All 8 tool implementations | Medium - Add context parameter | Medium |
| `base-tool.ts` | Low - Update interface | Low |
| `desktop-chat-service.ts` | Medium - Use singleton | Medium |
| `chat-handler.ts` | Major - Multi-service management | High |
| `orchestrator-types.ts` | Low - Add new types | Low |

### Breaking Changes

1. **Tool Interface**: All tools must update `execute()` signature
2. **IPC Protocol**: Renderer must pass thread ID in chat:send
3. **Orchestrator API**: Remove instance-level working directory methods

### Backward Compatibility

- Phase 1 approach maintains compatibility during migration
- Existing tools work with default context
- Gradual rollout possible

---

## Testing Strategy

### Unit Tests

1. **ToolOrchestrator Singleton**
   - Test getInstance() returns same instance
   - Test thread-safety of initialization
   - Test resetInstance() for test isolation

2. **Tool Execution with Context**
   - Test each tool with different working directories
   - Test concurrent tool executions with different contexts
   - Test security checks with various paths

3. **FileToolsService**
   - Test resolvePath() with various working directories
   - Test checkPathAccess() remains consistent
   - Test blacklist/whitelist behavior

### Integration Tests

1. **Multi-Thread Scenarios**
   - Create 2+ chat services with different working directories
   - Execute tools concurrently from different threads
   - Verify context isolation

2. **IPC Handler Tests**
   - Test createProvider for multiple threads
   - Test chat:send for concurrent threads
   - Test destroyProvider cleanup

### E2E Tests

1. **User Workflow**
   - Open multiple threads
   - Send messages with tool use in each
   - Verify correct file operations per thread
   - Verify no cross-contamination

---

## Performance Considerations

### Memory

**Before**: N orchestrators × 8 tools = N × tool_size
**After**: 1 orchestrator × 8 tools = constant

**Savings**: For 10 threads, ~90% reduction in tool-related memory

### Initialization

**Before**: Tool initialization on every chat session creation (~10ms × N sessions)
**After**: One-time initialization at startup (~10ms total)

**Improvement**: O(N) → O(1) initialization cost

### Execution Overhead

**Added**: Context object creation per tool call (~1μs)
**Minimal**: Context is lightweight struct, no cloning required

---

## Security Considerations

### Global Security State

- Blacklist/whitelist remain global (intended behavior)
- All threads share same security boundaries
- Updating allowed paths affects all threads immediately

### Context Validation

```typescript
// Validate working directory is within allowed paths
function validateContext(context: ToolExecutionContext): boolean {
  const orchestrator = ToolOrchestrator.getInstance();
  const allowedPaths = orchestrator.getAllowedPaths();

  if (allowedPaths.length === 0) return true;

  return allowedPaths.some(allowed =>
    context.workingDirectory.startsWith(allowed)
  );
}
```

### Path Traversal Prevention

- Maintain existing path resolution and normalization
- Security checks use fully resolved absolute paths
- Relative path resolution always within working directory

---

## Future Enhancements

### 1. Context Pooling

If context objects become heavy:
```typescript
class ToolExecutionContextPool {
  private pool: ToolExecutionContext[] = [];

  acquire(workingDirectory: string): ToolExecutionContext {
    return this.pool.pop() || { workingDirectory };
  }

  release(context: ToolExecutionContext): void {
    this.pool.push(context);
  }
}
```

### 2. Tool Metrics

Add per-thread metrics to context:
```typescript
interface ToolExecutionContext {
  workingDirectory: string;
  threadId?: string;
  branchId?: string;
  statusCallback?: ToolStatusCallback;
  metrics?: {
    startTime: number;
    threadName: string;
  };
}
```

### 3. Tool Versioning

Support multiple tool versions:
```typescript
class ToolOrchestrator {
  private tools: Map<string, Map<string, ITool>>; // name -> version -> tool

  executeTool(
    name: string,
    input: Record<string, unknown>,
    context: ToolExecutionContext,
    version: string = 'latest'
  ): Promise<ToolResult>
}
```

---

## Conclusion

This refactoring enables **true multi-threaded chat support** by:

1. **Eliminating shared state** between chat sessions
2. **Reducing memory overhead** through singleton pattern
3. **Improving performance** by initializing tools once
4. **Maintaining security** through global access controls
5. **Enabling scalability** for concurrent thread operations

The phased migration approach ensures **minimal disruption** to existing functionality while providing a clear path to multi-thread support.

---

## Appendix: Code Checklist

### Files to Modify

- [ ] `src-electron/services/tool-calling/orchestrator.ts`
- [ ] `src-electron/services/tool-calling/file-tools.service.ts`
- [ ] `src-electron/services/tool-calling/orchestrator-types.ts`
- [ ] `src-electron/services/tool-calling/tools/base-tool.ts`
- [ ] `src-electron/services/tool-calling/tools/file-read.tool.ts`
- [ ] `src-electron/services/tool-calling/tools/folder-read.tool.ts`
- [ ] `src-electron/services/tool-calling/tools/file-write.tool.ts`
- [ ] `src-electron/services/tool-calling/tools/windows-shell.tool.ts`
- [ ] `src-electron/services/tool-calling/tools/unix-shell.tool.ts`
- [ ] `src-electron/services/tool-calling/tools/read-word.tool.ts`
- [ ] `src-electron/services/tool-calling/tools/read-excel.tool.ts`
- [ ] `src-electron/services/tool-calling/tools/read-pdf.tool.ts`
- [ ] `src-electron/services/chat/desktop-chat-service.ts`
- [ ] `src-electron/ipc-handlers/chat-handler.ts`

### Tests to Create

- [ ] Unit: `orchestrator.spec.ts` - Singleton pattern
- [ ] Unit: `file-tools.service.spec.ts` - Context-aware path resolution
- [ ] Unit: `file-read.tool.spec.ts` - Context parameter
- [ ] Integration: `multi-thread-tools.spec.ts` - Concurrent execution
- [ ] E2E: `multi-thread-chat.spec.ts` - Full workflow

---

**Document Version**: 1.0
**Author**: Claude Sonnet 4.5
**Date**: 2026-01-22
**Status**: Draft for Review

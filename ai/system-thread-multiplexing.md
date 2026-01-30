# Stream Thread Multiplexing

The UI creates individual chat streams in the backend and then subscribes to the active one to receive events needed to update the UI. 
The UI can create and subscribe to multiple chat streams in the case of a model or prompt branch, where moire than 1 prompt could be running. 
The chat service is connected to the thread repository which updates and maintains all message data. 
The thread repository also emits event updates for the ones the UI has subscribed to. 
A thread that is active but not being viewed in the UI is updated in the thread-repository. 
When the UI switches from one thread to another, the UI stops listening for the first thread and listens to the new one. 
To assist the UI in initializing UI component status, the Backend indicates if a thread has a streaming branch (so UI controls and status can be shown.) 

## Requirements

### Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-1 | Support multiple concurrent chat streams across different threads |
| FR-2 | Support branching: same prompt to up to 9 models simultaneously within one thread |
| FR-3 | UI subscribes to specific branches; only subscribed branches receive real-time IPC updates |
| FR-4 | Background streams (unsubscribed) continue executing without IPC emission |
| FR-5 | All streams write to ThreadRepository regardless of subscription state |
| FR-6 | UI can Cancel individual branches or all branches in a thread |
| FR-7 | Query active stream status for UI indicators |
| FR-8 | ThreadRepository tracks message status (`pending`, `streaming`, `complete`, `error`) |
| FR-9 | `getMessages()` returns message status so UI can render streaming indicators without cross-referencing |
| FR-10 | Emit real-time status phases and messages for detailed UI feedback (e.g., "Sending", "List folders", "Found 6 files") |
| FR-11 | Chat providers supply human-readable tool titles and result summaries; StreamManager passes through without interpretation |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1 | Stream startup latency | < 50ms |
| NFR-2 | Memory per active stream | < 60MB |
| NFR-3 | Concurrent streams | 25+ |
| NFR-4 | Code complexity | < 150 lines for stream manager |

### Constraints

- `appSlug` (8-digit string) identifies provider and system prompt; required per stream
- UI determines service reuse; backend creates fresh service per stream
- No service pooling or caching in backend
- ThreadRepository is source of truth for message content AND status
- StreamManager has no knowledge of tool names or formatting; all display text comes from providers/tools

---

## Overview

The stream multiplexing system enables concurrent chat operations across multiple threads and branches. It separates concerns:

- **Stream execution** (backend StreamManager)
- **Stream routing** (frontend via subscriptions)  
- **Status display text** (chat providers and tools)

### Core Principles

| Principle | Description |
|-----------|-------------|
| Repository-first | All streams write to ThreadRepository; IPC is secondary |
| Status in repository | Message status tracked in repository, not just StreamManager |
| Subscription-based emission | Only subscribed branches receive real-time IPC updates |
| Stateless services | Create service per stream, dispose on completion |
| UI-controlled context | Frontend determines what to display; backend executes |
| Pass-through messages | StreamManager passes display text from providers without interpretation |

### Data Model

See **system-branching-id.md § 7.4 Thread Repository Service** for the complete `Message` interface.

```typescript
// Key fields for streaming
interface Message {
  id: string;
  threadId: string;
  branchId: string;      // 4-digit format: "row.lane.message.tool_iteration"
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  status: MessageStatus; // 'pending' | 'streaming' | 'complete' | 'error'
  error?: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              MAIN PROCESS                               │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                       StreamManager                               │ │
│  │                                                                   │ │
│  │   Emits phases:  initializing → sending → receiving → complete   │ │
│  │                                    ↓                              │ │
│  │                              tool_call (when tools execute)       │ │
│  │                                                                   │ │
│  │   Passes through messages from providers:                        │ │
│  │     - Tool title: "List folders"                                 │ │
│  │     - Tool result: "Found 6 folders and 12 files"                │ │
│  │     - Tool progress: "Processing file 3 of 10"                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                              │                                          │
│              'chat:stream' { type: 'status', payload: { phase, message } }
│                              │                                          │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           RENDERER PROCESS                               │
│                                                                          │
│   UI displays:                                                          │
│   ┌────────────────────────────────────────────────────────────────┐    │
│   │  phase: tool_call                                              │    │
│   │  message: "List folders"              →  ○ List folders        │    │
│   │                                                                │    │
│   │  phase: tool_call                                              │    │
│   │  message: "Found 6 folders..."        →  ○ Found 6 folders...  │    │
│   │                                                                │    │
│   │  phase: receiving                                              │    │
│   │  message: undefined                   →  ● Receiving...        │    │
│   └────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### View Switching Flow

1. User opens Thread 1 with branches [1.0.0.0, 1.0.1.0, 1.0.2.0]
2. Frontend calls `subscribe(threadId, branchIds)`
3. Frontend calls `getMessages(threadId)` — receives messages with `status` field
4. UI renders based on `message.status` (streaming indicators, error states)
5. Active streams for subscribed branches emit tokens and status to IPC
6. User switches to Thread 2
7. Frontend calls `subscribe(thread2, [...])` — Thread 1 streams continue in background
8. User returns to Thread 1 — `getMessages` returns updated content and status

---

## Real-Time Status System

### Separation of Concerns

| Concept | Type | Source | Purpose |
|---------|------|--------|---------|
| **StreamPhase** | Enum (7 values) | StreamManager | State machine for UI styling |
| **Status Message** | String | Chat providers/tools | Human-readable display text |

### StreamPhase (State Machine)

```typescript
type StreamPhase = 
  | 'initializing'   // Setting up request
  | 'sending'        // Request sent, waiting for response
  | 'receiving'      // Receiving tokens from model
  | 'tool_call'      // Tool is executing
  | 'finalizing'     // Stream ending, cleanup
  | 'complete'       // Done successfully
  | 'error';         // Failed
```

### StreamStatus (IPC Payload)

```typescript
interface StreamStatus {
  phase: StreamPhase;
  message?: string;   // Pass-through from provider/tools
}
```

### Phase Transitions

```
┌──────────────┐
│ initializing │ ─────────────────────────────────────────────┐
└──────┬───────┘                                              │
       │                                                      │
       ▼                                                      │
┌──────────────┐                                              │
│   sending    │ ─────────────────────────────────────────────┤
└──────┬───────┘                                              │
       │ (first token received)                               │
       ▼                                                      │
┌──────────────┐     ┌──────────────┐                        │
│  receiving   │ ←─→ │  tool_call   │  (can alternate)       │
└──────┬───────┘     └──────────────┘                        │
       │                                                      │
       ▼                                                      │
┌──────────────┐                                              │
│  finalizing  │                                              │
└──────┬───────┘                                              │
       │                                                      │
       ▼                                                      ▼
┌──────────────┐                                     ┌──────────────┐
│   complete   │                                     │    error     │
└──────────────┘                                     └──────────────┘
```

---

## Provider-Side Changes

### ToolDefinition Enhancement

Add `displayName` to tool definitions so providers can look up human-readable names:

```typescript
// src-electron/services/tool-calling/tool-types.ts

export interface ToolDefinition {
  name: string;
  displayName: string;    // NEW: "List folders", "Read file"
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}
```

### Tool Implementation Updates

Each tool provides its display name:

```typescript
// Example: src-electron/services/tool-calling/tools/folder-read.tool.ts

export function createFolderReadTool(context: ToolContext): ITool {
  return {
    getName: () => 'read_folder',
    
    getDefinition: () => ({
      name: 'read_folder',
      displayName: 'List folders',    // NEW
      description: 'List files and directories in a folder',
      input_schema: { /* ... */ }
    }),
    
    execute: async (input) => { /* ... */ }
  };
}
```

### Enhanced Tool Notification

Chat providers emit enhanced notifications with title and result:

```typescript
// @holokai/chat-component types

export interface ToolNotification {
  stage: 'start' | 'complete';
  toolCallId: string;
  title?: string;     // NEW: Display name from ToolDefinition.displayName
  result?: string;    // NEW: Formatted result summary (on complete)
}

// onToolUse callback signature (unchanged, but richer data)
type ToolUseCallback = (
  toolName: string,
  input: unknown,
  notification: ToolNotification
) => void;
```

### Provider Responsibility

The chat provider owns all tool event emission through `onToolUse`. It looks up display names and formats results:

```typescript
// In chat provider (e.g., AnthropicProvider)

private async executeToolCall(
  toolCall: ToolCall,
  onToolUse: ToolUseCallback
): Promise<ToolResult> {
  const toolDef = this.tools.find(t => t.name === toolCall.name);
  const title = toolDef?.displayName || toolCall.name;

  // Emit start (tool execution begins)
  onToolUse(toolCall.name, toolCall.input, {
    stage: 'start',
    toolCallId: toolCall.id,
    title  // "List folders" - displayed with spinner while executing
  });

  // Execute tool
  const result = await this.orchestrator.executeTool(toolCall.name, toolCall.input);

  // Emit complete
  onToolUse(toolCall.name, toolCall.input, {
    stage: 'complete',
    toolCallId: toolCall.id,
    title,
    result: this.formatToolResult(toolCall.name, result)  // "Found 6 folders and 12 files"
  });

  return result;
}
```

**Key Points:**
- Provider emits `start` (action happening) and `complete` (action finished)
- `start` title is displayed with a spinner while tool executes
- Provider has access to tool definitions for `displayName` lookup
- Provider formats results into human-readable strings
- StreamManager receives a consistent `ToolNotification` shape

### Result Formatting (Provider-Side)

```typescript
// In chat provider

private formatToolResult(toolName: string, result: ToolResult): string | undefined {
  if (!result.success || !result.data) return undefined;
  
  switch (toolName) {
    case 'read_folder':
      const folder = result.data as ReadFolderResult;
      return `Found ${folder.total_directories} folders and ${folder.total_files} files`;
    
    case 'read_file':
      const file = result.data as ReadFileResult;
      return `Read ${file.metadata.lines} lines (${file.metadata.size} bytes)`;
    
    case 'write_file':
      const write = result.data as WriteFileResult;
      return write.created ? `Created file (${write.bytesWritten} bytes)` : `Updated file (${write.bytesWritten} bytes)`;
    
    // Add more formatters as tools are added
    default:
      return undefined;
  }
}
```

---

## UI Lifecycle: When to Load and When to Cancel

### When to Call `thread.getMessages(threadId)`

The UI calls `getMessages` to load the current state from ThreadRepository. This is the **source of truth** for message content AND status.

| Scenario | Action | Reason |
|----------|--------|--------|
| **Open thread** | `getMessages(threadId)` | Load messages with status before subscribing |
| **Switch to different thread** | `getMessages(newThreadId)` | Load current state; status reflects stream progress |
| **Return to previous thread** | `getMessages(threadId)` | Status may have changed to 'complete' or 'error' |
| **App regains focus** | `getMessages(threadId)` | Sync with background stream completion |
| **Reconnect after offline** | `getMessages(threadId)` | Sync with any changes persisted during disconnect |
| **After stream error** | `getMessages(threadId)` | Get error message and partial content |

**Key Principle:** `getMessages()` returns everything needed to render the UI, including which messages are still streaming. No need to call `chat.getActive()` separately.

```typescript
// Correct order in viewThread()
async viewThread(threadId: string, branchIds: string[]) {
  // 1. Subscribe first (so we don't miss any tokens)
  await window.electronAPI.chat.subscribe(threadId, branchIds);
  
  // 2. Load current state from repository (includes status!)
  const messages = await window.electronAPI.thread.getMessages(threadId);
  
  // 3. Set up stream listener for real-time updates
  this.unsubscribe = window.electronAPI.chat.onStreamMessage(handler);
  
  // 4. Initialize UI directly from messages
  for (const msg of messages) {
    this.branches.set(msg.branchId, {
      branchId: msg.branchId,
      model: msg.model,
      status: msg.status,
      content: msg.content,
      error: msg.error
    });
  }
}
```

### When to Cancel Streaming

Cancellation stops the LLM generation and aborts the stream. Use sparingly—most scenarios should let streams complete in the background.

| Scenario | Action | Reason |
|----------|--------|--------|
| **User clicks Cancel button** | `cancel(threadId, branchId)` | Explicit user intent to stop generation |
| **User clicks Cancel All** | `cancelThread(threadId)` | Stop all branches in current thread |
| **User deletes thread** | `cancelThread(threadId)` | No point continuing; thread is gone |
| **User deletes specific branch** | `cancel(threadId, branchId)` | Branch no longer needed |
| **App shutdown** | `cleanup()` | Graceful termination of all streams |
| **Error recovery** | `cancel(threadId, branchId)` | Stop broken stream before retry |

**When NOT to Cancel:**

| Scenario | Why Not Cancel |
|----------|----------------|
| **Switch to different thread** | Let background streams complete; content saves to repository |
| **Minimize/background app** | Streams continue; user expects results when returning |
| **Close thread panel** | Stream may be intentionally running in background |
| **Navigate to settings** | Not leaving thread context |

### Sequence Diagram: Thread Switch

```
User views Thread 1          User switches to Thread 2         User returns to Thread 1
       │                              │                               │
       ▼                              ▼                               ▼
┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
│ subscribe(t1)   │           │ subscribe(t2)   │           │ subscribe(t1)   │
│ getMessages(t1) │           │ getMessages(t2) │           │ getMessages(t1) │
│ status:streaming│           │ status:complete │           │ status:complete │
│ onStreamMessage │           │ onStreamMessage │           │ (stream finished)│
└────────┬────────┘           └────────┬────────┘           └────────┬────────┘
         │                             │                             │
         ▼                             ▼                             ▼
   Stream t1::1.0.0             Stream t1::1.0.0              Repository has
   emits to UI                  continues in background       final content +
   status: streaming            updates repository            status: complete
                                status → complete
```

### Activity Indicators

For showing background activity (e.g., spinner on thread list), use `chat.getActive()`:

```typescript
// Quick check without loading full messages
const activeStreams = await window.electronAPI.chat.getActive();
const threadHasActivity = activeStreams.some(s => s.threadId === threadId);
```

For rendering message-level status, use `message.status` from `getMessages()`.

---

## Design Patterns and Constructs

### Pattern: Module-Level State

Instead of a singleton class, use simple module-level variables with exported functions. This reduces boilerplate and simplifies testing.

```typescript
// State
const activeStreams = new Map<string, AbortController>();
const subscribed = new Set<string>();

// Functions operate on module state
export function start(params) { ... }
export function cancel(threadId, branchId) { ... }
```

**Benefits:** No constructor, no `getInstance()`, no lifecycle management. State is initialized on module load, cleaned up on `cleanup()` call.

### Pattern: Repository Status Integration

StreamManager updates ThreadRepository status at each lifecycle point:

```typescript
// Stream lifecycle → Repository status
start()     → setMessageStatus('streaming')
token       → appendToken() (status remains 'streaming')
complete    → setMessageStatus('complete')
error       → setMessageStatus('error', errorMessage)
cancel      → setMessageStatus('error', 'Cancelled')
```

**Benefits:** Single source of truth. UI reads status from `getMessages()` without cross-referencing active streams.

### Pattern: Phase/Message Separation

StreamManager owns phase transitions (state machine). Providers own display messages (pass-through text):

```typescript
// StreamManager: controls phases
emitStatus('initializing');
emitStatus('sending');
emitStatus('tool_call', notification.title);  // Phase + pass-through message
emitStatus('receiving');
emitStatus('complete');

// Provider: supplies messages
notification.title = "List folders";           // From ToolDefinition.displayName
notification.result = "Found 6 folders...";    // Formatted by provider
```

**Benefits:** StreamManager has no knowledge of tool names or formatting. Easy to add new tools without changing StreamManager.

### Pattern: Subscription-Based Emission

Streams always execute, but IPC emission is conditional on subscription state:

```typescript
const emit = (type, payload) => {
  if (subscribed.has(key) && !controller.signal.aborted) {
    mainWindow.webContents.send('chat:stream', message);
  }
};
```

**Benefits:** Background streams don't flood IPC. UI only receives what it's displaying.

### Pattern: Composite Key

Use `threadId::branchId` as a composite key for both active streams and subscriptions:

```typescript
const key = (threadId: string, branchId: string) => `${threadId}::${branchId}`;
```

**Benefits:** Simple string operations for lookup, filtering by thread prefix (`k.startsWith(threadId)`).

### Pattern: AbortController for Cancellation

Each stream gets an AbortController. Callbacks check `signal.aborted` before emitting:

```typescript
const controller = new AbortController();
activeStreams.set(key, controller);

// In callback
if (!controller.signal.aborted) emit('token', { token });

// To cancel
activeStreams.get(key)?.abort();
```

**Benefits:** Native browser/Node API, propagates cancellation cleanly, no custom event system.

### Pattern: Fire-and-Forget with Promise.allSettled

For branched prompts, start all streams concurrently and collect results:

```typescript
const results = await Promise.allSettled(branches.map(b => start({ ...b, threadId })));
return results.map((r, i) => ({
  branchId: branches[i].branchId,
  success: r.status === 'fulfilled' && r.value.success,
  error: r.status === 'rejected' ? r.reason?.message : r.value?.error
}));
```

**Benefits:** One failure doesn't abort others. All results collected for UI feedback.

### Construct: StreamMessage

Unified message type for all stream events:

```typescript
interface StreamMessage {
  type: 'token' | 'complete' | 'error' | 'tool_use' | 'status';
  threadId: string;
  branchId: string;
  model: string;
  payload: unknown;
}

// Payload by type:
// 'token'      → { token: string }
// 'complete'   → {}
// 'error'      → { message: string }
// 'tool_use'   → { toolName, input, stage, title?, result? }
// 'status'     → { phase: StreamPhase, message?: string }
```

**Benefits:** Single IPC channel, frontend routes by `branchId`, extensible payload.

### Construct: StartStreamParams

All parameters needed to start a stream:

```typescript
interface StartStreamParams {
  threadId: string;
  branchId: string;
  appSlug: string;        // Provider/system prompt identifier
  providerType: string;   // 'anthropic', 'openai', etc.
  model: string;          // 'claude-3-opus', 'gpt-4', etc.
  config: ProviderConfig;
  request: DesktopChatRequest;
}
```

---

## Implementation

### stream-types.ts

```typescript
// src-electron/services/chat/stream-types.ts

/**
 * High-level phases of a chat stream (state machine)
 * StreamManager controls these transitions
 */
export type StreamPhase = 
  | 'initializing'
  | 'sending'
  | 'receiving'
  | 'tool_call'
  | 'finalizing'
  | 'complete'
  | 'error';

/**
 * Stream status emitted to UI
 * Phase is controlled by StreamManager; message is pass-through from providers
 */
export interface StreamStatus {
  phase: StreamPhase;
  message?: string;  // Pass-through from provider/tools (title, result, progress)
}
```

### tool-types.ts (additions)

```typescript
// src-electron/services/tool-calling/tool-types.ts

export interface ToolDefinition {
  name: string;
  displayName: string;    // NEW: Human-readable name for UI
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

// ToolNotification enhanced with display text
export interface ToolNotification {
  stage: 'start' | 'complete';
  toolCallId: string;
  title?: string;     // NEW: From ToolDefinition.displayName
  result?: string;    // NEW: Formatted result summary (on complete)
}
```

### thread-repository.ts

See **system-branching-id.md § 7.4 Thread Repository Service** for the complete consolidated interface.

**Methods used by StreamManager:**

```typescript
// Streaming lifecycle
createAssistantMessage(threadId, branchId, model)  // Create placeholder before streaming
setMessageStatus(threadId, branchId, status, error?)  // Update status: pending → streaming → complete/error
appendToken(threadId, branchId, token)  // Append token during streaming

// Query
getMessage(threadId, branchId)  // Get single message
getMessages(threadId)  // Get all messages for thread (includes status)
```

### stream-manager.ts

```typescript
// src-electron/services/chat/stream-manager.ts

import { BrowserWindow } from 'electron';
import { DesktopChatService } from './desktop-chat-service.js';
import { ToolOrchestrator } from '../tool-calling/orchestrator.js';
import * as ThreadRepository from '../thread/thread-repository.js';
import type { ProviderConfig } from '@holokai/chat-component';
import type { DesktopChatRequest } from './chat-types.js';
import type { ToolNotification } from '../tool-calling/tool-types.js';
import type { StreamPhase, StreamStatus } from './stream-types.js';
import log from 'electron-log';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface StreamMessage {
  type: 'token' | 'complete' | 'error' | 'tool_use' | 'status';
  threadId: string;
  branchId: string;
  model: string;
  payload: unknown;
}

export interface StartStreamParams {
  threadId: string;
  branchId: string;
  appSlug: string;
  providerType: string;
  model: string;
  config: ProviderConfig;
  request: DesktopChatRequest;
}

// ─────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────

const activeStreams = new Map<string, AbortController>();
const subscribed = new Set<string>();

let mainWindow: BrowserWindow | null = null;
let toolOrchestrator: ToolOrchestrator | null = null;

const key = (threadId: string, branchId: string) => `${threadId}::${branchId}`;

// ─────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────

export function configure(window: BrowserWindow, allowedPaths: string[]): void {
  mainWindow = window;
  toolOrchestrator = new ToolOrchestrator(undefined, allowedPaths);
}

export function cleanup(): void {
  activeStreams.forEach(c => c.abort());
  activeStreams.clear();
  subscribed.clear();
}

// ─────────────────────────────────────────────────────────────
// Subscriptions
// ─────────────────────────────────────────────────────────────

export function subscribe(threadId: string, branchIds: string[]): void {
  subscribed.clear();
  branchIds.forEach(b => subscribed.add(key(threadId, b)));
}

export function addSubscription(threadId: string, branchId: string): void {
  subscribed.add(key(threadId, branchId));
}

export function clearSubscriptions(): void {
  subscribed.clear();
}

// ─────────────────────────────────────────────────────────────
// Streaming
// ─────────────────────────────────────────────────────────────

export async function start(params: StartStreamParams): Promise<{ success: boolean; error?: string }> {
  const k = key(params.threadId, params.branchId);
  const controller = new AbortController();
  activeStreams.set(k, controller);

  const emit = (type: StreamMessage['type'], payload: unknown) => {
    if (subscribed.has(k) && !controller.signal.aborted) {
      mainWindow?.webContents.send('chat:stream', {
        type,
        threadId: params.threadId,
        branchId: params.branchId,
        model: params.model,
        payload
      } as StreamMessage);
    }
  };

  const emitStatus = (phase: StreamPhase, message?: string) => {
    emit('status', { phase, message } as StreamStatus);
  };

  // Phase: initializing
  emitStatus('initializing');
  await ThreadRepository.setMessageStatus(params.threadId, params.branchId, 'streaming');

  const service = new DesktopChatService(params.providerType, params.config, toolOrchestrator ?? undefined);

  // Phase: sending
  emitStatus('sending');

  let hasReceivedToken = false;

  try {
    await service.chat(
      params.request,
      async (token: string) => {
        if (controller.signal.aborted) return;
        
        // First token → receiving phase
        if (!hasReceivedToken) {
          hasReceivedToken = true;
          emitStatus('receiving');
        }
        
        await ThreadRepository.appendToken(params.threadId, params.branchId, token);
        emit('token', { token });
      },
      (toolName: string, input: unknown, notification: ToolNotification) => {
        if (controller.signal.aborted) return;
        
        // Tool events: phase is tool_call, message is pass-through from provider
        if (notification.stage === 'start') {
          emitStatus('tool_call', notification.title);  // "List folders" (with spinner)
        } else if (notification.stage === 'complete') {
          emitStatus('tool_call', notification.result || notification.title);  // "Found 6 folders..."
        }
        
        emit('tool_use', { toolName, input, ...notification });
      }
    );

    // Phase: finalizing → complete
    emitStatus('finalizing');
    await ThreadRepository.setMessageStatus(params.threadId, params.branchId, 'complete');
    emitStatus('complete');
    emit('complete', {});
    return { success: true };

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    emitStatus('error', message);
    await ThreadRepository.setMessageStatus(params.threadId, params.branchId, 'error', message);
    emit('error', { message });
    return { success: false, error: message };

  } finally {
    activeStreams.delete(k);
  }
}

export async function startBranched(
  threadId: string,
  branches: Array<Omit<StartStreamParams, 'threadId'>>
): Promise<Array<{ branchId: string; success: boolean; error?: string }>> {
  
  // Create placeholder messages for all branches
  for (const branch of branches) {
    await ThreadRepository.createAssistantMessage(threadId, branch.branchId, branch.model);
  }

  const results = await Promise.allSettled(branches.map(b => start({ ...b, threadId })));
  return results.map((r, i) => ({
    branchId: branches[i].branchId,
    success: r.status === 'fulfilled' && r.value.success,
    error: r.status === 'rejected' ? r.reason?.message : r.status === 'fulfilled' ? r.value.error : undefined
  }));
}

// ─────────────────────────────────────────────────────────────
// Control
// ─────────────────────────────────────────────────────────────

export async function cancel(threadId: string, branchId: string): Promise<void> {
  const k = key(threadId, branchId);
  const controller = activeStreams.get(k);
  if (controller) {
    controller.abort();
    await ThreadRepository.setMessageStatus(threadId, branchId, 'error', 'Cancelled by user');
  }
}

export async function cancelThread(threadId: string): Promise<void> {
  const cancellations: Promise<void>[] = [];
  
  activeStreams.forEach((controller, k) => {
    if (k.startsWith(`${threadId}::`)) {
      controller.abort();
      const [, branchId] = k.split('::');
      cancellations.push(
        ThreadRepository.setMessageStatus(threadId, branchId, 'error', 'Cancelled by user')
      );
    }
  });
  
  await Promise.all(cancellations);
}

export function isActive(threadId: string, branchId: string): boolean {
  return activeStreams.has(key(threadId, branchId));
}

export function getActive(): Array<{ threadId: string; branchId: string }> {
  return Array.from(activeStreams.keys()).map(k => {
    const [threadId, branchId] = k.split('::');
    return { threadId, branchId };
  });
}
```

### chat-handler.ts

```typescript
// src-electron/ipc-handlers/chat-handler.ts

import * as StreamManager from '../services/chat/stream-manager.js';
import { ipcMain, BrowserWindow } from 'electron';
import { getSettingsService } from './settings-handler.js';
import log from 'electron-log';

export function registerChatHandlers(mainWindow: BrowserWindow): void {
  StreamManager.configure(mainWindow, getSettingsService().getDirectoryWhitelist());

  // Subscriptions
  ipcMain.handle('chat:subscribe', (_, threadId, branchIds) => StreamManager.subscribe(threadId, branchIds));
  ipcMain.handle('chat:addSubscription', (_, threadId, branchId) => StreamManager.addSubscription(threadId, branchId));
  ipcMain.handle('chat:unsubscribe', () => StreamManager.clearSubscriptions());

  // Streaming
  ipcMain.handle('chat:start', (_, params) => StreamManager.start(params));
  ipcMain.handle('chat:startBranched', (_, threadId, branches) => StreamManager.startBranched(threadId, branches));

  // Control
  ipcMain.handle('chat:cancel', (_, threadId, branchId) => StreamManager.cancel(threadId, branchId));
  ipcMain.handle('chat:cancelThread', (_, threadId) => StreamManager.cancelThread(threadId));

  // Status
  ipcMain.handle('chat:isActive', (_, threadId, branchId) => StreamManager.isActive(threadId, branchId));
  ipcMain.handle('chat:getActive', () => StreamManager.getActive());

  log.info('[IPC] Chat handlers registered');
}

export function unregisterChatHandlers(): void {
  StreamManager.cleanup();
  ['subscribe', 'addSubscription', 'unsubscribe', 'start', 'startBranched',
   'cancel', 'cancelThread', 'isActive', 'getActive'].forEach(n => ipcMain.removeHandler(`chat:${n}`));
  log.info('[IPC] Chat handlers unregistered');
}
```

### preload.ts (chat section)

```typescript
// Add to preload.ts electronAPI.chat

import type { StreamMessage, StartStreamParams } from './services/chat/stream-manager.js';

chat: {
  // Subscriptions
  subscribe: (threadId: string, branchIds: string[]): Promise<void> =>
    ipcRenderer.invoke('chat:subscribe', threadId, branchIds),

  addSubscription: (threadId: string, branchId: string): Promise<void> =>
    ipcRenderer.invoke('chat:addSubscription', threadId, branchId),

  unsubscribe: (): Promise<void> =>
    ipcRenderer.invoke('chat:unsubscribe'),

  // Streaming
  start: (params: StartStreamParams): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('chat:start', params),

  startBranched: (
    threadId: string,
    branches: Array<Omit<StartStreamParams, 'threadId'>>
  ): Promise<Array<{ branchId: string; success: boolean; error?: string }>> =>
    ipcRenderer.invoke('chat:startBranched', threadId, branches),

  // Stream events
  onStreamMessage: (callback: (message: StreamMessage) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, message: StreamMessage) => callback(message);
    ipcRenderer.on('chat:stream', handler);
    return () => ipcRenderer.removeListener('chat:stream', handler);
  },

  // Control
  cancel: (threadId: string, branchId: string): Promise<void> =>
    ipcRenderer.invoke('chat:cancel', threadId, branchId),

  cancelThread: (threadId: string): Promise<void> =>
    ipcRenderer.invoke('chat:cancelThread', threadId),

  // Status (for quick checks; prefer message.status from getMessages)
  isActive: (threadId: string, branchId: string): Promise<boolean> =>
    ipcRenderer.invoke('chat:isActive', threadId, branchId),

  getActive: (): Promise<Array<{ threadId: string; branchId: string }>> =>
    ipcRenderer.invoke('chat:getActive'),
}
```

---

## Sample UI Implementation

### chat-stream.service.ts

```typescript
// src/lib/services/chat-stream.service.ts

import type { StreamMessage, StartStreamParams } from '$electron/services/chat/stream-manager.js';
import type { StreamPhase, StreamStatus } from '$electron/services/chat/stream-types.js';
import type { Message, MessageStatus } from '$electron/services/thread/thread-repository.js';

interface BranchState {
  branchId: string;
  model: string;
  status: MessageStatus;        // Persisted status from repository
  phase: StreamPhase;           // Real-time phase for styling
  statusMessage?: string;       // Real-time message for display
  content: string;
  error?: string;
}

type BranchUpdateCallback = (branchId: string, state: BranchState) => void;

class ChatStreamService {
  private currentThreadId: string | null = null;
  private branches = new Map<string, BranchState>();
  private unsubscribe: (() => void) | null = null;
  private onUpdate: BranchUpdateCallback | null = null;

  async viewThread(
    threadId: string,
    branchIds: string[],
    onUpdate: BranchUpdateCallback
  ): Promise<Map<string, BranchState>> {
    this.cleanup();
    this.currentThreadId = threadId;
    this.onUpdate = onUpdate;

    // 1. Subscribe to streams (so we don't miss tokens)
    await window.electronAPI.chat.subscribe(threadId, branchIds);

    // 2. Load messages WITH status from repository
    const messages = await window.electronAPI.thread.getMessages(threadId);

    // 3. Initialize branch states directly from message status
    for (const branchId of branchIds) {
      const msg = messages.find((m: Message) => m.branchId === branchId);
      this.branches.set(branchId, {
        branchId,
        model: msg?.model || 'unknown',
        status: msg?.status || 'pending',
        phase: this.statusToPhase(msg?.status),
        content: msg?.content || '',
        error: msg?.error
      });
    }

    // 4. Listen for real-time updates
    this.unsubscribe = window.electronAPI.chat.onStreamMessage((msg) => {
      if (msg.threadId === this.currentThreadId) this.handleMessage(msg);
    });

    return this.branches;
  }

  private statusToPhase(status?: MessageStatus): StreamPhase {
    switch (status) {
      case 'pending': return 'initializing';
      case 'streaming': return 'receiving';
      case 'complete': return 'complete';
      case 'error': return 'error';
      default: return 'initializing';
    }
  }

  async startBranched(
    threadId: string,
    prompt: string,
    models: Array<{
      branchId: string;
      appSlug: string;
      providerType: string;
      model: string;
      config: any;
    }>,
    messages: any[]
  ): Promise<void> {
    // Initialize branch states as pending
    for (const m of models) {
      this.branches.set(m.branchId, {
        branchId: m.branchId,
        model: m.model,
        status: 'pending',
        phase: 'initializing',
        content: ''
      });
      await window.electronAPI.chat.addSubscription(threadId, m.branchId);
      this.onUpdate?.(m.branchId, this.branches.get(m.branchId)!);
    }

    // Build request for each branch
    const branches = models.map(m => ({
      branchId: m.branchId,
      appSlug: m.appSlug,
      providerType: m.providerType,
      model: m.model,
      config: m.config,
      request: {
        messages,
        thread_guid: threadId,
        branch_id: m.branchId
      }
    }));

    // Start all streams
    const results = await window.electronAPI.chat.startBranched(threadId, branches);

    // Handle immediate failures
    for (const r of results) {
      if (!r.success) {
        const state = this.branches.get(r.branchId);
        if (state) {
          state.status = 'error';
          state.phase = 'error';
          state.error = r.error;
          this.onUpdate?.(r.branchId, { ...state });
        }
      }
    }
  }

  private handleMessage(msg: StreamMessage): void {
    const state = this.branches.get(msg.branchId);
    if (!state) return;

    switch (msg.type) {
      case 'token':
        state.content += (msg.payload as { token: string }).token;
        state.status = 'streaming';
        break;
        
      case 'status':
        const { phase, message } = msg.payload as StreamStatus;
        state.phase = phase;
        state.statusMessage = message;
        break;
        
      case 'complete':
        state.status = 'complete';
        state.phase = 'complete';
        state.statusMessage = undefined;
        break;
        
      case 'error':
        state.status = 'error';
        state.phase = 'error';
        state.error = (msg.payload as { message: string }).message;
        break;
    }

    this.onUpdate?.(msg.branchId, { ...state });
  }

  async cancelBranch(branchId: string): Promise<void> {
    if (this.currentThreadId) {
      await window.electronAPI.chat.cancel(this.currentThreadId, branchId);
      const state = this.branches.get(branchId);
      if (state) {
        state.status = 'error';
        state.phase = 'error';
        state.error = 'Cancelled by user';
        this.onUpdate?.(branchId, { ...state });
      }
    }
  }

  async cancelAll(): Promise<void> {
    if (this.currentThreadId) {
      await window.electronAPI.chat.cancelThread(this.currentThreadId);
      for (const [branchId, state] of this.branches) {
        if (state.status === 'streaming' || state.status === 'pending') {
          state.status = 'error';
          state.phase = 'error';
          state.error = 'Cancelled by user';
          this.onUpdate?.(branchId, { ...state });
        }
      }
    }
  }

  cleanup(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    window.electronAPI.chat.unsubscribe();
    this.branches.clear();
    this.currentThreadId = null;
    this.onUpdate = null;
  }
}

export const chatStreamService = new ChatStreamService();
```

### BranchedChatView.svelte

```svelte
<!-- src/lib/components/BranchedChatView.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { chatStreamService } from '$lib/services/chat-stream.service';
  import type { StreamPhase } from '$electron/services/chat/stream-types.js';

  export let threadId: string;
  export let branchIds: string[];

  let branches = new Map<string, BranchState>();

  // Default status text by phase
  const phaseDefaults: Record<StreamPhase, string> = {
    initializing: 'Initializing...',
    sending: 'Sending...',
    receiving: 'Receiving...',
    tool_call: 'Processing...',
    finalizing: 'Finalizing...',
    complete: 'Complete',
    error: 'Error'
  };

  function getStatusText(branch: BranchState | undefined): string {
    if (!branch) return '';
    return branch.statusMessage || phaseDefaults[branch.phase] || '';
  }

  onMount(async () => {
    branches = await chatStreamService.viewThread(threadId, branchIds, (branchId, state) => {
      branches = new Map(branches.set(branchId, state));
    });
  });

  onDestroy(() => chatStreamService.cleanup());

  async function submitPrompt(prompt: string, models: ModelConfig[]) {
    await chatStreamService.startBranched(threadId, prompt, models, currentMessages);
  }

  function cancelBranch(branchId: string) {
    chatStreamService.cancelBranch(branchId);
  }

  function cancelAll() {
    chatStreamService.cancelAll();
  }

  $: hasActiveStreams = Array.from(branches.values()).some(
    b => !['complete', 'error'].includes(b.phase)
  );
</script>

<div class="branched-view">
  <div class="branches-grid" style="--cols: {branchIds.length}">
    {#each branchIds as branchId (branchId)}
      {@const branch = branches.get(branchId)}
      <div class="branch-panel" class:active={branch && !['complete', 'error'].includes(branch.phase)}>
        <header>
          <span class="model">{branch?.model}</span>
          
          <span class="status phase-{branch?.phase}">
            {#if branch?.phase && !['complete', 'error'].includes(branch.phase)}
              <span class="spinner"></span>
            {:else if branch?.phase === 'complete'}
              <span class="icon">✓</span>
            {:else if branch?.phase === 'error'}
              <span class="icon">✕</span>
            {/if}
            {getStatusText(branch)}
          </span>
          
          {#if branch && !['complete', 'error'].includes(branch.phase)}
            <button on:click={() => cancelBranch(branchId)}>Cancel</button>
          {/if}
        </header>

        <div class="content">
          {branch?.content || ''}
          {#if branch?.phase === 'receiving'}
            <span class="cursor">▌</span>
          {/if}
        </div>

        {#if branch?.error}
          <div class="error">{branch.error}</div>
        {/if}
      </div>
    {/each}
  </div>

  {#if hasActiveStreams}
    <button class="cancel-all" on:click={cancelAll}>Cancel All</button>
  {/if}
</div>

<style>
  .branches-grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: 1rem;
  }

  .branch-panel {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
    transition: border-color 0.2s;
  }

  .branch-panel.active {
    border-color: var(--accent);
  }

  .status {
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .phase-initializing,
  .phase-sending { color: var(--muted); }
  
  .phase-receiving,
  .phase-tool_call { color: var(--accent); }
  
  .phase-finalizing { color: var(--warning); }
  .phase-complete { color: var(--success); }
  .phase-error { color: var(--error); }

  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .cursor {
    animation: blink 1s infinite;
  }

  .error {
    color: var(--error);
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes blink {
    50% { opacity: 0; }
  }
</style>
```

---

## Status Flow Example

```
User submits prompt
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Phase         │ Message (from provider)         │ UI Display             │
├──────────────────────────────────────────────────────────────────────────┤
│ initializing  │ -                               │ ○ Initializing...      │
│ sending       │ -                               │ ○ Sending...           │
│ tool_call     │ "List folders"                  │ ○ List folders         │
│ tool_call     │ "Found 6 folders and 12 files"  │ ○ Found 6 folders...   │
│ tool_call     │ "Read file"                     │ ○ Read file            │
│ tool_call     │ "Read 340 lines"                │ ○ Read 340 lines       │
│ receiving     │ -                               │ ● Receiving...         │
│ finalizing    │ -                               │ ○ Finalizing...        │
│ complete      │ -                               │ ✓ Complete             │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

| Component | Lines | Responsibility |
|-----------|-------|----------------|
| stream-types.ts | ~15 | StreamPhase enum, StreamStatus interface |
| tool-types.ts (additions) | ~10 | displayName, ToolNotification enhancements |
| thread-repository.ts (additions) | ~50 | Message status tracking |
| stream-manager.ts | ~130 | Execute streams, emit phases, pass through messages |
| chat-handler.ts | ~25 | Wire IPC to stream manager |
| preload.ts (chat) | ~40 | Expose API to renderer |
| chat-stream.service.ts | ~120 | Frontend stream orchestration |
| BranchedChatView.svelte | ~100 | UI for multi-model view with status |

**Key Design Decisions:**
- **StreamPhase** (7 values): State machine controlled by StreamManager
- **Status message**: Pass-through text from providers/tools, no interpretation by StreamManager
- **ToolDefinition.displayName**: Tools define their own human-readable names
- **Provider formats results**: Chat providers format tool results as human-readable strings
- **UI uses both**: Phase for styling/icons, message for display text

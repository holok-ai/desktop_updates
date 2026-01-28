# System Event Handling

**Version:** 1.0
**Date:** 2026-01-26
**Status:** Draft
**Purpose:** Centralized requirements and design for event handling across the desktop application, including thread events, UI notifications, IPC communication, and state management.

---

## Table of Contents

1. [Referenced Documents Summary](#1-referenced-documents-summary)
   - 1.1 [Thread Component Requirements](#11-thread-component-requirements)
   - 1.2 [Thread Component Design](#12-thread-component-design)
   - 1.3 [Architecture 2025-11-25](#13-architecture-2025-11-25)
2. [Event Handling Requirements](#2-event-handling-requirements)
3. [Event Categories](#3-event-categories)
4. [Thread Event Flow - User Prompt to Response](#4-thread-event-flow---user-prompt-to-response)

---

## 1. Referenced Documents Summary

### 1.1 Thread Component Requirements

**Document:** `ai/thread-component-requirements.md`

**Event Handling Summary:**
- **Thread Status Events**: 6-state status indicator (idle, connecting, sending, receiving, tool-executing, error) with state transitions
- **Thread-Level Status**: Status applies to entire thread, not individual messages
- **Status Persistence**: Error state persists until next user prompt
- **View Switching Events**: User can switch between 4 views (Chat, Execution, Branching, Prompt) during streaming
- **Thread Switching Events**: User can switch threads during active streaming without interruption
- **Scroll Position Events**: View scroll positions persist when switching views
- **Toast Notifications**: Toggle mechanism shows toast notification (MR-202)
- **Streaming Continuation**: Streaming continues in background when view/thread switches
- **Branch Selection Events**: User selections trigger UI updates and composer state changes
- **Message Events**: Token-by-token streaming display with real-time UI updates

### 1.2 Thread Component Design

**Document:** `ai/thread-component-design.md`

**Event Handling Summary:**
- **State Management Stores**: 4 global stores (threadViewState, streamingState, threadStatusState, branchSelectionState) using Svelte writable/derived
- **Token Event Listeners**: `window.electronAPI.chat.onToken()` for streaming token callbacks with cleanup via `removeTokenListener()`
- **Status State Machine**: ThreadStatusService with explicit state transitions (onConnecting, onSending, onReceiving, onToolExecuting, onIdle, onError, onRateLimited, onDisconnected)
- **Component Events**: Props-based event callbacks (onViewChange, onSendMessage, onCreateVariation, onToggleBranches, onSelectBranch, onNodeClick, onToggle)
- **Keyboard Events**: Global keyboard shortcut handler (Cmd/Ctrl-Shift-T) for component toggle
- **Toast Notifications**: Toast on toggle to inform user of component switch
- **Execution Events**: ExecutionRunner lifecycle events (onRun, onStop) with execution record creation
- **Timeout Events**: Idle timeout (60s) and no-response timeout (60s) for streaming health monitoring
- **Cleanup Events**: Service cleanup on component unmount (remove listeners, clear timeouts)

### 1.3 Architecture 2025-11-25

**Document:** `bmad/architecture-2025-11-25.md`

**Event Handling Summary:**
- **NotificationService**: Core service for system-wide notifications
- **IPC Event Namespaces**: 11 namespaces with event-based communication (auth, threads, projects, workflows, files, insights, preferences, notifications, system, dialog, clipboard)
- **Real-Time Events**: Notification events, preference change notifications, workflow execution updates
- **Auth Events**: SSO session expiration events, token refresh events
- **Workflow Execution Events**: Step-level audit events (workflow_start, step_start, step_complete, workflow_complete, workflow_failed)
- **Project Update Events**: Polling-based invalidation (current), future RabbitMQ subscription for real-time updates
- **State Store Events**: Svelte stores (authStore, threadStore, projectStore, workflowStore, settingsStore, notificationStore) with reactive subscriptions
- **Audit Events**: Workflow execution audit trail written to Moku API
- **Cache Invalidation Events**: Project cache invalidation on detected changes

---

## 2. Event Handling Requirements

### 2.1 Core Event Types

| Event Type | Source | Destination | Priority | Status |
|------------|--------|-------------|----------|--------|
| **Token Stream** | Chat Provider → IPC → UI | StreamingService → UI Components | CRITICAL | Implemented |
| **Status State Transition** | Service Layer → StatusService | ThreadStatusIndicator Component | HIGH | Planned |
| **View Navigation** | User Interaction | ThreadComponent Orchestrator | HIGH | Planned |
| **Branch Selection** | User Interaction | BranchSelectionState Store | HIGH | Planned |
| **Execution Lifecycle** | ExecutionRunner | ExecutionView Components | MEDIUM | Planned |
| **Toast Notification** | System Events | Toast Store → UI | MEDIUM | Implemented |
| **Keyboard Shortcut** | Window Event | Component Toggle Logic | LOW | Implemented |
| **Auth Session** | Auth Service → IPC | Auth Store → UI | CRITICAL | Implemented |
| **Workflow Audit** | Execution Engine | Moku API | HIGH | Planned |
| **Cache Invalidation** | Project Service | Cache Manager | HIGH | Implemented |

### 2.2 Event Delivery Patterns

**Synchronous Events:**
- Component prop callbacks (onViewChange, onSendMessage)
- Direct function calls within services
- State store updates (immediate reactivity)

**Asynchronous Events:**
- IPC calls (renderer ↔ main process)
- API requests (desktop → Moku/Holo)
- Streaming tokens (provider → IPC → UI)

**Polling Events:**
- Project updates (every 30s, configurable)
- Cache staleness checks

**Future Real-Time Events:**
- RabbitMQ subscriptions for project updates
- WebSocket connections for live collaboration

---

## 3. Event Categories

### 3.1 Thread Lifecycle Events

**Thread Creation**
- `thread:create` - New thread initiated
- `thread:title-generated` - Title auto-generated

**Thread Loading**
- `thread:load-start` - Thread data fetch begins
- `thread:load-complete` - Thread and messages loaded
- `thread:load-error` - Failed to load thread

**Thread Updates**
- `thread:message-added` - New message appended
- `thread:message-updated` - Message content changed
- `thread:branch-created` - New branch point created
- `thread:status-changed` - Thread status updated

### 3.2 Message Streaming Events

**Stream Lifecycle**
- `stream:start` - Streaming initiated
- `stream:token` - Token received (high frequency)
- `stream:complete` - Stream finished successfully
- `stream:error` - Stream failed
- `stream:timeout` - No response timeout triggered

**Stream Health**
- `stream:idle-timeout` - No tokens for 60s
- `stream:no-response-timeout` - No initial response for 60s

### 3.3 UI State Events

**View Navigation**
- `view:switch` - User switches view (Chat/Execution/Branching/Prompt)
- `view:scroll-position-saved` - Scroll position captured
- `view:scroll-position-restored` - Scroll position applied

**Branch Interaction**
- `branch:select` - User selects branch lane
- `branch:toggle` - User expands/collapses branch
- `branch:create-variation` - User initiates variation

**Modal Events**
- `modal:open` - Modal displayed
- `modal:close` - Modal dismissed
- `modal:submit` - Modal form submitted

### 3.4 System Events

**Authentication**
- `auth:sso-login` - SSO flow initiated
- `auth:session-expired` - Session timeout
- `auth:token-refreshed` - Token refresh successful

**Notifications**
- `notification:received` - New notification from backend
- `notification:read` - User marks notification read
- `notification:toast-show` - Toast displayed
- `notification:toast-dismiss` - Toast dismissed

**Preferences**
- `preference:theme-changed` - Theme updated
- `preference:setting-updated` - Setting modified

**Execution**
- `execution:start` - Thread execution begins
- `execution:step-complete` - Execution step finished
- `execution:complete` - Full execution finished
- `execution:failed` - Execution error
- `execution:audit-written` - Audit event persisted

---

## 4. Thread Event Flow - User Prompt to Response

This section describes the complete event-driven flow from when a user submits a prompt through receiving streaming responses and executing tool function calls. The UI remains responsive throughout, providing real-time feedback to the user about what is happening at each stage.

### 4.1 Overview

The thread event system enables the UI to show users exactly what is happening as their prompts are processed:

- **Real-time Status Updates**: Visual indicators show connection state, sending, receiving, and tool execution
- **Token-by-Token Streaming**: Response text appears incrementally as it arrives
- **Tool Call Transparency**: Users see when tools are invoked and their results
- **Background Continuation**: Events continue even if user switches views or threads
- **Error Recovery**: Clear error states with user-actionable messages

### 4.2 Event Flow Stages

#### Stage 1: Prompt Submission

**User Action:** User types message and clicks Send (or presses Enter)

**Events Triggered:**

1. **`message:send-initiated`**
   - **Source**: Composer component
   - **Payload**: `{ content: string, threadId: string, branchId: string }`
   - **UI Update**: Send button disabled, input cleared

2. **`thread:status-change`** → `'connecting'`
   - **Source**: ThreadStatusService
   - **Payload**: `{ state: 'connecting', message: 'Connecting to model...', timestamp: number }`
   - **UI Update**: Status indicator Circle 1 starts pulsing, status text displays "Connecting to model..."

3. **`message:optimistic-add`**
   - **Source**: MessageTransmitter
   - **Payload**: `{ message: Message, status: 'sending' }`
   - **UI Update**: User message appears in timeline with "sending" indicator

**State Changes:**
```typescript
streamingState.update(s => ({ ...s, isStreaming: true }));
threadStatusState.set({ state: 'connecting', message: 'Connecting to model...', timestamp: Date.now() });
```

#### Stage 2: Message Sending

**System Action:** Desktop sends chat request to chat service via IPC

**Events Triggered:**

4. **`ipc:chat-request-sent`**
   - **Source**: window.electronAPI.chat.chat()
   - **Payload**: `{ threadId: string, branchId: string, messageCount: number }`
   - **UI Update**: No immediate UI change (internal event)

5. **`thread:status-change`** → `'sending'`
   - **Source**: ThreadStatusService
   - **Payload**: `{ state: 'sending', message: null, timestamp: number }`
   - **UI Update**: Status indicator Circle 1 turns solid green, pulsing stops

6. **`stream:timeouts-started`**
   - **Source**: StreamingService
   - **Payload**: `{ noResponseTimeout: 60000, idleTimeout: 60000 }`
   - **UI Update**: No immediate UI change (internal event)

**State Changes:**
```typescript
threadStatusState.set({ state: 'sending', message: null, timestamp: Date.now() });
```

#### Stage 3: First Token Received

**System Action:** Chat provider (OpenAI, Gemini, Claude, etc.) begins streaming response

**Events Triggered:**

7. **`stream:first-token`**
   - **Source**: IPC token listener
   - **Payload**: `{ token: string, timestamp: number, latency: number }`
   - **UI Update**: No-response timeout cleared

8. **`thread:status-change`** → `'receiving'`
   - **Source**: ThreadStatusService
   - **Payload**: `{ state: 'receiving', message: null, timestamp: number }`
   - **UI Update**: Status indicator Circle 1 clears, Circle 2 turns blue

9. **`stream:token`** (first of many)
   - **Source**: window.electronAPI.chat.onToken()
   - **Payload**: `{ token: string, branchId: string }`
   - **UI Update**: First text appears in streaming area of message timeline

**State Changes:**
```typescript
threadStatusState.set({ state: 'receiving', message: null, timestamp: Date.now() });
streamingState.update(s => ({
  ...s,
  responseText: token,
  streamingBranchId: branchId
}));
```

#### Stage 4: Continuous Token Streaming

**System Action:** Tokens continue arriving from model (high frequency, 10-100+ per second)

**Events Triggered:**

10. **`stream:token`** (repeated)
    - **Source**: IPC token listener
    - **Payload**: `{ token: string }`
    - **UI Update**: Text accumulates in streaming area, auto-scrolls to bottom

11. **`stream:idle-reset`** (on each token)
    - **Source**: StreamingService
    - **Payload**: `{ lastTokenAt: timestamp }`
    - **UI Update**: Idle timeout resets (internal event)

**State Changes (per token):**
```typescript
streamingState.update(s => ({
  ...s,
  responseText: s.responseText + token
}));
```

**UI Behavior:**
- Message timeline shows accumulating text
- Markdown rendering occurs in real-time
- Scroll position follows streaming text
- Status indicator Circle 2 remains blue and animated

#### Stage 5: Tool Call Detected (Optional)

**System Action:** Model response includes tool/function call request

**Events Triggered:**

12. **`tool:call-detected`**
    - **Source**: Chat provider (via IPC)
    - **Payload**: `{ toolName: string, toolId: string, arguments: object }`
    - **UI Update**: Tool call banner appears in message timeline

13. **`thread:status-change`** → `'tool-executing'`
    - **Source**: ThreadStatusService
    - **Payload**: `{ state: 'tool-executing', message: 'Executing tool: {toolName}', timestamp: number }`
    - **UI Update**: Status indicator Circle 2 turns yellow, status text shows "Executing tool: read_file"

14. **`stream:paused`**
    - **Source**: StreamingService
    - **Payload**: `{ reason: 'tool-execution' }`
    - **UI Update**: Streaming text pauses accumulating

**State Changes:**
```typescript
threadStatusState.set({
  state: 'tool-executing',
  message: `Executing tool: ${toolName}`,
  timestamp: Date.now()
});
```

**UI Behavior:**
- Tool call box appears showing tool name and arguments
- Loading spinner appears next to tool call
- Status text shows which tool is executing

#### Stage 6: Tool Execution

**System Action:** Tool orchestrator executes the tool function

**Events Triggered:**

15. **`tool:execution-started`**
    - **Source**: ToolOrchestrator
    - **Payload**: `{ toolId: string, toolName: string, workingDirectory: string }`
    - **UI Update**: Tool status updates to "Running..."

16. **`tool:progress-update`** (optional, for long-running tools)
    - **Source**: Tool implementation
    - **Payload**: `{ toolId: string, progress: number, message: string }`
    - **UI Update**: Progress bar or status message in tool call box

17. **`tool:execution-complete`**
    - **Source**: ToolOrchestrator
    - **Payload**: `{ toolId: string, success: boolean, result: any, duration: number }`
    - **UI Update**: Tool call box shows result summary, success/error indicator

**State Changes:**
```typescript
// Tool result stored in message metadata
toolResults.set(toolId, {
  success: true,
  data: result,
  duration: 1234
});
```

**UI Behavior:**
- Tool call box expands to show result
- Success checkmark or error icon appears
- Result data displayed (collapsed by default for large results)
- Execution time shown

#### Stage 7: Streaming Resumes After Tool

**System Action:** Model receives tool result and continues generating response

**Events Triggered:**

18. **`stream:resumed`**
    - **Source**: StreamingService
    - **Payload**: `{ afterTool: true, toolId: string }`
    - **UI Update**: No immediate change

19. **`thread:status-change`** → `'receiving'`
    - **Source**: ThreadStatusService
    - **Payload**: `{ state: 'receiving', message: null, timestamp: number }`
    - **UI Update**: Status indicator Circle 2 turns back to blue

20. **`stream:token`** (resumed streaming)
    - **Source**: IPC token listener
    - **Payload**: `{ token: string }`
    - **UI Update**: Text continues accumulating after tool result

**State Changes:**
```typescript
threadStatusState.set({ state: 'receiving', message: null, timestamp: Date.now() });
```

**UI Behavior:**
- Streaming text resumes after tool call box
- Tool result remains visible above continuing response
- Multiple tool calls may occur sequentially (repeat stages 5-7)

#### Stage 8: Stream Completion

**System Action:** Model finishes generating response, sends completion signal

**Events Triggered:**

21. **`stream:complete`**
    - **Source**: Chat provider (via IPC)
    - **Payload**: `{ branchId: string, totalTokens: number, duration: number, finishReason: 'stop' }`
    - **UI Update**: Streaming indicator stops

22. **`message:save-started`**
    - **Source**: MessageTransmitter
    - **Payload**: `{ content: string, branchId: string }`
    - **UI Update**: No immediate change (internal)

23. **`message:saved`**
    - **Source**: ThreadRepository
    - **Payload**: `{ message: Message, localOnly: boolean }`
    - **UI Update**: Message status changes from "streaming" to "sent"

24. **`thread:status-change`** → `'idle'`
    - **Source**: ThreadStatusService
    - **Payload**: `{ state: 'idle', message: null, timestamp: number }`
    - **UI Update**: Status indicator returns to background color (all circles idle)

25. **`stream:cleanup`**
    - **Source**: StreamingService
    - **Payload**: `{ listenersRemoved: true, timeoutsCleared: true }`
    - **UI Update**: No change (internal cleanup)

**State Changes:**
```typescript
threadStatusState.set({ state: 'idle', message: null, timestamp: Date.now() });
streamingState.set({
  isStreaming: false,
  responseText: '',
  streamingBranchId: null,
  error: null
});
```

**UI Behavior:**
- Send button re-enabled
- Composer input re-enabled
- Streaming text solidifies into permanent message
- Message timestamp finalizes
- Optimistic user message replaced with saved version

#### Stage 9: Post-Completion Actions

**System Action:** Background sync and UI cleanup

**Events Triggered:**

26. **`message:optimistic-replaced`**
    - **Source**: MessageTransmitter
    - **Payload**: `{ optimisticId: string, actualId: string }`
    - **UI Update**: Message ID updates (usually invisible to user)

27. **`thread:sync-triggered`** (optional)
    - **Source**: ThreadRepository
    - **Payload**: `{ threadId: string, reason: 'new-message' }`
    - **UI Update**: No immediate change

**State Changes:**
```typescript
messages = messages.map(m =>
  m.id === optimisticId ? { ...actualMessage } : m
);
```

### 4.3 Error Scenarios

#### Timeout Error (No Initial Response)

**Trigger:** No tokens received within 60 seconds of sending

**Events Triggered:**

- **`stream:no-response-timeout`**
  - **Payload**: `{ timeoutDuration: 60000 }`
- **`thread:status-change`** → `'error'`
  - **Payload**: `{ state: 'error', message: 'No response from model. Please try again.', timestamp: number }`
- **`notification:toast-show`**
  - **Payload**: `{ message: 'No response from model. Please try again.', duration: 4000 }`

**UI Update:**
- Status indicator Circle 3 turns red
- Error message appears in status area
- Toast notification shows at top of window
- Send button re-enabled for retry

#### Idle Timeout Error (Streaming Stalled)

**Trigger:** No tokens received for 60 seconds during active streaming

**Events Triggered:**

- **`stream:idle-timeout`**
  - **Payload**: `{ lastTokenAt: timestamp, idleDuration: 60000 }`
- **`thread:status-change`** → `'error'`
  - **Payload**: `{ state: 'error', message: 'Streaming stalled. Please try again.', timestamp: number }`
- **`stream:force-complete`**
  - **Payload**: `{ reason: 'idle-timeout', partialText: string }`

**UI Update:**
- Status indicator Circle 3 turns red
- Partial response saved as-is
- Error indicator appears on message
- User can retry or continue

#### Tool Execution Error

**Trigger:** Tool execution fails or times out

**Events Triggered:**

- **`tool:execution-failed`**
  - **Payload**: `{ toolId: string, toolName: string, error: string }`
- **`tool:error-reported`**
  - **Payload**: `{ toolId: string, errorMessage: string }`

**UI Update:**
- Tool call box shows error icon
- Error message displayed in tool result area
- Model may receive error and continue streaming
- Status returns to 'receiving' if stream continues

#### Rate Limit Error

**Trigger:** API rate limit hit

**Events Triggered:**

- **`api:rate-limited`**
  - **Payload**: `{ retryAfter: number }`
- **`thread:status-change`** → `'rate-limited'`
  - **Payload**: `{ state: 'rate-limited', message: 'Rate limited. Retry in 30s', timestamp: number }`

**UI Update:**
- Status indicator Circle 3 turns orange
- Countdown timer shows retry time
- Send button disabled until retry time elapses

### 4.4 Multi-Tool Call Flow

**Scenario:** Model makes multiple tool calls in sequence

**Event Pattern:**

```
[Streaming] → [Tool 1 Detected] → [Tool 1 Executing] → [Tool 1 Complete]
  → [Streaming Resumes] → [Tool 2 Detected] → [Tool 2 Executing] → [Tool 2 Complete]
  → [Streaming Resumes] → [Stream Complete]
```

**UI Behavior:**
- Multiple tool call boxes appear in sequence
- Each tool shows its own loading/success/error state
- Streaming text flows between and after tool calls
- Status indicator cycles between 'receiving' and 'tool-executing'

**Iteration Tracking:**
- Branch ID increments tool sequence digit: `1.0.1.0` → `1.0.1.1` → `1.0.1.2`
- Each tool iteration creates sub-branch in message tree
- UI can display tool call tree structure

### 4.5 Background Event Continuation

**Scenario:** User switches views or threads during streaming

**Behavior:**

1. **View Switch**
   - Events continue firing in background
   - `streamingState` store continues updating
   - Status indicator remains visible in header (all views)
   - User can switch back to Chat view to see accumulated text

2. **Thread Switch**
   - Current thread's streaming continues in background
   - New thread UI loads immediately
   - Status indicator shows previous thread still receiving
   - Both threads' states managed independently

3. **Return to Original Thread/View**
   - Full accumulated response visible immediately
   - No "catch-up" delay
   - Scroll position restored if stream complete

### 4.6 Event Performance Characteristics

**Token Event Frequency:**
- **Typical Rate**: 20-50 tokens/second
- **Peak Rate**: 100+ tokens/second (fast models)
- **UI Update Strategy**: Batched via Svelte reactivity (not per-token DOM update)

**Event Processing:**
- **Token events**: ~1-2ms processing time per event
- **Status changes**: <1ms (simple store update)
- **Message saves**: 10-50ms (database write)
- **Tool execution**: Variable (100ms - 60s depending on tool)

**Optimization:**
- Token events don't trigger immediate DOM updates (Svelte batches)
- Status indicator uses CSS transitions (GPU-accelerated)
- Tool results lazy-rendered (collapsed by default)
- Markdown parsing throttled during active streaming

### 4.7 Event Observability

**Logging Strategy:**

All thread events logged to console with structured format:
```typescript
console.log('[ThreadEvent]', {
  type: 'stream:token',
  threadId: '...',
  branchId: '1.0.1.0',
  timestamp: Date.now(),
  payload: { tokenLength: 15 }
});
```

**Debug Mode:**

Enable verbose logging:
```typescript
window.__THREAD_EVENT_DEBUG__ = true;
// Logs every event with full payload and timing
```

**Performance Monitoring:**

Track event timings:
```typescript
performance.mark('stream:start');
// ... streaming ...
performance.mark('stream:complete');
performance.measure('stream-duration', 'stream:start', 'stream:complete');
```

---

## 7. Appendix

### 7.1 Related Documents

- `thread-component-requirements.md` - Detailed functional requirements
- `thread-component-design.md` - Component architecture and service design
- `system-branching-id.md` - Branch ID system specification
- `bmad/architecture-2025-11-25.md` - Overall system architecture
- `bmad/ipc-api.md` - IPC API specification

### 7.2 Change History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-26 | System | Initial document creation from referenced sources |

---

**Document Status:** Draft - Ready for review and expansion with additional event handling requirements as implementation progresses.

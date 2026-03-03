# Tool Call Progress UI — Design Proposal

Branch: `baxter/tool-error-handling`

---

## Goal

Show each tool call that occurs during an assistant turn as a live status indicator inside the chat window. Once the response is complete, collapse the tool calls out of view. A toggle control on the response lets the user redisplay them as "response details".

---

## UI Behaviour Summary

| Phase             | What the user sees                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| Tool starts       | Inline status row appears below streaming text: wrench icon + tool name + input hint + spinner |
| Tool succeeds     | Row updates to green ✓ check + `complete`                                                      |
| Tool fails        | Row updates to red ✗ + brief error code                                                        |
| Response complete | All tool rows disappear; a small chip `⚙ 3 calls` appears at bottom of response bubble        |
| Chip clicked      | Tool detail rows re-expand inline (toggle)                                                     |

---

## Wireframes

### During Streaming (2 tools, one failed)

```
┌──────────────────────────────────────────────────────────────┐
│ You  ↑                                                        │
│  "what files are in /src and show me App.ts"                  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                                           assistant response ▼│
│  Sure, let me look at that for you...                         │
│  ···  (streaming dots / partial text)                         │
│                                                               │
│  ─────────────────────────────────────────────────────────   │
│  ⚙ Tool calls                                                 │
│                                                               │
│  ⟳  read_folder   /src/                                       │
│     Scanning directory...                                     │
│                                                               │
│  ✗  read_file     /src/App.ts                                 │
│     FILE_NOT_FOUND: '/src/App.ts' does not exist              │
└──────────────────────────────────────────────────────────────┘
```

### After Completion (collapsed, all succeeded)

```
┌──────────────────────────────────────────────────────────────┐
│                                           assistant response ▼│
│  The /src directory contains: main.ts, App.svelte, routes/…   │
│  I wasn't able to read App.ts — the file doesn't exist at    │
│  that path. Did you mean App.svelte?                          │
│                                                               │
│  ┌─────────────┐                                              │
│  │ ⚙  2 calls  │  ← small chip, always visible after done    │
│  └─────────────┘                                              │
└──────────────────────────────────────────────────────────────┘
```

### After Completion (chip clicked → expanded)

```
┌──────────────────────────────────────────────────────────────┐
│                                           assistant response ▼│
│  The /src directory contains: main.ts, App.svelte, routes/…   │
│  I wasn't able to read App.ts — the file doesn't exist.      │
│                                                               │
│  ─────────────────────────────────────────────────────────   │
│  ⚙ Tool calls                           ╱ hide               │
│                                                               │
│  ✓  read_folder   /src/                                       │
│                                                               │
│  ✗  read_file     /src/App.ts                                 │
│     FILE_NOT_FOUND: '/src/App.ts' does not exist              │
│                                                               │
│  ┌─────────────┐                                              │
│  │ ⚙  2 calls  │                                              │
│  └─────────────┘                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Data Model

### New shared type: `ToolCall`

Add to `src-electron/services/tool-calling/tool-types.ts` (and export from chat API types):

```typescript
export interface ToolCall {
  id: string; // tool_use_id from the LLM request (Anthropic: block.id)
  name: string; // e.g. 'read_file', 'read_folder'
  inputHint: string; // short human-readable hint, e.g. '/src/App.ts'
  status: 'in_progress' | 'complete' | 'error';
  message?: string; // progress message, e.g. 'Reading file: /src/App.ts'
  error?: string; // error string if status === 'error'
  startedAt: number;
  completedAt?: number;
}
```

`inputHint` is derived by each tool from its primary input param:

- `read_file` → `file_path` value
- `read_folder` → `folder_path` value
- `write_file` → `file_path` value
- shell tools → first 40 chars of `command`

### Updated `ToolStatus`

```typescript
// tool-types.ts
export interface ToolStatus {
  toolCallId: string; // NEW — ties status to a specific tool_use block
  toolName: string;
  state: 'in_progress' | 'complete' | 'error'; // 'error' added
  message?: string;
  error?: string; // NEW — error detail when state === 'error'
  inputHint?: string; // NEW — forwarded from tool execution
}
```

---

## Event Flow (Fixed)

```
 Tool called by LLM
      │
      ▼
 orchestrator.executeTool(name, input, context)
      │   ← context.statusCallback fires 'in_progress' (fix Issue 1)
      │   ← orchestrator try/catch wraps execute() (fix Issue 7)
      │
      ▼
 tool.execute() → { success, data, error }
      │   ← tool fires 'complete' or 'error' via statusCallback (fix Issue 2)
      │
      ▼
 DesktopChatService.chat()
      │   ← statusCallback is context.statusCallback,
      │     set from onToolStatus arg each call (fix Issue 1)
      │
      ▼
 chat-handler.ts  onToolStatus callback
      │   ← fires event.sender.send('chat:toolStatus', payload)
      │
      ▼
 preload.ts  chat.onToolStatus(callback)      ← NEW (fix Issue 4)
      │
      ▼
 thread-stream.service.ts  initializeEventListeners()
      │   ← new listener alongside onToken
      │   ← updates toolCallsMap[threadId]
      │   ← notifies subscribers
      │
      ▼
 ThreadChatView.svelte
      │   ← activeToolCalls reactive state updated
      │   ← passed to streaming ChatResponse
      │
      ▼
 ChatResponse.svelte  <ToolCallDetails tools={...} />
```

---

## Component Changes

### 1. New: `ToolCallDetails.svelte`

Location: `src/lib/components/thread/chat-view/ToolCallDetails.svelte`

Props:

```typescript
interface Props {
  tools: ToolCall[];
  // no other props needed — display-only
}
```

Renders a list of tool call rows. Each row:

- Status icon: `pi-spinner pi-spin` (in_progress) · `pi-check` green (complete) · `pi-times` red (error)
- Tool name
- Input hint (greyed, smaller)
- If `error`: expand to show error text in red

Follows design tokens from `ChatResponse.svelte`:

```css
.tool-details {
  border-top: 1px solid var(--surface-border, #e0e0e0);
  font-size: 0.75rem;
}
.tool-item.error {
  color: var(--error-color, #dc2626);
}
.tool-item.complete .status-icon {
  color: #10b981;
}
```

---

### 2. Modified: `ChatResponse.svelte`

Change `tools` prop type from `Array<{ name: string; status: string }>` to `ToolCall[]`.

Add `isStreaming`-aware display logic:

```
during streaming:   always render <ToolCallDetails {tools} />
after streaming:    render toggle chip; <ToolCallDetails> only when expanded
```

New local state: `let toolsExpanded = $state(false);`

Toggle chip rendered at bottom of `.response-bubble` when `!isStreaming && tools.length > 0`:

```
⚙  N call(s)
```

Clicking sets `toolsExpanded = !toolsExpanded`.

---

### 3. Modified: `ChatMessage.svelte`

Change `tools` prop type to `ToolCall[]` (passes through unchanged to ChatResponse).

The tools are already passed to both the streaming response and completed responses — that's correct. After completion the tool calls are preserved on the prop so the toggle can still show them.

---

### 4. Modified: `ThreadChatView.svelte`

#### New state:

```typescript
// Tool calls accumulating for the currently active stream
let activeToolCalls = $state<ToolCall[]>([]);

// Tool calls preserved per branchId after stream ends
// (persists for the lifetime of the component)
let completedToolCalls = $state(new Map<string, ToolCall[]>());
```

#### In `setupTokenListener()` / streaming setup:

Subscribe to `chat:toolStatus` via `threadService.subscribeToToolStatus(threadId, branchId, callback)`.

Callback updates `activeToolCalls`:

- `in_progress`: push new `ToolCall` entry
- `complete` / `error`: find by `id` and update status, error, completedAt

#### When stream completes (after `apiOk`):

```typescript
// Snapshot the accumulated tool calls, keyed by the active branchId
if (activeToolCalls.length > 0) {
  completedToolCalls.set(capturedBranchId, [...activeToolCalls]);
  completedToolCalls = completedToolCalls; // trigger reactivity
}
activeToolCalls = [];
```

#### When rendering `<ChatMessage>`:

```svelte
<ChatMessage
  tools={isStreaming && pair.request.branchId === activeStreamBranchId
    ? activeToolCalls
    : (completedToolCalls.get(pair.request.branchId) ?? [])}
  ...
/>
```

---

### 5. Modified: `thread-stream.service.ts`

Add tool call tracking alongside token streaming:

```typescript
// keyed by "threadId:branchId"
private toolCallCallbacks = new Map<string, Set<(call: ToolStatus) => void>>();

// In initializeEventListeners():
const unsubToolStatus = window.electronAPI.chat.onToolStatus?.(
  (data: { threadId: string; branchId: string } & ToolStatus) => {
    const key = this.buildStreamKey(data.threadId, data.branchId);
    const callbacks = this.toolCallCallbacks.get(key);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }
);
if (unsubToolStatus) this.registerCleanup(unsubToolStatus);

// New public method:
subscribeToToolStatus(threadId: string, branchId: string, callback: (s: ToolStatus) => void): () => void
```

---

### 6. Modified: `preload.ts`

Add to the `chat` API object:

```typescript
onToolStatus: (
  callback: (data: {
    threadId: string;
    branchId: string;
    toolCallId: string;
    toolName: string;
    state: 'in_progress' | 'complete' | 'error';
    message?: string;
    error?: string;
    inputHint?: string;
  }) => void,
): (() => void) => {
  const subscription = (_event: IpcRendererEvent, data: ...) => callback(data);
  ipcRenderer.on('chat:toolStatus', subscription);
  return () => ipcRenderer.off('chat:toolStatus', subscription);
},
```

---

### 7. Modified: `desktop-chat-service.ts` (Fix Issue 1)

In `chat()`, update `this.threadContext.statusCallback` instead of attaching to request:

```typescript
// Replace lines 165-166:
this.threadContext.statusCallback = onToolStatus;

// Already in finally block — correct:
this.threadContext.statusCallback = undefined;
```

The tool execution callback in the constructor closes over `this.threadContext`, so updating the field is enough.

---

### 8. Modified: `orchestrator.ts` (Fix Issue 7)

Wrap `tool.execute()` in try/catch:

```typescript
try {
  return await tool.execute(input, executionContext);
} catch (err) {
  const error = err instanceof Error ? err.message : String(err);
  log.error('[ToolOrchestrator] Tool execution threw:', name, error);
  if (executionContext.statusCallback) {
    executionContext.statusCallback({ toolCallId: '?', toolName: name, state: 'error', error });
  }
  return { success: false, error };
}
```

---

### 9. Modified: `tool-types.ts`

- Add `'error'` to `ToolStatus.state`
- Add `toolCallId`, `error`, `inputHint` fields to `ToolStatus`

---

### 10. Modified: Tool implementations (`file-read.tool.ts`, `folder-read.tool.ts`, etc.)

Each error-return path should fire a status update before returning:

```typescript
// Before any early return with success: false:
if (executionContext.statusCallback) {
  executionContext.statusCallback({
    toolCallId: executionContext.currentToolCallId ?? '?',
    toolName: this.getName(),
    state: 'error',
    error: errorMessage,
  });
}
return { success: false, error: errorMessage };
```

`currentToolCallId` needs to be passed into `ToolExecutionContext` by the orchestrator when it calls `tool.execute()`. The orchestrator already has `name` and the `ToolUse.id` from the LLM — it should forward that id.

---

## Data Flow Through the Stack (End-to-End)

```
LLM returns: tool_use block { id: "toolu_01", name: "read_file", input: { file_path: "/src/App.ts" } }
                │
                ▼
ClaudeProvider calls: onToolUse({ id: "toolu_01", name: "read_file", input: { ... } })
                │
                ▼
DesktopChatService.onToolUse callback:
  → this.toolOrchestra.executeTool("read_file", input, {
      ...this.threadContext,
      currentToolCallId: "toolu_01"          // NEW
    })
                │
                ▼
ToolOrchestrator.executeTool():
  → Before calling tool.execute():
      context.statusCallback?.({
        toolCallId: "toolu_01",
        toolName: "read_file",
        state: 'in_progress',
        inputHint: "/src/App.ts",            // extracted from input
        message: "Reading file: /src/App.ts"
      })
  → Calls tool.execute()
  → If throws: catch → statusCallback({ state: 'error', error })
                │
                ▼
FileReadTool.execute():
  → File not found → statusCallback({ state: 'error', error: "FILE_NOT_FOUND: ..." })
  → Returns { success: false, error: "FILE_NOT_FOUND: ..." }
                │
                ▼
Back up to DesktopChatService → IPC handler onToolStatus callback fires:
  → event.sender.send('chat:toolStatus', {
      threadId, branchId,
      toolCallId: "toolu_01",
      toolName: "read_file",
      state: 'error',
      error: "FILE_NOT_FOUND: '/src/App.ts' does not exist",
      inputHint: "/src/App.ts"
    })
                │
                ▼
Renderer: preload.onToolStatus callback fires
  → thread-stream.service.ts notifies subscribers
  → ThreadChatView.activeToolCalls updated reactively
  → ChatResponse re-renders with updated ToolCallDetails
  → User sees: ✗  read_file   /src/App.ts
                  FILE_NOT_FOUND: '/src/App.ts' does not exist
```

---

## Changes in `chat-handler.ts`

The `onToolStatus` callback is already wired in to `chatService.chat()`. The only change needed is that the payload needs `branchId` (extracted from the request) so the renderer can route it to the right stream:

```typescript
(status: ToolStatus) => {
  if (abortController.signal.aborted) return;
  event.sender.send('chat:toolStatus', {
    threadId,
    branchId,   // ADD: already available in scope
    ...status
  });
},
```

---

## `inputHint` Extraction

To keep tools simple, extract `inputHint` in the orchestrator from the `input` object using a convention:

```typescript
function extractInputHint(toolName: string, input: Record<string, unknown>): string {
  // First param named after the tool's primary input
  const primary =
    input.file_path ?? input.folder_path ?? input.path ?? input.command ?? input.query;
  if (!primary) return '';
  const s = String(primary);
  return s.length > 60 ? s.slice(0, 57) + '…' : s;
}
```

No changes to individual tools needed.

---

## Open Questions / Decisions Needed

1. **Persistence**: Should tool calls be stored in the message DB (in `Message.metadata`) so they survive page reload? Current design is in-memory only — lost on refresh. For v1 this is acceptable.

2. **Multi-response messages**: `ChatMessage` can have `responses: Array<{id, content}>` — multiple completed responses. In practice each response has its own branchId and there is one active stream at a time. The tool calls are associated with the active `capturedBranchId`. This is correct but the display in `ChatMessage` passes the same `tools` array to all responses — should be scoped to the streaming response and then the last completed response only.

3. **Input detail level**: The wireframe shows `inputHint` (short, one-liner). Should the user be able to expand a tool call to see the full input JSON? This adds UI surface but could be valuable for debugging. Defer to v2.

4. **Chip vs command**: The `⚙ N calls` toggle could live in `ChatResponseCommands` (the hover-reveal bar) instead of the bubble itself. Hover-only is less discoverable. Recommend inline chip in the bubble.

5. **`branchId` on `chat:toolStatus`**: Currently `chat-handler.ts` has `branchId` in scope (line 98) but the existing `chat:toolStatus` send doesn't include it. This is a one-line fix.

---

## Implementation Phases

### Phase 1 — Fix the wiring (backend + IPC, no visible UI change)

1. `tool-types.ts` — add `'error'` state, `toolCallId`, `error`, `inputHint` to `ToolStatus`
2. `orchestrator.ts` — try/catch + emit `in_progress` before execute, `error` on catch
3. `desktop-chat-service.ts` — fix `statusCallback` wiring into `this.threadContext`
4. `chat-handler.ts` — add `branchId` to `chat:toolStatus` payload
5. `preload.ts` — expose `chat.onToolStatus` listener

### Phase 2 — New `ToolCall` type + streaming service

6. Define `ToolCall` interface in shared types
7. `thread-stream.service.ts` — add `subscribeToToolStatus`, listen to IPC event

### Phase 3 — UI components

8. New `ToolCallDetails.svelte` — renders tool call rows (in_progress/complete/error)
9. `ChatResponse.svelte` — use `ToolCall[]`, inline during streaming, chip + toggle after
10. `ChatMessage.svelte` — update `tools` prop type

### Phase 4 — ThreadChatView wiring

11. `ThreadChatView.svelte` — `activeToolCalls` state, subscribe to toolStatus, snapshot on complete, pass to ChatMessage

---

## Files Touched

| File                                                         | Change type                  | Phase |
| ------------------------------------------------------------ | ---------------------------- | ----- |
| `src-electron/services/tool-calling/tool-types.ts`           | Extend types                 | 1     |
| `src-electron/services/tool-calling/orchestrator.ts`         | Try/catch + status emit      | 1     |
| `src-electron/services/chat/desktop-chat-service.ts`         | Fix statusCallback wiring    | 1     |
| `src-electron/ipc-handlers/chat-handler.ts`                  | Add branchId to payload      | 1     |
| `src-electron/preload.ts`                                    | Expose onToolStatus          | 1     |
| `src/lib/types/tool-call.type.ts`                            | New ToolCall type            | 2     |
| `src/lib/services/thread-stream.service.ts`                  | Add tool status subscription | 2     |
| `src/lib/components/thread/chat-view/ToolCallDetails.svelte` | New component                | 3     |
| `src/lib/components/thread/chat-view/ChatResponse.svelte`    | Chip toggle + inline detail  | 3     |
| `src/lib/components/thread/chat-view/ChatMessage.svelte`     | Update tools prop type       | 3     |
| `src/lib/components/thread/chat-view/ThreadChatView.svelte`  | State + subscription wiring  | 4     |

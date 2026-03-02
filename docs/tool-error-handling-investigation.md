# Tool Error Handling Investigation

Branch: `baxter/tool-error-handling`

## Overview

When a tool (e.g. `read_file`, `read_folder`) encounters an error, the user gets no meaningful feedback. This document maps the exact failure points from tool execution through to the UI.

---

## The Error Flow (what should happen vs what does)

```
Tool fails
  → returns { success: false, error: "FILE_NOT_FOUND: ..." }
  → ClaudeToolHandler wraps it in a tool_result block
  → sends it back to the LLM
  → LLM decides what to say about it
  → user sees LLM's response (not the raw error)
```

The user only ever sees whatever the LLM chooses to say. There is no direct UI feedback that a tool failed.

---

## Issue 1: `statusCallback` is never wired into `ToolExecutionContext`

**Files:** `src-electron/services/chat/desktop-chat-service.ts` lines 165–166 and 62–67

In the constructor, the `onToolUse` callback is permanently fixed:

```typescript
async (toolUse: ChatComponentToolUse) => {
  return await this.toolOrchestra.executeTool(
    toolUse.name,
    toolUse.input,
    this.threadContext,  // ← statusCallback is always undefined here
  );
}
```

In `chat()`, the incoming `onToolStatus` is attached to the `request` object instead of `this.threadContext`:

```typescript
// line 165–166 — attaches to request (ignored by tool execution)
(request as unknown as { statusCallback: ToolStatusCallback | undefined }).statusCallback =
  onToolStatus || undefined;
```

`this.threadContext.statusCallback` is never set, so every tool checks `executionContext.statusCallback` and finds `undefined`. Status events are never fired.

**Fix:** Set `this.threadContext.statusCallback = onToolStatus` in the `chat()` method, and clear it in the `finally` block (which already exists for exactly this purpose).

---

## Issue 2: Tool errors emit no status update

**Files:** `src-electron/services/tool-calling/tools/file-read.tool.ts` lines 63–70, 147–152

Tools only call `statusCallback` with `'in_progress'` at the start and `'complete'` on success. On failure they return early with `{ success: false, error: "..." }` — no status update is emitted.

```typescript
if (!fs.existsSync(resolvedPath)) {
  return { success: false, error: `FILE_NOT_FOUND: '${userPath}' does not exist` };
  // ← statusCallback never called, state stays 'in_progress' forever
}
```

**Fix:** `ToolStatus.state` needs an `'error'` variant, and each error return path should emit a status update before returning.

---

## Issue 3: `ToolStatus` has no error state

**File:** `src-electron/services/tool-calling/tool-types.ts` lines 22–26

```typescript
export interface ToolStatus {
  toolName: string;
  state: 'in_progress' | 'complete';  // no 'error'
  message?: string;
}
```

There is no way to express that a tool failed in the status type.

**Fix:** Add `'error'` to the union: `state: 'in_progress' | 'complete' | 'error'`

---

## Issue 4: `chat:toolUse` and `chat:toolStatus` IPC events are dead channels

**File:** `src-electron/preload.ts` lines 541–592

The main process sends these events (chat-handler.ts lines 130–139):

```typescript
event.sender.send('chat:toolUse', { threadId, toolName, input, ...notification });
event.sender.send('chat:toolStatus', { threadId, ...status });
```

But the preload's `chat` API only exposes `onToken`. There is no `onToolUse` or `onToolStatus` listener. The renderer cannot subscribe to these events through `window.electronAPI`.

Even if the events were fired (they aren't, due to Issue 1), the renderer could not receive them.

**Fix:** Expose `onToolStatus` (and optionally `onToolUse`) in the preload's chat API, following the same pattern as `onToken`.

---

## Issue 5: The `onToolUse` callback from the IPC handler is silently ignored

**File:** `src-electron/services/chat/desktop-chat-service.ts` lines 144–179

`DesktopChatService.chat()` accepts `onToolUse?: ToolUseCallback` as a parameter but never uses it. Tool execution always goes through the constructor's fixed callback. The IPC handler passes a callback expecting to emit `chat:toolUse` events — that callback is never called.

---

## Issue 6: `ChatResponse` has no error styling for tools

**File:** `src/lib/components/thread/chat-view/ChatResponse.svelte` lines 60–72

```svelte
<span class="tool-status" class:complete={tool.status === 'complete'}>
  {tool.status}
</span>
```

Only `'complete'` has a CSS class. An `'error'` status would display as unstyled text indistinguishable from `'in_progress'`.

**Fix:** Add `class:error={tool.status === 'error'}` and corresponding CSS.

---

## Issue 7: `ToolOrchestrator.executeTool` has no try/catch

**File:** `src-electron/services/tool-calling/orchestrator.ts` lines 68–88

```typescript
return await tool.execute(input, executionContext);
```

If a tool throws an unexpected exception (e.g. `fs.promises.stat()` on a permissions error not caught in the tool), it propagates unhandled up through the chat stack. It eventually reaches the IPC catch block and becomes `apiFail(-1, "Unknown error")` — shown in the UI as a generic red error banner with no context.

**Fix:** Wrap in try/catch and return `{ success: false, error: errorMessage }`.

---

## Issue 8: `handleGuardError` conflates all error types

**File:** `src/lib/components/thread/chat-view/ThreadChatView.svelte` lines 856–910

All errors funnel through `handleGuardError()`. It distinguishes PII/guard errors from everything else by keyword-matching the error string. Non-guard errors go into a generic red banner (`error` state variable, line 908). There's no concept of a "tool error" — the banner gives no context about which tool failed or why.

---

## Summary Table

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| 1 | `statusCallback` never set on `ToolExecutionContext` | `desktop-chat-service.ts:165` | High — blocks all status events |
| 2 | Error paths in tools emit no status update | `file-read.tool.ts`, others | High — tools stay 'in_progress' on error |
| 3 | `ToolStatus.state` has no `'error'` value | `tool-types.ts:24` | Medium — type gap |
| 4 | `chat:toolUse`/`chat:toolStatus` not in preload | `preload.ts` | High — renderer can't receive events |
| 5 | `onToolUse` IPC callback silently ignored | `desktop-chat-service.ts:147` | Medium — telemetry gap |
| 6 | `ChatResponse` has no error styling for tools | `ChatResponse.svelte:66` | Low — visual gap |
| 7 | Orchestrator lacks try/catch on `tool.execute()` | `orchestrator.ts:87` | Medium — unhandled exceptions |
| 8 | All errors treated as guard errors in UI | `ThreadChatView.svelte:856` | Medium — poor UX for tool errors |

---

## Recommended Fix Order

1. **`tool-types.ts`** — Add `'error'` to `ToolStatus.state`
2. **`desktop-chat-service.ts`** — Wire `onToolStatus` into `this.threadContext.statusCallback`
3. **`orchestrator.ts`** — Add try/catch around `tool.execute()`, return `{ success: false, error }`
4. **Tool implementations** — Emit `state: 'error'` status before returning failure results
5. **`preload.ts`** — Expose `onToolStatus` listener in chat API
6. **`ThreadChatView.svelte`** — Subscribe to `chat:toolStatus` events, track per-tool error state
7. **`ChatResponse.svelte`** — Add `error` CSS class and styling for tool status

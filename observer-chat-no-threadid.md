# Background Chat: Remove Thread ID from Observer Requests

## Summary

The `ThreadObserver` is aware of threads and tracks tasks by thread ID internally, but the
`BackgroundChatRequest` sent to the main process should not carry a `threadId` or `branch_id`.
The background chat service only needs an `agentId` to look up the provider config and run the
inference. Removing thread identity from the request makes it structurally impossible for the API
to persist background messages to a thread.

---

## Motivation

Currently `BackgroundChatRequest` includes `threadId`, and `background-chat-handler.ts` passes it
through as `thread_id` in the chat request. The API interprets `thread_id + branch_id` as
"persist this message to the thread", causing observer prompts and responses to appear in
`ThreadChatView`. The `ObserverPromptsInspector` was added as a workaround to filter these out
after the fact. This change eliminates the root cause.

---

## Planned Changes

### 1. `src-shared/types/observer.types.ts`

- Replace `threadId: string` with `agentId: string` in `BackgroundChatRequest`

### 2. `src/lib/observer/tasks/rename-title.ts` and `compress-context.ts`

- Remove `threadId: thread.id` from each `buildRequest` return value
- Tasks do not need to know the agentId — the observer injects it (same pattern as `model`)

### 3. `src/lib/observer/thread-observer.ts`

- In `executeTask`, after `task.buildRequest(thread, messages)`, inject `request.agentId` from
  `(thread as { metadata?: { agentId?: string } }).metadata?.agentId`
- This mirrors the existing `model` injection block already in `executeTask`
- All internal tracking (`activeByKey`, `observerStore`, logging) continues to use `thread.id`
  directly — unaffected

### 4. `src-electron/ipc-handlers/background-chat-handler.ts`

- Remove the `CreateChatServiceCommand` call (it exists solely to load the thread and extract the
  agent — no longer needed)
- Call `modelRepository.getAgentById(request.agentId)` directly to get provider URL
- Build `DesktopChatService` from the agent result
- Build `chatRequest` with no `thread_id` or `branch_id` fields

---

## Key Decisions

- **`agentId` injected by observer, not tasks** — tasks only describe what to ask, not how to
  route it. Keeps `ObserverTask.buildRequest` focused on prompt construction.
- **`ObserverPromptsInspector` stays** — it becomes a defensive safety net for any future
  regression, not the primary fix.
- **`CreateChatServiceCommand` is not deleted** — it is still used by the regular chat flow.
  The background handler simply stops using it.
- **Observer separation is unchanged** — concurrent `observe()` calls for different threads
  remain isolated via closure; no coordination needed at the IPC level.

---

## Potential Issues

- **`agentId` missing from thread metadata** — If a thread was created before `agentId` was
  stored in metadata, `request.agentId` will be empty and the background handler will fail to
  find the agent. Need a graceful failure path (log + return early).

- **`modelRepository.getAgentById` availability in handler** — Need to confirm
  `modelRepository` is importable in `background-chat-handler.ts` (it is used in
  `CreateChatServiceCommand` already, so should be fine).

- **Test updates** — `observer-tasks.spec.ts` and `thread-observer.spec.ts` reference
  `request.threadId`; these will need updating to `request.agentId`. The IPC handler test
  (`chat-handler.spec.ts`) may also need updating.

- **`suggest-prompt` task** — Currently commented out of the observer but also uses `threadId`
  in `buildRequest`. Should be updated at the same time to stay consistent.

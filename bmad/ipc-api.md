# IPC API Reference

## Overview

Holokai Desktop uses Electron's IPC (Inter-Process Communication) with a secure **Context Bridge** pattern to enable communication between the renderer (Svelte UI) and main (Node.js) processes.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process                          │
│                                                              │
│  window.electronAPI.{domain}.{method}()                     │
│                         │                                    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              preload.ts (Context Bridge)              │  │
│  │  contextBridge.exposeInMainWorld('electronAPI', ...) │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                    │
└─────────────────────────┼────────────────────────────────────┘
                          │ ipcRenderer.invoke() / .on()
┌─────────────────────────┼────────────────────────────────────┐
│                    Main Process                              │
│                         │                                    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           IPC Handlers (src-electron/ipc-handlers/)   │  │
│  │  ipcMain.handle('domain:method', handler)            │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Services & Repositories                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## API Domains

The `window.electronAPI` exposes the following domain APIs:

| Domain | Handler File | Purpose |
|--------|--------------|---------|
| `auth` | `auth-handler.ts` | Authentication & OAuth |
| `chat` | `chat-handler.ts` | LLM chat operations |
| `thread` | `thread-handler.ts` | Thread/conversation management |
| `project` | `project-handler.ts` | Project organization |
| `settings` | `settings-handler.ts` | App configuration |
| `models` | `models-handler.ts` | AI model listing |
| `file` | `file-handler.ts` | File upload/download |
| `system` | `system-handler.ts` | System info |
| `log` | (inline) | Logging to main process |

---

## Thread API

### Methods

| Method | Channel | Description |
|--------|---------|-------------|
| `getAll(options?)` | `thread:getAll` | Get all threads (optional project filter) |
| `getById(id)` | `thread:getById` | Get single thread |
| `create(thread)` | `thread:create` | Create new thread |
| `update(id, updates)` | `thread:update` | Update thread |
| `delete(id)` | `thread:delete` | Delete thread |
| `softDelete(id)` | `thread:softDelete` | Mark as deleted |
| `moveToProject(threadId, projectId, options?)` | `thread:moveToProject` | Move thread to project |
| `renameThread(threadId, newTitle)` | `thread:renameThread` | Rename with validation |
| `undoRename(threadId)` | `thread:undoRename` | Undo last rename |
| `getMessages(id)` | `thread:getMessages` | Get thread messages |
| `addUserPrompt(threadId, prompt, opts?)` | `thread:addUserPrompt` | Add user message |
| `addAssistantResponse(threadId, response, model?)` | `thread:addAssistantResponse` | Add AI response |
| `savePromptAndResponses(...)` | `thread:savePromptAndResponses` | Batch save |
| `appendMessage(threadId, payload)` | `thread:appendMessage` | Append with idempotency |
| `updateMessage(threadId, messageId, content)` | `thread:updateMessage` | Edit message |
| `getMessageVersions(threadId, messageId)` | `thread:getMessageVersions` | Get edit history |
| `deleteMessagesAfter(threadId, messageId)` | `thread:deleteMessagesAfter` | Truncate conversation |

### Events

| Event | Channel | Payload |
|-------|---------|---------|
| Thread created | `thread:created` | `Thread` |
| Thread updated | `thread:updated` | `Thread` |
| Thread deleted | `thread:deleted` | `threadId: string` |
| Title generation started | `thread:titleGenerationStarted` | `{ threadId }` |
| Title generation finished | `thread:titleGenerationFinished` | `{ threadId, title }` |
| Message persisted | `message:persisted` | `{ thread_id, message_id, timestamp }` |
| Message error | `message:error` | `{ thread_id?, error }` |

---

## Project API

### Methods

| Method | Channel | Description |
|--------|---------|-------------|
| `getAll()` | `project:getAll` | Get all projects |
| `getById(id)` | `project:getById` | Get single project |
| `create(data)` | `project:create` | Create project |
| `update(id, updates)` | `project:update` | Update project |
| `delete(id, options?)` | `project:delete` | Delete project |
| `getThreads(projectId)` | `project:getThreads` | Get thread count |

### Events

| Event | Channel | Payload |
|-------|---------|---------|
| Project created | `project:created` | `Project` |
| Project updated | `project:updated` | `Project` |
| Project deleted | `project:deleted` | `projectId: GUID` |

---

## Auth API

### Methods

| Method | Channel | Description |
|--------|---------|-------------|
| `startOAuthFlow()` | `auth:startOAuthFlow` | Begin OAuth (returns authUrl) |
| `exchangeCode(code, verifier)` | `auth:exchangeCode` | Exchange code for tokens |
| `mockLogin(provider)` | `auth:mockLogin` | Test login |
| `getAuthState()` | `auth:getAuthState` | Get current auth state |
| `getUser()` | `auth:getUser` | Get current user |
| `isAuthenticated()` | `auth:isAuthenticated` | Check auth status |
| `logout()` | `auth:logout` | Clear auth |
| `refreshToken()` | `auth:refreshToken` | Refresh access token |

### Events

| Event | Channel | Payload |
|-------|---------|---------|
| OAuth success | `auth:callback-success` | `{ user, isAuthenticated }` |
| OAuth error | `auth:callback-error` | `{ error, description }` |

---

## Chat API

### Methods

| Method | Channel | Description |
|--------|---------|-------------|
| `createProvider(type, config)` | `chat:createProvider` | Initialize provider |
| `chat(request)` | `chat:send` | Send message (streaming) |
| `chatWithOptions(request)` | `chat:sendWithOptions` | Send with advanced options |
| `getMetrics()` | `chat:getMetrics` | Get audit metrics |
| `close()` | `chat:close` | Cleanup provider |

### Events

| Event | Channel | Payload |
|-------|---------|---------|
| Token received | `chat:token` | `token: string` |

---

## File API

### Methods

| Method | Channel | Description |
|--------|---------|-------------|
| `upload(payload)` | `file:upload` | Upload file |
| `get(payload)` | `file:get` | Get file buffer |
| `delete(payload)` | `file:delete` | Delete file |
| `validate(payload)` | `file:validate` | Validate before upload |
| `preview(payload)` | `file:preview` | Get preview token |
| `download(payload)` | `file:download` | Get download token |
| `getWithToken(payload)` | `file:getWithToken` | Retrieve with token |

### Events

| Event | Channel | Payload |
|-------|---------|---------|
| Upload progress | `file:uploadProgress` | `{ fileId, progress }` |

---

## Settings API

### Methods

| Method | Channel | Description |
|--------|---------|-------------|
| `getAll()` | `settings:getAll` | Get all settings |
| `get(key)` | `settings:get` | Get single setting |
| `set(key, value)` | `settings:set` | Set single setting |
| `setMultiple(settings)` | `settings:setMultiple` | Batch update |
| `reset()` | `settings:reset` | Reset to defaults |
| `getMokuWebUrl()` | `settings:getMokuWebUrl` | Get Moku web URL |
| `getMokuApiUrl()` | `settings:getMokuApiUrl` | Get Moku API URL |
| `getStorePath()` | `settings:getStorePath` | Get settings file path |

---

## Models API

### Methods

| Method | Channel | Description |
|--------|---------|-------------|
| `listAvailable(userId?)` | `models:listAvailable` | List available models |
| `listAll(userId?)` | `models:listAll` | List all models |
| `get(provider, id)` | `models:get` | Get single model |

---

## System API

### Methods

| Method | Channel | Description |
|--------|---------|-------------|
| `platform()` | `system:platform` | Get OS platform |
| `version()` | `system:version` | Get app version |
| `getPath(name)` | `system:getPath` | Get system path |

---

## Log API

### Methods (Fire-and-forget)

| Method | Channel | Description |
|--------|---------|-------------|
| `info(message, ...params)` | `log:info` | Info log |
| `warn(message, ...params)` | `log:warn` | Warning log |
| `error(message, ...params)` | `log:error` | Error log |
| `debug(message, ...params)` | `log:debug` | Debug log |

---

## Security Considerations

1. **Context Isolation** - Preload runs in isolated context
2. **Explicit Whitelist** - Only declared APIs are exposed
3. **No Token Exposure** - Auth tokens never sent to renderer
4. **Typed Interfaces** - Full TypeScript type safety
5. **Cleanup Functions** - Event listeners return unsubscribe functions

# Thread Methods Analysis

## Overview

This document analyzes the thread-related methods used in the application, comparing what's implemented in the backend (src-electron) with what's actually used in the frontend (src), and provides recommendations for API simplification.

## Methods Used in src-electron (Backend)

The following methods are currently implemented in `ThreadRepository` and exposed via IPC handlers:

### 1. **listThreads()** - GET /threads
- **Purpose**: Load all thread summaries
- **Returns**: Array of threads with basic info (id, title, metadata, createdAt, updatedAt)
- **Filters**: Excludes soft-deleted threads
- **Used in**:
  - thread-handler.ts:178, 185
  - project-handler.ts:138, 150, 175

### 2. **loadThread(threadId)** - GET /threads/:threadId
- **Purpose**: Get single thread with all data
- **Returns**: Complete thread object including messages
- **Used in**:
  - thread-handler.ts:193, 204, 242, 264, 274, 341, 415, 444, 511, 569

### 3. **getMessages(threadId)** - GET /threads/:threadId/messages
- **Purpose**: Load all messages for a specific thread
- **Returns**: Array of messages sorted by createdAt (ascending)
- **Filters**: Excludes soft-deleted messages
- **Used in**:
  - thread-handler.ts:204 (filters messages from loaded thread)

### 4. **appendMessage(threadId, payload)** - POST /threads/:threadId/messages
- **Purpose**: Append a new message to a thread
- **Payload**: `{ role, content, metadata?, clientMessageId? }`
- **Returns**: Created message object + updated thread
- **Features**:
  - Idempotency via clientMessageId
  - Message size validation (8KB limit)
  - Authorization checks
- **Used in**:
  - thread-handler.ts:269, 437

### 5. **createThread(metadata)** - POST /threads
- **Purpose**: Create a new thread
- **Payload**: `{ title?, metadata? }`
- **Returns**: Created thread object
- **Used in**:
  - thread-handler.ts:329

### 6. **saveThread(thread)** - PATCH /threads/:threadId
- **Purpose**: Update thread metadata and properties
- **Payload**: Partial thread updates (title, metadata, status)
- **Returns**: Updated thread object
- **Used in**:
  - thread-handler.ts:354

### 7. **updateThreadMetadata(threadId, updates)** - PATCH /threads/:threadId/metadata
- **Purpose**: Update only thread metadata fields
- **Payload**: Partial metadata object
- **Returns**: Updated thread object
- **Used in**:
  - thread-handler.ts:609
  - project-handler.ts:156

### 8. **deleteThread(threadId)** - DELETE /threads/:threadId
- **Purpose**: Permanently delete a thread
- **Returns**: Boolean success
- **Side effects**: Deletes associated files
- **Used in**:
  - thread-handler.ts:370

### 9. **softDeleteThread(threadId)** - POST /threads/:threadId/soft-delete
- **Purpose**: Mark thread as deleted without removing data
- **Side effects**:
  - Sets deletedAt timestamp
  - Sets status to 'deleted'
  - Deletes associated files
- **Used in**:
  - thread-handler.ts:377
  - project-handler.ts:142

### 10. **duplicateMessage(threadId, messageId)** - POST /threads/:threadId/messages/:messageId/duplicate
- **Purpose**: Create a copy of an existing user message
- **Returns**: New message object
- **Restriction**: Only user messages can be duplicated
- **Status**: ⚠️ Logic exists but method not directly called (inlined in handler)

### 11. **addUserPrompt(threadId, prompt, opts)** - POST /threads/:threadId/user-prompt
- **Purpose**: Add user prompt and optionally create thread
- **Payload**: `{ prompt, title?, description?, model? }`
- **Returns**: Thread + message object
- **Feature**: Creates thread if threadId is null
- **Used in**:
  - thread-handler.ts:492

### 12. **addAssistantResponse(threadId, response, model)** - POST /threads/:threadId/assistant-response
- **Purpose**: Add assistant response to thread
- **Payload**: `{ response, model? }`
- **Returns**: Message object
- **Side effect**: Updates thread metadata with model
- **Used in**:
  - thread-handler.ts:510

### 13. **savePromptAndResponses(threadId, prompt, responses, opts)** - POST /threads/:threadId/prompt-and-responses
- **Purpose**: Atomically save user prompt and multiple assistant responses
- **Payload**: `{ prompt, responses: [{ text, model? }], title?, description? }`
- **Returns**: Thread + prompt message + response messages array
- **Feature**: Creates thread if threadId is null
- **Used in**:
  - thread-handler.ts:534

---

## Methods Used in src (Frontend)

Analysis of which backend methods are actually called from the frontend code:

### ✅ Actively Used (8 methods)

1. **threadService.getAll()** - GET /threads
   - threads/+page.svelte:145
   - projects/+page.svelte:32, 117
   - ChatPane.svelte:780
   - ActivityListSidebar.svelte:227

2. **threadService.getMessages(id)** - GET /threads/:threadId/messages
   - threads/+page.svelte:112, 177
   - message-state-machine.ts:386

3. **threadService.appendMessage(threadId, payload)** - POST /threads/:threadId/messages
   - ChatPane.svelte:253, 351

4. **threadService.update(id, updates)** - PATCH /threads/:threadId
   - threads/+page.svelte:202

5. **threadService.moveToProject(threadId, targetProjectId, options)** - POST /threads/:threadId/move
   - MoveThreadModal.svelte:84

6. **threadService.softDelete(id)** - POST /threads/:threadId/soft-delete
   - ActivityListSidebar.svelte:288, 312

7. **window.electronAPI.thread.addUserPrompt(...)** - POST /threads/:threadId/user-prompt
   - threads/+page.svelte:207

8. **window.electronAPI.thread.savePromptAndResponses(...)** - POST /threads/:threadId/prompt-and-responses
   - ChatPane.svelte:377

### ❌ Not Used (5 methods)

- `threadService.getById()` - Defined but never called
- `threadService.create()` - Defined but never called directly
- `threadService.delete()` - Defined but never called
- `window.electronAPI.thread.addAssistantResponse()` - Never used
- `duplicateMessage()` - Handler exists but not exposed to frontend

### 📡 Event Listeners (WebSocket-like updates)

- `onThreadCreated()` - thread.service.ts:12
- `onThreadUpdated()` - thread.service.ts:16, threads/+page.svelte:108, projects/+page.svelte:38
- `onThreadDeleted()` - thread.service.ts:20, projects/+page.svelte:43
- `onMessageError()` - ChatPane.svelte:493

---

## Recommendations

### Simplify API to 9 Core Methods

The current 13 methods can be reduced to 9 essential methods by eliminating redundant atomic operations (methods 11, 12, 13) and replacing them with a two-step pattern.

#### Core API Methods

1. **GET /threads** - List all thread summaries
2. **GET /threads/:threadId** - Get single thread details
3. **GET /threads/:threadId/messages** - Get messages for a thread
4. **POST /threads/:threadId/messages** - Append message (user or assistant)
5. **POST /threads** - Create new thread
6. **PATCH /threads/:threadId** - Update thread metadata/properties
7. **POST /threads/:threadId/move** - Move thread to/from project
8. **DELETE /threads/:threadId** - Hard delete thread
9. **POST /threads/:threadId/soft-delete** - Soft delete thread

#### Replacement Pattern for Eliminated Methods

**Old Method 11: `addUserPrompt()`**
```javascript
// OLD: Atomic operation
const res = await window.electronAPI.thread.addUserPrompt(null, prompt, { title, description, model });

// NEW: Two-step pattern
const thread = await threadService.create({ title, description, metadata: { model } });
await threadService.appendMessage(thread.id, { role: 'user', content: prompt });
```

**Old Method 12: `addAssistantResponse()`**
```javascript
// OLD: Special method
await window.electronAPI.thread.addAssistantResponse(threadId, response, model);

// NEW: Use standard append
await threadService.appendMessage(threadId, {
  role: 'assistant',
  content: response,
  metadata: { model }
});
```

**Old Method 13: `savePromptAndResponses()`**
```javascript
// OLD: Atomic operation
const saved = await window.electronAPI.thread.savePromptAndResponses(
  null,
  userMessage,
  [{ text: responseText, model: 'llama3:latest' }],
  { title, description }
);

// NEW: Sequential operations
const thread = await threadService.create({ title, description, metadata: { model } });
await threadService.appendMessage(thread.id, { role: 'user', content: userMessage });
await threadService.appendMessage(thread.id, { role: 'assistant', content: responseText });
```

### Benefits of Simplification

1. **Reduced API surface**: 4 fewer endpoints to maintain
2. **Consistent patterns**: Everything uses `appendMessage` for adding content
3. **More flexible**: Can add messages in any order or combination
4. **Simpler backend**: No special-case logic for atomic operations
5. **Clearer semantics**: Each operation does one thing well
6. **Easier testing**: Fewer code paths to test
7. **Better separation**: Thread creation is separate from message management

### Implementation Notes

- The current "atomic" operations (methods 11, 13) aren't truly atomic since they make multiple repository calls anyway
- The two-step pattern provides the same functionality with more flexibility
- Client-side code can add loading states between operations if needed
- The `appendMessage` method already supports idempotency via `clientMessageId`

### Migration Path

1. Add `create()` method calls to frontend where needed
2. Replace `addUserPrompt()` calls with create + append pattern
3. Replace `savePromptAndResponses()` calls with create + multiple appends
4. Remove unused methods from backend once frontend is updated
5. Update tests to use new patterns

---

## Moku Service Thread API Methods

The `MokuService` (src-electron/services/moku.service.ts) needs to be extended with thread management methods that communicate with the Moku API backend. These methods serve as the HTTP client layer between the ThreadRepository cache and the Moku API.

### Required Service Methods

All methods require an `accessToken` parameter for authentication (obtained from `AuthService.getAccessToken()`).

#### 1. **listThreads(accessToken)**

List all thread summaries for the authenticated user.

```typescript
async listThreads(accessToken: string): Promise<ThreadSummary[]>
```

- **HTTP Method**: `GET`
- **Endpoint**: `/api/threads`
- **Headers**: `Authorization: Bearer ${accessToken}`
- **Returns**: Array of thread summaries (without messages)
- **Response**:
  ```json
  [
    {
      "id": "thread_abc123",
      "title": "My Thread",
      "description": "Thread description",
      "status": "active",
      "createdAt": 1234567890000,
      "updatedAt": 1234567890000,
      "metadata": {
        "model": "gpt-4",
        "projectId": "proj_123"
      }
    }
  ]
  ```

#### 2. **getThread(accessToken, threadId)**

Get a single thread by ID with all details.

```typescript
async getThread(accessToken: string, threadId: string): Promise<Thread | null>
```

- **HTTP Method**: `GET`
- **Endpoint**: `/api/threads/${threadId}`
- **Headers**: `Authorization: Bearer ${accessToken}`
- **Returns**: Complete thread object including messages, or null if not found
- **Status Codes**:
  - `200 OK` - Thread found
  - `404 Not Found` - Thread doesn't exist

#### 3. **getThreadMessages(accessToken, threadId)**

Get all messages for a specific thread.

```typescript
async getThreadMessages(accessToken: string, threadId: string): Promise<Message[]>
```

- **HTTP Method**: `GET`
- **Endpoint**: `/api/threads/${threadId}/messages`
- **Headers**: `Authorization: Bearer ${accessToken}`
- **Returns**: Array of messages sorted by createdAt
- **Response**:
  ```json
  [
    {
      "id": "msg_xyz789",
      "threadId": "thread_abc123",
      "role": "user",
      "content": "Hello, how are you?",
      "createdAt": 1234567890000,
      "metadata": {}
    }
  ]
  ```

#### 4. **createThread(accessToken, data)**

Create a new thread.

```typescript
async createThread(accessToken: string, data: {
  title?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}): Promise<Thread>
```

- **HTTP Method**: `POST`
- **Endpoint**: `/api/threads`
- **Headers**: `Authorization: Bearer ${accessToken}`
- **Body**:
  ```json
  {
    "title": "New Thread",
    "description": "Thread description",
    "metadata": {
      "model": "gpt-4",
      "projectId": "proj_123"
    }
  }
  ```
- **Returns**: Created thread object with generated ID

#### 5. **updateThread(accessToken, threadId, updates)**

Update thread metadata and properties.

```typescript
async updateThread(accessToken: string, threadId: string, updates: {
  title?: string;
  description?: string;
  status?: 'active' | 'archived' | 'deleted';
  metadata?: Record<string, unknown>;
}): Promise<Thread>
```

- **HTTP Method**: `PATCH`
- **Endpoint**: `/api/threads/${threadId}`
- **Headers**: `Authorization: Bearer ${accessToken}`
- **Body**: Partial thread updates
- **Returns**: Updated thread object

#### 6. **appendMessage(accessToken, threadId, payload)**

Append a new message to a thread.

```typescript
async appendMessage(accessToken: string, threadId: string, payload: {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
  clientMessageId?: string;
}): Promise<{ message: Message; thread: Thread }>
```

- **HTTP Method**: `POST`
- **Endpoint**: `/api/threads/${threadId}/messages`
- **Headers**: `Authorization: Bearer ${accessToken}`
- **Body**:
  ```json
  {
    "role": "user",
    "content": "Message content",
    "metadata": {
      "model": "gpt-4"
    },
    "clientMessageId": "client_msg_123"
  }
  ```
- **Returns**: Object containing the created message and updated thread
- **Features**:
  - Idempotency via `clientMessageId`
  - Message size validation (8KB limit) on server
- **Status Codes**:
  - `200 OK` - Message created
  - `413 Payload Too Large` - Message exceeds size limit

#### 7. **moveThreadToProject(accessToken, threadId, targetProjectId, options)**

Move a thread to/from a project.

```typescript
async moveThreadToProject(
  accessToken: string,
  threadId: string,
  targetProjectId: string | null,
  options?: {
    privacyMode?: string;
    contextHandling?: string;
  }
): Promise<Thread>
```

- **HTTP Method**: `POST`
- **Endpoint**: `/api/threads/${threadId}/move`
- **Headers**: `Authorization: Bearer ${accessToken}`
- **Body**:
  ```json
  {
    "targetProjectId": "proj_123",
    "privacyMode": "private",
    "contextHandling": "preserve"
  }
  ```
- **Returns**: Updated thread object
- **Note**: Pass `null` for `targetProjectId` to move to general history

#### 8. **softDeleteThread(accessToken, threadId)**

Soft delete a thread (marks as deleted without removing data).

```typescript
async softDeleteThread(accessToken: string, threadId: string): Promise<boolean>
```

- **HTTP Method**: `POST`
- **Endpoint**: `/api/threads/${threadId}/soft-delete`
- **Headers**: `Authorization: Bearer ${accessToken}`
- **Returns**: Boolean indicating success
- **Side Effects**: Sets `deletedAt` timestamp and status to 'deleted'

#### 9. **deleteThread(accessToken, threadId)**

Permanently delete a thread.

```typescript
async deleteThread(accessToken: string, threadId: string): Promise<boolean>
```

- **HTTP Method**: `DELETE`
- **Endpoint**: `/api/threads/${threadId}`
- **Headers**: `Authorization: Bearer ${accessToken}`
- **Returns**: Boolean indicating success
- **Warning**: Permanently removes thread and all associated data

### Implementation Example

```typescript
// src-electron/services/moku.service.ts

export class MokuService {
  private readonly mokuApiBaseUrl: string;

  constructor() {
    this.mokuApiBaseUrl = this.getMokuApiUrl();
    this.seedModels();
  }

  private getMokuApiUrl(): string {
    const settingsService = getSettingsService();
    return settingsService.getMokuApiUrl();
  }

  // Example implementation
  async listThreads(accessToken: string): Promise<ThreadSummary[]> {
    const response = await fetch(`${this.mokuApiBaseUrl}/api/threads`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list threads: ${response.statusText}`);
    }

    return await response.json();
  }

  async appendMessage(
    accessToken: string,
    threadId: string,
    payload: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      metadata?: Record<string, unknown>;
      clientMessageId?: string;
    }
  ): Promise<{ message: Message; thread: Thread }> {
    const response = await fetch(
      `${this.mokuApiBaseUrl}/api/threads/${threadId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      if (response.status === 413) {
        throw new Error('MESSAGE_TOO_LARGE');
      }
      throw new Error(`Failed to append message: ${response.statusText}`);
    }

    return await response.json();
  }

  // ... other methods follow similar pattern
}
```

### Error Handling

All methods should handle common HTTP errors:

- **401 Unauthorized**: Access token invalid or expired
  - Call `authService.getAccessToken()` to refresh
  - Retry request once
- **403 Forbidden**: User doesn't have permission
  - Throw error for handler to catch
- **404 Not Found**: Resource doesn't exist
  - Return `null` for get operations
  - Throw error for update/delete operations
- **413 Payload Too Large**: Message exceeds size limit
  - Throw specific `MESSAGE_TOO_LARGE` error
- **500 Internal Server Error**: Server-side issue
  - Log error and throw

### Type Definitions

```typescript
export interface ThreadSummary {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'archived' | 'deleted';
  createdAt: number;  // epoch ms
  updatedAt: number;  // epoch ms
  metadata?: {
    model?: string;
    projectId?: string;
    [key: string]: unknown;
  };
}

export interface Thread extends ThreadSummary {
  messages: Message[];
  deletedAt?: number | null;
}

export interface Message {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;  // epoch ms
  metadata?: {
    model?: string;
    provider?: string;
    attachments?: Attachment[];
    [key: string]: unknown;
  };
  clientMessageId?: string;
  deletedAt?: number | null;
}
```

---

## Thread Repository Caching Architecture

The `ThreadRepository` (src-electron/repository/thread-repository.ts) should implement a **caching layer** that sits between the IPC handlers and the Moku API. This provides performance benefits and reduces unnecessary API calls.

### Design Principles

1. **Cache-first**: Always check in-memory cache before calling Moku API
2. **Lazy loading**: Only load data from API when requested and not in cache
3. **Write-through**: All mutations (create/update/delete) call API then update cache
4. **Separate message caching**: Messages cached independently by threadId for efficient loading

### Cache Structure

```typescript
export class ThreadRepository {
  // In-memory caches
  private readonly threadsById: Map<string, Thread> = new Map();
  private readonly messagesByThreadId: Map<string, Message[]> = new Map();
  private readonly idempotencyIndex: Map<string, Map<string, string>> = new Map();
  private cacheLoaded: boolean = false;

  constructor() {
    // No disk loading - will load from Moku API on demand
  }
}
```

### Method Implementations

#### Read Operations (Cache-first)

**listThreads()**
```typescript
public async listThreads(): Promise<Thread[]> {
  // If cache not loaded, fetch all threads from API
  if (!this.cacheLoaded) {
    await this.loadThreadsFromApi();
  }

  // Return from cache
  return Array.from(this.threadsById.values())
    .filter((t) => !t.deletedAt && t.metadata?.status !== 'deleted')
    .map((t) => this.cloneThread(t))
    .sort((a, b) => b.createdAt - a.createdAt);
}

private async loadThreadsFromApi(): Promise<void> {
  const accessToken = await this.getAccessToken();
  const threads = await mokuService.listThreads(accessToken);

  // Populate cache
  this.threadsById.clear();
  for (const thread of threads) {
    this.threadsById.set(thread.id, thread);
  }

  this.cacheLoaded = true;
}
```

**loadThread(threadId)**
```typescript
public async loadThread(threadId: string): Promise<Thread | null> {
  // Check cache first
  if (this.threadsById.has(threadId)) {
    return this.cloneThread(this.threadsById.get(threadId)!);
  }

  // Not in cache, fetch from API
  const accessToken = await this.getAccessToken();
  const thread = await mokuService.getThread(accessToken, threadId);

  if (thread) {
    // Store in cache
    this.threadsById.set(thread.id, thread);
    if (thread.messages) {
      this.messagesByThreadId.set(thread.id, [...thread.messages]);
    }
  }

  return thread ? this.cloneThread(thread) : null;
}
```

**getMessages(threadId)**
```typescript
public async getMessages(threadId: string): Promise<Message[]> {
  // Check if messages are cached
  if (this.messagesByThreadId.has(threadId)) {
    return this.messagesByThreadId.get(threadId)!
      .filter((m) => !m.deletedAt)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((m) => ({ ...m }));
  }

  // Not in cache, fetch from API
  const accessToken = await this.getAccessToken();
  const messages = await mokuService.getThreadMessages(accessToken, threadId);

  // Cache the messages
  this.messagesByThreadId.set(threadId, messages);

  return messages
    .filter((m) => !m.deletedAt)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((m) => ({ ...m }));
}
```

#### Write Operations (Write-through)

**createThread(metadata)**
```typescript
public async createThread(metadata: ThreadMetadata): Promise<Thread> {
  const accessToken = await this.getAccessToken();

  // Create via API
  const thread = await mokuService.createThread(accessToken, {
    title: metadata.title,
    description: metadata.description,
    metadata: metadata,
  });

  // Add to cache
  this.threadsById.set(thread.id, thread);
  this.messagesByThreadId.set(thread.id, []);

  return this.cloneThread(thread);
}
```

**appendMessage(threadId, payload)**
```typescript
public async appendMessage(
  threadId: string,
  payload: {
    role: MessageRole;
    content: string;
    metadata?: Record<string, unknown>;
    clientMessageId?: string;
  }
): Promise<Message> {
  const accessToken = await this.getAccessToken();

  // Check idempotency in cache
  if (payload.clientMessageId) {
    const byThread = this.idempotencyIndex.get(threadId);
    const existingId = byThread?.get(payload.clientMessageId);
    if (existingId) {
      const messages = this.messagesByThreadId.get(threadId) || [];
      const found = messages.find((m) => m.id === existingId);
      if (found) return { ...found };
    }
  }

  // Call API
  const result = await mokuService.appendMessage(accessToken, threadId, payload);

  // Update cache
  this.threadsById.set(result.thread.id, result.thread);

  const messages = this.messagesByThreadId.get(threadId) || [];
  messages.push(result.message);
  this.messagesByThreadId.set(threadId, messages);

  // Update idempotency index
  if (payload.clientMessageId) {
    if (!this.idempotencyIndex.has(threadId)) {
      this.idempotencyIndex.set(threadId, new Map());
    }
    this.idempotencyIndex.get(threadId)!.set(payload.clientMessageId, result.message.id);
  }

  return { ...result.message };
}
```

**updateThreadMetadata(threadId, updates)**
```typescript
public async updateThreadMetadata(
  threadId: string,
  updates: Partial<ThreadMetadata>
): Promise<Thread> {
  const accessToken = await this.getAccessToken();

  // Update via API
  const updatedThread = await mokuService.updateThread(accessToken, threadId, {
    metadata: updates,
  });

  // Update cache
  this.threadsById.set(threadId, updatedThread);

  return this.cloneThread(updatedThread);
}
```

**softDeleteThread(threadId)**
```typescript
public async softDeleteThread(threadId: string): Promise<boolean> {
  const accessToken = await this.getAccessToken();

  // Delete via API
  const success = await mokuService.softDeleteThread(accessToken, threadId);

  if (success) {
    // Update cache
    const thread = this.threadsById.get(threadId);
    if (thread) {
      thread.deletedAt = Date.now();
      thread.metadata = { ...thread.metadata, status: 'deleted' };
      this.threadsById.set(threadId, thread);
    }
  }

  return success;
}
```

**deleteThread(threadId)**
```typescript
public async deleteThread(threadId: string): Promise<boolean> {
  const accessToken = await this.getAccessToken();

  // Delete via API
  const success = await mokuService.deleteThread(accessToken, threadId);

  if (success) {
    // Remove from cache
    this.threadsById.delete(threadId);
    this.messagesByThreadId.delete(threadId);
    this.idempotencyIndex.delete(threadId);
  }

  return success;
}
```

### Authentication Helper

```typescript
private async getAccessToken(): Promise<string> {
  const auth = getAuthService();
  if (!auth.isAuthenticated()) {
    throw new Error('Not authenticated');
  }
  return await auth.getAccessToken(); // Auto-refreshes if expired
}
```

### Cache Management

```typescript
// Clear cache (called on logout)
public clearCache(): void {
  this.threadsById.clear();
  this.messagesByThreadId.clear();
  this.idempotencyIndex.clear();
  this.cacheLoaded = false;
}
```

### Benefits

✅ **Performance**: No API call if data is already cached
✅ **Reduced latency**: Instant response for cached data
✅ **Offline-aware**: Can show cached data if API temporarily unavailable
✅ **Consistency**: All writes go through API to maintain sync
✅ **Simple interface**: Handler code doesn't change - same methods as before
✅ **Memory efficient**: Messages loaded on-demand per thread
✅ **Idempotency preserved**: Prevents duplicate messages via in-memory index

### Flow Diagrams

**First List Request:**
```
Frontend → IPC Handler → ThreadRepository.listThreads()
                         ↓ (cache empty)
                         → Moku API GET /threads
                         ↓ (store in cache)
                         → Return threads
```

**Subsequent List Request:**
```
Frontend → IPC Handler → ThreadRepository.listThreads()
                         ↓ (cache loaded)
                         → Return from cache (no API call)
```

**Create Thread:**
```
Frontend → IPC Handler → ThreadRepository.createThread()
                         ↓
                         → Moku API POST /threads
                         ↓ (success)
                         → Update cache
                         → Return thread
```

**Get Messages (first time):**
```
Frontend → IPC Handler → ThreadRepository.getMessages(threadId)
                         ↓ (messages not cached)
                         → Moku API GET /threads/:id/messages
                         ↓ (store in cache)
                         → Return messages
```

---

## Moku API Backend Implementation

This section describes the backend implementation needed in the Moku API (Java/Spring Boot) to support the thread and project management features required by the desktop application.

### Architecture Overview

```
Desktop App (Electron)
    ↓
MokuService (HTTP Client)
    ↓
Moku API (Spring Boot)
    ↓
DesktopController → DesktopThreadService → ThreadRepository
                                        → ProjectRepository
```

### Layer Responsibilities

1. **Controller Layer** - HTTP endpoint handling, request validation, response formatting
2. **Service Layer** - Business logic, authorization, transaction management
3. **Repository Layer** - Database operations, entity management
4. **DTO Layer** - Data transfer objects for API requests/responses

---

### Controller Layer

#### DesktopThreadController

Handles all thread-related HTTP endpoints for the desktop application.

```java
package ai.holok.moku.controller;

import ai.holok.moku.dto.desktop.*;
import ai.holok.moku.service.DesktopThreadService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/threads")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Desktop Threads", description = "Thread management endpoints for desktop application")
@PreAuthorize("hasRole('USER') or hasRole('ADMIN')")
public class DesktopThreadController {

    private final DesktopThreadService threadService;

    @GetMapping
    @Operation(summary = "List all threads for current user")
    public ResponseEntity<List<ThreadSummaryDTO>> listThreads(Authentication authentication) {
        log.info("List threads request from user: {}", authentication.getName());
        List<ThreadSummaryDTO> threads = threadService.listThreadsForUser(authentication);
        return ResponseEntity.ok(threads);
    }

    @GetMapping("/{threadId}")
    @Operation(summary = "Get single thread by ID")
    public ResponseEntity<ThreadDetailDTO> getThread(
            @PathVariable UUID threadId,
            Authentication authentication) {
        log.info("Get thread request: threadId={}, user={}", threadId, authentication.getName());
        ThreadDetailDTO thread = threadService.getThreadById(threadId, authentication);
        return ResponseEntity.ok(thread);
    }

    @GetMapping("/{threadId}/messages")
    @Operation(summary = "Get all messages for a thread")
    public ResponseEntity<List<MessageDTO>> getThreadMessages(
            @PathVariable UUID threadId,
            Authentication authentication) {
        log.info("Get messages request: threadId={}, user={}", threadId, authentication.getName());
        List<MessageDTO> messages = threadService.getMessagesForThread(threadId, authentication);
        return ResponseEntity.ok(messages);
    }

    @PostMapping
    @Operation(summary = "Create a new thread")
    public ResponseEntity<ThreadDetailDTO> createThread(
            @Valid @RequestBody CreateThreadRequestDTO request,
            Authentication authentication) {
        log.info("Create thread request from user: {}", authentication.getName());
        ThreadDetailDTO thread = threadService.createThread(request, authentication);
        return ResponseEntity.status(HttpStatus.CREATED).body(thread);
    }

    @PatchMapping("/{threadId}")
    @Operation(summary = "Update thread metadata")
    public ResponseEntity<ThreadDetailDTO> updateThread(
            @PathVariable UUID threadId,
            @Valid @RequestBody UpdateThreadRequestDTO request,
            Authentication authentication) {
        log.info("Update thread request: threadId={}, user={}", threadId, authentication.getName());
        ThreadDetailDTO thread = threadService.updateThread(threadId, request, authentication);
        return ResponseEntity.ok(thread);
    }

    @PostMapping("/{threadId}/messages")
    @Operation(summary = "Append message to thread")
    public ResponseEntity<AppendMessageResponseDTO> appendMessage(
            @PathVariable UUID threadId,
            @Valid @RequestBody AppendMessageRequestDTO request,
            Authentication authentication) {
        log.info("Append message request: threadId={}, user={}", threadId, authentication.getName());
        AppendMessageResponseDTO response = threadService.appendMessage(threadId, request, authentication);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{threadId}/move")
    @Operation(summary = "Move thread to/from project")
    public ResponseEntity<ThreadDetailDTO> moveThreadToProject(
            @PathVariable UUID threadId,
            @Valid @RequestBody MoveThreadRequestDTO request,
            Authentication authentication) {
        log.info("Move thread request: threadId={}, targetProjectId={}, user={}",
                threadId, request.getTargetProjectId(), authentication.getName());
        ThreadDetailDTO thread = threadService.moveThreadToProject(threadId, request, authentication);
        return ResponseEntity.ok(thread);
    }

    @PostMapping("/{threadId}/soft-delete")
    @Operation(summary = "Soft delete thread")
    public ResponseEntity<Void> softDeleteThread(
            @PathVariable UUID threadId,
            Authentication authentication) {
        log.info("Soft delete thread request: threadId={}, user={}", threadId, authentication.getName());
        threadService.softDeleteThread(threadId, authentication);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{threadId}")
    @Operation(summary = "Permanently delete thread")
    public ResponseEntity<Void> deleteThread(
            @PathVariable UUID threadId,
            Authentication authentication) {
        log.info("Delete thread request: threadId={}, user={}", threadId, authentication.getName());
        threadService.deleteThread(threadId, authentication);
        return ResponseEntity.ok().build();
    }
}
```

#### DesktopProjectController

Handles project-related HTTP endpoints (if needed for thread organization).

```java
package ai.holok.moku.controller;

import ai.holok.moku.dto.desktop.*;
import ai.holok.moku.service.DesktopProjectService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Desktop Projects", description = "Project management endpoints for desktop application")
@PreAuthorize("hasRole('USER') or hasRole('ADMIN')")
public class DesktopProjectController {

    private final DesktopProjectService projectService;

    @GetMapping
    @Operation(summary = "List all projects for current user")
    public ResponseEntity<List<ProjectSummaryDTO>> listProjects(Authentication authentication) {
        List<ProjectSummaryDTO> projects = projectService.listProjectsForUser(authentication);
        return ResponseEntity.ok(projects);
    }

    @GetMapping("/{projectId}/threads")
    @Operation(summary = "Get thread count for a project")
    public ResponseEntity<ProjectThreadCountDTO> getProjectThreadCount(
            @PathVariable UUID projectId,
            Authentication authentication) {
        ProjectThreadCountDTO count = projectService.getThreadCountForProject(projectId, authentication);
        return ResponseEntity.ok(count);
    }
}
```

---

### Service Layer

#### DesktopThreadService

Business logic for thread operations with authorization checks.

```java
package ai.holok.moku.service;

import ai.holok.moku.dto.desktop.*;
import ai.holok.moku.model.DesktopThread;
import ai.holok.moku.model.DesktopMessage;
import ai.holok.moku.model.User;
import ai.holok.moku.repository.DesktopThreadRepository;
import ai.holok.moku.repository.DesktopMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityNotFoundException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DesktopThreadService {

    private final DesktopThreadRepository threadRepository;
    private final DesktopMessageRepository messageRepository;
    private final UserService userService;

    @Transactional(readOnly = true)
    public List<ThreadSummaryDTO> listThreadsForUser(Authentication authentication) {
        User user = userService.getUserFromAuthentication(authentication);

        List<DesktopThread> threads = threadRepository.findByUserIdAndDeletedAtIsNull(user.getId());

        return threads.stream()
                .map(this::toThreadSummaryDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ThreadDetailDTO getThreadById(UUID threadId, Authentication authentication) {
        User user = userService.getUserFromAuthentication(authentication);

        DesktopThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new EntityNotFoundException("Thread not found: " + threadId));

        // Authorization check
        if (!thread.getUserId().equals(user.getId())) {
            throw new SecurityException("Access denied to thread: " + threadId);
        }

        return toThreadDetailDTO(thread);
    }

    @Transactional(readOnly = true)
    public List<MessageDTO> getMessagesForThread(UUID threadId, Authentication authentication) {
        User user = userService.getUserFromAuthentication(authentication);

        DesktopThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new EntityNotFoundException("Thread not found: " + threadId));

        // Authorization check
        if (!thread.getUserId().equals(user.getId())) {
            throw new SecurityException("Access denied to thread: " + threadId);
        }

        List<DesktopMessage> messages = messageRepository.findByThreadIdAndDeletedAtIsNullOrderByCreatedAtAsc(threadId);

        return messages.stream()
                .map(this::toMessageDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public ThreadDetailDTO createThread(CreateThreadRequestDTO request, Authentication authentication) {
        User user = userService.getUserFromAuthentication(authentication);

        DesktopThread thread = new DesktopThread();
        thread.setId(UUID.randomUUID());
        thread.setUserId(user.getId());
        thread.setTitle(request.getTitle() != null ? request.getTitle() : "");
        thread.setDescription(request.getDescription());
        thread.setStatus("active");
        thread.setMetadata(request.getMetadata());
        thread.setCreatedAt(Instant.now());
        thread.setUpdatedAt(Instant.now());

        thread = threadRepository.save(thread);
        log.info("Created thread: threadId={}, userId={}", thread.getId(), user.getId());

        return toThreadDetailDTO(thread);
    }

    @Transactional
    public ThreadDetailDTO updateThread(UUID threadId, UpdateThreadRequestDTO request, Authentication authentication) {
        User user = userService.getUserFromAuthentication(authentication);

        DesktopThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new EntityNotFoundException("Thread not found: " + threadId));

        // Authorization check
        if (!thread.getUserId().equals(user.getId())) {
            throw new SecurityException("Access denied to thread: " + threadId);
        }

        // Update fields
        if (request.getTitle() != null) {
            thread.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            thread.setDescription(request.getDescription());
        }
        if (request.getStatus() != null) {
            thread.setStatus(request.getStatus());
        }
        if (request.getMetadata() != null) {
            // Merge metadata
            Map<String, Object> metadata = thread.getMetadata();
            if (metadata == null) {
                metadata = request.getMetadata();
            } else {
                metadata.putAll(request.getMetadata());
            }
            thread.setMetadata(metadata);
        }
        thread.setUpdatedAt(Instant.now());

        thread = threadRepository.save(thread);
        log.info("Updated thread: threadId={}", threadId);

        return toThreadDetailDTO(thread);
    }

    @Transactional
    public AppendMessageResponseDTO appendMessage(UUID threadId, AppendMessageRequestDTO request, Authentication authentication) {
        User user = userService.getUserFromAuthentication(authentication);

        DesktopThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new EntityNotFoundException("Thread not found: " + threadId));

        // Authorization check
        if (!thread.getUserId().equals(user.getId())) {
            throw new SecurityException("Access denied to thread: " + threadId);
        }

        // Check for idempotency
        if (request.getClientMessageId() != null) {
            DesktopMessage existing = messageRepository.findByThreadIdAndClientMessageId(
                    threadId, request.getClientMessageId());
            if (existing != null) {
                log.info("Idempotent message request: returning existing message={}", existing.getId());
                return new AppendMessageResponseDTO(toMessageDTO(existing), toThreadSummaryDTO(thread));
            }
        }

        // Validate message size (8KB limit)
        if (request.getContent().getBytes().length > 8 * 1024) {
            throw new IllegalArgumentException("MESSAGE_TOO_LARGE");
        }

        // Create message
        DesktopMessage message = new DesktopMessage();
        message.setId(UUID.randomUUID());
        message.setThreadId(threadId);
        message.setRole(request.getRole());
        message.setContent(request.getContent());
        message.setMetadata(request.getMetadata());
        message.setClientMessageId(request.getClientMessageId());
        message.setCreatedAt(Instant.now());

        message = messageRepository.save(message);

        // Update thread timestamp
        thread.setUpdatedAt(Instant.now());
        thread = threadRepository.save(thread);

        log.info("Appended message: messageId={}, threadId={}, role={}",
                message.getId(), threadId, request.getRole());

        return new AppendMessageResponseDTO(toMessageDTO(message), toThreadSummaryDTO(thread));
    }

    @Transactional
    public ThreadDetailDTO moveThreadToProject(UUID threadId, MoveThreadRequestDTO request, Authentication authentication) {
        User user = userService.getUserFromAuthentication(authentication);

        DesktopThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new EntityNotFoundException("Thread not found: " + threadId));

        // Authorization check
        if (!thread.getUserId().equals(user.getId())) {
            throw new SecurityException("Access denied to thread: " + threadId);
        }

        // Update metadata with project ID
        Map<String, Object> metadata = thread.getMetadata();
        if (request.getTargetProjectId() == null) {
            metadata.remove("projectId");
        } else {
            metadata.put("projectId", request.getTargetProjectId().toString());
        }

        if (request.getPrivacyMode() != null) {
            metadata.put("privacyMode", request.getPrivacyMode());
        }
        if (request.getContextHandling() != null) {
            metadata.put("contextHandling", request.getContextHandling());
        }

        thread.setMetadata(metadata);
        thread.setUpdatedAt(Instant.now());
        thread = threadRepository.save(thread);

        log.info("Moved thread: threadId={}, projectId={}", threadId, request.getTargetProjectId());

        return toThreadDetailDTO(thread);
    }

    @Transactional
    public void softDeleteThread(UUID threadId, Authentication authentication) {
        User user = userService.getUserFromAuthentication(authentication);

        DesktopThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new EntityNotFoundException("Thread not found: " + threadId));

        // Authorization check
        if (!thread.getUserId().equals(user.getId())) {
            throw new SecurityException("Access denied to thread: " + threadId);
        }

        thread.setDeletedAt(Instant.now());
        thread.setStatus("deleted");
        thread.setUpdatedAt(Instant.now());
        threadRepository.save(thread);

        log.info("Soft deleted thread: threadId={}", threadId);
    }

    @Transactional
    public void deleteThread(UUID threadId, Authentication authentication) {
        User user = userService.getUserFromAuthentication(authentication);

        DesktopThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new EntityNotFoundException("Thread not found: " + threadId));

        // Authorization check
        if (!thread.getUserId().equals(user.getId())) {
            throw new SecurityException("Access denied to thread: " + threadId);
        }

        // Delete all messages first
        messageRepository.deleteByThreadId(threadId);

        // Delete thread
        threadRepository.delete(thread);

        log.info("Permanently deleted thread: threadId={}", threadId);
    }

    // DTO conversion methods
    private ThreadSummaryDTO toThreadSummaryDTO(DesktopThread thread) {
        return ThreadSummaryDTO.builder()
                .id(thread.getId())
                .title(thread.getTitle())
                .description(thread.getDescription())
                .status(thread.getStatus())
                .createdAt(thread.getCreatedAt().toEpochMilli())
                .updatedAt(thread.getUpdatedAt().toEpochMilli())
                .metadata(thread.getMetadata())
                .build();
    }

    private ThreadDetailDTO toThreadDetailDTO(DesktopThread thread) {
        List<DesktopMessage> messages = messageRepository.findByThreadIdAndDeletedAtIsNullOrderByCreatedAtAsc(thread.getId());

        return ThreadDetailDTO.builder()
                .id(thread.getId())
                .title(thread.getTitle())
                .description(thread.getDescription())
                .status(thread.getStatus())
                .createdAt(thread.getCreatedAt().toEpochMilli())
                .updatedAt(thread.getUpdatedAt().toEpochMilli())
                .deletedAt(thread.getDeletedAt() != null ? thread.getDeletedAt().toEpochMilli() : null)
                .metadata(thread.getMetadata())
                .messages(messages.stream().map(this::toMessageDTO).collect(Collectors.toList()))
                .build();
    }

    private MessageDTO toMessageDTO(DesktopMessage message) {
        return MessageDTO.builder()
                .id(message.getId())
                .threadId(message.getThreadId())
                .role(message.getRole())
                .content(message.getContent())
                .createdAt(message.getCreatedAt().toEpochMilli())
                .metadata(message.getMetadata())
                .clientMessageId(message.getClientMessageId())
                .deletedAt(message.getDeletedAt() != null ? message.getDeletedAt().toEpochMilli() : null)
                .build();
    }
}
```

---

### Repository Layer

```java
package ai.holok.moku.repository;

import ai.holok.moku.model.DesktopThread;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DesktopThreadRepository extends JpaRepository<DesktopThread, UUID> {

    List<DesktopThread> findByUserIdAndDeletedAtIsNull(UUID userId);

    List<DesktopThread> findByUserId(UUID userId);
}
```

```java
package ai.holok.moku.repository;

import ai.holok.moku.model.DesktopMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DesktopMessageRepository extends JpaRepository<DesktopMessage, UUID> {

    List<DesktopMessage> findByThreadIdAndDeletedAtIsNullOrderByCreatedAtAsc(UUID threadId);

    DesktopMessage findByThreadIdAndClientMessageId(UUID threadId, String clientMessageId);

    void deleteByThreadId(UUID threadId);
}
```

---

### Entity Models

```java
package ai.holok.moku.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "desktop_threads")
@Data
public class DesktopThread {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private String status; // active, archived, deleted

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
```

```java
package ai.holok.moku.model;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "desktop_messages")
@Data
public class DesktopMessage {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "thread_id", nullable = false, columnDefinition = "uuid")
    private UUID threadId;

    @Column(nullable = false)
    private String role; // user, assistant, system

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @Column(name = "client_message_id")
    private String clientMessageId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
```

---

### DTO Classes

```java
package ai.holok.moku.dto.desktop;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ThreadSummaryDTO {
    private UUID id;
    private String title;
    private String description;
    private String status;
    private Long createdAt;  // epoch milliseconds
    private Long updatedAt;  // epoch milliseconds
    private Map<String, Object> metadata;
}
```

```java
package ai.holok.moku.dto.desktop;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ThreadDetailDTO {
    private UUID id;
    private String title;
    private String description;
    private String status;
    private Long createdAt;
    private Long updatedAt;
    private Long deletedAt;
    private Map<String, Object> metadata;
    private List<MessageDTO> messages;
}
```

```java
package ai.holok.moku.dto.desktop;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageDTO {
    private UUID id;
    private UUID threadId;
    private String role;
    private String content;
    private Long createdAt;
    private Map<String, Object> metadata;
    private String clientMessageId;
    private Long deletedAt;
}
```

```java
package ai.holok.moku.dto.desktop;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Map;

@Data
public class CreateThreadRequestDTO {
    @Size(max = 255)
    private String title;

    @Size(max = 1000)
    private String description;

    private Map<String, Object> metadata;
}
```

```java
package ai.holok.moku.dto.desktop;

import lombok.Data;

import java.util.Map;

@Data
public class UpdateThreadRequestDTO {
    private String title;
    private String description;
    private String status;
    private Map<String, Object> metadata;
}
```

```java
package ai.holok.moku.dto.desktop;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.util.Map;

@Data
public class AppendMessageRequestDTO {
    @NotBlank
    @Pattern(regexp = "user|assistant|system")
    private String role;

    @NotBlank
    private String content;

    private Map<String, Object> metadata;

    private String clientMessageId;
}
```

```java
package ai.holok.moku.dto.desktop;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AppendMessageResponseDTO {
    private MessageDTO message;
    private ThreadSummaryDTO thread;
}
```

```java
package ai.holok.moku.dto.desktop;

import lombok.Data;

import java.util.UUID;

@Data
public class MoveThreadRequestDTO {
    private UUID targetProjectId;
    private String privacyMode;
    private String contextHandling;
}
```

---

### Database Schema

#### Database Migration (Flyway)

The database schema should be created using Flyway migrations for version control and reproducibility.

**File**: `src/main/resources/db/migration/V{VERSION}__create_desktop_threads_tables.sql`

Replace `{VERSION}` with the appropriate version number (e.g., `V1.15` if the last migration was `V1.14`).

```sql
-- ============================================================================
-- Desktop Threads and Messages Tables
-- ============================================================================
-- Description: Creates tables for desktop application thread management
-- Author: [Your Name]
-- Date: [Current Date]
-- Version: V{VERSION}
-- ============================================================================

-- Desktop Threads Table
-- Stores conversation threads for desktop application users
CREATE TABLE desktop_threads (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,

    CONSTRAINT desktop_threads_status_check CHECK (status IN ('active', 'archived', 'deleted')),
    CONSTRAINT fk_desktop_threads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for desktop_threads
CREATE INDEX idx_desktop_threads_user_id ON desktop_threads(user_id);

-- Comment on table
COMMENT ON TABLE desktop_threads IS 'Conversation threads for desktop application';
COMMENT ON COLUMN desktop_threads.id IS 'Unique thread identifier';
COMMENT ON COLUMN desktop_threads.user_id IS 'User who owns this thread';
COMMENT ON COLUMN desktop_threads.title IS 'Thread title/name';
COMMENT ON COLUMN desktop_threads.description IS 'Optional thread description';
COMMENT ON COLUMN desktop_threads.status IS 'Thread status: active, archived, or deleted';
COMMENT ON COLUMN desktop_threads.metadata IS 'Flexible metadata storage (model, projectId, etc.)';
COMMENT ON COLUMN desktop_threads.created_at IS 'Timestamp when thread was created';
COMMENT ON COLUMN desktop_threads.updated_at IS 'Timestamp of last update';
COMMENT ON COLUMN desktop_threads.deleted_at IS 'Soft delete timestamp (NULL if not deleted)';

-- Desktop Messages Table
-- Stores individual messages within threads
CREATE TABLE desktop_messages (
    id UUID PRIMARY KEY,
    thread_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    client_message_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,

    CONSTRAINT desktop_messages_role_check CHECK (role IN ('user', 'assistant', 'system')),
    CONSTRAINT fk_desktop_messages_thread FOREIGN KEY (thread_id) REFERENCES desktop_threads(id) ON DELETE CASCADE
);

-- Indexes for desktop_messages
CREATE INDEX idx_desktop_messages_thread_id ON desktop_messages(thread_id);

-- Comment on table
COMMENT ON TABLE desktop_messages IS 'Messages within desktop application threads';
COMMENT ON COLUMN desktop_messages.id IS 'Unique message identifier';
COMMENT ON COLUMN desktop_messages.thread_id IS 'Thread this message belongs to';
COMMENT ON COLUMN desktop_messages.role IS 'Message role: user, assistant, or system';
COMMENT ON COLUMN desktop_messages.content IS 'Message content/text';
COMMENT ON COLUMN desktop_messages.metadata IS 'Flexible metadata storage (model, provider, attachments, etc.)';
COMMENT ON COLUMN desktop_messages.client_message_id IS 'Client-provided ID for idempotency';
COMMENT ON COLUMN desktop_messages.created_at IS 'Timestamp when message was created';
COMMENT ON COLUMN desktop_messages.deleted_at IS 'Soft delete timestamp (NULL if not deleted)';

-- ============================================================================
-- End of migration
-- ============================================================================
```

#### Flyway Migration Notes

1. **Version Numbering**: Follow your project's versioning convention (e.g., `V1.15`, `V2.0`, etc.)
2. **Naming Convention**: `V{VERSION}__{description}.sql` (use double underscore)
3. **Idempotency**: Flyway ensures migrations run only once
4. **Rollback**: Create corresponding `U{VERSION}__rollback_desktop_threads.sql` if needed:

```sql
-- Rollback migration (if needed)
-- File: U{VERSION}__rollback_desktop_threads.sql

DROP TABLE IF EXISTS desktop_messages CASCADE;
DROP TABLE IF EXISTS desktop_threads CASCADE;
```

5. **Testing**: Test migration on local/dev database before production:
```bash
# Validate migration
./gradlew flywayValidate

# Run migration
./gradlew flywayMigrate

# Check migration status
./gradlew flywayInfo
```

6. **Dependencies**: Ensure `users` table exists before running this migration
7. **Baseline**: If adding to existing database, may need to baseline:
```bash
./gradlew flywayBaseline
```

#### Schema Verification Queries

After migration, verify tables were created correctly:

```sql
-- Check tables exist
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('desktop_threads', 'desktop_messages');

-- Check indexes
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE tablename IN ('desktop_threads', 'desktop_messages')
ORDER BY tablename, indexname;

-- Check constraints
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN (
    SELECT oid FROM pg_class
    WHERE relname IN ('desktop_threads', 'desktop_messages')
);

-- Check JSONB column support
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('desktop_threads', 'desktop_messages')
  AND data_type = 'jsonb';
```

---

### Key Design Decisions

1. **Separate Tables**: `desktop_threads` and `desktop_messages` for clean separation
2. **UUID Primary Keys**: For distributed systems and security
3. **JSONB Metadata**: Flexible storage for extensibility without schema changes
4. **Soft Deletes**: `deletedAt` timestamp for recovery and audit trail
5. **Idempotency**: `clientMessageId` index for preventing duplicate messages
6. **Cascade Deletes**: Foreign key constraints ensure data integrity
7. **Authorization**: Service layer checks user ownership on all operations
8. **Transaction Management**: `@Transactional` ensures atomic operations
9. **Epoch Timestamps**: DTOs use epoch milliseconds for JavaScript compatibility
10. **Validation**: Bean validation annotations on request DTOs

---

## Data Structures

The application uses different TypeScript interfaces at different layers:

### Backend Internal Thread (src-electron/repository/thread-repository.ts)
```typescript
interface Thread {
  id: string;
  title: string;
  metadata: ThreadMetadata;  // Required object
  messages: Message[];       // Includes full message array
  createdAt: number;         // Epoch milliseconds
  updatedAt: number;         // Epoch milliseconds
  deletedAt?: number | null;
}

interface ThreadMetadata {
  title?: string;
  description?: string;
  model?: string;
  projectId?: string;
  userId?: string;
  status?: 'active' | 'archived' | 'deleted';
  [key: string]: unknown;
}
```

### IPC/Renderer Thread (src-electron/preload.ts, used by frontend)
```typescript
interface Thread {
  id: string;
  title: string;             // Flattened from metadata
  description: string;       // Flattened from metadata
  status: ThreadStatus;      // Flattened from metadata
  createdAt: Date;           // Date objects (converted from epoch ms)
  updatedAt: Date;           // Date objects
  metadata?: Record<string, unknown>;  // Optional catch-all for other fields
}
```

**Note**: The `toRendererThread()` function in thread-handler.ts converts between these representations.

### Backend Internal Message (src-electron/repository/thread-repository.ts)
```typescript
interface Message {
  id: string;
  threadId: string;          // Reference to parent thread
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;         // Epoch milliseconds
  metadata?: MessageMetadata;
  clientMessageId?: string;
  deletedAt?: number | null;
}
```

### Frontend Message (src/lib/types/thread.type.ts)
```typescript
interface Message {
  id: string;
  clientMessageId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;         // Epoch milliseconds
  status?: MessageStatus;    // Frontend-specific state
  attemptCount?: number;     // Frontend-specific retry tracking
  metadata?: MessageMetadata;
}
```

### MessageMetadata (src-shared/types/attachment.types.ts)
```typescript
interface MessageMetadata {
  attachments?: Attachment[];
  provider?: string;         // e.g., 'ollama', 'anthropic'
  model?: string;            // e.g., 'llama3:latest', 'claude-3-opus'
  [key: string]: unknown;
}
```

---

## Additional Considerations

### Authorization
- All operations require authentication checks
- Thread ownership validation via metadata.userId
- Project access validation for move operations

### File Management
- Thread deletion (hard and soft) should clean up associated files
- File storage is handled via `fileStorageService`

### Idempotency
- `appendMessage` supports idempotency via `clientMessageId`
- Prevents duplicate messages on retry/network issues

### Size Limits
- Message content limited to 8KB
- Validation happens in `appendMessage`

# Thread Management Architecture

## Overview

This document describes the thread management architecture for the Holokai Desktop application. The architecture follows a **separation of concerns** pattern where:

- **Holo API** - Single source of truth for prompt execution and persistence
- **Moku API** - Provides read access to threads/messages and organizational operations
- **Desktop App** - Generates thread IDs, submits prompts, manages local cache

## Architecture Flow

```
Desktop App
    ↓ (generates threadId)
    ↓ (submits prompt via ChatService)
    ↓
Holo API (chat endpoint)
    ↓ (executes LLM prompt)
    ↓ (saves request + response to Postgres)
    ↓
Shared Database (Postgres)
    ↓
Moku API (read access)
    ↓ (desktop reads threads/messages)
    ↓ (desktop performs organizational operations)
Desktop App (displays + caches)
```

## Architecture Flow

```
Desktop App
    ↓ (generates threadId)
    ↓ (submits prompt via ChatService)
    ↓
Holo API (chat endpoint)
    ↓ (executes LLM prompt)
    ↓ (saves request + response to Postgres)
    ↓
Shared Database (Postgres)
    ↓
Moku API (read access)
    ↓ (desktop reads threads/messages)
    ↓ (desktop performs organizational operations)
Desktop App (displays + caches)
```

## Thread ID Generation

### Desktop-Generated UUIDs

The desktop application generates thread IDs locally using UUID v4 (random):

```typescript
import { randomUUID } from 'crypto';

// Generate new thread ID
const threadId = randomUUID(); // e.g., "550e8400-e29b-41d4-a716-446655440000"
```

**Benefits:**

- ✅ No API call needed to start a conversation
- ✅ Works offline (can queue prompts)
- ✅ Globally unique (collision probability ~1 in 2^122)
- ✅ Desktop controls threadId from the start

**Implementation Location:**
`src-electron/repository/thread-repository.ts`

```typescript
public createNewThreadId(): string {
  return randomUUID();
}
```

---

## Prompt Submission Flow

### Step 1: Desktop Generates Thread ID

```typescript
// In ThreadRepository or handler
const threadId = randomUUID();
```

### Step 2: Desktop Submits to Holo API

Uses the **existing ChatService** (`src-electron/services/chat.service.ts`):

```typescript
// ChatService.submitPrompt() - needs modification
await chatService.submitPrompt({
  threadId, // Desktop-generated UUID
  prompt: userMessage,
  model: 'claude-3-opus',
  // ... other parameters
});
```

**⚠️ IMPORTANT: Holo API Modification Required**

The Holo API chat method must be updated to:

1. **Accept** a `threadId` parameter (UUID string)
2. **Store** the `threadId` in the `requests` table (NOT in responses - they use FK to request)
3. **Return** the `threadId` in the response

**Current Holo API (assumed):**

```
POST /api/chat
{
  "prompt": "user message",
  "model": "claude-3-opus"
}
```

**Updated Holo API (required):**

```
POST /api/chat
{
  "threadId": "550e8400-e29b-41d4-a716-446655440000",  // Added
  "prompt": "user message",
  "model": "claude-3-opus"
}
```

### Step 3: Holo Saves to Database

Holo API automatically:

1. Saves user prompt to `requests` table with `threadId` field
2. Executes LLM request
3. Saves LLM response to `responses` table with foreign key to request

**Database Structure:**

```
requests table:
  - id (primary key)
  - threadId (UUID - provided by desktop)
  - prompt (user message)
  - model
  - createdAt
  - ... other fields

responses table:
  - id (primary key)
  - requestId (foreign key to requests.id - one-to-one)
  - content (assistant message)
  - createdAt
  - ... other fields
```

**Note**: Responses do NOT have a `threadId` field since they have a one-to-one relationship with requests. To get all messages for a thread, query all requests with that `threadId` and join with their responses.

### Step 4: Desktop Reads from Moku API

After submission, desktop can read the saved thread/messages:

```typescript
// Read thread with messages
const thread = await mokuService.getThread(accessToken, threadId);

// Or just read messages
const messages = await mokuService.getThreadMessages(accessToken, threadId);
```

## ChatService Interface

### Current Implementation

Location: `src-electron/services/chat.service.ts`

### Required Update

The `submitPrompt` method needs to accept a `threadId` parameter:

```typescript
// BEFORE (assumed current implementation)
async submitPrompt(params: {
  prompt: string;
  model: string;
  // ... other params
}): Promise<ChatResponse>

// AFTER (required modification)
async submitPrompt(params: {
  threadId: string;        // NEW: Desktop-generated UUID
  prompt: string;
  model: string;
  // ... other params
}): Promise<ChatResponse>
```

**Example Updated Method:**

```typescript
export class ChatService {
  async submitPrompt(params: {
    threadId: string;
    prompt: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<ChatResponse> {
    const response = await fetch(`${this.holoApiBaseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        threadId: params.threadId, // Pass to Holo
        prompt: params.prompt,
        model: params.model,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`Holo API error: ${response.statusText}`);
    }

    return await response.json();
  }
}
```

## Moku API Methods

The Moku API provides **read access** to threads/messages and **organizational operations**. It does NOT handle prompt submission or message creation (that's Holo's job).

### How Moku Queries Holo's Database

Moku API reads from the same Postgres database that Holo writes to. To reconstruct a thread's conversation:

```sql
-- Get all messages for a thread (interleaving requests and responses)
SELECT
  r.id as message_id,
  'user' as role,
  r.prompt as content,
  r.createdAt,
  r.model
FROM requests r
WHERE r.threadId = :threadId

UNION ALL

SELECT
  resp.id as message_id,
  'assistant' as role,
  resp.content,
  resp.createdAt,
  r.model
FROM responses resp
JOIN requests r ON resp.requestId = r.id
WHERE r.threadId = :threadId

ORDER BY createdAt ASC;
```

This query:

1. Gets all user messages (requests) for the thread
2. Gets all assistant messages (responses) via JOIN
3. Combines them with UNION ALL
4. Orders chronologically

**Listing Threads:**

```sql
-- Get all distinct threads for a user
SELECT DISTINCT
  r.threadId as id,
  MIN(r.createdAt) as createdAt,
  MAX(GREATEST(r.createdAt, COALESCE(resp.createdAt, r.createdAt))) as updatedAt,
  -- Title can be derived from first request or stored separately in thread_metadata table
  (SELECT prompt FROM requests WHERE threadId = r.threadId ORDER BY createdAt LIMIT 1) as title
FROM requests r
LEFT JOIN responses resp ON resp.requestId = r.id
WHERE r.userId = :userId
GROUP BY r.threadId
ORDER BY updatedAt DESC;
```

**Note**: You may want to create a separate `thread_metadata` table to store thread-level attributes (title, description, status, projectId) rather than deriving them from requests. This would improve query performance and allow for organizational operations.

**Recommended thread_metadata table:**

```
thread_metadata:
  - threadId (UUID, primary key)
  - userId (UUID)
  - title (string)
  - description (text)
  - status (enum: 'active', 'archived', 'deleted')
  - projectId (UUID, nullable)
  - createdAt (timestamp)
  - updatedAt (timestamp)
  - deletedAt (timestamp, nullable)
```

### Required Moku Service Methods

All methods require an `accessToken` parameter for authentication.

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
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "My Conversation",
      "description": "Thread description",
      "status": "active",
      "createdAt": 1234567890000,
      "updatedAt": 1234567890000,
      "metadata": {
        "model": "claude-3-opus",
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
      "threadId": "550e8400-e29b-41d4-a716-446655440000",
      "role": "user",
      "content": "Hello, how are you?",
      "createdAt": 1234567890000,
      "metadata": {}
    },
    {
      "id": "msg_abc456",
      "threadId": "550e8400-e29b-41d4-a716-446655440000",
      "role": "assistant",
      "content": "I'm doing well, thank you!",
      "createdAt": 1234567891000,
      "metadata": {
        "model": "claude-3-opus"
      }
    }
  ]
  ```

#### 4. **updateThread(accessToken, threadId, updates)**

Update thread metadata and properties (organizational operations only).

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
- **Use Cases**: Update title, add description, change status

#### 5. **moveThreadToProject(accessToken, threadId, targetProjectId, options)**

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

#### 6. **softDeleteThread(accessToken, threadId)**

Soft delete a thread (marks as deleted without removing data).

```typescript
async softDeleteThread(accessToken: string, threadId: string): Promise<boolean>
```

- **HTTP Method**: `POST`
- **Endpoint**: `/api/threads/${threadId}/soft-delete`
- **Headers**: `Authorization: Bearer ${accessToken}`
- **Returns**: Boolean indicating success
- **Side Effects**: Sets `deletedAt` timestamp and status to 'deleted'

#### 7. **deleteThread(accessToken, threadId)**

Permanently delete a thread.

```typescript
async deleteThread(accessToken: string, threadId: string): Promise<boolean>
```

- **HTTP Method**: `DELETE`
- **Endpoint**: `/api/threads/${threadId}`
- **Headers**: `Authorization: Bearer ${accessToken}`
- **Returns**: Boolean indicating success
- **Warning**: Permanently removes thread and all associated data

## Thread Repository Caching Architecture

The `ThreadRepository` implements a **read-focused caching layer** that sits between the IPC handlers and the Moku API.

### Design Principles

1. **Cache-first for reads**: Always check in-memory cache before calling Moku API
2. **Lazy loading**: Only load data from API when requested and not in cache
3. **No write operations**: All message creation happens via Holo API
4. **Organizational writes**: Metadata updates go through Moku API and update cache
5. **Separate message caching**: Messages cached independently by threadId
6. **Cache invalidation**: Refresh cache when data may be stale

### Cache Structure

```typescript
export class ThreadRepository {
  // In-memory caches
  private readonly threadsById: Map<string, Thread> = new Map();
  private readonly messagesByThreadId: Map<string, Message[]> = new Map();
  private cacheLoaded: boolean = false;

  constructor(
    private readonly mokuService: MokuService,
    private readonly chatService: ChatService,
  ) {}
}
```

### Core Operations

#### Creating a New Thread and Submitting Prompt

```typescript
public async createThreadWithPrompt(
  prompt: string,
  options: {
    title?: string;
    description?: string;
    model: string;
  }
): Promise<{ threadId: string; thread: Thread }> {
  // 1. Generate thread ID locally
  const threadId = randomUUID();

  // 2. Submit prompt to Holo API (which saves thread + messages)
  await this.chatService.submitPrompt({
    threadId,
    prompt,
    model: options.model,
  });

  // 3. Read back the saved thread from Moku API
  const accessToken = await this.getAccessToken();
  const thread = await this.mokuService.getThread(accessToken, threadId);

  if (!thread) {
    throw new Error('Thread not found after Holo submission');
  }

  // 4. Optionally update metadata via Moku if title/description provided
  if (options.title || options.description) {
    const updated = await this.mokuService.updateThread(accessToken, threadId, {
      title: options.title,
      description: options.description,
    });

    // Cache the updated thread
    this.threadsById.set(threadId, updated);
    return { threadId, thread: updated };
  }

  // 5. Cache the thread
  this.threadsById.set(threadId, thread);
  if (thread.messages) {
    this.messagesByThreadId.set(threadId, [...thread.messages]);
  }

  return { threadId, thread };
}
```

#### Continuing a Conversation (Appending to Existing Thread)

```typescript
public async continueThread(
  threadId: string,
  prompt: string,
  model: string
): Promise<Message[]> {
  // 1. Submit prompt to Holo API (which appends messages)
  await this.chatService.submitPrompt({
    threadId,
    prompt,
    model,
  });

  // 2. Invalidate cached messages for this thread
  this.messagesByThreadId.delete(threadId);

  // 3. Reload messages from Moku API
  const accessToken = await this.getAccessToken();
  const messages = await this.mokuService.getThreadMessages(accessToken, threadId);

  // 4. Update cache
  this.messagesByThreadId.set(threadId, messages);

  // 5. Update thread timestamp in cache
  const thread = this.threadsById.get(threadId);
  if (thread) {
    thread.updatedAt = Date.now();
    this.threadsById.set(threadId, thread);
  }

  return messages;
}
```

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
    .filter((t) => !t.deletedAt && t.status !== 'deleted')
    .map((t) => this.cloneThread(t))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

private async loadThreadsFromApi(): Promise<void> {
  const accessToken = await this.getAccessToken();
  const threads = await this.mokuService.listThreads(accessToken);

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
  const thread = await this.mokuService.getThread(accessToken, threadId);

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
  const messages = await this.mokuService.getThreadMessages(accessToken, threadId);

  // Cache the messages
  this.messagesByThreadId.set(threadId, messages);

  return messages
    .filter((m) => !m.deletedAt)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((m) => ({ ...m }));
}
```

#### Organizational Operations (Write-through to Moku API)

**updateThreadMetadata(threadId, updates)**

```typescript
public async updateThreadMetadata(
  threadId: string,
  updates: {
    title?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<Thread> {
  const accessToken = await this.getAccessToken();

  // Update via Moku API
  const updatedThread = await this.mokuService.updateThread(accessToken, threadId, updates);

  // Update cache
  this.threadsById.set(threadId, updatedThread);

  return this.cloneThread(updatedThread);
}
```

**softDeleteThread(threadId)**

```typescript
public async softDeleteThread(threadId: string): Promise<boolean> {
  const accessToken = await this.getAccessToken();

  // Delete via Moku API
  const success = await this.mokuService.softDeleteThread(accessToken, threadId);

  if (success) {
    // Update cache
    const thread = this.threadsById.get(threadId);
    if (thread) {
      thread.deletedAt = Date.now();
      thread.status = 'deleted';
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

  // Delete via Moku API
  const success = await this.mokuService.deleteThread(accessToken, threadId);

  if (success) {
    // Remove from cache
    this.threadsById.delete(threadId);
    this.messagesByThreadId.delete(threadId);
  }

  return success;
}
```

### Cache Management

```typescript
// Clear cache (called on logout)
public clearCache(): void {
  this.threadsById.clear();
  this.messagesByThreadId.clear();
  this.cacheLoaded = false;
}

// Invalidate specific thread (force reload from API)
public async invalidateThread(threadId: string): Promise<void> {
  this.threadsById.delete(threadId);
  this.messagesByThreadId.delete(threadId);
  // Reload from API on next access
}

// Invalidate thread list (force reload all threads)
public invalidateThreadList(): void {
  this.cacheLoaded = false;
  // Will reload on next listThreads() call
}

// Refresh thread from API (bypass cache)
public async refreshThread(threadId: string): Promise<Thread | null> {
  const accessToken = await this.getAccessToken();
  const thread = await this.mokuService.getThread(accessToken, threadId);

  if (thread) {
    this.threadsById.set(thread.id, thread);
    if (thread.messages) {
      this.messagesByThreadId.set(thread.id, [...thread.messages]);
    }
  }

  return thread ? this.cloneThread(thread) : null;
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

## Error Handling

### Holo API Errors

When submitting prompts via ChatService:

- **401 Unauthorized**: Access token invalid or expired
  - Refresh token and retry once
  - If refresh fails, prompt user to log in
- **429 Too Many Requests**: Rate limiting
  - Implement exponential backoff
  - Show user-friendly message
- **500 Internal Server Error**: Holo API issue
  - Log error
  - Show user error message
  - Allow retry

### Moku API Errors

When reading threads/messages:

- **401 Unauthorized**: Refresh token and retry
- **403 Forbidden**: User doesn't have permission
- **404 Not Found**: Thread doesn't exist
  - Remove from cache
  - Handle gracefully in UI
- **500 Internal Server Error**: Log and show error

### Cache Synchronization

If Holo saves data but Moku read fails:

1. Thread exists in database but not in cache
2. Desktop should retry reading from Moku
3. If persistent failure, show error but data is saf

return thread ? this.cloneThread(thread) : null;
}

````

### Authentication Helper

```typescript
private async getAccessToken(): Promise<string> {
  const auth = getAuthService();
  if (!auth.isAuthenticated()) {
    throw new Error('Not authenticated');
  }
  return await auth.getAccessToken(); // Auto-refreshes if expired
}
````

## Error Handling

### Holo API Errors

When submitting prompts via ChatService:

- **401 Unauthorized**: Access token invalid or expired
  - Refresh token and retry once
  - If refresh fails, prompt user to log in
- **429 Too Many Requests**: Rate limiting
  - Implement exponential backoff
  - Show user-friendly message
- **500 Internal Server Error**: Holo API issue
  - Log error
  - Show user error message
  - Allow retry

### Moku API Errors

When reading threads/messages:

- **401 Unauthorized**: Refresh token and retry
- **403 Forbidden**: User doesn't have permission
- **404 Not Found**: Thread doesn't exist
  - Remove from cache
  - Handle gracefully in UI
- **500 Internal Server Error**: Log and show error

### Cache Synchronization

If Holo saves data but Moku read fails:

1. Thread exists in database but not in cache
2. Desktop should retry reading from Moku
3. If persistent failure, show error but data is safe

## Data Structures

### Thread

```typescript
interface Thread {
  id: string; // UUID v4 (generated by desktop)
  title: string;
  description?: string;
  status: 'active' | 'archived' | 'deleted';
  createdAt: number; // Epoch milliseconds
  updatedAt: number; // Epoch milliseconds
  deletedAt?: number | null; // Soft delete timestamp
  metadata?: {
    model?: string; // Last used model
    projectId?: string; // Project association
    [key: string]: unknown;
  };
  messages?: Message[]; // Included in getThread() response
}
```

### Message

```typescript
interface Message {
  id: string; // Generated by Holo API
  threadId: string; // UUID v4 (provided by desktop)
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number; // Epoch milliseconds
  deletedAt?: number | null; // Soft delete timestamp
  metadata?: {
    model?: string; // Model used for this message
    provider?: string; // e.g., 'anthropic', 'openai'
    [key: string]: unknown;
  };
}
```

## Implementation Checklist

### Holo API Changes

- [ ] Update chat endpoint to accept `threadId` parameter
- [ ] Store `threadId` with prompt request in database
- [ ] Store `threadId` with LLM response in database
- [ ] Return `threadId` in response payload
- [ ] Test UUID format compatibility

### Desktop App Changes

- [ ] Update `ChatService.submitPrompt()` to include `threadId`
- [ ] Implement `ThreadRepository.createThreadWithPrompt()`
- [ ] Implement `ThreadRepository.continueThread()`
- [ ] Add UUID generation helper
- [ ] Update IPC handlers to use new flow
- [ ] Update frontend to handle new architecture

### Moku API Implementation

- [ ] Implement `GET /api/threads` endpoint
- [ ] Implement `GET /api/threads/:threadId` endpoint
- [ ] Implement `GET /api/threads/:threadId/messages` endpoint
- [ ] Implement `PATCH /api/threads/:threadId` endpoint
- [ ] Implement `POST /api/threads/:threadId/move` endpoint
- [ ] Implement `POST /api/threads/:threadId/soft-delete` endpoint
- [ ] Implement `DELETE /api/threads/:threadId` endpoint
- [ ] Add authorization checks (user ownership)
- [ ] Add database queries for thread/message retrieval

### Testing

- [ ] Test UUID uniqueness across multiple desktop instances
- [ ] Test Holo API saves threadId correctly
- [ ] Test Moku API returns threads/messages correctly
- [ ] Test cache invalidation after Holo submission
- [ ] Test offline queue (if implementing)
- [ ] Test error handling for Holo/Moku failures

## Benefits of This Architecture

### Separation of Concerns

✅ **Holo API**: Handles LLM execution and persistence (single source of truth)
✅ **Moku API**: Handles organization and retrieval (read-focused)
✅ **Desktop App**: Handles UI, caching, and orchestration

### Simplified Desktop Logic

✅ No complex write operations to manage
✅ No idempotency concerns (Holo handles that)
✅ Simpler error handling (read vs write)
✅ Cache can focus on read performance

### Scalability

✅ Holo API can be optimized for write throughput
✅ Moku API can be optimized for read performance
✅ Desktop doesn't need to coordinate writes
✅ Easier to implement real-time updates (Holo → Moku → Desktop)

### Consistency

✅ Single database for all prompt/response data
✅ No sync issues between multiple write sources
✅ Desktop always reads latest data from Moku
✅ Holo guarantees atomic write of request + response

---

## Future Enhancements

### Thread

```typescript
interface Thread {
  id: string; // UUID v4 (generated by desktop)
  title: string;
  description?: string;
  status: 'active' | 'archived' | 'deleted';
  createdAt: number; // Epoch milliseconds
  updatedAt: number; // Epoch milliseconds
  deletedAt?: number | null; // Soft delete timestamp
  metadata?: {
    model?: string; // Last used model
    projectId?: string; // Project association
    [key: string]: unknown;
  };
  messages?: Message[]; // Included in getThread() response
}
```

### Message

```typescript
interface Message {
  id: string; // Generated by Holo API
  threadId: string; // UUID v4 (provided by desktop)
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number; // Epoch milliseconds
  deletedAt?: number | null; // Soft delete timestamp
  metadata?: {
    model?: string; // Model used for this message
    provider?: string; // e.g., 'anthropic', 'openai'
    [key: string]: unknown;
  };
}
```

## Implementation Checklist

### Holo API Changes

- [ ] Update chat endpoint to accept `threadId` parameter
- [ ] Store `threadId` with prompt request in database
- [ ] Store `threadId` with LLM response in database
- [ ] Return `threadId` in response payload
- [ ] Test UUID format compatibility

### Desktop App Changes

- [ ] Update `ChatService.submitPrompt()` to include `threadId`
- [ ] Implement `ThreadRepository.createThreadWithPrompt()`
- [ ] Implement `ThreadRepository.continueThread()`
- [ ] Add UUID generation helper
- [ ] Update IPC handlers to use new flow
- [ ] Update frontend to handle new architecture

### Moku API Implementation

- [ ] Implement `GET /api/threads` endpoint
- [ ] Implement `GET /api/threads/:threadId` endpoint
- [ ] Implement `GET /api/threads/:threadId/messages` endpoint
- [ ] Implement `PATCH /api/threads/:threadId` endpoint
- [ ] Implement `POST /api/threads/:threadId/move` endpoint
- [ ] Implement `POST /api/threads/:threadId/soft-delete` endpoint
- [ ] Implement `DELETE /api/threads/:threadId` endpoint
- [ ] Add authorization checks (user ownership)
- [ ] Add database queries for thread/message retrieval

### Testing

- [ ] Test UUID uniqueness across multiple desktop instances
- [ ] Test Holo API saves threadId correctly
- [ ] Test Moku API returns threads/messages correctly
- [ ] Test cache invalidation after Holo submission
- [ ] Test offline queue (if implementing)
- [ ] Test error handling for Holo/Moku failures

---

## Benefits of This Architecture

### Separation of Concerns

✅ **Holo API**: Handles LLM execution and persistence (single source of truth)
✅ **Moku API**: Handles organization and retrieval (read-focused)
✅ **Desktop App**: Handles UI, caching, and orchestration

### Simplified Desktop Logic

✅ No complex write operations to manage
✅ No idempotency concerns (Holo handles that)
✅ Simpler error handling (read vs write)
✅ Cache can focus on read performance

### Scalability

✅ Holo API can be optimized for write throughput
✅ Moku API can be optimized for read performance
✅ Desktop doesn't need to coordinate writes
✅ Easier to implement real-time updates (Holo → Moku → Desktop)

### Consistency

✅ Single database for all prompt/response data
✅ No sync issues between multiple write sources
✅ Desktop always reads latest data from Moku
✅ Holo guarantees atomic write of request + responses

## Future Enhancements

### Real-time Updates

- Implement WebSocket connection from desktop to Moku
- Receive push notifications when new messages arrive
- Update cache in real-time without polling

### Offline Support

- Queue prompts locally when offline
- Submit to Holo when connection restored
- Show pending status in UI

### Optimistic UI Updates

- Show user message immediately in UI
- Show "AI is thinking..." placeholder
- Replace with real response when received from Moku

### Background Sync

### Real-time Updates

- Receive push notifications when new messages arrive
- Update cache in real-time without polling

### Offline Support

- Queue prompts locally when offline
- Submit to Holo when connection restored
- Show pending status in UI

### Optimistic UI Updates

- Show user message immediately in UI
- Show "AI is thinking..." placeholder
- Replace with real response when received from Moku

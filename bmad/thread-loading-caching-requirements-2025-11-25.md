# Thread Loading and Caching Requirements

**Date:** 2025-11-25
**Status:** Requirements Refinement
**Purpose:** Solidify requirements for sprint development

## Executive Summary

This document refines the existing thread management requirements to address:
1. **Project thread support** - shared threads with access control
2. **File attachment integration** - connecting to Storage Service
3. **Cache invalidation for collaboration** - multi-user scenarios
4. **Real-time updates** - MVP polling, future RabbitMQ

### Relationship to Existing Documents

| Document | Relationship |
|----------|--------------|
| `ai/thread-methods.md` | Base architecture - this doc extends it |
| `ai/desktop-system-architecture.md` | System context - this doc refines caching |
| `ai/MOKU-API-FOR-DESKTOP.md` | API implementation - this doc adds endpoints |
| `brainstorming-session-file-storage-2025-11-25.md` | File attachments integration |

---

## 1. Project Thread Requirements

### 1.1 Thread Ownership Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                    THREAD OWNERSHIP MODEL                            │
│                                                                      │
│  PERSONAL THREADS                      PROJECT THREADS               │
│  ─────────────────                     ───────────────               │
│  • Owner: userId                       • Owner: projectId            │
│  • Access: owner only                  • Access: project members     │
│  • Stored: user's thread list          • Stored: project's threads   │
│  • Cache: per-user, no TTL             • Cache: per-project, with TTL│
│  • Attachments: local storage          • Attachments: Storage Service│
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Thread Data Model Update

```typescript
interface Thread {
  id: string;                              // UUID v4
  title: string;
  description?: string;
  status: 'active' | 'archived' | 'deleted';

  // Ownership (NEW)
  type: 'personal' | 'project';
  ownerId: string;                         // userId (personal) or projectId (project)
  createdBy: string;                       // userId who created
  projectId?: string;                      // populated if type='project'

  // Timestamps
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;

  // Metadata
  metadata?: {
    model?: string;
    [key: string]: unknown;
  };

  messages?: Message[];
}
```

### 1.3 Project Member Roles

| Role | Permissions |
|------|-------------|
| **View** | Read threads, issue prompts (continue conversations) |
| **Edit** | View + create threads, create workflows, create templates |
| **Admin** | Edit + delete any thread, manage members |

### 1.4 Access Control Matrix

| Action | View Member | Edit Member | Thread Creator | Project Admin |
|--------|-------------|-------------|----------------|---------------|
| View thread | ✓ | ✓ | ✓ | ✓ |
| Issue prompts | ✓ | ✓ | ✓ | ✓ |
| Create thread | | ✓ | - | ✓ |
| Edit thread metadata | | ✓ | ✓ | ✓ |
| Delete thread | | | ✓ | ✓ |
| Move thread out | | | ✓ | ✓ |

### 1.5 Thread Movement

Threads can be moved between:
- Personal → Project (user must be Edit member of target project)
- Project → Project (user must be creator/admin of source, Edit member of target)
- Project → Personal (user must be creator/admin, thread becomes personal to that user)

**Updated Move API:**

```
POST /api/threads/{threadId}/move

Headers:
  Authorization: Bearer <jwt>

Body:
{
  "targetType": "personal" | "project",
  "targetProjectId": "project-guid" | null
}

Response 200:
{
  "id": "thread-guid",
  "type": "project",
  "ownerId": "project-guid",
  "projectId": "project-guid",
  ...
}

Errors:
  400 - Invalid target (e.g., moving to project user can't edit)
  403 - User not authorized (not creator/admin, or can't edit target)
  404 - Thread or project not found
```

### 1.6 New API Endpoints

**List Project Threads:**

```
GET /api/projects/{projectId}/threads

Headers:
  Authorization: Bearer <jwt>

Query params:
  limit: number (default 50, max 100)
  cursor: string
  status: 'active' | 'archived' (optional, default 'active')

Response 200:
{
  "threads": [
    {
      "id": "thread-guid",
      "title": "Code Review Discussion",
      "type": "project",
      "ownerId": "project-guid",
      "createdBy": "user-guid",
      "status": "active",
      "createdAt": 1732540800000,
      "updatedAt": 1732544400000,
      "metadata": { "model": "claude-3-opus" }
    }
  ],
  "nextCursor": "xyz" | null
}

Errors:
  403 - User not member of project
  404 - Project not found
```

**Updated List Threads (with type filter):**

```
GET /api/threads

Query params:
  type: 'personal' | 'project' | 'all' (default 'all')
  projectId: UUID (required if type='project')
  limit: number (default 50)
  cursor: string

Response 200:
{
  "threads": [...],
  "nextCursor": "xyz" | null
}
```

---

## 2. File Attachment Integration

### 2.1 Connection to Storage Service

From the File Storage session:
- Project thread attachments stored in **Storage Service**
- Personal thread attachments stored **locally** (existing pattern)
- Attachment metadata travels with messages through Holo audit

### 2.2 Message Data Model Update

```typescript
interface Message {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  deletedAt?: number;

  // File attachments (NEW)
  attachments?: FileAttachment[];

  metadata?: {
    model?: string;
    provider?: string;
    [key: string]: unknown;
  };
}

interface FileAttachment {
  fileId: string;           // Storage Service ID (project) or local ID (personal)
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;       // userId
  uploadedAt: string;       // ISO8601
  storageType: 'local' | 'remote';  // indicates where file is stored
}
```

### 2.3 Attachment Storage Decision

```typescript
async uploadAttachment(threadId: string, file: File): Promise<FileAttachment> {
  const thread = await this.getThread(threadId);

  if (thread.type === 'personal') {
    // Store locally (existing FileStorageService)
    const result = await this.localFileStorage.save(threadId, file);
    return { ...result, storageType: 'local' };
  } else {
    // Store in Storage Service (project files)
    const result = await this.projectFileService.upload(
      thread.projectId,
      threadId,
      file
    );
    return { ...result, storageType: 'remote' };
  }
}

async downloadAttachment(attachment: FileAttachment): Promise<Buffer> {
  if (attachment.storageType === 'local') {
    return this.localFileStorage.read(attachment.fileId);
  } else {
    // Uses caching from File Storage session design
    return this.projectFileService.download(attachment.fileId);
  }
}
```

### 2.4 Caching Strategy for Attachments

**What gets cached where:**

| Data | Cache Location | TTL |
|------|----------------|-----|
| Attachment metadata | Message cache (with message) | Same as message TTL |
| Personal file content | Local filesystem | Permanent |
| Project file content | FileCacheRepo (encrypted) | 3 days (configurable) |

**Flow:**
```
1. Load thread → messages include attachment metadata
2. User clicks attachment → check FileCacheRepo
3. Cache miss → Storage Service presigned URL → download
4. Cache hit → decrypt and return
5. Display/save file
```

---

## 3. Cache Architecture Update

### 3.1 Dual Cache Structure

All caches use **LRU (Least Recently Used) eviction** to prevent memory exhaustion. When a cache reaches its configured limit, the least recently accessed item is evicted to make room for new entries.

```typescript
class ThreadCache {
  // Personal threads - no TTL, LRU eviction at limits
  private readonly personalThreadCache: LRUCache<string, Thread>;
  private readonly personalMessageCache: LRUCache<string, EncryptedMessage[]>;

  // Project threads - TTL expiry + LRU eviction at limits
  private readonly projectThreadCaches: Map<string, LRUCache<string, CacheEntry<Thread>>>;
  private readonly projectMessageCaches: Map<string, LRUCache<string, CacheEntry<EncryptedMessage[]>>>;

  // Cache configuration
  private readonly config = {
    personal: {
      maxThreads: 100,        // LRU eviction when exceeded
      maxMessages: 1000,      // LRU eviction when exceeded
      ttl: Infinity           // No time-based expiry
    },
    project: {
      maxThreadsPerProject: 50,           // LRU eviction when exceeded
      maxMessagesPerProject: 500,         // LRU eviction when exceeded
      threadListTTL: 5 * 60 * 1000,       // 5 minutes
      messagesTTL: 2 * 60 * 1000          // 2 minutes
    }
  };
}
```

**LRU Eviction Behavior:**

| Cache | Max Items | Eviction Trigger | Eviction Policy |
|-------|-----------|------------------|-----------------|
| Personal threads | 100 | Adding thread #101 | Evict least recently accessed thread |
| Personal messages | 1000 | Adding message set #1001 | Evict least recently accessed thread's messages |
| Project threads | 50 per project | Adding thread #51 to project | Evict least recently accessed thread in that project |
| Project messages | 500 per project | Adding message set #501 | Evict least recently accessed thread's messages in that project |

**Memory Protection:**
- Bounded cache sizes ensure predictable memory usage
- LRU policy keeps frequently accessed data warm
- Evicted items are re-fetched from API on next access
- No memory leaks from unbounded growth

### 3.2 Cache Entry with TTL

```typescript
interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttl: number;
}

function isExpired<T>(entry: CacheEntry<T>): boolean {
  if (entry.ttl === Infinity) return false;
  return Date.now() > entry.cachedAt + entry.ttl;
}
```

### 3.3 Cache Operations

**Get Thread:**
```typescript
async getThread(threadId: string): Promise<Thread | null> {
  // 1. Check personal cache (no TTL check needed)
  const personal = this.personalThreadCache.get(threadId);
  if (personal) return personal;

  // 2. Check project caches (with TTL check)
  for (const [projectId, cache] of this.projectThreadCaches) {
    const entry = cache.get(threadId);
    if (entry && !isExpired(entry)) {
      return entry.data;
    }
  }

  // 3. Fetch from API
  const thread = await this.mokuAPI.getThread(threadId);
  if (!thread) return null;

  // 4. Cache in appropriate location
  this.cacheThread(thread);
  return thread;
}
```

**Cache Thread:**
```typescript
private cacheThread(thread: Thread): void {
  if (thread.type === 'personal') {
    this.personalThreadCache.set(thread.id, thread);
  } else {
    const cache = this.getOrCreateProjectCache(thread.projectId!);
    cache.set(thread.id, {
      data: thread,
      cachedAt: Date.now(),
      ttl: this.config.project.threadListTTL
    });
  }
}
```

### 3.4 Cache Invalidation

```typescript
// Invalidate single thread (e.g., after edit)
invalidateThread(threadId: string): void {
  this.personalThreadCache.delete(threadId);
  for (const cache of this.projectThreadCaches.values()) {
    cache.delete(threadId);
  }
  this.personalMessageCache.delete(threadId);
  for (const cache of this.projectMessageCaches.values()) {
    cache.delete(threadId);
  }
}

// Invalidate entire project (e.g., after poll detects changes)
invalidateProject(projectId: string): void {
  this.projectThreadCaches.delete(projectId);
  this.projectMessageCaches.delete(projectId);
}

// Clear all caches (e.g., on logout)
clearAll(): void {
  this.personalThreadCache.clear();
  this.personalMessageCache.clear();
  this.projectThreadCaches.clear();
  this.projectMessageCaches.clear();
  this.cacheManager.clearEncryption();
}
```

---

## 4. Collaboration - Cache Invalidation

### 4.1 MVP Strategy: TTL + Polling

```
┌─────────────────────────────────────────────────────────────────────┐
│                 MVP CACHE INVALIDATION                               │
│                                                                      │
│  PERSONAL THREADS:                                                   │
│  • No TTL (never expires)                                           │
│  • No polling                                                        │
│  • Refresh on user action only                                       │
│                                                                      │
│  PROJECT THREADS:                                                    │
│  • Thread list TTL: 5 minutes                                       │
│  • Messages TTL: 2 minutes                                          │
│  • Polling: active project every 30 seconds                         │
│  • Manual refresh button in UI                                       │
│                                                                      │
│  FUTURE (RabbitMQ):                                                  │
│  • Subscribe to project queue                                        │
│  • Real-time invalidation events                                     │
│  • Eliminate polling                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Polling Service

```typescript
class ProjectPollingService {
  private pollInterval: NodeJS.Timeout | null = null;
  private activeProjectId: string | null = null;
  private lastCheckTimes: Map<string, number> = new Map();

  private readonly POLL_INTERVAL_MS = 30000;  // 30 seconds

  /**
   * Set the currently active project for polling
   */
  setActiveProject(projectId: string | null): void {
    const wasPolling = this.pollInterval !== null;
    this.activeProjectId = projectId;

    if (projectId && !wasPolling) {
      this.startPolling();
    } else if (!projectId && wasPolling) {
      this.stopPolling();
    }
  }

  private async poll(): Promise<void> {
    if (!this.activeProjectId) return;

    try {
      const lastCheck = this.lastCheckTimes.get(this.activeProjectId) || 0;
      const response = await this.mokuAPI.checkProjectUpdates(
        this.activeProjectId,
        new Date(lastCheck).toISOString()
      );

      if (response.hasUpdates) {
        // Invalidate project cache
        this.threadCache.invalidateProject(this.activeProjectId);

        // Notify UI to refresh
        eventBus.emit('project:updated', {
          projectId: this.activeProjectId,
          summary: response.summary
        });
      }

      this.lastCheckTimes.set(this.activeProjectId, Date.now());
    } catch (error) {
      log.warn('Polling failed', { projectId: this.activeProjectId, error });
    }
  }

  private startPolling(): void {
    if (this.pollInterval) return;

    // Poll immediately, then on interval
    this.poll();
    this.pollInterval = setInterval(() => this.poll(), this.POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  dispose(): void {
    this.stopPolling();
    this.lastCheckTimes.clear();
  }
}
```

### 4.3 New API Endpoint: Check Project Updates

```
GET /api/projects/{projectId}/updates

Headers:
  Authorization: Bearer <jwt>

Query params:
  since: ISO8601 timestamp (required)

Response 200:
{
  "hasUpdates": true,
  "lastUpdate": "2025-11-25T12:00:00Z",
  "summary": {
    "threadsCreated": 1,
    "threadsUpdated": 3,
    "threadsDeleted": 0,
    "messagesCreated": 12
  }
}

Response 200 (no updates):
{
  "hasUpdates": false,
  "lastUpdate": "2025-11-25T11:30:00Z",
  "summary": null
}

Errors:
  403 - User not member of project
  404 - Project not found
```

### 4.4 UI Integration

**Manual Refresh Button:**
```svelte
<button on:click={refreshProject} disabled={isRefreshing}>
  {#if isRefreshing}
    Refreshing...
  {:else}
    Refresh
  {/if}
</button>

<script>
  async function refreshProject() {
    isRefreshing = true;
    threadCache.invalidateProject(projectId);
    await loadThreads();
    isRefreshing = false;
  }
</script>
```

**Update Indicator:**
```svelte
{#if hasNewUpdates}
  <div class="update-banner">
    New updates available
    <button on:click={refreshProject}>Refresh</button>
  </div>
{/if}

<script>
  eventBus.on('project:updated', ({ projectId, summary }) => {
    if (projectId === currentProjectId) {
      hasNewUpdates = true;
    }
  });
</script>
```

---

## 5. Future: RabbitMQ Integration

### 5.1 Deferred Requirements

Real-time updates via RabbitMQ are deferred to a future sprint. When implemented:

**Architecture:**
```
Desktop → RabbitMQ (subscribe to project queue)
Server → RabbitMQ (publish invalidation events)
```

**Event Types:**
- `thread.created` - new thread in project
- `thread.updated` - thread metadata changed
- `thread.deleted` - thread removed
- `message.created` - new message in thread
- `attachment.added` - file attached to message
- `member.added` - new project member
- `member.removed` - member removed from project

**Benefits over Polling:**
- Instant updates (no 30-second delay)
- Reduced API load (no polling requests)
- Battery efficient (no wake-up cycles)

---

## 6. Implementation Checklist

### 6.1 Moku API Updates

- [ ] Add `type` and `projectId` fields to thread model
- [ ] Add `GET /api/projects/{projectId}/threads` endpoint
- [ ] Update `GET /api/threads` with type filter
- [ ] Update `POST /api/threads/{threadId}/move` for type changes
- [ ] Add `GET /api/projects/{projectId}/updates` endpoint
- [ ] Add project membership checks to thread access

### 6.2 Desktop Updates

- [ ] Update Thread interface with `type`, `ownerId`, `projectId`
- [ ] Update Message interface with `attachments` array
- [ ] Implement dual cache structure (personal + project)
- [ ] Add TTL support to project caches
- [ ] Implement ProjectPollingService
- [ ] Integrate with ProjectFileService for attachments
- [ ] Update ThreadRepository for project thread operations
- [ ] Add manual refresh button to UI
- [ ] Add update indicator to UI

### 6.3 Integration Testing

- [ ] Personal thread CRUD operations
- [ ] Project thread CRUD operations
- [ ] Thread movement between personal/project
- [ ] Cache invalidation on TTL expiry
- [ ] Polling detects remote changes
- [ ] Attachment upload/download for personal threads
- [ ] Attachment upload/download for project threads
- [ ] Access control enforcement (view vs edit members)

---

## 7. Key Decisions Summary

| Decision | Value |
|----------|-------|
| Thread types | `personal` (user-owned) and `project` (shared) |
| Project member roles | View (read + prompt) / Edit (create) / Admin (delete + manage) |
| Thread movement | Supported: personal↔project, project↔project |
| Personal attachment storage | Local (existing FileStorageService) |
| Project attachment storage | Storage Service (remote, with local cache) |
| Cache eviction policy | LRU (Least Recently Used) for all caches |
| Personal thread cache limit | 100 threads, 1000 message sets (LRU eviction) |
| Project thread cache limit | 50 threads per project, 500 message sets per project (LRU eviction) |
| Personal thread cache TTL | Infinity (no expiry) |
| Project thread list TTL | 5 minutes |
| Project messages TTL | 2 minutes |
| Polling interval | 30 seconds (active project only) |
| Real-time updates | Deferred (future RabbitMQ) |

---

## 8. API Summary

### New Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/projects/{projectId}/threads` | GET | List project threads |
| `/api/projects/{projectId}/updates` | GET | Check for updates (polling) |

### Updated Endpoints

| Endpoint | Method | Change |
|----------|--------|--------|
| `/api/threads` | GET | Add `type` and `projectId` query params |
| `/api/threads` | POST | Add `type` and `projectId` fields |
| `/api/threads/{id}/move` | POST | Support `targetType` for personal/project |

---

_Requirements refined for sprint development - 2025-11-25_

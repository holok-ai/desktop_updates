# Epic 4: Desktop Core - Implementation Context

**Generated:** 2025-12-12
**Owner:** Peter
**Priority:** P0
**Dependencies:** None (can run in parallel)

---

## Epic Overview

**Description:** Platform infrastructure for notifications, state persistence, and deep linking.

**Objective:** Build the foundational desktop platform services that enable user experience features like notifications, persistent preferences, deep linking, and high-performance data caching.

**Stories:** 4 stories (E4-S1 through E4-S4)

---

## Architecture Context

### Storage Model (Critical)

This epic implements **LOCAL CACHING ONLY** - not data storage:

| Data Type | Storage Location | Cache Location |
|-----------|------------------|----------------|
| Threads (personal) | Moku API | Local encrypted cache (E4-S4) |
| Threads (project) | Moku API | Local encrypted cache (E4-S4) |
| Messages (personal) | Moku API | Local encrypted cache (E4-S4) |
| Messages (project) | Moku API | Local encrypted cache (E4-S4) |
| Files (personal) | Local filesystem | N/A (not cached) |
| Files (project) | Storage Service | Local encrypted cache (E4-S4) |
| Window state | Local filesystem | N/A |
| User preferences | Local filesystem | N/A |

**Key Principle:** E4-S4 implements a **cache layer**, not a storage/repository layer. All threads and messages are stored in Moku API. The cache is a performance optimization with TTL-based expiration.

---

## Story 1: Notification System (E4-S1)

**Size:** M
**Description:** System and in-app notifications

### Key Features

1. **System Notifications** (OS-level)
   - Uses Electron Notification API
   - Appears in OS notification center
   - Click brings app to focus
   - Respects OS notification settings

2. **Toast Notifications** (in-app)
   - Lightweight, auto-dismissing UI notifications
   - Multiple concurrent toasts supported
   - Color-coded by type (info, success, warning, error)
   - Default 3-second auto-dismiss

3. **Notification History**
   - Stores last 50 notifications
   - Includes timestamp, type, message, read status
   - `markAsRead()` and `clearAll()` methods

4. **Settings**
   - Toggle: Enable system notifications
   - Toggle: Enable sound
   - Checkboxes for notification types
   - Persists in StateStore

### Technical Implementation

**Service:** `NotificationService.ts` (singleton)

```typescript
interface NotificationPayload {
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning' | 'error';
  icon?: string;
  action?: () => void;
}
```

**Components:**
- `Toast.svelte` - Individual toast notification
- `ToastContainer.svelte` - Container with positioning

**Store:** `notificationHistoryStore` (Svelte store)

### Requirements References
- CORE §8.1: System notifications
- CORE §8.2: Toast notifications
- CORE §8.3: Notification history
- CORE §8.4: Notification settings

### Acceptance Criteria
- ✅ System notifications appear in OS notification center
- ✅ Toasts appear in-app with auto-dismiss
- ✅ Notification history accessible
- ✅ Settings persist across sessions

---

## Story 2: State Persistence (E4-S2)

**Size:** M
**Description:** Persist window state and user preferences

### Key Features

1. **Window State**
   - Position (x, y)
   - Size (width, height)
   - Maximized state
   - Multi-monitor awareness
   - Debounced save (500ms after change)

2. **Sidebar State**
   - Collapsed/expanded state
   - Width (if resizable)
   - Which sections are expanded

3. **User Preferences**
   - Theme (light/dark/system)
   - Font size
   - Default model selection
   - Notification preferences
   - Last active project/thread

4. **State Versioning & Migration**
   - Version field in state
   - Migration functions for each version
   - Runs on app startup
   - Handles corrupt state (reset to defaults)

### Technical Implementation

**Service:** `StateStore.ts`

Uses `electron-store` or similar for JSON persistence

```typescript
interface StateSchema {
  version: number;
  window: {
    x: number;
    y: number;
    width: number;
    height: number;
    maximized: boolean;
  };
  sidebar: {
    collapsed: boolean;
    width: number;
    expandedSections: string[];
  };
  preferences: {
    theme: 'light' | 'dark' | 'system';
    fontSize: number;
    defaultModel: string;
    lastActiveProject?: string;
    lastActiveThread?: string;
  };
}
```

**Methods:**
- `get(key: string): any`
- `set(key: string, value: any): void`
- `delete(key: string): void`

### Requirements References
- CORE §9.1: Window state
- CORE §9.2: User preferences
- CORE §9.3: Application state
- CORE §9.4: State migration

### Acceptance Criteria
- ✅ Window opens at last position/size
- ✅ Sidebar collapse state remembered
- ✅ Theme preference remembered
- ✅ Old state formats migrated successfully

---

## Story 3: Deep Link Handler (E4-S3)

**Size:** M
**Description:** Handle `holokai://` protocol links

### Key Features

1. **Protocol Registration**
   - Register `holokai://` protocol
   - Windows/Linux: `app.setAsDefaultProtocolClient()`
   - macOS: Configure Info.plist
   - Package-time configuration

2. **Route Parsing**
   - Extract route type (thread, project, workflow, settings)
   - Extract parameters (id, etc.)
   - Validate URL format
   - Handle malformed URLs gracefully

3. **Route Handlers**
   - `holokai://thread/{id}` → Navigate to thread view
   - `holokai://project/{id}` → Navigate to project view
   - `holokai://workflow/{id}` → Navigate to workflow view
   - `holokai://settings` → Open settings page
   - `holokai://settings/{section}` → Open specific settings tab

4. **App Lifecycle Handling**
   - **App closed:** Store URL, process after auth
   - **App open:** Focus window, navigate to target
   - Windows/Linux: `second-instance` event
   - macOS: `open-url` event

### Technical Implementation

**Utilities:**
- `DeepLinkParser.ts` - Parse and validate URLs
- `DeepLinkRouter.ts` - Route to appropriate handler

```typescript
interface DeepLinkRoute {
  type: 'thread' | 'project' | 'workflow' | 'settings';
  id?: string;
  section?: string;
  params?: Record<string, string>;
}
```

**Flow:**
1. App receives protocol URL
2. Parser validates and extracts route
3. If app launching: store for later
4. If app open: navigate immediately
5. Router calls appropriate handler
6. Navigation occurs

### Requirements References
- CORE §10.1: Protocol registration
- CORE §10.2: Route table
- CORE §10.3: Link handling (app closed)
- CORE §10.4: Link handling (app open)

### Acceptance Criteria
- ✅ `holokai://thread/{id}` opens thread
- ✅ `holokai://project/{id}` opens project
- ✅ `holokai://settings` opens settings
- ✅ Works from browser, email, other apps

---

## Story 4: Local Cache Service (E4-S4)

**Size:** L (Largest story in epic)
**Description:** Encrypted caching layer for Moku API data with TTL-based expiration, LRU eviction, and lazy loading support

### Critical Architecture Clarification

**THIS IS A CACHE, NOT A STORAGE LAYER**

- ❌ Does NOT store threads/messages permanently
- ✅ Caches Moku API responses for performance
- ✅ TTL-based expiration triggers refetch from API
- ✅ Cache can be cleared without data loss
- ✅ Works for BOTH personal and project data

### Key Features

1. **Encrypted Cache Storage**
   - AES-256-GCM encryption
   - Per-installation encryption key
   - Stored in OS keychain (Electron safeStorage)
   - 8-hour key rotation

2. **TTL-Based Expiration**
   - Thread list: 5 minute TTL
   - Messages: 2 minute TTL
   - Project files: 3 day TTL
   - Auto-invalidate on expiration
   - Refetch from Moku API when expired

3. **LRU Eviction**
   - Max cache size: 500MB
   - Track access timestamps
   - Evict oldest accessed entries
   - Never evict entries accessed in last 5 minutes

4. **Lazy Loading Support**
   - Chunk messages (50 per chunk)
   - Cache keys include chunk info
   - On-demand loading from Moku API
   - Returns `{ messages, hasMore, nextOffset }`

5. **Cache Invalidation**
   - `invalidateThread(threadId)` - specific thread
   - `invalidateMessages(threadId)` - messages for thread
   - `invalidateThreadList()` - clear thread list
   - `invalidateAll()` - clear everything (logout)
   - `invalidateExpired()` - cleanup expired entries

6. **Statistics & Monitoring**
   - Total cache size (bytes)
   - Entry count
   - Hit/miss rates
   - Events for cache operations

### Technical Implementation

**Service:** `LocalCacheService.ts`

**Cache Directory:**
```
~/.holokai/cache/encrypted/
├── threads.cache              # Thread list cache
├── messages-{threadId}.cache  # Message cache per thread
├── messages-{threadId}-chunk-{n}.cache  # Chunked messages
├── files-{fileId}.cache       # Project file cache
└── index.json                 # Cache metadata
```

**Cache Entry Structure:**
```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  encrypted: boolean;
}
```

**Methods:**

```typescript
class LocalCacheService {
  // Thread list caching
  cacheThreadList(threads: Thread[], ttl?: number): Promise<void>
  getThreadList(): Promise<Thread[] | null>

  // Message caching
  cacheMessages(threadId: string, messages: Message[], ttl?: number): Promise<void>
  getMessages(threadId: string): Promise<Message[] | null>

  // Chunked message caching
  getMessageChunk(threadId: string, offset: number, limit: number): Promise<{
    messages: Message[];
    hasMore: boolean;
    nextOffset: number;
  }>

  // File caching
  cacheFile(fileId: string, content: Buffer, ttl?: number): Promise<void>
  getFile(fileId: string): Promise<Buffer | null>

  // Invalidation
  invalidateThread(threadId: string): Promise<void>
  invalidateMessages(threadId: string): Promise<void>
  invalidateThreadList(): Promise<void>
  invalidateAll(): Promise<void>
  invalidateExpired(): Promise<void>

  // Eviction
  evictLRU(): Promise<void>

  // Stats
  getCacheStats(): Promise<{
    size: number;
    entryCount: number;
    hitRate: number;
    missRate: number;
  }>
}
```

### Requirements References
- ARCH §3.4: Local Cache Architecture
- ARCH §4.1-4.2: Cache Strategy
- TLC §3.2: TTL Configuration
- ARCH §7.1: Encryption
- ARCH §3.3: Storage Split

### Acceptance Criteria
- ✅ All Moku API data (threads/messages) cached with encryption
- ✅ TTL expiration triggers refetch from Moku API
- ✅ Thread list: 5min TTL, Messages: 2min TTL, Files: 3 day TTL
- ✅ LRU eviction when cache exceeds 500MB
- ✅ Cache invalidation works on logout and manual clear
- ✅ Corrupt cache files handled gracefully with refetch
- ✅ Cache stats available for monitoring
- ✅ Lazy loading supports chunked message retrieval (50/chunk)

---

## Implementation Order

**Recommended sequence:**

1. **E4-S2: State Persistence** (Foundation)
   - Other stories will need StateStore
   - Simple JSON persistence
   - No external dependencies

2. **E4-S1: Notification System** (Independent)
   - Can build in parallel
   - Uses StateStore from E4-S2

3. **E4-S3: Deep Link Handler** (Independent)
   - Can build in parallel
   - Uses StateStore from E4-S2

4. **E4-S4: Local Cache Service** (Last, largest)
   - Most complex story
   - Encryption setup required
   - Critical for app performance

---

## Key Dependencies

### External Libraries
- `electron-store` - State persistence
- Node.js `crypto` - Encryption
- Electron `safeStorage` - Key storage
- Electron `Notification` API

### Internal Dependencies
- `MokuAPIClient` (from E1) - For cache refetch
- `AuthService` (existing) - For user context
- `StateStore` (E4-S2) - For settings persistence

### File System Paths
- Cache: `~/.holokai/cache/encrypted/`
- State: `~/.holokai/state.json`
- Keychain: OS-specific (via Electron safeStorage)

---

## Testing Strategy

### E4-S1: Notification System
- Test system notification appearance
- Test toast auto-dismiss timing
- Test notification history storage
- Test settings persistence

### E4-S2: State Persistence
- Test window position/size restore
- Test multi-monitor handling
- Test state migration
- Test corrupt state recovery

### E4-S3: Deep Link Handler
- Test all route types (thread, project, workflow, settings)
- Test app closed vs app open behavior
- Test malformed URL handling
- Test auth-required scenarios

### E4-S4: Local Cache Service
- Test TTL expiration and refetch
- Test LRU eviction
- Test encryption/decryption
- Test cache invalidation
- Test chunked message loading
- Test corrupt cache recovery
- Test cache stats accuracy

---

## Performance Considerations

### E4-S4: Cache Performance Targets
- Cache hit latency: <10ms
- Cache miss + API fetch: <200ms
- Encryption/decryption: <5ms per operation
- LRU eviction: <50ms
- Cache stats calculation: <20ms

### Memory Usage
- In-memory cache metadata: ~10MB
- StateStore: ~1MB
- Notification history: ~500KB
- Total target: <50MB for all E4 services

---

## Security Considerations

### E4-S4: Encryption
- AES-256-GCM for all cached data
- Per-installation unique keys
- Keys stored in OS keychain (secure)
- 8-hour key rotation
- No plaintext data on disk

### State Persistence
- Preferences stored in plaintext (non-sensitive)
- No credentials or tokens in StateStore
- File permissions: user-only read/write

---

## Common Pitfalls

1. **E4-S4: Don't treat cache as storage**
   - Cache can be cleared without data loss
   - Always fallback to Moku API
   - TTL expiration is expected behavior

2. **E4-S2: Handle multi-monitor changes**
   - Window position may be invalid on monitor disconnect
   - Default to primary monitor if invalid

3. **E4-S3: Handle auth before navigation**
   - Deep links may arrive before user logs in
   - Queue navigation until authenticated

4. **E4-S1: Rate limit notifications**
   - Don't spam user with toasts
   - Consolidate similar notifications

---

## Document References

### Architecture
- `architecture-2025-11-25.md` §3.4: Local Cache Architecture
- `architecture-2025-11-25.md` §4.1-4.2: Cache Strategy
- `architecture-2025-11-25.md` §7.1: Encryption

### Requirements
- `desktop-core-requirements-2025-11-25.md` §8: Notifications
- `desktop-core-requirements-2025-11-25.md` §9: State Persistence
- `desktop-core-requirements-2025-11-25.md` §10: Deep Linking
- `thread-loading-caching-requirements-2025-11-25.md` §3: Caching

---

## Success Metrics

- Cache hit rate: >80% for thread/message access
- Notification delivery: <100ms from trigger
- State restore time: <50ms on app launch
- Deep link navigation: <500ms from click
- Zero data loss from cache invalidation

# Epic Technical Specification: Desktop Core

Date: 2025-11-26
Author: Peter
Epic ID: 4
Status: Draft

---

## Overview

Epic 4 establishes the foundational desktop application infrastructure for Holokai Desktop. Unlike Epic 1 (backend-focused database and API work), this epic is 100% desktop/frontend implementation within the Electron + Svelte stack. It provides four critical platform capabilities: (1) NotificationService for system-level and in-app notifications with history and user preferences, (2) StateStore for persisting window state, sidebar configuration, and user preferences across sessions with versioned migrations, (3) DeepLinkHandler for `holokai://` protocol registration enabling deep links from browsers and external apps, and (4) ThreadRepository - a sophisticated local caching layer with gzip compression, AES-256-GCM encryption, LRU eviction policy, and lazy message loading.

This epic is **independent** of Epic 1 and can be developed in parallel, as it uses existing Phase 1 API endpoints and requires no backend changes. It focuses entirely on desktop platform services and local data management.

## Objectives and Scope

**In Scope:**
- **NotificationService** (E4-S1): System notifications via Electron Notification API, in-app toast components, notification history store (last 50 notifications), and user settings for enabling/disabling notification types
- **StateStore** (E4-S2): Window position/size persistence with multi-monitor support, sidebar collapse/width state, user preferences (theme, font size, default model), versioned state schema with migration functions
- **DeepLinkHandler** (E4-S3): `holokai://` protocol registration on all platforms, route parsing for thread/project/workflow/settings URLs, navigation handling for both cold-start and warm-start scenarios
- **ThreadRepository** (E4-S4): Local thread cache with gzip compression (~70% size reduction), AES-256-GCM encryption with OS keychain integration, LRU cache policy (500MB max), lazy message loading (50 message chunks), cache statistics and management

**Out of Scope:**
- Backend API endpoint changes (Epic 1)
- UI components for thread branching visualization (Epic 2)
- Project collaboration UI features (Epic 3)
- File upload/download integration (Epic 5)
- Insights dashboard components (Epic 6)
- Workflow execution engine (Epic 7)
- Any UI/UX polish beyond core notification toasts (Epic 8)

## System Architecture Alignment

**Architecture Compliance:** This epic aligns with `architecture-2025-11-25.md §2 (Desktop Application Architecture)` and implements the desktop core services defined in `desktop-core-requirements-2025-11-25.md §8-10`.

**Key Components Referenced:**
- **Main Process Services:** NotificationService, StateStore, DeepLinkHandler, ThreadRepository (all in Electron main process)
- **Renderer Components:** Toast.svelte, ToastContainer.svelte (Svelte UI components for in-app notifications)
- **IPC Bridge:** Context bridge exposes notification, state, and deep link APIs to renderer process
- **Secure Storage:** Electron safeStorage for state persistence, OS keychain (via keytar) for encryption keys

**Architectural Constraints:**
- All services operate in Electron main process for security (file system, encryption, OS integration)
- Renderer process communicates via IPC context bridge only (no direct Node.js access)
- State persistence uses electron-store (JSON file in app data directory)
- Thread cache stored in `~/.holokai/cache/threads/` with file-based storage
- Encryption keys never exposed to renderer process or stored in plaintext
- Deep link handling must support single-instance mode (prevent multiple app instances)

## Detailed Design

### Services and Modules

| Module/Service | Responsibilities | Inputs | Outputs | Owner |
|----------------|------------------|--------|---------|-------|
| **NotificationService** | System + in-app notifications | NotificationPayload (type, title, message, duration) | OS notifications, toast UI updates | Main Process |
| **ToastContainer.svelte** | Toast message display and stacking | Toast events from NotificationService | Rendered toast UI components | Renderer Process |
| **Toast.svelte** | Individual toast component | NotificationPayload | Single toast with auto-dismiss | Renderer Process |
| **NotificationHistoryStore** | Notification history persistence | Notification records | History list (last 50), read/unread status | Main Process |
| **StateStore** | Application state persistence | State updates (window, sidebar, prefs) | Persisted state, restored on launch | Main Process |
| **WindowStateManager** | Window position/size tracking | Window resize/move events | Saved window bounds | Main Process |
| **DeepLinkHandler** | Protocol URL parsing and routing | `holokai://` URLs | Navigation actions | Main Process |
| **DeepLinkParser** | URL parsing and validation | URL string | Route type, parameters | Main Process |
| **DeepLinkRouter** | Route dispatching | Parsed route | SPA navigation | Main Process → Renderer |
| **ThreadRepository** | Local thread cache management | Thread/message data | Compressed+encrypted files, cache stats | Main Process |
| **CompressionService** | gzip compression/decompression | Raw thread data | Compressed buffers | Main Process |
| **EncryptionService** | AES-256-GCM encryption/decryption | Compressed data, encryption key | Encrypted buffers | Main Process |
| **CacheManager** | LRU eviction policy | Cache size, access times | Eviction decisions | Main Process |

### Data Models and Contracts

**NotificationPayload:**

```typescript
interface NotificationPayload {
  id?: string;                          // auto-generated if not provided
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  icon?: string;                        // path to icon file
  duration?: number;                    // ms, default 3000 for toasts
  action?: () => void;                 // callback on click
  timestamp?: number;                   // auto-generated
}

interface NotificationHistory {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  source: 'system' | 'toast';
}
```

**StateSchema:**

```typescript
interface StateSchema {
  version: number;                      // for migrations, current: 1

  window: {
    x: number;                          // window position X
    y: number;                          // window position Y
    width: number;                      // window width (min: 800)
    height: number;                     // window height (min: 600)
    maximized: boolean;                 // maximized state
    displayBounds?: {                   // for multi-monitor
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };

  sidebar: {
    collapsed: boolean;                 // primary sidebar collapsed
    width: number;                      // sidebar width (if resizable)
    expandedSections: string[];         // section IDs that are expanded
  };

  preferences: {
    theme: 'light' | 'dark' | 'system'; // UI theme
    fontSize: number;                   // base font size (10-20)
    defaultModel: string;               // default LLM model
    notifications: {
      enableSystem: boolean;            // system notifications enabled
      enableSound: boolean;             // notification sound enabled
      enabledTypes: ('info' | 'success' | 'warning' | 'error')[];
    };
  };

  lastActive: {
    projectId?: string;                 // last viewed project
    threadId?: string;                  // last viewed thread
  };
}
```

**DeepLinkRoute:**

```typescript
interface DeepLinkRoute {
  type: 'thread' | 'project' | 'workflow' | 'settings';
  params: Record<string, string>;       // e.g., { id: 'uuid' }
  queryParams?: Record<string, string>; // optional query params
}

// Supported routes
type DeepLinkURL =
  | `holokai://thread/${string}`           // thread detail
  | `holokai://project/${string}`          // project detail
  | `holokai://workflow/${string}`         // workflow detail
  | `holokai://settings`                   // settings page
  | `holokai://settings/${string}`;        // specific settings tab
```

**ThreadCacheEntry:**

```typescript
interface ThreadCacheEntry {
  threadId: string;
  filePath: string;                     // e.g., ~/.holokai/cache/threads/{id}.dat
  sizeBytes: number;                    // compressed + encrypted size
  lastAccessedAt: number;               // epoch ms
  createdAt: number;
  messageCount: number;
  compressionRatio: number;             // original / compressed
}

interface CacheIndex {
  version: number;                      // index format version
  entries: Map<string, ThreadCacheEntry>;
  totalSizeBytes: number;
  maxSizeBytes: number;                 // default 500MB
}

interface CacheStats {
  totalThreads: number;
  totalSizeBytes: number;
  maxSizeBytes: number;
  utilizationPercent: number;
  oldestAccessedAt: number;
  newestAccessedAt: number;
  hitRate: number;                      // cache hits / total requests
  compressionRatio: number;             // average across all threads
}
```

**Encrypted File Format:**

```typescript
interface EncryptedFileHeader {
  version: number;                      // encryption version
  algorithm: 'AES-256-GCM';
  ivLength: number;                     // IV length in bytes (12)
  authTagLength: number;                // auth tag length (16)
  compressedSizeBytes: number;          // size before encryption
}

// File structure on disk:
// [Header (JSON, 128 bytes)] + [IV (12 bytes)] + [Encrypted Data] + [Auth Tag (16 bytes)]
```

### APIs and Interfaces

**NotificationService IPC API:**

```typescript
// Main process API
class NotificationService {
  showSystemNotification(payload: NotificationPayload): void;
  showToast(payload: NotificationPayload): void;
  getHistory(limit?: number): NotificationHistory[];
  markAsRead(id: string): void;
  markAllAsRead(): void;
  clearHistory(): void;
}

// Renderer process (via context bridge)
window.api.notifications = {
  getHistory: () => invoke('notifications:history'),
  markRead: (id: string) => invoke('notifications:markRead', id),
  markAllRead: () => invoke('notifications:markAllRead'),
  onNotification: (callback) => on('notifications:new', callback)
};
```

**StateStore IPC API:**

```typescript
// Main process API
class StateStore {
  get<K extends keyof StateSchema>(key: K): StateSchema[K] | undefined;
  set<K extends keyof StateSchema>(key: K, value: StateSchema[K]): void;
  delete(key: string): void;
  migrate(fromVersion: number, toVersion: number): void;
  getAll(): StateSchema;
}

// Renderer process (via context bridge)
window.api.preferences = {
  get: () => invoke('preferences:get'),
  set: (prefs: Partial<StateSchema['preferences']>) => invoke('preferences:set', prefs),
  onThemeChanged: (callback) => on('preferences:themeChanged', callback)
};
```

**DeepLinkHandler IPC API:**

```typescript
// Main process API
class DeepLinkHandler {
  register(): void;                     // register holokai:// protocol
  handleURL(url: string): void;         // process deep link URL
  parse(url: string): DeepLinkRoute | null;
  route(route: DeepLinkRoute): void;    // dispatch to navigation
}

// No direct renderer access - deep links trigger navigation automatically
```

**ThreadRepository IPC API:**

```typescript
// Main process API
interface ThreadRepository {
  getThread(id: string): Promise<Thread | null>;
  saveThread(thread: Thread): Promise<void>;
  deleteThread(id: string): Promise<void>;
  listThreads(options?: { limit?: number; offset?: number }): Promise<Thread[]>;

  getMessages(threadId: string, options?: {
    limit?: number;        // default 50
    before?: string;       // cursor
    after?: string;        // cursor
  }): Promise<{
    messages: Message[];
    hasMore: boolean;
    cursor?: string;
  }>;

  saveMessage(message: Message): Promise<void>;
  deleteMessage(id: string): Promise<void>;

  getCacheStats(): CacheStats;
  clearCache(): Promise<void>;
  evictLRU(targetSizeBytes: number): Promise<number>; // returns bytes evicted
}

// Renderer process (via context bridge)
window.api.threads = {
  get: (id: string) => invoke('threads:get', id),
  list: (params) => invoke('threads:list', params),
  // ... other methods exposed via IPC
};
```

### Workflows and Sequencing

**E4-S1: NotificationService Implementation Sequence**

1. Create `src-electron/services/NotificationService.ts`
2. Implement singleton pattern, dependency injection
3. Add `showSystemNotification()` using Electron Notification class
4. Create IPC handler in main process for system notifications
5. Create `src/components/Toast.svelte` component with auto-dismiss timer
6. Create `src/components/ToastContainer.svelte` for stacking toasts
7. Add global toast store (Svelte writable store) in renderer
8. Implement `showToast()` that emits to renderer via IPC
9. Create notification history store (in-memory + persist to StateStore)
10. Add notification settings UI to settings page
11. Wire settings to NotificationService (enable/disable types)
12. Test: System notification → click → app focus
13. Test: Toast notification → auto-dismiss → stacking
14. Test: Notification history → mark read → clear all

**E4-S2: StateStore Implementation Sequence**

1. Install electron-store package (`npm install electron-store`)
2. Create `src-electron/services/StateStore.ts` wrapper
3. Define StateSchema interface with version field
4. Initialize electron-store with default state values
5. Implement `get()`, `set()`, `delete()` methods with type safety
6. Create WindowStateManager to track window bounds
7. Listen for window resize/move events (debounced 500ms)
8. Save window state on change, restore on app launch
9. Handle multi-monitor scenarios (check displayBounds)
10. Add sidebar state tracking (collapse/expand events)
11. Add preferences UI in settings page (theme, fontSize, etc.)
12. Implement state migration system (version 1 → version N)
13. Test: Close app → reopen → window at same position
14. Test: Change theme → close → reopen → theme remembered
15. Test: Migrate from v1 to v2 schema (add new field, preserve existing)

**E4-S3: DeepLinkHandler Implementation Sequence**

1. Create `src-electron/services/DeepLinkHandler.ts`
2. Register `holokai://` protocol in main.ts (app.setAsDefaultProtocolClient)
3. Add protocol to electron-builder config (build.protocols)
4. Create DeepLinkParser utility (parse URL → route object)
5. Create route validation (ensure params are UUIDs, sanitize input)
6. Implement DeepLinkRouter (route object → navigation action)
7. Add IPC message to trigger renderer navigation
8. Handle cold-start scenario (app closed, URL triggers launch)
9. Store pending deep link URL, process after auth check
10. Handle warm-start scenario (app open, URL received)
11. Listen for `second-instance` event (Windows/Linux)
12. Listen for `open-url` event (macOS)
13. Focus existing window on deep link while app running
14. Test: Click `holokai://thread/abc` in browser → app opens thread
15. Test: App running, click deep link → focus + navigate
16. Test: Invalid URL → show error toast, don't crash

**E4-S4: ThreadRepository Implementation Sequence**

1. Install dependencies: `pako` (gzip), `keytar` (keychain)
2. Create cache directory structure (`~/.holokai/cache/threads/`)
3. Create `src-electron/services/EncryptionService.ts`
4. Generate per-installation encryption key (AES-256)
5. Store encryption key in OS keychain via keytar
6. Implement `encrypt(data, key)` and `decrypt(data, key)` with AES-256-GCM
7. Create `src-electron/services/CompressionService.ts`
8. Implement `compress(data)` and `decompress(data)` with pako (gzip)
9. Create `src-electron/repositories/ThreadRepository.ts`
10. Implement write path: Thread → compress → encrypt → write to disk
11. Implement read path: read from disk → decrypt → decompress → Thread
12. Create cache index file (JSON) with thread metadata
13. Update index on every cache write/delete
14. Implement lazy message loading (50 message chunks, cursor-based)
15. Implement LRU eviction algorithm (track lastAccessedAt)
16. Add `getCacheStats()` method (size, count, hit rate)
17. Add error handling for corrupt cache files (delete + re-fetch)
18. Emit IPC events for cache operations (hits, misses, evictions)
19. Test: Save 1000-message thread → verify ~70% compression
20. Test: Restart app → encryption key loaded from keychain
21. Test: Cache exceeds 500MB → LRU eviction triggered
22. Test: Corrupt .dat file → detected, deleted, re-fetched from API

## Non-Functional Requirements

### Performance

**NotificationService Performance:**
- Toast notification render time: < 50ms from trigger to visible
- System notification delivery: < 100ms (OS-dependent)
- Notification history query: < 20ms for 50 notifications
- Toast stacking animation: 60 FPS (smooth transitions)
- Maximum concurrent toasts: 5 (older toasts dismissed automatically)

**StateStore Performance:**
- State read operations: < 5ms (in-memory cache)
- State write operations: < 50ms (debounced, written to disk)
- Window resize/move debounce delay: 500ms (prevent excessive writes)
- State migration execution: < 100ms (version 1 → version N)
- App startup state load: < 50ms (blocks UI rendering)

**DeepLinkHandler Performance:**
- Protocol registration: < 100ms during app startup
- Deep link URL parsing: < 10ms
- Route validation: < 20ms
- Navigation dispatch: < 50ms from URL received to SPA route change
- Cold-start navigation: < 2 seconds (launch app + navigate)

**ThreadRepository Performance:**
- Cache write (1000-message thread): < 100ms (compress + encrypt + write)
- Cache read (1000-message thread): < 150ms (read + decrypt + decompress)
- Message lazy load (50 messages): < 50ms
- LRU eviction (100 threads): < 500ms
- Cache index update: < 20ms
- Compression ratio target: 70% size reduction (text-heavy threads)
- Cache stats query: < 10ms

### Security

**NotificationService Security:**
- Notification content sanitized before display (prevent XSS in toast messages)
- System notifications respect OS privacy settings (don't show sensitive data in previews)
- Notification history stored in memory only (cleared on logout)
- No sensitive data (tokens, passwords) displayed in notifications

**StateStore Security:**
- State file encrypted using Electron safeStorage API
- State file permissions: read/write for current user only (chmod 600)
- No plaintext secrets stored in state (tokens stored separately in secure storage)
- State migrations validate data types (prevent injection attacks)
- JSON parsing with error handling (corrupt state doesn't crash app)

**DeepLinkHandler Security:**
- Deep link URLs validated before processing (regex validation)
- Route parameters sanitized (prevent path traversal, XSS)
- Authentication check before navigation (require valid session)
- Invalid URLs logged and rejected (no crash, no execution)
- CSRF protection: deep links from external sources require user confirmation for sensitive actions

**ThreadRepository Security:**
- Thread cache encrypted with AES-256-GCM (authenticated encryption)
- Encryption key stored in OS keychain (Windows Credential Manager, macOS Keychain, Linux Secret Service)
- Encryption key never exposed to renderer process or logged
- IV (initialization vector) randomly generated per write (12 bytes)
- Authentication tag verified on decrypt (16 bytes, detects tampering)
- Cache file permissions: read/write for current user only (chmod 600)
- Corrupt cache files deleted (don't expose plaintext)
- Key rotation support (future: migrate cache with new key)

### Reliability/Availability

**NotificationService Reliability:**
- System notification failures don't block app (graceful degradation)
- Toast notifications always work (pure UI, no external dependencies)
- Notification history persists across sessions (stored in StateStore)
- Missing notification settings default to sensible values (all enabled)
- Concurrent toast limit prevents UI clutter (max 5, dismiss oldest)

**StateStore Reliability:**
- Corrupt state file handled gracefully (reset to defaults, log error)
- State write failures logged (don't crash app)
- State migrations idempotent (can run multiple times safely)
- State rollback not supported (migrations are one-way, ensure backups)
- Multi-monitor disconnect handled (window repositioned to primary monitor)
- Window bounds validated (ensure visible on screen before restore)

**DeepLinkHandler Reliability:**
- Invalid deep link URLs logged and rejected (don't crash app)
- Malformed URLs show error toast (user-friendly message)
- Deep link navigation failures logged (route not found, auth required)
- Cold-start deep links queued (processed after app ready)
- Single-instance mode enforced (prevent multiple app instances)
- Deep link race conditions handled (queue URL processing)

**ThreadRepository Reliability:**
- Corrupt cache files detected (authentication tag failure) and deleted
- Cache write failures logged (fallback to API only)
- Cache read failures fallback to API fetch (transparent to user)
- Encryption key not found → generate new key, clear cache
- Disk full → evict LRU threads, log warning
- Cache index corruption → rebuild index from .dat files
- LRU eviction never deletes threads accessed in last 24 hours (protection)
- Cache operations atomic (write to temp file, then rename)

### Observability

**NotificationService Observability:**
- Log all system notifications sent (type, title, timestamp)
- Log notification click events (user engagement tracking)
- Track toast auto-dismiss vs. manual dismiss rates
- Count notifications by type (info/success/warning/error)
- Log notification settings changes (enabled/disabled types)

**StateStore Observability:**
- Log state migrations (version X → version Y, duration, success/failure)
- Log state write errors (disk full, permissions, corruption)
- Log window state restoration (position, size, maximized)
- Track state file size growth over time
- Log multi-monitor events (disconnect, reconnect, reposition)

**DeepLinkHandler Observability:**
- Log all deep link invocations (URL, timestamp, route type)
- Log deep link navigation success/failure
- Track deep link sources (browser, email, external app)
- Log invalid URLs (malformed, unknown routes)
- Count deep link usage by route type (thread/project/workflow/settings)

**ThreadRepository Observability:**
- Log cache operations (hit, miss, write, evict)
- Track cache hit rate (percentage)
- Log compression ratios (per thread, average)
- Track cache size growth over time (total bytes, thread count)
- Log LRU evictions (threadId, lastAccessed, size)
- Log encryption/decryption errors (corrupt files, key issues)
- Emit IPC events for cache stats updates (renderer can display)
- Track cache performance (read/write latencies, p50/p95/p99)

## Dependencies and Integrations

**NPM Dependencies (Desktop Application):**

| Package | Version | Purpose | Story |
|---------|---------|---------|-------|
| **electron-store** | 11.x | State persistence (JSON file storage) | E4-S2 |
| **keytar** | ^7.9.0 | OS keychain integration for encryption keys | E4-S4 |
| **pako** | ^2.1.0 | gzip compression/decompression | E4-S4 |
| **uuid** | ^9.0.0 | Notification ID generation | E4-S1 |
| **electron** | 39.x (existing) | Main process APIs (Notification, safeStorage, protocol) | All |
| **svelte** | 5.x (existing) | UI components (Toast, ToastContainer) | E4-S1 |
| **typescript** | 5.9+ (existing) | Type safety for all services | All |

**Node.js Built-in Modules:**

| Module | Purpose | Story |
|--------|---------|-------|
| **crypto** | AES-256-GCM encryption | E4-S4 |
| **fs/promises** | File system operations (cache management) | E4-S4 |
| **path** | File path resolution | E4-S4 |
| **url** | Deep link URL parsing | E4-S3 |

**Electron APIs Used:**

| API | Purpose | Story |
|-----|---------|-------|
| **Notification** | System notifications | E4-S1 |
| **safeStorage** | Encrypt state file | E4-S2 |
| **app.setAsDefaultProtocolClient()** | Protocol registration | E4-S3 |
| **app.on('open-url')** | Deep link handling (macOS) | E4-S3 |
| **app.on('second-instance')** | Deep link handling (Windows/Linux) | E4-S3 |
| **BrowserWindow.focus()** | Bring window to foreground on deep link | E4-S3 |
| **ipcMain/ipcRenderer** | IPC communication for all services | All |

**OS Integrations:**

| Platform | Integration | Purpose | Story |
|----------|-------------|---------|-------|
| **Windows** | Notification Center | System notifications | E4-S1 |
| **Windows** | Credential Manager | Encryption key storage | E4-S4 |
| **Windows** | Registry | Protocol handler registration | E4-S3 |
| **macOS** | Notification Center | System notifications | E4-S1 |
| **macOS** | Keychain | Encryption key storage | E4-S4 |
| **macOS** | Info.plist | Protocol handler registration | E4-S3 |
| **Linux** | libnotify | System notifications | E4-S1 |
| **Linux** | Secret Service API | Encryption key storage (via keytar) | E4-S4 |
| **Linux** | Desktop Entry | Protocol handler registration | E4-S3 |

**File System Layout:**

```
~/.holokai/                              # App data directory
├── cache/
│   └── threads/
│       ├── index.json                   # Cache index (E4-S4)
│       ├── stats.json                   # Cache statistics (E4-S4)
│       ├── {threadId-1}.dat            # Encrypted thread cache (E4-S4)
│       ├── {threadId-2}.dat
│       └── ...
├── config.json                          # StateStore data (E4-S2, via electron-store)
└── logs/
    └── main.log                         # Application logs
```

**External Service Dependencies:**

- **None** - Epic 4 is entirely local/offline-capable
- Uses existing Phase 1 Moku API endpoints (no new API dependencies)
- ThreadRepository fallback to API on cache miss (not a hard dependency)

**Build & Packaging:**

| Tool | Configuration Required | Purpose |
|------|----------------------|---------|
| **electron-builder** | Add protocol to build.protocols | Deep link protocol registration |
| **TypeScript** | Add types for electron-store, keytar, pako | Type safety |
| **Webpack/Vite** | Bundle pako, exclude keytar (native module) | Build optimization |

**Platform-Specific Requirements:**

**Windows:**
- Windows 10+ required for Notification Center
- .NET Framework 4.5+ for keytar (Credential Manager)

**macOS:**
- macOS 10.14+ (Mojave) for Notification Center
- Code signing required for keychain access

**Linux:**
- libsecret-1-dev for keytar (build dependency)
- Desktop environment with notification daemon (GNOME, KDE, etc.)

**Version Constraints:**

- Electron 39.x required (Notification API, safeStorage)
- Node.js 20.x embedded in Electron (crypto module compatibility)
- keytar requires native build tools (node-gyp)

**Known Compatibility Notes:**

- electron-store 11.x requires Electron 30+
- keytar native module requires rebuild for Electron (electron-rebuild)
- pako is pure JavaScript (no native dependencies, cross-platform)
- Deep link protocol registration varies by platform (electron-builder handles this)
- OS keychain access may require user permission prompts (first use)
- StateStore file location varies by platform (electron-store handles this)

## Acceptance Criteria (Authoritative)

**E4-S1: NotificationService**

1. System notifications appear in OS notification center (Windows Notification Center, macOS Notification Center, Linux libnotify)
2. Clicking system notification brings app window to foreground and focuses it
3. Toast notifications render in-app with correct styling based on type (info=blue, success=green, warning=orange, error=red)
4. Toasts auto-dismiss after configured duration (default 3000ms)
5. Multiple toasts stack vertically without overlap (max 5 concurrent, oldest dismissed first)
6. Toast dismiss button (X) immediately removes toast from UI
7. Notification history stores last 50 notifications with timestamp, type, message, read status
8. `markAsRead(id)` successfully updates notification read status in history
9. `clearAll()` clears all notification history
10. Notification settings UI allows toggle for system notifications, sound, and individual types (info/success/warning/error)
11. Notification settings persist across app restarts (stored in StateStore)

**E4-S2: StateStore**

12. Window opens at last saved position (x, y) on app restart
13. Window opens at last saved size (width, height) on app restart
14. Window maximized state remembered (opens maximized if was maximized)
15. Multi-monitor disconnect handled gracefully (window repositioned to primary monitor if saved position invalid)
16. Sidebar collapsed/expanded state remembered across sessions
17. Sidebar width remembered (if resizable) across sessions
18. Expanded section states remembered (which accordions/panels are open)
19. Theme preference (light/dark/system) remembered and applied on startup
20. Font size preference remembered and applied on startup
21. Default model preference remembered
22. Notification preferences (from E4-S1) remembered
23. Last active project/thread ID remembered
24. State version migrations execute successfully on app startup (v1 → v2 → vN)
25. Corrupt state file handled gracefully (reset to defaults, log error, app doesn't crash)

**E4-S3: DeepLinkHandler**

26. `holokai://thread/{threadId}` navigates to thread detail view
27. `holokai://project/{projectId}` navigates to project detail view
28. `holokai://workflow/{workflowId}` navigates to workflow detail view
29. `holokai://settings` opens settings page
30. `holokai://settings/{section}` opens specific settings tab (e.g., holokai://settings/notifications)
31. Deep link works when app is closed (cold-start: launches app, waits for auth, navigates to target)
32. Deep link works when app is open (warm-start: focuses window, navigates to target)
33. Invalid deep link URLs show error toast with user-friendly message (app doesn't crash)
34. Deep links requiring authentication redirect to login first, then navigate after auth
35. Multiple app instances prevented (second instance sends URL to first instance, then exits)

**E4-S4: ThreadRepository**

36. Threads saved to disk with gzip compression achieving ~70% size reduction for text-heavy threads
37. Threads encrypted with AES-256-GCM before writing to disk (.dat files)
38. Encryption key generated on first run and stored in OS keychain (Windows Credential Manager, macOS Keychain, Linux Secret Service)
39. Threads decrypted and decompressed successfully on read
40. LRU eviction triggered when cache exceeds 500MB (evicts oldest accessed threads)
41. Threads accessed in last 24 hours never evicted (protection for recent threads)
42. Messages load in chunks of 50 (lazy loading, not all messages at once)
43. Cursor-based pagination works (before/after parameters return correct message chunks)
44. Corrupt cache files detected (authentication tag verification fails) and deleted (re-fetch from API)
45. `getCacheStats()` returns accurate cache statistics (size, thread count, oldest/newest access times, hit rate, compression ratio)

## Traceability Mapping

| AC# | Acceptance Criteria | Spec Section(s) | Component(s) | Test Strategy |
|-----|---------------------|-----------------|--------------|---------------|
| 1 | System notifications in OS center | Data Models §NotificationPayload, NFR §Security | NotificationService.showSystemNotification(), Electron Notification | Integration: Trigger notification, verify appears in OS notification center |
| 2 | Clicking notification focuses app | APIs §NotificationService | Notification click handler, BrowserWindow.focus() | Integration: Click notification, verify window focused |
| 3 | Toast styling by type | Data Models §NotificationPayload, Components | Toast.svelte CSS | Unit: Render toast with each type, verify colors |
| 4 | Toast auto-dismiss | Data Models §NotificationPayload duration | Toast.svelte timer logic | Unit: Render toast, wait 3s, verify dismissed |
| 5 | Multiple toasts stack | Services §ToastContainer.svelte | ToastContainer.svelte stacking logic | Integration: Show 6 toasts, verify max 5 visible, oldest dismissed |
| 6 | Toast dismiss button | Components | Toast.svelte dismiss button click handler | Unit: Click X button, verify toast removed |
| 7 | Notification history stores 50 | Data Models §NotificationHistory | NotificationHistoryStore | Integration: Generate 100 notifications, verify only last 50 stored |
| 8 | markAsRead updates status | APIs §NotificationService | NotificationService.markAsRead() | Unit: Mark notification read, verify read=true |
| 9 | clearAll clears history | APIs §NotificationService | NotificationService.clearHistory() | Integration: Add notifications, clear, verify empty |
| 10 | Settings UI toggles | Components | Settings page notification section | Integration: Toggle settings, verify state changes |
| 11 | Settings persist | NFR §StateStore | StateStore, notification preferences | Integration: Change settings, restart app, verify remembered |
| 12 | Window position remembered | Data Models §StateSchema.window | WindowStateManager, BrowserWindow.setBounds() | Integration: Move window, restart, verify same position |
| 13 | Window size remembered | Data Models §StateSchema.window | WindowStateManager, BrowserWindow.setBounds() | Integration: Resize window, restart, verify same size |
| 14 | Maximized state remembered | Data Models §StateSchema.window.maximized | WindowStateManager | Integration: Maximize, restart, verify opens maximized |
| 15 | Multi-monitor disconnect handled | NFR §StateStore Reliability | WindowStateManager multi-monitor validation | Integration: Save position on secondary monitor, disconnect, restart, verify on primary |
| 16 | Sidebar collapsed state remembered | Data Models §StateSchema.sidebar.collapsed | StateStore, sidebar component | Integration: Collapse sidebar, restart, verify collapsed |
| 17 | Sidebar width remembered | Data Models §StateSchema.sidebar.width | StateStore, sidebar resize handler | Integration: Resize sidebar, restart, verify width |
| 18 | Expanded sections remembered | Data Models §StateSchema.sidebar.expandedSections | StateStore, accordion components | Integration: Expand sections, restart, verify expanded |
| 19 | Theme remembered | Data Models §StateSchema.preferences.theme | StateStore, theme service | Integration: Change theme, restart, verify theme applied |
| 20 | Font size remembered | Data Models §StateSchema.preferences.fontSize | StateStore, CSS root font-size | Integration: Change font size, restart, verify applied |
| 21 | Default model remembered | Data Models §StateSchema.preferences.defaultModel | StateStore, model selector | Integration: Change default model, restart, verify selected |
| 22 | Notification prefs remembered | Data Models §StateSchema.preferences.notifications | StateStore | Integration: Covered by AC#11 |
| 23 | Last active remembered | Data Models §StateSchema.lastActive | StateStore | Integration: View thread, restart, verify suggested in UI |
| 24 | State migrations execute | Workflows §E4-S2 step 12 | StateStore.migrate() | Integration: Seed v1 state, start app, verify migrated to v2 |
| 25 | Corrupt state handled | NFR §StateStore Reliability | StateStore error handling | Integration: Corrupt config.json, start app, verify defaults loaded |
| 26 | Thread deep link navigates | Data Models §DeepLinkRoute, Workflows §E4-S3 | DeepLinkHandler.parse(), DeepLinkRouter.route() | Integration: Click holokai://thread/{id}, verify navigation |
| 27 | Project deep link navigates | Data Models §DeepLinkRoute | DeepLinkHandler, DeepLinkRouter | Integration: Click holokai://project/{id}, verify navigation |
| 28 | Workflow deep link navigates | Data Models §DeepLinkRoute | DeepLinkHandler, DeepLinkRouter | Integration: Click holokai://workflow/{id}, verify navigation |
| 29 | Settings deep link opens | Data Models §DeepLinkRoute | DeepLinkHandler, DeepLinkRouter | Integration: Click holokai://settings, verify settings page opens |
| 30 | Settings section deep link | Data Models §DeepLinkRoute params | DeepLinkParser query params | Integration: Click holokai://settings/notifications, verify tab opens |
| 31 | Cold-start deep link | Workflows §E4-S3 step 8-9 | app.on('open-url'), pending URL queue | Integration: App closed, click deep link, verify launches + navigates |
| 32 | Warm-start deep link | Workflows §E4-S3 step 10-13 | app.on('second-instance'), BrowserWindow.focus() | Integration: App open, click deep link, verify focuses + navigates |
| 33 | Invalid URL shows toast | NFR §DeepLinkHandler Security | DeepLinkParser validation | Integration: Click holokai://invalid, verify error toast, no crash |
| 34 | Auth-required deep link | NFR §DeepLinkHandler Security | DeepLinkHandler auth check | Integration: Deep link while logged out, verify login redirect |
| 35 | Single instance enforced | NFR §DeepLinkHandler Reliability | app.requestSingleInstanceLock() | Integration: Launch app twice, verify second exits, URL handled by first |
| 36 | Compression achieves 70% | NFR §ThreadRepository Performance | CompressionService.compress(), pako | Integration: Save 1000-msg thread, verify size reduction ~70% |
| 37 | Encryption with AES-256-GCM | Data Models §EncryptedFileHeader | EncryptionService.encrypt(), crypto.createCipheriv | Integration: Encrypt data, verify ciphertext not readable |
| 38 | Encryption key in OS keychain | NFR §ThreadRepository Security | keytar.setPassword/getPassword | Integration: Generate key, restart app, verify loaded from keychain |
| 39 | Decrypt and decompress on read | Workflows §E4-S4 step 11 | ThreadRepository.getThread() | Integration: Save thread, restart, read, verify matches original |
| 40 | LRU eviction at 500MB | NFR §ThreadRepository Performance | CacheManager.evictLRU() | Integration: Fill cache to 501MB, verify eviction triggered |
| 41 | 24-hour protection | NFR §ThreadRepository Reliability | LRU eviction logic | Integration: Cache full, access thread, wait, verify not evicted if < 24h |
| 42 | Lazy load 50 messages | APIs §ThreadRepository.getMessages | ThreadRepository.getMessages() pagination | Integration: Load thread with 200 msgs, verify first call returns 50 |
| 43 | Cursor pagination works | Data Models §MessageChunk | ThreadRepository cursor logic | Integration: Get 50 msgs, use cursor for next 50, verify correct chunk |
| 44 | Corrupt files deleted | NFR §ThreadRepository Reliability | EncryptionService decrypt error handling | Integration: Corrupt .dat file (modify bytes), verify detected + deleted |
| 45 | Cache stats accurate | APIs §ThreadRepository.getCacheStats | CacheManager.getCacheStats() | Integration: Add threads, query stats, verify counts/sizes match |

## Risks, Assumptions, Open Questions

**Risks:**

1. **[RISK - High]** keytar native module build failures on different platforms (requires node-gyp, Python, C++ build tools)
   - *Mitigation:* Test on all platforms (Windows, macOS, Linux), provide build instructions, consider fallback to Electron safeStorage only

2. **[RISK - Medium]** OS keychain permission prompts may confuse users on first run (macOS Keychain Access, Windows Credential Manager)
   - *Mitigation:* Show explanatory toast before first keychain access, document in help/FAQ

3. **[RISK - Medium]** Deep link protocol registration may fail on Linux (varies by desktop environment)
   - *Mitigation:* Test on major distros (Ubuntu, Fedora, Arch), provide manual registration instructions

4. **[RISK - Low]** State migration bugs could cause data loss (user preferences reset)
   - *Mitigation:* Backup state file before migration, make migrations idempotent, test all migration paths

5. **[RISK - Medium]** Cache corruption could cascade (index out of sync with .dat files)
   - *Mitigation:* Rebuild index on startup if checksums don't match, atomic writes (temp file → rename)

6. **[RISK - Low]** Compression ratio lower than 70% for non-text threads (images, code snippets)
   - *Mitigation:* Track compression ratios, adjust expectations, consider skipping compression for small threads

7. **[RISK - Medium]** Toast notification z-index conflicts with modals/dialogs
   - *Mitigation:* Use high z-index (9999), position toasts in dedicated portal, test with all modal types

**Assumptions:**

1. **[ASSUMPTION]** Users have OS notification permissions enabled (macOS requires explicit permission)
   - *Validation:* Detect permission status, show prompt if denied, gracefully disable system notifications

2. **[ASSUMPTION]** electron-store JSON file size won't exceed 1MB (reasonable for state data)
   - *Validation:* Monitor state file size, log warning if > 500KB, consider binary format if grows large

3. **[ASSUMPTION]** Users won't manually edit cache files or state files
   - *Validation:* Detect corruption on load, reset to defaults if invalid

4. **[ASSUMPTION]** LRU eviction at 500MB is sufficient for most users (won't evict frequently)
   - *Validation:* Track eviction frequency in logs, make configurable in settings if needed

5. **[ASSUMPTION]** Deep links from untrusted sources are safe (no RCE via protocol handler)
   - *Validation:* Validate all URL parameters, sanitize inputs, no eval() or exec(), audit for injection vectors

6. **[ASSUMPTION]** Encryption key stored in OS keychain is secure (no malware can extract)
   - *Validation:* Trust OS keychain implementation, document security model, consider additional encryption layer

7. **[ASSUMPTION]** Electron 39.x Notification API works consistently across all platforms
   - *Validation:* Test system notifications on all platforms, fallback to toast-only if unsupported

**Open Questions:**

1. **[QUESTION]** Should we support notification actionable buttons (Reply, Dismiss, etc.)?
   - *Next Step:* Review UX requirements, check Electron Notification API support

2. **[QUESTION]** What happens to cache when user clears browser data / app data?
   - *Next Step:* Detect cache clear, show re-sync prompt, reload threads from API

3. **[QUESTION]** Should state migrations be reversible (downgrade v2 → v1)?
   - *Next Step:* Product decision, generally not needed for desktop apps

4. **[QUESTION]** Do we need cache encryption for compliance (GDPR, HIPAA)?
   - *Next Step:* Legal review, encryption is already implemented (safe by default)

5. **[QUESTION]** Should deep links support query parameters (e.g., holokai://thread/{id}?message={msgId})?
   - *Next Step:* Expand DeepLinkParser to support query params, add to route schema

6. **[QUESTION]** What's the maximum thread size we support in cache (e.g., 10MB compressed)?
   - *Next Step:* Define limit, reject caching very large threads (fallback to API only)

## Test Strategy Summary

**Testing Pyramid Breakdown:**

| Test Level | Coverage Target | Tools | Focus Areas |
|------------|----------------|-------|-------------|
| **Unit Tests** | 80% code coverage | Vitest, jsdom | Service logic, compression, encryption, URL parsing |
| **Integration Tests** | All IPC APIs, OS integrations | Playwright, Spectron | Notification display, state persistence, deep link navigation, cache operations |
| **E2E Tests** | Critical user flows | Playwright | End-to-end notification + toast flow, state restore flow, deep link flow |
| **Manual Tests** | Platform-specific behavior | Manual QA | OS notification center, keychain prompts, multi-monitor handling |

**Unit Test Coverage (Services/Utilities):**

- **NotificationService:**
  - Test `showSystemNotification()` calls Electron Notification API with correct params
  - Test `showToast()` emits IPC event to renderer with payload
  - Test history management (add, markAsRead, clearAll, 50-item limit)
  - Mock Electron Notification to avoid OS calls

- **StateStore:**
  - Test `get()`, `set()`, `delete()` operations
  - Test type safety (invalid types rejected)
  - Test migration functions (v1 → v2, preserves existing fields, adds new fields)
  - Mock electron-store to avoid file I/O

- **DeepLinkParser:**
  - Test URL parsing for all supported routes (thread, project, workflow, settings)
  - Test invalid URL rejection (malformed, unknown routes)
  - Test parameter extraction (UUIDs validated)
  - Test query parameter parsing (if implemented)

- **CompressionService:**
  - Test compress() + decompress() round-trip (data integrity)
  - Test compression ratio on sample data (text, JSON)
  - Test error handling (corrupt compressed data)

- **EncryptionService:**
  - Test encrypt() + decrypt() round-trip (data integrity)
  - Test authentication tag verification (detect tampering)
  - Test IV randomness (each encrypt uses unique IV)
  - Test error handling (wrong key, corrupt ciphertext)

- **CacheManager:**
  - Test LRU eviction algorithm (evict oldest accessed)
  - Test 24-hour protection (recent threads not evicted)
  - Test cache stats calculation (size, count, hit rate)

**Integration Test Coverage:**

- **Notification Integration:**
  - Test system notification → appears in OS center (Windows/macOS/Linux)
  - Test notification click → app window focuses
  - Test toast render → correct styling, auto-dismiss
  - Test multiple toasts → stacking, max 5 limit
  - Test notification history → persists across restarts

- **State Persistence Integration:**
  - Test window state → save on resize/move, restore on startup
  - Test multi-monitor → handle disconnect, reposition to primary
  - Test sidebar state → collapse/expand, width, expanded sections
  - Test preferences → theme, fontSize, defaultModel persist
  - Test state migration → upgrade v1 → v2 state file

- **Deep Link Integration:**
  - Test cold-start → launch app, navigate to thread
  - Test warm-start → focus window, navigate to thread
  - Test all routes → thread, project, workflow, settings
  - Test invalid URLs → error toast, no crash
  - Test single-instance → second launch sends URL to first, exits

- **Cache Integration:**
  - Test cache write → thread compressed + encrypted + written to disk
  - Test cache read → decrypt + decompress, matches original
  - Test lazy loading → 50 message chunks, cursor pagination
  - Test LRU eviction → fills cache to 501MB, triggers eviction
  - Test corrupt file → detected, deleted, re-fetched from API
  - Test keychain → encryption key persists across restarts

**E2E Test Scenarios:**

1. **Notification Flow:**
   - Trigger event requiring notification (e.g., message received)
   - Verify system notification appears
   - Click notification → app focuses
   - Verify toast appears in-app
   - Wait 3s → toast auto-dismisses
   - Check notification history → event logged

2. **State Restore Flow:**
   - Set preferences (dark theme, font size 14)
   - Resize window to 1200x800, move to position (100, 100)
   - Collapse sidebar
   - Close app
   - Restart app
   - Verify theme, fontSize, window position/size, sidebar state all restored

3. **Deep Link Flow:**
   - App closed
   - Click `holokai://thread/{id}` in browser
   - App launches
   - Login (if needed)
   - Navigate to thread detail
   - Verify thread loaded and displayed

4. **Cache Performance Flow:**
   - Load thread with 1000 messages (cold cache)
   - Measure time (should < 2s from API)
   - Close thread
   - Reopen thread (warm cache)
   - Measure time (should < 200ms from cache)
   - Verify messages match

**Platform-Specific Manual Tests:**

- **Windows:**
  - System notification appears in Windows Notification Center
  - Clicking notification focuses app
  - Encryption key stored in Windows Credential Manager
  - Deep link protocol registered in Registry
  - Multi-monitor handling (extend, duplicate, disconnect)

- **macOS:**
  - System notification appears in macOS Notification Center
  - Notification permission prompt shown on first use
  - Encryption key stored in macOS Keychain
  - Deep link opens via open-url event
  - Multi-monitor handling (Spaces, Mission Control)

- **Linux (Ubuntu 22.04, Fedora 38):**
  - System notification via libnotify (GNOME, KDE)
  - Encryption key stored via Secret Service API
  - Deep link protocol registered in .desktop file
  - Test multiple desktop environments (GNOME, KDE, XFCE)

**Performance Benchmarks:**

1. **Toast Render Time:** < 50ms (measure with performance.now())
2. **State Load Time:** < 50ms (measure app startup)
3. **Deep Link Parse Time:** < 10ms (measure URL → route object)
4. **Cache Write Time (1000 messages):** < 100ms (compress + encrypt + write)
5. **Cache Read Time (1000 messages):** < 150ms (read + decrypt + decompress)
6. **Compression Ratio:** ~70% for text-heavy threads (measure actual vs. expected)

**Security Tests:**

- **Encryption Verification:** Inspect .dat files, verify ciphertext (not plaintext)
- **Key Isolation:** Verify encryption key never logged or exposed to renderer
- **XSS Prevention:** Inject `<script>alert(1)</script>` in notification content, verify sanitized
- **Path Traversal:** Deep link `holokai://thread/../../etc/passwd`, verify rejected
- **State Injection:** Inject malicious JSON in state file, verify rejected

**Continuous Integration:**

- All unit tests run on every commit (CI pipeline)
- Integration tests run on PR (Windows, macOS, Linux runners)
- E2E tests run nightly (full platform matrix)
- Code coverage report generated (fail build if < 80% for new code)

**Manual QA Checklist (Pre-Release):**

- [ ] System notifications work on Windows 10/11
- [ ] System notifications work on macOS 12+
- [ ] System notifications work on Ubuntu 22.04 (GNOME)
- [ ] Encryption key prompts work on all platforms (keychain, credential manager)
- [ ] Deep links work from Chrome, Firefox, Edge
- [ ] Window state persists across restarts (position, size, maximized)
- [ ] Multi-monitor disconnect handled gracefully
- [ ] Cache eviction triggers at 500MB
- [ ] Corrupt cache files detected and deleted
- [ ] State migrations work (v1 → v2)

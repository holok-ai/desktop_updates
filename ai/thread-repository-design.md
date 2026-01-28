# Thread Repository Refactoring - Design Document

## Executive Summary

This document describes the design for updating and simplifying the thread-repository to support branch-based message ordering, local-to-API message synchronization, and branch renumbering. The refactored repository will integrate with the Chat Connection Manager to provide efficient message lifecycle management across multiple concurrent chat sessions.

## 1. Current State Analysis

### 1.1 Current Architecture

**File**: `src-electron/repository/thread-repository.ts` (1305 lines)

**Key Data Structures**:
```typescript
interface Message {
  id: UUID;                    // Random UUID for local messages
  branchId: string;            // Hierarchical ID (e.g., "1.0", "1.1", "1.1.1")
  role: MessageRole;
  content: string;
  createdAt: number;           // Timestamp (epoch ms)
  clientMessageId?: string;    // Optional client-side ID for idempotency
  metadata?: MessageMetadata;
  modelId?: string | null;
}

interface Thread {
  id: UUID;
  messages: Message[];
  currentBranchId: string;     // Active branch (e.g., "1.0")
  metadata: ThreadMetadata;
  createdAt: number;
  updatedAt: number;
}
```

### 1.2 Current Message Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Current Flow                            │
└─────────────────────────────────────────────────────────────────┘

1. UI creates message
   ↓
2. appendMessageLocal(threadId, { content, branchId })
   - Generates random UUID for message.id
   - Uses thread.currentBranchId if branchId not provided
   - Calculates createdAt = max(localNow, lastMessageTime + 1s)
   - Stores in local cache
   ↓
3. Chat service called
   - Uses local messages in cache
   - Chat completes, messages saved to API
   ↓
4. loadThread() called (refresh)
   - Fetches messages from API
   - REPLACES all local cache with API messages
   - Uses deduplicateToolLoopMessages()
   - Orders by createdAt timestamp
```

### 1.3 Problems with Current Approach

| Problem | Impact | Line Refs |
|---------|--------|-----------|
| **No Local-to-API Mapping** | Local messages have random UUIDs; no way to identify which API message corresponds to which local message | 432, 444 |
| **Timestamp-Based Ordering** | Messages ordered by createdAt; doesn't respect branch structure | 282-284, 1039 |
| **Full Replacement on Load** | loadThread() replaces ALL messages; loses local-only messages if API fetch fails | 232-236, 282-284 |
| **No Partial Sync** | No mechanism to fetch "last N messages" and merge with local cache | N/A |
| **No Branch Renumbering** | Cannot reorder/renumber branches; no API update mechanism | N/A |
| **Time Manipulation** | artificially adds 1 second to ensure ordering; fragile | 424 |
| **Tool-Loop Deduplication** | Complex deduplication logic (156-202); may not work with branch-based ordering | 156-202 |

### 1.4 Integration Points

- **Chat Handler** (`chat-handler.ts`): Creates messages via `appendMessageLocal()` before chat
- **Thread API Service** (`thread-api.service.ts`): Fetches/creates messages from Moku API
- **UI Components**: Display messages, switch branches, create variations
- **Chat Connection Manager** (new): Manages concurrent chat sessions per provider/model

## 2. Requirements

### 2.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-1 | Use branchId for message ordering | MUST | Messages sorted by branchId hierarchy, then by position |
| FR-2 | Insert local messages using branchId | MUST | appendMessageLocal() uses branchId for ordering, not timestamp manipulation |
| FR-3 | Sync local messages with API | MUST | Fetch last N messages from API and replace matching local messages by clientMessageId |
| FR-4 | Preserve unsynced local messages | MUST | If sync fails or API returns empty, keep local messages |
| FR-5 | Support branch renumbering | MUST | UI can reorder branches; repository updates branchId and syncs to API |
| FR-6 | Integrate with Chat Connection Manager | MUST | Use manager to determine when chats complete and trigger sync |
| FR-7 | Maintain clientMessageId for idempotency | MUST | All locally created messages have clientMessageId for mapping |
| FR-8 | Support partial message refresh | SHOULD | Fetch only recent messages (last 50) instead of full thread |
| FR-9 | Optimize message loading | SHOULD | Cache branch metadata to avoid full message scans |

### 2.2 Non-Functional Requirements

| ID | Requirement | Target | Notes |
|----|-------------|--------|-------|
| NFR-1 | Message sync latency | < 500ms | For 50 messages |
| NFR-2 | Branch renumbering performance | < 200ms | For updating 100 messages |
| NFR-3 | Memory efficiency | < 5MB per thread | With 1000 messages |
| NFR-4 | Code reduction | 20% fewer lines | Simplify by removing timestamp manipulation |

### 2.3 Design Constraints

- All threads must use 4-digit branch IDs (row.lane.message.tool_sequence)
- Must not break current UI components
- Must work with existing Moku API endpoints
- Must support offline operation (local-only messages)
- Must integrate with Chat Connection Manager lifecycle

## 3. Proposed Architecture

### 3.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        New Flow                                 │
└─────────────────────────────────────────────────────────────────┘

1. UI creates message
   ↓
2. insertLocalMessage (threadId, localMessage, branchId, modelData)
   - Uses provided 4-digit branchId (e.g., "2.0.0.0")
   - Generates clientMessageId = `${threadId}:${branchId}:${timestamp}`
   - branchId contains all ordering information (row.lane.message.tool_sequence)
   - NO timestamp manipulation
   - Stores in local cache with isLocal flag
   ↓
3. Chat service called
   - Chat Connection Manager tracks chat lifecycle
   - Uses local messages in cache
   - Chat completes, messages saved to API by chat service
   ↓
4. syncRecentMessages(threadId, limit=50) called automatically
   - Fetches last 50 messages from API
   - Matches API messages to local messages by branch_id
   - Replaces matched local messages with API versions
   - Keeps unmatched local messages (not yet synced)
   - Orders all messages by 4-digit branchId hierarchy (row.lane.message.tool_sequence)
   ↓
5. UI displays messages
   - Messages ordered by branch structure, not timestamps
   - Local-only messages marked visually (optional)
```

### 3.2 Branch-Based Ordering

**Current Ordering**: `createdAt` timestamp (chronological)

**New Ordering**: 4-digit branch_id hierarchy (row.lane.message.tool_sequence)

#### Branch ID Format

```
Format: row.lane.message.tool_sequence

Examples:
- "1.0.0.0" - First message in thread (row 1, main lane, message 0, no tools)
- "2.0.0.0" - Second message in thread (row 2, main lane, message 0, no tools)
- "2.0.0.1" - Tool response for second message (row 2, main lane, message 0, tool iteration 1)
- "2.0.0.2" - Second tool iteration for second message (row 2, main lane, message 0, tool iteration 2)
- "3.1.0.0" - Branch variation at row 3 (row 3, lane 1, message 0, no tools)
- "3.2.0.0" - Another branch variation at row 3 (row 3, lane 2, message 0, no tools)
- "3.1.1.0" - Second message in branch lane 1 (row 3, lane 1, message 1, no tools)

Digit meanings:
1. Row: Position as you move down the thread (can be a message or branch point)
2. Lane: 0 for main message, 1+ for branch variations
3. Message: Position within the lane (for branches with multiple messages)
4. Tool Sequence: Iteration sequence for tool calls (0 for non-tool messages, 1+ for tool iterations)
```

#### Ordering Rules

```typescript
// Branch hierarchy ordering (lexicographic comparison of 4 digits)
"1.0.0.0" < "1.0.0.1" < "1.0.0.2" < "2.0.0.0" < "2.1.0.0" < "3.0.0.0"

// Branch variations at same row
"3.0.0.0" < "3.1.0.0" < "3.2.0.0" < "3.3.0.0"

// Multiple messages in a branch lane
"3.1.0.0" < "3.1.1.0" < "3.1.2.0"

// Tool iterations for same message
"2.0.0.0" < "2.0.0.1" < "2.0.0.2"

// Comparison algorithm:
1. Split branchId into parts: ["2", "0", "0", "1"]
2. Compare parts numerically left-to-right
3. First difference determines order
4. If all parts equal, compare createdAt (fallback for duplicates)
```

#### Why This Works

- **No separate sequence number needed**: The 4-digit branch_id encodes all ordering information
- **Tool iterations naturally ordered**: Tool responses appear right after their message (e.g., 2.0.0.0 → 2.0.0.1 → 2.0.0.2)
- **Branches naturally grouped**: All variations at row 3 appear together (3.0.0.0, 3.1.0.0, 3.2.0.0, etc.)
- **Deterministic ordering**: No timestamp manipulation needed, branch_id is sufficient

### 3.3 Message Lifecycle States

```typescript
enum MessageSyncState {
  LOCAL_ONLY = 'local_only',       // Created locally, not yet in API
  SYNCED = 'synced',                // Exists in API, has API id
  SYNC_FAILED = 'sync_failed',      // Sync attempted but failed
}

interface Message {
  id: UUID;                          // API id (from Moku) or temp UUID
  branchId: string;                  // 4-digit hierarchical ID (row.lane.message.tool_sequence)
  clientMessageId: string;           // Client-generated ID for matching
  syncState: MessageSyncState;       // Current sync status
  role: MessageRole;
  content: string;
  createdAt: number;                 // API timestamp or local timestamp
  // ... other fields
}
```

### 3.4 Integration with Chat Connection Manager

```typescript
// In chat-handler.ts after chat completes
async function onChatComplete(threadId: string, branchId: string) {
  // Sync recent messages for this thread
  await threadRepository.syncRecentMessages(threadId, { limit: 50 });

  log.info('[ChatHandler] Messages synced after chat completion', { threadId, branchId });
}

// In ChatConnectionManager
class ChatConnectionManager {
  // ... existing methods

  /**
   * Register callback for when chat completes
   */
  public onChatComplete(callback: (threadId: string, branchId: string) => Promise<void>): void {
    this.chatCompleteCallbacks.push(callback);
  }
}
```

## 4. Detailed Design

### 4.1 Message Data Model Changes

**File**: `src-electron/repository/thread-repository.ts`

```typescript
// NEW: 4-digit branch_id for complete ordering
export interface Message {
  id: UUID;
  title: string;
  role: MessageRole;
  content: string;
  createdAt: number;

  // NEW FIELDS
  branchId: string;                    // 4-digit format: row.lane.message.tool_sequence (e.g., "2.0.0.0")
  clientMessageId: string;             // REQUIRED (not optional)
  syncState: MessageSyncState;         // Sync status
  apiId?: string;                      // Original API id (if synced)

  // EXISTING FIELDS
  metadata?: MessageMetadata;
  deletedAt?: number | null;
  editedAt?: number;
  versions?: MessageVersion[];
  isEdited?: boolean;
  modelId?: string | null;
}

// NEW: Message sync state enum
export enum MessageSyncState {
  LOCAL_ONLY = 'local_only',
  SYNCED = 'synced',
  SYNC_FAILED = 'sync_failed',
}

// NEW: Options for syncing messages
export interface SyncMessagesOptions {
  limit?: number;                      // Number of messages to fetch (default 50)
  force?: boolean;                     // Force sync even if recently synced
}

// NEW: Result of sync operation
export interface SyncResult {
  synced: number;                      // Number of messages synced
  added: number;                       // Number of new messages added
  localOnly: number;                   // Number of local-only messages remaining
  errors: string[];                    // Any errors encountered
}
```

### 4.2 Thread Repository Changes

#### 4.2.1 Generate Client Message ID

```typescript
/**
 * Generate a unique client message ID for idempotency and sync matching.
 * Format: threadId:branchId:timestamp:random
 */
private generateClientMessageId(threadId: string, branchId: string): string {
  const timestamp = Date.now();
  const random = crypto.randomUUID().substring(0, 8);
  return `${threadId}:${branchId}:${timestamp}:${random}`;
}
```

#### 4.2.2 Message Comparison for Sorting

```typescript
/**
 * Compare two messages for sorting by 4-digit branch hierarchy.
 * Branch format: row.lane.message.tool_sequence
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
private compareMessages(a: Message, b: Message): number {
  // Compare branch IDs - they contain all ordering information
  const branchCompare = this.compareBranchIds(a.branchId, b.branchId);
  if (branchCompare !== 0) {
    return branchCompare;
  }

  // Same branch ID - compare timestamps (fallback for exact duplicates)
  return a.createdAt - b.createdAt;
}

/**
 * Compare two 4-digit branch IDs hierarchically.
 * Compares row.lane.message.tool_sequence numerically left-to-right.
 *
 * Examples:
 *   compareBranchIds("1.0.0.0", "1.0.0.1") => -1  (same message, tool iteration 0 < 1)
 *   compareBranchIds("1.0.0.0", "2.0.0.0") => -1  (row 1 < row 2)
 *   compareBranchIds("2.0.0.0", "2.1.0.0") => -1  (row 2 main lane < row 2 branch lane 1)
 *   compareBranchIds("3.1.0.0", "3.1.1.0") => -1  (branch lane 1 message 0 < message 1)
 *   compareBranchIds("1.0.0.0", "1.0.0.0") => 0   (identical)
 */
private compareBranchIds(a: string, b: string): number {
  const partsA = a.split('.').map(p => parseInt(p, 10));
  const partsB = b.split('.').map(p => parseInt(p, 10));

  // Always compare 4 digits (row, lane, message, tool_sequence)
  const maxLen = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLen; i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;

    if (numA !== numB) {
      return numA - numB;
    }
  }

  return 0;  // All parts equal
}
```

#### 4.2.3 Updated appendMessageLocal

```typescript
/**
 * Create message locally without API call.
 * Messages are created when chat function is called, not via API.
 *
 * CHANGES:
 * - Always generates clientMessageId
 * - Uses 4-digit branchId for all ordering (row.lane.message.tool_sequence)
 * - Sets syncState to LOCAL_ONLY
 * - NO timestamp manipulation (removes lastMessageTime + 1000 hack)
 * - NO separate sequenceNumber field (encoded in branchId)
 */
public async appendMessageLocal(
  threadId: string,
  payload: {
    role: MessageRole;
    content: string;
    metadata?: Record<string, unknown>;
    clientMessageId?: string;  // Optional: use provided or generate
    branchId: string;           // REQUIRED: 4-digit format (row.lane.message.tool_sequence)
    modelId?: string | null;
  },
): Promise<Message> {
  // Check local idempotency cache first
  if (payload.clientMessageId) {
    const byThread = this.idempotencyIndex.get(threadId);
    const existingId = byThread?.get(payload.clientMessageId);
    if (existingId) {
      const thread = this.threadsById.get(threadId);
      const found = thread?.messages.find((m) => m.id === existingId);
      if (found) {
        log.info('[ThreadRepository] Message found in local idempotency cache:', existingId);
        return { ...found };
      }
    }
  }

  // Content size check
  const contentBytes = Buffer.byteLength(payload.content ?? '', 'utf8');
  if (contentBytes > 8 * 1024) throw new Error('MESSAGE_TOO_LARGE');

  // Get thread from cache or fetch it
  let thread = this.threadsById.get(threadId);
  if (!thread) {
    log.info('[ThreadRepository] Thread not in cache, fetching:', threadId);
    const loadedThread = await this.loadThread(threadId);
    if (!loadedThread) throw new Error(`Thread not found: ${threadId}`);
    thread = loadedThread;
  }

  // Use provided 4-digit branchId (caller must provide complete format)
  const branchId = this.normalizeBranchId(payload.branchId);

  // Validate 4-digit format
  const parts = branchId.split('.');
  if (parts.length !== 4) {
    throw new Error(`Invalid branchId format: ${branchId}. Expected 4 digits (row.lane.message.tool_sequence)`);
  }

  // Generate or use provided clientMessageId
  const clientMessageId = payload.clientMessageId ??
    this.generateClientMessageId(threadId, branchId);

  // Create message locally (branchId contains all ordering information)
  const message: Message = {
    id: crypto.randomUUID(),  // Temporary ID until synced
    title: thread.title,
    role: payload.role,
    content: payload.content,
    createdAt: Date.now(),    // NO manipulation - just current time
    branchId,                 // 4-digit format with all ordering info
    clientMessageId,          // REQUIRED for sync matching
    syncState: MessageSyncState.LOCAL_ONLY,  // NEW
    metadata: payload.metadata as MessageMetadata | undefined,
    deletedAt: null,
    modelId: payload.modelId ?? null,
  };

  log.info('[ThreadRepository] Created message locally:', {
    id: message.id,
    branchId,  // e.g., "2.0.0.0" or "2.0.0.1" for tool iteration
    clientMessageId,
    syncState: message.syncState,
  });

  // Add to thread and sort by 4-digit branch hierarchy
  thread.messages.push(message);
  thread.messages.sort((a, b) => this.compareMessages(a, b));
  thread.updatedAt = Date.now();
  this.threadsById.set(thread.id, thread);

  // Update idempotency index
  if (clientMessageId) {
    let byThread = this.idempotencyIndex.get(threadId);
    if (!byThread) {
      byThread = new Map();
      this.idempotencyIndex.set(threadId, byThread);
    }
    byThread.set(clientMessageId, message.id);
  }

  return { ...message };
}
```

#### 4.2.4 NEW: Sync Recent Messages

```typescript
/**
 * Sync recent messages from API with local cache.
 *
 * Algorithm:
 * 1. Fetch last N messages from API (default 50)
 * 2. For each API message with clientMessageId:
 *    - Find matching local message by clientMessageId
 *    - If found, replace local message with API version
 *    - Update id, syncState, apiId, createdAt from API
 * 3. For API messages without clientMessageId:
 *    - Add as new messages if not already in cache
 * 4. Keep local messages that weren't matched (not yet synced)
 * 5. Resort all messages by 4-digit branch hierarchy (row.lane.message.tool_sequence)
 *
 * @param threadId - Thread to sync
 * @param options - Sync options (limit, force)
 * @returns Sync result with counts
 */
public async syncRecentMessages(
  threadId: string,
  options: SyncMessagesOptions = {}
): Promise<SyncResult> {
  const limit = options.limit ?? 50;
  const force = options.force ?? false;

  log.info('[ThreadRepository] Syncing recent messages', { threadId, limit, force });

  // Get thread from cache
  const thread = this.threadsById.get(threadId);
  if (!thread) {
    throw new Error(`Thread not found in cache: ${threadId}`);
  }

  // Check if recently synced (unless force)
  const lastSyncKey = `lastSync:${threadId}`;
  const lastSync = this.syncTimestamps.get(lastSyncKey);
  if (!force && lastSync && Date.now() - lastSync < 5000) {
    log.info('[ThreadRepository] Skipping sync - recently synced:', threadId);
    return {
      synced: 0,
      added: 0,
      localOnly: thread.messages.filter(m => m.syncState === MessageSyncState.LOCAL_ONLY).length,
      errors: [],
    };
  }

  const result: SyncResult = {
    synced: 0,
    added: 0,
    localOnly: 0,
    errors: [],
  };

  try {
    // Fetch recent messages from API (sorted by createdAt descending)
    const messagesResponse = await threadApiService.getMessages(threadId, {
      size: limit,
      sort: 'createdAt,desc',
    });

    log.info('[ThreadRepository] Fetched', messagesResponse.content.length, 'messages from API');

    // Deduplicate tool-loop messages (existing logic)
    const dedupedMessages = this.deduplicateToolLoopMessages(messagesResponse.content);

    // Create lookup maps
    const localByClientId = new Map<string, Message>();
    const localById = new Map<string, Message>();

    for (const msg of thread.messages) {
      if (msg.clientMessageId) {
        localByClientId.set(msg.clientMessageId, msg);
      }
      localById.set(msg.id, msg);
    }

    const apiById = new Map<string, MessageDTO>();
    for (const dto of dedupedMessages) {
      apiById.set(dto.id, dto);
    }

    // Process API messages
    for (const dto of dedupedMessages) {
      // Extract clientMessageId from API message
      const clientId = dto.metadata?.clientMessageId as string | undefined;

      if (clientId && localByClientId.has(clientId)) {
        // MATCH FOUND - Replace local message with API version
        const localMsg = localByClientId.get(clientId)!;
        const apiMessage = this.mapDTOToMessage(dto, thread.title);

        // Update sync fields (branchId comes from API, contains all ordering info)
        apiMessage.clientMessageId = clientId;
        apiMessage.syncState = MessageSyncState.SYNCED;
        apiMessage.apiId = dto.id;

        // Replace in thread.messages array
        const index = thread.messages.findIndex(m => m.id === localMsg.id);
        if (index !== -1) {
          thread.messages[index] = apiMessage;
          result.synced++;

          log.info('[ThreadRepository] Synced message', {
            clientId,
            localId: localMsg.id,
            apiId: dto.id,
            branchId: apiMessage.branchId,
          });
        }
      } else if (!localById.has(dto.id)) {
        // NEW MESSAGE - Add to thread
        const apiMessage = this.mapDTOToMessage(dto, thread.title);
        apiMessage.syncState = MessageSyncState.SYNCED;
        apiMessage.apiId = dto.id;

        // branchId from API already contains all ordering info (row.lane.message.tool_sequence)
        thread.messages.push(apiMessage);
        result.added++;

        log.info('[ThreadRepository] Added new message from API', {
          apiId: dto.id,
          branchId: apiMessage.branchId,
        });
      }
      // else: Message already exists in cache with API id - skip
    }

    // Count remaining local-only messages
    result.localOnly = thread.messages.filter(
      m => m.syncState === MessageSyncState.LOCAL_ONLY
    ).length;

    // Resort messages by 4-digit branch hierarchy (row.lane.message.tool_sequence)
    thread.messages.sort((a, b) => this.compareMessages(a, b));

    // Update cache and sync timestamp
    thread.updatedAt = Date.now();
    this.threadsById.set(threadId, thread);
    this.syncTimestamps.set(lastSyncKey, Date.now());

    log.info('[ThreadRepository] Sync complete', result);

  } catch (error) {
    log.error('[ThreadRepository] Sync failed:', error);
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

// Add private field to track sync timestamps
private readonly syncTimestamps: Map<string, number> = new Map();
```

#### 4.2.5 NEW: Renumber Branch

```typescript
/**
 * Renumber messages in a branch (and all sub-branches).
 * Updates branchId for all affected messages and syncs to API.
 *
 * Example: Renumber branch from row 2 to row 3
 * - "2.0.0.0" -> "3.0.0.0" (main message at row 2 moves to row 3)
 * - "2.0.0.1" -> "3.0.0.1" (tool iteration moves with message)
 * - "2.1.0.0" -> "3.1.0.0" (branch lane preserved)
 * - "2.1.1.0" -> "3.1.1.0" (branch messages preserved)
 *
 * @param threadId - Thread ID
 * @param oldBranchPrefix - Current branch prefix (e.g., "2" for row 2)
 * @param newBranchPrefix - New branch prefix (e.g., "3" for row 3)
 * @returns Number of messages updated
 */
public async renumberBranch(
  threadId: string,
  oldBranchId: string,
  newBranchId: string,
): Promise<number> {
  const thread = this.threadsById.get(threadId);
  if (!thread) {
    throw new Error(`Thread not found: ${threadId}`);
  }

  const normalizedOld = this.normalizeBranchId(oldBranchId);
  const normalizedNew = this.normalizeBranchId(newBranchId);

  log.info('[ThreadRepository] Renumbering branch', {
    threadId,
    oldBranchId: normalizedOld,
    newBranchId: normalizedNew,
  });

  // Find all messages that need renumbering
  const oldPrefix = normalizedOld + '.';
  const messagesToUpdate: Message[] = [];

  for (const msg of thread.messages) {
    if (msg.branchId === normalizedOld || msg.branchId.startsWith(oldPrefix)) {
      messagesToUpdate.push(msg);
    }
  }

  if (messagesToUpdate.length === 0) {
    log.warn('[ThreadRepository] No messages found for branch:', normalizedOld);
    return 0;
  }

  // Update branchId for each message
  const updatePromises: Promise<void>[] = [];

  for (const msg of messagesToUpdate) {
    // Calculate new branchId
    const newBranchIdForMsg = msg.branchId === normalizedOld
      ? normalizedNew
      : msg.branchId.replace(normalizedOld, normalizedNew);

    msg.branchId = newBranchIdForMsg;

    // Update in API if message is synced
    if (msg.syncState === MessageSyncState.SYNCED && msg.apiId) {
      const promise = threadApiService.updateMessage(msg.apiId, {
        metadata: {
          ...(msg.metadata || {}),
          branchId: newBranchIdForMsg,
        },
      }).catch(error => {
        log.error('[ThreadRepository] Failed to update message in API:', error);
        // Continue with local update even if API fails
      });

      updatePromises.push(promise);
    }
  }

  // Wait for all API updates
  await Promise.allSettled(updatePromises);

  // Resort messages
  thread.messages.sort((a, b) => this.compareMessages(a, b));
  thread.updatedAt = Date.now();
  this.threadsById.set(threadId, thread);

  log.info('[ThreadRepository] Renumbered', messagesToUpdate.length, 'messages');

  return messagesToUpdate.length;
}
```

#### 4.2.6 Update loadThread

```typescript
/**
 * Load thread from API and cache.
 *
 * CHANGES:
 * - Uses syncRecentMessages() instead of replacing all messages
 * - Preserves local-only messages
 * - Orders messages by 4-digit branch hierarchy
 */
public async loadThread(threadId: string): Promise<Thread | null> {
  // Check cache first
  const cachedThread = this.threadsById.get(threadId);
  if (cachedThread) {
    log.info('[ThreadRepository] Thread found in cache, syncing messages:', threadId);

    // Sync recent messages instead of full replacement
    try {
      await this.syncRecentMessages(threadId, { limit: 50 });
    } catch (error) {
      log.error('[ThreadRepository] Failed to sync messages for cached thread:', error);
      // Continue with cached messages
    }

    return this.cloneThread(cachedThread);
  }

  // Fetch from API
  try {
    log.info('[ThreadRepository] Fetching thread from API:', threadId);
    const threadDTO = await threadApiService.getThread(threadId);

    const desktopDTO = this.toDesktopThreadDTO(threadDTO);
    const thread = this.mapDTOToThread(desktopDTO);

    // Fetch messages for the thread
    log.info('[ThreadRepository] Fetching messages for thread:', threadId);
    const messagesResponse = await threadApiService.getMessages(threadId, { size: 1000 });
    log.info('[ThreadRepository] Received', messagesResponse.content.length, 'message DTOs from API');

    // Deduplicate tool-loop continuation messages
    const dedupedMessages = this.deduplicateToolLoopMessages(messagesResponse.content);

    thread.messages = dedupedMessages.map((dto) => {
      const msg = this.mapDTOToMessage(dto, thread.title);
      msg.syncState = MessageSyncState.SYNCED;
      msg.apiId = dto.id;
      return msg;
    });

    // Sort by 4-digit branch hierarchy (row.lane.message.tool_sequence)
    thread.messages.sort((a, b) => this.compareMessages(a, b));

    // Update cache
    this.threadsById.set(thread.id, thread);
    log.info('[ThreadRepository] Thread fetched and cached:', threadId, 'with', thread.messages.length, 'messages');

    return this.cloneThread(thread);
  } catch (error) {
    log.error('[ThreadRepository] Failed to load thread:', error);
    return null;
  }
}
```

#### 4.2.7 Update mapDTOToMessage

```typescript
/**
 * Map MessageDTO from API to internal Message model.
 * Converts ISO-8601 timestamps to epoch milliseconds.
 *
 * CHANGES:
 * - Extracts 4-digit branchId (row.lane.message.tool_sequence)
 * - Extracts clientMessageId from metadata
 * - Sets syncState to SYNCED
 * - No sequenceNumber needed (encoded in branchId)
 */
private mapDTOToMessage(dto: MessageDTO, threadTitle: string): Message {
  // Extract branchId (4-digit format: row.lane.message.tool_sequence)
  let branchId = dto.branchId;
  if (!branchId && dto.options?.branch_id) {
    branchId = dto.options.branch_id;
  }

  // All messages must have a 4-digit branchId
  if (!branchId) {
    throw new Error(`Message missing branchId: ${dto.id}. All messages must have 4-digit branch IDs.`);
  }

  // Validate and normalize branchId
  branchId = this.normalizeBranchId(branchId);

  // Extract clientMessageId from metadata
  const clientMessageId = (dto.metadata?.clientMessageId as string) ||
    `api:${dto.id}`; // Fallback for messages created without desktop client

  return {
    id: dto.id,
    title: threadTitle,
    role: dto.role as MessageRole,
    content: dto.content,
    createdAt: this.parseApiTimeMs(dto.createdAt),
    branchId,              // 4-digit format contains all ordering info
    clientMessageId,
    syncState: MessageSyncState.SYNCED,
    apiId: dto.id,
    metadata: dto.metadata as MessageMetadata | undefined,
    deletedAt: null,
    editedAt: dto.updatedAt !== dto.createdAt ? this.parseApiTimeMs(dto.updatedAt) : undefined,
    modelId: dto.model ?? null,
  };
}
```

### 4.3 Chat Handler Integration

**File**: `src-electron/ipc-handlers/chat-handler.ts`

```typescript
/**
 * Send Chat Message - Updated to sync after completion
 */
ipcMain.handle(
  'chat:send',
  async (
    event: IpcMainInvokeEvent,
    request: DesktopChatRequest,
  ): Promise<{ success: boolean; error?: string }> => {
    log.info('[IPC] chat:send called');

    if (!currentServiceParams) {
      const errorMessage = 'Chat service not initialized. Call createProvider first.';
      log.error('[IPC]', errorMessage);
      throw new Error(errorMessage);
    }

    try {
      const manager = getManager();
      const getParams: GetServiceParams = {
        appSlug: currentServiceParams.appSlug,
        provider: currentServiceParams.provider,
        model: currentServiceParams.model,
        config: {} as ProviderConfig,
      };

      const chatService = manager.get(getParams);

      await chatService.chat(
        request,
        (token: string) => {
          event.sender.send('chat:token', token);
        },
        (toolName, input, notification) => {
          event.sender.send('chat:toolUse', {
            toolName,
            input,
            ...notification,
          });
        },
        (status: ToolStatus) => {
          event.sender.send('chat:toolStatus', status);
        }
      );

      // Increment call count
      manager.incrementCallCount(
        currentServiceParams.appSlug,
        currentServiceParams.provider,
        currentServiceParams.model,
      );

      // NEW: Sync recent messages after chat completes
      const threadId = request.thread_guid;
      const branchId = request.branch_id;

      if (threadId) {
        try {
          const syncResult = await threadRepository.syncRecentMessages(threadId, { limit: 50 });
          log.info('[IPC] Messages synced after chat', {
            threadId,
            branchId,
            synced: syncResult.synced,
            added: syncResult.added,
            localOnly: syncResult.localOnly,
          });
        } catch (error) {
          log.error('[IPC] Failed to sync messages after chat:', error);
          // Don't fail the chat request if sync fails
        }
      }

      log.info('[IPC] Chat message sent successfully');
      return { success: true };
    } catch (error) {
      log.error('[IPC] Error sending chat message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  },
);
```

### 4.4 API Service Changes

**File**: `src-electron/services/mokuapi/thread-api.service.ts`

```typescript
/**
 * NEW: Update message metadata (for branch renumbering).
 *
 * @param messageId - Message ID
 * @param request - Update request with new metadata
 */
async updateMessage(messageId: string, request: UpdateMessageRequest): Promise<MessageDTO> {
  const accessToken = await this.getAccessToken();
  if (!accessToken) {
    throw new Error('Not authenticated. Please log in.');
  }

  const mokuApiUrl = this.getMokuApiUrl();
  const url = `${mokuApiUrl}/api/messages/${messageId}`;

  log.info('[ThreadApiService] Updating message metadata:', messageId);

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error('[ThreadApiService] Update message failed:', response.status, errorText);

    if (response.status === 401) {
      throw new Error('Authentication failed. Please log in again.');
    }
    throw new Error(`Failed to update message: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as MessageDTO;
  log.info('[ThreadApiService] Message updated successfully:', messageId);
  return data;
}
```

### 4.5 UI Component Changes (Minimal)

**File**: `src/lib/utils/message-utils.ts` (new helper)

```typescript
/**
 * Get display order for messages in a thread.
 * Messages are already sorted by repository, so just return as-is.
 */
export function getDisplayMessages(messages: Message[]): Message[] {
  // Messages are already sorted by branch hierarchy in repository
  return messages;
}

/**
 * Check if a message is local-only (not yet synced to API).
 */
export function isLocalMessage(message: Message): boolean {
  return message.syncState === MessageSyncState.LOCAL_ONLY;
}
```

**Usage in components**: No changes needed if components already iterate messages in order.

## 5. Migration Path

### Phase 1: Add New Fields (Week 1)
1. Add `clientMessageId`, `syncState`, `apiId` to Message interface
2. Update `branchId` to 4-digit format (row.lane.message.tool_sequence)
3. Add MessageSyncState enum
4. Update TypeScript types throughout codebase

### Phase 2: Update Message Creation (Week 1-2)
1. Update `appendMessageLocal()` with new logic:
   - Require 4-digit branchId parameter
   - Generate clientMessageId
   - Validate 4-digit branchId format
   - Remove timestamp manipulation
2. Update `mapDTOToMessage()` to extract clientMessageId and validate 4-digit branchId
3. Add `generateClientMessageId()` helper
4. Update `normalizeBranchId()` to validate 4-digit format

### Phase 3: Implement Ordering (Week 2)
1. Add `compareMessages()` and `compareBranchIds()` methods for 4-digit comparison
2. Update all message array operations to use `.sort(compareMessages)`
3. Test 4-digit branch-based ordering in UI (row.lane.message.tool_sequence)

### Phase 4: Implement Sync (Week 2-3)
1. Add `syncRecentMessages()` method
2. Add syncTimestamps tracking
3. Update `loadThread()` to use sync instead of full replacement
4. Integrate with chat-handler to call sync after chat completion

### Phase 5: Implement Renumbering (Week 3)
1. Add `renumberBranch()` method
2. Add `updateMessage()` to thread-api.service
3. Add UI controls for branch reordering (separate task)

### Phase 6: Testing & Optimization (Week 4)
1. Unit tests for all new methods
2. Integration tests for sync scenarios
3. Performance testing with 1000+ messages
4. Fix bugs and edge cases

### Phase 7: Deployment (Week 5)
1. Deploy to beta
2. Monitor logs for sync errors
3. Gather user feedback
4. Iterate on performance

## 6. Testing Strategy

### 6.1 Unit Tests

```typescript
describe('ThreadRepository - Message Ordering', () => {
  it('should order messages by 4-digit branch hierarchy', () => {
    const messages = [
      { branchId: '1.1.0.0' },  // Row 1, branch lane 1
      { branchId: '1.0.0.0' },  // Row 1, main lane
      { branchId: '1.0.0.1' },  // Row 1, main lane, tool iteration 1
      { branchId: '2.0.0.0' },  // Row 2, main lane
    ];

    messages.sort((a, b) => repo.compareMessages(a, b));

    expect(messages.map(m => m.branchId)).toEqual([
      '1.0.0.0',  // Row 1, main lane comes first
      '1.0.0.1',  // Then tool iteration
      '1.1.0.0',  // Then branch variation
      '2.0.0.0',  // Then row 2
    ]);
  });

  it('should order tool iterations within same message', () => {
    const messages = [
      { branchId: '2.0.0.2' },  // Tool iteration 2
      { branchId: '2.0.0.0' },  // Original message
      { branchId: '2.0.0.1' },  // Tool iteration 1
    ];

    messages.sort((a, b) => repo.compareMessages(a, b));

    expect(messages.map(m => m.branchId)).toEqual([
      '2.0.0.0',
      '2.0.0.1',
      '2.0.0.2',
    ]);
  });

  it('should order multiple messages in branch lane', () => {
    const messages = [
      { branchId: '3.1.2.0' },  // Message 2 in branch lane 1
      { branchId: '3.1.0.0' },  // Message 0 in branch lane 1
      { branchId: '3.1.1.0' },  // Message 1 in branch lane 1
    ];

    messages.sort((a, b) => repo.compareMessages(a, b));

    expect(messages.map(m => m.branchId)).toEqual([
      '3.1.0.0',
      '3.1.1.0',
      '3.1.2.0',
    ]);
  });
});

describe('ThreadRepository - Message Sync', () => {
  it('should sync local messages with API by clientMessageId', async () => {
    // Create local message with 4-digit branchId
    const localMsg = await repo.appendMessageLocal(threadId, {
      content: 'test',
      branchId: '1.0.0.0',  // Row 1, main lane, message 0, no tools
    });

    expect(localMsg.syncState).toBe(MessageSyncState.LOCAL_ONLY);

    // Mock API response with matching clientMessageId
    mockApiService.getMessages.mockResolvedValue({
      content: [{
        id: 'api-123',
        content: 'test',
        branchId: '1.0.0.0',
        metadata: { clientMessageId: localMsg.clientMessageId },
        ...
      }],
    });

    // Sync
    const result = await repo.syncRecentMessages(threadId);

    expect(result.synced).toBe(1);

    // Verify message updated
    const thread = await repo.loadThread(threadId);
    const syncedMsg = thread.messages.find(m => m.clientMessageId === localMsg.clientMessageId);

    expect(syncedMsg.id).toBe('api-123');
    expect(syncedMsg.syncState).toBe(MessageSyncState.SYNCED);
  });

  it('should keep local-only messages when sync returns no match', async () => {
    const localMsg = await repo.appendMessageLocal(threadId, {
      content: 'local only',
      branchId: '1.0.0.0',
    });

    mockApiService.getMessages.mockResolvedValue({ content: [] });

    const result = await repo.syncRecentMessages(threadId);

    expect(result.localOnly).toBe(1);

    const thread = await repo.loadThread(threadId);
    expect(thread.messages).toContainEqual(expect.objectContaining({
      id: localMsg.id,
      syncState: MessageSyncState.LOCAL_ONLY,
    }));
  });
});

describe('ThreadRepository - Branch Renumbering', () => {
  it('should renumber branch row and preserve structure', async () => {
    // Create messages at row 2 with various lanes and tool iterations
    await repo.appendMessageLocal(threadId, { content: 'm1', branchId: '2.0.0.0' });  // Main message
    await repo.appendMessageLocal(threadId, { content: 'm2', branchId: '2.0.0.1' });  // Tool iteration
    await repo.appendMessageLocal(threadId, { content: 'm3', branchId: '2.1.0.0' });  // Branch lane 1

    // Renumber row 2 -> row 3
    const count = await repo.renumberBranch(threadId, '2', '3');

    expect(count).toBe(3);

    const thread = await repo.loadThread(threadId);
    const branchIds = thread.messages.map(m => m.branchId);
    expect(branchIds).toContain('3.0.0.0');  // Main message moved to row 3
    expect(branchIds).toContain('3.0.0.1');  // Tool iteration preserved
    expect(branchIds).toContain('3.1.0.0');  // Branch lane preserved
  });
});
```

### 6.2 Integration Tests

```typescript
describe('Chat Handler Integration', () => {
  it('should sync messages after chat completion', async () => {
    // Create thread and local message
    const thread = await repo.createThread();
    await repo.appendMessageLocal(thread.id, {
      content: 'user prompt',
      branchId: '1.0.0',
    });

    // Send chat (mocked)
    await chatHandler.send({
      thread_guid: thread.id,
      branch_id: '1.0.0',
      messages: [...],
    });

    // Verify sync was called
    expect(repo.syncRecentMessages).toHaveBeenCalledWith(thread.id, { limit: 50 });
  });
});
```

### 6.3 Manual Testing Checklist

- [ ] Create new thread and send message - verify clientMessageId generated and 4-digit branchId used
- [ ] Send multiple messages in same lane - verify branchId third digit increments (e.g., 1.0.0.0 → 1.0.1.0 → 1.0.2.0)
- [ ] Create branch variation - verify messages ordered correctly by 4-digit hierarchy
- [ ] Send message with tool calls - verify tool iterations use fourth digit (e.g., 2.0.0.0 → 2.0.0.1 → 2.0.0.2)
- [ ] Trigger sync after chat - verify local messages replaced with API versions
- [ ] Create local message, go offline, verify message persists with LOCAL_ONLY state
- [ ] Go online, trigger sync, verify local message gets API id
- [ ] Renumber branch row - verify all messages updated and synced to API (e.g., row 2 → row 3)
- [ ] Load thread with 1000+ messages - verify performance < 500ms
- [ ] Switch branches - verify correct messages displayed in 4-digit branch order

## 7. Performance Considerations

### 7.1 Message Ordering Performance

**Current**: O(n log n) for sorting by timestamp
**New**: O(n log n) for sorting by branch hierarchy

**Optimization**: Cache branch comparison results
```typescript
private branchCompareCache = new Map<string, number>();

private compareBranchIds(a: string, b: string): number {
  const cacheKey = `${a}:${b}`;
  if (this.branchCompareCache.has(cacheKey)) {
    return this.branchCompareCache.get(cacheKey)!;
  }

  const result = this.compareBranchIdsImpl(a, b);
  this.branchCompareCache.set(cacheKey, result);
  return result;
}
```

### 7.2 Sync Performance

**Target**: < 500ms for 50 messages

**Optimizations**:
1. Limit API fetch to 50 messages (configurable)
2. Use Map lookups for O(1) matching by clientMessageId
3. Batch API updates for branch renumbering
4. Cache sync timestamps to avoid redundant syncs

### 7.3 Memory Usage

**Current**: ~5KB per message × 1000 messages = 5MB
**New**: ~5.5KB per message (added clientMessageId, syncState, apiId; 4-digit branchId is same size) × 1000 messages = 5.5MB

**Impact**: +10% memory per thread (acceptable, less than originally estimated since no separate sequenceNumber field)

## 8. Error Handling

### 8.1 Sync Failures

```typescript
try {
  await repo.syncRecentMessages(threadId);
} catch (error) {
  log.error('[Sync] Failed:', error);
  // Keep local messages - don't clear cache
  // Retry on next chat or manual refresh
}
```

### 8.2 API Update Failures

```typescript
// In renumberBranch()
const updatePromises = messages.map(msg =>
  api.updateMessage(msg.id, { branchId: newBranchId })
    .catch(err => {
      log.error('[Renumber] Failed to update message:', err);
      // Mark message as sync_failed
      msg.syncState = MessageSyncState.SYNC_FAILED;
    })
);

await Promise.allSettled(updatePromises);
// Continue with local updates even if some API calls failed
```

### 8.3 Validation

```typescript
/**
 * Validate and normalize 4-digit branch ID.
 * All threads are expected to have 4-digit branch IDs.
 */
function normalizeBranchId(branchId: string): string {
  const parts = branchId.split('.');

  // Validate 4-digit format
  if (parts.length !== 4) {
    throw new Error(`Invalid branch ID format: ${branchId}. Expected 4 digits (row.lane.message.tool_sequence)`);
  }

  // Validate all parts are numeric
  for (const part of parts) {
    if (isNaN(parseInt(part, 10))) {
      throw new Error(`Invalid branch ID format: ${branchId}. All parts must be numeric.`);
    }
  }

  return branchId;
}

// Handle messages without sync fields (for messages created before sync implementation)
const clientMessageId = msg.clientMessageId ?? `api:${msg.id}`;
const syncState = msg.syncState ?? MessageSyncState.SYNCED;
```

## 9. Future Enhancements

### 9.1 Optimistic UI Updates

```typescript
// Show message immediately while syncing in background
const optimisticMsg = await repo.appendMessageLocal(threadId, { ... });
ui.displayMessage(optimisticMsg); // Show immediately

// Sync in background
repo.syncRecentMessages(threadId).then(() => {
  ui.refreshMessages(); // Update with API version
});
```

### 9.2 Conflict Resolution

```typescript
// If local and API versions differ, show conflict UI
interface MessageConflict {
  local: Message;
  api: Message;
  resolution: 'keep_local' | 'use_api' | 'merge';
}

// Detect conflicts during sync
if (localMsg.content !== apiMsg.content) {
  conflicts.push({ local: localMsg, api: apiMsg });
}
```

### 9.3 Bulk Operations

```typescript
// Renumber multiple branches at once
async renumberBranches(
  threadId: string,
  mappings: Array<{ oldBranchId: string; newBranchId: string }>
): Promise<number>
```

### 9.4 Message Prefetching

```typescript
// Prefetch messages for likely next branches
async prefetchBranchMessages(threadId: string, branchId: string): Promise<void> {
  // Fetch messages for sibling branches in background
  const siblingBranches = this.getSiblingBranches(branchId);
  for (const sibling of siblingBranches) {
    this.prefetchCache.set(sibling, this.getMessagesByBranchId(threadId, sibling));
  }
}
```

## 10. Implementation Checklist

### Code Changes
- [ ] Update branchId to 4-digit format (row.lane.message.tool_sequence) throughout codebase
- [ ] Add new fields to Message interface (clientMessageId, syncState, apiId)
- [ ] Remove sequenceNumber field (no longer needed)
- [ ] Add MessageSyncState enum
- [ ] Add SyncMessagesOptions and SyncResult interfaces
- [ ] Implement generateClientMessageId()
- [ ] Update normalizeBranchId() to validate 4-digit format
- [ ] Implement compareMessages() and compareBranchIds() for 4-digit comparison
- [ ] Update appendMessageLocal():
  - Remove timestamp manipulation
  - Require 4-digit branchId parameter
  - Validate 4-digit format
  - Add clientMessageId generation
- [ ] Update mapDTOToMessage() (extract clientMessageId, set syncState, handle 4-digit branchId)
- [ ] Update loadThread() (use sync instead of full replacement, remove recalculateSequenceNumbers)
- [ ] Implement syncRecentMessages()
- [ ] Implement renumberBranch() for row-level renumbering
- [ ] Add updateMessage() to thread-api.service
- [ ] Update chat-handler to call sync after chat completion
- [ ] Add message-utils.ts helper functions
- [ ] Update all UI code to provide 4-digit branchIds when creating messages

### Testing
- [ ] Unit tests for 4-digit message ordering (row, lane, message, tool_sequence)
- [ ] Unit tests for tool iteration ordering (4th digit)
- [ ] Unit tests for message sync (matching, adding, preserving local)
- [ ] Unit tests for row-level branch renumbering
- [ ] Unit tests for branchId validation (reject non-4-digit formats)
- [ ] Integration tests for chat-handler sync
- [ ] Manual testing checklist completed
- [ ] Performance testing with 1000+ messages
- [ ] Load testing with concurrent chats

### Documentation
- [ ] Update API documentation
- [ ] Update architecture diagrams
- [ ] Add troubleshooting guide for sync issues
- [ ] Document branch renumbering UI flow (separate task)

### Deployment
- [ ] Code review
- [ ] Merge to main branch
- [ ] Deploy to beta
- [ ] Monitor logs for sync errors
- [ ] Gather user feedback

## 11. Rollback Plan

If critical issues discovered:

1. **Immediate Rollback**:
   - Revert to timestamp-based ordering
   - Disable syncRecentMessages() calls
   - Revert 4-digit branchId requirement

2. **Partial Rollback**:
   - Disable automatic sync (set auto-sync flag to false)
   - Keep new ordering logic
   - Manual sync via UI button only

3. **Investigation**:
   - Review logs for sync errors
   - Check message ordering bugs
   - Verify API contract compliance

## 12. Success Criteria

Implementation successful when:

1. **Functional Requirements Met**:
   - Messages ordered by branch hierarchy (not timestamps)
   - Local messages sync with API correctly
   - Branch renumbering works across all messages
   - No data loss during sync

2. **Performance Requirements Met**:
   - Message sync < 500ms for 50 messages
   - Branch renumbering < 200ms for 100 messages
   - No memory leaks after 100+ chats

3. **Quality Requirements Met**:
   - All unit tests pass
   - All integration tests pass
   - Manual testing checklist completed
   - Code reduced by 20% (removed timestamp manipulation)

4. **User Experience**:
   - No visible changes (transparent upgrade)
   - Branch switching feels instant
   - No message duplication or loss
   - Local-only messages preserved offline

## Appendix A: Related Documents

- `chat-connection-manager-design.md` - Chat Connection Manager design
- `tool-orchestrator-design.md` - Tool orchestrator refactoring
- Thread API documentation (Moku API)

## Appendix B: API Contracts

### Message DTO

```typescript
interface MessageDTO {
  id: string;
  threadId: string;
  branchId?: string;              // May be in options.branch_id
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    clientMessageId?: string;     // Added for sync matching
    [key: string]: unknown;
  };
  options?: {
    branch_id?: string;
    [key: string]: unknown;
  };
  createdAt: string;              // ISO-8601
  updatedAt: string;              // ISO-8601
}
```

### Update Message Request

```typescript
interface UpdateMessageRequest {
  metadata: {
    branchId?: string;            // For branch renumbering
    [key: string]: unknown;
  };
}
```

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **Branch ID** | 4-digit hierarchical identifier (row.lane.message.tool_sequence) - e.g., "2.0.0.0" or "3.1.2.1" |
| **Row** | First digit - position as you move down the thread (can be a message or branch point) |
| **Lane** | Second digit - 0 for main message, 1+ for branch variations at that row |
| **Message** | Third digit - position of message within a lane (for branches with multiple messages) |
| **Tool Sequence** | Fourth digit - iteration sequence for tool calls (0 for non-tool messages, 1+ for tool iterations) |
| **Client Message ID** | Client-generated unique ID for idempotency and sync matching (format: threadId:branchId:timestamp:random) |
| **Sync State** | Status of message sync with API (local_only, synced, sync_failed) |
| **Local Message** | Message created locally, not yet in API |
| **API Message** | Message fetched from or synced to Moku API |
| **Branch Renumbering** | Changing row number for messages (e.g., row 2 → row 3, "2.0.0.0" → "3.0.0.0") |

---

**Document Version**: 1.0
**Last Updated**: 2026-01-22
**Author**: Claude Sonnet 4.5
**Status**: Ready for Implementation

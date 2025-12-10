# Story 4.4: ThreadRepository

Status: ready-for-dev

## Story

As a desktop user,
I want threads cached locally with compression and encryption,
so that I can access threads quickly offline and my data is secure.

## Acceptance Criteria

1. Threads cached locally with gzip compression (ARCH §3.4)
2. Cache encrypted with AES-256-GCM (ARCH §3.4)
3. LRU eviction when cache exceeds 500MB (ARCH §3.4)
4. Messages load in chunks of 50 with cursor-based pagination (ARCH §3.4)
5. Corrupt cache files handled gracefully (delete and re-fetch) (ARCH §3.4)
6. Cache stats available: {size, count, oldest, newest} (ARCH §3.4)
7. Compression achieves ~70% size reduction for text-heavy threads
8. Encryption key stored securely in OS keychain
9. Thread index maintained for fast listing without reading all files
10. Never evict threads accessed in last 24 hours

## Tasks / Subtasks

- [ ] Create ThreadRepository base class and interface (AC: #1-#10)
  - [ ] Create `src/repositories/base.repository.ts` with common utilities
  - [ ] Create `src/repositories/thread.repository.ts`
  - [ ] Define ThreadRepository interface: saveThread, getThread, deleteThread, listThreads, getMessages, evictLRU, getCacheStats
  - [ ] Create cache directory: `~/.holokai/cache/threads/`
  - [ ] Create thread index file: `~/.holokai/cache/threads/index.json`
  - [ ] Inject CryptoService and CompressionService dependencies

- [ ] Implement compression layer (AC: #1, #7)
  - [ ] Use Node.js zlib.gzip() for compression
  - [ ] Use zlib.gunzip() for decompression
  - [ ] Compress thread JSON before encryption
  - [ ] Decompress after decryption
  - [ ] Add compression stats to CacheStats: {originalSize, compressedSize, ratio}
  - [ ] Write unit test: Compression achieves ~70% reduction for text data
  - [ ] Write unit test: Compress/decompress round trip preserves data

- [ ] Implement encryption layer (AC: #2, #8)
  - [ ] Use crypto.createCipheriv() with AES-256-GCM
  - [ ] Generate per-installation encryption key (32 bytes random)
  - [ ] Store key in OS keychain using keytar library
  - [ ] Key service name: 'holokai-desktop', account: 'cache-encryption-key'
  - [ ] On first run: Generate key, store in keychain
  - [ ] On subsequent runs: Load key from keychain
  - [ ] Encrypt compressed data with authentication tag (GCM)
  - [ ] Decrypt with tag verification (integrity check)
  - [ ] Handle decryption failures: Delete corrupt file, log error, re-fetch from API
  - [ ] Write unit test: Encrypt/decrypt round trip preserves data
  - [ ] Write unit test: Tampered data fails decryption

- [ ] Implement thread storage operations (AC: #1, #2, #9)
  - [ ] saveThread(thread): Serialize → compress → encrypt → write `{threadId}.dat`
  - [ ] Update thread index with: {id, title, lastAccessed, size, messageCount}
  - [ ] getThread(id): Read file → decrypt → decompress → parse JSON
  - [ ] Update lastAccessed timestamp in index
  - [ ] Return null if file not found (cache miss)
  - [ ] deleteThread(id): Delete file, remove from index
  - [ ] listThreads(options): Read index, apply filters/sorting
  - [ ] Options: {sortBy: 'title' | 'lastAccessed', filter?: {projectId?, type?}}
  - [ ] Write unit test: Save/get round trip preserves thread data
  - [ ] Write unit test: Index updated correctly on save

- [ ] Implement lazy loading for messages (AC: #4)
  - [ ] getMessages(threadId, {limit, cursor}): Load thread, extract message chunk
  - [ ] Default limit: 50 messages
  - [ ] Cursor format: {timestamp, messageId} for pagination
  - [ ] Return: {messages: Message[], hasMore: boolean, nextCursor?: Cursor}
  - [ ] Load newest messages first (descending order by created_at)
  - [ ] Support before/after cursor for bidirectional pagination
  - [ ] Cache message positions for efficient seeking (in-memory map)
  - [ ] Write unit test: Lazy load 50 messages from 500-message thread
  - [ ] Write unit test: Cursor pagination forward and backward

- [ ] Implement LRU cache policy (AC: #3, #10)
  - [ ] Track lastAccessed timestamp per thread (in index)
  - [ ] Implement evictLRU(targetSizeBytes) method
  - [ ] Sort threads by lastAccessed ascending (oldest first)
  - [ ] Skip threads accessed in last 24 hours (never evict)
  - [ ] Delete oldest threads until cache size < targetSizeBytes
  - [ ] Default max cache size: 500MB (configurable via settings)
  - [ ] Run eviction check on app startup and after each save
  - [ ] Log eviction: "Evicted {count} threads, freed {sizeBytes}"
  - [ ] Write unit test: LRU evicts oldest threads first
  - [ ] Write unit test: Never evict threads accessed in last 24h

- [ ] Implement cache management utilities (AC: #6)
  - [ ] getCacheStats(): Calculate total size, thread count, oldest/newest accessed
  - [ ] Return: {totalSize, threadCount, oldestAccess, newestAccess, compressionRatio}
  - [ ] Scan cache directory, sum file sizes
  - [ ] clearCache(): Delete all .dat files, reset index
  - [ ] Confirm before clear (show cache stats first)
  - [ ] exportThread(id, path): Export unencrypted JSON for debugging
  - [ ] importThread(path): Import JSON, encrypt, save to cache
  - [ ] Write unit test: Cache stats calculated correctly

- [ ] Add error handling and recovery (AC: #5)
  - [ ] Handle file system errors: EACCES, ENOENT, ENOSPC
  - [ ] Handle corrupt cache files: Catch decryption/decompression errors
  - [ ] On corrupt file: Delete file, remove from index, log error, emit 'cache-error' event
  - [ ] Emit events: 'cache-miss', 'cache-hit', 'cache-error', 'cache-evicted'
  - [ ] Log all cache operations with context (threadId, operation, duration, error)
  - [ ] Write unit test: Corrupt file triggers re-fetch
  - [ ] Write unit test: Disk full error handled gracefully

- [ ] Implement cache warming on app startup (AC: #1, #3)
  - [ ] On app ready: Load index, calculate cache size
  - [ ] If cache > 500MB: Run evictLRU()
  - [ ] Prefetch last N accessed threads (e.g., 10) for offline availability
  - [ ] Log cache status: "Cache ready: {count} threads, {size}MB"

## Dev Notes

### Architecture Patterns and Constraints

**Cache Directory Structure:**
```
~/.holokai/cache/threads/
  index.json               # Thread metadata index
  {threadId}.dat           # Encrypted + compressed thread data
```

**Index Format:**
```json
{
  "threads": [
    {
      "id": "uuid",
      "title": "Thread Title",
      "lastAccessed": "2025-11-27T10:00:00Z",
      "size": 102400,
      "messageCount": 150
    }
  ],
  "totalSize": 52428800,
  "version": 1
}
```

**Encryption Pipeline:**
```
Thread JSON → gzip compress → AES-256-GCM encrypt → Write .dat file
Read .dat file → AES-256-GCM decrypt → gzip decompress → Parse JSON
```

**LRU Eviction Policy:**
- Sort by lastAccessed ascending (oldest first)
- Protect threads accessed in last 24h (skip eviction)
- Evict until cache size < max (500MB default)
- Never evict active threads (currently open in UI)

### Project Structure Notes

**File Locations:**
- `src/repositories/thread.repository.ts` - Main ThreadRepository implementation
- `src/repositories/base.repository.ts` - Common repository utilities
- `src/services/CryptoService.ts` - AES-256-GCM encryption/decryption
- `src/services/CompressionService.ts` - gzip compression/decompression
- `~/.holokai/cache/threads/` - Cache storage directory

**Dependencies:**
- Node.js crypto module (AES-256-GCM)
- Node.js zlib module (gzip)
- keytar (OS keychain access)
- fs/promises (async file operations)

### Testing Framework

**Unit Tests:**
- Compression/decompression round trip
- Encryption/decryption round trip
- LRU eviction logic
- Index update operations
- Lazy loading pagination
- Error handling (corrupt files, disk full)

**Integration Tests:**
- Full save/load cycle with compression + encryption
- Cache stats calculation
- Eviction triggers at 500MB limit
- Keychain key storage/retrieval

**Performance Tests:**
- Measure compression ratio (target ~70%)
- Measure encrypt/decrypt throughput
- Measure lazy load latency (target <100ms for 50 messages)

### References

- [Source: docs/epics-and-stories-2025-11-25.md §E4-S4]
- [Source: docs/architecture-2025-11-25.md §2.2 - Cache Layer - ThreadCache]

### Learnings from Previous Stories

**From E4-S1, E4-S2, E4-S3:**
- Service layer pattern
- Error handling with logging and events
- Electron-store for settings (use similar pattern for index)
- Graceful degradation on errors

## Dev Agent Record

### Context Reference
- [Story Context XML](e4-s4-threadrepository.context.xml)

### Agent Model Used

<!-- To be filled by dev agent during implementation -->

### Debug Log References

<!-- To be filled by dev agent during implementation -->

### Completion Notes List

<!-- To be filled by dev agent during implementation -->

### File List

<!-- To be filled by dev agent during implementation -->

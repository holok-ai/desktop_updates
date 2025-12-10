# Story 5.2: File Cache (Encrypted)

Status: ready-for-dev

## Story

As a desktop application developer,
I want an encrypted local file cache with TTL-based eviction and user-configurable settings stored in appdata,
so that project files can be accessed quickly without repeated downloads while maintaining security with AES-256 encryption and respecting user preferences.

## Acceptance Criteria

1. FileCache.set() encrypts blob with AES-256 before storing
2. FileCache.get() decrypts blob and returns original file
3. Cache entries have TTL (default 24 hours, configurable per user in appdata)
4. Cache eviction uses LRU when size limit (1GB default) exceeded
5. Cache configuration (maxSizeBytes, defaultTTLHours) stored in appdata per user
6. FileCache.updateConfig() persists configuration changes to appdata
7. Encryption/decryption overhead <50ms for files <10MB
8. Cache hit rate measured and logged
9. Cache cleared on user logout (sensitive data removed)

## Tasks / Subtasks

- [ ] **Task 1: Implement Cache Storage Structure (AC: 3-4)**
  - [ ] Create FileCache class with in-memory Map storage
  - [ ] Implement CacheEntry interface: { data: Blob, cachedAt: Date, ttl: number, expiresAt: Date, fileSize: number }
  - [ ] Add cache metadata tracking: total size (bytes), entry count
  - [ ] Implement TTL-based expiration checking
  - [ ] Implement LRU eviction algorithm (evict oldest when size limit exceeded)

- [ ] **Task 2: Implement AES-256 Encryption/Decryption (AC: 1-2, 7)**
  - [ ] Integrate with KeyManager (Epic 4) to derive encryption keys from desktop master key
  - [ ] **Mitigation if E4 not complete**: Use temporary key derivation (replace when E4 complete)
  - [ ] Implement encrypt() method: Blob → AES-256 → Encrypted Blob
  - [ ] Implement decrypt() method: Encrypted Blob → AES-256 → Original Blob
  - [ ] Use Web Crypto API (crypto.subtle.encrypt/decrypt) for performance
  - [ ] Benchmark encryption overhead: target <50ms for files <10MB
  - [ ] Store encryption key reference in CacheEntry (not the key itself)

- [ ] **Task 3: Implement Cache Operations (AC: 1-2)**
  - [ ] Implement set(fileKey, data, ttl?): encrypt data, store in cache
  - [ ] Implement get(fileKey): check expiration, decrypt data, return blob or null
  - [ ] Implement delete(fileKey): remove cache entry
  - [ ] Implement clear(): remove all cache entries
  - [ ] Implement getSize(): return total cache size in bytes

- [ ] **Task 4: Implement User-Configurable Settings in Appdata (AC: 5-6)**
  - [ ] Define FileCacheConfig interface: { maxSizeBytes, defaultTTLHours }
  - [ ] Determine appdata path per platform:
    - Windows: `%APPDATA%/holokai-desktop/cache-config.json`
    - macOS: `~/Library/Application Support/holokai-desktop/cache-config.json`
    - Linux: `~/.config/holokai-desktop/cache-config.json`
  - [ ] Implement getConfig(): read from appdata, return config
  - [ ] Implement updateConfig(config): merge with existing config, write to appdata
  - [ ] Default values: maxSizeBytes = 1GB, defaultTTLHours = 24
  - [ ] Load config on FileCache initialization

- [ ] **Task 5: Implement Cache Eviction (AC: 4)**
  - [ ] Monitor total cache size after each set() operation
  - [ ] If size exceeds maxSizeBytes:
    - Sort cache entries by last accessed time (LRU)
    - Evict oldest entries until size < maxSizeBytes
    - Log evicted entries (INFO level)
  - [ ] Update cache metadata after eviction

- [ ] **Task 6: Implement Cache Metrics (AC: 8)**
  - [ ] Add hit/miss counters for cache operations
  - [ ] Implement getHitRate(): calculate hit rate percentage
  - [ ] Log cache operations (INFO level): hits, misses, evictions
  - [ ] Expose metrics for observability: cache size, entry count, hit rate

- [ ] **Task 7: Implement Cache Clearing on Logout (AC: 9)**
  - [ ] Listen for logout event from AuthService
  - [ ] On logout: call clear(), remove all cache entries
  - [ ] Secure memory cleanup: overwrite sensitive data before deletion
  - [ ] Log cache cleared (INFO level)

- [ ] **Task 8: Testing and Performance (AC: 7-8)**
  - [ ] Unit test: Encryption/decryption (various file sizes)
  - [ ] Unit test: TTL expiration (entry expires after TTL)
  - [ ] Unit test: LRU eviction (oldest entries evicted first)
  - [ ] Unit test: Config persistence to appdata (write, read, verify)
  - [ ] Integration test: Cache operations with FileService
  - [ ] Performance test: Encryption overhead <50ms for files <10MB
  - [ ] E2E test: Download file twice, second download uses cache

## Dev Notes

### Cache Entry Structure (Tech Spec §4.2)

```typescript
interface CacheEntry {
  data: Blob;               // Encrypted file blob
  cachedAt: Date;
  ttl: number;              // milliseconds (default 86400000 = 24 hours)
  expiresAt: Date;          // cachedAt + ttl
  fileSize: number;         // original file size (bytes)
  lastAccessed: Date;       // for LRU eviction
  encryptionKey: string;    // reference to encryption key (not the key itself)
}

interface FileCacheStore {
  entries: Map<string, CacheEntry>;
  totalSize: number;        // sum of all file sizes (bytes)
  hits: number;
  misses: number;
}
```

### FileCache API (Tech Spec §4.3)

```typescript
interface IFileCache {
  get(fileKey: string): Promise<Blob | null>;
  set(fileKey: string, data: Blob, ttl?: number): Promise<void>;
  delete(fileKey: string): Promise<void>;
  clear(): Promise<void>;
  getSize(): Promise<number>;  // Total cache size in bytes
  getHitRate(): number;         // Hit rate percentage

  // Configuration (stored in appdata per user)
  getConfig(): FileCacheConfig;
  updateConfig(config: Partial<FileCacheConfig>): Promise<void>;
}

interface FileCacheConfig {
  maxSizeBytes: number;         // Default: 1GB (1073741824 bytes)
  defaultTTLHours: number;      // Default: 24 hours
}
```

### AES-256 Encryption (Tech Spec §6.2)

**Encryption Flow:**
1. Derive encryption key from desktop master key (KeyManager from E4)
2. Generate random IV (Initialization Vector) for each file
3. Encrypt file blob using AES-256-GCM
4. Store encrypted blob + IV in cache
5. Store encryption key reference in CacheEntry

**Decryption Flow:**
1. Retrieve encrypted blob + IV from cache
2. Get encryption key from KeyManager using key reference
3. Decrypt blob using AES-256-GCM
4. Return original file blob

**Web Crypto API Example:**
```typescript
async encrypt(data: Blob, key: CryptoKey): Promise<{ encrypted: Blob, iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));  // GCM IV
  const buffer = await data.arrayBuffer();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    buffer
  );
  return { encrypted: new Blob([encrypted]), iv };
}

async decrypt(encryptedData: Blob, key: CryptoKey, iv: Uint8Array): Promise<Blob> {
  const buffer = await encryptedData.arrayBuffer();
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    buffer
  );
  return new Blob([decrypted]);
}
```

### User-Configurable Settings in Appdata (Tech Spec §4.3)

**Appdata Path Determination:**
```typescript
function getAppdataPath(): string {
  const platform = process.platform;
  const homeDir = os.homedir();

  switch (platform) {
    case 'win32':
      return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'holokai-desktop');
    case 'darwin':
      return path.join(homeDir, 'Library', 'Application Support', 'holokai-desktop');
    case 'linux':
      return path.join(process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config'), 'holokai-desktop');
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
```

**Config File Structure (cache-config.json):**
```json
{
  "maxSizeBytes": 1073741824,
  "defaultTTLHours": 24
}
```

**Config Persistence:**
```typescript
async updateConfig(config: Partial<FileCacheConfig>): Promise<void> {
  const configPath = path.join(getAppdataPath(), 'cache-config.json');
  const currentConfig = await this.getConfig();
  const newConfig = { ...currentConfig, ...config };

  // Write to appdata
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  await fs.promises.writeFile(configPath, JSON.stringify(newConfig, null, 2));

  // Update in-memory config
  this.config = newConfig;
}
```

### LRU Eviction Algorithm (Tech Spec §6.1)

```typescript
async evictIfNeeded(): Promise<void> {
  if (this.totalSize <= this.config.maxSizeBytes) {
    return;  // No eviction needed
  }

  // Sort entries by lastAccessed (oldest first)
  const sortedEntries = Array.from(this.entries.entries())
    .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());

  const evictedFiles = [];

  // Evict oldest entries until size < maxSizeBytes
  for (const [fileKey, entry] of sortedEntries) {
    if (this.totalSize <= this.config.maxSizeBytes) {
      break;
    }

    this.entries.delete(fileKey);
    this.totalSize -= entry.fileSize;
    evictedFiles.push(fileKey);
  }

  logger.warn(`Cache eviction: ${evictedFiles.length} files evicted (size limit exceeded)`);
}
```

### Cache Clearing on Logout (Tech Spec §6.2)

```typescript
// Listen for logout event
authService.on('logout', async () => {
  await fileCache.clear();
  logger.info('File cache cleared on user logout');
});

async clear(): Promise<void> {
  // Overwrite sensitive data before deletion (secure cleanup)
  for (const [fileKey, entry] of this.entries.entries()) {
    // Overwrite encrypted blob with random data
    const buffer = await entry.data.arrayBuffer();
    const overwrite = crypto.getRandomValues(new Uint8Array(buffer.byteLength));
    // Note: In-memory only, no filesystem writes needed
  }

  this.entries.clear();
  this.totalSize = 0;
  this.hits = 0;
  this.misses = 0;
}
```

### Performance Targets (Tech Spec §6.1)

- **Cache Lookup**: <10ms
- **Cache Hit**: <50ms (decrypt + return blob)
- **Encryption Overhead**: <50ms for files <10MB
- **Cache Hit Rate**: >80% target
- **Cache Size Limit**: 1GB default (configurable)
- **Cache TTL**: 24 hours default (configurable)

### Testing Strategy

- **Unit Tests**: Encryption/decryption, TTL expiration, LRU eviction, config persistence
- **Integration Tests**: Cache operations with FileService, logout clears cache
- **Performance Tests**: Encryption overhead, cache hit rate
- **Security Tests**: Encrypted cache files unreadable without decryption key

### Dependencies

- **BLOCKER: E4-S2 (KeyManager)** - Needed for encryption key derivation
  - **Mitigation**: Implement temporary key derivation, replace when E4 complete
  - Use static key for MVP, migrate to KeyManager-derived keys in E4
- **Used by: E5-S1 (FileService)** - Cache integration for file downloads

### References

- [Tech Spec: Epic 5 File Attachments](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md)
- [Tech Spec §4.2: Data Models (CacheEntry)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#data-models-and-contracts)
- [Tech Spec §4.3: APIs (FileCache API)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#apis-and-interfaces)
- [Tech Spec §6.1: Performance (Cache performance)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#performance)
- [Tech Spec §6.2: Security (Encryption, cache clearing)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#security)
- [Tech Spec §9: Open Question #2 (Local encryption decision)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#open-questions)
- [Tech Spec §9: Open Question #5 (User-configurable TTL decision)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#open-questions)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e5-s2-file-cache-encrypted.context.xml

- docs/sprint-artifacts/e5-s2-file-cache-encrypted.context.xml



### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

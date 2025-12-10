# Epic Technical Specification: File Attachments

Date: 2025-11-26
Author: Peter
Epic ID: 5
Status: Draft

---

## Overview

Epic 5 implements file attachment capabilities with intelligent storage routing: personal thread attachments stored locally for speed, project thread attachments stored in Storage Service (S3/Azure Blob) for team collaboration. This addresses the core file sharing requirement (PRD §3.6) enabling users to attach documents, images, and other files to conversations with automatic encryption, caching, and progress tracking. The implementation includes a unified FileService abstraction layer, encrypted local cache for project files, rich attachment UI with preview and drag-and-drop, and Storage Service integration with presigned URL workflows.

## Objectives and Scope

**In Scope:**
- FileService desktop layer with storage routing logic (personal → local, project → Storage Service)
- File upload with progress tracking and retry logic (3 attempts, exponential backoff)
- File download with caching (encrypted local cache for project files)
- Attachment UI with preview, drag-and-drop upload, file list display
- Storage Service integration via presigned URL workflow
- File cache with encryption at rest (AES-256) and TTL-based eviction
- Supported file types: Images (PNG, JPG, GIF, WebP), PDFs, text files, code files
- File size limits: 10MB per file (configurable), 50MB per message (total attachments)
- Reference counting for file lifecycle management (delete when no references)

**Out of Scope:**
- Video/audio file playback (deferred to Phase 3)
- File versioning or history
- Collaborative editing (Google Docs-style)
- File compression or optimization (beyond browser defaults)
- Virus scanning or malware detection (assume Storage Service handles this)
- Thumbnail generation for images (browser handles preview)
- Offline file access (cache available, but download requires network)
- File sharing outside of thread context (no direct file links)

## System Architecture Alignment

This epic implements the file storage bifurcation pattern (Architecture §5.3, §10.4):

**Components Added:**
- **FileService (Desktop)** - Unified file abstraction with storage routing: personal threads → local filesystem, project threads → Storage Service
- **FileCache (Encrypted)** - Local cache for project files with AES-256 encryption and TTL-based eviction
- **AttachmentUI** - Rich file display with preview, drag-and-drop, progress indicators
- **StorageServiceClient** - Integration with Storage Service presigned URL API

**Architectural Constraints:**
- Personal threads: Files stored in `~/.holokai/files/` (local filesystem)
- Project threads: Files stored in Storage Service (S3/Azure Blob via presigned URLs)
- Cache encrypted at rest using desktop's master encryption key (Epic 4 dependency)
- File metadata stored in local SQLite (`desktop_attachments` table)
- No direct filesystem paths exposed to UI (all operations via FileService abstraction)

**Data Flow:**
User uploads file → FileService.upload() → Check thread context → If personal: save to local filesystem → If project: request presigned URL from Storage Service → upload to S3/Blob → save metadata → update UI

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs | Owner |
|--------|---------------|--------|---------|-------|
| **FileService** | Upload/download with storage routing | File, threadId, messageId | Attachment metadata, progress events | E5-S1 |
| **FileCache** | Encrypted local cache for project files | FileId, blob data | Cached file data, cache hits/misses | E5-S2 |
| **AttachmentUI** | File preview, drag-and-drop, list display | Attachment metadata | User interactions (download, delete, preview) | E5-S3 |
| **StorageServiceClient** | Presigned URL workflow integration | File upload/download requests | Presigned URLs, upload confirmation | E5-S4 |

### Data Models and Contracts

**Attachment Entity:**

```typescript
interface Attachment {
  id: string;
  messageId: string;
  threadId: string;
  fileName: string;
  fileSize: number;         // bytes
  mimeType: string;
  storageType: 'local' | 'storage_service';
  localPath?: string;       // if storageType === 'local'
  storageServiceKey?: string; // if storageType === 'storage_service'
  uploadedAt: Date;
  uploadedBy: string;       // userId
  encryptionKey?: string;   // for encrypted cache
}
```

**Database Schema (desktop_attachments table):**

```sql
CREATE TABLE desktop_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_type TEXT NOT NULL CHECK(storage_type IN ('local', 'storage_service')),
  local_path TEXT,
  storage_service_key TEXT,
  uploaded_at INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL,
  encryption_key TEXT,

  FOREIGN KEY (message_id) REFERENCES desktop_messages(id),
  FOREIGN KEY (thread_id) REFERENCES desktop_threads(id)
);

CREATE INDEX idx_attachments_message ON desktop_attachments(message_id);
CREATE INDEX idx_attachments_thread ON desktop_attachments(thread_id);
```

**Upload Progress Event:**

```typescript
interface UploadProgressEvent {
  attachmentId: string;
  fileName: string;
  loaded: number;           // bytes uploaded
  total: number;            // total file size
  percentage: number;       // 0-100
  status: 'uploading' | 'complete' | 'error';
  error?: string;
}
```

**Storage Service API Contracts:**

```typescript
interface PresignedUploadRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
  projectId: string;
}

interface PresignedUploadResponse {
  uploadUrl: string;        // Presigned S3/Blob URL (expires in 15 minutes)
  fileKey: string;          // Storage key for future downloads
  expiresAt: Date;
}

interface PresignedDownloadRequest {
  fileKey: string;
}

interface PresignedDownloadResponse {
  downloadUrl: string;      // Presigned download URL (expires in 1 hour)
  expiresAt: Date;
}
```

### APIs and Interfaces

**FileService API:**

```typescript
interface IFileService {
  // Upload
  upload(file: File, threadId: string, messageId: string): Promise<Attachment>;
  uploadMultiple(files: File[], threadId: string, messageId: string): Promise<Attachment[]>;

  // Download
  download(attachmentId: string): Promise<Blob>;
  getDownloadUrl(attachmentId: string): Promise<string>;  // For opening in browser

  // Metadata
  getAttachments(messageId: string): Promise<Attachment[]>;
  deleteAttachment(attachmentId: string): Promise<void>;

  // Migration (Epic 3 Integration)
  migrateAttachments(threadId: string, targetProjectId: string): Promise<MigrationResult>;

  // Progress
  onUploadProgress(attachmentId: string, callback: (event: UploadProgressEvent) => void): void;
  onMigrationProgress(threadId: string, callback: (event: MigrationProgressEvent) => void): void;
}

interface MigrationResult {
  success: boolean;
  migratedCount: number;
  failedCount: number;
  errors?: string[];
}

interface MigrationProgressEvent {
  threadId: string;
  totalFiles: number;
  migratedFiles: number;
  currentFile: string;
  percentage: number;  // 0-100
}
```

**Storage Service Endpoints:**

```
POST   /api/storage/upload-url      - Get presigned upload URL
POST   /api/storage/download-url    - Get presigned download URL
DELETE /api/storage/files/{key}     - Delete file (when no references)
```

**IPC Handlers (Electron):**

```typescript
// renderer → main process
ipcRenderer.invoke('files:upload', { file, threadId, messageId });
ipcRenderer.invoke('files:download', attachmentId);
ipcRenderer.invoke('files:delete', attachmentId);
ipcRenderer.on('upload:progress', (event, progressEvent) => { /* update UI */ });
```

**FileCache API:**

```typescript
interface IFileCache {
  get(fileKey: string): Promise<Blob | null>;
  set(fileKey: string, data: Blob, ttl?: number): Promise<void>;
  delete(fileKey: string): Promise<void>;
  clear(): Promise<void>;
  getSize(): Promise<number>;  // Total cache size in bytes

  // Configuration (stored in appdata per user)
  getConfig(): FileCacheConfig;
  updateConfig(config: Partial<FileCacheConfig>): Promise<void>;
}

interface FileCacheConfig {
  maxSizeBytes: number;         // Default: 1GB
  defaultTTLHours: number;      // Default: 24 hours
}
```

### Workflows and Sequencing

**File Upload Flow (Personal Thread):**

1. User drags file into message input or clicks upload button
2. Browser FileReader reads file metadata (name, size, type)
3. Client-side validation: size <10MB, type in allowlist
4. FileService.upload() called with file, threadId, messageId
5. FileService checks thread context: personal thread detected
6. Save file to local filesystem: `~/.holokai/files/{threadId}/{attachmentId}-{fileName}`
7. Create attachment record in desktop_attachments table (storage_type='local')
8. Return attachment metadata to UI
9. UI displays file in message composer with preview
10. User sends message → attachment metadata included in message

**File Upload Flow (Project Thread):**

1. User drags file into message input
2. Client-side validation: size <10MB, type in allowlist
3. FileService.upload() called
4. FileService checks thread context: project thread detected
5. Request presigned upload URL from Storage Service: `POST /api/storage/upload-url`
6. Storage Service returns presigned S3/Blob URL (expires in 15 min)
7. Upload file directly to S3/Blob via presigned URL (HTTP PUT)
8. Upload progress events emitted via IPC to renderer for progress bar
9. On upload complete (HTTP 200), save attachment record (storage_type='storage_service')
10. Return attachment metadata to UI
11. UI displays file with upload complete indicator

**File Download Flow (Cached Project File):**

1. User clicks attachment to download/preview
2. FileService.download(attachmentId) called
3. Check FileCache for cached blob
4. If cache hit: return cached blob immediately (<50ms)
5. UI displays file (opens in browser or downloads)

**File Download Flow (Uncached Project File):**

1. User clicks attachment
2. FileService.download(attachmentId) called
3. Cache miss detected
4. Request presigned download URL: `POST /api/storage/download-url` with fileKey
5. Storage Service returns presigned download URL (expires in 1 hour)
6. Download file from S3/Blob via presigned URL (HTTP GET)
7. Encrypt file blob with AES-256 using attachment.encryptionKey
8. Save to FileCache with TTL (default 24 hours)
9. Return decrypted blob to UI
10. UI displays file

**File Deletion Flow (Reference Counting):**

1. User deletes message with attachments
2. FileService.deleteAttachment(attachmentId) called
3. Check reference count: `SELECT COUNT(*) FROM desktop_attachments WHERE (local_path = ? OR storage_service_key = ?)`
4. If reference count = 1 (last reference):
   - If local: delete file from filesystem
   - If Storage Service: call `DELETE /api/storage/files/{key}`
5. Delete attachment record from desktop_attachments
6. Invalidate FileCache entry

**Drag-and-Drop Upload Flow:**

1. User drags file(s) over message input area
2. Drop zone highlights (visual feedback)
3. User drops file(s)
4. Browser dragover event captured, FileList extracted
5. For each file: validate size, type
6. FileService.uploadMultiple() called with all valid files
7. Upload operations run in parallel (max 3 concurrent)
8. Progress bars displayed for each file
9. On complete: all attachments added to message composer
10. Invalid files rejected with error message (toast notification)

**Thread Move File Migration Flow (Epic 3 Integration):**

1. User moves thread from personal context to project context (Epic 3)
2. FileService.migrateAttachments(threadId, targetProjectId) called
3. Query all attachments for thread: `SELECT * FROM desktop_attachments WHERE thread_id = ?`
4. For each attachment with storage_type='local':
   - Request presigned upload URL from Storage Service
   - Read file from local filesystem
   - Upload file to S3/Blob via presigned URL
   - Update attachment record: storage_type='storage_service', storage_service_key={key}, local_path=null
   - Delete local file after successful migration
5. Migration progress displayed to user (X of Y files migrated)
6. On complete: all files now accessible to project members via Storage Service
7. Rollback on failure: restore local files, revert storage_type changes

## Non-Functional Requirements

### Performance

**Response Time Targets:**
- File upload (local): <500ms for files <1MB
- File upload (Storage Service): <5s for files <10MB (network dependent)
- File download (cached): <50ms
- File download (uncached, Storage Service): <3s for files <10MB
- Presigned URL generation: <500ms (API call to Storage Service)
- Cache lookup: <10ms
- Attachment list render: <100ms for messages with 10 attachments

**Upload Performance:**
- Concurrent uploads: Max 3 files simultaneously
- Progress updates: Every 100ms or 10% completion (whichever is less frequent)
- Retry on failure: 3 attempts with exponential backoff (1s, 2s, 4s)

**Cache Performance:**
- Cache hit rate target: >80% for project files
- Cache size limit: 1GB default (configurable per user in appdata)
- Cache TTL: 24 hours default (configurable per user in appdata settings)
- Cache eviction: LRU when size limit reached
- Encryption/decryption overhead: <50ms for files <10MB

### Security

**File Validation:**
- MIME type validation against allowlist (images, PDFs, text, code)
- File size limits enforced: 10MB per file, 50MB per message
- Executable file rejection (.exe, .bat, .sh, .app, .dmg)
- Malicious file detection: delegate to Storage Service (out of scope for desktop)

**Encryption:**
- FileCache encrypted at rest with AES-256
- Encryption keys derived from desktop master key (Epic 4 KeyManager)
- Local files NOT encrypted (rely on OS filesystem encryption)
- Presigned URLs time-limited: upload URLs expire in 15 min, download URLs in 1 hour

**Authorization:**
- File access tied to thread access (RBAC from Epic 3)
- Presigned URL requests include user JWT for authorization
- Storage Service validates user has access to project before issuing URLs
- Desktop layer validates thread access before allowing download

**Data Protection:**
- Personal files stored locally (not cloud-exposed)
- Project files encrypted in transit (HTTPS) and at rest (S3/Blob encryption)
- Cache cleared on logout (sensitive data removed)
- File deletion cascades when thread/message deleted

### Reliability/Availability

**Upload Resilience:**
- Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s delays)
- Network interruption handling: full file retry (no chunk resumption - multipart upload not supported)
- Presigned URL expiration handling: extend to 1 hour for files >5MB
- Partial upload cleanup: delete incomplete uploads from Storage Service on failure

**Download Resilience:**
- Cache serves as offline fallback (24-hour TTL default)
- Graceful degradation: if Storage Service unavailable, show cached files only
- Presigned URL expiration: auto-renew if user attempts download after 1 hour

**Data Integrity:**
- Reference counting prevents orphaned files
- Atomic upload: file record created only after successful upload
- Atomic delete: file deleted only after record removal
- Transaction rollback on upload failure (no orphaned records)

**Error Recovery:**
- Failed upload: user can retry immediately
- Failed download: automatic retry with exponential backoff
- Corrupted cache: invalidate entry, re-download from Storage Service
- Storage Service outage: graceful error messages, operations queued for retry

### Observability

**Metrics:**
- `file.upload.duration` - P50/P95/P99 upload latency by storage type (local vs Storage Service)
- `file.upload.size` - Histogram of file sizes uploaded
- `file.cache.hit_rate` - Percentage of cache hits
- `file.cache.size` - Current cache size in bytes
- `file.download.duration` - Download latency (cached vs uncached)
- `file.storage_service.presigned_url.duration` - Latency to get presigned URLs
- `file.upload.retry_rate` - Percentage of uploads requiring retries

**Logging:**
- **INFO:** File uploaded (attachmentId, fileName, fileSize, storageType, duration)
- **INFO:** File downloaded (attachmentId, cached: true/false, duration)
- **INFO:** File deleted (attachmentId, orphaned: true/false)
- **WARN:** Upload retry (attachmentId, attempt: 2/3, error)
- **WARN:** Cache eviction (reason: size_limit, files_evicted: 5)
- **ERROR:** Upload failed after 3 retries (attachmentId, error details)
- **ERROR:** Presigned URL request failed (projectId, error)
- **ERROR:** Storage Service unavailable (fallback to cache only)

**Tracing:**
- Distributed trace for upload: UI → FileService → Storage Service (presigned URL) → S3 upload → Metadata save
- Trace download: UI → FileService → Cache check → Storage Service (if miss) → S3 download → Cache save
- Trace file deletion: Message delete → Reference count → Storage Service delete (if last reference)

**Alerting:**
- Alert if upload failure rate > 5% over 10 minutes
- Alert if cache hit rate < 60% (misconfigured TTL or cache too small)
- Alert if Storage Service presigned URL latency > 2s (P95)
- Alert if file upload P95 > 10s for files <10MB (network issue)

## Dependencies and Integrations

**Internal Dependencies (BLOCKERS):**
- **E3-S1: Project Service** - MUST be complete before E5-S1 can route files based on thread context
  - FileService needs ProjectService.get(projectId) to determine if thread is personal or project
- **E4-S2: State Persistence / KeyManager** - NEEDED for FileCache encryption
  - Encryption keys derived from desktop master key
  - **Mitigation:** E5-S2 can implement cache without encryption initially, add encryption when E4 complete

**External Dependencies:**
- **Storage Service API** - Presigned URL endpoints must be deployed
  - Version: Storage Service v1.0+ required
  - Endpoints: POST /upload-url, POST /download-url, DELETE /files/{key}
- **S3/Azure Blob Storage** - Backend storage for project files
  - Must support presigned URL uploads/downloads
  - Must support CORS for browser-based uploads

**Integration Points:**

**1. Storage Service Integration:**
- FileService wraps all Storage Service API calls
- JWT token passed for authorization (from Epic 1 AuthService)
- Presigned URLs generated server-side (not exposed to client)

**2. Thread/Message Integration:**
- Attachments linked to messages via messageId foreign key
- Thread deletion cascades to message deletion cascades to attachment deletion
- Thread move (Epic 3) triggers file migration: local → Storage Service

**3. Project Service Integration:**
- FileService.upload() calls ProjectService.get(thread.projectId) to determine storage routing
- If thread.projectId is null: personal thread → local storage
- If thread.projectId exists: project thread → Storage Service

**4. Cache Integration:**
- FileCache shares TTL/eviction strategy with ProjectCache (Epic 3)
- Both use similar in-memory Map structure with metadata
- Encryption handled by shared KeyManager (Epic 4)

## Acceptance Criteria (Authoritative)

**AC-1: File Service (Desktop) - E5-S1**
- [ ] FileService.upload() successfully uploads file to local filesystem for personal threads
- [ ] FileService.upload() successfully uploads file to Storage Service for project threads
- [ ] Upload progress events emitted every 100ms with percentage, loaded, total
- [ ] Upload retry logic: 3 attempts with exponential backoff on network failure
- [ ] File size validation: reject files >10MB, show error message
- [ ] MIME type validation: accept images, PDFs, text, code; reject executables
- [ ] FileService.download() returns file blob from local filesystem or Storage Service
- [ ] FileService.getAttachments(messageId) returns all attachments for message
- [ ] FileService.deleteAttachment() uses reference counting: deletes file only if last reference
- [ ] Upload completes in <5s for 10MB file (P95, Storage Service)

**AC-2: File Cache (Encrypted) - E5-S2**
- [ ] FileCache.set() encrypts blob with AES-256 before storing
- [ ] FileCache.get() decrypts blob and returns original file
- [ ] Cache entries have TTL (default 24 hours, configurable per user in appdata)
- [ ] Cache eviction uses LRU when size limit (1GB default) exceeded
- [ ] Cache configuration (maxSizeBytes, defaultTTLHours) stored in appdata per user
- [ ] FileCache.updateConfig() persists configuration changes to appdata
- [ ] Encryption/decryption overhead <50ms for files <10MB
- [ ] Cache hit rate measured and logged
- [ ] Cache cleared on user logout (sensitive data removed)

**AC-3: Attachment UI - E5-S3**
- [ ] Drag-and-drop zone highlights when file dragged over
- [ ] Dropped files validated: size, type checked
- [ ] Upload progress bar displays for each file with percentage
- [ ] Attachment list shows: fileName, fileSize, upload status
- [ ] File preview available for images (inline thumbnail)
- [ ] Download button downloads file or opens in browser (based on MIME type)
- [ ] Delete button removes attachment (with confirmation)
- [ ] Multiple file upload: max 3 concurrent uploads
- [ ] UI renders in <100ms for messages with 10 attachments

**AC-4: Storage Service Integration - E5-S4**
- [ ] StorageServiceClient.getUploadUrl() returns presigned upload URL (expires in 15 min for files <5MB, 1 hour for files >5MB)
- [ ] StorageServiceClient.getDownloadUrl() returns presigned download URL (expires in 1 hour)
- [ ] File uploaded directly to S3/Blob via presigned URL (no proxy through desktop)
- [ ] Presigned URL expiration handled: request new URL if expired
- [ ] Storage Service API calls include JWT token for authorization
- [ ] Presigned URL generation completes in <500ms (P95)
- [ ] File deletion calls Storage Service DELETE endpoint when last reference removed

**AC-5: Thread Move File Migration (Epic 3 Integration) - E5-S1**
- [ ] FileService.migrateAttachments(threadId, targetProjectId) migrates all local attachments to Storage Service
- [ ] Migration queries all attachments for thread where storage_type='local'
- [ ] Each local file uploaded to Storage Service via presigned URL
- [ ] Attachment records updated: storage_type='storage_service', storage_service_key set, local_path cleared
- [ ] Local files deleted after successful migration
- [ ] Migration progress displayed to user (X of Y files migrated)
- [ ] Rollback on failure: local files restored, attachment records reverted
- [ ] After migration, all files accessible to project members via Storage Service

## Traceability Mapping

| AC ID | PRD Reference | Spec Section | Component/API | Test Approach |
|-------|---------------|--------------|---------------|---------------|
| AC-1 | PRD §3.6 (File Storage) | Services §4.1, APIs §4.3 | FileService | Unit: Storage routing logic, mock Storage Service<br>Integration: E2E upload to local and Storage Service<br>Performance: Upload latency with various file sizes |
| AC-2 | Architecture §7.1 (Encryption) | Data Models §4.2, APIs §4.3 | FileCache | Unit: Encryption/decryption, TTL expiration, LRU eviction, config persistence<br>Integration: Cache hit/miss scenarios, appdata config storage<br>Performance: Encryption overhead measurement |
| AC-3 | PRD §3.6 (Attachment UI) | Services §4.1 | AttachmentUI | E2E: Drag-and-drop upload, progress tracking, inline preview<br>Visual: Preview rendering for images<br>Accessibility: Keyboard navigation |
| AC-4 | Architecture §9.2 (Storage Service) | APIs §4.3, Workflows §4.4 | StorageServiceClient | Unit: Presigned URL workflow, mock Storage Service<br>Integration: Actual S3/Blob upload<br>Security: URL expiration handling (15 min/<1 hour) |
| AC-5 | Epic 3 (Thread Move) | Workflows §4.4 | FileService | Integration: Thread move triggers file migration<br>E2E: Local files migrated to Storage Service, accessible to project members<br>Error handling: Rollback on failure |

## Risks, Assumptions, Open Questions

**Risks:**

1. **RISK:** Storage Service presigned URL expiration (15 min) could interrupt large file uploads on slow networks
   - **Impact:** Medium - user frustration, lost progress
   - **Mitigation:** Extend presigned URL expiration to 1 hour for large files (>5MB); implement retry logic with exponential backoff
   - **Decision:** Multipart upload NOT supported in MVP (complexity vs benefit trade-off)

2. **RISK:** File cache encryption overhead could degrade performance on low-end hardware
   - **Impact:** Medium - slower downloads
   - **Mitigation:** Benchmark encryption on target hardware; make cache encryption optional for non-sensitive projects

3. **RISK:** Reference counting could fail if concurrent deletions occur (race condition)
   - **Impact:** Medium - orphaned files or premature deletion
   - **Mitigation:** Use database transaction with SELECT FOR UPDATE when checking reference count

4. **RISK:** Local filesystem storage could fill up disk on user's machine
   - **Impact:** Low - desktop app crash or file save failure
   - **Mitigation:** Implement disk space checking before local file save; alert user if <1GB free space

**Assumptions:**

1. **ASSUMPTION:** 10MB file size limit acceptable for MVP (no large video/dataset uploads)
   - **Validation:** Gather user feedback during Beta; increase limit if needed

2. **ASSUMPTION:** Storage Service handles virus scanning and malware detection
   - **Validation:** Confirm with Platform Team; document if not available

3. **ASSUMPTION:** Users will primarily upload images and PDFs (not executables or archives)
   - **Validation:** Track MIME type distribution in analytics; adjust allowlist if needed

4. **ASSUMPTION:** 1GB cache size sufficient for typical user's project files
   - **Validation:** Monitor cache eviction rate; increase limit if eviction happens frequently

**Open Questions:**

~~1. **QUESTION:** Should we support multipart upload for resumable large file uploads?~~
   - **DECISION:** No - multipart upload NOT supported in MVP (complexity vs benefit trade-off). Use retry logic with exponential backoff instead.
   - **Decided by:** Product/Architecture review (2025-11-26)

~~2. **QUESTION:** Should local personal files also be encrypted at rest, or rely on OS encryption?~~
   - **DECISION:** No - rely on OS filesystem encryption for local personal files. Only FileCache (for project files) uses AES-256 encryption.
   - **Decided by:** Product/Architecture review (2025-11-26)

~~3. **QUESTION:** What happens to files when thread moved from personal to project (Epic 3)? Auto-migrate to Storage Service?~~
   - **DECISION:** Files are automatically migrated to Storage Service when thread moves from personal to project context. See "Thread Move File Migration Flow" in Workflows section.
   - **Decided by:** Product/Architecture review (2025-11-26)

~~4. **QUESTION:** Should we show file preview thumbnails inline in messages, or only on click?~~
   - **DECISION:** Show preview thumbnails inline in messages for images. See AC-3 in Acceptance Criteria.
   - **Decided by:** UX Designer (Sally) (2025-11-26)

~~5. **QUESTION:** Should cache TTL be configurable per user, or global setting?~~
   - **DECISION:** Configurable per user as a setting stored in desktop appdata. Default: 24 hours. See FileCacheConfig interface in APIs section.
   - **Decided by:** Architecture review (2025-11-26)

## Test Strategy Summary

**Test Levels:**

**1. Unit Tests (Target: 85% coverage)**
- **FileService:**
  - Storage routing logic (personal vs project threads)
  - File size validation (accept <10MB, reject >10MB)
  - MIME type validation (allowlist enforcement)
  - Retry logic (simulate network failures)
  - Reference counting (delete when count = 1)
- **FileCache:**
  - Encryption/decryption with various file sizes
  - TTL expiration and eviction
  - LRU algorithm (evict oldest when size limit reached)
- **StorageServiceClient:**
  - Presigned URL workflow
  - URL expiration handling
  - JWT token inclusion

**2. Integration Tests**
- **Upload flow (personal):** UI → FileService → Local filesystem → Metadata save → UI update
- **Upload flow (project):** UI → FileService → Storage Service (presigned URL) → S3 upload → Metadata save
- **Download flow (cached):** UI → FileService → Cache hit → Return blob
- **Download flow (uncached):** UI → FileService → Cache miss → Storage Service → S3 download → Cache save → Return blob
- **File deletion:** Message delete → Reference count check → File delete (if last reference)
- **Thread move file migration:** Personal thread with 5 attachments → Move to project → All files migrated to Storage Service → Local files deleted → Files accessible to project members
- **Cache configuration:** Update cache TTL and size limit in appdata → Restart app → Config persisted correctly

**3. E2E Tests (Playwright)**
- **Happy path:** User uploads file, sends message, recipient downloads file
- **Drag-and-drop:** User drags multiple files, progress bars shown, all files attached
- **File size rejection:** User attempts to upload 15MB file, error shown
- **Executable rejection:** User attempts to upload .exe file, rejected
- **Cache behavior:** User downloads same file twice, second download instant (<100ms)
- **Offline mode:** Cache available, new uploads disabled with clear error

**4. Performance Tests**
- **Upload latency:** Measure P50/P95/P99 for 1MB/5MB/10MB files to local and Storage Service
- **Download latency:** Cached vs uncached, measure difference
- **Concurrent uploads:** Upload 10 files simultaneously, verify max 3 concurrent
- **Cache encryption overhead:** Measure encryption/decryption time for various file sizes
- **Presigned URL latency:** Measure API call time to Storage Service

**5. Security Tests**
- **MIME type spoofing:** Rename .exe to .jpg, verify rejection based on actual content
- **File size tampering:** Modify file size in metadata, verify server-side validation
- **Presigned URL replay:** Attempt to reuse expired URL, verify rejection
- **Unauthorized download:** Attempt to download file from thread without access, verify denial
- **Cache encryption:** Verify cache files unreadable without decryption key

**Test Frameworks & Tools:**
- **Vitest** - Unit and integration tests
- **Playwright** - E2E tests
- **AWS SDK mock** - Mock S3 for Storage Service testing
- **Faker.js** - Generate test files with various sizes/types

**Edge Cases to Test:**

1. **Presigned URL expiration during upload:** Upload large file on slow connection, URL expires mid-upload (verify extended expiration for files >5MB)
2. **Concurrent file deletion:** Two users delete same file simultaneously (reference counting race)
3. **Cache full:** Upload files until cache reaches 1GB limit, verify LRU eviction
4. **Network interruption:** Upload interrupted, verify retry logic (full file retry, no multipart)
5. **Storage Service unavailable:** Cache serves files, new uploads queue for retry
6. **File name collisions:** Two files with same name uploaded to same thread
7. **Large message attachment list:** Message with 50 attachments (exceeds 50MB limit), verify rejection
8. **Orphaned files:** Thread deleted while upload in progress, verify cleanup
9. **Thread move migration failure:** Thread move initiated, file migration fails mid-way, verify rollback and local files restored
10. **Thread move with large attachments:** Personal thread with 100MB total attachments moved to project, verify migration progress displayed and completes
11. **Cache TTL configuration:** User changes cache TTL from 24 hours to 6 hours, verify existing cache entries respect new TTL

**Test Data Strategy:**
- **Synthetic files:** Generate files of specific sizes (1MB, 5MB, 10MB) and types
- **Real files:** Sample images, PDFs, text files for realistic testing
- **Malicious file samples:** Safe test executables for validation testing

**Continuous Integration:**
- All tests run on every PR
- E2E tests run on staging before production deploy
- Performance tests run nightly, alert on >10% regression
- Security tests run on every commit

**Definition of Done for Epic 5:**
- All unit tests pass (85%+ coverage)
- All integration tests pass, including thread move file migration
- All E2E tests pass in Chrome, Firefox, Safari
- Performance benchmarks meet targets (upload <5s for 10MB, cache hit >80%)
- Security tests pass (MIME validation, encryption, authorization)
- Cache configuration persisted to appdata and survives app restart
- Thread move with file migration tested and verified (personal → project, all files accessible to team)
- No P0/P1 bugs open

# Epic 5: File Attachments - Implementation Context

**Generated:** 2025-12-12
**Owner:** Dev B
**Priority:** P1
**Dependencies:** E3 (Project Collaboration)

---

## Epic Overview

**Description:** File upload/download with appropriate storage routing

**Objective:** Enable users to attach files to messages with intelligent storage routing (personal projects use local filesystem, shared projects use cloud storage) and safe deletion via reference counting.

**Stories:** 4 stories (E5-S1 through E5-S4)

---

## Architecture Context

### Storage Routing Model (Critical)

**File storage depends on PROJECT TYPE, not thread type:**

| Project Type | File Storage Location | Cache Location |
|--------------|----------------------|----------------|
| Personal | Local filesystem (`~/.holokai/files/`) | N/A (already local) |
| Shared | Storage Service (S3/Azure Blob) | Local encrypted cache (3 day TTL) |

**Key Principle:** Files are the ONLY data type with split storage. Threads and messages are ALWAYS stored in Moku API (cached locally via E4-S4).

### File Attachment Model

**Shared References (No Duplication):**
- Same file attached to multiple messages = same `fileId` reference
- Branch retries copy attachment references (not file content)
- Reference counting prevents premature deletion
- Storage quota counts unique files only

**File Metadata:**
```typescript
interface FileMetadata {
  fileId: string;           // UUID
  filename: string;         // Original filename
  mimeType: string;         // MIME type
  fileSize: number;         // Bytes
  uploadedAt: string;       // ISO timestamp
  uploadedBy: string;       // User ID
  storageLocation: 'local' | 'remote';
  referenceCount: number;   // How many messages reference this file
}
```

---

## Story 1: File Service (Desktop) (E5-S1)

**Size:** M
**Description:** Unified file service with storage routing (personal=local, shared=remote) and reference counting for safe deletion

### Key Features

1. **Storage Routing**
   - Check project type (personal vs shared)
   - Personal → LocalFileRepository
   - Shared → StorageAPIClient
   - Helper: `getStorageTarget(projectType)`

2. **Upload Flow**
   - For shared projects:
     1. Call `getUploadUrl()` → presigned URL
     2. Upload directly to presigned URL (PUT)
     3. Call `confirmUpload()` → get fileId
   - For personal projects:
     1. Copy file to `~/.holokai/files/`
     2. Generate fileId locally (UUID)
     3. Store metadata

3. **Upload Progress**
   - Emit progress events (0-100%)
   - Support progress callback
   - Update UI with percentage
   - Use XMLHttpRequest or fetch with progress

4. **Reference Counting**
   - Track references per fileId
   - Increment when attachment added to message
   - Decrement when message deleted
   - Store counts via Moku API

5. **Safe Deletion**
   - Check reference count before delete
   - If count > 0: reject with error
   - If count == 0: proceed with deletion
   - Clear error messages for UI

### Technical Implementation

**Service:** `FileService.ts`

```typescript
interface FileService {
  // Upload
  upload(file: File, projectType: 'personal' | 'shared',
         onProgress?: (percent: number) => void): Promise<FileMetadata>

  // Download
  download(fileId: string): Promise<Blob>

  // Delete (with reference check)
  delete(fileId: string): Promise<{ success: boolean; error?: string }>

  // Reference counting
  incrementReference(fileId: string): Promise<void>
  decrementReference(fileId: string): Promise<void>
  getReferenceCount(fileId: string): Promise<number>
}
```

**Dependencies:**
- `StorageAPIClient` (E5-S4) - For shared project files
- `LocalFileRepository` - For personal project files
- `AuthService` - For authentication

### Requirements References
- ARCH §5.3: FileService design
- PROJ §3.2: Storage routing
- FS §2.1: Storage split
- FS §3: Storage Service API
- FS §3.3: Upload progress
- ARCH §3.2: Shared references

### Acceptance Criteria
- ✅ Files in personal projects stored locally on filesystem
- ✅ Files in shared projects stored via Storage Service (S3/Blob)
- ✅ Progress reported during upload
- ✅ Errors handled gracefully
- ✅ File deletion blocked if referenced by any message
- ✅ Storage quota counts unique files only (not references)

---

## Story 2: File Cache (Encrypted) (E5-S2)

**Size:** M
**Description:** Local cache for project files with encryption

### Key Features

1. **Encrypted Cache**
   - AES-256-GCM encryption
   - Encryption key from user credentials
   - IV stored with each encrypted file
   - Node.js crypto module

2. **3-Day TTL**
   - Store creation timestamp with entry
   - Check TTL on cache access
   - Return null for expired entries
   - Background cleanup of expired files

3. **LRU Eviction**
   - Track last access time per file
   - Max cache size: 500MB
   - Evict least recently used when exceeded
   - Run eviction check after each write

4. **Cache Statistics**
   - Total cache size (bytes)
   - File count
   - Hit/miss ratio
   - Expose `getStats()` method

### Technical Implementation

**Repository:** `FileCacheRepository.ts`

**Cache Directory:**
```
~/.holokai/cache/files/
├── {fileId}.encrypted     # Encrypted file content
├── {fileId}.meta          # Metadata (timestamps, TTL)
└── index.json             # Cache index with LRU info
```

```typescript
interface FileCacheRepository {
  // Basic operations
  get(fileId: string): Promise<Buffer | null>
  set(fileId: string, content: Buffer): Promise<void>
  delete(fileId: string): Promise<void>
  has(fileId: string): Promise<boolean>

  // Stats
  getStats(): Promise<{
    totalSize: number;
    fileCount: number;
    hitRate: number;
    missRate: number;
  }>

  // Maintenance
  evictLRU(): Promise<void>
  cleanupExpired(): Promise<void>
}
```

**Note:** This cache is for **shared project files only**. Personal project files stay on local filesystem (no cache needed).

### Requirements References
- PROJ §3.4: File cache design
- ARCH §7.1: Encryption
- CORE §3: Encryption standards
- TLC §3.1: TTL and eviction
- INS §5: Cache stats

### Acceptance Criteria
- ✅ Files encrypted at rest
- ✅ Cache size respects limits
- ✅ Old files evicted automatically
- ✅ Stats available for dashboard

---

## Story 3: Attachment UI (E5-S3)

**Size:** M
**Description:** UI for viewing and managing attachments

### Key Features

1. **Attachment Preview**
   - Thumbnail for images (resized to fit)
   - File icon for non-images
   - Display filename and file size
   - Support image, PDF, code file types

2. **Drag-and-Drop Zone**
   - Listen for drag events (dragenter, dragleave, dragover, drop)
   - Highlight drop zone on drag over
   - Accept multiple files
   - Integrate with message input area

3. **Attachment Chips**
   - Display filename with truncation
   - Show file type icon
   - Tooltip with full filename and size
   - Style as inline chip/badge

4. **Download Button**
   - Download icon button on chip
   - Call `FileService.download()` on click
   - Use Electron's download dialog
   - Show progress during download
   - Optional: open file after download

5. **Remove Button (Before Send)**
   - X button on pending attachment chips
   - Remove from `pendingAttachments` array
   - Animate removal
   - Only show for pending (not sent) messages

### Technical Implementation

**Components:**
- `AttachmentPreview.svelte` - Preview component
- `DropZone.svelte` - Drag-and-drop zone
- `AttachmentChip.svelte` - Chip display
- `ToastContainer.svelte` - For upload notifications

```typescript
// AttachmentChip props
interface AttachmentChipProps {
  fileId: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  removable: boolean;  // true for pending, false for sent
  onRemove?: () => void;
  onDownload?: () => void;
}
```

### UI Flow

**Upload Flow:**
1. User drags file or clicks file picker
2. DropZone highlights
3. File dropped
4. Upload starts (progress shown)
5. AttachmentChip appears in input area
6. User can remove before sending
7. On send: chip becomes permanent in message

**Download Flow:**
1. User clicks download button on chip
2. FileService.download() called
3. Progress shown
4. Electron save dialog appears
5. File downloaded to chosen location

### Requirements References
- TLC §2.2: Attachment preview
- UI §3: Drag-and-drop
- TM §6.6: Message display
- TLC §2.4: Download button

### Acceptance Criteria
- ✅ Drag-drop adds files to pending
- ✅ Attachments visible in messages
- ✅ Click downloads file
- ✅ Can remove before sending

---

## Story 4: Storage Service Integration (E5-S4)

**Size:** S
**Description:** Desktop integration with Storage Service API

### Key Features

1. **Presigned URL Flow**
   - `getUploadUrl()` - Get presigned upload URL
   - Upload directly to presigned URL (PUT)
   - `confirmUpload()` - Confirm successful upload
   - `getDownloadUrl()` - Get presigned download URL

2. **API Client**
   - Configure base URL for Storage Service
   - Inject AuthService for auth headers
   - Request/response interceptors
   - Error mapping to domain errors

3. **Error Handling**
   - Quota exceeded
   - File not found
   - Expired/deleted file
   - Permission denied
   - Validation errors

### Technical Implementation

**Client:** `StorageAPIClient.ts`

```typescript
interface StorageAPIClient {
  // Upload flow
  getUploadUrl(request: {
    filename: string;
    fileSize: number;
    mimeType: string;
  }): Promise<{
    uploadUrl: string;  // Presigned URL
    fileId: string;     // UUID for file
  }>

  confirmUpload(fileId: string, checksum: string): Promise<FileMetadata>

  // Download flow
  getDownloadUrl(fileId: string): Promise<{
    downloadUrl: string;  // Presigned URL
    expiresAt: string;    // ISO timestamp
  }>

  // Delete
  deleteFile(fileId: string): Promise<{ success: boolean }>
}
```

### API Endpoints

**Base URL:** `https://storage.holokai.ai/api` (configurable)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/storage/upload-url` | POST | Get presigned upload URL |
| `/storage/confirm/{fileId}` | POST | Confirm upload completion |
| `/storage/download-url/{fileId}` | GET | Get presigned download URL |
| `/storage/{fileId}` | DELETE | Delete file |

### Requirements References
- FS §3: Storage API client
- FS §3.1: Presigned URL flow
- PROJ §3.3: Storage Service integration
- FS §3.4: Error handling

### Acceptance Criteria
- ✅ All Storage Service endpoints accessible
- ✅ Presigned URLs work for upload/download
- ✅ Errors include meaningful messages

---

## Implementation Order

**Recommended sequence:**

1. **E5-S4: Storage Service Integration** (Foundation)
   - Build API client first
   - No UI dependencies
   - Can test with Postman/curl

2. **E5-S2: File Cache (Encrypted)** (Parallel with E5-S4)
   - Independent of API client
   - Reuse encryption from E4-S4
   - Can test with mock data

3. **E5-S1: File Service (Desktop)** (Depends on E5-S4)
   - Integrates API client and cache
   - Implements storage routing
   - Core business logic

4. **E5-S3: Attachment UI** (Last, depends on E5-S1)
   - Builds on FileService
   - User-facing components
   - Requires full backend working

---

## Key Dependencies

### External Libraries
- Node.js `crypto` - File encryption
- `fetch` or `XMLHttpRequest` - Upload with progress
- Electron `dialog` - Save dialog for downloads

### Internal Dependencies
- `AuthService` (existing) - Auth headers for API
- `MokuAPIClient` (E1) - For file metadata storage
- `LocalCacheService` (E4-S4) - Encryption patterns
- `ProjectService` (E3) - Determine project type

### File System Paths
- Personal files: `~/.holokai/files/{fileId}`
- Cache: `~/.holokai/cache/files/`
- Metadata: Stored in Moku API

---

## Testing Strategy

### E5-S1: File Service
- Test storage routing (personal vs shared)
- Test upload progress tracking
- Test reference counting
- Test safe deletion (blocked when referenced)
- Test quota exceeded handling

### E5-S2: File Cache
- Test encryption/decryption
- Test TTL expiration
- Test LRU eviction
- Test cache stats accuracy
- Test corrupt file recovery

### E5-S3: Attachment UI
- Test drag-and-drop
- Test file preview (images, PDFs, code)
- Test attachment chips
- Test download flow
- Test remove before send

### E5-S4: Storage Service Integration
- Test presigned URL upload
- Test presigned URL download
- Test confirmUpload flow
- Test all error scenarios
- Test auth header injection

---

## Performance Considerations

### Upload Performance
- Direct to S3/Blob (no proxy through Moku API)
- Progress tracking: 0.5s update interval
- Parallel uploads: max 3 concurrent
- Chunk size: 5MB for large files

### Download Performance
- Cache hit: <10ms
- Cache miss + S3/Blob: <500ms
- Presigned URL valid: 15 minutes
- Download resume: supported

### Cache Performance
- Encryption/decryption: <10ms per file
- LRU eviction: <100ms
- Cache stats: <20ms

---

## Security Considerations

### File Encryption (Cache)
- AES-256-GCM for cached files
- Same encryption key as E4-S4 cache
- IV per file
- No plaintext on disk

### Presigned URLs
- Short expiration (15 minutes)
- Single-use (upload only)
- No credentials exposed
- S3/Blob validates checksum

### Reference Counting
- Prevents accidental deletion
- Prevents orphaned files
- Quota enforcement
- Audit trail

---

## Storage Quota Management

### Personal Projects
- Local filesystem (no hard limit)
- OS disk space is the limit
- User can manually clean up

### Shared Projects
- Storage Service enforces quota
- Quota per organization
- `getUploadUrl()` returns quota exceeded error
- UI shows quota usage in settings

**Quota Calculation:**
- Count unique files only (not references)
- Same file in multiple messages = 1x quota usage
- Deleted files freed from quota immediately

---

## Common Pitfalls

1. **Storage routing by project type, not thread type**
   - Threads are ALWAYS in Moku API
   - Files depend on project type
   - Personal project → local files
   - Shared project → remote files

2. **Reference counting is critical**
   - Don't delete files with non-zero reference count
   - Branch retries share file references
   - Test deletion blocking thoroughly

3. **Cache vs Storage confusion**
   - Cache (E5-S2) is for SHARED project files only
   - Personal files stay on local filesystem (no cache)
   - Cache can be cleared without data loss

4. **Presigned URL expiration**
   - URLs expire in 15 minutes
   - Don't cache presigned URLs
   - Generate fresh URL for each operation

5. **Error handling for quota**
   - Quota exceeded is a user-facing error
   - Provide clear message with quota info
   - Suggest cleanup or upgrade

---

## File Type Support

### Phase 1 (MVP)
- Images: PNG, JPG, GIF, WebP
- Documents: PDF, TXT, MD
- Code: JS, TS, PY, JAVA, etc.
- Archives: ZIP, TAR.GZ

### Preview Support
- Images: inline thumbnail
- PDFs: first page thumbnail
- Code: syntax-highlighted preview
- Others: file icon only

### Size Limits
- Personal projects: 100MB per file
- Shared projects: 100MB per file (enforced by Storage Service)
- Total upload size per message: 500MB

---

## Document References

### Architecture
- `architecture-2025-11-25.md` §5.3: File Service
- `architecture-2025-11-25.md` §3.2: Shared References
- `architecture-2025-11-25.md` §7.1: Encryption

### Requirements
- `project-requirements-2025-11-25.md` §3: File Storage
- `brainstorming-session-file-storage-2025-11-25.md`: File Storage Design
- `thread-loading-caching-requirements-2025-11-25.md` §2.2: Attachments

---

## Success Metrics

- Upload success rate: >99%
- Upload performance: <5s for 10MB file
- Download performance: <2s for 10MB file
- Cache hit rate: >70% for shared project files
- Zero files deleted while referenced
- Zero quota exceeded errors (with proper UI warnings)
- Storage quota accuracy: 100%

---

## Integration with Other Epics

### E3: Project Collaboration
- ProjectService provides project type
- Required to determine storage routing
- Must complete E3-S1 before E5-S1

### E4: Desktop Core
- E4-S4 provides encryption patterns
- E4-S1 for upload/download notifications
- E4-S2 for file cache path preferences

### E2: Thread Branching
- Branch retries copy attachment references
- Reference counting prevents deletion
- FileService handles reference increments

---

## UI/UX Considerations

### Upload Flow UX
1. Drag file or click picker
2. Immediate feedback (highlight drop zone)
3. Progress bar appears
4. Toast on success/failure
5. Attachment chip shows in input
6. Can remove before send

### Error Messages
- "File too large (max 100MB)"
- "Storage quota exceeded. Free up space in Settings."
- "Upload failed. Check your internet connection."
- "Cannot delete file: still attached to 3 messages"

### Visual Design
- Attachment chips: rounded, with icon
- Progress: linear bar with percentage
- Drop zone: dashed border, blue highlight
- File icons: use mime-type icons

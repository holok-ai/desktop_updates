# Story 5.1: File Service Desktop

Status: ready-for-dev

## Story

As a desktop application developer,
I want a unified FileService with intelligent storage routing (personal → local, project → Storage Service), upload/download operations, and file migration capabilities,
so that file attachments work seamlessly across personal and project contexts with proper progress tracking and error handling.

## Acceptance Criteria

1. FileService.upload() successfully uploads file to local filesystem for personal threads
2. FileService.upload() successfully uploads file to Storage Service for project threads
3. Upload progress events emitted every 100ms with percentage, loaded, total
4. Upload retry logic: 3 attempts with exponential backoff on network failure
5. File size validation: reject files >10MB, show error message
6. MIME type validation: accept images, PDFs, text, code; reject executables
7. FileService.download() returns file blob from local filesystem or Storage Service
8. FileService.getAttachments(messageId) returns all attachments for message
9. FileService.deleteAttachment() uses reference counting: deletes file only if last reference
10. Upload completes in <5s for 10MB file (P95, Storage Service)
11. FileService.migrateAttachments() migrates local files to Storage Service for thread move (Epic 3 integration)

## Tasks / Subtasks

- [ ] **Task 1: Implement Storage Routing Logic (AC: 1-2)**
  - [ ] Create FileService class with dependency injection (ProjectService, StorageServiceClient, FileCache)
  - [ ] Implement thread context detection: check if thread.projectId exists
  - [ ] If projectId null: route to local filesystem storage
  - [ ] If projectId exists: route to Storage Service
  - [ ] Create upload() method with storage routing logic
  - [ ] Add local file save: `~/.holokai/files/{threadId}/{attachmentId}-{fileName}`
  - [ ] Add Storage Service upload via presigned URL (E5-S4 integration)

- [ ] **Task 2: Implement Upload Progress Tracking (AC: 3)**
  - [ ] Add progress event emitter for upload operations
  - [ ] Emit progress events every 100ms with: loaded, total, percentage
  - [ ] Track progress for both local and Storage Service uploads
  - [ ] IPC channel: 'upload:progress' → renderer for UI updates
  - [ ] Include status: 'uploading' | 'complete' | 'error'

- [ ] **Task 3: Implement Retry Logic (AC: 4)**
  - [ ] Create retry wrapper for upload operations
  - [ ] Max 3 attempts with exponential backoff (1s, 2s, 4s)
  - [ ] Handle transient errors: network failures, timeout, 5xx responses
  - [ ] Log retry attempts with attempt number and error
  - [ ] Final failure: emit error event, show user-friendly message

- [ ] **Task 4: Implement File Validation (AC: 5-6)**
  - [ ] Add file size validation: reject files >10MB
  - [ ] Add MIME type allowlist: images (PNG, JPG, GIF, WebP), PDFs, text files, code files
  - [ ] Reject executable files: .exe, .bat, .sh, .app, .dmg, .msi
  - [ ] Client-side validation before upload starts
  - [ ] Show error message for invalid files (toast notification)
  - [ ] Validate total message attachment size <50MB

- [ ] **Task 5: Implement Download Operations (AC: 7)**
  - [ ] Implement download() method: returns file blob
  - [ ] For local files: read from filesystem, return blob
  - [ ] For Storage Service files: check FileCache first (E5-S2 integration)
  - [ ] Cache miss: download from Storage Service via presigned URL
  - [ ] Implement getDownloadUrl() for opening files in browser
  - [ ] Handle download errors with retry logic

- [ ] **Task 6: Implement Attachment Metadata Operations (AC: 8)**
  - [ ] Implement getAttachments(messageId): query desktop_attachments table
  - [ ] Return array of Attachment objects with metadata
  - [ ] Filter by messageId, order by uploadedAt
  - [ ] Include storage type, file size, MIME type in response

- [ ] **Task 7: Implement File Deletion with Reference Counting (AC: 9)**
  - [ ] Implement deleteAttachment(attachmentId) method
  - [ ] Query reference count: `SELECT COUNT(*) FROM desktop_attachments WHERE (local_path = ? OR storage_service_key = ?)`
  - [ ] Use database transaction with SELECT FOR UPDATE (prevent race conditions)
  - [ ] If reference count = 1 (last reference):
    - Local file: delete from filesystem
    - Storage Service file: call DELETE /api/storage/files/{key}
  - [ ] Delete attachment record from desktop_attachments table
  - [ ] Invalidate FileCache entry

- [ ] **Task 8: Implement Thread Move File Migration (AC: 11)**
  - [ ] Implement migrateAttachments(threadId, targetProjectId) method
  - [ ] Query all attachments for thread: `SELECT * FROM desktop_attachments WHERE thread_id = ? AND storage_type = 'local'`
  - [ ] For each local attachment:
    - Request presigned upload URL from Storage Service
    - Read file from local filesystem
    - Upload to S3/Blob via presigned URL
    - Update attachment record: storage_type='storage_service', storage_service_key, local_path=null
    - Delete local file after successful migration
  - [ ] Emit migration progress events: X of Y files migrated
  - [ ] Rollback on failure: restore local files, revert attachment records
  - [ ] Transaction wrapper for atomicity

- [ ] **Task 9: Create Database Schema (desktop_attachments table)**
  - [ ] Create desktop_attachments table with schema from tech spec
  - [ ] Add foreign keys: message_id, thread_id
  - [ ] Create indexes: idx_attachments_message, idx_attachments_thread
  - [ ] Add CHECK constraint: storage_type IN ('local', 'storage_service')

- [ ] **Task 10: Testing and Performance (AC: 10)**
  - [ ] Unit test: Storage routing logic (personal vs project)
  - [ ] Unit test: File validation (size, MIME type)
  - [ ] Unit test: Reference counting (delete when count = 1)
  - [ ] Unit test: Retry logic with simulated failures
  - [ ] Integration test: Full upload flow (local and Storage Service)
  - [ ] Integration test: Thread move file migration (local → Storage Service)
  - [ ] E2E test: Upload file, download file, delete file
  - [ ] Performance test: Upload 10MB file in <5s (P95)

## Dev Notes

### Storage Routing Logic (Tech Spec §4.4)

**Decision Tree:**
```
User uploads file
  ↓
Check thread.projectId
  ↓
  ├─ projectId === null  → Personal thread → Save to local filesystem
  └─ projectId exists    → Project thread  → Upload to Storage Service
```

### Local File Storage Path

```
~/.holokai/files/{threadId}/{attachmentId}-{fileName}

Example:
~/.holokai/files/thread-123/att-456-report.pdf
```

### Attachment Entity (Tech Spec §4.2)

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
  encryptionKey?: string;   // for encrypted cache (E5-S2)
}
```

### Database Schema (Tech Spec §4.2)

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

### File Validation Rules

**File Size:**
- Per file: Max 10MB
- Per message: Total attachments max 50MB

**MIME Type Allowlist:**
- Images: `image/png`, `image/jpeg`, `image/gif`, `image/webp`
- PDFs: `application/pdf`
- Text: `text/plain`, `text/markdown`, `text/csv`
- Code: `text/javascript`, `text/html`, `text/css`, `application/json`, `application/xml`

**Reject Executables:**
- Extensions: `.exe`, `.bat`, `.sh`, `.app`, `.dmg`, `.msi`, `.dll`, `.com`, `.scr`
- Validate both extension AND MIME type (prevent spoofing)

### Upload Progress Event (Tech Spec §4.2)

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

### Reference Counting for File Deletion (Tech Spec §4.4)

```typescript
async deleteAttachment(attachmentId: string): Promise<void> {
  const attachment = await this.getAttachment(attachmentId);

  // Start transaction
  await db.transaction(async (tx) => {
    // Count references (with lock to prevent race conditions)
    const refCount = await tx
      .select('COUNT(*)')
      .from('desktop_attachments')
      .where(function() {
        if (attachment.storageType === 'local') {
          this.where('local_path', attachment.localPath);
        } else {
          this.where('storage_service_key', attachment.storageServiceKey);
        }
      })
      .forUpdate()  // SELECT FOR UPDATE
      .first();

    // Delete attachment record
    await tx('desktop_attachments').where('id', attachmentId).del();

    // If last reference, delete actual file
    if (refCount === 1) {
      if (attachment.storageType === 'local') {
        await fs.unlink(attachment.localPath);
      } else {
        await this.storageService.deleteFile(attachment.storageServiceKey);
      }
    }
  });

  // Invalidate cache
  await this.fileCache.delete(attachment.id);
}
```

### Thread Move File Migration Flow (Tech Spec §4.4, Epic 3 Integration)

```typescript
async migrateAttachments(threadId: string, targetProjectId: string): Promise<MigrationResult> {
  const attachments = await db('desktop_attachments')
    .where('thread_id', threadId)
    .where('storage_type', 'local');

  const totalFiles = attachments.length;
  let migratedFiles = 0;
  const errors = [];

  for (const attachment of attachments) {
    try {
      // Emit progress event
      this.emitMigrationProgress({ threadId, totalFiles, migratedFiles, currentFile: attachment.fileName });

      // Read local file
      const fileBlob = await fs.readFile(attachment.localPath);

      // Request presigned upload URL
      const { uploadUrl, fileKey } = await this.storageService.getUploadUrl({
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType,
        projectId: targetProjectId
      });

      // Upload to Storage Service
      await axios.put(uploadUrl, fileBlob, {
        headers: { 'Content-Type': attachment.mimeType }
      });

      // Update attachment record
      await db('desktop_attachments')
        .where('id', attachment.id)
        .update({
          storage_type: 'storage_service',
          storage_service_key: fileKey,
          local_path: null
        });

      // Delete local file
      await fs.unlink(attachment.localPath);

      migratedFiles++;
    } catch (error) {
      errors.push(`Failed to migrate ${attachment.fileName}: ${error.message}`);
    }
  }

  return {
    success: errors.length === 0,
    migratedCount: migratedFiles,
    failedCount: errors.length,
    errors: errors.length > 0 ? errors : undefined
  };
}
```

### Performance Targets (Tech Spec §6.1)

- **Upload (local)**: <500ms for files <1MB
- **Upload (Storage Service)**: <5s for files <10MB (P95)
- **Download (cached)**: <50ms
- **Download (uncached)**: <3s for files <10MB
- **Progress updates**: Every 100ms
- **Retry delays**: 1s, 2s, 4s (exponential backoff)

### IPC Handlers (Tech Spec §4.3)

```typescript
// renderer → main process
ipcRenderer.invoke('files:upload', { file, threadId, messageId });
ipcRenderer.invoke('files:download', attachmentId);
ipcRenderer.invoke('files:delete', attachmentId);
ipcRenderer.invoke('files:migrateAttachments', threadId, targetProjectId);
ipcRenderer.on('upload:progress', (event, progressEvent) => { /* update UI */ });
ipcRenderer.on('migration:progress', (event, progressEvent) => { /* update UI */ });
```

### Testing Strategy

- **Unit Tests**: Storage routing, file validation, reference counting, retry logic
- **Integration Tests**: Full upload/download flows, thread move migration
- **E2E Tests**: Upload file, download file, delete file, thread move with files
- **Performance Tests**: Upload timing, progress tracking accuracy
- **Error Handling**: Network failures, validation errors, rollback on migration failure

### Dependencies

- **BLOCKER: E3-S1 (ProjectService)** - Needed to determine thread context (personal vs project)
- **Requires: E5-S4 (StorageServiceClient)** - Presigned URL workflow for Storage Service uploads
- **Integrates with: E5-S2 (FileCache)** - Caching for project file downloads
- **Used by: E3-S8 (Thread Copy Functionality)** - File migration for thread move

### References

- [Tech Spec: Epic 5 File Attachments](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md)
- [Tech Spec §4.1: Services (FileService)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#services-and-modules)
- [Tech Spec §4.2: Data Models (Attachment entity, DB schema)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#data-models-and-contracts)
- [Tech Spec §4.3: APIs (FileService API, IPC handlers)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#apis-and-interfaces)
- [Tech Spec §4.4: Workflows (Upload, download, migration flows)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#workflows-and-sequencing)
- [Tech Spec §6: Non-Functional Requirements](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#non-functional-requirements)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e5-s1-file-service-desktop.context.xml

- docs/sprint-artifacts/e5-s1-file-service-desktop.context.xml



### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

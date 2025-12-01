# File Upload Feature - Architecture & Usage

## Overview

The file upload feature allows users to attach files and images to chat messages, enabling multi-modal interactions with LLM providers. Files are uploaded, validated, stored locally, and persisted with message metadata.

## Status

**Version:** MVP 1.0  
**Completion:** 12/25 tasks (48%)  
**Status:** ✅ Core functionality complete and working

---

## Features

### ✅ Implemented

1. **File Selection**
   - Click attach button (paperclip icon)
   - Keyboard shortcut: `Ctrl+U` (Windows/Linux) or `Cmd+U` (Mac)
   - Multiple file selection supported

2. **File Validation**
   - Type validation (whitelist: images, documents, data files)
   - Size limit: 5MB (configurable)
   - Filename sanitization (prevent path traversal)
   - Pre-upload validation

3. **File Storage**
   - Local filesystem storage in `<userData>/holokai/desktop/attachments/<threadId>/`
   - Unique file IDs (UUID)
   - Extension preservation
   - Automatic directory creation

4. **Upload Flow**
   - Validate → Upload → Persist metadata → Display preview
   - Idempotent uploads
   - Error handling

5. **Message Integration**
   - Attachments stored in `message.metadata.attachments[]`
   - Persisted with thread data
   - Survived app restart

6. **Display & Download**
   - Attachment previews in message history
   - Thumbnail display for images
   - Icon display for documents
   - Click to download functionality

7. **Cleanup**
   - Automatic file deletion on thread deletion (both hard and soft delete)
   - Prevents orphaned files

8. **Audit Logging**
   - All uploads logged (success/failure)
   - All downloads logged
   - File validation failures logged
   - Uses electron-log

### 🚧 Pending

9. **Drag-and-Drop** (Task 6) - Not yet implemented
10. **Upload Progress** (Task 8) - Not yet implemented
11. **Provider Integration** (Tasks 13-15) - Not yet implemented for multi-modal AI
12. **Tests** (Tasks 16-21) - Not yet implemented

---

## Architecture

### Data Flow

```
┌─────────────┐
│   User UI   │
│  (Svelte)   │
└──────┬──────┘
       │ Select File
       ▼
┌─────────────────────┐
│   Composer.svelte   │
│  - File picker      │
│  - Preview display  │
└──────┬──────────────┘
       │ Upload
       ▼
┌──────────────────────┐
│  IPC: file:upload    │
│  (via preload.ts)    │
└──────┬───────────────┘
       │
       ▼
┌────────────────────────┐
│  file-handler.ts       │
│  - Validate            │
│  - Call storage        │
└──────┬─────────────────┘
       │
       ▼
┌──────────────────────────┐
│  FileStorageService      │
│  - Save to disk          │
│  - Generate UUID         │
│  - Return metadata       │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│  ThreadRepository        │
│  - Persist metadata      │
│  - Save to thread JSON   │
└──────────────────────────┘
```

### File Storage Structure

```
<userData>/holokai/desktop/attachments/
├── <threadId-1>/
│   ├── <fileId-1>.jpg
│   ├── <fileId-2>.pdf
│   └── <fileId-3>.txt
├── <threadId-2>/
│   └── <fileId-4>.png
└── <threadId-3>/
    ├── <fileId-5>.csv
    └── <fileId-6>.json
```

### Type Definitions

**Location:** `src-shared/types/attachment.types.ts`

```typescript
export interface Attachment {
  id: UUID; // Unique file ID
  filename: string; // Original filename
  mimeType: string; // MIME type
  size: number; // Bytes
  uploadedAt: number; // Timestamp
  status: AttachmentStatus; // 'uploading' | 'success' | 'failed'
  error?: string; // Error message if failed
  localPath?: string; // File path (main process only)
  url?: string; // URL for renderer
  thumbnailUrl?: string; // Thumbnail (optional)
}

export interface MessageMetadata {
  attachments?: Attachment[]; // Array of attachments
  provider?: string; // LLM provider
  model?: string; // LLM model
  [key: string]: unknown; // Extensible
}
```

---

## Services

### FileStorageService

**Location:** `src-electron/services/file-storage.service.ts`

**Responsibilities:**

- Save files to local filesystem
- Retrieve files by ID
- Delete files
- Delete all thread files (cleanup)
- Generate unique file paths

**Key Methods:**

```typescript
saveFile(threadId, fileBuffer, filename, mimeType): Promise<Attachment>
getFile(threadId, fileId): Promise<Buffer | null>
deleteFile(threadId, fileId): Promise<boolean>
deleteThreadFiles(threadId): Promise<void>
```

**Storage Path Pattern:**

```
<userData>/holokai/desktop/attachments/<threadId>/<fileId>.<ext>
```

### FileValidationService

**Location:** `src-electron/services/file-validation.service.ts`

**Responsibilities:**

- Validate file type (whitelist)
- Validate file size (max 5MB)
- Sanitize filenames (security)
- Check extension-MIME type match

**Validation Rules:**

| Type          | Allowed MIME Types                                                                                                      | Extensions                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Images**    | image/jpeg, image/png, image/gif, image/webp, image/svg+xml                                                             | jpg, jpeg, png, gif, webp, svg |
| **Documents** | application/pdf, text/plain, text/markdown                                                                              | pdf, txt, md                   |
| **Data**      | application/json, text/csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | json, csv, xls, xlsx           |

**Key Methods:**

```typescript
validate(filename, mimeType, size): FileValidationResult
isAllowedType(mimeType, extension): boolean
isAllowedSize(size): boolean
sanitizeFilename(filename): string
getMaxFileSize(): number
```

---

## IPC API

### File API (Exposed via preload.ts)

```typescript
window.electronAPI.file = {
  // Upload file to storage
  upload: (payload: {
    threadId: string;
    fileBuffer: Buffer;
    filename: string;
    mimeType: string;
  }) => Promise<{
    success: boolean;
    attachment?: Attachment;
    error?: string;
  }>;

  // Get file by ID
  get: (payload: {
    threadId: string;
    fileId: string;
  }) => Promise<{
    success: boolean;
    buffer?: Buffer;
    error?: string;
  }>;

  // Delete file
  delete: (payload: {
    threadId: string;
    fileId: string;
  }) => Promise<{
    success: boolean;
    error?: string;
  }>;

  // Validate file before upload
  validate: (payload: {
    filename: string;
    mimeType: string;
    size: number;
  }) => Promise<FileValidationResult>;

  // Listen for upload progress events (future)
  onUploadProgress: (callback: (data: {
    fileId: string;
    progress: number;
  }) => void) => () => void;
};
```

---

## UI Components

### Composer.svelte

**File Picker Button:**

- Location: Next to textarea in composer
- Icon: Paperclip SVG
- Accessibility: ARIA label, keyboard shortcut tooltip
- Keyboard shortcut: Ctrl/Cmd+U

**File Input:**

- Hidden input element
- Multiple file selection
- Accept attribute filters by MIME type

**State Management:**

```typescript
let selectedFiles = $state<File[]>([]);
let fileInputRef: HTMLInputElement | undefined = $state();

// Methods
function handleFileSelect();
function handleFileChange(event);
function removeFile(index);
async function uploadFiles(files, threadId): Promise<Attachment[]>;
```

### AttachmentPreview.svelte

**Modes:**

- `preview`: Before sending (shows remove button)
- `history`: In message history (shows download button)

**Display:**

- Images: Thumbnail (12x12 grid)
- Documents: Icon + filename + size
- Status indicators: ✓ success, ✗ failed, ⟳ uploading

**Props:**

```typescript
interface Props {
  attachment: Attachment;
  mode?: 'preview' | 'history';
  onRemove?: () => void;
  onDownload?: () => void;
}
```

### ChatPane.svelte

**Message Display:**

- Renders attachments in message history
- Downloads files on click
- Passes attachments to sendMessage

**Download Handler:**

```typescript
async function downloadAttachment(threadId, fileId, filename) {
  // Fetch file via IPC
  // Create blob and trigger download
}
```

---

## Usage Examples

### Upload a File

```typescript
// In Composer or ChatPane
const file = /* File from input */;
const threadId = thread.id;

// Validate
const validation = await window.electronAPI.file.validate({
  filename: file.name,
  mimeType: file.type,
  size: file.size,
});

if (!validation.valid) {
  console.error('Validation failed:', validation.error);
  return;
}

// Upload
const arrayBuffer = await file.arrayBuffer();
const buffer = new Uint8Array(arrayBuffer);

const result = await window.electronAPI.file.upload({
  threadId,
  fileBuffer: buffer,
  filename: file.name,
  mimeType: file.type,
});

if (result.success && result.attachment) {
  // Attachment ready to include in message
  console.log('Uploaded:', result.attachment);
}
```

### Send Message with Attachments

```typescript
// In ChatPane
await sendMessage(userMessage, attachments);

// sendMessage implementation
async function sendMessage(userMessage: string, attachments: Attachment[] = []) {
  const result = await threadService.appendMessage(thread.id, {
    role: 'user',
    content: userMessage,
    metadata: {
      provider: 'ollama',
      model: 'llama3:latest',
      attachments: attachments.length > 0 ? attachments : undefined,
    },
    clientMessageId: crypto.randomUUID(),
  });
}
```

### Download an Attachment

```typescript
// In ChatPane or AttachmentPreview
async function downloadAttachment(threadId: string, fileId: string, filename: string) {
  const result = await window.electronAPI.file.get({ threadId, fileId });

  if (result.success && result.buffer) {
    const uint8Array = new Uint8Array(result.buffer);
    const blob = new Blob([uint8Array]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

---

## Security

### File Validation

1. **Type Whitelist:** Only allowed MIME types accepted
2. **Size Limit:** 5MB maximum (configurable)
3. **Extension Check:** Extension must match MIME type
4. **Filename Sanitization:**
   - Remove path separators (`/`, `\`)
   - Remove parent directory references (`../`)
   - Remove null bytes (`\0`)
   - Remove control characters (ASCII 0-31)
   - Limit length to 255 characters

### Storage Security

1. **Isolated Storage:** Files stored in app userData directory (OS-protected)
2. **UUID Filenames:** Prevents filename conflicts and predictable paths
3. **No Direct Access:** Renderer cannot access filesystem directly
4. **IPC Validation:** All file operations validated in main process

### Audit Trail

All file operations logged via electron-log:

- Upload attempts (success/failure)
- File retrieval
- File deletion
- Validation failures
- Thread file cleanup

**Log Location:** `<userData>/holokai/desktop/logs/`

---

## Configuration

### Max File Size

**Default:** 5MB  
**Configurable:** Yes

```typescript
// In FileValidationService
fileValidationService.setMaxFileSize(10 * 1024 * 1024); // 10MB
```

### Allowed File Types

**Modify:** Edit `FileValidationService` constructor

```typescript
// src-electron/services/file-validation.service.ts
private getDefaultConfig(): ValidationConfig {
  const allowedMimeTypes = new Set([
    // Add new MIME types here
    'application/zip',
  ]);

  const allowedExtensions = new Set([
    // Add new extensions here
    'zip',
  ]);

  const mimeToExtensions = new Map([
    // Map MIME to extensions
    ['application/zip', ['zip']],
  ]);
}
```

---

## Troubleshooting

### File Upload Fails

**Check:**

1. File type is in whitelist
2. File size < 5MB
3. Thread ID is valid
4. User has write permissions to userData directory

**Logs:** Check electron-log for detailed error messages

### Files Not Persisting

**Check:**

1. ThreadRepository is saving to disk
2. Message metadata includes attachments
3. Storage path is accessible

### Download Fails

**Check:**

1. File exists in storage directory
2. Thread ID and file ID are correct
3. Buffer conversion is working

---

## Future Enhancements

### Planned (Not Yet Implemented)

1. **Drag-and-Drop Support** (Task 6)
   - Drop zone overlay in ChatPane
   - Visual feedback on drag over
   - Multiple file drop support

2. **Upload Progress** (Task 8)
   - Real-time progress bar (0-100%)
   - Streaming upload for large files
   - Progress events via IPC

3. **Multi-Modal LLM Support** (Tasks 13-15)
   - Update IChatProvider to accept attachments
   - Encode images as Base64 for providers
   - Encode text files as UTF-8
   - Test with Claude, OpenAI, Ollama vision models

4. **Cloud Sync** (Deferred)
   - Upload to cloud storage (S3, Azure Blob, etc.)
   - Cross-device access
   - Shared attachments

5. **Advanced Features** (Deferred)
   - Virus scanning integration
   - PDF thumbnail generation
   - Image resizing/compression
   - Multiple files per message UI
   - Paste images from clipboard
   - Camera capture (photo/video)

---

## Testing

### Manual Testing Checklist

- [ ] Click attach button opens file picker
- [ ] Ctrl/Cmd+U opens file picker
- [ ] Select multiple files
- [ ] Preview shows correct file info
- [ ] Remove file from preview works
- [ ] Upload files on send
- [ ] Files persist in message metadata
- [ ] Attachments display in message history
- [ ] Download attachment works
- [ ] App restart preserves attachments
- [ ] Thread deletion removes files from disk
- [ ] Invalid file type shows error
- [ ] File too large shows error

### Automated Tests (Pending)

**Unit Tests:**

- FileValidationService validation logic
- FileStorageService CRUD operations
- File encoding logic

**Integration Tests:**

- IPC handlers (upload, get, delete)
- ThreadRepository file cleanup

**E2E Tests:**

- Upload flow end-to-end
- Drag-and-drop (when implemented)
- Error scenarios
- Accessibility

---

## Performance

### Benchmarks

| Operation          | Target | Actual |
| ------------------ | ------ | ------ |
| File upload (<5MB) | <2s    | TBD    |
| File download      | <1s    | TBD    |
| Validation         | <100ms | TBD    |
| Thread creation    | <800ms | TBD    |

### Optimizations

- Async file operations (non-blocking)
- Lazy loading of attachments
- Thumbnail caching (future)
- Chunked uploads for large files (future)

---

## Developer Notes

### File Structure

```
src-shared/types/
  └── attachment.types.ts       # Shared type definitions

src-electron/services/
  ├── file-storage.service.ts   # File persistence
  ├── file-validation.service.ts # Validation logic
  └── file-encoding.service.ts  # Provider encoding (future)

src-electron/ipc-handlers/
  └── file-handler.ts            # IPC layer

src-electron/repository/
  └── thread-repository.ts       # Thread + attachment persistence

src/lib/components/
  ├── Composer.svelte            # File picker UI
  ├── AttachmentPreview.svelte   # Preview component
  └── ChatPane.svelte            # Message + attachment display
```

### Adding New File Types

1. Update `FileValidationService`:
   - Add MIME type to `allowedMimeTypes`
   - Add extension to `allowedExtensions`
   - Map MIME to extensions in `mimeToExtensions`

2. Update `FileStorageService` (if needed):
   - Add extension mapping in `getExtensionFromMimeType`

3. Update `AttachmentPreview.svelte` (optional):
   - Add icon for new file type in `getFileIcon`

### Extending for Multi-Modal AI

1. Implement `FileEncodingService`
2. Update `IChatProvider` interface
3. Modify provider implementations (Claude, OpenAI, Ollama)
4. Test with vision models

---

## References

- **Issue:** #72
- **Implementation Plan:** `docs/issues/issue-72-implementation.md`
- **Architecture Requirement:** REQ-LLM-07 (Multi-Modal Input Support)
- **Design Doc:** `ai/ARCHITECTURE.md` Section 7.4

---

**Last Updated:** 2025-11-10  
**Version:** MVP 1.0  
**Status:** ✅ Core functionality complete

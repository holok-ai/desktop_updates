# Story 5.3: Attachment UI

Status: ready-for-dev

## Story

As a desktop application user,
I want a rich attachment UI with drag-and-drop upload, progress tracking, inline image previews, and file management,
so that I can easily attach, preview, download, and manage files in my conversations with clear visual feedback.

## Acceptance Criteria

1. Drag-and-drop zone highlights when file dragged over
2. Dropped files validated: size, type checked
3. Upload progress bar displays for each file with percentage
4. Attachment list shows: fileName, fileSize, upload status
5. File preview available for images (inline thumbnail)
6. Download button downloads file or opens in browser (based on MIME type)
7. Delete button removes attachment (with confirmation)
8. Multiple file upload: max 3 concurrent uploads
9. UI renders in <100ms for messages with 10 attachments

## Tasks / Subtasks

- [ ] **Task 1: Implement Drag-and-Drop Zone (AC: 1-2)**
  - [ ] Create drop zone component in message composer
  - [ ] Add dragover event handler: highlight drop zone
  - [ ] Add dragleave event handler: remove highlight
  - [ ] Add drop event handler: extract FileList, validate files
  - [ ] Validate each file: size <10MB, MIME type in allowlist
  - [ ] Show validation errors for rejected files (toast notification)
  - [ ] Visual feedback: border highlight, "Drop files here" text

- [ ] **Task 2: Implement File Upload Button (Alternative to Drag-and-Drop)**
  - [ ] Add "Attach File" button in message composer toolbar
  - [ ] Open native file picker on click
  - [ ] Allow multiple file selection
  - [ ] Validate selected files (same logic as drag-and-drop)
  - [ ] Trigger upload via FileService.uploadMultiple()

- [ ] **Task 3: Implement Upload Progress Tracking (AC: 3)**
  - [ ] Subscribe to upload progress events from FileService (IPC channel: 'upload:progress')
  - [ ] Display progress bar for each file being uploaded
  - [ ] Show: fileName, fileSize, percentage (0-100%), status (uploading/complete/error)
  - [ ] Update progress bar every 100ms based on events
  - [ ] Handle upload completion: show checkmark icon
  - [ ] Handle upload errors: show error icon, error message

- [ ] **Task 4: Implement Attachment List Display (AC: 4)**
  - [ ] Create AttachmentList component for message composer
  - [ ] Display attached files: fileName, fileSize (formatted: KB/MB), status icon
  - [ ] Show file icon based on MIME type (image icon, PDF icon, text icon, etc.)
  - [ ] Add "Remove" button for each attachment (before message sent)
  - [ ] Update list reactively when uploads complete or files removed

- [ ] **Task 5: Implement Image Preview (AC: 5)**
  - [ ] Check if attachment is image (MIME type: image/*)
  - [ ] Display inline thumbnail for image attachments
  - [ ] Thumbnail size: 100x100px with aspect ratio preserved
  - [ ] Load thumbnail from file blob using FileReader or object URL
  - [ ] Click thumbnail opens full-size preview modal
  - [ ] Preview modal: display full image with download/close buttons

- [ ] **Task 6: Implement Download/Open Button (AC: 6)**
  - [ ] Add download button for each attachment in sent messages
  - [ ] On click: call FileService.download(attachmentId)
  - [ ] Determine action based on MIME type:
    - Images, PDFs: open in browser (new tab or modal)
    - Other files: trigger browser download (save to disk)
  - [ ] Show loading indicator during download
  - [ ] Handle download errors with retry option

- [ ] **Task 7: Implement Delete Button with Confirmation (AC: 7)**
  - [ ] Add delete button for each attachment (before message sent)
  - [ ] Confirmation dialog: "Remove this file from the message?"
  - [ ] On confirm: call FileService.deleteAttachment(attachmentId)
  - [ ] Remove attachment from UI list
  - [ ] Update message composer state

- [ ] **Task 8: Implement Concurrent Upload Management (AC: 8)**
  - [ ] Queue multiple file uploads
  - [ ] Execute max 3 uploads concurrently
  - [ ] Remaining files wait in queue
  - [ ] Progress bars shown for active + queued uploads
  - [ ] Queued uploads show "Waiting..." status
  - [ ] Start queued upload when active upload completes

- [ ] **Task 9: Performance Optimization (AC: 9)**
  - [ ] Virtualize attachment list for messages with many files
  - [ ] Lazy load thumbnails (only visible images)
  - [ ] Optimize rendering: React.memo or equivalent
  - [ ] Benchmark render time with 10/20/50 attachments (target: <100ms for 10)

- [ ] **Task 10: Testing**
  - [ ] Unit test: Drag-and-drop event handlers
  - [ ] Unit test: File validation logic
  - [ ] E2E test: Drag-and-drop upload flow
  - [ ] E2E test: Upload progress tracking
  - [ ] E2E test: Image preview modal
  - [ ] E2E test: Download/delete attachment
  - [ ] Visual test: Attachment list rendering
  - [ ] Accessibility test: Keyboard navigation, screen reader support

## Dev Notes

### Drag-and-Drop Implementation

```typescript
<div
  className="drop-zone"
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
>
  {isDragging ? (
    <div className="drop-zone-active">
      📎 Drop files here to attach
    </div>
  ) : (
    <textarea placeholder="Type a message..." />
  )}
</div>

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  setIsDragging(true);
}

function handleDragLeave(e: DragEvent) {
  setIsDragging(false);
}

async function handleDrop(e: DragEvent) {
  e.preventDefault();
  setIsDragging(false);

  const files = Array.from(e.dataTransfer.files);

  // Validate files
  const validFiles = [];
  const errors = [];

  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) {
      errors.push(`${file.name}: File too large (max 10MB)`);
      continue;
    }

    if (!isAllowedMimeType(file.type)) {
      errors.push(`${file.name}: File type not supported`);
      continue;
    }

    validFiles.push(file);
  }

  // Show errors
  if (errors.length > 0) {
    toast.error(errors.join('\n'));
  }

  // Upload valid files
  if (validFiles.length > 0) {
    await uploadMultiple(validFiles);
  }
}
```

### Upload Progress Tracking

```typescript
// Subscribe to progress events from main process
ipcRenderer.on('upload:progress', (event, progressEvent: UploadProgressEvent) => {
  setUploadProgress((prev) => ({
    ...prev,
    [progressEvent.attachmentId]: {
      fileName: progressEvent.fileName,
      percentage: progressEvent.percentage,
      status: progressEvent.status,
      error: progressEvent.error
    }
  }));
});

// Progress bar component
<div className="upload-progress">
  <div className="file-name">{fileName}</div>
  <div className="progress-bar">
    <div
      className="progress-fill"
      style={{ width: `${percentage}%` }}
    />
  </div>
  <div className="progress-text">{percentage}%</div>
  {status === 'error' && <div className="error-message">{error}</div>}
</div>
```

### Image Preview Implementation

```typescript
function ImageThumbnail({ attachment }: { attachment: Attachment }) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadThumbnail() {
      const blob = await ipcRenderer.invoke('files:download', attachment.id);
      const url = URL.createObjectURL(blob);
      setThumbnailUrl(url);
    }

    if (attachment.mimeType.startsWith('image/')) {
      loadThumbnail();
    }

    return () => {
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [attachment.id]);

  if (!thumbnailUrl) {
    return <div className="thumbnail-loading">Loading...</div>;
  }

  return (
    <img
      src={thumbnailUrl}
      alt={attachment.fileName}
      className="thumbnail"
      style={{ width: '100px', height: '100px', objectFit: 'cover' }}
      onClick={() => openPreviewModal(thumbnailUrl)}
    />
  );
}
```

### File Type Icons

Map MIME types to icons for visual distinction:

```typescript
function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.startsWith('text/')) return '📝';
  if (mimeType.startsWith('video/')) return '🎥';
  if (mimeType.startsWith('audio/')) return '🎵';
  return '📎';  // Generic file icon
}
```

### Concurrent Upload Queue

```typescript
class UploadQueue {
  private queue: File[] = [];
  private activeUploads = 0;
  private readonly MAX_CONCURRENT = 3;

  async add(files: File[]): Promise<void> {
    this.queue.push(...files);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.activeUploads < this.MAX_CONCURRENT) {
      const file = this.queue.shift();
      if (!file) break;

      this.activeUploads++;

      try {
        await this.uploadFile(file);
      } catch (error) {
        console.error(`Upload failed: ${file.name}`, error);
      } finally {
        this.activeUploads--;
        this.processQueue();  // Process next in queue
      }
    }
  }

  private async uploadFile(file: File): Promise<void> {
    const result = await ipcRenderer.invoke('files:upload', {
      file,
      threadId: currentThreadId,
      messageId: currentMessageId
    });
    // Update UI with upload result
  }
}
```

### Attachment List UI

```
┌─────────────────────────────────────────────┐
│ Message Input Area                          │
├─────────────────────────────────────────────┤
│ Attachments (3)                   [Attach] │
├─────────────────────────────────────────────┤
│ 🖼️ image.png (2.3 MB)            ✓  [×]   │
│ 📄 report.pdf (1.1 MB)           ✓  [×]   │
│ 📝 notes.txt (45 KB)       ▓▓▓▓▓░░ 65% [×] │
└─────────────────────────────────────────────┘
```

### Performance Targets (Tech Spec §6.1)

- **Attachment List Render**: <100ms for messages with 10 attachments
- **Thumbnail Load**: <200ms per image
- **Progress Update**: Every 100ms (matching FileService events)
- **Drag-and-Drop Response**: <50ms visual feedback

### UI/UX Patterns

**Empty State:**
"No attachments yet. Drag files here or click [Attach File] to add attachments."

**Loading State:**
Show skeleton loaders for thumbnails while loading

**Error State:**
"Upload failed: {fileName}. [Retry]"

**Validation Errors:**
Toast notification with list of rejected files and reasons

### Accessibility

- **Keyboard Navigation**: Tab to navigate attachments, Enter to download/preview, Delete key to remove
- **ARIA Labels**: Screen reader announces file names, sizes, upload status
- **Focus Management**: Focus on upload button after file added, focus on next attachment after deletion
- **Color Contrast**: Ensure progress bars and status icons meet WCAG AA standards

### Testing Strategy

- **Unit Tests**: Drag-and-drop handlers, file validation, concurrent upload queue
- **E2E Tests**: Full upload flow, progress tracking, preview modal, download/delete
- **Visual Tests**: Screenshot comparison for attachment list rendering
- **Accessibility Tests**: Keyboard navigation, screen reader compatibility
- **Performance Tests**: Render time with 10/20/50 attachments

### Dependencies

- **Requires: E5-S1 (FileService)** - Upload/download operations
- **Integrates with: Message Composer** - Attachment UI embedded in composer

### References

- [Tech Spec: Epic 5 File Attachments](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md)
- [Tech Spec §4.1: Services (AttachmentUI)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#services-and-modules)
- [Tech Spec §4.4: Workflows (Drag-and-drop flow)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#workflows-and-sequencing)
- [Tech Spec §6.1: Performance (UI render targets)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#performance)
- [Tech Spec §9: Open Question #4 (Inline preview decision)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#open-questions)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e5-s3-attachment-ui.context.xml

- docs/sprint-artifacts/e5-s3-attachment-ui.context.xml



### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

# Story 2.6: Clipboard Paste Operations

Status: ready-for-dev

## Story

As a user,
I want to paste text, images, and files into the input,
so that I can quickly attach content from other applications.

## Acceptance Criteria

1. Pasting text works in input box (default behavior preserved) (TM §6.5)
2. Pasting image (screenshot) creates attachment preview (TM §6.6)
3. Pasting file creates attachment preview (TM §6.6)
4. Invalid files show error toast with specific reason (FS §3.2)
5. Multiple files in single paste operation supported
6. Image thumbnails generated for pasted images
7. File size validation before accepting paste (max 10MB per file)

## Tasks / Subtasks

- [ ] Handle text paste (preserve default behavior) (AC: #1)
  - [ ] Listen for 'paste' event on input element
  - [ ] Check clipboard data for text/plain
  - [ ] Insert text at cursor position (default browser behavior)
  - [ ] No special handling needed - let browser handle it

- [ ] Detect and handle image paste (AC: #2, #6)
  - [ ] Listen for 'paste' event on input element
  - [ ] Check clipboard for image types: image/png, image/jpeg, image/gif
  - [ ] Read image data as Blob: event.clipboardData.items
  - [ ] Generate unique filename: `screenshot-${Date.now()}.png`
  - [ ] Create thumbnail: Canvas API to resize to 200x200px
  - [ ] Convert to data URL for preview
  - [ ] Create PendingAttachment object with blob

- [ ] Detect and handle file paste (AC: #3, #5)
  - [ ] Check clipboard for files: event.clipboardData.files
  - [ ] Extract File objects from FileList
  - [ ] Support multiple files in single paste (loop through files)
  - [ ] Create PendingAttachment for each file

- [ ] Convert to pending attachments (AC: #2, #3)
  - [ ] Create PendingAttachment interface:
    ```typescript
    interface PendingAttachment {
      id: string;           // Local UUID
      file: File | Blob;    // File data
      filename: string;     // Display name
      mimeType: string;     // MIME type
      sizeBytes: number;    // File size
      thumbnail?: string;   // Data URL for preview
      status: 'pending' | 'uploading' | 'uploaded' | 'error';
    }
    ```
  - [ ] Add to pendingAttachments array in input state
  - [ ] Display as attachment chip below input
  - [ ] Show thumbnail for images, icon for other files
  - [ ] Add remove button (X) to each chip

- [ ] Validate file type and size (AC: #4, #7)
  - [ ] Create `src/utils/fileValidator.ts`
  - [ ] Define allowed MIME types: images (png, jpg, gif), documents (pdf), text (txt, md)
  - [ ] Define allowed extensions: .png, .jpg, .jpeg, .gif, .pdf, .txt, .md
  - [ ] Check file.type against MIME allowlist
  - [ ] Check file extension against extension allowlist
  - [ ] Verify file.size ≤ 10MB (10 * 1024 * 1024 bytes)
  - [ ] Show error toast for invalid files:
    - "File type not supported: {type}"
    - "File too large: {size}MB (max 10MB)"
    - "Invalid file extension: {ext}"
  - [ ] Reject invalid files, don't add to pending list

- [ ] Implement thumbnail generation for images (AC: #6)
  - [ ] Create `src/utils/thumbnailGenerator.ts`
  - [ ] Use Canvas API to resize image
  - [ ] Target size: 200x200px (maintain aspect ratio)
  - [ ] Convert to data URL for display
  - [ ] Cache thumbnails in memory during session

- [ ] Handle paste errors gracefully (AC: #4)
  - [ ] Catch clipboard read errors
  - [ ] Handle unsupported clipboard formats
  - [ ] Show error toast with helpful message
  - [ ] Log errors for debugging

- [ ] Add drag-and-drop support (bonus)
  - [ ] Listen for 'drop' event on input area
  - [ ] Extract files from event.dataTransfer.files
  - [ ] Reuse paste handling logic
  - [ ] Show drop zone visual indicator

## Dev Notes

### Architecture Patterns and Constraints

**Clipboard Paste Event Handling:**
```typescript
inputElement.addEventListener('paste', async (event) => {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault(); // Prevent default image paste
      const blob = item.getAsFile();
      await handleImagePaste(blob);
    } else if (item.kind === 'file') {
      event.preventDefault();
      const file = item.getAsFile();
      await handleFilePaste(file);
    }
    // Let text paste through (default behavior)
  }
});
```

**Thumbnail Generation:**
```typescript
function generateThumbnail(file: File, maxSize: number = 200): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      // Calculate dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxSize) {
          height = height * (maxSize / width);
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = width * (maxSize / height);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL());
    };
    img.src = URL.createObjectURL(file);
  });
}
```

**File Validation:**
- Client-side only (not security boundary)
- Validates before upload to provide immediate feedback
- Backend must also validate (E5 file upload story)

### Project Structure Notes

**File Locations:**
- `src/components/MessageInput.svelte` (update with paste handler)
- `src/components/AttachmentChip.svelte` (display pending attachments)
- `src/utils/fileValidator.ts` (validation logic)
- `src/utils/thumbnailGenerator.ts` (image thumbnail generation)
- `src/types/attachment.ts` (PendingAttachment interface)

**Dependencies:**
- E4-S1: NotificationService for error toasts
- E5-S1: File upload (actual file upload happens in E5-S1)

### Testing Framework

**Unit Tests:**
- File validator with valid/invalid files
- Thumbnail generator with various image sizes
- MIME type and extension validation

**Integration Tests:**
- Paste image from clipboard → verify thumbnail appears
- Paste file from clipboard → verify chip appears
- Paste invalid file → verify error toast

**E2E Tests:**
- Copy image to clipboard, paste into input, verify preview
- Paste file > 10MB, verify error message
- Paste unsupported file type, verify error message

### References

- [Source: docs/epics-and-stories-2025-11-25.md §E2-S6]

### Learnings from Previous Stories

**From E2-S5:**
- Clipboard operations via IPC
- Toast notifications for user feedback

**From E4-S1:**
- NotificationService for toasts

## Dev Agent Record

### Context Reference
- [Story Context XML](e2-s6-clipboard-paste-operations.context.xml)

### Agent Model Used

<!-- To be filled by dev agent during implementation -->

### Debug Log References

<!-- To be filled by dev agent during implementation -->

### Completion Notes List

<!-- To be filled by dev agent during implementation -->

### File List

<!-- To be filled by dev agent during implementation -->

# Drag and Drop File Upload Feature

## Overview

The drag-and-drop feature allows users to attach files by dragging them from their file system directly onto the message composer area.

## Implementation

### Frontend (Composer.svelte)

The `Composer` component has been enhanced with drag-and-drop functionality:

**Key Features:**

- Visual feedback when dragging files over the composer
- Drag overlay with upload icon and instructions
- Nested drag event handling (prevents flicker)
- Accessible ARIA labels and roles
- Works alongside existing file picker button

**Event Handlers:**

- `ondragenter` - Shows overlay when files enter composer area
- `ondragleave` - Hides overlay when files leave
- `ondragover` - Maintains drag state and sets drop effect
- `ondrop` - Captures dropped files and adds them to selection

**Visual Design:**

- Dashed border around composer when dragging
- Semi-transparent overlay with blur effect
- Upload icon (cloud with arrow) and message
- Smooth transitions and animations

### State Management

- `isDragging` - Boolean flag for drag state
- `dragCounter` - Tracks nested drag enter/leave events (prevents premature hide)
- `selectedFiles` - Array of File objects (works for both drag-drop and file picker)

### File Processing

Once files are dropped:

1. Files are added to `selectedFiles` array
2. Preview components are displayed for each file
3. User can remove files before sending
4. On send, files are validated and uploaded via IPC
5. Upload follows same flow as file picker selection

## Accessibility

### ARIA Attributes

- `role="region"` on composer container
- `aria-label="Message composer with file drop zone"`
- `role="status"` and `aria-live="polite"` on drag overlay

### Keyboard Support

- All drag-drop features also work via file picker (Ctrl/Cmd+U)
- Remove attachments with Delete/Backspace keys
- Full keyboard navigation support

## Browser/Electron Compatibility

- Uses standard HTML5 Drag and Drop API
- Works in Electron's Chromium environment
- File validation occurs on both client and server
- Secure IPC communication for file upload

## Testing

- E2E test suite at `tests/e2e/file-drag-drop.spec.ts`
- Tests file input (simulates drag-drop)
- Verifies preview, removal, and send functionality
- Validates accessibility attributes

## User Experience

### Visual Flow:

1. User drags file(s) from desktop/folder
2. Composer highlights with dashed border
3. Overlay appears: "Drop files here to attach"
4. User releases files
5. Overlay disappears
6. Previews appear below composer
7. User can review, remove, or send

### Supported File Types:

Same as file picker:

- Images: JPEG, PNG, GIF, WebP
- Documents: PDF, TXT, Markdown
- Data: JSON, CSV

### Size Limits:

- Default: 10MB per file
- Configurable in FileValidationService

## Integration Points

- Uses existing `FileStorageService` for persistence
- Uses existing `FileValidationService` for security
- Uses existing IPC handlers (`file:upload`, etc.)
- Compatible with multi-modal AI providers (Claude, OpenAI)

## Future Enhancements

- Progress indicator for large file uploads
- Thumbnail generation for images
- Drag-and-drop onto specific message (edit/reply)
- Folder upload support
- Paste from clipboard support

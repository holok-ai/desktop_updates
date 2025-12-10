# Story 8.4: Drag and Drop

Status: ready-for-dev

## Story

As a Holokai Desktop user,
I want to drag and drop files into the message input area and reorder threads in the sidebar,
so that I can quickly attach files to messages and organize my threads without clicking through menus.

## Acceptance Criteria

1. **AC-4.1**: Message input area accepts drag-drop files with visual feedback (drop zone highlight, file count indicator)
   - Drop zone highlights with blue border when files dragged over
   - File count badge shows "3 files" during drag
   - Highlight removed when drag leaves or drop completes

2. **AC-4.2**: Multi-file drag-drop supported with file type and size validation
   - Dropped files validated against allowed types (per E5 file attachment rules)
   - Files exceeding size limit (100MB per file) rejected with error message
   - Valid files show upload progress, invalid files show error toast

3. **AC-4.3**: Thread sidebar supports drag-to-reorder threads with drag handles
   - Drag handle icon visible on thread hover (six dots)
   - Dragging thread shows ghost preview following cursor
   - Dropping thread reorders thread list (persists order to backend)

4. **AC-4.4**: Drop rejection states show clear error messages (e.g., "File type not allowed", "File exceeds 100MB limit")
   - Error toast displays for 5 seconds with specific rejection reason
   - Multiple errors grouped: "2 files rejected: file-type-not-allowed"

5. **AC-4.5**: File drop quota validation prevents exceeding storage limits
   - If user quota exceeded, show error: "Storage quota exceeded (used 950MB / 1GB)"
   - Provide link to Settings > Storage to manage files

## Tasks / Subtasks

- [ ] Implement file drop zone in message input area (AC: 4.1, 4.2)
  - [ ] Create DragDropHandler Svelte action in `src/lib/actions/dragdrop.ts`
  - [ ] Add dragenter/dragleave/dragover/drop event listeners to message input component
  - [ ] Track drag counter to handle nested elements (increment on enter, decrement on leave)
  - [ ] Add/remove 'drag-over' CSS class based on drag state
  - [ ] Call `event.preventDefault()` on dragover to allow drop
  - [ ] Set `event.dataTransfer.dropEffect = 'copy'` for visual feedback
- [ ] Implement visual feedback during drag (AC: 4.1)
  - [ ] Add CSS styles for `.drag-over` class (blue dashed border, light blue background)
  - [ ] Create drop zone overlay component showing "Drop files here" text with icon
  - [ ] Display file count badge during drag (extract from `event.dataTransfer.items.length`)
  - [ ] Animate border on dragenter (CSS transition)
  - [ ] Remove all visual feedback on dragleave or drop completion
- [ ] Implement file validation and processing (AC: 4.2, 4.4, 4.5)
  - [ ] Extract files array from `event.dataTransfer.files` on drop
  - [ ] Create `validateFiles()` function checking type, size, and quota
  - [ ] Validate file types against allowlist from E5 FileService configuration
  - [ ] Validate each file size against 100MB limit
  - [ ] Check total size against user storage quota (call StorageService)
  - [ ] Separate valid files from invalid files with rejection reasons
  - [ ] Pass valid files to FileService.uploadFiles() with progress callbacks
  - [ ] Display error toast for invalid files with specific reason (type/size/quota)
  - [ ] Group multiple errors: "2 files rejected: size-exceeded"
- [ ] Integrate with FileService for upload (AC: 4.2)
  - [ ] Call FileService.uploadFile() for each valid file via IPC
  - [ ] Display upload progress bar/spinner for each file
  - [ ] Add uploaded files to message attachments array
  - [ ] Show file preview thumbnails in message input area
  - [ ] Handle upload errors (network, server) with retry option
- [ ] Implement thread reordering via drag-drop (AC: 4.3)
  - [ ] Add drag handle icon (six dots) to thread list items, visible on hover
  - [ ] Make thread list items draggable by setting `draggable="true"` on drag handle
  - [ ] Listen for dragstart event to capture dragged thread ID and index
  - [ ] Create ghost preview element following cursor during drag
  - [ ] Listen for dragover on other thread items to show drop indicator
  - [ ] Calculate drop position (before/after target thread) based on cursor position
  - [ ] On drop, reorder threads array in ThreadStore
  - [ ] Call ThreadRepository.updateThreadOrder() to persist new order
  - [ ] Animate thread list reordering (CSS transition)
- [ ] Add error handling and user feedback (AC: 4.4, 4.5)
  - [ ] Create Toast notification component for errors
  - [ ] Display toast for 5 seconds with auto-dismiss
  - [ ] Format error messages: "File type not allowed: document.exe"
  - [ ] For quota errors, include link to Settings > Storage
  - [ ] Log all drop errors to electron-log for debugging
  - [ ] Handle edge cases: empty drop, non-file data, network errors

## Dev Notes

### HTML5 Drag and Drop API Patterns

**Event Flow:**
1. User drags file over window → `dragenter` fires → Show drop zone
2. File moves over drop zone → `dragover` fires continuously → Maintain visual feedback
3. File leaves drop zone → `dragleave` fires → Hide drop zone
4. File dropped → `drop` fires → Process files

**Nested Element Issue:**
The drag/drop API fires enter/leave events for every child element, causing flicker. Solution:
- Use a counter: increment on `dragenter`, decrement on `dragleave`
- Only show drop zone when counter === 1
- Reset counter to 0 on drop

**DataTransfer Object:**
- `event.dataTransfer.files` - FileList of dropped files
- `event.dataTransfer.items` - DataTransferItemList (for file count during drag)
- `event.dataTransfer.dropEffect` - Visual cursor feedback ('copy', 'move', 'link', 'none')

**Svelte Action Pattern:**
```typescript
export function dragdrop(node: HTMLElement, options: DragDropOptions) {
  let dragCounter = 0;

  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    dragCounter++;
    if (dragCounter === 1) node.classList.add('drag-over');
  }

  // ... other handlers

  return {
    destroy() {
      // cleanup listeners
    }
  };
}
```

### File Validation Requirements

Per Epic 5 (File Attachments) specification:
- **Allowed Types**: Images (PNG, JPG, GIF, WebP), Documents (PDF, TXT, MD), Archives (ZIP)
- **Max File Size**: 100MB per file
- **Storage Quota**: User-specific, check via `StorageService.getQuota()`
- **Security**: Validate file type by magic bytes, not just extension

### Thread Reordering Data Model

Threads have an implicit order based on array index in ThreadStore. On reorder:
1. Update local `threads` array in Svelte store (reactive)
2. Call `ThreadRepository.updateThreadOrder(threadIds: string[])` via IPC
3. Main process persists order to electron-store
4. On app restart, threads load in saved order

**Data Structure:**
```typescript
// electron-store: settings.json
{
  "threadOrder": ["thread-uuid-3", "thread-uuid-1", "thread-uuid-2"]
}
```

### Architecture References

- **DragDropHandler**: Renderer process (Architecture §2.3), Svelte action pattern
- **FileService**: Epic 5 dependency for file upload (Architecture §2.2 main process)
- **ThreadRepository**: Epic 4 dependency for thread order persistence (Architecture §2.2)
- **IPC Communication**: All file operations via secure IPC channels (Architecture §3)
- **Security**: CSP allows drag-drop events, files validated in main process before upload

### Component Integration

**MessageInput.svelte** (existing component from earlier stories):
- Add `use:dragdrop` action to message input container
- Display drop zone overlay when drag active
- Show file attachment previews below input
- Integrate with existing FileService from E5

**ThreadList.svelte** (existing component from E2/E3):
- Add drag handles to thread items
- Implement reorder logic in thread store
- Persist order via ThreadRepository

### Testing Strategy

**Unit Tests:**
- DragDropHandler action: validate drag counter logic, CSS class application
- validateFiles function: test type/size/quota validation with fixtures
- Thread reorder: test array manipulation, order persistence

**Integration Tests:**
- Drop file → FileService.upload() called with correct file data
- Thread reorder → ThreadRepository.updateThreadOrder() called with new order

**E2E Tests:**
- E8-S4-01: Drag image file to message input, verify upload and preview
- E8-S4-02: Drag oversized file (150MB), verify error toast
- E8-S4-03: Drag thread in sidebar, verify visual feedback and order persistence
- E8-S4-04: Drop multiple files (5), verify all valid ones upload, invalid ones show errors

### Project Structure Notes

**New Files:**
- `src/lib/actions/dragdrop.ts` - Svelte drag-drop action
- `src/lib/components/DropZone.svelte` - Drop zone overlay component
- `src/lib/components/Toast.svelte` - Error notification toast
- `tests/unit/actions/dragdrop.test.ts` - Unit tests for drag-drop logic

**Modified Files:**
- `src/lib/components/MessageInput.svelte` - Add drop zone integration
- `src/lib/components/ThreadList.svelte` - Add drag handles and reorder logic
- `src/lib/stores/threadStore.ts` - Add thread reorder method
- `src/main/ipc-handlers/thread-handler.ts` - Add updateThreadOrder IPC handler

### References

- [Tech Spec: Epic 8, E8-S4 AC-4.1-4.5] - docs/sprint-artifacts/tech-spec-epic-8.md §Acceptance Criteria
- [Tech Spec: DragDropHandler API] - docs/sprint-artifacts/tech-spec-epic-8.md §APIs and Interfaces (line 480-566)
- [Architecture: Renderer Process] - docs/architecture.md §2.3
- [Architecture: IPC Communication] - docs/architecture.md §IPC Communication
- [Epic 5: File Attachments] - docs/epics-and-stories-2025-11-25.md (dependency for FileService)
- [Epic 4: ThreadRepository] - docs/epics-and-stories-2025-11-25.md (dependency for thread persistence)
- [Epics: E8-S4 Tasks] - docs/epics-and-stories-2025-11-25.md lines 2240-2279

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e8-s4-drag-and-drop.context.xml

- docs/sprint-artifacts/e8-s4-drag-and-drop.context.xml



### Agent Model Used

<!-- Model name and version will be added during implementation -->

### Debug Log References

<!-- Debug log paths will be added during implementation -->

### Completion Notes List

<!-- Completion notes will be added by dev agent after implementation -->

### File List

<!-- File changes will be tracked here by dev agent -->

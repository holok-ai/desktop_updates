# Story 2.5: Clipboard Copy Operations

Status: ready-for-dev

## Story

As a user,
I want to copy prompts, responses, and code blocks to clipboard,
so that I can reuse content in other applications or modify prompts.

## Acceptance Criteria

1. Copy button on user messages copies content to input box and focuses it (TM §6.1)
2. Copy Response button on assistant messages copies to system clipboard (TM §6.2)
3. Copy Code button on code blocks copies code only, no backticks (TM §6.3)
4. Toast shows "Copied to clipboard" confirmation (CORE §8.2)
5. Copy Response supports text and markdown format options (TM §6.4)
6. Format preference remembered across sessions
7. Keyboard shortcut Ctrl+C/Cmd+C works on selected messages

## Tasks / Subtasks

- [ ] Add Copy button to user messages (copy to input) (AC: #1)
  - [ ] Create `src/components/CopyToInputButton.svelte`
  - [ ] Position in message action bar (hover reveal)
  - [ ] Icon: duplicate or arrow-down-to-box
  - [ ] On click: Set input value to message.content
  - [ ] Focus input box programmatically
  - [ ] Scroll input into view if needed
  - [ ] Show toast: "Copied to input"

- [ ] Add Copy Response button to assistant messages (AC: #2, #4, #5)
  - [ ] Create `src/components/CopyResponseButton.svelte`
  - [ ] Use Electron clipboard API via IPC bridge
  - [ ] Create IPC handler in main process: 'clipboard:write'
  - [ ] Add format dropdown: "Copy as Text" | "Copy as Markdown"
  - [ ] Strip markdown for text format: Remove **, __, `, links, etc.
  - [ ] Preserve markdown for markdown format
  - [ ] Call clipboard.writeText(content) in main process
  - [ ] Show toast: "Copied to clipboard"

- [ ] Add Copy Code button to code blocks (AC: #3, #4)
  - [ ] Update `src/components/CodeBlock.svelte`
  - [ ] Add button overlay in top-right corner
  - [ ] Show on hover: position absolute, top-right
  - [ ] Extract code content only (strip ```language and closing ```)
  - [ ] Copy to clipboard via IPC
  - [ ] Show language name as tooltip on button
  - [ ] Show toast: "Code copied"

- [ ] Implement clipboard service (AC: #2)
  - [ ] Create `src-electron/services/clipboard.service.ts`
  - [ ] Expose via IPC: ipcMain.handle('clipboard:write')
  - [ ] Use electron.clipboard.writeText(text)
  - [ ] Handle clipboard errors gracefully
  - [ ] Create renderer wrapper: `src/services/ClipboardService.ts`
  - [ ] Export copyText(text) method

- [ ] Implement format preference persistence (AC: #5, #6)
  - [ ] Add to StateStore: copyFormat: 'text' | 'markdown'
  - [ ] Default: 'markdown'
  - [ ] Update on format selection
  - [ ] Load on app startup
  - [ ] Apply to all Copy Response operations

- [ ] Add toast notifications for copy actions (AC: #4)
  - [ ] Use NotificationService from E4-S1
  - [ ] Show toast on successful copy
  - [ ] Different messages for different actions:
    - "Copied to input" (user message copy)
    - "Copied to clipboard" (response copy)
    - "Code copied" (code block copy)
  - [ ] Auto-dismiss after 2 seconds
  - [ ] Position: top-right corner

- [ ] Add keyboard shortcut support (AC: #7)
  - [ ] Listen for Ctrl+C / Cmd+C on focused message
  - [ ] Detect if message is selected (highlight or focus state)
  - [ ] Copy message content to clipboard
  - [ ] Show appropriate toast
  - [ ] Don't interfere with text selection within message

## Dev Notes

### Architecture Patterns and Constraints

**Clipboard API Integration:**
- Main process: electron.clipboard (Node.js context)
- Renderer process: Must use IPC bridge for security
- IPC pattern: renderer invokes → main handles → clipboard write

**IPC Bridge:**
```typescript
// Main process
ipcMain.handle('clipboard:write', async (event, text: string) => {
  clipboard.writeText(text);
  return { success: true };
});

// Renderer process
async function copyToClipboard(text: string) {
  await window.electron.invoke('clipboard:write', text);
}
```

**Markdown Stripping Algorithm:**
```typescript
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')  // Bold
    .replace(/__(.+?)__/g, '$1')       // Bold
    .replace(/\*(.+?)\*/g, '$1')       // Italic
    .replace(/_(.+?)_/g, '$1')         // Italic
    .replace(/`(.+?)`/g, '$1')         // Inline code
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
    .replace(/^#+\s+/gm, '')           // Headers
    .replace(/^>\s+/gm, '')            // Blockquotes
    .trim();
}
```

### Project Structure Notes

**File Locations:**
- `src/components/CopyToInputButton.svelte`
- `src/components/CopyResponseButton.svelte`
- `src/components/CodeBlock.svelte` (update existing)
- `src/services/ClipboardService.ts` (renderer wrapper)
- `src-electron/services/clipboard.service.ts` (main process)
- `src/utils/markdownStripper.ts`

**Dependencies:**
- E4-S1: NotificationService for toasts
- Electron clipboard API

### Testing Framework

**Unit Tests:**
- Markdown stripping function with various inputs
- Copy format preference persistence

**Integration Tests:**
- IPC clipboard write communication
- Toast notifications appear on copy

**E2E Tests:**
- Click Copy on user message → verify input populated
- Click Copy Response → verify clipboard contains text
- Click Copy Code → verify clipboard contains code only
- Change format preference → verify persisted across restart

### References

- [Source: docs/epics-and-stories-2025-11-25.md §E2-S5]

### Learnings from Previous Stories

**From E4-S1:**
- NotificationService for toasts
- Toast positioning and auto-dismiss

**From E2-S2:**
- Message action bar pattern
- Hover reveal for buttons

## Dev Agent Record

### Context Reference
- [Story Context XML](e2-s5-clipboard-copy-operations.context.xml)

### Agent Model Used

<!-- To be filled by dev agent during implementation -->

### Debug Log References

<!-- To be filled by dev agent during implementation -->

### Completion Notes List

<!-- To be filled by dev agent during implementation -->

### File List

<!-- To be filled by dev agent during implementation -->

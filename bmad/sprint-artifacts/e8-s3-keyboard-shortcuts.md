# Story 8.3: Keyboard Shortcuts

Status: ready-for-dev

## Story

As a power user,
I want comprehensive keyboard shortcuts for common actions,
so that I can navigate and control Holokai Desktop efficiently without relying on mouse interactions.

## Acceptance Criteria

1. **AC-3.1**: Global shortcuts work when app is backgrounded: Cmd+N (New Thread), Cmd+K (Command Palette)
   - Shortcuts activate even when other apps are focused
   - Shortcuts bring app to foreground before executing action

2. **AC-3.2**: In-app shortcuts work when app is focused: Cmd+1-9 (Switch Threads), Cmd+B/I (Bold/Italic), Cmd+Enter (Send Message), Esc (Close Dialog)
   - Thread switching shortcuts jump to thread at index (1-9)
   - Text formatting shortcuts toggle bold/italic in message input
   - Cmd+Enter sends message without clicking Send button
   - Esc closes topmost modal/dialog and restores focus

3. **AC-3.3**: Command palette (Cmd+K) opens with fuzzy search across all commands
   - Palette overlays current view with search input focused
   - Search returns results within 50ms for query against 100+ commands
   - Arrow keys navigate results, Enter executes selected command, Esc closes palette

4. **AC-3.4**: Command palette displays keyboard shortcuts next to command labels
   - Shortcuts shown in gray text (e.g., "New Thread    Cmd+N")
   - Shortcuts update when user customizes them in Settings

5. **AC-3.5**: Shortcuts configuration UI allows customization of all non-system shortcuts
   - Settings > Keyboard Shortcuts shows list of all customizable shortcuts
   - Click shortcut to record new key combination
   - Conflict detection warns if new shortcut conflicts with OS or existing shortcut
   - Reset button restores default shortcuts

6. **AC-3.6**: Shortcut registration fails gracefully if OS conflict detected
   - If global shortcut conflicts with OS (e.g., Cmd+Space on macOS), show notification: "Shortcut Cmd+Space unavailable (OS reserved)"
   - Fallback to app-level shortcut (only works when app focused)
   - User can reassign shortcut in Settings

## Tasks / Subtasks

- [ ] Define keyboard shortcut system architecture (AC: #3.1, #3.2)
  - [ ] Create `src/main/services/ShortcutService.ts` for main process global shortcut management
  - [ ] Create `src/config/shortcuts.ts` for centralized shortcut configuration
  - [ ] Define `ShortcutConfig` interface with id, label, accelerator, scope, handler, conflictsWith fields
  - [ ] Define `ShortcutRegistry` interface for shortcuts and customizations mapping
  - [ ] Implement platform detection for Cmd vs Ctrl (darwin vs win32/linux)

- [ ] Implement ShortcutService for global shortcuts (AC: #3.1, #3.6)
  - [ ] Implement `registerShortcuts()` method using `globalShortcut.register()` API
  - [ ] Implement IPC handler to send 'shortcut:triggered' events to renderer
  - [ ] Implement `checkConflicts()` method to detect OS-reserved shortcuts
  - [ ] Implement `getOSReservedShortcuts()` for platform-specific reserved keys
  - [ ] Implement `unregisterAll()` for cleanup on app quit
  - [ ] Add graceful failure handling for registration conflicts
  - [ ] Store registry in Map for lookup and management

- [ ] Register global shortcuts (AC: #3.1)
  - [ ] Register Cmd/Ctrl+N for New Thread (global scope, works when backgrounded)
  - [ ] Register Cmd/Ctrl+K for Command Palette (global scope)
  - [ ] Implement handlers that bring app to foreground before executing action
  - [ ] Wire IPC events from main to renderer for shortcut activation

- [ ] Implement in-app shortcuts (AC: #3.2)
  - [ ] Register Cmd/Ctrl+1-9 for thread switching (app scope)
  - [ ] Implement handler to navigate to nth thread in thread list
  - [ ] Register Cmd/Ctrl+B for bold text formatting in message input
  - [ ] Register Cmd/Ctrl+I for italic text formatting in message input
  - [ ] Register Cmd/Ctrl+Enter for send message action
  - [ ] Register Esc for close dialog/modal with focus restoration

- [ ] Create CommandPaletteStore (AC: #3.3, #3.4)
  - [ ] Create `src/lib/stores/commandPaletteStore.ts` Svelte store
  - [ ] Initialize command registry with Command[] array
  - [ ] Integrate Fuse.js for fuzzy search (threshold: 0.3)
  - [ ] Implement `search()` method returning results within 50ms
  - [ ] Define Command interface: id, label, category, keywords, shortcut, handler, enabled
  - [ ] Populate default commands (New Thread, Settings, Toggle Sidebar, Search Threads, etc.)

- [ ] Create CommandPalette UI component (AC: #3.3, #3.4)
  - [ ] Create `src/lib/components/CommandPalette.svelte`
  - [ ] Implement modal overlay with search input focused on open
  - [ ] Wire Cmd/Ctrl+K shortcut to open palette
  - [ ] Implement keyboard navigation (Arrow Up/Down, Enter, Esc)
  - [ ] Display shortcuts in gray text next to command labels
  - [ ] Implement command execution on Enter key or click
  - [ ] Close palette on Esc or backdrop click

- [ ] Create Shortcuts configuration UI (AC: #3.5)
  - [ ] Create `src/routes/settings/Shortcuts.svelte` settings page
  - [ ] Display list of all customizable shortcuts in table format
  - [ ] Implement shortcut recording on click (capture key combination)
  - [ ] Implement conflict detection UI warning
  - [ ] Implement Reset button to restore defaults
  - [ ] Persist customizations to Settings store via IPC
  - [ ] Load custom shortcuts from Settings on app startup

- [ ] Integrate shortcuts with menu system (AC: #3.4)
  - [ ] Add accelerator property to menu items in MenuService
  - [ ] Ensure shortcuts display correctly in menu labels
  - [ ] Sync menu accelerators with customized shortcuts
  - [ ] Update menu items when shortcuts change in Settings

- [ ] Add graceful error handling (AC: #3.6)
  - [ ] Detect global shortcut registration failures
  - [ ] Show toast notification for OS conflicts
  - [ ] Fallback to app-level shortcut (only active when focused)
  - [ ] Provide "Customize Shortcut" action in notification
  - [ ] Log shortcut conflicts for debugging

- [ ] Write unit tests for ShortcutService
  - [ ] Test `registerShortcuts()` successfully registers global shortcuts
  - [ ] Test conflict detection identifies OS-reserved shortcuts
  - [ ] Test shortcut handler triggers correct IPC events
  - [ ] Test `unregisterAll()` cleans up shortcuts on app quit
  - [ ] Test platform-specific reserved shortcuts detection

- [ ] Write unit tests for CommandPaletteStore
  - [ ] Test fuzzy search returns relevant commands for query
  - [ ] Test search performance <50ms for 100+ commands
  - [ ] Test command handler execution triggers correct action
  - [ ] Test keyboard navigation (arrow keys, enter, esc)

- [ ] Write component tests for CommandPalette
  - [ ] Test opens on Cmd+K shortcut
  - [ ] Test search input focused on open
  - [ ] Test arrow keys navigate results
  - [ ] Test Enter executes selected command
  - [ ] Test Esc closes palette

- [ ] Write E2E tests for keyboard shortcuts workflow
  - [ ] Test: Launch app, create 3 threads, press Cmd+1/2/3 to switch threads
  - [ ] Test: Press Cmd+K, type "new", press Enter to create new thread
  - [ ] Test: Press Cmd+N from another app to bring Holokai to foreground and create thread
  - [ ] Test: Type in message input, press Cmd+B to toggle bold formatting
  - [ ] Test: Press Cmd+Enter to send message without clicking Send button
  - [ ] Test: Open modal, press Esc to close and restore focus

## Dev Notes

### Architecture Alignment

This story implements comprehensive keyboard shortcut functionality for Holokai Desktop, spanning both Electron main process (global shortcuts) and renderer process (in-app shortcuts, command palette). The implementation follows the multi-process Electron architecture pattern documented in Architecture §2.

**Key Components:**

- **ShortcutService (Main Process)** - Manages global shortcuts using Electron's `globalShortcut` API, detects OS conflicts, and communicates with renderer via IPC
- **CommandPaletteStore (Renderer)** - Svelte 5 store managing command registry and fuzzy search using Fuse.js
- **CommandPalette Component (Renderer)** - Modal UI component for keyboard-driven command execution
- **Shortcuts Settings Page (Renderer)** - Configuration UI for shortcut customization

**Architectural Constraints:**

- Global shortcuts MUST be registered in main process via `globalShortcut.register()` to work when app is backgrounded (Architecture §2.2)
- All shortcut actions MUST communicate via IPC (main → renderer) using `electronAPI.shortcut.onTriggered` pattern
- Command palette MUST use platform-agnostic accelerator format: `CmdOrCtrl+Key` for cross-platform compatibility
- Shortcut customizations MUST persist via electron-store in main process (Architecture: Data Storage)

**Platform-Specific Considerations:**

- macOS: Use `Cmd` key (Command)
- Windows/Linux: Use `Ctrl` key
- Reserved OS shortcuts vary by platform:
  - macOS: Cmd+Space (Spotlight), Cmd+Tab (App Switcher), Cmd+Q/H/M (System)
  - Windows: Alt+Tab, Ctrl+Alt+Del, Win+L
  - Linux: Varies by desktop environment

**Cross-Platform Key Binding Patterns:**

```typescript
// Use CmdOrCtrl for primary modifier
{ accelerator: 'CmdOrCtrl+N' }  // Cmd+N on macOS, Ctrl+N on Windows/Linux

// Use platform detection for OS-specific shortcuts
if (process.platform === 'darwin') {
  { accelerator: 'Cmd+,' }  // Settings on macOS
} else {
  { accelerator: 'Ctrl+,' }  // Settings on Windows/Linux
}

// Use Alt vs Option explicitly when needed
{ accelerator: 'Alt+F4' }     // Windows/Linux only (close window)
{ accelerator: 'Cmd+W' }       // macOS only (close window)
```

### Data Flow

**Global Shortcut Activation:**
1. User presses Cmd+N while app is backgrounded
2. OS triggers global shortcut → Electron `globalShortcut` handler
3. ShortcutService handler: `app.show()` + `ipcHandler.send('shortcut:triggered', 'new-thread')`
4. Renderer receives IPC event → ThreadStore.createThread()
5. New thread created and focused

**Command Palette Search:**
1. User presses Cmd+K → CommandPalette component opens
2. User types "new th" → CommandPaletteStore.search('new th')
3. Fuse.js returns fuzzy matches: [{ id: 'new-thread', label: 'New Thread', shortcut: 'Cmd+N' }]
4. User presses Enter → Command handler executes → ThreadStore.createThread()
5. Palette closes, new thread focused

**Shortcut Customization:**
1. User navigates to Settings > Keyboard Shortcuts
2. User clicks "New Thread" shortcut → Recording mode activated
3. User presses Cmd+T → Conflict check (OK)
4. Customization saved: `{ 'new-thread': 'CmdOrCtrl+T' }` → electron-store
5. App restart: ShortcutService loads customizations → Registers Cmd+T instead of Cmd+N

### Testing Strategy

**Unit Tests:**
- ShortcutService: Registration, conflict detection, IPC events, cleanup
- CommandPaletteStore: Fuzzy search, performance (<50ms), command execution

**Component Tests:**
- CommandPalette: Open/close, keyboard navigation, search, command execution

**Integration Tests:**
- Menu-to-shortcut sync: Menu accelerators match registered shortcuts
- Shortcut customization: Changes persist and apply on restart

**E2E Tests:**
- Global shortcut workflow: Cmd+N from backgrounded app
- Command palette workflow: Cmd+K → search → execute
- Shortcut customization workflow: Change shortcut → restart → verify

**Performance Targets:**
- Command palette search: <50ms for 100+ commands (AC-3.3)
- Shortcut registration: <100ms for all shortcuts at startup (Tech Spec §Non-Functional Requirements)
- Keyboard navigation latency: <16ms (60fps) for focus updates (Tech Spec §Non-Functional Requirements)

### Security Considerations

- **Shortcut Injection Prevention**: All keyboard shortcuts validated against whitelist; no dynamic shortcut registration from user input
- **Menu Command Injection**: Menu templates statically defined; no user-controlled menu labels or actions
- **IPC Security**: All shortcut actions use predefined IPC channels; no eval() or dynamic code execution

### Project Structure Notes

**New Files:**
- `src/main/services/ShortcutService.ts` - Global shortcut management (Main)
- `src/config/shortcuts.ts` - Shortcut configuration and defaults
- `src/lib/stores/commandPaletteStore.ts` - Command palette state (Renderer)
- `src/lib/components/CommandPalette.svelte` - Command palette UI (Renderer)
- `src/routes/settings/Shortcuts.svelte` - Shortcuts settings page (Renderer)

**Modified Files:**
- `src/main/main.ts` - Initialize ShortcutService on app ready
- `src/main/ipc-handlers/shortcuts.ts` - IPC handlers for shortcut events
- `src/main/services/MenuService.ts` - Sync menu accelerators with shortcuts
- `src/lib/stores/settingsStore.ts` - Add shortcut customizations to settings

**Dependencies:**
- `fuse.js` (v7.0+): Fuzzy search for command palette
- Electron `globalShortcut` API (v39+): Global shortcut registration
- Electron `Menu` API (v39+): Menu accelerators (from E8-S1)

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-8.md - §Detailed Design: Shortcut Service API]
- [Source: docs/sprint-artifacts/tech-spec-epic-8.md - §Detailed Design: Command Palette Store]
- [Source: docs/sprint-artifacts/tech-spec-epic-8.md - §Detailed Design: Data Models - ShortcutConfig]
- [Source: docs/sprint-artifacts/tech-spec-epic-8.md - §Acceptance Criteria: E8-S3]
- [Source: docs/epics-and-stories-2025-11-25.md - Epic 8: E8-S3: Keyboard Shortcuts]
- [Source: docs/architecture.md - §2: Multi-Process Electron Architecture]
- [Source: docs/architecture.md - §3: IPC Communication]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e8-s3-keyboard-shortcuts.context.xml

- docs/sprint-artifacts/e8-s3-keyboard-shortcuts.context.xml



### Agent Model Used

<!-- Agent model will be recorded during dev-story execution -->

### Debug Log References

<!-- Debug logs will be added during implementation -->

### Completion Notes List

<!-- Completion notes will be added after implementation -->

### File List

<!-- File list will be populated during implementation -->

# Story 8.1: Application Menu Bar

Status: ready-for-dev

## Story

As a Holokai Desktop user,
I want a native application menu bar with standard menus (File, Edit, View, Window, Help),
so that I can access common application functions through familiar desktop conventions and keyboard shortcuts.

## Acceptance Criteria

**AC-1.1**: Application displays native menu bar with File, Edit, View, Window, Help menus on startup
- Menu bar visible immediately after main window creation
- Menu structure matches platform conventions (macOS: app menu first, Windows/Linux: File menu first)

**AC-1.2**: File menu includes New Thread (Cmd+N), Close Window (Cmd+W), Quit (Cmd+Q) with functional shortcuts
- New Thread shortcut creates new thread and focuses message input
- Close Window closes current window without quitting app (macOS) or quits app (Windows/Linux single-window)
- Quit command closes all windows and terminates app process

**AC-1.3**: Edit menu includes Undo, Redo, Cut, Copy, Paste, Select All with standard Electron roles
- All Edit commands work in text inputs, textareas, and contenteditable elements
- Undo/Redo disabled when no action history available

**AC-1.4**: View menu includes Reload, Toggle DevTools, Zoom In/Out/Reset, Toggle Fullscreen
- Reload refreshes current view without losing authentication state
- DevTools toggle only enabled in development builds
- Zoom commands adjust renderer process zoom level (80%-200% range)
- Fullscreen toggle works on all platforms (F11 or native fullscreen on macOS)

**AC-1.5**: Window menu includes Minimize, Close, and macOS-specific "Bring All to Front"
- Minimize minimizes to dock/taskbar (preserves window state)
- macOS "Bring All to Front" brings all app windows to foreground

**AC-1.6**: Help menu includes Documentation (opens external URL), Report Issue (opens GitHub issues), About (shows dialog)
- Documentation link opens browser with docs.holokai.com
- Report Issue opens browser with GitHub new issue form pre-filled
- About dialog displays app name, version, copyright, license

**AC-1.7**: Keyboard shortcuts display in menu items (e.g., "New Thread    Cmd+N")
- Shortcuts show platform-specific modifiers (Cmd on macOS, Ctrl on Windows/Linux)
- Shortcuts respect user's keyboard layout (no conflicts with non-US keyboards)

## Tasks / Subtasks

- [ ] **Task 1: Create MenuService in main process** (AC: 1.1, 1.7)
  - [ ] Create `src/main/services/MenuService.ts` in Electron main process
  - [ ] Implement `createMenu()` method using `Menu.buildFromTemplate()`
  - [ ] Define menu template with File, Edit, View, Window, Help sections
  - [ ] Implement `Menu.setApplicationMenu()` on app ready
  - [ ] Add platform detection for menu structure (macOS app menu vs standard)

- [ ] **Task 2: Implement File menu with keyboard shortcuts** (AC: 1.2, 1.7)
  - [ ] Add "New Thread" item with accelerator 'CmdOrCtrl+N'
  - [ ] Implement click handler to send IPC event 'menu:new-thread'
  - [ ] Add "Close Window" item with accelerator 'CmdOrCtrl+W' (role: 'close')
  - [ ] Add separator
  - [ ] Add "Quit" item with accelerator 'CmdOrCtrl+Q' (role: 'quit')
  - [ ] Test shortcuts trigger correct actions

- [ ] **Task 3: Implement Edit menu with standard Electron roles** (AC: 1.3)
  - [ ] Add "Undo" with accelerator 'CmdOrCtrl+Z', role: 'undo'
  - [ ] Add "Redo" with accelerator 'Shift+CmdOrCtrl+Z', role: 'redo'
  - [ ] Add separator
  - [ ] Add "Cut" with accelerator 'CmdOrCtrl+X', role: 'cut'
  - [ ] Add "Copy" with accelerator 'CmdOrCtrl+C', role: 'copy'
  - [ ] Add "Paste" with accelerator 'CmdOrCtrl+V', role: 'paste'
  - [ ] Add "Select All" with accelerator 'CmdOrCtrl+A', role: 'selectAll'
  - [ ] Test Edit commands work in text inputs and contenteditable elements

- [ ] **Task 4: Implement View menu with zoom and developer tools** (AC: 1.4)
  - [ ] Add "Reload" with accelerator 'CmdOrCtrl+R', role: 'reload'
  - [ ] Add "Toggle DevTools" with accelerator 'CmdOrCtrl+Shift+I', role: 'toggleDevTools'
  - [ ] Conditionally enable DevTools only in development builds
  - [ ] Add separator
  - [ ] Add "Actual Size" with accelerator 'CmdOrCtrl+0', role: 'resetZoom'
  - [ ] Add "Zoom In" with accelerator 'CmdOrCtrl+Plus', role: 'zoomIn'
  - [ ] Add "Zoom Out" with accelerator 'CmdOrCtrl+-', role: 'zoomOut'
  - [ ] Add separator
  - [ ] Add "Toggle Fullscreen" with accelerator 'F11', role: 'togglefullscreen'
  - [ ] Test zoom range enforcement (80%-200%)

- [ ] **Task 5: Implement Window menu with platform-specific items** (AC: 1.5)
  - [ ] Add "Minimize" with accelerator 'CmdOrCtrl+M', role: 'minimize'
  - [ ] Add "Close" with accelerator 'CmdOrCtrl+W', role: 'close'
  - [ ] For macOS only: Add separator and "Bring All to Front", role: 'front'
  - [ ] Test platform-specific menu items appear correctly

- [ ] **Task 6: Implement Help menu with external links** (AC: 1.6)
  - [ ] Add "Documentation" item with click handler to open docs.holokai.com via shell.openExternal()
  - [ ] Add "Report Issue" item with click handler to open GitHub issues URL
  - [ ] Add separator
  - [ ] Add "About Holokai" item with click handler to send IPC event 'menu:show-about'
  - [ ] Create About dialog component in renderer (name, version, copyright, license)
  - [ ] Test external URLs open in default browser

- [ ] **Task 7: Add macOS app menu** (AC: 1.1, 1.2)
  - [ ] Detect macOS platform with `process.platform === 'darwin'`
  - [ ] Unshift app menu to beginning of template array
  - [ ] Add "About {app.name}" with role: 'about'
  - [ ] Add separator
  - [ ] Add "Settings" with accelerator 'CmdOrCtrl+,' and IPC handler 'menu:settings'
  - [ ] Add separator
  - [ ] Add "Hide Holokai" with accelerator 'Command+H', role: 'hide'
  - [ ] Add "Hide Others" with accelerator 'Command+Alt+H', role: 'hideOthers'
  - [ ] Add "Show All" with role: 'unhide'
  - [ ] Add separator
  - [ ] Add "Quit" with accelerator 'Command+Q', role: 'quit'
  - [ ] Test macOS app menu appears in correct position

- [ ] **Task 8: Implement IPC handlers for menu actions** (AC: 1.2, 1.6)
  - [ ] Create IPC handler for 'menu:new-thread' in main process
  - [ ] Send IPC message to renderer to create new thread via ThreadStore
  - [ ] Create IPC handler for 'menu:show-about' to display About dialog
  - [ ] Create IPC handler for 'menu:settings' to navigate to Settings view
  - [ ] Test IPC events trigger correct renderer actions

- [ ] **Task 9: Write unit tests for MenuService** (AC: All)
  - [ ] Test `createMenu()` builds menu with all required sections
  - [ ] Test platform-specific menu structure (macOS vs Windows/Linux)
  - [ ] Test menu click handlers trigger correct IPC events
  - [ ] Test menu roles assigned correctly (undo, redo, cut, copy, paste, etc.)
  - [ ] Mock `Menu.buildFromTemplate()` and `Menu.setApplicationMenu()`

- [ ] **Task 10: Write E2E tests for menu bar workflow** (AC: All)
  - [ ] Test launch app and verify menu bar visible
  - [ ] Test File > New Thread creates new thread
  - [ ] Test Cmd+N keyboard shortcut creates new thread
  - [ ] Test Edit menu commands (Cut, Copy, Paste) work in text inputs
  - [ ] Test View > Zoom In/Out adjusts zoom level
  - [ ] Test Help > Documentation opens external URL in browser
  - [ ] Test About dialog displays correctly with app info

## Dev Notes

### Architecture Patterns

**Main Process Architecture** (Architecture §2.2):
- MenuService runs in Electron main process with access to Node.js APIs
- Uses `Menu.buildFromTemplate()` and `Menu.setApplicationMenu()` for native menu creation
- Platform detection via `process.platform` (darwin, win32, linux) for platform-specific menus
- Menu actions communicate with renderer via IPC events (`ipcMain.send()`)

**IPC Communication Pattern** (Architecture §3):
- Menu clicks trigger IPC events sent to renderer process
- Channel naming convention: `menu:{action}` (e.g., 'menu:new-thread', 'menu:show-about')
- Renderer listens via context bridge exposed API (`electronAPI.menu.onAction`)
- Flow: User clicks menu → Main process handler → IPC send → Renderer receives → UI update

**Security Considerations** (Architecture §5):
- All menu templates statically defined (no user-controlled labels or actions)
- External URLs opened via `shell.openExternal()` (sanitized by Electron)
- IPC channels use predefined whitelist (no dynamic channel registration)
- Menu actions respect Content Security Policy (no eval or inline scripts)

### Component References

**New Components to Create**:
- `src/main/services/MenuService.ts` - Main process menu management service
- `src/renderer/components/AboutDialog.svelte` - About dialog component

**Components to Modify**:
- `src/main.ts` - Initialize MenuService on app.ready event
- `src/preload.ts` - Expose menu IPC API via context bridge
- `src/renderer/lib/stores/threadStore.ts` - Add handler for IPC 'menu:new-thread' event

**IPC Handlers to Add**:
- Main → Renderer: `menu:new-thread`, `menu:show-about`, `menu:settings`
- Context Bridge: `electronAPI.menu.onAction(callback)`

### Testing Standards

**Unit Tests** (tests/unit/):
- Test MenuService menu creation with correct structure
- Test platform-specific menu additions (macOS app menu)
- Test menu click handlers trigger IPC events
- Mock Electron Menu API and IPC handlers

**Integration Tests** (tests/integration/):
- Test menu click → IPC event → renderer action flow
- Test ThreadStore receives and handles 'menu:new-thread' event
- Test About dialog opens and displays correct app info

**E2E Tests** (tests/e2e/):
- Launch app and verify menu bar visible with all menus
- Click File > New Thread and verify new thread created
- Press Cmd+N and verify keyboard shortcut creates thread
- Test Edit menu commands (Cut/Copy/Paste) in text input
- Test View > Zoom In increases zoom level
- Test Help > Documentation opens external browser
- Test macOS-specific menu items appear on macOS platform

### Electron Menu API Notes

**Menu Template Structure**:
```typescript
interface MenuTemplate {
  label: string;              // Menu item label
  submenu?: MenuTemplate[];   // Nested submenu items
  role?: string;              // Built-in Electron role (undo, redo, quit, etc.)
  accelerator?: string;       // Keyboard shortcut (e.g., 'CmdOrCtrl+N')
  click?: () => void;         // Click handler function
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio';
  enabled?: boolean;          // Enable/disable menu item
}
```

**Built-in Roles** (Electron documentation):
- Edit: `undo`, `redo`, `cut`, `copy`, `paste`, `selectAll`
- Window: `minimize`, `close`, `quit`, `reload`, `toggleDevTools`, `togglefullscreen`
- Zoom: `resetZoom`, `zoomIn`, `zoomOut`
- macOS: `about`, `hide`, `hideOthers`, `unhide`, `front`

**Platform-Specific Shortcuts**:
- Use `CmdOrCtrl` for cross-platform shortcuts (Cmd on macOS, Ctrl on Windows/Linux)
- macOS-specific: `Command+H` (hide), `Command+Alt+H` (hide others)
- Test shortcuts respect user's keyboard layout

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-8.md§Detailed Design - MenuService API]
- [Source: docs/sprint-artifacts/tech-spec-epic-8.md§Acceptance Criteria - E8-S1]
- [Source: docs/epics-and-stories-2025-11-25.md§Epic 8 - E8-S1: Application Menu Bar]
- [Source: docs/architecture.md§IPC Communication]
- [Source: docs/architecture.md§Main Process Components]
- [Source: Electron Menu API Documentation: https://www.electronjs.org/docs/latest/api/menu]
- [Source: Electron MenuItem API: https://www.electronjs.org/docs/latest/api/menu-item]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e8-s1-application-menu-bar.context.xml

- docs/sprint-artifacts/e8-s1-application-menu-bar.context.xml



### Agent Model Used

_To be filled by Dev agent_

### Debug Log References

_To be filled by Dev agent during implementation_

### Completion Notes List

_To be filled by Dev agent upon completion_

### File List

_To be filled by Dev agent with NEW, MODIFIED, DELETED file paths_

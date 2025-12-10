# Story 8.2: System Tray

Status: ready-for-dev

## Story

As a **Holokai Desktop user**,
I want **a system tray icon with quick actions and connection status indicators**,
so that **I can quickly access the application, monitor connection status at a glance, and perform common actions without opening the main window**.

## Acceptance Criteria

1. **AC-2.1**: System tray icon displays in platform tray with three status states (connected: green, disconnected: gray, syncing: blue)
   - Icon renders at correct size (16x16 macOS template, 16x16 Windows ICO, 22x22 Linux PNG)
   - Icon color updates within 500ms of connection status change

2. **AC-2.2**: Tray icon tooltip shows connection status and unread notification count
   - Tooltip format: "Holokai Desktop - Connected" or "Holokai Desktop - 3 unread notifications"
   - Tooltip updates immediately on status or count change

3. **AC-2.3**: Tray menu includes Show/Hide Window, New Thread, Settings, Quit actions
   - Show/Hide toggles main window visibility (restores window position)
   - New Thread opens app if hidden and creates thread
   - Settings opens Settings dialog
   - Quit terminates app

4. **AC-2.4**: Double-clicking tray icon shows/hides main window
   - First double-click shows window and focuses it
   - Second double-click hides window (minimizes to tray)
   - Window state preserved across show/hide cycles

5. **AC-2.5**: macOS tray icon uses Template image format for automatic dark mode support
   - Icon inverts color in dark mode automatically
   - Icon matches system tray appearance guidelines

## Tasks / Subtasks

- [ ] Create TrayService in main process (AC: 2.1, 2.3, 2.4, 2.5)
  - [ ] Create `src/main/services/TrayService.ts` file
  - [ ] Import Electron Tray, Menu, nativeImage classes
  - [ ] Define TrayStatus interface (status: 'connected' | 'disconnected' | 'syncing', tooltip: string, unreadCount?: number)
  - [ ] Implement singleton pattern for TrayService instance
  - [ ] Add dependency injection for IPC handler

- [ ] Implement tray icon initialization (AC: 2.1, 2.5)
  - [ ] Create `createTray()` method
  - [ ] Design icon assets for three states (connected-green, disconnected-gray, syncing-blue)
  - [ ] Store icon paths in iconPaths property (connected, disconnected, syncing)
  - [ ] Handle macOS template image format (nativeImage.createFromPath().resize({ width: 16, height: 16 }))
  - [ ] Handle Windows ICO format (16x16)
  - [ ] Handle Linux PNG format (22x22)
  - [ ] Initialize tray on app ready event
  - [ ] Set initial tooltip "Holokai Desktop - Connected"

- [ ] Implement connection status updates (AC: 2.1, 2.2)
  - [ ] Create `updateStatus(status: TrayStatus)` method
  - [ ] Update tray icon based on status.status (setImage with correct iconPath)
  - [ ] Update tooltip based on status.tooltip (setToolTip)
  - [ ] Handle unreadCount for Windows (setTitle with badge count)
  - [ ] Ensure icon change completes within 500ms

- [ ] Create tray context menu (AC: 2.3)
  - [ ] Define tray menu template using Menu.buildFromTemplate()
  - [ ] Add "Show Holokai" menu item with click handler
  - [ ] Add "New Thread" menu item with accelerator (CmdOrCtrl+N) and click handler
  - [ ] Add separator
  - [ ] Add "Settings" menu item with click handler
  - [ ] Add separator
  - [ ] Add "Quit" menu item with click handler (app.quit())
  - [ ] Set context menu with tray.setContextMenu()

- [ ] Implement tray menu actions via IPC (AC: 2.3)
  - [ ] Create IPC event 'tray:show-window' for Show/Hide action
  - [ ] Create IPC event 'tray:new-thread' for New Thread action
  - [ ] Create IPC event 'tray:settings' for Settings action
  - [ ] Create IPC event 'tray:toggle-window' for double-click handler
  - [ ] Send IPC events from TrayService click handlers
  - [ ] Handle IPC events in main process to communicate with renderer

- [ ] Implement show/hide window functionality (AC: 2.3, 2.4)
  - [ ] Create handler for 'tray:show-window' IPC event
  - [ ] Restore window if minimized (window.restore())
  - [ ] Show window if hidden (window.show())
  - [ ] Focus window (window.focus())
  - [ ] Store window position before hiding
  - [ ] Restore window position on show
  - [ ] Handle case where app is hidden vs minimized

- [ ] Implement double-click toggle behavior (AC: 2.4)
  - [ ] Register 'double-click' event listener on tray
  - [ ] Check current window visibility state
  - [ ] Toggle: if visible → hide, if hidden → show
  - [ ] Send 'tray:toggle-window' IPC event
  - [ ] Preserve window state (position, size) across cycles

- [ ] Implement New Thread tray action (AC: 2.3)
  - [ ] Handle 'tray:new-thread' IPC event
  - [ ] Check if window is hidden; if so, show window first
  - [ ] Trigger thread creation via ThreadService
  - [ ] Focus message input after thread created
  - [ ] Navigate to new thread view

- [ ] Implement Settings tray action (AC: 2.3)
  - [ ] Handle 'tray:settings' IPC event
  - [ ] Show window if hidden
  - [ ] Navigate to Settings view
  - [ ] Focus settings panel

- [ ] Expose tray APIs via IPC context bridge (AC: 2.1, 2.2)
  - [ ] Add tray namespace to electronAPI in preload.ts
  - [ ] Expose `electronAPI.tray.onShowWindow(callback)` for IPC events
  - [ ] Expose `electronAPI.tray.onNewThread(callback)` for IPC events
  - [ ] Expose `electronAPI.tray.onSettings(callback)` for IPC events
  - [ ] Expose `electronAPI.tray.onToggleWindow(callback)` for IPC events
  - [ ] Expose `electronAPI.tray.updateStatus(status: TrayStatus)` for status updates from renderer

- [ ] Integrate TrayService with ConnectionManager (AC: 2.1, 2.2)
  - [ ] Subscribe to ConnectionManager status change events
  - [ ] Map connection status to TrayStatus (connected, disconnected, syncing)
  - [ ] Call TrayService.updateStatus() on connection status change
  - [ ] Update tooltip text based on connection status

- [ ] Integrate TrayService with NotificationService (AC: 2.2)
  - [ ] Subscribe to unread notification count changes
  - [ ] Update TrayStatus.unreadCount property
  - [ ] Update tooltip format to include unread count if > 0
  - [ ] Call TrayService.updateStatus() on notification count change

- [ ] Handle tray cleanup on app quit (AC: 2.3)
  - [ ] Register 'before-quit' event listener
  - [ ] Call tray.destroy() to remove tray icon
  - [ ] Unregister all IPC listeners
  - [ ] Clean up TrayService instance

- [ ] Add unit tests for TrayService (AC: All)
  - [ ] Test createTray() initializes tray with correct icon
  - [ ] Test updateStatus() updates icon and tooltip
  - [ ] Test menu click handlers send correct IPC events
  - [ ] Test double-click toggles window visibility
  - [ ] Test platform-specific icon formats (macOS template, Windows ICO, Linux PNG)
  - [ ] Test tooltip format with and without unread count
  - [ ] Test tray cleanup on app quit

- [ ] Add integration tests for tray actions (AC: 2.3, 2.4)
  - [ ] Test Show/Hide toggles window visibility
  - [ ] Test New Thread creates thread and shows window
  - [ ] Test Settings opens settings view
  - [ ] Test Quit terminates app
  - [ ] Test double-click handler toggles window
  - [ ] Test window position preserved across show/hide cycles

- [ ] Add E2E tests for system tray (AC: All)
  - [ ] Launch app and verify tray icon visible
  - [ ] Disconnect network and verify icon changes to gray
  - [ ] Reconnect and verify icon changes to green
  - [ ] Double-click tray icon and verify window hides
  - [ ] Double-click again and verify window shows
  - [ ] Right-click tray and verify menu opens
  - [ ] Click "New Thread" and verify thread created

## Dev Notes

### Electron Tray API Patterns

**Tray Initialization:**
- Use `new Tray(icon)` to create tray instance
- Icon path must be absolute path to image file
- macOS: Use `nativeImage.createFromPath()` with Template suffix for dark mode support
- Windows: Use ICO format for best compatibility
- Linux: Use PNG format with appropriate size (22x22 recommended)

**Platform-Specific Icon Handling:**
```typescript
// macOS: Template image for automatic dark mode
const icon = process.platform === 'darwin'
  ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  : iconPath;
```

**Context Menu Pattern:**
- Use `Menu.buildFromTemplate()` to create menu from template array
- Set with `tray.setContextMenu(menu)`
- Menu items use same template structure as application menu
- Accelerators displayed but not registered globally (app must be focused)

**Event Handling:**
- `tray.on('click')` - Single click (platform-specific behavior)
- `tray.on('double-click')` - Double-click (recommended for show/hide)
- `tray.on('right-click')` - Right-click (opens context menu automatically)

**Dynamic Updates:**
- Call `tray.setImage(newIconPath)` to change icon
- Call `tray.setToolTip(text)` to update tooltip
- Call `tray.setContextMenu(newMenu)` to update menu
- Updates are synchronous and immediate

### Cross-Platform Considerations

**macOS:**
- System tray called "Menu Bar Status Item"
- Icons should be monochrome Template images (automatically inverts in dark mode)
- Recommended size: 16x16 points (@2x for Retina: 32x32 pixels)
- Template image naming: `icon-Template.png`
- Status bar height: 22pt (44px @2x)

**Windows:**
- System tray called "Notification Area"
- Icons should be ICO format for best results
- Recommended size: 16x16 pixels
- Can set badge overlay with `tray.setTitle()` for notification counts
- Tray icon can display tooltip on hover

**Linux:**
- System tray called "System Tray" or "Notification Area" (varies by DE)
- Icons should be PNG format
- Recommended size: 22x22 pixels (varies by desktop environment)
- Some desktop environments (GNOME) may not show tray icons by default
- May require extensions or configuration to enable system tray

### IPC Communication Flow

**Status Update Flow:**
```
ConnectionManager → TrayService.updateStatus() → tray.setImage() → Visual update in system tray
```

**Tray Action Flow:**
```
User clicks tray menu item → TrayService click handler → ipcHandler.send('tray:action') → Main process IPC handler → Renderer IPC listener → UI action
```

**Double-Click Flow:**
```
User double-clicks tray → tray 'double-click' event → ipcHandler.send('tray:toggle-window') → Main process → window.show() or window.hide()
```

### Icon Design Requirements

**Three State Icons Needed:**
1. **Connected (Green)**: Indicates successful connection to backend
2. **Disconnected (Gray)**: Indicates no connection or offline
3. **Syncing (Blue)**: Indicates active data synchronization

**Design Guidelines:**
- Simple, recognizable shape (Holokai logo or "H" monogram)
- Monochrome for macOS (Template image)
- Color variants for Windows/Linux
- Clear visual distinction between states
- Readable at 16x16 pixels

### Window State Management

**Show/Hide Behavior:**
- Track window visibility state in main process
- Store window bounds before hiding (`window.getBounds()`)
- Restore bounds when showing (`window.setBounds(bounds)`)
- Handle edge case: window moved to different screen while hidden

**Focus Management:**
- Always call `window.focus()` after showing window
- Restore keyboard focus to last focused element in renderer
- Handle case where app is fully quit vs just hidden

### Connection Status Integration

**Status Mapping:**
- `ConnectionManager.connected` → TrayStatus.status = 'connected'
- `ConnectionManager.disconnected` → TrayStatus.status = 'disconnected'
- `ConnectionManager.syncing` → TrayStatus.status = 'syncing'

**Tooltip Format:**
- Connected: "Holokai Desktop - Connected"
- Disconnected: "Holokai Desktop - Offline"
- Syncing: "Holokai Desktop - Syncing..."
- With notifications: "Holokai Desktop - Connected (3 unread)"

### Error Handling

**Icon Load Failure:**
- Provide fallback icon if primary icon fails to load
- Log error with icon path for debugging
- Continue app operation even if tray icon unavailable

**Menu Action Failure:**
- Wrap IPC send calls in try-catch
- Log errors but don't crash app
- Show error toast to user if action fails

**Platform Unavailability:**
- Check if tray is supported on current platform (`Tray.isSupported()`)
- Gracefully degrade if tray not available (log warning, continue without tray)
- Provide alternative access methods (dock/taskbar icon, CLI)

### Testing Considerations

**Manual Testing Checklist:**
- [ ] Verify icon visible on macOS, Windows, Linux
- [ ] Verify icon changes color on connection status change
- [ ] Verify tooltip shows correct text
- [ ] Verify menu opens on right-click (Windows/Linux) and left-click (macOS)
- [ ] Verify all menu actions work
- [ ] Verify double-click toggles window visibility
- [ ] Verify window position preserved across show/hide
- [ ] Verify macOS dark mode icon inversion
- [ ] Verify Windows notification badge shows unread count

**Automated Testing Strategy:**
- Unit tests: TrayService methods (createTray, updateStatus, menu handlers)
- Integration tests: IPC communication between tray and renderer
- E2E tests: Full user flows (tray click → action → UI update)
- Platform-specific tests: Run on each OS to verify icon rendering

### Architecture Alignment

**Component Location:**
- `src/main/services/TrayService.ts` - Main process service class
- `src/main/ipc/tray-handlers.ts` - IPC event handlers
- `assets/tray-icons/` - Icon assets directory (connected.png, disconnected.png, syncing.png)

**Dependencies:**
- Electron Tray API (Tray, Menu, nativeImage)
- ConnectionManager for status events
- NotificationService for unread count
- IPC handler for communication with renderer

**State Management:**
- Tray state (icon, tooltip, menu) managed in TrayService
- Window visibility state managed in main process (BrowserWindow)
- Connection status managed in ConnectionManager
- Notification count managed in NotificationService

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-8.md#E8-S2-System-Tray] - Technical specification for system tray implementation
- [Source: docs/epics-and-stories-2025-11-25.md#E8-S2] - Epic story definition and tasks
- [Source: docs/architecture.md#Multi-Process-Electron-Architecture] - Electron main process architecture
- [Source: Electron Tray API Documentation] - https://www.electronjs.org/docs/latest/api/tray
- [Source: Electron Menu API Documentation] - https://www.electronjs.org/docs/latest/api/menu

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e8-s2-system-tray.context.xml

- docs/sprint-artifacts/e8-s2-system-tray.context.xml



### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

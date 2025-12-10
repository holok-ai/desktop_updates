# Story 4.1: Notification System

Status: ready-for-dev

## Story

As a desktop user,
I want to receive system and in-app notifications,
so that I'm informed of important events even when the app is in the background.

## Acceptance Criteria

1. System notifications appear in OS notification center (CORE §8.1)
2. Toasts appear in-app with auto-dismiss after configurable duration (default 3s) (CORE §8.2)
3. Notification history accessible with last N notifications stored (e.g., 50) (CORE §8.3)
4. Settings persist across sessions (enable/disable, sound, types filter) (CORE §8.4)
5. Clicking system notification brings app to focus
6. Multiple concurrent toasts supported without overlap
7. Toasts styled by type (info=blue, success=green, warning=orange, error=red)
8. Notification settings respect OS notification permissions

## Tasks / Subtasks

- [ ] Create NotificationService in main process (AC: #1, #5, #8)
  - [ ] Create `src-electron/services/notification.service.ts`
  - [ ] Use Electron's Notification API for system notifications
  - [ ] Define NotificationPayload interface: {title, body, icon?, type, data?}
  - [ ] Implement showSystemNotification(payload) method
  - [ ] Handle notification click event → focus app window
  - [ ] Check OS notification permissions before showing
  - [ ] Expose service via IPC to renderer process

- [ ] Implement in-app toast system (AC: #2, #6, #7)
  - [ ] Create `src/components/Toast.svelte` component
  - [ ] Create `src/components/ToastContainer.svelte` for positioning
  - [ ] Create notificationStore (Svelte store) for toast state management
  - [ ] Support toast types: info, success, warning, error
  - [ ] Auto-dismiss after duration (default 3000ms, configurable)
  - [ ] Add manual dismiss button (X icon)
  - [ ] Style toasts by type with appropriate colors and icons
  - [ ] Position toasts in top-right corner (or configurable)
  - [ ] Stack multiple toasts vertically with animations
  - [ ] Add enter/exit transitions (slide in from right)

- [ ] Implement notification history (AC: #3)
  - [ ] Create notificationHistoryStore (writable store)
  - [ ] Store last 50 notifications with: {id, timestamp, type, title, message, read}
  - [ ] Add addNotification(notification) method
  - [ ] Add markAsRead(id) method
  - [ ] Add clearAll() method
  - [ ] Persist history to electron-store (optional, for cross-session)
  - [ ] Create NotificationHistory.svelte page/panel
  - [ ] Display notifications in reverse chronological order
  - [ ] Show unread count badge

- [ ] Create notification settings UI (AC: #4)
  - [ ] Add Notifications section to Settings page
  - [ ] Toggle: Enable system notifications (default: true)
  - [ ] Toggle: Enable sound (default: false)
  - [ ] Toggle: Enable in-app toasts (default: true)
  - [ ] Checkboxes: Filter notification types (info, success, warning, error)
  - [ ] Persist settings in StateStore
  - [ ] Apply settings to NotificationService (check before showing)

- [ ] Integrate with application events (AC: #1, #2)
  - [ ] Show notification on new message received (if not active window)
  - [ ] Show notification on workflow execution complete
  - [ ] Show notification on file upload complete
  - [ ] Show toast on error conditions (API failures, network issues)
  - [ ] Show toast on success actions (project created, member added)

- [ ] Write tests for notification system (AC: #1-#8)
  - [ ] Unit test: NotificationService.showSystemNotification() calls Electron API
  - [ ] Unit test: Toast auto-dismiss after duration
  - [ ] Unit test: Notification history stores last 50 items
  - [ ] Integration test: Click system notification focuses app
  - [ ] Integration test: Settings persist and apply correctly
  - [ ] E2E test: Display toast and verify auto-dismiss

## Dev Notes

### Architecture Patterns and Constraints

**Two-Layer Notification System:**
- **System notifications:** OS-level via Electron Notification API (background notifications)
- **Toast notifications:** In-app via Svelte components (foreground notifications)
- Use system notifications when app is not focused, toasts when focused

**Electron Notification API:**
- Main process creates Notification instances
- Renderer requests notifications via IPC
- Handle OS permissions (notifications can be disabled by user)
- macOS: Notifications appear in Notification Center
- Windows: Notifications appear in Action Center
- Linux: Depends on desktop environment (libnotify)

**Toast Component Architecture:**
- ToastContainer: Fixed position wrapper (top-right corner)
- Toast: Individual toast component with type styling
- notificationStore: Central state management for active toasts
- Auto-removal via setTimeout (cleared on manual dismiss)

**Notification History:**
- In-memory store (last 50 notifications)
- Optional persistence to electron-store for cross-session
- Mark-as-read pattern for UI badges

### Project Structure Notes

**File Locations (Desktop - Electron + Svelte):**
- `src-electron/services/notification.service.ts` - Main process notification service
- `src/services/NotificationService.ts` - Renderer process wrapper (IPC calls)
- `src/components/Toast.svelte` - Individual toast component
- `src/components/ToastContainer.svelte` - Toast container/manager
- `src/stores/notificationStore.ts` - Toast state store
- `src/stores/notificationHistoryStore.ts` - Notification history store
- `src/pages/Settings/Notifications.svelte` - Settings UI

**Dependencies:**
- electron: 39.x (Notification API)
- svelte: 5.x (components and stores)
- electron-store: 11.x (settings persistence)

### Testing Framework

**Unit Tests (Vitest):**
- NotificationService methods (mock Electron Notification)
- Toast component rendering and auto-dismiss
- Store logic (add, mark-as-read, clear)

**Integration Tests:**
- IPC communication between main and renderer
- Settings persistence and retrieval

**E2E Tests (Playwright):**
- Display system notification and verify OS notification center
- Display toast and verify auto-dismiss timing
- Navigate to notification history and verify entries

### References

- [Source: docs/epics-and-stories-2025-11-25.md §E4-S1]
- [Source: docs/sprint-artifacts/tech-spec-epic-4.md (if exists)]
- [Source: docs/architecture-2025-11-25.md §2.2 Process Architecture - NotificationService]

### Learnings from Previous Stories

**This is the first story in Epic 4** - No predecessor context in this epic.

**From Epic 1 patterns:**
- Use service layer pattern (NotificationService)
- Use IPC for main ↔ renderer communication
- Persist settings in electron-store

## Dev Agent Record

### Context Reference
- [Story Context XML](e4-s1-notification-system.context.xml)

### Agent Model Used

<!-- To be filled by dev agent during implementation -->

### Debug Log References

<!-- To be filled by dev agent during implementation -->

### Completion Notes List

<!-- To be filled by dev agent during implementation -->

### File List

<!-- To be filled by dev agent during implementation -->

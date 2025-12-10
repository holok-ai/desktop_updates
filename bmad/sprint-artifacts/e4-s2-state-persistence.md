# Story 4.2: State Persistence

Status: ready-for-dev

## Story

As a desktop user,
I want the application to remember my window position, sidebar state, and preferences,
so that my workspace layout persists across sessions.

## Acceptance Criteria

1. Window opens at last position and size (CORE §9.1)
2. Sidebar collapse/expand state remembered (CORE §9.1)
3. Theme preference remembered (light/dark/system) (CORE §9.2)
4. Last active project/thread restored on app launch (CORE §9.2)
5. Old state formats automatically migrated to new versions (CORE §9.4)
6. Corrupt state handled gracefully (reset to defaults, log error)
7. Multi-monitor changes handled (window stays visible on available screens)
8. State changes debounced to avoid excessive disk writes

## Tasks / Subtasks

- [ ] Create StateStore service with electron-store (AC: #1-#8)
  - [ ] Create `src-electron/services/state-store.service.ts`
  - [ ] Use electron-store for persistent key-value storage
  - [ ] Define StateSchema interface with typed fields
  - [ ] Implement get(key), set(key, value), delete(key), clear() methods
  - [ ] Add state versioning: {version: number, data: StateSchema}
  - [ ] Implement migration system for state schema changes
  - [ ] Handle corrupt state: catch parse errors, reset to defaults, log warning
  - [ ] Expose via IPC for renderer access

- [ ] Implement window state persistence (AC: #1, #7, #8)
  - [ ] Listen to window 'resize' and 'move' events in main process
  - [ ] Debounce state save (500ms delay after last change)
  - [ ] Save window bounds: {x, y, width, height, isMaximized, isFullScreen}
  - [ ] On app launch: Restore window position if within available screens
  - [ ] Handle multi-monitor: Check if saved position is on available display
  - [ ] Fallback: Center window if saved position offscreen
  - [ ] Respect minimized/maximized state
  - [ ] Write unit test: Window position saved after debounce delay
  - [ ] Write unit test: Offscreen position falls back to center

- [ ] Implement sidebar state persistence (AC: #2)
  - [ ] Save sidebar collapsed state (boolean)
  - [ ] Save sidebar width (if resizable, in pixels)
  - [ ] Save expanded sections (array of section IDs)
  - [ ] Create sidebarStore (Svelte store) synced with StateStore
  - [ ] Subscribe to store changes, save to StateStore
  - [ ] Restore sidebar state on app launch
  - [ ] Write unit test: Sidebar state persists correctly

- [ ] Implement user preferences persistence (AC: #3, #4)
  - [ ] Save theme preference: 'light' | 'dark' | 'system'
  - [ ] Save font size: 'small' | 'medium' | 'large'
  - [ ] Save default LLM model selection
  - [ ] Save notification preferences (from E4-S1)
  - [ ] Save last active project ID
  - [ ] Save last active thread ID
  - [ ] Create preferencesStore (Svelte store) synced with StateStore
  - [ ] Subscribe to preference changes, save immediately (no debounce)
  - [ ] Restore preferences on app launch
  - [ ] Apply theme on startup before UI renders

- [ ] Implement state versioning and migration (AC: #5, #6)
  - [ ] Add STATE_VERSION constant (increment on schema changes)
  - [ ] On load: Check current version vs. stored version
  - [ ] Define migration functions: migrateV1ToV2(), migrateV2ToV3(), etc.
  - [ ] Run migrations sequentially (v1→v2→v3→current)
  - [ ] Log each migration: "Migrating state from v1 to v2"
  - [ ] Handle migration failures: Reset to defaults, log error
  - [ ] Add version to stored state: {version: 3, windowState: {...}, preferences: {...}}
  - [ ] Write unit test: Migration from v1 to v2 adds new fields with defaults
  - [ ] Write unit test: Corrupt state resets to defaults

- [ ] Add state export/import utilities (Optional)
  - [ ] Add exportState() method (JSON file export)
  - [ ] Add importState(json) method with validation
  - [ ] Useful for debugging, user data portability
  - [ ] Add to developer/advanced settings menu

## Dev Notes

### Architecture Patterns and Constraints

**electron-store Library:**
- Simple key-value store backed by JSON file
- Location: `~/.config/holokai-desktop/config.json` (Linux/Mac) or `%APPDATA%\holokai-desktop\config.json` (Windows)
- Synchronous API (blocking) - acceptable for small state objects
- Atomic writes prevent corruption

**Debouncing Strategy:**
- Window resize/move events fire frequently (every frame during drag)
- Debounce saves to reduce disk I/O (500ms delay)
- Preferences saved immediately (infrequent changes, user expects instant save)

**State Migration Pattern:**
```typescript
interface StateMigration {
  from: number;
  to: number;
  migrate: (oldState: any) => any;
}

const migrations: StateMigration[] = [
  { from: 1, to: 2, migrate: (s) => ({...s, newField: 'default'}) },
  { from: 2, to: 3, migrate: (s) => ({...s, renamedField: s.oldField}) }
];
```

**Multi-Monitor Handling:**
- screen.getAllDisplays() returns available displays
- Check if saved {x, y} is within any display bounds
- If offscreen: Center on primary display

### Project Structure Notes

**File Locations:**
- `src-electron/services/state-store.service.ts` - Main process state management
- `src/stores/sidebarStore.ts` - Renderer sidebar state (synced with StateStore)
- `src/stores/preferencesStore.ts` - Renderer preferences (synced with StateStore)
- `src/utils/stateMigrations.ts` - Version migration functions

**State Schema:**
```typescript
interface StateSchema {
  version: number;
  windowState: {
    x: number;
    y: number;
    width: number;
    height: number;
    isMaximized: boolean;
    isFullScreen: boolean;
  };
  sidebarState: {
    collapsed: boolean;
    width: number;
    expandedSections: string[];
  };
  preferences: {
    theme: 'light' | 'dark' | 'system';
    fontSize: 'small' | 'medium' | 'large';
    defaultModel: string;
    lastActiveProjectId?: string;
    lastActiveThreadId?: string;
  };
}
```

### Testing Framework

**Unit Tests:**
- StateStore get/set/delete operations
- Debounce logic (verify save delayed by 500ms)
- Migration functions (v1→v2, v2→v3)
- Corrupt state handling (reset to defaults)

**Integration Tests:**
- Window position saved and restored
- Preferences persist across app restarts
- Multi-monitor fallback (mock offscreen position)

### References

- [Source: docs/epics-and-stories-2025-11-25.md §E4-S2]
- [Source: docs/architecture-2025-11-25.md §2.2 - StateStore]

### Learnings from Previous Stories

**From E4-S1:**
- Use electron-store for persistence
- IPC pattern for main ↔ renderer communication
- Svelte stores for reactive state management

## Dev Agent Record

### Context Reference
- [Story Context XML](e4-s2-state-persistence.context.xml)

### Agent Model Used

<!-- To be filled by dev agent during implementation -->

### Debug Log References

<!-- To be filled by dev agent during implementation -->

### Completion Notes List

<!-- To be filled by dev agent during implementation -->

### File List

<!-- To be filled by dev agent during implementation -->

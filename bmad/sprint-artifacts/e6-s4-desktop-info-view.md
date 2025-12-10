# Story 6.4: Desktop Info View

Status: ready-for-dev

## Story

As a desktop application user,
I want to view local cache statistics with per-project breakdown, storage usage, and application version info with cache management capabilities,
so that I can monitor local resource consumption and clear cache when needed.

## Acceptance Criteria

1. Cache stats display: cached thread count, cached message count, cached file count and size (overall totals)
2. Per-project breakdown table shows: project name, threads, messages, files, size for each project
3. Personal cache row shows personal (non-project) threads, messages, files, size separately
4. Projects sorted by storage size descending (largest projects first)
5. Storage usage display: breakdown by cache, database, logs with total and available disk space
6. Application version display: app version (from package.json), Electron version, OS/platform
7. "Clear Cache" button shows confirmation dialog before clearing
8. Optional: "Clear Cache for Project" button in per-project row for targeted cleanup
9. Cache clear operation completes and shows success toast
10. Stats refresh after cache clear (all counts reset to zero or project removed from list)
11. "Check for Updates" button triggers Electron auto-updater check

## Tasks / Subtasks

- [ ] **Task 1: Implement DesktopInfoTab Component (AC: 1-4)**
  - [ ] Create DesktopInfoTab.svelte component
  - [ ] Fetch cache stats via `insightsService.getCacheStats()`
  - [ ] Display overall cache totals: threads, messages, files, total size
  - [ ] Create CacheBreakdownTable component showing per-project rows
  - [ ] Show personal cache row separately
  - [ ] Sort projects by size descending

- [ ] **Task 2: Implement Storage Usage Display (AC: 5)**
  - [ ] Fetch storage usage via `insightsService.getStorageUsage()`
  - [ ] Display breakdown: cache, database, logs
  - [ ] Show total used and available disk space
  - [ ] Format sizes (bytes → KB/MB/GB)

- [ ] **Task 3: Implement Version Info (AC: 6)**
  - [ ] Display app version from package.json
  - [ ] Display Electron version
  - [ ] Display OS and platform
  - [ ] Add "Check for Updates" button

- [ ] **Task 4: Implement Cache Clear (AC: 7-10)**
  - [ ] Add "Clear Cache" button
  - [ ] Show confirmation dialog with impact message
  - [ ] Call `insightsService.clearCache()` on confirm
  - [ ] Show success toast
  - [ ] Re-fetch cache stats after clear

- [ ] **Task 5: Optional Per-Project Cache Clear (AC: 8)**
  - [ ] Add "Clear" button in each project row
  - [ ] Implement `clearProjectCache(projectId)` method
  - [ ] Confirm before clearing
  - [ ] Update table after clear

- [ ] **Task 6: Testing**
  - [ ] Unit test: Cache stats calculation
  - [ ] E2E test: Cache clear flow
  - [ ] Integration test: Storage usage query

## Dev Notes

See tech spec for CacheStats data model and implementation details.

### References

- [Tech Spec §4.1: Desktop Info View](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-6.md#services-and-modules)
- [Tech Spec §4.2: CacheStats Interface](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-6.md#data-models-and-contracts)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e6-s4-desktop-info-view.context.xml

- docs/sprint-artifacts/e6-s4-desktop-info-view.context.xml

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

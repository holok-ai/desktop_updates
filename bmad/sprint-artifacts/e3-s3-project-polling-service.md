# Story 3.3: Project Polling Service

Status: ready-for-dev

## Story

As a desktop application user,
I want the application to periodically check for project updates in the background,
so that I can see changes made by other team members without manually refreshing.

**NOTE:** This story was originally planned but has been **descoped from MVP** per Tech Spec Open Question #5. Manual refresh only in MVP. This story is retained for future Phase 3 implementation.

## Acceptance Criteria

**DESCOPED FROM MVP - Deferred to Phase 3**

The following ACs are for future reference only:

1. ~~ProjectPollingService starts background polling on app launch~~
2. ~~Polling checks for updates every 60 seconds (configurable interval)~~
3. ~~Polling fetches project list and compares timestamps with cached data~~
4. ~~If remote data is newer, invalidate cache and fetch fresh data~~
5. ~~Polling service auto-restarts if crash detected (watchdog timer)~~
6. ~~Polling cycle completes within 5 seconds~~
7. ~~Alert if polling cycle > 10s for 5 consecutive cycles~~

## Tasks / Subtasks

**DESCOPED FROM MVP - No tasks to implement**

This story exists for tracking purposes only. Implementation deferred to Phase 3 when WebSockets or auto-polling will be added.

## Dev Notes

### Decision: Manual Refresh Only in MVP (Tech Spec §9)

**Open Question #5 Resolution:**
- **DECISION:** Manual polling only (no auto-polling in MVP)
- **Decided by:** Architecture review (2025-11-27)
- **Rationale:** Simplifies MVP implementation; users can manually refresh when needed
- **Implementation:**
  - Remove ProjectPollingService from MVP scope (defer to Phase 3)
  - Add "Refresh" button in project sidebar and detail view
  - Refresh button invalidates cache and fetches fresh data from API
  - Future: Add auto-polling in Phase 3 when WebSockets implemented for real-time updates

### Manual Refresh Flow (Tech Spec §4.4)

1. User clicks "Refresh" button in project sidebar or detail view
2. ProjectService.refresh() invalidates all project caches
3. Fresh data fetched from Moku API: GET /api/projects, GET /api/projects/{id}/members
4. Cache updated with fresh data (new 5-minute TTL)
5. UI updates to show latest projects, members, threads
6. No automatic polling - refresh is always user-initiated

### Future Implementation (Phase 3)

When this story is re-activated in Phase 3, the following should be implemented:

**Option 1: Polling-Based Updates**
- Background service polls Moku API every 60s
- Compares project updatedAt timestamps with cached values
- Invalidates stale cache entries and fetches fresh data
- Watchdog timer restarts service on crash

**Option 2: WebSocket-Based Updates (Preferred)**
- WebSocket connection to Moku API for real-time updates
- Server pushes project change notifications to desktop
- Desktop invalidates cache and fetches fresh data on notification
- More efficient than polling (no unnecessary API calls)

### Risk Mitigation (Tech Spec §9)

**RISK:** Manual refresh only may cause users to see stale data
- **Impact:** Low-Medium - users must manually refresh to see changes from other devices
- **Mitigation:** MVP: Clear "Refresh" buttons visible in sidebar and detail view; Phase 3: Implement WebSockets for real-time updates; User education: notify users to refresh when collaborating

### Testing Strategy

**No tests required for MVP** - Story descoped

For Phase 3 implementation:
- Unit tests: Polling logic, timestamp comparison, watchdog timer
- Integration tests: Full polling cycle, cache invalidation
- Performance tests: Polling cycle duration (<5s), alert on >10s
- Reliability tests: Auto-restart on crash

### Dependencies

- **Descoped** - No dependencies in MVP
- **Future Dependency: WebSockets** - Phase 3 implementation may require WebSocket infrastructure

### References

- [Tech Spec: Epic 3 Project Collaboration](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md)
- [Tech Spec §9: Open Questions #5 (Manual refresh decision)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#open-questions)
- [Tech Spec §4.4: Manual Refresh Flow](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#workflows-and-sequencing)
- [Tech Spec §2: Out of Scope (Real-time updates deferred)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#objectives-and-scope)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e3-s3-project-polling-service.context.xml

### Agent Model Used

### Debug Log References

### Completion Notes List

**NOTE:** This story was descoped from MVP. No implementation work required. Story retained for future Phase 3 planning.

### File List

**No files created** - Story descoped from MVP

# Story 3.2: Project Cache

Status: ready-for-dev

## Story

As a desktop application developer,
I want an in-memory ProjectCache with TTL-based expiration and manual refresh,
so that project data can be retrieved quickly without repeated API calls while allowing users to fetch fresh data on demand.

## Acceptance Criteria

1. ProjectCache stores entries with TTL (default 5 minutes)
2. ProjectCache.get() returns cached data if not expired, null if expired
3. ProjectCache.set() stores data with expiration timestamp
4. ProjectCache.invalidate() removes specific cache entry
5. ProjectCache.invalidatePattern() removes all matching entries (e.g., 'projects:*')
6. Cache hit rate measured and logged
7. Memory usage stays <50MB for 1000 cached projects

## Tasks / Subtasks

- [ ] **Task 1: Implement Core Cache Structure (AC: 1-3)**
  - [ ] Create CacheEntry<T> interface with data, cachedAt, ttl, expiresAt fields
  - [ ] Create ProjectCacheStore interface with projects Map, members Map, lastPollTime
  - [ ] Implement ProjectCache class with in-memory Map storage
  - [ ] Implement set() method: store data with TTL and calculate expiresAt
  - [ ] Implement get() method: check expiration, return data or null
  - [ ] Add default TTL constant (300000ms = 5 minutes)

- [ ] **Task 2: Implement Cache Invalidation (AC: 4-5)**
  - [ ] Implement invalidate() method: remove single cache key
  - [ ] Implement invalidatePattern() method: pattern matching with wildcards
  - [ ] Implement clear() method: remove all cache entries
  - [ ] Add cascade invalidation helpers (e.g., invalidating project invalidates members)

- [ ] **Task 3: Implement Cache Metrics (AC: 6)**
  - [ ] Add hit/miss counters for cache operations
  - [ ] Implement getHitRate() method: calculate hit rate percentage
  - [ ] Add logging for cache operations (INFO level)
  - [ ] Expose metrics for observability (cache size, hit rate, memory usage)

- [ ] **Task 4: Implement Memory Management (AC: 7)**
  - [ ] Add memory tracking for cached entries
  - [ ] Implement memory usage calculation (estimate object size)
  - [ ] Add LRU eviction policy if memory exceeds threshold
  - [ ] Test with 1000 cached projects, verify <50MB usage

- [ ] **Task 5: Testing**
  - [ ] Unit test: TTL expiration logic (cache entry expires after TTL)
  - [ ] Unit test: Cache hit/miss scenarios
  - [ ] Unit test: Pattern matching for invalidation
  - [ ] Unit test: Cascade invalidation (project delete invalidates members)
  - [ ] Performance test: Lookup speed <10ms, memory usage <50MB for 1000 entries
  - [ ] Integration test: Cache integration with ProjectService

## Dev Notes

### Architecture Constraints

- **In-Memory Only**: Cache not persisted to disk (simplifies MVP, cleared on app restart)
- **TTL-Based Expiration**: Default 5 minutes, configurable per entry
- **Manual Refresh**: No automatic polling in MVP (user-initiated refresh only)
- **Read-Through Pattern**: Cache miss triggers API fetch in ProjectService

### Cache Entry Structure (Tech Spec §4.2)

```typescript
interface CacheEntry<T> {
  data: T;
  cachedAt: Date;
  ttl: number;            // milliseconds, default 300000 (5 min)
  expiresAt: Date;        // cachedAt + ttl
}

interface ProjectCacheStore {
  projects: Map<string, CacheEntry<Project>>;
  members: Map<string, CacheEntry<ProjectMember[]>>;  // key: projectId
  lastPollTime: Date;
}
```

### ProjectCache API (Tech Spec §4.3)

```typescript
interface IProjectCache {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, ttl?: number): void;
  invalidate(key: string): void;
  invalidatePattern(pattern: string): void;  // e.g., 'projects:*'
  clear(): void;
  getHitRate(): number;
  getMemoryUsage(): number;
}
```

### Cache Key Patterns

- **Projects**: `project:{projectId}` - Individual project
- **Project List**: `projects:list:{userId}` - User's project list
- **Members**: `members:{projectId}` - Project member list
- **Wildcard Invalidation**: `projects:*` - All project-related keys

### Performance Targets (Tech Spec §6.1)

- **Cache Lookup**: <10ms for any cached entity
- **Cache Hit Rate**: >90% for project/member lookups
- **Memory Footprint**: <50MB for 1000 cached projects
- **TTL**: 5 minutes default (configurable)

### Manual Refresh Flow (Tech Spec §4.4)

1. User clicks "Refresh" button
2. ProjectService.refresh() calls ProjectCache.invalidatePattern('projects:*')
3. Fresh data fetched from Moku API
4. Cache updated with new 5-minute TTL
5. UI updates with latest data

### Testing Strategy

- **Unit Tests**: TTL expiration, hit/miss, pattern matching, cascade invalidation
- **Performance Tests**: Lookup speed, memory usage with 100/500/1000 entries
- **Integration Tests**: Cache integration with ProjectService

### Dependencies

- **No blockers** - Standalone cache implementation
- **Used by: E3-S1 (ProjectService)** - Cache integrated into ProjectService

### References

- [Tech Spec: Epic 3 Project Collaboration](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md)
- [Tech Spec §4.2: Data Models (Cache Entry)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#data-models-and-contracts)
- [Tech Spec §4.3: APIs (ProjectCache API)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#apis-and-interfaces)
- [Tech Spec §6.1: Performance Requirements](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#performance)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e3-s2-project-cache.context.xml

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

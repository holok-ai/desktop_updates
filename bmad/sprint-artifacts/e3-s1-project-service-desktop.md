# Story 3.1: Project Service Desktop

Status: ready-for-dev

## Story

As a desktop application developer,
I want a ProjectService layer that handles CRUD operations, member management, and API coordination with the Moku API,
so that the desktop application can manage project collaboration features with proper caching, retry logic, and permission enforcement.

## Acceptance Criteria

1. ProjectService.create() successfully creates project via Moku API and caches result
2. ProjectService.list() returns user's owned + shared projects
3. ProjectService.get() retrieves project from cache (if fresh) or API (if stale)
4. ProjectService.update() modifies project and invalidates cache
5. ProjectService.delete() removes project and all associated cache entries
6. ProjectService.getMembers() returns member list from cache or API
7. ProjectService.addMember() adds member and invalidates members cache
8. ProjectService.removeMember() removes member with role validation (must be owner)
9. ProjectService.hasPermission() correctly evaluates user role against permission matrix
10. All API calls include retry logic (3 attempts, exponential backoff)

## Tasks / Subtasks

- [ ] **Task 1: Implement ProjectService Core (AC: 1-5)**
  - [ ] Create ProjectService class with dependency injection (AuthService, ProjectCache)
  - [ ] Implement create() method: POST /api/projects, cache result with 5-minute TTL
  - [ ] Implement list() method: GET /api/projects, cache all projects
  - [ ] Implement get() method: check cache first, fallback to API if expired
  - [ ] Implement update() method: PATCH /api/projects/{id}, invalidate cache
  - [ ] Implement delete() method: DELETE /api/projects/{id}, invalidate all project-related caches
  - [ ] Add error handling and validation for all CRUD operations

- [ ] **Task 2: Implement Member Management (AC: 6-8)**
  - [ ] Implement getMembers() method: GET /api/projects/{id}/members, cache result
  - [ ] Implement addMember() method: POST /api/projects/{id}/members, invalidate members cache
  - [ ] Implement removeMember() method: DELETE /api/projects/{id}/members/{userId}, validate owner role
  - [ ] Implement updateMemberRole() method: PATCH /api/projects/{id}/members/{userId}
  - [ ] Add permission checks before mutating operations

- [ ] **Task 3: Implement Permission System (AC: 9)**
  - [ ] Implement hasPermission() method using role permission matrix
  - [ ] Define ProjectPermission enum (view, create_thread, invite_member, etc.)
  - [ ] Create role permission matrix constant (owner/editor/viewer × permissions)
  - [ ] Add permission validation helper methods

- [ ] **Task 4: Implement API Retry Logic (AC: 10)**
  - [ ] Create retry wrapper for API calls (max 3 attempts, exponential backoff: 1s, 2s, 4s)
  - [ ] Handle transient errors (network failures, 5xx responses)
  - [ ] Log retry attempts and final failure
  - [ ] Add circuit breaker pattern for graceful degradation

- [ ] **Task 5: Integration and Testing**
  - [ ] Write unit tests for all ProjectService methods (mock API and cache)
  - [ ] Test permission matrix exhaustively (3 roles × permissions)
  - [ ] Test retry logic with simulated API failures
  - [ ] Integration test: full CRUD flow with real cache
  - [ ] E2E test: create project → list → update → delete

## Dev Notes

### Architecture Constraints

- **API Coordination**: All project data stored on Moku API (cloud-first for collaboration)
- **Caching Strategy**: Read-through cache with 5-minute TTL (ProjectCache integration)
- **Retry Logic**: Exponential backoff (1s, 2s, 4s) for network resilience
- **Permission Enforcement**: Defense in depth (desktop + API both enforce RBAC)
- **Error Handling**: Graceful degradation with cached data if API unavailable

### Role Permission Matrix (Tech Spec §4.2)

| Permission | Owner | Editor | Viewer |
|------------|-------|--------|--------|
| View project | ✓ | ✓ | ✓ |
| View threads | ✓ | ✓ | ✓ |
| Create threads | ✓ | ✓ | ✗ |
| Edit own threads | ✓ | ✓ | ✗ |
| Delete own threads | ✓ | ✓ | ✗ |
| View files | ✓ | ✓ | ✓ |
| Upload files | ✓ | ✓ | ✗ |
| Invite members | ✓ | ✗ | ✗ |
| Remove members | ✓ | ✗ | ✗ |
| Change member roles | ✓ | ✗ | ✗ |
| Delete project | ✓ | ✗ | ✗ |

### API Endpoints (Tech Spec §4.3)

```
POST   /api/projects                    - Create project
GET    /api/projects                    - List user's projects
GET    /api/projects/{id}               - Get project details
PATCH  /api/projects/{id}               - Update project
DELETE /api/projects/{id}               - Delete project (CASCADE)
GET    /api/projects/{id}/members       - List members
POST   /api/projects/{id}/members       - Add member
DELETE /api/projects/{id}/members/{userId} - Remove member
PATCH  /api/projects/{id}/members/{userId} - Update member role
```

### Data Models (Tech Spec §4.2)

**Project Entity:**
```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;          // Moku Web color palette (12 colors)
  icon: string;           // Icon identifier
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  memberCount: number;
  threadCount: number;
}
```

**ProjectMember Entity:**
```typescript
interface ProjectMember {
  projectId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  addedAt: Date;
  addedBy: string;
}
```

### Testing Strategy

- **Unit Tests**: Mock Moku API, test all methods, permission matrix validation
- **Integration Tests**: Real cache integration, E2E CRUD flow
- **Performance Tests**: API latency P50/P95/P99, cache hit rate >90%
- **Security Tests**: Permission bypass attempts, RBAC parity with API

### Dependencies

- **BLOCKER: E1-S4 (Project API Implementation)** - Moku API endpoints must exist
- **Requires: E3-S2 (ProjectCache)** - Cache integration for performance
- **Uses: AuthService** - JWT token management for API calls

### References

- [Tech Spec: Epic 3 Project Collaboration](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md)
- [Tech Spec §4.1: Services and Modules](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#services-and-modules)
- [Tech Spec §4.2: Data Models](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#data-models-and-contracts)
- [Tech Spec §4.3: APIs and Interfaces](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#apis-and-interfaces)
- [Tech Spec §6: Non-Functional Requirements](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#non-functional-requirements)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e3-s1-project-service-desktop.context.xml

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

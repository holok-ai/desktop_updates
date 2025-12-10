# Epic Technical Specification: Project Collaboration

Date: 2025-11-26
Author: Peter
Epic ID: 3
Status: Draft

---

## Overview

Epic 3 implements project collaboration features enabling teams to create shared workspaces with thread collaboration, member management, and file sharing. This addresses the core enterprise user need (US-14 from PRD §3.6) for department heads and teams to collaborate on AI workflows within organized project spaces. The implementation includes desktop-first project services with intelligent caching (TTL-based with polling for updates), project-scoped RBAC (owner/editor/viewer roles), and thread migration capabilities between personal and project contexts.

## Objectives and Scope

**In Scope:**
- ProjectService desktop layer with CRUD operations (create, read, update, delete, list)
- Project member management (add, remove, update roles: owner/editor/viewer)
- Project invitation system (email + in-app notifications in Moku Web/Desktop)
- ProjectCache with TTL-based expiration (5-minute default TTL)
- Manual refresh for cache invalidation (no auto-polling in MVP)
- Project sidebar UI with type-based grouped project list (My Projects, Shared Projects) and refresh button
- Project creation dialog with Moku Web color palette (12 predefined colors)
- Project detail view with tabbed interface (Threads, Files, Members, Settings)
- Member management UI (invite, remove, change roles)
- Thread copy functionality (bidirectional: personal ↔ project with file migration)
- Project deletion with cascade delete (threads/messages deleted, logged in audit table)
- Project-scoped file storage integration
- RBAC enforcement at desktop layer

**Out of Scope:**
- Real-time project updates via WebSockets (deferred to Phase 3)
- Automatic polling for updates (MVP uses manual refresh only)
- Project templates or duplication features
- Project archival/soft-delete (hard delete with cascade + audit logging)
- Nested projects or project hierarchies
- Project-level workflows or automation (Epic 7 scope)
- Granular permissions beyond role-based (owner/editor/viewer)
- Project analytics or activity feeds
- Offline project creation (requires network)
- Custom hex color input (Moku Web color palette only)

## System Architecture Alignment

This epic extends the desktop architecture (Architecture §2, §5) with project collaboration layers:

**Components Added:**
- **ProjectService (Desktop)** - Main service layer coordinating project operations with Moku API
- **ProjectCache** - In-memory cache with TTL expiration and polling-based invalidation
- **ProjectPollingService** - Background service checking for project updates every 60s
- **Project Sidebar UI** - Primary sidebar section showing project list (Architecture §8.1)
- **Project Detail View** - Main content area with tabbed interface for project resources

**Architectural Constraints:**
- Projects stored on Moku API (cloud-first for collaboration)
- Desktop maintains read-through cache with 5-minute TTL
- File storage bifurcates: Personal threads use local storage, Project threads use Storage Service (Architecture §10.4)
- RBAC enforced at both API and desktop layers (defense in depth)
- Polling-based updates (no WebSockets in MVP per Architecture §2.3)

**Data Flow:**
User creates project → ProjectService.create() → Moku API → Cache entry → Poll detects changes in other clients → Cache invalidation → UI refresh

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs | Owner |
|--------|---------------|--------|---------|-------|
| **ProjectService** | CRUD operations, member management, invitations, API coordination | Project data, member operations, invitation requests | Project entities, operation results | E3-S1 |
| **ProjectCache** | In-memory caching with TTL expiration, manual refresh | Project IDs, cache keys, refresh triggers | Cached project data, cache hits/misses | E3-S2 |
| **ProjectSidebarUI** | Display project list with refresh button, handle navigation | User's projects (owned + shared) | Project selection events, refresh events | E3-S3 |
| **ProjectCreationDialog** | Project creation wizard with Moku Web color palette | User inputs (name, description, color from palette, icon) | Created project | E3-S4 |
| **ProjectDetailView** | Tabbed project interface with refresh button | Project ID | Rendered tabs (Threads, Files, Members, Settings) | E3-S5 |
| **MemberManagementUI** | Add/remove/edit project members, manage invitations | Project ID, member data, invitation data | Member CRUD operations, invitation status | E3-S6 |
| **ThreadCopyService** | Copy threads bidirectionally (personal ↔ project) | Thread ID, target context (personal/project) | Copied thread with files | E3-S7 |

### Data Models and Contracts

**Project Entity:**

```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  type: 'personal' | 'shared';  // Project type: personal (single-member) or shared (multi-member)
  color: string;          // Moku Web design system color (predefined palette: 12 colors)
  icon: string;           // Icon identifier (from Moku Web icon set)
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  memberCount: number;    // Cached count
  threadCount: number;    // Cached count
}

// Moku Web color palette (imported from design system)
const MOKU_PROJECT_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#A855F7', // Violet
];
```

**Project Member Entity:**

```typescript
interface ProjectMember {
  projectId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  addedAt: Date;
  addedBy: string;        // userId of inviter
}
```

**Project Invitation Entity (New):**

```typescript
interface ProjectInvitation {
  id: string;
  projectId: string;
  invitedEmail: string;
  invitedUserId?: string;  // If user already registered
  role: 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'declined';
  invitedBy: string;       // userId of inviter
  invitedAt: Date;
  respondedAt?: Date;
  expiresAt: Date;         // Invitations expire after 7 days
}
```

**Role Permission Matrix:**

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

**Cache Entry Structure:**

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

### APIs and Interfaces

**ProjectService API:**

```typescript
interface IProjectService {
  // CRUD operations
  create(data: CreateProjectRequest): Promise<Project>;
  get(projectId: string): Promise<Project>;
  update(projectId: string, data: UpdateProjectRequest): Promise<Project>;
  delete(projectId: string): Promise<void>;
  list(): Promise<Project[]>;  // Returns owned + shared

  // Member management
  getMembers(projectId: string): Promise<ProjectMember[]>;
  addMember(projectId: string, userId: string, role: ProjectMemberRole): Promise<ProjectMember>;
  removeMember(projectId: string, userId: string): Promise<void>;
  updateMemberRole(projectId: string, userId: string, role: ProjectMemberRole): Promise<ProjectMember>;

  // Permissions
  hasPermission(projectId: string, permission: ProjectPermission): Promise<boolean>;
}
```

**Moku API Endpoints:**

```
POST   /api/projects                    - Create project (with cascade delete on FK)
GET    /api/projects                    - List user's projects
GET    /api/projects/{id}               - Get project details
PATCH  /api/projects/{id}               - Update project
DELETE /api/projects/{id}               - Delete project (CASCADE deletes threads/messages, logs to audit table)
POST   /api/projects/{id}/upgrade-to-shared - Upgrade personal project to shared (owner only, E9-S1)
GET    /api/projects/{id}/members       - List members
POST   /api/projects/{id}/members       - Add member (direct add, no invitation)
DELETE /api/projects/{id}/members/{userId} - Remove member
PATCH  /api/projects/{id}/members/{userId} - Update member role

-- New invitation endpoints
POST   /api/projects/{id}/invitations   - Send invitation (creates invitation, sends email)
GET    /api/projects/{id}/invitations   - List pending invitations (owner only)
GET    /api/invitations                 - List user's pending invitations (all projects)
POST   /api/invitations/{id}/accept     - Accept invitation (creates member, updates status)
POST   /api/invitations/{id}/decline    - Decline invitation (updates status)
DELETE /api/projects/{id}/invitations/{invitationId} - Cancel invitation (owner only)
```

**IPC Handlers (Electron):**

```typescript
// renderer → main process
ipcRenderer.invoke('projects:create', { name, description, type, color, icon });
ipcRenderer.invoke('projects:list');
ipcRenderer.invoke('projects:get', projectId);
ipcRenderer.invoke('projects:refresh');  // Manual refresh - invalidates cache, fetches fresh data
ipcRenderer.invoke('projects:upgrade-to-shared', projectId);  // E9-S1: Upgrade personal to shared
ipcRenderer.invoke('projects:addMember', projectId, { userId, role });
ipcRenderer.invoke('projects:removeMember', projectId, userId);
ipcRenderer.invoke('projects:inviteMember', projectId, { email, role });
ipcRenderer.invoke('projects:listInvitations');  // User's pending invitations
ipcRenderer.invoke('projects:acceptInvitation', invitationId);
ipcRenderer.invoke('projects:declineInvitation', invitationId);
ipcRenderer.invoke('threads:copy', threadId, { targetContext: 'personal' | 'project', projectId? });
```

**ProjectCache API:**

```typescript
interface IProjectCache {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, ttl?: number): void;
  invalidate(key: string): void;
  invalidatePattern(pattern: string): void;  // e.g., 'projects:*'
  clear(): void;
}
```

### Workflows and Sequencing

**Project Creation Flow:**

1. User clicks "New Project" button in sidebar
2. ProjectCreationDialog opens with form fields
3. User fills: name (required), description (optional), type (personal/shared - required, defaults to personal), color (from Moku Web palette - 12 colors), icon (selector)
4. Client-side validation: name 1-100 chars, no special chars in name, type selected, color must be from predefined palette
5. User clicks "Create"
6. ProjectService.create() calls Moku API `POST /api/projects` with { name, description, type, color, icon }
7. API returns new project with generated ID and type field
8. API creates foreign key with ON DELETE CASCADE for project_id in desktop_threads table
9. ProjectService adds to cache with 5-minute TTL
10. UI navigates to new project detail view
11. Project appears in "My Projects" section if type='personal' or "Shared Projects" section if type='shared'

**Member Invitation Flow:**

1. Owner clicks "Invite Member" in project settings
2. MemberManagementUI shows invitation dialog
3. Owner enters email (validates format)
4. Owner selects role (editor/viewer)
5. ProjectService.inviteMember() checks owner permission
6. API call: `POST /api/projects/{id}/invitations` with { email, role }
7. Moku API creates invitation record (status: pending, expiresAt: +7 days)
8. **Multi-channel notifications:**
   - **Email:** Moku sends email with invitation link (immediate delivery)
   - **Moku Web:** Notification appears in notifications dropdown (bell icon)
   - **Desktop:** In-app notification shown when user refreshes or on next launch
9. Invitation link: `https://app.moku.ai/invitations/{invitationId}/accept`
10. New member clicks link or in-app notification:
    - Option 1: Click "Accept" → `POST /api/invitations/{id}/accept` → Member added with specified role
    - Option 2: Click "Decline" → `POST /api/invitations/{id}/decline` → Invitation status updated
11. On acceptance: Cache invalidation for members list, new member sees project in "Shared Projects"
12. Desktop shows pending invitations in notification center (badge count)

**Thread Copy Flow (Bidirectional):**

1. User right-clicks thread → "Copy to Personal" OR "Copy to Project..."
2. **Option A: Copy to Personal**
   - Permission check: User must be thread owner
   - ThreadCopyService copies thread: `POST /api/threads/copy` with `{ sourceThreadId, targetContext: 'personal' }`
   - If thread has file attachments in Storage Service: Download files, save to local filesystem
   - New personal thread created with copied messages
   - Original project thread remains unchanged
   - UI shows new thread in personal list

3. **Option B: Copy to Project**
   - Dialog shows list of user's projects (filtered by 'editor' or 'owner' role)
   - User selects target project
   - Permission check: Must have edit access to target project
   - ThreadCopyService copies thread: `POST /api/threads/copy` with `{ sourceThreadId, targetContext: 'project', projectId }`
   - If thread has file attachments locally: Upload files to Storage Service
   - New project thread created with copied messages
   - Original personal thread remains unchanged (copy semantics, not move)
   - Cache invalidation for target project threads
   - UI shows new thread in project thread list

4. **File Migration:**
   - Personal → Project: Upload local files to Storage Service, update attachment references
   - Project → Personal: Download Storage Service files to local filesystem, update attachment references
   - Transactional: If file migration fails, thread copy rolls back

**Manual Refresh Flow:**

1. User clicks "Refresh" button in project sidebar or detail view
2. ProjectService.refresh() invalidates all project caches
3. Fresh data fetched from Moku API: GET /api/projects, GET /api/projects/{id}/members
4. Cache updated with fresh data (new 5-minute TTL)
5. UI updates to show latest projects, members, threads
6. No automatic polling - refresh is always user-initiated

## Non-Functional Requirements

### Performance

**Response Time Targets:**
- Project list retrieval: <300ms (cache hit), <1s (cache miss / API call)
- Project creation: <2s end-to-end (API call + cache update + UI navigation)
- Member list retrieval: <200ms (cached), <800ms (API call)
- Thread move operation: <3s for threads without files, <10s with file migration
- Cache lookup: <10ms for any cached entity
- Polling cycle: Complete within 5s (all subscribed projects checked)

**Cache Performance:**
- Cache hit rate target: >90% for project/member lookups
- TTL: 5 minutes default (configurable)
- Memory footprint: <50MB for 1000 cached projects

**UI Performance:**
- Project sidebar render: <100ms for 100 projects
- Project detail view load: <500ms
- Member list render: <200ms for 100 members

### Security

**Authorization (RBAC):**
- Role-based permissions enforced at desktop layer (owner/editor/viewer matrix)
- Permission checks before every mutating operation (addMember, removeMember, delete)
- Defense in depth: Moku API also enforces same permissions (double validation)
- JWT tokens passed with all API requests for user identity verification

**Data Protection:**
- Project data cached in memory only (not persisted to disk in plaintext)
- Member email addresses handled per GDPR requirements
- File migration during thread move preserves encryption (Storage Service handles encryption at rest)

**Input Validation:**
- Project names sanitized: max 100 chars, alphanumeric + spaces/hyphens only
- Email validation for member invitations (regex + DNS MX check optional)
- Role values restricted to enum: 'owner' | 'editor' | 'viewer'
- Prevent self-removal of last project owner (must transfer ownership first)

**Audit Logging:**
- Log all member add/remove operations with actor userId
- Log project deletion with confirmation
- Log permission denial attempts

### Reliability/Availability

**Network Resilience:**
- Retry logic for API calls: max 3 attempts, exponential backoff (1s, 2s, 4s)
- Graceful degradation: if Moku API unavailable, show cached data with staleness warning
- Offline mode: project list shows cached projects, mutations disabled with clear error message

**Cache Consistency:**
- Polling detects stale cache within 60 seconds of external changes
- Manual refresh action forces cache invalidation
- Cache miss triggers immediate API fetch (read-through pattern)
- Invalidation cascades: deleting project invalidates members, threads, files

**Data Integrity:**
- Thread move is transactional: if file migration fails, thread move rolls back
- Member removal checks: cannot remove last owner (API enforces this rule)
- Project deletion requires explicit confirmation (prevent accidental data loss)

**Error Recovery:**
- Failed project creation: user can retry with same inputs
- Failed member invitation: partial success handled (some members added, some failed)
- Polling service auto-restarts if crash detected (watchdog timer)

### Observability

**Metrics:**
- `project.cache.hit_rate` - Percentage of cache hits vs misses
- `project.cache.size` - Number of cached entities
- `project.api.latency` - P50/P95/P99 for Moku API calls
- `project.poll.cycle_duration` - Time to complete full polling cycle
- `project.member.invitation_rate` - Invitations sent per day
- `thread.move.duration` - Time to move thread (with/without files)
- `thread.move.file_migration_size` - Total bytes migrated during moves

**Logging:**
- **INFO:** Project created (projectId, ownerId, name)
- **INFO:** Member added (projectId, userId, role, addedBy)
- **INFO:** Thread moved (threadId, fromProject, toProject, fileCount)
- **WARN:** Cache miss for frequently accessed project (potential caching issue)
- **WARN:** Polling cycle exceeded 10s (performance degradation)
- **ERROR:** API call failed after 3 retries (network/service issue)
- **ERROR:** Thread move failed (reason, rollback status)

**Tracing:**
- Distributed trace for project creation: UI → ProjectService → Moku API → Cache → UI update
- Trace thread move with file migration: Check permissions → Upload files → Update thread → Invalidate cache
- Trace polling cycle: Fetch updates → Compare timestamps → Invalidate stale entries

**Alerting:**
- Alert if cache hit rate < 80% (caching misconfiguration or TTL too short)
- Alert if polling cycle > 10s for 5 consecutive cycles (performance issue)
- Alert if API error rate > 5% over 5 minutes (service degradation)

## Dependencies and Integrations

**Internal Dependencies (BLOCKERS):**
- **E1-S4: Project API Implementation** - MUST be complete before E3-S1 can call Moku API endpoints
  - Requires project CRUD endpoints implemented
  - Requires member management endpoints
- **E4-S2: State Persistence** - Needed for cache persistence strategy (if implemented)
  - ProjectCache currently in-memory only
  - Optional integration for cache persistence across app restarts
- **E5-S1: File Service (Desktop)** - BLOCKER for E3-S8 (Thread Move with files)
  - Thread move with local files requires File Service to migrate to Storage Service
  - **Mitigation:** E3-S8 can implement thread move without files first, file migration added when E5 complete

**External Dependencies:**
- **Moku API (Backend)** - Project and member endpoints must be deployed
  - Version compatibility: Desktop requires Moku API v1.2+ for project features
- **Storage Service** - Required for project-scoped file storage
  - Thread files in project context stored in Storage Service, not local filesystem

**Integration Points:**

**1. Moku API Integration:**
- ProjectService wraps all Moku API calls with error handling, retries, auth
- JWT token management handled by existing AuthService (Epic 1)
- API client maintains connection pool for performance

**2. File Storage Bifurcation:**
- Personal threads: Files stored locally (existing behavior, no change)
- Project threads: Files stored in Storage Service (cloud storage)
- Thread move triggers file migration: local → Storage Service upload

**3. Authorization Service Integration (Epic 1):**
- ProjectService.hasPermission() queries user's role in project
- Integrates with E1-S5 Authorization Service for RBAC checks
- Desktop enforces permissions before API calls (optimistic UI)

**4. Thread Service Integration:**
- Thread move operation coordinated between ThreadService and ProjectService
- ThreadService updates thread.projectId field
- ProjectService invalidates affected caches

**5. Notification System (Epic 4):**
- Desktop notifications when added to project: "You've been invited to Project X"
- Notification when member added (owner sees confirmation)
- Optional integration, graceful if notifications unavailable

## Acceptance Criteria (Authoritative)

**AC-1: Project Service (Desktop) - E3-S1**
- [ ] ProjectService.create() successfully creates project via Moku API and caches result
- [ ] ProjectService.list() returns user's owned + shared projects
- [ ] ProjectService.get() retrieves project from cache (if fresh) or API (if stale)
- [ ] ProjectService.update() modifies project and invalidates cache
- [ ] ProjectService.delete() removes project and all associated cache entries
- [ ] ProjectService.getMembers() returns member list from cache or API
- [ ] ProjectService.addMember() adds member and invalidates members cache
- [ ] ProjectService.removeMember() removes member with role validation (must be owner)
- [ ] ProjectService.hasPermission() correctly evaluates user role against permission matrix
- [ ] All API calls include retry logic (3 attempts, exponential backoff)

**AC-2: Project Cache - E3-S2**
- [ ] ProjectCache stores entries with TTL (default 5 minutes)
- [ ] ProjectCache.get() returns cached data if not expired, null if expired
- [ ] ProjectCache.set() stores data with expiration timestamp
- [ ] ProjectCache.invalidate() removes specific cache entry
- [ ] ProjectCache.invalidatePattern() removes all matching entries (e.g., 'projects:*')
- [ ] Cache hit rate measured and logged
- [ ] Memory usage stays <50MB for 1000 cached projects

**AC-3: Project Sidebar UI - E3-S3**
- [ ] Sidebar displays project list grouped by type: "My Projects" (type='personal') and "Shared Projects" (type='shared')
- [ ] Each project shows: icon, name, color indicator (from Moku Web palette)
- [ ] Clicking project navigates to project detail view
- [ ] "New Project" button visible and functional
- [ ] "Refresh" button visible and invalidates cache when clicked
- [ ] Project list updates when cache invalidated (manual refresh)
- [ ] Sidebar renders in <100ms for 100 projects
- [ ] Pending invitations badge shown with count

**AC-4: Project Creation Dialog - E3-S4**
- [ ] Dialog opens when "New Project" clicked
- [ ] Form fields: name (required, 1-100 chars), description (optional), type (Personal/Shared, required, defaults to Personal), color (predefined Moku Web palette - 12 colors), icon (selector)
- [ ] Type selector shows help text explaining personal vs shared projects (E9-S1)
- [ ] Color picker shows ONLY predefined palette (no custom hex input)
- [ ] Client-side validation prevents submission with invalid data (name length, type selected, color from palette)
- [ ] "Create" button calls ProjectService.create() with type field and shows loading state
- [ ] Success: dialog closes, navigates to new project
- [ ] Failure: error message shown, user can retry
- [ ] Project creation completes in <2s (P95)
- [ ] Database foreign key created with ON DELETE CASCADE for project_id

**AC-5: Project Detail View - E3-S5**
- [ ] Detail view has tabbed interface: Threads, Files, Members, Settings
- [ ] Threads tab shows project threads (filtered by projectId)
- [ ] Files tab shows project files (requires Epic 5 File Service)
- [ ] Members tab shows member list with roles + pending invitations section
- [ ] Settings tab shows project metadata (name, description, color from Moku Web palette, icon)
- [ ] Only owner sees "Delete Project" button
- [ ] Delete confirmation dialog shows: "This will permanently delete X threads and Y messages. This action cannot be undone."
- [ ] Delete confirmation requires typing project name to confirm (prevent accidental deletion)
- [ ] Project deletion CASCADE deletes all threads and messages (ON DELETE CASCADE foreign key)
- [ ] Deleted threads/messages logged to PostgreSQL audit table (audit trail preserved)
- [ ] View loads in <500ms
- [ ] "Refresh" button visible in detail view toolbar

**AC-6: Member Management and Invitations - E3-S6**
- [ ] Members tab displays list with: name, email, role, "added by" info
- [ ] "Invite Member" button visible only to owners
- [ ] Invitation dialog: email input (with validation), role selector (editor/viewer)
- [ ] Invitation sent: Creates invitation record (status: pending, expiresAt: +7 days)
- [ ] **Multi-channel notifications:** Email sent, notification in Moku Web (bell icon), Desktop in-app notification
- [ ] Invitation link format: `https://app.moku.ai/invitations/{invitationId}/accept`
- [ ] Desktop notification center shows pending invitations with badge count
- [ ] Pending invitations section in Members tab shows: invited email, role, invited date, "Cancel" button (owner only)
- [ ] User can accept/decline invitations from Desktop notification center or email link
- [ ] Invitation acceptance: Creates member with specified role, updates invitation status to 'accepted'
- [ ] Invitation decline: Updates invitation status to 'declined', no member created
- [ ] Invitations expire after 7 days (expiresAt timestamp checked)
- [ ] "Remove" button visible only to owners, disabled for self if last owner
- [ ] Role change dropdown visible only to owners
- [ ] Member operations complete in <1s (P95)

**AC-7: Thread Copy Functionality (Bidirectional) - E3-S7**
- [ ] Right-click thread shows "Copy to Personal" OR "Copy to Project..." option
- [ ] **Copy to Personal:** Permission check (user must be thread owner)
- [ ] **Copy to Personal:** Thread copied with all messages to personal context
- [ ] **Copy to Personal:** Project files in Storage Service downloaded to local filesystem
- [ ] **Copy to Project:** Dialog shows list of user's projects (editor/owner roles only)
- [ ] **Copy to Project:** Permission check (must have edit access to target project)
- [ ] **Copy to Project:** Personal local files uploaded to Storage Service
- [ ] Thread without files copies in <3s
- [ ] Thread with files: file migration (upload or download) before copy completes
- [ ] Thread with files copies in <10s for up to 10MB total attachments
- [ ] File migration failure rolls back thread copy (atomic operation, transactional)
- [ ] Copied thread appears in target context, original thread remains unchanged (copy semantics, not move)
- [ ] Cache invalidation for target project threads (if copying to project)
- [ ] API endpoint: `POST /api/threads/copy` with `{ sourceThreadId, targetContext, projectId? }`

**AC-8: Manual Refresh - E3-S3 (Additional)**
- [ ] "Refresh" button visible in project sidebar and detail view
- [ ] Clicking refresh invalidates all project caches
- [ ] Fresh data fetched from Moku API: GET /api/projects, GET /api/projects/{id}/members
- [ ] Cache updated with new 5-minute TTL
- [ ] UI updates to show latest projects, members, threads
- [ ] No automatic polling - all refreshes are user-initiated (manual only)
- [ ] Refresh operation completes in <2s (P95)

## Traceability Mapping

| AC ID | PRD Reference | Spec Section | Component/API | Test Approach |
|-------|---------------|--------------|---------------|---------------|
| AC-1 | PRD §3.6 (Project Collaboration) | Services §4.1, APIs §4.3 | ProjectService | Unit: API wrapper logic, mock Moku API<br>Integration: E2E project CRUD operations<br>Performance: API latency measurement |
| AC-2 | Architecture §5 (Caching) | Data Models §4.2 | ProjectCache | Unit: TTL expiration logic, eviction<br>Integration: Cache hit/miss scenarios<br>Performance: Memory usage, lookup speed |
| AC-3 | Architecture §8.1 (Sidebar), Open Questions §Q5 | Services §4.1 | ProjectSidebarUI | E2E: Visual test with grouped projects, refresh button<br>Performance: Render time for 100 projects<br>Accessibility: Keyboard navigation |
| AC-4 | PRD §3.6 (Project creation), Open Questions §Q1 | Workflows §4.4 | ProjectCreationDialog | E2E: Full creation flow with Moku Web color palette validation<br>Unit: Input validation logic, color from palette<br>Manual: Moku Web color picker (12 colors), icon selector |
| AC-5 | Architecture §8.1 (Project view), Open Questions §Q2 | Services §4.1, Workflows §4.4 | ProjectDetailView | E2E: Tab navigation, data loading, cascade delete with confirmation<br>Performance: View load time<br>Integration: Verify ON DELETE CASCADE, audit table logging |
| AC-6 | PRD §3.6 (Member management), Open Questions §Q3 | APIs §4.3, Workflows §4.4 | MemberManagementUI, InvitationService | E2E: Invite flow (email + Moku Web + Desktop notifications), accept/decline<br>Unit: Permission checks (owner-only actions)<br>Integration: Email sent, invitation record created, multi-channel notifications |
| AC-7 | Architecture §10.4 (File storage), Open Questions §Q4 | Workflows §4.4 | ThreadCopyService | E2E: Copy bidirectionally (personal ↔ project) with/without files<br>Integration: File migration (upload to Storage Service OR download to local)<br>Reliability: Rollback on failure, copy semantics (original unchanged) |
| AC-8 | Architecture §2.3 (Manual refresh), Open Questions §Q5 | Services §4.1 | ProjectService, ProjectCache | E2E: Manual refresh invalidates cache, fetches fresh data<br>Integration: Verify no automatic polling<br>Performance: Refresh completes in <2s |

## Risks, Assumptions, Open Questions

**Risks:**

1. **RISK:** Manual refresh only (no automatic polling) may cause users to see stale data
   - **Impact:** Low-Medium - users must manually refresh to see changes from other devices
   - **Mitigation:** MVP: Clear "Refresh" buttons visible in sidebar and detail view; Phase 3: Implement WebSockets for real-time updates; User education: notify users to refresh when collaborating

2. **RISK:** File migration during thread copy could fail partially, leaving inconsistent state
   - **Impact:** High - data integrity issue
   - **Mitigation:** Implement transactional file migration with rollback; all-or-nothing copy; if file migration fails, entire thread copy rolls back (atomic operation)

3. **RISK:** Cascade delete could accidentally delete large amounts of data (threads/messages)
   - **Impact:** High - data loss
   - **Mitigation:** Require explicit confirmation with project name typed; show deletion impact ("X threads, Y messages will be deleted"); audit table logs all deletions for recovery; consider adding "soft delete" in future for 30-day recovery window

4. **RISK:** Multi-channel invitation notifications (email + Moku Web + Desktop) could create notification fatigue
   - **Impact:** Low - UX annoyance
   - **Mitigation:** Consolidate notifications (one badge count across channels); allow users to configure notification preferences; expire invitations after 7 days (auto-cleanup)

5. **RISK:** Cache memory usage could grow unbounded with many projects
   - **Impact:** Medium - desktop performance degradation
   - **Mitigation:** Implement LRU eviction policy; monitor memory usage metrics; 5-minute TTL helps naturally expire unused entries

6. **RISK:** Permission checks at desktop layer could diverge from API enforcement
   - **Impact:** Medium - security vulnerability or confusing UX
   - **Mitigation:** Share permission matrix definition between desktop and API (TypeScript interfaces); automated tests verify parity; defense in depth (both layers enforce)

**Assumptions:**

1. **ASSUMPTION:** Users will have <100 projects on average (cache size optimization target)
   - **Validation:** Track project count distribution in Alpha; adjust cache strategy if needed

2. **ASSUMPTION:** Manual refresh acceptable for MVP (no automatic polling requirement)
   - **Validation:** Gather user feedback during Beta; implement auto-polling or WebSockets in Phase 3 if critical for UX

3. **ASSUMPTION:** Moku API project endpoints (CRUD + invitations) will be available by E3 sprint start
   - **Validation:** Coordinate with backend team; confirm deployment timeline for project_invitations table and endpoints

4. **ASSUMPTION:** Thread copy with file migration <10s acceptable for up to 10MB files
   - **Validation:** Performance testing with various file sizes; implement progress indicator if slower

5. **ASSUMPTION:** Moku Web color palette (12 colors) sufficient for project colors in MVP
   - **Validation:** UX testing confirms 12 colors provide enough differentiation; custom colors deferred to premium/enterprise plans

6. **ASSUMPTION:** Cascade delete with confirmation acceptable (no soft delete needed in MVP)
   - **Validation:** Beta testing confirms confirmation flow prevents accidental deletions; audit table logs provide recovery option if needed

**Open Questions:**

~~1. **QUESTION:** Should project colors be predefined palette or custom hex input?~~
   - **DECISION:** Colors should follow design style and guidelines established for Moku Web
   - **Decided by:** Product/UX review (2025-11-27)
   - **Rationale:** Consistent branding across Desktop and Web apps; use Moku Web color system for project colors
   - **Implementation:**
     - Import Moku Web design system colors (predefined palette: 12 colors matching brand guidelines)
     - No custom hex input in MVP (reduces complexity, ensures visual consistency)
     - Color picker shows predefined palette only
     - Future: Allow custom colors for premium/enterprise plans

~~2. **QUESTION:** What happens to project threads when project deleted? Cascade delete or orphan?~~
   - **DECISION:** Cascade delete - threads deleted when project deleted
   - **Decided by:** Architecture review (2025-11-27)
   - **Rationale:** PostgreSQL has audit tables to record deleted records; cascade delete is cleanest UX (avoids orphaned threads)
   - **Implementation:**
     - Database: `ON DELETE CASCADE` foreign key constraint on desktop_threads.project_id
     - Audit: All deleted threads/messages logged in PostgreSQL audit table (pg_audit or custom audit_log table)
     - UI: Project deletion shows warning: "This will permanently delete X threads and Y messages. This action cannot be undone."
     - Confirmation: Require typing project name to confirm deletion (prevent accidental data loss)

~~3. **QUESTION:** Should members receive in-app notifications when invited, or email only?~~
   - **DECISION:** Member invites shown in Moku Web AND Desktop; also sent by email
   - **Decided by:** Product review (2025-11-27)
   - **Rationale:** Multi-channel notifications ensure users don't miss invitations
   - **Implementation:**
     - **Email:** Moku API sends email invitation on POST /api/projects/{id}/members (immediate delivery)
     - **Moku Web:** Notifications dropdown shows "You've been invited to Project X" (bell icon)
     - **Desktop:** In-app notification (system tray or in-app banner) when polling detects new membership
     - **Accept/Decline:** Users click email link or in-app notification to accept/decline invitation
     - Invitation entity: `project_invitations` table tracks pending invites (status: pending/accepted/declined)

~~4. **QUESTION:** Can users move threads from project back to personal context? Or one-way only?~~
   - **DECISION:** YES - Threads can be moved from project to personal (bidirectional)
   - **Decided by:** Product review (2025-11-27)
   - **Rationale:** Users may want to copy project threads to personal workspace for experimentation or archival
   - **Implementation:**
     - Thread move dialog shows: "Move to Personal" option OR "Move to Project..." with project list
     - Permission: Only thread owner can move thread to personal (even in project context)
     - File migration: Project files in Storage Service copied to local storage (download + save locally)
     - UI: Right-click thread → "Move to Personal" OR "Move to Project..."
     - Note: Use "copy" semantics - original thread remains in project, copy created in personal (prevents data loss)

~~5. **QUESTION:** Should polling interval be user-configurable or system-wide setting?~~
   - **DECISION:** Manual polling only (no auto-polling in MVP)
   - **Decided by:** Architecture review (2025-11-27)
   - **Rationale:** Simplifies MVP implementation; users can manually refresh when needed
   - **Implementation:**
     - Remove ProjectPollingService from MVP scope (defer to Phase 3)
     - Add "Refresh" button in project sidebar and detail view
     - Refresh button invalidates cache and fetches fresh data from API
     - Future: Add auto-polling in Phase 3 when WebSockets implemented for real-time updates

## Test Strategy Summary

**Test Levels:**

**1. Unit Tests (Target: 85% coverage)**
- **ProjectService:**
  - CRUD operations with mocked Moku API
  - Invitation management (create, accept, decline)
  - Retry logic (simulate API failures)
  - Permission checks (all role combinations)
  - Cache integration (hit/miss scenarios)
  - Manual refresh logic
- **ProjectCache:**
  - TTL expiration logic
  - Invalidation patterns (manual refresh)
  - LRU eviction (if implemented)
  - Memory usage tracking
- **ThreadCopyService:**
  - Bidirectional copy (personal ↔ project)
  - Permission validation (owner check for copy to personal, edit check for copy to project)
  - File migration logic (upload to Storage Service OR download to local)
  - Rollback on failure (transactional copy)
  - Copy semantics (original thread unchanged)
- **InvitationService:**
  - Create invitation (email validation, role validation)
  - Multi-channel notifications (email + Moku Web + Desktop)
  - Accept/decline logic
  - Expiration check (7-day TTL)

**2. Integration Tests**
- **Project creation flow:** UI → ProjectService → Moku API (creates project with ON DELETE CASCADE FK) → Cache → UI update
- **Project deletion flow:** Owner clicks delete → Confirmation dialog (type project name) → CASCADE deletes threads/messages → Audit table logs deletions
- **Member invitation flow:** Owner invites member → API creates invitation (status: pending) → Email + Moku Web + Desktop notifications sent → Member accepts → Member created, invitation status updated
- **Manual refresh flow:** User clicks refresh → Cache invalidated → Fresh data fetched from API → Cache updated (new TTL) → UI updates
- **Thread copy to project with files:** Validate permissions → Upload local files to Storage Service → Create new project thread → Original personal thread unchanged → Rollback if upload fails
- **Thread copy to personal with files:** Validate permissions → Download Storage Service files to local → Create new personal thread → Original project thread unchanged → Rollback if download fails
- **Cross-epic integration:** Thread copy with Epic 5 File Service

**3. E2E Tests (Playwright)**
- **Happy path:** User creates project (with Moku Web color palette), invites member via email, member receives email + Moku Web + Desktop notification, accepts invitation, sees project in "Shared Projects"
- **Cascade delete:** Owner deletes project → Confirmation dialog requires typing project name → Project, threads, and messages deleted → Audit table logs all deletions
- **Permission enforcement:** Viewer attempts to add member (denied), editor attempts (denied), owner succeeds
- **Thread copy bidirectional:** User copies thread from personal to project (files uploaded to Storage Service), then copies from project to personal (files downloaded to local), verifies both threads exist with correct files
- **Manual refresh behavior:** User A creates project, User B clicks refresh button, sees new project (no automatic polling)
- **Invitation expiration:** Invitation created, 7 days pass, invitation expired (status check prevents acceptance)
- **Error handling:** API unavailable, show cached data with staleness warning, refresh button disabled or shows error

**4. Performance Tests**
- **Cache hit rate:** Measure hit rate over simulated user session (target: >90%)
- **Project list render:** Benchmark rendering 10/50/100 projects with Moku Web colors (target: <100ms for 100)
- **API latency:** Measure P50/P95/P99 for all project API calls (CRUD + invitations)
- **Manual refresh:** Benchmark refresh operation with 10/50/100 projects (target: <2s for 100)
- **Thread copy:** Benchmark with 1MB/5MB/10MB file attachments (target: <10s for 10MB, bidirectional)
- **Invitation flow:** Measure end-to-end invitation (create → email sent → notification shown) (target: <3s)
- **Memory usage:** Monitor cache memory with 100/500/1000 cached projects (target: <50MB for 1000)

**5. Security Tests**
- **Permission bypass attempts:** Viewer attempts delete (blocked), editor attempts add member (blocked)
- **RBAC parity:** Verify desktop permission checks match API enforcement (automated comparison)
- **Input sanitization:** Inject special characters in project names, verify sanitization
- **JWT token validation:** Expired/invalid tokens rejected, valid tokens accepted

**Test Frameworks & Tools:**
- **Vitest** - Unit and integration tests
- **Playwright** - E2E tests
- **Lighthouse CI** - Performance regression detection
- **Artillery** - API load testing (simulate polling from 100 concurrent clients)

**Edge Cases to Test:**

1. **Last owner removal:** Cannot remove last owner, must transfer ownership first
2. **Concurrent member operations:** Two owners add same member simultaneously (idempotent handling)
3. **Concurrent invitations:** Two owners invite same email simultaneously (duplicate prevention or idempotent handling)
4. **Large project lists:** Render performance with 1000 projects (with Moku Web colors)
5. **File migration failures:** Partial upload/download, network interruption during thread copy (rollback verification)
6. **Cache stampede:** Multiple clients request same uncached project simultaneously
7. **Manual refresh spam:** User clicks refresh button rapidly (rate limiting or debouncing)
8. **Thread copy permission changes:** User loses edit permission mid-operation (permission re-check before commit)
9. **Project deletion with large thread count:** Delete project with 1000+ threads (cascade delete performance, audit logging)
10. **Invitation expiration edge:** Invitation accepted exactly at 7-day expiration boundary (timestamp precision)
11. **Color palette validation:** Attempt to create project with invalid color (not from Moku Web palette) - client-side rejection
12. **Project deletion confirmation typo:** User types incorrect project name (confirmation rejected, deletion prevented)

**Test Data Strategy:**
- **Synthetic projects:** Generate projects with known properties (Moku Web colors, icons, member counts)
- **Real-world samples:** Export actual project data from Beta testing
- **Permission matrix validation:** Exhaustive testing of all role × permission combinations (3 roles × 10 permissions = 30 test cases)
- **Invitation test data:** Pre-seed invitations with various states (pending, accepted, declined, expired)
- **Cascade delete test data:** Projects with varying thread counts (1, 10, 100, 1000) for performance testing

**Continuous Integration:**
- All tests run on every PR
- E2E tests run on staging before production deploy
- Performance tests run nightly, alert on >10% regression
- Security tests (RBAC parity) run on every commit to desktop + backend
- Cascade delete audit logging verified in CI (audit table entries created)

**Definition of Done for Epic 3:**
- All unit tests pass (85%+ coverage)
- All integration tests pass (including invitation flow, cascade delete, manual refresh)
- All E2E tests pass in Chrome, Firefox, Safari (including bidirectional thread copy)
- Performance benchmarks meet targets (API <1s, cache >90% hit rate, UI <100ms render, refresh <2s)
- Security tests pass (permission matrix parity verified)
- Moku Web color palette validated (no custom hex input possible)
- Cascade delete with confirmation flow tested (audit table logging verified)
- Multi-channel invitation notifications working (email + Moku Web + Desktop)
- Manual refresh working (no automatic polling)
- No P0/P1 bugs open
- Thread copy with files tested and working bidirectionally (requires Epic 5 completion)

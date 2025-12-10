# Epics and Stories - Holokai Desktop Phase 2

**Date:** 2025-11-25
**Methodology:** Kanban (continuous flow)
**Team Size:** 3 developers (all full-stack)

---

## Requirement Document Key

| Abbreviation | Document |
|--------------|----------|
| **TM** | `thread-management-requirements-2025-11-25.md` |
| **TLC** | `thread-loading-caching-requirements-2025-11-25.md` |
| **PROJ** | `project-requirements-2025-11-25.md` |
| **CORE** | `desktop-core-requirements-2025-11-25.md` |
| **UI** | `ui-ux-requirements-2025-11-25.md` |
| **INS** | `insights-requirements-2025-11-25.md` |
| **ARCH** | `architecture-2025-11-25.md` |
| **API** | `moku-api-specification-2025-11-25.md` |
| **DB** | `database-schema-2025-11-25.md` |
| **WF** | `brainstorming-session-workflow-templates-2025-11-25.md` |
| **FS** | `brainstorming-session-file-storage-2025-11-25.md` |

---

## Team Structure

| Role | Focus Areas | WIP Limit |
|------|-------------|-----------|
| **Peter (Lead)** | Architecture, integration, code review | 2 |
| **Dev A** | Feature development, frontend/backend | 2 |
| **Dev B** | Feature development, frontend/backend | 2 |

### Work Stream Strategy

To maximize parallel work and minimize conflicts:

| Stream | Owner | Description |
|--------|-------|-------------|
| **Stream 1: Thread & Messages** | Dev A | Thread branching, auto-title, clipboard |
| **Stream 2: Projects & Collaboration** | Dev B | Projects, members, file storage |
| **Stream 3: Platform & Integration** | Peter | Core infrastructure, API integration, workflows |

---

## Epic Overview

| Epic | Priority | Stories | Dependencies |
|------|----------|---------|--------------|
| E1: Database & API Foundation | P0 | 5 | None |
| E2: Thread Branching | P0 | 6 | E1 |
| E3: Project Collaboration | P0 | 8 | E1 |
| E4: Desktop Core | P0 | 4 | None |
| E5: File Attachments | P1 | 4 | E3 |
| E6: Insights Dashboard | P1 | 5 | E1 |
| E7: Workflows | P1 | 6 | E1, E3 |
| E8: UI/UX Polish | P1 | 5 | E2, E3 |

### Dependency Graph

```
E1: Database & API Foundation
    ├── E2: Thread Branching
    ├── E3: Project Collaboration
    │       └── E5: File Attachments
    ├── E6: Insights Dashboard
    └── E7: Workflows (also depends on E3)

E4: Desktop Core (parallel, no dependencies)

E8: UI/UX Polish (after E2, E3)
```

---

## Epic 1: Database & API Foundation

**Owner:** Peter
**Priority:** P0 - Must complete first
**Description:** Database schema updates and core Moku API endpoints required by all other epics.

### Stories

#### E1-S1: Database Schema Migration
**Size:** M
**Description:** Create Flyway migrations for Phase 2 schema changes.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| V2.1 migration (thread/message) | DB | §8.2 |
| V2.2 migration (projects, members) | DB | §8.3 |
| V2.3 migration (workflows) | DB | §8.4 |
| V2.4 migration (saved_reports) | DB | §8.5 |
| V2.5 migration (views, triggers) | DB | §8.6 |

**Tasks:**
- [ ] Create V2.1 migration (thread/message updates) `DB §8.2`
  - [ ] Add `type` column to `desktop_threads` (VARCHAR, default 'personal')
  - [ ] Add `owner_id` column to `desktop_threads` (UUID, NOT NULL)
  - [ ] Add `project_id` column to `desktop_threads` (UUID, nullable, FK)
  - [ ] Add `created_by` column to `desktop_threads` (UUID, NOT NULL)
  - [ ] Add `parent_message_id` column to `desktop_messages` (UUID, nullable, FK)
  - [ ] Add `branch_index` column to `desktop_messages` (INT, default 0)
  - [ ] Add `attachments` JSONB column to `desktop_messages`
  - [ ] Add CHECK constraint for `branch_index` (0-2)
  - [ ] Add CHECK constraint for type/project_id consistency
  - [ ] Create indexes on new columns
- [ ] Create V2.2 migration (projects, members) `DB §8.3`
  - [ ] Create `projects` table with all columns
  - [ ] Create `project_members` table with role CHECK constraint
  - [ ] Add unique constraint on (project_id, user_id)
  - [ ] Add FK constraints to users table
  - [ ] Create indexes for common queries
- [ ] Create V2.3 migration (workflows, executions) `DB §8.4`
  - [ ] Create `workflows` table with JSONB columns
  - [ ] Create `workflow_executions` table
  - [ ] Add status CHECK constraints
  - [ ] Create indexes on owner_id, scope, status
- [ ] Create V2.4 migration (saved_reports) `DB §8.5`
  - [ ] Create `saved_reports` table
  - [ ] Add JSONB column for report config
  - [ ] Create indexes on owner_id
- [ ] Create V2.5 migration (views, triggers) `DB §8.6`
  - [ ] Create `v_project_thread_summary` view
  - [ ] Create `v_user_project_access` view
  - [ ] Create `v_workflow_execution_stats` view
  - [ ] Add `updated_at` trigger functions
- [ ] Test migrations on dev database
  - [ ] Run on empty database
  - [ ] Run on Phase 1 database with existing data
  - [ ] Verify data integrity after migration
- [ ] Document rollback procedures
  - [ ] Create rollback scripts for each migration
  - [ ] Test rollback on dev database

**Acceptance Criteria:**
- All migrations run successfully on clean database
- All migrations run successfully on existing Phase 1 database
- Rollback scripts work correctly
- Schema matches `DB §2-5`

---

#### E1-S2: Thread API Updates
**Size:** M
**Description:** Update thread endpoints for ownership and branching support.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Thread ownership fields | TLC | §1.2 |
| Thread type filter | TLC | §1.6 |
| Project thread authorization | PROJ | §2.3-2.4 |

**Tasks:**
- [ ] Add `type`, `owner_id`, `project_id`, `created_by` to ThreadDTO `TLC §1.2`
  - [ ] Update ThreadDTO class with new fields
  - [ ] Update ThreadEntity with JPA annotations
  - [ ] Update ThreadMapper (entity ↔ DTO)
  - [ ] Add validation annotations (@NotNull, etc.)
- [ ] Update `GET /api/threads` with type/project filters `API §3.1`
  - [ ] Add `type` query parameter (personal|project|all)
  - [ ] Add `projectId` query parameter
  - [ ] Update ThreadRepository with filter queries
  - [ ] Add pagination support (limit, cursor)
  - [ ] Write unit tests for filter combinations
- [ ] Update `POST /api/threads` for project threads `API §3.4`
  - [ ] Accept optional `projectId` in request body
  - [ ] Set `type` based on projectId presence
  - [ ] Validate project exists and user has edit access
  - [ ] Set `created_by` from JWT claims
  - [ ] Write integration test for project thread creation
- [ ] Update authorization checks for project threads `PROJ §2.3-2.4`
  - [ ] Inject AuthorizationService into ThreadController
  - [ ] Check read access for GET endpoints
  - [ ] Check edit access for POST/PATCH endpoints
  - [ ] Return 403 with clear error message on denial

**Acceptance Criteria:**
- Personal threads work as before (backward compatible)
- Project threads require project membership `PROJ §2.4`
- Type filter returns correct thread sets `TLC §1.6`

---

#### E1-S3: Message API Updates
**Size:** M
**Description:** Update message endpoints for branching support.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Message branching fields | TM | §2.1 |
| Branch validation rules | TM | §2.2 |
| Attachment metadata | TLC | §2.2 |
| API endpoint updates | API | §3.5 |

**Tasks:**
- [ ] Add `parent_message_id`, `branch_index`, `attachments` to MessageDTO `TM §2.1`
  - [ ] Update MessageDTO class with new fields
  - [ ] Update MessageEntity with JPA annotations
  - [ ] Add self-referencing FK for parent_message_id
  - [ ] Create AttachmentDTO embedded class
  - [ ] Update MessageMapper (entity ↔ DTO)
- [ ] Update `POST /api/threads/{id}/messages` for branching `API §3.5`
  - [ ] Accept `parent_message_id` in request body
  - [ ] Accept `branch_index` in request body
  - [ ] Accept `client_message_id` for idempotency
  - [ ] Accept `attachments` array with fileId references
  - [ ] Validate parent message exists in same thread
  - [ ] Validate branch_index is 0-9
- [ ] Add branch validation (max 9 retries per parent) `TM §2.2`
  - [ ] Query existing messages with same parent_message_id
  - [ ] Count distinct branch_index values
  - [ ] Reject if requested branch_index already exists
  - [ ] Reject if branch_index > 9
  - [ ] Return clear error: "Maximum retry branches reached"
- [ ] Add idempotency check on `client_message_id` `API §3.5`
  - [ ] Add unique index on (thread_id, client_message_id)
  - [ ] Check for existing message before insert
  - [ ] Return existing message if duplicate (200, not 201)
  - [ ] Log idempotent hit for debugging
- [ ] Update `GET /api/threads/{id}/messages` to include branch info `API §3.3`
  - [ ] Include parent_message_id in response
  - [ ] Include branch_index in response
  - [ ] Include attachments array in response
  - [ ] Order by created_at for tree reconstruction

**Acceptance Criteria:**
- First message accepts null `parent_message_id` `TM §2.1`
- Subsequent messages require valid `parent_message_id` `TM §2.1`
- Branch index 0-2 accepted, 3+ rejected with error `TM §2.2`
- Duplicate `client_message_id` returns existing message (idempotent) `API §11`

---

#### E1-S4: Project API Implementation
**Size:** L
**Description:** Implement complete project CRUD and member management.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Project CRUD endpoints | API | §4.1-4.5 |
| Member management endpoints | API | §5 |
| Role-based authorization | PROJ | §2.3-2.4 |
| Updates polling endpoint | TLC | §4.3 |

**Tasks:**
- [ ] Create ProjectController with CRUD endpoints `API §4.1-4.5`
  - [ ] `GET /api/projects` - list user's projects
    - [ ] Query projects where user is member
    - [ ] Include member count in response
    - [ ] Support pagination (limit, cursor)
  - [ ] `GET /api/projects/{id}` - get project details
    - [ ] Include metadata (color, icon, tags)
    - [ ] Include user's role in response
  - [ ] `POST /api/projects` - create project
    - [ ] Validate name (required, max 100 chars)
    - [ ] Set created_by from JWT
    - [ ] Auto-add creator as owner member
  - [ ] `PATCH /api/projects/{id}` - update project
    - [ ] Require owner role
    - [ ] Support partial updates
  - [ ] `DELETE /api/projects/{id}` - soft delete
    - [ ] Require owner role
    - [ ] Set deleted_at timestamp
- [ ] Create ProjectService with business logic `PROJ §8.1`
  - [ ] Implement CRUD methods
  - [ ] Implement member count queries
  - [ ] Implement updates-since queries
  - [ ] Add transaction boundaries
- [ ] Create ProjectMemberController `API §5`
  - [ ] `GET /api/projects/{id}/members` - list members
    - [ ] Include user details (name, email)
    - [ ] Include role and join date
  - [ ] `POST /api/projects/{id}/members` - add member
    - [ ] Require owner role
    - [ ] Validate user exists
    - [ ] Prevent duplicate membership
  - [ ] `PATCH /api/projects/{id}/members/{memberId}` - update role
    - [ ] Require owner role
    - [ ] Validate role value (viewer|editor|owner)
  - [ ] `DELETE /api/projects/{id}/members/{memberId}` - remove member
    - [ ] Require owner role
    - [ ] Prevent removing last owner
- [ ] Implement role-based authorization `PROJ §2.3-2.4, API §10`
  - [ ] Use AuthorizationService for all endpoints
  - [ ] Viewer: can read project and threads
  - [ ] Editor: can create threads, upload files
  - [ ] Owner: can manage members, delete project
- [ ] Add `GET /api/projects/{id}/updates` for polling `TLC §4.3, API §4.9`
  - [ ] Accept `since` query parameter (ISO8601 timestamp)
  - [ ] Return counts: threads_updated, members_updated, workflows_updated
  - [ ] Return latest update timestamp
- [ ] Add `GET /api/projects/{id}/threads` `API §4.7`
  - [ ] Filter threads by project_id
  - [ ] Support pagination
  - [ ] Include thread metadata
- [ ] Add `GET /api/projects/{id}/workflows` `API §4.8`
  - [ ] Filter workflows by project scope and owner_id
  - [ ] Support pagination

**Acceptance Criteria:**
- Project creator automatically added as owner `PROJ §7.1`
- Member roles enforced on all operations `PROJ §2.4`
- Cannot remove last owner from project `API §5.4`
- Updates endpoint returns changes since timestamp `TLC §4.3`

---

#### E1-S5: Authorization Service
**Size:** S
**Description:** Centralized authorization checks for project resources.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Authorization service design | API | §10 |
| Permission matrix | PROJ | §2.4 |
| Role definitions | PROJ | §2.3 |

**Tasks:**
- [ ] Create AuthorizationService class `API §10.1`
  - [ ] Create service class with ProjectMemberRepository dependency
  - [ ] Define AccessDeniedException for authorization failures
  - [ ] Add logging for authorization decisions
- [ ] Implement `getUserRoleInProject()` `API §10.1`
  - [ ] Query project_members by (project_id, user_id)
  - [ ] Check expires_at is null or in future
  - [ ] Return role (viewer|editor|owner) or null if not member
  - [ ] Cache result for request duration
- [ ] Implement `requireProjectAccess()` `API §10.1`
  - [ ] Accept projectId and minimum required role
  - [ ] Get user's role via getUserRoleInProject()
  - [ ] Compare role hierarchy (viewer < editor < owner)
  - [ ] Throw AccessDeniedException if insufficient
- [ ] Implement `requireThreadAccess()` `API §10.1`
  - [ ] Check if thread is personal (owner = current user)
  - [ ] If project thread, delegate to requireProjectAccess()
  - [ ] Handle deleted threads (return 404, not 403)
- [ ] Implement `requireThreadModify()` `API §10.1`
  - [ ] For personal threads: require owner
  - [ ] For project threads: require editor role for own messages
  - [ ] For project threads: require owner for others' messages
- [ ] Add unit tests for all permission scenarios `PROJ §2.4`
  - [ ] Test viewer role read access (allowed)
  - [ ] Test viewer role create access (denied)
  - [ ] Test editor role create access (allowed)
  - [ ] Test editor role delete others' content (denied)
  - [ ] Test owner role full access (allowed)
  - [ ] Test expired membership (denied)
  - [ ] Test non-member access (denied)

**Acceptance Criteria:**
- Viewer role can read but not create `PROJ §2.3`
- Editor role can create and modify own content `PROJ §2.3`
- Owner role can modify any content `PROJ §2.3`
- Expired memberships are rejected `PROJ §2.2`

---

## Epic 2: Thread Branching

**Owner:** Dev A
**Priority:** P0
**Description:** Message tree structure with retry branching and enhanced clipboard operations.

### Stories

#### E2-S1: Message Tree Data Model (Desktop)
**Size:** M
**Description:** Update desktop message model and repository for tree structure.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Message interface update | TM | §2.1 |
| Context assembly | TM | §2.3 |
| Branch limit check | TM | §2.2 |
| Cache support | TLC | §3.1 |

**Tasks:**
- [ ] Add `parentMessageId`, `branchIndex` to Message interface `TM §2.1`
  - [ ] Update `src/types/message.ts` with new fields
  - [ ] Add TypeScript types for branching (parentMessageId: string | null)
  - [ ] Add branchIndex: number (0-9) type constraint
  - [ ] Update message creation functions
- [ ] Update MessageRepository for tree queries `ARCH §5.2`
  - [ ] Add `getMessagesByParentId(parentId)` method
  - [ ] Add `getBranchesForMessage(messageId)` method
  - [ ] Add `getRootMessages(threadId)` for messages with null parent
  - [ ] Update `getMessagesForThread()` to include branch info
- [ ] Implement `assembleContext()` for branch path `TM §2.3`
  - [ ] Walk up tree from current message via parentMessageId
  - [ ] Collect messages in reverse order (root → current)
  - [ ] Handle branch selection (follow branchIndex on each level)
  - [ ] Return ordered array of messages for LLM context
- [ ] Implement `getNextBranchIndex()` with limit check `TM §2.2`
  - [ ] Query existing branches for given parentMessageId
  - [ ] Find max branchIndex currently used
  - [ ] Return next index if < 2, else throw error
  - [ ] Return clear error message for UI display
- [ ] Add local cache support for branched messages `TLC §3.1`
  - [ ] Update cache key structure to include branch info
  - [ ] Invalidate branch cache when new branch created
  - [ ] Cache context assembly results for performance

**Acceptance Criteria:**
- Messages form valid tree via parentMessageId `TM §2.1`
- Context assembly follows correct branch path `TM §2.3`
- Branch limit (2) enforced locally before API call `TM §2.2`

---

#### E2-S2: Retry Flow Implementation
**Size:** L
**Description:** Implement retry button and branch creation flow with attachment handling.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Retry button behavior | TM | §3.1 |
| Branch creation flow | TM | §3.2 |
| Error handling | TM | §3.3 |
| Branch attachment behavior | ARCH | §3.2 |

**Tasks:**
- [ ] Add Retry button to user messages `TM §3.1`
  - [ ] Create RetryButton component
  - [ ] Show only on user role messages (not assistant/system)
  - [ ] Position in message action bar (hover reveal)
  - [ ] Disable if branch limit reached (show tooltip explaining why)
- [ ] Implement `createRetry()` in ThreadService `TM §3.2`
  - [ ] Calculate next branchIndex via getNextBranchIndex()
  - [ ] Set parentMessageId to parent of original message
  - [ ] Create new user message with updated prompt
  - [ ] Submit to API and await assistant response
  - [ ] Handle streaming response
- [ ] Show prompt input with original text copied `TM §3.1`
  - [ ] Create RetryInputModal or expand existing input
  - [ ] Pre-populate with original message content
  - [ ] Focus input and select all text
  - [ ] Show "Retry" button instead of "Send"
- [ ] Copy attachment references to retry input (shared references) `ARCH §3.2`
  - [ ] Get attachments array from original message
  - [ ] Create shallow copy of attachment objects (same fileIds)
  - [ ] Display as editable attachment chips
  - [ ] Do NOT duplicate file content
- [ ] Allow user to remove attachments before submitting `ARCH §3.2`
  - [ ] Add X button to each attachment chip
  - [ ] Remove from local array (not from storage)
  - [ ] Update UI to reflect removal
- [ ] Allow user to add new attachments before submitting `ARCH §3.2`
  - [ ] Enable file picker / drag-drop on retry input
  - [ ] Upload new files (new fileIds)
  - [ ] Add to attachments array
- [ ] Submit retry with correct parentMessageId and branchIndex `TM §3.2`
  - [ ] Use parent of original message as parentMessageId
  - [ ] Use calculated branchIndex
  - [ ] Include modified attachments array
  - [ ] Generate client_message_id for idempotency
- [ ] Handle branch limit error gracefully `TM §3.3`
  - [ ] Catch "Maximum retry branches reached" error
  - [ ] Show user-friendly toast message
  - [ ] Keep retry modal open so user doesn't lose edits
  - [ ] Suggest deleting an existing branch

**Acceptance Criteria:**
- Retry button visible on user messages (not assistant) `TM §3.1`
- Clicking Retry opens input with original prompt `TM §3.1`
- Original attachments shown as editable chips `ARCH §3.2`
- User can remove/add attachments before submitting `ARCH §3.2`
- Kept attachments use shared fileId references (not copies) `ARCH §3.2`
- User can edit prompt before submitting `TM §3.1`
- Clear error message when branch limit reached `TM §3.3`

---

#### E2-S3: Branch Visualization UI
**Size:** L
**Description:** Visual lane-based display for branched conversations.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Branch visualization | TM | §5 |
| Lane component design | ARCH | §8.1 |

**Tasks:**
- [ ] Design branch lane component `TM §5.1`
  - [ ] Create BranchLane.svelte component
  - [ ] Define lane width, spacing, border styles
  - [ ] Add lane header showing branch number (e.g., "Branch 1")
  - [ ] Style active vs inactive lane states
- [ ] Render single column until branch point `TM §5.2`
  - [ ] Detect messages with multiple children (branch points)
  - [ ] Render linear messages in single column
  - [ ] Insert branch indicator at fork point
  - [ ] Show "Branch" icon/badge at fork
- [ ] Split into 2-3 lanes at branch points `TM §5.2`
  - [ ] Calculate lane layout based on branch count
  - [ ] Use CSS grid or flexbox for lane positioning
  - [ ] Ensure lanes align horizontally at branch point
  - [ ] Connect lanes to parent with visual connector lines
- [ ] Highlight active branch `TM §5.3`
  - [ ] Track active branch index in store
  - [ ] Apply highlight style (border, background) to active lane
  - [ ] Dim/fade inactive lanes slightly
  - [ ] Update active branch on lane click
- [ ] Implement branch collapse/expand `TM §5.4`
  - [ ] Add collapse button to lane header
  - [ ] Animate collapse/expand transition
  - [ ] Show collapsed state indicator (e.g., "2 messages hidden")
  - [ ] Persist collapse state in local storage
- [ ] Handle nested branches (branch within branch) `TM §5.5`
  - [ ] Support recursive lane rendering
  - [ ] Limit visual depth to 2 levels
  - [ ] Show "View full branch" link for deeper nesting
  - [ ] Test with complex branch scenarios

**Acceptance Criteria:**
- Clear visual distinction between lanes `TM §5.1`
- Active lane highlighted `TM §5.3`
- Lanes independently scrollable `TM §5.2`
- Collapse hides inactive branches `TM §5.4`
- Works with up to 2 levels of nesting `TM §5.5`

---

#### E2-S4: Auto-Title Generation
**Size:** S
**Description:** Automatically generate thread title after 2nd exchange.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Auto-title trigger | TM | §4.1 |
| Title generation | TM | §4.2 |
| Title constraints | TM | §4.3 |

**Tasks:**
- [ ] Detect 2nd exchange completion (4 messages on main branch) `TM §4.1`
  - [ ] Count messages on branchIndex=0 path
  - [ ] Check for user→assistant→user→assistant pattern
  - [ ] Only trigger on main branch (not retry branches)
  - [ ] Add flag to prevent duplicate triggers
- [ ] Generate title using thread's configured model `TM §4.2`
  - [ ] Get first 2 exchanges (4 messages) as context
  - [ ] Build title generation prompt (system + context)
  - [ ] Call LLM via thread's model configuration
  - [ ] Parse response and extract title (strip quotes, truncate)
  - [ ] Handle generation errors gracefully
- [ ] Update thread title in UI `TM §4.2`
  - [ ] Update threadStore with new title
  - [ ] Update thread list sidebar
  - [ ] Show subtle animation on title update
- [ ] Allow manual title editing `TM §4.3`
  - [ ] Make title clickable to edit
  - [ ] Show inline text input on click
  - [ ] Save on blur or Enter key
  - [ ] Cancel on Escape key
- [ ] Skip if title already exists `TM §4.1`
  - [ ] Check thread.title !== null before triggering
  - [ ] Respect manually-set titles

**Acceptance Criteria:**
- Title generated after 2nd assistant response `TM §4.1`
- Title max 50 characters `TM §4.2`
- Title editable by user `TM §4.3`
- No duplicate generation calls `TM §4.1`

---

#### E2-S5: Clipboard - Copy Operations
**Size:** M
**Description:** Implement copy-to-input and copy-to-clipboard features.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Copy prompt button | TM | §6.1 |
| Copy response button | TM | §6.2 |
| Copy code button | TM | §6.3 |
| Clipboard formats | TM | §6.4 |

**Tasks:**
- [ ] Add Copy button to user messages (copies to input) `TM §6.1`
  - [ ] Create CopyToInputButton component
  - [ ] Position in message action bar
  - [ ] On click: set input value to message content
  - [ ] Focus input box after copying
- [ ] Add Copy Response button to assistant messages `TM §6.2`
  - [ ] Create CopyResponseButton component
  - [ ] Use Electron clipboard API via IPC
  - [ ] Handle both plain text and formatted content
- [ ] Add Copy Code button to code blocks `TM §6.3`
  - [ ] Add button overlay to CodeBlock component
  - [ ] Show on hover in top-right corner
  - [ ] Copy only the code content (no backticks/language)
  - [ ] Show language name as tooltip
- [ ] Implement text and markdown format options `TM §6.4`
  - [ ] Add dropdown to Copy Response button
  - [ ] "Copy as Text" - strip markdown formatting
  - [ ] "Copy as Markdown" - preserve formatting
  - [ ] Remember last selection in preferences
- [ ] Show confirmation toast on copy `CORE §8.2`
  - [ ] Use NotificationService for toast
  - [ ] Show "Copied to clipboard" message
  - [ ] Auto-dismiss after 2 seconds

**Acceptance Criteria:**
- Copy (user message) populates input box, focuses it `TM §6.1`
- Copy Response copies to system clipboard `TM §6.2`
- Copy Code copies code block content only `TM §6.3`
- Toast shows "Copied to clipboard" `CORE §8.2`

---

#### E2-S6: Clipboard - Paste Operations
**Size:** M
**Description:** Handle paste with support for images and files.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Paste handling | TM | §6.5 |
| Image paste | TM | §6.6 |
| File validation | FS | §3.2 |

**Tasks:**
- [ ] Handle text paste (default behavior) `TM §6.5`
  - [ ] Listen for paste event on input element
  - [ ] Check clipboard for text/plain data
  - [ ] Insert text at cursor position
  - [ ] Preserve default browser behavior
- [ ] Detect and handle image paste (screenshot) `TM §6.6`
  - [ ] Check clipboard for image/png or image/jpeg types
  - [ ] Read image data as Blob from clipboard
  - [ ] Generate unique filename (screenshot-{timestamp}.png)
  - [ ] Create preview thumbnail
- [ ] Detect and handle file paste `TM §6.6`
  - [ ] Check clipboard for files (DataTransferItemList)
  - [ ] Extract file objects from clipboard
  - [ ] Support multiple files in single paste
- [ ] Convert pasted images to pending attachments `TM §6.6`
  - [ ] Create PendingAttachment object with blob data
  - [ ] Add to pendingAttachments array in input state
  - [ ] Display as attachment chip below input
  - [ ] Show thumbnail for images
- [ ] Validate file type and size before attaching `FS §3.2`
  - [ ] Check file extension against allowlist
  - [ ] Check MIME type against allowlist
  - [ ] Verify file size ≤ max limit (e.g., 10MB)
  - [ ] Show error toast for invalid files with specific reason
  - [ ] Reject and do not add invalid files

**Acceptance Criteria:**
- Pasting text works in input box `TM §6.5`
- Pasting image creates attachment preview `TM §6.6`
- Pasting file creates attachment preview `TM §6.6`
- Invalid files show error toast `FS §3.2`

---

## Epic 3: Project Collaboration

**Owner:** Dev B
**Priority:** P0
**Description:** Project creation, member management, and thread sharing.

### Stories

#### E3-S1: Project Service (Desktop)
**Size:** M
**Description:** Desktop service layer for project operations.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| ProjectService design | PROJ | §8.1 |
| CRUD operations | PROJ | §5.1 |
| Member management | PROJ | §5.2 |
| API client integration | ARCH | §2.3 |

**Tasks:**
- [ ] Create ProjectService class `PROJ §8.1`
  - [ ] Create `src/services/ProjectService.ts`
  - [ ] Inject MokuAPIClient dependency
  - [ ] Inject ProjectCache dependency
  - [ ] Add TypeScript interface for service methods
- [ ] Implement CRUD operations `PROJ §5.1`
  - [ ] `listProjects()` - get all user's projects
  - [ ] `getProject(id)` - get single project with members
  - [ ] `createProject(data)` - create new project
  - [ ] `updateProject(id, data)` - update project metadata
  - [ ] `deleteProject(id)` - soft delete project
- [ ] Implement member management methods `PROJ §5.2`
  - [ ] `getMembers(projectId)` - list project members
  - [ ] `addMember(projectId, userId, role)` - invite member
  - [ ] `updateMemberRole(projectId, memberId, role)` - change role
  - [ ] `removeMember(projectId, memberId)` - remove member
- [ ] Integrate with MokuAPI client `ARCH §2.3`
  - [ ] Use MokuAPIClient for all HTTP requests
  - [ ] Pass auth headers from AuthService
  - [ ] Handle pagination for list operations
- [ ] Add error handling and retry logic `ARCH §5.1`
  - [ ] Catch HTTP errors and transform to domain errors
  - [ ] Implement retry for transient failures (5xx, network)
  - [ ] Max 3 retries with exponential backoff
  - [ ] Surface user-friendly error messages

**Acceptance Criteria:**
- All project operations work online `PROJ §5`
- Errors surface to UI with clear messages `CORE §8.2`
- Operations use correct authorization headers `CORE §1`

---

#### E3-S2: Project Cache
**Size:** M
**Description:** Caching layer for project data with TTL.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| ProjectCache design | PROJ | §8.2 |
| TTL configuration | TLC | §3.1 |
| Cache invalidation | TLC | §3.4 |

**Tasks:**
- [ ] Create ProjectCache class `PROJ §8.2`
  - [ ] Create `src/cache/ProjectCache.ts`
  - [ ] Use Map or LRU cache for storage
  - [ ] Define CacheEntry type with data, timestamp, TTL
  - [ ] Implement `get(key)`, `set(key, value, ttl)`, `delete(key)`
- [ ] Implement project list cache (10 min TTL) `PROJ §8.2`
  - [ ] Cache key: `projects:list`
  - [ ] Store array of project summaries
  - [ ] Check TTL on get, return null if expired
  - [ ] Auto-refresh on cache miss
- [ ] Implement member cache (5 min TTL) `PROJ §8.2`
  - [ ] Cache key: `projects:{id}:members`
  - [ ] Store array of member objects
  - [ ] Shorter TTL since membership changes more frequently
- [ ] Add cache invalidation methods `TLC §3.4`
  - [ ] `invalidateProject(id)` - clear specific project
  - [ ] `invalidateProjectList()` - clear list cache
  - [ ] `invalidateMembers(projectId)` - clear member cache
  - [ ] `clearAll()` - clear entire cache (logout)
- [ ] Integrate with polling service `TLC §4.2`
  - [ ] Expose method to receive polling updates
  - [ ] Invalidate relevant caches when updates detected
  - [ ] Emit event for UI refresh

**Acceptance Criteria:**
- Cache reduces API calls for repeated access `TLC §3.1`
- TTL expiry triggers fresh fetch `TLC §3.2`
- Manual invalidation works `TLC §3.4`
- Cache cleared on logout `TLC §3.4`

---

#### E3-S3: Project Polling Service
**Size:** S
**Description:** Poll for project updates to invalidate cache.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Polling service design | TLC | §4.2 |
| Polling interval | TLC | §4.1 |
| Update detection | TLC | §4.3 |

**Tasks:**
- [ ] Create ProjectPollingService `TLC §4.2`
  - [ ] Create `src/services/ProjectPollingService.ts`
  - [ ] Inject MokuAPIClient and ProjectCache
  - [ ] Track active project ID
  - [ ] Use setInterval for polling loop
- [ ] Poll active project every 30 seconds `TLC §4.1`
  - [ ] Start polling when `startPolling(projectId)` called
  - [ ] Stop polling when `stopPolling()` called
  - [ ] Clear interval on stop
  - [ ] Handle app sleep/resume (restart polling)
- [ ] Call `/api/projects/{id}/updates` `TLC §4.3`
  - [ ] Store last-checked timestamp
  - [ ] Pass `since` parameter with last timestamp
  - [ ] Parse response for update counts
  - [ ] Update last-checked timestamp on success
- [ ] Invalidate cache when changes detected `TLC §4.2`
  - [ ] Check threads_updated count
  - [ ] Check members_updated count
  - [ ] Check workflows_updated count
  - [ ] Call relevant cache invalidation methods
- [ ] Emit event for UI refresh `TLC §4.4`
  - [ ] Use EventEmitter or Svelte store
  - [ ] Emit `project:updates-available` event
  - [ ] Include counts in event payload

**Acceptance Criteria:**
- Polling starts when project opened `TLC §4.2`
- Polling stops when project closed `TLC §4.2`
- Updates detected within 30 seconds `TLC §4.1`
- UI shows "Updates available" banner `TLC §4.4`

---

#### E3-S4: Project Sidebar UI
**Size:** M
**Description:** Project list and navigation in primary sidebar.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Sidebar layout | ARCH | §8.1 |
| Project list display | PROJ | §7.1 |
| Project metadata (color, icon) | PROJ | §2.1 |

**Tasks:**
- [ ] Add Projects section to sidebar `ARCH §8.1`
  - [ ] Create ProjectsSidebar.svelte component
  - [ ] Add collapsible section header "Projects"
  - [ ] Position below Threads section
  - [ ] Add expand/collapse toggle with persistence
- [ ] Show project list with icons/colors `PROJ §2.1`
  - [ ] Create ProjectListItem.svelte component
  - [ ] Display project icon (emoji or default)
  - [ ] Apply project color to accent/border
  - [ ] Truncate long project names with ellipsis
  - [ ] Subscribe to projectsStore for data
- [ ] Add "New Project" button `PROJ §7.1`
  - [ ] Add + button in section header
  - [ ] Style as icon button
  - [ ] On click: open ProjectCreationDialog
- [ ] Implement project selection `PROJ §7.1`
  - [ ] Track selected project in store
  - [ ] Highlight selected project item
  - [ ] On click: navigate to project view
  - [ ] Start polling for selected project
- [ ] Show member count badge `PROJ §2.1`
  - [ ] Add badge/pill to project item
  - [ ] Show count from project.memberCount
  - [ ] Use subtle styling (gray background)

**Acceptance Criteria:**
- Projects appear below Threads in sidebar `ARCH §8.1`
- Project color/icon visible `PROJ §2.1`
- Click opens project view `PROJ §7.1`
- New Project opens creation dialog `PROJ §7.1`

---

#### E3-S5: Project Creation Dialog
**Size:** S
**Description:** Dialog for creating new projects.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Creation workflow | PROJ | §7.1 |
| Project fields | PROJ | §2.1 |
| Validation rules | API | §4.3 |

**Tasks:**
- [ ] Create project creation modal `PROJ §7.1`
  - [ ] Create ProjectCreationDialog.svelte component
  - [ ] Use modal/dialog pattern with backdrop
  - [ ] Add close button (X) and Cancel button
  - [ ] Focus trap within modal
  - [ ] Close on Escape key
- [ ] Form fields: name, description, color, icon `PROJ §2.1`
  - [ ] Name input (text, required)
  - [ ] Description textarea (optional, max 500 chars)
  - [ ] Color picker (predefined palette)
  - [ ] Icon picker (emoji selector or icon grid)
- [ ] Validation (name required, max lengths) `API §4.3`
  - [ ] Validate name not empty
  - [ ] Validate name ≤ 100 characters
  - [ ] Validate description ≤ 500 characters
  - [ ] Show inline error messages
  - [ ] Disable Create button until valid
- [ ] Create project via ProjectService `PROJ §8.1`
  - [ ] Call projectService.createProject()
  - [ ] Show loading state on Create button
  - [ ] Handle API errors (show toast)
- [ ] Navigate to new project on success `PROJ §7.1`
  - [ ] Close modal
  - [ ] Select new project in sidebar
  - [ ] Navigate to project detail view
  - [ ] Invalidate project list cache

**Acceptance Criteria:**
- Modal opens from "New Project" button `PROJ §7.1`
- Validation errors shown inline `UI §4`
- Success creates project and navigates `PROJ §7.1`
- Cancel closes without action `UI §4`

---

#### E3-S6: Project Detail View
**Size:** L
**Description:** Main project view with tabs for content.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Project view layout | ARCH | §8.1 |
| Tabs structure | PROJ | §1.1 |
| Thread list in project | PROJ | §4.1 |

**Tasks:**
- [ ] Create ProjectView component `ARCH §8.1`
  - [ ] Create ProjectView.svelte as main container
  - [ ] Accept projectId as prop/route param
  - [ ] Load project data on mount
  - [ ] Handle loading and error states
- [ ] Implement Threads tab `PROJ §4.1`
  - [ ] Create ProjectThreadsTab.svelte component
  - [ ] Fetch threads for project via ProjectService
  - [ ] Display thread list similar to personal threads
  - [ ] Add "New Thread" button for edit+ roles
  - [ ] Show empty state when no threads
- [ ] Implement Workflows tab (placeholder) `PROJ §4.2`
  - [ ] Create ProjectWorkflowsTab.svelte component
  - [ ] Show "Coming soon" or basic list placeholder
  - [ ] Wire up to WorkflowService when ready
- [ ] Implement Files tab (placeholder) `PROJ §4.3`
  - [ ] Create ProjectFilesTab.svelte component
  - [ ] Show "Coming soon" or basic list placeholder
  - [ ] Wire up to FileService when ready
- [ ] Implement Members tab `PROJ §5.2`
  - [ ] Create ProjectMembersTab.svelte component
  - [ ] Fetch members via ProjectService
  - [ ] Display member list with roles
  - [ ] Show admin controls if user is admin
- [ ] Show project header with settings `PROJ §2.1`
  - [ ] Create ProjectHeader.svelte component
  - [ ] Display project name, icon, color
  - [ ] Add Settings gear icon (admin only)
  - [ ] Settings opens ProjectSettingsDialog

**Acceptance Criteria:**
- All tabs navigable `PROJ §1.1`
- Threads tab shows project threads `PROJ §4.1`
- Members tab shows member list `PROJ §5.2`
- Settings accessible to admins only `PROJ §2.4`

---

#### E3-S7: Member Management UI
**Size:** M
**Description:** UI for adding, removing, and updating project members.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Member list display | PROJ | §5.2 |
| Add member workflow | PROJ | §7.2 |
| Role management | PROJ | §2.3-2.4 |

**Tasks:**
- [ ] Create MembersTab component `PROJ §5.2`
  - [ ] Create MembersTab.svelte component
  - [ ] Subscribe to members store
  - [ ] Layout as list or table
  - [ ] Add section header "Members"
- [ ] Display member list with roles `PROJ §5.2`
  - [ ] Create MemberListItem.svelte component
  - [ ] Show user avatar (initials or image)
  - [ ] Display user name and email
  - [ ] Show role badge (Admin/Edit/View)
  - [ ] Show join date
- [ ] Add "Invite Member" button (admin only) `PROJ §7.2`
  - [ ] Conditionally show based on user role
  - [ ] Position in section header
  - [ ] On click: open InviteMemberDialog
  - [ ] Create InviteMemberDialog.svelte
  - [ ] Form: email input, role selector
- [ ] Implement role change dropdown (admin only) `PROJ §2.4`
  - [ ] Add role dropdown to MemberListItem
  - [ ] Show only for admin users
  - [ ] Options: View, Edit, Admin
  - [ ] Call projectService.updateMemberRole on change
  - [ ] Show loading state during update
- [ ] Implement remove member (admin only) `PROJ §2.4`
  - [ ] Add remove button (trash icon)
  - [ ] Show only for admin users
  - [ ] Show confirmation dialog before removal
  - [ ] Call projectService.removeMember on confirm
  - [ ] Handle "last admin" error gracefully
- [ ] Show pending invitations `PROJ §7.2`
  - [ ] Separate section for pending invites
  - [ ] Show invited email and role
  - [ ] Add "Cancel Invite" button
  - [ ] Show "Pending" status badge

**Acceptance Criteria:**
- Members list shows name, email, role `PROJ §5.2`
- Role change updates immediately `PROJ §2.4`
- Cannot remove last admin (error shown) `PROJ §5.2`
- Non-admins see read-only list `PROJ §2.4`

---

#### E3-S8: Thread Move Functionality
**Size:** M
**Description:** Move threads between personal and project contexts.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Thread movement rules | TLC | §1.5 |
| Move API | TLC | §1.5, API §3.6 |
| File migration | PROJ | §3.2 |

**Tasks:**
- [ ] Add "Move to Project" context menu item `PROJ §7.4`
  - [ ] Add context menu to thread list items
  - [ ] Include "Move to Project..." option
  - [ ] Also add "Move to Personal" for project threads
  - [ ] Disable if user doesn't have edit permission
- [ ] Show project selection dialog `PROJ §7.4`
  - [ ] Create MoveThreadDialog.svelte component
  - [ ] Fetch user's projects with edit+ role
  - [ ] Display as selectable list
  - [ ] Show project name, icon, color
  - [ ] Add "Move" and "Cancel" buttons
- [ ] Call move API with target `TLC §1.5, API §3.6`
  - [ ] Call `PATCH /api/threads/{id}` with new projectId
  - [ ] Set projectId to null for "Move to Personal"
  - [ ] Show loading state during move
  - [ ] Handle errors (toast message)
- [ ] Update local cache after move `TLC §3.4`
  - [ ] Remove thread from source list cache
  - [ ] Add thread to target list cache
  - [ ] Invalidate both project caches
  - [ ] Update thread store
- [ ] Handle file migration for project threads `PROJ §3.2, §7.5`
  - [ ] Detect threads with local attachments
  - [ ] Upload local files to Storage Service
  - [ ] Update attachment references to new fileIds
  - [ ] Show progress for file migration
  - [ ] Handle migration errors gracefully

**Acceptance Criteria:**
- Move option in thread context menu `PROJ §7.4`
- Only shows projects user can edit `TLC §1.5`
- Thread appears in target after move `PROJ §7.4`
- Files migrate to Storage Service for project threads `PROJ §3.2`

---

## Epic 4: Desktop Core

**Owner:** Peter
**Priority:** P0
**Description:** Platform infrastructure for notifications, state persistence, and deep linking.

### Stories

#### E4-S1: Notification System
**Size:** M
**Description:** System and in-app notifications.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| System notifications | CORE | §8.1 |
| Toast notifications | CORE | §8.2 |
| Notification history | CORE | §8.3 |
| Notification settings | CORE | §8.4 |

**Tasks:**
- [ ] Create NotificationService `CORE §8`
  - [ ] Create `src/services/NotificationService.ts`
  - [ ] Define notification types enum (info, success, warning, error)
  - [ ] Define NotificationPayload interface
  - [ ] Implement singleton pattern for service
- [ ] Implement system notifications (Electron Notification API) `CORE §8.1`
  - [ ] Use Electron's Notification class via IPC
  - [ ] Create main process handler for notifications
  - [ ] Support title, body, icon fields
  - [ ] Handle click action (bring app to focus)
  - [ ] Respect OS notification settings
- [ ] Implement toast notifications (in-app) `CORE §8.2`
  - [ ] Create Toast.svelte component
  - [ ] Create ToastContainer.svelte for positioning
  - [ ] Support multiple concurrent toasts
  - [ ] Auto-dismiss after configurable duration (default 3s)
  - [ ] Add dismiss button (X)
  - [ ] Style by type (info=blue, success=green, etc.)
- [ ] Add notification history store `CORE §8.3`
  - [ ] Create notificationHistoryStore
  - [ ] Store last N notifications (e.g., 50)
  - [ ] Include timestamp, type, message, read status
  - [ ] Add `markAsRead(id)` and `clearAll()` methods
- [ ] Add notification settings (enable/disable, types) `CORE §8.4`
  - [ ] Add notification section to settings page
  - [ ] Toggle: Enable system notifications
  - [ ] Toggle: Enable sound
  - [ ] Checkboxes for notification types
  - [ ] Persist settings in StateStore

**Acceptance Criteria:**
- System notifications appear in OS notification center `CORE §8.1`
- Toasts appear in-app with auto-dismiss `CORE §8.2`
- Notification history accessible `CORE §8.3`
- Settings persist across sessions `CORE §8.4`

---

#### E4-S2: State Persistence
**Size:** M
**Description:** Persist window state and user preferences.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Window state | CORE | §9.1 |
| User preferences | CORE | §9.2 |
| Application state | CORE | §9.3 |
| State migration | CORE | §9.4 |

**Tasks:**
- [ ] Create StateStore service `CORE §9`
  - [ ] Create `src/services/StateStore.ts`
  - [ ] Use electron-store or similar for persistence
  - [ ] Define StateSchema interface
  - [ ] Add `get(key)`, `set(key, value)`, `delete(key)` methods
- [ ] Save/restore window position and size `CORE §9.1`
  - [ ] Listen for window resize/move events
  - [ ] Debounce save (save after 500ms of no changes)
  - [ ] Store x, y, width, height, maximized state
  - [ ] Restore on app launch
  - [ ] Handle multi-monitor changes gracefully
- [ ] Save/restore sidebar states `CORE §9.1`
  - [ ] Track sidebar collapsed/expanded state
  - [ ] Track sidebar width (if resizable)
  - [ ] Track which sections are expanded
  - [ ] Restore on app launch
- [ ] Save/restore user preferences `CORE §9.2`
  - [ ] Theme (light/dark/system)
  - [ ] Font size preference
  - [ ] Default model selection
  - [ ] Notification preferences
  - [ ] Last active project/thread
- [ ] Implement state versioning and migration `CORE §9.4`
  - [ ] Add version field to stored state
  - [ ] Define migration functions for each version
  - [ ] Run migrations on app startup
  - [ ] Handle corrupt state (reset to defaults)
  - [ ] Log migration actions

**Acceptance Criteria:**
- Window opens at last position/size `CORE §9.1`
- Sidebar collapse state remembered `CORE §9.1`
- Theme preference remembered `CORE §9.2`
- Old state formats migrated `CORE §9.4`

---

#### E4-S3: Deep Link Handler
**Size:** M
**Description:** Handle `holokai://` protocol links.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Protocol registration | CORE | §10.1 |
| Route table | CORE | §10.2 |
| Link handling | CORE | §10.3-10.4 |

**Tasks:**
- [ ] Register protocol handler `CORE §10.1`
  - [ ] Register `holokai://` protocol in main process
  - [ ] Use app.setAsDefaultProtocolClient() on Windows/Linux
  - [ ] Configure Info.plist for macOS
  - [ ] Handle protocol during app packaging
- [ ] Parse deep link routes `CORE §10.2`
  - [ ] Create DeepLinkParser utility
  - [ ] Extract route type (thread, project, workflow, settings)
  - [ ] Extract route parameters (id, etc.)
  - [ ] Validate URL format and parameters
  - [ ] Handle malformed URLs gracefully
- [ ] Implement route handlers (thread, project, workflow, settings) `CORE §10.2`
  - [ ] Create DeepLinkRouter service
  - [ ] Handler: `thread/{id}` → navigate to thread view
  - [ ] Handler: `project/{id}` → navigate to project view
  - [ ] Handler: `workflow/{id}` → navigate to workflow view
  - [ ] Handler: `settings` → open settings page
  - [ ] Handler: `settings/{section}` → open specific settings tab
- [ ] Handle links when app is closed (launch and navigate) `CORE §10.3`
  - [ ] Store deep link URL during app launch
  - [ ] Process after app is ready and user authenticated
  - [ ] Navigate to target after initial load
  - [ ] Handle auth required (redirect to login first)
- [ ] Handle links when app is open (navigate) `CORE §10.4`
  - [ ] Listen for second-instance event (Windows/Linux)
  - [ ] Listen for open-url event (macOS)
  - [ ] Focus existing window
  - [ ] Navigate to deep link target

**Acceptance Criteria:**
- `holokai://thread/{id}` opens thread `CORE §10.2`
- `holokai://project/{id}` opens project `CORE §10.2`
- `holokai://settings` opens settings `CORE §10.2`
- Works from browser, email, other apps `CORE §10.3`

---

#### E4-S4: ThreadRepository
**Size:** L
**Description:** Local thread cache with compression, encryption, LRU policy, and lazy loading.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| ThreadRepository interface | ARCH | §3.4 |
| Storage format | ARCH | §3.4 |
| Compression/encryption | ARCH | §3.4 |
| Lazy loading | ARCH | §3.4 |
| Cache policy | ARCH | §3.4 |

**Tasks:**
- [ ] Create ThreadRepository interface and base class `ARCH §3.4`
  - [ ] Create `src/repositories/base.repository.ts` with common utilities
  - [ ] Create `src/repositories/thread.repository.ts`
  - [ ] Define ThreadRepository interface with thread/message operations
  - [ ] Create cache directory at `~/.holokai/cache/threads/`
  - [ ] Add dependency injection for crypto and compression services
- [ ] Implement compression layer `ARCH §3.4`
  - [ ] Use gzip compression for thread data
  - [ ] Compress on write, decompress on read
  - [ ] Target ~70% size reduction for text-heavy threads
  - [ ] Add compression stats to CacheStats
- [ ] Implement encryption layer `ARCH §3.4`
  - [ ] Use AES-256-GCM encryption
  - [ ] Generate per-installation encryption key
  - [ ] Store key securely in OS keychain (keytar)
  - [ ] Encrypt after compression, decrypt before decompression
  - [ ] Handle key rotation (future consideration)
- [ ] Implement thread storage operations `ARCH §3.4`
  - [ ] `saveThread(thread)` - compress, encrypt, write to `{threadId}.dat`
  - [ ] `getThread(id)` - read, decrypt, decompress, update LRU timestamp
  - [ ] `deleteThread(id)` - remove file and update index
  - [ ] `listThreads(options)` - list from index with filtering/sorting
  - [ ] Maintain thread index file for fast listing
- [ ] Implement lazy loading for messages `ARCH §3.4`
  - [ ] `getMessages(threadId, { limit: 50, before?, after? })`
  - [ ] Return `{ messages, hasMore, cursor }` structure
  - [ ] Default chunk size: 50 messages
  - [ ] Support cursor-based pagination (before/after)
  - [ ] Load newest messages first (descending order)
  - [ ] Cache message positions for efficient seeking
- [ ] Implement LRU cache policy `ARCH §3.4`
  - [ ] Track last access time per thread
  - [ ] Implement `evictLRU(targetSizeBytes)` method
  - [ ] Default max cache size: 500MB
  - [ ] Evict oldest accessed threads when over limit
  - [ ] Never evict threads accessed in last 24 hours
  - [ ] Add `getCacheStats()` method (size, count, oldest, newest)
- [ ] Implement cache management utilities `ARCH §3.4`
  - [ ] `clearCache()` - remove all cached threads
  - [ ] Automatic cache cleanup on app startup
  - [ ] Handle corrupt/unreadable cache files gracefully
  - [ ] Log cache operations for debugging
- [ ] Add error handling and recovery `ARCH §3.4`
  - [ ] Handle file system errors gracefully
  - [ ] Recover from corrupt cache files (delete and re-fetch)
  - [ ] Handle encryption/decryption failures
  - [ ] Emit events for cache errors

**Acceptance Criteria:**
- Threads cached locally with compression (gzip) `ARCH §3.4`
- Cache encrypted with AES-256-GCM `ARCH §3.4`
- LRU eviction when cache exceeds 500MB `ARCH §3.4`
- Messages load in chunks of 50 with pagination `ARCH §3.4`
- Corrupt cache files handled gracefully `ARCH §3.4`
- Cache stats available for monitoring `ARCH §3.4`

---

## Epic 5: File Attachments

**Owner:** Dev B
**Priority:** P1
**Depends On:** E3 (Projects)
**Description:** File upload/download with appropriate storage routing.

### Stories

#### E5-S1: File Service (Desktop)
**Size:** M
**Description:** Unified file service with storage routing and reference counting.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| FileService design | ARCH | §5.3 |
| Storage routing | PROJ | §3.2, FS §2.1 |
| Storage Service API | FS | §3 |
| Upload progress | FS | §3.3 |
| Shared references | ARCH | §3.2 |

**Tasks:**
- [ ] Create FileService class `ARCH §5.3`
  - [ ] Create `src/services/FileService.ts`
  - [ ] Inject StorageAPIClient, LocalFileRepository
  - [ ] Define FileMetadata interface
  - [ ] Add `upload()`, `download()`, `delete()` methods
- [ ] Implement storage routing (local vs remote) `PROJ §3.2`
  - [ ] Check thread type (personal vs project)
  - [ ] Personal threads: use LocalFileRepository
  - [ ] Project threads: use StorageAPIClient
  - [ ] Add helper `getStorageTarget(threadId)`
- [ ] Integrate with Storage Service API `FS §3`
  - [ ] Use StorageAPIClient for remote operations
  - [ ] Handle auth headers via AuthService
  - [ ] Map API errors to domain errors
- [ ] Implement presigned URL flow `FS §3.1`
  - [ ] Call `getUploadUrl()` to get presigned URL
  - [ ] Upload file directly to presigned URL (PUT)
  - [ ] Call `confirmUpload()` after successful upload
  - [ ] Store fileId from confirmation response
- [ ] Add upload progress tracking `FS §3.3`
  - [ ] Use XMLHttpRequest or fetch with progress event
  - [ ] Emit progress events (0-100%)
  - [ ] Support progress callback parameter
  - [ ] Update UI with progress percentage
- [ ] Track file references for deletion safety `ARCH §3.2`
  - [ ] Maintain reference count per fileId
  - [ ] Increment when attachment added to message
  - [ ] Decrement when message deleted
  - [ ] Store reference counts in local DB
- [ ] Implement safe delete (only when no message references) `ARCH §3.2`
  - [ ] Check reference count before delete
  - [ ] If count > 0: reject deletion with error
  - [ ] If count == 0: proceed with deletion
  - [ ] Return clear error message for UI

**Acceptance Criteria:**
- Personal thread files stored locally `PROJ §3.1`
- Project thread files stored via Storage Service `PROJ §3.2`
- Progress reported during upload `FS §3.3`
- Errors handled gracefully `FS §3.4`
- File deletion blocked if referenced by any message `ARCH §3.2`
- Storage quota counts unique files only (not references) `ARCH §3.2`

---

#### E5-S2: File Cache (Encrypted)
**Size:** M
**Description:** Local cache for project files with encryption.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| File cache design | PROJ | §3.4 |
| Encryption | ARCH | §7.1, CORE §3 |
| TTL and eviction | PROJ | §3.4, TLC §3.1 |

**Tasks:**
- [ ] Create FileCacheRepository `PROJ §3.4`
  - [ ] Create `src/repositories/FileCacheRepository.ts`
  - [ ] Define cache directory location (app data folder)
  - [ ] Store metadata separately from file content
  - [ ] Implement `get()`, `set()`, `delete()`, `has()` methods
- [ ] Implement AES-256-GCM encryption `ARCH §7.1`
  - [ ] Generate encryption key from user credentials
  - [ ] Use Node.js crypto module
  - [ ] Encrypt file content before writing to disk
  - [ ] Decrypt file content when reading from cache
  - [ ] Store IV with each encrypted file
- [ ] Set 3-day TTL for cached files `PROJ §3.4`
  - [ ] Store creation timestamp with each cache entry
  - [ ] Check TTL on cache access
  - [ ] Return null for expired entries
  - [ ] Background cleanup of expired files
- [ ] Implement LRU eviction `TLC §3.1`
  - [ ] Track last access time per file
  - [ ] Define max cache size (e.g., 500MB)
  - [ ] Evict least recently used when limit exceeded
  - [ ] Run eviction check after each write
- [ ] Add cache stats for Insights `INS §5`
  - [ ] Track total cache size
  - [ ] Track file count
  - [ ] Track hit/miss ratio
  - [ ] Expose `getStats()` method

**Acceptance Criteria:**
- Files encrypted at rest `ARCH §7.1`
- Cache size respects limits `TLC §3.1`
- Old files evicted automatically `PROJ §3.4`
- Stats available for dashboard `INS §5`

---

#### E5-S3: Attachment UI
**Size:** M
**Description:** UI for viewing and managing attachments.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Attachment preview | TLC | §2.2 |
| Drag-and-drop | UI | §3 |
| Message display | TM | §6.6 |

**Tasks:**
- [ ] Create AttachmentPreview component `TLC §2.2`
  - [ ] Create AttachmentPreview.svelte component
  - [ ] Display thumbnail for images (resize to fit)
  - [ ] Display file icon for non-images
  - [ ] Show filename and file size
  - [ ] Support image, PDF, code file types
- [ ] Implement drag-and-drop zone `UI §3`
  - [ ] Create DropZone.svelte component
  - [ ] Listen for dragenter, dragleave, dragover, drop events
  - [ ] Highlight drop zone on drag over
  - [ ] Accept multiple files
  - [ ] Integrate with message input area
- [ ] Show attachment chips in message `TLC §2.2`
  - [ ] Create AttachmentChip.svelte component
  - [ ] Display filename with truncation
  - [ ] Show file type icon
  - [ ] Add tooltip with full filename and size
  - [ ] Style as inline chip/badge
- [ ] Add download button `TLC §2.4`
  - [ ] Add download icon button to chip
  - [ ] Call FileService.download() on click
  - [ ] Use Electron's download dialog
  - [ ] Show progress during download
  - [ ] Open file after download (optional)
- [ ] Add remove button (before send) `TLC §2.2`
  - [ ] Add X button to pending attachment chips
  - [ ] Remove from pendingAttachments array
  - [ ] Animate removal
  - [ ] Only show for pending (not sent) messages

**Acceptance Criteria:**
- Drag-drop adds files to pending `UI §3`
- Attachments visible in messages `TLC §2.2`
- Click downloads file `TLC §2.4`
- Can remove before sending `TLC §2.2`

---

#### E5-S4: Storage Service Integration
**Size:** S
**Description:** Desktop integration with Storage Service API.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Storage API client | FS | §3 |
| Presigned URL flow | FS | §3.1, PROJ §3.3 |

**Tasks:**
- [ ] Create StorageAPIClient `FS §3`
  - [ ] Create `src/api/StorageAPIClient.ts`
  - [ ] Configure base URL for Storage Service
  - [ ] Inject AuthService for auth headers
  - [ ] Add request/response interceptors
- [ ] Implement getUploadUrl() `FS §3.1, PROJ §3.3`
  - [ ] POST to `/api/storage/upload-url`
  - [ ] Send filename, fileSize, mimeType
  - [ ] Return presigned URL and fileId
  - [ ] Handle quota exceeded error
- [ ] Implement confirmUpload() `FS §3.1, PROJ §3.3`
  - [ ] POST to `/api/storage/confirm/{fileId}`
  - [ ] Send checksum for verification
  - [ ] Return confirmed file metadata
  - [ ] Handle validation errors
- [ ] Implement getDownloadUrl() `FS §3.1, PROJ §3.3`
  - [ ] GET `/api/storage/download-url/{fileId}`
  - [ ] Return presigned download URL
  - [ ] Handle file not found error
  - [ ] Handle expired/deleted file
- [ ] Implement deleteFile() `FS §3.1, PROJ §3.3`
  - [ ] DELETE `/api/storage/{fileId}`
  - [ ] Handle file not found (ignore)
  - [ ] Handle permission denied error
  - [ ] Return success/failure status

**Acceptance Criteria:**
- All Storage Service endpoints accessible `PROJ §3.3`
- Presigned URLs work for upload/download `FS §3.1`
- Errors include meaningful messages `FS §3.4`

---

## Epic 6: Insights Dashboard

**Owner:** Dev A
**Priority:** P1
**Depends On:** E1 (API Foundation)
**Description:** Analytics dashboard and reporting for AI usage.

### Stories

#### E6-S1: Insights API Endpoints
**Size:** M
**Description:** Backend endpoints for insights data.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Dashboard endpoint | API | §7.1 |
| Activity endpoint | API | §7.2 |
| Topics endpoint | API | §7.3 |
| Project activity | API | §7.4 |

**Tasks:**
- [ ] Create InsightsController `API §7`
  - [ ] Create InsightsController.java in Moku backend
  - [ ] Inject InsightsService dependency
  - [ ] Add @RestController annotation
  - [ ] Map to `/api/insights` base path
- [ ] Implement `GET /api/insights/dashboard` `API §7.1`
  - [ ] Create dashboard endpoint method
  - [ ] Return total_threads, total_prompts, total_tokens
  - [ ] Return top_models array (name, count)
  - [ ] Calculate period (default: last 30 days)
  - [ ] Use materialized view or aggregation query
- [ ] Implement `GET /api/insights/activity` `API §7.2`
  - [ ] Accept startDate, endDate, granularity params
  - [ ] Return time-series array (date, prompts, tokens)
  - [ ] Support granularity: hour, day, week, month
  - [ ] Use date_trunc for grouping
  - [ ] Limit result set size
- [ ] Implement `GET /api/insights/topics` (basic) `API §7.3`
  - [ ] Return top topics array
  - [ ] Basic keyword extraction (placeholder for ML)
  - [ ] Include topic name and count
  - [ ] Limit to top 10 topics
- [ ] Implement `GET /api/insights/projects` `API §7.4`
  - [ ] Return per-project metrics
  - [ ] Include thread_count, prompt_count per project
  - [ ] Filter by user's accessible projects
  - [ ] Support date range filtering

**Acceptance Criteria:**
- Dashboard returns summary metrics `INS §1`
- Activity returns time-series data `INS §2`
- Queries performant (<500ms) `INS §1.3`
- Proper date range filtering `INS §2.2`

---

#### E6-S2: Dashboard View
**Size:** M
**Description:** Main insights dashboard UI.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Dashboard layout | INS | §1 |
| Summary cards | INS | §1.1 |
| Recent activity | INS | §1.2 |

**Tasks:**
- [ ] Create InsightsView component `INS §1`
  - [ ] Create InsightsView.svelte component
  - [ ] Add tab navigation (Dashboard, Activity, Desktop Info)
  - [ ] Handle tab state with URL or store
  - [ ] Show loading skeleton on initial load
- [ ] Create DashboardTab with summary cards `INS §1.1`
  - [ ] Create DashboardTab.svelte component
  - [ ] Fetch data from `/api/insights/dashboard`
  - [ ] Layout cards in responsive grid
  - [ ] Add refresh button
- [ ] Show total threads, prompts, tokens `INS §1.1`
  - [ ] Create SummaryCard.svelte component
  - [ ] Card for "Total Threads" with count
  - [ ] Card for "Total Prompts" with count
  - [ ] Card for "Total Tokens" with formatted number
  - [ ] Add icons for each metric type
- [ ] Show recent activity summary `INS §1.2`
  - [ ] Create RecentActivityCard.svelte component
  - [ ] Show last 7 days sparkline chart
  - [ ] Show prompts count for period
  - [ ] Link to full Activity tab
- [ ] Show top models used `INS §1.1`
  - [ ] Create TopModelsCard.svelte component
  - [ ] Display model name and usage count
  - [ ] Show as horizontal bar chart or list
  - [ ] Limit to top 5 models

**Acceptance Criteria:**
- Dashboard loads within 2 seconds `INS §1.3`
- Cards show accurate counts `INS §1.1`
- Responsive layout `UI §6`
- Loading states shown `UI §4`

---

#### E6-S3: Activity Charts
**Size:** M
**Description:** Time-series charts for activity metrics.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Activity view | INS | §2 |
| Time-series data | INS | §2.1 |
| Date range filter | INS | §2.2 |

**Tasks:**
- [ ] Create ActivityTab component `INS §2`
  - [ ] Create ActivityTab.svelte component
  - [ ] Fetch data from `/api/insights/activity`
  - [ ] Handle loading and error states
  - [ ] Add controls section above chart
- [ ] Implement line chart for prompts over time `INS §2.1`
  - [ ] Use Chart.js or similar library
  - [ ] Create LineChart.svelte wrapper component
  - [ ] Plot prompts on y-axis, date on x-axis
  - [ ] Add smooth curve option
  - [ ] Style with theme colors
- [ ] Add date range selector `INS §2.2`
  - [ ] Create DateRangePicker.svelte component
  - [ ] Preset buttons: Last 7 days, 30 days, 90 days
  - [ ] Custom date range inputs
  - [ ] Re-fetch data on range change
- [ ] Add granularity selector (hour/day/week) `INS §2.2`
  - [ ] Create segmented control component
  - [ ] Options: Hour, Day, Week, Month
  - [ ] Enable/disable based on date range
  - [ ] Re-fetch data on granularity change
- [ ] Show totals summary `INS §2.3`
  - [ ] Display total prompts for period
  - [ ] Display total tokens for period
  - [ ] Display average prompts/day
  - [ ] Position above or beside chart

**Acceptance Criteria:**
- Chart renders correctly `INS §2.1`
- Date range updates chart `INS §2.2`
- Granularity changes aggregation `INS §2.2`
- Hover shows data points `INS §2.1`

---

#### E6-S4: Desktop Info View
**Size:** S
**Description:** Local desktop statistics and information.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Desktop info view | INS | §5 |
| Cache statistics | INS | §5.1 |
| Storage usage | INS | §5.2 |

**Tasks:**
- [ ] Create DesktopInfoTab component `INS §5`
  - [ ] Create DesktopInfoTab.svelte component
  - [ ] Layout as info cards/sections
  - [ ] Refresh stats on tab activation
  - [ ] Add manual refresh button
- [ ] Show cache statistics (threads, messages, files) `INS §5.1`
  - [ ] Create CacheStatsCard.svelte component
  - [ ] Display cached thread count
  - [ ] Display cached message count
  - [ ] Display cached file count and size
  - [ ] Get data from CacheService
- [ ] Show storage usage `INS §5.2`
  - [ ] Create StorageUsageCard.svelte component
  - [ ] Calculate total local storage used
  - [ ] Show breakdown: cache, database, logs
  - [ ] Display as progress bar or pie chart
  - [ ] Show available disk space
- [ ] Show application version `INS §5.3`
  - [ ] Create AppInfoCard.svelte component
  - [ ] Display app version from package.json
  - [ ] Display Electron version
  - [ ] Display OS and platform info
  - [ ] Add "Check for Updates" button
- [ ] Add "Clear Cache" button `INS §5.4`
  - [ ] Add button to CacheStatsCard
  - [ ] Show confirmation dialog before clearing
  - [ ] Call CacheService.clearAll() on confirm
  - [ ] Show success toast after clearing
  - [ ] Refresh stats after clearing

**Acceptance Criteria:**
- Stats update on tab open `INS §5`
- Storage shows used/available `INS §5.2`
- Version matches package.json `INS §5.3`
- Clear cache works with confirmation `INS §5.4`

---

#### E6-S5: Report Export
**Size:** S
**Description:** Export insights data to files.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Export formats | INS | §6.3 |
| Export workflow | INS | §6.4 |

**Tasks:**
- [ ] Implement CSV export `INS §6.3`
  - [ ] Create ExportService utility
  - [ ] Convert data array to CSV format
  - [ ] Handle special characters (escape commas, quotes)
  - [ ] Include header row with column names
  - [ ] Support export of activity data
- [ ] Implement JSON export `INS §6.3`
  - [ ] Convert data to JSON format
  - [ ] Pretty-print with indentation
  - [ ] Include data type information
  - [ ] Validate JSON output
- [ ] Add export button to charts `INS §6.4`
  - [ ] Add export dropdown to chart toolbar
  - [ ] Options: Export as CSV, Export as JSON
  - [ ] Position in top-right of chart area
  - [ ] Show loading indicator during export
- [ ] Use native save dialog `UI §4`
  - [ ] Use Electron's dialog.showSaveDialog()
  - [ ] Set appropriate file filters (.csv, .json)
  - [ ] Default to Documents folder
  - [ ] Remember last export location
- [ ] Include metadata in export `INS §6.3`
  - [ ] Add export timestamp
  - [ ] Add date range used
  - [ ] Add granularity setting
  - [ ] Add user/project context

**Acceptance Criteria:**
- CSV opens in Excel/Sheets `INS §6.3`
- JSON is valid and complete `INS §6.3`
- Save dialog allows location choice `UI §4`
- Filename includes date `INS §6.4`

---

## Epic 7: Workflows

**Owner:** Peter
**Priority:** P1
**Depends On:** E1, E3
**Description:** Reusable workflow templates and execution.

### Stories

#### E7-S1: Workflow API Endpoints
**Size:** L
**Description:** Backend endpoints for workflow management.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Workflow CRUD | API | §6.1-6.4 |
| Fork endpoint | API | §6.4 |
| Execute endpoint | API | §6.5 |
| Execution history | API | §6.6-6.7 |

**Tasks:**
- [ ] Create WorkflowController `API §6`
  - [ ] Create WorkflowController.java in Moku backend
  - [ ] Inject WorkflowService dependency
  - [ ] Add @RestController annotation
  - [ ] Map to `/api/workflows` base path
- [ ] Implement CRUD endpoints `API §6.1-6.4`
  - [ ] GET `/api/workflows` - list user's workflows
    - [ ] Support filters: scope, projectId
    - [ ] Support pagination
  - [ ] GET `/api/workflows/{id}` - get workflow details
    - [ ] Include full definition (inputs, steps, outputs)
  - [ ] POST `/api/workflows` - create workflow
    - [ ] Validate definition structure
    - [ ] Set owner_id from JWT
  - [ ] PATCH `/api/workflows/{id}` - update workflow
    - [ ] Require owner or admin permission
  - [ ] DELETE `/api/workflows/{id}` - soft delete
    - [ ] Require owner or admin permission
- [ ] Implement fork endpoint `API §6.4`
  - [ ] POST `/api/workflows/{id}/fork`
  - [ ] Copy workflow definition
  - [ ] Set forked_from to original workflow id
  - [ ] Set new owner_id
  - [ ] Return new workflow
- [ ] Implement execute endpoint `API §6.5`
  - [ ] POST `/api/workflows/{id}/execute`
  - [ ] Accept inputs in request body
  - [ ] Create workflow_execution record
  - [ ] Return execution id
  - [ ] Do NOT run synchronously (desktop handles execution)
- [ ] Implement execution history endpoint `API §6.7`
  - [ ] GET `/api/workflows/{id}/executions`
  - [ ] Return paginated list
  - [ ] Include status, started_at, completed_at
  - [ ] Support filtering by status

**Acceptance Criteria:**
- All CRUD operations work `API §6.1-6.4`
- Fork creates copy with parent reference `API §6.4`
- Execute creates execution record `API §6.5`
- History returns paginated results `API §6.7`

---

#### E7-S2: Workflow Service & Execution Engine (Desktop)
**Size:** L
**Description:** Desktop service for workflow operations and execution engine for running workflows.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| WorkflowService design | ARCH | §5.1 |
| Execution engine | ARCH | §6.1 |
| Step executors | ARCH | §6.1 |
| Execution polling | WF | §4.3 |
| Workflow cache | ARCH | §4.1 |

**Tasks:**
- [ ] Create WorkflowService class `ARCH §5.1`
  - [ ] Create `src/services/WorkflowService.ts`
  - [ ] Inject MokuAPIClient, WorkflowCache
  - [ ] Define Workflow, WorkflowExecution interfaces
- [ ] Implement CRUD operations `PROJ §4.2`
  - [ ] `listWorkflows(filters)` - get user's workflows
  - [ ] `getWorkflow(id)` - get workflow with definition
  - [ ] `createWorkflow(data)` - create new workflow
  - [ ] `updateWorkflow(id, data)` - update workflow
  - [ ] `deleteWorkflow(id)` - delete workflow
- [ ] Implement fork operation `WF §3.2`
  - [ ] `forkWorkflow(id)` - create copy of workflow
  - [ ] Handle API response with new workflow
  - [ ] Navigate to new workflow editor
- [ ] Create WorkflowExecutionEngine class `ARCH §6.1`
  - [ ] Create `src/services/WorkflowExecutionEngine.ts`
  - [ ] Constructor: inject ToolExecutor, MCPExecutor, PromptExecutor
  - [ ] Define ExecutionContext interface
  - [ ] Implement `execute(workflow, inputs, threadId)` method
  - [ ] Execute steps in order (sorted by step.order)
- [ ] Implement ToolExecutor for native tools `ARCH §6.1`
  - [ ] Create `src/executors/ToolExecutor.ts`
  - [ ] Map tool names to implementation functions
  - [ ] Handle tool inputs from context
  - [ ] Return tool outputs for next step
- [ ] Implement MCPExecutor for MCP servers `ARCH §6.1`
  - [ ] Create `src/executors/MCPExecutor.ts`
  - [ ] Connect to MCP server via stdio or HTTP
  - [ ] Call specified tool on server
  - [ ] Handle MCP protocol responses
- [ ] Implement PromptExecutor for LLM calls `ARCH §6.1`
  - [ ] Create `src/executors/PromptExecutor.ts`
  - [ ] Build prompt from template and context
  - [ ] Call LLM API via ThreadService
  - [ ] Parse and return LLM response
- [ ] Implement variable resolution ({{variable}} syntax) `ARCH §6.1`
  - [ ] Create `resolveVariables(template, context)` utility
  - [ ] Support nested access: `{{step1.output.field}}`
  - [ ] Support input variables: `{{inputs.name}}`
  - [ ] Handle missing variables (throw or default)
- [ ] Implement error handling (stop/skip/retry) `ARCH §6.1`
  - [ ] Read step.onError setting
  - [ ] "stop": halt execution, mark as failed
  - [ ] "skip": continue to next step, log warning
  - [ ] "retry": retry step up to maxRetries
- [ ] Write audit events during execution `WF §4.3`
  - [ ] Write workflow_start event
  - [ ] Write step_start, step_complete events
  - [ ] Write workflow_complete or workflow_failed event
  - [ ] Include timing and output data
- [ ] Cache workflow definitions `ARCH §4.1`
  - [ ] Create WorkflowCache class
  - [ ] Cache by workflow id with TTL
  - [ ] Invalidate on update/delete

**Acceptance Criteria:**
- All CRUD operations work via service `PROJ §4.2`
- Execution engine runs steps sequentially `ARCH §6.1`
- Tool/MCP/Prompt steps execute correctly `ARCH §6.1`
- Variables resolved between steps `ARCH §6.1`
- Errors handled per step's onError setting `ARCH §6.1`
- Audit events written for start/step/complete/fail `WF §4.3`
- Cache reduces API calls `ARCH §4.1`

---

#### E7-S3: Workflow List View
**Size:** S
**Description:** List workflows in sidebar and project view.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Workflow list in project | PROJ | §4.2 |
| Template display | WF | §2.1 |
| Scope filter | WF | §2.2 |

**Tasks:**
- [ ] Add Workflows section to project view `PROJ §4.2`
  - [ ] Add WorkflowsTab to ProjectView tabs
  - [ ] Create WorkflowList.svelte component
  - [ ] Fetch workflows via WorkflowService
  - [ ] Handle empty state
- [ ] Show workflow list with status `WF §2.1`
  - [ ] Create WorkflowListItem.svelte component
  - [ ] Display workflow name
  - [ ] Display last modified date
  - [ ] Show execution count badge
- [ ] Add "New Workflow" button `WF §2.1`
  - [ ] Add + button in section header
  - [ ] On click: open WorkflowEditor with empty workflow
  - [ ] Navigate to workflow editor view
- [ ] Show template badge for templates `WF §2.1`
  - [ ] Check workflow.isTemplate flag
  - [ ] Display "Template" badge/tag
  - [ ] Use distinct styling (different color)
- [ ] Filter by personal/project scope `WF §2.2`
  - [ ] Add filter dropdown: All, Personal, Project
  - [ ] Pass scope filter to WorkflowService
  - [ ] Update list on filter change
  - [ ] Remember last filter selection

**Acceptance Criteria:**
- Workflows listed with names `WF §2.1`
- Templates visually distinct `WF §2.1`
- Click opens workflow `WF §2.1`
- Filter switches views `WF §2.2`

---

#### E7-S4: Workflow Editor
**Size:** L
**Description:** UI for creating and editing workflows.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Workflow definition | WF | §3 |
| Input definition | WF | §3.1 |
| Step definition | WF | §3.2 |
| Output mapping | WF | §3.3 |

**Tasks:**
- [ ] Create WorkflowEditor component `WF §3`
  - [ ] Create WorkflowEditor.svelte component
  - [ ] Accept workflowId prop (null for new)
  - [ ] Load workflow data on mount
  - [ ] Track dirty state for unsaved changes
  - [ ] Layout: header, sidebar, main canvas
- [ ] Implement input definition UI `WF §3.1`
  - [ ] Create InputsPanel.svelte component
  - [ ] Add/remove input fields
  - [ ] Configure input name, type, required
  - [ ] Supported types: string, number, boolean, file
  - [ ] Add description/help text field
- [ ] Implement step definition UI `WF §3.2`
  - [ ] Create StepsPanel.svelte component
  - [ ] Create StepCard.svelte for each step
  - [ ] Drag-and-drop step reordering
  - [ ] Step types: tool, mcp, prompt
  - [ ] Configure step-specific settings
  - [ ] Add step: show type selection modal
  - [ ] Delete step: with confirmation
- [ ] Implement output mapping UI `WF §3.3`
  - [ ] Create OutputsPanel.svelte component
  - [ ] Map step outputs to workflow outputs
  - [ ] Visual connection between steps and outputs
  - [ ] Configure output name and type
- [ ] Add save and cancel buttons `WF §3`
  - [ ] Save button: call WorkflowService.create/update
  - [ ] Cancel button: discard changes, navigate back
  - [ ] Prompt if navigating with unsaved changes
  - [ ] Show validation errors on save

**Acceptance Criteria:**
- Can define inputs with types `WF §3.1`
- Can add/remove/reorder steps `WF §3.2`
- Can map outputs `WF §3.3`
- Save persists workflow `WF §3`

---

#### E7-S5: Workflow Execution UI
**Size:** M
**Description:** Execute workflows and view results.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Execution dialog | WF | §4.1 |
| Progress display | WF | §4.2 |
| Results display | WF | §4.4 |

**Tasks:**
- [ ] Create ExecuteWorkflowDialog `WF §4.1`
  - [ ] Create ExecuteWorkflowDialog.svelte component
  - [ ] Accept workflow as prop
  - [ ] Show workflow name in header
  - [ ] Two-panel layout: inputs left, progress right
- [ ] Show input form based on definition `WF §4.1`
  - [ ] Create InputForm.svelte component
  - [ ] Dynamically render fields from workflow.inputs
  - [ ] String → text input
  - [ ] Number → number input
  - [ ] Boolean → checkbox
  - [ ] File → file picker
  - [ ] Validate required fields
- [ ] Display execution progress `WF §4.2`
  - [ ] Create ExecutionProgress.svelte component
  - [ ] Show step list with status indicators
  - [ ] Highlight current step
  - [ ] Update in real-time as steps complete
  - [ ] Show elapsed time
- [ ] Show step-by-step results `WF §4.4`
  - [ ] Expand step to show output
  - [ ] Format output based on type
  - [ ] Show execution duration per step
  - [ ] Highlight errors in red
- [ ] Display final output `WF §4.4`
  - [ ] Show workflow outputs section
  - [ ] Format based on output type
  - [ ] Allow copying output to clipboard
  - [ ] Add "Run Again" button

**Acceptance Criteria:**
- Input form matches workflow inputs `WF §4.1`
- Progress shows current step `WF §4.2`
- Results display when complete `WF §4.4`
- Errors shown clearly `WF §4.5`

---

#### E7-S6: Execution History
**Size:** S
**Description:** View past workflow executions.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Execution history | WF | §5 |
| History display | WF | §5.1 |
| Execution details | WF | §5.2 |

**Tasks:**
- [ ] Create ExecutionHistoryTab `WF §5`
  - [ ] Create ExecutionHistoryTab.svelte component
  - [ ] Fetch executions via WorkflowService
  - [ ] Display as list or table
  - [ ] Handle empty state
- [ ] List executions with status `WF §5.1`
  - [ ] Create ExecutionListItem.svelte component
  - [ ] Show execution date/time
  - [ ] Show duration (if completed)
  - [ ] Show status badge (pending/running/success/failed)
  - [ ] Color-code by status
- [ ] Show execution details on click `WF §5.2`
  - [ ] Create ExecutionDetail.svelte component
  - [ ] Show in sidebar panel or modal
  - [ ] Include all execution metadata
- [ ] Display inputs, outputs, timing `WF §5.2`
  - [ ] Show inputs section with values used
  - [ ] Show outputs section with results
  - [ ] Show timing: started_at, completed_at, duration
  - [ ] Show step-by-step breakdown
- [ ] Show errors for failed runs `WF §5.2`
  - [ ] Highlight failed status prominently
  - [ ] Show error message from execution
  - [ ] Show which step failed
  - [ ] Show stack trace (if available, collapsible)

**Acceptance Criteria:**
- History sorted by date `WF §5.1`
- Status badges (success/failed) `WF §5.1`
- Details accessible `WF §5.2`
- Pagination for long lists `WF §5.1`

---

## Epic 8: UI/UX Polish

**Owner:** Dev A, Dev B
**Priority:** P1
**Depends On:** E2, E3
**Description:** Menu bar, system tray, keyboard shortcuts, and accessibility.

### Stories

#### E8-S1: Application Menu Bar
**Size:** M
**Description:** Native menu bar with standard menus.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Menu bar structure | UI | §1 |
| File menu | UI | §1.1 |
| Edit menu | UI | §1.2 |
| View/Window/Help menus | UI | §1.3-1.5 |

**Tasks:**
- [ ] Create menu template `UI §1`
  - [ ] Create `src/main/menu.ts` in Electron main process
  - [ ] Use Electron's Menu.buildFromTemplate()
  - [ ] Define menu structure array
  - [ ] Set as application menu on startup
- [ ] Implement File menu (New Thread, Open, Close) `UI §1.1`
  - [ ] New Thread: Cmd/Ctrl+N → create new thread
  - [ ] Open Recent → submenu of recent threads
  - [ ] Close Thread: Cmd/Ctrl+W → close current thread
  - [ ] Settings: Cmd/Ctrl+, → open settings
  - [ ] Quit: Cmd/Ctrl+Q → exit app (with confirmation)
- [ ] Implement Edit menu (Undo, Cut, Copy, Paste) `UI §1.2`
  - [ ] Undo: Cmd/Ctrl+Z → standard undo
  - [ ] Redo: Cmd/Ctrl+Shift+Z → standard redo
  - [ ] Cut: Cmd/Ctrl+X → standard cut
  - [ ] Copy: Cmd/Ctrl+C → standard copy
  - [ ] Paste: Cmd/Ctrl+V → standard paste
  - [ ] Select All: Cmd/Ctrl+A → standard select all
- [ ] Implement View menu (Zoom, Sidebar toggle) `UI §1.3`
  - [ ] Toggle Sidebar: Cmd/Ctrl+B → show/hide sidebar
  - [ ] Zoom In: Cmd/Ctrl+= → increase zoom
  - [ ] Zoom Out: Cmd/Ctrl+- → decrease zoom
  - [ ] Actual Size: Cmd/Ctrl+0 → reset zoom
  - [ ] Fullscreen: F11 or Cmd+Ctrl+F → toggle fullscreen
- [ ] Implement Window menu (Minimize, Close) `UI §1.4`
  - [ ] Minimize: Cmd/Ctrl+M → minimize window
  - [ ] Zoom (macOS) / Maximize (Win/Linux)
  - [ ] Bring All to Front (macOS only)
- [ ] Implement Help menu (About, Documentation) `UI §1.5`
  - [ ] Documentation → open docs in browser
  - [ ] Release Notes → open changelog
  - [ ] Report Issue → open GitHub issues
  - [ ] About Holokai → show about dialog

**Acceptance Criteria:**
- Menus work on Windows, macOS, Linux `UI §1`
- Keyboard shortcuts shown in menus `UI §1`
- Actions trigger correctly `UI §1`
- Platform-specific conventions followed `UI §1`

---

#### E8-S2: System Tray
**Size:** M
**Description:** System tray icon with quick actions.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Tray icon | UI | §2.1 |
| Tray menu | UI | §2.2 |
| Quick actions | UI | §2.3 |

**Tasks:**
- [ ] Create tray icon `UI §2.1`
  - [ ] Create `src/main/tray.ts` in Electron main process
  - [ ] Use Electron's Tray class
  - [ ] Design icon assets (online, offline states)
  - [ ] Initialize tray on app ready
  - [ ] Handle tray click (show/hide window)
- [ ] Show connection status in icon `UI §2.1`
  - [ ] Create multiple icon variants (green, red, yellow)
  - [ ] Subscribe to ConnectionManager events
  - [ ] Update tray icon based on status
  - [ ] Add tooltip showing status text
- [ ] Create tray context menu `UI §2.2`
  - [ ] Create context menu with Menu.buildFromTemplate()
  - [ ] Set as tray context menu
  - [ ] Update menu items dynamically
- [ ] Implement quick actions (New Thread, Settings) `UI §2.3`
  - [ ] New Thread → create thread and show window
  - [ ] Settings → open settings page and show window
  - [ ] Show/Hide Holokai → toggle window visibility
  - [ ] Separator
  - [ ] Quit → exit application
- [ ] Handle show/hide from tray `UI §2.3`
  - [ ] Single click: toggle window visibility
  - [ ] Show window: restore if minimized, focus
  - [ ] Hide window: hide (not close) to tray
  - [ ] Option: close to tray vs close app

**Acceptance Criteria:**
- Tray icon visible `UI §2.1`
- Icon changes for offline status `UI §2.1`
- Menu opens on right-click `UI §2.2`
- Actions work correctly `UI §2.3`

---

#### E8-S3: Keyboard Shortcuts
**Size:** M
**Description:** Global keyboard shortcuts for common actions.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Shortcut table | UI | §2 |
| Shortcut implementation | UI | §2.1-2.3 |

**Tasks:**
- [ ] Define shortcut map `UI §2`
  - [ ] Create `src/config/shortcuts.ts`
  - [ ] Define ShortcutConfig interface
  - [ ] Map action names to key combinations
  - [ ] Support platform-specific shortcuts (Cmd vs Ctrl)
- [ ] Implement Cmd/Ctrl+N (new thread) `UI §2.1`
  - [ ] Register shortcut in menu and/or globalShortcut
  - [ ] Handler: create new thread via ThreadService
  - [ ] Navigate to new thread view
  - [ ] Focus input box
- [ ] Implement Cmd/Ctrl+K (quick search) `UI §2.1`
  - [ ] Register shortcut
  - [ ] Handler: open command palette / search modal
  - [ ] Focus search input
  - [ ] Support fuzzy search
- [ ] Implement Cmd/Ctrl+, (settings) `UI §2.1`
  - [ ] Register shortcut
  - [ ] Handler: navigate to settings view
  - [ ] Standard macOS convention
- [ ] Implement Cmd/Ctrl+1-9 (recent threads) `UI §2.2`
  - [ ] Register shortcuts for numbers 1-9
  - [ ] Handler: navigate to nth recent thread
  - [ ] Update menu with recent threads list
  - [ ] Show shortcuts in menu items
- [ ] Add shortcuts to menu items `UI §2.3`
  - [ ] Use accelerator property in menu template
  - [ ] Ensure shortcuts display correctly
  - [ ] Test all shortcuts work from menu

**Acceptance Criteria:**
- All shortcuts work `UI §2`
- No conflicts with OS shortcuts `UI §2`
- Shortcuts shown in menus `UI §2.3`
- Work in all app states `UI §2`

---

#### E8-S4: Drag and Drop
**Size:** S
**Description:** Drag-and-drop for files and thread reordering.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Drag-and-drop zones | UI | §3 |
| File drop handling | UI | §3.1 |
| Visual feedback | UI | §3.2 |

**Tasks:**
- [ ] Implement file drop zone in message input `UI §3.1`
  - [ ] Add drop zone overlay to MessageInput component
  - [ ] Listen for dragenter on window to detect drag
  - [ ] Show drop zone when files being dragged
  - [ ] Accept files dropped anywhere in input area
- [ ] Visual feedback during drag `UI §3.2`
  - [ ] Add dashed border and background color
  - [ ] Show "Drop files here" text/icon
  - [ ] Animate border on dragenter
  - [ ] Remove highlight on dragleave/drop
- [ ] Handle dropped files as attachments `UI §3.1`
  - [ ] Extract files from DragEvent.dataTransfer
  - [ ] Validate file types against allowlist
  - [ ] Validate file sizes
  - [ ] Add valid files to pending attachments
  - [ ] Show error toast for rejected files
- [ ] Implement thread reordering in list (stretch) `UI §3.3`
  - [ ] Add drag handle to thread list items
  - [ ] Listen for drag events on thread items
  - [ ] Show drop indicator between items
  - [ ] Update thread order on drop
  - [ ] Persist new order to storage

**Acceptance Criteria:**
- Drop zone highlighted on drag over `UI §3.2`
- Files attached on drop `UI §3.1`
- Invalid files rejected with message `UI §3.1`

---

#### E8-S5: Accessibility Audit
**Size:** M
**Description:** Ensure WCAG 2.1 AA compliance.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Accessibility baseline | UI | §5 |
| Color contrast | UI | §5.1 |
| Keyboard navigation | UI | §5.2 |
| Screen reader support | UI | §5.3 |

**Tasks:**
- [ ] Audit color contrast `UI §5.1`
  - [ ] Use automated tool (axe, Lighthouse)
  - [ ] Check all text/background combinations
  - [ ] Verify 4.5:1 ratio for normal text
  - [ ] Verify 3:1 ratio for large text
  - [ ] Document and fix failures
- [ ] Add ARIA labels to interactive elements `UI §5.3`
  - [ ] Add aria-label to icon-only buttons
  - [ ] Add aria-describedby for complex controls
  - [ ] Add role attributes where needed
  - [ ] Add aria-live for dynamic content
  - [ ] Add aria-expanded for collapsible sections
- [ ] Ensure keyboard navigation works `UI §5.2`
  - [ ] Test Tab order through all components
  - [ ] Ensure all interactive elements are focusable
  - [ ] Add skip links for main content
  - [ ] Support Escape to close modals
  - [ ] Support arrow keys for lists
- [ ] Test with screen reader `UI §5.3`
  - [ ] Test with VoiceOver (macOS)
  - [ ] Test with NVDA (Windows)
  - [ ] Verify announcements are clear
  - [ ] Fix any confusing or missing announcements
- [ ] Fix identified issues `UI §5`
  - [ ] Create issues for each a11y problem
  - [ ] Prioritize by impact
  - [ ] Fix high-priority issues
  - [ ] Document remaining issues for future

**Acceptance Criteria:**
- Color contrast meets AA standards `UI §5.1`
- All actions keyboard accessible `UI §5.2`
- Screen reader announces correctly `UI §5.3`
- Focus visible on all elements `UI §5.2`

---

## Story Size Reference

| Size | Effort | Description |
|------|--------|-------------|
| S | 1-2 days | Single focus, well-defined |
| M | 3-5 days | Multiple components, some complexity |
| L | 5-8 days | Cross-cutting, significant complexity |
| XL | 8+ days | Should be split into smaller stories |

---

## Kanban Board Columns

| Column | WIP Limit | Description |
|--------|-----------|-------------|
| Backlog | - | Prioritized, ready to pull |
| In Progress | 2 per dev | Currently being worked |
| Review | 4 | Awaiting code review |
| Testing | 4 | QA/integration testing |
| Done | - | Completed and deployed |

---

## Suggested Work Order

### Phase 1: Foundation (Week 1-2)

**Peter:** E1-S1, E1-S4, E1-S5 (Database, Project API, Auth)
**Dev A:** E2-S1, E2-S4 (Message tree model, Auto-title)
**Dev B:** E3-S1, E3-S2, E3-S3 (Project service, cache, polling)

### Phase 2: Core Features (Week 3-4)

**Peter:** E4-S1, E4-S2, E4-S3, E4-S4 (Notifications, State, Deep links, ThreadRepository)
**Dev A:** E2-S2, E2-S3 (Retry flow, Branch UI)
**Dev B:** E3-S4, E3-S5, E3-S6 (Project UI)

### Phase 3: Integration (Week 5-6)

**Peter:** E7-S1, E7-S2 (Workflow API and service)
**Dev A:** E2-S5, E2-S6, E6-S2, E6-S3 (Clipboard, Dashboard)
**Dev B:** E3-S7, E3-S8, E5-S1, E5-S3 (Members, Move, Files)

### Phase 4: Polish (Week 7-8)

**Peter:** E7-S4, E7-S5 (Workflow editor, execution)
**Dev A:** E8-S1, E8-S3, E8-S5 (Menu, Shortcuts, Accessibility)
**Dev B:** E8-S2, E8-S4, E5-S2 (Tray, DnD, File cache)

---

## Key Milestones

| Milestone | Target | Criteria |
|-----------|--------|----------|
| **M1: API Complete** | End Week 2 | All E1 stories done, API testable |
| **M2: Thread Branching** | End Week 4 | E2 complete, branching works end-to-end |
| **M3: Projects Live** | End Week 4 | E3 complete, collaboration functional |
| **M4: Full Feature** | End Week 6 | E4-E7 complete, all features working |
| **M5: Release Ready** | End Week 8 | E8 complete, polished and accessible |

---

_Epic and Story Planning - 2025-11-25_

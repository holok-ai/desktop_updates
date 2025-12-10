# Story 3.6: Project Detail View

Status: ready-for-dev

## Story

As a desktop application user,
I want a project detail view with tabs for Threads, Files, Members, and Settings,
so that I can manage all project resources in a single organized interface with proper deletion safeguards.

## Acceptance Criteria

1. Detail view has tabbed interface: Threads, Files, Members, Settings
2. Threads tab shows project threads (filtered by projectId)
3. Files tab shows project files (requires Epic 5 File Service)
4. Members tab shows member list with roles + pending invitations section
5. Settings tab shows project metadata (name, description, color from Moku Web palette, icon)
6. Only owner sees "Delete Project" button
7. Delete confirmation dialog shows: "This will permanently delete X threads and Y messages. This action cannot be undone."
8. Delete confirmation requires typing project name to confirm (prevent accidental deletion)
9. Project deletion CASCADE deletes all threads and messages (ON DELETE CASCADE foreign key)
10. Deleted threads/messages logged to PostgreSQL audit table (audit trail preserved)
11. View loads in <500ms
12. "Refresh" button visible in detail view toolbar

## Tasks / Subtasks

- [ ] **Task 1: Implement Tabbed Interface (AC: 1)**
  - [ ] Create ProjectDetailView component with tab navigation
  - [ ] Implement tabs: Threads, Files, Members, Settings
  - [ ] Add tab state management (active tab selection)
  - [ ] Add visual styling for active/inactive tabs
  - [ ] Load project data on component mount (ProjectService.get())

- [ ] **Task 2: Implement Threads Tab (AC: 2)**
  - [ ] Fetch project threads: filter by projectId
  - [ ] Display thread list with: title, preview, last updated
  - [ ] Click thread navigates to thread view
  - [ ] Show empty state: "No threads yet. Create your first thread."
  - [ ] Add "New Thread" button (creates thread scoped to project)

- [ ] **Task 3: Implement Files Tab (AC: 3)**
  - [ ] **PLACEHOLDER**: Files tab requires E5-S1 (File Service)
  - [ ] Display message: "File management coming soon (Epic 5)"
  - [ ] Future: Integrate with File Service to show project files
  - [ ] Leave tab structure in place for Epic 5 implementation

- [ ] **Task 4: Implement Members Tab (AC: 4)**
  - [ ] Fetch project members: GET /api/projects/{id}/members
  - [ ] Display member list with: name, email, role, "added by" info
  - [ ] Show role badge (owner/editor/viewer)
  - [ ] Add "Pending Invitations" section below members list
  - [ ] **Delegate member management UI to E3-S7** (invite, remove, change roles)
  - [ ] Show member count in tab label: "Members (5)"

- [ ] **Task 5: Implement Settings Tab (AC: 5-6)**
  - [ ] Display project metadata: name, description, color (Moku Web palette), icon
  - [ ] Show owner information (name, email)
  - [ ] Show created/updated timestamps
  - [ ] Add "Edit Project" button (inline editing or separate dialog)
  - [ ] Show "Delete Project" button ONLY if current user is owner
  - [ ] Apply permission check before rendering delete button

- [ ] **Task 6: Implement Project Deletion with Safeguards (AC: 7-10)**
  - [ ] Add "Delete Project" button in Settings tab (owner only)
  - [ ] Open confirmation dialog on click
  - [ ] Fetch thread and message counts: Display "This will permanently delete X threads and Y messages."
  - [ ] Add text input: "Type project name to confirm"
  - [ ] Validate typed name matches project name exactly (case-sensitive)
  - [ ] Disable "Confirm Delete" button until name matches
  - [ ] On confirm: Call ProjectService.delete()
  - [ ] **Cascade delete**: ON DELETE CASCADE foreign key deletes all threads/messages
  - [ ] **Audit logging**: Verify deleted threads/messages logged to PostgreSQL audit table
  - [ ] On success: Navigate back to project list, show toast: "Project deleted"

- [ ] **Task 7: Implement Refresh Button (AC: 12)**
  - [ ] Add "Refresh" button in detail view toolbar
  - [ ] On click: Invalidate project cache, re-fetch project data
  - [ ] Re-fetch active tab data (threads/members/files)
  - [ ] Show loading indicator during refresh

- [ ] **Task 8: Performance and Testing (AC: 11)**
  - [ ] Benchmark view load time (project data fetch + render)
  - [ ] Target: <500ms for view load
  - [ ] Unit test: Tab navigation, permission checks (owner-only delete button)
  - [ ] E2E test: Full cascade delete flow (create project → add threads → delete → verify audit table)
  - [ ] E2E test: Delete confirmation requires typing project name
  - [ ] Integration test: Verify ON DELETE CASCADE foreign key works
  - [ ] Manual test: Deletion confirmation UX, audit table logging

## Dev Notes

### Tabbed Interface Structure

```
┌─────────────────────────────────────────────┐
│ Project Name                    [Refresh]   │
├─────────────────────────────────────────────┤
│ [Threads] [Files] [Members] [Settings]     │
├─────────────────────────────────────────────┤
│                                             │
│         Active Tab Content                  │
│                                             │
└─────────────────────────────────────────────┘
```

### Cascade Delete Flow (Tech Spec §4.4, Open Question #2)

**DECISION:** Cascade delete - threads deleted when project deleted

1. Owner clicks "Delete Project" in Settings tab
2. Confirmation dialog shows:
   - **Warning**: "This will permanently delete X threads and Y messages. This action cannot be undone."
   - **Input**: "Type project name to confirm" (text input)
   - **Buttons**: "Cancel", "Confirm Delete" (disabled until name matches)
3. User types project name exactly (case-sensitive validation)
4. User clicks "Confirm Delete"
5. ProjectService.delete() calls Moku API: DELETE /api/projects/{id}
6. **Database CASCADE DELETE**:
   - Foreign key constraint: `ON DELETE CASCADE` on desktop_threads.project_id
   - PostgreSQL automatically deletes all threads and messages when project deleted
7. **Audit Logging**:
   - Deleted threads/messages logged to audit table (pg_audit or custom audit_log table)
   - Log includes: project_id, thread_ids, message_ids, deleted_at, deleted_by (userId)
8. ProjectService invalidates all project-related caches
9. UI navigates back to project list
10. Toast notification: "Project '{name}' deleted"

### Foreign Key Constraint (Tech Spec §4.2)

```sql
ALTER TABLE desktop_threads
ADD CONSTRAINT fk_project_id
FOREIGN KEY (project_id)
REFERENCES projects(id)
ON DELETE CASCADE;

-- Similarly for messages
ALTER TABLE messages
ADD CONSTRAINT fk_thread_id
FOREIGN KEY (thread_id)
REFERENCES desktop_threads(id)
ON DELETE CASCADE;
```

### Audit Table Structure (Tech Spec §6.2)

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50),  -- 'project', 'thread', 'message'
  entity_id UUID,
  action VARCHAR(50),       -- 'delete', 'update', 'create'
  actor_user_id UUID,
  metadata JSONB,           -- { projectId, threadIds, messageIds, counts }
  created_at TIMESTAMP DEFAULT NOW()
);
```

Example audit entry:
```json
{
  "entity_type": "project",
  "entity_id": "project-uuid",
  "action": "delete",
  "actor_user_id": "user-uuid",
  "metadata": {
    "projectName": "Marketing Team",
    "threadCount": 15,
    "messageCount": 247,
    "threadIds": ["thread-1", "thread-2", ...],
    "deletedAt": "2025-11-27T10:30:00Z"
  }
}
```

### Permission Checks (Tech Spec §4.2)

- **Delete Project**: Owner only
- **Edit Project**: Owner only
- **Invite Members**: Owner only (handled in E3-S7)
- **View Threads/Files/Members**: All roles (owner/editor/viewer)

### API Endpoints (Tech Spec §4.3)

```
GET    /api/projects/{id}               - Get project details
GET    /api/projects/{id}/members       - List members
DELETE /api/projects/{id}               - Delete project (CASCADE)
GET    /api/projects/{id}/threads       - List project threads
```

### Performance Targets (Tech Spec §6.1)

- **View Load**: <500ms (project data fetch + initial tab render)
- **Tab Switch**: <100ms (cached data, no API call)
- **Refresh**: <2s (invalidate cache + fetch fresh data)

### Testing Strategy

- **Unit Tests**: Tab navigation, permission checks, delete confirmation validation
- **E2E Tests**: Full cascade delete flow (create → add threads → delete → verify audit table), delete confirmation UX (typing project name)
- **Integration Tests**: Verify ON DELETE CASCADE foreign key, verify audit table logging
- **Performance Tests**: View load time <500ms, tab switch <100ms
- **Manual Tests**: Deletion confirmation dialog UX, audit table entries

### Dependencies

- **Requires: E3-S1 (ProjectService)** - API for project data, delete operation
- **Requires: E3-S4 (ProjectSidebarUI)** - Navigation to detail view
- **Integrates with: E3-S7 (MemberManagementUI)** - Members tab delegates to member management
- **Future: E5-S1 (File Service)** - Files tab integration deferred to Epic 5

### References

- [Tech Spec: Epic 3 Project Collaboration](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md)
- [Tech Spec §4.1: Services (ProjectDetailView)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#services-and-modules)
- [Tech Spec §4.4: Cascade Delete Flow](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#workflows-and-sequencing)
- [Tech Spec §6.2: Security (Audit Logging)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#security)
- [Tech Spec §9: Open Question #2 (Cascade delete decision)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#open-questions)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e3-s6-project-detail-view.context.xml

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

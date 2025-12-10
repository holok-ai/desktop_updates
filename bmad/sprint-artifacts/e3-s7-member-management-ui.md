# Story 3.7: Member Management and Invitations UI

Status: ready-for-dev

## Story

As a project owner,
I want to invite members via email with multi-channel notifications (email + Moku Web + Desktop), manage existing members, and handle invitations,
so that I can collaborate with my team while maintaining proper access control with clear invitation workflows.

## Acceptance Criteria

1. Members tab displays list with: name, email, role, "added by" info
2. "Invite Member" button visible only to owners
3. Invitation dialog: email input (with validation), role selector (editor/viewer)
4. Invitation sent: Creates invitation record (status: pending, expiresAt: +7 days)
5. **Multi-channel notifications:** Email sent, notification in Moku Web (bell icon), Desktop in-app notification
6. Invitation link format: `https://app.moku.ai/invitations/{invitationId}/accept`
7. Desktop notification center shows pending invitations with badge count
8. Pending invitations section in Members tab shows: invited email, role, invited date, "Cancel" button (owner only)
9. User can accept/decline invitations from Desktop notification center or email link
10. Invitation acceptance: Creates member with specified role, updates invitation status to 'accepted'
11. Invitation decline: Updates invitation status to 'declined', no member created
12. Invitations expire after 7 days (expiresAt timestamp checked)
13. "Remove" button visible only to owners, disabled for self if last owner
14. Role change dropdown visible only to owners
15. **Personal project upgrade**: If project.type='personal' and owner tries to add member, show upgrade confirmation dialog; on confirm, upgrade to type='shared' then add member
16. Member operations complete in <1s (P95)

## Tasks / Subtasks

- [ ] **Task 1: Implement Member List Display (AC: 1)**
  - [ ] Fetch project members: GET /api/projects/{id}/members
  - [ ] Display member list with columns: Avatar, Name, Email, Role, Added By, Actions
  - [ ] Show role badge (owner/editor/viewer) with color coding
  - [ ] Show "added by" info with username and date
  - [ ] Sort members: Owners first, then editors, then viewers
  - [ ] Handle empty state: "No members yet. Invite your first team member."

- [ ] **Task 2: Implement Invitation Dialog (AC: 2-3)**
  - [ ] Add "Invite Member" button (visible only to owners)
  - [ ] Create invitation dialog component
  - [ ] Add email input with validation (regex + format check)
  - [ ] Add role selector dropdown (editor/viewer only - cannot invite as owner)
  - [ ] Add "Send Invitation" and "Cancel" buttons
  - [ ] Implement client-side validation (valid email, role selected)

- [ ] **Task 2.5: Implement Personal-to-Shared Upgrade Dialog (AC: 15)**
  - [ ] Create UpgradeToSharedDialog component (Svelte modal)
  - [ ] Display warning message: "This will upgrade your personal project to a shared project. Team members will be able to access all workflows. This action cannot be undone. Continue?"
  - [ ] Add "Cancel" and "Upgrade" buttons
  - [ ] On "Upgrade": Call IPC handler: `ipcRenderer.invoke('projects:upgrade-to-shared', projectId)`
  - [ ] Show loading state during upgrade (disable buttons, show spinner)
  - [ ] On success: Close dialog, refresh project data, proceed with member add flow
  - [ ] On failure: Show error toast, keep dialog open for retry
  - [ ] Integrate with member add flow: Check if project.type='personal' before opening invitation dialog
  - [ ] If personal: Show UpgradeToSharedDialog first, then proceed to invitation dialog after upgrade
  - [ ] If shared: Open invitation dialog directly

- [ ] **Task 3: Implement Invitation Sending (AC: 4-6)**
  - [ ] Call ProjectService.inviteMember(): POST /api/projects/{id}/invitations
  - [ ] API creates invitation record: { email, role, status: 'pending', expiresAt: +7 days }
  - [ ] **Multi-channel notifications triggered by API:**
    - **Email**: Moku API sends email with invitation link
    - **Moku Web**: Notification in bell icon dropdown
    - **Desktop**: In-app notification shown on next refresh or app launch
  - [ ] Invitation link format: `https://app.moku.ai/invitations/{invitationId}/accept`
  - [ ] Show success toast: "Invitation sent to {email}"
  - [ ] Close dialog on success

- [ ] **Task 4: Implement Pending Invitations Section (AC: 8)**
  - [ ] Add "Pending Invitations" section below member list in Members tab
  - [ ] Fetch pending invitations: GET /api/projects/{id}/invitations (filter status: pending)
  - [ ] Display invitation list: Email, Role, Invited Date, Expires In, Actions
  - [ ] Show expiration countdown: "Expires in 5 days"
  - [ ] Add "Cancel Invitation" button (owner only)
  - [ ] On cancel: DELETE /api/projects/{id}/invitations/{invitationId}, update UI

- [ ] **Task 5: Implement Desktop Notification Center (AC: 7, 9)**
  - [ ] Create notification center component (bell icon in app header)
  - [ ] Fetch user's pending invitations: GET /api/invitations (filter status: pending)
  - [ ] Show badge count on bell icon (number of pending invitations)
  - [ ] Display invitation notifications: "You've been invited to {projectName} as {role}"
  - [ ] Add "Accept" and "Decline" buttons inline
  - [ ] On accept: POST /api/invitations/{id}/accept, update status, create member
  - [ ] On decline: POST /api/invitations/{id}/decline, update status
  - [ ] Remove notification after action, update badge count

- [ ] **Task 6: Implement Member Removal (AC: 13)**
  - [ ] Add "Remove" button next to each member (visible only to owners)
  - [ ] Disable "Remove" button if:
    - User is removing self and is last owner (must transfer ownership first)
    - User is not owner
  - [ ] Confirmation dialog: "Remove {memberName} from project?"
  - [ ] On confirm: DELETE /api/projects/{id}/members/{userId}
  - [ ] Invalidate members cache, refresh member list
  - [ ] Show toast: "{memberName} removed from project"

- [ ] **Task 7: Implement Role Change (AC: 14)**
  - [ ] Add role dropdown next to each member (visible only to owners)
  - [ ] Prevent changing own role if last owner
  - [ ] On role change: PATCH /api/projects/{id}/members/{userId} with new role
  - [ ] Invalidate members cache, refresh member list
  - [ ] Show toast: "{memberName} role changed to {newRole}"

- [ ] **Task 8: Implement Invitation Expiration (AC: 12)**
  - [ ] Check invitation expiresAt timestamp before accepting
  - [ ] If expired: Show error "This invitation has expired", prevent acceptance
  - [ ] Auto-filter expired invitations from pending list (UI only shows valid invitations)
  - [ ] Consider background job to auto-decline expired invitations (optional)

- [ ] **Task 9: Testing (AC: 10-11, 15)**
  - [ ] Unit test: Email validation, permission checks (owner-only actions)
  - [ ] E2E test: Full invitation flow (send → email + notifications → accept → member created)
  - [ ] E2E test: Invitation decline (send → decline → no member created)
  - [ ] E2E test: Invitation expiration (create invitation, advance time 7 days, verify expired)
  - [ ] E2E test: Member removal, role change
  - [ ] E2E test: Personal project upgrade flow (add member to personal project → confirm upgrade → verify type changed → member added)
  - [ ] E2E test: Cancel upgrade (add member to personal project → cancel upgrade → no member added, type unchanged)
  - [ ] Integration test: Multi-channel notifications (verify email sent, Moku Web notification, Desktop notification)
  - [ ] Performance test: Member operations <1s (P95)
  - [ ] Manual test: Notification center UX, email template content, upgrade dialog UX

## Dev Notes

### Multi-Channel Invitation Notifications (Tech Spec §4.4, Open Question #3)

**DECISION:** Member invites shown in Moku Web AND Desktop; also sent by email

**Implementation:**
1. **Email**: Moku API sends email on POST /api/projects/{id}/invitations
   - Email template includes: Project name, inviter name, role, invitation link, expiration date
   - Link: `https://app.moku.ai/invitations/{invitationId}/accept`
2. **Moku Web**: Notification in bell icon dropdown (notifications dropdown)
   - Notification text: "You've been invited to {projectName} as {role} by {inviterName}"
   - Accept/Decline buttons inline
3. **Desktop**: In-app notification (notification center or banner)
   - Fetched on app launch or manual refresh: GET /api/invitations
   - Same UI as Moku Web (notification center with accept/decline)

### Invitation Flow (Tech Spec §4.4)

1. Owner clicks "Invite Member" in Members tab
2. Invitation dialog: Enter email, select role (editor/viewer)
3. Owner clicks "Send Invitation"
4. API call: POST /api/projects/{id}/invitations with { email, role }
5. Moku API:
   - Creates invitation record (status: pending, expiresAt: +7 days)
   - Sends email with invitation link
   - Creates notification for Moku Web and Desktop
6. New user receives:
   - Email with link
   - Moku Web notification (bell icon)
   - Desktop notification (on next refresh or launch)
7. User clicks "Accept" (email link or in-app):
   - POST /api/invitations/{id}/accept
   - API creates member with specified role
   - API updates invitation status to 'accepted'
   - User sees project in "Shared Projects" in sidebar
8. User clicks "Decline":
   - POST /api/invitations/{id}/decline
   - API updates invitation status to 'declined'
   - No member created

### ProjectInvitation Entity (Tech Spec §4.2)

```typescript
interface ProjectInvitation {
  id: string;
  projectId: string;
  invitedEmail: string;
  invitedUserId?: string;  // If user already registered
  role: 'editor' | 'viewer';  // Cannot invite as owner
  status: 'pending' | 'accepted' | 'declined';
  invitedBy: string;       // userId of inviter
  invitedAt: Date;
  respondedAt?: Date;
  expiresAt: Date;         // +7 days from invitedAt
}
```

### API Endpoints (Tech Spec §4.3)

```
-- Invitation endpoints (NEW)
POST   /api/projects/{id}/invitations   - Send invitation
GET    /api/projects/{id}/invitations   - List pending invitations (owner only)
GET    /api/invitations                 - List user's pending invitations (all projects)
POST   /api/invitations/{id}/accept     - Accept invitation
POST   /api/invitations/{id}/decline    - Decline invitation
DELETE /api/projects/{id}/invitations/{invitationId} - Cancel invitation (owner only)

-- Member endpoints (EXISTING)
GET    /api/projects/{id}/members       - List members
POST   /api/projects/{id}/members       - Add member (direct add, no invitation)
DELETE /api/projects/{id}/members/{userId} - Remove member
PATCH  /api/projects/{id}/members/{userId} - Update member role

-- Project upgrade (E9-S1 Integration)
POST   /api/projects/{id}/upgrade-to-shared - Upgrade personal project to shared (owner only)
```

### Permission Checks (Tech Spec §4.2)

- **Invite Member**: Owner only
- **Cancel Invitation**: Owner only
- **Remove Member**: Owner only (cannot remove self if last owner)
- **Change Role**: Owner only (cannot change own role if last owner)
- **Accept/Decline Invitation**: Invited user only

### Invitation Expiration Logic

```typescript
// Check if invitation expired
function isInvitationExpired(invitation: ProjectInvitation): boolean {
  return new Date() > new Date(invitation.expiresAt);
}

// Filter expired invitations from pending list
const validInvitations = pendingInvitations.filter(inv => !isInvitationExpired(inv));
```

### Personal-to-Shared Upgrade Flow (E9-S1 Integration, AC: 15)

**When**: Owner of a personal project attempts to invite a member

**Flow**:
1. User clicks "Invite Member" button in Members tab
2. UI checks `project.type` field
3. If `type === 'personal'`:
   - Show UpgradeToSharedDialog with warning message
   - User can Cancel (abort member invite) or Upgrade (proceed)
4. If user clicks "Upgrade":
   - Call IPC: `ipcRenderer.invoke('projects:upgrade-to-shared', projectId)`
   - Main process calls API: `POST /api/projects/{projectId}/upgrade-to-shared`
   - API verifies: current user is owner, current type is 'personal'
   - API updates: `project.type = 'shared'`
   - API returns updated ProjectDTO
   - Desktop updates cache and UI
5. After successful upgrade:
   - Close UpgradeToSharedDialog
   - Open invitation dialog to add member
   - Project now appears in "Shared Projects" section in sidebar
6. If `type === 'shared'`:
   - Open invitation dialog directly (no upgrade needed)

**Warning Message**:
> "This will upgrade your personal project to a shared project. Team members will be able to access all workflows. This action cannot be undone. Continue?"

**IPC Handler** (Main Process):
```typescript
ipcMain.handle('projects:upgrade-to-shared', async (event, projectId: string) => {
  const result = await ProjectService.upgradeToShared(projectId);
  ProjectCache.invalidate(`projects:${projectId}`);
  ProjectCache.invalidate('projects:list');
  return result;
});
```

**API Endpoint**:
```
POST /api/projects/{id}/upgrade-to-shared
Authorization: Bearer {token}

Response 200:
{
  "id": "uuid",
  "name": "My Project",
  "type": "shared",  // Changed from 'personal'
  ...
}

Response 400: { "error": "Cannot upgrade: project is already shared" }
Response 403: { "error": "Only project owner can upgrade to shared" }
Response 404: { "error": "Project not found" }
```

**Downgrade Prevention**:
- No endpoint exists for shared-to-personal conversion
- ProjectService.updateProject() rejects type changes from 'shared' to 'personal'
- Once upgraded, project remains shared permanently

### Performance Targets (Tech Spec §6.1)

- **Member Operations**: <1s (P95) - invite, remove, role change
- **Member List Load**: <200ms (cached), <800ms (API call)
- **Invitation Flow**: <3s end-to-end (send invitation → email sent → notifications created)
- **Project Upgrade**: <1s (P95) - personal to shared upgrade

### UI/UX Patterns

**Members Tab Layout:**
```
┌─────────────────────────────────────────────┐
│ Members (5)                  [Invite Member]│
├─────────────────────────────────────────────┤
│ Avatar | Name | Email | Role | Added By | ⋮│
│ ...    | ...  | ...   | ...  | ...      | ⋮│
├─────────────────────────────────────────────┤
│ Pending Invitations (2)                     │
├─────────────────────────────────────────────┤
│ Email | Role | Invited | Expires In | Cancel│
│ ...   | ...  | ...     | ...        | ...   │
└─────────────────────────────────────────────┘
```

**Notification Center:**
```
┌─────────────────────────────────────────────┐
│ 🔔 Notifications (3)                        │
├─────────────────────────────────────────────┤
│ You've been invited to "Marketing Team"     │
│ as Editor by John Doe                       │
│ [Accept] [Decline]                          │
├─────────────────────────────────────────────┤
│ ...                                         │
└─────────────────────────────────────────────┘
```

### Testing Strategy

- **Unit Tests**: Email validation, permission checks, expiration logic
- **E2E Tests**: Full invitation flow (send → accept/decline), member removal, role change
- **Integration Tests**: Multi-channel notifications (email + Moku Web + Desktop)
- **Performance Tests**: Member operations <1s
- **Manual Tests**: Email template content, notification center UX

### Dependencies

- **Requires: E3-S1 (ProjectService)** - API for member and invitation management
- **Requires: E3-S6 (ProjectDetailView)** - Members tab integration
- **Integrates with: E4-S1 (Notification System)** - Desktop in-app notifications
- **Integrates with: E9-S1 (Personal Project Type Support)** - Personal-to-shared upgrade flow

### References

- [Tech Spec: Epic 3 Project Collaboration](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md)
- [Tech Spec §4.1: Services (MemberManagementUI)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#services-and-modules)
- [Tech Spec §4.2: Data Models (ProjectInvitation)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#data-models-and-contracts)
- [Tech Spec §4.3: APIs (Invitation endpoints)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#apis-and-interfaces)
- [Tech Spec §4.4: Member Invitation Flow](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#workflows-and-sequencing)
- [Tech Spec §9: Open Question #3 (Multi-channel notifications)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#open-questions)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e3-s7-member-management-ui.context.xml

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

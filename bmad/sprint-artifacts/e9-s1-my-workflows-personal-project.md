# Story 9.1: Personal Project Type Support

Status: ready-for-dev

## Story

As a Holokai Desktop user,
I want to create personal projects that only I can access,
so that I can keep my private workflows separate from team collaboration.

## Acceptance Criteria

1. **AC-1.1: Project type field** - Projects have a `type` field with values 'personal' or 'shared' (stored in database, exposed via API).

2. **AC-1.2: Single-member enforcement** - Personal projects enforce single-member constraint (only the owner can be a member); attempting to add members to personal projects is rejected.

3. **AC-1.3: Type-based sidebar grouping** - Personal projects appear under "My Projects" section header; shared projects appear under "Shared Projects" section header in the project sidebar.

4. **AC-1.4: Personal-to-shared upgrade** - Personal projects can be upgraded to shared projects by adding a member (requires confirmation dialog); downgrade from shared to personal is prohibited.

5. **AC-1.5: Project isolation enforced** - Workflows in personal projects cannot access shared project files; workflows in shared projects cannot access personal project files; storage boundaries enforced via Epic 10's capability-based sandboxing.

## Tasks / Subtasks

### Task 1: Backend - Add Project Type Field (AC: 1.1)
- [ ] **1.1** Add `type` column to projects table
  - [ ] 1.1.1 Create database migration: `V2.6__add_project_type.sql`
  - [ ] 1.1.2 Add `type VARCHAR(50) NOT NULL DEFAULT 'shared'` column
  - [ ] 1.1.3 Add CHECK constraint: `type IN ('personal', 'shared')`
  - [ ] 1.1.4 Add index on `type` column for filtering: `CREATE INDEX idx_projects_type ON projects(type)`
  - [ ] 1.1.5 Test migration on dev database
- [ ] **1.2** Update Project entity and DTOs
  - [ ] 1.2.1 Add `type` field to ProjectEntity with enum: `ProjectType.PERSONAL` or `ProjectType.SHARED`
  - [ ] 1.2.2 Add `type` field to ProjectDTO
  - [ ] 1.2.3 Add `type` parameter to CreateProjectRequest DTO (required)
  - [ ] 1.2.4 Update ProjectMapper to include type field
  - [ ] 1.2.5 Update ProjectService to accept type in create() method

### Task 2: Backend - Enforce Single-Member Constraint (AC: 1.2)
- [ ] **2.1** Add database trigger for single-member enforcement
  - [ ] 2.1.1 Create trigger function: `enforce_personal_project_members()`
  - [ ] 2.1.2 Trigger checks project type before allowing member insert
  - [ ] 2.1.3 If type='personal' and member count > 0, raise exception
  - [ ] 2.1.4 Create trigger: `BEFORE INSERT ON project_members FOR EACH ROW EXECUTE FUNCTION enforce_personal_project_members()`
  - [ ] 2.1.5 Test trigger with unit tests (attempt to add second member to personal project)
- [ ] **2.2** Add application-level validation
  - [ ] 2.2.1 Update `ProjectService.addMember()` to check project type
  - [ ] 2.2.2 If type='personal', throw `PersonalProjectMemberLimitException`
  - [ ] 2.2.3 Return 400 Bad Request with error message: "Personal projects can only have one member (the owner)"
  - [ ] 2.2.4 Add unit test for service-level validation

### Task 3: Backend - Personal-to-Shared Upgrade (AC: 1.4)
- [ ] **3.1** Add upgrade endpoint
  - [ ] 3.1.1 Create endpoint: `POST /api/projects/{id}/upgrade-to-shared`
  - [ ] 3.1.2 Verify current user is owner
  - [ ] 3.1.3 Verify current type is 'personal'
  - [ ] 3.1.4 Update project.type='shared' in database
  - [ ] 3.1.5 Return updated ProjectDTO with type='shared'
- [ ] **3.2** Prevent downgrade
  - [ ] 3.2.1 Ensure no endpoint exists for shared-to-personal conversion
  - [ ] 3.2.2 Add validation in `ProjectService.updateProject()` to reject type changes from 'shared' to 'personal'
  - [ ] 3.2.3 Return 400 Bad Request if attempted: "Cannot downgrade shared project to personal"
  - [ ] 3.2.4 Add integration test for downgrade prevention

### Task 4: Desktop - Update Project Interface (AC: 1.1)
- [ ] **4.1** Add type field to TypeScript Project interface
  - [ ] 4.1.1 Update Project interface in `src/types/project.ts`: Add `type: 'personal' | 'shared'`
  - [ ] 4.1.2 Update ProjectService to include type in API requests
  - [ ] 4.1.3 Update ProjectCache to cache type field
  - [ ] 4.1.4 Update all project-related components to access type field

### Task 5: Desktop - Type-Based Sidebar Grouping (AC: 1.3)
- [ ] **5.1** Update ProjectSidebar component
  - [ ] 5.1.1 Change grouping logic from role-based to type-based
  - [ ] 5.1.2 Group projects: `personalProjects = projects.filter(p => p.type === 'personal')`
  - [ ] 5.1.3 Group projects: `sharedProjects = projects.filter(p => p.type === 'shared')`
  - [ ] 5.1.4 Render section header: "My Projects" for personal projects
  - [ ] 5.1.5 Render section header: "Shared Projects" for shared projects
  - [ ] 5.1.6 Sort personal projects alphabetically
  - [ ] 5.1.7 Sort shared projects alphabetically
  - [ ] 5.1.8 Update CSS for section headers (font-weight, margin)

### Task 6: Desktop - Upgrade Confirmation Dialog (AC: 1.4)
- [ ] **6.1** Create UpgradeToSharedDialog component
  - [ ] 6.1.1 Create Svelte component: `UpgradeToSharedDialog.svelte`
  - [ ] 6.1.2 Display warning message: "This will upgrade your personal project to a shared project. Team members will be able to access all workflows. Continue?"
  - [ ] 6.1.3 Add "Cancel" and "Upgrade" buttons
  - [ ] 6.1.4 On "Upgrade", call IPC: `ipcRenderer.invoke('projects:upgrade-to-shared', projectId)`
  - [ ] 6.1.5 Show loading state during upgrade
  - [ ] 6.1.6 On success: Close dialog, refresh project list, show success toast
  - [ ] 6.1.7 On failure: Show error message, keep dialog open
- [ ] **6.2** Integrate upgrade dialog with member add flow
  - [ ] 6.2.1 Update MemberManagementUI: Before adding member, check if project.type='personal'
  - [ ] 6.2.2 If personal, show UpgradeToSharedDialog
  - [ ] 6.2.3 If user confirms upgrade, proceed with upgrade → then add member
  - [ ] 6.2.4 If user cancels, abort member add operation

### Task 7: Project Isolation (AC: 1.5)
- [ ] **7.1** Verify Epic 10 capability sandboxing integration
  - [ ] 7.1.1 Confirm StorageService uses project-scoped URLs: `holokai://project/{projectId}/path`
  - [ ] 7.1.2 Confirm capability format includes project ID: `filesystem:read:project:{projectId}`
  - [ ] 7.1.3 Test cross-project access: Create workflow in personal project, attempt to access shared project file
  - [ ] 7.1.4 Verify PermissionDeniedError is thrown by Epic 10's CapabilityEnforcer
  - [ ] 7.1.5 Test reverse: Create workflow in shared project, attempt to access personal project file
  - [ ] 7.1.6 Verify error message is clear: "Workflow does not have permission to access files in project {projectId}"

### Task 8: Testing
- [ ] **8.1** Backend unit tests
  - [ ] 8.1.1 Test project creation with type='personal'
  - [ ] 8.1.2 Test project creation with type='shared'
  - [ ] 8.1.3 Test single-member constraint: Attempt to add second member to personal project → expect exception
  - [ ] 8.1.4 Test upgrade: POST /api/projects/{id}/upgrade-to-shared → expect type changed
  - [ ] 8.1.5 Test downgrade prevention: Attempt to change type from 'shared' to 'personal' → expect 400 error
- [ ] **8.2** Backend integration tests
  - [ ] 8.2.1 Test database trigger: Insert second member into personal project → expect constraint violation
  - [ ] 8.2.2 Test upgrade flow: Create personal project → upgrade → add member → verify success
  - [ ] 8.2.3 Test project listing: Create 5 personal + 5 shared projects → verify type field in response
- [ ] **8.3** Desktop E2E tests
  - [ ] 8.3.1 Test sidebar grouping: Create personal and shared projects → verify "My Projects" and "Shared Projects" sections
  - [ ] 8.3.2 Test upgrade dialog: Add member to personal project → verify confirmation dialog → confirm → verify upgrade success
  - [ ] 8.3.3 Test project isolation: Create workflow in personal project → attempt to access shared project file → verify error
- [ ] **8.4** Migration testing
  - [ ] 8.4.1 Test migration on clean database
  - [ ] 8.4.2 Test migration on database with 100 existing projects (all should default to type='shared')
  - [ ] 8.4.3 Verify rollback works correctly

## Dev Notes

### Architecture Patterns

**Project Type Model:**
- Extends existing `projects` table from Epic 3 with `type` field
- Two types: `'personal'` (single-member) and `'shared'` (multi-member)
- Personal projects enforce single-member constraint via database trigger + application validation
- Shared projects allow multiple members (no limit)
- Personal projects can be upgraded to shared (one-way only)

**Single-Member Enforcement:**
- Database trigger: `enforce_personal_project_members()` prevents INSERT into project_members if count > 0 for personal projects
- Application validation: `ProjectService.addMember()` checks type before allowing member add
- Upgrade flow: User must explicitly upgrade to shared before adding members

**Type-Based Grouping:**
- ProjectSidebar groups by `project.type` field (not by role)
- "My Projects" = `projects.filter(p => p.type === 'personal')`
- "Shared Projects" = `projects.filter(p => p.type === 'shared')`

**Project Isolation (Epic 10 Integration):**
- Each project has isolated storage: `holokai://project/{projectId}/`
- Workflows inherit project-scoped capabilities: `filesystem:read:project:{projectId}`
- Cross-project access attempts are rejected by Epic 10's CapabilityEnforcer
- No special isolation needed between personal vs shared - all projects are isolated from each other

### Database Schema

**Migration: V2.6__add_project_type.sql**
```sql
-- Add type column with default 'shared' for backward compatibility
ALTER TABLE projects ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT 'shared';

-- Add CHECK constraint for valid types
ALTER TABLE projects ADD CONSTRAINT check_project_type CHECK (type IN ('personal', 'shared'));

-- Add index for filtering by type
CREATE INDEX idx_projects_type ON projects(type);

-- Create trigger function to enforce single-member constraint for personal projects
CREATE OR REPLACE FUNCTION enforce_personal_project_members()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT type FROM projects WHERE id = NEW.project_id) = 'personal' THEN
    IF (SELECT COUNT(*) FROM project_members WHERE project_id = NEW.project_id) > 0 THEN
      RAISE EXCEPTION 'Personal projects can only have one member (the owner)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce constraint
CREATE TRIGGER check_personal_project_members
  BEFORE INSERT ON project_members
  FOR EACH ROW
  EXECUTE FUNCTION enforce_personal_project_members();
```

### TypeScript Interfaces

**Updated Project Interface:**
```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  type: 'personal' | 'shared';  // NEW: Project type
  color: string;
  icon: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  memberCount: number;
  threadCount: number;
}

interface CreateProjectRequest {
  name: string;
  description?: string;
  type: 'personal' | 'shared';  // NEW: Required type selection
  color: string;
  icon: string;
}
```

### API Endpoints

**Updated Endpoints:**
```
POST /api/projects
Body: { name, description, type, color, icon }
Response: ProjectDTO with type field

POST /api/projects/{id}/upgrade-to-shared
Body: {}
Response: ProjectDTO with type='shared'

POST /api/projects/{id}/members (existing)
Behavior: Reject if project.type='personal' with 400 error
```

### UI Components

**ProjectSidebar.svelte Updates:**
```typescript
// Group projects by type (not by role)
$: personalProjects = $projects.filter(p => p.type === 'personal');
$: sharedProjects = $projects.filter(p => p.type === 'shared');

// Render grouped sections
{#if personalProjects.length > 0}
  <h3 class="section-header">My Projects</h3>
  {#each personalProjects as project}
    <ProjectListItem {project} />
  {/each}
{/if}

{#if sharedProjects.length > 0}
  <h3 class="section-header">Shared Projects</h3>
  {#each sharedProjects as project}
    <ProjectListItem {project} />
  {/each}
{/if}
```

**UpgradeToSharedDialog.svelte:**
```svelte
<Dialog bind:open={isOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Upgrade to Shared Project?</DialogTitle>
    </DialogHeader>
    <p>
      This will upgrade your personal project to a shared project.
      Team members will be able to access all workflows.
      This action cannot be undone.
    </p>
    <p>Continue?</p>
    <DialogFooter>
      <Button variant="outline" on:click={close}>Cancel</Button>
      <Button on:click={handleUpgrade} disabled={isUpgrading}>
        {#if isUpgrading}Upgrading...{:else}Upgrade{/if}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Testing Strategy

- **Unit Tests**: Project type validation, single-member constraint, upgrade logic
- **Integration Tests**: Database trigger enforcement, API endpoint behavior, member add rejection
- **E2E Tests**: Sidebar grouping, upgrade confirmation dialog, project isolation
- **Migration Tests**: Backward compatibility (existing projects default to 'shared')

### Project Structure Notes

**Storage Layout (Unchanged from Epic 3):**
```
~/.holokai/projects/
├── {personal-project-id}/           # Personal project
│   ├── .holokai/
│   │   ├── config.yaml              # Project-specific config
│   │   └── workflows/
│   │       ├── custom/              # User-created workflows
│   │       └── marketplace/         # Installed marketplace workflows
│   └── ...
├── {shared-project-id}/             # Shared project
│   ├── .holokai/
│   │   ├── config.yaml              # Team workflow config
│   │   └── workflows/
│   │       └── marketplace/         # Team-installed workflows
│   └── ...
```

**No Special "My Workflows" Project:**
- Users create personal projects with any name they choose
- No auto-creation of special projects
- Personal projects are just regular projects with `type='personal'` and single-member enforcement

### References

**Technical Specification:**
- [Source: docs/sprint-artifacts/tech-spec-epic-9.md#Overview] - Epic 9 strategic importance
- [Source: docs/sprint-artifacts/tech-spec-epic-9.md#System-Architecture-Alignment] - Epic 3 Project Collaboration integration
- [Source: docs/sprint-artifacts/tech-spec-epic-3.md#Project-Entity] - Base Project data model

**Architecture Documentation:**
- [Source: docs/architecture.md#Data-Architecture] - Storage strategy and data models
- [Source: docs/architecture.md#Component-Overview] - Main process and renderer components

**Dependencies:**
- Epic 3: Project Collaboration (completed) - Provides project model, ProjectService, RBAC
- Epic 10: Portable Workflow Engine (in progress) - Provides storage abstraction and capability enforcement

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e9-s1-my-workflows-personal-project.context.xml

- docs/sprint-artifacts/e9-s1-my-workflows-personal-project.context.xml



### Agent Model Used

<!-- Agent model name and version will be added here during development -->

### Debug Log References

<!-- Debug logs will be added here during development -->

### Completion Notes List

<!-- Completion notes will be added here during development -->

### File List

<!-- File list will be added here during development -->

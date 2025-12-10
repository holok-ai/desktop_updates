# Story 3.5: Project Creation Dialog

Status: ready-for-dev

## Story

As a desktop application user,
I want a project creation dialog with fields for name, description, color (from Moku Web palette), and icon,
so that I can create new projects with consistent branding and visual organization.

## Acceptance Criteria

1. Dialog opens when "New Project" clicked
2. Form fields: name (required, 1-100 chars), description (optional), **type selector (Personal/Shared, required)**, color (predefined Moku Web palette - 12 colors), icon (selector)
3. **Type selector defaults to "Personal" with help text explaining the difference**
4. Color picker shows ONLY predefined palette (no custom hex input)
5. Client-side validation prevents submission with invalid data (name length, color from palette, type selection)
6. "Create" button calls ProjectService.create() with type and shows loading state
7. Success: dialog closes, navigates to new project
8. Failure: error message shown, user can retry
9. Project creation completes in <2s (P95)
10. Database foreign key created with ON DELETE CASCADE for project_id

## Tasks / Subtasks

- [ ] **Task 1: Implement Dialog UI and Form (AC: 1-3)**
  - [ ] Create ProjectCreationDialog component (modal/dialog UI)
  - [ ] Add form fields: name (text input, required, max 100 chars), description (textarea, optional), type (radio buttons), color (color picker), icon (icon selector)
  - [ ] Open dialog when "New Project" button clicked from sidebar (E3-S4)
  - [ ] Add "Create" and "Cancel" buttons
  - [ ] Implement dialog open/close state management

- [ ] **Task 1.5: Implement Project Type Selector (AC: 2-3)**
  - [ ] Add type selector with radio buttons: "Personal Project" and "Shared Project"
  - [ ] Default selection to "Personal Project"
  - [ ] Add help text for Personal: "Only you can access. Can be upgraded to shared later."
  - [ ] Add help text for Shared: "Invite team members to collaborate."
  - [ ] Store selected type in form state
  - [ ] Include type in CreateProjectRequest body

- [ ] **Task 2: Implement Moku Web Color Picker (AC: 3)**
  - [ ] Create color picker component with predefined Moku Web palette (12 colors)
  - [ ] Display colors as color swatches (grid layout)
  - [ ] Allow single color selection (radio button pattern)
  - [ ] Default to first color (Blue #3B82F6)
  - [ ] **NO custom hex input** - palette only
  - [ ] Validate selected color is from MOKU_PROJECT_COLORS array

- [ ] **Task 3: Implement Icon Selector (AC: 2)**
  - [ ] Create icon selector component with Moku Web icon set
  - [ ] Display icons in grid/list view
  - [ ] Allow single icon selection
  - [ ] Default to a standard project icon (e.g., "folder" or "briefcase")
  - [ ] Store icon identifier (string) in Project entity

- [ ] **Task 4: Implement Client-Side Validation (AC: 5)**
  - [ ] Validate name: required, 1-100 characters, alphanumeric + spaces/hyphens only
  - [ ] Validate type: required, must be 'personal' or 'shared'
  - [ ] Validate color: must be from MOKU_PROJECT_COLORS array
  - [ ] Validate icon: must be valid icon identifier
  - [ ] Show inline error messages for invalid inputs
  - [ ] Disable "Create" button if validation fails

- [ ] **Task 5: Implement Project Creation Flow (AC: 5-7)**
  - [ ] Wire "Create" button to ProjectService.create()
  - [ ] Show loading spinner during API call
  - [ ] On success: Close dialog, navigate to new project detail view (E3-S6)
  - [ ] On failure: Show error message (toast or inline), keep dialog open, allow retry
  - [ ] Handle API errors: network failure, validation errors, server errors

- [ ] **Task 6: Verify Database Foreign Key (AC: 9)**
  - [ ] Confirm Moku API creates ON DELETE CASCADE foreign key for project_id in desktop_threads table
  - [ ] Integration test: Create project → Delete project → Verify threads cascade deleted
  - [ ] Document foreign key constraint in Dev Notes

- [ ] **Task 7: Performance and Testing (AC: 8)**
  - [ ] Benchmark project creation end-to-end (dialog submit → API → cache → navigation)
  - [ ] Target: <2s (P95) for project creation
  - [ ] Unit test: Form validation logic
  - [ ] Unit test: Color picker (palette only, no custom hex)
  - [ ] E2E test: Full creation flow with Moku Web color palette and icon selector
  - [ ] E2E test: Error handling (API failure, retry flow)

## Dev Notes

### Project Type Selector (E9-S1 Integration)

**Type Options:**
- **Personal Project**: Single-member projects, only owner can access
  - Help text: "Only you can access. Can be upgraded to shared later."
  - Default selection
  - Suitable for private workflows, personal experimentation
- **Shared Project**: Multi-member projects, team collaboration
  - Help text: "Invite team members to collaborate."
  - Can add/remove members after creation
  - Suitable for team workflows, shared resources

**UI Pattern:**
```svelte
<RadioGroup bind:value={selectedType}>
  <RadioGroupItem value="personal">
    <Label>Personal Project</Label>
    <HelpText>Only you can access. Can be upgraded to shared later.</HelpText>
  </RadioGroupItem>
  <RadioGroupItem value="shared">
    <Label>Shared Project</Label>
    <HelpText>Invite team members to collaborate.</HelpText>
  </RadioGroupItem>
</RadioGroup>
```

**API Integration:**
```typescript
interface CreateProjectRequest {
  name: string;
  description?: string;
  type: 'personal' | 'shared';  // NEW: Required field
  color: string;
  icon: string;
}
```

### Moku Web Color Palette (Tech Spec §4.2, Open Question #1)

**DECISION:** Colors follow Moku Web design system (12 predefined colors)

```typescript
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

**Rationale:**
- Consistent branding across Desktop and Web apps
- Reduces complexity (no custom hex input in MVP)
- Ensures visual consistency
- Future: Allow custom colors for premium/enterprise plans

### Project Creation Flow (Tech Spec §4.4)

1. User clicks "New Project" button in sidebar
2. ProjectCreationDialog opens with form fields
3. User fills: name (required), description (optional), color (from Moku Web palette - 12 colors), icon (selector)
4. Client-side validation: name 1-100 chars, no special chars in name, color must be from predefined palette
5. User clicks "Create"
6. ProjectService.create() calls Moku API `POST /api/projects`
7. API returns new project with generated ID
8. **API creates foreign key with ON DELETE CASCADE for project_id in desktop_threads table**
9. ProjectService adds to cache with 5-minute TTL
10. UI navigates to new project detail view

### Input Validation Rules

- **Name**:
  - Required field
  - 1-100 characters
  - Alphanumeric + spaces + hyphens only (regex: `^[a-zA-Z0-9\s\-]+$`)
  - Trim whitespace before validation
- **Description**:
  - Optional field
  - Max 500 characters
- **Color**:
  - Must be one of MOKU_PROJECT_COLORS (exact hex match)
  - No custom hex input allowed
- **Icon**:
  - Must be valid icon identifier from Moku Web icon set
  - Default: "folder" or "briefcase"

### API Endpoint (Tech Spec §4.3)

```typescript
POST /api/projects

Request Body:
{
  "name": "string (1-100 chars)",
  "description": "string (optional)",
  "color": "string (hex from MOKU_PROJECT_COLORS)",
  "icon": "string (icon identifier)"
}

Response:
{
  "id": "string (UUID)",
  "name": "string",
  "description": "string?",
  "color": "string",
  "icon": "string",
  "ownerId": "string (current user)",
  "createdAt": "ISO 8601 date",
  "updatedAt": "ISO 8601 date",
  "memberCount": 1,
  "threadCount": 0
}
```

### IPC Handler (Tech Spec §4.3)

```typescript
const newProject = await ipcRenderer.invoke('projects:create', {
  name: formData.name,
  description: formData.description,
  color: formData.color,  // Must be from MOKU_PROJECT_COLORS
  icon: formData.icon
});
```

### Foreign Key Constraint (Tech Spec §4.4, Open Question #2)

**DECISION:** Cascade delete - threads deleted when project deleted

Database constraint:
```sql
ALTER TABLE desktop_threads
ADD CONSTRAINT fk_project_id
FOREIGN KEY (project_id)
REFERENCES projects(id)
ON DELETE CASCADE;
```

This ensures when a project is deleted, all associated threads and messages are automatically deleted.

### Performance Targets (Tech Spec §6.1)

- **Project Creation**: <2s end-to-end (P95) - API call + cache update + UI navigation
- **Dialog Open**: <100ms
- **Form Validation**: <50ms (client-side only)

### UI/UX Patterns

- **Dialog Layout**: Modal overlay with centered form
- **Color Picker**: Grid of color swatches (4x3 or 6x2 layout)
- **Icon Selector**: Grid of icon buttons with hover preview
- **Error Messages**: Inline below each field + toast for API errors
- **Loading State**: Disable form, show spinner on "Create" button

### Testing Strategy

- **Unit Tests**: Form validation (name, color from palette, icon), color picker component
- **E2E Tests**: Full creation flow (open dialog → fill form → submit → navigate), error handling (API failure), retry flow
- **Manual Tests**: Color picker UI (verify 12 colors, no custom hex input), icon selector UX
- **Integration Tests**: Verify ON DELETE CASCADE foreign key (create project → delete → verify threads deleted)

### Dependencies

- **Requires: E3-S1 (ProjectService)** - API for creating projects
- **Called by: E3-S4 (ProjectSidebarUI)** - "New Project" button opens dialog
- **Navigates to: E3-S6 (ProjectDetailView)** - On success, navigate to new project

### References

- [Tech Spec: Epic 3 Project Collaboration](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md)
- [Tech Spec §4.2: Data Models (Moku Web colors)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#data-models-and-contracts)
- [Tech Spec §4.4: Project Creation Flow](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#workflows-and-sequencing)
- [Tech Spec §6.1: Performance (Creation <2s)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#performance)
- [Tech Spec §9: Open Question #1 (Color palette decision)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#open-questions)
- [Tech Spec §9: Open Question #2 (Cascade delete decision)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#open-questions)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e3-s5-project-creation-dialog.context.xml

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

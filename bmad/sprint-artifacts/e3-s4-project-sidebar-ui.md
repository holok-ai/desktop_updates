# Story 3.4: Project Sidebar UI

Status: ready-for-dev

## Story

As a desktop application user,
I want a project sidebar that displays my personal and shared projects with a refresh button,
so that I can easily navigate between projects and manually fetch the latest updates.

## Acceptance Criteria

1. Sidebar displays project list grouped: **"My Projects" (type=personal)** and **"Shared Projects" (type=shared)**
2. Each project shows: icon, name, color indicator (from Moku Web palette)
3. Clicking project navigates to project detail view
4. "New Project" button visible and functional
5. "Refresh" button visible and invalidates cache when clicked
6. Project list updates when cache invalidated (manual refresh)
7. Sidebar renders in <100ms for 100 projects
8. Pending invitations badge shown with count

## Tasks / Subtasks

- [ ] **Task 1: Implement Sidebar Layout and Type-Based Grouping (AC: 1-2)**
  - [ ] Create ProjectSidebarUI component (Svelte)
  - [ ] Implement type-based grouped list rendering: "My Projects" section (type='personal'), "Shared Projects" section (type='shared')
  - [ ] Filter projects by type: `personalProjects = projects.filter(p => p.type === 'personal')`
  - [ ] Filter projects by type: `sharedProjects = projects.filter(p => p.type === 'shared')`
  - [ ] Display project icon (icon identifier from Project entity)
  - [ ] Display project name
  - [ ] Display color indicator using Moku Web palette (12 colors)
  - [ ] Add visual distinction between groups (section headers with bold font, spacing)

- [ ] **Task 2: Implement Project Navigation (AC: 3)**
  - [ ] Add click handler for project items
  - [ ] Navigate to project detail view on click (route: /projects/{projectId})
  - [ ] Highlight selected project in sidebar (active state)
  - [ ] Handle navigation state management

- [ ] **Task 3: Implement Action Buttons (AC: 4-5)**
  - [ ] Add "New Project" button at top of sidebar
  - [ ] Wire "New Project" button to open ProjectCreationDialog (E3-S5)
  - [ ] Add "Refresh" button (icon button, visible near top)
  - [ ] Implement refresh handler: call ProjectService.refresh(), invalidate cache
  - [ ] Show loading indicator during refresh operation

- [ ] **Task 4: Implement Cache-Driven Updates (AC: 6)**
  - [ ] Subscribe to cache invalidation events from ProjectService
  - [ ] Re-fetch project list when cache invalidated
  - [ ] Update UI reactively when new data loaded
  - [ ] Handle empty project list state (onboarding message)

- [ ] **Task 5: Implement Pending Invitations Badge (AC: 8)**
  - [ ] Add "Invitations" section at top of sidebar
  - [ ] Display badge with count of pending invitations
  - [ ] Fetch invitation count: GET /api/invitations (filter status: pending)
  - [ ] Update badge count on refresh
  - [ ] Click badge navigates to invitations view

- [ ] **Task 6: Performance Optimization (AC: 7)**
  - [ ] Implement virtualization for long project lists (if >50 projects)
  - [ ] Optimize rendering: React.memo or equivalent
  - [ ] Lazy load project icons/colors
  - [ ] Benchmark render time with 10/50/100 projects (target: <100ms for 100)

- [ ] **Task 7: Testing**
  - [ ] Unit test: Grouped list rendering (owned vs shared)
  - [ ] Unit test: Refresh button invalidates cache
  - [ ] E2E test: Click project navigates to detail view
  - [ ] E2E test: Refresh button fetches latest data
  - [ ] Performance test: Render time <100ms for 100 projects
  - [ ] Accessibility test: Keyboard navigation, screen reader support

## Dev Notes

### Architecture Alignment (Tech Spec §8.1)

- **Primary Sidebar Section**: Projects are a core sidebar component (Architecture §8.1)
- **Position**: Projects section appears below threads, above settings
- **Grouping (Type-Based - E9-S1 Integration)**: Two groups - "My Projects" (type='personal'), "Shared Projects" (type='shared')
  - **Changed from role-based to type-based grouping** for cleaner personal vs team distinction
  - Personal projects: Single-member, private workflows
  - Shared projects: Multi-member, team collaboration

### Moku Web Color Palette (Tech Spec §4.2)

Use the predefined Moku Web color palette for project color indicators:

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

### Manual Refresh Flow (Tech Spec §4.4)

1. User clicks "Refresh" button
2. onClick handler calls ProjectService.refresh()
3. ProjectService invalidates all project caches: ProjectCache.invalidatePattern('projects:*')
4. ProjectService fetches fresh data: GET /api/projects
5. Cache updated with new 5-minute TTL
6. Sidebar component re-fetches project list (cache miss → API call)
7. UI updates with latest projects (owned + shared)

### Type-Based Grouping Logic (E9-S1 Integration)

```typescript
// Group projects by type (not by role)
$: personalProjects = $projects.filter(p => p.type === 'personal').sort((a, b) => a.name.localeCompare(b.name));
$: sharedProjects = $projects.filter(p => p.type === 'shared').sort((a, b) => a.name.localeCompare(b.name));
```

```svelte
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

### IPC Handlers (Tech Spec §4.3)

```typescript
// Fetch project list
const projects = await ipcRenderer.invoke('projects:list');

// Manual refresh
await ipcRenderer.invoke('projects:refresh');

// Fetch pending invitations count
const invitations = await ipcRenderer.invoke('projects:listInvitations');
const pendingCount = invitations.filter(inv => inv.status === 'pending').length;
```

### Performance Targets (Tech Spec §6.1)

- **Sidebar Render**: <100ms for 100 projects
- **Project List Retrieval**: <300ms (cache hit), <1s (cache miss / API call)
- **Refresh Operation**: <2s (P95)

### UI/UX Patterns

- **Empty State**: "No projects yet. Create your first project to collaborate with your team."
- **Loading State**: Skeleton loader during initial fetch
- **Error State**: "Unable to load projects. [Retry]" button
- **Active State**: Selected project highlighted with background color

### Testing Strategy

- **Unit Tests**: Component rendering, grouped list logic, button handlers
- **E2E Tests**: Navigation, refresh button, pending invitations badge
- **Performance Tests**: Render time benchmarks with 10/50/100 projects
- **Accessibility Tests**: Keyboard navigation (Tab, Enter), ARIA labels, screen reader

### Dependencies

- **Requires: E3-S1 (ProjectService)** - API for fetching project list
- **Requires: E3-S2 (ProjectCache)** - Cache integration for performance
- **Integrates with: E3-S5 (ProjectCreationDialog)** - "New Project" button opens dialog
- **Integrates with: E3-S6 (ProjectDetailView)** - Clicking project navigates to detail view

### References

- [Tech Spec: Epic 3 Project Collaboration](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md)
- [Tech Spec §4.1: Services (ProjectSidebarUI)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#services-and-modules)
- [Tech Spec §4.2: Data Models (Moku Web colors)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#data-models-and-contracts)
- [Tech Spec §4.3: IPC Handlers](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#apis-and-interfaces)
- [Tech Spec §4.4: Manual Refresh Flow](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#workflows-and-sequencing)
- [Tech Spec §6.1: Performance (Sidebar render)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#performance)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e3-s4-project-sidebar-ui.context.xml

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

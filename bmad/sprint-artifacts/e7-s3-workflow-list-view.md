# Story 7.3: Workflow List View

Status: ready-for-dev

## Story

As a user,
I want to view a list of available workflows in the project sidebar,
so that I can discover, filter, and execute workflows relevant to my current project.

## Acceptance Criteria

### AC-3.1: Workflow List Rendering
- [ ] Workflow list renders in project sidebar with workflow names and metadata (name, last modified date, execution count badge)
- [ ] WorkflowList component loads workflows via WorkflowService on mount
- [ ] Each workflow displayed as a WorkflowListItem with hover effects
- [ ] Workflow metadata includes: name, lastModified date, executionCount badge
- [ ] List updates when new workflow created or existing workflow updated

[Source: tech-spec-epic-7.md §3 Detailed Design - Acceptance Criteria AC-3.1]

### AC-3.2: New Workflow Button
- [ ] "New Workflow" button displays in workflow section header
- [ ] Clicking button opens WorkflowEditor with empty workflow definition
- [ ] Button navigates to `/workflows/new` route
- [ ] Button accessible via keyboard (Tab + Enter)

[Source: tech-spec-epic-7.md §3 Detailed Design - Acceptance Criteria AC-3.2]

### AC-3.3: Workflow Navigation
- [ ] Clicking workflow item navigates to workflow detail/editor view
- [ ] Navigation target: `/workflows/{workflowId}` route
- [ ] Loading state displayed while navigating
- [ ] Back navigation preserves list scroll position

[Source: tech-spec-epic-7.md §3 Detailed Design - Acceptance Criteria AC-3.3]

### AC-3.4: Template Badge Display
- [ ] Template badge displayed for workflows with `isTemplate=true`
- [ ] Badge visually distinct (e.g., "Template" label with distinct color/styling)
- [ ] Badge positioned consistently across all workflow items (top-right corner)
- [ ] Template workflows visually distinguishable from regular workflows

[Source: tech-spec-epic-7.md §3 Detailed Design - Acceptance Criteria AC-3.4]

### AC-3.5: Scope Filter
- [ ] Scope filter dropdown displays: "All", "Personal", "Project"
- [ ] Filter selection updates workflow list via WorkflowService API call
- [ ] Default filter: "All" (shows personal + project workflows)
- [ ] Filter state persists in local storage (remembered across sessions)
- [ ] Filter works correctly: Personal shows only `scope=personal`, Project shows only `scope=project`

[Source: tech-spec-epic-7.md §3 Detailed Design - Acceptance Criteria AC-3.5]

### AC-3.6: Empty State
- [ ] Empty state displayed when no workflows exist (filtered or unfiltered)
- [ ] Empty state shows friendly message: "No workflows yet"
- [ ] Empty state includes "Create Workflow" CTA button
- [ ] Empty state updates when filter changes

[Source: tech-spec-epic-7.md §3 Detailed Design - Acceptance Criteria AC-3.6]

### AC-3.7: Virtual Scrolling Performance
- [ ] Virtual scrolling enabled for lists with >100 workflows
- [ ] List renders only visible items + buffer (20 items above/below viewport)
- [ ] Scroll performance meets target: 60fps smooth scrolling
- [ ] Workflow list load time: <500ms P95

[Source: tech-spec-epic-7.md §3 Detailed Design - Acceptance Criteria AC-3.7]

## Tasks / Subtasks

### Task 1: Create WorkflowList Component (AC: 3.1, 3.3, 3.6)
- [ ] Create `src/lib/components/workflows/WorkflowList.svelte`
  - [ ] Define component props: `projectId` (optional - null for personal workflows)
  - [ ] Import WorkflowService from electron service wrapper
  - [ ] Define reactive workflows array state
  - [ ] Define loading and error states
- [ ] Implement workflow loading on mount
  - [ ] Call `window.electronAPI.workflow.list({ scope, projectId })` in onMount
  - [ ] Handle loading state (show skeleton loaders)
  - [ ] Handle error state (show error message with retry button)
  - [ ] Update workflows array with API response
- [ ] Implement empty state
  - [ ] Create EmptyState component or inline implementation
  - [ ] Show when `workflows.length === 0`
  - [ ] Display message: "No workflows yet. Create your first workflow to automate repetitive tasks."
  - [ ] Include "Create Workflow" button linking to `/workflows/new`
- [ ] Add list container with proper styling
  - [ ] Use vertical stack layout
  - [ ] Add spacing between items (gap-2 or gap-3)
  - [ ] Ensure scrollable container if content overflows

### Task 2: Create WorkflowListItem Component (AC: 3.1, 3.3, 3.4)
- [ ] Create `src/lib/components/workflows/WorkflowListItem.svelte`
  - [ ] Define props: `workflow` (Workflow interface)
  - [ ] Define click handler for navigation
  - [ ] Use Tailwind for hover effects (hover:bg-gray-100 dark:hover:bg-gray-800)
- [ ] Display workflow name
  - [ ] Render `workflow.name` as primary text (font-semibold, text-base)
  - [ ] Truncate long names with ellipsis (truncate class)
  - [ ] Add title attribute for full name on hover
- [ ] Display workflow metadata
  - [ ] Show last modified date: format as relative time (e.g., "2 hours ago", "3 days ago")
  - [ ] Use `formatDistanceToNow()` from date-fns or similar utility
  - [ ] Show execution count badge (pill-shaped, muted color)
  - [ ] Format as "{count} runs" (e.g., "12 runs", "0 runs")
- [ ] Implement template badge
  - [ ] Check `workflow.isTemplate` boolean flag
  - [ ] If true, render badge with text "Template"
  - [ ] Style badge: small, rounded, distinct color (e.g., blue-500 background, white text)
  - [ ] Position in top-right corner of list item (absolute positioning)
- [ ] Add navigation handler
  - [ ] On click: navigate to `/workflows/${workflow.id}` route
  - [ ] Use router push or SPA router navigation
  - [ ] Add keyboard support (Enter key triggers navigation)

### Task 3: Implement Scope Filter (AC: 3.5)
- [ ] Add filter UI to WorkflowList component
  - [ ] Create filter dropdown or segmented control
  - [ ] Options: "All", "Personal", "Project"
  - [ ] Position above workflow list (mb-4)
  - [ ] Style consistently with other filters in app
- [ ] Implement filter state management
  - [ ] Create reactive `scopeFilter` state variable
  - [ ] Initialize from localStorage: `localStorage.getItem('workflow-scope-filter') || 'all'`
  - [ ] Update localStorage on filter change
- [ ] Wire filter to API calls
  - [ ] Pass `scopeFilter` to WorkflowService.list() as `scope` parameter
  - [ ] Map filter values: "All" → null, "Personal" → "personal", "Project" → "project"
  - [ ] Reload workflows when filter changes (reactive statement)
- [ ] Test filter behavior
  - [ ] Verify "All" shows both personal and project workflows
  - [ ] Verify "Personal" shows only `scope=personal` workflows
  - [ ] Verify "Project" shows only `scope=project` workflows

### Task 4: Add "New Workflow" Button (AC: 3.2)
- [ ] Add button to WorkflowList header
  - [ ] Position button in top-right of workflow section header
  - [ ] Use primary button styling (e.g., bg-blue-600 text-white)
  - [ ] Label: "New Workflow" with optional + icon
- [ ] Implement navigation
  - [ ] On click: navigate to `/workflows/new` route
  - [ ] Pass `projectId` as query parameter if in project context
  - [ ] Use router push with state: `{ projectId }`
- [ ] Add keyboard accessibility
  - [ ] Button focusable via Tab key
  - [ ] Enter/Space triggers navigation

### Task 5: Implement Virtual Scrolling (AC: 3.7)
- [ ] Install svelte-virtual or similar virtual scrolling library
  - [ ] Add dependency: `npm install svelte-virtual`
  - [ ] Import VirtualList component
- [ ] Wrap workflow list in VirtualList
  - [ ] Only enable if `workflows.length > 100`
  - [ ] Set item height: estimate 80px per workflow item
  - [ ] Configure buffer: 20 items above/below viewport
  - [ ] Pass workflows array as data prop
- [ ] Test virtual scrolling performance
  - [ ] Create test fixture with 500+ workflows
  - [ ] Measure scroll performance (target: 60fps)
  - [ ] Verify only visible items + buffer are rendered (check DOM node count)
- [ ] Add fallback for small lists
  - [ ] If `workflows.length <= 100`, render simple list without virtualization
  - [ ] Avoids unnecessary complexity for common case

### Task 6: Integration with WorkflowService (AC: 3.1, 3.5)
- [ ] Create WorkflowService IPC wrapper (if not exists)
  - [ ] Define `window.electronAPI.workflow.list(filters)` method
  - [ ] Map to IPC channel: `workflow:list`
  - [ ] Return Promise<Workflow[]>
- [ ] Test WorkflowService integration
  - [ ] Mock IPC responses in unit tests
  - [ ] Verify filter parameters passed correctly
  - [ ] Verify caching behavior (10min TTL per tech spec)

### Task 7: Add Refresh Capability (AC: 3.1)
- [ ] Add refresh button to WorkflowList header
  - [ ] Icon-only button (refresh icon, circular arrow)
  - [ ] Position next to "New Workflow" button
  - [ ] Show loading spinner when refreshing
- [ ] Implement refresh handler
  - [ ] Call WorkflowService.list() again with current filters
  - [ ] Clear component-level cache (not service cache)
  - [ ] Update workflows array on completion

## Dev Notes

### UI Components Architecture
This story creates the foundational UI layer for workflow management, focusing on discovery and navigation. The WorkflowList component follows existing patterns from ThreadList and ProjectList components.

**Component Hierarchy:**
```
WorkflowList (container)
├── Header (filters + New Workflow button)
├── VirtualList (conditional, for >100 items)
│   └── WorkflowListItem (repeated)
│       ├── Name + Metadata
│       └── Template Badge (conditional)
└── EmptyState (conditional)
```

**Styling Patterns:**
- Use existing Tailwind classes from ThreadList/ProjectList for consistency
- Follow dark mode patterns: `dark:bg-gray-800`, `dark:text-gray-200`
- Hover effects: `hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors`

[Source: architecture.md §1 Architecture Pattern - Multi-Process Electron Architecture]

### WorkflowService Integration
The WorkflowList component integrates with WorkflowService (Epic 7 Story 2) via IPC channels. WorkflowService provides caching with 10min TTL to reduce API load.

**IPC API:**
```typescript
window.electronAPI.workflow.list(filters: {
  scope?: 'personal' | 'project' | 'organization';
  projectId?: string;
}): Promise<Workflow[]>
```

**Caching Strategy:**
- WorkflowService maintains LRU cache (max 500 workflows)
- Cache key includes filter parameters: `list_${JSON.stringify(filters)}`
- Cache TTL: 10 minutes (600s)
- Cache invalidated on create/update/delete operations

[Source: tech-spec-epic-7.md §4.3 APIs and Interfaces - Desktop IPC API]

### Virtual Scrolling Implementation
Virtual scrolling is critical for performance when users have >100 workflows. Use `svelte-virtual` library which provides efficient viewport-based rendering.

**Implementation Notes:**
- Only enable virtual scrolling when `workflows.length > 100`
- Set item height: 80px (estimated based on WorkflowListItem design)
- Buffer size: 20 items above/below viewport (prevents blank areas during fast scrolling)
- Monitor performance: target 60fps, measure with Chrome DevTools Performance panel

**Performance Targets from Tech Spec:**
- Workflow List Load: <500ms P95
- Virtual Scrolling: Smooth 60fps scrolling for 500+ workflows
- Cache Hit Rate: >80% for workflow definitions

[Source: tech-spec-epic-7.md §5 Non-Functional Requirements - Performance]

### Empty State Best Practices
Empty states should be friendly and actionable, guiding users to create their first workflow.

**Recommended Empty State Design:**
- Icon: Large workflow/automation icon (e.g., gear/cog, flowchart)
- Message: "No workflows yet"
- Subtext: "Create your first workflow to automate repetitive tasks"
- CTA Button: "Create Workflow" (primary style, navigates to `/workflows/new`)

[Source: UI patterns from existing ThreadList/ProjectList components]

### Filter State Persistence
Save filter selection to localStorage to preserve user preferences across sessions. This improves UX by remembering the last view the user selected.

**localStorage Key:** `workflow-scope-filter`
**Values:** `'all'`, `'personal'`, `'project'`

### Accessibility Considerations
- All interactive elements (buttons, list items) must be keyboard accessible
- List items focusable via Tab key
- Enter/Space keys trigger navigation
- Screen reader support: add `aria-label` to buttons, `role="button"` to list items
- Loading states: use `aria-busy="true"` during data fetch

### Epic 10 Dependency Note
Epic 7 (Workflows UI) depends on Epic 10 (Portable Workflow Engine) for execution functionality. However, **E7-S3 (Workflow List View) has no direct Epic 10 dependency** - it only displays workflow metadata from Moku API, not execution state.

Execution-related features are in E7-S5 (Workflow Execution UI), which will integrate with Epic 10's execution engine.

[Source: tech-spec-epic-7.md §6 Dependencies and Integrations - Epic 10 Integration Points]

### Project Structure Notes

**Files to Create:**
- `src/lib/components/workflows/WorkflowList.svelte` - Main list container
- `src/lib/components/workflows/WorkflowListItem.svelte` - Individual workflow item
- `src/lib/components/workflows/EmptyState.svelte` - Empty state UI (optional, can be inline)

**Files to Update:**
- `src/routes/projects/[id].svelte` - Add WorkflowsTab to project view (if not already present)
- `src/lib/services/electron.ts` - Add workflow.list() IPC wrapper (if not already present)

**TypeScript Interfaces (from Tech Spec):**
```typescript
interface Workflow {
  id: string;
  ownerId: string;
  projectId?: string;
  name: string;
  description?: string;
  scope: 'personal' | 'project' | 'organization';
  isTemplate: boolean;
  forkedFrom?: string;
  definition: WorkflowDefinition;
  createdAt: Date;
  updatedAt: Date;
  executionCount: number;
  lastExecutedAt?: Date;
}
```

[Source: tech-spec-epic-7.md §4.2 Data Models and Contracts - TypeScript Interfaces]

### Testing Strategy

**Component Tests (Svelte Testing Library):**
- WorkflowList: empty state, loading state, workflow rendering, filter behavior
- WorkflowListItem: click navigation, template badge display, metadata formatting

**E2E Tests (Playwright):**
- Workflow list loads in project view
- Filter switches between All/Personal/Project
- Click workflow navigates to editor
- New Workflow button creates empty workflow
- Virtual scrolling works for >100 workflows

**Coverage Target:** 80%+ for component tests

[Source: tech-spec-epic-7.md §8 Test Strategy Summary]

## References

- [Tech Spec: Epic 7 - Workflows](docs/sprint-artifacts/tech-spec-epic-7.md)
  - §3: Detailed Design - Acceptance Criteria AC-3.1 to AC-3.7
  - §4.1: Services and Modules - WorkflowList component
  - §4.3: APIs and Interfaces - Desktop IPC API
  - §5: Non-Functional Requirements - Performance targets
  - §6: Dependencies and Integrations - Epic 10 integration (not applicable to this story)
- [Epics File](docs/epics-and-stories-2025-11-25.md)
  - E7-S3: Workflow List View story definition
  - Task breakdown and requirement references
- [Architecture](docs/architecture.md)
  - §1: Multi-Process Electron Architecture
  - §2: IPC Communication patterns
  - §7: Component Overview - Renderer process components

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e7-s3-workflow-list-view.context.xml

- docs/sprint-artifacts/e7-s3-workflow-list-view.context.xml



### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

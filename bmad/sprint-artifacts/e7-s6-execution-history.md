# Story 7.6: Execution History

Status: ready-for-dev

## Story

As a workflow user,
I want to view past workflow executions with their details,
so that I can audit execution history, review past results, and replay workflows with previous inputs.

## Acceptance Criteria

1. **AC-6.1: Execution history list displays past executions** - ExecutionHistory component displays list of past executions with status, started time, and duration (from `GET /api/workflows/{id}/executions`)
2. **AC-6.2: Clicking execution expands details** - Clicking execution row expands detail panel showing inputs, outputs, and step-by-step execution trace
3. **AC-6.3: Replay button pre-fills execution inputs** - "Replay" button opens ExecuteWorkflowDialog with execution inputs pre-filled for re-running workflow
4. **AC-6.4: Pagination works for >20 executions** - Execution history uses pagination (20 records per page) with next/previous controls
5. **AC-6.5: Status filter works** - Status filter dropdown (All, Completed, Failed, Running) filters execution list correctly
6. **AC-6.6: Execution trace shows step-level details** - Step-by-step trace displays step name, status, output, and duration for each step

## Tasks / Subtasks

- [ ] Create ExecutionHistory component (AC: 6.1, 6.2)
  - [ ] Create `ExecutionHistory.svelte` component in `src/lib/components/workflows`
  - [ ] Accept `workflowId` prop from parent workflow detail view
  - [ ] Fetch executions via `WorkflowService.getExecutionHistory(workflowId, filters)`
  - [ ] Handle loading state, empty state, and error state
  - [ ] Display execution list with status badges and metadata
  - [ ] Implement expand/collapse for execution details panel

- [ ] Display execution list with metadata (AC: 6.1)
  - [ ] Create `ExecutionListItem.svelte` component for each execution row
  - [ ] Show execution ID (truncated UUID)
  - [ ] Show status badge with color coding (pending=gray, running=blue, completed=green, failed=red, cancelled=orange)
  - [ ] Show started time (formatted as "MMM DD, YYYY HH:mm:ss")
  - [ ] Show duration (if completed/failed, formatted as "Xs" or "Xm Ys")
  - [ ] Show "Running" or "Queued" for incomplete executions
  - [ ] Add click handler to expand/collapse details

- [ ] Implement execution details panel (AC: 6.2, 6.6)
  - [ ] Create `ExecutionDetail.svelte` component displayed when execution expanded
  - [ ] Fetch full execution details via `WorkflowService.getExecution(executionId)` if needed
  - [ ] Display inputs section with key-value pairs (formatted JSON)
  - [ ] Display outputs section with key-value pairs (formatted JSON)
  - [ ] Display execution timing: started_at, completed_at (if complete), duration_ms
  - [ ] Display execution trace table with columns: Step Name, Status, Duration, Output
  - [ ] Format step outputs (collapse long JSON, expand on click)
  - [ ] Show error messages prominently for failed steps (red background)
  - [ ] Add collapsible sections for inputs/outputs/trace to reduce clutter

- [ ] Implement replay functionality (AC: 6.3)
  - [ ] Add "Replay" button to ExecutionDetail component (positioned in header or footer)
  - [ ] On click: extract execution.inputs from current execution
  - [ ] Open ExecuteWorkflowDialog component with workflow and inputs pre-filled
  - [ ] Execution proceeds as normal workflow execution (see E7-S5)
  - [ ] Toast notification: "Replaying workflow with previous inputs"

- [ ] Add pagination controls (AC: 6.4)
  - [ ] Display "Page X of Y" counter
  - [ ] Add "Previous" and "Next" buttons
  - [ ] Fetch page via `WorkflowService.getExecutionHistory(workflowId, { page, size: 20 })`
  - [ ] Disable "Previous" on first page, "Next" on last page
  - [ ] Preserve current page when navigating away and back (store in component state)
  - [ ] Default page size: 20 executions per page (as per tech-spec §4.3)

- [ ] Implement status filter (AC: 6.5)
  - [ ] Add status filter dropdown above execution list
  - [ ] Options: "All", "Completed", "Failed", "Running", "Queued", "Cancelled"
  - [ ] On selection: fetch executions with `{ status: selectedStatus }` filter
  - [ ] Update URL query params to reflect filter (e.g., `?status=completed`)
  - [ ] Reset pagination to page 1 when filter changes
  - [ ] Remember last filter selection in local storage (key: `workflow-history-filter-{workflowId}`)

- [ ] Add empty state handling (AC: 6.1)
  - [ ] Display empty state message when no executions exist: "No executions yet. Run this workflow to see execution history."
  - [ ] Show different message when filter returns no results: "No {status} executions found."
  - [ ] Include "Clear Filter" button in filtered empty state

- [ ] Add execution history tab to workflow detail view (AC: 6.1)
  - [ ] Update WorkflowDetail.svelte (or equivalent workflow view component)
  - [ ] Add "History" tab alongside "Editor" and "Execute" tabs
  - [ ] Mount ExecutionHistory component when History tab active
  - [ ] Pass current workflowId to ExecutionHistory component

- [ ] Write component tests (AC: All)
  - [ ] Test ExecutionHistory component renders execution list correctly
  - [ ] Test ExecutionListItem displays status badges with correct colors
  - [ ] Test ExecutionDetail expands/collapses correctly
  - [ ] Test replay button opens ExecuteWorkflowDialog with pre-filled inputs
  - [ ] Test pagination controls (next/previous buttons, page counter)
  - [ ] Test status filter updates execution list
  - [ ] Test empty state displays correctly

## Dev Notes

### Execution History Component Architecture

**Component Hierarchy:**
```
ExecutionHistory.svelte
├── StatusFilter.svelte (dropdown)
├── ExecutionList.svelte
│   └── ExecutionListItem.svelte (repeated)
│       └── ExecutionDetail.svelte (expanded inline)
│           ├── InputsSection.svelte
│           ├── OutputsSection.svelte
│           └── ExecutionTrace.svelte
└── Pagination.svelte (next/prev controls)
```

**Data Flow:**
1. Parent workflow view passes `workflowId` to ExecutionHistory
2. ExecutionHistory fetches executions via `WorkflowService.getExecutionHistory(workflowId, { status, page })`
3. ExecutionListItem displays summary, clicks expand to show ExecutionDetail
4. ExecutionDetail fetches full execution if not already loaded (optimize: load on expand, not on list fetch)
5. Replay button navigates to ExecuteWorkflowDialog with pre-filled inputs

**Pagination Pattern:**
- Backend API: `GET /api/workflows/{id}/executions?status={status}&page={page}&size=20`
- Response includes: `{ content: [...], totalPages, totalElements, currentPage }`
- Frontend tracks `currentPage` state, increments/decrements on button click
- Reset to page 1 when filter changes

**Status Filter Pattern:**
- Filter values map to backend status enum: `queued`, `running`, `completed`, `failed`, `cancelled`
- "All" filter = omit status parameter from API request
- Filter persisted to local storage: `localStorage.setItem('workflow-history-filter-{workflowId}', status)`
- Read on mount: `const savedFilter = localStorage.getItem(...) || 'all'`

**Execution Trace Display:**
- Trace format (from tech-spec §4.2):
  ```typescript
  interface ExecutionStepTrace {
    stepId: string;
    stepName: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'skipped';
    startedAt: Date;
    completedAt?: Date;
    output?: unknown;
    error?: string;
    durationMs?: number;
  }
  ```
- Display as table with collapsible rows for step outputs
- Long outputs (>500 chars) truncated with "Show More" button
- Failed steps highlighted in red with error message expanded by default

**Replay Functionality:**
- Extract `execution.inputs` (Record<string, unknown>)
- Pass to ExecuteWorkflowDialog as `initialInputs` prop
- ExecuteWorkflowDialog pre-populates input form with these values
- User can modify inputs before submitting (not locked)
- New execution created on submit (not linked to original execution)

### Integration Points

**WorkflowService Methods (from E7-S2):**
- `getExecutionHistory(workflowId: string, filters?: { status?: string, page?: number, size?: number }): Promise<WorkflowExecution[]>`
- `getExecution(executionId: string): Promise<WorkflowExecution>` (if needed for full details)

**IPC Channels:**
- `workflow:execution-history` - Get paginated execution list
- `workflow:get-execution` - Get single execution details (optional, may batch in list fetch)

**Component Dependencies:**
- `ExecuteWorkflowDialog.svelte` (from E7-S5) - Reused for replay functionality
- `WorkflowService.ts` (from E7-S2) - Fetch execution data
- Shared UI components: Badge, Pagination, EmptyState, JsonViewer

### Styling and UX Notes

**Status Badge Colors:**
- `pending` / `queued` → Gray background (#E5E7EB), dark gray text
- `running` → Blue background (#DBEAFE), blue text
- `completed` → Green background (#D1FAE5), green text
- `failed` → Red background (#FEE2E2), red text
- `cancelled` → Orange background (#FED7AA), orange text

**Duration Formatting:**
- Less than 60s: "Xs" (e.g., "3s")
- 60s to 60min: "Xm Ys" (e.g., "2m 34s")
- Over 60min: "Xh Ym" (e.g., "1h 23m")

**Execution List Layout:**
- Table or card-based list (recommend table for scanability)
- Columns: Status (badge), Started At, Duration, Actions (Replay button)
- Expandable rows for execution details (slide-down animation)
- Hover highlight on rows

**Empty State Messages:**
- No executions: "No executions yet. Run this workflow to see execution history."
- Filtered empty: "No {status} executions found. Try a different filter or clear filters."
- Include icon (empty box or clock icon)

### Performance Considerations

- **Lazy Loading:** Only fetch full execution details on expand (not on list load)
- **Pagination:** Limit to 20 executions per page to keep list performant
- **Virtual Scrolling:** Not needed at 20 items per page, but consider if page size increases
- **Caching:** Cache execution list for 30s to avoid redundant API calls (WorkflowCache)
- **Debounce Filter:** Debounce filter changes by 300ms to avoid rapid API calls

### Error Handling

- **API Errors:** Show toast error message if execution list fetch fails
- **Empty Execution Details:** If execution trace missing, show "Execution trace not available"
- **Failed Replays:** If replay fails (e.g., workflow deleted), show error toast with reason

### Testing Strategy

**Unit Tests (Vitest):**
- Test status filter logic (filter selection updates API call)
- Test pagination calculations (currentPage, totalPages)
- Test duration formatting function
- Test empty state rendering based on execution count and filter state

**Component Tests (Svelte Testing Library):**
- Test ExecutionHistory renders execution list
- Test ExecutionListItem displays status badge with correct color
- Test ExecutionDetail expands on click
- Test replay button calls ExecuteWorkflowDialog with correct inputs
- Test pagination next/previous buttons update page
- Test status filter updates list

**Integration Tests:**
- Test full flow: fetch executions → display list → expand details → replay
- Test pagination loads next page correctly
- Test filter changes reset pagination to page 1

**E2E Tests (Playwright):**
- Test user can view execution history from workflow detail view
- Test user can expand execution to see inputs/outputs/trace
- Test user can replay execution and workflow re-runs with previous inputs
- Test pagination works across multiple pages
- Test status filter correctly filters execution list

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-7.md §4.2 Workflow Execution Data Model] - ExecutionStepTrace interface
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md §4.3 APIs and Interfaces] - `GET /api/workflows/{id}/executions` endpoint
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md §4.4 Workflows and Sequencing] - Execution History and Replay Flow
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md §5 Non-Functional Requirements] - Performance targets (execution history load <1s P95)
- [Source: docs/epics-and-stories-2025-11-25.md Epic 7 §E7-S6] - Story requirements and tasks
- [Source: docs/architecture.md §2 Multi-Process Electron Architecture] - IPC communication pattern
- [Source: docs/architecture.md §4 Component Overview] - Renderer process component structure

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e7-s6-execution-history.context.xml

- docs/sprint-artifacts/e7-s6-execution-history.context.xml



### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

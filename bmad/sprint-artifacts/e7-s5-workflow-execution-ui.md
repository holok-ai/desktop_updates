# Story 7.5: Workflow Execution UI

Status: ready-for-dev

## Story

As a Holokai Desktop user,
I want to execute workflows with real-time progress tracking and results display,
so that I can run automated tasks and see their outputs clearly.

## Acceptance Criteria

1. **AC-5.1:** ExecuteWorkflowDialog displays input form based on workflow.definition.inputs
2. **AC-5.2:** Input fields rendered correctly: string → text input, number → number input, boolean → checkbox, file → file picker
3. **AC-5.3:** Required inputs validated before execution (show error if missing)
4. **AC-5.4:** "Run Workflow" button starts execution, shows progress panel
5. **AC-5.5:** Progress panel displays step list with status indicators (queued, running, completed, failed, skipped)
6. **AC-5.6:** Current step highlighted during execution
7. **AC-5.7:** Step outputs displayed when expanded (formatted based on type)
8. **AC-5.8:** Final outputs displayed when execution completes
9. **AC-5.9:** Errors displayed clearly (red highlight, error message)
10. **AC-5.10:** "Run Again" button pre-fills inputs and re-executes workflow

## Tasks / Subtasks

- [ ] Create ExecuteWorkflowDialog component (AC: #5.1, #5.4)
  - [ ] Create `src/lib/components/workflows/ExecuteWorkflowDialog.svelte`
  - [ ] Accept workflow prop (Workflow interface)
  - [ ] Show workflow name and description in header
  - [ ] Implement two-panel layout: inputs left, progress right
  - [ ] Handle dialog open/close state
  - [ ] Track execution state (idle, running, completed, failed)

- [ ] Implement dynamic input form rendering (AC: #5.1, #5.2, #5.3)
  - [ ] Create `src/lib/components/workflows/InputForm.svelte`
  - [ ] Dynamically render fields based on workflow.definition.inputs array
  - [ ] Render string inputs as text fields with label and placeholder
  - [ ] Render number inputs as number fields with validation
  - [ ] Render boolean inputs as checkboxes
  - [ ] Render file inputs as file pickers with drag-and-drop support
  - [ ] Display input descriptions as help text
  - [ ] Mark required fields with asterisk
  - [ ] Implement client-side validation (required fields, type checks)
  - [ ] Show validation errors inline with red text
  - [ ] Disable "Run Workflow" button until all required inputs valid

- [ ] Create execution progress display (AC: #5.4, #5.5, #5.6)
  - [ ] Create `src/lib/components/workflows/ExecutionProgress.svelte`
  - [ ] Display step list with step names from workflow.definition.steps
  - [ ] Implement status indicators: queued (gray), running (blue spinner), completed (green checkmark), failed (red X), skipped (orange dash)
  - [ ] Highlight current executing step with background color and bold text
  - [ ] Show elapsed time counter during execution
  - [ ] Display total execution time when complete
  - [ ] Auto-scroll to current step during execution
  - [ ] Listen to `workflow:progress` IPC events from main process
  - [ ] Update step statuses in real-time based on progress events

- [ ] Implement step output display (AC: #5.7)
  - [ ] Add expand/collapse functionality to each step in progress list
  - [ ] Display step outputs when step is expanded
  - [ ] Format string outputs as pre-formatted text
  - [ ] Format object outputs as JSON with syntax highlighting
  - [ ] Format file outputs with download link
  - [ ] Show execution duration for each step (in milliseconds)
  - [ ] Display error messages in red for failed steps

- [ ] Display final workflow outputs (AC: #5.8)
  - [ ] Create outputs section below progress panel
  - [ ] Show all workflow.definition.outputs with mapped values
  - [ ] Format outputs based on type (string, number, object)
  - [ ] Add "Copy to Clipboard" button for each output
  - [ ] Show success message when execution completes
  - [ ] Display final execution summary (total time, steps completed/failed)

- [ ] Implement error handling and display (AC: #5.9)
  - [ ] Catch execution errors from IPC call
  - [ ] Display error banner at top of dialog with error message
  - [ ] Highlight failed step in progress panel with red background
  - [ ] Show detailed error message in step details
  - [ ] Include stack trace in expandable section for debugging
  - [ ] Provide "View Logs" button to open electron logs
  - [ ] Keep dialog open on error to allow user to review

- [ ] Add "Run Again" functionality (AC: #5.10)
  - [ ] Show "Run Again" button after execution completes (success or failure)
  - [ ] Pre-fill input form with previous execution inputs
  - [ ] Reset progress panel to initial state
  - [ ] Reset execution state to idle
  - [ ] Allow editing inputs before re-running
  - [ ] Increment execution count in UI

- [ ] Wire up IPC communication (AC: #5.4, #5.5)
  - [ ] Call `window.electronAPI.workflow.execute(workflowId, inputs)` on "Run Workflow" click
  - [ ] Handle IPC response with execution result
  - [ ] Listen to `workflow:progress` IPC events for real-time updates
  - [ ] Update component state on progress events
  - [ ] Handle execution completion event
  - [ ] Handle execution failure event

- [ ] Add unit tests for ExecuteWorkflowDialog (AC: #5.1-5.10)
  - [ ] Test input form renders correctly for all input types
  - [ ] Test required field validation
  - [ ] Test execution flow (idle → running → completed)
  - [ ] Test progress panel updates on IPC events
  - [ ] Test error display for failed executions
  - [ ] Test "Run Again" functionality
  - [ ] Test output display and formatting

- [ ] Add E2E tests for workflow execution (AC: #5.1-5.10)
  - [ ] Test opening ExecuteWorkflowDialog from workflow list
  - [ ] Test filling in input form and running workflow
  - [ ] Test progress updates during execution
  - [ ] Test final output display
  - [ ] Test error handling for failed workflow
  - [ ] Test "Run Again" button

## Dev Notes

### Architecture Context

**Component Location:**
- Main dialog: `src/lib/components/workflows/ExecuteWorkflowDialog.svelte`
- Input form: `src/lib/components/workflows/InputForm.svelte`
- Progress panel: `src/lib/components/workflows/ExecutionProgress.svelte`

**IPC Integration:**
- Uses `workflow:execute` channel to start execution in main process
- Listens to `workflow:progress` events for real-time status updates
- Main process WorkflowExecutionEngine emits progress events via `webContents.send()`

**Real-Time Progress Pattern:**
```typescript
// Main Process (WorkflowExecutionEngine.ts)
for (const step of workflow.definition.steps) {
  webContents.send('workflow:progress', {
    executionId: execution.id,
    step: { stepId: step.id, stepName: step.name },
    status: 'running',
  });

  const output = await executeStep(step, context);

  webContents.send('workflow:progress', {
    executionId: execution.id,
    step: { stepId: step.id, stepName: step.name },
    status: 'completed',
    output,
  });
}

// Renderer Process (ExecuteWorkflowDialog.svelte)
onMount(() => {
  window.electronAPI.workflow.onProgress((data) => {
    if (data.executionId === currentExecutionId) {
      updateStepStatus(data.step.stepId, data.status, data.output);
    }
  });
});
```

**State Management:**
- Component manages local execution state (idle, running, completed, failed)
- Progress panel maintains step status array
- Input form maintains input values in Svelte stores or local state

**Styling:**
- Use TailwindCSS for styling
- Status indicators: queued (gray-400), running (blue-500 with spinner), completed (green-500 with checkmark), failed (red-500 with X), skipped (orange-500 with dash)
- Dialog uses standard modal pattern with backdrop
- Two-panel layout with 40/60 split (inputs left, progress right)

**Validation:**
- Client-side validation before IPC call (required fields, type checks)
- Server-side validation handled by WorkflowExecutionEngine
- Display validation errors inline with red text and icons

**Error Handling:**
- Execution errors caught from IPC response
- Progress events include error field for step-level failures
- Display errors prominently with actionable error messages
- Provide "View Logs" button to open electron-log output

### Integration with Epic 10

This story depends on Epic 10's Portable Workflow Engine for actual execution:
- WorkflowExecutionEngine (E7-S2) delegates to Epic 10's WorkflowEngine.execute()
- Storage abstraction: workflows access files via `storage.readFile(url)` APIs
- Capability enforcement: Epic 10's CapabilityEnforcer validates workflow capabilities before execution
- Step executors (Tool, MCP, Prompt) implemented by Epic 10

### Component Hierarchy

```
ExecuteWorkflowDialog
├── DialogHeader (workflow name, description)
├── DialogBody
│   ├── InputForm (left panel)
│   │   ├── StringInput (per workflow.definition.inputs)
│   │   ├── NumberInput
│   │   ├── BooleanInput
│   │   └── FileInput
│   └── ExecutionProgress (right panel)
│       ├── StepList
│       │   └── StepCard (per workflow.definition.steps)
│       │       ├── StatusIndicator (queued/running/completed/failed/skipped)
│       │       ├── StepName
│       │       ├── ExpandButton
│       │       └── StepOutput (expanded)
│       └── ExecutionSummary (time, status)
├── OutputsPanel (below body, after execution)
│   └── OutputCard (per workflow.definition.outputs)
└── DialogFooter
    ├── CancelButton
    ├── RunWorkflowButton (primary)
    └── RunAgainButton (shown after execution)
```

### Testing Strategy

**Unit Tests (Vitest + Svelte Testing Library):**
- Test input form rendering for all input types
- Test validation logic (required fields, type checks)
- Test progress panel updates on mock progress events
- Test output display formatting
- Test "Run Again" state reset

**E2E Tests (Playwright):**
- Full workflow execution flow from start to finish
- Test real-time progress updates
- Test error handling for failed workflows
- Test "Run Again" with pre-filled inputs

### References

- [Tech Spec Epic 7: §4.4 Workflows and Sequencing - Workflow Execution Flow](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-7.md#workflows-and-sequencing)
- [Tech Spec Epic 7: §4.1 Services and Modules - ExecuteWorkflowDialog (Renderer)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-7.md#services-and-modules)
- [Tech Spec Epic 7: §4.2 Data Models and Contracts - WorkflowExecution interface](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-7.md#data-models-and-contracts)
- [Tech Spec Epic 7: §6 Acceptance Criteria - AC-5.1 to AC-5.10](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-7.md#acceptance-criteria-authoritative)
- [Architecture: §2 IPC Communication Pattern](C:\Projects\repos\holokai\bmad\desktop-project\docs\architecture.md#ipc-communication)
- [Architecture: §1 Multi-Process Electron Architecture](C:\Projects\repos\holokai\bmad\desktop-project\docs\architecture.md#multi-process-electron-architecture)
- [Epics: E7-S5: Workflow Execution UI](C:\Projects\repos\holokai\bmad\desktop-project\docs\epics-and-stories-2025-11-25.md#e7-s5-workflow-execution-ui)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e7-s5-workflow-execution-ui.context.xml

- docs/sprint-artifacts/e7-s5-workflow-execution-ui.context.xml



### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

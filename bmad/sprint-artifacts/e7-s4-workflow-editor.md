# Story 7.4: Workflow Editor

Status: ready-for-dev

## Story

As a Holokai Desktop user,
I want a visual workflow editor to define workflow inputs, steps, and outputs,
so that I can create and modify reusable workflows without manually editing YAML/JSON files.

## Acceptance Criteria

1. **AC-4.1**: Editor loads workflow definition (or empty for new workflow)
2. **AC-4.2**: Inputs panel allows adding/removing inputs with type, required, description fields
3. **AC-4.3**: Steps panel allows adding/removing/reordering steps (drag-and-drop)
4. **AC-4.4**: Step type selection modal (Tool, MCP, Prompt) displayed when adding step
5. **AC-4.5**: Step configuration forms display based on type (ToolStepConfig, MCPStepConfig, PromptStepConfig)
6. **AC-4.6**: Outputs panel allows mapping step outputs to workflow outputs (variable references)
7. **AC-4.7**: Save button validates workflow (required fields, circular dependencies, valid variable references)
8. **AC-4.8**: Cancel button discards changes with unsaved changes confirmation
9. **AC-4.9**: Validation errors displayed in editor UI (e.g., "Step 3 references undefined variable {{step5.output}}")

## Tasks / Subtasks

- [ ] Create WorkflowEditor component (AC: #4.1)
  - [ ] Create WorkflowEditor.svelte component in `src/lib/components/workflows/`
  - [ ] Accept workflowId prop (null for new workflow)
  - [ ] Load workflow data on mount via WorkflowService
  - [ ] Track dirty state for unsaved changes detection
  - [ ] Implement three-panel layout: header, sidebar panels, main canvas area
  - [ ] Handle loading and error states (skeleton UI, error messages)

- [ ] Implement InputsPanel for workflow inputs (AC: #4.2)
  - [ ] Create InputsPanel.svelte component in `src/lib/components/workflows/editor/`
  - [ ] Display list of workflow inputs (name, type, required, description)
  - [ ] Add "Add Input" button to create new input entries
  - [ ] Implement "Remove Input" button for each input (with confirmation)
  - [ ] Create input field components: name (text), type dropdown (string, number, boolean, file)
  - [ ] Add required checkbox and description textarea
  - [ ] Validate input name uniqueness and format (alphanumeric + underscore)
  - [ ] Emit events on input changes to update workflow definition state

- [ ] Implement StepsPanel for workflow steps (AC: #4.3, #4.4, #4.5)
  - [ ] Create StepsPanel.svelte component in `src/lib/components/workflows/editor/`
  - [ ] Create StepCard.svelte component for individual step display
  - [ ] Display steps list sorted by step.order with visual step numbering
  - [ ] Implement drag-and-drop step reordering (use svelte-dnd-action or native HTML5 drag)
  - [ ] Add "Add Step" button that opens StepTypeSelectionModal
  - [ ] Create StepTypeSelectionModal.svelte with options: Tool, MCP, Prompt
  - [ ] Create ToolStepConfig.svelte for tool step configuration (tool name, inputs mapping)
  - [ ] Create MCPStepConfig.svelte for MCP step configuration (server name, tool name, inputs)
  - [ ] Create PromptStepConfig.svelte for prompt step configuration (template textarea, model, temperature, maxTokens)
  - [ ] Add "Delete Step" button with confirmation dialog
  - [ ] Implement step.onError dropdown (stop, skip, retry) and maxRetries field
  - [ ] Add conditional execution field (step.condition) for Intermediate tier workflows
  - [ ] Support variable reference autocomplete in input fields ({{inputs.*, {{step*.output.*}})

- [ ] Implement OutputsPanel for workflow outputs (AC: #4.6)
  - [ ] Create OutputsPanel.svelte component in `src/lib/components/workflows/editor/`
  - [ ] Display list of workflow outputs (name, source, type)
  - [ ] Add "Add Output" button to create new output mappings
  - [ ] Implement "Remove Output" button for each output
  - [ ] Create output field components: name (text), source (variable reference), type dropdown
  - [ ] Support variable reference picker/autocomplete for source field (dropdown of available step outputs)
  - [ ] Validate output source references point to existing steps
  - [ ] Show visual connection hints between steps and output mappings

- [ ] Implement workflow validation (AC: #4.7, #4.9)
  - [ ] Create WorkflowValidator.ts utility in `src/lib/utils/`
  - [ ] Validate required fields: workflow name, at least 1 step, at least 1 output
  - [ ] Check for circular dependencies between steps (step A depends on step B, step B depends on step A)
  - [ ] Validate all variable references ({{inputs.*, {{step*.output.*}}) resolve to defined inputs/steps
  - [ ] Validate step order is sequential (no gaps, starts at 1)
  - [ ] Validate input names are unique and valid identifiers
  - [ ] Validate output names are unique
  - [ ] Return structured validation errors with field paths and error messages
  - [ ] Display validation errors inline in editor UI (red borders, error text below fields)
  - [ ] Show validation error summary panel at top of editor

- [ ] Implement save and cancel actions (AC: #4.7, #4.8)
  - [ ] Add Save button in editor header that calls WorkflowService.createWorkflow() or updateWorkflow()
  - [ ] Run validation before save, block save if validation fails
  - [ ] Show loading state on Save button during API call
  - [ ] Handle API errors and display error toast messages
  - [ ] Navigate to workflow list view on successful save
  - [ ] Add Cancel button that navigates back to workflow list
  - [ ] Implement unsaved changes detection (compare current state to loaded state)
  - [ ] Show confirmation dialog if navigating away with unsaved changes
  - [ ] Add keyboard shortcuts: Cmd/Ctrl+S for save, Escape for cancel

- [ ] Add editor header with workflow metadata (AC: #4.1)
  - [ ] Create WorkflowEditorHeader.svelte component
  - [ ] Display workflow name input field (editable)
  - [ ] Display workflow description textarea (optional)
  - [ ] Add scope selector dropdown (personal, project)
  - [ ] Add "Mark as Template" checkbox (for workflow.isTemplate flag)
  - [ ] Show last modified timestamp (read-only)
  - [ ] Include Save and Cancel buttons in header

- [ ] Write unit tests for editor components (AC: #4.1-4.9)
  - [ ] Test WorkflowEditor component: load workflow, dirty state tracking
  - [ ] Test InputsPanel: add/remove inputs, field validation
  - [ ] Test StepsPanel: add/remove/reorder steps, step type selection
  - [ ] Test OutputsPanel: add/remove outputs, variable reference validation
  - [ ] Test WorkflowValidator: all validation rules (circular deps, missing variables, required fields)
  - [ ] Test save/cancel actions: API calls, unsaved changes prompt

## Dev Notes

### Architecture Context

**Component Location**: `src/lib/components/workflows/editor/`

**Parent Components**:
- WorkflowEditor.svelte (main container)
- InputsPanel.svelte, StepsPanel.svelte, OutputsPanel.svelte (sub-panels)

**Dependencies**:
- WorkflowService (`src/services/WorkflowService.ts`) - CRUD operations via IPC
- WorkflowValidator (`src/lib/utils/WorkflowValidator.ts`) - validation logic
- IPC Channels: `workflow:get`, `workflow:create`, `workflow:update`

**Data Models** (from tech-spec-epic-7.md §4.2):
```typescript
interface Workflow {
  id: string;
  ownerId: string;
  projectId?: string;
  name: string;
  description?: string;
  scope: 'personal' | 'project' | 'organization';
  isTemplate: boolean;
  definition: WorkflowDefinition;
}

interface WorkflowDefinition {
  inputs: WorkflowInput[];
  steps: WorkflowStep[];
  outputs: WorkflowOutput[];
  capabilities: string[];
}

interface WorkflowInput {
  name: string; // Variable name (e.g., "email_text")
  type: 'string' | 'number' | 'boolean' | 'file';
  required: boolean;
  description?: string;
  defaultValue?: unknown;
}

interface WorkflowStep {
  id: string;
  name: string;
  type: 'tool' | 'mcp' | 'prompt';
  order: number;
  condition?: string; // Optional for Intermediate tier
  config: ToolStepConfig | MCPStepConfig | PromptStepConfig;
  onError: 'stop' | 'skip' | 'retry';
  maxRetries?: number;
}

interface ToolStepConfig {
  tool: string; // e.g., "filesystem:read"
  inputs: Record<string, string>; // Variable references: { "path": "{{inputs.file_path}}" }
}

interface MCPStepConfig {
  server: string; // e.g., "github"
  tool: string; // e.g., "create_issue"
  inputs: Record<string, string>;
}

interface PromptStepConfig {
  template: string; // Prompt template with {{variable}} placeholders
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface WorkflowOutput {
  name: string; // Output variable name (e.g., "summary")
  source: string; // Variable reference: "{{step3.output.text}}"
  type: 'string' | 'number' | 'boolean' | 'object';
}
```

### Validation Patterns

**Variable Reference Validation**:
- Format: `{{namespace.path.to.field}}`
- Valid namespaces: `inputs` (workflow inputs), `step{N}` (step outputs by step ID)
- Example valid references: `{{inputs.email}}`, `{{step1.output.content}}`, `{{step2.output.metadata.summary}}`
- Invalid references: `{{step5.output}}` if step5 doesn't exist, `{{undefined_var}}`

**Circular Dependency Detection**:
- Build dependency graph: for each step, extract all `{{stepX.*}}` references from step.config.inputs
- Perform topological sort or cycle detection (DFS with visited/recursion stack)
- Report circular chains: "Step 2 → Step 5 → Step 2"

**Step Order Validation**:
- Steps must be sequential: 1, 2, 3, ... (no gaps)
- Step order determines execution sequence
- Reordering steps updates step.order field automatically

### UI/UX Considerations

**Drag-and-Drop**:
- Use `svelte-dnd-action` library for step reordering (already used in other components)
- Visual feedback: dragging placeholder, drop zone highlight
- Update step.order on drop completion

**Unsaved Changes Detection**:
- Store original workflow state on mount: `originalWorkflow = cloneDeep(workflow)`
- Compare current state to original on navigation: `isDirty = !isEqual(workflow, originalWorkflow)`
- Show browser "beforeunload" confirmation if dirty state

**Variable Reference Autocomplete**:
- Build autocomplete list from workflow.definition.inputs and workflow.definition.steps
- Format: `inputs.{inputName}`, `step{N}.output.{field}`
- Use dropdown component with fuzzy search
- Insert `{{reference}}` on selection

**Validation Error Display**:
- Inline errors: red border on invalid field, error text below field
- Summary panel: collapsible panel at top with all validation errors (clickable to jump to field)
- Example: "Step 3, Input 'path': Variable {{step5.output}} references non-existent step"

### Testing Strategy

**Component Tests** (Svelte Testing Library):
- Test InputsPanel: add input, remove input, validate name uniqueness
- Test StepsPanel: add step, remove step, reorder steps (simulate drag-and-drop)
- Test OutputsPanel: add output, validate source reference
- Test WorkflowEditor: load workflow, save workflow, cancel with unsaved changes

**Unit Tests** (Vitest):
- Test WorkflowValidator: all validation rules (circular deps, missing variables, required fields, step order)

**E2E Tests** (Playwright):
- Test workflow creation flow: open editor, add inputs, add steps, add outputs, save, verify workflow appears in list
- Test workflow editing flow: open existing workflow, modify step, save, verify changes persisted
- Test validation flow: create invalid workflow (missing variable reference), attempt save, verify error messages shown
- Test unsaved changes flow: edit workflow, click cancel, verify confirmation dialog, discard changes

### Project Structure Notes

**File Structure**:
```
src/lib/components/workflows/
├── WorkflowList.svelte (E7-S3)
├── WorkflowEditor.svelte (E7-S4 - main component)
├── editor/
│   ├── WorkflowEditorHeader.svelte
│   ├── InputsPanel.svelte
│   ├── StepsPanel.svelte
│   ├── StepCard.svelte
│   ├── StepTypeSelectionModal.svelte
│   ├── ToolStepConfig.svelte
│   ├── MCPStepConfig.svelte
│   ├── PromptStepConfig.svelte
│   └── OutputsPanel.svelte
├── ExecuteWorkflowDialog.svelte (E7-S5)
└── ExecutionHistory.svelte (E7-S6)

src/lib/utils/
└── WorkflowValidator.ts

src/services/
└── WorkflowService.ts (E7-S2)
```

**Routing**:
- Route: `/workflows/new` - New workflow editor
- Route: `/workflows/:id/edit` - Edit existing workflow
- Navigation: WorkflowList → WorkflowEditor (click workflow or "New Workflow" button)

### References

**Tech Spec Sections**:
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md#Detailed-Design §4.1 Services and Modules]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md#Detailed-Design §4.2 Data Models and Contracts]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md#Workflows-and-Sequencing §4.4 Workflow Creation Flow]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md#Acceptance-Criteria §4 AC-4.1 to AC-4.9]

**Epic References**:
- [Source: docs/epics-and-stories-2025-11-25.md#Epic-7 E7-S4: Workflow Editor]

**Architecture References**:
- [Source: docs/architecture.md §1 Multi-Process Electron Architecture]
- [Source: docs/architecture.md §2 IPC Communication Pattern]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e7-s4-workflow-editor.context.xml

- docs/sprint-artifacts/e7-s4-workflow-editor.context.xml



### Agent Model Used

<!-- Model name and version will be added by dev agent -->

### Debug Log References

<!-- Links to debug logs will be added by dev agent -->

### Completion Notes List

<!-- Dev agent will add completion notes here -->

### File List

<!-- Dev agent will add file list here with NEW/MODIFIED/DELETED markers -->

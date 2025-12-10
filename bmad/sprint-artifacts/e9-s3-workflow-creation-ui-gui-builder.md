# Story 9.3: Workflow Creation UI (GUI Builder)

Status: ready-for-dev

## Story

As a **workflow creator**,
I want **a visual GUI workflow builder with timeline/flowchart view, step editor, template editor, and YAML editor**,
so that **I can create custom workflows without writing code manually, while retaining full control over workflow definition**.

## Acceptance Criteria

1. **AC-3.1:** Timeline or flowchart view functional (user can add/remove/reorder steps)
2. **AC-3.2:** Step editor allows configuring all step types (Ask User, Generate Output, Run Script, Conditional)
3. **AC-3.3:** Template editor with split view (code + preview) functional
4. **AC-3.4:** Form builder auto-generates template from dragged sections (or defer to post-MVP)
5. **AC-3.5:** Raw YAML editor with syntax highlighting and validation functional
6. **AC-3.6:** GUI ↔ YAML sync works bidirectionally
7. **AC-3.7:** Workflow saved as .wfpkg bundle in "My Workflows/custom/"

## Tasks / Subtasks

- [ ] Task 1: Create GUIWorkflowBuilder component (AC: #3.1, #3.2, #3.3, #3.5, #3.6)
  - [ ] Create `GUIWorkflowBuilder.svelte` as main container component
  - [ ] Implement tab navigation: Timeline, Template Editor, YAML Editor
  - [ ] Set up state management for workflow definition (Svelte store)
  - [ ] Load workflow definition from file if editing existing workflow
  - [ ] Initialize empty workflow structure for new workflows

- [ ] Task 2: Implement Timeline/Flowchart view (AC: #3.1)
  - [ ] Create `TimelineView.svelte` component for step visualization
  - [ ] Render steps as draggable cards/nodes in linear timeline
  - [ ] Implement drag-and-drop reordering of steps
  - [ ] Add (+) button between steps to add new step
  - [ ] Show step type icon and name on each card
  - [ ] Highlight selected step for editing
  - [ ] Add remove (trash) icon on each step card
  - [ ] Support keyboard navigation (arrow keys, Enter to edit)

- [ ] Task 3: Implement Step Editor panel (AC: #3.2)
  - [ ] Create `StepEditor.svelte` component in sidebar/panel
  - [ ] Show when step is selected in timeline
  - [ ] Implement step type selector dropdown (Ask User, Generate Output, Run Script, Conditional)
  - [ ] Create type-specific configuration forms:
    - [ ] **Ask User**: prompt text, input type (string/number/boolean/file), required flag, default value
    - [ ] **Generate Output**: LLM provider, model, prompt template, temperature, max tokens
    - [ ] **Run Script**: script language (JS/Python), script content textarea, input mappings
    - [ ] **Conditional**: condition expression (e.g., `input.value > 10`), true branch, false branch
  - [ ] Add step name input field
  - [ ] Add step description textarea
  - [ ] Add "Save" and "Cancel" buttons
  - [ ] Validate required fields before save
  - [ ] Update workflow definition on save

- [ ] Task 4: Implement Template Editor with split view (AC: #3.3)
  - [ ] Create `TemplateEditor.svelte` component
  - [ ] Add code editor pane (Monaco editor or CodeMirror)
  - [ ] Configure Handlebars syntax highlighting
  - [ ] Add live preview pane (render template with sample data)
  - [ ] Implement split-view resizer between code and preview
  - [ ] Generate sample data from workflow outputs for preview
  - [ ] Add toolbar with formatting buttons (bold, italic, code, heading)
  - [ ] Support markdown preview (use marked.js or similar)
  - [ ] Add "Insert Variable" dropdown to insert `{{variable}}` tokens
  - [ ] Sync template changes to workflow definition

- [ ] Task 5: Implement Raw YAML editor (AC: #3.5)
  - [ ] Create `YAMLEditor.svelte` component
  - [ ] Add code editor with YAML syntax highlighting (Monaco or CodeMirror)
  - [ ] Implement YAML validation on change (use js-yaml library)
  - [ ] Show validation errors inline (line numbers, error messages)
  - [ ] Add schema validation against workflow.yaml schema
  - [ ] Add toolbar with "Format" button (auto-format YAML)
  - [ ] Show warning if YAML is invalid

- [ ] Task 6: Implement bidirectional GUI ↔ YAML sync (AC: #3.6)
  - [ ] Parse YAML to workflow definition object on YAML editor change
  - [ ] Update Timeline and Step Editor from parsed definition
  - [ ] Serialize workflow definition to YAML on GUI change
  - [ ] Update YAML editor content from serialized YAML
  - [ ] Add debouncing to avoid sync loops (300ms delay)
  - [ ] Show "Syncing..." indicator during updates
  - [ ] Handle sync errors gracefully (show toast, allow manual fix)

- [ ] Task 7: Implement workflow save and packaging (AC: #3.7)
  - [ ] Add "Save Workflow" button in header
  - [ ] Validate workflow definition before save (required fields, no circular deps)
  - [ ] Generate manifest.json from workflow metadata
  - [ ] Create workflow directory structure:
    - [ ] `manifest.json` (metadata, version, author, permissions)
    - [ ] `workflow.yaml` (workflow definition)
    - [ ] `instructions.md` (generated from description)
    - [ ] `template.md` (output template from Template Editor)
  - [ ] Call `WorkflowPackagingService.createPackage()` via IPC
  - [ ] Save .wfpkg bundle to "My Workflows/custom/{workflow-name}/"
  - [ ] Show success toast with path to saved workflow
  - [ ] Navigate to workflow detail view after save

- [ ] Task 8: Add workflow metadata form (AC: #3.7)
  - [ ] Create `WorkflowMetadataForm.svelte` component in header/sidebar
  - [ ] Add workflow name input (required, alphanumeric + hyphens)
  - [ ] Add workflow description textarea (required)
  - [ ] Add category selector (Documentation, Code Generation, Testing, etc.)
  - [ ] Add tier selector (Basic, Intermediate, Advanced)
  - [ ] Add tags input (comma-separated or chip input)
  - [ ] Add capabilities/permissions checklist (filesystem, network, git, etc.)
  - [ ] Validate metadata before allowing save

- [ ] Task 9: Create IPC handlers for workflow operations (AC: #3.7)
  - [ ] Register `workflow:gui-save` IPC handler in main process
  - [ ] Call `WorkflowPackagingService.createPackage()` with workflow data
  - [ ] Return saved workflow path and hash to renderer
  - [ ] Register `workflow:gui-load` IPC handler to load existing workflow
  - [ ] Load workflow directory, parse files, return definition to renderer

- [ ] Task 10: Add unit and component tests (AC: all)
  - [ ] Test TimelineView: add, remove, reorder steps
  - [ ] Test StepEditor: configure each step type, validate fields
  - [ ] Test TemplateEditor: edit template, preview renders correctly
  - [ ] Test YAMLEditor: YAML parsing, validation, error display
  - [ ] Test GUI ↔ YAML sync: changes propagate bidirectionally
  - [ ] Test workflow save: valid workflow saves successfully
  - [ ] Test workflow save: invalid workflow shows errors

## Dev Notes

### Architecture Patterns and Constraints

**Component Architecture:**
- Multi-tab interface with shared workflow state (Svelte store)
- Timeline view uses drag-and-drop API (HTML5 native or svelte-dnd-action)
- Monaco editor for YAML and template editing (same as VS Code)
- Split-view for template preview (CSS flexbox with resizer)

**Workflow Definition Object:**
```typescript
interface WorkflowDefinition {
  name: string;
  description: string;
  tier: 'Basic' | 'Intermediate' | 'Advanced';
  category: string;
  tags: string[];
  capabilities: string[]; // e.g., ['filesystem:read', 'network:https']
  inputs: WorkflowInput[];
  steps: WorkflowStep[];
  outputs: WorkflowOutput[];
  template: string; // Handlebars template
}

interface WorkflowStep {
  id: string; // UUID
  name: string;
  description?: string;
  type: 'ask_user' | 'generate_output' | 'run_script' | 'conditional';
  config: Record<string, any>; // Type-specific configuration
}
```

**State Management:**
- Use `workflowBuilderStore` (Svelte writable store) for workflow definition
- Each component subscribes to store, updates on change
- Store persists to local storage on change (auto-save draft)
- Load from local storage on component mount (restore draft)

**Validation Strategy:**
- Validate on save, not on every keystroke (avoid disrupting user flow)
- Required fields: name, description, at least one step, at least one output
- Check for circular dependencies in conditional steps
- Validate YAML syntax using js-yaml library
- Validate against JSON schema for workflow.yaml

**Performance Considerations:**
- Debounce YAML ↔ GUI sync (300ms delay to avoid thrashing)
- Use virtual scrolling for timeline if >50 steps (svelte-virtual-list)
- Lazy-load Monaco editor (dynamic import, only load when tab opened)
- Use Svelte's reactive declarations to minimize re-renders

**UI/UX Patterns:**
- Timeline view: Linear vertical layout (Pinterest/Trello card style)
- Step cards: Card with type icon, name, description, hover actions
- Drag handle: Left edge of card, 6 dots icon (⠿)
- Add button: Centered (+) circle between steps
- Step editor: Right sidebar panel, slide in when step selected
- Template preview: Live render, updates on 500ms debounce
- YAML editor: Full-screen with validation errors inline

### Project Structure Notes

**New Files:**
```
src/renderer/
├── lib/
│   ├── components/
│   │   ├── workflow-builder/
│   │   │   ├── GUIWorkflowBuilder.svelte (main container)
│   │   │   ├── TimelineView.svelte (step timeline)
│   │   │   ├── StepEditor.svelte (step config panel)
│   │   │   ├── TemplateEditor.svelte (template editor with preview)
│   │   │   ├── YAMLEditor.svelte (raw YAML editor)
│   │   │   ├── WorkflowMetadataForm.svelte (metadata form)
│   │   │   └── StepCard.svelte (individual step card)
│   ├── stores/
│   │   └── workflowBuilderStore.ts (workflow state)
│   └── services/
│       └── workflowValidation.ts (validation utilities)
src/main/
├── services/
│   └── WorkflowPackagingService.ts (already exists from E9-S4)
└── ipc-handlers/
    └── workflow-handlers.ts (IPC handlers)
```

**Dependencies:**
```json
{
  "monaco-editor": "^0.50.0",  // Code editor
  "js-yaml": "^4.1.0",          // YAML parsing
  "ajv": "^8.17.1",             // JSON schema validation
  "marked": "^14.1.3",          // Markdown preview
  "svelte-dnd-action": "^0.9.50", // Drag-and-drop
  "uuid": "^11.0.3"             // UUID generation
}
```

### Integration Points

**Epic 10 Integration (Portable Workflow Engine):**
- GUI builder creates workflows that will be executed by Epic 10 engine
- Workflow definition must conform to Epic 10's workflow.yaml schema
- Capabilities declared in GUI must match Epic 10's capability model
- Storage abstraction: workflows use URL schemes, not direct file paths

**Epic 7 Integration (Workflows):**
- Workflows saved by GUI builder appear in workflow list (Epic 7)
- Workflow execution UI (Epic 7) renders GUI-created workflows
- Execution history (Epic 7) tracks runs of GUI-created workflows

**E9-S2 Integration (AI-Assisted Workflow Creation):**
- GUI builder can be opened from AI workflow creation flow
- AI-generated workflow structure loads into Timeline view
- User can refine AI-generated steps in Step Editor
- Both AI and GUI paths produce same .wfpkg format

**E9-S4 Integration (Workflow Packaging Service):**
- GUI builder calls `WorkflowPackagingService.createPackage()` to save
- Packaging service validates manifest, creates .wfpkg bundle, generates SHA-256 hash
- Packaging service extracts .wfpkg for loading existing workflows

### Testing Standards Summary

**Component Tests (Svelte Testing Library):**
- Test GUIWorkflowBuilder: tab navigation, state management
- Test TimelineView: add/remove/reorder steps, drag-and-drop
- Test StepEditor: configure each step type, validation
- Test TemplateEditor: edit template, preview renders
- Test YAMLEditor: YAML parsing, validation, error display
- Mock IPC calls using Vitest mocks

**Integration Tests (Vitest):**
- Test workflow save: GUI → IPC → WorkflowPackagingService → .wfpkg file
- Test workflow load: .wfpkg file → WorkflowPackagingService → IPC → GUI
- Test GUI ↔ YAML sync: changes propagate bidirectionally without errors
- Use real WorkflowPackagingService, mock file system

**E2E Tests (Playwright):**
- Test full workflow creation flow:
  1. User clicks "Create Workflow"
  2. Fills metadata form (name, description, category)
  3. Adds steps in Timeline view
  4. Configures each step in Step Editor
  5. Edits template in Template Editor
  6. Reviews in YAML Editor
  7. Saves workflow
  8. Workflow appears in workflow list
  9. Workflow is executable
- Test workflow load: open existing workflow, edit, save

**Coverage Target:** 85%+ for GUI components, 90%+ for services

### References

**Tech Spec References:**
- [E9-S3 Overview](tech-spec-epic-9.md#e9-s3-gui-workflow-builder) - Source: docs/sprint-artifacts/tech-spec-epic-9.md, lines 1155-1161
- [GUI Workflow Builder Flow](tech-spec-epic-9.md#gui-workflow-builder-flow-e9-s3) - Source: docs/sprint-artifacts/tech-spec-epic-9.md, lines 910-924
- [Acceptance Criteria](tech-spec-epic-9.md#e9-s3-gui-workflow-builder) - Source: docs/sprint-artifacts/tech-spec-epic-9.md, lines 1155-1161
- [Component Integration](tech-spec-epic-9.md#component-integration) - Source: docs/sprint-artifacts/tech-spec-epic-9.md, lines 62-92
- [Data Models](tech-spec-epic-9.md#typescript-interfaces-desktop) - Source: docs/sprint-artifacts/tech-spec-epic-9.md, lines 342-494

**Architecture References:**
- [Electron Multi-Process Architecture](architecture.md#multi-process-electron-architecture) - Source: docs/architecture.md, lines 18-66
- [IPC Communication Pattern](architecture.md#ipc-communication) - Source: docs/architecture.md, lines 169-199
- [Component Overview](architecture.md#component-overview) - Source: docs/architecture.md, lines 147-168
- [Technology Stack](architecture.md#technology-stack) - Source: docs/architecture.md, lines 69-83

**Epic 10 References:**
- Portable Workflow Engine (BLOCKS Epic 9 - must complete first)
- [Workflow Engine Integration](tech-spec-epic-9.md#epic-10-integration) - Source: docs/sprint-artifacts/tech-spec-epic-9.md, lines 1125-1133
- [Storage Abstraction](tech-spec-epic-9.md#epic-10-integration-points) - Source: docs/sprint-artifacts/tech-spec-epic-9.md, lines 1125-1137
- [Capability Model](tech-spec-epic-9.md#epic-10-integration-points) - Source: docs/sprint-artifacts/tech-spec-epic-9.md, lines 1125-1137

**Epic 7 References:**
- Workflow Execution UI
- [Workflow List Integration](tech-spec-epic-9.md#epic-7-integration) - Source: docs/sprint-artifacts/tech-spec-epic-9.md, lines 89-92

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e9-s3-workflow-creation-ui-gui-builder.context.xml

- docs/sprint-artifacts/e9-s3-workflow-creation-ui-gui-builder.context.xml



### Agent Model Used

<!-- Model name and version will be added during development -->

### Debug Log References

<!-- Debug log paths will be added during development -->

### Completion Notes List

<!-- Completion notes will be added by dev agent:
- New patterns/services created
- Architectural deviations or decisions made
- Technical debt deferred to future stories
- Warnings or recommendations for next story
- Interfaces/methods created for reuse
-->

### File List

<!-- File list will be added by dev agent:
- NEW: [file-path] - description
- MODIFIED: [file-path] - description
- DELETED: [file-path] - description
-->

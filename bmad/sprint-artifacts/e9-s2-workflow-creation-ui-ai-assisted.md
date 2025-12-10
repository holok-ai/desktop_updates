# Story 9.2: Workflow Creation UI (AI-Assisted)

Status: ready-for-dev

## Story

As a power user creating custom workflows,
I want to describe my workflow needs in natural language and have AI generate the workflow structure,
so that I can quickly create workflows without manually editing YAML or understanding workflow syntax.

## Acceptance Criteria

1. **AC-2.1**: User can describe workflow in natural language and receive AI-suggested structure
   - User enters description in conversational dialog (e.g., "I need a workflow that summarizes emails")
   - AI extracts intent, identifies inputs/outputs, and suggests workflow goal
   - AI response shows suggested workflow name, inputs, outputs, and description

2. **AC-2.2**: AI detects workflow tier (Basic vs Intermediate) based on requirements
   - Basic tier: Single-step workflows (Ask User → Generate Output)
   - Intermediate tier: Multi-step workflows with conditional logic, scripts, or multiple generations
   - Tier displayed in AI suggestion with explanation

3. **AC-2.3**: Iterative refinement works (user can modify suggested steps before finalizing)
   - User can edit suggested steps (add, remove, reorder)
   - User can modify step configurations (input names, prompt templates, output formats)
   - User can request AI to regenerate specific steps
   - Changes preserved between refinement iterations

4. **AC-2.4**: Generated workflow saved to "My Workflows/custom/" with all required files
   - manifest.json (name, version, tier, author, license, description, category, tags, permissions, files)
   - workflow.yaml (steps, inputs, outputs, tier)
   - instructions.md (user-facing instructions for executing workflow)
   - template.md (Handlebars template for output formatting)
   - All files valid and schema-compliant

5. **AC-2.5**: Workflow appears in workflow list and is executable
   - Workflow shows in workflow list (Epic 7 integration)
   - User can execute workflow from workflow list
   - Execution follows generated steps correctly
   - Template renders with workflow outputs

## Tasks / Subtasks

### Task 1: AI Workflow Creation Dialog UI (AC: 2.1, 2.3)
- [ ] Create `AIWorkflowCreationDialog.svelte` component
  - [ ] Conversational UI with chat-like message history
  - [ ] User input field for workflow description
  - [ ] Display AI-suggested workflow structure (intent, name, inputs, outputs)
  - [ ] Show suggested steps with editable config
  - [ ] "Regenerate" button for each step
  - [ ] "Approve & Create" button to finalize workflow
- [ ] Wire dialog to IPC API
  - [ ] Call `ipcRenderer.invoke('workflow:ai-create', description)` on submit
  - [ ] Call `ipcRenderer.invoke('workflow:ai-suggest-structure', intent)` after intent extraction
  - [ ] Call `ipcRenderer.invoke('workflow:ai-generate-template', structure)` on approval
- [ ] Add dialog trigger to workflow list
  - [ ] "Create Workflow with AI" button in workflow list toolbar
  - [ ] Open AIWorkflowCreationDialog on click

### Task 2: AI Workflow Creation Service (Main Process) (AC: 2.1, 2.2, 2.4)
- [ ] Create `AIWorkflowCreationService.ts` in main process
  - [ ] `describeWorkflow(userInput: string): Promise<WorkflowIntent>` method
    - [ ] Call Anthropic API with claude-3-5-sonnet-20241022 model
    - [ ] Prompt: Extract workflow intent from user description
    - [ ] Return: intent, suggestedName, inputs[], outputs[], tier
  - [ ] `suggestStructure(intent: WorkflowIntent): Promise<WorkflowStructure>` method
    - [ ] Call Anthropic API to generate step-by-step structure
    - [ ] Prompt: Generate workflow steps for intent (Ask User, Generate Output, Run Script, Conditional)
    - [ ] Return: steps[], tier (Basic/Intermediate), requiredCapabilities[]
  - [ ] `generateTemplate(structure: WorkflowStructure): Promise<string>` method
    - [ ] Call Anthropic API to generate Handlebars template
    - [ ] Prompt: Generate output template with all workflow variables
    - [ ] Return: Markdown-formatted Handlebars template
- [ ] Implement tier detection logic
  - [ ] Basic: Single Ask User + single Generate Output
  - [ ] Intermediate: Multiple steps OR conditional logic OR scripts
  - [ ] Include tier explanation in response
- [ ] Create workflow files on approval
  - [ ] Generate manifest.json from structure
  - [ ] Generate workflow.yaml from steps
  - [ ] Generate instructions.md with usage guide
  - [ ] Save template.md from AI-generated template
  - [ ] Write files to `~/.holokai/My Workflows/custom/{workflow-name}/`

### Task 3: IPC Handlers for AI Workflow Creation (AC: 2.1, 2.4)
- [ ] Register `workflow:ai-create` handler
  - [ ] Call `AIWorkflowCreationService.describeWorkflow(description)`
  - [ ] Return WorkflowIntent to renderer
  - [ ] Handle errors (API rate limits, network errors)
- [ ] Register `workflow:ai-suggest-structure` handler
  - [ ] Call `AIWorkflowCreationService.suggestStructure(intent)`
  - [ ] Return WorkflowStructure to renderer
  - [ ] Handle errors gracefully
- [ ] Register `workflow:ai-generate-template` handler
  - [ ] Call `AIWorkflowCreationService.generateTemplate(structure)`
  - [ ] Call `WorkflowPackagingService.createPackage()` (E9-S4 integration)
  - [ ] Save workflow to "My Workflows/custom/"
  - [ ] Return workflow ID and file paths
  - [ ] Trigger workflow list refresh (Epic 7 integration)

### Task 4: Workflow Structure Validation (AC: 2.4)
- [ ] Validate manifest.json against JSON schema
  - [ ] Required fields: name, version, tier, author, license, description, category, files
  - [ ] Version format: semantic versioning (X.Y.Z)
  - [ ] Category: valid WorkflowCategory value
  - [ ] Tier: "Basic" or "Intermediate"
- [ ] Validate workflow.yaml structure
  - [ ] Required fields: name, tier, steps, inputs, outputs
  - [ ] Steps: valid step types (ask_user, generate_output, run_script, conditional)
  - [ ] Inputs/outputs: valid variable names and types
- [ ] Validate template.md syntax
  - [ ] Valid Handlebars syntax (no unclosed tags)
  - [ ] All referenced variables exist in workflow outputs
- [ ] Show validation errors in dialog
  - [ ] Display specific validation failures to user
  - [ ] Allow user to fix issues before retrying

### Task 5: Epic 7 Integration (AC: 2.5)
- [ ] Add created workflow to workflow list
  - [ ] Call `WorkflowService.refreshWorkflowList()` after creation
  - [ ] Workflow appears in workflow list with correct metadata
  - [ ] Workflow icon/badge shows "Custom" or "AI-Generated"
- [ ] Test workflow execution
  - [ ] Execute generated workflow via Epic 7 WorkflowExecutionEngine
  - [ ] Verify steps execute in correct order
  - [ ] Verify template renders with outputs
  - [ ] Verify workflow completes successfully

### Task 6: Unit Tests (AC: All)
- [ ] Test `AIWorkflowCreationService.describeWorkflow()`
  - [ ] Mock Anthropic API responses
  - [ ] Verify intent extraction logic
  - [ ] Test error handling (API errors, invalid responses)
- [ ] Test `AIWorkflowCreationService.suggestStructure()`
  - [ ] Mock Anthropic API responses
  - [ ] Verify tier detection (Basic vs Intermediate)
  - [ ] Test capability detection logic
- [ ] Test `AIWorkflowCreationService.generateTemplate()`
  - [ ] Mock Anthropic API responses
  - [ ] Verify template includes all output variables
  - [ ] Test Handlebars syntax validation
- [ ] Test manifest validation
  - [ ] Valid manifests pass
  - [ ] Invalid manifests rejected with clear errors
- [ ] Test workflow.yaml validation
  - [ ] Valid workflow structures pass
  - [ ] Invalid structures rejected

### Task 7: Integration Tests (AC: 2.5)
- [ ] Test full AI workflow creation flow
  - [ ] User enters description → AI extracts intent
  - [ ] User approves intent → AI generates structure
  - [ ] User approves structure → Workflow files created
  - [ ] Workflow appears in list
  - [ ] Workflow executes successfully
- [ ] Test refinement flow
  - [ ] User modifies suggested steps
  - [ ] Changes preserved across iterations
  - [ ] Final workflow reflects user modifications
- [ ] Test error scenarios
  - [ ] Anthropic API unavailable
  - [ ] Invalid workflow structure generated
  - [ ] Validation failures handled gracefully

### Task 8: E2E Tests (AC: All)
- [ ] Test AI workflow creation happy path
  - [ ] Open AI creation dialog
  - [ ] Enter workflow description
  - [ ] Approve suggested structure
  - [ ] Verify workflow created in "My Workflows/custom/"
  - [ ] Verify workflow appears in workflow list
  - [ ] Execute workflow and verify output
- [ ] Test iterative refinement
  - [ ] Modify suggested steps
  - [ ] Request regeneration
  - [ ] Approve modified workflow
  - [ ] Verify final workflow matches modifications

## Dev Notes

### AI Integration Patterns

**Model Selection:**
- Use `claude-3-5-sonnet-20241022` for all AI workflow generation
- Model provides best balance of quality and latency (<10s P95)
- Use streaming responses for perceived speed (show progress as AI generates)

**Prompt Engineering Strategies:**

1. **Intent Extraction Prompt:**
```
Extract workflow intent from user description: "{userInput}"

Return JSON with:
- intent: High-level goal (string)
- suggestedName: Workflow name (kebab-case)
- inputs: Array of {name, type, description} (e.g., [{name: "email_body", type: "text", description: "Email content to summarize"}])
- outputs: Array of {name, type, description} (e.g., [{name: "summary", type: "text", description: "Concise email summary"}])
- tier: "Basic" or "Intermediate" (based on complexity)

Be specific about input/output names and types.
```

2. **Structure Generation Prompt:**
```
Generate workflow structure for: {JSON.stringify(intent)}

Return JSON with:
- steps: Array of step objects with:
  - name: Step name (string)
  - type: "ask_user" | "generate_output" | "run_script" | "conditional"
  - config: Step-specific configuration (inputs, prompts, outputs)
- tier: "Basic" | "Intermediate"
- requiredCapabilities: Array of capabilities (e.g., ["filesystem:read", "network:https:api.example.com"])

Guidelines:
- Basic tier: Single ask_user → single generate_output
- Intermediate tier: Multiple steps OR conditional logic OR scripts
- Use clear, descriptive step names
- Include all necessary step configs
```

3. **Template Generation Prompt:**
```
Generate Handlebars template for workflow: {JSON.stringify(structure)}

Requirements:
- Include all output variables from workflow steps
- Use markdown formatting for readability
- Add helpful sections (Summary, Details, Next Steps)
- Use {{variable_name}} syntax for all variables
- Ensure all referenced variables exist in workflow outputs
- Make template user-friendly and well-formatted
```

**API Configuration:**
- Timeout: 30s (generous for complex workflows)
- Max tokens: 4096 (sufficient for most workflow structures)
- Temperature: 0.7 (balanced creativity and consistency)
- Retry logic: 3 attempts with exponential backoff

### Workflow File Structure

Generated workflows follow Epic 9 package format:

```
~/.holokai/My Workflows/custom/{workflow-name}/
├── manifest.json          # Workflow metadata
├── workflow.yaml          # Step definitions
├── instructions.md        # User-facing instructions
└── templates/
    └── template.md        # Output template
```

**manifest.json Example:**
```json
{
  "name": "email-summarizer",
  "version": "1.0.0",
  "tier": "Basic",
  "author": {
    "name": "Peter",
    "email": "user@example.com"
  },
  "license": "MIT",
  "description": "Summarizes email content using AI",
  "category": "Email Automation",
  "tags": ["email", "summarization", "ai"],
  "permissions": [],
  "files": {
    "manifest": "manifest.json",
    "workflow": "workflow.yaml",
    "instructions": "instructions.md",
    "templates": ["template.md"]
  }
}
```

**workflow.yaml Example:**
```yaml
name: email-summarizer
tier: Basic
inputs:
  - name: email_body
    type: text
    description: Email content to summarize
outputs:
  - name: summary
    type: text
    description: Concise email summary
steps:
  - name: ask_email
    type: ask_user
    config:
      prompt: "Paste the email content you want summarized:"
      variable: email_body
  - name: generate_summary
    type: generate_output
    config:
      prompt: "Summarize the following email in 2-3 sentences:\n\n{{email_body}}"
      output: summary
```

### Error Handling

**Anthropic API Errors:**
- Rate limit exceeded → Show "API rate limit reached, please try again in X seconds"
- Network timeout → Show "AI service unavailable, please check connection"
- Invalid API key → Show "API key invalid, please check settings"
- Model overloaded → Retry with exponential backoff (3 attempts)

**Validation Errors:**
- Invalid manifest → Show specific field errors (e.g., "Version must be semantic X.Y.Z")
- Invalid workflow.yaml → Show syntax errors with line numbers
- Invalid template → Show Handlebars parsing errors

**File System Errors:**
- Directory creation failed → Show "Could not create workflow directory, check permissions"
- File write failed → Show "Could not save workflow files, check disk space"

### Architecture Alignment

**Multi-Process Pattern:**
- Renderer: `AIWorkflowCreationDialog.svelte` (UI, user interaction)
- IPC: `workflow:ai-create`, `workflow:ai-suggest-structure`, `workflow:ai-generate-template` channels
- Main: `AIWorkflowCreationService` (Anthropic API calls, file operations)

**Epic 10 Integration (Post-MVP):**
- Workflows created in E9-S2 executed by Epic 10's portable engine
- Storage abstraction ensures marketplace workflows use URL schemes
- Capability enforcement validates user-approved permissions

**Epic 7 Integration:**
- Workflows added to workflow list via `WorkflowService.refreshWorkflowList()`
- Execution via `WorkflowExecutionEngine.execute(workflowId, inputs)`
- Execution history tracked for AI-generated workflows

### Testing Strategy

**Unit Tests (Vitest):**
- Mock Anthropic SDK responses
- Test intent extraction, structure generation, template generation
- Test validation logic (manifest, workflow.yaml, template)
- Target: 90%+ coverage for AIWorkflowCreationService

**Integration Tests:**
- Test full IPC flow (renderer → main → Anthropic → file system)
- Use Anthropic test mode (mock API calls)
- Verify workflow files created correctly
- Target: 85%+ coverage for integration paths

**E2E Tests (Playwright):**
- Test complete user flow: describe → refine → approve → execute
- Verify workflow appears in list and executes correctly
- Test error scenarios (API errors, validation failures)
- Target: 100% of critical user flows covered

### Performance Targets

| Metric | Target | Priority |
|--------|--------|----------|
| AI Intent Extraction | <3s P95 | P0 |
| AI Structure Generation | <10s P95 | P0 |
| AI Template Generation | <5s P95 | P1 |
| File Creation | <1s P95 | P1 |
| Total Flow (describe → create) | <20s P95 | P0 |

### Security Considerations

- **API Key Storage**: Use electron `safeStorage` for Anthropic API key
- **Prompt Injection**: Sanitize user input before sending to Anthropic API
- **File System Access**: Validate workflow directory paths (no path traversal)
- **Capability Enforcement**: AI suggests capabilities, user approves before execution (Epic 10)

### References

- [Source: C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-9.md - AI-Assisted Workflow Creation (E9-S2)]
- [Source: C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-9.md - §4.1 Services and Modules - AIWorkflowCreationService]
- [Source: C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-9.md - §4.3 APIs and Interfaces - IPC Handlers]
- [Source: C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-9.md - §4.4 Workflows and Sequencing - AI-Assisted Workflow Creation Flow]
- [Source: C:\Projects\repos\holokai\bmad\desktop-project\docs\architecture.md - Multi-Process Electron Architecture]
- [Source: C:\Projects\repos\holokai\bmad\desktop-project\docs\architecture.md - IPC Communication Patterns]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e9-s2-workflow-creation-ui-ai-assisted.context.xml

- docs/sprint-artifacts/e9-s2-workflow-creation-ui-ai-assisted.context.xml



### Agent Model Used

<!-- Model name and version will be added during implementation -->

### Debug Log References

<!-- Debug log references will be added during implementation -->

### Completion Notes List

<!-- Completion notes will be added during implementation -->

### File List

<!-- File list will be added during implementation -->

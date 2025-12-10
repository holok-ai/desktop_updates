# Epic Technical Specification: Workflows

Date: 2025-11-26
Author: Peter
Epic ID: 7
Status: Draft

---

## Overview

Epic 7 implements the workflow management and execution infrastructure for Holokai Desktop, enabling users to create, edit, and execute reusable workflow templates that automate repetitive tasks. This epic provides the **user-facing interface layer** for workflows (CRUD, editing, execution UI, history) while relying on the **portable workflow engine** (Epic 10) for actual execution.

This epic delivers 6 stories across the full workflow lifecycle: backend API endpoints (E7-S1), desktop execution service and engine integration (E7-S2), list view for workflow discovery (E7-S3), visual workflow editor (E7-S4), execution UI with progress tracking (E7-S5), and execution history for audit and replay (E7-S6).

**Key Distinction**: Epic 7 focuses on workflow **management and UI** (creating, editing, executing workflows through the desktop interface), while Epic 10 (Portable Workflow Engine) provides the **execution infrastructure** (portable engine, storage abstraction, capability sandboxing, script runners). Epic 7 depends on Epic 10's execution engine being available.

## Objectives and Scope

**In Scope:**
- Moku API workflow management endpoints (CRUD, fork, execute, history) - **E7-S1**
- Desktop WorkflowService for workflow operations (list, create, update, delete, fork) - **E7-S2**
- Desktop WorkflowExecutionEngine integration with Epic 10's portable engine - **E7-S2**
- Workflow list view in project sidebar with personal/project scope filtering - **E7-S3**
- Workflow editor UI for defining inputs, steps, and outputs - **E7-S4**
- Workflow execution UI with input forms, real-time progress, and results display - **E7-S5**
- Execution history view with replay capability - **E7-S6**
- Support for Basic and Intermediate workflow tiers (linear steps, conditionals, file inputs, multiple templates)
- Integration with Epic 10's storage service abstraction (file URLs, not paths)
- Workflow caching for performance (10min TTL)

**Out of Scope (Deferred to Post-MVP):**
- Chat-to-workflow progression (automatic workflow suggestions from chat patterns) - PRD §3.2, requires ML infrastructure
- Workflow template marketplace (50+ curated templates, user publishing, freemium model) - PRD §3.7.2, Month 6 post-MVP
- AI-assisted workflow creation ("I need a workflow that...") - PRD §3.7.1, post-MVP
- GUI workflow builder (visual drag-and-drop editor) - PRD §3.7.1, post-MVP (MVP uses YAML/JSON definition only)
- Advanced workflow tier (invoke other workflows, loops, knowledge bases) - PRD §3.7.1, post-MVP
- Workflow versioning and rollback - post-MVP
- Real-time collaboration on workflows - post-MVP
- Scheduled workflow execution (cron-like triggers) - PRD §3.8.7, post-MVP cloud execution
- Cloud workflow execution - PRD §3.8.7, Month 6+ post-MVP

## System Architecture Alignment

**Architecture References:**
- Multi-process Electron architecture (ARCH §1): Main process handles workflow execution, renderer handles UI
- IPC communication pattern (ARCH §2): `workflow:*` channels for CRUD operations
- Moku API integration (ARCH §3): Spring Boot backend provides workflow persistence and API
- Epic 10 Portable Workflow Engine (tech-spec-epic-10.md): Provides execution infrastructure with storage abstraction

**Component Integration:**
1. **Moku API (Backend)**:
   - New `WorkflowController` with CRUD endpoints (`/api/workflows/*`)
   - New database tables: `workflows`, `workflow_executions`
   - Integration with existing `projects` and `users` tables for RBAC

2. **Electron Main Process**:
   - `WorkflowService.ts`: Manages workflow CRUD via Moku API, implements caching (10min TTL)
   - `WorkflowExecutionEngine.ts`: Integrates with Epic 10's portable engine, executes steps sequentially
   - `WorkflowCache.ts`: LRU cache for workflow definitions (max 500 workflows)
   - IPC handlers for `workflow:*` channels

3. **Electron Renderer Process**:
   - `WorkflowList.svelte`: Lists workflows in project sidebar
   - `WorkflowEditor.svelte`: Visual editor for workflow definition (inputs, steps, outputs)
   - `ExecuteWorkflowDialog.svelte`: Execution UI with progress and results
   - `ExecutionHistory.svelte`: Historical execution view

4. **Epic 10 Integration**:
   - Workflow execution delegates to Epic 10's `WorkflowEngine.execute(workflow, inputs, userContext)`
   - Storage abstraction: Workflows access files via `storage.readFile(url)` APIs (not direct paths)
   - Capability-based sandboxing: User approves workflow capabilities before installation
   - RBAC/SSO context: Workflows inherit user's permissions from JWT

**Data Flow:**
```
User clicks "Execute Workflow"
  → Renderer: ExecuteWorkflowDialog collects inputs
  → IPC: ipcRenderer.invoke('workflow:execute', workflowId, inputs)
  → Main: WorkflowService.executeWorkflow()
  → Main: WorkflowExecutionEngine.execute() (Epic 10 integration)
  → Main: StepExecutor runs each step (Tool, MCP, Prompt)
  → Main: Updates execution state, emits progress events
  → IPC: webContents.send('workflow:progress', { step, status })
  → Renderer: ExecuteWorkflowDialog updates progress UI
  → Main: Execution completes, saves results to Moku API
  → IPC: Returns execution result to renderer
  → Renderer: Displays final outputs
```

**Constraint Compliance:**
- **Zero Electron Dependencies in Execution Engine** (Epic 10 constraint): WorkflowExecutionEngine can run in plain Node.js
- **Storage Abstraction** (Epic 10 constraint): No direct filesystem paths, all file access via storage service URLs
- **Capability-Based Security** (Epic 10 constraint): Workflows declare required capabilities, enforced at runtime

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs | Owner |
|--------|---------------|--------|---------|-------|
| **WorkflowController** (Moku API) | REST API for workflow CRUD operations | HTTP requests (JWT auth) | JSON responses, database writes | Backend Team |
| **WorkflowService** (Desktop Main) | Workflow management, caching, API client | IPC requests, workflow data | Cached workflows, API responses | Desktop Team |
| **WorkflowExecutionEngine** (Desktop Main) | Integrates with Epic 10 engine, orchestrates execution | Workflow definition, inputs, user context | Execution results, progress events | Desktop Team |
| **ToolExecutor** (Desktop Main) | Executes native tool steps (e.g., file operations) | Tool name, inputs from context | Tool outputs for next step | Desktop Team |
| **MCPExecutor** (Desktop Main) | Executes MCP server tool invocations | MCP server name, tool name, inputs | MCP tool outputs | Desktop Team |
| **PromptExecutor** (Desktop Main) | Executes LLM prompt steps | Prompt template, context variables | LLM response text | Desktop Team |
| **WorkflowCache** (Desktop Main) | LRU cache for workflow definitions | Workflow ID | Cached workflow or null | Desktop Team |
| **WorkflowList** (Renderer) | Displays workflows in sidebar | Workflow array, filters | User navigation events | Frontend Team |
| **WorkflowEditor** (Renderer) | Visual editor for workflow definition | Workflow object (or null for new) | Updated workflow definition | Frontend Team |
| **ExecuteWorkflowDialog** (Renderer) | Execution UI with progress and results | Workflow ID, initial inputs | Execution complete event | Frontend Team |
| **ExecutionHistory** (Renderer) | Historical execution view | Workflow ID | Replay execution requests | Frontend Team |

### Data Models and Contracts

**Database Schema (Moku API - PostgreSQL):**

```sql
-- Workflow definitions table
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE, -- NULL = personal workflow
  name VARCHAR(200) NOT NULL,
  description TEXT,
  scope VARCHAR(50) NOT NULL CHECK (scope IN ('personal', 'project', 'organization')),
  is_template BOOLEAN DEFAULT false,
  forked_from UUID REFERENCES workflows(id) ON DELETE SET NULL,

  -- Workflow definition (JSONB for flexibility)
  definition JSONB NOT NULL, -- { inputs, steps, outputs, capabilities }

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP, -- Soft delete
  execution_count INT DEFAULT 0,
  last_executed_at TIMESTAMP,

  CONSTRAINT workflows_project_scope_check
    CHECK ((scope = 'personal' AND project_id IS NULL) OR (scope IN ('project', 'organization') AND project_id IS NOT NULL))
);

CREATE INDEX idx_workflows_owner ON workflows(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_workflows_project ON workflows(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_workflows_scope ON workflows(scope) WHERE deleted_at IS NULL;

-- Workflow execution history table
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES desktop_threads(id) ON DELETE SET NULL, -- Optional: link to chat thread

  -- Execution state
  status VARCHAR(50) NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  -- Inputs and outputs (JSONB for flexibility)
  inputs JSONB NOT NULL, -- User-provided inputs at execution time
  outputs JSONB, -- Final workflow outputs

  -- Execution trace (for debugging and replay)
  execution_trace JSONB, -- Step-by-step execution log: [{ step, status, output, duration }]
  error_message TEXT, -- Error details if status = 'failed'

  -- Metadata
  duration_ms INT, -- Total execution time in milliseconds

  CONSTRAINT execution_completed_at_check
    CHECK ((status IN ('completed', 'failed', 'cancelled') AND completed_at IS NOT NULL) OR (status IN ('queued', 'running')))
);

CREATE INDEX idx_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_executions_user ON workflow_executions(user_id);
CREATE INDEX idx_executions_status ON workflow_executions(status);
CREATE INDEX idx_executions_started_at ON workflow_executions(started_at DESC);
```

**TypeScript Interfaces (Desktop):**

```typescript
// Workflow Definition
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
  deletedAt?: Date;
  executionCount: number;
  lastExecutedAt?: Date;
}

interface WorkflowDefinition {
  inputs: WorkflowInput[];
  steps: WorkflowStep[];
  outputs: WorkflowOutput[];
  capabilities: string[]; // e.g., ["filesystem:read", "network:https:github.com"]
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
  type: 'tool' | 'mcp' | 'prompt'; // Step executor type
  order: number; // Execution order (1, 2, 3, ...)

  // Conditional execution (Intermediate tier)
  condition?: string; // e.g., "{{step1.output.success}} === true"

  // Step configuration (varies by type)
  config: ToolStepConfig | MCPStepConfig | PromptStepConfig;

  // Error handling
  onError: 'stop' | 'skip' | 'retry';
  maxRetries?: number; // If onError = 'retry'
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
  model?: string; // Optional: override default model
  temperature?: number;
  maxTokens?: number;
}

interface WorkflowOutput {
  name: string; // Output variable name (e.g., "summary")
  source: string; // Variable reference: "{{step3.output.text}}"
  type: 'string' | 'number' | 'boolean' | 'object';
}

// Workflow Execution
interface WorkflowExecution {
  id: string;
  workflowId: string;
  userId: string;
  threadId?: string;

  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;

  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;

  executionTrace?: ExecutionStepTrace[];
  errorMessage?: string;

  durationMs?: number;
}

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

// Execution Context (passed between steps)
interface ExecutionContext {
  workflowId: string;
  executionId: string;
  userId: string;
  inputs: Record<string, unknown>; // User-provided inputs
  variables: Record<string, unknown>; // Step outputs accumulated during execution
  userContext: { userId: string; jwt: string }; // For RBAC enforcement
  workingDirectory: string; // Storage URL (e.g., "project://")
}
```

### APIs and Interfaces

**Moku API Endpoints (Spring Boot REST API):**

```java
@RestController
@RequestMapping("/api/workflows")
public class WorkflowController {

  // E7-S1: Workflow CRUD operations
  @GetMapping
  ResponseEntity<Page<WorkflowDTO>> listWorkflows(
    @RequestParam(required = false) String scope, // personal, project, organization
    @RequestParam(required = false) UUID projectId,
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size
  );

  @GetMapping("/{id}")
  ResponseEntity<WorkflowDTO> getWorkflow(@PathVariable UUID id);

  @PostMapping
  ResponseEntity<WorkflowDTO> createWorkflow(@RequestBody CreateWorkflowRequest request);

  @PatchMapping("/{id}")
  ResponseEntity<WorkflowDTO> updateWorkflow(
    @PathVariable UUID id,
    @RequestBody UpdateWorkflowRequest request
  );

  @DeleteMapping("/{id}")
  ResponseEntity<Void> deleteWorkflow(@PathVariable UUID id); // Soft delete

  // E7-S1: Fork workflow (create copy)
  @PostMapping("/{id}/fork")
  ResponseEntity<WorkflowDTO> forkWorkflow(@PathVariable UUID id);

  // E7-S1: Execute workflow (creates execution record, does NOT run synchronously)
  @PostMapping("/{id}/execute")
  ResponseEntity<WorkflowExecutionDTO> executeWorkflow(
    @PathVariable UUID id,
    @RequestBody Map<String, Object> inputs
  );

  // E7-S1: Execution history
  @GetMapping("/{id}/executions")
  ResponseEntity<Page<WorkflowExecutionDTO>> getExecutionHistory(
    @PathVariable UUID id,
    @RequestParam(required = false) String status, // queued, running, completed, failed
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size
  );

  @GetMapping("/executions/{executionId}")
  ResponseEntity<WorkflowExecutionDTO> getExecution(@PathVariable UUID executionId);
}
```

**Request/Response DTOs:**

```java
public record CreateWorkflowRequest(
  String name,
  String description,
  String scope, // personal, project, organization
  UUID projectId,
  WorkflowDefinitionDTO definition
) {}

public record UpdateWorkflowRequest(
  String name,
  String description,
  WorkflowDefinitionDTO definition
) {}

public record WorkflowDTO(
  UUID id,
  UUID ownerId,
  UUID projectId,
  String name,
  String description,
  String scope,
  boolean isTemplate,
  UUID forkedFrom,
  WorkflowDefinitionDTO definition,
  Instant createdAt,
  Instant updatedAt,
  int executionCount,
  Instant lastExecutedAt
) {}

public record WorkflowDefinitionDTO(
  List<WorkflowInputDTO> inputs,
  List<WorkflowStepDTO> steps,
  List<WorkflowOutputDTO> outputs,
  List<String> capabilities
) {}

public record WorkflowExecutionDTO(
  UUID id,
  UUID workflowId,
  UUID userId,
  UUID threadId,
  String status,
  Instant startedAt,
  Instant completedAt,
  Map<String, Object> inputs,
  Map<String, Object> outputs,
  List<ExecutionStepTraceDTO> executionTrace,
  String errorMessage,
  Integer durationMs
) {}
```

**Desktop IPC API (Electron Main Process):**

```typescript
// WorkflowService (Main Process)
export class WorkflowService {
  private cache: WorkflowCache;
  private apiClient: MokuAPIClient;

  // E7-S2: CRUD operations
  async listWorkflows(filters: {
    scope?: 'personal' | 'project' | 'organization';
    projectId?: string;
  }): Promise<Workflow[]> {
    const cacheKey = `list_${JSON.stringify(filters)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const workflows = await this.apiClient.get('/api/workflows', { params: filters });
    this.cache.set(cacheKey, workflows, 600); // 10min TTL
    return workflows;
  }

  async getWorkflow(id: string): Promise<Workflow> {
    const cached = this.cache.get(`workflow_${id}`);
    if (cached) return cached;

    const workflow = await this.apiClient.get(`/api/workflows/${id}`);
    this.cache.set(`workflow_${id}`, workflow, 600);
    return workflow;
  }

  async createWorkflow(data: CreateWorkflowData): Promise<Workflow> {
    const workflow = await this.apiClient.post('/api/workflows', data);
    this.cache.invalidate(`list_*`); // Invalidate list caches
    this.cache.set(`workflow_${workflow.id}`, workflow, 600);
    return workflow;
  }

  async updateWorkflow(id: string, data: UpdateWorkflowData): Promise<Workflow> {
    const workflow = await this.apiClient.patch(`/api/workflows/${id}`, data);
    this.cache.invalidate(`workflow_${id}`);
    this.cache.invalidate(`list_*`);
    this.cache.set(`workflow_${id}`, workflow, 600);
    return workflow;
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.apiClient.delete(`/api/workflows/${id}`);
    this.cache.invalidate(`workflow_${id}`);
    this.cache.invalidate(`list_*`);
  }

  async forkWorkflow(id: string): Promise<Workflow> {
    const workflow = await this.apiClient.post(`/api/workflows/${id}/fork`);
    this.cache.invalidate(`list_*`);
    return workflow;
  }

  // E7-S2: Execution
  async executeWorkflow(id: string, inputs: Record<string, unknown>): Promise<WorkflowExecution> {
    // Create execution record in Moku API
    const execution = await this.apiClient.post(`/api/workflows/${id}/execute`, inputs);

    // Run execution via WorkflowExecutionEngine (Epic 10 integration)
    const workflow = await this.getWorkflow(id);
    const result = await this.executionEngine.execute(workflow, inputs, this.getUserContext());

    // Update execution record with results
    await this.apiClient.patch(`/api/workflows/executions/${execution.id}`, {
      status: result.success ? 'completed' : 'failed',
      outputs: result.outputs,
      executionTrace: result.trace,
      errorMessage: result.error,
      durationMs: result.durationMs,
    });

    return { ...execution, ...result };
  }

  async getExecutionHistory(
    workflowId: string,
    filters?: { status?: string }
  ): Promise<WorkflowExecution[]> {
    return this.apiClient.get(`/api/workflows/${workflowId}/executions`, { params: filters });
  }
}

// IPC Handlers (registered in main.ts)
ipcMain.handle('workflow:list', async (event, filters) => {
  return workflowService.listWorkflows(filters);
});

ipcMain.handle('workflow:get', async (event, id) => {
  return workflowService.getWorkflow(id);
});

ipcMain.handle('workflow:create', async (event, data) => {
  return workflowService.createWorkflow(data);
});

ipcMain.handle('workflow:update', async (event, id, data) => {
  return workflowService.updateWorkflow(id, data);
});

ipcMain.handle('workflow:delete', async (event, id) => {
  return workflowService.deleteWorkflow(id);
});

ipcMain.handle('workflow:fork', async (event, id) => {
  return workflowService.forkWorkflow(id);
});

ipcMain.handle('workflow:execute', async (event, id, inputs) => {
  return workflowService.executeWorkflow(id, inputs);
});

ipcMain.handle('workflow:execution-history', async (event, workflowId, filters) => {
  return workflowService.getExecutionHistory(workflowId, filters);
});
```

### Workflows and Sequencing

**Workflow Creation Flow (E7-S3, E7-S4):**

```
User clicks "New Workflow" in WorkflowList
  1. Renderer: WorkflowList emits 'create-workflow' event
  2. Router: Navigate to `/workflows/new`
  3. Renderer: WorkflowEditor.svelte mounts with empty workflow
  4. User: Defines inputs (name, type, required, description)
  5. User: Adds steps (drag from library or click "+")
     - Select step type: Tool, MCP, or Prompt
     - Configure step-specific settings (tool name, inputs, template)
     - Set error handling: stop, skip, or retry
  6. User: Maps outputs (reference step outputs → workflow outputs)
  7. User: Clicks "Save"
  8. Renderer: Validates workflow definition
     - Check required fields (name, at least 1 step, valid variable references)
     - Check circular dependencies (step A depends on step B, step B depends on step A)
  9. IPC: ipcRenderer.invoke('workflow:create', workflowData)
 10. Main: WorkflowService.createWorkflow()
 11. Main → Moku API: POST /api/workflows
 12. Moku API: Validates, saves to database, returns WorkflowDTO
 13. Main: Caches workflow, returns to renderer
 14. Renderer: Navigate to workflow detail view, show success toast
```

**Workflow Execution Flow (E7-S5):**

```
User clicks "Execute" on workflow
  1. Renderer: ExecuteWorkflowDialog.svelte opens
  2. Renderer: Displays input form based on workflow.definition.inputs
  3. User: Fills in required inputs (string, number, boolean, file)
  4. User: Clicks "Run Workflow"
  5. Renderer: Validates inputs (required fields, type checks)
  6. IPC: ipcRenderer.invoke('workflow:execute', workflowId, inputs)
  7. Main: WorkflowService.executeWorkflow()
  8. Main → Moku API: POST /api/workflows/{id}/execute → Creates execution record
  9. Main: WorkflowExecutionEngine.execute() (Epic 10 integration)
     a. Create ExecutionContext: { workflowId, userId, inputs, variables: {}, userContext }
     b. For each step (sorted by step.order):
        i.   Check condition (if present): evaluateCondition(step.condition, context)
        ii.  If condition false → skip step, continue
        iii. Resolve step inputs: replaceVariables(step.config.inputs, context)
        iv.  Execute step via appropriate executor:
             - Tool step → ToolExecutor.execute(step.config)
             - MCP step → MCPExecutor.execute(step.config)
             - Prompt step → PromptExecutor.execute(step.config)
        v.   Store step output in context.variables[stepId]
        vi.  Emit progress event: webContents.send('workflow:progress', { step, status: 'completed' })
        vii. If error:
             - onError='stop' → halt execution, mark as failed
             - onError='skip' → log warning, continue to next step
             - onError='retry' → retry up to maxRetries times
     c. Map final outputs: evaluateOutputs(workflow.definition.outputs, context)
     d. Return execution result
 10. Main → Moku API: PATCH /api/workflows/executions/{id} → Updates execution with results
 11. Main: Returns execution result to renderer
 12. Renderer: ExecuteWorkflowDialog displays final outputs
 13. Renderer: "Run Again" button → repeat from step 3
```

**Workflow Execution Progress Updates:**

```
Main Process emits progress events during execution:
  webContents.send('workflow:progress', {
    executionId: string,
    step: { stepId: string, stepName: string },
    status: 'queued' | 'running' | 'completed' | 'failed' | 'skipped',
    output?: unknown,
    error?: string
  })

Renderer Process listens and updates UI:
  1. IPC: ipcRenderer.on('workflow:progress', (event, data) => { ... })
  2. Renderer: ExecuteWorkflowDialog updates step status in real-time
  3. Renderer: Highlights current step, shows checkmarks for completed steps, shows errors
```

**Execution History and Replay Flow (E7-S6):**

```
User clicks "History" on workflow
  1. Renderer: ExecutionHistory.svelte loads
  2. IPC: ipcRenderer.invoke('workflow:execution-history', workflowId, { status: 'completed' })
  3. Main: WorkflowService.getExecutionHistory()
  4. Main → Moku API: GET /api/workflows/{id}/executions
  5. Main: Returns paginated execution list
  6. Renderer: Displays execution list (status, started time, duration)
  7. User: Clicks on execution
  8. Renderer: Expands execution details (inputs, outputs, step-by-step trace)
  9. User: Clicks "Replay" button
 10. Renderer: Opens ExecuteWorkflowDialog pre-filled with execution inputs
 11. Flow continues from "Workflow Execution Flow" step 4
```

**Fork Workflow Flow:**

```
User clicks "Fork" on workflow
  1. IPC: ipcRenderer.invoke('workflow:fork', workflowId)
  2. Main: WorkflowService.forkWorkflow()
  3. Main → Moku API: POST /api/workflows/{id}/fork
  4. Moku API: Copies workflow definition, sets forked_from = original workflow ID, owner_id = current user
  5. Main: Returns new workflow, invalidates list cache
  6. Renderer: Navigate to workflow editor with forked workflow
  7. User: Edits and saves as own workflow
```

## Non-Functional Requirements

### Performance

| Requirement | Target | Measurement | Priority |
|-------------|--------|-------------|----------|
| **Workflow List Load** | <500ms P95 | Time from IPC call to render | P0 |
| **Workflow Editor Load** | <1s P95 | Time from route navigation to interactive editor | P0 |
| **Workflow Execution Startup** | <2s P95 | Time from "Run" button to first step execution | P0 |
| **Step Execution Latency** | <5s P95 per step | Time for single step execution (Tool, MCP, Prompt) | P1 |
| **Execution History Load** | <1s P95 | Time to load 20 execution records | P1 |
| **Cache Hit Rate** | >80% for workflow definitions | Cache hits / total workflow fetches | P1 |
| **Concurrent Executions** | Support 3 simultaneous workflow executions | Desktop can run 3 workflows in parallel | P1 |

**Performance Optimizations:**
- **Workflow Cache**: LRU cache with 10min TTL (max 500 workflows)
- **Lazy Loading**: Load workflow definition only when user opens editor or executes
- **Pagination**: Execution history paginated at 20 records per page
- **Progress Streaming**: Progress events emitted every 500ms (debounced to avoid UI thrashing)
- **Virtual Scrolling**: Workflow list uses virtual scrolling for >100 workflows

### Security

| Requirement | Implementation | Priority |
|-------------|----------------|----------|
| **RBAC Enforcement** | Only workflow owner or project admin can edit/delete workflows | P0 |
| **Capability-Based Sandboxing** | Workflows declare capabilities, enforced by Epic 10's CapabilityEnforcer | P0 |
| **RBAC/SSO Context Inheritance** | Workflow executions inherit user's JWT token and RBAC permissions | P0 |
| **Input Validation** | Workflow inputs validated against type schema before execution | P0 |
| **SQL Injection Prevention** | All database queries use parameterized statements (JPA) | P0 |
| **XSS Prevention** | Workflow outputs sanitized before rendering in UI | P0 |
| **Audit Trail** | All workflow CRUD and execution events logged to audit_log table | P1 |

**Security References:**
- **Epic 10 Capability Model**: Workflows request capabilities (e.g., `filesystem:read`, `network:https:github.com`)
- **User Approval Flow**: User must approve workflow capabilities before installation (PRD §3.8.5)
- **RBAC Integration**: Epic 10's CapabilityEnforcer checks `getUserRoleInProject(userContext) >= 'edit'` for write operations
- **Storage Abstraction**: No direct filesystem access - all file operations via Epic 10's storage service (prevents path traversal attacks)
- **Resource Limits**: Epic 10 enforces 512MB RAM, 1 core CPU, 60s timeout per step (prevents resource exhaustion)

### Reliability/Availability

| Requirement | Implementation | Target | Priority |
|-------------|----------------|--------|----------|
| **Graceful Failure Handling** | Step errors handled per onError setting (stop, skip, retry) | 100% of errors handled | P0 |
| **Retry Logic** | Failed steps retried up to 3 times with exponential backoff (1s, 2s, 4s) | <5% permanent failures | P0 |
| **Execution Recovery** | Execution state saved in workflow_executions table for resume (post-MVP) | N/A (MVP) | P2 |
| **Workflow Validation** | Workflow definition validated before save (required fields, circular deps) | 100% of workflows validated | P0 |
| **API Error Handling** | Moku API errors caught and displayed to user with actionable messages | 100% of errors caught | P0 |
| **Cache Invalidation** | Workflow cache invalidated on update/delete to prevent stale data | 100% invalidation on mutations | P1 |

**Error Recovery Patterns:**
- **Step Failure**: If step fails and `onError='retry'`, retry with exponential backoff (1s, 2s, 4s)
- **Workflow Failure**: If execution fails, save execution trace to `workflow_executions` for debugging
- **Network Failure**: If Moku API unreachable, show offline error and allow local workflow editing (execution disabled)
- **Validation Failure**: If workflow definition invalid, show detailed error messages in editor UI

### Observability

| Signal Type | Implementation | Examples | Priority |
|-------------|----------------|----------|----------|
| **Logs** | electron-log for Desktop, Spring Boot logging for Moku API | Workflow created, execution started, step completed, errors | P0 |
| **Metrics** | Execution count, duration, success/failure rate stored in database | `execution_count`, `duration_ms`, `status` | P0 |
| **Traces** | Execution trace saved to `execution_trace` JSONB column | Step-by-step execution log with inputs/outputs | P0 |
| **Audit Events** | Workflow CRUD and execution events logged to `audit_log` table | User X created workflow Y, User X executed workflow Y | P1 |

**Required Logging:**
- **Workflow CRUD**: `[WorkflowService] Created workflow ${workflowId} by user ${userId}`
- **Execution Start**: `[WorkflowExecutionEngine] Starting execution ${executionId} for workflow ${workflowId}`
- **Step Execution**: `[StepExecutor] Executing step ${stepId} (${stepType})`
- **Step Completion**: `[StepExecutor] Step ${stepId} completed in ${durationMs}ms`
- **Errors**: `[WorkflowExecutionEngine] Execution ${executionId} failed: ${errorMessage}`

**Execution Trace Format:**
```json
{
  "executionTrace": [
    {
      "stepId": "step1",
      "stepName": "Read file",
      "status": "completed",
      "startedAt": "2025-11-26T10:00:00Z",
      "completedAt": "2025-11-26T10:00:02Z",
      "output": { "content": "file contents..." },
      "durationMs": 2000
    },
    {
      "stepId": "step2",
      "stepName": "Summarize with AI",
      "status": "completed",
      "startedAt": "2025-11-26T10:00:02Z",
      "completedAt": "2025-11-26T10:00:05Z",
      "output": { "summary": "..." },
      "durationMs": 3000
    }
  ]
}
```

## Dependencies and Integrations

**Critical Dependencies:**

| Dependency | Type | Purpose | Owner | Status |
|------------|------|---------|-------|--------|
| **Epic 10: Portable Workflow Engine** | Internal | Provides WorkflowEngine.execute(), storage abstraction, capability sandboxing | Desktop Team | **BLOCKS Epic 7** - Must complete first |
| **Epic 1: Database & API Foundation** | Internal | Provides Moku API infrastructure, database schema, authentication | Backend Team | Completed |
| **Epic 3: Project Collaboration** | Internal | Provides projects table, RBAC enforcement, member management | Desktop/Backend Team | Completed |
| **Moku API** | Platform | Spring Boot backend for workflow persistence, execution tracking | Backend Team | Requires updates (see below) |
| **Electron** | External | Desktop framework for IPC, main process services | Electron.js | v39.x (existing) |
| **PostgreSQL** | External | Database for workflow definitions and execution history | PostgreSQL | v14+ (existing) |

**Moku API Updates Required (E7-S1):**

```java
// New Controllers
- WorkflowController: 9 endpoints (CRUD, fork, execute, history)

// New Database Tables
- workflows (workflow definitions)
- workflow_executions (execution history)

// New Services
- WorkflowService: Business logic for workflow CRUD
- WorkflowExecutionService: Create and update execution records

// New DTOs
- WorkflowDTO, CreateWorkflowRequest, UpdateWorkflowRequest
- WorkflowExecutionDTO, ExecutionStepTraceDTO
```

**Epic 10 Integration Points:**

| Epic 10 Component | How Epic 7 Uses It |
|-------------------|-------------------|
| `WorkflowEngine.execute()` | Called by WorkflowExecutionEngine to run workflow steps |
| `StorageService` | Workflows access files via URLs (not direct paths) |
| `CapabilityEnforcer` | Checks workflow capabilities before allowing step execution |
| `ScriptRunner` | Executes script steps in sandboxed environments |
| `AIClient` | Executes prompt steps via embedded Anthropic API client |

**Integration Constraints from Epic 10:**
- ✅ **Zero Electron Dependencies**: WorkflowExecutionEngine can run in plain Node.js
- ✅ **Storage Abstraction**: All file access via `storage.readFile(url)`, not direct paths
- ✅ **Capability-Based Security**: Workflows declare capabilities, enforced at runtime
- ✅ **RBAC/SSO Context**: Workflows inherit user's permissions from JWT

**Third-Party Dependencies (Desktop):**

| Package | Version | Purpose | License |
|---------|---------|---------|---------|
| `electron` | 39.x | Desktop framework | MIT |
| `electron-store` | 11.x | Local cache storage | MIT |
| `electron-log` | 5.x | Logging | MIT |
| `svelte` | 5.x | UI framework | MIT |
| `tailwindcss` | 3.x | Styling | MIT |

## Acceptance Criteria (Authoritative)

**E7-S1: Workflow API Endpoints (Backend)**
- [ ] AC-1.1: `GET /api/workflows` returns paginated workflow list with filters (scope, projectId)
- [ ] AC-1.2: `GET /api/workflows/{id}` returns workflow with full definition (inputs, steps, outputs, capabilities)
- [ ] AC-1.3: `POST /api/workflows` creates workflow with validation (required fields, JWT owner_id)
- [ ] AC-1.4: `PATCH /api/workflows/{id}` updates workflow (only owner or admin can update)
- [ ] AC-1.5: `DELETE /api/workflows/{id}` soft deletes workflow (sets deleted_at timestamp)
- [ ] AC-1.6: `POST /api/workflows/{id}/fork` creates copy with forked_from reference
- [ ] AC-1.7: `POST /api/workflows/{id}/execute` creates execution record (does NOT run synchronously)
- [ ] AC-1.8: `GET /api/workflows/{id}/executions` returns paginated execution history with status filter
- [ ] AC-1.9: All endpoints enforce RBAC (only owner/admin can edit, delete; all project members can view)

**E7-S2: Workflow Service & Execution Engine (Desktop)**
- [ ] AC-2.1: `WorkflowService.listWorkflows()` returns cached workflows (10min TTL, cache hit >80%)
- [ ] AC-2.2: `WorkflowService.createWorkflow()` saves workflow and invalidates list cache
- [ ] AC-2.3: `WorkflowService.executeWorkflow()` creates execution record, runs via Epic 10 engine, updates record with results
- [ ] AC-2.4: `WorkflowExecutionEngine.execute()` runs steps sequentially (sorted by step.order)
- [ ] AC-2.5: Step executors (ToolExecutor, MCPExecutor, PromptExecutor) execute correctly and return outputs
- [ ] AC-2.6: Variable resolution works: `{{inputs.name}}`, `{{step1.output.field}}` replaced with actual values
- [ ] AC-2.7: Conditional steps evaluated correctly (if condition false → skip step)
- [ ] AC-2.8: Error handling works: onError='stop' halts, onError='skip' continues, onError='retry' retries (max 3 times)
- [ ] AC-2.9: Progress events emitted during execution (`workflow:progress` IPC events)
- [ ] AC-2.10: Execution trace saved to Moku API with step-by-step details (inputs, outputs, duration, errors)

**E7-S3: Workflow List View (Desktop UI)**
- [ ] AC-3.1: Workflow list renders in project sidebar with workflow names and metadata
- [ ] AC-3.2: "New Workflow" button opens editor with empty workflow
- [ ] AC-3.3: Clicking workflow navigates to workflow detail/editor view
- [ ] AC-3.4: Template badge displayed for workflows with `isTemplate=true`
- [ ] AC-3.5: Scope filter (All, Personal, Project) works and updates list
- [ ] AC-3.6: Empty state displayed when no workflows exist
- [ ] AC-3.7: Virtual scrolling works for >100 workflows (performance)

**E7-S4: Workflow Editor (Desktop UI)**
- [ ] AC-4.1: Editor loads workflow definition (or empty for new workflow)
- [ ] AC-4.2: Inputs panel allows adding/removing inputs with type, required, description fields
- [ ] AC-4.3: Steps panel allows adding/removing/reordering steps (drag-and-drop)
- [ ] AC-4.4: Step type selection modal (Tool, MCP, Prompt) displayed when adding step
- [ ] AC-4.5: Step configuration forms display based on type (ToolStepConfig, MCPStepConfig, PromptStepConfig)
- [ ] AC-4.6: Outputs panel allows mapping step outputs to workflow outputs (variable references)
- [ ] AC-4.7: Save button validates workflow (required fields, circular dependencies, valid variable references)
- [ ] AC-4.8: Cancel button discards changes with unsaved changes confirmation
- [ ] AC-4.9: Validation errors displayed in editor UI (e.g., "Step 3 references undefined variable {{step5.output}}")

**E7-S5: Workflow Execution UI (Desktop UI)**
- [ ] AC-5.1: ExecuteWorkflowDialog displays input form based on workflow.definition.inputs
- [ ] AC-5.2: Input fields rendered correctly: string → text input, number → number input, boolean → checkbox, file → file picker
- [ ] AC-5.3: Required inputs validated before execution (show error if missing)
- [ ] AC-5.4: "Run Workflow" button starts execution, shows progress panel
- [ ] AC-5.5: Progress panel displays step list with status indicators (queued, running, completed, failed, skipped)
- [ ] AC-5.6: Current step highlighted during execution
- [ ] AC-5.7: Step outputs displayed when expanded (formatted based on type)
- [ ] AC-5.8: Final outputs displayed when execution completes
- [ ] AC-5.9: Errors displayed clearly (red highlight, error message)
- [ ] AC-5.10: "Run Again" button pre-fills inputs and re-executes workflow

**E7-S6: Execution History (Desktop UI)**
- [ ] AC-6.1: Execution history list displays past executions (status, started time, duration)
- [ ] AC-6.2: Clicking execution expands details (inputs, outputs, step-by-step trace)
- [ ] AC-6.3: "Replay" button opens ExecuteWorkflowDialog pre-filled with execution inputs
- [ ] AC-6.4: Pagination works for >20 executions
- [ ] AC-6.5: Status filter works (completed, failed, all)
- [ ] AC-6.6: Execution trace shows step-level details (step name, status, output, duration)

## Traceability Mapping

| Acceptance Criteria | Spec Section | Component/API | Test Type |
|---------------------|--------------|---------------|-----------|
| **AC-1.1 to AC-1.9** (Workflow API) | §4.3 APIs and Interfaces | `WorkflowController` (Moku API) | Integration tests (Spring Boot REST) |
| **AC-2.1 to AC-2.3** (WorkflowService CRUD) | §4.3 APIs and Interfaces | `WorkflowService` (Desktop Main) | Unit tests + Integration tests (Moku API mocked) |
| **AC-2.4 to AC-2.10** (Execution Engine) | §4.4 Workflows and Sequencing | `WorkflowExecutionEngine`, `StepExecutor`, `ToolExecutor`, `MCPExecutor`, `PromptExecutor` | Unit tests + Integration tests (Epic 10 engine) |
| **AC-3.1 to AC-3.7** (Workflow List UI) | §4.1 Services and Modules | `WorkflowList.svelte` (Renderer) | Component tests (Svelte Testing Library) + E2E tests |
| **AC-4.1 to AC-4.9** (Workflow Editor UI) | §4.1 Services and Modules | `WorkflowEditor.svelte`, `InputsPanel`, `StepsPanel`, `OutputsPanel` | Component tests + E2E tests |
| **AC-5.1 to AC-5.10** (Execution UI) | §4.4 Workflows and Sequencing | `ExecuteWorkflowDialog.svelte`, `ExecutionProgress.svelte` | Component tests + E2E tests |
| **AC-6.1 to AC-6.6** (Execution History UI) | §4.4 Workflows and Sequencing | `ExecutionHistory.svelte` | Component tests + E2E tests |

**PRD Requirement Traceability:**

| PRD Requirement | Epic 7 Implementation | Acceptance Criteria |
|-----------------|----------------------|---------------------|
| PRD §3.7 Workflow Marketplace (MVP: Basic CRUD) | E7-S1, E7-S2, E7-S3, E7-S4 (CRUD + execution, no marketplace features in MVP) | AC-1.1 to AC-4.9 |
| PRD §3.7.1 Workflow Tiers (Basic, Intermediate) | E7-S2 WorkflowExecutionEngine (sequential steps, conditionals, variables) | AC-2.4 to AC-2.8 |
| PRD §3.8 Portable Workflow Engine (Epic 10 integration) | E7-S2 WorkflowExecutionEngine delegates to Epic 10 | AC-2.3, AC-2.4 |
| PRD §3.8.2 Storage Abstraction | E7-S2 integrates Epic 10's storage service (file URLs, not paths) | AC-2.4 (implicitly tested via Epic 10) |
| PRD §3.8.5 Capability-Based Sandboxing | E7-S2 workflows declare capabilities, enforced by Epic 10 | AC-2.4 (implicitly tested via Epic 10) |

**Architecture Requirement Traceability:**

| Architecture Requirement | Implementation | Acceptance Criteria |
|-------------------------|----------------|---------------------|
| ARCH §2 IPC Pattern (`workflow:*` channels) | IPC handlers in main.ts (`workflow:list`, `workflow:create`, etc.) | AC-2.1, AC-2.2, AC-2.3 |
| ARCH §3 Moku API Integration | `WorkflowController` REST API | AC-1.1 to AC-1.9 |
| ARCH §4 Caching Strategy (LRU, 10min TTL) | `WorkflowCache` class | AC-2.1 |
| ARCH §5 Multi-Process (Main handles execution, Renderer handles UI) | WorkflowExecutionEngine in main, WorkflowEditor/ExecuteWorkflowDialog in renderer | AC-2.4, AC-4.1, AC-5.1 |

**Test Coverage Mapping:**

| Story | Unit Tests | Integration Tests | E2E Tests | Coverage Target |
|-------|------------|------------------|-----------|----------------|
| **E7-S1** | WorkflowController tests (Spring Boot JUnit) | Moku API integration tests (database) | N/A (backend only) | 90%+ |
| **E7-S2** | WorkflowService, WorkflowExecutionEngine, Step executors | Epic 10 integration tests, Moku API mocked | Workflow execution E2E (Desktop) | 85%+ |
| **E7-S3** | WorkflowList component tests | N/A | Workflow list E2E (navigate, filter) | 80%+ |
| **E7-S4** | WorkflowEditor component tests | N/A | Workflow creation E2E (create, save) | 80%+ |
| **E7-S5** | ExecuteWorkflowDialog component tests | N/A | Workflow execution E2E (execute, progress, results) | 85%+ |
| **E7-S6** | ExecutionHistory component tests | N/A | Execution history E2E (view, replay) | 80%+ |

## Risks, Assumptions, Open Questions

**RISKS:**

| Risk | Probability | Impact | Mitigation | Owner |
|------|------------|--------|------------|-------|
| **RISK-1: Epic 10 delays block Epic 7 implementation** | High | Critical | Epic 10 is P0 Critical priority, parallel development with mocks; WorkflowExecutionEngine designed to swap in Epic 10 engine when ready | Desktop Team |
| **RISK-2: Workflow editor UX too complex for non-technical users** | Medium | High | User testing with 5+ users; provide "Simple Mode" with only linear steps (no conditionals); invest in onboarding tooltips and help docs | UX Team |
| **RISK-3: Execution progress updates cause UI performance issues** | Low | Medium | Debounce progress events (max 1 event per 500ms); use virtual scrolling for step list; optimize renderer re-renders | Desktop Team |
| **RISK-4: Moku API delays for new endpoints** | Medium | High | Backend team prioritizes E7-S1 API endpoints; Desktop team develops with mocked APIs; integration tests validate once APIs ready | Backend Team |
| **RISK-5: Variable resolution edge cases cause execution failures** | Medium | Medium | Comprehensive unit tests for variable resolution (nested access, missing variables, type coercion); error messages show exact variable that failed | Desktop Team |
| **RISK-6: Workflow validation doesn't catch all invalid definitions** | Low | Medium | Multi-layer validation: client-side (editor), server-side (API), execution-time (engine); add validation test suite with 50+ invalid workflows | Desktop + Backend Team |
| **RISK-7: Cache invalidation bugs cause stale workflow data** | Low | High | Strict cache invalidation on all mutations (create, update, delete); integration tests verify cache behavior; add manual refresh button in UI | Desktop Team |

**ASSUMPTIONS:**

| Assumption | Validation | Impact if Wrong |
|------------|------------|-----------------|
| **ASSUMPTION-1: Epic 10 Portable Workflow Engine completes before Epic 7** | Epic 10 marked P0 Critical in sprint-status.yaml | Epic 7 blocked - cannot test execution engine integration |
| **ASSUMPTION-2: Basic and Intermediate workflow tiers sufficient for MVP** | PRD §3.7.1 defines tiers; validated with user research | May need Advanced tier earlier than planned (loop constructs, invoke workflows) |
| **ASSUMPTION-3: YAML/JSON workflow definition acceptable (no GUI builder in MVP)** | PRD §3.7.1 defers GUI builder to post-MVP | Low user adoption if editing raw YAML is too difficult - may need to accelerate GUI builder |
| **ASSUMPTION-4: 10min workflow cache TTL provides good balance** | Industry standard for low-churn data | If workflows edited frequently, cache thrashing reduces performance - may need adaptive TTL |
| **ASSUMPTION-5: Workflows with 3+ simultaneous executions sufficient** | Based on typical user behavior (1-2 workflows active) | If users run >3 workflows concurrently, UI becomes unresponsive - need execution queuing |
| **ASSUMPTION-6: Moku API can handle workflow CRUD load** | Moku API already handles thread/message CRUD at scale | If workflows create >10K records/user, pagination and indexing need optimization |

**OPEN QUESTIONS:**

| Question | Owner | Decision Deadline | Status |
|----------|-------|-------------------|--------|
| **Q1: Should workflow editor support YAML/JSON direct editing OR only form-based editing in MVP?** | Product + UX | End of Month 1 | **OPEN** - Need user testing to validate |
| **Q2: Should workflows be versioned from MVP launch OR defer versioning to post-MVP?** | Product + Engineering | End of Month 1 | **OPEN** - Impacts database schema design |
| **Q3: What is the maximum execution duration before timeout? (60s per step OR total workflow timeout)** | Product + Engineering | End of Month 2 | **OPEN** - May need configurable timeout per workflow |
| **Q4: Should execution history have retention policy? (90 days, 1 year, indefinite)** | Product + Legal | End of Month 2 | **OPEN** - Impacts storage costs and compliance (GDPR) |
| **Q5: Should failed executions automatically retry OR require manual retry?** | Product | End of Month 2 | **OPEN** - Auto-retry could cause API rate limiting |
| **Q6: Should workflows support secrets/environment variables OR rely on storage service only?** | Product + Security | End of Month 2 | **OPEN** - Impacts capability model and security surface area |

## Test Strategy Summary

**Testing Approach:**

Epic 7 employs a **multi-layer testing strategy** covering unit tests, integration tests, component tests, and end-to-end tests to ensure 85%+ overall code coverage.

**1. Unit Tests**

**Backend (Moku API - Spring Boot + JUnit):**
- `WorkflowControllerTest`: Test all REST endpoints (CRUD, fork, execute, history)
  - Mock `WorkflowService` and `WorkflowExecutionService`
  - Verify request/response DTOs, status codes, pagination
  - Test RBAC enforcement (owner/admin can edit, members can view)
- `WorkflowServiceTest`: Test business logic (validation, soft delete, forked_from references)
- `WorkflowExecutionServiceTest`: Test execution record creation and updates

**Desktop (Main Process - Vitest):**
- `WorkflowService.test.ts`: Test CRUD operations, caching, cache invalidation
  - Mock Moku API client
  - Verify cache hit/miss behavior (TTL, invalidation on mutations)
- `WorkflowExecutionEngine.test.ts`: Test step execution, variable resolution, error handling
  - Mock Epic 10 WorkflowEngine
  - Test sequential execution, conditional steps, onError handling (stop, skip, retry)
- `ToolExecutor.test.ts`, `MCPExecutor.test.ts`, `PromptExecutor.test.ts`: Test individual step executors
  - Mock dependencies (filesystem, MCP client, LLM API)
  - Verify input resolution (`{{variable}}` replacement), output extraction

**Desktop (Renderer - Svelte Testing Library):**
- `WorkflowList.test.ts`: Test workflow list rendering, filters, empty state
- `WorkflowEditor.test.ts`: Test editor forms (inputs, steps, outputs), validation
- `ExecuteWorkflowDialog.test.ts`: Test input form, progress display, results
- `ExecutionHistory.test.ts`: Test execution list, details expansion, replay

**Coverage Target:** 90%+ for backend, 85%+ for desktop main, 80%+ for renderer

**2. Integration Tests**

**Moku API (Spring Boot + TestContainers):**
- Full stack integration tests with real PostgreSQL database
- Test workflow CRUD persistence (create → read → update → delete)
- Test execution history queries with pagination
- Test RBAC enforcement at database level (SQL queries respect user permissions)

**Desktop + Moku API Integration:**
- Test Desktop → Moku API communication with real HTTP calls (Moku API running in test mode)
- Test workflow creation flow: Desktop creates workflow → Moku API saves → Desktop fetches cached workflow
- Test execution flow: Desktop executes → Moku API creates execution record → Desktop updates with results

**Desktop + Epic 10 Integration:**
- Test WorkflowExecutionEngine with real Epic 10 WorkflowEngine (not mocked)
- Test storage abstraction: workflows read files via `storage.readFile(url)` (Epic 10 LocalStorageService)
- Test capability enforcement: workflows with unapproved capabilities blocked by Epic 10 CapabilityEnforcer

**Coverage Target:** 85%+ for integration tests

**3. Component Tests (Svelte + Playwright Component Testing)**

- Test Svelte components in isolation with real user interactions (click, type, drag-and-drop)
- Test `WorkflowEditor` drag-and-drop step reordering
- Test `ExecuteWorkflowDialog` input form rendering based on workflow definition
- Test `ExecutionHistory` pagination and filtering

**Coverage Target:** 80%+ for component tests

**4. End-to-End Tests (Playwright)**

**Workflow Creation E2E:**
1. Launch Desktop app
2. Navigate to project, click "New Workflow"
3. Fill in workflow name, add input (name="email", type=string, required=true)
4. Add step: Prompt step with template "Summarize: {{inputs.email}}"
5. Map output: summary → step1.output.text
6. Click "Save"
7. Verify workflow appears in list

**Workflow Execution E2E:**
1. Open workflow, click "Execute"
2. Fill in input (email="test email text")
3. Click "Run Workflow"
4. Verify progress panel shows step 1 status "running" → "completed"
5. Verify final output displays summary text
6. Click "Run Again", verify inputs pre-filled

**Execution History E2E:**
1. Open workflow, click "History"
2. Verify execution list shows past run (status, duration)
3. Click execution, verify details expanded (inputs, outputs, trace)
4. Click "Replay", verify ExecuteWorkflowDialog opens with pre-filled inputs

**Coverage Target:** 100% of critical user flows tested E2E

**5. Performance Tests**

- **Load Testing**: Create 500 workflows, measure list load time (<500ms P95)
- **Execution Latency**: Execute 100 workflows, measure startup time (<2s P95) and step execution time (<5s P95)
- **Cache Performance**: Measure cache hit rate (target >80%) under realistic usage (100 workflow fetches, 20 unique workflows)
- **Concurrent Execution**: Run 3 workflows simultaneously, verify UI responsiveness (no lag, progress updates smooth)

**6. Security Tests**

- **RBAC Enforcement**: Attempt to edit workflow as non-owner → expect 403 Forbidden
- **SQL Injection**: Submit workflow with malicious input (`'; DROP TABLE workflows; --`) → expect sanitized
- **XSS Prevention**: Submit workflow output with `<script>alert('XSS')</script>` → expect escaped in UI
- **Capability Enforcement**: Execute workflow with unapproved capability → expect PermissionDeniedError

**7. Edge Case Tests**

- **Circular Dependency**: Create workflow where step 1 depends on step 2, step 2 depends on step 1 → expect validation error
- **Missing Variable**: Reference undefined variable `{{step5.output}}` → expect execution error with clear message
- **Empty Workflow**: Save workflow with no steps → expect validation error
- **Large Execution Trace**: Execute workflow with 100 steps → verify trace saved correctly (pagination, no truncation)
- **Network Failure During Execution**: Disconnect Moku API mid-execution → expect retry logic + fallback error message

**Test Execution:**
- **CI/CD**: All tests run on every PR (unit, integration, component tests)
- **Nightly**: E2E tests, performance tests, security tests
- **Pre-Release**: Full test suite + manual QA on Alpha/Beta/RC builds

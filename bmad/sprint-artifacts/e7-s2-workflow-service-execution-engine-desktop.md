# Story 7.2: Workflow Service & Execution Engine (Desktop)

Status: ready-for-dev

## Story

As a **Holokai Desktop developer**,
I want **a WorkflowService for workflow CRUD operations and a WorkflowExecutionEngine for running workflow steps**,
so that **the desktop app can manage workflows via Moku API and execute them locally by orchestrating step executors (Tool, MCP, Prompt) with proper error handling and variable resolution**.

## Acceptance Criteria

1. **AC-2.1:** `WorkflowService.listWorkflows()` returns cached workflows (10min TTL, cache hit >80%)
2. **AC-2.2:** `WorkflowService.createWorkflow()` saves workflow and invalidates list cache
3. **AC-2.3:** `WorkflowService.executeWorkflow()` creates execution record, runs via Epic 10 engine, updates record with results
4. **AC-2.4:** `WorkflowExecutionEngine.execute()` runs steps sequentially (sorted by step.order)
5. **AC-2.5:** Step executors (ToolExecutor, MCPExecutor, PromptExecutor) execute correctly and return outputs
6. **AC-2.6:** Variable resolution works: `{{inputs.name}}`, `{{step1.output.field}}` replaced with actual values
7. **AC-2.7:** Conditional steps evaluated correctly (if condition false → skip step)
8. **AC-2.8:** Error handling works: onError='stop' halts, onError='skip' continues, onError='retry' retries (max 3 times)
9. **AC-2.9:** Progress events emitted during execution (`workflow:progress` IPC events)
10. **AC-2.10:** Execution trace saved to Moku API with step-by-step details (inputs, outputs, duration, errors)

## Tasks / Subtasks

- [ ] **Task 1: Create WorkflowService class** (AC: #2.1, #2.2, #2.3)
  - [ ] Create `src/services/WorkflowService.ts` with TypeScript interfaces
  - [ ] Inject MokuAPIClient and WorkflowCache dependencies
  - [ ] Define Workflow, WorkflowDefinition, WorkflowExecution interfaces per tech-spec §4.2
  - [ ] Define WorkflowInput, WorkflowStep, WorkflowOutput interfaces per tech-spec §4.2
  - [ ] Initialize cache with LRU strategy (max 500 workflows, 10min TTL)

- [ ] **Task 2: Implement WorkflowService CRUD operations** (AC: #2.1, #2.2)
  - [ ] Implement `listWorkflows(filters)` - fetch from Moku API with caching
    - [ ] Cache key: `list_${JSON.stringify(filters)}`
    - [ ] On cache miss: call `/api/workflows` endpoint
    - [ ] Cache result with 10min TTL
    - [ ] Return Workflow[] array
  - [ ] Implement `getWorkflow(id)` - fetch single workflow with caching
    - [ ] Cache key: `workflow_${id}`
    - [ ] On cache miss: call `/api/workflows/{id}` endpoint
    - [ ] Cache result with 10min TTL
    - [ ] Return Workflow object with full definition
  - [ ] Implement `createWorkflow(data)` - create new workflow
    - [ ] POST to `/api/workflows` with CreateWorkflowRequest
    - [ ] Invalidate all `list_*` cache entries
    - [ ] Cache new workflow with key `workflow_${id}`
    - [ ] Return created Workflow object
  - [ ] Implement `updateWorkflow(id, data)` - update existing workflow
    - [ ] PATCH to `/api/workflows/{id}` with UpdateWorkflowRequest
    - [ ] Invalidate `workflow_${id}` cache entry
    - [ ] Invalidate all `list_*` cache entries
    - [ ] Cache updated workflow
    - [ ] Return updated Workflow object
  - [ ] Implement `deleteWorkflow(id)` - soft delete workflow
    - [ ] DELETE to `/api/workflows/{id}`
    - [ ] Invalidate `workflow_${id}` cache entry
    - [ ] Invalidate all `list_*` cache entries
  - [ ] Implement `forkWorkflow(id)` - create copy of workflow
    - [ ] POST to `/api/workflows/{id}/fork`
    - [ ] Invalidate all `list_*` cache entries
    - [ ] Return new forked Workflow object

- [ ] **Task 3: Implement WorkflowService execution orchestration** (AC: #2.3, #2.10)
  - [ ] Implement `executeWorkflow(id, inputs)` - orchestrate execution
    - [ ] Create execution record: POST to `/api/workflows/{id}/execute` with inputs
    - [ ] Fetch workflow definition via `getWorkflow(id)`
    - [ ] Call WorkflowExecutionEngine.execute() with workflow, inputs, userContext
    - [ ] Handle execution result (success or failure)
    - [ ] Update execution record: PATCH to `/api/workflows/executions/{executionId}` with:
      - [ ] status: 'completed' or 'failed'
      - [ ] outputs: final workflow outputs
      - [ ] executionTrace: step-by-step execution log
      - [ ] errorMessage: error details if failed
      - [ ] durationMs: total execution time
    - [ ] Return WorkflowExecution object
  - [ ] Implement `getExecutionHistory(workflowId, filters)` - fetch execution history
    - [ ] GET from `/api/workflows/{workflowId}/executions` with filters
    - [ ] Support pagination (page, size)
    - [ ] Support status filter (queued, running, completed, failed)
    - [ ] Return WorkflowExecution[] array

- [ ] **Task 4: Create WorkflowExecutionEngine class** (AC: #2.4, #2.5, #2.9, #2.10)
  - [ ] Create `src/services/WorkflowExecutionEngine.ts` with Epic 10 integration
  - [ ] Inject dependencies: ToolExecutor, MCPExecutor, PromptExecutor
  - [ ] Define ExecutionContext interface per tech-spec §4.2
  - [ ] Implement `execute(workflow, inputs, userContext)` main method
    - [ ] Initialize ExecutionContext with workflowId, executionId, userId, inputs, variables={}, userContext
    - [ ] Create empty executionTrace array for step-by-step logging
    - [ ] Sort workflow.definition.steps by step.order (ascending)
    - [ ] Initialize success flag and outputs variable
    - [ ] Record execution start time
  - [ ] Implement step execution loop (sequential processing)
    - [ ] For each step in sorted steps array:
      - [ ] Create step trace entry: { stepId, stepName, status: 'queued', startedAt }
      - [ ] Emit progress event: `workflow:progress` via webContents.send()
      - [ ] Evaluate conditional (if step.condition exists) - see Task 9
      - [ ] If condition false: mark step as 'skipped', continue to next step
      - [ ] Update step trace status to 'running'
      - [ ] Resolve step inputs from context (replace {{variable}} syntax) - see Task 8
      - [ ] Execute step via appropriate executor based on step.type:
        - [ ] type='tool' → ToolExecutor.execute(step.config, context)
        - [ ] type='mcp' → MCPExecutor.execute(step.config, context)
        - [ ] type='prompt' → PromptExecutor.execute(step.config, context)
      - [ ] Store step output in context.variables[step.id]
      - [ ] Update step trace: status='completed', completedAt, output, durationMs
      - [ ] Emit progress event with completed status
      - [ ] Handle step errors - see Task 10
  - [ ] Map final workflow outputs
    - [ ] For each output in workflow.definition.outputs:
      - [ ] Resolve output.source from context.variables (e.g., "{{step3.output.text}}")
      - [ ] Store in outputs object: outputs[output.name] = resolvedValue
  - [ ] Return execution result object
    - [ ] success: boolean (true if all steps completed, false if failed/stopped)
    - [ ] outputs: Record<string, unknown> (final workflow outputs)
    - [ ] executionTrace: ExecutionStepTrace[] (step-by-step log)
    - [ ] error?: string (error message if failed)
    - [ ] durationMs: number (total execution time)

- [ ] **Task 5: Implement ToolExecutor for native tools** (AC: #2.5)
  - [ ] Create `src/executors/ToolExecutor.ts` with Epic 10 integration
  - [ ] Define ToolStepConfig interface: { tool: string, inputs: Record<string, string> }
  - [ ] Implement `execute(config, context)` method
    - [ ] Parse tool name from config.tool (e.g., "filesystem:read")
    - [ ] Resolve tool inputs from config.inputs using context (replace {{variables}})
    - [ ] Map tool name to implementation function
    - [ ] Call tool function with resolved inputs
    - [ ] Handle tool errors (throw descriptive error)
    - [ ] Return tool output as unknown
  - [ ] Implement tool mappings (initial set)
    - [ ] "filesystem:read" → read file from storage service (Epic 10 integration)
    - [ ] "filesystem:write" → write file to storage service (Epic 10 integration)
    - [ ] Add more tools as needed (extensible design)

- [ ] **Task 6: Implement MCPExecutor for MCP servers** (AC: #2.5)
  - [ ] Create `src/executors/MCPExecutor.ts` with MCP protocol support
  - [ ] Define MCPStepConfig interface: { server: string, tool: string, inputs: Record<string, string> }
  - [ ] Implement `execute(config, context)` method
    - [ ] Parse MCP server name from config.server (e.g., "github")
    - [ ] Resolve tool inputs from config.inputs using context
    - [ ] Connect to MCP server (use existing MCP client infrastructure)
    - [ ] Call specified tool on MCP server with resolved inputs
    - [ ] Handle MCP protocol responses
    - [ ] Parse and extract output from MCP response
    - [ ] Handle MCP errors (throw descriptive error)
    - [ ] Return tool output as unknown

- [ ] **Task 7: Implement PromptExecutor for LLM calls** (AC: #2.5)
  - [ ] Create `src/executors/PromptExecutor.ts` with LLM integration
  - [ ] Define PromptStepConfig interface: { template: string, model?: string, temperature?: number, maxTokens?: number }
  - [ ] Implement `execute(config, context)` method
    - [ ] Resolve prompt template from config.template using context (replace {{variables}})
    - [ ] Build LLM request with resolved prompt
    - [ ] Apply model override if config.model specified
    - [ ] Apply temperature override if config.temperature specified
    - [ ] Apply maxTokens override if config.maxTokens specified
    - [ ] Call LLM API (integrate with existing ChatService or use Epic 10 AIClient)
    - [ ] Parse LLM response text
    - [ ] Handle LLM errors (throw descriptive error with context)
    - [ ] Return response as { text: string }

- [ ] **Task 8: Implement variable resolution utility** (AC: #2.6)
  - [ ] Create `src/utils/variableResolver.ts` utility module
  - [ ] Implement `resolveVariables(template, context)` function
    - [ ] Find all {{variable}} patterns in template string (regex: /\{\{([^}]+)\}\}/g)
    - [ ] For each variable reference:
      - [ ] Parse variable path (e.g., "inputs.name" or "step1.output.field")
      - [ ] Split path by '.' delimiter
      - [ ] Traverse context object to resolve value
      - [ ] Handle nested access (e.g., context.step1.output.field)
      - [ ] Handle missing variables: throw descriptive error with variable name
    - [ ] Replace {{variable}} with resolved value in template
    - [ ] Return resolved string
  - [ ] Implement `resolveValue(path, context)` helper function
    - [ ] Split path into parts (e.g., ["inputs", "name"])
    - [ ] Start with context object
    - [ ] For each part: access object[part]
    - [ ] If part missing: throw error "Variable not found: ${path}"
    - [ ] Return final value
  - [ ] Add unit tests for edge cases
    - [ ] Missing variables → error
    - [ ] Nested access → correct value
    - [ ] Multiple variables in one template → all resolved
    - [ ] Special characters in values → properly escaped

- [ ] **Task 9: Implement conditional step evaluation** (AC: #2.7)
  - [ ] Extend WorkflowExecutionEngine with `evaluateCondition(condition, context)` method
    - [ ] Parse condition string (e.g., "{{step1.output.success}} === true")
    - [ ] Resolve variables in condition using variableResolver
    - [ ] Evaluate condition expression (use safe eval or expression parser)
    - [ ] Return boolean result
    - [ ] Handle evaluation errors: log warning, default to false
  - [ ] Integrate condition evaluation in step execution loop
    - [ ] Before executing step: check if step.condition exists
    - [ ] If exists: call evaluateCondition(step.condition, context)
    - [ ] If result is false: skip step, update trace status to 'skipped'
    - [ ] If result is true or no condition: execute step normally

- [ ] **Task 10: Implement error handling (stop/skip/retry)** (AC: #2.8)
  - [ ] Extend step execution loop with error handling
    - [ ] Wrap step execution in try-catch block
    - [ ] On error: read step.onError setting ('stop', 'skip', 'retry')
    - [ ] If onError='stop':
      - [ ] Update step trace: status='failed', error=errorMessage
      - [ ] Halt execution loop (break)
      - [ ] Mark overall execution as failed
      - [ ] Return execution result with success=false, error=errorMessage
    - [ ] If onError='skip':
      - [ ] Update step trace: status='failed', error=errorMessage
      - [ ] Log warning to console
      - [ ] Continue to next step (don't break loop)
    - [ ] If onError='retry':
      - [ ] Read step.maxRetries (default to 3)
      - [ ] Retry step up to maxRetries times
      - [ ] Use exponential backoff: wait 1s, 2s, 4s between retries
      - [ ] If all retries fail: apply onError='stop' behavior
      - [ ] If retry succeeds: continue normally

- [ ] **Task 11: Implement audit events during execution** (AC: #2.10)
  - [ ] Create audit event utility or use existing logging infrastructure
  - [ ] Write workflow_start event at execution beginning
    - [ ] Include: workflowId, executionId, userId, inputs, timestamp
  - [ ] Write step_start event when step begins
    - [ ] Include: workflowId, executionId, stepId, stepName, timestamp
  - [ ] Write step_complete event when step finishes
    - [ ] Include: workflowId, executionId, stepId, status, output, durationMs, timestamp
  - [ ] Write workflow_complete event on success
    - [ ] Include: workflowId, executionId, outputs, durationMs, timestamp
  - [ ] Write workflow_failed event on failure
    - [ ] Include: workflowId, executionId, error, failedStepId, durationMs, timestamp
  - [ ] Ensure audit events are non-blocking (fire and forget)

- [ ] **Task 12: Implement WorkflowCache class** (AC: #2.1)
  - [ ] Create `src/cache/WorkflowCache.ts` with LRU caching strategy
  - [ ] Define cache entry structure: { key: string, value: unknown, expiresAt: number }
  - [ ] Implement `get(key)` method
    - [ ] Lookup key in cache map
    - [ ] Check if entry expired (expiresAt < Date.now())
    - [ ] If expired: remove entry, return null
    - [ ] If valid: return entry.value
  - [ ] Implement `set(key, value, ttlSeconds)` method
    - [ ] Create cache entry with expiresAt = Date.now() + (ttlSeconds * 1000)
    - [ ] Store in cache map
    - [ ] Check if cache size exceeds max (500 workflows)
    - [ ] If exceeded: evict least recently used entry
  - [ ] Implement `invalidate(keyPattern)` method
    - [ ] Support wildcard patterns (e.g., "list_*")
    - [ ] Iterate cache entries
    - [ ] Remove entries matching pattern
  - [ ] Implement LRU eviction logic
    - [ ] Track access order (Map preserves insertion order)
    - [ ] On cache full: remove oldest entry (first in map)
    - [ ] On access: move entry to end (delete + re-insert)

- [ ] **Task 13: Register IPC handlers for workflow operations** (AC: #2.1, #2.2, #2.3)
  - [ ] Add IPC handlers in `main.ts` or `ipc-handlers/workflow.ts`
  - [ ] Register `workflow:list` handler → WorkflowService.listWorkflows()
  - [ ] Register `workflow:get` handler → WorkflowService.getWorkflow()
  - [ ] Register `workflow:create` handler → WorkflowService.createWorkflow()
  - [ ] Register `workflow:update` handler → WorkflowService.updateWorkflow()
  - [ ] Register `workflow:delete` handler → WorkflowService.deleteWorkflow()
  - [ ] Register `workflow:fork` handler → WorkflowService.forkWorkflow()
  - [ ] Register `workflow:execute` handler → WorkflowService.executeWorkflow()
  - [ ] Register `workflow:execution-history` handler → WorkflowService.getExecutionHistory()
  - [ ] Add error handling for all IPC handlers (try-catch, log errors, return error response)

- [ ] **Task 14: Write unit tests for WorkflowService** (AC: #2.1, #2.2)
  - [ ] Create `tests/unit/services/WorkflowService.test.ts`
  - [ ] Mock MokuAPIClient and WorkflowCache
  - [ ] Test listWorkflows() with cache hit and cache miss scenarios
  - [ ] Test createWorkflow() invalidates list cache
  - [ ] Test updateWorkflow() invalidates workflow and list caches
  - [ ] Test deleteWorkflow() invalidates caches
  - [ ] Test forkWorkflow() returns new workflow with forked_from reference
  - [ ] Test error handling (API errors, network errors)
  - [ ] Target: 90%+ code coverage for WorkflowService

- [ ] **Task 15: Write unit tests for WorkflowExecutionEngine** (AC: #2.4, #2.5, #2.6, #2.7, #2.8)
  - [ ] Create `tests/unit/services/WorkflowExecutionEngine.test.ts`
  - [ ] Mock ToolExecutor, MCPExecutor, PromptExecutor
  - [ ] Test sequential step execution (steps run in order)
  - [ ] Test variable resolution between steps (step1 output → step2 input)
  - [ ] Test conditional step evaluation (condition false → skip step)
  - [ ] Test error handling: onError='stop' halts execution
  - [ ] Test error handling: onError='skip' continues execution
  - [ ] Test error handling: onError='retry' retries step (mock retries)
  - [ ] Test execution trace is properly populated
  - [ ] Test progress events are emitted (mock webContents.send)
  - [ ] Target: 85%+ code coverage for WorkflowExecutionEngine

- [ ] **Task 16: Write unit tests for step executors** (AC: #2.5)
  - [ ] Create `tests/unit/executors/ToolExecutor.test.ts`
    - [ ] Mock filesystem tool (read, write)
    - [ ] Test tool input resolution from context
    - [ ] Test tool output returned correctly
    - [ ] Test tool errors thrown with descriptive messages
  - [ ] Create `tests/unit/executors/MCPExecutor.test.ts`
    - [ ] Mock MCP client connection
    - [ ] Test MCP tool invocation with inputs
    - [ ] Test MCP response parsing
    - [ ] Test MCP errors handled correctly
  - [ ] Create `tests/unit/executors/PromptExecutor.test.ts`
    - [ ] Mock LLM API client
    - [ ] Test prompt template resolution from context
    - [ ] Test LLM response parsed correctly
    - [ ] Test model/temperature/maxTokens overrides applied
    - [ ] Test LLM errors handled correctly
  - [ ] Target: 85%+ code coverage for all executors

- [ ] **Task 17: Write integration tests for WorkflowService + Moku API** (AC: #2.1, #2.2, #2.3, #2.10)
  - [ ] Create `tests/integration/WorkflowService.integration.test.ts`
  - [ ] Use real Moku API client (or test instance)
  - [ ] Test workflow creation flow: create → list (verify appears) → get (verify definition)
  - [ ] Test workflow update flow: update → get (verify changes)
  - [ ] Test workflow delete flow: delete → list (verify removed)
  - [ ] Test execution flow: execute → getExecutionHistory (verify execution record)
  - [ ] Test cache behavior: listWorkflows() twice → verify cache hit on second call
  - [ ] Test cache invalidation: createWorkflow() → listWorkflows() → verify cache miss
  - [ ] Target: 85%+ code coverage for integration tests

- [ ] **Task 18: Write integration tests for WorkflowExecutionEngine + Epic 10** (AC: #2.4, #2.5, #2.10)
  - [ ] Create `tests/integration/WorkflowExecutionEngine.integration.test.ts`
  - [ ] Use real Epic 10 WorkflowEngine (when available) or stub
  - [ ] Test end-to-end workflow execution with real step executors
  - [ ] Test Tool step with Epic 10 storage service (read/write file)
  - [ ] Test MCP step with real MCP server (or mock MCP server)
  - [ ] Test Prompt step with real LLM API (or mock LLM API)
  - [ ] Test multi-step workflow with variable passing between steps
  - [ ] Test conditional workflow (skip steps based on condition)
  - [ ] Test error workflow (onError='stop', 'skip', 'retry')
  - [ ] Verify execution trace saved correctly
  - [ ] Target: 85%+ code coverage for integration tests

## Dev Notes

### Epic 10 Integration (Critical Dependency)

**BLOCKING DEPENDENCY**: This story depends on Epic 10 (Portable Workflow Engine) for execution infrastructure. Epic 10 provides:

1. **WorkflowEngine.execute()**: Core execution engine that runs workflow steps
2. **StorageService**: File access abstraction (URLs, not paths) for tool executors
3. **CapabilityEnforcer**: Sandboxing and security enforcement
4. **AIClient**: Embedded LLM client for prompt executors

**Integration Points:**
- WorkflowExecutionEngine delegates to Epic 10's engine for actual step execution
- ToolExecutor uses Epic 10's StorageService for filesystem operations (`storage.readFile(url)`, `storage.writeFile(url, data)`)
- PromptExecutor may use Epic 10's AIClient for LLM calls
- Capability enforcement happens in Epic 10, not in this story

**Mitigation if Epic 10 Not Ready:**
- Develop WorkflowService CRUD operations independently (no Epic 10 dependency)
- Create mock/stub Epic 10 interfaces for WorkflowExecutionEngine development
- Design WorkflowExecutionEngine with clear Epic 10 integration points
- Replace mocks with real Epic 10 components when available

### Architecture Alignment

**Multi-Process Electron Pattern** (ARCH §1):
- WorkflowService runs in Main process (Node.js APIs available)
- WorkflowExecutionEngine runs in Main process (access to filesystem, network)
- Renderer communicates via IPC (`workflow:*` channels)

**IPC Communication Pattern** (ARCH §2):
- Channel naming: `workflow:{action}` (e.g., `workflow:list`, `workflow:execute`)
- Request/response pattern: `ipcRenderer.invoke()` → Main handler → service → repository → response
- Event broadcasting: Main → `webContents.send('workflow:progress')` → Renderer listeners

**Moku API Integration** (ARCH §3):
- WorkflowService wraps Moku API calls (Spring Boot backend)
- All workflow persistence via REST endpoints (`/api/workflows/*`)
- JWT authentication for RBAC enforcement

**Caching Strategy** (ARCH §4):
- LRU cache with 10min TTL (600 seconds)
- Max 500 workflows cached
- Cache invalidation on mutations (create, update, delete)
- Target >80% cache hit rate

### Data Models and TypeScript Interfaces

**Key Interfaces** (tech-spec §4.2):

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
  deletedAt?: Date;
  executionCount: number;
  lastExecutedAt?: Date;
}

interface WorkflowDefinition {
  inputs: WorkflowInput[];
  steps: WorkflowStep[];
  outputs: WorkflowOutput[];
  capabilities: string[]; // Epic 10 capability model
}

interface WorkflowStep {
  id: string;
  name: string;
  type: 'tool' | 'mcp' | 'prompt';
  order: number;
  condition?: string; // Conditional execution (Intermediate tier)
  config: ToolStepConfig | MCPStepConfig | PromptStepConfig;
  onError: 'stop' | 'skip' | 'retry';
  maxRetries?: number;
}

interface ExecutionContext {
  workflowId: string;
  executionId: string;
  userId: string;
  inputs: Record<string, unknown>; // User-provided inputs
  variables: Record<string, unknown>; // Step outputs (e.g., { step1: { output: {...} } })
  userContext: { userId: string; jwt: string }; // RBAC context
  workingDirectory: string; // Storage URL (Epic 10 integration)
}

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
```

### Workflow Execution Flow (tech-spec §4.4)

**High-Level Flow:**
1. User clicks "Execute Workflow" in UI
2. Renderer: ExecuteWorkflowDialog collects inputs
3. IPC: `ipcRenderer.invoke('workflow:execute', workflowId, inputs)`
4. Main: WorkflowService.executeWorkflow()
5. Main: Creates execution record in Moku API
6. Main: WorkflowExecutionEngine.execute() (Epic 10 integration)
7. Main: Runs steps sequentially (ToolExecutor, MCPExecutor, PromptExecutor)
8. Main: Emits progress events (`workflow:progress`) to renderer
9. Main: Saves execution trace to Moku API
10. IPC: Returns execution result to renderer
11. Renderer: Displays final outputs

**Step Execution Detail:**
```
For each step (sorted by step.order):
  1. Evaluate condition (if present) → skip if false
  2. Resolve step inputs (replace {{variables}} from context)
  3. Execute step via appropriate executor:
     - Tool step → ToolExecutor.execute(config, context)
     - MCP step → MCPExecutor.execute(config, context)
     - Prompt step → PromptExecutor.execute(config, context)
  4. Store step output in context.variables[stepId]
  5. Emit progress event (workflow:progress)
  6. Handle errors per step.onError setting (stop/skip/retry)
```

### Variable Resolution Pattern (tech-spec §4.2)

**Supported Syntax:**
- `{{inputs.name}}` - User-provided input
- `{{step1.output}}` - Step output (entire object)
- `{{step1.output.field}}` - Nested field access
- `{{step2.output.items[0].name}}` - Array indexing (future)

**Resolution Algorithm:**
1. Find all `{{variable}}` patterns in template
2. Parse variable path (split by '.')
3. Traverse context object: context[part1][part2][...]
4. Replace {{variable}} with resolved value
5. Throw error if variable not found

**Error Handling:**
- Missing variable → throw descriptive error (e.g., "Variable not found: step5.output")
- Type mismatch → coerce to string or throw error (configurable)
- Circular reference → detect and throw error

### Error Handling Strategies (tech-spec §4.4)

**onError Settings:**
1. **stop** (default): Halt execution immediately, mark execution as failed
2. **skip**: Log warning, continue to next step
3. **retry**: Retry step up to `maxRetries` times with exponential backoff (1s, 2s, 4s)

**Retry Logic:**
```typescript
let retries = 0;
while (retries < step.maxRetries) {
  try {
    const output = await executor.execute(step.config, context);
    return output; // Success
  } catch (error) {
    retries++;
    if (retries >= step.maxRetries) {
      // Apply onError='stop' behavior
      throw error;
    }
    // Exponential backoff: 2^retries seconds
    await sleep(Math.pow(2, retries) * 1000);
  }
}
```

### Progress Events and Real-Time Updates (AC-2.9)

**Event Structure:**
```typescript
webContents.send('workflow:progress', {
  executionId: string,
  step: { stepId: string, stepName: string },
  status: 'queued' | 'running' | 'completed' | 'failed' | 'skipped',
  output?: unknown,
  error?: string,
  timestamp: Date
});
```

**Emission Points:**
- Before step execution: status='running'
- After step execution: status='completed' or 'failed'
- On conditional skip: status='skipped'
- Execution start/end: special events for overall workflow

**Renderer Handling:**
- Listen: `ipcRenderer.on('workflow:progress', (event, data) => { ... })`
- Update UI: ExecuteWorkflowDialog updates step status indicators
- Highlight current step, show checkmarks for completed steps

### Security Considerations (tech-spec §5.2)

**RBAC Enforcement:**
- Workflows inherit user's JWT token and RBAC permissions
- Epic 10's CapabilityEnforcer checks user role before allowing write operations
- WorkflowService passes userContext to execution engine

**Capability-Based Sandboxing** (Epic 10 integration):
- Workflows declare required capabilities (e.g., `filesystem:read`, `network:https:github.com`)
- User must approve capabilities before execution
- Epic 10 enforces capabilities at runtime

**Input Validation:**
- Validate workflow inputs against type schema before execution
- Sanitize user-provided inputs to prevent injection attacks
- Validate workflow definition before save (required fields, circular dependencies)

**Storage Abstraction** (Epic 10 integration):
- No direct filesystem access - all file operations via storage service
- Prevents path traversal attacks
- Storage service returns URLs, not file paths

### Performance Optimizations (tech-spec §5.1)

**Caching:**
- Workflow definitions cached with 10min TTL
- LRU eviction when cache exceeds 500 workflows
- Cache invalidation on mutations (create, update, delete)
- Target >80% cache hit rate

**Progress Event Debouncing:**
- Emit progress events at most once per 500ms
- Prevents UI thrashing during fast step execution
- Use lodash.debounce or custom debounce utility

**Parallel Execution** (future enhancement, not MVP):
- MVP: Sequential execution only
- Post-MVP: Support parallel step execution (step groups)

### Testing Strategy (tech-spec §6)

**Unit Tests (Vitest):**
- WorkflowService: CRUD operations, caching, cache invalidation (90%+ coverage)
- WorkflowExecutionEngine: Step execution, variable resolution, error handling (85%+ coverage)
- Step Executors: ToolExecutor, MCPExecutor, PromptExecutor (85%+ coverage)
- VariableResolver: Edge cases (missing variables, nested access, multiple variables)

**Integration Tests (Vitest):**
- WorkflowService + Moku API: Real HTTP calls, workflow persistence
- WorkflowExecutionEngine + Epic 10: Real step execution with Epic 10 engine
- End-to-end workflow execution: Multi-step workflow with variable passing

**Mock Strategy:**
- Mock Moku API client for unit tests (use Vitest vi.mock)
- Mock Epic 10 components for unit tests (WorkflowEngine, StorageService, AIClient)
- Use real Epic 10 components for integration tests

### Observability and Logging (tech-spec §5.4)

**Required Logs:**
- `[WorkflowService] Created workflow ${workflowId} by user ${userId}`
- `[WorkflowExecutionEngine] Starting execution ${executionId} for workflow ${workflowId}`
- `[StepExecutor] Executing step ${stepId} (${stepType})`
- `[StepExecutor] Step ${stepId} completed in ${durationMs}ms`
- `[WorkflowExecutionEngine] Execution ${executionId} failed: ${errorMessage}`

**Audit Events:**
- workflow_start: { workflowId, executionId, userId, inputs, timestamp }
- step_start: { workflowId, executionId, stepId, stepName, timestamp }
- step_complete: { workflowId, executionId, stepId, status, output, durationMs, timestamp }
- workflow_complete: { workflowId, executionId, outputs, durationMs, timestamp }
- workflow_failed: { workflowId, executionId, error, failedStepId, durationMs, timestamp }

**Execution Trace:**
- Saved to Moku API in `workflow_executions.execution_trace` JSONB column
- Includes step-by-step details: inputs, outputs, duration, errors
- Used for debugging, replay, and audit

### Project Structure Notes

**New Files Created:**
- `src/services/WorkflowService.ts` - Main workflow service (CRUD, execution orchestration)
- `src/services/WorkflowExecutionEngine.ts` - Workflow execution engine (step orchestration)
- `src/executors/ToolExecutor.ts` - Tool step executor (native tools)
- `src/executors/MCPExecutor.ts` - MCP step executor (MCP servers)
- `src/executors/PromptExecutor.ts` - Prompt step executor (LLM calls)
- `src/cache/WorkflowCache.ts` - LRU cache for workflow definitions
- `src/utils/variableResolver.ts` - Variable resolution utility ({{variable}} syntax)
- `src/ipc-handlers/workflow.ts` - IPC handlers for workflow operations (or add to `main.ts`)

**Modified Files:**
- `src/main.ts` - Register IPC handlers for workflow operations
- `src/preload.ts` - Expose workflow IPC API to renderer (if not already exposed)

**Test Files:**
- `tests/unit/services/WorkflowService.test.ts`
- `tests/unit/services/WorkflowExecutionEngine.test.ts`
- `tests/unit/executors/ToolExecutor.test.ts`
- `tests/unit/executors/MCPExecutor.test.ts`
- `tests/unit/executors/PromptExecutor.test.ts`
- `tests/unit/utils/variableResolver.test.ts`
- `tests/integration/WorkflowService.integration.test.ts`
- `tests/integration/WorkflowExecutionEngine.integration.test.ts`

### References

**Tech Spec Sections:**
- §4.1 Services and Modules - WorkflowService, WorkflowExecutionEngine, Step Executors
- §4.2 Data Models and Contracts - Workflow interfaces, TypeScript types
- §4.3 APIs and Interfaces - Moku API endpoints, Desktop IPC API
- §4.4 Workflows and Sequencing - Execution flows, step execution, variable resolution
- §5.1 Performance - Caching, debouncing, optimization targets
- §5.2 Security - RBAC, capability sandboxing, input validation
- §5.4 Observability - Logging, audit events, execution trace

**Architecture References:**
- ARCH §1: Multi-process Electron architecture (Main handles execution, Renderer handles UI)
- ARCH §2: IPC communication pattern (`workflow:*` channels)
- ARCH §3: Moku API integration (Spring Boot backend)
- ARCH §4: Caching strategy (LRU, 10min TTL)

**Epic Dependencies:**
- Epic 10: Portable Workflow Engine (BLOCKING - provides execution infrastructure)
- Epic 1: Database & API Foundation (completed - provides Moku API infrastructure)
- Epic 3: Project Collaboration (completed - provides RBAC, project context)

**External Documentation:**
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md]
- [Source: docs/epics-and-stories-2025-11-25.md#E7-S2]
- [Source: docs/architecture.md]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e7-s2-workflow-service-execution-engine-desktop.context.xml

- docs/sprint-artifacts/e7-s2-workflow-service-execution-engine-desktop.context.xml



### Agent Model Used

<!-- Agent model name and version will be added here during implementation -->

### Debug Log References

<!-- Links to debug logs will be added here during implementation -->

### Completion Notes List

<!-- Completion notes will be added here by dev agent during implementation -->

### File List

<!-- Files created/modified/deleted will be listed here by dev agent during implementation -->

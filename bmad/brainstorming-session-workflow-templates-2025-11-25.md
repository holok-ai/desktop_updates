# Brainstorming Session Results

**Session Date:** 2025-11-25
**Facilitator:** BMad Brainstorming Facilitator
**Participant:** Peter

## Session Start

**Approach Selected:** Direct Design (building on orchestrator session)

**Topic:** Workflow Template and Storage Design

**Rationale:** Workflow templates are a core component identified in the Tool Orchestrator session. This session defines the data model, storage schema, and API for managing reusable workflows.

## Executive Summary

**Session Goals:** Design the workflow template system including data model, relational storage schema, and Moku API endpoints.

**Context from Previous Sessions:**
- Workflows are first-class citizens (from orchestrator session)
- Natural language → workflow → reusable tool → shared asset
- Storage decision: Relational DB for workflow templates (from file storage session)
- Audit logs captured by Holo for LLM calls, but tool/MCP/script calls need capture too

**Key Outcomes:**
- Unified workflow model (template + instance in one entity)
- Unified audit event table (Holo + Desktop events)
- 13 API endpoints for workflow and audit management
- PostgreSQL schema with versioning support

### Key Themes Identified:

1. **Unified Model** - Workflow and WorkflowTemplate are the same entity with `isTemplate` flag
2. **Scoped Ownership** - Personal or project scope (marketplace later for org/public)
3. **Versioning** - Edits create new versions, users choose to adopt
4. **Unified Audit** - Single table for all execution events (Holo LLM + Desktop tool/MCP/script)
5. **JWT Authentication** - All APIs use existing JWT pattern from Desktop ↔ Moku/Holo

## Architecture

### Platform Integration

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW SYSTEM ARCHITECTURE                      │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                        DESKTOP                               │    │
│  │                                                               │    │
│  │  • Create/edit workflows                                     │    │
│  │  • Execute workflows                                          │    │
│  │  • Write audit events (tool, MCP, script)                    │    │
│  └──────────────────────┬────────────────────────────────────────┘    │
│                         │ JWT Auth                                   │
│           ┌─────────────┴─────────────┐                             │
│           │                           │                             │
│           ▼                           ▼                             │
│  ┌─────────────────┐        ┌─────────────────┐                    │
│  │      MOKU       │        │      HOLO       │                    │
│  │                 │        │                 │                    │
│  │ • Workflow CRUD │        │ • LLM proxy     │                    │
│  │ • Execution mgmt│        │ • Write audit   │                    │
│  │ • Audit API     │        │   (llm events)  │                    │
│  └────────┬────────┘        └────────┬────────┘                    │
│           │                          │                              │
│           └──────────┬───────────────┘                              │
│                      │                                               │
│                      ▼                                               │
│           ┌─────────────────────┐                                   │
│           │   POSTGRESQL        │                                   │
│           │                     │                                   │
│           │ • workflows         │                                   │
│           │ • workflow_executions│                                  │
│           │ • audit_events      │                                   │
│           └─────────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Audit Event Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    UNIFIED AUDIT SYSTEM                              │
│                                                                      │
│  What Holo captures:                What Desktop captures:           │
│  ───────────────────                ──────────────────────           │
│  • llm_request                      • tool_call / tool_result        │
│  • llm_response                     • mcp_call / mcp_result          │
│                                     • script_exec / script_result    │
│                                     • workflow_start                 │
│                                     • workflow_step_start            │
│                                     • workflow_step_complete         │
│                                     • workflow_complete              │
│                                     • workflow_failed                │
│                                     • workflow_cancelled             │
│                                                                      │
│  All events linked by: executionId + threadId + userId              │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    audit_events table                        │    │
│  │  • Single table, flexible JSONB payload                      │    │
│  │  • source: 'holo' | 'desktop'                                │    │
│  │  • Query by execution, thread, user, project, type          │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Model

### Workflow (Unified Template + Instance)

```typescript
interface Workflow {
  id: string;                          // GUID

  // Identity & Scope
  name: string;                        // "Code Review for Ticket"
  description?: string;
  scope: 'personal' | 'project';
  ownerId: string;                     // userId (personal) or projectId (project)
  createdBy: string;                   // userId who created

  // Template vs Instance
  isTemplate: boolean;                 // true = reusable template
  forkedFrom?: string;                 // workflowId if forked from another

  // Versioning (for templates)
  version: number;                     // increments on edit
  isLatest: boolean;                   // true for current version
  previousVersionId?: string;          // links version chain

  // Definition
  parameters: WorkflowParameter[];     // inputs when running
  steps: WorkflowStep[];               // the plan

  // Metadata
  createdAt: string;                   // ISO8601
  updatedAt: string;
  tags?: string[];                     // for search/categorization
}

interface WorkflowParameter {
  name: string;                        // "ticketId"
  type: 'string' | 'number' | 'boolean' | 'file' | 'selection';
  description?: string;
  required: boolean;
  defaultValue?: unknown;
  options?: string[];                  // for 'selection' type
}

interface WorkflowStep {
  id: string;                          // step identifier
  order: number;                       // execution order
  name: string;                        // "Lookup ticket"
  type: 'tool' | 'mcp' | 'prompt' | 'condition' | 'parallel';

  // What to execute
  toolId?: string;                     // for type='tool'
  mcpServer?: string;                  // for type='mcp'
  mcpCommand?: string;
  promptTemplate?: string;             // for type='prompt'

  // Input/Output
  inputs: Record<string, string>;      // param mappings: { "ticket": "{{ticketId}}" }
  outputVariable?: string;             // store result as variable

  // Flow control
  condition?: string;                  // for type='condition'
  parallelSteps?: WorkflowStep[];      // for type='parallel'
  onError?: 'stop' | 'skip' | 'retry';

  // Safety (from orchestrator session)
  isReversible: boolean;
  requiresConfirmation?: boolean;
}
```

### Workflow Execution

```typescript
interface WorkflowExecution {
  id: string;                          // GUID
  workflowId: string;                  // template being executed
  workflowVersion: number;             // version at time of execution

  // Context
  userId: string;                      // who ran it
  threadId: string;                    // conversation thread
  projectId?: string;                  // if project-scoped

  // Runtime
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  parameterValues: Record<string, unknown>;
  currentStepId?: string;

  // Timing
  startedAt: string;
  completedAt?: string;

  // Error tracking
  errorMessage?: string;
  errorStepId?: string;
}
```

### Audit Event

```typescript
interface AuditEvent {
  id: string;                          // GUID

  // Context
  executionId?: string;                // workflow execution (if part of workflow)
  threadId: string;                    // conversation thread
  requestId?: string;                  // specific request within thread
  userId: string;                      // who triggered it
  projectId?: string;                  // if project-scoped

  // Event identity
  timestamp: string;                   // ISO8601
  source: 'holo' | 'desktop';          // who wrote this event
  type: AuditEventType;

  // Flexible payload
  payload: Record<string, unknown>;    // JSONB - varies by type
}

type AuditEventType =
  // Holo events (existing)
  | 'llm_request'
  | 'llm_response'
  // Desktop events (new)
  | 'tool_call'
  | 'tool_result'
  | 'mcp_call'
  | 'mcp_result'
  | 'script_exec'
  | 'script_result'
  | 'workflow_start'
  | 'workflow_step_start'
  | 'workflow_step_complete'
  | 'workflow_complete'
  | 'workflow_failed'
  | 'workflow_cancelled';
```

### Audit Payload Examples

```typescript
// tool_call
{
  toolId: "file-tool",
  function: "readFile",
  inputs: { path: "/src/main.ts" },
  isReversible: true
}

// tool_result
{
  toolId: "file-tool",
  function: "readFile",
  success: true,
  output: { content: "...", size: 1234 },
  durationMs: 45
}

// mcp_call
{
  server: "github-mcp",
  command: "getPullRequest",
  inputs: { repo: "holokai/desktop", pr: 202 }
}

// workflow_start
{
  workflowId: "abc-123",
  workflowName: "Code Review",
  workflowVersion: 3,
  parameters: { ticketId: "HOLO-202", repository: "desktop" }
}

// workflow_step_complete
{
  stepId: "step-1",
  stepName: "Lookup ticket",
  status: "completed",
  durationMs: 1250,
  output: { ticketTitle: "Fix login bug", branch: "fix/login" }
}

// workflow_complete
{
  workflowId: "abc-123",
  status: "completed",
  totalSteps: 6,
  completedSteps: 6,
  durationMs: 12340
}
```

## PostgreSQL Schema

```sql
-- ============================================
-- WORKFLOW TEMPLATES
-- ============================================

CREATE TABLE workflows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity & Scope
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  scope           VARCHAR(20) NOT NULL CHECK (scope IN ('personal', 'project')),
  owner_id        UUID NOT NULL,
  created_by      UUID NOT NULL,

  -- Template vs Instance
  is_template     BOOLEAN NOT NULL DEFAULT false,
  forked_from     UUID REFERENCES workflows(id),

  -- Versioning
  version         INTEGER NOT NULL DEFAULT 1,
  is_latest       BOOLEAN NOT NULL DEFAULT true,
  previous_version_id UUID REFERENCES workflows(id),

  -- Definition (JSONB for flexibility)
  parameters      JSONB NOT NULL DEFAULT '[]',
  steps           JSONB NOT NULL DEFAULT '[]',

  -- Metadata
  tags            TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflows_owner ON workflows(owner_id);
CREATE INDEX idx_workflows_scope ON workflows(scope);


-- ============================================
-- AUDIT EVENTS (unified)
-- ============================================

CREATE TABLE audit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  execution_id    UUID,
  thread_id       UUID NOT NULL,
  request_id      UUID,
  user_id         UUID NOT NULL,
  project_id      UUID,

  -- Event identity
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source          VARCHAR(20) NOT NULL CHECK (source IN ('holo', 'desktop')),
  type            VARCHAR(50) NOT NULL,

  -- Flexible payload
  payload         JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_audit_thread ON audit_events(thread_id);
CREATE INDEX idx_audit_execution ON audit_events(execution_id) WHERE execution_id IS NOT NULL;


-- ============================================
-- WORKFLOW EXECUTIONS
-- ============================================

CREATE TABLE workflow_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What's being executed
  workflow_id     UUID NOT NULL REFERENCES workflows(id),
  workflow_version INTEGER NOT NULL,

  -- Context
  user_id         UUID NOT NULL,
  thread_id       UUID NOT NULL,
  project_id      UUID,

  -- Status
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'paused',
                                    'completed', 'failed', 'cancelled')),

  -- Runtime data
  parameter_values JSONB NOT NULL DEFAULT '{}',
  current_step_id  VARCHAR(100),

  -- Timing
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,

  -- Error tracking
  error_message   TEXT,
  error_step_id   VARCHAR(100)
);

CREATE INDEX idx_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_executions_user ON workflow_executions(user_id);
```

## API Endpoints (Moku)

**Base URL:** `https://moku.holokai.com/v1`

**Authentication:** All endpoints require JWT in header:
```
Authorization: Bearer <jwt>
```

### Workflow Templates

| # | Endpoint | Method | Purpose |
|---|----------|--------|---------|
| 1 | `/workflows` | POST | Create workflow |
| 2 | `/workflows` | GET | List workflows (personal + project) |
| 3 | `/workflows/{id}` | GET | Get workflow by ID |
| 4 | `/workflows/{id}` | PUT | Update workflow (creates new version) |
| 5 | `/workflows/{id}` | DELETE | Delete workflow |
| 6 | `/workflows/{id}/fork` | POST | Fork workflow as new |
| 7 | `/workflows/{id}/versions` | GET | List versions of a workflow |

### Workflow Executions

| # | Endpoint | Method | Purpose |
|---|----------|--------|---------|
| 8 | `/workflows/{id}/execute` | POST | Start execution |
| 9 | `/executions/{id}` | GET | Get execution status |
| 10 | `/executions/{id}/cancel` | POST | Cancel execution |
| 11 | `/executions` | GET | List executions |

### Audit Events

| # | Endpoint | Method | Purpose |
|---|----------|--------|---------|
| 12 | `/audit/events` | POST | Write audit event (Desktop) |
| 13 | `/audit/events` | GET | Query audit events |

### Endpoint Details

#### POST /workflows - Create Workflow

```
Body:
{
  "name": "Code Review",
  "description": "Review code for a ticket",
  "scope": "project",
  "ownerId": "project-guid",
  "isTemplate": true,
  "parameters": [
    { "name": "ticketId", "type": "string", "required": true }
  ],
  "steps": [
    {
      "id": "step-1",
      "order": 1,
      "name": "Lookup ticket",
      "type": "mcp",
      "mcpServer": "github-mcp",
      "mcpCommand": "getIssue",
      "inputs": { "issueId": "{{ticketId}}" },
      "outputVariable": "ticketInfo",
      "isReversible": true
    }
  ],
  "tags": ["code-review", "github"]
}

Response 201: { "id": "guid", "version": 1, ... }
```

#### GET /workflows - List Workflows

```
Query params:
  scope: "personal" | "project"
  projectId: UUID (required if scope=project)
  isTemplate: boolean
  tags: string (comma-separated)
  limit: number (default 50)
  cursor: string

Response 200: { "workflows": [...], "nextCursor": "..." }
```

#### PUT /workflows/{id} - Update (New Version)

```
Body:
{
  "name": "Code Review v2",
  "parameters": [...],
  "steps": [...]
}

Response 200: { "id": "guid", "version": 4, "previousVersionId": "...", ... }
```

#### POST /workflows/{id}/fork - Fork Workflow

```
Body:
{
  "name": "My Code Review",
  "scope": "personal"
}

Response 201: { "id": "new-guid", "forkedFrom": "original-guid", "version": 1, ... }
```

#### POST /workflows/{id}/execute - Start Execution

```
Body:
{
  "threadId": "thread-guid",
  "projectId": "project-guid",
  "parameters": {
    "ticketId": "HOLO-202"
  }
}

Response 201: { "executionId": "exec-guid", "status": "pending", ... }
```

#### POST /audit/events - Write Audit Event

```
Body:
{
  "executionId": "exec-guid",
  "threadId": "thread-guid",
  "type": "tool_call",
  "payload": {
    "toolId": "file-tool",
    "function": "readFile",
    "inputs": { "path": "/src/main.ts" }
  }
}

Response 201: { "id": "event-guid", "timestamp": "..." }

Note: source="desktop" and userId set automatically from JWT
```

#### GET /audit/events - Query Events

```
Query params:
  executionId: UUID
  threadId: UUID
  projectId: UUID
  type: string (comma-separated)
  source: "holo" | "desktop"
  from: ISO8601
  to: ISO8601
  limit: number (default 100)
  cursor: string

Response 200: { "events": [...], "nextCursor": "..." }
```

## Key Decisions Summary

| Decision | Value |
|----------|-------|
| Data model | Unified (workflow + template in one entity) |
| Template scope | Personal or Project (marketplace later) |
| Versioning | Yes - edits create new versions |
| Forking | Yes - copy as new unique workflow |
| Audit storage | Single unified table (Holo + Desktop events) |
| Audit payload | Flexible JSONB per event type |
| Storage location | Moku (PostgreSQL) |
| Authentication | JWT (existing pattern) |
| API count | 13 endpoints |

## Action Planning

### Top 3 Priority Ideas

#### #1 Priority: PostgreSQL Schema

- **Rationale:** Foundation for all workflow features
- **Next steps:**
  1. Create migrations for workflows table
  2. Create migrations for workflow_executions table
  3. Create migrations for audit_events table (or extend existing)
  4. Test JSONB queries for parameters/steps
- **Resources needed:**
  - Moku database access
  - Migration tooling

#### #2 Priority: Workflow CRUD API

- **Rationale:** Enables Desktop to create and manage workflows
- **Next steps:**
  1. Implement POST /workflows
  2. Implement GET /workflows (list with filters)
  3. Implement GET /workflows/{id}
  4. Implement PUT /workflows/{id} (versioning logic)
  5. Implement DELETE /workflows/{id}
  6. Implement POST /workflows/{id}/fork
  7. Implement GET /workflows/{id}/versions
- **Resources needed:**
  - Moku API framework
  - JWT validation middleware

#### #3 Priority: Audit Event API

- **Rationale:** Enables complete execution tracking
- **Next steps:**
  1. Implement POST /audit/events
  2. Implement GET /audit/events (query with filters)
  3. Coordinate with Holo team on unified table
  4. Test event correlation by executionId
- **Resources needed:**
  - Coordination with Holo team
  - Audit table access

## Reflection and Follow-up

### What Worked Well

- Building on orchestrator session provided clear requirements
- Unified model (workflow + template) simplifies the system
- Single audit table avoids fragmentation

### Areas for Further Exploration

1. **Execution engine** - How Desktop actually runs workflow steps
2. **Plan preview UI** - Show plan before execution (from orchestrator session)
3. **Undo capability** - Using isReversible metadata

### Questions That Emerged

1. How does Desktop handle long-running workflow executions?
2. Should there be workflow execution timeouts?
3. How to handle partial failures (some steps succeed, then one fails)?

### Next Session Planning

- **Suggested topic:** Tool Orchestrator Implementation - wire up Desktop components
- **Preparation needed:** Review orchestrator session priorities

---

## Relationship to Other Sessions

| Session | Relationship |
|---------|--------------|
| Tool Orchestrator | Workflows are the core value prop; this defines storage |
| File Storage | Separate concern; files use Storage Service, workflows use Moku DB |

---

_Session facilitated using the BMAD CIS brainstorming framework_

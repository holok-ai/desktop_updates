# PostgreSQL Database Schema

**Date:** 2025-11-25
**Version:** 2.0
**Status:** Database Specification
**Purpose:** Consolidated database schema for Holokai Desktop Phase 2

## Document Overview

This document consolidates all PostgreSQL schema definitions required for Holokai Desktop, including:
- Thread management with message branching
- Project collaboration with member roles
- Workflow templates and execution
- Insights and reporting

**Source Documents:**
- `moku-api-specification-2025-11-25.md`
- `thread-management-requirements-2025-11-25.md`
- `project-requirements-2025-11-25.md`
- `thread-loading-caching-requirements-2025-11-25.md`
- `ai/MOKU-API-FOR-DESKTOP.md` (Phase 1 baseline)

---

## 1. Schema Overview

### 1.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA OVERVIEW                             │
│                                                                              │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │    users    │◄────────│  projects   │◄────────│  project_   │           │
│  │  (existing) │ created │             │  has    │  members    │           │
│  └──────┬──────┘   by    └──────┬──────┘         └─────────────┘           │
│         │                       │                                           │
│         │ owns                  │ contains                                  │
│         ▼                       ▼                                           │
│  ┌─────────────┐         ┌─────────────┐                                   │
│  │  desktop_   │◄────────│  desktop_   │                                   │
│  │  threads    │         │  threads    │                                   │
│  │ (personal)  │         │  (project)  │                                   │
│  └──────┬──────┘         └──────┬──────┘                                   │
│         │                       │                                           │
│         │ contains              │ contains                                  │
│         ▼                       ▼                                           │
│  ┌─────────────────────────────────────────┐                               │
│  │            desktop_messages              │                               │
│  │  (with branching: parent_message_id)    │                               │
│  └─────────────────────────────────────────┘                               │
│                                                                              │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │  workflows  │────────►│  workflow_  │         │   saved_    │           │
│  │             │ creates │ executions  │         │   reports   │           │
│  └─────────────┘         └─────────────┘         └─────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Table Summary

| Table | Purpose | New/Updated |
|-------|---------|-------------|
| `users` | User accounts (existing) | Existing |
| `organizations` | Organization accounts (existing) | Existing |
| `desktop_threads` | Conversation threads | Updated |
| `desktop_messages` | Thread messages with branching | Updated |
| `projects` | Project containers | New |
| `project_members` | Project membership and roles | New |
| `workflows` | Workflow definitions and templates | New |
| `workflow_executions` | Workflow execution history | New |
| `saved_reports` | User-saved report configurations | New |

---

## 2. Core Tables

### 2.1 desktop_threads

Stores conversation threads for both personal and project contexts.

```sql
CREATE TABLE desktop_threads (
    -- Primary Key
    id UUID PRIMARY KEY,

    -- User Association
    user_id UUID NOT NULL,

    -- Thread Metadata
    title VARCHAR(255) NOT NULL DEFAULT '',
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',

    -- Ownership (Phase 2)
    type VARCHAR(20) NOT NULL DEFAULT 'personal',
    owner_id UUID NOT NULL,
    project_id UUID,
    created_by UUID NOT NULL,

    -- Flexible Metadata
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT desktop_threads_status_check
        CHECK (status IN ('active', 'archived', 'deleted')),
    CONSTRAINT desktop_threads_type_check
        CHECK (type IN ('personal', 'project')),
    CONSTRAINT desktop_threads_project_consistency
        CHECK (
            (type = 'personal' AND project_id IS NULL) OR
            (type = 'project' AND project_id IS NOT NULL)
        ),

    -- Foreign Keys
    CONSTRAINT fk_desktop_threads_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_desktop_threads_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_desktop_threads_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_desktop_threads_user_id
    ON desktop_threads(user_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_desktop_threads_project_id
    ON desktop_threads(project_id)
    WHERE project_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_desktop_threads_type
    ON desktop_threads(type)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_desktop_threads_status
    ON desktop_threads(status)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_desktop_threads_updated_at
    ON desktop_threads(updated_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_desktop_threads_owner_id
    ON desktop_threads(owner_id)
    WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE desktop_threads IS 'Conversation threads for desktop application (personal and project)';
COMMENT ON COLUMN desktop_threads.id IS 'Unique thread identifier (UUID v4, desktop-generated)';
COMMENT ON COLUMN desktop_threads.user_id IS 'User who owns this thread (for personal) or created it (for project)';
COMMENT ON COLUMN desktop_threads.title IS 'Thread title (auto-generated after 2nd exchange, max 50 chars)';
COMMENT ON COLUMN desktop_threads.description IS 'Optional thread description';
COMMENT ON COLUMN desktop_threads.status IS 'Thread status: active, archived, or deleted';
COMMENT ON COLUMN desktop_threads.type IS 'Thread ownership type: personal or project';
COMMENT ON COLUMN desktop_threads.owner_id IS 'Owner ID - user_id for personal, project_id for project';
COMMENT ON COLUMN desktop_threads.project_id IS 'Project association (NULL for personal threads)';
COMMENT ON COLUMN desktop_threads.created_by IS 'User who created the thread';
COMMENT ON COLUMN desktop_threads.metadata IS 'Flexible metadata: model, settings, etc.';
COMMENT ON COLUMN desktop_threads.created_at IS 'Thread creation timestamp';
COMMENT ON COLUMN desktop_threads.updated_at IS 'Last update timestamp';
COMMENT ON COLUMN desktop_threads.deleted_at IS 'Soft delete timestamp (NULL if not deleted)';
```

### 2.2 desktop_messages

Provides tree structure metadata for displaying branched conversations. Works in conjunction with llm_requests and llm_responses tables to reconstruct conversation threads with branches.

**Purpose:** Desktop_messages contains records ONLY for user requests that are part of branches, enabling the UI to visualize and navigate branch structures. The actual request/response content is stored in llm_requests/llm_responses tables. Linear conversations (no branches) do not require desktop_messages records.

**Relationship to llm_requests:**
- `request_id`: Links to the specific llm_request for THIS message's content
- `branch_point_request_id`: Links to the llm_request where branches diverge (identifies branch location)
- `parent_message_id`: Creates the chain within a branch (null for first message in branch)
- `branch_index`: Distinguishes sibling branches (0-10)

```sql
CREATE TABLE desktop_messages (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Thread Association
    thread_id UUID NOT NULL,

    -- LLM Request References
    request_id UUID,
    branch_point_request_id UUID,

    -- Branching Structure
    parent_message_id UUID,
    branch_index INTEGER NOT NULL DEFAULT 0,
    branch_type VARCHAR(50) NOT NULL DEFAULT 'prompt_variation',
    is_closed BOOLEAN NOT NULL DEFAULT false,

    -- Ownership
    created_user_id UUID NOT NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Audit fields
    created_by VARCHAR(255),
    last_modified_by VARCHAR(255),

    -- Constraints
    CONSTRAINT desktop_messages_branch_check
        CHECK (branch_index >= 0 AND branch_index <= 10),

    -- Foreign Keys
    CONSTRAINT fk_desktop_messages_thread
        FOREIGN KEY (thread_id) REFERENCES desktop_threads(id) ON DELETE CASCADE,
    CONSTRAINT fk_desktop_messages_parent
        FOREIGN KEY (parent_message_id) REFERENCES desktop_messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_desktop_messages_request
        FOREIGN KEY (request_id) REFERENCES llm_requests(id) ON DELETE SET NULL,
    CONSTRAINT fk_desktop_messages_branch_point
        FOREIGN KEY (branch_point_request_id) REFERENCES llm_requests(id) ON DELETE SET NULL,
    CONSTRAINT fk_desktop_messages_created_user
        FOREIGN KEY (created_user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_desktop_messages_thread_id
    ON desktop_messages(thread_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_desktop_messages_request
    ON desktop_messages(request_id)
    WHERE request_id IS NOT NULL;

CREATE INDEX idx_desktop_messages_branch_point
    ON desktop_messages(branch_point_request_id)
    WHERE branch_point_request_id IS NOT NULL;

CREATE INDEX idx_desktop_messages_parent
    ON desktop_messages(parent_message_id)
    WHERE parent_message_id IS NOT NULL;

CREATE INDEX idx_desktop_messages_branch
    ON desktop_messages(thread_id, branch_index)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_desktop_messages_created_at
    ON desktop_messages(thread_id, created_at ASC)
    WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE desktop_messages IS 'Branch structure metadata for reconstructing conversation trees. Only contains user requests in branches. Content stored in llm_requests/llm_responses.';
COMMENT ON COLUMN desktop_messages.id IS 'Unique desktop_message identifier (UUID v4), generated on record creation';
COMMENT ON COLUMN desktop_messages.thread_id IS 'Parent thread reference';
COMMENT ON COLUMN desktop_messages.request_id IS 'Links to llm_requests.id - the specific request for THIS message';
COMMENT ON COLUMN desktop_messages.branch_point_request_id IS 'Links to llm_requests.id - the request where branches diverge (identifies branch location in conversation)';
COMMENT ON COLUMN desktop_messages.parent_message_id IS 'Links to previous desktop_messages.id in branch chain (NULL for first message in branch)';
COMMENT ON COLUMN desktop_messages.branch_index IS 'Distinguishes sibling branches: 0-10';
COMMENT ON COLUMN desktop_messages.branch_type IS 'Type of branch: prompt_variation, model_comparison, etc.';
COMMENT ON COLUMN desktop_messages.is_closed IS 'Whether this branch has been closed/converged';
COMMENT ON COLUMN desktop_messages.created_user_id IS 'User who created this branch';
COMMENT ON COLUMN desktop_messages.created_at IS 'Branch message creation timestamp';
COMMENT ON COLUMN desktop_messages.updated_at IS 'Last update timestamp';
COMMENT ON COLUMN desktop_messages.deleted_at IS 'Soft delete timestamp';
```

---

## 3. Project Tables

### 3.1 projects

Project containers for collaborative work.

```sql
CREATE TABLE projects (
    -- Primary Key
    id UUID PRIMARY KEY,

    -- Project Info
    name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Ownership
    created_by UUID NOT NULL,
    organization_id UUID,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active',

    -- Flexible Metadata
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT projects_status_check
        CHECK (status IN ('active', 'archived', 'deleted')),
    CONSTRAINT projects_name_not_empty
        CHECK (length(trim(name)) > 0),

    -- Foreign Keys
    CONSTRAINT fk_projects_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_projects_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_projects_created_by
    ON projects(created_by)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_projects_organization
    ON projects(organization_id)
    WHERE organization_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_projects_status
    ON projects(status)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_projects_updated_at
    ON projects(updated_at DESC)
    WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE projects IS 'Project containers for collaborative work';
COMMENT ON COLUMN projects.id IS 'Unique project identifier (UUID v4)';
COMMENT ON COLUMN projects.name IS 'Project name (max 200 chars)';
COMMENT ON COLUMN projects.description IS 'Project description';
COMMENT ON COLUMN projects.created_by IS 'User who created the project';
COMMENT ON COLUMN projects.organization_id IS 'Optional organization association';
COMMENT ON COLUMN projects.status IS 'Project status: active, archived, deleted';
COMMENT ON COLUMN projects.metadata IS 'Flexible metadata: color, icon, tags, settings';
COMMENT ON COLUMN projects.created_at IS 'Project creation timestamp';
COMMENT ON COLUMN projects.updated_at IS 'Last update timestamp';
COMMENT ON COLUMN projects.deleted_at IS 'Soft delete timestamp';
```

### 3.2 project_members

Project membership with role-based access control.

```sql
CREATE TABLE project_members (
    -- Primary Key
    id UUID PRIMARY KEY,

    -- Project Association
    project_id UUID NOT NULL,

    -- Member Target (one of user_id or organization_id)
    user_id UUID,
    organization_id UUID,

    -- Role
    role VARCHAR(20) NOT NULL,

    -- Audit
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Optional Expiration
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT project_members_role_check
        CHECK (role IN ('view', 'edit', 'admin')),
    CONSTRAINT project_members_target_check
        CHECK (
            (user_id IS NOT NULL AND organization_id IS NULL) OR
            (user_id IS NULL AND organization_id IS NOT NULL)
        ),

    -- Unique constraints (prevent duplicate memberships)
    CONSTRAINT project_members_unique_user
        UNIQUE (project_id, user_id),
    CONSTRAINT project_members_unique_org
        UNIQUE (project_id, organization_id),

    -- Foreign Keys
    CONSTRAINT fk_project_members_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_members_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_members_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_members_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_project_members_project
    ON project_members(project_id);

CREATE INDEX idx_project_members_user
    ON project_members(user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX idx_project_members_organization
    ON project_members(organization_id)
    WHERE organization_id IS NOT NULL;

CREATE INDEX idx_project_members_expires
    ON project_members(expires_at)
    WHERE expires_at IS NOT NULL;

-- Comments
COMMENT ON TABLE project_members IS 'Project membership with role-based access';
COMMENT ON COLUMN project_members.id IS 'Unique membership identifier';
COMMENT ON COLUMN project_members.project_id IS 'Project reference';
COMMENT ON COLUMN project_members.user_id IS 'Individual user member (mutually exclusive with organization_id)';
COMMENT ON COLUMN project_members.organization_id IS 'Organization-wide membership (mutually exclusive with user_id)';
COMMENT ON COLUMN project_members.role IS 'Member role: view, edit, or admin';
COMMENT ON COLUMN project_members.created_by IS 'User who granted membership';
COMMENT ON COLUMN project_members.created_at IS 'Membership creation timestamp';
COMMENT ON COLUMN project_members.expires_at IS 'Optional membership expiration';
```

---

## 4. Workflow Tables

### 4.1 workflows

Workflow definitions and templates.

```sql
CREATE TABLE workflows (
    -- Primary Key
    id UUID PRIMARY KEY,

    -- Workflow Info
    name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Scope and Ownership
    scope VARCHAR(20) NOT NULL,
    owner_id UUID NOT NULL,
    project_id UUID,

    -- Template Settings
    is_template BOOLEAN NOT NULL DEFAULT false,
    version INTEGER NOT NULL DEFAULT 1,
    parent_id UUID,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'draft',

    -- Workflow Definition
    definition JSONB NOT NULL,

    -- Audit
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT workflows_scope_check
        CHECK (scope IN ('personal', 'project')),
    CONSTRAINT workflows_status_check
        CHECK (status IN ('draft', 'active', 'archived')),
    CONSTRAINT workflows_scope_project_consistency
        CHECK (
            (scope = 'personal' AND project_id IS NULL) OR
            (scope = 'project' AND project_id IS NOT NULL)
        ),
    CONSTRAINT workflows_version_positive
        CHECK (version > 0),
    CONSTRAINT workflows_name_not_empty
        CHECK (length(trim(name)) > 0),

    -- Foreign Keys
    CONSTRAINT fk_workflows_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_workflows_parent
        FOREIGN KEY (parent_id) REFERENCES workflows(id) ON DELETE SET NULL,
    CONSTRAINT fk_workflows_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_workflows_owner
    ON workflows(owner_id);

CREATE INDEX idx_workflows_project
    ON workflows(project_id)
    WHERE project_id IS NOT NULL;

CREATE INDEX idx_workflows_template
    ON workflows(is_template)
    WHERE is_template = true;

CREATE INDEX idx_workflows_status
    ON workflows(status);

CREATE INDEX idx_workflows_parent
    ON workflows(parent_id)
    WHERE parent_id IS NOT NULL;

CREATE INDEX idx_workflows_updated_at
    ON workflows(updated_at DESC);

-- Comments
COMMENT ON TABLE workflows IS 'Workflow definitions and templates';
COMMENT ON COLUMN workflows.id IS 'Unique workflow identifier';
COMMENT ON COLUMN workflows.name IS 'Workflow name';
COMMENT ON COLUMN workflows.description IS 'Workflow description';
COMMENT ON COLUMN workflows.scope IS 'Workflow scope: personal or project';
COMMENT ON COLUMN workflows.owner_id IS 'Owner ID - user_id for personal, project_id for project';
COMMENT ON COLUMN workflows.project_id IS 'Project association (NULL for personal workflows)';
COMMENT ON COLUMN workflows.is_template IS 'True if this workflow is a reusable template';
COMMENT ON COLUMN workflows.version IS 'Workflow version number (incremented on updates)';
COMMENT ON COLUMN workflows.parent_id IS 'Parent workflow if forked from another';
COMMENT ON COLUMN workflows.status IS 'Workflow status: draft, active, archived';
COMMENT ON COLUMN workflows.definition IS 'Workflow definition: inputs, steps, outputs';
COMMENT ON COLUMN workflows.created_by IS 'User who created the workflow';
COMMENT ON COLUMN workflows.created_at IS 'Workflow creation timestamp';
COMMENT ON COLUMN workflows.updated_at IS 'Last update timestamp';
```

### 4.2 workflow_executions

Workflow execution history and results.

```sql
CREATE TABLE workflow_executions (
    -- Primary Key
    id UUID PRIMARY KEY,

    -- Workflow Association
    workflow_id UUID NOT NULL,
    thread_id UUID,

    -- Executor
    executed_by UUID NOT NULL,

    -- Execution Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    -- Input/Output
    inputs JSONB,
    outputs JSONB,
    step_results JSONB,

    -- Error Handling
    error TEXT,

    -- Timing
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms BIGINT,

    -- Constraints
    CONSTRAINT executions_status_check
        CHECK (status IN ('pending', 'running', 'success', 'failed', 'cancelled')),
    CONSTRAINT executions_duration_positive
        CHECK (duration_ms IS NULL OR duration_ms >= 0),
    CONSTRAINT executions_completed_requires_duration
        CHECK (
            (completed_at IS NULL AND duration_ms IS NULL) OR
            (completed_at IS NOT NULL)
        ),

    -- Foreign Keys
    CONSTRAINT fk_executions_workflow
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    CONSTRAINT fk_executions_thread
        FOREIGN KEY (thread_id) REFERENCES desktop_threads(id) ON DELETE SET NULL,
    CONSTRAINT fk_executions_executed_by
        FOREIGN KEY (executed_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_executions_workflow
    ON workflow_executions(workflow_id);

CREATE INDEX idx_executions_thread
    ON workflow_executions(thread_id)
    WHERE thread_id IS NOT NULL;

CREATE INDEX idx_executions_executed_by
    ON workflow_executions(executed_by);

CREATE INDEX idx_executions_status
    ON workflow_executions(status);

CREATE INDEX idx_executions_started_at
    ON workflow_executions(started_at DESC);

CREATE INDEX idx_executions_workflow_status
    ON workflow_executions(workflow_id, status);

-- Comments
COMMENT ON TABLE workflow_executions IS 'Workflow execution history and results';
COMMENT ON COLUMN workflow_executions.id IS 'Unique execution identifier';
COMMENT ON COLUMN workflow_executions.workflow_id IS 'Workflow being executed';
COMMENT ON COLUMN workflow_executions.thread_id IS 'Associated thread (optional)';
COMMENT ON COLUMN workflow_executions.executed_by IS 'User who initiated execution';
COMMENT ON COLUMN workflow_executions.status IS 'Execution status: pending, running, success, failed, cancelled';
COMMENT ON COLUMN workflow_executions.inputs IS 'Input values provided for execution';
COMMENT ON COLUMN workflow_executions.outputs IS 'Output values from completed execution';
COMMENT ON COLUMN workflow_executions.step_results IS 'Results from each workflow step';
COMMENT ON COLUMN workflow_executions.error IS 'Error message if execution failed';
COMMENT ON COLUMN workflow_executions.started_at IS 'Execution start timestamp';
COMMENT ON COLUMN workflow_executions.completed_at IS 'Execution completion timestamp';
COMMENT ON COLUMN workflow_executions.duration_ms IS 'Total execution duration in milliseconds';
```

---

## 5. Reporting Tables

### 5.1 saved_reports

User-saved report configurations for the Insights feature.

```sql
CREATE TABLE saved_reports (
    -- Primary Key
    id UUID PRIMARY KEY,

    -- User Association
    user_id UUID NOT NULL,

    -- Report Info
    name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Report Configuration
    config JSONB NOT NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT saved_reports_name_not_empty
        CHECK (length(trim(name)) > 0),

    -- Foreign Keys
    CONSTRAINT fk_saved_reports_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_saved_reports_user
    ON saved_reports(user_id);

CREATE INDEX idx_saved_reports_updated_at
    ON saved_reports(updated_at DESC);

-- Comments
COMMENT ON TABLE saved_reports IS 'User-saved report configurations';
COMMENT ON COLUMN saved_reports.id IS 'Unique report identifier';
COMMENT ON COLUMN saved_reports.user_id IS 'User who saved the report';
COMMENT ON COLUMN saved_reports.name IS 'Report name';
COMMENT ON COLUMN saved_reports.description IS 'Report description';
COMMENT ON COLUMN saved_reports.config IS 'Report configuration: type, dateRange, filters, groupBy, metrics';
COMMENT ON COLUMN saved_reports.created_at IS 'Report creation timestamp';
COMMENT ON COLUMN saved_reports.updated_at IS 'Last update timestamp';
```

---

## 6. JSONB Column Schemas

### 6.1 desktop_threads.metadata

```json
{
  "model": "claude-3-opus",
  "temperature": 0.7,
  "systemPrompt": "You are a helpful assistant...",
  "customField": "any value"
}
```

### 6.2 desktop_messages.attachments

```json
[
  {
    "fileId": "550e8400-e29b-41d4-a716-446655440000",
    "filename": "document.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 1048576,
    "uploadedBy": "user-uuid",
    "uploadedAt": "2025-11-25T10:00:00Z",
    "storageType": "remote"
  }
]
```

### 6.3 desktop_messages.metadata

```json
{
  "model": "claude-3-opus",
  "provider": "anthropic",
  "tokens": {
    "prompt": 150,
    "completion": 500,
    "total": 650
  },
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Note:** `requestId` is a UUID that references `llm_requests.request_id` in the Moku database. This FK relationship enables cost tracking, latency metrics, and LLM performance analytics from the `llm_requests` and `llm_responses` tables.

### 6.4 projects.metadata

```json
{
  "color": "#3b82f6",
  "icon": "folder",
  "tags": ["development", "ai"],
  "settings": {
    "defaultModel": "claude-3-opus",
    "maxStorageBytes": 5368709120,
    "maxThreads": 100
  }
}
```

### 6.5 workflows.definition

```json
{
  "inputs": [
    {
      "name": "brief",
      "type": "text",
      "required": true,
      "description": "Marketing brief"
    },
    {
      "name": "tone",
      "type": "select",
      "options": ["professional", "casual"],
      "default": "professional"
    }
  ],
  "steps": [
    {
      "id": "step-1",
      "name": "Analyze",
      "type": "llm",
      "config": {
        "model": "claude-3-opus",
        "prompt": "Analyze: {{brief}}"
      }
    },
    {
      "id": "step-2",
      "name": "Generate",
      "type": "llm",
      "dependsOn": ["step-1"],
      "config": {
        "model": "claude-3-opus",
        "prompt": "Based on {{step-1.output}}, generate {{tone}} content"
      }
    }
  ],
  "outputs": [
    {
      "name": "content",
      "source": "step-2.output"
    }
  ]
}
```

### 6.6 workflow_executions.step_results

```json
[
  {
    "stepId": "step-1",
    "status": "success",
    "output": "Analysis result...",
    "startedAt": 1732496400000,
    "completedAt": 1732496415000,
    "durationMs": 15000
  },
  {
    "stepId": "step-2",
    "status": "success",
    "output": "Generated content...",
    "startedAt": 1732496415000,
    "completedAt": 1732496445000,
    "durationMs": 30000
  }
]
```

### 6.7 saved_reports.config

```json
{
  "type": "activity",
  "dateRange": {
    "relative": "7d"
  },
  "filters": {
    "projectIds": ["project-uuid"],
    "models": ["claude-3-opus", "gpt-4"]
  },
  "groupBy": ["day", "model"],
  "metrics": ["prompts", "tokens", "threads"]
}
```

---

## 7. Views (Optional Performance Optimization)

### 7.1 Project Thread Summary View

```sql
CREATE OR REPLACE VIEW v_project_thread_summary AS
SELECT
    p.id AS project_id,
    p.name AS project_name,
    COUNT(DISTINCT t.id) AS thread_count,
    COUNT(DISTINCT m.id) AS message_count,
    MAX(t.updated_at) AS last_activity
FROM projects p
LEFT JOIN desktop_threads t ON t.project_id = p.id AND t.deleted_at IS NULL
LEFT JOIN desktop_messages m ON m.thread_id = t.id AND m.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name;

COMMENT ON VIEW v_project_thread_summary IS 'Aggregated thread and message counts per project';
```

### 7.2 User Project Access View

```sql
CREATE OR REPLACE VIEW v_user_project_access AS
SELECT
    pm.user_id,
    p.id AS project_id,
    p.name AS project_name,
    pm.role,
    p.status AS project_status
FROM project_members pm
JOIN projects p ON p.id = pm.project_id
WHERE p.deleted_at IS NULL
AND pm.user_id IS NOT NULL
AND (pm.expires_at IS NULL OR pm.expires_at > CURRENT_TIMESTAMP);

COMMENT ON VIEW v_user_project_access IS 'User project access with roles';
```

### 7.3 Workflow Execution Stats View

```sql
CREATE OR REPLACE VIEW v_workflow_execution_stats AS
SELECT
    w.id AS workflow_id,
    w.name AS workflow_name,
    COUNT(we.id) AS execution_count,
    COUNT(CASE WHEN we.status = 'success' THEN 1 END) AS success_count,
    COUNT(CASE WHEN we.status = 'failed' THEN 1 END) AS failed_count,
    ROUND(
        COUNT(CASE WHEN we.status = 'success' THEN 1 END)::NUMERIC /
        NULLIF(COUNT(we.id), 0) * 100, 2
    ) AS success_rate,
    ROUND(AVG(we.duration_ms)) AS avg_duration_ms,
    MAX(we.started_at) AS last_executed_at
FROM workflows w
LEFT JOIN workflow_executions we ON we.workflow_id = w.id
GROUP BY w.id, w.name;

COMMENT ON VIEW v_workflow_execution_stats IS 'Workflow execution statistics';
```

---

## 8. Flyway Migrations

### 8.1 Migration Strategy

Migrations are split into phases to support incremental deployment:

| Migration | Description | Phase |
|-----------|-------------|-------|
| V1.0 | Base users/orgs tables | Existing |
| V2.0 | Desktop threads/messages (Phase 1) | Existing |
| V2.1 | Update threads for Phase 2 | Phase 2 |
| V2.2 | Projects and members | Phase 2 |
| V2.3 | Workflows and executions | Phase 2 |
| V2.4 | Saved reports | Phase 2 |
| V2.5 | Views and functions | Phase 2 |

### 8.2 V2.1 - Update Threads for Phase 2

**File:** `V2.1__update_threads_phase2.sql`

```sql
-- ============================================================================
-- V2.1: Update desktop_threads for Phase 2
-- ============================================================================
-- Adds ownership columns for project support
-- ============================================================================

-- Add new columns
ALTER TABLE desktop_threads
    ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'personal',
    ADD COLUMN IF NOT EXISTS owner_id UUID,
    ADD COLUMN IF NOT EXISTS project_id UUID,
    ADD COLUMN IF NOT EXISTS created_by UUID;

-- Backfill existing data
UPDATE desktop_threads
SET
    owner_id = user_id,
    created_by = user_id
WHERE owner_id IS NULL;

-- Make columns NOT NULL after backfill
ALTER TABLE desktop_threads
    ALTER COLUMN owner_id SET NOT NULL,
    ALTER COLUMN created_by SET NOT NULL;

-- Add constraints
ALTER TABLE desktop_threads
    ADD CONSTRAINT desktop_threads_type_check
        CHECK (type IN ('personal', 'project')),
    ADD CONSTRAINT desktop_threads_project_consistency
        CHECK (
            (type = 'personal' AND project_id IS NULL) OR
            (type = 'project' AND project_id IS NOT NULL)
        );

-- Add foreign key (deferred until projects table exists)
-- Will be added in V2.2

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_desktop_threads_project_id
    ON desktop_threads(project_id)
    WHERE project_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_desktop_threads_type
    ON desktop_threads(type)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_desktop_threads_owner_id
    ON desktop_threads(owner_id)
    WHERE deleted_at IS NULL;

-- Update messages for branching
ALTER TABLE desktop_messages
    ADD COLUMN IF NOT EXISTS parent_message_id UUID,
    ADD COLUMN IF NOT EXISTS branch_index INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS attachments JSONB;

ALTER TABLE desktop_messages
    ADD CONSTRAINT desktop_messages_branch_check
        CHECK (branch_index >= 0 AND branch_index <= 2),
    ADD CONSTRAINT fk_desktop_messages_parent
        FOREIGN KEY (parent_message_id) REFERENCES desktop_messages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_desktop_messages_parent
    ON desktop_messages(parent_message_id)
    WHERE parent_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_desktop_messages_branch
    ON desktop_messages(thread_id, branch_index)
    WHERE deleted_at IS NULL;

-- Comments
COMMENT ON COLUMN desktop_threads.type IS 'Thread ownership type: personal or project';
COMMENT ON COLUMN desktop_threads.owner_id IS 'Owner ID - user_id for personal, project_id for project';
COMMENT ON COLUMN desktop_threads.project_id IS 'Project association (NULL for personal threads)';
COMMENT ON COLUMN desktop_threads.created_by IS 'User who created the thread';
COMMENT ON COLUMN desktop_messages.parent_message_id IS 'Parent message for tree structure (NULL for root message)';
COMMENT ON COLUMN desktop_messages.branch_index IS 'Branch index: 0=original path, 1-2=retry branches';
COMMENT ON COLUMN desktop_messages.attachments IS 'File attachments array';
```

### 8.3 V2.2 - Projects and Members

**File:** `V2.2__create_projects_tables.sql`

```sql
-- ============================================================================
-- V2.2: Create projects and project_members tables
-- ============================================================================

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT projects_status_check CHECK (status IN ('active', 'archived', 'deleted')),
    CONSTRAINT projects_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX idx_projects_created_by ON projects(created_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_organization ON projects(organization_id) WHERE organization_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_projects_status ON projects(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_updated_at ON projects(updated_at DESC) WHERE deleted_at IS NULL;

-- Project members table
CREATE TABLE project_members (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT project_members_role_check CHECK (role IN ('view', 'edit', 'admin')),
    CONSTRAINT project_members_target_check CHECK (
        (user_id IS NOT NULL AND organization_id IS NULL) OR
        (user_id IS NULL AND organization_id IS NOT NULL)
    ),
    CONSTRAINT project_members_unique_user UNIQUE (project_id, user_id),
    CONSTRAINT project_members_unique_org UNIQUE (project_id, organization_id)
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_project_members_organization ON project_members(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_project_members_expires ON project_members(expires_at) WHERE expires_at IS NOT NULL;

-- Add foreign key from threads to projects (deferred from V2.1)
ALTER TABLE desktop_threads
    ADD CONSTRAINT fk_desktop_threads_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- Comments
COMMENT ON TABLE projects IS 'Project containers for collaborative work';
COMMENT ON TABLE project_members IS 'Project membership with role-based access';
```

### 8.4 V2.3 - Workflows and Executions

**File:** `V2.3__create_workflows_tables.sql`

```sql
-- ============================================================================
-- V2.3: Create workflows and workflow_executions tables
-- ============================================================================

-- Workflows table
CREATE TABLE workflows (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    scope VARCHAR(20) NOT NULL,
    owner_id UUID NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    is_template BOOLEAN NOT NULL DEFAULT false,
    version INTEGER NOT NULL DEFAULT 1,
    parent_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    definition JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT workflows_scope_check CHECK (scope IN ('personal', 'project')),
    CONSTRAINT workflows_status_check CHECK (status IN ('draft', 'active', 'archived')),
    CONSTRAINT workflows_scope_project_consistency CHECK (
        (scope = 'personal' AND project_id IS NULL) OR
        (scope = 'project' AND project_id IS NOT NULL)
    ),
    CONSTRAINT workflows_version_positive CHECK (version > 0),
    CONSTRAINT workflows_name_not_empty CHECK (length(trim(name)) > 0)
);

-- Add self-referential foreign key separately
ALTER TABLE workflows
    ADD CONSTRAINT fk_workflows_parent
        FOREIGN KEY (parent_id) REFERENCES workflows(id) ON DELETE SET NULL;

CREATE INDEX idx_workflows_owner ON workflows(owner_id);
CREATE INDEX idx_workflows_project ON workflows(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_workflows_template ON workflows(is_template) WHERE is_template = true;
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_parent ON workflows(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_workflows_updated_at ON workflows(updated_at DESC);

-- Workflow executions table
CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES desktop_threads(id) ON DELETE SET NULL,
    executed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    inputs JSONB,
    outputs JSONB,
    step_results JSONB,
    error TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms BIGINT,

    CONSTRAINT executions_status_check CHECK (status IN ('pending', 'running', 'success', 'failed', 'cancelled')),
    CONSTRAINT executions_duration_positive CHECK (duration_ms IS NULL OR duration_ms >= 0)
);

CREATE INDEX idx_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_executions_thread ON workflow_executions(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_executions_executed_by ON workflow_executions(executed_by);
CREATE INDEX idx_executions_status ON workflow_executions(status);
CREATE INDEX idx_executions_started_at ON workflow_executions(started_at DESC);
CREATE INDEX idx_executions_workflow_status ON workflow_executions(workflow_id, status);

-- Comments
COMMENT ON TABLE workflows IS 'Workflow definitions and templates';
COMMENT ON TABLE workflow_executions IS 'Workflow execution history and results';
```

### 8.5 V2.4 - Saved Reports

**File:** `V2.4__create_saved_reports_table.sql`

```sql
-- ============================================================================
-- V2.4: Create saved_reports table
-- ============================================================================

CREATE TABLE saved_reports (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT saved_reports_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX idx_saved_reports_user ON saved_reports(user_id);
CREATE INDEX idx_saved_reports_updated_at ON saved_reports(updated_at DESC);

COMMENT ON TABLE saved_reports IS 'User-saved report configurations';
```

### 8.6 V2.5 - Views and Functions

**File:** `V2.5__create_views_and_functions.sql`

```sql
-- ============================================================================
-- V2.5: Create views and utility functions
-- ============================================================================

-- Project thread summary view
CREATE OR REPLACE VIEW v_project_thread_summary AS
SELECT
    p.id AS project_id,
    p.name AS project_name,
    COUNT(DISTINCT t.id) AS thread_count,
    COUNT(DISTINCT m.id) AS message_count,
    MAX(t.updated_at) AS last_activity
FROM projects p
LEFT JOIN desktop_threads t ON t.project_id = p.id AND t.deleted_at IS NULL
LEFT JOIN desktop_messages m ON m.thread_id = t.id AND m.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name;

-- User project access view
CREATE OR REPLACE VIEW v_user_project_access AS
SELECT
    pm.user_id,
    p.id AS project_id,
    p.name AS project_name,
    pm.role,
    p.status AS project_status
FROM project_members pm
JOIN projects p ON p.id = pm.project_id
WHERE p.deleted_at IS NULL
AND pm.user_id IS NOT NULL
AND (pm.expires_at IS NULL OR pm.expires_at > CURRENT_TIMESTAMP);

-- Workflow execution stats view
CREATE OR REPLACE VIEW v_workflow_execution_stats AS
SELECT
    w.id AS workflow_id,
    w.name AS workflow_name,
    COUNT(we.id) AS execution_count,
    COUNT(CASE WHEN we.status = 'success' THEN 1 END) AS success_count,
    COUNT(CASE WHEN we.status = 'failed' THEN 1 END) AS failed_count,
    ROUND(
        COUNT(CASE WHEN we.status = 'success' THEN 1 END)::NUMERIC /
        NULLIF(COUNT(we.id), 0) * 100, 2
    ) AS success_rate,
    ROUND(AVG(we.duration_ms)) AS avg_duration_ms,
    MAX(we.started_at) AS last_executed_at
FROM workflows w
LEFT JOIN workflow_executions we ON we.workflow_id = w.id
GROUP BY w.id, w.name;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for auto-updating updated_at
CREATE TRIGGER tr_desktop_threads_updated_at
    BEFORE UPDATE ON desktop_threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_workflows_updated_at
    BEFORE UPDATE ON workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_saved_reports_updated_at
    BEFORE UPDATE ON saved_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON VIEW v_project_thread_summary IS 'Aggregated thread and message counts per project';
COMMENT ON VIEW v_user_project_access IS 'User project access with roles';
COMMENT ON VIEW v_workflow_execution_stats IS 'Workflow execution statistics';
COMMENT ON FUNCTION update_updated_at_column IS 'Auto-update updated_at timestamp on row update';
```

---

## 9. Verification Queries

### 9.1 Schema Verification

```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'desktop_threads',
    'desktop_messages',
    'projects',
    'project_members',
    'workflows',
    'workflow_executions',
    'saved_reports'
)
ORDER BY table_name;

-- Check all views exist
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name IN (
    'v_project_thread_summary',
    'v_user_project_access',
    'v_workflow_execution_stats'
);

-- Check column additions
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'desktop_threads'
AND column_name IN ('type', 'owner_id', 'project_id', 'created_by')
ORDER BY column_name;

-- Check branching columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'desktop_messages'
AND column_name IN ('parent_message_id', 'branch_index', 'attachments')
ORDER BY column_name;

-- Check indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN (
    'desktop_threads',
    'desktop_messages',
    'projects',
    'project_members',
    'workflows',
    'workflow_executions'
)
ORDER BY tablename, indexname;

-- Check constraints
SELECT conname, conrelid::regclass AS table_name, contype
FROM pg_constraint
WHERE conrelid::regclass::text IN (
    'desktop_threads',
    'desktop_messages',
    'projects',
    'project_members',
    'workflows',
    'workflow_executions'
)
ORDER BY conrelid::regclass::text, conname;

-- Check triggers
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

---

## 10. Key Decisions Summary

| Decision | Value |
|----------|-------|
| Primary keys | UUID v4 (desktop-generated where applicable) |
| Timestamps | `TIMESTAMP WITH TIME ZONE` for proper timezone handling |
| Soft deletes | `deleted_at` column pattern |
| Flexible metadata | JSONB columns for extensibility |
| Thread branching | `parent_message_id` + `branch_index` (0-2) |
| Thread ownership | `type` + `owner_id` pattern |
| Project access | Role-based via `project_members` |
| Workflow versioning | Integer version, `parent_id` for forks |
| Content limit | 32KB per message (enforced at DB level) |
| Auto-update timestamps | Database triggers |
| Cascade deletes | Foreign keys with `ON DELETE CASCADE` where appropriate |

---

_PostgreSQL Database Schema Specification - 2025-11-25_

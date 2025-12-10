# Moku API Specification for Desktop

**Date:** 2025-11-25
**Version:** 2.0
**Status:** API Specification
**Purpose:** Define complete Moku API backend for Holokai Desktop Phase 2

## Document Overview

This specification defines the complete Moku API (Spring Boot) implementation required to support:
- Thread management with message branching
- Project collaboration with member roles
- Workflow templates and execution
- Insights and reporting

**Supersedes:** `ai/MOKU-API-FOR-DESKTOP.md` (Phase 1)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MOKU API ARCHITECTURE                                │
│                                                                              │
│  Desktop App (Electron)                                                      │
│       ↓                                                                      │
│  HTTP Client (axios/fetch)                                                   │
│       ↓                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     MOKU API (Spring Boot)                           │    │
│  │                                                                       │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │                    CONTROLLER LAYER                          │    │    │
│  │  │  ThreadController │ ProjectController │ WorkflowController   │    │    │
│  │  │  InsightsController │ MemberController                       │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                              ↓                                       │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │                    SERVICE LAYER                             │    │    │
│  │  │  ThreadService │ ProjectService │ WorkflowService            │    │    │
│  │  │  InsightsService │ MemberService │ AuthorizationService      │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                              ↓                                       │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │                    REPOSITORY LAYER                          │    │    │
│  │  │  ThreadRepository │ MessageRepository │ ProjectRepository    │    │    │
│  │  │  MemberRepository │ WorkflowRepository │ ExecutionRepository │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                              ↓                                       │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │                    PostgreSQL                                │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. API Endpoints Summary

### 2.1 Thread Endpoints (`/api/threads`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/threads` | List threads for current user |
| GET | `/api/threads/{id}` | Get thread by ID |
| GET | `/api/threads/{id}/messages` | Get messages for thread |
| POST | `/api/threads` | Create new thread |
| PATCH | `/api/threads/{id}` | Update thread metadata |
| POST | `/api/threads/{id}/messages` | Append message to thread |
| POST | `/api/threads/{id}/move` | Move thread to/from project |
| POST | `/api/threads/{id}/generate-title` | Generate title from content |
| POST | `/api/threads/{id}/soft-delete` | Soft delete thread |
| DELETE | `/api/threads/{id}` | Permanently delete thread |

### 2.2 Project Endpoints (`/api/projects`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List user's projects |
| GET | `/api/projects/{id}` | Get project details |
| POST | `/api/projects` | Create project |
| PATCH | `/api/projects/{id}` | Update project |
| DELETE | `/api/projects/{id}` | Delete project (admin) |
| POST | `/api/projects/{id}/archive` | Archive project |
| POST | `/api/projects/{id}/restore` | Restore archived project |
| GET | `/api/projects/{id}/threads` | List project threads |
| GET | `/api/projects/{id}/workflows` | List project workflows |
| GET | `/api/projects/{id}/updates` | Check for updates since timestamp |

### 2.3 Member Endpoints (`/api/projects/{projectId}/members`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/{id}/members` | List project members |
| POST | `/api/projects/{id}/members` | Add member |
| PATCH | `/api/projects/{id}/members/{memberId}` | Update member role |
| DELETE | `/api/projects/{id}/members/{memberId}` | Remove member |

### 2.4 Workflow Endpoints (`/api/workflows`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workflows` | List workflows (personal + project) |
| GET | `/api/workflows/{id}` | Get workflow |
| POST | `/api/workflows` | Create workflow |
| PATCH | `/api/workflows/{id}` | Update workflow |
| DELETE | `/api/workflows/{id}` | Delete workflow |
| POST | `/api/workflows/{id}/fork` | Fork template |
| POST | `/api/workflows/{id}/execute` | Execute workflow |
| GET | `/api/workflows/{id}/executions` | List executions |
| GET | `/api/workflows/executions/{executionId}` | Get execution details |

### 2.5 Insights Endpoints (`/api/insights`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/insights/dashboard` | Dashboard summary |
| GET | `/api/insights/activity` | User activity metrics |
| GET | `/api/insights/topics` | Thread topic analysis |
| GET | `/api/insights/projects` | Project activity |
| GET | `/api/insights/workflows` | Workflow metrics |
| POST | `/api/insights/reports/run` | Run ad-hoc report |
| GET | `/api/insights/reports` | List saved reports |
| POST | `/api/insights/reports` | Save report configuration |
| DELETE | `/api/insights/reports/{id}` | Delete saved report |

---

## 3. Thread API Details

### 3.1 List Threads

```
GET /api/threads
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| type | string | all | `personal`, `project`, `all` |
| projectId | UUID | - | Filter by project |
| status | string | active | `active`, `archived`, `deleted` |
| page | int | 0 | Page number |
| size | int | 50 | Page size (max 100) |
| sort | string | updatedAt,desc | Sort field and direction |

**Response:**

```json
{
  "content": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Authentication Implementation",
      "type": "personal",
      "ownerId": "user-uuid",
      "projectId": null,
      "status": "active",
      "createdAt": 1732492800000,
      "updatedAt": 1732496400000,
      "metadata": {
        "model": "claude-3-opus"
      },
      "messageCount": 12,
      "branchCount": 2
    }
  ],
  "totalElements": 45,
  "totalPages": 1,
  "number": 0,
  "size": 50
}
```

### 3.2 Get Thread

```
GET /api/threads/{threadId}
```

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Authentication Implementation",
  "type": "personal",
  "ownerId": "user-uuid",
  "projectId": null,
  "createdBy": "user-uuid",
  "status": "active",
  "createdAt": 1732492800000,
  "updatedAt": 1732496400000,
  "metadata": {
    "model": "claude-3-opus"
  },
  "messages": [
    {
      "id": "msg-uuid-1",
      "threadId": "550e8400-e29b-41d4-a716-446655440000",
      "parentMessageId": null,
      "branchIndex": 0,
      "role": "user",
      "content": "How do I implement JWT authentication?",
      "createdAt": 1732492800000,
      "metadata": null,
      "attachments": []
    },
    {
      "id": "msg-uuid-2",
      "threadId": "550e8400-e29b-41d4-a716-446655440000",
      "parentMessageId": "msg-uuid-1",
      "branchIndex": 0,
      "role": "assistant",
      "content": "Here's how to implement JWT...",
      "createdAt": 1732492830000,
      "metadata": {
        "model": "claude-3-opus",
        "provider": "anthropic",
        "tokens": {
          "prompt": 25,
          "completion": 450,
          "total": 475
        }
      },
      "attachments": []
    }
  ]
}
```

### 3.3 Get Messages

```
GET /api/threads/{threadId}/messages
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| branchIndex | int | - | Filter by branch (optional) |
| fromMessageId | UUID | - | Get messages after this ID |

**Response:**

```json
{
  "messages": [
    {
      "id": "msg-uuid-1",
      "threadId": "thread-uuid",
      "parentMessageId": null,
      "branchIndex": 0,
      "role": "user",
      "content": "...",
      "createdAt": 1732492800000,
      "metadata": null,
      "attachments": []
    }
  ],
  "branchPoints": [
    {
      "messageId": "msg-uuid-3",
      "branches": [0, 1, 2]
    }
  ]
}
```

### 3.4 Create Thread

```
POST /api/threads
```

**Request:**

```json
{
  "title": "",
  "type": "personal",
  "projectId": null,
  "metadata": {
    "model": "claude-3-opus"
  }
}
```

**Response:** `201 Created` with ThreadDetailDTO

### 3.5 Append Message

```
POST /api/threads/{threadId}/messages
```

**Request:**

```json
{
  "parentMessageId": "msg-uuid-2",
  "branchIndex": 0,
  "role": "user",
  "content": "Can you explain the token validation?",
  "clientMessageId": "client-generated-uuid",
  "metadata": null,
  "attachments": [
    {
      "fileId": "file-uuid",
      "filename": "auth-flow.png",
      "mimeType": "image/png",
      "sizeBytes": 45000
    }
  ]
}
```

**Validation Rules:**
- `parentMessageId` required except for first message
- `branchIndex` must be 0-2
- Maximum 2 retry branches per parent (branchIndex 1 and 2)
- Content max 32KB
- `clientMessageId` for idempotency

**Response:**

```json
{
  "message": {
    "id": "new-msg-uuid",
    "threadId": "thread-uuid",
    "parentMessageId": "msg-uuid-2",
    "branchIndex": 0,
    "role": "user",
    "content": "Can you explain the token validation?",
    "createdAt": 1732496400000,
    "metadata": null,
    "attachments": [...]
  },
  "thread": {
    "id": "thread-uuid",
    "updatedAt": 1732496400000
  }
}
```

### 3.6 Move Thread

```
POST /api/threads/{threadId}/move
```

**Request:**

```json
{
  "targetType": "project",
  "targetProjectId": "project-uuid"
}
```

**Rules:**
- Personal → Project: User must have Edit role on target project
- Project → Personal: User must be thread creator or project admin
- Project → Project: User must be creator/admin on source, Edit on target

**Response:** Updated ThreadDetailDTO

### 3.7 Generate Title

```
POST /api/threads/{threadId}/generate-title
```

Called by Desktop after 2nd exchange. Moku stores the generated title.

**Response:**

```json
{
  "title": "JWT Authentication Implementation Guide"
}
```

---

## 4. Project API Details

### 4.1 List Projects

```
GET /api/projects
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | string | active | `active`, `archived`, `all` |
| role | string | - | Filter by user's role |

**Response:**

```json
{
  "projects": [
    {
      "id": "project-uuid",
      "name": "Q4 Marketing Campaign",
      "description": "AI-assisted marketing content",
      "createdBy": "user-uuid",
      "organizationId": null,
      "status": "active",
      "createdAt": 1732400000000,
      "updatedAt": 1732496400000,
      "metadata": {
        "color": "#3b82f6",
        "icon": "megaphone",
        "tags": ["marketing", "content"]
      },
      "myRole": "admin",
      "threadCount": 15,
      "workflowCount": 3,
      "memberCount": 4
    }
  ]
}
```

### 4.2 Get Project

```
GET /api/projects/{projectId}
```

**Response:**

```json
{
  "id": "project-uuid",
  "name": "Q4 Marketing Campaign",
  "description": "AI-assisted marketing content",
  "createdBy": "user-uuid",
  "organizationId": null,
  "status": "active",
  "createdAt": 1732400000000,
  "updatedAt": 1732496400000,
  "metadata": {
    "color": "#3b82f6",
    "icon": "megaphone",
    "tags": ["marketing", "content"],
    "settings": {
      "defaultModel": "claude-3-opus",
      "maxStorageBytes": 5368709120
    }
  },
  "myRole": "admin",
  "stats": {
    "threadCount": 15,
    "workflowCount": 3,
    "memberCount": 4,
    "storageUsedBytes": 1073741824,
    "lastActivity": 1732496400000
  }
}
```

### 4.3 Create Project

```
POST /api/projects
```

**Request:**

```json
{
  "name": "New Project",
  "description": "Project description",
  "organizationId": null,
  "metadata": {
    "color": "#10b981",
    "icon": "folder",
    "tags": ["development"],
    "settings": {
      "defaultModel": "claude-3-sonnet"
    }
  }
}
```

**Response:** `201 Created` with ProjectDetailDTO

Creator automatically added as `admin` member.

### 4.4 Update Project

```
PATCH /api/projects/{projectId}
```

**Request:**

```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "metadata": {
    "color": "#ef4444"
  }
}
```

**Authorization:** Admin only

### 4.5 Delete Project

```
DELETE /api/projects/{projectId}
```

**Authorization:** Admin only

Soft delete - sets `deletedAt` timestamp.

### 4.6 Archive/Restore Project

```
POST /api/projects/{projectId}/archive
POST /api/projects/{projectId}/restore
```

**Authorization:** Admin only

### 4.7 Get Project Threads

```
GET /api/projects/{projectId}/threads
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | int | 0 | Page number |
| size | int | 50 | Page size |
| sort | string | updatedAt,desc | Sort |

**Authorization:** Any project member

### 4.8 Get Project Workflows

```
GET /api/projects/{projectId}/workflows
```

**Authorization:** Any project member

### 4.9 Check for Updates

```
GET /api/projects/{projectId}/updates
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| since | long | Yes | Epoch milliseconds |

**Response:**

```json
{
  "hasUpdates": true,
  "updatedThreads": ["thread-uuid-1", "thread-uuid-2"],
  "updatedWorkflows": [],
  "updatedMembers": false,
  "projectUpdated": false,
  "latestTimestamp": 1732496400000
}
```

Used by Desktop for polling-based cache invalidation.

---

## 5. Member API Details

### 5.1 List Members

```
GET /api/projects/{projectId}/members
```

**Response:**

```json
{
  "members": [
    {
      "id": "member-uuid",
      "projectId": "project-uuid",
      "userId": "user-uuid",
      "organizationId": null,
      "role": "admin",
      "createdBy": "creator-uuid",
      "createdAt": 1732400000000,
      "expiresAt": null,
      "user": {
        "id": "user-uuid",
        "email": "user@example.com",
        "name": "John Doe",
        "avatarUrl": "https://..."
      }
    }
  ]
}
```

### 5.2 Add Member

```
POST /api/projects/{projectId}/members
```

**Request:**

```json
{
  "userId": "user-uuid",
  "role": "edit",
  "expiresAt": null
}
```

Or for organization-wide access:

```json
{
  "organizationId": "org-uuid",
  "role": "view",
  "expiresAt": 1735689600000
}
```

**Authorization:** Admin only

### 5.3 Update Member Role

```
PATCH /api/projects/{projectId}/members/{memberId}
```

**Request:**

```json
{
  "role": "admin"
}
```

**Authorization:** Admin only

### 5.4 Remove Member

```
DELETE /api/projects/{projectId}/members/{memberId}
```

**Authorization:** Admin only

Cannot remove last admin.

---

## 6. Workflow API Details

### 6.1 List Workflows

```
GET /api/workflows
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| scope | string | all | `personal`, `project`, `all` |
| projectId | UUID | - | Filter by project |
| isTemplate | boolean | - | Filter templates only |
| status | string | active | `draft`, `active`, `archived` |

**Response:**

```json
{
  "workflows": [
    {
      "id": "workflow-uuid",
      "name": "Content Generator",
      "description": "Generate marketing content",
      "scope": "project",
      "ownerId": "project-uuid",
      "projectId": "project-uuid",
      "isTemplate": true,
      "version": 3,
      "parentId": null,
      "status": "active",
      "createdBy": "user-uuid",
      "createdAt": 1732400000000,
      "updatedAt": 1732496400000,
      "executionCount": 45,
      "lastExecutedAt": 1732496000000
    }
  ]
}
```

### 6.2 Get Workflow

```
GET /api/workflows/{workflowId}
```

**Response:**

```json
{
  "id": "workflow-uuid",
  "name": "Content Generator",
  "description": "Generate marketing content from brief",
  "scope": "project",
  "ownerId": "project-uuid",
  "projectId": "project-uuid",
  "isTemplate": true,
  "version": 3,
  "parentId": null,
  "status": "active",
  "createdBy": "user-uuid",
  "createdAt": 1732400000000,
  "updatedAt": 1732496400000,
  "definition": {
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
        "options": ["professional", "casual", "playful"],
        "default": "professional"
      }
    ],
    "steps": [
      {
        "id": "step-1",
        "name": "Analyze Brief",
        "type": "llm",
        "config": {
          "model": "claude-3-opus",
          "prompt": "Analyze this marketing brief: {{brief}}"
        }
      },
      {
        "id": "step-2",
        "name": "Generate Content",
        "type": "llm",
        "dependsOn": ["step-1"],
        "config": {
          "model": "claude-3-opus",
          "prompt": "Based on analysis: {{step-1.output}}, generate {{tone}} content"
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
}
```

### 6.3 Create Workflow

```
POST /api/workflows
```

**Request:**

```json
{
  "name": "New Workflow",
  "description": "Description",
  "scope": "personal",
  "projectId": null,
  "isTemplate": false,
  "definition": {
    "inputs": [...],
    "steps": [...],
    "outputs": [...]
  }
}
```

### 6.4 Fork Workflow

```
POST /api/workflows/{workflowId}/fork
```

**Request:**

```json
{
  "name": "My Content Generator",
  "scope": "personal",
  "projectId": null
}
```

Creates a copy with `parentId` set to original.

**Authorization:** Must have access to source workflow (View role minimum)

### 6.5 Execute Workflow

```
POST /api/workflows/{workflowId}/execute
```

**Request:**

```json
{
  "inputs": {
    "brief": "Create content for product launch...",
    "tone": "professional"
  },
  "threadId": "thread-uuid"
}
```

**Response:**

```json
{
  "executionId": "execution-uuid",
  "workflowId": "workflow-uuid",
  "status": "pending",
  "inputs": {...},
  "startedAt": 1732496400000
}
```

Execution runs asynchronously. Desktop polls for status or uses future WebSocket.

### 6.6 Get Execution

```
GET /api/workflows/executions/{executionId}
```

**Response:**

```json
{
  "id": "execution-uuid",
  "workflowId": "workflow-uuid",
  "status": "success",
  "inputs": {
    "brief": "...",
    "tone": "professional"
  },
  "outputs": {
    "content": "Generated marketing content..."
  },
  "stepResults": [
    {
      "stepId": "step-1",
      "status": "success",
      "output": "Brief analysis...",
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
  ],
  "error": null,
  "startedAt": 1732496400000,
  "completedAt": 1732496445000,
  "durationMs": 45000
}
```

### 6.7 List Executions

```
GET /api/workflows/{workflowId}/executions
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | string | - | Filter by status |
| page | int | 0 | Page number |
| size | int | 20 | Page size |

---

## 7. Insights API Details

### 7.1 Dashboard

```
GET /api/insights/dashboard
```

**Response:**

```json
{
  "summary": {
    "totalThreads": 156,
    "totalProjects": 8,
    "totalWorkflows": 23,
    "totalPrompts": 1250,
    "storageUsedBytes": 5368709120,
    "totalCost": 12.45,
    "totalTokens": 2450000
  },
  "recentActivity": {
    "today": {
      "prompts": 45,
      "threads": 3,
      "workflowExecutions": 5,
      "cost": 0.85,
      "tokens": 125000,
      "avgLatencyMs": 1250
    },
    "thisWeek": {
      "prompts": 280,
      "threads": 12,
      "workflowExecutions": 23,
      "cost": 5.20,
      "tokens": 875000,
      "avgLatencyMs": 1180
    }
  },
  "topModels": [
    {"model": "claude-3-opus", "count": 850, "cost": 8.50, "avgLatencyMs": 1400},
    {"model": "gpt-4", "count": 400, "cost": 3.95, "avgLatencyMs": 980}
  ],
  "activeProjects": [
    {"id": "project-uuid", "name": "Q4 Campaign", "activityCount": 45}
  ]
}
```

### 7.2 User Activity

```
GET /api/insights/activity
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| range | string | 7d | `24h`, `7d`, `30d`, `90d` |
| granularity | string | day | `hour`, `day`, `week` |

**Response:**

```json
{
  "range": "7d",
  "granularity": "day",
  "dataPoints": [
    {
      "timestamp": 1732320000000,
      "prompts": 42,
      "threads": 3,
      "tokensUsed": 125000,
      "cost": 0.75,
      "avgLatencyMs": 1200,
      "avgTimeToFirstTokenMs": 450
    }
  ],
  "totals": {
    "prompts": 280,
    "threads": 15,
    "tokensUsed": 875000,
    "totalCost": 5.20,
    "avgLatencyMs": 1180,
    "avgTimeToFirstTokenMs": 430
  }
}
```

### 7.3 Thread Topics

```
GET /api/insights/topics
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| range | string | 30d | Time range |
| limit | int | 20 | Max topics |

**Response:**

```json
{
  "topics": [
    {
      "topic": "Authentication",
      "threadCount": 12,
      "promptCount": 145,
      "keywords": ["jwt", "oauth", "session", "token"]
    },
    {
      "topic": "Database Design",
      "threadCount": 8,
      "promptCount": 89,
      "keywords": ["schema", "postgresql", "migration", "index"]
    }
  ]
}
```

### 7.4 Project Activity

```
GET /api/insights/projects
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| range | string | 30d | Time range |
| projectId | UUID | - | Specific project |

**Response:**

```json
{
  "projects": [
    {
      "projectId": "project-uuid",
      "projectName": "Q4 Campaign",
      "threadCount": 15,
      "promptCount": 234,
      "workflowExecutions": 45,
      "activeMembers": 3,
      "storageUsedBytes": 1073741824
    }
  ]
}
```

### 7.5 Workflow Metrics

```
GET /api/insights/workflows
```

**Response:**

```json
{
  "workflows": [
    {
      "workflowId": "workflow-uuid",
      "workflowName": "Content Generator",
      "executionCount": 45,
      "successRate": 0.93,
      "avgDurationMs": 42000,
      "lastExecuted": 1732496000000
    }
  ]
}
```

### 7.6 Run Report

```
POST /api/insights/reports/run
```

**Request:**

```json
{
  "type": "activity",
  "dateRange": {
    "start": 1730419200000,
    "end": 1732924800000
  },
  "filters": {
    "projectIds": ["project-uuid-1"],
    "models": ["claude-3-opus"]
  },
  "groupBy": ["day", "model"],
  "metrics": ["prompts", "tokens", "threads"]
}
```

**Response:**

```json
{
  "reportId": "report-uuid",
  "generatedAt": 1732496400000,
  "parameters": {...},
  "data": [
    {
      "date": "2024-11-25",
      "model": "claude-3-opus",
      "prompts": 45,
      "tokens": 125000,
      "threads": 3
    }
  ],
  "summary": {
    "totalPrompts": 280,
    "totalTokens": 875000,
    "totalThreads": 15
  }
}
```

### 7.7 Save Report

```
POST /api/insights/reports
```

**Request:**

```json
{
  "name": "Weekly Activity Report",
  "description": "Track weekly prompt usage",
  "config": {
    "type": "activity",
    "dateRange": {"relative": "7d"},
    "filters": {...},
    "groupBy": ["day"],
    "metrics": ["prompts", "tokens"]
  }
}
```

---

## 8. Entity Models

### 8.1 Thread Entity

```java
@Entity
@Table(name = "desktop_threads")
@Data
public class DesktopThread {
    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ThreadType type;  // PERSONAL, PROJECT

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;  // userId for personal, projectId for project

    @Column(name = "project_id")
    private UUID projectId;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ThreadStatus status;  // ACTIVE, ARCHIVED, DELETED

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
```

### 8.2 Message Entity

```java
@Entity
@Table(name = "desktop_messages")
@Data
public class DesktopMessage {
    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "thread_id", nullable = false)
    private UUID threadId;

    @Column(name = "parent_message_id")
    private UUID parentMessageId;  // null for first message

    @Column(name = "branch_index", nullable = false)
    private Integer branchIndex;  // 0=original, 1-2=retries

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private MessageRole role;  // USER, ASSISTANT, SYSTEM

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<FileAttachment> attachments;

    @Column(name = "client_message_id")
    private String clientMessageId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
```

### 8.3 Project Entity

```java
@Entity
@Table(name = "projects")
@Data
public class Project {
    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ProjectStatus status;  // ACTIVE, ARCHIVED, DELETED

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
```

### 8.4 Project Member Entity

```java
@Entity
@Table(name = "project_members")
@Data
public class ProjectMember {
    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private MemberRole role;  // VIEW, EDIT, ADMIN

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at")
    private Instant expiresAt;
}
```

### 8.5 Workflow Entity

```java
@Entity
@Table(name = "workflows")
@Data
public class Workflow {
    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private WorkflowScope scope;  // PERSONAL, PROJECT

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(name = "is_template", nullable = false)
    private Boolean isTemplate;

    @Column(nullable = false)
    private Integer version;

    @Column(name = "parent_id")
    private UUID parentId;  // forked from

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private WorkflowStatus status;  // DRAFT, ACTIVE, ARCHIVED

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private WorkflowDefinition definition;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
```

### 8.6 Workflow Execution Entity

```java
@Entity
@Table(name = "workflow_executions")
@Data
public class WorkflowExecution {
    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "workflow_id", nullable = false)
    private UUID workflowId;

    @Column(name = "thread_id")
    private UUID threadId;

    @Column(name = "executed_by", nullable = false)
    private UUID executedBy;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ExecutionStatus status;  // PENDING, RUNNING, SUCCESS, FAILED

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> inputs;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> outputs;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<StepResult> stepResults;

    @Column(columnDefinition = "TEXT")
    private String error;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "duration_ms")
    private Long durationMs;
}
```

---

## 9. Database Schema

### 9.1 Flyway Migration

**File:** `V2.0__desktop_phase2_tables.sql`

```sql
-- ============================================================================
-- Desktop Phase 2 Database Schema
-- ============================================================================
-- Creates tables for projects, members, workflows, and updates thread/message
-- ============================================================================

-- Update desktop_threads table
ALTER TABLE desktop_threads ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'personal';
ALTER TABLE desktop_threads ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE desktop_threads ADD COLUMN IF NOT EXISTS project_id UUID;
ALTER TABLE desktop_threads ADD COLUMN IF NOT EXISTS created_by UUID;

-- Set owner_id = user_id for existing rows
UPDATE desktop_threads SET owner_id = user_id WHERE owner_id IS NULL;
UPDATE desktop_threads SET created_by = user_id WHERE created_by IS NULL;

ALTER TABLE desktop_threads ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE desktop_threads ALTER COLUMN created_by SET NOT NULL;

ALTER TABLE desktop_threads ADD CONSTRAINT desktop_threads_type_check
    CHECK (type IN ('personal', 'project'));

CREATE INDEX IF NOT EXISTS idx_desktop_threads_project ON desktop_threads(project_id)
    WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_desktop_threads_type ON desktop_threads(type);

-- Update desktop_messages table for branching
ALTER TABLE desktop_messages ADD COLUMN IF NOT EXISTS parent_message_id UUID;
ALTER TABLE desktop_messages ADD COLUMN IF NOT EXISTS branch_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE desktop_messages ADD COLUMN IF NOT EXISTS attachments JSONB;

ALTER TABLE desktop_messages ADD CONSTRAINT desktop_messages_branch_check
    CHECK (branch_index >= 0 AND branch_index <= 2);

CREATE INDEX IF NOT EXISTS idx_desktop_messages_parent ON desktop_messages(parent_message_id)
    WHERE parent_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_desktop_messages_branch ON desktop_messages(thread_id, branch_index);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,

    CONSTRAINT projects_status_check CHECK (status IN ('active', 'archived', 'deleted'))
);

CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status) WHERE deleted_at IS NULL;

-- Project members table
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,

    CONSTRAINT project_members_role_check CHECK (role IN ('view', 'edit', 'admin')),
    CONSTRAINT project_members_target_check CHECK (
        (user_id IS NOT NULL AND organization_id IS NULL) OR
        (user_id IS NULL AND organization_id IS NOT NULL)
    ),
    CONSTRAINT project_members_unique_user UNIQUE (project_id, user_id),
    CONSTRAINT project_members_unique_org UNIQUE (project_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id) WHERE user_id IS NOT NULL;

-- Add foreign key from threads to projects
ALTER TABLE desktop_threads ADD CONSTRAINT fk_desktop_threads_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    scope VARCHAR(20) NOT NULL,
    owner_id UUID NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    is_template BOOLEAN NOT NULL DEFAULT false,
    version INTEGER NOT NULL DEFAULT 1,
    parent_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    definition JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT workflows_scope_check CHECK (scope IN ('personal', 'project')),
    CONSTRAINT workflows_status_check CHECK (status IN ('draft', 'active', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_workflows_owner ON workflows(owner_id);
CREATE INDEX IF NOT EXISTS idx_workflows_project ON workflows(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflows_template ON workflows(is_template) WHERE is_template = true;
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);

-- Workflow executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES desktop_threads(id) ON DELETE SET NULL,
    executed_by UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    inputs JSONB,
    outputs JSONB,
    step_results JSONB,
    error TEXT,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms BIGINT,

    CONSTRAINT executions_status_check CHECK (status IN ('pending', 'running', 'success', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_user ON workflow_executions(executed_by);
CREATE INDEX IF NOT EXISTS idx_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_started ON workflow_executions(started_at DESC);

-- Saved reports table
CREATE TABLE IF NOT EXISTS saved_reports (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saved_reports_user ON saved_reports(user_id);

-- Comments
COMMENT ON TABLE projects IS 'Project containers for collaborative work';
COMMENT ON TABLE project_members IS 'Project membership with role-based access';
COMMENT ON TABLE workflows IS 'Workflow definitions and templates';
COMMENT ON TABLE workflow_executions IS 'Workflow execution history';
COMMENT ON TABLE saved_reports IS 'User-saved report configurations';

COMMENT ON COLUMN desktop_threads.type IS 'Thread ownership type: personal or project';
COMMENT ON COLUMN desktop_threads.owner_id IS 'Owner ID - user_id for personal, project_id for project';
COMMENT ON COLUMN desktop_messages.parent_message_id IS 'Parent message for tree structure (null for root)';
COMMENT ON COLUMN desktop_messages.branch_index IS 'Branch index: 0=original, 1-2=retry branches';
```

### 9.2 Verification Queries

```sql
-- Verify tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('projects', 'project_members', 'workflows', 'workflow_executions', 'saved_reports');

-- Verify branching columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'desktop_messages'
AND column_name IN ('parent_message_id', 'branch_index', 'attachments');

-- Verify thread updates
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'desktop_threads'
AND column_name IN ('type', 'owner_id', 'project_id', 'created_by');
```

---

## 10. Authorization Service

### 10.1 Permission Checks

```java
@Service
@RequiredArgsConstructor
public class AuthorizationService {

    private final ProjectMemberRepository memberRepository;

    public MemberRole getUserRoleInProject(UUID userId, UUID projectId) {
        return memberRepository.findByProjectIdAndUserId(projectId, userId)
            .map(ProjectMember::getRole)
            .orElseThrow(() -> new AccessDeniedException("Not a member of project"));
    }

    public void requireProjectAccess(UUID userId, UUID projectId) {
        getUserRoleInProject(userId, projectId);  // throws if not member
    }

    public void requireProjectRole(UUID userId, UUID projectId, MemberRole... allowedRoles) {
        MemberRole role = getUserRoleInProject(userId, projectId);
        if (!Arrays.asList(allowedRoles).contains(role)) {
            throw new AccessDeniedException("Insufficient permissions");
        }
    }

    public void requireThreadAccess(UUID userId, DesktopThread thread) {
        if (thread.getType() == ThreadType.PERSONAL) {
            if (!thread.getUserId().equals(userId)) {
                throw new AccessDeniedException("Not owner of thread");
            }
        } else {
            requireProjectAccess(userId, thread.getProjectId());
        }
    }

    public void requireThreadModify(UUID userId, DesktopThread thread) {
        if (thread.getType() == ThreadType.PERSONAL) {
            if (!thread.getUserId().equals(userId)) {
                throw new AccessDeniedException("Not owner of thread");
            }
        } else {
            MemberRole role = getUserRoleInProject(userId, thread.getProjectId());
            if (role == MemberRole.VIEW) {
                throw new AccessDeniedException("View role cannot modify threads");
            }
            // Edit can modify own threads, Admin can modify any
            if (role == MemberRole.EDIT && !thread.getCreatedBy().equals(userId)) {
                throw new AccessDeniedException("Can only modify own threads");
            }
        }
    }

    public void requireThreadDelete(UUID userId, DesktopThread thread) {
        if (thread.getType() == ThreadType.PERSONAL) {
            if (!thread.getUserId().equals(userId)) {
                throw new AccessDeniedException("Not owner of thread");
            }
        } else {
            MemberRole role = getUserRoleInProject(userId, thread.getProjectId());
            if (role != MemberRole.ADMIN && !thread.getCreatedBy().equals(userId)) {
                throw new AccessDeniedException("Only admin or creator can delete");
            }
        }
    }
}
```

### 10.2 Permission Matrix

| Action | Personal Thread | Project Thread (View) | Project Thread (Edit) | Project Thread (Admin) |
|--------|-----------------|----------------------|----------------------|------------------------|
| Read | Owner only | ✓ | ✓ | ✓ |
| Prompt | Owner only | ✓ | ✓ | ✓ |
| Create | Owner only | ✗ | ✓ | ✓ |
| Edit own | Owner only | ✗ | ✓ | ✓ |
| Edit any | Owner only | ✗ | ✗ | ✓ |
| Delete own | Owner only | ✗ | ✓ | ✓ |
| Delete any | Owner only | ✗ | ✗ | ✓ |

---

## 11. Error Responses

### 11.1 Error Format

```json
{
  "timestamp": 1732496400000,
  "status": 400,
  "error": "Bad Request",
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    {
      "field": "content",
      "message": "Content exceeds maximum length of 32768 characters"
    }
  ],
  "path": "/api/threads/123/messages"
}
```

### 11.2 Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INVALID_BRANCH` | 400 | Branch index invalid or limit exceeded |
| `MESSAGE_TOO_LARGE` | 400 | Content exceeds 32KB |
| `UNAUTHORIZED` | 401 | Authentication required |
| `TOKEN_EXPIRED` | 401 | JWT expired |
| `ACCESS_DENIED` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `IDEMPOTENT_REQUEST` | 200 | Request already processed (returns existing) |
| `INTERNAL_ERROR` | 500 | Server error |

---

## 12. Implementation Checklist

### 12.1 Phase 1 Updates (Thread Branching)

- [ ] Add `parent_message_id`, `branch_index`, `attachments` to desktop_messages
- [ ] Add `type`, `owner_id`, `project_id`, `created_by` to desktop_threads
- [ ] Update `AppendMessageRequestDTO` for branching
- [ ] Add branch validation (max 2 retries per parent)
- [ ] Add `POST /api/threads/{id}/generate-title` endpoint
- [ ] Update thread list to include `branchCount`

### 12.2 Phase 2: Projects

- [ ] Create `projects` table
- [ ] Create `project_members` table
- [ ] Implement `ProjectController`
- [ ] Implement `ProjectService`
- [ ] Implement `ProjectMemberController`
- [ ] Implement `AuthorizationService`
- [ ] Add project-scoped thread queries
- [ ] Add `GET /api/projects/{id}/updates` endpoint

### 12.3 Phase 2: Workflows

- [ ] Create `workflows` table
- [ ] Create `workflow_executions` table
- [ ] Implement `WorkflowController`
- [ ] Implement `WorkflowService`
- [ ] Implement workflow fork logic
- [ ] Implement execution engine integration
- [ ] Add execution status polling

### 12.4 Phase 2: Insights

- [ ] Create `saved_reports` table
- [ ] Implement `InsightsController`
- [ ] Implement `InsightsService`
- [ ] Add dashboard aggregation queries
- [ ] Add activity metrics queries
- [ ] Add topic analysis (may require external service)
- [ ] Implement report runner

---

## 13. Key Decisions Summary

| Decision | Value |
|----------|-------|
| Message branching | `parentMessageId` tree, max 2 retries (branchIndex 1-2) |
| Thread ownership | `type` + `ownerId` pattern |
| Project access | Role-based (view/edit/admin) via `project_members` |
| Workflow versioning | Integer version, `parentId` for forks |
| Cache invalidation | Polling via `/api/projects/{id}/updates` |
| Content limit | 32KB per message |
| Pagination | Spring Data style (page, size, sort) |
| Timestamps | Epoch milliseconds in JSON |
| IDs | UUID v4 |

---

_Moku API Specification - 2025-11-25_

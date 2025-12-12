# Project Requirements

**Date:** 2025-11-25
**Status:** Requirements Definition
**Purpose:** Define project concept, structure, and integration with platform services

## Executive Summary

A **Project** is an organizational container that groups related work for collaboration. Projects contain:
- **Threads** - Conversation history with AI assistants
- **Workflows** - Saved and reusable AI task sequences
- **Files** - Input assets and generated outputs

Projects enable teams to compartmentalize work, share context, and collaborate on AI-powered tasks.

### Relationship to Existing Documents

| Document | Relationship |
|----------|--------------|
| `thread-loading-caching-requirements-2025-11-25.md` | Project thread caching, member roles |
| `thread-management-requirements-2025-11-25.md` | Thread creation and branching |
| `brainstorming-session-file-storage-2025-11-25.md` | Storage Service for project files |
| `brainstorming-session-workflow-templates-2025-11-25.md` | Workflow model and storage |
| `ai/projects-feature-summary.md` | Original requirements (superseded by this doc) |

---

## 1. Core Concept

### 1.1 Project Contents

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PROJECT                                         │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │    THREADS      │  │   WORKFLOWS     │  │     FILES       │              │
│  │                 │  │                 │  │                 │              │
│  │ • Conversations │  │ • Templates     │  │ • Input assets  │              │
│  │ • Message trees │  │ • Instances     │  │ • Output assets │              │
│  │ • Attachments   │  │ • Executions    │  │ • Shared docs   │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
│  MEMBERS: View | Edit | Admin                                               │
│  STORAGE: Threads/Messages=Moku API (cached), Files=Storage Service         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Project vs Personal

| Aspect | Personal (Thread List) | Project |
|--------|------------------------|---------|
| Owner | User | Project (shared) |
| Access | Owner only | Project members |
| Thread/Message storage | Moku API (cached locally) | Moku API (cached locally) |
| File storage | Local filesystem | Storage Service |
| Cache TTL | 5 min (threads), 2 min (messages) | 5 min (threads), 2 min (messages) |
| Workflows | Personal scope | Project scope |
| Collaboration | None | View/Edit/Admin roles |

---

## 2. Data Model

### 2.1 Project Entity

```typescript
interface Project {
  id: string;                    // UUID v4
  name: string;                  // "Q4 Marketing Campaign"
  description?: string;          // Project purpose/details
  createdBy: string;             // userId of creator
  organizationId?: string;       // Optional org association
  status: 'active' | 'archived' | 'deleted';
  createdAt: number;             // Epoch milliseconds
  updatedAt: number;
  deletedAt?: number;

  metadata: {
    color?: string;              // UI accent color
    icon?: string;               // Project icon identifier
    tags?: string[];             // Searchable tags
    settings?: {
      defaultModel?: string;     // Preferred AI model
      maxThreads?: number;       // Optional limit
      maxWorkflows?: number;     // Optional limit
      maxStorageBytes?: number;  // Storage quota
    };
  };

  // Computed fields (not stored, fetched on demand)
  threadCount?: number;
  workflowCount?: number;
  fileCount?: number;
  memberCount?: number;
  storageUsedBytes?: number;
  lastActivity?: number;
}
```

### 2.2 Project Member Entity

```typescript
interface ProjectMember {
  id: string;                    // UUID v4
  projectId: string;             // FK to projects
  userId?: string;               // Individual user (nullable)
  organizationId?: string;       // Org membership (nullable)
  role: 'view' | 'edit' | 'admin';
  createdBy: string;             // Who granted access
  createdAt: number;
  expiresAt?: number;            // Optional expiration
}
```

### 2.3 Member Roles

| Role | Permissions |
|------|-------------|
| **View** | Read threads, read workflows, read files, issue prompts (continue conversations) |
| **Edit** | View + create threads, create workflows, create templates, upload files |
| **Admin** | Edit + delete any thread/workflow/file, manage members, update project settings |

### 2.4 Role Permission Matrix

| Action | View | Edit | Admin |
|--------|------|------|-------|
| View threads | ✓ | ✓ | ✓ |
| Issue prompts | ✓ | ✓ | ✓ |
| View workflows | ✓ | ✓ | ✓ |
| Execute workflows | ✓ | ✓ | ✓ |
| View files | ✓ | ✓ | ✓ |
| Download files | ✓ | ✓ | ✓ |
| Create threads | | ✓ | ✓ |
| Create workflows | | ✓ | ✓ |
| Create templates | | ✓ | ✓ |
| Upload files | | ✓ | ✓ |
| Edit own threads | | ✓ | ✓ |
| Edit own workflows | | ✓ | ✓ |
| Delete own threads | | ✓ | ✓ |
| Delete own workflows | | ✓ | ✓ |
| Delete own files | | ✓ | ✓ |
| Delete any thread | | | ✓ |
| Delete any workflow | | | ✓ |
| Delete any file | | | ✓ |
| Manage members | | | ✓ |
| Update project settings | | | ✓ |
| Archive/delete project | | | ✓ |

---

## 3. Storage Architecture

### 3.1 Storage Split

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STORAGE ARCHITECTURE                                 │
│                                                                              │
│  PERSONAL PROJECT                    SHARED PROJECT                         │
│  ────────────────                    ──────────────                         │
│                                                                              │
│  Threads    → Moku API (cached)      Threads    → Moku API (cached)         │
│  Messages   → Moku API (cached)      Messages   → Moku API (cached)         │
│  Files      → Local filesystem       Files      → Storage Service           │
│  Workflows  → Moku API               Workflows  → Moku API                  │
│                                                                              │
│  TTL: 5min (threads), 2min (msgs)    TTL: 5min (threads), 2min (msgs)      │
│  LRU eviction when cache > 500MB     LRU eviction when cache > 500MB       │
│  No sharing (owner only)             Shared via member roles                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 File Storage Decision

**File storage is determined by PROJECT type (personal vs shared), not thread type.**

```typescript
function getStorageLocation(context: { projectType: 'personal' | 'shared' }): StorageType {
  if (context.projectType === 'personal') {
    return 'local';      // Local filesystem
  } else {
    return 'remote';     // Storage Service, presigned URLs
  }
}
```

**Note:** Thread and message storage is ALWAYS Moku API for both personal and shared projects. Only FILE storage differs.

### 3.3 Storage Service Integration

From the File Storage brainstorming session:

| Operation | Endpoint | Purpose |
|-----------|----------|---------|
| Upload URL | `POST /projects/{projectId}/threads/{threadId}/files/upload-url` | Get presigned upload URL |
| Upload Complete | `POST /files/{fileId}/upload-complete` | Confirm upload |
| Download URL | `GET /files/{fileId}/download-url` | Get presigned download URL |
| List Files | `GET /projects/{projectId}/files` | List project files |
| Delete | `DELETE /files/{fileId}` | Delete file |
| Stats | `GET /projects/{projectId}/storage` | Storage usage |

### 3.4 Local Cache for Project Files

Desktop caches project files locally for performance:

```
userData/holokai/desktop/file-cache/
├── <projectId>/
│   ├── <fileId>.enc          # gzip + AES-256-GCM encrypted
│   └── manifest.json         # metadata + cachedAt + etag
└── cache-settings.json       # maxSize, evictionDays (default 3)
```

---

## 4. Project Contents

### 4.1 Threads in Projects

Threads belong to a project via `projectId`:

```typescript
interface Thread {
  id: string;
  type: 'personal' | 'project';
  ownerId: string;               // userId (personal) or projectId (project)
  projectId?: string;            // populated if type='project'
  // ... other fields from thread-management-requirements
}
```

**Thread Movement:**
- Personal → Project (user must be Edit member)
- Project → Project (user must be creator/admin of source, Edit of target)
- Project → Personal (user must be creator/admin, becomes personal to that user)

### 4.2 Workflows in Projects

Workflows belong to a project via `projectId`:

```typescript
interface Workflow {
  id: string;
  scope: 'personal' | 'project';
  projectId?: string;            // populated if scope='project'
  ownerId: string;               // userId (personal) or projectId (project)
  isTemplate: boolean;           // true = reusable template
  // ... other fields from workflow-templates session
}
```

**Workflow Scope:**
- Personal workflows visible only to owner
- Project workflows visible to all project members
- Templates can be forked by Edit/Admin members

### 4.3 Files in Projects

Files are associated with threads or exist at project level:

```typescript
interface ProjectFile {
  fileId: string;
  projectId: string;
  threadId?: string;             // null = project-level file
  messageId?: string;            // null = not attached to message
  filename: string;
  mimeType: string;
  sizeBytes: number;
  type: 'input' | 'output';
  uploadedBy: string;
  uploadedAt: string;
  metadata?: {
    workflowId?: string;         // if generated by workflow
    requestId?: string;          // audit request reference
    tags?: string[];
  };
}
```

**File Categories:**

| Category | Description | Examples |
|----------|-------------|----------|
| Thread attachment | Attached to a message | Image in prompt, code file |
| Workflow input | Input to workflow execution | Data file, config |
| Workflow output | Generated by workflow | Report, analysis |
| Project file | Project-level shared file | Reference doc, template |

---

## 5. API Endpoints

### 5.1 Project CRUD

```
POST /api/projects
  Create new project

GET /api/projects
  List user's projects (owned + member of)

GET /api/projects/{projectId}
  Get project details

PATCH /api/projects/{projectId}
  Update project (name, description, settings)

DELETE /api/projects/{projectId}
  Soft delete project (admin only)

POST /api/projects/{projectId}/archive
  Archive project (admin only)

POST /api/projects/{projectId}/restore
  Restore archived project (admin only)
```

### 5.2 Member Management

```
GET /api/projects/{projectId}/members
  List project members

POST /api/projects/{projectId}/members
  Add member (admin only)
  Body: { userId?, organizationId?, role, expiresAt? }

PATCH /api/projects/{projectId}/members/{memberId}
  Update member role (admin only)

DELETE /api/projects/{projectId}/members/{memberId}
  Remove member (admin only)
```

### 5.3 Project Threads

```
GET /api/projects/{projectId}/threads
  List project threads

POST /api/threads/{threadId}/move
  Move thread to/from project
  Body: { targetType, targetProjectId? }
```

### 5.4 Project Workflows

```
GET /api/projects/{projectId}/workflows
  List project workflows

POST /api/workflows
  Create workflow
  Body: { scope, projectId?, ... }
```

### 5.5 Project Files

Uses Storage Service endpoints (see section 3.3).

### 5.6 Authentication

All endpoints require JWT in Authorization header:
```
Authorization: Bearer <jwt>
```

---

## 6. Database Schema

### 6.1 Projects Table

```sql
CREATE TABLE projects (
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

    CONSTRAINT projects_status_check
        CHECK (status IN ('active', 'archived', 'deleted'))
);

CREATE INDEX idx_projects_created_by ON projects(created_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_org ON projects(organization_id) WHERE organization_id IS NOT NULL;
```

### 6.2 Project Members Table

```sql
CREATE TABLE project_members (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,

    CONSTRAINT project_members_role_check
        CHECK (role IN ('view', 'edit', 'admin')),
    CONSTRAINT project_members_target_check
        CHECK (
            (user_id IS NOT NULL AND organization_id IS NULL) OR
            (user_id IS NULL AND organization_id IS NOT NULL)
        )
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id) WHERE user_id IS NOT NULL;
```

### 6.3 Existing Table Updates

**threads table** - add `project_id` column:
```sql
ALTER TABLE threads ADD COLUMN project_id UUID REFERENCES projects(id);
CREATE INDEX idx_threads_project ON threads(project_id) WHERE project_id IS NOT NULL;
```

**workflows table** - add `project_id` column:
```sql
ALTER TABLE workflows ADD COLUMN project_id UUID REFERENCES projects(id);
CREATE INDEX idx_workflows_project ON workflows(project_id) WHERE project_id IS NOT NULL;
```

---

## 7. User Workflows

### 7.1 Creating a Project

```
1. User clicks "New Project" in sidebar
2. Desktop shows creation dialog
3. User enters name, description
4. Desktop generates UUID, calls POST /api/projects
5. Moku creates project, adds user as admin
6. Desktop adds project to sidebar
```

### 7.2 Adding Members

```
1. User opens project settings → Members tab
2. Clicks "Add Member"
3. Enters email or selects from org
4. Selects role (View/Edit/Admin)
5. Desktop calls POST /api/projects/{id}/members
6. Moku creates member record
7. Member sees project in their project list
```

### 7.3 Creating Thread in Project

```
1. User opens project
2. Clicks "New Thread"
3. Selects model, enters prompt
4. Desktop creates thread with type='project', projectId set
5. Submits to Holo API
6. Thread appears in project thread list
```

### 7.4 Moving Thread to Project

```
1. User right-clicks thread in Thread List
2. Selects "Move to Project" → chooses project
3. Desktop calls POST /api/threads/{id}/move
4. Thread type changes to 'project'
5. Files move from local to Storage Service
6. Thread appears in project
```

### 7.5 Working with Project Files

```
1. User uploads file to project thread
2. Desktop calls Storage Service for presigned URL
3. Desktop uploads file directly to blob storage
4. Desktop confirms upload complete
5. File metadata stored, visible to all members
6. Other members download via presigned URL
7. Desktop caches locally (encrypted)
```

---

## 8. Desktop Architecture

### 8.1 Project Service

```typescript
class ProjectService {
  // CRUD
  async create(name: string, description?: string): Promise<Project>;
  async get(projectId: string): Promise<Project>;
  async update(projectId: string, updates: Partial<Project>): Promise<Project>;
  async delete(projectId: string): Promise<void>;
  async archive(projectId: string): Promise<void>;
  async restore(projectId: string): Promise<void>;

  // Listing
  async list(): Promise<Project[]>;
  async listByOrg(orgId: string): Promise<Project[]>;

  // Members
  async getMembers(projectId: string): Promise<ProjectMember[]>;
  async addMember(projectId: string, member: AddMemberRequest): Promise<ProjectMember>;
  async updateMember(projectId: string, memberId: string, role: Role): Promise<ProjectMember>;
  async removeMember(projectId: string, memberId: string): Promise<void>;

  // Contents
  async getThreads(projectId: string): Promise<Thread[]>;
  async getWorkflows(projectId: string): Promise<Workflow[]>;
  async getFiles(projectId: string): Promise<ProjectFile[]>;
  async getStats(projectId: string): Promise<ProjectStats>;
}
```

### 8.2 Project Cache

```typescript
class ProjectCache {
  private readonly projectCache: LRUCache<string, CacheEntry<Project>>;
  private readonly memberCache: LRUCache<string, CacheEntry<ProjectMember[]>>;

  private readonly config = {
    maxProjects: 50,
    projectTTL: 10 * 60 * 1000,     // 10 minutes
    membersTTL: 5 * 60 * 1000       // 5 minutes
  };

  async getProject(projectId: string): Promise<Project>;
  async getMembers(projectId: string): Promise<ProjectMember[]>;
  invalidateProject(projectId: string): void;
  invalidateMembers(projectId: string): void;
}
```

---

## 9. Implementation Checklist

### 9.1 Moku API

- [ ] Create projects table
- [ ] Create project_members table
- [ ] Add project_id to threads table
- [ ] Add project_id to workflows table
- [ ] Implement project CRUD endpoints
- [ ] Implement member management endpoints
- [ ] Add permission checks to thread/workflow endpoints
- [ ] Add permission checks to Storage Service

### 9.2 Desktop

- [ ] Implement ProjectService
- [ ] Implement ProjectCache
- [ ] Create project sidebar UI
- [ ] Create project detail view
- [ ] Create member management UI
- [ ] Integrate with ThreadService for project threads
- [ ] Integrate with WorkflowService for project workflows
- [ ] Integrate with ProjectFileService for project files
- [ ] Handle thread move (personal ↔ project)
- [ ] Handle file migration on thread move

### 9.3 Storage Service

- [ ] Add project permission checks
- [ ] Validate member role on file operations

---

## 10. Key Decisions Summary

| Decision | Value |
|----------|-------|
| Project contents | Threads, Workflows, Files |
| Member roles | View (read + prompt), Edit (create), Admin (delete + manage) |
| Personal file storage | Local filesystem (encrypted) |
| Project file storage | Storage Service (presigned URLs) |
| Project cache TTL | 10 minutes |
| Project members cache TTL | 5 minutes |
| Thread cache TTL | 5 minutes (threads), 2 minutes (messages) |
| File cache | 3 days, encrypted, LRU eviction |
| Context modes | Deferred to design phase |

---

## 11. Deferred Items

Items to be refined during design phase:

1. **Context modes** - Preserve vs Break context when moving threads
2. **Organization-level projects** - Org-wide project visibility
3. **Project templates** - Pre-configured project structures
4. **Project analytics** - Usage metrics, AI costs
5. **Real-time presence** - Show who's viewing/editing
6. **Invitation system** - Email invitations for external users

---

_Project requirements defined - 2025-11-25_

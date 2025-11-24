# Projects Feature - Holokai Desktop Application

## Overview

The **Projects** feature in Holokai Desktop provides a workspace concept that organizes related AI conversations, assets, and outputs into logical containers. Projects enable users to compartmentalize their work, collaborate with team members, and maintain context across multiple chat threads and documents.

---

## Core Concept

A **Project** is a collection of:
- **Threads** - Conversation history with AI assistants
- **Input Assets** - Documents, data files, images, scripts, videos uploaded for AI processing
- **Generated Assets** - Outputs created by AI (reports, code, analysis, etc.)
- **Metadata** - Project settings, permissions, sharing configuration

Projects serve as organizational containers that:
- Group related work together (e.g., "Q4 Marketing Campaign", "Backend Refactor", "Research Paper")
- Provide context boundaries for AI conversations
- Enable collaboration through sharing mechanisms
- Maintain asset associations and versions with thread_id and request_id tracking

---

## Key Features

### 1. Thread Organization

Threads can be associated with projects through the `projectId` metadata field stored in the `thread_metadata` table. This allows:

**Thread-to-Project Relationships:**
- One thread belongs to zero or one project (nullable relationship)
- One project can contain many threads
- Threads without a project live in threads list

**Operations:**
- Move threads into projects
- Move threads out of projects threads list
- Filter/view threads by project
- Bulk operations on project threads

**Context Handling:**
When moving threads between projects, the desktop app can implement privacy modes:
- **Preserve Context** - Thread history remains visible in both locations
- **Break Context** - Thread appears fresh in new location (metadata flag)

### 2. Asset Management

Projects manage two categories of assets:

**Input Assets:**
- Documents, images, videos, scripts, files users upload to provide context to AI
- PDFs, spreadsheets, code files, media files, etc.
- Referenced by threads within the project
- Stored in project-specific directories or cloud storage
- Asset type tracked: 'file' | 'script' | 'image' | 'video' | 'document'

**Generated Assets:**
- AI-created outputs (documents, code, reports, visualizations, scripts)
- Linked to specific threads via thread_id in metadata
- Associated with specific requests via request_id in metadata
- Tracked for version history and regeneration

**Asset Storage Strategy:**
```
Local Storage (Desktop):
  ~/AppData/Roaming/holokai-desktop/projects/{projectId}/
    inputs/
      {assetId}.{ext}
    outputs/
      {assetId}.{ext}
    metadata.json

** Future Storage Capability - Not To Be Implemented **
Cloud Storage (Moku):
  - Asset metadata stored in Postgres (includes thread_id, request_id)
  - Binary content in S3/object storage
  - Sync state tracked for offline support
```

### 3. Collaboration & Sharing

Projects support multi-user collaboration through integration with Moku's user and organization management:

**Sharing Levels:**

| Level | Description | Permissions |
|-------|-------------|-------------|
| **Private** | Project owner only | Full control: read, write, delete, share |
| **Shared - View** | Specific users/orgs | Read threads, view assets, cannot modify |
| **Shared - Edit** | Specific users/orgs | Read, create threads, upload assets, limited delete |
| **Organization** | All org members | Permissions based on org role (admin/member) |

**Sharing Mechanism:**
- Creator adds user to project and selects level - Member sees project in their project list
- Moku API manages access control lists (ACLs)
- Desktop app enforces permissions locally
- Real-time sync keeps permissions current

**Use Cases:**
- **Team Projects**: Share "Q4 Budget Analysis" with finance team
- **Client Work**: Share "Website Redesign" with one person  (view-only)

### 4. Privacy & Context Management

Projects provide privacy boundaries and context control:

**Context Isolation:**
- Threads in Project A cannot reference assets from Project B
- AI responses use only project-specific context
- Search/indexing respects project boundaries

**Privacy Modes:**
- **Private Projects**: Data never leaves user's account
- **Shared Projects**: Data visible to members only

**Context Window Management:**
- Desktop tracks which assets are "active" in current conversation
- User can explicitly include/exclude project assets from AI context
- Token budgets managed per-thread, respecting project limits

---

## Data Model

### Project Entity

```typescript
interface Project {
  id: string;                          // UUID v4
  name: string;                        // "Q4 Marketing Campaign"
  description?: string;                // Project purpose/details
  createdBy: string;                   // User ID of creator
  organizationId?: string;             // Optional org association
  status: 'active' | 'archived' | 'deleted';
  createdAt: number;                   // Epoch milliseconds
  updatedAt: number;                   // Epoch milliseconds
  deletedAt?: number | null;           // Soft delete
  
  metadata: {
    color?: string;                    // UI accent color
    icon?: string;                     // Project icon identifier
    tags?: string[];                   // Searchable tags
    settings?: {
      defaultModel?: string;           // Preferred AI model
      contextMode?: 'full' | 'limited'; // File context behavior
      maxThreads?: number;             // Optional limit
    };
  };
  
  // Computed fields (not stored, fetched on demand)
  threadCount?: number;
  assetCount?: number;
  memberCount?: number;
  lastActivity?: number;
}
```

### Project Member Entity

```typescript
interface ProjectMember {
  id: string;                          // UUID v4
  projectId: string;                   // FK to projects
  userId?: string;                     // Individual user (nullable)
  organizationId?: string;             // Org membership (nullable)
  permission: 'view' | 'edit' | 'admin';
  createdBy: string;                   // Who granted access
  createdAt: number;
  expiresAt?: number | null;           // Optional expiration
}
```

### Project Asset Entity

```typescript
interface ProjectAsset {
  id: string;                          // UUID v4
  projectId: string;                   // FK to projects
  name: string;                        // Original filename
  type: 'input' | 'output';           // Asset category
  assetType: 'file' | 'script' | 'image' | 'video' | 'document';
  mimeType: string;                    // e.g., 'application/pdf', 'video/mp4'
  size: number;                        // Bytes
  path: string;                        // Local storage path
  cloudUrl?: string;                   // Cloud storage URL (if synced)
  uploadedBy: string;                  // User ID
  createdAt: number;
  metadata?: {
    threadId?: string;                 // Associated thread
    requestId?: string;                // Associated request (for generated assets)
    version?: number;                  // Version tracking
    tags?: string[];
  };
}
```

---

## Database Schema

### Moku API Tables

```sql
-- Projects Table
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL,
    organization_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    
    CONSTRAINT projects_status_check CHECK (status IN ('active', 'archived', 'deleted')),
);

CREATE INDEX idx_projects_status ON projects(status) WHERE deleted_at IS NULL;

-- Project Members Table
CREATE TABLE project_members (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    user_id UUID,
    organization_id UUID,
    permission VARCHAR(20) NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,

    CONSTRAINT project_members_permission_check CHECK (permission IN ('view', 'edit', 'admin')),
    CONSTRAINT project_members_target_check CHECK (
        (user_id IS NOT NULL AND organization_id IS NULL) OR
        (user_id IS NULL AND organization_id IS NOT NULL)
    ),
    CONSTRAINT fk_project_members_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id) WHERE user_id IS NOT NULL;

-- Project Assets Table
CREATE TABLE project_assets (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    name VARCHAR(500) NOT NULL,
    type VARCHAR(20) NOT NULL,
    asset_type VARCHAR(20) NOT NULL,
    mime_type VARCHAR(200) NOT NULL,
    size BIGINT NOT NULL,
    path VARCHAR(1000) NOT NULL,
    cloud_url VARCHAR(1000),
    uploaded_by UUID NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,

    CONSTRAINT project_assets_type_check CHECK (type IN ('input', 'output')),
    CONSTRAINT project_assets_asset_type_check CHECK (asset_type IN ('file', 'script', 'image', 'video', 'document')),
    CONSTRAINT fk_project_assets_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
);

CREATE INDEX idx_project_assets_project ON project_assets(project_id);

-- Example metadata JSONB structure with thread_id and request_id:
-- {
--   "thread_id": "uuid",
--   "request_id": "uuid",
--   "version": 1,
--   "tags": ["analysis", "draft"]
-- }
```

**Note:** The `thread_metadata` table already has a `project_id` column (from the migration we created), creating the link between threads and projects.

---

## Architecture Integration

### Desktop App Responsibilities

1. **Project Management UI**
   - Create/rename/delete projects
   - Navigate between projects
   - View project details (threads, assets, members)

2. **Thread-Project Association**
   - Move threads to/from projects
   - Update `thread_metadata.project_id` via Moku API
   - Cache project associations locally

3. **Asset Management**
   - Upload assets to projects
   - Download assets from projects
   - Sync with cloud storage (Moku/S3)
   - Maintain local cache

4. **Collaboration UI**
   - Invite members to projects
   - Manage permissions
   - Show member presence (who's viewing/editing)

### Moku API Responsibilities

1. **Project CRUD Operations**
   - `GET /api/projects` - List user's projects
   - `POST /api/projects` - Create project
   - `GET /api/projects/:id` - Get project details
   - `PATCH /api/projects/:id` - Update project
   - `DELETE /api/projects/:id` - Delete project

2. **Member Management**
   - `POST /api/projects/:id/members` - Add member to project
   - `DELETE /api/projects/:id/members/:memberId` - Remove member access
   - `GET /api/projects/:id/members` - List project members

3. **Asset Operations**
   - `POST /api/projects/:id/assets` - Upload asset
   - `GET /api/projects/:id/assets` - List project assets
   - `DELETE /api/projects/:id/assets/:assetId` - Delete asset
   - Generate pre-signed URLs for S3 access

4. **Authorization**
   - Validate user permissions on all operations
   - Audit logging for compliance

### Holo API (No Changes Required)

The Holo API continues to handle prompt execution and persistence. It does not need project awareness since:
- Projects are organizational constructs managed by Moku
- Thread-project associations stored in `thread_metadata`
- Asset context provided by desktop app in prompt payload

---

## User Workflows

### Creating a Project

1. User clicks "New Project" in desktop app
2. Desktop generates UUID, shows creation dialog
3. User enters name, description, selects sharing options
4. Desktop calls `POST /api/projects` (Moku API)
5. Moku creates project, returns project object
6. Desktop caches project locally, adds to sidebar

### Adding Threads to Project
1. User clicks on a project in the Activity List 
2. In Project page, user selects "New Thread" 
3. Desktop generates UUID, shows thread creation page
3. Desktop calls `POST /api/threads/:id/move` (Moku API)
4. Moku updates `thread_metadata.project_id`

### Moving a Thread to Project
1. User right-clicks thread in General History
2. Selects "Move to Project" → chooses project
3. Desktop calls `POST /api/threads/:id/move` (Moku API)
4. Moku updates `thread_metadata.project_id`
5. Desktop refreshes UI, thread appears in project

### Sharing a Project

1. User opens project settings → Sharing tab
2. Clicks "Invite Member"
3. Enters email or selects from org roster
4. Selects permission level (view/edit/admin)
5. Desktop calls `POST /api/projects/:id/members` (Moku API)
6. Moku validates, creates `project_members` record
7. Sends invitation email to member
8. Member accepts, project appears in their desktop app

### Working with Project Assets

1. User drags asset into project asset panel
2. Desktop uploads to local cache immediately
3. Background sync uploads to Moku/S3
4. Asset available to all project members
5. User includes asset in chat: "Analyze this budget spreadsheet"
6. Desktop includes asset content/reference in Holo API request with thread_id and request_id
7. AI response considers asset context
8. Generated outputs saved to project outputs folder with associated thread_id and request_id in metadata

---

## Implementation Phases

### Phase 1: Core Project Management (MVP)
- [ ] Projects table and basic CRUD in Moku API
- [ ] Desktop UI for creating/viewing projects
- [ ] Thread-to-project association (move threads)
- [ ] Project selector in sidebar
- [ ] Local project cache

### Phase 2: Asset Management
- [ ] Project assets table in Moku API
- [ ] Asset upload/download endpoints
- [ ] Desktop asset panel UI
- [ ] Local asset storage and caching
- [ ] Cloud sync (S3 integration)
- [ ] Support for multiple asset types (file, script, image, video, document)
- [ ] Thread_id and request_id tracking in asset metadata

### Phase 3: Collaboration
- [ ] Project members table and APIs
- [ ] Desktop sharing UI
- [ ] Permission enforcement in Moku API
- [ ] Invitation email system
- [ ] Real-time member presence

### Phase 4: Advanced Features
- [ ] Organization-level projects
- [ ] Project templates
- [ ] Project archival and export
- [ ] Advanced search within projects
- [ ] Project analytics and usage metrics

---

## Security Considerations

### Access Control
- All project operations require authentication
- Moku API validates user permissions on every request
- Desktop enforces UI restrictions based on permission level
- Audit log tracks all project access and modifications

### Data Isolation
- Projects are completely isolated at database level
- No cross-project queries allowed
- Asset access controlled via signed URLs with expiration
- Search indexes respect project boundaries

### Compliance
- Organization admins can enforce data policies
- Support for data residency requirements
- Retention policies for archived/deleted projects
- GDPR-compliant data export and deletion

---

## Future Enhancements

1. **Project Templates** - Pre-configured projects for common workflows
2. **Project Duplication** - Clone project structure for reuse
3. **Cross-Project Search** - Search across all accessible projects
4. **Project Dependencies** - Link related projects together
5. **Version Control** - Git-like branching for project variations
6. **Project Analytics** - Usage metrics, AI costs, collaboration stats
7. **External Integrations** - Sync with GitHub, Google Drive, Notion
8. **Project Automation** - Scheduled tasks, webhooks, CI/CD integration

---

## Summary

The Projects feature transforms Holokai Desktop from a simple chat interface into a comprehensive AI-powered workspace. By organizing threads, assets, and members into projects, users can:

- Maintain context across complex, multi-session work
- Collaborate effectively with teams and organizations
- Manage input and output assets systematically (files, scripts, images, videos, documents)
- Track asset associations with threads and requests via metadata
- Control privacy and sharing granularly
- Scale AI workflows for enterprise use

The feature integrates seamlessly with the existing architecture:
- Desktop app handles UI and local caching
- Moku API manages persistence and authorization
- Holo API continues to process prompts without modification
- Shared Postgres database maintains referential integrity

This design positions Holokai Desktop as an enterprise-ready AI platform suitable for teams, organizations, and power users who need more than isolated chat sessions.

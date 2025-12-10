# Epic Technical Specification: Database & API Foundation

Date: 2025-11-26
Author: Peter
Epic ID: 1
Status: Draft

---

## Overview

Epic 1 establishes the foundational database schema and Moku API endpoints required for all Phase 2 features. This epic implements the data persistence layer for thread branching (parent-child message relationships), project collaboration (projects, members, roles), workflow automation (templates, executions), and insights reporting (saved reports, metrics). Additionally, it creates the REST API endpoints on the Moku service for thread operations, project CRUD, member management, and a centralized authorization service for role-based access control across all project resources.

This work is prerequisite for Epics 2, 3, 6, and 7, which depend on these database tables and API endpoints to function.

## Objectives and Scope

**In Scope:**
- Flyway database migrations (V2.1-V2.5) for Phase 2 schema updates
- Thread API updates supporting ownership fields (`owner_id`, `project_id`, `type`) and branching metadata
- Message API updates for parent-child relationships, branch indexing, and attachment metadata
- Complete Project API implementation with CRUD endpoints and member management
- Centralized AuthorizationService for role-based access checks across all controllers
- Database views (`v_project_thread_summary`, `v_user_project_access`, `v_workflow_execution_stats`)
- Rollback scripts and migration testing on both clean and existing databases

**Out of Scope:**
- Desktop application UI changes (covered in Epic 2, 3, 6, 7, 8)
- File upload/download implementation (Epic 5)
- Workflow execution engine logic (Epic 7)
- Insights dashboard frontend (Epic 6)
- MCP integration and chat-to-workflow features (Enterprise MVP, separate epics)

## System Architecture Alignment

**Architecture Compliance:** This epic aligns with `architecture-2025-11-25.md §2 (Desktop Application Architecture)` and implements the Moku API layer defined in `§1.2 (Service Responsibilities)`.

**Key Components Referenced:**
- **Moku API (Spring Boot REST):** Thread, Message, Project, and ProjectMember controllers with service/repository layers
- **Database Layer:** PostgreSQL 14+ with Flyway migrations, foreign key constraints, CHECK constraints, and indexed queries
- **AuthorizationService:** Centralized permission checks using project member roles (view, edit, admin) per `API §10`

**Architectural Constraints:**
- All API endpoints must return standardized JSON responses with consistent error handling (4xx/5xx with error codes)
- Database schema changes must be backward-compatible with Phase 1 data (requires migration testing)
- Authorization checks must execute before any data mutations or sensitive reads
- API endpoints must support pagination (limit/cursor) for list operations to handle large datasets

## Detailed Design

### Services and Modules

| Module/Service | Responsibilities | Inputs | Outputs | Owner |
|----------------|------------------|--------|---------|-------|
| **ThreadController** | Thread CRUD endpoints, filtering, pagination | HTTP requests with auth context | ThreadDTO, PagedResponse | Backend (Moku API) |
| **ThreadService** | Thread business logic, authorization checks | ThreadDTO, filters, user context | Thread entities, validation results | Backend (Moku API) |
| **ThreadRepository** | Thread database queries, filtering by type/project | Query parameters, UUIDs | Thread entities from DB | Backend (Moku API) |
| **MessageController** | Message creation with branching support | Message content, parent_id, branch_index, attachments | MessageDTO | Backend (Moku API) |
| **MessageService** | Message validation, idempotency, branch counting | Message data, thread context | Message entities | Backend (Moku API) |
| **MessageRepository** | Message queries, tree reconstruction | Thread ID, query filters | Message entities ordered by created_at | Backend (Moku API) |
| **ProjectController** | Project CRUD, member management endpoints | ProjectDTO, member data | Project entities, member lists | Backend (Moku API) |
| **ProjectService** | Project business logic, member count, updates-since queries | Project data, timestamps | Project entities, update counts | Backend (Moku API) |
| **ProjectRepository** | Project database queries, soft deletes | UUIDs, filters | Project entities | Backend (Moku API) |
| **ProjectMemberController** | Member add/update/remove endpoints | Member data, role updates | MemberDTO, operation results | Backend (Moku API) |
| **ProjectMemberService** | Role validation, last-admin checks | Member operations, project context | Member entities, validation results | Backend (Moku API) |
| **ProjectMemberRepository** | Member queries, role lookups | Project ID, user ID | Member entities with roles | Backend (Moku API) |
| **AuthorizationService** | Centralized permission checks for all resources | Project ID, user ID, required role | Permission decision (allow/deny) | Backend (Moku API) |
| **Flyway Migration Scripts** | Database schema evolution (V2.1-V2.5) | Migration SQL, rollback SQL | Schema changes applied to DB | Database |

### Data Models and Contracts

**Desktop Thread Entity (Updated):**

```sql
-- Key fields (Phase 2 additions in bold)
id UUID PRIMARY KEY
user_id UUID NOT NULL
title VARCHAR(255)
status VARCHAR(20) -- 'active' | 'archived' | 'deleted'
**type VARCHAR(20) DEFAULT 'personal' -- 'personal' | 'project'**
**owner_id UUID NOT NULL**
**project_id UUID (nullable, FK to projects)**
**created_by UUID NOT NULL**
metadata JSONB
created_at TIMESTAMP
updated_at TIMESTAMP
deleted_at TIMESTAMP (soft delete)

-- Constraints:
CHECK (type IN ('personal', 'project'))
CHECK ((type = 'personal' AND project_id IS NULL) OR (type = 'project' AND project_id IS NOT NULL))

-- Audit Table: desktop_threads_audit (in holokai_audit schema)
-- Created by Hibernate Envers for @Audited entities
-- Contains: id, revision_id, revision_type, all entity columns, {field}_modified columns
```

**Desktop Message Entity (Updated):**

```sql
-- Key fields (Phase 2 additions in bold)
id UUID PRIMARY KEY
thread_id UUID NOT NULL (FK)
**parent_message_id UUID (nullable, self-referencing FK)**
**branch_index INTEGER DEFAULT 0 -- 0=original, 1-2=retries**
role VARCHAR(20) -- 'user' | 'assistant' | 'system'
content TEXT (max 32KB)
**attachments JSONB -- [{fileId, filename, mimeType, sizeBytes, storageType}]**
metadata JSONB
**client_message_id VARCHAR(255) -- for idempotency**
created_at TIMESTAMP
deleted_at TIMESTAMP

-- Constraints:
CHECK (role IN ('user', 'assistant', 'system'))
CHECK (branch_index >= 0 AND branch_index <= 2)
UNIQUE INDEX on (thread_id, client_message_id) WHERE client_message_id IS NOT NULL

-- Audit Table: desktop_messages_audit (in holokai_audit schema)
-- Created by Hibernate Envers for @Audited entities
-- Contains: id, revision_id, revision_type, all entity columns, {field}_modified columns
```

**Project Entity (New):**

```sql
id UUID PRIMARY KEY
name VARCHAR(200) NOT NULL
description TEXT
created_by UUID NOT NULL (FK to users) -- Project creator (immutable, used for thread ownership transfer)
organization_id UUID (nullable, FK to organizations)
status VARCHAR(20) DEFAULT 'active' -- 'active' | 'archived' | 'deleted'
metadata JSONB -- {color, icon, tags, settings, max_members: 100}
created_at TIMESTAMP
updated_at TIMESTAMP
deleted_at TIMESTAMP

-- Note: created_by serves as creator_id for thread ownership transfers when members leave
-- System-configurable max_members limit stored in metadata (default: 100)

-- Audit Table: projects_audit (in holokai_audit schema)
-- Created by Hibernate Envers for @Audited entities
-- Contains: id, revision_id, revision_type, all entity columns, {field}_modified columns
```

**Project Member Entity (New):**

```sql
id UUID PRIMARY KEY
project_id UUID NOT NULL (FK)
user_id UUID (nullable, FK to users)
organization_id UUID (nullable, FK to organizations)
role VARCHAR(20) NOT NULL -- 'view' | 'edit' | 'admin'
created_by UUID NOT NULL (FK to users)
created_at TIMESTAMP
expires_at TIMESTAMP (nullable)

-- Constraints:
CHECK (role IN ('view', 'edit', 'admin'))
CHECK ((user_id IS NOT NULL AND organization_id IS NULL) OR (user_id IS NULL AND organization_id IS NOT NULL))
UNIQUE (project_id, user_id)
UNIQUE (project_id, organization_id)

-- Note: Projects can have either individual members (user_id) OR organization groups (organization_id)
-- Both count toward the 100-member limit configured per project
-- Organization groups expand to individual users for access control (Moku handles expansion)
-- Validation: COUNT(project_members WHERE project_id = ?) < max_project_members before adding member/group

-- Audit Table: project_members_audit (in holokai_audit schema)
-- Created by Hibernate Envers for @Audited entities
-- Contains: id, revision_id, revision_type, all entity columns, {field}_modified columns
```

**Workflow Entity (New):**

```sql
id UUID PRIMARY KEY
name VARCHAR(200) NOT NULL
description TEXT
scope VARCHAR(20) NOT NULL -- 'personal' | 'project'
owner_id UUID NOT NULL
project_id UUID (nullable, FK)
is_template BOOLEAN DEFAULT false
version INTEGER DEFAULT 1
parent_id UUID (nullable, FK to workflows)
status VARCHAR(20) DEFAULT 'draft' -- 'draft' | 'active' | 'archived'
definition JSONB NOT NULL -- workflow steps, prompts, conditions
created_by UUID NOT NULL (FK)
created_at TIMESTAMP
updated_at TIMESTAMP
```

**Workflow Execution Entity (New):**

```sql
id UUID PRIMARY KEY
workflow_id UUID NOT NULL (FK)
status VARCHAR(20) NOT NULL -- 'pending' | 'running' | 'completed' | 'failed'
started_by UUID NOT NULL (FK to users)
started_at TIMESTAMP
completed_at TIMESTAMP (nullable)
result JSONB -- execution outputs
error JSONB (nullable)
```

**Saved Report Entity (New):**

```sql
id UUID PRIMARY KEY
name VARCHAR(200) NOT NULL
owner_id UUID NOT NULL (FK to users)
report_type VARCHAR(50) NOT NULL
config JSONB NOT NULL -- report parameters, filters
created_at TIMESTAMP
updated_at TIMESTAMP

-- Audit Table: saved_reports_audit (in holokai_audit schema)
-- Created by Hibernate Envers for @Audited entities
-- Contains: id, revision_id, revision_type, all entity columns, {field}_modified columns
```

**Migration Transaction Entity (New - Epic 5):**

```sql
id UUID PRIMARY KEY -- Transaction ID for rollback coordination
user_id UUID NOT NULL (FK to users)
migration_type VARCHAR(50) NOT NULL -- 'file_upload' | 'data_migration'
status VARCHAR(20) NOT NULL -- 'pending' | 'phase1_complete' | 'completed' | 'failed' | 'rolled_back'
file_count INTEGER DEFAULT 0
files_uploaded JSONB -- Array of storage service file IDs from Phase 1
error JSONB (nullable)
started_at TIMESTAMP
completed_at TIMESTAMP (nullable)

-- Note: Tracks two-phase file migration transactions for rollback capability
-- Phase 1: Upload to storage service → store file IDs in files_uploaded
-- Phase 2: Update database + delete local files
-- Rollback: Use transaction ID + files_uploaded to send DELETE to storage service
```

### APIs and Interfaces

**Thread API Endpoints:**

```
GET /api/threads?type={personal|project|all}&projectId={uuid}&page={int}&size={int}
→ Response: PagedResponse<ThreadDTO>
  {
    "content": [{id, title, type, ownerId, projectId, status, createdAt, updatedAt, messageCount, branchCount}],
    "totalElements": int,
    "totalPages": int
  }

GET /api/threads/{threadId}
→ Response: ThreadDetailDTO
  {id, title, type, ownerId, projectId, createdBy, status, createdAt, updatedAt, metadata, messages: [MessageDTO]}

POST /api/threads
  Request: {title?, projectId?, metadata?}
→ Response: ThreadDTO (201 Created)

PATCH /api/threads/{threadId}
  Request: {title?, status?, metadata?}
→ Response: ThreadDTO (200 OK)

POST /api/threads/{threadId}/messages
  Request: {content, parentMessageId?, branchIndex?, attachments?, clientMessageId?}
→ Response: MessageDTO (201 Created or 200 OK if idempotent)
```

**Project API Endpoints:**

```
GET /api/projects?page={int}&size={int}
→ Response: PagedResponse<ProjectDTO>

GET /api/projects/{projectId}
→ Response: ProjectDetailDTO
  {id, name, description, createdBy, organizationId, status, metadata, memberCount, createdAt, updatedAt, userRole}

POST /api/projects
  Request: {name, description?, metadata?}
→ Response: ProjectDTO (201 Created)
  Auto-creates owner membership for creator

PATCH /api/projects/{projectId}
  Request: {name?, description?, metadata?}
→ Response: ProjectDTO (200 OK)
  Requires: owner role

DELETE /api/projects/{projectId}
→ Response: 204 No Content (soft delete)
  Requires: owner role

GET /api/projects/{projectId}/updates?since={ISO8601}
→ Response: {threadsUpdated: int, membersUpdated: int, workflowsUpdated: int, latestUpdate: timestamp}
```

**Project Member API Endpoints:**

```
GET /api/projects/{projectId}/members
→ Response: [MemberDTO]
  {id, userId, organizationId, userName, userEmail, role, createdBy, createdAt, expiresAt}

POST /api/projects/{projectId}/members
  Request: {userId, role: 'viewer'|'editor'|'owner', expiresAt?}
→ Response: MemberDTO (201 Created)
  Requires: owner role

PATCH /api/projects/{projectId}/members/{memberId}
  Request: {role: 'viewer'|'editor'|'owner'}
→ Response: MemberDTO (200 OK)
  Requires: owner role

DELETE /api/projects/{projectId}/members/{memberId}
→ Response: 204 No Content
  Requires: owner role
  Validation: Cannot remove last owner
```

**Authorization Service Interface:**

```java
public class AuthorizationService {
  // Returns user's role in project (viewer|editor|owner) or null if not member
  // Note: User expiration handled by Moku authentication layer (not checked here)
  // Desktop login attempt → Moku returns 401 with "Account expired" if user inactive
  public String getUserRoleInProject(UUID projectId, UUID userId);

  // Throws AccessDeniedException if user lacks required role
  public void requireProjectAccess(UUID projectId, UUID userId, String minRole);

  // Checks thread access (owner for personal, project membership for project threads)
  public void requireThreadAccess(UUID threadId, UUID userId);

  // Checks modify permission (owner for personal, edit+ for project threads)
  public void requireThreadModify(UUID threadId, UUID userId);
}
```

**Error Response Format (Standardized):**

```json
{
  "timestamp": "2025-11-26T10:15:30Z",
  "status": 403,
  "error": "Forbidden",
  "message": "User does not have edit access to this project",
  "errorCode": "INSUFFICIENT_PERMISSIONS",
  "path": "/api/projects/550e8400-e29b-41d4-a716-446655440000/threads"
}
```

### Workflows and Sequencing

**E1-S1: Database Migration Sequence**

1. Developer creates V2.1_add_thread_branching.sql migration
2. Developer creates V2.2_add_projects.sql migration
3. Developer creates V2.3_add_workflows.sql migration
4. Developer creates V2.4_add_saved_reports.sql migration
5. Developer creates V2.5_add_views_triggers.sql migration
6. Test migrations on clean DB → Verify schema matches spec
7. Test migrations on Phase 1 DB → Verify backward compatibility
8. Create rollback scripts for each migration
9. Test rollback scripts on dev environment
10. Commit migrations to version control

**E1-S2/S3: Thread & Message API Update Sequence**

1. Backend: Update ThreadEntity with new columns (type, owner_id, project_id, created_by)
2. Backend: Update MessageEntity with branching fields (parent_message_id, branch_index, attachments, client_message_id)
3. Backend: Update ThreadDTO and MessageDTO to expose new fields
4. Backend: Update ThreadMapper and MessageMapper for entity ↔ DTO conversion
5. Backend: Add type/projectId filters to ThreadRepository.findByUser()
6. Backend: Add branch validation logic in MessageService (count existing branches for parent)
7. Backend: Add idempotency check on client_message_id in MessageService
8. Backend: Inject AuthorizationService into ThreadController and MessageController
9. Backend: Add authorization checks before thread/message operations
10. Test with Postman/integration tests → Verify filters, branching, idempotency

**E1-S4: Project API Implementation Sequence**

1. Backend: Create ProjectEntity, ProjectMemberEntity
2. Backend: Create ProjectDTO, MemberDTO, ProjectDetailDTO
3. Backend: Create ProjectRepository, ProjectMemberRepository with JPA queries
4. Backend: Create ProjectService with CRUD methods and updates-since logic
5. Backend: Create ProjectMemberService with role validation, last-admin check, and member limit validation
6. Backend: Create ProjectController with endpoints (GET list, GET detail, POST create, PATCH update, DELETE soft-delete)
7. Backend: Create ProjectMemberController with member endpoints (GET list, POST add, PATCH role, DELETE remove)
8. Backend: Add auto-membership logic in ProjectService.create() → auto-add creator as admin
9. Backend: Add member limit validation: COUNT(project_members WHERE project_id = ?) < max_project_members before adding
10. Backend: Add thread ownership transfer in ProjectMemberService.removeMember():
    - Query threads owned by removed user: SELECT id FROM desktop_threads WHERE owner_id = ? AND project_id = ?
    - Transfer ownership to project creator: UPDATE desktop_threads SET owner_id = (SELECT created_by FROM projects WHERE id = ?) WHERE id IN (...)
    - Send audit event to Holokai audit system for role change
11. Backend: Add transaction boundaries (@Transactional) to service methods
12. Integration tests → Verify CRUD, member management, role enforcement, member limit, thread ownership transfer

**E1-S5: Authorization Service Sequence**

1. Backend: Create AuthorizationService class
2. Backend: Create AccessDeniedException custom exception
3. Backend: Implement getUserRoleInProject() → Query project_members, check expires_at
4. Backend: Implement requireProjectAccess() → Get role, compare hierarchy (viewer < editor < owner), throw if insufficient
5. Backend: Implement requireThreadAccess() → Check thread type, if project → delegate to requireProjectAccess()
6. Backend: Implement requireThreadModify() → Check ownership/role based on thread type
7. Backend: Add request-scoped caching for role lookups (avoid repeated DB queries in single request)
8. Backend: Inject AuthorizationService into all controllers (ThreadController, ProjectController, etc.)
9. Backend: Add @PreAuthorize or manual checks before sensitive operations
10. Unit tests → Test all permission scenarios (viewer/editor/owner, personal/project, expired memberships)

## Non-Functional Requirements

### Performance

**Database Query Performance:**
- Thread list queries must complete in < 200ms for up to 10,000 threads per user (with pagination)
- Message list queries must complete in < 300ms for threads with up to 1,000 messages
- Project list queries must complete in < 150ms for up to 500 projects per user
- Member list queries must complete in < 100ms for projects with up to 100 members
- Authorization role lookups must complete in < 50ms (with request-scoped caching)

**API Endpoint Latency (p95):**
- GET /api/threads: < 250ms
- GET /api/threads/{id}: < 400ms (includes message tree)
- POST /api/threads/{id}/messages: < 500ms
- GET /api/projects: < 200ms
- POST /api/projects: < 300ms (includes auto-membership creation)
- GET /api/projects/{id}/members: < 150ms

**Database Connection Pool:**
- Min connections: 5
- Max connections: 20
- Connection timeout: 30 seconds
- Idle timeout: 10 minutes

**Index Strategy:**
- All foreign key columns must have indexes
- Composite indexes on (thread_id, created_at) for message ordering
- Partial indexes with WHERE deleted_at IS NULL for soft-deleted records
- Unique indexes on (thread_id, client_message_id) for idempotency

**Migration Performance:**
- Each Flyway migration must complete in < 5 minutes on databases with up to 100K threads
- Migrations must not lock tables for > 30 seconds (use concurrent indexes where possible)

### Security

**Authentication & Authorization:**
- All API endpoints require valid JWT bearer token in Authorization header
- JWT tokens must be validated on every request (signature, expiration, issuer)
- User ID extracted from JWT claims (`sub` field) for authorization checks
- AuthorizationService must verify project membership before any project resource access
- Personal threads accessible only by owner (user_id == JWT sub)
- Project threads require project membership with appropriate role (viewer/editor/owner)

**Role-Based Access Control (RBAC):**
- **Viewer role:** Read-only access to project threads, workflows, members list
- **Editor role:** Viewer + create threads, execute workflows, upload files
- **Owner role:** Editor + manage members, update project metadata, delete project
- Role hierarchy enforced: owner > editor > viewer
- Expired memberships (expires_at < current time) denied access

**Data Validation:**
- All input sanitized and validated before database operations
- SQL injection prevented via JPA parameterized queries (no string concatenation)
- Content length limits enforced: thread title (255 chars), message content (32KB), project name (200 chars)
- CHECK constraints in database enforce valid enum values (status, type, role)
- Foreign key constraints prevent orphaned records

**Sensitive Data:**
- No plaintext secrets in database or logs
- Message attachments metadata stored in JSONB (actual files in Storage Service)
- User emails visible only to project admins (not exposed to view/edit roles)
- Soft deletes preserve audit trail (deleted_at timestamp)

**API Security Headers:**
- CORS enabled for desktop app origin only
- Content-Type validation (application/json)
- Rate limiting: 100 requests/minute per user (via API gateway)
- HTTPS required for all API communication

### Reliability/Availability

**Database Reliability:**
- PostgreSQL 14+ with automatic failover (primary + standby replica)
- Target uptime: 99.9% (< 8.76 hours downtime per year)
- Backup strategy: Daily full backups, hourly incremental backups, 30-day retention
- Point-in-time recovery (PITR) within last 30 days

**API Reliability:**
- Moku API deployed with minimum 2 instances (horizontal scaling)
- Health check endpoint: GET /actuator/health (returns 200 if DB connection healthy)
- Circuit breaker pattern for external dependencies (Holo API, Storage Service)
- Graceful degradation: If authorization service fails, deny access (fail-safe)

**Data Integrity:**
- Foreign key constraints enforce referential integrity (CASCADE deletes for threads/messages, SET NULL for optional refs)
- Unique constraints prevent duplicate memberships (project_id, user_id)
- CHECK constraints validate data consistency (type/project_id alignment, role values, branch_index 0-2)
- Idempotency guarantees: Duplicate client_message_id returns existing message (no duplicate inserts)

**Error Handling:**
- All exceptions caught and returned as standardized JSON error responses (timestamp, status, error, message, errorCode, path)
- Database connection failures return 503 Service Unavailable
- Authorization failures return 403 Forbidden with clear message
- Validation failures return 400 Bad Request with field-level errors
- Not found errors return 404 Not Found

**Migration Rollback:**
- Every Flyway migration has tested rollback script
- Rollback scripts stored in version control (V2.1_rollback.sql, etc.)
- Rollback must complete within 2x migration time
- Production migrations require QA approval and tested rollback plan

### Observability

**Logging Requirements:**
- All API requests logged with: timestamp, user ID, endpoint, status code, duration (ms)
- Authorization decisions logged: "User {userId} granted/denied {role} access to project {projectId}"
- Database query slow logs enabled for queries > 500ms
- Error stack traces logged for all 5xx responses
- Migration execution logged with success/failure status and duration

**Metrics (Prometheus/Micrometer):**
- API endpoint latency histograms (p50, p95, p99)
- Database connection pool metrics (active, idle, waiting)
- Authorization cache hit rate
- Thread/message/project creation rates (per minute)
- Error rates by endpoint and status code (4xx, 5xx)
- Migration execution time and status

**Tracing (OpenTelemetry/Jaeger):**
- Distributed tracing for all API requests (trace ID, span ID)
- Spans for: HTTP request → Service method → Repository query → Database
- Trace context propagated to Holo API and Storage Service calls
- Trace IDs included in error responses for debugging

**Database Monitoring:**
- Query performance monitoring via pg_stat_statements
- Index usage statistics via pg_stat_user_indexes
- Table bloat monitoring (autovacuum effectiveness)
- Replication lag monitoring (standby replica)
- Connection count and wait events

**Required Log Signals:**
- `auth.access_granted` - User authorized for resource
- `auth.access_denied` - User denied access (includes reason)
- `db.migration.started` - Flyway migration started
- `db.migration.completed` - Flyway migration completed
- `db.migration.failed` - Flyway migration failed (includes error)
- `api.validation_error` - Request validation failed (includes field errors)
- `api.idempotent_hit` - Duplicate client_message_id detected

## Dependencies and Integrations

**Backend Dependencies (Moku API - Spring Boot):**

| Dependency | Version | Purpose | Notes |
|------------|---------|---------|-------|
| **Spring Boot** | 3.2+ | Backend framework | Web, JPA, Security modules |
| **Spring Data JPA** | 3.2+ | ORM layer | Entity/repository pattern |
| **Hibernate Envers** | 6.4+ | Entity audit history | Change tracking via @Audited annotation, creates audit tables in holokai_audit schema |
| **PostgreSQL Driver** | 42.7+ | Database connectivity | JDBC driver for PostgreSQL 14+ |
| **Flyway** | 10.x | Database migrations | Schema versioning (V2.1-V2.5) |
| **HikariCP** | 5.1+ | Connection pooling | Default Spring Boot connection pool |
| **Jackson** | 2.17+ | JSON serialization | DTO ↔ JSON conversion |
| **Spring Security** | 6.2+ | Authentication/Authorization | JWT validation, RBAC |
| **Lombok** | 1.18+ | Boilerplate reduction | @Data, @Builder annotations |
| **Micrometer** | 1.13+ | Metrics collection | Prometheus integration |
| **Logback** | 1.5+ | Logging framework | SLF4J implementation |
| **JUnit 5** | 5.10+ | Unit testing | @SpringBootTest integration |
| **Mockito** | 5.x | Mocking framework | Service/repository mocking |
| **Testcontainers** | 1.19+ | Integration testing | PostgreSQL container for tests |

**Database:**

| Component | Version | Purpose |
|-----------|---------|---------|
| **PostgreSQL** | 14+ | Primary database | ACID compliance, JSONB support |
| **pg_stat_statements** | Extension | Query monitoring | Performance analysis |

**Desktop Application (Indirect Integration):**

This desktop project (Electron + Svelte) consumes the Moku API endpoints created in Epic 1. No changes to desktop dependencies required for Epic 1, but the following existing packages enable API communication:

| Dependency | Version | Purpose |
|------------|---------|---------|
| **Electron** | 39.x | Desktop framework | Main process API client |
| **TypeScript** | 5.9+ | Type safety | DTO interfaces for API responses |

**External Service Integrations:**

| Service | Integration Point | Protocol | Purpose |
|---------|------------------|----------|---------|
| **Holo API** | Not used in Epic 1 | HTTP/REST | LLM prompt execution (Epic 2+) |
| **Storage Service** | Not used in Epic 1 | HTTP/REST | File upload/download (Epic 5) |
| **SSO Provider** | JWT validation | OAuth 2.0/OIDC | User authentication (existing) |

**Migration Scripts Dependencies:**

- Flyway CLI or Maven plugin for migration execution
- PostgreSQL 14+ client tools (psql) for manual verification
- Version control (Git) for migration script tracking

**Testing Dependencies:**

- PostgreSQL Testcontainers for integration tests
- H2 Database (optional) for fast unit tests of repository layer
- Spring Boot Test for controller/service integration tests
- RestAssured or MockMvc for API endpoint testing

**Build & Deployment:**

| Tool | Purpose |
|------|---------|
| **Maven** or **Gradle** | Build automation for Moku API |
| **Docker** | Containerization (Moku API + PostgreSQL) |
| **Kubernetes** (optional) | Orchestration for multi-instance deployment |

**Version Constraints:**

- Java 17+ required (Spring Boot 3.2 baseline)
- PostgreSQL 14+ required (JSONB improvements, performance)
- Node.js 20+ for desktop app (not affected by Epic 1)

**Known Compatibility Notes:**

- Flyway 10.x compatible with PostgreSQL 14-16
- Spring Boot 3.2 requires Java 17 minimum (not compatible with Java 11)
- HikariCP max pool size should not exceed PostgreSQL max_connections (default 100)
- Jackson JSONB serialization requires @Type(JsonBinaryType.class) annotation in Hibernate entities

## Acceptance Criteria (Authoritative)

**E1-S1: Database Schema Migration**

1. All V2.1-V2.5 Flyway migrations execute successfully on a clean PostgreSQL 14+ database
2. All V2.1-V2.5 migrations execute successfully on existing Phase 1 database with backward compatibility
3. Schema after migrations exactly matches database-schema-2025-11-25.md §2-5 (all tables, columns, constraints, indexes)
4. Rollback scripts for V2.1-V2.5 successfully revert schema changes without data loss (tested on dev database)
5. All CHECK constraints enforce valid enum values (status, type, role, branch_index)
6. All foreign key constraints correctly cascade deletes or set NULL as specified
7. All indexes exist on foreign key columns and frequently queried fields (type, status, updated_at, project_id)
8. Unique indexes prevent duplicate memberships and idempotent message IDs

**E1-S2: Thread API Updates**

9. ThreadDTO includes new fields: type, ownerId, projectId, createdBy (per API §3.1)
10. GET /api/threads?type=personal returns only personal threads (project_id IS NULL)
11. GET /api/threads?type=project returns only project threads (project_id IS NOT NULL)
12. GET /api/threads?projectId={uuid} returns threads for specific project only
13. POST /api/threads with projectId creates project thread (type='project', project_id set)
14. POST /api/threads without projectId creates personal thread (type='personal', project_id NULL)
15. Personal threads accessible only by owner (user_id matches JWT sub)
16. Project threads require project membership (AuthorizationService enforces view role minimum)
17. Thread list pagination works correctly (page, size parameters, totalElements count accurate)

**E1-S3: Message API Updates**

18. MessageDTO includes new fields: parentMessageId, branchIndex, attachments, clientMessageId (per API §3.5)
19. POST /api/threads/{id}/messages accepts parentMessageId and branchIndex in request body
20. First message in thread can have null parentMessageId (root message)
21. Subsequent messages require valid parentMessageId that exists in same thread (validation error if invalid)
22. Branch index 0-2 accepted, values 3+ rejected with error "Maximum retry branches reached"
23. Duplicate clientMessageId returns existing message with 200 OK (idempotent, not 201 Created)
24. Attachments array serialized/deserialized correctly from JSONB [{fileId, filename, mimeType, sizeBytes}]
25. GET /api/threads/{id}/messages returns messages ordered by created_at for tree reconstruction

**E1-S4: Project API Implementation**

26. POST /api/projects automatically adds creator as owner member (per PROJ §7.1)
27. GET /api/projects returns only projects where user is a member (membership filter)
28. GET /api/projects/{id} includes userRole field (viewer/editor/owner) for current user
29. PATCH /api/projects/{id} requires owner role (403 Forbidden if editor or viewer role)
30. DELETE /api/projects/{id} soft deletes project (sets deleted_at timestamp, requires owner role)
31. POST /api/projects/{id}/members requires owner role (403 if not owner)
32. PATCH /api/projects/{id}/members/{id} (change role) requires owner role
33. DELETE /api/projects/{id}/members/{id} prevents removing last owner (validation error: "Cannot remove last owner")
34. GET /api/projects/{id}/updates?since={timestamp} returns counts (threadsUpdated, membersUpdated, workflowsUpdated)
35. Member roles enforced on all operations per PROJ §2.4 (viewer: read only, editor: create, owner: manage)

**E1-S5: Authorization Service**

36. getUserRoleInProject(projectId, userId) returns 'viewer', 'editor', 'owner', or null (not member)
37. Expired memberships (expires_at < current time) return null from getUserRoleInProject()
38. requireProjectAccess(projectId, userId, 'viewer') allows viewer/editor/owner roles
39. requireProjectAccess(projectId, userId, 'editor') allows editor/owner roles only (denies viewer)
40. requireProjectAccess(projectId, userId, 'owner') allows owner role only
41. requireThreadAccess() for personal thread checks owner_id == userId
42. requireThreadAccess() for project thread delegates to requireProjectAccess() with 'viewer' role
43. AccessDeniedException thrown when insufficient permissions (caught by controller, returns 403 with clear message)
44. Authorization decisions logged with user ID, project ID, role, and grant/deny result

**E1-S1: Database Schema Migration (Additional Criteria for Resolved Decisions)**

45. Project member limit enforced: POST /api/projects/{id}/members fails with 400 when COUNT(project_members WHERE project_id = ?) >= max_project_members (default: 100)
46. Thread ownership transfer on member removal: DELETE /api/projects/{id}/members/{memberId} transfers all owned threads (owner_id = removed_user_id) to project creator (created_by)
47. Role change audit events sent to Holokai audit system with format: {event: 'project.member.role_changed', actorId, targetUserId, projectId, oldRole, newRole, timestamp}
48. Branch index auto-assigned by backend: POST /api/threads/{id}/messages with parentMessageId auto-calculates branchIndex = COUNT(existing branches for parent) without client specifying
49. File migration two-phase commit: Phase 1 uploads to storage service and waits for confirmation before Phase 2 (database update + local file delete)
50. File migration rollback on failure: If Phase 2 fails, sends DELETE request to storage service with transaction ID to remove uploaded files from Phase 1

## Traceability Mapping

| AC# | Acceptance Criteria | Spec Section(s) | Component(s)/API(s) | Test Strategy |
|-----|---------------------|-----------------|---------------------|---------------|
| 1 | Clean DB migrations succeed | Data Models §2.1-2.2, §3.1-3.2, §4.1-4.3 | Flyway migrations V2.1-V2.5 | Integration: Run Flyway on empty DB, verify schema |
| 2 | Phase 1 DB migrations succeed | Data Models §2.1-2.2 | Flyway migrations V2.1-V2.5 | Integration: Seed Phase 1 data, run migrations, verify no errors |
| 3 | Schema matches spec exactly | Data Models §2.1-2.2, §3.1-3.2, §4.1-4.3 | PostgreSQL schema | Integration: Compare pg_dump output to spec DDL |
| 4 | Rollback scripts work | Workflows §E1-S1 step 8-9 | Rollback scripts V2.1-V2.5 | Integration: Apply migration, rollback, verify original state |
| 5 | CHECK constraints enforce enums | Data Models §2.1 constraints | desktop_threads, desktop_messages, projects, project_members | Unit: Attempt invalid enum insert, expect constraint violation |
| 6 | FK cascades/set null work | Data Models §2.1-2.2 FK constraints | All tables with FKs | Integration: Delete parent, verify child cascade/null behavior |
| 7 | All indexes exist | Data Models §2.1-2.2 indexes | All tables | Integration: Query pg_indexes, verify all listed indexes present |
| 8 | Unique indexes prevent duplicates | Data Models §2.2 unique index, §3.2 unique constraints | desktop_messages, project_members | Unit: Attempt duplicate insert, expect unique violation |
| 9 | ThreadDTO has new fields | APIs §3.1 Response | ThreadDTO, ThreadMapper | Unit: Serialize ThreadEntity, verify DTO fields |
| 10 | Type filter personal works | APIs §3.1 Query Params | ThreadController, ThreadRepository | Integration: GET /api/threads?type=personal, verify only personal returned |
| 11 | Type filter project works | APIs §3.1 Query Params | ThreadController, ThreadRepository | Integration: GET /api/threads?type=project, verify only project returned |
| 12 | ProjectId filter works | APIs §3.1 Query Params | ThreadController, ThreadRepository | Integration: GET /api/threads?projectId=X, verify only project X threads |
| 13 | Create project thread works | APIs §3.1 POST /api/threads | ThreadController, ThreadService | Integration: POST with projectId, verify type='project', project_id set |
| 14 | Create personal thread works | APIs §3.1 POST /api/threads | ThreadController, ThreadService | Integration: POST without projectId, verify type='personal', project_id NULL |
| 15 | Personal thread auth enforced | Security §RBAC, Authorization Service | AuthorizationService.requireThreadAccess() | Integration: GET personal thread as other user, expect 403 |
| 16 | Project thread auth enforced | Security §RBAC, Authorization Service | AuthorizationService.requireThreadAccess() | Integration: GET project thread as non-member, expect 403 |
| 17 | Thread pagination works | APIs §3.1 Query Params | ThreadController | Integration: Create 100 threads, GET page=0&size=50, verify 50 returned |
| 18 | MessageDTO has new fields | APIs §3.5 Request/Response | MessageDTO, MessageMapper | Unit: Serialize MessageEntity, verify DTO fields |
| 19 | POST message accepts branching | APIs §3.5 POST Request | MessageController, MessageService | Integration: POST with parentMessageId, branchIndex, verify stored |
| 20 | Root message allows null parent | Data Models §2.2 constraints | MessageService validation | Integration: POST first message with null parentMessageId, expect 201 |
| 21 | Non-root requires valid parent | Data Models §2.2 FK constraint | MessageService validation | Integration: POST with invalid parentMessageId, expect 400 validation error |
| 22 | Branch index 0-2 accepted, 3+ rejected | Data Models §2.2 CHECK constraint | MessageService validation | Unit: POST with branchIndex=3, expect 400 error "Maximum retry branches" |
| 23 | Idempotency on clientMessageId | APIs §3.5 Idempotency, Workflows §E1-S3 step 7 | MessageService idempotency check | Integration: POST twice with same clientMessageId, second returns 200 (existing) |
| 24 | Attachments JSONB serialization | Data Models §2.2 attachments JSONB | MessageEntity, Jackson serialization | Unit: Save message with attachments array, read back, verify structure |
| 25 | Messages ordered by created_at | APIs §3.3 Response | MessageRepository.findByThreadId() | Integration: GET /api/threads/{id}/messages, verify ascending created_at order |
| 26 | Creator auto-added as owner | Workflows §E1-S4 step 8 | ProjectService.create() | Integration: POST /api/projects, verify creator in project_members with role='owner' |
| 27 | Projects list filters by membership | APIs §4.1 GET /api/projects | ProjectController, ProjectRepository | Integration: Create project, GET as non-member, expect empty list |
| 28 | Project detail includes userRole | APIs §4.2 Response | ProjectController, AuthorizationService | Integration: GET /api/projects/{id}, verify userRole field present |
| 29 | Update requires owner | Security §RBAC owner permissions | ProjectController, AuthorizationService | Integration: PATCH as editor role, expect 403 |
| 30 | Delete soft deletes (owner only) | APIs §4.5 DELETE, Reliability §Data Integrity | ProjectController, ProjectService | Integration: DELETE as owner, verify deleted_at set (not hard delete) |
| 31 | Add member requires owner | Security §RBAC owner permissions | ProjectMemberController, AuthorizationService | Integration: POST member as editor role, expect 403 |
| 32 | Change role requires owner | Security §RBAC owner permissions | ProjectMemberController, AuthorizationService | Integration: PATCH member role as editor role, expect 403 |
| 33 | Cannot remove last owner | Workflows §E1-S4 step 5, APIs §5.4 | ProjectMemberService validation | Integration: DELETE only owner member, expect 400 validation error |
| 34 | Updates endpoint returns counts | APIs §4.9 Response | ProjectController, ProjectService | Integration: Update threads, GET /updates?since=T, verify threadsUpdated count |
| 35 | Role enforcement on operations | Security §RBAC, Overview §Objectives | All controllers with AuthorizationService | Integration: Test matrix (viewer/editor/owner × operations), verify permissions |
| 36 | getUserRoleInProject returns roles | Authorization Service Interface | AuthorizationService.getUserRoleInProject() | Unit: Mock membership, verify role returned (viewer/editor/owner/null) |
| 37 | Expired memberships denied | Security §RBAC expired rule | AuthorizationService.getUserRoleInProject() | Unit: Mock expired membership (expires_at < now), verify null returned |
| 38 | Viewer role allows view operations | Security §RBAC role hierarchy | AuthorizationService.requireProjectAccess() | Unit: requireAccess(projectId, userId, 'viewer') with viewer role, expect pass |
| 39 | Editor role denies viewer-only | Security §RBAC role hierarchy | AuthorizationService.requireProjectAccess() | Unit: requireAccess(projectId, userId, 'editor') with viewer role, expect exception |
| 40 | Owner role required for owner ops | Security §RBAC role hierarchy | AuthorizationService.requireProjectAccess() | Unit: requireAccess(projectId, userId, 'owner') with editor role, expect exception |
| 41 | Personal thread owner check | Authorization Service Interface | AuthorizationService.requireThreadAccess() | Unit: Mock personal thread, verify owner_id == userId check |
| 42 | Project thread delegates to project | Authorization Service Interface | AuthorizationService.requireThreadAccess() | Unit: Mock project thread, verify delegation to requireProjectAccess() |
| 43 | AccessDeniedException returns 403 | Security §API Security, Error Response Format | @ExceptionHandler in controllers | Integration: Trigger auth failure, verify 403 response with errorCode |
| 44 | Auth decisions logged | Observability §Required Log Signals | AuthorizationService logging | Integration: Trigger auth grant/deny, verify logs contain auth.access_granted/denied |
| 45 | Project member limit enforced | Open Questions §Q1 Decision | ProjectMemberService validation | Integration: Add 100 members, attempt 101st, expect 400 "Member limit exceeded" |
| 46 | Thread ownership transfer | Open Questions §Q2 Decision, Workflows §E1-S4 step 10 | ProjectMemberService.removeMember() | Integration: Create threads as user, remove user from project, verify owner_id = project.created_by |
| 47 | Audit events to Holokai | Open Questions §Q4 Decision | ProjectMemberService, HolokaiAuditClient | Integration: Change member role, verify audit event sent with correct format |
| 48 | Branch index auto-assigned | Open Questions §Q5 Decision | MessageService.createMessage() | Integration: POST message without branchIndex, verify backend calculates COUNT(siblings) |
| 49 | Two-phase migration commit | Open Questions §Q6 Decision | MigrationService (Epic 5) | Integration: Upload files, verify DB update only after storage confirmation |
| 50 | Migration rollback on failure | Open Questions §Q6 Decision | MigrationService (Epic 5) | Integration: Simulate Phase 2 failure, verify DELETE sent to storage service |

## Risks, Assumptions, Open Questions

**Risks:**

1. **[RISK - Medium]** Database migration on production with 100K+ existing threads may exceed 5-minute target window
   - *Mitigation:* Test migrations on production-sized dataset clone, use concurrent indexes (CREATE INDEX CONCURRENTLY) to avoid table locks

2. **[RISK - Medium]** Backward compatibility breaking if Phase 1 desktop app calls updated API before deploying Phase 2 app
   - *Mitigation:* Ensure API changes are additive only (new fields optional), deploy Moku API first, then desktop app

3. **[RISK - Low]** Authorization service performance impact if role lookups hit database on every request
   - *Mitigation:* Implement request-scoped caching (Spring @RequestScope bean), cache invalidation on member role changes

4. **[RISK - High]** Branch index validation logic may have edge cases (concurrent requests creating duplicate branch indexes)
   - *Mitigation:* Use database-level unique constraint on (parent_message_id, branch_index) to prevent duplicates, handle constraint violation gracefully

5. **[RISK - Medium]** Idempotency check on client_message_id may fail if desktop retries before first request commits (race condition)
   - *Mitigation:* Use READ COMMITTED isolation level, retry logic with exponential backoff on unique constraint violations

6. **[RISK - Low]** JSONB query performance on attachments metadata if users attach many files
   - *Mitigation:* Add GIN index on attachments JSONB column if query performance degrades (monitor slow query log)

7. **[RISK - Medium]** Flyway rollback scripts may not handle data transformations correctly (e.g., new columns with non-null constraints)
   - *Mitigation:* Test rollback scripts with realistic data, document data loss scenarios in rollback notes

**Assumptions:**

1. **[ASSUMPTION]** Moku API backend exists and is running Spring Boot 3.2+ on Java 17+
   - *Validation:* Confirm with backend team, review existing codebase structure

2. **[ASSUMPTION]** PostgreSQL database is version 14+ with Flyway migrations already configured
   - *Validation:* Check database version (SELECT version()), verify Flyway integration in build config

3. **[ASSUMPTION]** JWT authentication is already implemented and provides user ID in `sub` claim
   - *Validation:* Review existing authentication code, test JWT token parsing

4. **[ASSUMPTION]** Desktop app will be updated in Epic 2+ to consume new API fields (type, owner_id, project_id)
   - *Validation:* Coordinate with desktop team, ensure backward compatibility if desktop lags backend deployment

5. **[ASSUMPTION]** Storage Service integration for file attachments is out of scope for Epic 1 (only metadata stored)
   - *Validation:* Confirmed in Epic scope (Epic 5 handles file upload/download)

6. **[ASSUMPTION]** Organization-level project membership (organization_id in project_members) is future work, not MVP
   - *Validation:* PRD review confirms user-level membership is sufficient for Phase 2

7. **[ASSUMPTION]** Max 3 retry branches per message is sufficient for user needs (branch_index 0-2)
   - *Validation:* Product team confirmation, can increase limit in future if needed (schema change + validation update)

**Open Questions:**

~~1. **[QUESTION]** Should we enforce a maximum project member count (e.g., 100 members per project) for performance?~~
   - **DECISION:** YES - System-configurable limit of 100 "members" (individuals or organization groups) per project
   - **Decided by:** Product/Architecture review (2025-11-27)
   - **Rationale:** Projects can have either members OR organization groups. Moku maintains organization structure and membership; Desktop will use that. 100-member limit provides reasonable scale while maintaining performance.
   - **Implementation:**
     - Add `max_project_members` system configuration (default: 100)
     - Project members can be individual users OR organization groups
     - Validation: `COUNT(project_members WHERE project_id = ?) < max_project_members` before adding member/group
     - Organization groups expand to individual users for access control (handled by Moku)

~~2. **[QUESTION]** What happens to project threads when a user is removed from a project? Hide or maintain read-only access?~~
   - **DECISION:** Transfer thread ownership to project creator
   - **Decided by:** Product review (2025-11-27)
   - **Rationale:** Project threads must always be accessible to the project. Thread ownership should be updated to the project creator (every project must have a creator). This ensures threads remain accessible and attributable even when original author leaves.
   - **Implementation:**
     - Every project has a `creator_id` field (immutable)
     - When user removed from project: `UPDATE desktop_threads SET owner_id = (SELECT creator_id FROM projects WHERE id = ?) WHERE owner_id = ? AND project_id = ?`
     - Threads remain visible to all project members with appropriate access

~~3. **[QUESTION]** Should expired memberships (expires_at < now) be soft-deleted automatically, or just denied access?~~
   - **DECISION:** Expiration handled in Moku; expired assets remain accessible to project members
   - **Decided by:** Architecture review (2025-11-27)
   - **Rationale:** Expired members (inactive logins for configurable period of days) will be disabled in Moku where expiration is handled. Desktop will attempt to log expired user in, and Moku will fail the login with appropriate message. In a project, expired user's assets (threads, messages) remain accessible to the project members.
   - **Implementation:**
     - Moku handles user expiration/disabling (not Desktop concern)
     - Desktop login attempt → Moku returns 401 with message "Account expired after X days of inactivity"
     - Expired user's threads/messages remain in project (not deleted)
     - No Desktop-side expiration logic needed

~~4. **[QUESTION]** Do we need audit logging for member role changes (who changed whose role from X to Y)?~~
   - **DECISION:** YES - Audit changes go to existing Holokai audit system
   - **Decided by:** Security review (2025-11-27)
   - **Rationale:** Role changes are security-relevant events requiring audit trail for compliance
   - **Implementation:**
     - Send audit events to existing Holokai audit system (via Moku API)
     - Event format: `{ event: 'project.member.role_changed', actorId, targetUserId, projectId, oldRole, newRole, timestamp }`
     - No new audit_log table needed; use existing audit infrastructure

~~5. **[QUESTION]** Should branch_index be auto-assigned by backend (find next available) or specified by client?~~
   - **DECISION:** Auto-assign by backend
   - **Decided by:** Architecture review (2025-11-27)
   - **Rationale:** Backend auto-assignment prevents race conditions in concurrent branch creation; simpler than client-specified with conflict resolution
   - **Implementation:** `branchIndex = (SELECT COUNT(*) FROM desktop_messages WHERE parent_message_id = ? AND role = 'user')`

~~6. **[QUESTION]** What's the rollback procedure if a migration fails mid-execution on production?~~
   - **DECISION:** Two-phase commit: verify storage service upload before deleting local files
   - **Decided by:** Architecture review (2025-11-27)
   - **Rationale:** Migration structured to remove local files ONLY AFTER storage service confirms new ones migrated. Failure triggers rollback command to storage service to remove migrated files from last migration transaction.
   - **Implementation:**
     - **Phase 1:** Upload files to storage service → Wait for confirmation with file IDs
     - **Phase 2:** Update database with storage URLs → Delete local files
     - **Rollback on failure:** Send DELETE request to storage service with transaction ID to remove uploaded files from Phase 1
     - Transaction log: `migration_transactions` table tracks each migration attempt (transaction_id, file_count, status, rollback_completed)

## Test Strategy Summary

**Testing Pyramid Breakdown:**

| Test Level | Coverage Target | Tools | Focus Areas |
|------------|----------------|-------|-------------|
| **Unit Tests** | 80% code coverage | JUnit 5, Mockito | Service logic, AuthorizationService, validation, mappers |
| **Integration Tests** | All API endpoints, DB operations | Spring Boot Test, Testcontainers | Controllers, repositories, migrations, end-to-end flows |
| **Contract Tests** | All API endpoints | Spring REST Docs or Pact | Request/response schemas, error formats |
| **Performance Tests** | Critical paths (thread list, message create) | JMeter or Gatling | Latency targets (p95), connection pool behavior |
| **Security Tests** | All authorization paths | Custom test harness | RBAC enforcement, expired memberships, 403 responses |

**Unit Test Coverage (Service/Repository Layer):**

- **AuthorizationService:**
  - Test all role hierarchy combinations (viewer/editor/owner)
  - Test expired membership handling (expires_at < now → null)
  - Test personal vs. project thread authorization paths
  - Mock ProjectMemberRepository to control test data

- **MessageService:**
  - Branch validation logic (count existing branches, reject if ≥3)
  - Idempotency check (duplicate client_message_id returns existing)
  - Parent message validation (must exist, must be in same thread)
  - JSONB attachments serialization/deserialization

- **ProjectService:**
  - Auto-membership creation (creator → owner role)
  - Updates-since query logic (count changes after timestamp)
  - Soft delete (sets deleted_at, not hard delete)

- **ProjectMemberService:**
  - Last owner check (prevent removing only owner)
  - Role change validation (viewer → editor → owner hierarchy)
  - Duplicate membership prevention (unique constraint)
  - Member limit validation (100-member limit enforcement)
  - Thread ownership transfer logic (transfer to project creator on member removal)
  - Audit event generation (send to Holokai audit system on role changes)

**Integration Test Coverage (Controller/DB Layer):**

- **Migration Tests:**
  - Run V2.1-V2.5 on empty DB → verify schema matches spec
  - Run V2.1-V2.5 on Phase 1 seeded DB → verify no errors, backward compatibility
  - Run rollback scripts → verify original state restored
  - Verify all constraints (CHECK, FK, UNIQUE) enforce correctly

- **Thread API Tests:**
  - GET /api/threads with type/projectId filters → verify correct filtering
  - POST /api/threads with/without projectId → verify type set correctly
  - Authorization: personal thread access (owner only), project thread access (member only)
  - Pagination: create 100 threads, request page 0-4 size 20, verify counts

- **Message API Tests:**
  - POST message with branching (parentMessageId, branchIndex) → verify stored
  - POST with branchIndex=3 → expect 400 error
  - POST duplicate clientMessageId → second request returns 200 with existing message
  - POST message without branchIndex → verify backend auto-calculates branchIndex = COUNT(siblings)
  - POST concurrent messages with same parent → verify unique branch indexes assigned (no duplicates)
  - GET messages → verify ordered by created_at

- **Project API Tests:**
  - POST /api/projects → verify creator auto-added as owner
  - GET /api/projects as non-member → expect empty list
  - PATCH/DELETE as non-owner → expect 403
  - POST member, PATCH role, DELETE member → verify RBAC enforcement
  - DELETE last owner → expect 400 validation error
  - POST 101st member → expect 400 "Member limit exceeded" (100-member limit)
  - DELETE member with owned threads → verify threads transferred to project creator (owner_id updated)
  - PATCH member role → verify audit event sent to Holokai system with correct format

- **Authorization Tests:**
  - Test matrix: (viewer/editor/owner role) × (read/create/update/delete operations) → verify permissions
  - Test expired membership (expires_at < now) → expect 403
  - Test non-member access → expect 403
  - Note: User account expiration (inactive logins) handled by Moku authentication layer (Desktop receives 401 on login attempt, not tested here)

**Contract Test Coverage:**

- Document all request/response schemas with Spring REST Docs
- Validate error response format (timestamp, status, error, message, errorCode, path)
- Ensure backward compatibility with Phase 1 API (existing fields unchanged)

**Performance Test Scenarios:**

1. **Thread List Query:**
   - Setup: 10,000 threads per user
   - Test: GET /api/threads?page=0&size=50
   - Target: p95 < 250ms

2. **Message Creation:**
   - Setup: Thread with 1,000 existing messages
   - Test: POST /api/threads/{id}/messages
   - Target: p95 < 500ms

3. **Authorization Lookup:**
   - Setup: User in 50 projects
   - Test: Authorization service role lookup
   - Target: < 50ms with request-scoped caching

4. **Project Member List:**
   - Setup: Project with 100 members
   - Test: GET /api/projects/{id}/members
   - Target: p95 < 150ms

**Security Test Scenarios:**

- Attempt to access personal thread as different user → expect 403
- Attempt to access project thread as non-member → expect 403
- Attempt to create project thread without project membership → expect 403
- Attempt to update project as edit role → expect 403 (requires admin)
- Attempt to remove last admin from project → expect 400 validation error
- Test with expired JWT token → expect 401 Unauthorized
- Test with valid JWT but expired membership → expect 403

**Test Data Strategy:**

- Use Testcontainers for PostgreSQL in integration tests (isolated, repeatable)
- Seed Phase 1 test data (users, threads, messages) for backward compatibility tests
- Use fixture builders for complex entity graphs (Project → Members → Threads → Messages)
- Randomized UUID generation for realistic test data

**Continuous Integration:**

- All tests run on every commit (CI pipeline)
- Migration tests run against PostgreSQL 14, 15, 16 (version matrix)
- Code coverage report generated (fail build if < 80% for new code)
- Security scan for SQL injection vulnerabilities (static analysis)

**Manual Testing Checklist (Pre-Production):**

- [ ] Run migrations on production-sized database clone, measure duration
- [ ] Test rollback scripts on staging environment
- [ ] Verify API endpoints with Postman/Insomnia (sample requests)
- [ ] Test concurrent message creation (same parent, different branch indexes)
- [ ] Load test with realistic user traffic (100 concurrent users)
- [ ] Review all logged authorization decisions (audit trail verification)
- [ ] Test 100-member project limit (add members until limit, verify 101st rejected)
- [ ] Test thread ownership transfer (remove member with owned threads, verify transfer to creator)
- [ ] Verify audit events sent to Holokai system on role changes (check audit system logs)
- [ ] Test auto-assigned branch_index (POST messages without branchIndex, verify sequential assignment)
- [ ] Test two-phase file migration (Epic 5): Upload → confirm → database update → local delete
- [ ] Test migration rollback (Epic 5): Simulate Phase 2 failure, verify storage service rollback called

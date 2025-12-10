# Story 7.1: Workflow API Endpoints

Status: ready-for-dev

## Story

As a Holokai Desktop backend developer,
I want REST API endpoints for workflow management (CRUD, fork, execute, history),
so that the desktop client can persist and retrieve workflow definitions and execution records from the Moku API backend.

## Acceptance Criteria

1. **AC-1.1**: `GET /api/workflows` returns paginated workflow list with filters (scope, projectId)
   - Supports query parameters: `scope` (personal/project/organization), `projectId` (UUID), `page` (int, default 0), `size` (int, default 20)
   - Returns `Page<WorkflowDTO>` with workflow metadata (id, name, description, scope, execution_count, last_executed_at)
   - Filters workflows by authenticated user's ownership or project membership
   - Respects RBAC: users can only list workflows they own or are project members of

2. **AC-1.2**: `GET /api/workflows/{id}` returns workflow with full definition (inputs, steps, outputs, capabilities)
   - Returns `WorkflowDTO` with complete `WorkflowDefinitionDTO` (inputs, steps, outputs, capabilities)
   - Returns 404 if workflow not found or user lacks access
   - Returns 200 with workflow object if authorized

3. **AC-1.3**: `POST /api/workflows` creates workflow with validation (required fields, JWT owner_id)
   - Accepts `CreateWorkflowRequest` with name, description, scope, projectId (optional), definition
   - Validates required fields: name (max 200 chars), scope (enum), definition (valid JSON structure)
   - Sets `owner_id` from JWT authentication (authenticated user)
   - Returns 201 with created `WorkflowDTO` including generated id and timestamps
   - Returns 400 if validation fails (e.g., missing name, invalid scope, malformed definition)

4. **AC-1.4**: `PATCH /api/workflows/{id}` updates workflow (only owner or admin can update)
   - Accepts `UpdateWorkflowRequest` with name, description, definition (all optional)
   - Only allows owner or project admin to update (RBAC enforcement)
   - Updates `updated_at` timestamp
   - Returns 200 with updated `WorkflowDTO`
   - Returns 403 if user is not owner or admin
   - Returns 404 if workflow not found

5. **AC-1.5**: `DELETE /api/workflows/{id}` soft deletes workflow (sets deleted_at timestamp)
   - Sets `deleted_at` timestamp (soft delete, preserves data for audit)
   - Only allows owner or project admin to delete (RBAC enforcement)
   - Returns 204 No Content on success
   - Returns 403 if user is not owner or admin
   - Returns 404 if workflow not found or already deleted

6. **AC-1.6**: `POST /api/workflows/{id}/fork` creates copy with forked_from reference
   - Copies workflow definition from source workflow
   - Sets `forked_from` field to original workflow id
   - Sets `owner_id` to authenticated user (forker becomes owner)
   - Resets `execution_count` to 0 and `last_executed_at` to null
   - Returns 201 with new `WorkflowDTO`
   - Returns 404 if source workflow not found

7. **AC-1.7**: `POST /api/workflows/{id}/execute` creates execution record (does NOT run synchronously)
   - Accepts `Map<String, Object>` inputs in request body
   - Creates `workflow_executions` record with status='queued'
   - Stores inputs in `inputs` JSONB column
   - Returns 201 with `WorkflowExecutionDTO` (id, workflowId, status='queued', startedAt)
   - Desktop client handles actual execution asynchronously
   - Returns 400 if inputs validation fails (missing required inputs)

8. **AC-1.8**: `GET /api/workflows/{id}/executions` returns paginated execution history with status filter
   - Returns `Page<WorkflowExecutionDTO>` with execution records for specified workflow
   - Supports query parameters: `status` (queued/running/completed/failed/cancelled), `page`, `size`
   - Orders by `started_at DESC` (most recent first)
   - Returns 200 with paginated list (empty list if no executions)
   - Returns 404 if workflow not found or user lacks access

9. **AC-1.9**: All endpoints enforce RBAC (only owner/admin can edit, delete; all project members can view)
   - GET endpoints: Allow if user is owner OR project member (for project-scoped workflows)
   - POST/PATCH/DELETE endpoints: Allow if user is owner OR project admin
   - Personal workflows: Only owner can access
   - Returns 403 Forbidden if RBAC check fails

## Tasks / Subtasks

- [ ] Create database schema migration (AC: #1.1-1.8)
  - [ ] Create `workflows` table with columns: id (UUID), owner_id (UUID FK), project_id (UUID FK nullable), name (VARCHAR 200), description (TEXT), scope (VARCHAR 50), is_template (BOOLEAN), forked_from (UUID FK nullable), definition (JSONB), created_at, updated_at, deleted_at, execution_count (INT), last_executed_at (TIMESTAMP)
  - [ ] Add indexes: `idx_workflows_owner`, `idx_workflows_project`, `idx_workflows_scope`
  - [ ] Add constraints: `workflows_project_scope_check` (personal workflows have null project_id, project/org workflows require project_id)
  - [ ] Create `workflow_executions` table with columns: id (UUID), workflow_id (UUID FK), user_id (UUID FK), thread_id (UUID FK nullable), status (VARCHAR 50), started_at, completed_at, inputs (JSONB), outputs (JSONB), execution_trace (JSONB), error_message (TEXT), duration_ms (INT)
  - [ ] Add indexes: `idx_executions_workflow`, `idx_executions_user`, `idx_executions_status`, `idx_executions_started_at`
  - [ ] Add constraints: `execution_completed_at_check` (completed/failed/cancelled must have completed_at)
  - [ ] Write Liquibase/Flyway migration file in `src/main/resources/db/migration/`
  - [ ] Test migration applies successfully on clean database

- [ ] Create DTOs for request/response objects (AC: #1.1-1.8)
  - [ ] Create `WorkflowDTO` record with all workflow fields (id, ownerId, projectId, name, description, scope, isTemplate, forkedFrom, definition, createdAt, updatedAt, executionCount, lastExecutedAt)
  - [ ] Create `WorkflowDefinitionDTO` record (inputs, steps, outputs, capabilities)
  - [ ] Create `WorkflowInputDTO`, `WorkflowStepDTO`, `WorkflowOutputDTO` records
  - [ ] Create `CreateWorkflowRequest` record (name, description, scope, projectId, definition)
  - [ ] Create `UpdateWorkflowRequest` record (name, description, definition - all optional)
  - [ ] Create `WorkflowExecutionDTO` record (id, workflowId, userId, threadId, status, startedAt, completedAt, inputs, outputs, executionTrace, errorMessage, durationMs)
  - [ ] Create `ExecutionStepTraceDTO` record (stepId, stepName, status, startedAt, completedAt, output, error, durationMs)
  - [ ] Add Jackson annotations for JSON serialization (@JsonProperty, @JsonFormat for dates)

- [ ] Create JPA entity classes (AC: #1.1-1.8)
  - [ ] Create `Workflow` entity with @Entity annotation, map to `workflows` table
  - [ ] Add @Id @GeneratedValue for id field (UUID)
  - [ ] Add @ManyToOne for ownerId → User entity
  - [ ] Add @ManyToOne for projectId → Project entity (nullable)
  - [ ] Add @Type(JsonType.class) for definition JSONB column (Hibernate JSON type)
  - [ ] Add @CreationTimestamp, @UpdateTimestamp for timestamps
  - [ ] Create `WorkflowExecution` entity with @Entity annotation, map to `workflow_executions` table
  - [ ] Add @ManyToOne for workflowId → Workflow entity
  - [ ] Add @Type(JsonType.class) for inputs, outputs, executionTrace JSONB columns
  - [ ] Add lifecycle methods: @PrePersist, @PreUpdate for timestamp management

- [ ] Create JPA repository interfaces (AC: #1.1-1.8)
  - [ ] Create `WorkflowRepository extends JpaRepository<Workflow, UUID>`
  - [ ] Add query methods: `findByOwnerIdAndDeletedAtIsNull()`, `findByProjectIdAndDeletedAtIsNull()`, `findByScopeAndDeletedAtIsNull()`
  - [ ] Add custom query: `@Query("SELECT w FROM Workflow w WHERE w.deletedAt IS NULL AND (w.ownerId = :userId OR w.projectId IN :projectIds)")` for user access filtering
  - [ ] Create `WorkflowExecutionRepository extends JpaRepository<WorkflowExecution, UUID>`
  - [ ] Add query methods: `findByWorkflowIdOrderByStartedAtDesc()`, `findByWorkflowIdAndStatusOrderByStartedAtDesc()`
  - [ ] Add pagination support with `Pageable` parameter

- [ ] Create WorkflowService business logic (AC: #1.1-1.9)
  - [ ] Create `WorkflowService` class with @Service annotation
  - [ ] Inject `WorkflowRepository`, `WorkflowExecutionRepository`, `ProjectService`, `UserService`
  - [ ] Implement `listWorkflows(scope, projectId, userId, pageable)` - query workflows with filters, enforce RBAC
  - [ ] Implement `getWorkflow(id, userId)` - fetch workflow, check RBAC (owner or project member)
  - [ ] Implement `createWorkflow(request, userId)` - validate request, set owner_id, save to DB
  - [ ] Implement `updateWorkflow(id, request, userId)` - check RBAC (owner or admin), update fields, save
  - [ ] Implement `deleteWorkflow(id, userId)` - check RBAC, set deleted_at timestamp (soft delete)
  - [ ] Implement `forkWorkflow(id, userId)` - copy workflow, set forked_from and new owner_id, reset counters
  - [ ] Implement `executeWorkflow(id, inputs, userId)` - create execution record with status='queued', validate inputs against workflow definition
  - [ ] Implement `getExecutionHistory(workflowId, status, userId, pageable)` - query executions, filter by status, enforce RBAC
  - [ ] Add validation methods: `validateWorkflowDefinition()`, `validateRequiredInputs()`, `checkWorkflowAccess()`, `checkWorkflowEditPermission()`

- [ ] Create WorkflowController REST endpoints (AC: #1.1-1.8)
  - [ ] Create `WorkflowController` class with @RestController and @RequestMapping("/api/workflows")
  - [ ] Inject `WorkflowService`
  - [ ] Implement `@GetMapping` listWorkflows(@RequestParam scope, @RequestParam projectId, Pageable pageable, @AuthenticationPrincipal user) → returns Page<WorkflowDTO>
  - [ ] Implement `@GetMapping("/{id}")` getWorkflow(@PathVariable id, @AuthenticationPrincipal user) → returns WorkflowDTO
  - [ ] Implement `@PostMapping` createWorkflow(@RequestBody CreateWorkflowRequest, @AuthenticationPrincipal user) → returns ResponseEntity<WorkflowDTO> with 201 Created
  - [ ] Implement `@PatchMapping("/{id}")` updateWorkflow(@PathVariable id, @RequestBody UpdateWorkflowRequest, @AuthenticationPrincipal user) → returns WorkflowDTO
  - [ ] Implement `@DeleteMapping("/{id}")` deleteWorkflow(@PathVariable id, @AuthenticationPrincipal user) → returns ResponseEntity<Void> with 204 No Content
  - [ ] Implement `@PostMapping("/{id}/fork")` forkWorkflow(@PathVariable id, @AuthenticationPrincipal user) → returns WorkflowDTO with 201 Created
  - [ ] Implement `@PostMapping("/{id}/execute")` executeWorkflow(@PathVariable id, @RequestBody Map<String, Object> inputs, @AuthenticationPrincipal user) → returns WorkflowExecutionDTO with 201 Created
  - [ ] Implement `@GetMapping("/{id}/executions")` getExecutionHistory(@PathVariable id, @RequestParam status, Pageable pageable, @AuthenticationPrincipal user) → returns Page<WorkflowExecutionDTO>
  - [ ] Add @Valid annotations for request validation
  - [ ] Add error handling with @ExceptionHandler for validation errors, access denied, not found

- [ ] Implement RBAC enforcement (AC: #1.9)
  - [ ] Create `WorkflowAccessChecker` service with methods: `canView(workflow, user)`, `canEdit(workflow, user)`
  - [ ] Implement `canView()`: return true if user is owner OR user is project member (query ProjectMember table)
  - [ ] Implement `canEdit()`: return true if user is owner OR user is project admin (check ProjectMember.role = 'admin')
  - [ ] Inject `WorkflowAccessChecker` in `WorkflowService`
  - [ ] Call access checker in all service methods, throw `AccessDeniedException` (403) if check fails
  - [ ] Add integration tests for RBAC enforcement (non-owner tries to edit → 403)

- [ ] Write unit tests for WorkflowService (AC: #1.1-1.9)
  - [ ] Test `listWorkflows()` with filters (scope, projectId), verify correct query methods called
  - [ ] Test `createWorkflow()` validates required fields, sets owner_id from user
  - [ ] Test `updateWorkflow()` updates fields, preserves owner_id, updates updated_at
  - [ ] Test `deleteWorkflow()` sets deleted_at (soft delete), does not remove from DB
  - [ ] Test `forkWorkflow()` copies definition, sets forked_from, resets counters
  - [ ] Test `executeWorkflow()` creates execution record with status='queued'
  - [ ] Test `getExecutionHistory()` returns paginated list, filters by status
  - [ ] Test RBAC: non-owner cannot edit/delete, project member can view
  - [ ] Mock `WorkflowRepository`, `WorkflowExecutionRepository`, `WorkflowAccessChecker`
  - [ ] Use JUnit 5 + Mockito, verify repository method calls with ArgumentCaptor

- [ ] Write integration tests for WorkflowController (AC: #1.1-1.9)
  - [ ] Use `@SpringBootTest(webEnvironment = RANDOM_PORT)` and `TestRestTemplate`
  - [ ] Set up test database with H2 or Testcontainers PostgreSQL
  - [ ] Test GET /api/workflows returns 200 with workflow list
  - [ ] Test POST /api/workflows creates workflow, returns 201 with id
  - [ ] Test PATCH /api/workflows/{id} updates workflow, returns 200
  - [ ] Test DELETE /api/workflows/{id} soft deletes, returns 204
  - [ ] Test POST /api/workflows/{id}/fork creates copy, returns 201
  - [ ] Test POST /api/workflows/{id}/execute creates execution, returns 201
  - [ ] Test GET /api/workflows/{id}/executions returns history, paginated
  - [ ] Test RBAC: 403 when non-owner tries to edit/delete
  - [ ] Test validation: 400 when required fields missing
  - [ ] Test 404 when workflow not found
  - [ ] Clean up test data after each test with @AfterEach

- [ ] Add logging and observability (AC: #1.1-1.9)
  - [ ] Add SLF4J logger in `WorkflowService` and `WorkflowController`
  - [ ] Log workflow creation: `log.info("Created workflow {} by user {}", workflowId, userId)`
  - [ ] Log workflow updates: `log.info("Updated workflow {} by user {}", workflowId, userId)`
  - [ ] Log workflow deletion: `log.info("Deleted workflow {} by user {}", workflowId, userId)`
  - [ ] Log execution creation: `log.info("Created execution {} for workflow {}", executionId, workflowId)`
  - [ ] Log RBAC failures: `log.warn("User {} denied access to workflow {}", userId, workflowId)`
  - [ ] Add error logging with full stack traces: `log.error("Failed to create workflow", exception)`
  - [ ] Ensure sensitive data (inputs, outputs) NOT logged (GDPR compliance)

- [ ] Update API documentation (AC: #1.1-1.8)
  - [ ] Add Swagger/OpenAPI annotations to `WorkflowController` endpoints
  - [ ] Document request/response schemas with @Schema annotations
  - [ ] Document error responses (400, 403, 404) with @ApiResponse
  - [ ] Generate OpenAPI spec (swagger.json) and verify completeness
  - [ ] Update API documentation in `docs/api-reference.md` with endpoint details
  - [ ] Include example requests/responses for each endpoint

## Dev Notes

### Architecture Patterns

This story implements the **backend persistence layer** for Epic 7 (Workflows). The Moku API provides REST endpoints for workflow CRUD operations, while the desktop client (E7-S2) handles actual workflow execution asynchronously.

**Key Architecture References:**
- Multi-process Electron architecture (ARCH §1): Backend provides persistence, desktop handles execution
- Moku API integration (ARCH §3): Spring Boot REST API with PostgreSQL database
- RBAC enforcement (PRD §3.3): Owner/admin can edit, project members can view
- Soft delete pattern: Set `deleted_at` timestamp instead of hard delete (audit trail preservation)

**Epic 10 Integration Note:**
Epic 7 focuses on workflow **management and UI**, while Epic 10 (Portable Workflow Engine) provides the **execution infrastructure**. This story (E7-S1) only creates execution **records** (metadata tracking), not the actual execution engine. Desktop WorkflowExecutionEngine (E7-S2) will integrate with Epic 10's portable engine for step execution.

### Database Design

**Workflows Table:**
- Uses JSONB for `definition` column (flexible schema for inputs/steps/outputs)
- `scope` enum: 'personal', 'project', 'organization'
- `forked_from` tracks workflow lineage (marketplace feature preparation)
- Soft delete via `deleted_at` timestamp (preserves audit trail)
- `execution_count` and `last_executed_at` cached for performance (dashboard metrics)

**Workflow Executions Table:**
- JSONB columns for `inputs`, `outputs`, `execution_trace` (flexible structure)
- `status` enum: 'queued', 'running', 'completed', 'failed', 'cancelled'
- `execution_trace` stores step-by-step execution log (debugging, replay)
- Links to `desktop_threads` via optional `thread_id` (workflow triggered from chat)

**RBAC Implementation:**
- Personal workflows: Only owner can access (owner_id = authenticated user)
- Project workflows: All project members can view, only owner/admin can edit
- Query optimization: Join with `project_members` table for access checks

### Testing Standards

**Unit Tests (JUnit 5 + Mockito):**
- Test `WorkflowService` business logic with mocked repositories
- Coverage target: 90%+ (all public methods)
- Focus on validation logic, RBAC enforcement, edge cases (null values, invalid enums)

**Integration Tests (Spring Boot Test + Testcontainers):**
- Full stack tests with real PostgreSQL database
- Test all REST endpoints with realistic request/response flows
- Test RBAC at HTTP level (403 errors)
- Test pagination (query 100 workflows, paginate by 20)
- Coverage target: 85%+ for controller + service integration

**Security Tests:**
- SQL injection: Submit workflow with malicious input `'; DROP TABLE workflows; --` → expect sanitized (JPA prevents injection)
- XSS prevention: Submit workflow description with `<script>alert('XSS')</script>` → expect escaped
- RBAC enforcement: Non-owner tries to edit → expect 403

### Component References

**Source Tree Locations:**
- Controllers: `src/main/java/com/holokai/moku/controller/WorkflowController.java`
- Services: `src/main/java/com/holokai/moku/service/WorkflowService.java`
- Repositories: `src/main/java/com/holokai/moku/repository/WorkflowRepository.java`, `WorkflowExecutionRepository.java`
- Entities: `src/main/java/com/holokai/moku/entity/Workflow.java`, `WorkflowExecution.java`
- DTOs: `src/main/java/com/holokai/moku/dto/WorkflowDTO.java`, `WorkflowExecutionDTO.java`, etc.
- Migrations: `src/main/resources/db/migration/V7_1__create_workflows_tables.sql`
- Tests: `src/test/java/com/holokai/moku/service/WorkflowServiceTest.java`, `src/test/java/com/holokai/moku/controller/WorkflowControllerIntegrationTest.java`

**Dependencies:**
- Spring Boot 3.x (REST framework, dependency injection)
- Spring Data JPA (repository pattern, query methods)
- PostgreSQL 14+ (database with JSONB support)
- Hibernate JSON type (JSONB column mapping)
- Jackson (JSON serialization)
- Spring Security (JWT authentication, RBAC)
- Liquibase or Flyway (database migrations)
- JUnit 5 + Mockito (unit tests)
- Testcontainers (integration tests with PostgreSQL)

### Project Structure Notes

**Alignment with Unified Project Structure:**
- Follow Spring Boot conventions: `src/main/java/com/holokai/moku/{controller,service,repository,entity,dto}/`
- Use package-by-feature if Moku API grows large: `com.holokai.moku.workflow.{controller,service,repository}`
- Migration files follow Flyway/Liquibase naming: `V{version}__{description}.sql` (e.g., `V7_1__create_workflows_tables.sql`)

**Naming Conventions:**
- Entities: Singular noun (`Workflow`, `WorkflowExecution`)
- DTOs: Entity name + DTO suffix (`WorkflowDTO`, `CreateWorkflowRequest`)
- Services: Entity name + Service suffix (`WorkflowService`)
- Repositories: Entity name + Repository suffix (`WorkflowRepository`)
- Controllers: Entity name + Controller suffix (`WorkflowController`)

### References

All technical details are derived from:
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md - §4.2 Data Models and Contracts (Database Schema)]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md - §4.3 APIs and Interfaces (Moku API Endpoints)]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md - §5 Non-Functional Requirements (Security RBAC, Performance)]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md - §7 Acceptance Criteria (AC-1.1 to AC-1.9)]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md - §8 Traceability Mapping (Test Coverage)]
- [Source: docs/architecture.md - §2 Technology Stack (Spring Boot, PostgreSQL)]
- [Source: docs/epics-and-stories-2025-11-25.md - Epic 7 > E7-S1: Workflow API Endpoints (Task Breakdown)]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e7-s1-workflow-api-endpoints.context.xml

- docs/sprint-artifacts/e7-s1-workflow-api-endpoints.context.xml



### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

# Story 9.5: Marketplace Publishing Pipeline

Status: ready-for-dev

## Story

As a workflow creator,
I want to publish my custom workflows to the marketplace with automated security scanning and human review,
so that I can share my workflows with the community and earn revenue while ensuring platform safety.

## Acceptance Criteria

### AC-5.1: Workflow Submission Endpoint
- [ ] POST `/api/marketplace/submit` endpoint accepts .wfpkg uploads
- [ ] Multipart upload with package file and metadata (name, description, category, price, etc.)
- [ ] Creates pending entry in `marketplace_workflows` table
- [ ] Stores .wfpkg in S3 or local storage with SHA-256 hash
- [ ] Returns workflow submission confirmation with tracking ID

### AC-5.2: Security Scanner
- [ ] ClamAV malware scan runs automatically on uploaded .wfpkg files
- [ ] npm audit scans dependencies for known vulnerabilities (if scripts present)
- [ ] Code obfuscation detection using entropy analysis
- [ ] Suspicious pattern detection (eval(), exec(), dangerous APIs)
- [ ] Security scan generates risk score: Low, Medium, High
- [ ] Scan results stored in `security_scan_result` JSONB field
- [ ] Test with EICAR test file confirms malware detection works

### AC-5.3: Syntax Validation
- [ ] Manifest.json validated against JSON schema (required fields, version format)
- [ ] Workflow.yaml validated against YAML schema
- [ ] Templates validated for syntax errors
- [ ] Invalid files rejected with detailed error messages
- [ ] Validation errors returned to submitter

### AC-5.4: Human Review Queue
- [ ] Admin endpoint GET `/api/marketplace/admin/review-queue` lists pending workflows
- [ ] Review queue UI shows workflow details: code, templates, permissions, security scan results
- [ ] Reviewers can view full workflow definition
- [ ] Test execution runs workflow with sample inputs before approval
- [ ] Review notes field for approval/rejection reasons

### AC-5.5: Approval/Rejection Flow
- [ ] POST `/api/marketplace/admin/workflows/{id}/approve` approves workflow
- [ ] Approval updates status to 'approved', sets published_at timestamp
- [ ] Approved workflows visible in marketplace browse/search
- [ ] Email notification sent to author on approval
- [ ] POST `/api/marketplace/admin/workflows/{id}/reject` rejects workflow
- [ ] Rejection updates status to 'rejected', stores review notes
- [ ] Email notification with feedback sent to author on rejection

### AC-5.6: Author Feedback Email
- [ ] Approval email includes marketplace URL for published workflow
- [ ] Rejection email includes specific reasons and improvement suggestions
- [ ] Email templates follow brand guidelines
- [ ] Unsubscribe link included for compliance

### AC-5.7: Test Execution
- [ ] Test runner executes workflow with sample inputs in sandboxed environment
- [ ] Execution logs captured for reviewer inspection
- [ ] Execution errors flagged in review queue
- [ ] Test results included in review decision data

## Tasks / Subtasks

### Task 1: Backend - Marketplace Submission Endpoint (AC-5.1)
- [ ] Create `MarketplaceController.java` in Moku API
  - [ ] Add `@RestController` annotation
  - [ ] Map to `/api/marketplace` base path
  - [ ] Inject `MarketplaceService`, `SecurityScannerService`, `StorageService`
- [ ] Implement `POST /submit` endpoint
  - [ ] Accept multipart upload: `@RequestPart("package") MultipartFile`, `@RequestPart("metadata") SubmitWorkflowRequest`
  - [ ] Validate user is authenticated (JWT token)
  - [ ] Extract author_id from JWT
  - [ ] Validate metadata fields (name, description, category, price)
  - [ ] Save multipart file to temporary location
  - [ ] Call `WorkflowPackagingService.validateManifest()` (from E9-S4)
  - [ ] Generate SHA-256 hash of .wfpkg file
  - [ ] Upload .wfpkg to S3 (or local storage in MVP)
  - [ ] Create entry in `marketplace_workflows` table with status='pending'
  - [ ] Return `MarketplaceWorkflowDTO` with submission ID
- [ ] Add error handling
  - [ ] 400 Bad Request for invalid metadata
  - [ ] 413 Payload Too Large for files >50MB
  - [ ] 500 Internal Server Error for storage failures
- [ ] Write unit tests for endpoint

### Task 2: Backend - Security Scanner Service (AC-5.2)
- [ ] Create `SecurityScannerService.java`
  - [ ] Add `@Service` annotation
  - [ ] Inject ClamAV client, npm audit wrapper
  - [ ] Define `SecurityScanResult` interface
- [ ] Implement ClamAV malware scan
  - [ ] Connect to ClamAV daemon (clamd) via socket
  - [ ] Send .wfpkg file for scanning
  - [ ] Parse scan results (FOUND, ERROR, OK)
  - [ ] Create `SecurityFinding` for each detected threat
  - [ ] Set severity: critical for malware
- [ ] Implement npm audit scan
  - [ ] Extract .wfpkg to temporary directory
  - [ ] Check for package.json or scripts with dependencies
  - [ ] Run `npm audit --json` if dependencies found
  - [ ] Parse vulnerabilities (low, medium, high, critical)
  - [ ] Create `SecurityFinding` for each vulnerability
- [ ] Implement obfuscation detection
  - [ ] Calculate Shannon entropy for JavaScript files
  - [ ] Flag files with entropy >7.0 (likely obfuscated)
  - [ ] Create `SecurityFinding` with type='obfuscation'
- [ ] Implement suspicious pattern detection
  - [ ] Regex patterns for: eval(), exec(), Function(), require('child_process')
  - [ ] Scan all .js, .ts, .yaml files
  - [ ] Create `SecurityFinding` for matches
- [ ] Calculate risk score
  - [ ] Critical findings → High risk
  - [ ] High findings → High risk
  - [ ] Medium findings → Medium risk
  - [ ] Low/info findings only → Low risk
- [ ] Store scan results in `marketplace_workflows.security_scan_result` JSONB
- [ ] Write unit tests with mock ClamAV

### Task 3: Backend - Syntax Validation (AC-5.3)
- [ ] Create JSON schema for manifest.json
  - [ ] Define required fields: name, version, author, description, category, files
  - [ ] Define version format: semantic versioning (X.Y.Z)
  - [ ] Define author schema: name (required), email (required), url (optional)
  - [ ] Define permissions array schema
  - [ ] Save schema to `src/main/resources/schemas/workflow-manifest.schema.json`
- [ ] Implement manifest validation
  - [ ] Use JSON schema validator library (Jackson, Everit)
  - [ ] Load schema from resources
  - [ ] Validate manifest against schema
  - [ ] Return validation errors with field paths
- [ ] Create YAML schema for workflow.yaml
  - [ ] Define required fields: name, inputs, steps, outputs
  - [ ] Define step schema: name, type, config, onError
  - [ ] Define inputs/outputs schema: name, type, required
- [ ] Implement workflow.yaml validation
  - [ ] Parse YAML file
  - [ ] Validate against schema
  - [ ] Check for circular dependencies in step outputs
  - [ ] Return validation errors
- [ ] Implement template syntax validation
  - [ ] Validate Handlebars syntax (parse templates)
  - [ ] Check for undefined variables
  - [ ] Return template errors
- [ ] Integrate validation into submission flow
  - [ ] Call validators after file upload, before security scan
  - [ ] Reject submission immediately if validation fails
  - [ ] Return detailed error response

### Task 4: Backend - Human Review Queue Endpoints (AC-5.4)
- [ ] Implement GET `/admin/review-queue` endpoint
  - [ ] Add `@PreAuthorize("hasRole('ADMIN')")` for RBAC
  - [ ] Query `marketplace_workflows` where status='pending'
  - [ ] Support pagination: page, size parameters
  - [ ] Support sorting: oldest first, highest risk first
  - [ ] Return `Page<MarketplaceWorkflowDTO>` with full details
- [ ] Include full workflow definition in response
  - [ ] Load .wfpkg from S3
  - [ ] Extract manifest, workflow.yaml, templates
  - [ ] Include in `MarketplaceWorkflowDTO.manifest` field
- [ ] Include security scan results
  - [ ] Parse `security_scan_result` JSONB field
  - [ ] Include risk score, findings list
  - [ ] Format for display in admin UI
- [ ] Add filtering options
  - [ ] Filter by status: pending, approved, rejected
  - [ ] Filter by risk score: low, medium, high
  - [ ] Filter by category
- [ ] Write integration tests for endpoint

### Task 5: Backend - Approval/Rejection Endpoints (AC-5.5)
- [ ] Implement POST `/admin/workflows/{id}/approve` endpoint
  - [ ] Add `@PreAuthorize("hasRole('ADMIN')")` for RBAC
  - [ ] Accept `ReviewDecisionRequest` with notes field
  - [ ] Validate workflow exists and status='pending'
  - [ ] Update status to 'approved'
  - [ ] Set `published_at` timestamp to NOW()
  - [ ] Store review notes
  - [ ] Trigger approval email (async)
  - [ ] Return updated `MarketplaceWorkflowDTO`
- [ ] Implement POST `/admin/workflows/{id}/reject` endpoint
  - [ ] Add `@PreAuthorize("hasRole('ADMIN')")` for RBAC
  - [ ] Accept `ReviewDecisionRequest` with notes field (required for rejection)
  - [ ] Validate workflow exists and status='pending'
  - [ ] Update status to 'rejected'
  - [ ] Store review notes (rejection reasons)
  - [ ] Trigger rejection email (async)
  - [ ] Return updated `MarketplaceWorkflowDTO`
- [ ] Add audit logging
  - [ ] Log approval decision to audit log
  - [ ] Include reviewer user ID, timestamp, decision
  - [ ] Log rejection decision with reasons
- [ ] Write integration tests

### Task 6: Backend - Email Notification Service (AC-5.6)
- [ ] Create `EmailService.java`
  - [ ] Add `@Service` annotation
  - [ ] Inject JavaMailSender (Spring Boot Mail)
  - [ ] Define email template loading
- [ ] Create approval email template
  - [ ] Subject: "Your workflow '{name}' has been approved!"
  - [ ] Body: Congratulations message, marketplace URL, next steps
  - [ ] Include branding (logo, colors)
  - [ ] Add unsubscribe link
  - [ ] Save as `src/main/resources/templates/email/workflow-approved.html`
- [ ] Create rejection email template
  - [ ] Subject: "Updates needed for your workflow '{name}'"
  - [ ] Body: Review notes, improvement suggestions, resubmission instructions
  - [ ] Friendly tone (not punitive)
  - [ ] Add unsubscribe link
  - [ ] Save as `src/main/resources/templates/email/workflow-rejected.html`
- [ ] Implement `sendApprovalEmail()` method
  - [ ] Load author email from user profile
  - [ ] Render template with workflow details
  - [ ] Send via SMTP
  - [ ] Log email sent
  - [ ] Handle send failures gracefully (log, don't block approval)
- [ ] Implement `sendRejectionEmail()` method
  - [ ] Load author email
  - [ ] Render template with review notes
  - [ ] Send via SMTP
  - [ ] Log email sent
- [ ] Configure SMTP settings
  - [ ] Add to application.properties: host, port, username, password
  - [ ] Use environment variables for credentials
  - [ ] Test with Mailtrap or real SMTP in staging
- [ ] Write unit tests with mock SMTP

### Task 7: Backend - Test Execution (AC-5.7)
- [ ] Create `WorkflowTestRunner.java`
  - [ ] Add `@Service` annotation
  - [ ] Inject `WorkflowExecutionEngine` (from Epic 10)
  - [ ] Define `TestExecutionResult` interface
- [ ] Implement `executeTest()` method
  - [ ] Load workflow definition from .wfpkg
  - [ ] Generate sample inputs based on input schema
  - [ ] Execute workflow in sandboxed environment
  - [ ] Capture stdout, stderr, execution logs
  - [ ] Set timeout (30 seconds max)
  - [ ] Catch and log exceptions
  - [ ] Return `TestExecutionResult` with status, logs, outputs
- [ ] Integrate test execution into review queue
  - [ ] Add "Run Test" button in review queue UI
  - [ ] Call test runner on button click
  - [ ] Display test results in modal
  - [ ] Flag execution errors in review data
- [ ] Add sandboxing constraints
  - [ ] Disable network access during test execution
  - [ ] Limit filesystem access to temp directory
  - [ ] Use Epic 10 capability enforcement
- [ ] Write integration tests

### Task 8: Frontend - Admin Review Queue UI (AC-5.4)
- [ ] Create `HumanReviewQueue.svelte` component
  - [ ] Create route: `/admin/review-queue`
  - [ ] Add route guard: require admin role
  - [ ] Layout: header, filters, workflow list, detail panel
- [ ] Implement workflow list view
  - [ ] Fetch workflows from GET `/admin/review-queue`
  - [ ] Display as cards: workflow name, author, risk score, submission date
  - [ ] Support pagination
  - [ ] Highlight high-risk workflows (red border)
- [ ] Implement detail panel
  - [ ] Show workflow details: description, category, permissions
  - [ ] Display security scan results: risk score, findings list
  - [ ] Code viewer for workflow.yaml, templates (syntax highlighting)
  - [ ] Test execution section with "Run Test" button
- [ ] Add filter controls
  - [ ] Dropdown: Filter by risk score (All, Low, Medium, High)
  - [ ] Dropdown: Filter by category
  - [ ] Sort: Oldest first, Highest risk first
- [ ] Add approve/reject actions
  - [ ] Approve button: opens confirmation dialog
  - [ ] Reject button: opens rejection form with notes textarea (required)
  - [ ] Call approval/rejection endpoints
  - [ ] Show success toast
  - [ ] Refresh list after action
- [ ] Style with Tailwind CSS
  - [ ] Use admin theme colors
  - [ ] Responsive layout

### Task 9: Integration Testing (AC-5.1 to AC-5.7)
- [ ] Write end-to-end test: workflow submission flow
  - [ ] Create test workflow with valid manifest
  - [ ] Submit via POST `/marketplace/submit`
  - [ ] Verify workflow created with status='pending'
  - [ ] Verify security scan triggered
  - [ ] Verify stored in S3
- [ ] Write test: security scanner detects malware
  - [ ] Submit .wfpkg with EICAR test file
  - [ ] Verify ClamAV detects malware
  - [ ] Verify risk score = High
  - [ ] Verify findings include malware detection
- [ ] Write test: syntax validation rejects invalid manifest
  - [ ] Submit .wfpkg with missing required fields
  - [ ] Verify 400 Bad Request response
  - [ ] Verify error message includes validation details
- [ ] Write test: approval flow
  - [ ] Admin approves pending workflow
  - [ ] Verify status updated to 'approved'
  - [ ] Verify published_at timestamp set
  - [ ] Verify approval email sent
- [ ] Write test: rejection flow
  - [ ] Admin rejects pending workflow with notes
  - [ ] Verify status updated to 'rejected'
  - [ ] Verify rejection email sent with notes
- [ ] Write test: review queue pagination
  - [ ] Create 50 pending workflows
  - [ ] Fetch page 1 (20 items)
  - [ ] Fetch page 2 (20 items)
  - [ ] Verify correct items returned

## Dev Notes

### Technical Context

**Architecture Integration:**
- This story builds the **publishing pipeline** for the marketplace (Epic 9)
- Works with E9-S4 (Workflow Packaging Service) for .wfpkg creation and validation
- Integrates with Epic 10 (Portable Workflow Engine) for test execution
- Uses Spring Boot backend (Moku API) for REST endpoints
- Uses PostgreSQL for `marketplace_workflows` table storage
- Uses AWS S3 (or local storage in MVP) for .wfpkg file storage
- Uses ClamAV for malware scanning
- Uses SMTP for email notifications

**Security Constraints:**
- All admin endpoints require `ADMIN` role (RBAC)
- File uploads limited to 50MB
- ClamAV must be running as daemon (clamd) on server
- S3 presigned URLs for secure .wfpkg downloads
- Sandboxed test execution (no network, limited filesystem access)

**Database Schema:**
```sql
-- marketplace_workflows table (from tech spec)
CREATE TABLE marketplace_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  long_description TEXT,
  category VARCHAR(100) NOT NULL,
  tier VARCHAR(50) NOT NULL CHECK (tier IN ('Basic', 'Intermediate', 'Advanced')),
  version VARCHAR(20) NOT NULL,

  -- Package metadata
  package_url TEXT NOT NULL, -- S3 URL or local path
  package_hash VARCHAR(64) NOT NULL, -- SHA-256
  manifest JSONB NOT NULL,

  -- Permissions and security
  capabilities TEXT[] NOT NULL,
  security_scan_result JSONB, -- { risk_score, findings, last_scanned_at }

  -- Status and moderation
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'disabled')),
  review_notes TEXT,

  -- Pricing
  pricing_type VARCHAR(50) NOT NULL CHECK (pricing_type IN ('free', 'premium')),
  price_usd DECIMAL(10,2),

  -- Metrics
  install_count INT DEFAULT 0,
  rating_avg DECIMAL(3,2) DEFAULT 0.0,
  rating_count INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP,
  last_scanned_at TIMESTAMP
);
```

**Data Flow:**
```
1. User submits workflow → POST /marketplace/submit
2. Backend validates manifest, workflow.yaml, templates
3. Backend uploads .wfpkg to S3, generates SHA-256 hash
4. Backend creates marketplace_workflows entry (status=pending)
5. Backend triggers security scan (ClamAV, npm audit, obfuscation detection)
6. Security scan results stored in security_scan_result JSONB
7. Workflow appears in admin review queue
8. Admin reviewer views code, permissions, security scan
9. Admin runs test execution with sample inputs
10. Admin approves → status=approved, published_at=NOW(), email sent
    OR Admin rejects → status=rejected, review notes saved, email sent
11. Approved workflows visible in marketplace browse/search (E9-S6)
```

**Testing Strategy:**
- Unit tests: Controller, Service, Security Scanner (mocked ClamAV)
- Integration tests: Full submission flow with real database, S3 mock
- E2E tests: Submit workflow → review → approve → verify in marketplace
- Security tests: Submit EICAR file, obfuscated code, vulnerable dependencies

**Performance Considerations:**
- Security scan may take 10-30 seconds (AC target: <30s P95)
- Use async processing for security scan (don't block HTTP response)
- Use async email sending (don't block approval/rejection)
- S3 presigned URLs for large .wfpkg downloads

**Error Handling:**
- ClamAV scan failure → flag for manual review, don't auto-reject
- Email send failure → log error, don't block approval
- S3 upload failure → return 500, user can retry
- Validation errors → return 400 with detailed field errors

### Project Structure Notes

**Backend Files (Moku API - Spring Boot):**
```
src/main/java/com/holokai/moku/
├── controller/
│   └── MarketplaceController.java (NEW)
├── service/
│   ├── MarketplaceService.java (NEW)
│   ├── SecurityScannerService.java (NEW)
│   ├── WorkflowTestRunner.java (NEW)
│   └── EmailService.java (NEW)
├── dto/
│   ├── MarketplaceWorkflowDTO.java (NEW)
│   ├── SubmitWorkflowRequest.java (NEW)
│   ├── ReviewDecisionRequest.java (NEW)
│   └── SecurityScanResult.java (NEW)
└── repository/
    └── MarketplaceWorkflowRepository.java (NEW)

src/main/resources/
├── schemas/
│   └── workflow-manifest.schema.json (NEW)
└── templates/email/
    ├── workflow-approved.html (NEW)
    └── workflow-rejected.html (NEW)
```

**Frontend Files (Electron Renderer - Svelte):**
```
src/routes/admin/
└── review-queue/
    ├── HumanReviewQueue.svelte (NEW)
    ├── WorkflowListItem.svelte (NEW)
    ├── WorkflowDetailPanel.svelte (NEW)
    └── TestExecutionResults.svelte (NEW)
```

**Database Migration:**
```
migrations/
└── V9__create_marketplace_workflows.sql (NEW - from E9-S4 or this story)
```

### References

- **Tech Spec:** [docs/sprint-artifacts/tech-spec-epic-9.md](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-9.md) - §4.3 APIs and Interfaces, §4.4 Workflows and Sequencing (Marketplace Publishing Flow)
- **Architecture:** [docs/architecture.md](C:\Projects\repos\holokai\bmad\desktop-project\docs\architecture.md) - §3 Multi-process Electron Architecture, Moku API integration
- **PRD:** Not explicitly referenced, but marketplace publishing is part of PRD §3.7.2 (Workflow Marketplace)
- **Epic 10 Tech Spec:** [docs/sprint-artifacts/tech-spec-epic-10.md](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-10.md) - Portable Workflow Engine for test execution
- **E9-S4 Story:** [docs/sprint-artifacts/e9-s4-workflow-packaging-service.md](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\e9-s4-workflow-packaging-service.md) - .wfpkg creation and validation

### Dependencies

**External Dependencies:**
- ClamAV (malware scanner) - Must be installed and running as daemon
- AWS S3 (or S3-compatible storage like MinIO for local dev)
- SMTP server (for email notifications)
- npm CLI (for npm audit vulnerability scanning)

**Internal Dependencies:**
- E9-S4 (Workflow Packaging Service) - BLOCKS this story, must be completed first for manifest validation
- Epic 10 (Portable Workflow Engine) - Needed for test execution in sandboxed environment

**Libraries/Packages (Backend):**
- ClamAV Java client (e.g., `clamav-client` or custom socket implementation)
- AWS SDK for Java (S3 operations)
- Spring Boot Mail Starter (email notifications)
- JSON Schema Validator (Jackson or Everit)
- YAML parser (SnakeYAML)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e9-s5-marketplace-publishing-pipeline.context.xml

- docs/sprint-artifacts/e9-s5-marketplace-publishing-pipeline.context.xml



### Agent Model Used

<!-- Model name and version will be added by dev agent -->

### Debug Log References

<!-- Debug log references will be added by dev agent during implementation -->

### Completion Notes List

<!-- Completion notes will be added by dev agent after story is done -->

### File List

<!-- File list will be added by dev agent after story is done -->

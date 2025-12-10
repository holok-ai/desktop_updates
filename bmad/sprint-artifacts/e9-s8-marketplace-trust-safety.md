# Story 9.8: Marketplace Trust & Safety

Status: ready-for-dev

## Story

As a **Holokai platform administrator**,
I want **automated security re-scanning and community moderation tools for marketplace workflows**,
so that **malicious or compromised workflows can be detected and removed, maintaining marketplace trust and user safety**.

## Acceptance Criteria

1. **AC-8.1: Weekly Re-scans** - Weekly re-scans functional (automated cron job)
   - Automated cron job runs weekly to re-scan all published workflows
   - Security scanner service invoked for each workflow (ClamAV, vulnerability scan, obfuscation detection)
   - Security scan results updated in marketplace_workflows table (security_scan_result, last_scanned_at)
   - Risk score recalculated for each workflow
   - Workflows with newly detected critical issues flagged for human review

2. **AC-8.2: Community Report Button** - Community report button functional (users can flag workflows)
   - Report button visible on workflow detail page for all authenticated users
   - Report dialog allows selecting reason: malicious_code, inaccurate_description, security_issue, spam, other
   - Details field for additional context (optional)
   - Report submission creates entry in workflow_reports table with status 'pending'
   - Toast confirmation shown to user after submission
   - Duplicate reports from same user prevented (one report per user per workflow)

3. **AC-8.3: Investigation Queue** - Holokai investigation queue shows flagged workflows with reports
   - Admin-only investigation queue page accessible at `/admin/moderation`
   - Queue shows workflows with pending/investigating status reports
   - Filterable by report reason and report count
   - Sortable by report count, last reported date, workflow install count
   - Each entry shows: workflow name, author, report count, reasons, security scan result
   - Click to view workflow detail with all reports and security scan details
   - Action buttons: View Workflow Code, Disable Workflow, Dismiss Reports

4. **AC-8.4: Workflow Disabling** - Malicious workflows can be disabled (removed from marketplace, users warned)
   - Disable workflow action available to admins in investigation queue
   - Disable dialog requires reason (text field, required)
   - Disabling updates workflow status from 'approved' to 'disabled'
   - Disabled workflows removed from marketplace browse/search immediately
   - Email notification sent to workflow author with reason and appeal instructions
   - Email notification sent to all users who installed the workflow with warning
   - Warning banner shown in desktop app for users with installed disabled workflow
   - Disabled workflows remain in database for audit trail

5. **AC-8.5: Appeal Process** - Appeal process functional (authors can contest disabling)
   - Disabled workflow authors can submit appeal via email or admin contact form
   - Appeals tracked in workflow_reports table with status 'investigating'
   - Admin review of appeal updates status to 'resolved' (reinstated) or 'dismissed' (upheld)
   - Reinstated workflows revert status from 'disabled' to 'approved'
   - Author notified of appeal outcome via email
   - Appeal history visible in admin investigation queue

6. **AC-8.6: Transparency Report** - Transparency report published monthly (# workflows scanned, flagged, disabled)
   - Automated monthly transparency report generated from database metrics
   - Report includes: total workflows scanned, workflows flagged, workflows disabled, reports received, reports resolved
   - Report published to public URL (e.g., `/transparency-report/2025-11`)
   - Report format: Markdown or PDF
   - Historical reports archived and accessible

## Tasks / Subtasks

- [ ] **Task 1: Backend - Security Re-scanning Service** (AC-8.1)
  - [ ] 1.1: Create `SecurityReScanService` class in Moku API
  - [ ] 1.2: Implement cron job using Spring `@Scheduled` annotation (cron expression for weekly execution)
  - [ ] 1.3: Fetch all published workflows with status='approved'
  - [ ] 1.4: For each workflow: download .wfpkg, invoke SecurityScannerService, update security_scan_result and last_scanned_at
  - [ ] 1.5: Flag workflows with newly detected critical findings (risk_score changed to High, or new critical findings)
  - [ ] 1.6: Send admin email digest with flagged workflows
  - [ ] 1.7: Write integration test with test database and mocked ClamAV

- [ ] **Task 2: Backend - Community Reporting API** (AC-8.2)
  - [ ] 2.1: Add POST `/api/marketplace/workflows/{id}/report` endpoint to MarketplaceController
  - [ ] 2.2: Implement `ReportRequest` DTO validation (reason required, details max 2000 chars)
  - [ ] 2.3: Create workflow_reports table entry with status='pending'
  - [ ] 2.4: Enforce constraint: one report per user per workflow (unique index on workflow_id + reporter_id)
  - [ ] 2.5: Return 409 Conflict if duplicate report attempted
  - [ ] 2.6: Send admin notification email when report submitted (async)
  - [ ] 2.7: Write unit tests for endpoint (happy path, duplicate report, invalid input)

- [ ] **Task 3: Backend - Investigation Queue API** (AC-8.3)
  - [ ] 3.1: Add GET `/api/marketplace/admin/investigation-queue` endpoint (admin only)
  - [ ] 3.2: Implement query with filters: reason, status, sort (report_count DESC, last_reported DESC)
  - [ ] 3.3: Join workflow_reports with marketplace_workflows, aggregate report counts
  - [ ] 3.4: Return `InvestigationQueueItemDTO` with workflow details, report summary, security scan
  - [ ] 3.5: Add GET `/api/marketplace/admin/workflows/{id}/reports` endpoint for detailed reports
  - [ ] 3.6: Write integration test for queue endpoint with test data

- [ ] **Task 4: Backend - Workflow Disabling API** (AC-8.4)
  - [ ] 4.1: Add POST `/api/marketplace/admin/workflows/{id}/disable` endpoint (admin only)
  - [ ] 4.2: Implement `DisableWorkflowRequest` DTO with required reason field
  - [ ] 4.3: Update workflow status from 'approved' to 'disabled', store reason in review_notes
  - [ ] 4.4: Send email to workflow author with reason and appeal instructions
  - [ ] 4.5: Fetch all users with workflow_installations for this workflow
  - [ ] 4.6: Send email to all installers with warning and removal instructions
  - [ ] 4.7: Update all workflow_reports for this workflow to status='resolved'
  - [ ] 4.8: Emit event for desktop app: `workflow:disabled` with workflowId
  - [ ] 4.9: Write integration test for disable workflow flow

- [ ] **Task 5: Backend - Appeal Process** (AC-8.5)
  - [ ] 5.1: Add POST `/api/marketplace/workflows/{id}/appeal` endpoint (workflow author only)
  - [ ] 5.2: Implement `AppealRequest` DTO with appeal text (required, max 5000 chars)
  - [ ] 5.3: Create workflow_reports entry with reason='appeal', status='investigating'
  - [ ] 5.4: Send admin notification email with appeal details
  - [ ] 5.5: Add POST `/api/marketplace/admin/workflows/{id}/reinstate` endpoint (admin only)
  - [ ] 5.6: Reinstate: Update status from 'disabled' to 'approved', update appeal report to 'resolved'
  - [ ] 5.7: Send email to author with appeal outcome (reinstated or dismissed)
  - [ ] 5.8: Write unit tests for appeal endpoints

- [ ] **Task 6: Backend - Transparency Report Generation** (AC-8.6)
  - [ ] 6.1: Create `TransparencyReportService` class
  - [ ] 6.2: Implement cron job using `@Scheduled` for monthly execution (1st of month)
  - [ ] 6.3: Query database metrics: total workflows, scanned count, flagged count, disabled count, reports received, reports resolved
  - [ ] 6.4: Generate Markdown report with metrics and trend charts (month-over-month)
  - [ ] 6.5: Save report to S3 bucket: `transparency-reports/{YYYY-MM}.md`
  - [ ] 6.6: Add GET `/api/marketplace/transparency-reports` endpoint to list reports
  - [ ] 6.7: Add GET `/api/marketplace/transparency-reports/{YYYY-MM}` endpoint to fetch report
  - [ ] 6.8: Write unit test for report generation logic

- [ ] **Task 7: Desktop - Report Workflow UI** (AC-8.2)
  - [ ] 7.1: Add "Report Workflow" button to `WorkflowDetailPage.svelte` (three-dot menu or flag icon)
  - [ ] 7.2: Create `ReportWorkflowDialog.svelte` component
  - [ ] 7.3: Dialog form: reason dropdown (select from enum values), details textarea (optional)
  - [ ] 7.4: On submit: call `ipcRenderer.invoke('marketplace:report-workflow', workflowId, report)`
  - [ ] 7.5: Show success toast on submission, error toast on failure (duplicate report)
  - [ ] 7.6: Add IPC handler in main process: `ipcMain.handle('marketplace:report-workflow')`
  - [ ] 7.7: Main handler calls Moku API POST `/marketplace/workflows/{id}/report`
  - [ ] 7.8: Write component test for ReportWorkflowDialog

- [ ] **Task 8: Desktop - Disabled Workflow Warning** (AC-8.4)
  - [ ] 8.1: Listen for IPC event `workflow:disabled` in renderer process
  - [ ] 8.2: Event handler: check if user has disabled workflow installed (query workflow_installations)
  - [ ] 8.3: If installed: show persistent warning banner at top of app
  - [ ] 8.4: Banner text: "A workflow you installed has been disabled due to security concerns. View details."
  - [ ] 8.5: Banner click: navigate to workflow detail page with warning message
  - [ ] 8.6: Workflow detail page shows disabled status, reason, and uninstall button
  - [ ] 8.7: Uninstall button removes workflow directory and installation record
  - [ ] 8.8: Write E2E test for disabled workflow warning flow

- [ ] **Task 9: Admin UI - Investigation Queue** (AC-8.3, AC-8.4)
  - [ ] 9.1: Create `InvestigationQueue.svelte` page component (admin only route)
  - [ ] 9.2: Fetch investigation queue via GET `/api/marketplace/admin/investigation-queue`
  - [ ] 9.3: Display table with columns: workflow name, author, reports count, reasons, security scan, actions
  - [ ] 9.4: Implement filters: reason dropdown, status dropdown
  - [ ] 9.5: Implement sort: report count, last reported date
  - [ ] 9.6: Click row to expand: show all reports with details, security scan findings
  - [ ] 9.7: Add "Disable Workflow" button per row (opens disable dialog)
  - [ ] 9.8: Create `DisableWorkflowDialog.svelte` with reason textarea (required)
  - [ ] 9.9: On disable: call POST `/api/marketplace/admin/workflows/{id}/disable`
  - [ ] 9.10: Add "Dismiss Reports" button to mark reports as resolved without disabling
  - [ ] 9.11: Write component tests for InvestigationQueue

- [ ] **Task 10: Admin UI - Transparency Report View** (AC-8.6)
  - [ ] 10.1: Create `TransparencyReports.svelte` page (public route)
  - [ ] 10.2: Fetch reports list via GET `/api/marketplace/transparency-reports`
  - [ ] 10.3: Display as list of cards: month, metrics summary, link to full report
  - [ ] 10.4: Click card to view full report (Markdown rendered to HTML)
  - [ ] 10.5: Add download button to export report as PDF
  - [ ] 10.6: Write component test for transparency report view

- [ ] **Task 11: Testing - Security Re-scanning** (AC-8.1)
  - [ ] 11.1: Integration test: Create published workflows, run re-scan cron job, verify security_scan_result updated
  - [ ] 11.2: Integration test: Simulate new critical finding, verify workflow flagged for review
  - [ ] 11.3: E2E test: Trigger re-scan manually (admin action), verify workflows re-scanned

- [ ] **Task 12: Testing - Community Reporting** (AC-8.2, AC-8.3)
  - [ ] 12.1: E2E test: User reports workflow, verify report appears in investigation queue
  - [ ] 12.2: Integration test: Submit duplicate report, verify 409 Conflict response
  - [ ] 12.3: E2E test: Admin dismisses reports, verify reports marked resolved

- [ ] **Task 13: Testing - Workflow Disabling** (AC-8.4, AC-8.5)
  - [ ] 13.1: E2E test: Admin disables workflow, verify removed from marketplace, author notified
  - [ ] 13.2: E2E test: User with installed workflow receives warning, uninstalls workflow
  - [ ] 13.3: Integration test: Author submits appeal, admin reinstates workflow, verify status updated
  - [ ] 13.4: E2E test: Author submits appeal, admin dismisses appeal, verify status remains disabled

## Dev Notes

### Architecture Patterns

**Security Re-scanning:**
- Use Spring `@Scheduled` annotation with cron expression: `0 0 2 * * SUN` (2 AM every Sunday)
- Re-scanning invokes same `SecurityScannerService` used in publishing pipeline (E9-S5)
- Security scan results stored in `marketplace_workflows.security_scan_result` (JSONB column)
- Weekly re-scans detect supply chain attacks, newly discovered vulnerabilities (CVE updates)

**Community Moderation:**
- `workflow_reports` table tracks all reports with status: pending, investigating, resolved, dismissed
- Investigation queue prioritizes by report count (multiple reports = higher priority)
- Disable workflow = soft delete (status='disabled'), not hard delete (audit trail required)
- Email notifications sent asynchronously (Spring `@Async` or message queue)

**Appeal Process:**
- Appeals stored as special reports with reason='appeal'
- Reinstate action: status 'disabled' → 'approved', workflow re-appears in marketplace
- Appeal history visible in admin UI (transparency)

**Transparency Reports:**
- Monthly cron job: `0 0 0 1 * *` (midnight on 1st of month)
- Metrics calculated from database queries (COUNT aggregations)
- Report stored as Markdown in S3, served via public URL
- Historical reports archived for trend analysis

### Integration Points

**Epic 9 Integration:**
- E9-S5 (Publishing Pipeline): Shares `SecurityScannerService` for initial scan and re-scans
- E9-S6 (Discovery & Installation): Disabled workflows removed from browse/search results
- E9-S7 (Freemium): Disabled premium workflows trigger refund process (future enhancement)

**Epic 10 Integration:**
- Disabled workflows still executable locally until user uninstalls (Epic 10 enforcement)
- Future enhancement: Epic 10 capability enforcer blocks disabled workflows at runtime

**Moku API Components:**
- New service: `SecurityReScanService` (cron job for weekly re-scans)
- New service: `TransparencyReportService` (monthly report generation)
- Existing service: `SecurityScannerService` (reused from E9-S5)
- Controller: `MarketplaceController` (add report, disable, appeal endpoints)

**Desktop Components:**
- New component: `ReportWorkflowDialog.svelte` (report submission form)
- Modified component: `WorkflowDetailPage.svelte` (add report button, disabled status warning)
- New component: `DisabledWorkflowBanner.svelte` (persistent warning banner)
- New IPC handlers: `marketplace:report-workflow`, event listener for `workflow:disabled`

**Admin UI Components (New Admin App or Desktop Admin Mode):**
- New page: `InvestigationQueue.svelte` (admin-only moderation dashboard)
- New component: `DisableWorkflowDialog.svelte` (disable workflow form)
- New page: `TransparencyReports.svelte` (public transparency report archive)

### Security Considerations

**Automated Re-scanning:**
- ClamAV virus definitions updated daily (daemon configuration)
- npm audit database updated daily (npm registry)
- Re-scan failures logged, admin notified (monitoring alert)
- Rate limiting: max 100 scans per hour (prevent resource exhaustion)

**Report Spam Prevention:**
- One report per user per workflow (unique constraint)
- Rate limiting: max 10 reports per user per day (prevent abuse)
- Report reasons enum (prevent injection)
- Details field sanitized (XSS prevention)

**Workflow Disabling:**
- Admin-only action (RBAC enforcement via `@PreAuthorize("hasRole('ADMIN')")`)
- Audit log: all disable actions logged with admin ID, timestamp, reason
- Disable reason required (transparency, accountability)
- Email notifications logged (delivery confirmation)

**Appeal Process:**
- Author-only action (only workflow owner can appeal)
- Appeal rate limiting: max 3 appeals per workflow (prevent spam)
- Admin review required (no automated reinstatement)

### Testing Strategy

**Unit Tests:**
- `SecurityReScanServiceTest`: Test cron job logic, scan invocation, flagging logic
- `MarketplaceControllerTest`: Test report endpoint (valid, duplicate, invalid input)
- `TransparencyReportServiceTest`: Test metrics calculation, report generation

**Integration Tests:**
- Re-scan flow: publish workflow → simulate new CVE → re-scan → verify flagged
- Report flow: submit report → verify in queue → disable workflow → verify removed
- Appeal flow: disable workflow → submit appeal → reinstate → verify restored

**E2E Tests (Playwright):**
- User reports workflow → admin views in queue → disables workflow → user sees warning → uninstalls
- Weekly re-scan detects malware → admin notified → disables workflow → users notified
- Author appeals disabling → admin reinstates → workflow re-appears in marketplace

**Security Tests:**
- Submit report with XSS payload → verify sanitized
- Submit 11 reports in 1 day → verify rate limited
- Non-admin attempts disable → verify 403 Forbidden
- Non-author attempts appeal → verify 403 Forbidden

### Performance Considerations

**Re-scanning at Scale:**
- If 10,000 workflows, weekly re-scan = 10,000 scans/week = ~60 scans/hour (acceptable)
- Batch processing: 10 concurrent scans, queue for rest
- Prioritize high-install workflows first (risk-based approach)
- Cache scan results for 7 days (skip unchanged workflows)

**Investigation Queue Performance:**
- Index on `workflow_reports.status` for fast filtering
- Index on `workflow_reports.workflow_id` for fast aggregation
- Denormalize report_count in `marketplace_workflows` table (updated on report submission)

**Transparency Report Performance:**
- Monthly report pre-calculated and cached (no live queries)
- S3 storage with CloudFront CDN (fast global access)
- Report generation runs off-peak (1st of month at midnight)

### Observability

**Metrics:**
- `security_rescan_count`: Total workflows re-scanned (weekly)
- `security_rescan_flagged_count`: Workflows newly flagged (weekly)
- `workflow_reports_received`: Reports submitted (daily)
- `workflows_disabled_count`: Workflows disabled (monthly)
- `appeals_submitted_count`: Appeals submitted (monthly)
- `transparency_report_views`: Report views (monthly)

**Logs:**
- Re-scan start/complete: `[SecurityReScanService] Weekly re-scan started, ${count} workflows to scan`
- Report submitted: `[MarketplaceController] Workflow ${id} reported by user ${userId}, reason: ${reason}`
- Workflow disabled: `[MarketplaceService] Workflow ${id} disabled by admin ${adminId}, reason: ${reason}`
- Appeal submitted: `[MarketplaceController] Appeal submitted for workflow ${id} by author ${authorId}`

**Alerts:**
- Critical findings detected in re-scan → alert admin Slack channel
- Re-scan cron job failure → alert ops team
- Disable action performed → audit log + Slack notification

### Project Structure Alignment

**Backend (Moku API):**
```
src/main/java/com/holokai/marketplace/
├── controller/MarketplaceController.java (add report, disable, appeal endpoints)
├── service/SecurityReScanService.java (NEW - cron job for weekly re-scans)
├── service/TransparencyReportService.java (NEW - monthly report generation)
├── service/SecurityScannerService.java (reused from E9-S5)
├── repository/WorkflowReportRepository.java (NEW - CRUD for workflow_reports)
├── dto/ReportRequest.java (NEW)
├── dto/DisableWorkflowRequest.java (NEW)
├── dto/AppealRequest.java (NEW)
└── dto/InvestigationQueueItemDTO.java (NEW)
```

**Desktop (Electron Renderer):**
```
src/lib/components/marketplace/
├── ReportWorkflowDialog.svelte (NEW - report submission form)
├── DisabledWorkflowBanner.svelte (NEW - persistent warning banner)
└── WorkflowDetailPage.svelte (MODIFIED - add report button, disabled status)
```

**Admin UI (Separate Admin App or Desktop Admin Mode):**
```
src/lib/components/admin/
├── InvestigationQueue.svelte (NEW - moderation dashboard)
├── DisableWorkflowDialog.svelte (NEW - disable form)
└── TransparencyReports.svelte (NEW - transparency report archive)
```

### References

**Source Documents:**
- [Tech Spec Epic 9](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-9.md#acceptance-criteria-authoritative) - AC-8.1 to AC-8.6
- [Tech Spec Epic 9 - Data Models](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-9.md#data-models-and-contracts) - workflow_reports table schema
- [Tech Spec Epic 9 - Security](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-9.md#security) - Security scanning, malware detection, weekly re-scans
- [Tech Spec Epic 9 - APIs](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-9.md#apis-and-interfaces) - MarketplaceController endpoints
- [Architecture](C:\Projects\repos\holokai\bmad\desktop-project\docs\architecture.md#security-architecture) - Security boundaries, admin RBAC

**Related Stories:**
- E9-S5 (Marketplace Publishing Pipeline): Shares SecurityScannerService for initial scans
- E9-S6 (Marketplace Discovery & Installation): Disabled workflows removed from browse
- E9-S7 (Freemium Business Model): Disabled premium workflows may trigger refunds

**Tech Stack:**
- Backend: Spring Boot (cron jobs via `@Scheduled`), PostgreSQL (workflow_reports table), ClamAV (malware scanning), AWS S3 (transparency reports)
- Desktop: Svelte 5, Electron IPC (report workflow, disabled workflow events)
- Admin UI: Svelte 5 (investigation queue, disable workflow dialog)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e9-s8-marketplace-trust-safety.context.xml

- docs/sprint-artifacts/e9-s8-marketplace-trust-safety.context.xml



### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

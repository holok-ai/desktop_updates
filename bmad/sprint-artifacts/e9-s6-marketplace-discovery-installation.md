# Story 9.6: Marketplace Discovery & Installation

Status: ready-for-dev

## Story

As a Holokai Desktop user,
I want to browse and install workflows from the marketplace,
so that I can extend my workflow capabilities with community-created templates without building from scratch.

## Acceptance Criteria

1. **AC-6.1: Marketplace Browse UI** - Marketplace browse UI with search, filters (category, pricing), sort (popular, highest rated) works
2. **AC-6.2: Workflow Detail Page** - Workflow detail page shows all info (description, permissions, trust indicators, reviews)
3. **AC-6.3: Permission Disclosure** - Permission disclosure shown before installation (mandatory)
4. **AC-6.4: Installation Location** - Installation flow allows choosing "My Workflows" vs team project
5. **AC-6.5: Workflow Execution** - Installed workflows appear in workflow list and are executable
6. **AC-6.6: Update Notifications** - Update notifications shown when new versions available
7. **AC-6.7: Trust Indicators** - Trust indicators displayed (security scan badge, install count, rating, verified publisher)

## Tasks / Subtasks

- [ ] **Task 1: Marketplace Browse UI Component** (AC: #6.1, #6.7)
  - [ ] Create `MarketplaceBrowse.svelte` component in renderer
  - [ ] Implement search bar with debounced full-text search
  - [ ] Add category filter dropdown (Documentation, Code Generation, Testing, Deployment, etc.)
  - [ ] Add pricing filter (Free, Premium, All)
  - [ ] Add sort selector (Popular, Highest Rated, Recently Updated, Trending)
  - [ ] Implement workflow card grid layout with pagination
  - [ ] Display trust indicators on each card (security badge, install count, rating)
  - [ ] Add loading states and empty state UI
  - [ ] Wire up to `MarketplaceService.browseWorkflows()` IPC call
  - [ ] Test search returns correct results
  - [ ] Test filters combine correctly
  - [ ] Test pagination works with filters

- [ ] **Task 2: Workflow Detail Page Component** (AC: #6.2, #6.3, #6.7)
  - [ ] Create `WorkflowDetailPage.svelte` component in renderer
  - [ ] Display workflow metadata (name, description, long description markdown)
  - [ ] Display author profile section (name, verified badge, reputation)
  - [ ] Display permissions/capabilities section with clear disclosure
  - [ ] Display security scan results (risk score, last scanned date, findings count)
  - [ ] Display trust indicators (install count, average rating, verified publisher badge)
  - [ ] Display reviews section with rating breakdown
  - [ ] Add "Install" button (or "Purchase" for premium workflows)
  - [ ] Add "View Reviews" expandable section
  - [ ] Wire up to `MarketplaceService.getWorkflow()` IPC call
  - [ ] Test all metadata displays correctly
  - [ ] Test permission section is clear and complete

- [ ] **Task 3: Permission Disclosure Dialog** (AC: #6.3)
  - [ ] Create `PermissionDisclosureDialog.svelte` modal component
  - [ ] Display all requested capabilities with clear descriptions
    - Example: "Filesystem: Read/Write in workspace"
    - Example: "Network: HTTPS requests to github.com"
  - [ ] Display risk score prominently (Low/Medium/High)
  - [ ] Display security scan summary (date, findings)
  - [ ] Add checkbox "I understand and approve these permissions"
  - [ ] Disable "Install" button until checkbox checked
  - [ ] Add "Cancel" and "Approve & Install" buttons
  - [ ] Test dialog shows before any installation
  - [ ] Test cannot proceed without approval

- [ ] **Task 4: Installation Location Picker** (AC: #6.4)
  - [ ] Create `InstallLocationPicker.svelte` component
  - [ ] List "My Workflows" as first option (default)
  - [ ] List all team projects user has edit access to
  - [ ] Show project icons and names
  - [ ] Set default selection to "My Workflows"
  - [ ] Return selected projectId or null for personal
  - [ ] Test shows all accessible projects
  - [ ] Test default selection works

- [ ] **Task 5: MarketplaceService IPC Implementation (Main Process)** (AC: #6.1, #6.2, #6.5)
  - [ ] Create `MarketplaceService.ts` in electron main process
  - [ ] Implement `browseWorkflows(search, filters, sort, page)` method
    - Call Moku API `GET /api/marketplace/workflows` with query params
    - Parse response and return MarketplaceWorkflow[] page
    - Handle pagination (return page + hasMore flag)
  - [ ] Implement `getWorkflow(workflowId)` method
    - Call Moku API `GET /api/marketplace/workflows/{id}`
    - Parse and return full MarketplaceWorkflow details
  - [ ] Implement `installWorkflow(workflowId, installLocation)` method
    - Call Moku API `POST /api/marketplace/workflows/{id}/install`
    - Store approved capabilities in DB (user_workflow_approvals)
    - Download .wfpkg from packageUrl
    - Extract to installation directory:
      - Personal: `~/.holokai/My Workflows/marketplace/{author}/{workflow}/`
      - Project: `projects/{projectId}/.holokai/workflows/marketplace/{author}/{workflow}/`
    - Call `WorkflowService.refreshWorkflowList()` to update Epic 7 list
    - Return installation status
  - [ ] Implement `checkForUpdates()` method
    - Get list of installed marketplace workflows
    - For each, call API to get latest version
    - Compare versions using semver
    - Return list of available updates
  - [ ] Add error handling for network failures, API errors
  - [ ] Write unit tests mocking Moku API calls

- [ ] **Task 6: IPC Handlers Registration** (AC: #6.1, #6.2, #6.5, #6.6)
  - [ ] Register `marketplace:browse` IPC handler in main.ts
  - [ ] Register `marketplace:get-workflow` IPC handler
  - [ ] Register `marketplace:install` IPC handler
  - [ ] Register `marketplace:check-updates` IPC handler
  - [ ] Expose handlers in preload.ts context bridge
  - [ ] Test IPC communication end-to-end

- [ ] **Task 7: Installation Flow Integration** (AC: #6.4, #6.5)
  - [ ] Wire "Install" button to open PermissionDisclosureDialog
  - [ ] On approval, show InstallLocationPicker
  - [ ] On location selected, call `MarketplaceService.installWorkflow()`
  - [ ] Show progress indicator during download/extraction
  - [ ] Show success toast on completion
  - [ ] Navigate to workflow list (Epic 7) after install
  - [ ] Handle errors (network failure, extraction failure) gracefully
  - [ ] Test full flow: browse → detail → approve → location → install
  - [ ] Test workflow appears in Epic 7 list after install
  - [ ] Test workflow is executable after install

- [ ] **Task 8: Update Notifications UI** (AC: #6.6)
  - [ ] Add "Check for Updates" button to workflow list (Epic 7)
  - [ ] Call `MarketplaceService.checkForUpdates()` on button click
  - [ ] Display update available badge on workflow cards
  - [ ] Create `UpdateAvailableDialog.svelte` showing changelog
  - [ ] Add "Update" button to re-install latest version
  - [ ] Test update check returns correct results
  - [ ] Test update flow works end-to-end

- [ ] **Task 9: Integration with Epic 7 Workflow List** (AC: #6.5)
  - [ ] Ensure Epic 7 `WorkflowService` scans marketplace directories
  - [ ] Add source indicator to workflow list items (Marketplace vs Custom)
  - [ ] Display author name for marketplace workflows
  - [ ] Add "View in Marketplace" link to workflow detail
  - [ ] Test marketplace workflows appear alongside custom workflows
  - [ ] Test marketplace workflows execute via Epic 10 engine

- [ ] **Task 10: Review and Rating UI** (AC: #6.2)
  - [ ] Create `ReviewList.svelte` component
  - [ ] Display reviews with star rating, comment, date
  - [ ] Add "Write Review" button (after user installs workflow)
  - [ ] Create `WriteReviewDialog.svelte` with star rating picker and comment field
  - [ ] Call `MarketplaceService.submitReview()` IPC (create method)
  - [ ] Test reviews display correctly
  - [ ] Test user can submit review after installation

- [ ] **Task 11: E2E Testing** (AC: All)
  - [ ] Write Playwright E2E test for browse → search → filter → sort flow
  - [ ] Write E2E test for workflow detail → permission disclosure → install flow
  - [ ] Write E2E test for installed workflow execution
  - [ ] Write E2E test for update notification → update flow
  - [ ] Mock Moku API responses in E2E tests
  - [ ] Verify all acceptance criteria pass

## Dev Notes

### Marketplace API Integration

**Moku API Endpoints (from tech-spec-epic-9.md §4.3):**
- `GET /api/marketplace/workflows` - Browse with search/filters/sort/pagination
- `GET /api/marketplace/workflows/{id}` - Get workflow details
- `POST /api/marketplace/workflows/{id}/install` - Install workflow (stores user approval)
- `GET /api/marketplace/workflows/{id}/reviews` - Get reviews
- `POST /api/marketplace/workflows/{id}/reviews` - Submit review

**Installation Directories:**
- Personal: `~/.holokai/My Workflows/marketplace/{author}/{workflow}/`
- Project: `projects/{projectId}/.holokai/workflows/marketplace/{author}/{workflow}/`

**Package Format:**
.wfpkg files are ZIP archives containing:
- `manifest.json` - Workflow metadata, capabilities
- `workflow.yaml` - Workflow definition
- `instructions.md` - Usage instructions
- `templates/` - Output templates

### Capability Approval Flow

1. User clicks "Install" on workflow detail page
2. `PermissionDisclosureDialog` shows all capabilities from manifest
3. User reviews and checks approval box
4. User clicks "Approve & Install"
5. `InstallLocationPicker` prompts for location
6. Call `POST /api/marketplace/workflows/{id}/install` with approved capabilities
7. API stores approval in `user_workflow_approvals` table
8. Download .wfpkg from S3 URL
9. Extract to installation directory
10. Epic 10 enforces approved capabilities at runtime

### Epic 10 Integration

Marketplace workflows execute via Epic 10 Portable Workflow Engine:
- Storage abstraction: All file access via storage service URLs (not direct paths)
- Capability enforcement: Epic 10 checks `user_workflow_approvals` before execution
- Sandboxing: Scripts execute in restricted environment with approved capabilities

### Trust Indicators

Display on workflow cards and detail page:
- **Security Scan Badge**: Low/Medium/High risk score from ClamAV scan
- **Install Count**: Total installs (social proof)
- **Average Rating**: Star rating (0.0-5.0)
- **Verified Publisher**: Checkmark badge for verified authors
- **Last Scanned**: Date of last security scan

### Project Structure Notes

**Alignment with Epic 3 and Epic 7:**
- "My Workflows" is a personal project (Epic 3 model)
- Team projects list comes from `ProjectService.getAll()`
- Installed workflows integrate with Epic 7 workflow list
- Epic 7 `WorkflowService` refreshed after installation

### Testing Standards

Follow existing test patterns:
- Unit tests for `MarketplaceService` methods (mock Moku API)
- Component tests for Svelte components (Svelte Testing Library)
- E2E tests for full user flows (Playwright)
- Integration tests for IPC communication
- Target 85%+ code coverage for this story

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-9.md §4.3 - Marketplace API Endpoints]
- [Source: docs/sprint-artifacts/tech-spec-epic-9.md §4.4 - Marketplace Installation Flow]
- [Source: docs/sprint-artifacts/tech-spec-epic-9.md §6 - Acceptance Criteria E9-S6]
- [Source: docs/architecture.md §2 - IPC Pattern]
- [Source: docs/sprint-artifacts/tech-spec-epic-10.md - Portable Workflow Engine Integration]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e9-s6-marketplace-discovery-installation.context.xml

- docs/sprint-artifacts/e9-s6-marketplace-discovery-installation.context.xml



### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

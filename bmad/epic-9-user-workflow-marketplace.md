# Epic 9: User Workflow Marketplace

**Priority:** P1 (High - Enterprise MVP Differentiator, Post-MVP Month 6)
**Owner:** Peter
**Description:** Enable users to create, share, and monetize workflows through a curated marketplace with AI-assisted creation, GUI builder, freemium business model, and enterprise private registries.

**Related Documents:**
- PRD §3.7: Workflow Marketplace & Creation
- Architecture Addendum: `architecture-workflow-engine-marketplace-addendum-2025-11-26.md` §4
- Requirements: `workflow-engine-requirements.md`

**Dependencies:**
- Epic 10 (Portable Workflow Engine) - MUST complete first (architectural foundation)
- Epic 1 (Database & API Foundation) - Workflow tables, templates
- Epic 3 (Project Collaboration) - "My Workflows" personal project

---

## Epic Overview

This epic transforms Holokai Desktop from a chat-to-workflow tool into a **workflow creation platform** where users can author, share, and monetize workflows. The marketplace becomes a business discriminator with network effects: more creators → more workflows → more users → more creators.

**MVP Scope (Month 4):**
- ✅ 50+ curated workflow templates (already in PRD §3.7.2)
- ✅ Chat-driven template activation (already in PRD §3.2)
- ✅ "My Workflows" personal project (already in Epic 3 scope)

**Post-MVP Scope (Month 6 - This Epic):**
- User-created workflows (AI-assisted, GUI builder, YAML editor)
- Marketplace publishing pipeline (scan → review → test → approve)
- Freemium business model (free + premium workflows, revenue sharing)
- Trust & safety (security scanning, ratings, verified publishers)
- Enterprise private registries (organization-hosted marketplaces)

---

## Stories

### E9-S1: "My Workflows" Personal Project

**Size:** M
**Priority:** P0 (Required for Epic 10)
**Description:** Auto-create "My Workflows" personal project for each user as a unified workspace for personal workflows.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Personal project model | PRD | §3.7.3 |
| Project isolation | Workflow Requirements | §2.1 |
| Data model | Architecture Addendum | §3 |

**Tasks:**
- [ ] Update `Project` interface with `type: 'personal' | 'team'` field
  - [ ] Add type column to `projects` table (VARCHAR, default 'team')
  - [ ] Add migration V2.6 for type column
  - [ ] Update ProjectDTO and ProjectEntity
- [ ] Create `createUserPersonalProject()` function
  - [ ] Auto-create on user signup with deterministic ID: `{userId}-personal`
  - [ ] Set name: "My Workflows", type: "personal", ownerId: userId
  - [ ] Create default config.yaml in `.holokai/` directory
  - [ ] Create `workflows/marketplace/` and `workflows/custom/` subdirectories
- [ ] Update project list UI to distinguish personal vs team projects
  - [ ] Show "My Workflows" with special icon (📁 vs 👥)
  - [ ] Group in sidebar: "My Workflows" (top) + "Team Projects" (below)
- [ ] Implement project isolation enforcement
  - [ ] Storage service checks: prevent cross-project file access
  - [ ] Config loading: load ONLY current project's config (no merging)
- [ ] Test personal project creation on new user signup

**Acceptance Criteria:**
- [ ] "My Workflows" project auto-created for all new users
- [ ] Personal project appears in project list with distinct visual treatment
- [ ] Workflows in personal project cannot access team project files (isolation enforced)
- [ ] Config loading uses only personal project config (no inheritance)

---

### E9-S2: Workflow Creation UI - AI Assisted

**Size:** L
**Priority:** P1
**Description:** AI-assisted workflow creation where user describes desired workflow and AI generates structure, steps, and templates through conversational prompts.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| AI-assisted creation flow | PRD | §3.7.1 |
| Workflow tiers | Workflow Requirements | §1.2 |
| AI client | Architecture Addendum | §2.4 |

**Tasks:**
- [ ] Create AI workflow creation service
  - [ ] Implement `describeWorkflow(userInput: string)` → Calls Anthropic to extract intent
  - [ ] Implement `suggestStructure(description)` → AI generates step-by-step structure
  - [ ] Implement `refineStructure(structure, userFeedback)` → Iterative refinement
  - [ ] Implement `generateTemplate(structure)` → AI generates output template with Handlebars
- [ ] Create conversational UI for workflow creation
  - [ ] Modal: "Describe your workflow" (text area, AI icon)
  - [ ] Show AI-suggested structure with editable steps
  - [ ] Allow user to approve/modify each step
  - [ ] Show guided prompts for template details ("What should the output include?")
  - [ ] Preview generated workflow.yaml and template.md
- [ ] Implement tier detection (Basic vs Intermediate)
  - [ ] AI detects if workflow needs conditionals → Intermediate
  - [ ] Validate tier constraints (Basic: no conditionals, Intermediate: if/then allowed)
- [ ] Save generated workflow to "My Workflows/custom/"
  - [ ] Create workflow directory structure
  - [ ] Write manifest.json, workflow.yaml, instructions.md, template.md
  - [ ] Add to user's workflow library
- [ ] Test end-to-end AI workflow creation

**Acceptance Criteria:**
- [ ] User can describe workflow in natural language and get AI-suggested structure
- [ ] AI detects workflow tier (Basic vs Intermediate) based on requirements
- [ ] Iterative refinement works (user can modify suggested steps)
- [ ] Generated workflow saved to "My Workflows/custom/" and appears in workflow list

---

### E9-S3: Workflow Creation UI - GUI Builder

**Size:** XL
**Priority:** P1
**Description:** Visual workflow builder with timeline/flowchart view, step editor, template editor (split view + form builder), and raw YAML editor for advanced users.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| GUI builder components | PRD | §3.7.1 |
| Workflow definition format | Workflow Requirements | §4 |
| Visual representation | Architecture Addendum | N/A (UI design) |

**Tasks:**
- [ ] Create workflow builder UI (timeline OR flowchart - choose simpler)
  - [ ] Timeline view: Horizontal steps (Step 1 → Step 2 → Step 3)
  - [ ] OR Flowchart view: Boxes + arrows (if conditionals needed for Intermediate tier)
  - [ ] Drag-and-drop step ordering
  - [ ] Add/delete steps with (+) / (x) buttons
- [ ] Create step editor component
  - [ ] Step type selector: Ask User, Generate Output, Run Script, Conditional (Intermediate only)
  - [ ] Step configuration form (varies by type)
  - [ ] Variable insertion dropdown ({{variable_name}})
- [ ] Create template editor (split view)
  - [ ] Left pane: Template code editor (markdown with Handlebars)
  - [ ] Right pane: Live preview with sample data
  - [ ] Form builder option: Drag-and-drop sections → auto-generate template
  - [ ] Variable palette (drag variables into template)
- [ ] Create raw YAML editor
  - [ ] Monaco editor with YAML syntax highlighting
  - [ ] Schema validation (manifest.json, workflow.yaml)
  - [ ] IntelliSense for workflow fields
  - [ ] Toggle between GUI and YAML (sync changes)
- [ ] Implement hybrid editing (GUI ↔ YAML sync)
  - [ ] Changes in GUI update YAML
  - [ ] Changes in YAML update GUI (if valid)
  - [ ] Conflict resolution if YAML edited manually
- [ ] Save workflow package
  - [ ] Validate all required files (manifest.json, workflow.yaml, etc.)
  - [ ] Create .wfpkg bundle (compressed .zip)
  - [ ] Save to "My Workflows/custom/"

**Acceptance Criteria:**
- [ ] Timeline or flowchart view functional (choose one for MVP)
- [ ] Step editor allows configuring all step types (Ask, Generate, Script, Conditional)
- [ ] Template editor with split view (code + preview) functional
- [ ] Form builder auto-generates template from dragged sections
- [ ] Raw YAML editor with syntax highlighting and validation functional
- [ ] GUI ↔ YAML sync works bidirectionally
- [ ] Workflow saved as .wfpkg bundle in "My Workflows/custom/"

---

### E9-S4: Workflow Packaging Service

**Size:** M
**Priority:** P1
**Description:** Create .wfpkg bundle from workflow directory, validate manifest schema, compress files, generate integrity hash.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Package structure | Workflow Requirements | §4.1 |
| Manifest schema | Workflow Requirements | Appendix A |
| Packaging service | Architecture Addendum | §4.1 |

**Tasks:**
- [ ] Create `WorkflowPackagingService`
  - [ ] `createPackage(workflowDir: string): Promise<Buffer>` - Create .wfpkg from directory
  - [ ] `validateManifest(manifest: object): ValidationResult` - Validate against JSON schema
  - [ ] `compressFiles(files: File[]): Promise<Buffer>` - Zip files into .wfpkg
  - [ ] `generateHash(packageFile: Buffer): string` - SHA-256 hash for integrity
- [ ] Implement manifest validation
  - [ ] JSON schema for manifest.json (see Workflow Requirements Appendix A)
  - [ ] Required fields: name, version, tier, author, license, description, category
  - [ ] Version format: Semantic versioning (X.Y.Z)
  - [ ] Permissions array validation (filesystem:read, network:https, etc.)
- [ ] Implement .wfpkg compression
  - [ ] Use JSZip library to create compressed archive
  - [ ] Preserve directory structure (manifest.json at root, templates/, scripts/, etc.)
  - [ ] Exclude unnecessary files (.DS_Store, node_modules/, etc.)
- [ ] Implement package extraction
  - [ ] `extractPackage(packageFile: Buffer): Promise<WorkflowDirectory>` - Unzip .wfpkg
  - [ ] Validate extracted contents match expected structure
- [ ] Test packaging round-trip (directory → .wfpkg → extract → directory)

**Acceptance Criteria:**
- [ ] Workflow directory correctly packaged into .wfpkg bundle
- [ ] Manifest.json validated against JSON schema
- [ ] .wfpkg file correctly compressed (can be extracted with standard zip tools)
- [ ] SHA-256 hash generated for package integrity
- [ ] Package extraction works (round-trip: directory → package → extract)

---

### E9-S5: Marketplace Publishing Pipeline

**Size:** XL
**Priority:** P1
**Description:** Full publishing pipeline from submission to approval: automated security scan, syntax validation, human review queue, test execution, and publish to marketplace.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Publishing flow | PRD | §3.7.2, Workflow Requirements | §5.3 |
| Security scanning | Architecture Addendum | §4.3 |
| Database schema | Architecture Addendum | §4.2 |

**Tasks:**
- [ ] Create database schema (Moku API)
  - [ ] `marketplace_workflows` table (see Architecture Addendum §4.2)
  - [ ] `workflow_reviews` table (ratings, comments)
  - [ ] `publisher_profiles` table (verified publishers, reputation)
  - [ ] `user_workflow_approvals` table (approved capabilities per workflow)
- [ ] Implement submission endpoint: `POST /marketplace/submit`
  - [ ] Accept .wfpkg file upload
  - [ ] Store in S3 (or local storage for MVP)
  - [ ] Create pending entry in `marketplace_workflows` table
  - [ ] Trigger automated security scan
- [ ] Implement security scanner
  - [ ] Malware scan with ClamAV (or VirusTotal API)
  - [ ] Vulnerability scan for dependencies (npm audit, Snyk)
  - [ ] Code obfuscation detection (entropy analysis, eval() detection)
  - [ ] Suspicious pattern detection (see Architecture Addendum §4.3)
  - [ ] Generate security scan report (findings, risk score)
- [ ] Implement syntax validation
  - [ ] Validate manifest.json schema
  - [ ] Validate workflow.yaml schema
  - [ ] Validate instructions.md XML structure
  - [ ] Validate template.md Handlebars syntax
  - [ ] Check for required files
- [ ] Create human review queue UI (Holokai team)
  - [ ] List pending workflows awaiting review
  - [ ] Show workflow details: code, templates, permissions, security scan results
  - [ ] Review checklist: code quality, security, documentation, test execution
  - [ ] Approve/Reject with feedback notes
- [ ] Implement test execution (automated QA)
  - [ ] Execute workflow with sample inputs
  - [ ] Verify output matches expected template
  - [ ] Check for runtime errors
  - [ ] Validate execution time < 60 seconds
- [ ] Publish approved workflows
  - [ ] Update status: pending → approved
  - [ ] Make visible in marketplace browse/search
  - [ ] Notify author via email
- [ ] Handle rejections
  - [ ] Update status: pending → rejected
  - [ ] Store rejection reason in review_notes
  - [ ] Notify author with feedback
  - [ ] Allow resubmission after fixes

**Acceptance Criteria:**
- [ ] Workflow submission endpoint accepts .wfpkg uploads
- [ ] Security scanner detects malware, vulnerabilities, obfuscation (test with known bad patterns)
- [ ] Syntax validation rejects invalid manifest/workflow/template files
- [ ] Human review queue shows pending workflows with all relevant info
- [ ] Approved workflows appear in marketplace
- [ ] Rejected workflows send feedback to author

---

### E9-S6: Marketplace Discovery & Installation

**Size:** L
**Priority:** P1
**Description:** Marketplace browse UI with search, categories, workflow detail page with permissions/trust indicators, and installation flow with permission disclosure.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Marketplace UI | PRD | §3.7.2 |
| Trust indicators | Workflow Requirements | §6.2 |
| Installation flow | Architecture Addendum | §4.2 |

**Tasks:**
- [ ] Create marketplace browse UI
  - [ ] Category filter: Documentation, Code Generation, Testing, Deployment, etc.
  - [ ] Search bar (full-text search across name, description, tags)
  - [ ] Sort options: Popular, Highest Rated, Recently Updated, Trending
  - [ ] Grid/list view toggle
  - [ ] Workflow cards showing: icon, name, author, rating, install count, price (if premium)
- [ ] Implement search backend (Moku API)
  - [ ] `GET /marketplace/workflows?search=...&category=...&sort=...`
  - [ ] PostgreSQL full-text search on name + description + tags
  - [ ] Filter by category, tier, pricing type (free/premium)
  - [ ] Pagination support (limit, offset)
- [ ] Create workflow detail page
  - [ ] Header: icon, name, author, version, rating, install count
  - [ ] Description (long_description markdown rendered)
  - [ ] Screenshots/demo video (optional, post-MVP)
  - [ ] Trust indicators (see below)
  - [ ] Permissions disclosure (mandatory)
  - [ ] Reviews & ratings section
  - [ ] [Install] button (or [Purchase $X.XX] for premium)
- [ ] Implement trust indicators
  - [ ] 🔒 Security scan badge: "Last scanned: 2 days ago, no issues" + risk score (Low/Medium/High)
  - [ ] 👥 Community feedback: Star rating (1-5), review count, recent comments
  - [ ] ⭐ Install count: "10K+ installs"
  - [ ] ✓ Verified Publisher badge (if author is verified)
- [ ] Implement permission disclosure (mandatory before install)
  - [ ] Modal dialog showing:
    ```
    This workflow requests:
    ✓ Filesystem: Read/Write in workspace
    ✓ Network: HTTPS requests to github.com
    ✓ Git: Read repository history
    ✓ Bash: Execute shell commands

    Risk Score: Medium Risk

    [Cancel] [Approve & Install]
    ```
  - [ ] Store user approval in `user_workflow_approvals` table
- [ ] Implement installation flow
  - [ ] User selects install location: "My Workflows" OR current team project
  - [ ] Download .wfpkg from S3 (or Storage Service)
  - [ ] Extract to `.holokai/workflows/marketplace/{author}/{workflow}/`
  - [ ] Add to workflow list
  - [ ] Show success toast: "Workflow installed successfully"
- [ ] Implement update notifications
  - [ ] Check for updates daily (compare installed version vs latest in marketplace)
  - [ ] Show notification: "Update available for 'Release Notes' workflow (v1.1.0)"
  - [ ] User clicks to review changelog
  - [ ] User approves → re-download and extract new version

**Acceptance Criteria:**
- [ ] Marketplace browse UI with search, filters, sort works
- [ ] Workflow detail page shows all info + trust indicators
- [ ] Permission disclosure shown before installation (mandatory)
- [ ] Installation flow allows choosing "My Workflows" vs team project
- [ ] Installed workflows appear in workflow list
- [ ] Update notifications shown when new versions available

---

### E9-S7: Freemium Business Model

**Size:** M
**Priority:** P1
**Description:** Premium workflow pricing, Stripe payment processing, revenue sharing (70% creator, 30% Holokai), creator grants, and reputation system.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Freemium model | PRD | §3.7.2, Workflow Requirements | §5.5 |
| Revenue flow | Architecture Addendum | §4.4 |
| Creator incentives | Workflow Requirements | §5.5 |

**Tasks:**
- [ ] Integrate Stripe payment processing
  - [ ] Create Stripe account + API keys
  - [ ] Implement Stripe Checkout for premium workflows
  - [ ] Store payment intent ID in `marketplace_workflows` table
  - [ ] Handle payment success/failure webhooks
- [ ] Implement premium workflow purchase flow
  - [ ] Detail page shows [Purchase $X.XX] button (instead of [Install])
  - [ ] Click → Stripe Checkout modal
  - [ ] User completes payment
  - [ ] On success → download and install workflow
  - [ ] On failure → show error message
- [ ] Implement revenue sharing (70/30 split)
  - [ ] Calculate creator payout: price * 0.70
  - [ ] Store in `creator_payouts` table (NEW table needed)
  - [ ] Monthly payout batch job (via Stripe Connect)
  - [ ] Minimum payout threshold: $100
- [ ] Create creator dashboard
  - [ ] Show total revenue, pending payout, last payout date
  - [ ] Show install count, ratings, reviews per workflow
  - [ ] Show reputation score, badges, leaderboard rank
- [ ] Implement creator grants
  - [ ] Monthly job: Calculate top 10% by install count + rating
  - [ ] Award grants: $500-$5,000/year based on criteria
  - [ ] Send notification to grant recipients
- [ ] Implement reputation system
  - [ ] Leaderboards: Most Installed, Highest Rated, Trending This Month
  - [ ] Badges: "Top Contributor" (>500 installs), "Rising Star" (>100 installs in 30 days), "Verified Publisher"
  - [ ] Profile page with stats, portfolio, testimonials

**Acceptance Criteria:**
- [ ] Premium workflows purchasable via Stripe Checkout
- [ ] Revenue sharing works (70% creator, 30% Holokai)
- [ ] Monthly payouts to creators via Stripe Connect (>$100 threshold)
- [ ] Creator dashboard shows revenue, stats, reputation
- [ ] Grants awarded to top contributors monthly
- [ ] Leaderboards and badges functional

---

### E9-S8: Marketplace Trust & Safety

**Size:** M
**Priority:** P1
**Description:** Weekly re-scanning of published workflows, community moderation (report/flag), Holokai investigation process, and malicious workflow disabling.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Trust & safety | PRD | §3.7.2, Workflow Requirements | §6 |
| Security scanning | Architecture Addendum | §4.3 |
| Community moderation | Workflow Requirements | §6.4 |

**Tasks:**
- [ ] Implement weekly re-scanning
  - [ ] Cron job: Scan all published workflows weekly
  - [ ] Run security scanner on latest .wfpkg file
  - [ ] Update `last_scanned_at` and `security_scan_result` in DB
  - [ ] If new issues found → flag for review (status: flagged)
- [ ] Implement community moderation UI
  - [ ] "Report" button on workflow detail page
  - [ ] Report reasons: Malicious code, Inaccurate description, Security issue, Spam
  - [ ] Submit report → creates entry in `workflow_reports` table (NEW table needed)
- [ ] Create Holokai investigation queue
  - [ ] List flagged workflows + community reports
  - [ ] Show workflow code, security scan results, report details
  - [ ] Actions: Disable workflow, Contact author, Dismiss report
- [ ] Implement workflow disabling
  - [ ] Update status: approved → disabled
  - [ ] Remove from marketplace browse/search
  - [ ] Notify author via email
  - [ ] Users who installed workflow see warning banner
- [ ] Implement appeal process
  - [ ] Disabled workflow authors can submit appeal
  - [ ] Holokai reviews appeal (human judgment)
  - [ ] Re-enable if appeal accepted
- [ ] Create transparency report
  - [ ] Monthly report: # workflows scanned, # flagged, # disabled, # appeals
  - [ ] Publish publicly for trust building

**Acceptance Criteria:**
- [ ] Weekly security re-scans functional (automated job)
- [ ] Community report button functional (users can flag workflows)
- [ ] Holokai investigation queue shows flagged workflows
- [ ] Malicious workflows can be disabled (removed from marketplace)
- [ ] Appeal process functional (authors can contest disabling)
- [ ] Transparency report published monthly

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Workflows Created** | 1,000+ by Month 6 | User-created workflows in "My Workflows" |
| **Workflows Published** | 100+ by Month 6 | Approved workflows in marketplace |
| **Marketplace Adoption** | 10,000+ workflow executions | Total executions of marketplace workflows |
| **Marketplace Revenue** | $50K ARR by Year 1 | Premium workflow sales (30% cut) |
| **Creator Grants** | 10+ recipients | Top contributors receiving grants |
| **Average Rating** | 4.0+ stars | Average workflow rating in marketplace |
| **Approval Rate** | 80%+ | % of submitted workflows approved |

---

## Dependencies

**Blocked By:**
- Epic 10 (Portable Workflow Engine) - MUST complete first (provides workflow execution foundation)
- Epic 1 (Database & API Foundation) - Workflow tables, templates API
- Epic 3 (Project Collaboration) - "My Workflows" personal project model

**Blocks:**
- None (this is a post-MVP feature, doesn't block other epics)

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Low marketplace adoption** | Medium | High | Pre-seed with 50+ curated templates (MVP); invest in creator incentives (grants, revenue sharing) |
| **Security vulnerabilities in published workflows** | Medium | High | Rigorous publishing pipeline (scan → review → test); weekly re-scans; community moderation |
| **Complex GUI builder delays launch** | High | Medium | Start with timeline view (simpler than flowchart); defer form builder to post-MVP |
| **Payment processing complexity** | Low | Medium | Use Stripe (proven solution); start with manual payouts if Stripe Connect delayed |

---

**End of Epic 9**

# Epic Technical Specification: User Workflow Marketplace

Date: 2025-11-26
Author: Peter
Epic ID: 9
Status: Draft

---

## Overview

Epic 9 transforms Holokai Desktop from a chat-to-workflow tool into a **workflow creation and marketplace platform**, enabling users to create, share, and monetize custom workflows. This epic delivers 8 stories spanning workflow creation (AI-assisted + GUI builder), packaging, marketplace publishing pipeline, discovery/installation, freemium business model, and trust & safety systems.

**Strategic Importance:**
- **Network Effects**: More creators → more workflows → more users → more creators (flywheel effect)
- **Revenue Model**: Freemium marketplace with 70/30 revenue split (creator/Holokai) generates sustainable revenue
- **Competitive Moat**: User-generated workflow marketplace differentiates from competitors (Zapier, Make.com have closed template libraries)
- **Enterprise Value**: Private workflow registries enable enterprise customers to build internal tool ecosystems

**Timeline:**
- **MVP (Month 4)**: 50+ curated workflow templates, chat-driven activation (PRD §3.7.2, §3.2) - **already in scope**
- **Post-MVP (Month 6 - This Epic)**: User-created workflows, marketplace publishing, freemium monetization, trust & safety

This epic delivers the **full marketplace infrastructure** required for post-MVP launch in Month 6.

## Objectives and Scope

**In Scope (Post-MVP Month 6):**
- **E9-S1**: "My Workflows" personal project auto-creation for each user (unified workspace for personal workflows)
- **E9-S2**: AI-assisted workflow creation (conversational prompts → AI generates structure, steps, templates)
- **E9-S3**: GUI workflow builder (timeline/flowchart view, step editor, template editor, YAML editor)
- **E9-S4**: Workflow packaging service (.wfpkg bundle creation, manifest validation, SHA-256 integrity hash)
- **E9-S5**: Marketplace publishing pipeline (security scan, syntax validation, human review, test execution, approval/rejection)
- **E9-S6**: Marketplace discovery & installation (browse UI, search, workflow detail page, permission disclosure, installation flow)
- **E9-S7**: Freemium business model (Stripe payment processing, 70/30 revenue split, creator dashboard, grants, reputation system)
- **E9-S8**: Trust & safety (weekly re-scanning, community moderation, investigation queue, workflow disabling, appeal process)

**Already in MVP (Month 4 - NOT in this epic):**
- 50+ curated workflow templates (PRD §3.7.2) - Pre-built by Holokai team
- Chat-to-workflow progression (PRD §3.2) - AI suggests workflows based on chat patterns
- Basic workflow execution (Epic 7) - Execute workflows from UI
- Portable workflow engine (Epic 10) - Execution infrastructure with storage abstraction and capability sandboxing

**Out of Scope (Deferred to Later):**
- Enterprise private workflow registries (organization-hosted marketplaces) - Year 2 feature
- Workflow versioning and rollback - Post-MVP Month 8+
- Advanced workflow tier (loop constructs, invoke other workflows, knowledge bases) - PRD §3.7.1, Post-MVP Month 8+
- Workflow analytics dashboard (execution stats, performance metrics) - Post-MVP Month 9+
- Multi-language support for templates (i18n) - Post-MVP Month 10+
- Mobile marketplace app (iOS, Android) - Year 2
- API-first marketplace (headless, allow third-party integrations) - Year 2

## System Architecture Alignment

**Architecture References:**
- Multi-process Electron architecture (ARCH §1): Main process handles workflow packaging/publishing, renderer handles creation UI
- Moku API integration (ARCH §3): New marketplace endpoints for publishing, discovery, payments
- Epic 10 Portable Workflow Engine (tech-spec-epic-10.md): Workflows created in Epic 9 executed by Epic 10 engine
- Epic 7 Workflows (tech-spec-epic-7.md): Workflow execution UI reused for marketplace workflows
- Epic 3 Project Collaboration (tech-spec-epic-3.md): "My Workflows" personal project model

**Component Integration:**

1. **Moku API (Backend) - New Marketplace Infrastructure**:
   - New `MarketplaceController` with endpoints: `/marketplace/workflows`, `/marketplace/submit`, `/marketplace/purchase`
   - New database tables: `marketplace_workflows`, `workflow_reviews`, `publisher_profiles`, `user_workflow_approvals`, `creator_payouts`
   - Security scanner service (ClamAV integration, vulnerability scanning)
   - Stripe payment integration (Checkout + Connect APIs)

2. **Electron Main Process - Workflow Creation & Packaging**:
   - `AIWorkflowCreationService`: Calls Anthropic API to generate workflow structure from user descriptions
   - `WorkflowPackagingService`: Creates .wfpkg bundles (ZIP compression, manifest validation, SHA-256 hashing)
   - `MarketplaceService`: Submit workflows, check for updates, download .wfpkg files
   - S3 or local storage for .wfpkg files (MVP: local, Post-MVP: S3)

3. **Electron Renderer Process - Creation & Marketplace UI**:
   - `AIWorkflowCreationDialog.svelte`: Conversational UI for AI-assisted workflow creation
   - `GUIWorkflowBuilder.svelte`: Timeline/flowchart editor, step editor, template editor
   - `MarketplaceBrowse.svelte`: Browse marketplace with search, filters, categories
   - `WorkflowDetailPage.svelte`: Workflow details, permissions, trust indicators, install button
   - `CreatorDashboard.svelte`: Revenue stats, workflow analytics, reputation scores

4. **Epic 10 Integration**:
   - Workflows created in Epic 9 are packaged as .wfpkg bundles
   - Epic 10's `WorkflowEngine` executes installed marketplace workflows
   - Storage abstraction ensures marketplace workflows use URL schemes (not direct paths)
   - Capability enforcement validates user-approved permissions before execution

5. **Epic 7 Integration**:
   - Marketplace workflows installed to "My Workflows" or team projects
   - Epic 7's `WorkflowExecutionEngine` executes marketplace workflows (via Epic 10)
   - Execution history tracked for marketplace workflows (same as custom workflows)

**Data Flow - AI-Assisted Workflow Creation:**
```
User describes workflow ("I need a workflow that summarizes emails")
  → Renderer: AIWorkflowCreationDialog captures description
  → IPC: ipcRenderer.invoke('workflow:ai-create', description)
  → Main: AIWorkflowCreationService.describeWorkflow(description)
  → Anthropic API: Extract intent, identify inputs/outputs
  → Main: AIWorkflowCreationService.suggestStructure()
  → Anthropic API: Generate step-by-step structure
  → Main: Returns suggested structure to renderer
  → Renderer: Display suggested steps, allow user refinement
  → User: Approves structure
  → Main: AIWorkflowCreationService.generateTemplate()
  → Anthropic API: Generate output template (Handlebars)
  → Main: WorkflowPackagingService.createPackage()
  → Main: Save .wfpkg to "My Workflows/custom/"
  → Renderer: Show success, navigate to workflow detail
```

**Data Flow - Marketplace Publishing:**
```
User clicks "Publish to Marketplace"
  → Renderer: Show publishing form (description, category, price)
  → IPC: ipcRenderer.invoke('marketplace:submit', workflowId, metadata)
  → Main: MarketplaceService.submitWorkflow()
  → Main: WorkflowPackagingService.createPackage() → .wfpkg bundle
  → Main → Moku API: POST /marketplace/submit (upload .wfpkg)
  → Moku API: Store in S3, create pending entry in marketplace_workflows
  → Moku API: Trigger security scan (ClamAV, vulnerability scan)
  → Moku API: Syntax validation (manifest, workflow.yaml, templates)
  → Holokai Team: Review in human review queue
  → Holokai Team: Approve workflow
  → Moku API: Update status → approved, make visible in marketplace
  → Email: Notify author "Workflow approved!"
```

**Data Flow - Workflow Installation:**
```
User clicks "Install" on marketplace workflow
  → Renderer: Show permission disclosure dialog (capabilities, risk score)
  → User: Approves permissions
  → IPC: ipcRenderer.invoke('marketplace:install', workflowId, installLocation)
  → Main: MarketplaceService.installWorkflow()
  → Main → Moku API: POST /marketplace/workflows/{id}/install
  → Moku API: Store in user_workflow_approvals (approved capabilities)
  → Main → Moku API: Download .wfpkg from S3
  → Main: Extract to .holokai/workflows/marketplace/{author}/{workflow}/
  → Main: Add to workflow list (Epic 7 integration)
  → Renderer: Show success toast, workflow appears in list
```

**Constraint Compliance:**
- **Zero Electron Dependencies in Workflow Engine** (Epic 10): Marketplace workflows execute in portable engine
- **Storage Abstraction** (Epic 10): All file access via storage service URLs, not direct paths
- **Capability-Based Security** (Epic 10): Marketplace workflows declare capabilities, enforced at runtime
- **RBAC Enforcement**: Only workflow owner can publish/update workflows

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs | Owner |
|--------|---------------|--------|---------|-------|
| **MarketplaceController** (Moku API) | REST API for marketplace operations (browse, publish, install, purchase) | HTTP requests (JWT auth) | JSON responses, database writes | Backend Team |
| **SecurityScannerService** (Moku API) | Security scanning (malware, vulnerabilities, obfuscation detection) | .wfpkg file | Security scan report, risk score | Backend Team |
| **StripeService** (Moku API) | Payment processing, revenue sharing, payouts | Payment intents, workflow prices | Payment confirmations, payout records | Backend Team |
| **AIWorkflowCreationService** (Desktop Main) | AI-assisted workflow generation from user descriptions | User description, refinements | Workflow structure, template | Desktop Team |
| **WorkflowPackagingService** (Desktop Main) | .wfpkg bundle creation, manifest validation, SHA-256 hashing | Workflow directory | .wfpkg file (ZIP), integrity hash | Desktop Team |
| **MarketplaceService** (Desktop Main) | Submit, install, update marketplace workflows | Workflow metadata, .wfpkg files | Installation status, update notifications | Desktop Team |
| **AIWorkflowCreationDialog** (Renderer) | Conversational UI for AI workflow creation | User prompts | Generated workflow definition | Frontend Team |
| **GUIWorkflowBuilder** (Renderer) | Visual workflow editor (timeline, steps, templates, YAML) | Workflow definition (or empty) | Updated workflow definition | Frontend Team |
| **MarketplaceBrowse** (Renderer) | Browse marketplace with search, filters, categories | Search query, filters | Workflow list, navigation events | Frontend Team |
| **WorkflowDetailPage** (Renderer) | Workflow details, permissions, trust indicators, install button | Workflow ID | Install/purchase events | Frontend Team |
| **CreatorDashboard** (Renderer) | Revenue stats, workflow analytics, reputation scores | User ID | Dashboard data, payout info | Frontend Team |
| **HumanReviewQueue** (Admin UI) | Holokai team workflow review interface | Pending workflows | Approve/reject decisions | Admin Team |

### Data Models and Contracts

**Database Schema (Moku API - PostgreSQL):**

```sql
-- Marketplace workflows table (published workflows)
CREATE TABLE marketplace_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  long_description TEXT, -- Markdown-formatted detailed description
  category VARCHAR(100) NOT NULL, -- Documentation, Code Generation, Testing, Deployment, etc.
  tier VARCHAR(50) NOT NULL CHECK (tier IN ('Basic', 'Intermediate', 'Advanced')),
  version VARCHAR(20) NOT NULL, -- Semantic versioning (X.Y.Z)

  -- Package metadata
  package_url TEXT NOT NULL, -- S3 URL or local path to .wfpkg file
  package_hash VARCHAR(64) NOT NULL, -- SHA-256 integrity hash
  manifest JSONB NOT NULL, -- Full manifest.json from .wfpkg

  -- Permissions and security
  capabilities TEXT[] NOT NULL, -- e.g., ['filesystem:read', 'network:https:github.com']
  security_scan_result JSONB, -- { risk_score, findings, last_scanned_at }

  -- Status and moderation
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'disabled')),
  review_notes TEXT, -- Human reviewer notes (approval/rejection reasons)

  -- Pricing (freemium model)
  pricing_type VARCHAR(50) NOT NULL CHECK (pricing_type IN ('free', 'premium')),
  price_usd DECIMAL(10,2), -- NULL for free workflows

  -- Metrics
  install_count INT DEFAULT 0,
  rating_avg DECIMAL(3,2) DEFAULT 0.0, -- Average rating (0.0-5.0)
  rating_count INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP, -- When approved
  last_scanned_at TIMESTAMP
);

CREATE INDEX idx_marketplace_workflows_author ON marketplace_workflows(author_id);
CREATE INDEX idx_marketplace_workflows_status ON marketplace_workflows(status);
CREATE INDEX idx_marketplace_workflows_category ON marketplace_workflows(category);
CREATE INDEX idx_marketplace_workflows_pricing ON marketplace_workflows(pricing_type);
CREATE INDEX idx_marketplace_workflows_rating ON marketplace_workflows(rating_avg DESC);
CREATE INDEX idx_marketplace_workflows_installs ON marketplace_workflows(install_count DESC);

-- Full-text search index
CREATE INDEX idx_marketplace_workflows_search ON marketplace_workflows
USING gin(to_tsvector('english', name || ' ' || description || ' ' || COALESCE(long_description, '')));

-- Workflow reviews and ratings
CREATE TABLE workflow_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES marketplace_workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(workflow_id, user_id) -- One review per user per workflow
);

CREATE INDEX idx_workflow_reviews_workflow ON workflow_reviews(workflow_id);

-- Publisher profiles (verified publishers, reputation)
CREATE TABLE publisher_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(100) NOT NULL,
  bio TEXT,
  website_url TEXT,
  github_url TEXT,

  -- Verification and reputation
  verified BOOLEAN DEFAULT false, -- Verified publisher badge
  reputation_score INT DEFAULT 0, -- Calculated from installs, ratings, grants

  -- Stats
  total_workflows_published INT DEFAULT 0,
  total_installs INT DEFAULT 0,
  total_revenue_usd DECIMAL(10,2) DEFAULT 0.0,

  -- Badges
  badges TEXT[], -- ['Top Contributor', 'Rising Star', 'Verified Publisher']

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User workflow approvals (capabilities approved per workflow)
CREATE TABLE user_workflow_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES marketplace_workflows(id) ON DELETE CASCADE,
  approved_capabilities TEXT[] NOT NULL, -- Capabilities user approved
  approved_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, workflow_id)
);

CREATE INDEX idx_user_workflow_approvals_user ON user_workflow_approvals(user_id);

-- Creator payouts (revenue sharing)
CREATE TABLE creator_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Payout period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Amounts
  total_sales_usd DECIMAL(10,2) NOT NULL, -- Total sales in period
  creator_share_usd DECIMAL(10,2) NOT NULL, -- 70% of total_sales
  holokai_share_usd DECIMAL(10,2) NOT NULL, -- 30% of total_sales

  -- Stripe Connect details
  stripe_payout_id VARCHAR(255), -- Stripe payout ID
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  paid_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_creator_payouts_author ON creator_payouts(author_id);
CREATE INDEX idx_creator_payouts_status ON creator_payouts(status);

-- Workflow reports (community moderation)
CREATE TABLE workflow_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES marketplace_workflows(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(100) NOT NULL CHECK (reason IN ('malicious_code', 'inaccurate_description', 'security_issue', 'spam', 'other')),
  details TEXT,

  -- Moderation status
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
  moderator_notes TEXT,
  resolved_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workflow_reports_workflow ON workflow_reports(workflow_id);
CREATE INDEX idx_workflow_reports_status ON workflow_reports(status);

-- Workflow installations (track who installed what)
CREATE TABLE workflow_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES marketplace_workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE, -- NULL = personal project

  -- Installation metadata
  installed_version VARCHAR(20) NOT NULL,
  installation_path TEXT NOT NULL, -- Local path where .wfpkg extracted

  installed_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(workflow_id, user_id, project_id) -- Can install same workflow multiple times in different projects
);

CREATE INDEX idx_workflow_installations_user ON workflow_installations(user_id);
CREATE INDEX idx_workflow_installations_workflow ON workflow_installations(workflow_id);
```

**TypeScript Interfaces (Desktop):**

```typescript
// Marketplace Workflow
interface MarketplaceWorkflow {
  id: string;
  authorId: string;
  name: string;
  description: string;
  longDescription?: string;
  category: WorkflowCategory;
  tier: 'Basic' | 'Intermediate' | 'Advanced';
  version: string; // Semantic versioning

  packageUrl: string; // S3 URL or local path
  packageHash: string; // SHA-256
  manifest: WorkflowManifest;

  capabilities: string[]; // e.g., ['filesystem:read', 'network:https:github.com']
  securityScanResult?: SecurityScanResult;

  status: 'pending' | 'approved' | 'rejected' | 'disabled';
  reviewNotes?: string;

  pricingType: 'free' | 'premium';
  priceUsd?: number;

  installCount: number;
  ratingAvg: number; // 0.0-5.0
  ratingCount: number;

  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  lastScannedAt?: Date;
}

type WorkflowCategory =
  | 'Documentation'
  | 'Code Generation'
  | 'Testing'
  | 'Deployment'
  | 'Data Analysis'
  | 'Email Automation'
  | 'Issue Tracking'
  | 'Release Management'
  | 'Other';

// Workflow Manifest (from .wfpkg bundle)
interface WorkflowManifest {
  name: string;
  version: string;
  tier: 'Basic' | 'Intermediate' | 'Advanced';
  author: {
    name: string;
    email: string;
    url?: string;
  };
  license: string; // SPDX identifier (MIT, Apache-2.0, GPL-3.0, etc.)
  description: string;
  category: WorkflowCategory;
  tags: string[];
  permissions: string[]; // Capabilities requested
  files: {
    manifest: 'manifest.json';
    workflow: 'workflow.yaml';
    instructions: 'instructions.md';
    templates: string[]; // e.g., ['template.md', 'output.html']
    scripts?: string[]; // Optional scripts
  };
}

// Security Scan Result
interface SecurityScanResult {
  riskScore: 'Low' | 'Medium' | 'High';
  findings: SecurityFinding[];
  lastScannedAt: Date;
  scannerVersion: string;
}

interface SecurityFinding {
  type: 'malware' | 'vulnerability' | 'obfuscation' | 'suspicious_pattern';
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  description: string;
  file?: string; // File where finding was detected
  line?: number;
}

// Workflow Review
interface WorkflowReview {
  id: string;
  workflowId: string;
  userId: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: Date;
}

// Publisher Profile
interface PublisherProfile {
  userId: string;
  displayName: string;
  bio?: string;
  websiteUrl?: string;
  githubUrl?: string;

  verified: boolean;
  reputationScore: number;

  totalWorkflowsPublished: number;
  totalInstalls: number;
  totalRevenueUsd: number;

  badges: string[]; // ['Top Contributor', 'Rising Star', 'Verified Publisher']

  createdAt: Date;
  updatedAt: Date;
}

// Creator Payout
interface CreatorPayout {
  id: string;
  authorId: string;

  periodStart: Date;
  periodEnd: Date;

  totalSalesUsd: number;
  creatorShareUsd: number; // 70%
  holokaiShareUsd: number; // 30%

  stripePayoutId?: string;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  paidAt?: Date;

  createdAt: Date;
}

// Workflow Report
interface WorkflowReport {
  id: string;
  workflowId: string;
  reporterId: string;
  reason: 'malicious_code' | 'inaccurate_description' | 'security_issue' | 'spam' | 'other';
  details?: string;

  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  moderatorNotes?: string;
  resolvedAt?: Date;

  createdAt: Date;
}
```

### APIs and Interfaces

**Moku API Endpoints (Spring Boot REST API):**

```java
@RestController
@RequestMapping("/api/marketplace")
public class MarketplaceController {

  // E9-S6: Browse and search marketplace
  @GetMapping("/workflows")
  ResponseEntity<Page<MarketplaceWorkflowDTO>> browseWorkflows(
    @RequestParam(required = false) String search,
    @RequestParam(required = false) String category,
    @RequestParam(required = false) String pricingType, // free, premium
    @RequestParam(required = false) String sort, // popular, highest_rated, recently_updated, trending
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size
  );

  @GetMapping("/workflows/{id}")
  ResponseEntity<MarketplaceWorkflowDTO> getWorkflow(@PathVariable UUID id);

  // E9-S5: Submit workflow for publishing
  @PostMapping("/submit")
  ResponseEntity<MarketplaceWorkflowDTO> submitWorkflow(
    @RequestPart("package") MultipartFile packageFile, // .wfpkg file
    @RequestPart("metadata") SubmitWorkflowRequest metadata
  );

  // E9-S6: Install workflow
  @PostMapping("/workflows/{id}/install")
  ResponseEntity<WorkflowInstallationDTO> installWorkflow(
    @PathVariable UUID id,
    @RequestBody InstallWorkflowRequest request
  );

  // E9-S7: Purchase premium workflow
  @PostMapping("/workflows/{id}/purchase")
  ResponseEntity<PurchaseIntentDTO> purchaseWorkflow(
    @PathVariable UUID id
  );

  // E9-S6: Submit review
  @PostMapping("/workflows/{id}/reviews")
  ResponseEntity<WorkflowReviewDTO> submitReview(
    @PathVariable UUID id,
    @RequestBody ReviewRequest request
  );

  @GetMapping("/workflows/{id}/reviews")
  ResponseEntity<Page<WorkflowReviewDTO>> getReviews(
    @PathVariable UUID id,
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size
  );

  // E9-S8: Report workflow
  @PostMapping("/workflows/{id}/report")
  ResponseEntity<WorkflowReportDTO> reportWorkflow(
    @PathVariable UUID id,
    @RequestBody ReportRequest request
  );

  // E9-S7: Creator dashboard
  @GetMapping("/creators/dashboard")
  ResponseEntity<CreatorDashboardDTO> getCreatorDashboard();

  @GetMapping("/creators/payouts")
  ResponseEntity<Page<CreatorPayoutDTO>> getCreatorPayouts(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size
  );

  // E9-S5: Admin review queue (Holokai team only)
  @GetMapping("/admin/review-queue")
  @PreAuthorize("hasRole('ADMIN')")
  ResponseEntity<Page<MarketplaceWorkflowDTO>> getReviewQueue(
    @RequestParam(defaultValue = "pending") String status,
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size
  );

  @PostMapping("/admin/workflows/{id}/approve")
  @PreAuthorize("hasRole('ADMIN')")
  ResponseEntity<MarketplaceWorkflowDTO> approveWorkflow(
    @PathVariable UUID id,
    @RequestBody ReviewDecisionRequest decision
  );

  @PostMapping("/admin/workflows/{id}/reject")
  @PreAuthorize("hasRole('ADMIN')")
  ResponseEntity<MarketplaceWorkflowDTO> rejectWorkflow(
    @PathVariable UUID id,
    @RequestBody ReviewDecisionRequest decision
  );

  @PostMapping("/admin/workflows/{id}/disable")
  @PreAuthorize("hasRole('ADMIN')")
  ResponseEntity<MarketplaceWorkflowDTO> disableWorkflow(
    @PathVariable UUID id,
    @RequestBody DisableWorkflowRequest request
  );
}

// Request DTOs
public record SubmitWorkflowRequest(
  String name,
  String description,
  String longDescription,
  String category,
  String tier,
  String version,
  List<String> capabilities,
  String pricingType, // free, premium
  BigDecimal priceUsd
) {}

public record InstallWorkflowRequest(
  UUID projectId, // NULL for personal project
  List<String> approvedCapabilities
) {}

public record ReviewRequest(
  int rating, // 1-5
  String comment
) {}

public record ReportRequest(
  String reason, // malicious_code, inaccurate_description, security_issue, spam, other
  String details
) {}

public record ReviewDecisionRequest(
  String notes
) {}

public record DisableWorkflowRequest(
  String reason
) {}

// Response DTOs
public record MarketplaceWorkflowDTO(
  UUID id,
  UUID authorId,
  String authorName, // Denormalized for display
  String name,
  String description,
  String longDescription,
  String category,
  String tier,
  String version,
  String packageUrl,
  String packageHash,
  WorkflowManifestDTO manifest,
  List<String> capabilities,
  SecurityScanResultDTO securityScanResult,
  String status,
  String reviewNotes,
  String pricingType,
  BigDecimal priceUsd,
  int installCount,
  BigDecimal ratingAvg,
  int ratingCount,
  Instant createdAt,
  Instant updatedAt,
  Instant publishedAt,
  Instant lastScannedAt
) {}

public record CreatorDashboardDTO(
  int totalWorkflowsPublished,
  int totalInstalls,
  BigDecimal totalRevenueUsd,
  BigDecimal pendingPayoutUsd,
  Instant lastPayoutDate,
  int reputationScore,
  List<String> badges,
  List<WorkflowStatsDTO> topWorkflows
) {}

public record WorkflowStatsDTO(
  UUID workflowId,
  String name,
  int installCount,
  BigDecimal ratingAvg,
  BigDecimal revenueUsd
) {}
```

**Desktop IPC API (Electron Main Process):**

```typescript
// AIWorkflowCreationService (Main Process)
export class AIWorkflowCreationService {
  private anthropicClient: Anthropic;

  // E9-S2: AI-assisted workflow creation
  async describeWorkflow(userInput: string): Promise<WorkflowIntent> {
    const response = await this.anthropicClient.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: `Extract workflow intent from user description: "${userInput}"\n\nReturn JSON with: intent, suggestedName, inputs (name, type, description), outputs (name, type, description)`,
        },
      ],
    });
    return JSON.parse(response.content[0].text);
  }

  async suggestStructure(intent: WorkflowIntent): Promise<WorkflowStructure> {
    const response = await this.anthropicClient.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: `Generate workflow structure for: ${JSON.stringify(intent)}\n\nReturn JSON with: steps (name, type, config), tier (Basic/Intermediate), requiredCapabilities`,
        },
      ],
    });
    return JSON.parse(response.content[0].text);
  }

  async generateTemplate(structure: WorkflowStructure): Promise<string> {
    const response = await this.anthropicClient.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: `Generate Handlebars template for workflow: ${JSON.stringify(structure)}\n\nInclude all output variables, use markdown formatting, add helpful sections`,
        },
      ],
    });
    return response.content[0].text;
  }
}

// WorkflowPackagingService (Main Process)
export class WorkflowPackagingService {
  // E9-S4: Create .wfpkg bundle
  async createPackage(workflowDir: string): Promise<{ buffer: Buffer; hash: string }> {
    // 1. Validate manifest.json
    const manifest = await this.validateManifest(workflowDir);

    // 2. Compress files into .wfpkg (ZIP format)
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('workflow.yaml', await fs.readFile(path.join(workflowDir, 'workflow.yaml')));
    zip.file('instructions.md', await fs.readFile(path.join(workflowDir, 'instructions.md')));

    // Add templates
    for (const template of manifest.files.templates) {
      zip.file(`templates/${template}`, await fs.readFile(path.join(workflowDir, 'templates', template)));
    }

    // Add scripts if present
    if (manifest.files.scripts) {
      for (const script of manifest.files.scripts) {
        zip.file(`scripts/${script}`, await fs.readFile(path.join(workflowDir, 'scripts', script)));
      }
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    // 3. Generate SHA-256 hash
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    return { buffer, hash };
  }

  async validateManifest(workflowDir: string): Promise<WorkflowManifest> {
    const manifestPath = path.join(workflowDir, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));

    // JSON schema validation (using ajv library)
    const valid = this.manifestSchema.validate(manifest);
    if (!valid) {
      throw new Error(`Manifest validation failed: ${JSON.stringify(this.manifestSchema.errors)}`);
    }

    return manifest;
  }

  async extractPackage(packageBuffer: Buffer, outputDir: string): Promise<void> {
    const zip = await JSZip.loadAsync(packageBuffer);
    await Promise.all(
      Object.keys(zip.files).map(async (filename) => {
        const file = zip.files[filename];
        if (!file.dir) {
          const content = await file.async('nodebuffer');
          const filePath = path.join(outputDir, filename);
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, content);
        }
      })
    );
  }
}

// MarketplaceService (Main Process)
export class MarketplaceService {
  private apiClient: MokuAPIClient;

  // E9-S5: Submit workflow to marketplace
  async submitWorkflow(workflowId: string, metadata: SubmitWorkflowMetadata): Promise<MarketplaceWorkflow> {
    // 1. Create .wfpkg bundle
    const workflowDir = this.getWorkflowDirectory(workflowId);
    const { buffer, hash } = await this.packagingService.createPackage(workflowDir);

    // 2. Upload to Moku API
    const formData = new FormData();
    formData.append('package', buffer, { filename: `${workflowId}.wfpkg` });
    formData.append('metadata', JSON.stringify(metadata));

    const response = await this.apiClient.post('/marketplace/submit', formData);
    return response.data;
  }

  // E9-S6: Install workflow from marketplace
  async installWorkflow(
    workflowId: string,
    installLocation: { projectId?: string }
  ): Promise<void> {
    // 1. Request installation (stores user approval in DB)
    const installation = await this.apiClient.post(`/marketplace/workflows/${workflowId}/install`, installLocation);

    // 2. Download .wfpkg
    const packageUrl = installation.data.packageUrl;
    const packageBuffer = await this.downloadPackage(packageUrl);

    // 3. Extract to installation directory
    const installDir = installLocation.projectId
      ? `projects/${installLocation.projectId}/.holokai/workflows/marketplace/${installation.data.authorName}/${installation.data.name}/`
      : `~/.holokai/My Workflows/marketplace/${installation.data.authorName}/${installation.data.name}/`;

    await this.packagingService.extractPackage(packageBuffer, installDir);

    // 4. Add to workflow list (Epic 7 integration)
    await this.workflowService.refreshWorkflowList();
  }

  // E9-S6: Check for workflow updates
  async checkForUpdates(): Promise<WorkflowUpdate[]> {
    const installedWorkflows = await this.getInstalledMarketplaceWorkflows();
    const updates: WorkflowUpdate[] = [];

    for (const installed of installedWorkflows) {
      const latest = await this.apiClient.get(`/marketplace/workflows/${installed.workflowId}`);
      if (semver.gt(latest.data.version, installed.installedVersion)) {
        updates.push({
          workflowId: installed.workflowId,
          currentVersion: installed.installedVersion,
          latestVersion: latest.data.version,
          changelog: latest.data.changelog,
        });
      }
    }

    return updates;
  }
}

// IPC Handlers (registered in main.ts)
ipcMain.handle('workflow:ai-create', async (event, description) => {
  return aiWorkflowCreationService.describeWorkflow(description);
});

ipcMain.handle('workflow:ai-suggest-structure', async (event, intent) => {
  return aiWorkflowCreationService.suggestStructure(intent);
});

ipcMain.handle('workflow:ai-generate-template', async (event, structure) => {
  return aiWorkflowCreationService.generateTemplate(structure);
});

ipcMain.handle('marketplace:submit', async (event, workflowId, metadata) => {
  return marketplaceService.submitWorkflow(workflowId, metadata);
});

ipcMain.handle('marketplace:install', async (event, workflowId, installLocation) => {
  return marketplaceService.installWorkflow(workflowId, installLocation);
});

ipcMain.handle('marketplace:check-updates', async (event) => {
  return marketplaceService.checkForUpdates();
});
```

### Workflows and Sequencing

**AI-Assisted Workflow Creation Flow (E9-S2):**
```
User clicks "Create Workflow with AI"
  1. Renderer: AIWorkflowCreationDialog opens
  2. User: Describes workflow ("I need a workflow that summarizes emails")
  3. IPC: ipcRenderer.invoke('workflow:ai-create', description)
  4. Main → Anthropic: Extract intent (inputs, outputs, goal)
  5. Main: Returns WorkflowIntent to renderer
  6. Renderer: Shows suggested structure, allows refinement
  7. User: Approves structure
  8. IPC: ipcRenderer.invoke('workflow:ai-suggest-structure', intent)
  9. Main → Anthropic: Generate step-by-step workflow structure
 10. Main: Returns WorkflowStructure (steps, tier, capabilities)
 11. Renderer: Shows steps with editable config
 12. User: Modifies steps, approves
 13. IPC: ipcRenderer.invoke('workflow:ai-generate-template', structure)
 14. Main → Anthropic: Generate Handlebars template
 15. Main: Create workflow directory, write files (manifest.json, workflow.yaml, instructions.md, template.md)
 16. Main: Save to "My Workflows/custom/{workflow-name}/"
 17. Renderer: Show success, navigate to workflow detail
```

**GUI Workflow Builder Flow (E9-S3):**
```
User clicks "Create Workflow"
  1. Renderer: GUIWorkflowBuilder opens (timeline view)
  2. User: Adds steps via drag-and-drop or (+) button
  3. User: Configures each step (type: Ask User, Generate Output, Run Script, Conditional)
  4. User: Maps outputs (step outputs → workflow outputs)
  5. User: Edits template in split view (code editor + live preview)
  6. User: Toggles to YAML editor to fine-tune
  7. User: Clicks "Save"
  8. Renderer: Validates workflow definition (required fields, circular deps)
  9. Main: Create workflow directory, write files
 10. Main: WorkflowPackagingService.createPackage() → .wfpkg bundle
 11. Main: Save to "My Workflows/custom/{workflow-name}/"
 12. Renderer: Show success toast
```

**Marketplace Publishing Flow (E9-S5):**
```
User clicks "Publish to Marketplace" on custom workflow
  1. Renderer: Show publishing form (category, price, long description)
  2. User: Fills metadata, clicks "Submit"
  3. IPC: ipcRenderer.invoke('marketplace:submit', workflowId, metadata)
  4. Main: WorkflowPackagingService.createPackage() → .wfpkg + SHA-256 hash
  5. Main → Moku API: POST /marketplace/submit (multipart upload)
  6. Moku API: Store .wfpkg in S3, create pending entry in marketplace_workflows
  7. Moku API: Trigger security scanner:
     a. ClamAV malware scan
     b. npm audit for dependencies (if scripts present)
     c. Code obfuscation detection (entropy analysis)
     d. Suspicious pattern detection (eval(), exec(), dangerous APIs)
  8. Moku API: Syntax validation (manifest.json, workflow.yaml schemas)
  9. Moku API: Generate security scan report (risk score, findings)
 10. Moku API: Add to human review queue (status: pending)
 11. Holokai Team: Reviews workflow in HumanReviewQueue UI
     - Views code, templates, permissions, security scan results
     - Runs test execution with sample inputs
     - Checks code quality, documentation
 12. Holokai Team: Approves workflow
 13. Moku API: Update status → approved, published_at = NOW()
 14. Moku API: Send email to author: "Workflow approved and published!"
 15. Marketplace: Workflow now visible in browse/search
```

**Marketplace Installation Flow (E9-S6):**
```
User clicks "Install" on marketplace workflow
  1. Renderer: WorkflowDetailPage shows permission disclosure dialog:
     ```
     This workflow requests:
     ✓ Filesystem: Read/Write in workspace
     ✓ Network: HTTPS requests to github.com
     ✓ Git: Read repository history

     Risk Score: Medium Risk
     Security Scan: Last scanned 2 days ago, no critical issues

     [Cancel] [Approve & Install]
     ```
  2. User: Reviews permissions, clicks "Approve & Install"
  3. Renderer: Prompt install location: "My Workflows" OR current team project
  4. User: Selects location
  5. IPC: ipcRenderer.invoke('marketplace:install', workflowId, installLocation)
  6. Main → Moku API: POST /marketplace/workflows/{id}/install
  7. Moku API: Store approved capabilities in user_workflow_approvals table
  8. Moku API: Increment install_count
  9. Moku API: Return installation metadata (packageUrl, version)
 10. Main: Download .wfpkg from S3
 11. Main: WorkflowPackagingService.extractPackage() to installation directory
 12. Main: Add workflow to Epic 7 workflow list
 13. Renderer: Show success toast, workflow appears in sidebar
```

**Premium Workflow Purchase Flow (E9-S7):**
```
User clicks "Purchase $9.99" on premium workflow
  1. Renderer: Show purchase confirmation dialog
  2. User: Confirms purchase
  3. IPC: ipcRenderer.invoke('marketplace:purchase', workflowId)
  4. Main → Moku API: POST /marketplace/workflows/{id}/purchase
  5. Moku API → Stripe: Create checkout session
  6. Moku API: Return Stripe checkout URL
  7. Main: Open Stripe checkout in browser window
  8. User: Completes payment
  9. Stripe Webhook → Moku API: payment_intent.succeeded
 10. Moku API: Create workflow_installations entry
 11. Moku API: Create creator_payouts entry (70% to creator, 30% to Holokai)
 12. Main: Poll Moku API for payment status
 13. Main: Payment confirmed → proceed with installation (same as free workflow flow step 10-13)
```

## Non-Functional Requirements

### Performance

| Requirement | Target | Measurement | Priority |
|-------------|--------|-------------|----------|
| **Marketplace Browse Load** | <1s P95 | Time to load 20 workflows with thumbnails | P0 |
| **Search Latency** | <500ms P95 | Full-text search response time | P0 |
| **AI Workflow Generation** | <10s P95 | Time from user description to generated structure | P1 |
| **Package Creation** | <5s P95 | Time to create .wfpkg bundle | P1 |
| **Security Scan** | <30s P95 | Time to scan .wfpkg for vulnerabilities | P1 |
| **Workflow Installation** | <10s P95 | Time from install click to workflow available | P1 |
| **Creator Dashboard Load** | <2s P95 | Time to load dashboard with stats | P1 |

**Performance Optimizations:**
- Full-text search index on marketplace_workflows (PostgreSQL GIN index)
- Workflow thumbnails cached in CDN (CloudFront or similar)
- AI workflow generation: Streaming responses for perceived speed
- .wfpkg bundles cached in S3 with CloudFront CDN
- Security scan results cached (weekly re-scans, not on every view)

### Security

| Requirement | Implementation | Priority |
|-------------|----------------|----------|
| **Malware Scanning** | ClamAV integration, all uploaded .wfpkg files scanned | P0 |
| **Vulnerability Scanning** | npm audit for dependencies, Snyk for advanced detection | P0 |
| **Code Obfuscation Detection** | Entropy analysis, eval()/exec() detection | P0 |
| **Permission Disclosure** | Mandatory capability disclosure before installation | P0 |
| **RBAC Enforcement** | Only workflow author can publish/update workflows | P0 |
| **Stripe Payment Security** | PCI-DSS compliant, use Stripe Checkout (no card data stored) | P0 |
| **Package Integrity** | SHA-256 hash verification on download | P0 |
| **Weekly Re-scanning** | Automated job re-scans all published workflows weekly | P1 |

**Security References:**
- **Epic 10 Capability Model**: Marketplace workflows inherit capability enforcement
- **User Approval**: Capabilities stored in `user_workflow_approvals` table, checked at execution time
- **Payment Security**: Stripe handles all card data, webhooks verify payment status
- **Supply Chain Security**: Dependencies scanned for known vulnerabilities (CVE database)

### Reliability/Availability

| Requirement | Implementation | Target | Priority |
|-------------|----------------|--------|----------|
| **Security Scan Reliability** | If ClamAV fails, queue for manual review (don't block) | 99% scan success rate | P0 |
| **Payment Reliability** | Stripe webhook retries (exponential backoff), idempotency keys | 99.9% payment processing | P0 |
| **Package Upload Reliability** | S3 multipart upload with retry logic | 99.9% upload success | P1 |
| **Installation Failure Recovery** | If extraction fails, rollback and show error | 100% graceful failures | P1 |
| **Payout Reliability** | Monthly batch job with Stripe Connect, manual fallback | 99% automated payouts | P1 |

**Error Recovery Patterns:**
- **Security Scan Failure**: Workflow flagged for manual review, author notified
- **Payment Failure**: User shown error, can retry payment
- **Installation Failure**: Cleanup partial extraction, show detailed error message
- **Payout Failure**: Log error, retry next month, send admin alert

### Observability

| Signal Type | Implementation | Examples | Priority |
|-------------|----------------|----------|----------|
| **Logs** | Spring Boot logging (Moku API), electron-log (Desktop) | Workflow submitted, scan complete, payment succeeded | P0 |
| **Metrics** | Database metrics (install_count, rating_avg), Stripe metrics (revenue) | Total workflows, approval rate, revenue/month | P0 |
| **Traces** | Publish pipeline trace (submit → scan → review → approve) | Step-by-step publishing progress | P1 |
| **Audit Events** | marketplace_audit_log table (NEW) | User X installed workflow Y, Admin approved workflow Z | P1 |

**Required Logging:**
- **Marketplace Browse**: `[MarketplaceController] Search query: ${query}, results: ${count}`
- **Workflow Submission**: `[MarketplaceService] Workflow ${id} submitted by user ${userId}, status: pending`
- **Security Scan**: `[SecurityScanner] Scan complete for ${id}, risk score: ${score}, findings: ${findingCount}`
- **Payment**: `[StripeService] Payment succeeded for workflow ${id}, amount: ${amount}, payout: ${creatorShare}`
- **Installation**: `[MarketplaceService] Workflow ${id} installed by user ${userId} to project ${projectId}`

## Dependencies and Integrations

**Critical Dependencies:**

| Dependency | Type | Purpose | Owner | Status |
|------------|------|---------|-------|--------|
| **Epic 10: Portable Workflow Engine** | Internal | Executes marketplace workflows with capability enforcement | Desktop Team | **BLOCKS Epic 9** - Must complete first |
| **Epic 7: Workflows** | Internal | Workflow execution UI, workflow list integration | Desktop Team | Completed |
| **Epic 3: Project Collaboration** | Internal | "My Workflows" personal project model | Desktop/Backend Team | Completed |
| **Stripe API** | External | Payment processing, Stripe Checkout, Stripe Connect for payouts | Stripe | Required for E9-S7 |
| **ClamAV** | External | Malware scanning engine | ClamAV | Required for E9-S5, E9-S8 |
| **Anthropic API** | External | AI-assisted workflow generation | Anthropic | Required for E9-S2 |
| **AWS S3** | External | .wfpkg file storage | AWS | Required for E9-S4, E9-S5, E9-S6 |
| **PostgreSQL** | External | Database for marketplace tables | PostgreSQL | v14+ (existing) |

**Third-Party Dependencies (Desktop):**

| Package | Version | Purpose | License |
|---------|---------|---------|---------|
| `jszip` | 3.x | .wfpkg bundle creation/extraction | MIT/GPL3 |
| `ajv` | 8.x | JSON schema validation (manifest.json) | MIT |
| `semver` | 7.x | Version comparison for updates | ISC |
| `@anthropic-ai/sdk` | 0.68.x | AI workflow generation | MIT |
| `stripe` | 14.x | Payment processing | MIT |
| `clamav` | - | Malware scanning (server-side) | GPL |

**Moku API Updates Required:**

```java
// New Controllers
- MarketplaceController: 14 endpoints (browse, submit, install, purchase, reviews, admin)

// New Database Tables
- marketplace_workflows (workflow listings)
- workflow_reviews (ratings, comments)
- publisher_profiles (verified publishers, reputation)
- user_workflow_approvals (approved capabilities)
- creator_payouts (revenue sharing)
- workflow_reports (community moderation)
- workflow_installations (track installs)

// New Services
- MarketplaceService: Browse, search, publishing pipeline
- SecurityScannerService: ClamAV integration, vulnerability scanning
- StripeService: Payment processing, payout automation

// Infrastructure
- S3 bucket for .wfpkg file storage
- ClamAV daemon for malware scanning
- Stripe webhook endpoint for payment confirmations
- Cron jobs: weekly re-scans, monthly payouts, grant calculations
```

**Epic 10 Integration Points:**

| Epic 10 Component | How Epic 9 Uses It |
|-------------------|-------------------|
| `WorkflowEngine.execute()` | Marketplace workflows executed via Epic 10 engine (same as custom workflows) |
| `StorageService` | Marketplace workflows use URL schemes for file access (not direct paths) |
| `CapabilityEnforcer` | User-approved capabilities enforced at runtime |
| `.wfpkg` format | Epic 9 creates .wfpkg bundles, Epic 10 executes workflows from bundles |

**Integration Constraints:**
- ✅ **Zero Electron Dependencies** (Epic 10): Marketplace workflows execute in portable engine
- ✅ **Storage Abstraction** (Epic 10): All file access via storage service URLs
- ✅ **Capability-Based Security** (Epic 10): Marketplace workflows declare capabilities, enforced at runtime

## Acceptance Criteria (Authoritative)

**E9-S1: "My Workflows" Personal Project**
- [ ] AC-1.1: "My Workflows" personal project auto-created for all new users
- [ ] AC-1.2: Personal project appears in sidebar with distinct icon (📁 vs 👥 for team projects)
- [ ] AC-1.3: Project isolation enforced (workflows cannot access team project files)
- [ ] AC-1.4: Config loading uses only personal project config (no inheritance from team projects)

**E9-S2: AI-Assisted Workflow Creation**
- [ ] AC-2.1: User can describe workflow in natural language and receive AI-suggested structure
- [ ] AC-2.2: AI detects workflow tier (Basic vs Intermediate) based on requirements
- [ ] AC-2.3: Iterative refinement works (user can modify suggested steps before finalizing)
- [ ] AC-2.4: Generated workflow saved to "My Workflows/custom/" with all required files (manifest.json, workflow.yaml, instructions.md, template.md)
- [ ] AC-2.5: Workflow appears in workflow list and is executable

**E9-S3: GUI Workflow Builder**
- [ ] AC-3.1: Timeline or flowchart view functional (user can add/remove/reorder steps)
- [ ] AC-3.2: Step editor allows configuring all step types (Ask User, Generate Output, Run Script, Conditional)
- [ ] AC-3.3: Template editor with split view (code + preview) functional
- [ ] AC-3.4: Form builder auto-generates template from dragged sections (or defer to post-MVP)
- [ ] AC-3.5: Raw YAML editor with syntax highlighting and validation functional
- [ ] AC-3.6: GUI ↔ YAML sync works bidirectionally
- [ ] AC-3.7: Workflow saved as .wfpkg bundle in "My Workflows/custom/"

**E9-S4: Workflow Packaging Service**
- [ ] AC-4.1: Workflow directory correctly packaged into .wfpkg bundle (ZIP format)
- [ ] AC-4.2: Manifest.json validated against JSON schema (required fields, version format)
- [ ] AC-4.3: .wfpkg file correctly compressed (can be extracted with standard zip tools)
- [ ] AC-4.4: SHA-256 hash generated for package integrity
- [ ] AC-4.5: Package extraction works (round-trip: directory → package → extract)

**E9-S5: Marketplace Publishing Pipeline**
- [ ] AC-5.1: Workflow submission endpoint accepts .wfpkg uploads
- [ ] AC-5.2: Security scanner detects malware, vulnerabilities, obfuscation (test with known bad patterns)
- [ ] AC-5.3: Syntax validation rejects invalid manifest/workflow/template files
- [ ] AC-5.4: Human review queue shows pending workflows with all relevant info (code, permissions, security scan)
- [ ] AC-5.5: Approved workflows appear in marketplace browse/search
- [ ] AC-5.6: Rejected workflows send feedback email to author
- [ ] AC-5.7: Test execution runs workflow with sample inputs before approval

**E9-S6: Marketplace Discovery & Installation**
- [ ] AC-6.1: Marketplace browse UI with search, filters (category, pricing), sort (popular, highest rated) works
- [ ] AC-6.2: Workflow detail page shows all info (description, permissions, trust indicators, reviews)
- [ ] AC-6.3: Permission disclosure shown before installation (mandatory)
- [ ] AC-6.4: Installation flow allows choosing "My Workflows" vs team project
- [ ] AC-6.5: Installed workflows appear in workflow list and are executable
- [ ] AC-6.6: Update notifications shown when new versions available
- [ ] AC-6.7: Trust indicators displayed (security scan badge, install count, rating, verified publisher)

**E9-S7: Freemium Business Model**
- [ ] AC-7.1: Premium workflows purchasable via Stripe Checkout
- [ ] AC-7.2: Revenue sharing works (70% creator, 30% Holokai)
- [ ] AC-7.3: Monthly payouts to creators via Stripe Connect (>$100 threshold)
- [ ] AC-7.4: Creator dashboard shows revenue, stats, reputation scores
- [ ] AC-7.5: Grants awarded to top contributors monthly (automated calculation)
- [ ] AC-7.6: Leaderboards and badges functional (Top Contributor, Rising Star, Verified Publisher)

**E9-S8: Marketplace Trust & Safety**
- [ ] AC-8.1: Weekly re-scans functional (automated cron job)
- [ ] AC-8.2: Community report button functional (users can flag workflows)
- [ ] AC-8.3: Holokai investigation queue shows flagged workflows with reports
- [ ] AC-8.4: Malicious workflows can be disabled (removed from marketplace, users warned)
- [ ] AC-8.5: Appeal process functional (authors can contest disabling)
- [ ] AC-8.6: Transparency report published monthly (# workflows scanned, flagged, disabled)

## Traceability Mapping

| Acceptance Criteria | Spec Section | Component/API | Test Type |
|---------------------|--------------|---------------|-----------|
| **AC-1.1 to AC-1.4** (Personal Project) | §4.1 Services and Modules | `ProjectService`, `StorageService` | Integration tests (project creation, isolation) |
| **AC-2.1 to AC-2.5** (AI Workflow Creation) | §4.3 APIs and Interfaces | `AIWorkflowCreationService`, Anthropic API | Integration tests (AI API mocked), E2E tests |
| **AC-3.1 to AC-3.7** (GUI Builder) | §4.1 Services and Modules | `GUIWorkflowBuilder.svelte` | Component tests + E2E tests |
| **AC-4.1 to AC-4.5** (Packaging) | §4.3 APIs and Interfaces | `WorkflowPackagingService` | Unit tests (ZIP creation, validation, extraction) |
| **AC-5.1 to AC-5.7** (Publishing Pipeline) | §4.3 APIs and Interfaces | `MarketplaceController`, `SecurityScannerService` | Integration tests (Spring Boot + ClamAV), E2E tests |
| **AC-6.1 to AC-6.7** (Discovery & Installation) | §4.4 Workflows and Sequencing | `MarketplaceBrowse.svelte`, `WorkflowDetailPage.svelte`, `MarketplaceService` | Component tests + E2E tests |
| **AC-7.1 to AC-7.6** (Freemium) | §4.3 APIs and Interfaces | `StripeService`, `CreatorDashboard.svelte` | Integration tests (Stripe mocked), E2E tests |
| **AC-8.1 to AC-8.6** (Trust & Safety) | §4.4 Workflows and Sequencing | `SecurityScannerService`, `HumanReviewQueue` | Integration tests (ClamAV), Cron job tests |

**PRD Requirement Traceability:**

| PRD Requirement | Epic 9 Implementation | Acceptance Criteria |
|-----------------|----------------------|---------------------|
| PRD §3.7.1 AI-Assisted Workflow Creation | E9-S2 (AI service with Anthropic integration) | AC-2.1 to AC-2.5 |
| PRD §3.7.1 GUI Workflow Builder | E9-S3 (Timeline/flowchart editor, template editor, YAML editor) | AC-3.1 to AC-3.7 |
| PRD §3.7.2 Workflow Marketplace | E9-S5, E9-S6 (Publishing pipeline, browse/install UI) | AC-5.1 to AC-6.7 |
| PRD §3.7.2 Freemium Business Model | E9-S7 (Stripe payments, 70/30 revenue split, grants) | AC-7.1 to AC-7.6 |
| PRD §3.7.2 Trust & Safety | E9-S8 (Weekly re-scans, community moderation) | AC-8.1 to AC-8.6 |
| PRD §3.7.3 "My Workflows" Personal Project | E9-S1 (Auto-create personal project) | AC-1.1 to AC-1.4 |
| PRD §3.8.5 Capability-Based Sandboxing | E9-S6 (Permission disclosure before install, Epic 10 integration) | AC-6.3 |

**Architecture Requirement Traceability:**

| Architecture Requirement | Implementation | Acceptance Criteria |
|-------------------------|----------------|---------------------|
| ARCH §2 IPC Pattern (`marketplace:*` channels) | IPC handlers for submit, install, ai-create | AC-2.4, AC-4.1, AC-5.1, AC-6.5 |
| ARCH §3 Moku API Integration | `MarketplaceController` REST API | AC-5.1, AC-6.1, AC-7.1 |
| Epic 10 Portable Engine | Marketplace workflows executed via Epic 10 | AC-6.5 (workflow executable) |
| Epic 10 Capability Model | Permission disclosure, user approvals stored | AC-6.3 (permission disclosure) |

## Risks, Assumptions, Open Questions

**RISKS:**

| Risk | Probability | Impact | Mitigation | Owner |
|------|------------|--------|------------|-------|
| **RISK-1: Low marketplace adoption (cold start problem)** | Medium | High | Pre-seed with 50+ curated templates in MVP; invest in creator incentives (grants $500-$5,000/year); launch with influencer partnerships | Product + Marketing |
| **RISK-2: Security vulnerabilities in published workflows** | Medium | High | Rigorous publishing pipeline (ClamAV, npm audit, human review); weekly re-scans; community moderation; transparency reports | Security Team |
| **RISK-3: Complex GUI builder delays launch** | High | Medium | Start with timeline view (simpler than flowchart); defer form builder to post-MVP; YAML editor as fallback | Desktop Team |
| **RISK-4: AI workflow generation produces low-quality workflows** | Medium | Medium | Iterative refinement UI allows user to modify suggestions; test with diverse use cases; improve prompts based on feedback | AI Team |
| **RISK-5: Stripe payment integration complexity** | Low | Medium | Use Stripe Checkout (proven solution); start with manual payouts if Stripe Connect delayed; thorough webhook testing | Backend Team |
| **RISK-6: ClamAV false positives block legitimate workflows** | Low | Medium | Human review queue catches false positives; whitelist known-good patterns; author appeal process | Security Team |
| **RISK-7: Marketplace revenue insufficient to cover costs** | Medium | High | Conservative revenue projections ($50K ARR Year 1); monitor CAC/LTV; adjust pricing/commission split if needed | Finance + Product |

**ASSUMPTIONS:**

| Assumption | Validation | Impact if Wrong |
|------------|------------|-----------------|
| **ASSUMPTION-1: Epic 10 Portable Workflow Engine completes before Epic 9** | Epic 10 marked P0 Critical | Epic 9 blocked - marketplace workflows cannot execute without Epic 10 |
| **ASSUMPTION-2: Users willing to pay for premium workflows** | PRD validated with user research | Freemium model fails - may need sponsorship/advertising instead |
| **ASSUMPTION-3: AI-assisted creation sufficient (no GUI builder in MVP)** | MVP scope decision (defer GUI builder to Month 6) | Low adoption if AI generation too limiting - accelerate GUI builder |
| **ASSUMPTION-4: ClamAV sufficient for security scanning** | Industry standard for malware detection | If advanced threats bypass ClamAV, need commercial scanner (VirusTotal API) |
| **ASSUMPTION-5: Holokai team can handle review queue volume** | Assume <100 submissions/month in first 6 months | If >1000 submissions/month, need automated review + paid moderators |
| **ASSUMPTION-6: S3 + CloudFront sufficient for .wfpkg distribution** | AWS scales to millions of downloads | If global latency issues, need multi-region CDN |

**OPEN QUESTIONS:**

| Question | Owner | Decision Deadline | Status |
|----------|-------|-------------------|--------|
| **Q1: Should AI workflow creation require subscription (e.g., Pro tier only) OR free for all users?** | Product + Finance | End of Month 1 | **OPEN** - Impacts pricing model |
| **Q2: Should marketplace allow NSFW/adult workflows OR family-friendly only?** | Product + Legal | End of Month 1 | **OPEN** - Impacts content moderation policy |
| **Q3: What is approval SLA for submitted workflows? (24 hours, 7 days, best effort)** | Product + Ops | End of Month 2 | **OPEN** - Impacts team staffing needs |
| **Q4: Should creators set their own pricing OR Holokai-approved pricing tiers?** | Product + Finance | End of Month 2 | **OPEN** - Impacts revenue predictability |
| **Q5: Should workflow reviews be moderated OR unmoderated (like App Store)?** | Product + Legal | End of Month 2 | **OPEN** - Impacts trust & safety workload |
| **Q6: Should marketplace support workflow bundles (multiple workflows in one purchase)?** | Product | End of Month 3 | **OPEN** - Impacts packaging service design |

## Test Strategy Summary

**Testing Approach:**

Epic 9 employs a **comprehensive testing strategy** covering unit tests, integration tests, component tests, E2E tests, security tests, and payment tests to ensure 85%+ overall code coverage.

**1. Unit Tests**

**Backend (Moku API - Spring Boot + JUnit):**
- `MarketplaceControllerTest`: Test all REST endpoints (browse, submit, install, purchase, admin)
- `SecurityScannerServiceTest`: Test ClamAV integration, vulnerability detection (mock ClamAV daemon)
- `StripeServiceTest`: Test payment processing, payout calculations (mock Stripe API)
- `WorkflowPackagingServiceTest`: Test .wfpkg creation, manifest validation, extraction

**Desktop (Main Process - Vitest):**
- `AIWorkflowCreationService.test.ts`: Test AI workflow generation (mock Anthropic API)
- `WorkflowPackagingService.test.ts`: Test ZIP creation, SHA-256 hashing, extraction
- `MarketplaceService.test.ts`: Test submit, install, update checking (mock Moku API)

**Desktop (Renderer - Svelte Testing Library):**
- `AIWorkflowCreationDialog.test.ts`: Test conversational UI, refinement flow
- `GUIWorkflowBuilder.test.ts`: Test timeline view, step editor, template editor
- `MarketplaceBrowse.test.ts`: Test search, filters, sorting
- `WorkflowDetailPage.test.ts`: Test trust indicators, permission disclosure
- `CreatorDashboard.test.ts`: Test revenue stats, payout info

**Coverage Target:** 90%+ for backend, 85%+ for desktop main, 80%+ for renderer

**2. Integration Tests**

**Moku API + Database:**
- Full stack tests with real PostgreSQL database
- Test publishing pipeline: submit → scan → review → approve → publish
- Test payment flow: purchase → Stripe webhook → payout calculation
- Test search with full-text index (GIN)

**Moku API + External Services:**
- ClamAV integration: Test with actual ClamAV daemon (Docker container in CI)
- Stripe integration: Test with Stripe test mode (real API calls, test card numbers)
- S3 integration: Test with localstack (S3 mock) or real S3 test bucket

**Desktop + Moku API:**
- Test workflow submission: Desktop uploads .wfpkg → Moku API receives and stores
- Test installation: Desktop downloads .wfpkg → extracts → adds to workflow list

**Coverage Target:** 85%+ for integration tests

**3. Component Tests (Svelte + Playwright Component Testing)**

- Test `GUIWorkflowBuilder` drag-and-drop functionality
- Test `MarketplaceBrowse` search and filtering with real data
- Test `WorkflowDetailPage` permission disclosure dialog

**Coverage Target:** 80%+ for component tests

**4. End-to-End Tests (Playwright)**

**AI Workflow Creation E2E:**
1. User describes workflow
2. AI generates structure
3. User refines steps
4. Workflow saved and appears in list

**Publishing E2E:**
1. User publishes workflow to marketplace
2. Security scan runs (mock ClamAV for E2E)
3. Admin approves workflow
4. Workflow appears in marketplace

**Installation E2E:**
1. User browses marketplace
2. Views workflow detail
3. Approves permissions
4. Installs workflow
5. Executes installed workflow

**Premium Purchase E2E:**
1. User clicks "Purchase"
2. Stripe checkout opens (test mode)
3. Payment completes
4. Workflow installed automatically

**Coverage Target:** 100% of critical user flows tested E2E

**5. Security Tests**

- **Malware Detection**: Submit .wfpkg with EICAR test file → expect detection
- **Vulnerability Detection**: Submit workflow with known vulnerable dependency → expect flagged
- **Obfuscation Detection**: Submit obfuscated JavaScript → expect high risk score
- **Permission Enforcement**: Install workflow, attempt unapproved capability → expect PermissionDeniedError
- **SQL Injection**: Submit workflow with malicious metadata → expect sanitized
- **XSS Prevention**: Workflow description with `<script>` tag → expect escaped

**6. Payment Tests**

- **Stripe Checkout**: Test with Stripe test card numbers (success, failure, 3D Secure)
- **Webhook Handling**: Simulate Stripe webhooks (payment_intent.succeeded, payment_intent.failed)
- **Payout Calculation**: Test 70/30 revenue split, $100 threshold
- **Idempotency**: Duplicate webhook → should not create duplicate payout

**7. Performance Tests**

- **Marketplace Browse**: Load 1000 workflows, measure P95 latency (<1s)
- **Search**: Full-text search across 1000 workflows (<500ms P95)
- **AI Generation**: Generate 100 workflows, measure P95 latency (<10s)
- **Security Scan**: Scan 100 .wfpkg files, measure P95 latency (<30s)

**Test Execution:**
- **CI/CD**: All tests run on every PR (unit, integration, component tests)
- **Nightly**: E2E tests, security tests, performance tests
- **Pre-Release**: Full test suite + manual QA + penetration testing (security audit)

# Workflow Requirements Alignment Analysis
## Gaps Between Workflow Engine Requirements and Existing Documentation

**Date:** 2025-11-26
**Analyst:** Mary (Business Analyst)

---

## Executive Summary

The new **Workflow Engine Requirements** (`workflow-engine-requirements.md`) introduce significant architectural and business model changes that are **not yet reflected** in the existing PRD, Architecture, and Epics documents. This analysis identifies gaps and provides recommended updates to ensure documentation alignment before implementation begins.

**Critical Finding:** The workflow engine is **architecturally distinct** from the existing "chat-to-workflow" feature in the PRD. The PRD's "Workflow Template Marketplace" (Section 3.7) focuses on **pre-built templates activated via chat**, while the new requirements define a **full workflow creation platform** with user authoring, marketplace distribution, and cloud portability.

**Recommendation:** Treat these as **separate but complementary features**:
1. **Chat-to-Workflow** (existing PRD) - Converts chat patterns into simple automations
2. **Workflow Engine & Marketplace** (new requirements) - Full workflow authoring, sharing, monetization

---

## 1. PRD Alignment Gaps

### 1.1 Missing Concepts

| Concept | Gap | Impact |
|---------|-----|--------|
| **"My Project" Model** | PRD has no concept of a personal project for workflow management | Users need a workspace for personal workflows; current PRD only mentions team projects |
| **Workflow Tiers** | PRD doesn't mention Basic/Intermediate tier system | Workflow complexity management undefined; MVP scope unclear |
| **Storage Service Abstraction** | PRD assumes local file access for workflows | Breaks cloud portability; incompatible with portable engine design |
| **Portable Engine Design** | PRD doesn't mention cloud-ready architecture | Future cloud execution will require major refactoring if not designed upfront |
| **Marketplace Curation Pipeline** | PRD Template Marketplace (§3.7) doesn't describe publishing process | Quality control, security scanning, human review process undefined |
| **Freemium Business Model** | PRD doesn't mention paid workflows or revenue sharing | Monetization strategy for workflow creators missing |
| **Creator Incentives** | PRD doesn't mention grants or reputation system | No plan to incentivize high-quality workflow creation |
| **Enterprise Private Registries** | PRD doesn't mention organization-hosted marketplaces | Enterprise requirement for proprietary workflow control |
| **Project Isolation** | PRD doesn't clarify that projects are independent (no config merging, no cross-project access) | Confusion about project relationships and data sharing |
| **Emergence Pattern** | PRD's "Make this a workflow" button doesn't mention subtle post-generation offers | Missing key UX pattern for workflow discovery |

### 1.2 Conflicting Definitions

| Topic | PRD (Section 3.7) | Workflow Requirements | Resolution |
|-------|-------------------|----------------------|------------|
| **Workflow Templates** | 50+ curated templates activated via chat | Marketplace with free + premium workflows from community | **Both**: Templates are **seed content** for marketplace; chat activation remains valid |
| **Workflow Creation** | "Make this a workflow" button converts chat to automation | AI-assisted → GUI builder → Hybrid → Raw YAML (4 methods) | **Compatible**: Chat-to-workflow is **one method** of many; PRD should acknowledge others |
| **Workflow Scope** | Personal vs Team workflows (tied to projects) | Personal workflows in "My Project", team workflows in team projects | **Clarify**: "My Project" is special personal project, not separate from project system |

### 1.3 Recommended PRD Updates

**Section 3.2: Chat-to-Workflow Progression**
- ✅ Keep existing "Make this a workflow" button content
- ➕ **Add:** Mention that this is **one** workflow creation method (others: AI-assisted, GUI builder, YAML)
- ➕ **Add:** Reference emergence pattern: *"Holokai subtly offers 'Want to create a workflow from this?' after user generates output"*

**Section 3.7: Workflow Template Marketplace** → Rename to **"Workflow Marketplace & Creation"**
- ✅ Keep 50+ curated templates
- ✅ Keep chat activation ("Set up daily standup report")
- ➕ **Add Section 3.7.1:** User-Created Workflows
  - AI-assisted workflow creation (describe → structure → prompt)
  - GUI workflow builder (timeline/flowchart view)
  - Template editor (split view + form builder + raw YAML/JSON)
  - Workflow tiers (Basic: linear steps, Intermediate: conditionals)
- ➕ **Add Section 3.7.2:** Marketplace Architecture
  - Freemium model (free + premium workflows)
  - Publishing pipeline (scan → review → test → approve → publish)
  - Trust indicators (security scan, ratings, install count)
  - Creator incentives (grants, reputation, revenue sharing)
  - Enterprise private registries (post-MVP)
- ➕ **Add Section 3.7.3:** "My Project" Concept
  - Every user has a personal project for workflow management
  - Projects are isolated (no config merging, no cross-project access)
  - Workflows install to "My Project" or team projects

**New Section 3.8: Portable Workflow Engine**
- ➕ **Add:** Portable engine design (local MVP, cloud post-MVP)
- ➕ **Add:** Storage service abstraction (workflows access files via URLs)
- ➕ **Add:** Capability-based sandboxing (RBAC/SSO integration)
- ➕ **Add:** Bundled runtimes (Node, Python, Bash)
- ➕ **Add:** AI client embedded in engine

**Section 1.4: Business Objectives** - Update metrics
- ➕ **Add:** Marketplace adoption metrics:
  - 1,000+ workflows created in first 3 months
  - 100+ workflows published to marketplace
  - 10,000+ workflow executions
  - $50K ARR from marketplace (Year 1)

---

## 2. Architecture Document Alignment Gaps

### 2.1 Missing Architecture Components

| Component | Gap | Impact |
|-----------|-----|--------|
| **"My Project" Architecture** | Architecture doesn't define personal project structure or lifecycle | Implementation team has no spec for personal project behavior |
| **Storage Service Abstraction for Workflows** | Section 9.2 has Storage Service for files, but not for workflow package files | Workflows can't access file URLs; breaks portability |
| **Portable Workflow Engine** | Section 6 has workflow execution engine, but no portability constraints | Engine will have desktop dependencies (Electron APIs, local paths) that break cloud execution |
| **Workflow Package Format** | No `.wfpkg` bundle format or manifest.json schema | No spec for how workflows are packaged/distributed |
| **Marketplace Architecture** | No marketplace API, publishing pipeline, or curation system architecture | Implementation team has no design for marketplace backend |
| **Capability Token Sandboxing** | Section 7.1 has security architecture, but no capability-based script sandboxing | Script security model undefined |
| **Workflow Tiers** | No differentiation between Basic and Intermediate workflows | No architectural constraints on workflow complexity |

### 2.2 Conflicting Sections

| Section | Current Content | Workflow Requirements | Resolution |
|---------|----------------|----------------------|------------|
| **Section 6: Workflow & Tool Orchestration** | Focuses on project workflow execution (XML instructions.md, YAML workflow.yaml) | User-created marketplace workflows with different schema (manifest.json, simpler steps) | **Both**: Section 6 should cover **two workflow types**: 1) Project workflows (team/internal), 2) Marketplace workflows (user-created) |
| **Section 13: MCP Integration** | Good alignment, but doesn't mention MCP tools as workflow actions | Workflow requirements show MCP tools integrated into workflow steps | **Update Section 13.5:** Add workflow integration examples |

### 2.3 Recommended Architecture Updates

**Section 2.2: Process Architecture**
- ➕ **Add Service:** `WorkflowPackagingService` - Creates .wfpkg bundles from workflow directories
- ➕ **Add Service:** `WorkflowMarketplaceService` - Manages marketplace discovery, installation, updates
- ➕ **Add Service:** `StorageServiceAbstraction` - Provides file URLs for workflow files

**Section 3: Data Architecture**
- ➕ **Add Section 3.6:** "My Project" Data Model
  ```typescript
  interface PersonalProject {
    id: string;  // Always "{userId}-personal"
    userId: string;
    workflows: Workflow[];
    config: {
      user_name: string;
      email: string;
      output_folder: string;  // Default: ~/Documents/Holokai Outputs
    };
  }
  ```

**Section 4: Cache Architecture**
- ➕ **Add:** Workflow package cache (LRU, 100 workflows, no TTL for personal)

**Section 6: Workflow & Tool Orchestration** → Expand to cover user workflows
- ➕ **Add Section 6.3:** User Workflow Execution Engine
  - Portable engine design (zero desktop dependencies)
  - Storage service abstraction (file URLs, not paths)
  - Bundled runtimes (Node, Python, Bash)
  - Capability-based sandboxing (RBAC/SSO context)
  - Embedded AI client
- ➕ **Add Section 6.4:** Workflow Packaging Format
  - Directory structure (manifest.json, instructions.md, templates/, scripts/)
  - .wfpkg bundle format (compressed .zip)
  - Manifest.json schema (from Appendix A of workflow requirements)
- ➕ **Add Section 6.5:** Marketplace Architecture
  - Publishing pipeline (scan → review → test → approve)
  - Trust indicators (security scan, ratings, install count)
  - Freemium model (free + premium workflows)
  - Enterprise private registries (post-MVP)

**Section 7: Security Architecture**
- ➕ **Add Section 7.3:** Workflow Script Security
  - Capability tokens (request → user approves → runtime enforces)
  - RBAC/SSO context inheritance (scripts run with user's permissions)
  - Permission disclosure (mandatory before installation)
  - Risk scoring (Low/Medium/High)

**Section 9.2: Storage Service**
- ➕ **Update:** Add workflow file storage endpoints:
  - `POST /workflows/upload-url` - Get presigned URL for workflow package
  - `GET /workflows/{id}/download-url` - Get presigned URL to download workflow
  - `GET /workflows/{id}/files/{filename}/url` - Get URL for specific workflow file (templates, scripts)

**Section 13.5: Integration with Workflow Execution Engine**
- ✅ Already good alignment - just add note that MCP tools work in **both** project and marketplace workflows

**New Section 15: Cloud Execution Architecture (Post-MVP)**
- ➕ **Add:** Trigger modes (desktop, web UI, API/webhooks, scheduled)
- ➕ **Add:** Portable engine benefits (same code local + cloud)
- ➕ **Add:** Storage service backends (S3, GCS, Azure Blob)

---

## 3. Epics & Stories Alignment Gaps

### 3.1 Missing Epics

| Epic | Description | Gap |
|------|-------------|-----|
| **E9: Workflow Marketplace** | User workflow creation, marketplace publishing, installation | Epic 7 focuses on project workflows, not user-created marketplace workflows |
| **E10: Portable Workflow Engine** | Storage service abstraction, capability sandboxing, cloud portability | No epic for portable engine infrastructure |
| **E11: Workflow Packaging & Distribution** | .wfpkg bundle creation, manifest validation, marketplace API | No epic for packaging/distribution mechanics |

### 3.2 Conflicting Content

| Epic | Current Focus | Workflow Requirements | Resolution |
|------|---------------|----------------------|------------|
| **E7: Workflows** | BMAD-style workflow execution (Section 6 of Architecture) | User-created workflows with marketplace | **Split into two epics**: E7 (Project workflows for team use), E9 (User marketplace workflows) |

### 3.3 Recommended Epics & Stories Updates

**Epic 7: Project Workflows** - Keep as-is
- Focus: Project workflows for team automation
- Reference: Current Section 6 of Architecture

**New Epic 9: User Workflow Marketplace**
Priority: P1 (High - Enterprise MVP differentiator)
Owner: Peter
Description: Enable users to create, share, and monetize workflows through a curated marketplace.

**Stories for Epic 9:**

**E9-S1: "My Project" Personal Workspace (Size: M)**
- Create "My Project" concept in data model
- Auto-create personal project on user signup
- UI to distinguish "My Project" from team projects
- Personal workflow installation flow

**E9-S2: Workflow Creation UI - AI Assisted (Size: L)**
- User describes workflow in natural language
- AI suggests structure and steps
- Guided prompts to fill in details
- Generate complete workflow package
- Implements: Workflow Requirements §1.1 (Priority 1: AI-Assisted Creation)

**E9-S3: Workflow Creation UI - GUI Builder (Size: XL)**
- Timeline or flowchart visual editor
- Step editor with conditional logic
- Variable insertion and preview
- Template editor (split view + form builder)
- Raw YAML/JSON editor for advanced users
- Implements: Workflow Requirements §1.1 (Priority 2: GUI Builder)

**E9-S4: Workflow Packaging Service (Size: M)**
- Create .wfpkg bundle from directory
- Validate manifest.json schema
- Compress workflow files
- Generate workflow hash for integrity
- Implements: Workflow Requirements §4.1

**E9-S5: Marketplace Publishing Pipeline (Size: XL)**
- Automated security scan (malware, vulnerabilities)
- Syntax validation (manifest, workflow.yaml, instructions.md)
- Human review workflow (queue, approve/reject)
- Test execution (automated QA)
- Publish to marketplace
- Implements: Workflow Requirements §5.3

**E9-S6: Marketplace Discovery & Installation (Size: L)**
- Browse marketplace (categories, search, featured)
- View workflow details (permissions, trust indicators)
- Installation flow (choose "My Project" or team project)
- Update notifications
- Implements: Workflow Requirements §2.1-2.3

**E9-S7: Freemium Business Model (Size: M)**
- Premium workflow pricing (creator sets price)
- Payment processing (Stripe integration)
- Revenue sharing (70% creator, 30% Holokai)
- Creator grants and reputation system
- Implements: Workflow Requirements §5.5

**E9-S8: Marketplace Trust & Safety (Size: M)**
- Security scanning (weekly re-scan of published workflows)
- Trust indicators (badges, ratings, install count)
- Permission transparency (mandatory disclosure)
- Risk scoring (Low/Medium/High)
- Community moderation (report, flag, ban)
- Implements: Workflow Requirements §6

**New Epic 10: Portable Workflow Engine**
Priority: P0 (Critical - Architectural foundation)
Owner: Peter
Description: Build cloud-portable workflow execution engine with zero desktop dependencies.

**Stories for Epic 10:**

**E10-S1: Storage Service Abstraction for Workflows (Size: M)**
- API-based file access (`storage.readFile()`, `storage.writeFile()`)
- File URL generation for prompt files
- Backend mapping (local filesystem for MVP, S3/Azure for cloud)
- Implements: Workflow Requirements §3.2

**E10-S2: Portable Execution Engine Core (Size: L)**
- Zero desktop UI dependencies
- Zero local file path dependencies
- Embedded AI client (Anthropic API)
- Bundled runtimes (Node, Python, Bash)
- Memory-based state, persisted by engine
- Implements: Workflow Requirements §3.1

**E10-S3: Capability-Based Sandboxing (Size: L)**
- Capability tokens (request → approve → enforce)
- RBAC/SSO context inheritance
- Permission enforcement (filesystem, network, commands)
- Resource limits (memory, CPU, timeout)
- Implements: Workflow Requirements §3.4

**E10-S4: Script Execution Infrastructure (Size: M)**
- Bundled Node.js, Python, Bash runtimes
- Script isolation (separate processes)
- Capability injection as environment variables
- Timeout enforcement (60 seconds default)
- Implements: Workflow Requirements §3.4

---

## 4. Implementation Readiness Assessment

### 4.1 Documentation Completeness

| Document | Current State | Required for Implementation | Gap |
|----------|---------------|----------------------------|-----|
| **PRD** | 90% complete for chat-to-workflow | Needs marketplace, "My Project", portable engine sections | 🟡 Medium gap |
| **Architecture** | 70% complete for project workflows | Needs portable engine, marketplace, packaging sections | 🔴 High gap |
| **Epics & Stories** | 30% complete for user workflows | Missing Epic 9 (Marketplace), Epic 10 (Portable Engine) | 🔴 High gap |

**Overall Readiness:** 🔴 **NOT READY** - Critical architectural sections missing

### 4.2 Recommended Action Plan

**Phase 1: Document Updates (Week 1)**
1. Update PRD with new sections (3.7.1-3.7.3, 3.8, 1.4)
2. Update Architecture with new sections (6.3-6.5, 7.3, 15)
3. Create Epic 9 and Epic 10 with stories

**Phase 2: Technical Validation (Week 2)**
4. Validate storage service abstraction with Platform Team
5. Validate portable engine constraints with Backend Team
6. Validate marketplace architecture with Product Team

**Phase 3: Implementation Planning (Week 3)**
7. Sequence Epic 9 and Epic 10 stories into sprints
8. Identify dependencies between chat-to-workflow (PRD) and marketplace workflows (new requirements)
9. Finalize MVP scope (Basic + Intermediate tiers only)

---

## 5. Key Decisions Needed

| Decision | Options | Recommendation | Deadline |
|----------|---------|---------------|----------|
| **Workflow Types** | 1) Single workflow system (marketplace replaces project workflows)<br>2) Dual systems (project workflows for teams, marketplace user-facing) | **Dual systems** - Project workflows for teams, marketplace for users | Before Epic 9 starts |
| **"My Project" Name** | 1) "My Project"<br>2) "Personal Workspace"<br>3) "Private Workflows"<br>4) Just use user's name | **"My Workflows"** - Clearer than "My Project", less confusing | Before UI mockups |
| **Marketplace Timing** | 1) MVP (Month 4)<br>2) Post-MVP (Month 6+) | **Post-MVP (Month 6)** - Focus on chat-to-workflow for MVP, marketplace for Phase 3 | Now |
| **Portable Engine Timing** | 1) MVP (build portable from day 1)<br>2) Refactor later (build fast, refactor for cloud) | **Build portable from day 1** - Refactoring is expensive and risky | Now |
| **Workflow Tiers in MVP** | 1) Basic only<br>2) Basic + Intermediate | **Basic + Intermediate** - Enables conditionals, which are needed for useful workflows | Before Epic 9 starts |

---

## 6. Risk Assessment

### 6.1 High Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Dual workflow systems confuse developers** | Medium | High | Clear separation: "Project workflows" (team automation) vs "User workflows" (marketplace); separate code paths |
| **Portable engine constraints slow development** | High | Medium | Accept MVP velocity trade-off for long-term cloud portability; prototype portable engine early |
| **Marketplace scope creep delays MVP** | High | High | **Defer marketplace to Post-MVP (Month 6)**; Focus MVP on chat-to-workflow only |
| **Storage service abstraction breaks existing code** | Low | High | Implement abstraction layer that wraps existing local filesystem; migrate incrementally |

### 6.2 Medium Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **"My Project" concept confuses users** | Medium | Medium | User research before finalizing naming; consider "My Workflows" instead |
| **Freemium model complexity** | Medium | Medium | Defer paid workflows to Post-MVP; Launch marketplace with free workflows only |
| **Capability sandboxing performance overhead** | Low | Medium | Benchmark early; optimize hot paths; consider lazy permission checking |

---

## 7. Summary of Required Document Updates

### PRD Updates

| Section | Change Type | Content |
|---------|------------|---------|
| § 1.4 Business Objectives | Add metrics | Marketplace adoption metrics ($50K ARR, 1K workflows, 100 published) |
| § 3.2 Chat-to-Workflow | Clarify | This is one workflow creation method; reference emergence pattern |
| § 3.7 (Rename) | Expand | Rename to "Workflow Marketplace & Creation"; add 3.7.1-3.7.3 subsections |
| § 3.8 (New) | Add | Portable Workflow Engine (storage abstraction, capability sandboxing, cloud-ready) |

### Architecture Updates

| Section | Change Type | Content |
|---------|------------|---------|
| § 2.2 Process Architecture | Add services | WorkflowPackagingService, WorkflowMarketplaceService, StorageServiceAbstraction |
| § 3.6 (New) | Add | "My Project" Data Model |
| § 4.1 Cache Architecture | Add | Workflow package cache |
| § 6.3-6.5 (New) | Add | User workflow execution, packaging, marketplace |
| § 7.3 (New) | Add | Workflow script security (capability tokens, RBAC/SSO) |
| § 9.2 Storage Service | Update | Add workflow file storage endpoints |
| § 13.5 MCP Integration | Update | Add note that MCP tools work in user workflows |
| § 15 (New) | Add | Cloud execution architecture (post-MVP) |

### Epics & Stories Updates

| Epic | Change Type | Content |
|------|------------|---------|
| E7 Workflows | Clarify scope | Focus on Project workflows (team); separate from user marketplace |
| E9 (New) | Add | User Workflow Marketplace (8 stories) |
| E10 (New) | Add | Portable Workflow Engine (4 stories) |

---

## 8. Conclusion

The **Workflow Engine Requirements** introduce a **major new product capability** that requires substantial updates to existing documentation. The key architectural decisions (portable engine, storage abstraction, capability sandboxing) must be incorporated **before implementation begins** to avoid costly refactoring.

**Critical Path:** Update PRD and Architecture documents **this week** to unblock Epic 9 and Epic 10 planning.

**Recommended Phasing:**
- **MVP (Month 4):** Focus on chat-to-workflow (existing PRD) + portable engine foundation (new requirements)
- **Post-MVP (Month 6):** Add full marketplace (publishing, curation, freemium model)

This phasing balances **MVP velocity** (get chat-to-workflow working fast) with **architectural discipline** (build portable from day 1, even if marketplace comes later).

---

**End of Analysis**

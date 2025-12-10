# Workflow Engine Requirements
## Holokai Desktop - User-Created Shareable Workflows

**Document Version:** 1.0
**Date:** 2025-11-26
**Author:** Mary (Business Analyst) with Peter Baxter
**Status:** Requirements Definition

---

## Executive Summary

This document defines requirements for the Holokai Desktop workflow engine - a **business discriminator** enabling users to create, share, and monetize workflows through a curated marketplace. The workflow engine must be **portable by design**, capable of running locally (MVP) and in the cloud (post-MVP) with minimal architectural changes.

### Key Principles
- **Democratized Creation**: Everyone can create workflows, from novices to experts
- **Shareable Assets**: Workflows are first-class shareable artifacts
- **Cloud Portable**: Zero dependencies on desktop UI or local file paths
- **Enterprise Ready**: RBAC/SSO integration, private registries, trust & safety
- **Freemium Business Model**: Free community + premium paid workflows + creator grants

---

## 1. User Capabilities

### 1.1 Workflow Creation Methods

Users can create workflows through multiple progressive methods:

#### Priority 1: AI-Assisted Creation
**User Flow:**
1. User describes desired workflow in natural language
2. AI suggests workflow structure with steps
3. User approves/modifies structure through guided prompts
4. User fills in template details via conversational refinement
5. AI generates complete workflow package

**AI Capabilities:**
- Suggest workflow structure based on user description
- Generate templates from examples
- Recommend knowledge bases (decision catalogs)
- Auto-detect workflow tier (Basic/Intermediate)
- Provide iterative refinement based on feedback

**Emergence Pattern:**
When user generates an output or file, Holokai subtly offers: *"Want to create a workflow from this?"*
- Captures context of what user just did
- Suggests workflow steps based on actions taken
- Workflows emerge from real work, not abstract planning

#### Priority 2: GUI Workflow Builder
**Visual Representation:** Timeline view (horizontal progression) OR Flowchart (boxes/arrows) - **whichever is simpler**

**Template Editor:**
- Split view: Template code (left) + Live preview (right)
- Form builder: Drag-and-drop sections, auto-generates template
- Raw YAML/JSON editor for advanced users

**Components:**
- Step editor with conditional logic
- Variable insertion from dropdown
- Template preview with sample data
- Permission/capability selector

#### Priority 3: Hybrid Editing
- GUI generates YAML structure
- Experts can hand-edit generated YAML
- Changes sync between GUI and code editor

#### Priority 4: Direct YAML Editing
- For power users who understand workflow schema
- Full access to advanced features
- Syntax validation and intellisense

### 1.2 Workflow Complexity Tiers

**Basic Tier:**
- Linear steps (do A, then B, then C)
- Ask user questions, capture answers
- Generate single output file from template
- Simple string variables only
- Example: "Create meeting notes from template"

**Intermediate Tier:**
- If/then conditional branching
- Multiple templates/outputs
- Load existing files as inputs
- Config references, system-generated variables
- Example: "Create bug report (different templates for frontend/backend)"

**Advanced Tier (Post-MVP):**
- Reserved for future expansion
- May include: workflow invocation, loops, knowledge bases, multi-step checkpoints

### 1.3 Workflow Management

Users can:
- **Browse workflows**: Marketplace + installed workflows
- **Install workflows**: From marketplace to "My Project" or team projects
- **Run workflows**: Via workflow browser or right-click context menu
- **Edit workflows**: Modify installed workflows (forks local copy)
- **Publish workflows**: Submit to marketplace for approval
- **Update workflows**: Receive notifications of available updates
- **Uninstall workflows**: Remove from project
- **Share workflows**: Via marketplace or export package file

### 1.4 Workflow Execution

**Input Handling:**
- Progressive prompts: Ask for inputs as workflow needs them (not all upfront)
- Variable types: Simple strings, config references, system-generated
- Smart defaults: AI suggests values based on context

**State Management:**
- Undo: Roll back reversible steps (only for reversible steps)
- History: View all past executions with inputs/outputs

**Error Handling:**
- AI assistance: Suggest fixes when steps fail
- Retry capability: Re-run failed steps
- Graceful degradation: Continue workflow when non-critical steps fail

---

## 2. Desktop Application Capabilities

### 2.1 Workflow Discovery & Invocation

**Workflow Browser (Primary UI):**
```
📚 Active Project: Holokai Desktop
  ├── 💼 Project Workflows (8)
  │   ├── custom/deploy-production
  │   └── marketplace/api-testing
  └── 👤 My Personal Workflows (15)
      ├── custom/meeting-notes
      └── marketplace/release-notes

🏪 Marketplace
  ├── ⭐ Featured
  ├── 📊 Popular
  └── 🔍 Search...

[Switch Project ▼]
```

**Right-Click Context Menu:**
- Right-click file → "Run workflow..."
- Shows applicable workflows for file type
- Quick access without opening browser

**Search & Filtering:**
- Full-text search across workflow names, descriptions, tags
- Filter by category, tier, installed/not-installed
- Sort by rating, install count, recently updated

### 2.2 Marketplace Integration

**Discovery Features:**
- **Categories**: "Documentation", "Code Generation", "Testing", "Deployment", etc.
- **Search**: Full-text across name, description, README
- **Recommendations**: "Similar workflows", "Users also installed"
- **Filtering**: By tier, category, verified publisher, rating

**Trust Indicators:**
- 🔒 **Security scan**: "Last scanned: 2 days ago, no issues" + risk score badge
- 👥 **Community feedback**: Star ratings (1-5), user reviews, comments
- ⭐ **Install count**: "10K+ installs"
- ✓ **Verified Publisher**: Badge for approved authors
- 🏢 **Enterprise approved**: Usage statistics

**Installation Flow:**
1. User selects workflow in marketplace
2. Shows workflow details, permissions, risk score
3. **Mandatory permission disclosure**:
   ```
   This workflow requests:
   ✓ Filesystem: Read/Write in workspace
   ✓ Network: HTTPS requests to github.com
   ✓ Git: Read repository history
   ✓ Bash: Execute shell commands

   Risk Score: Medium Risk
   ```
4. User chooses: "Install to My Project" OR "Install to Current Project"
5. Downloads package, validates, installs dependencies (if any)
6. Adds to user's workflow library

**Update Notifications:**
- Desktop notifies: "Update available for 'Release Notes' workflow (v1.1.0)"
- User clicks to review changelog
- User approves/defers update
- No auto-updates - user control

### 2.3 Workflow Execution UI

**Execution Window:**
- Progress indicator showing current step
- Real-time output display
- Input prompts (progressive, as needed)
- Checkpoint options: [c] Continue, [a] Advanced Elicitation, [p] Party-Mode, [y] YOLO
- Pause/resume capability
- Undo reversible steps

**AI Assistance During Execution:**
- Pre-fill inputs based on context (current file, git state)
- Explain steps: User asks "What does step 3 do?"
- Handle errors: "Step 2 failed, here's a suggested fix"
- Suggest improvements: "You run this often, want to automate it?"

### 2.4 Project Management

**Project Model:**
Every user has a **"My Project"** (personal project) plus team projects.

```
~/.holokai/My Project/          # Personal project
├── .holokai/
│   ├── config.yaml             # User variables
│   └── workflows/
│       ├── marketplace/        # Installed from marketplace
│       └── custom/             # User-created workflows
└── outputs/                    # Workflow outputs

/team-project/.holokai/         # Team project
├── .holokai/
│   ├── config.yaml             # Project variables
│   └── workflows/
│       ├── marketplace/        # Project-specific (git-ignored)
│       └── custom/             # Team workflows (git-committed)
└── docs/                       # Project outputs
```

**Project Isolation:**
- Projects are independent - no config merging, no inheritance
- Workflow runs in ONE project context, uses ONLY that project's config
- No cross-project file access
- Variables: Project config + workflow config only

**Project Variables:**
```yaml
# .holokai/config.yaml (per project)
project_name: "Holokai Desktop"
output_folder: "{project-root}/docs"
team_name: "Core Team"
# ... project-specific variables
```

**System Variables (Available to All Workflows):**
- `{user_name}` - from My Project config
- `{project_name}` - from current project config
- `{project-root}` - absolute path to current project
- `{date}` - current date (YYYY-MM-DD)
- `{timestamp}` - current timestamp (ISO 8601)
- `{workflow-name}` - name of executing workflow

---

## 3. Workflow Engine Architecture (Portable Core)

### 3.1 Design Constraints

**CRITICAL: The workflow engine MUST be portable to run in the cloud (post-MVP).**

**Prohibited Dependencies:**
- ❌ Desktop UI frameworks (Electron APIs)
- ❌ Local file paths (must use abstracted storage)
- ❌ Operating system-specific features
- ❌ Native binaries (unless containerized)

**Required Architecture:**
```
┌────────────────────────────────────────────────┐
│       Workflow Engine (Portable Core)          │
│  ✓ Embedded AI client (Anthropic API)          │
│  ✓ Bundled runtimes (Node, Python, Bash)       │
│  ✓ Memory-based state → persisted               │
│  ✓ NO desktop UI dependencies                   │
│  ✓ NO local file paths                          │
└────────────────────────────────────────────────┘
         ↕                              ↕
┌──────────────────┐          ┌──────────────────┐
│ Storage Service  │          │  Trigger Layer   │
│ - File URLs      │          │  - Desktop (MVP) │
│ - Prompt files   │          │  - Web UI        │
│ - Workflow files │          │  - API/Webhooks  │
│ - Outputs        │          │  - Scheduled     │
└──────────────────┘          └──────────────────┘
```

### 3.2 Core Components

#### File System Abstraction
**API-based file access** - workflows call storage service APIs, never direct filesystem:

```javascript
// Workflow script calls:
const content = await storage.readFile('workflow://templates/output.md')
const url = await storage.getFileURL('project://docs/prd.md')
await storage.writeFile('project://outputs/result.md', content)
```

Storage service provides:
- File URLs for prompt files and workflow files
- Abstracted read/write operations
- Mapping to local filesystem (MVP) or cloud storage (post-MVP)

#### AI Integration
**Embedded AI client** in workflow engine:
- Workflows call `ai.generate(prompt, context)` API
- Engine routes to Anthropic API (works local + cloud)
- AI available for: input pre-filling, error handling, explanation, generation

#### Script Execution
**Bundled runtimes**: Workflow engine includes Node.js, Python, Bash interpreters
- Scripts run in isolated contexts with capability tokens
- Language detection from script file extension
- All scripts executed through runtime sandboxes

**Sandboxing Approach: Capability Tokens (Q17)**
- Scripts request specific capabilities: `["filesystem:read", "network:https", "git:read"]`
- User approves capabilities during workflow installation
- Runtime enforces capability restrictions
- RBAC/SSO integration: Scripts run with user's security context

#### State Management
**Memory-based state, persisted by workflow engine:**
- Workflow execution state held in memory during execution
- Checkpoints saved to storage service
- History persisted for undo/replay
- No external database dependency (MVP)

### 3.3 Runtime Isolation

**DEFERRED**: Specific container/sandbox technology decision deferred.
- Options include: Docker/Podman containers, WASM, V8 isolates, process-based
- Decision based on performance testing and cloud provider constraints
- Must support bundled runtimes (Node/Python/Bash)

### 3.4 Script Capabilities & Security

Scripts can access (with user approval via RBAC/SSO):
- **Filesystem**: Read/write files in workspace (via storage service)
- **Network**: Call APIs, download data (HTTPS only)
- **Execute commands**: Run shell commands, npm scripts
- **Claude AI**: Invoke AI within script via embedded client

**Supported Languages:**
- JavaScript/TypeScript (Node.js runtime)
- Python
- Bash/shell scripts

**Permission Model:**
- Workflow manifest declares required permissions
- User sees permissions before installation (mandatory disclosure)
- Runtime enforces permissions using capability tokens
- Scripts inherit user's RBAC/SSO context (no privilege escalation)

---

## 4. Workflow Definition Format

### 4.1 Package Structure

**Directory-based (development):**
```
my-workflow/
├── manifest.json          # Package metadata
├── workflow.yaml          # Core workflow definition
├── instructions.md        # Step execution logic
├── templates/
│   ├── output-template.md
│   └── email-template.html
├── scripts/
│   ├── preprocess.js      # Pre-workflow script
│   ├── transform.py       # Step script
│   └── validate.sh        # Post-workflow validation
├── inputs/
│   ├── variables.yaml     # Input variable definitions
│   └── samples/
│       ├── sample-data.csv
│       └── example.json
├── assets/
│   └── icon.png
└── README.md
```

**Single-file bundle (distribution):**
```
my-workflow.wfpkg          # Compressed archive (.zip)
```

**Hybrid approach:**
- Development: Directory structure (editable)
- Distribution: Compressed .wfpkg file (marketplace)
- Installation: Extracts to `.holokai/workflows/` in project

### 4.2 Manifest Schema

```json
{
  "name": "create-release-notes",
  "version": "1.2.0",
  "tier": "intermediate",
  "author": "peter@holokai.ai",
  "license": "MIT",
  "description": "Generate release notes from git commits",
  "category": "documentation",
  "tags": ["changelog", "release", "git"],

  "inputs": [
    {
      "name": "start_tag",
      "type": "string",
      "description": "Starting git tag",
      "required": true
    },
    {
      "name": "end_tag",
      "type": "string",
      "description": "Ending git tag (defaults to HEAD)",
      "required": false,
      "default": "HEAD"
    }
  ],

  "outputs": [
    {
      "name": "release_notes",
      "path": "{project-root}/RELEASE_NOTES.md",
      "description": "Generated release notes"
    }
  ],

  "scripts": [
    {
      "name": "parse-commits.js",
      "language": "javascript",
      "purpose": "Extract commit messages"
    }
  ],

  "permissions": [
    "filesystem:read",
    "filesystem:write",
    "git:read"
  ],

  "dependencies": {
    "git-history-analyzer": "^2.0.0"
  }
}
```

### 4.3 Workflow.yaml Schema

```yaml
name: workflow-id
description: "User-facing description"
author: "username"
tier: "basic" | "intermediate"

# Project config reference
config_source: "{project-root}/.holokai/config.yaml"
output_folder: "{config_source}:output_folder"

# Workflow components
installed_path: "{project-root}/.holokai/workflows/marketplace/author/workflow-name"
instructions: "{installed_path}/instructions.md"
template: "{installed_path}/templates/output.md"
validation: "{installed_path}/checklist.md"  # Optional

# Input variables (from manifest)
inputs:
  start_tag: string
  end_tag: string

# Output configuration
default_output_file: "{output_folder}/release-notes-{date}.md"

# Scripts
scripts:
  - name: "parse-commits"
    path: "{installed_path}/scripts/parse-commits.js"
    when: "before-step-2"
```

### 4.4 Instructions.md Format

XML-based workflow language:

```xml
<workflow>
  <step n="1" goal="Gather git history">
    <action>Get start_tag from user input</action>
    <action>Get end_tag from user input (default: HEAD)</action>
    <action>Run parse-commits.js script</action>
  </step>

  <step n="2" goal="Generate release notes">
    <action>Load template from templates/output.md</action>
    <action>Replace {{commits}} with parsed commit list</action>
    <action>Replace {{date}} with current date</action>

    <template-output>
      <!-- Generated content saved to output file -->
    </template-output>
  </step>

  <step n="3" goal="Validation">
    <ask>Review generated release notes. Approve? (y/n)</ask>
    <check if="user approves">
      <action>Save to {default_output_file}</action>
    </check>
    <check if="user rejects">
      <goto step="2">Regenerate</goto>
    </check>
  </step>
</workflow>
```

**Supported Tags:**
- `<step n="X" goal="...">` - Define workflow step
- `<action>` - Required action to perform
- `<check if="condition">` - Conditional execution
- `<ask>` - Get user input (wait for response)
- `<goto step="X">` - Jump to another step
- `<template-output>` - Save content checkpoint
- `<invoke-workflow>` - Call another workflow (post-MVP)

### 4.5 Input Variable Types

**Simple Strings:**
```yaml
project_name: "Holokai Desktop"
user_input: "{{ask_user}}"
```

**Config References:**
```yaml
output_folder: "{config_source}:output_folder"
team_name: "{config_source}:team_name"
```

**System-Generated:**
```yaml
date: system-generated  # YYYY-MM-DD
timestamp: system-generated  # ISO 8601
current_year: system-generated
```

---

## 5. Marketplace & Sharing

### 5.1 Marketplace Architecture

**Hosting:** Holokai-hosted (holokai.ai/marketplace)

**Components:**
- Public marketplace (free + premium workflows)
- Enterprise private registries (post-MVP)
- Publishing pipeline
- Review & curation system
- Security scanning
- Payment processing (for premium workflows)

### 5.2 Enterprise Private Registries

**Capabilities:**
- Organizations can run internal workflow marketplace
- Curate workflows for their teams
- Keep proprietary workflows private
- Control what employees can install from public marketplace
- Sync workflows across team members
- Track usage and compliance

**Architecture:**
```
Public Marketplace (holokai.ai)
  ↓
Enterprise Registry (company.internal)
  ↓
Employee Desktop App
```

### 5.3 Publishing Flow

**Who Can Publish:** Approved publishers only
- Application process
- Background check
- Terms of service acceptance
- Publisher agreement (revenue share, content policy)

**Publishing Pipeline:**
```
Developer submits workflow
  ↓
Automated security scan (malware, vulnerabilities)
  ↓
Syntax validation (manifest, workflow.yaml, instructions.md)
  ↓
Human review (Holokai team)
  - Code quality / best practices
  - Security vulnerabilities
  - Accurate description / documentation
  - Actually works (test execution)
  - No malicious code
  - License compliance
  ↓
Test execution (automated QA)
  ↓
Approve → Publish to marketplace
  OR
Reject → Feedback to developer
```

**Review SLA:** 1-3 business days

### 5.4 Versioning & Updates

**Semantic Versioning:**
- Format: MAJOR.MINOR.PATCH (e.g., 1.2.0)
- Breaking changes: Increment MAJOR
- New features: Increment MINOR
- Bug fixes: Increment PATCH

**Update Notifications:**
- Desktop app checks for updates daily
- User receives notification: "Update available for X workflow"
- User reviews changelog
- User approves/defers update
- No automatic updates - user control

**Version Pinning:**
- Users can lock to specific version
- Workflow dependencies specify version ranges: `^2.0.0`

### 5.5 Business Model - Freemium

**Free Tier:**
- Public marketplace access
- Install unlimited free workflows
- Create and publish workflows
- Basic workflow tiers (Basic, Intermediate)

**Premium Workflows:**
- Creators set price ($0.99 - $99.99)
- Holokai takes 30% revenue share
- Payment processing via Stripe
- Monthly payouts to creators

**Creator Incentives:**
- **Holokai License Grants**: Pay top contributors for maintaining popular workflows
- **Reputation System**: Leaderboards, "Top Contributor" badges, verified publisher status
- Revenue sharing from premium workflows

**Enterprise Licensing:**
- Private registries: $99/month per organization
- Team collaboration features
- Priority support
- Custom workflow development services

---

## 6. Trust & Safety

### 6.1 Security Scanning

**Automated Scans:**
- Run on every workflow submission
- Run weekly on all published workflows
- Checks for:
  - Malware signatures
  - Vulnerability patterns (SQL injection, XSS, command injection)
  - Suspicious network calls
  - Obfuscated code
  - Known malicious dependencies

**Security Badges:**
- "Last scanned: 2 days ago, no issues found"
- "Security scan failed - workflow disabled"

### 6.2 Trust Indicators

**Displayed in Marketplace:**
- 🔒 **Security scan**: Badge + last scan date
- 👥 **Community feedback**: Star ratings (1-5), review count, comment excerpts
- ⭐ **Install count**: "10K+ installs" (social proof)
- ✓ **Verified Publisher**: Manual approval by Holokai team
- 🏢 **Enterprise approved**: "Used by 50+ organizations"

### 6.3 Permission Transparency

**Mandatory Disclosure (Before Installation):**
```
╔═══════════════════════════════════════════════╗
║  This workflow requests:                      ║
║                                               ║
║  ✓ Filesystem: Read/Write in workspace       ║
║  ✓ Network: HTTPS requests to github.com     ║
║  ✓ Git: Read repository history              ║
║  ✓ Bash: Execute shell commands              ║
║                                               ║
║  Risk Score: Medium Risk                      ║
║                                               ║
║  [View Details] [Cancel] [Install]           ║
╚═══════════════════════════════════════════════╝
```

**Risk Score Calculation:**
- Low: Read-only filesystem, no network, no scripts
- Medium: Write filesystem, HTTPS network, limited commands
- High: Execute arbitrary commands, network access to any domain

### 6.4 Community Moderation

**User Actions:**
- Report malicious workflows
- Flag inaccurate descriptions
- Report bugs/issues
- Leave reviews and ratings

**Holokai Response:**
- Investigate reports within 24 hours
- Disable malicious workflows immediately
- Contact publisher for clarification/fixes
- Ban repeat offenders

**Appeal Process:**
- Publishers can appeal rejections/bans
- Human review of appeal
- Transparent reasoning provided

---

## 7. Cloud Execution (Post-MVP)

### 7.1 Trigger Modes

**Desktop Delegate:**
- User clicks "Run" in desktop app
- Desktop sends workflow execution request to cloud
- Cloud runs workflow in isolated environment
- Streams results back to desktop in real-time
- Desktop displays output as if running locally

**Web UI:**
- Separate cloud-based workflow UI (holokai.ai/workflows)
- Users can run workflows from browser
- Same marketplace, same workflows
- Useful for lightweight access without desktop app

**API/Webhooks:**
- Programmatic workflow invocation
- Examples:
  - Git push → run "Deploy to staging" workflow
  - Issue created → run "Triage bug" workflow
  - Schedule → run "Generate weekly report" workflow
- REST API: `POST /api/workflows/{id}/execute`

**Scheduled Execution:**
- Cron-like scheduling for recurring workflows
- Examples:
  - Daily: "Update documentation index"
  - Weekly: "Generate team report"
  - Monthly: "Archive completed issues"

### 7.2 Cloud Architecture (Future)

```
┌──────────────────────────────────────────────┐
│  Workflow Engine (Portable Core)             │
│  - Same engine as desktop                    │
│  - No code changes needed                    │
└──────────────────────────────────────────────┘
         ↕                              ↕
┌──────────────────┐          ┌──────────────────┐
│ Cloud Storage    │          │ Cloud Triggers   │
│ - S3/GCS         │          │ - Web UI         │
│ - File URLs      │          │ - API Gateway    │
│ - Blob storage   │          │ - Event Bus      │
└──────────────────┘          └──────────────────┘
```

**Benefits of Portable Design:**
- Same workflow runs local or cloud without modification
- No vendor lock-in (can run on AWS, GCP, Azure)
- Hybrid execution: Heavy workflows in cloud, light workflows local
- Team collaboration: Share execution state via cloud

---

## 8. Success Metrics

### 8.1 MVP Success Criteria

**User Adoption:**
- 1,000+ workflows created in first 3 months
- 100+ workflows published to marketplace
- 10,000+ workflow executions

**Marketplace Health:**
- 50+ verified publishers
- 4.0+ average workflow rating
- 80%+ workflow approval rate (publishing pipeline)

**Technical Performance:**
- Workflow execution: <5 seconds startup time
- Storage service: <100ms file URL retrieval
- Security scans: 100% coverage, <5 false positives per week

### 8.2 Business Metrics

**Revenue (Year 1):**
- 20% of workflows are premium (paid)
- Average premium workflow price: $9.99
- 30% revenue share to Holokai
- Target: $50K ARR from marketplace

**Enterprise Adoption:**
- 10+ enterprise private registries
- $99/month per organization
- Target: $12K ARR from enterprise licensing

**Creator Economics:**
- Top 10% of creators earn $100+/month
- Top 1% earn $1,000+/month
- Holokai grants: $50K/year to top contributors

---

## 9. Implementation Phases

### Phase 1: MVP (Desktop Local Execution)

**Core Engine:**
- Workflow parser (YAML + XML instructions)
- Execution engine (step-by-step runner)
- Storage service abstraction (local filesystem backend)
- Embedded AI client (Anthropic API)
- Bundled runtimes (Node, Python, Bash)
- Capability-based sandboxing

**Desktop UI:**
- Workflow browser
- Marketplace integration
- Installation flow with permission disclosure
- Execution UI with progress tracking
- Right-click context menu

**Marketplace:**
- Holokai-hosted marketplace (holokai.ai/marketplace)
- Publishing pipeline (scan → review → test → approve)
- Free + premium workflows
- Payment processing (Stripe)

**Workflows:**
- Basic tier support
- Intermediate tier support
- Template system (Handlebars)
- Script execution (JS, Python, Bash)

### Phase 2: Cloud Execution

**Cloud Runner:**
- Deploy workflow engine to cloud (AWS Lambda / GCP Cloud Run)
- Cloud storage integration (S3 / GCS)
- API Gateway for programmatic invocation
- Webhook triggers

**Desktop Integration:**
- Delegate execution to cloud
- Stream results back to desktop
- Hybrid mode: Choose local or cloud execution

**Web UI:**
- Browser-based workflow execution
- Same marketplace, same workflows
- Account sync (cross-device)

### Phase 3: Enterprise Features

**Private Registries:**
- Organization-hosted workflow registries
- Workflow curation and approval
- Team collaboration
- Usage analytics

**Advanced Workflows:**
- Workflow invocation (call other workflows)
- Loop constructs (for-each)
- Knowledge bases (decision catalogs)
- Multi-step checkpoints with branching

**Scheduled Execution:**
- Cron-like scheduling
- Event-based triggers
- Workflow dependencies (run A then B)

---

## 10. Open Questions & Future Decisions

### Deferred Decisions

**Q50: Runtime Isolation Technology**
- Decision: DEFERRED
- Options: Docker/Podman, WASM, V8 isolates, process-based
- Timeline: Decide during Phase 2 (Cloud Execution) based on performance testing

### Future Exploration

**Advanced Workflow Features:**
- Should workflows be able to invoke other workflows? (MVP: No, Phase 3: Yes)
- Loop constructs for batch operations?
- Parallel step execution?
- Workflow versioning with migration paths?

**AI-Powered Features:**
- AI-generated workflow suggestions based on user behavior?
- Auto-optimization of workflows (detect inefficiencies)?
- Natural language workflow editing ("Add a step that validates the output")?

**Enterprise Requirements:**
- SSO integration specifics (SAML, OAuth, OIDC)?
- Audit logging and compliance (SOC2, GDPR)?
- Workflow approval gates for enterprise teams?

**Marketplace Evolution:**
- Workflow collections/bundles (install multiple related workflows)?
- Workflow templates (starter packs for common patterns)?
- Community forums and workflow sharing (beyond marketplace)?

---

## Appendix A: Workflow Schema Reference

### Manifest.json Complete Schema

```json
{
  "$schema": "https://holokai.ai/schemas/workflow-manifest-v1.json",

  "name": "string (required, lowercase-kebab-case)",
  "version": "string (required, semver: X.Y.Z)",
  "tier": "basic | intermediate (required)",
  "author": "string (required, email or username)",
  "license": "string (required, SPDX identifier)",
  "description": "string (required, max 200 chars)",
  "longDescription": "string (optional, markdown)",
  "category": "string (required, from predefined categories)",
  "tags": ["array of strings (optional)"],
  "homepage": "string (optional, URL)",
  "repository": "string (optional, git URL)",

  "inputs": [
    {
      "name": "string (required)",
      "type": "string (required: string | number | boolean | date)",
      "description": "string (required)",
      "required": "boolean (required)",
      "default": "any (optional)"
    }
  ],

  "outputs": [
    {
      "name": "string (required)",
      "path": "string (required, supports variables)",
      "description": "string (required)"
    }
  ],

  "scripts": [
    {
      "name": "string (required)",
      "language": "javascript | python | bash (required)",
      "purpose": "string (optional)"
    }
  ],

  "permissions": [
    "filesystem:read",
    "filesystem:write",
    "network:https",
    "git:read",
    "bash:execute"
  ],

  "dependencies": {
    "workflow-name": "version range (^X.Y.Z)"
  },

  "pricing": {
    "type": "free | premium (required)",
    "price": "number (required if premium, USD)"
  },

  "icon": "string (optional, relative path to icon.png)"
}
```

### Predefined Categories

```
- Documentation
- Code Generation
- Testing
- Deployment
- Project Setup
- Data Processing
- API Integration
- Reporting
- Automation
- Other
```

---

## Appendix B: Storage Service API

### Interface Definition

```typescript
interface StorageService {
  // Read operations
  readFile(url: string): Promise<string>
  getFileURL(path: string): Promise<string>
  fileExists(path: string): Promise<boolean>
  listFiles(path: string): Promise<string[]>

  // Write operations
  writeFile(path: string, content: string): Promise<void>
  deleteFile(path: string): Promise<void>
  createDirectory(path: string): Promise<void>

  // Metadata
  getFileMetadata(path: string): Promise<FileMetadata>
}

interface FileMetadata {
  size: number
  created: Date
  modified: Date
  mimeType: string
}
```

### URL Schemes

```
workflow://      - Files within workflow package
project://       - Files in current project
personal://      - Files in "My Project" (personal)
marketplace://   - Files in marketplace (read-only)
```

### Examples

```javascript
// Read workflow template
const template = await storage.readFile('workflow://templates/output.md')

// Read project file
const prd = await storage.readFile('project://docs/prd.md')

// Write output
await storage.writeFile('project://outputs/release-notes.md', content)

// Get file URL for AI prompt
const fileUrl = await storage.getFileURL('project://docs/architecture.md')
// Returns: "file:///path/to/project/docs/architecture.md" (MVP)
//      or: "https://storage.holokai.ai/files/abc123" (Cloud)
```

---

## Appendix C: AI Client API

### Interface Definition

```typescript
interface AIClient {
  // Text generation
  generate(prompt: string, context?: AIContext): Promise<string>

  // Streaming generation
  generateStream(prompt: string, context?: AIContext): AsyncIterator<string>

  // Structured extraction
  extract<T>(prompt: string, schema: Schema<T>): Promise<T>

  // Multi-turn conversation
  chat(messages: Message[]): Promise<string>
}

interface AIContext {
  files?: string[]  // File URLs to include in context
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}
```

### Examples

```javascript
// Simple generation
const summary = await ai.generate(
  'Summarize this PRD in 3 bullet points',
  { files: ['project://docs/prd.md'] }
)

// Structured extraction
const commits = await ai.extract(
  'Extract all commit messages from this git log',
  {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        hash: { type: 'string' },
        message: { type: 'string' },
        author: { type: 'string' }
      }
    }
  }
)

// Streaming (for real-time UI updates)
for await (const chunk of ai.generateStream('Write release notes')) {
  console.log(chunk)
}
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-26 | Mary (Analyst) with Peter Baxter | Initial requirements document |

---

**End of Document**

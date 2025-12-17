# Product Requirements Document: Holokai Desktop Enterprise MVP

**Document Version:** 2.0
**Date:** 2025-11-26
**Status:** Draft
**Author:** Product Team
**Stakeholders:** Engineering, Design, QA, Sales, Customer Success
**Supersedes:** Phase 2 PRD v1.0 (2025-11-25)

---

## 1. Executive Summary

### 1.1 Product Overview

Holokai Desktop Enterprise MVP transforms the Phase 2 collaboration foundation into an **enterprise-ready progressive agentic platform** for organizations with 100-1,000 knowledge workers. Building on Phase 1's chat and authentication capabilities, the Enterprise MVP introduces the platform's core differentiators: chat-to-workflow progression, MCP integration ecosystem, progressive governance controls, and native enterprise integrations.

### 1.2 Vision Statement

**Enable mid-market enterprises to achieve 80%+ AI adoption through progressive complexity**: employees start with natural chat interactions, the platform automatically suggests workflow automation opportunities, and IT maintains adaptive governance controls that scale with organizational usage.

### 1.3 Strategic Positioning

| Dimension | Holokai Desktop Enterprise MVP | Competitors |
|-----------|-------------------------------|-------------|
| **Target Market** | 100-1,000 employee organizations | Enterprise (1,000+) or SMB (<100) |
| **Adoption Strategy** | Chat-first progressive onboarding | Upfront workflow builder training |
| **Time to Value** | 2-4 weeks to full deployment | 6-12 months |
| **Pricing** | $50-100/user/year | $100-200+/user (enterprise) or $240-1,200/user (Zapier at scale) |
| **Governance Model** | Progressive (permissive → controlled) | Binary (open or locked-down) |
| **Core Differentiator** | Chat-to-workflow automation path | Separate chat OR automation tools |

### 1.4 Business Objectives

| Objective | Target | Measurement | Rationale |
|-----------|--------|-------------|-----------|
| **Customer Acquisition** | 20-40 enterprise customers | Signed annual contracts | $12.5K-25K ACV per customer |
| **Annual Recurring Revenue** | $250K-500K Year 1 | Total contract value | Validates product-market fit |
| **Employee Adoption Rate** | 80%+ within 90 days | Active users / provisioned seats | Core value prop: high adoption |
| **Chat→Workflow Progression** | 40%+ in first 30 days | Users creating first workflow | Validates progressive model |
| **Marketplace Adoption** | 1,000+ workflows created (Month 4), 100+ published (Month 6) | User-created workflows | Validates workflow creation democratization |
| **Marketplace Revenue** | $50K ARR (Year 1, post-MVP Month 6) | Premium workflow sales | Validates freemium business model |
| **Enterprise Sales Cycle** | 6-9 months | Lead → closed-won | Industry standard for enterprise |
| **Deployment Speed** | <4 weeks pilot to production | IT provisioning → 80% adoption | 3x faster than competitors (12 weeks+) |
| **SOC 2 Type II Certification** | Month 6 (aligned with company) | Certification achieved | Required for enterprise sales >$50K |

### 1.5 Success Metrics

**Product Metrics:**
- **Adoption Rate:** 80%+ of provisioned employees actively use Holokai within 90 days
- **Progression Rate:** 40%+ of active users create their first workflow within 30 days
- **Workflow Execution:** 20+ executions per active workflow (demonstrates value)
- **Time-to-First-Value:** <7 days from account creation to first workflow automation
- **NPS Score:** 40+ (enterprise software benchmark)

**Business Metrics:**
- **Customer Acquisition:** 20-40 paying customers by end of Year 1
- **ARR:** $250K-500K by end of Year 1
- **Pilot→Paid Conversion:** 60%+ of 90-day pilots convert to paid contracts
- **Net Revenue Retention:** 110-120% (expansion through seat growth and upsells)
- **Customer Acquisition Cost:** <$15K per customer (target 3:1 LTV:CAC ratio)

**Operational Metrics:**
- **Deployment Time:** 2-4 weeks from contract signature to 80% adoption
- **Support Tickets:** <1 ticket per 10 users per month
- **Uptime:** 99.5%+ (enterprise SLA standard)

---

## 2. User Personas

### 2.1 Knowledge Worker (Primary User - 60-80% of organization)

**Profile:**
- **Title:** Individual contributors across all departments (Marketing Coordinator, Sales Rep, Financial Analyst, Operations Manager, HR Specialist, Product Manager, etc.)
- **Organization Size:** 100-1,000 employees
- **Tech Savvy:** Moderate (comfortable with SaaS tools like Slack, Salesforce, Notion)
- **Current AI Usage:** Using ChatGPT or Claude personally; copy-pasting data between tools

**Goals:**
- Automate 10-20 hours/month of repetitive work (email summaries, report generation, data entry, meeting prep)
- Get AI benefits without learning "yet another complex tool"
- Stay productive without constant context-switching between tools

**Pain Points:**
- "I waste hours every week on the same repetitive tasks" (manual data entry, email summarization, report generation)
- "I tried workflow builders like Zapier but they're too complicated for me"
- "My company deployed [expensive enterprise tool] but I never use it because it's too hard to access"
- "I use ChatGPT for work but IT says it's not allowed" (shadow IT frustration)

**Phase 2 Value Proposition:**
- **Day 1:** Start chatting naturally (zero training); no "workflow builder" to learn
- **Week 1:** Platform suggests "You've summarized emails 15 times. Want me to automate this?" → Click yes → First workflow created
- **Month 1:** Using 2-5 personal workflows that save 10-20 hours/month
- **Month 3:** Sharing workflows with team; contributing to department template library

**Success Criteria:**
- Create first workflow within 30 days
- Execute 20+ workflow runs within 90 days
- Save 10-20 hours/month on repetitive tasks
- Share at least 1 workflow with team

---

### 2.2 Department Head (Champion - 10-20% of organization)

**Profile:**
- **Title:** Directors, VPs, Department Leads (Director of Marketing, VP Operations, Head of Sales, etc.)
- **Organization Size:** Leading teams of 10-50 people within 100-1,000 employee orgs
- **Responsibilities:** Drive team productivity, justify tool investments, measure ROI
- **Current Behavior:** Champions tool pilots, sponsors adoption initiatives, reports metrics to leadership

**Goals:**
- Increase team productivity by 20-30% through automation
- Prove ROI to justify budget for AI tools
- Achieve >80% team adoption (vs. typical 20-30% for enterprise tools)
- Standardize best practices across team (reduce variance in output quality)

**Pain Points:**
- "We deployed [expensive tool] but only 20-30% of my team actually uses it"
- "I need measurable ROI within 90 days or I lose the budget"
- "My team is drowning in manual work but they resist learning new tools"
- "Different team members use different AI approaches—no consistency"

**Enterprise MVP Value Proposition:**
- **Week 1-2:** Run 90-day pilot with 25-50 team members
- **Month 1:** See 80%+ team adoption (vs. 20-30% for traditional tools); real-time dashboard shows usage metrics
- **Month 2:** Team creates 20-50 department-specific workflows; time savings become measurable
- **Month 3:** Present ROI metrics to leadership: "80% adoption, 15 hours saved per person/month, $30K/month productivity gain"

**Success Criteria:**
- Achieve 80%+ team adoption within 90 days
- Measurable time savings: 10-20 hours per employee per month
- Build library of 10-20 department-specific workflow templates
- Justify full organizational rollout with ROI metrics

---

### 2.3 IT Leader (Primary Decision Maker - 1-5% of organization)

**Profile:**
- **Title:** CIO, VP IT, IT Director, Head of Digital Transformation
- **Organization Size:** 100-1,000 employees
- **Responsibilities:** Technology strategy, vendor selection, security/compliance, budget authority
- **Buying Authority:** Final approval on enterprise software purchases >$10K

**Goals:**
- Enable AI innovation without creating security risks
- Deploy tools that employees actually use (>80% adoption)
- Fast time-to-value (2-4 weeks vs. 6-12 months for competitors)
- Maintain governance and compliance (SOC 2, audit logs, RBAC)

**Pain Points:**
- "Employees are using ungoverned ChatGPT/Claude with company data—it's a security risk" (shadow IT crisis)
- "We spent $150K on [enterprise platform] but only 25% of employees use it—wasted investment"
- "Enterprise tools take 6-12 months to deploy and require extensive IT involvement"
- "Leadership demands AI adoption NOW but I can't compromise security"

**Enterprise MVP Value Proposition:**
- **Week 1:** Provision Holokai with SSO (Okta/Azure AD); employees self-onboard through chat (no training required)
- **Week 2-4:** Monitor real-time adoption dashboard; see 80%+ employees actively using platform
- **Month 1-3:** Enable progressive governance controls: start permissive (pilot phase), add department-level controls as usage scales
- **Month 6:** SOC 2 Type II certification complete (aligned with company-wide initiative); full enterprise governance active

**Success Criteria:**
- Deploy pilot in <2 weeks; full organization in <4 weeks
- Achieve 80%+ employee adoption within 90 days
- Zero security incidents in first year
- Pass enterprise security review (SOC 2, SSO, RBAC, encryption, audit logs)
- Justify investment with measurable ROI ($250K+ productivity gains for $50K investment)

---

### 2.4 Security Officer (Gatekeeper - 1-2% of organization)

**Profile:**
- **Title:** CISO, IT Security Manager, Compliance Officer, InfoSec Lead
- **Organization Size:** 100-1,000 employees
- **Responsibilities:** Vendor security reviews, compliance management, risk assessment
- **Veto Power:** Can block tool adoption if security requirements not met

**Goals:**
- Ensure AI usage complies with security policies (data protection, access controls, audit trails)
- Mitigate AI-specific risks (data leaks, API key exposure, unauthorized workflow execution)
- Maintain SOC 2 / ISO 27001 / GDPR compliance posture
- Enable innovation without compromising security

**Pain Points:**
- "69% of organizations cite AI data leaks as top security concern" (Gartner)
- "Agentic AI creates new attack surfaces: API keys, workflow automation, data access across systems"
- "47% of organizations have NO AI-specific security controls in place"
- "I can't say 'no' to AI (executive mandate) but current tools don't meet our security standards"

**Enterprise MVP Value Proposition:**
- **Security Review:** SOC 2 Type II certification (aligned with company), encryption at rest/transit, audit logs, RBAC
- **API Key Management:** Moku system provides secure credential storage, rotation, monitoring, and access controls
- **Progressive Governance:** Start with pilot (25-50 users, permissive mode); add controls as usage scales
- **Audit Trail:** Complete activity logs for compliance reporting (who created what workflow, who executed it, what data accessed)

**Success Criteria:**
- Pass enterprise security review (SOC 2 Type II, encryption, RBAC, audit logs)
- Zero security incidents in first year
- Complete audit trail for compliance reporting
- API keys and credentials managed securely through Moku system

---

### 2.5 CFO / Finance Leader (ROI Validator - 1% of organization)

**Profile:**
- **Title:** CFO, VP Finance, Finance Director
- **Organization Size:** 100-1,000 employees
- **Responsibilities:** Budget approval, ROI validation, cost optimization
- **Buying Authority:** Approves investments >$50K

**Goals:**
- Validate ROI before approving multi-year contracts
- Ensure tool adoption justifies investment
- Compare cost vs. alternatives (build vs. buy, competitors)
- Forecast impact on organizational productivity

**Pain Points:**
- "We've wasted money on tools that employees don't use"
- "How do I quantify the ROI of 'AI productivity'?"
- "Competitors quote $100-200/user/year—is Holokai's $50-100/user competitive?"

**Enterprise MVP Value Proposition:**
- **Pricing:** $50-100/user/year = 50-75% savings vs. enterprise competitors (Microsoft Copilot Studio, Moveworks)
- **ROI Calculation:** 10-20 hours saved per employee/month × $125/hour labor cost = $1,250-2,500/employee/month value
  - Investment: $50-100/user/year = $4-8/user/month
  - ROI: 150x-300x return on investment
- **Pilot-Driven:** 90-day pilot proves value before full organizational commitment

**Success Criteria:**
- Achieve measurable ROI within 90-day pilot (time savings, workflow executions, adoption %)
- Justify investment with >100x ROI calculation

---

## 3. Core Feature Set

### 3.1 Feature Overview

| Feature Category | Priority | MVP Scope | Deferred |
|------------------|----------|-----------|----------|
| **Chat-to-Workflow Progression** | P0 (Critical) | ✓ Full | - |
| **MCP Integration Ecosystem** | P0 (Critical) | ✓ Top 20 servers | Advanced orchestration |
| **Native Enterprise Integrations** | P0 (Critical) | ✓ Top 10 apps | Additional apps |
| **Progressive Governance** | P0 (Critical) | ✓ Phase 1-2 controls | Phase 3 full enterprise |
| **Thread Management (Dual-Sidebar)** | P0 (Critical) | ✓ Full | - |
| **Project Collaboration** | P1 (High) | ✓ Full | Org-level projects |
| **Workflow Template Marketplace** | P1 (High) | ✓ Basic (50 templates) | Community contributions |
| **Admin Dashboard & Insights** | P1 (High) | ✓ Core metrics | Advanced analytics |
| **Desktop Core Platform** | P0 (Critical) | ✓ Full | - |

---

### 3.2 Feature 1: Chat-to-Workflow Progression (P0 - Core Differentiator)

**Description:**
The platform automatically detects repetitive patterns in chat interactions and suggests workflow automation opportunities, enabling employees to progress from chat to automation without learning workflow builders. This is **one of multiple workflow creation methods** in Holokai Desktop (others include AI-assisted creation, GUI workflow builder, and direct YAML editing - see Section 3.7), designed to provide the fastest path to automation for non-technical users.

**User Stories:**
- **US-1:** As a knowledge worker, I want the platform to detect when I'm repeating similar prompts, so I can automate repetitive tasks without manual workflow building
- **US-2:** As a knowledge worker, I want to click "Make this a workflow" after a successful chat interaction, so I can reuse it without rebuilding from scratch
- **US-3:** As a knowledge worker, I want workflows to run in the background, so I don't have to learn workflow builder interfaces
- **US-4:** As a department head, I want employees to discover automation opportunities naturally through chat, so I achieve >80% adoption vs. <30% with traditional workflow tools

**Key Requirements:**

**1. Automatic Workflow Suggestions (ML-Driven)**
- **Pattern Detection Engine:**
  - Analyze chat history to detect repetitive prompts (semantic similarity >85% across 3+ interactions within 30 days)
  - Identify automation opportunities: email summarization, report generation, data extraction, meeting preparation
  - Trigger threshold: 3+ similar prompts within 30 days OR 5+ within 90 days
- **Suggestion UI:**
  - Toast notification: "You've summarized emails 15 times this month. Want me to automate this?"
  - Inline suggestion in chat interface: "🤖 This looks repetitive. Make it a workflow?"
  - Suggestion includes: detected pattern, estimated time savings, one-click accept
- **Suggestion Timing:**
  - Show suggestion immediately after 3rd similar prompt
  - Re-suggest after 10 interactions if user dismissed
  - Never suggest more than 1 automation per day (avoid fatigue)

**2. "Make This a Workflow" Button**
- **Location:**
  - Appears on every successful chat response (>50 tokens, no errors)
  - Visible in thread history for past conversations (trailing 90 days)
  - **Emergence Pattern:** When user generates an output or file, Holokai subtly offers: *"Want to create a workflow from this?"* (non-intrusive, contextually relevant)
- **Functionality:**
  - One-click workflow creation from chat context
  - Auto-extracts: prompt template, input variables, expected output format
  - Pre-populates workflow name (user can edit)
  - Saves to personal workflow library ("My Workflows" - see Section 3.7.3)
- **Context Preservation:**
  - Captures full chat context (messages, attachments, model settings)
  - Extracts variable placeholders: `{{email_text}}`, `{{date}}`, `{{recipient_name}}`
  - Preserves system prompt, temperature, max tokens

**3. Invisible Workflow Execution**
- **Execution Modes:**
  - **Chat-driven:** User types trigger phrase ("Summarize my inbox") → workflow executes → results appear in chat
  - **Scheduled:** User sets schedule ("Every Monday 9am") → workflow runs automatically → results posted to thread
  - **Integration-triggered:** External event (new email, Slack message) → workflow executes → results delivered
- **User Experience:**
  - No "workflow builder" UI required for basic usage
  - Results appear in chat interface (looks like natural conversation)
  - "Show workflow details" link for power users who want customization

**4. Workflow Template Marketplace**
- **Pre-Built Templates:**
  - 50+ curated workflows across departments (Marketing, Sales, Operations, Finance, HR)
  - Examples: "Daily standup report", "Email inbox summary", "Meeting notes generator", "Expense report processor"
  - Activated through chat: User types "Set up daily standup report" → template activated with guided setup
- **Template Structure:**
  - Name, description, category tags
  - Input parameters (user provides during setup)
  - Step-by-step execution logic
  - Expected outputs and delivery method

**Acceptance Criteria:**
- [ ] Pattern detection identifies repetitive prompts with >85% accuracy
- [ ] Workflow suggestions trigger after 3rd similar prompt within 30 days
- [ ] "Make this a workflow" button appears on all successful chat responses
- [ ] One-click workflow creation preserves full chat context and extracts variables
- [ ] Workflows execute in background; results appear in chat interface
- [ ] Template marketplace includes 50+ curated workflows across 5+ departments
- [ ] Template activation via chat ("Set up [template name]") works with guided setup
- [ ] Users can progress from chat → workflow without ever seeing workflow builder UI

**Technical Implementation:**
- **Pattern Detection:** Sentence embeddings (OpenAI `text-embedding-3-small`) + cosine similarity >0.85 threshold
- **Workflow Storage:** PostgreSQL `workflows` table with columns: `id`, `userId`, `projectId`, `name`, `triggerType`, `steps` (JSONB), `createdFrom` (threadId/messageId)
- **Execution Engine:** Moku API workflow orchestration service (sequential/parallel step execution)
- **Template Library:** Seed data in `workflow_templates` table with `category`, `featured`, `usageCount`

**Dependencies:**
- Moku API: Workflow CRUD endpoints, execution engine, pattern detection service
- Thread Context: Read access to thread history for pattern detection
- ML Model: Embedding model for semantic similarity (OpenAI API or self-hosted)

---

### 3.3 Feature 2: MCP Integration Ecosystem (P0 - Critical Differentiator)

**Description:**
Integrate Model Context Protocol (MCP) ecosystem (257+ community servers) plus native connectors for top 10 enterprise apps, enabling workflows to interact with external systems without custom code.

**User Stories:**
- **US-5:** As a knowledge worker, I want workflows to read/write data from Slack, Gmail, Salesforce without manual API setup, so I can automate cross-tool tasks
- **US-6:** As an IT leader, I want secure credential management for API keys (via Moku), so employees can't leak credentials
- **US-7:** As a developer, I want to use MCP community servers to extend functionality, so I can integrate niche tools without custom development

**Key Requirements:**

**1. MCP Server Integration (Top 20 Priority)**
- **MCP Protocol Support:**
  - Desktop app acts as MCP client
  - Supports MCP protocol: server discovery, tool invocation, resource access
  - Sandboxed execution (MCP servers run in isolated process)
- **Pre-Installed MCP Servers (MVP - Top 20):**
  - **Productivity:** Google Drive, Gmail, Google Calendar, Slack, Microsoft 365 (OneDrive, Outlook, Teams)
  - **Development:** GitHub, GitLab, Linear, Jira
  - **Data:** PostgreSQL, MongoDB, Airtable, Notion
  - **File:** Filesystem (local file access), S3, Azure Blob
  - **Other:** Puppeteer (web automation), Brave Search, Memory (persistent context)
- **MCP Server Management:**
  - Admin UI to enable/disable MCP servers per organization
  - Credential configuration per MCP server (API keys, OAuth tokens stored in Moku)
  - Usage monitoring (which servers used, by whom, error rates)

**2. Native Enterprise Integrations (Top 10 Apps)**
- **Native Connectors (Optimized Performance):**
  - **Top 10 Priority:** Slack, Google Workspace (Gmail, Drive, Calendar, Docs), Microsoft 365 (Outlook, OneDrive, Teams), Salesforce, HubSpot, Notion, Jira, GitHub, Zoom, Zapier (for extended integrations)
- **Integration Capabilities:**
  - **Read:** Fetch messages, files, records, calendar events
  - **Write:** Send messages, create files, update records, schedule meetings
  - **Triggers:** Webhook-based triggers (new Slack message, new Salesforce lead, etc.)
- **Authentication:**
  - OAuth 2.0 for all native integrations
  - Credentials stored securely in Moku system (AES-256 encryption, key rotation)
  - Per-user credential storage (employees authenticate individually, not shared org-wide)

**3. API Key Management (Moku System)**
- **Credential Storage:**
  - All API keys, OAuth tokens stored in Moku (not Desktop app)
  - AES-256-GCM encryption at rest
  - Key rotation every 90 days (automatic for OAuth, manual notification for API keys)
- **Access Controls:**
  - RBAC: Only workflow creators can access their stored credentials
  - Audit logs: All credential usage logged (which workflow, which user, timestamp)
  - Expiration: Credentials expire after 12 months of inactivity
- **Monitoring:**
  - Failed authentication alerts (sent to user + IT admin)
  - Unusual usage patterns (e.g., 100 API calls in 1 minute)
  - Credential rotation reminders

**4. Workflow Integration Actions**
- **Action Library:**
  - Each MCP server/native integration exposes actions (e.g., "Send Slack message", "Create Jira ticket", "Search Gmail")
  - Actions discoverable in workflow builder (searchable, categorized)
  - Action inputs/outputs documented (type, required/optional, example values)
- **Workflow Builder UI:**
  - Drag-and-drop actions from library
  - Configure action inputs (static values or variables from previous steps)
  - Map outputs to next step inputs

**Acceptance Criteria:**
- [ ] Desktop app supports MCP protocol (client implementation)
- [ ] 20+ MCP servers pre-installed and functional (Google, Slack, GitHub, etc.)
- [ ] 10+ native integrations fully functional (Slack, Gmail, Salesforce, etc.)
- [ ] OAuth authentication flow works for all native integrations
- [ ] API keys and OAuth tokens stored securely in Moku system (AES-256-GCM, key rotation)
- [ ] Workflow actions discoverable and configurable in builder UI
- [ ] Audit logs capture all credential usage (workflow, user, timestamp)
- [ ] Admin dashboard shows MCP server usage metrics (which servers, by whom, error rates)

**Technical Implementation:**
- **MCP Client:** Electron main process runs MCP client SDK (TypeScript)
- **MCP Server Execution:** Each MCP server runs in isolated Node.js child process (sandbox)
- **Native Integrations:** Custom API clients (Slack SDK, Google APIs, Salesforce SDK, etc.)
- **Credential Storage:** Moku API `credentials` table: `userId`, `integrationType`, `encryptedToken`, `expiresAt`, `lastUsed`
- **Action Registry:** Moku API `integration_actions` table: `integrationId`, `actionName`, `inputSchema` (JSON), `outputSchema` (JSON)

**Dependencies:**
- MCP Protocol SDK (TypeScript client library)
- Moku API: Credential storage, OAuth callback handling, usage logging
- Native SDKs: Slack SDK, Google APIs, Salesforce SDK, HubSpot API, Notion SDK, etc.

---

#### 3.3.5 Enterprise MCP Governance & Security (P0 - Critical Differentiator)

**Description:**
Organizational-level control over MCP server access, providing IT administrators with comprehensive governance tools to whitelist approved servers, monitor usage, enforce security policies, and maintain compliance. This is a **critical competitive differentiator** positioning Holokai as the only platform offering MCP-specific enterprise controls.

**Competitive Context:**
- **Market Gap:** Only 2/13 competitors have MCP support; only 1/13 (Cody) has organizational MCP control (maturity unclear)
- **AI Governance Players:** Witness.ai and Credo.ai provide broad AI governance but NOT MCP-specific controls
- **Holokai's Advantage:** First-to-market with comprehensive MCP-specific organizational governance

**User Stories:**
- **US-7a:** As a CISO, I want to whitelist approved MCP servers so employees can't connect to unapproved/malicious servers
- **US-7b:** As a compliance officer, I want complete audit trails of MCP usage (who used which server, when, with what data) for SOC 2/GDPR reporting
- **US-7c:** As an IT admin, I want to review and approve employee requests for new MCP servers before they're enabled
- **US-7d:** As a security officer, I want to enforce data classification policies (e.g., "PII data cannot flow to external MCP servers")
- **US-7e:** As an IT leader, I want real-time monitoring of MCP usage with alerts for suspicious activity

**Key Requirements:**

**1. MCP Server Whitelist/Blacklist Management**
- **Whitelist Model (Default-Deny):**
  - Admin maintains approved MCP server list per organization
  - Employees can ONLY connect to whitelisted servers
  - Blacklist for explicitly prohibited servers (overrides whitelist)
  - Pre-approved list: 20 MVP servers auto-whitelisted for Phase 1 (Pilot)

- **Server Registry:**
  - Each MCP server has: `serverId`, `name`, `vendor`, `version`, `approvalStatus` (approved/pending/rejected), `securityRating` (low/medium/high risk)
  - Admin UI shows: server details, data access scope, approval history, usage stats

- **Version Pinning:**
  - Pin specific MCP server versions for stability
  - Block automatic updates without admin approval
  - Rollback capability if new version causes issues

**2. MCP Server Approval Workflow**
- **Request Flow:**
  1. Employee attempts to use unapproved MCP server → Desktop shows "Request Access" prompt
  2. Employee submits request with business justification
  3. Request routed to IT admin/department head (based on governance phase)
  4. Admin reviews: server details, data access scope, security rating, vendor reputation
  5. Admin approves/rejects with optional expiration date (e.g., 90-day trial)
  6. Employee notified; server becomes available immediately upon approval

- **Bulk Approval:**
  - Admin can approve server for: individual user, department, entire organization
  - Pre-approve common servers (e.g., "All marketing team members can use HubSpot MCP server")

**3. MCP Security Scanning & Risk Assessment**
- **Automated Security Review:**
  - Scan MCP server package for vulnerabilities (npm audit, Snyk integration)
  - Check vendor reputation (community downloads, GitHub stars, security incidents)
  - Analyze data access scope (read-only vs. write, PII access, network access)
  - Generate security rating: LOW (read-only, no PII), MEDIUM (write access), HIGH (PII access, network calls)

- **Manual Review Checkpoints:**
  - Admin dashboard shows security report for each server
  - Warning indicators: "This server requests PII access", "This server makes external network calls"
  - Recommended action: "Approve with restrictions" or "Reject - high risk"

**4. MCP Usage Monitoring & Audit Logs**
- **Real-Time Monitoring Dashboard:**
  - Active MCP connections per server
  - API call volume per server (last hour/day/week)
  - Error rates per server
  - Top users by MCP usage
  - Suspicious activity alerts (unusual API call patterns, data exfiltration indicators)

- **Comprehensive Audit Trail:**
  - **Event Types:** MCP server connected, tool invoked, resource accessed, server disconnected, approval granted/rejected
  - **Logged Data:** `timestamp`, `userId`, `mcpServerId`, `action`, `dataAccessed` (sanitized), `success/failure`, `ipAddress`
  - **Retention:** 2 years (configurable for compliance requirements)
  - **Export:** CSV, JSON for compliance reporting

- **Alerting:**
  - Real-time alerts for: unapproved server access attempts, unusual API call volume, failed authentications, data policy violations
  - Delivery: Email, Slack, PagerDuty integration
  - Configurable thresholds (e.g., alert if user makes >1000 API calls/hour)

**5. MCP-Specific Data Governance Policies**
- **Data Classification Rules:**
  - Define data types: PII, Financial, Confidential, Public
  - Policy enforcement: "PII data cannot flow to MCP servers rated HIGH risk", "Financial data requires 2FA before MCP access"
  - Workflow-level controls: Workflows accessing PII require admin approval before execution

- **Geo-Restrictions:**
  - Block MCP servers hosted in specific countries (GDPR compliance)
  - Example: "No data can flow to servers in countries without adequate data protection laws"

- **Usage Quotas:**
  - Per-server quotas: Max API calls per day/month per server
  - Per-user quotas: Max MCP API calls per day per user
  - Quota exceeded → Soft limit (alert) or Hard limit (block)

- **Network Access Controls:**
  - MCP servers can ONLY access allowlisted domains
  - Example: GitHub MCP server can only connect to `*.github.com`, `api.github.com`
  - Block unencrypted HTTP connections (enforce HTTPS only)

**6. Progressive MCP Governance Integration**
- **Phase 1 (Pilot - 25-50 users):**
  - Permissive: 20 pre-approved MCP servers enabled
  - Monitoring: Usage tracking, audit logs enabled
  - Limits: No quotas; monitoring only
  - Alerts: Suspicious activity monitoring (log only, no blocking)

- **Phase 2 (Department - 100-250 users):**
  - Department-level approvals: Department heads approve MCP servers for their teams
  - Whitelist enforcement: Employees must request unapproved servers
  - Quotas: 1,000 API calls/day per user
  - Alerts: Real-time alerts to department heads

- **Phase 3 (Enterprise - 250+ users):**
  - Full governance: Organizational whitelist, approval workflows mandatory
  - Data policies: PII restrictions, geo-restrictions enforced
  - Advanced quotas: Per-server, per-department quotas
  - Compliance reporting: Automated SOC 2, GDPR, PCI DSS reports

**7. MCP Governance Admin UI**
- **Server Management Page:**
  - Table: Approved servers (name, version, usage, risk rating, actions)
  - Actions: View details, update version, revoke approval, configure quotas
  - Search/filter: By category, risk rating, usage volume

- **Approval Queue:**
  - Pending requests (employee name, server requested, justification, timestamp)
  - Quick actions: Approve/Reject with comments
  - Bulk actions: Approve all from department, reject all HIGH risk

- **Monitoring Dashboard:**
  - Real-time charts: MCP API calls over time, top servers, error rates
  - Alert feed: Recent suspicious activity, quota exceeded warnings
  - Audit log search: Filter by user, server, date range

- **Policy Configuration:**
  - Data classification rules (define PII fields, confidential data patterns)
  - Geo-restriction settings (select blocked countries)
  - Quota settings (per-user, per-server limits)
  - Alert thresholds (API call volume, error rate triggers)

**Acceptance Criteria:**
- [ ] Whitelist/blacklist system: Employees can ONLY connect to approved MCP servers
- [ ] Approval workflow: Employee requests → Admin reviews → Approve/Reject flow functional
- [ ] Security scanning: Automated security rating (LOW/MEDIUM/HIGH) generated for each server
- [ ] Real-time monitoring: Dashboard shows active connections, API call volume, error rates
- [ ] Audit logs: Complete MCP usage trail (who, what, when) with 2-year retention
- [ ] Alerts: Suspicious activity triggers real-time alerts (email/Slack)
- [ ] Data policies: PII restrictions enforced (workflows with PII cannot use HIGH-risk servers)
- [ ] Geo-restrictions: MCP servers in blocked countries cannot be accessed
- [ ] Usage quotas: Per-user and per-server quotas enforced; soft/hard limits configurable
- [ ] Progressive governance: MCP controls integrate with Phase 1/2/3 governance model
- [ ] Admin UI: Server management, approval queue, monitoring dashboard, policy config fully functional
- [ ] Compliance export: Audit logs exportable in CSV/JSON for SOC 2, GDPR, PCI DSS reporting

**Technical Implementation:**
- **Database:**
  - `mcp_servers` table: `id`, `name`, `vendor`, `version`, `approvalStatus`, `securityRating`, `whitelisted`, `blacklisted`, `quotaLimit`, `allowedDomains[]`
  - `mcp_approvals` table: `id`, `serverId`, `requestedBy`, `approvedBy`, `status`, `justification`, `approvedAt`, `expiresAt`
  - `mcp_audit_log` table: `id`, `userId`, `serverId`, `action`, `timestamp`, `dataAccessed`, `ipAddress`, `success`
  - `mcp_policies` table: `id`, `orgId`, `policyType` (data_classification/geo_restriction/quota), `config` (JSONB)

- **MCP Gateway Proxy:**
  - All MCP connections routed through gateway proxy (Moku API layer)
  - Proxy enforces: whitelist check, quota limits, data policies, audit logging
  - Blocks unapproved connections before reaching MCP server

- **Security Scanner Service:**
  - Background job: Scan new MCP servers for vulnerabilities
  - Integration: npm audit, Snyk API, GitHub API (for repo analysis)
  - Output: Security report JSON stored in `mcp_servers.securityReport`

- **Monitoring Service:**
  - Real-time stream: MCP gateway logs → Monitoring service → Dashboard
  - Anomaly detection: ML-based detection of unusual patterns (data exfiltration, brute force)
  - Alerting: Trigger alerts via webhook (email, Slack, PagerDuty)

**Dependencies:**
- Moku API: MCP gateway proxy, whitelist/blacklist enforcement, audit log storage
- Desktop: MCP connection attempts routed through Moku gateway (not direct)
- Security scanning: npm audit, Snyk API, GitHub API
- Monitoring: Real-time log streaming (e.g., Kafka, Redis Streams)
- Alerting: Email service, Slack API, PagerDuty integration

**Rollout Strategy:**
- **MVP (Month 4):** Basic whitelist/approval workflow, monitoring dashboard, audit logs
- **Post-MVP (Month 6):** Advanced features (security scanning, data policies, geo-restrictions, anomaly detection)

**Competitive Differentiation:**
> **"Enterprise MCP Platform: The only solution providing organizational control over Model Context Protocol servers. Give developers the MCP ecosystem they love, with the security and governance IT demands."**

---

### 3.4 Feature 3: Progressive Governance System (P0 - Unique Differentiator)

**Description:**
Adaptive governance controls that scale from permissive (pilot phase) to controlled (enterprise phase), enabling fast adoption while maintaining compliance.

**User Stories:**
- **US-8:** As an IT leader, I want to start with a permissive pilot (25-50 users) to prove value, then add controls as usage scales
- **US-9:** As a security officer, I want RBAC, audit logs, and workflow approval controls activated at scale (100+ users), without blocking early adoption
- **US-10:** As a department head, I want department-level governance (my team's workflows visible to me, not other departments)

**Key Requirements:**

**1. Phase 1: Pilot Mode (25-50 users, Month 1-2)**
- **Governance Controls:**
  - **Permissive:** Employees can create/execute any workflows
  - **Monitoring:** IT dashboard shows usage metrics (no blocking)
  - **Limits:** 50 workflows per user, 1,000 executions/day per user
- **Security Baseline:**
  - SSO/SAML required (Okta, Azure AD, Google)
  - Encryption at rest/transit (AES-256-GCM, TLS 1.3)
  - Audit logs enabled (stored but not actively reviewed)
- **Goals:**
  - Prove value: 80%+ pilot user adoption
  - Gather feedback: Identify top use cases, pain points
  - Build momentum: Pilot users become champions for org-wide rollout

**2. Phase 2: Department Expansion (100-250 users, Month 3-4)**
- **Governance Controls:**
  - **Department-level RBAC:** Department heads can view/manage their team's workflows
  - **Workflow sharing controls:** Personal (private), Team (shared within department), Organization (shared org-wide)
  - **Approval workflows (optional):** Department heads can require approval for org-wide workflow sharing
  - **Resource limits:** 100 workflows per user, 5,000 executions/day per user
- **Enhanced Monitoring:**
  - Department-level dashboards: Usage by team, top workflows, time savings
  - Alerts: Workflow errors, unusual usage patterns, failed authentications
- **Goals:**
  - Scale adoption: 80%+ org-wide adoption
  - Empower champions: Department heads manage their teams autonomously
  - Identify organizational workflows: Workflows that benefit entire org (shared templates)

**3. Phase 3: Enterprise Mode (250+ users, Month 5-6)**
- **Full Governance Controls:**
  - **Full RBAC:** Admin, Department Head, Power User, Standard User roles
  - **Workflow approval:** Admin approval required for org-wide workflows with external integrations
  - **Data access controls:** Workflows can only access data user has permission to view (enforced by integrations)
  - **Compliance reporting:** Automated reports for SOC 2, ISO 27001, GDPR audits
- **Advanced Security:**
  - **API rate limiting:** Prevent abuse (e.g., 10,000 API calls/hour limit)
  - **Anomaly detection:** ML-based detection of unusual workflow behavior (e.g., data exfiltration patterns)
  - **Geo-restrictions:** Option to block workflow execution from specific countries (GDPR compliance)
- **Goals:**
  - Maintain compliance: SOC 2 Type II certification (Month 6)
  - Scale safely: Support 250-1,000 users without security incidents

**RBAC Roles:**

| Role | Permissions | Typical Users |
|------|-------------|---------------|
| **Admin** | Full platform control: manage users, configure integrations, set policies, view all workflows | IT Leader, CIO |
| **Department Head** | View/manage department workflows, approve workflow sharing, view team usage analytics | Directors, VPs |
| **Power User** | Create workflows, share with team/org (with approval), use all integrations | 10-20% of users |
| **Standard User** | Create personal workflows, execute shared workflows, use approved integrations | 60-80% of users |
| **View-Only** | Execute shared workflows, view results, cannot create workflows | Interns, contractors |

**Acceptance Criteria:**
- [ ] Phase 1 (Pilot) mode: Permissive controls, monitoring only, 50 users
- [ ] Phase 2 (Department) mode: Department-level RBAC, workflow sharing controls, 250 users
- [ ] Phase 3 (Enterprise) mode: Full RBAC (5 roles), approval workflows, compliance reporting
- [ ] IT admin can configure which phase to activate (manual control, not automatic)
- [ ] Department heads can view/manage their team's workflows (not other departments)
- [ ] Audit logs capture all governance events (workflow approvals, policy changes, role assignments)
- [ ] Admin dashboard shows real-time governance status (which phase, active policies, compliance posture)

**Technical Implementation:**
- **Phase Configuration:** Moku API `organization_settings` table: `governancePhase` (enum: pilot, department, enterprise)
- **RBAC:** Moku API `user_roles` table: `userId`, `role` (enum: admin, deptHead, powerUser, standardUser, viewOnly)
- **Workflow Permissions:** `workflows` table: `visibility` (enum: personal, team, organization), `approvalStatus` (enum: draft, pending, approved, rejected)
- **Audit Logs:** `audit_log` table: `userId`, `action`, `resource`, `timestamp`, `metadata` (JSONB)

**Dependencies:**
- Moku API: RBAC enforcement, approval workflow engine, audit log storage
- Admin Dashboard: UI for configuring governance phase, viewing compliance reports

---

### 3.5 Feature 4: Thread Management with Dual-Sidebar UX (P0)

**Description:**
Enhanced conversation management with dual-sidebar layout, thread branching, and persistent context. Builds on Phase 1 chat foundation.

**User Stories:**
- **US-11:** As a user, I want to navigate between Home, Threads, Projects, Insights using a primary sidebar, so I can quickly switch contexts
- **US-12:** As a user, I want to see my thread list in a secondary sidebar, so I can access recent conversations without leaving the main chat
- **US-13:** As a user, I want to retry a prompt with modifications without losing the original response (thread branching)

**Key Requirements:**

**1. Dual-Sidebar Layout**
- **Primary Sidebar (64px width):**
  - Organization icon (top)
  - Navigation icons (vertically stacked): Home, Threads, Projects, Insights
  - User profile (bottom)
- **Secondary Sidebar (280px width):**
  - Context-specific content based on primary sidebar selection:
    - **Threads:** Search + thread list (grouped by date: Today, Yesterday, Last 7 Days, Older)
    - **Projects:** Search + project list (grouped by membership role: Owned, Shared)
    - **Insights:** Quick stats + shortcuts to reports
  - Collapsible (user can hide to maximize chat area)
- **Main Content Area:**
  - Chat interface (thread messages, input box, attachments)
  - Workflow builder (when editing workflows)
  - Project view (when viewing project details)
  - Insights dashboard (when viewing analytics)

**2. Thread Branching (Retry)**
- **Branch Structure:**
  - Message tree via `parentMessageId`
  - Maximum 9 retry branches per divergence point (branchIndex: 0=original, 1-9=retries)
  - Visual lane-based UI (horizontal lanes show branches side-by-side)
- **User Actions:**
  - "Retry" button on any user message
  - Edit prompt before retrying
  - Switch between branches to compare responses
  - Copy prompt/response to clipboard
- **Context Assembly:**
  - Follow correct branch path when assembling context for LLM
  - Include all messages from root to current branch

**3. Thread Features**
- **Auto-Title Generation:**
  - Generate title after 2nd exchange (max 50 chars)
  - User can manually edit title
- **Search:**
  - Full-text search across thread titles and message content
  - Filter by date range, project, model used
- **Organization:**
  - Pin important threads to top
  - Archive old threads (hide from main list)
  - Move threads between personal ↔ project

**Acceptance Criteria:**
- [ ] Dual-sidebar layout implemented (64px primary + 280px secondary)
- [ ] Primary sidebar navigation: Home, Threads, Projects, Insights
- [ ] Secondary sidebar shows context-specific lists (threads, projects)
- [ ] Thread branching: User can create up to 2 retry branches per message
- [ ] Branch limit enforced with clear user feedback
- [ ] Visual lane-based UI shows branches side-by-side
- [ ] Context assembly follows correct branch path
- [ ] Auto-title generation after 2nd exchange
- [ ] Full-text search across threads
- [ ] Pin, archive, move threads between personal/project

**Technical Implementation:**
- **UI Framework:** Svelte 5.x components for dual-sidebar layout
- **Message Storage:** `desktop_messages` table: `parentMessageId`, `branchIndex`
- **Thread Storage:** `desktop_threads` table: `title`, `isPinned`, `isArchived`, `projectId`
- **Search:** PostgreSQL full-text search (tsvector) on `title` + `content`

**Dependencies:**
- Moku API: Thread CRUD, message branching support
- Desktop UI: Svelte components for dual-sidebar, branch visualization

---

### 3.6 Feature 5: Project Collaboration (P1)

**Description:**
Shared workspaces for team collaboration on threads, workflows, and files. Enables department-level adoption.

**User Stories:**
- **US-14:** As a department head, I want to create a project and invite team members, so we can collaborate on AI workflows
- **US-15:** As a team member, I want to view and contribute to shared conversations without permission bottlenecks
- **US-16:** As an admin, I want to control who can create, edit, or delete content (RBAC)

**Key Requirements:**

**1. Project CRUD**
- **Project Metadata:**
  - Name, description, color, icon, tags
  - Visibility: Private (invite-only) or Org-wide (anyone can join)
  - Owner (creator), members (invited users)
- **Member Roles:**
  - **Viewer:** Read threads/workflows/files, issue prompts
  - **Editor:** Create/edit/delete own content
  - **Owner:** Manage members, edit project settings, delete any content

**2. Project Content**
- **Threads:** Shared conversations visible to all project members
- **Workflows:** Team workflows executable by all members
- **Files:** Project-level file storage (via Storage Service, not local filesystem)

**3. Project File Storage**
- **Storage Service Integration:**
  - Project files stored in Storage Service (S3/Azure Blob)
  - Presigned URLs for uploads/downloads
  - Local cache (encrypted, 3-day TTL) for performance
- **File Limits:**
  - 10MB per file, 50MB per message
  - 10GB per project (configurable by admin)

**4. Cache Invalidation**
- **Polling Strategy:**
  - 30-second polling interval for project updates
  - Invalidate cache on: new message, new workflow, member change
  - Manual refresh button for immediate updates

**Acceptance Criteria:**
- [ ] Projects appear in secondary sidebar with visual distinction (color, icon)
- [ ] Member invitation works via email or user search
- [ ] Role changes take effect immediately
- [ ] Thread move (personal ↔ project) preserves all messages and attachments
- [ ] File storage correctly routes to Storage Service for project threads
- [ ] 30-second polling updates project content
- [ ] Local cache encrypted at rest (AES-256-GCM)

**Technical Implementation:**
- **Database:** `projects` table: `name`, `description`, `visibility`, `ownerId`
- **Membership:** `project_members` table: `projectId`, `userId`, `role`
- **File Storage:** Storage Service API for presigned URLs
- **Cache:** better-sqlite3 with `project_cache` table: `projectId`, `lastUpdated`, `encryptedData`

**Dependencies:**
- Moku API: Project CRUD, member management, file storage integration
- Storage Service: Presigned URLs for file uploads/downloads

---

#### 3.6.1 Progressive Project Transition (P1 - Competitive Differentiator)

**Description:**
Seamless conversion mechanism enabling users to transition personal projects ("My Workflows") to shared team projects without rebuilding content. This is a **key competitive differentiator** as no other platform offers smooth personal→shared progression.

**Competitive Context:**
- **Market Gap:** 6/13 competitors have project concepts, but NONE offer progressive personal→shared transition
- **Binary Choice Problem:** Current tools force upfront decision (personal OR shared), creating adoption friction
- **Holokai's Advantage:** Only solution where users start personal, then share with team when ready (no rebuild required)

**User Stories:**
- **US-16a:** As a power user, I want to convert my personal workflows to a team project with one click, so my team can benefit from my work
- **US-16b:** As a department head, I want to promote successful personal experiments to department-wide projects, so we can scale what works
- **US-16c:** As a user, I want to understand exactly what changes when I convert personal→shared (privacy, permissions, storage), so I make informed decisions
- **US-16d:** As a team member, I want to "fork" a shared project back to personal if I leave the team, so I retain my work

**Key Requirements:**

**1. Conversion Flow (Personal → Team)**
- **Entry Points:**
  - From "My Workflows" project: Click "Share with Team" button
  - From workflow detail: "Convert to Team Project" option
  - From admin dashboard: Bulk promote successful personal projects

- **Conversion Wizard:**
  - **Step 1: Choose Project Type**
    - Option A: Create new team project from personal content
    - Option B: Merge personal content into existing team project

  - **Step 2: Select Content**
    - Choose which workflows/threads to include (multi-select)
    - Preview: "3 workflows, 12 threads, 5 files will be shared"
    - Option to exclude sensitive content

  - **Step 3: Configure Team Settings**
    - Project name, description, color, icon
    - Initial team members (invite colleagues)
    - Default member role (Viewer/Editor)
    - Visibility (Private invite-only OR Org-wide)

  - **Step 4: Privacy & Permissions**
    - Warning: "Shared content will be visible to team members"
    - Option: "Keep original personal copies" (fork vs. move)
    - Permission inheritance: Who can edit converted workflows?

  - **Step 5: Confirm & Convert**
    - Summary: What changes, what stays the same
    - Checklist: Storage location changes (local → cloud), permissions change, audit logs enabled
    - Final confirmation: "Convert to Team Project"

- **Post-Conversion:**
  - Personal project remains (empty or with copies, based on user choice)
  - New team project appears in secondary sidebar
  - Team members receive invitation notifications
  - Conversion audit log entry created

**2. Storage Migration (Personal → Shared)**
- **File Migration:**
  - Personal files (local filesystem) → Upload to Storage Service (S3/Blob)
  - Background job: Copy files, generate presigned URLs, update references
  - Progress indicator: "Migrating 15 files to cloud storage (5/15 complete)"
  - Rollback capability if migration fails

- **Thread/Workflow Migration:**
  - Update `projectId` in database (threads, workflows, files)
  - Maintain message history, branch structure, attachment references
  - No data loss during migration

- **Cache Invalidation:**
  - Clear personal project cache
  - Initialize team project cache
  - Notify all team members to refresh

**3. Reverse Conversion (Team → Personal)**
- **Fork Project:**
  - Team member can "fork" shared project to personal workspace
  - Creates copy of workflows/threads (not move)
  - Files remain in Storage Service (user gets copy references)
  - Use case: Team member leaves organization, wants to retain work

- **Access Revocation:**
  - When user removed from team project → Loses access to shared content
  - Option during removal: "Create personal fork for this user?"
  - Preserves user's contributions while enforcing access control

**4. Progressive Transition Stages**
- **Stage 1: Fully Personal**
  - Single user, local files, no sharing
  - No governance controls
  - Example: "My Workflows" default project

- **Stage 2: Shared - Experimental (2-5 users)**
  - Small team collaboration (e.g., 2 colleagues testing workflows)
  - Files migrated to Storage Service
  - Basic RBAC (Viewer/Editor roles)
  - No approval workflows yet

- **Stage 3: Department Project (5-25 users)**
  - Department-level collaboration
  - Department head has Owner role
  - Department-level governance applies (Phase 2 controls)
  - Workflow sharing requires department head approval (optional)

- **Stage 4: Organizational Project (25+ users)**
  - Org-wide visibility (anyone can join)
  - Full governance controls (Phase 3)
  - Workflow sharing requires admin approval
  - Compliance reporting enabled

**5. Permission Inheritance Rules**
- **During Conversion:**
  - Personal workflows → Team workflows (owner retains edit rights)
  - Personal threads → Team threads (all members can read, original author can edit)
  - Personal files → Team files (all members can download)

- **Team Member Roles:**
  - **Viewer:** Can read workflows/threads, execute workflows, cannot edit
  - **Editor:** Can create/edit own workflows, contribute to threads
  - **Owner:** Original creator retains Owner role in converted project

**6. Data Classification & Privacy**
- **Pre-Conversion Check:**
  - Scan personal content for PII, confidential data
  - Warning: "This workflow accesses PII. Are you sure you want to share?"
  - Option: "Review content before sharing" (opens preview)

- **Selective Sharing:**
  - User can exclude sensitive workflows/threads from conversion
  - "Share 5 of 8 workflows" (leave 3 private)

**7. Adoption Tracking & Analytics**
- **Conversion Metrics:**
  - Track: % of users who convert personal → team
  - Time to first conversion (days from account creation)
  - Conversion funnel: Start wizard → Complete conversion
  - Dropout analysis: Where do users abandon conversion?

- **Success Indicators:**
  - Personal project converted to team project with 3+ members
  - Converted workflows executed by team members (not just creator)
  - Team members contribute new workflows to converted project

**Acceptance Criteria:**
- [ ] "Share with Team" button visible in "My Workflows" project settings
- [ ] Conversion wizard guides user through 5 steps (project type, content selection, team settings, privacy, confirm)
- [ ] File migration works: Personal files (local) → Storage Service (cloud) without data loss
- [ ] Thread/workflow migration preserves: message history, branches, attachments, metadata
- [ ] Permission inheritance: Original creator retains Owner role in team project
- [ ] Team members receive invitation notifications immediately after conversion
- [ ] Reverse conversion (fork): Team member can create personal copy of shared project
- [ ] Data classification check: Warning shown if PII detected in shared content
- [ ] Audit log: Conversion events logged (who converted, when, which content)
- [ ] Progress indicator: File migration shows real-time progress (X/Y files migrated)
- [ ] Rollback: If migration fails, revert to pre-conversion state

**Technical Implementation:**
- **Conversion Service:**
  - `ProjectConversionService.ts` handles conversion logic
  - Methods: `convertToTeamProject()`, `forkToPersonal()`, `validateConversion()`, `migrateFiles()`

- **Database Changes:**
  - `project_conversions` table: `id`, `fromProjectId`, `toProjectId`, `userId`, `status`, `createdAt`, `completedAt`
  - Update `projectId` in: `workflows`, `threads`, `files`, `messages` tables
  - Add `originalCreator` field to workflows/threads (track original owner after conversion)

- **File Migration Service:**
  - Background job: Copy local files → Storage Service
  - Progress tracking: `file_migrations` table: `fileId`, `status` (pending/in_progress/completed/failed), `progress` (bytes uploaded)
  - Rollback mechanism: Keep local copies until migration confirmed successful

- **UI Components:**
  - `ConversionWizard.svelte` - Multi-step wizard component
  - `ContentSelector.svelte` - Multi-select grid for workflows/threads
  - `MigrationProgress.svelte` - Real-time progress indicator

**Dependencies:**
- Moku API: Conversion service, file migration, permission updates
- Storage Service: Upload personal files to cloud storage
- Desktop: Conversion wizard UI, progress tracking

**Rollout Strategy:**
- **MVP (Month 4):** Basic conversion (personal → team, single-step UI)
- **Post-MVP (Month 6):** Full wizard (5-step flow), fork capability, data classification checks

**Competitive Differentiation:**
> **"Start Personal, Scale to Teams: The only platform where workflows seamlessly transition from individual experimentation to enterprise collaboration. No rebuilding required."**

**Success Metrics:**
- **Conversion Rate:** 20%+ of users convert personal project to team within 90 days
- **Team Engagement:** 80%+ of team members execute converted workflows within 30 days
- **Migration Success:** 99%+ file migrations complete without data loss

---

### 3.7 Feature 6: Workflow Marketplace & Creation (P1 - MVP: Templates, Post-MVP Month 6: Full Marketplace)

**Description:**
Comprehensive workflow creation and sharing platform enabling users to author workflows through multiple methods (AI-assisted, GUI builder, YAML editing), and share them via a curated marketplace. **MVP (Month 4) focuses on chat-to-workflow (Section 3.2) + 50 curated templates**. **Post-MVP (Month 6) adds full marketplace with user publishing, freemium model, and enterprise private registries.**

**User Stories:**
- **US-17:** As a knowledge worker, I want to create workflows using multiple methods (AI-assisted, GUI, templates, YAML), so I can choose the approach that fits my skill level
- **US-18:** As a knowledge worker, I want to discover and activate curated templates through chat ("Set up daily standup report"), so I don't have to build from scratch (MVP)
- **US-19:** As a power user, I want to publish my workflows to the marketplace and monetize them, so I'm incentivized to create high-quality reusable workflows (Post-MVP)
- **US-20:** As an IT leader, I want my organization to have a private workflow registry, so we can keep proprietary workflows internal while leveraging public marketplace (Post-MVP)

---

#### 3.7.1 User-Created Workflows (Post-MVP - Month 6)

**Workflow Creation Methods** (Progressive sophistication):

**1. AI-Assisted Creation** (Priority: High - Post-MVP)
- **User Flow:**
  - User describes desired workflow in natural language: "I need a workflow that summarizes emails and posts to Slack"
  - AI suggests workflow structure with steps
  - User approves/modifies structure through guided prompts
  - User fills in template details via conversational refinement
  - AI generates complete workflow package
- **AI Capabilities:**
  - Suggest workflow structure based on description
  - Generate templates from examples
  - Recommend knowledge bases (decision catalogs)
  - Auto-detect workflow tier (Basic/Intermediate - see below)

**2. GUI Workflow Builder** (Priority: Medium - Post-MVP)
- **Visual Representation:** Timeline view (horizontal progression) OR Flowchart (boxes/arrows) - whichever is simpler to implement
- **Template Editor:**
  - Split view: Template code (left) + Live preview (right)
  - Form builder: Drag-and-drop sections, auto-generates template
  - Raw YAML/JSON editor for advanced users
- **Components:**
  - Step editor with conditional logic
  - Variable insertion from dropdown
  - Template preview with sample data
  - Permission/capability selector

**3. Hybrid Editing** (Priority: Medium - Post-MVP)
- GUI generates YAML structure
- Experts can hand-edit generated YAML
- Changes sync between GUI and code editor

**4. Direct YAML Editing** (Priority: Low - Post-MVP)
- For power users who understand workflow schema
- Full access to advanced features
- Syntax validation and intellisense

**Workflow Complexity Tiers:**

| Tier | Capabilities | Use Cases |
|------|-------------|-----------|
| **Basic** | Linear steps (do A, then B, then C), ask user questions, generate output from template, simple string variables | "Create meeting notes from template", "Generate standup report" |
| **Intermediate** | If/then conditionals, multiple templates/outputs, load files as inputs, config references, system variables | "Create bug report (different templates for frontend/backend)", "Process expenses with approval logic" |
| **Advanced** (Future) | Invoke other workflows, loop constructs, knowledge bases, multi-step checkpoints | Complex orchestration workflows |

**MVP Scope:** Basic + Intermediate tiers only (Advanced deferred to post-MVP)

---

#### 3.7.2 Workflow Template Marketplace (MVP: 50 Templates, Post-MVP: User Publishing)

**MVP (Month 4): Curated Template Library**

**1. Template Library (50+ Curated Workflows)**
- **Department Categories:**
  - **Marketing (10 templates):** Social media scheduler, blog post generator, SEO analyzer, competitor monitoring, email campaign creator
  - **Sales (10 templates):** Lead qualifier, proposal generator, meeting notes summarizer, CRM update automator, follow-up email writer
  - **Operations (10 templates):** Expense report processor, vendor invoice parser, project status reporter, resource capacity planner, incident response automator
  - **Finance (10 templates):** Financial report generator, budget variance analyzer, invoice approval workflow, revenue forecast updater, audit log exporter
  - **HR (10 templates):** Job description writer, candidate screening assistant, onboarding checklist generator, performance review summarizer, policy Q&A bot

**2. Template Activation (Chat-Driven - MVP)**
- **Discovery:**
  - User types "What workflows can help me?" → Platform suggests relevant templates based on user's role/department
  - Template recommendations appear in chat: "Based on your role (Marketing), here are 5 workflows: [list]"
- **Activation:**
  - User types "Set up [template name]" → Guided setup flow in chat
  - Platform asks for required inputs ("What email inbox should I monitor?", "What Slack channel for notifications?")
  - Template activated and appears in user's "My Workflows" library

**3. Template Structure (MVP)**
- **Metadata:** Name, description, category, estimatedTimeSavings (hours/month), usageCount
- **Configuration:** Required inputs (with validation), optional settings
- **Steps:** Pre-configured workflow logic (can be customized after activation)

**Post-MVP (Month 6): Full Marketplace with User Publishing**

**4. Marketplace Architecture**
- **Freemium Business Model:**
  - Free tier: Public marketplace access, install unlimited free workflows, create/publish workflows
  - Premium workflows: Creators set price ($0.99-$99.99), Holokai takes 30% revenue share
  - Payment processing via Stripe, monthly payouts to creators
- **Creator Incentives:**
  - Holokai License Grants: Pay top contributors for maintaining popular workflows
  - Reputation System: Leaderboards, "Top Contributor" badges, verified publisher status
  - Revenue sharing from premium workflows

**5. Publishing Pipeline (Post-MVP)**
- **Who Can Publish:** Approved publishers (application process, background check, terms acceptance)
- **Publishing Flow:**
  ```
  Developer submits workflow
    ↓
  Automated security scan (malware, vulnerabilities)
    ↓
  Syntax validation (manifest.json, workflow.yaml, instructions.md)
    ↓
  Human review (Holokai team - 1-3 days)
    ↓
  Test execution (automated QA)
    ↓
  Approve → Publish to marketplace
    OR
  Reject → Feedback to developer
  ```

**6. Trust & Safety (Post-MVP)**
- **Security Scanning:**
  - Automated scans on submission + weekly re-scans
  - Checks for: malware, vulnerabilities, suspicious code, obfuscation
- **Trust Indicators:**
  - 🔒 **Security scan**: "Last scanned: 2 days ago, no issues" + risk score (Low/Medium/High)
  - 👥 **Community feedback**: Star ratings (1-5), review count, comments
  - ⭐ **Install count**: "10K+ installs" (social proof)
  - ✓ **Verified Publisher**: Manual approval by Holokai team
- **Permission Transparency (Mandatory Disclosure):**
  ```
  This workflow requests:
  ✓ Filesystem: Read/Write in workspace
  ✓ Network: HTTPS requests to github.com
  ✓ Git: Read repository history
  ✓ Bash: Execute shell commands

  Risk Score: Medium Risk
  ```
- **Community Moderation:**
  - Report malicious workflows, flag inaccurate descriptions
  - Holokai investigates within 24 hours, disables malicious workflows immediately

**7. Enterprise Private Registries (Post-MVP)**
- Organizations can run internal workflow marketplace
- Curate workflows for their teams, keep proprietary workflows private
- Control what employees can install from public marketplace
- Usage analytics and compliance tracking

---

#### 3.7.3 "My Workflows" Concept (MVP)

**Personal Workspace for Workflow Management**

**Key Principle:** Every user has a **"My Workflows"** personal project (conceptually similar to team projects, but private to the user). This provides a unified model for workflow storage without special-casing personal vs. team workflows.

**Structure:**
```
My Workflows (Personal Project)
├── .holokai/
│   ├── config.yaml              # User variables
│   └── workflows/
│       ├── marketplace/         # Installed from marketplace
│       │   ├── holokai-official/release-notes/
│       │   └── peter/my-workflow/
│       └── custom/              # User-created workflows
│           └── personal-templates/

Team Project (Shared)
├── .holokai/
│   ├── config.yaml              # Project variables
│   └── workflows/
│       ├── marketplace/         # Project-specific (git-ignored)
│       └── custom/              # Team workflows (git-committed)
```

**Project Isolation:**
- Projects are independent - no config merging, no inheritance
- Workflow runs in ONE project context, uses ONLY that project's config
- No cross-project file access
- Variables: Project config + workflow config only

**Workflow Installation:**
When user installs workflow from marketplace:
- **User Choice:** "Install to My Workflows" OR "Install to [Current Team Project]"
- Context-aware default: If browsing from team project → default to project, else → My Workflows
- Override button: "Install elsewhere"

**Team Workflow Sharing:**
- Team workflows in `/project/.holokai/workflows/custom/` are git-committed
- Team shares workflows via version control
- Marketplace workflows in `/project/.holokai/workflows/marketplace/` are git-ignored (each dev installs separately)

---

**Acceptance Criteria (MVP - Month 4):**
- [ ] 50+ curated templates across 5+ departments (Marketing, Sales, Operations, Finance, HR)
- [ ] Template discovery via chat ("What workflows can help me?")
- [ ] Template activation via chat ("Set up [template name]") with guided input collection
- [ ] Activated templates appear in user's "My Workflows" library
- [ ] Template usage tracked (usageCount increments on activation)
- [ ] Basic + Intermediate workflow tiers supported (Advanced deferred)
- [ ] "My Workflows" personal project created automatically for each user

**Acceptance Criteria (Post-MVP - Month 6):**
- [ ] AI-assisted workflow creation (describe → structure → prompt)
- [ ] GUI workflow builder (timeline/flowchart view, template editor)
- [ ] Publishing pipeline (scan → review → test → approve)
- [ ] Freemium marketplace (free + premium workflows)
- [ ] Trust indicators (security scan, ratings, install count, verified publishers)
- [ ] Mandatory permission disclosure before installation
- [ ] Enterprise private registries (organization-hosted marketplaces)

**Technical Implementation:**
- **Database (MVP):** `workflow_templates` table: `name`, `description`, `category`, `featured`, `steps` (JSONB), `requiredInputs` (JSONB)
- **Database (Post-MVP):** `marketplace_workflows` table, `workflow_reviews` table, `publisher_profiles` table
- **Chat Integration:** Keyword detection ("set up", "what workflows") → Trigger template discovery/activation flow
- **Activation:** Clone template to `workflows` table with `createdFrom` = `templateId`
- **Publishing Pipeline:** Security scanning service, review queue UI, automated testing

**Dependencies:**
- **MVP:** Moku API (template library, activation engine), Chat Interface (guided input collection)
- **Post-MVP:** Workflow packaging service (.wfpkg bundles), Publishing pipeline (scan/review/test), Payment processing (Stripe), Marketplace UI (browse, search, install)

---

### 3.8 Feature 7: Portable Workflow Engine (P0 - Architectural Foundation)

**Description:**
Cloud-portable workflow execution engine designed from day one to run locally (MVP) and in the cloud (post-MVP) with zero architectural changes. This is a **critical architectural constraint** that must be respected throughout implementation to avoid expensive refactoring when adding cloud execution.

**User Stories:**
- **US-21:** As a user, I want workflows to execute locally in MVP with low latency, so I get immediate results (MVP)
- **US-22:** As a user, I want the same workflows to run in the cloud in future releases without modification, so I can leverage server-side execution for long-running tasks (Post-MVP)
- **US-23:** As a workflow creator, I want workflows to access files via URLs (not direct paths), so they work in both local and cloud environments (MVP)

**Key Requirements:**

**1. Zero Desktop Dependencies (MVP - Critical Constraint)**
- **Prohibited:**
  - ❌ Electron APIs (main process, renderer process, IPC)
  - ❌ Local file paths (`/Users/peter/Documents/file.txt`, `C:\Users\...`)
  - ❌ Operating system-specific features (Windows Registry, macOS Keychain)
  - ❌ Native binaries (unless containerized or cross-platform)
- **Required:**
  - ✅ Storage service abstraction (file URLs, not paths)
  - ✅ Platform-agnostic runtime (Node, Python, Bash - bundled)
  - ✅ Memory-based state (persisted by engine, not external DB)

**2. Storage Service Abstraction (MVP)**
- **API-Based File Access:**
  ```javascript
  // Workflow scripts call storage service APIs (NOT direct filesystem)
  const content = await storage.readFile('workflow://templates/output.md')
  const url = await storage.getFileURL('project://docs/prd.md')
  await storage.writeFile('project://outputs/result.md', content)
  ```
- **URL Schemes:**
  - `workflow://` - Files within workflow package
  - `project://` - Files in current project
  - `personal://` - Files in "My Workflows" (personal project)
  - `marketplace://` - Files in marketplace (read-only)
- **Backend Mapping:**
  - MVP: Local filesystem (`/Users/peter/.holokai/...`)
  - Post-MVP Cloud: S3, Azure Blob, Google Cloud Storage

**3. Embedded AI Client (MVP)**
- **Anthropic API Integration:**
  - Workflow engine includes embedded AI client (calls Anthropic API)
  - Workflows call `ai.generate(prompt, context)` API
  - Works identically local and cloud (same Anthropic API)
- **AI Capabilities:**
  - Text generation, streaming generation, structured extraction, multi-turn conversations
  - Context assembly (include file URLs in prompts)

**4. Bundled Runtimes (MVP)**
- **Included Interpreters:**
  - Node.js (for JavaScript/TypeScript workflows and scripts)
  - Python (for Python scripts)
  - Bash (for shell scripts)
- **Script Execution:**
  - Scripts run in isolated contexts with capability tokens (see below)
  - Language detection from file extension (`.js`, `.py`, `.sh`)
  - All scripts executed through runtime sandboxes

**5. Capability-Based Sandboxing (MVP)**
- **Permission Model:**
  - Scripts request specific capabilities: `["filesystem:read", "network:https", "git:read"]`
  - User approves capabilities during workflow installation (mandatory disclosure - see Section 3.7.2)
  - Runtime enforces capability restrictions during execution
- **RBAC/SSO Integration:**
  - Scripts run with user's security context (inherit RBAC permissions)
  - No privilege escalation - scripts can only access data user can access
  - API calls include user's JWT token for authorization
- **Resource Limits (Per Workflow Execution):**
  - Memory: 512MB default (configurable)
  - CPU: 1 core (soft limit)
  - Timeout: 60 seconds default (configurable per step)
  - Retry policy: Max 3 attempts, exponential backoff

**6. Memory-Based State Management (MVP)**
- **Execution State:**
  - Workflow state held in memory during execution
  - Checkpoints saved to storage service (for resumability - post-MVP)
  - History persisted for undo/replay (only reversible steps)
- **No External Database Dependency:**
  - MVP does not require workflow engine to access PostgreSQL
  - State persistence handled by workflow engine itself (via storage service)

**7. Cloud Execution Readiness (Post-MVP - Month 6+)**
- **Trigger Modes (Post-MVP):**
  - Desktop delegate: User runs workflow in desktop, desktop calls cloud API
  - Web UI: Browser-based workflow execution (same engine, different UI)
  - API/Webhooks: Programmatic invocation (git push → run workflow)
  - Scheduled: Cron-like scheduling for recurring workflows
- **Benefits of Portable Design:**
  - Same workflow runs local (MVP) or cloud (post-MVP) without modification
  - No vendor lock-in (can run on AWS, GCP, Azure)
  - Hybrid execution: Heavy workflows in cloud, light workflows local
  - Team collaboration: Share execution state via cloud

**Acceptance Criteria (MVP - Month 4):**
- [ ] Workflow engine has zero Electron dependencies (can run in Node.js without Electron)
- [ ] Storage service abstraction implemented (file URLs, not paths)
- [ ] Workflows access files via `storage.readFile()`, `storage.writeFile()` APIs
- [ ] Embedded AI client functional (Anthropic API integration)
- [ ] Bundled runtimes included (Node.js, Python, Bash)
- [ ] Capability-based sandboxing enforced (permissions checked before script execution)
- [ ] RBAC/SSO context inherited by workflows (user permissions enforced)
- [ ] Resource limits enforced (memory, CPU, timeout)
- [ ] Memory-based state management functional (no external DB required)

**Acceptance Criteria (Post-MVP - Month 6+):**
- [ ] Workflow engine deployed to cloud (AWS Lambda, GCP Cloud Run, or Azure Functions)
- [ ] Cloud storage integration (S3, Azure Blob, GCS) via storage service
- [ ] Multiple trigger modes functional (desktop, web UI, API, scheduled)
- [ ] Same workflows run local and cloud without modification

**Technical Implementation:**
- **Workflow Engine:** Standalone Node.js service (can run in Electron main process or cloud runtime)
- **Storage Service Interface:**
  ```typescript
  interface StorageService {
    readFile(url: string): Promise<string>
    getFileURL(path: string): Promise<string>
    writeFile(path: string, content: string): Promise<void>
    // ... additional methods
  }
  ```
- **Backend Implementations:**
  - `LocalStorageService` (MVP): Maps URLs to local filesystem paths
  - `S3StorageService` (Post-MVP): Maps URLs to S3 objects
  - `AzureBlobStorageService` (Post-MVP): Maps URLs to Azure Blob Storage
- **AI Client:**
  ```typescript
  interface AIClient {
    generate(prompt: string, context?: AIContext): Promise<string>
    generateStream(prompt: string, context?: AIContext): AsyncIterator<string>
    // ... additional methods
  }
  ```
- **Capability Enforcement:**
  ```typescript
  class CapabilityEnforcer {
    checkPermission(capability: string, userContext: UserContext): boolean
    enforceResourceLimits(execution: WorkflowExecution): void
    // ... additional methods
  }
  ```

**Dependencies:**
- Storage service (local filesystem MVP, cloud storage post-MVP)
- Anthropic API (AI generation)
- Bundled runtimes (Node.js, Python, Bash - packaged with Desktop installer)
- Moku API (user context, RBAC permissions)

**Design Principles:**
1. **Portable from Day 1:** Never assume local filesystem or Electron APIs exist
2. **Storage Abstraction:** All file access goes through storage service (URLs, not paths)
3. **Stateless Execution:** Workflow engine can be deployed as stateless cloud function
4. **Security First:** Capability-based sandboxing, RBAC/SSO integration, resource limits
5. **Cloud Ready:** Architecture supports multiple trigger modes and cloud deployment without refactoring

---

### 3.9 Feature 8: Admin Dashboard & Insights (P1)

**Description:**
Real-time analytics and governance monitoring for IT leaders and department heads.

**User Stories:**
- **US-19:** As an IT leader, I want to see real-time adoption metrics (active users, workflows created, executions), so I can report ROI to leadership
- **US-20:** As a department head, I want to see my team's usage and time savings, so I can justify budget
- **US-21:** As a security officer, I want to see audit logs and security events, so I can ensure compliance

**Key Requirements:**

**1. Adoption Metrics Dashboard**
- **Overview Cards:**
  - Active Users (last 30 days): count + trend
  - Workflows Created: count + trend
  - Workflow Executions (last 30 days): count + trend
  - Estimated Time Saved: hours + dollar value ($125/hour labor cost)
- **Charts:**
  - Daily Active Users (last 90 days)
  - Workflow Executions Over Time (last 90 days)
  - Top Workflows by Usage (top 10)
  - Department Adoption Rates (% of users active by department)

**2. Department Dashboards**
- **Department Head View:**
  - Team usage summary (active users, workflows, executions)
  - Top workflows used by team
  - Time savings per team member (hours/month)
  - Workflow sharing activity (who shared what)

**3. Governance Monitoring**
- **Security Events:**
  - Failed authentication attempts (last 7 days)
  - Unusual usage patterns (e.g., 1,000 API calls in 1 hour)
  - Credential rotation reminders (OAuth tokens expiring soon)
- **Audit Logs:**
  - Filterable by user, action, date range
  - Exportable (CSV, JSON) for compliance reporting
  - Actions logged: workflow created, workflow executed, member invited, role changed, settings updated

**4. Reports**
- **Pre-Built Reports:**
  - Monthly Usage Report (active users, workflows, executions, time saved)
  - Department Adoption Report (per-department metrics)
  - Security Audit Report (failed logins, access changes, credential usage)
- **Export Formats:** CSV, JSON, PDF

**Acceptance Criteria:**
- [ ] Dashboard loads within 2 seconds
- [ ] Overview cards show real-time metrics (active users, workflows, executions, time saved)
- [ ] Charts render correctly (daily active users, executions over time, top workflows)
- [ ] Department heads can view team-specific dashboards
- [ ] Audit logs filterable by user, action, date range
- [ ] Reports exportable in CSV, JSON, PDF formats
- [ ] Security events visible (failed logins, unusual usage, credential alerts)

**Technical Implementation:**
- **Metrics:** Pre-aggregated in Moku API `usage_metrics` table (daily rollups)
- **Charts:** Chart.js or Recharts (React charting library)
- **Audit Logs:** `audit_log` table queried with pagination (limit 1,000 rows per query)
- **Reports:** Generated on-demand (PDF via Puppeteer, CSV via streaming)

**Dependencies:**
- Moku API: Metrics aggregation, audit log queries, report generation
- Desktop UI: Dashboard components (cards, charts, tables)

---

### 3.10 Feature 9: Desktop Core Platform (P0)

**Description:**
Electron-based desktop application with notifications, state persistence, deep linking, and auto-updates.

**User Stories:**
- **US-22:** As a user, I want to receive notifications for workflow completions and team activity, so I stay informed without constant app checking
- **US-23:** As a user, I want to open threads directly from email links (`holokai://thread/{id}`), so I can navigate quickly
- **US-24:** As a user, I want the app to auto-update in the background, so I always have the latest features and security patches

**Key Requirements:**

**1. Notifications**
- **System Notifications (Native OS):**
  - Workflow completion: "Your 'Daily standup report' finished"
  - Team activity: "@you mentioned in 'Marketing Q4 Strategy'"
  - Admin alerts: "New workflow shared with your team"
- **Toast Notifications (In-App):**
  - Non-critical updates: "5 new messages in 'Project Alpha'"
  - Success confirmations: "Workflow saved successfully"
  - Error alerts: "Workflow execution failed"

**2. State Persistence**
- **Window State:**
  - Remember window size, position, maximized state
  - Restore last active view (thread, project, dashboard)
- **User Preferences:**
  - Theme (light/dark mode), font size, sidebar collapsed state
  - Notification preferences (enable/disable per type)

**3. Deep Linking**
- **Protocol Registration:** `holokai://` protocol registered on OS
- **Supported Routes:**
  - `holokai://thread/{id}` - Open thread
  - `holokai://project/{id}` - Open project
  - `holokai://workflow/{id}` - Open workflow editor
  - `holokai://settings` - Open settings
  - `holokai://invite/{code}` - Accept project invitation

**4. Auto-Updates**
- **Update Strategy:**
  - Check for updates on app launch (Electron autoUpdater)
  - Download in background
  - Prompt user to restart when ready (not forced)
- **Release Channels:**
  - Stable (default): Production-ready releases
  - Beta (opt-in): Early access to new features

**Acceptance Criteria:**
- [ ] System notifications appear for workflow completions, mentions, admin alerts
- [ ] Toast notifications appear for non-critical updates
- [ ] Window state persists (size, position, maximized)
- [ ] User preferences persist (theme, font size, notification settings)
- [ ] Deep links work when app is running or closed
- [ ] Auto-update downloads in background and prompts user to restart
- [ ] Update channels (Stable, Beta) configurable in settings

**Technical Implementation:**
- **Notifications:** Electron `Notification` API (system), custom toast component (in-app)
- **State Persistence:** Electron `electron-store` library (JSON file in user data dir)
- **Deep Linking:** Electron `app.setAsDefaultProtocolClient('holokai')`
- **Auto-Updates:** Electron `autoUpdater` with update server (electron-builder + S3)

**Dependencies:**
- Electron 39.x
- electron-store (state persistence)
- electron-builder (packaging, auto-updates)

---

## 4. Technical Architecture

### 4.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PLATFORM SERVICES                               │
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   HOLO API   │    │   MOKU API   │    │   STORAGE    │                  │
│  │  (LLM Chat)  │    │ (Management) │    │   SERVICE    │                  │
│  │              │    │              │    │              │                  │
│  │ - Claude     │    │ - Users      │    │ - S3/Blob    │                  │
│  │ - GPT-4      │    │ - Projects   │    │ - Presigned  │                  │
│  │ - Gemini     │    │ - Workflows  │    │   URLs       │                  │
│  │ - Streaming  │    │ - Auth/RBAC  │    │              │                  │
│  │              │    │ - Credentials│    │              │                  │
│  │              │    │ - Audit Logs │    │              │                  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                  │
│         │                   │                   │                           │
│         └───────────────────┼───────────────────┘                           │
│                             │                                                │
│                    ┌────────┴────────┐                                      │
│                    │  DESKTOP APP    │                                      │
│                    │ (Electron/Svelte)│                                      │
│                    │                 │                                      │
│                    │ - Chat UI       │                                      │
│                    │ - Workflow Exec │                                      │
│                    │ - MCP Client    │                                      │
│                    │ - Local Cache   │                                      │
│                    └─────────────────┘                                      │
│                             │                                                │
│                    ┌────────┴────────┐                                      │
│                    │  MCP SERVERS    │                                      │
│                    │  (Sandboxed)    │                                      │
│                    │                 │                                      │
│                    │ - Google (20+)  │                                      │
│                    │ - Slack         │                                      │
│                    │ - GitHub        │                                      │
│                    │ - Salesforce    │                                      │
│                    │ - [257+ total]  │                                      │
│                    └─────────────────┘                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Technology Stack

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| **Desktop Framework** | Electron | 39.x | Cross-platform, native integrations, auto-updates |
| **UI Framework** | Svelte | 5.x | Lightweight, reactive, fast rendering |
| **Styling** | Tailwind CSS | 3.4.x | Utility-first, consistent design system |
| **Component Library** | PrimeNG | Latest | Pre-built components (tables, charts, dialogs) |
| **State Management** | Svelte Stores | Built-in | Simple, reactive state |
| **Local Cache** | better-sqlite3 | Latest | Fast local storage, SQL queries |
| **Backend** | Spring Boot | Latest | Existing Moku API stack |
| **Database** | PostgreSQL | 14+ | Relational, JSONB support, full-text search |
| **File Storage** | S3/Azure Blob | N/A | Existing Storage Service |
| **Authentication** | SSO (Okta/Azure AD/Google) | OAuth 2.0 | Enterprise standard |
| **MCP Integration** | MCP SDK | Latest | Model Context Protocol support |

### 4.3 Data Architecture

**Storage Split:**

| Data Type | Personal | Project | Rationale |
|-----------|----------|---------|-----------|
| Thread metadata | Moku API (cached locally) | Moku API (cached locally) | Both stored via Moku API; cached for performance |
| Messages | Moku API (cached locally) | Moku API (cached locally) | Both stored via Moku API; cached for performance |
| Files | Local filesystem | Storage Service (S3/Blob) | Personal: local only; Project: shared cloud storage |
| Workflows | Moku API | Moku API | Always synced for execution engine |
| Credentials | Moku API (encrypted) | Moku API (encrypted) | Never stored locally (security) |

**Cache Strategy:**

| Cache Type | Personal | Project | TTL | Eviction |
|------------|----------|---------|-----|----------|
| Thread list | LRU | LRU | 5min (both types) | LRU when >1,000 threads |
| Messages | LRU | LRU | 2min (both types) | LRU when >100MB |
| Files | Permanent | Encrypted | None (personal), 3 days (project) | Manual clear or TTL |
| Workflow definitions | N/A | LRU | 10min | LRU when >500 workflows |

### 4.4 Security Architecture

**Authentication:**
- SSO exchange code flow with CSRF protection (Okta, Azure AD, Google)
- JWT tokens: 1-hour access token, 7-day refresh token
- Token storage: Electron safeStorage (OS keychain)

**Data Encryption:**
- **At rest:** AES-256-GCM for cached messages, files, credentials
- **In transit:** TLS 1.3 for all API calls
- **Key management:** Encryption keys derived from user credentials + device ID, rotated every 8 hours

**IPC Security:**
- Electron `contextIsolation: true` (renderer process isolated from Node.js)
- Electron `sandbox: true` (renderer process sandboxed)
- Content Security Policy (CSP): No inline scripts, no eval()

**MCP Sandboxing:**
- Each MCP server runs in isolated Node.js child process
- Resource limits: 512MB RAM, 1 CPU core, 60-second timeout per tool invocation
- No filesystem access except `/tmp` (write-only)
- No network access except allowlisted domains (per MCP server config)

**API Key Management (Moku System):**
- All credentials stored in Moku API (not Desktop app)
- AES-256-GCM encryption at rest
- Key rotation every 90 days (automatic for OAuth, manual notification for API keys)
- RBAC: Only workflow creators can access their stored credentials
- Audit logs: All credential usage logged (workflow, user, timestamp)

**SOC 2 Alignment:**
- Aligned with company-wide SOC 2 Type II initiative (Month 6 target)
- Desktop app contributes: encryption at rest/transit, audit logs, RBAC, secure credential storage
- Moku API responsible for: access controls, data retention, incident response, compliance reporting

---

## 5. Dependencies and Integrations

### 5.1 Platform Dependencies

| Dependency | Purpose | Status | Owner |
|------------|---------|--------|-------|
| **Holo API** | LLM prompt execution, streaming responses | Existing | Platform Team |
| **Moku API** | User/project/thread/workflow management, RBAC, credentials | Requires updates | Backend Team |
| **Storage Service** | Project file storage (S3/Azure Blob) | Existing | Platform Team |
| **SSO Provider** | Authentication (Okta, Azure AD, Google) | Existing | IT Team |

### 5.2 Moku API Updates Required

**New Endpoints:**
- `POST /workflows` - Create workflow (with chat context extraction)
- `POST /workflows/{id}/execute` - Execute workflow
- `GET /workflows/suggestions` - ML-driven workflow suggestions based on chat history
- `POST /workflows/{id}/fork` - Fork workflow template
- `GET /workflow-templates` - List curated templates
- `POST /workflow-templates/{id}/activate` - Activate template for user
- `POST /credentials` - Store OAuth token or API key (encrypted)
- `GET /credentials/{integrationType}` - Retrieve credential for integration (decrypted)
- `POST /governance/phase` - Set organization governance phase (pilot/department/enterprise)
- `GET /governance/audit-logs` - Retrieve audit logs (filterable)
- `GET /usage-metrics` - Retrieve dashboard metrics (adoption, executions, time saved)

**Database Schema Changes:**
- **New Tables:**
  - `workflows` - Workflow definitions (id, userId, projectId, name, triggerType, steps JSONB, createdFrom)
  - `workflow_executions` - Execution history (id, workflowId, userId, status, startedAt, completedAt, results JSONB)
  - `workflow_templates` - Curated templates (id, name, category, steps JSONB, requiredInputs JSONB)
  - `credentials` - API keys/OAuth tokens (id, userId, integrationType, encryptedToken, expiresAt)
  - `integration_actions` - Action registry (id, integrationId, actionName, inputSchema JSONB, outputSchema JSONB)
  - `audit_log` - Governance events (id, userId, action, resource, timestamp, metadata JSONB)
  - `usage_metrics` - Pre-aggregated metrics (date, orgId, activeUsers, workflowsCreated, executions, timeSaved)
- **Updated Tables:**
  - `desktop_threads` - Add `projectId`, `visibility` (personal/team/org), `createdFromWorkflow`
  - `desktop_messages` - Add `parentMessageId`, `branchIndex` (for thread branching)
  - `projects` - Add `governancePhase` (pilot/department/enterprise)

### 5.3 Third-Party Dependencies

| Dependency | Purpose | License | Version |
|------------|---------|---------|---------|
| **Electron** | Desktop framework | MIT | 39.x |
| **Svelte** | UI framework | MIT | 5.x |
| **Tailwind CSS** | Styling | MIT | 3.4.x |
| **PrimeNG** | Component library | MIT | Latest |
| **better-sqlite3** | Local cache | MIT | Latest |
| **MCP SDK** | Model Context Protocol client | MIT | Latest |
| **Slack SDK** | Native Slack integration | MIT | Latest |
| **Google APIs** | Native Google Workspace integration | Apache 2.0 | Latest |
| **Salesforce SDK** | Native Salesforce integration | BSD-3 | Latest |
| **Chart.js** | Dashboard charts | MIT | Latest |
| **electron-store** | State persistence | MIT | Latest |
| **electron-builder** | Packaging, auto-updates | MIT | Latest |

---

## 6. Release Scope & Timeline

### 6.1 Enterprise MVP Scope (4-Month Timeline)

**In Scope:**

**Core Differentiators (P0):**
- ✅ Chat-to-workflow progression ("Make this a workflow" button, ML-driven suggestions, template marketplace)
- ✅ MCP integration (20 pre-installed servers: Google, Slack, GitHub, Salesforce, etc.)
- ✅ Native integrations (Top 10: Slack, Google Workspace, Microsoft 365, Salesforce, HubSpot, Notion, Jira, GitHub, Zoom, Zapier)
- ✅ Progressive governance (Phase 1-2: Pilot + Department controls; Phase 3: Enterprise mode)

**Foundation Features (P0):**
- ✅ Thread management with dual-sidebar UX (branching, search, organization)
- ✅ Project collaboration (RBAC, member management, file storage)
- ✅ Admin dashboard & insights (adoption metrics, department dashboards, audit logs)
- ✅ Desktop core platform (notifications, state persistence, deep linking, auto-updates)

**Enterprise Readiness (P0):**
- ✅ SOC 2 alignment (encryption, audit logs, RBAC, secure credentials) - aligned with company-wide initiative (Month 6)
- ✅ SSO/SAML (Okta, Azure AD, Google) - existing from Phase 1
- ✅ API key management via Moku system
- ✅ Compliance reporting (audit logs, usage metrics, security events)

**Out of Scope (Future Phases):**
- ❌ Real-time collaboration (WebSocket) - polling only in MVP
- ❌ Advanced workflow orchestration (conditional logic, loops, error handling) - basic sequential/parallel execution only
- ❌ Topic analysis with ML (requires ML infrastructure)
- ❌ Report scheduling (on-demand reports only)
- ❌ Organization-level projects (department-level only in MVP)
- ❌ Mobile apps (iOS, Android) - Desktop only in MVP
- ❌ Offline mode - online-only architecture
- ❌ Advanced MCP features (custom server development, marketplace) - pre-installed servers only
- ❌ Workflow versioning and rollback - single version only
- ❌ Multi-language support - English only in MVP

### 6.2 Release Phases (4-Month Timeline)

| Phase | Duration | Features | Target | Success Criteria |
|-------|----------|----------|--------|------------------|
| **Alpha (Month 1)** | Weeks 1-4 | Thread branching, dual-sidebar UX, desktop core (notifications, deep linking, auto-updates) | Internal testing (10-20 employees) | All P0 features functional; <10 critical bugs |
| **Beta (Month 2)** | Weeks 5-8 | Projects, MCP integration (20 servers), native integrations (Top 10), chat-to-workflow ("Make this a workflow" button) | Beta customers (3-5 orgs, 25-50 users each) | 80%+ pilot adoption; 30%+ chat→workflow progression |
| **RC (Month 3)** | Weeks 9-12 | Progressive governance (Phase 1-2), workflow templates (50+), admin dashboard & insights | Early adopters (10-15 orgs, 50-100 users each) | 80%+ adoption; 40%+ chat→workflow progression; <5 critical bugs |
| **GA (Month 4)** | Weeks 13-16 | UI polish, performance optimization, documentation, onboarding materials, SOC 2 alignment finalized | General availability | SOC 2 audit in progress; 20+ paying customers; $250K+ ARR pipeline |

### 6.3 Feature Flags

| Flag | Description | Default | Phase |
|------|-------------|---------|-------|
| `enableChatToWorkflow` | "Make this a workflow" button and ML suggestions | false | Beta (Month 2) |
| `enableMCP` | MCP integration ecosystem | false | Beta (Month 2) |
| `enableNativeIntegrations` | Native top 10 integrations | false | Beta (Month 2) |
| `enableProgressiveGovernance` | Progressive governance controls | false | RC (Month 3) |
| `enableWorkflowTemplates` | Template marketplace (50+ templates) | false | RC (Month 3) |
| `enableBranching` | Thread retry branching | true | Alpha (Month 1) |
| `enableProjects` | Project collaboration | true | Beta (Month 2) |
| `enableInsights` | Admin dashboard & insights | true | RC (Month 3) |
| `enablePolling` | Project cache polling (30s interval) | true | Beta (Month 2) |

---

## 7. Go-to-Market & Onboarding

### 7.1 Sales Strategy

**Reference:** Holokai company GTM strategy and onboarding plan for early adopters, pilots, and enterprise sales.

**Sales Motion:**
- **Direct enterprise sales** (not self-serve)
- **Pilot-driven:** 90-day pilots (25-50 users) before full organizational deployment
- **Target customers:** 100-1,000 employee organizations in professional services, tech, marketing agencies, financial services
- **Sales cycle:** 6-9 months (industry standard for enterprise software)

**Pricing Model:**
- **Reference:** Holokai company pricing plan (includes Desktop product)
- **Expected Range:** $50-100/user/year (50-75% savings vs. enterprise competitors)
- **Minimum Commitment:** 100 seats minimum ($5,000/year minimum contract value)

### 7.2 Customer Onboarding

**Reference:** Holokai company onboarding plan for early adopters, pilots, and enterprise sales.

**Onboarding Timeline:**
- **Week 1:** IT provisions platform (SSO configuration, user invites)
- **Week 2:** Employees self-onboard through chat (no formal training required)
- **Week 3-4:** Monitor adoption, gather feedback, enable first governance controls
- **Total:** 2-4 weeks to 80%+ organizational adoption

**Onboarding Materials:**
- Welcome email with download link and quick-start guide
- In-app onboarding flow (5-minute guided tour)
- Video tutorials (3-5 minutes each): "Your first chat", "Create a workflow", "Share with your team"
- Template library with pre-built workflows (50+ templates)
- Help center with FAQs, troubleshooting, API documentation

---

## 8. Risks and Mitigations

### 8.1 Technical Risks

| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|-------------|------------|-------|
| **MCP integration complexity** | Delays Beta release | Medium | Start with 5 core servers (Google, Slack, GitHub); add 15 more incrementally | Engineering |
| **Pattern detection accuracy** | Low-quality workflow suggestions | Medium | Use sentence embeddings (OpenAI) with >0.85 similarity threshold; A/B test thresholds | ML Team |
| **Cache invalidation delays** | Users see stale project data | Medium | 30s polling + manual refresh button; WebSocket upgrade in future | Engineering |
| **Large thread performance** | UI lag with 1,000+ messages | Low | Virtual scrolling (only render visible messages); pagination for threads >500 messages | Engineering |
| **File upload failures** | Lost work, user frustration | Low | Retry logic (3 attempts), progress feedback, local backup before upload | Engineering |
| **Encryption key loss** | Data inaccessible if device lost | Low | Key derivation from user credentials + device ID; account recovery flow with admin approval | Security Team |
| **MCP server crashes** | Workflow execution failures | Medium | Isolate each MCP server in child process; automatic restart on crash; error reporting | Engineering |

### 8.2 Product Risks

| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|-------------|------------|-------|
| **Low chat→workflow progression** | Core differentiator fails | High | Pre-seed template library (50+ workflows); aggressive ML suggestion tuning; user interviews to understand barriers | Product |
| **Complex branching UI** | User confusion, low adoption | Medium | User testing (10+ sessions); clear visual design (lane-based); tooltips and help docs | Design |
| **Workflow learning curve** | Low workflow usage even with templates | Medium | Chat-driven activation ("Set up [template]"); invisible execution (results in chat); onboarding videos | Product |
| **Low project adoption** | Teams don't collaborate | Medium | Onboarding flow emphasizes projects; pre-seed with department templates; gamification (leaderboard for most-used workflows) | Product |
| **Progressive governance confusing** | IT leaders don't understand phases | Low | Clear admin dashboard showing current phase + next steps; documentation with decision tree | Product |

### 8.3 Market & Competitive Risks

| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|-------------|------------|-------|
| **Competitive response** (Microsoft, Zapier, Moveworks build chat-to-workflow) | Differentiation erodes | Medium | 6-12 month head start (per competitive research); continuous innovation (Phase 3 features); strong customer relationships | Product |
| **SOC 2 delays** | Can't sell to enterprise (>$50K contracts require SOC 2) | Medium | Align with company-wide SOC 2 initiative (Month 6 target); prioritize compliance work; hire compliance consultant if needed | Security Team |
| **Low enterprise adoption** | <80% target, ROI not proven | Medium | Pilot-driven sales (prove value before full deployment); focus on high-adoption orgs (tech, agencies); refine onboarding based on feedback | Sales |
| **Pricing pressure** | Customers demand <$50/user, can't achieve margins | Low | Anchor on value ($1,250-2,500/month savings per user); pilot proves ROI before pricing negotiation; volume discounts for 500+ seats | Sales |

### 8.4 Dependency Risks

| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|-------------|------------|-------|
| **Moku API delays** | Features blocked (workflows, credentials, governance) | Medium | Parallel development with mocks; prioritize API endpoints (workflows first, insights later); dedicated backend engineering resources | Backend Team |
| **Storage Service changes** | File upload/download breaks | Low | API versioning; service-level agreements (SLA); automated integration tests | Platform Team |
| **MCP protocol changes** | Breaking changes to MCP SDK | Low | Pin MCP SDK version; monitor MCP community for deprecations; automated regression tests | Engineering |
| **OAuth provider issues** (Okta, Google, Azure AD rate limits, outages) | Authentication failures | Low | Implement token caching (7-day refresh); fallback to email/password if OAuth unavailable; monitor provider status pages | Engineering |

---

## 9. Success Criteria & Validation

### 9.1 Product Validation (End of Month 4 - GA)

| Metric | Target | Measurement | Validation Method |
|--------|--------|-------------|-------------------|
| **Adoption Rate** | 80%+ of provisioned employees | % active users (last 30 days) / total provisioned | Pilot data from 10-15 early adopter orgs |
| **Chat→Workflow Progression** | 40%+ create first workflow in 30 days | % users with ≥1 workflow / active users | Pilot data + funnel analysis |
| **Workflow Execution** | 20+ executions per active workflow | Total executions / active workflows | Pilot data |
| **Time-to-First-Value** | <7 days from signup to first workflow | Median days (account created → first workflow executed) | Pilot data |
| **NPS Score** | 40+ (enterprise software benchmark) | Net Promoter Score survey | Pilot surveys (quarterly) |

### 9.2 Business Validation (End of Month 4 - GA)

| Metric | Target | Measurement | Validation Method |
|--------|--------|-------------|-------------------|
| **Customer Acquisition** | 20+ paying customers | Signed annual contracts | Sales pipeline |
| **ARR Pipeline** | $250K-500K | Total contract value (annual) | Sales pipeline |
| **Pilot→Paid Conversion** | 60%+ of pilots convert | % pilots → paid / total pilots | Sales data |
| **Average Contract Value** | $12.5K-25K per customer | Total ARR / # customers | Sales data |
| **Sales Cycle** | 6-9 months (lead → closed-won) | Median days (lead created → contract signed) | CRM data |

### 9.3 Technical Validation (End of Month 4 - GA)

| Metric | Target | Measurement | Validation Method |
|--------|--------|-------------|-------------------|
| **Deployment Time** | <4 weeks (pilot → 80% adoption) | Days (contract signed → 80% active users) | Pilot data |
| **Uptime** | 99.5%+ | % uptime (last 30 days) | Infrastructure monitoring |
| **Support Tickets** | <1 ticket per 10 users per month | # tickets / # active users / month | Support system |
| **Critical Bugs** | <5 in production | # P0/P1 bugs in GA release | Bug tracker |
| **Performance** | <2s dashboard load, <500ms chat response | P95 latency | Application monitoring (New Relic, Datadog) |

### 9.4 Compliance Validation (End of Month 6)

| Requirement | Target | Validation Method |
|-------------|--------|-------------------|
| **SOC 2 Type II Certification** | Certification achieved by Month 6 | Third-party audit (aligned with company-wide initiative) |
| **Encryption** | AES-256-GCM at rest, TLS 1.3 in transit | Security review + penetration testing |
| **Audit Logs** | Complete activity trail for all governance events | Compliance review + log sampling |
| **RBAC** | Role-based access control functional (5 roles) | Security review + permission testing |
| **Credential Security** | API keys encrypted, rotated every 90 days | Security review + Moku system audit |

---

## 10. Open Questions & Decisions Needed

| Question | Owner | Status | Decision Deadline |
|----------|-------|--------|-------------------|
| **Pricing:** Final pricing tiers ($50/75/100 per user/year)? | Product + Sales | TBD | End of Month 1 (Alpha) |
| **MCP Servers:** Which 20 servers to pre-install? | Product + Engineering | TBD | End of Month 1 (Alpha) |
| **Governance Phases:** Should Phase 3 (Enterprise) auto-activate at 250 users or remain manual? | Product + IT | TBD | End of Month 2 (Beta) |
| **Workflow Templates:** Final list of 50+ templates (which departments, which use cases)? | Product | TBD | End of Month 2 (Beta) |
| **Pattern Detection Threshold:** Cosine similarity >0.85 or >0.90 for workflow suggestions? | ML Team + Product | TBD | End of Month 2 (Beta) |
| **File Limits:** 10MB per file sufficient or increase to 50MB? | Engineering + Product | TBD | End of Month 1 (Alpha) |
| **Offline Mode:** Definitively out of scope or revisit in future? | Product + Architecture | Deferred | N/A (confirmed out of scope) |
| **Mobile Apps:** Timeline for iOS/Android apps (Year 2)? | Product | Deferred | N/A (post-MVP) |
| **Real-time Collaboration:** WebSocket upgrade timeline (Month 6+)? | Engineering + Product | Deferred | N/A (post-MVP) |
| **Audit Log Retention:** 90 days, 1 year, or 7 years (GDPR compliance)? | Legal + Security | TBD | End of Month 3 (RC) |

---

## 11. Appendices

### 11.1 Related Documents

| Document | Description | Location |
|----------|-------------|----------|
| **Product Brief** | Enterprise strategy, competitive analysis, market positioning | `docs/product-brief-holokai-desktop-2025-11-26.md` |
| **Competitive Research** | Deep analysis of 7 competitors, decision matrix, pre-mortem | `docs/research-competitive-2025-11-26.md` |
| **PRD Validation Report** | Gap analysis between Phase 2 PRD and Product Brief | `docs/prd-validation-report-2025-11-26.md` |
| **Architecture** | Technical architecture, data flow, security design | `docs/architecture-2025-11-25.md` |
| **Epics & Stories** | Detailed user stories for Phase 2 features | `docs/epics-and-stories-2025-11-25.md` |
| **Wireframe** | Dual-sidebar UX design | `docs/diagrams/wireframe-2025-11-25.excalidraw` |
| **Company GTM Plan** | Sales strategy, onboarding plan, pilot program | [Reference existing company document] |
| **Company Pricing Plan** | Pricing tiers, licensing model | [Reference existing company document] |
| **Company SOC 2 Initiative** | SOC 2 Type II timeline, audit process | [Reference existing company document] |

### 11.2 Glossary

| Term | Definition |
|------|------------|
| **Chat-to-Workflow** | Core differentiator: Platform suggests automating repetitive chat patterns into reusable workflows |
| **Progressive Governance** | Governance model that scales from permissive (pilot) to controlled (enterprise) as adoption grows |
| **MCP** | Model Context Protocol - Open protocol for LLM integrations (257+ community servers) |
| **Native Integration** | Optimized API connector for top enterprise apps (Slack, Gmail, Salesforce, etc.) |
| **Workflow Template** | Pre-built workflow activated through chat (e.g., "Set up daily standup report") |
| **Branch** | Alternative conversation path from a retry point in thread |
| **Project** | Shared workspace for team collaboration (threads, workflows, files) |
| **RBAC** | Role-Based Access Control - Permissions system (Admin, Department Head, Power User, Standard User, View-Only) |
| **Presigned URL** | Time-limited URL for direct file upload/download (S3/Azure Blob) |
| **TTL** | Time-To-Live - Cache expiration time |
| **LRU** | Least Recently Used - Cache eviction policy |
| **SOC 2 Type II** | Security compliance certification required for enterprise sales >$50K |

### 11.3 Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 2.1 | 2025-11-26 | Mary (Business Analyst) | **Workflow Marketplace & Portable Engine** - Added comprehensive workflow requirements. Updated §1.4 with marketplace metrics. Clarified §3.2 chat-to-workflow is one method. Completely rewrote §3.7 → "Workflow Marketplace & Creation" with subsections: User-Created Workflows (AI-assisted, GUI builder, tiers), Marketplace Architecture (freemium, publishing pipeline, trust & safety), "My Workflows" concept (personal project model). Added §3.8 Portable Workflow Engine (zero desktop dependencies, storage abstraction, embedded AI, capability sandboxing, cloud-ready). Renumbered §3.8→3.9 (Admin Dashboard), §3.9→3.10 (Desktop Core). |
| 2.0 | 2025-11-26 | Product Team | **Enterprise MVP PRD** - Pivoted from Phase 2 collaboration focus to enterprise strategy. Added: chat-to-workflow progression, MCP integration, progressive governance, native integrations (top 10), updated personas (enterprise buyers), 4-month timeline, SOC 2 alignment, GTM/onboarding references. Removed: Offline mode references, 8-week timeline. |
| 1.0 | 2025-11-25 | Product Team | Initial Phase 2 PRD (collaboration and workflow features) |

---

_Product Requirements Document - Holokai Desktop Enterprise MVP_

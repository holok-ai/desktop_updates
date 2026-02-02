# HoloKai Desktop: System Features Summary

## Feature Table by Category


---

### DESKTOP PLATFORM & UX

| Feature | Description | Phase | Status |
|---------|-------------|-------|--------|
| Notifications | System notifications (OS native) for workflows, mentions, alerts | 1 | |
| Toast Notifications | Show toast notifications with information, warning, and error types; in-app notifications with auto-dismiss | 1 | |
| Dual-Sidebar Navigation | Primary sidebar (icons) + secondary sidebar (context-specific lists) | 1 | |
| Flexible Thread Layout | Drag and drop layout area for a thread, including chat, graphic, prompt, execution and file views | 1 | |
| Tab-Based View Switching | UI tabs for Chat, Execution, Branching, Prompt, File views; switch between views via tabs or keyboard | 1 | |
| State Persistence | Remember window size, position, maximized state; restore last active view | 1 | |
| User Preferences | Persist theme (light/dark), font size, sidebar state, notification settings | 1 | |
| Auto-Update System | Background downloads; user-controlled restart; stable release channel | 1 | |
| Menu Bar & System Tray | Application menus (File, Edit, View, Window, Help); system tray with connection status | 1 | |
| Keyboard Shortcuts | Implement fixed keyboard shortcuts for common actions; display shortcuts in UI (menus, tooltips, help) | 1 | |
| Accessibility | WCAG 2.1 AA compliance; focus management, color contrast, screen reader support | 2 | |
| Deep Linking | `holokai://` protocol for direct navigation to threads, projects, workflows, settings, invites | 2 | |


### THREADS, CHAT AND BRANCHING 

| Feature | Description | Phase | Status |
|---------|-------------|-------|--------|
| Create Thread with Application & Model | Allow user to create threads by selecting application and model | 1 | |
| Threads in Personal & Shared Projects | Allow threads to be created in personal and shared projects | 1 | |
| Thread Management (Delete, Rename, Move) | Delete, rename and move a thread from user to project thread | 1 | |
| Thread Branching & Retry | Create conversation variations from any point; max 2 retry branches per divergence point | 1 | |
| Background Agent | Background process to run prompts that analyze user activity | 1 | |
| Auto-Title Generation | Use background agent to  generate thread titles after 2nd exchange | 1 | |
| Thread Search & Filtering | Full-text search across titles and content; filter by date, model used | 1 | |
| Thread Organization | Pin important threads, archive old threads, move between personal and project | 2 | |
| Clipboard Operations | Copy prompts, responses, and code blocks to system clipboard | 1 | |
| Branch Metadata Display | Show model name, token count, duration, and timestamp in visualization | 1 | |
| View Tool Iterations | Visualize tool call sequences in branching view as distinct nodes | 1 | |
| Tool Call Inputs/Outputs Display | Show tool parameters and results at Inspect zoom level | 1| |

---

### PERSONAL AND SHARED PROJECTS 

| Feature | Description | Phase | Status |
|---------|-------------|-------|--------|
| Project Spaces | Shared workspaces with metadata (name, color, icon, tags, visibility controls) | 1 | |
| Member Management | Invite team members via email or user search; manage roles and permissions | 1| |
| Project File View | Show files attached to or generated from project threads | 1| |
| Thread Execution | Allow thread "runs" w and w/o instruction file | 1 | |
| Thread Sharing | View and run/re-run threads with ai-assisted parameter prompting | 1 | |
| Project File Storage | Files stored in cloud storage service; accessible to all team members; encrypted cache | 1 | |
| Role-Based Access Control | Viewer, Editor, Admin roles (Phase 2); expanded to Power User, Standard User (Enterprise) | 1 | |
| Department-Level Controls | Department heads view/manage team workflows; optional approval workflows | 2 | |
| Personal-to-Team Conversion | One-click conversion of personal workflows to team projects; automatic file migration | 2 | |
| Team Analytics | Team-specific usage dashboards; metrics by individual team member | 2 | |

---

### SECURITY 

| Feature | Description | Phase | Status |
|---------|-------------|-------|--------|
| OAuth 2.0 Authentication | Secure credential management for integrations; per-user credential storage | 1 | |
| API Key Management | Centralized storage in Moku system; AES-256-GCM encryption; automatic rotation (90 days) | 1 | |
| SSO/SAML Authentication | OAuth 2.0 with Okta, Azure AD, Google; CSRF protection; JWT token management | 1 | |
| Secure Setting Storage | Save and load app settings from platform-supported encrypted storage | 1 | |
| Encryption at Rest & Transit | AES-256-GCM for cached data; TLS 1.3 for API calls | 1 | |
| Audit Logs | Complete activity trail (who, what, when); 2-year retention; export to CSV/JSON | 1 | |

---

### FILE MANAGEMENT AND FILE STORAGE SERVER

| Feature | Description | Phase | Status |
|---------|-------------|-------|--------|
| File Attachment Support | Attach media, documents, code files to prompts; drag-and-drop and paste support | 1 | |
| Upload/Download | Progress indicators for large files; retry logic on failures | 1 | |
| Personal Storage | Local filesystem for personal threads; encrypted at rest | 1 | |
| Project Storage | Use File storage Server for project files; accessible to all team members | 1 | |
| File Limits | 10MB per file, 50MB per message; quota enforcement per project | 1 | |
| Caching | Encrypted local cache for project files (3-day TTL); manual clear option | 1 | |
| Storage Server - Local | Develop storage server supporting docker volume or minio | 1 | |
| Storage Server Monitorring | Health check, integirty and capacity monitorring and alerting | 1 | |
| Storage Server - AWS S3 | Storage server supports S3 for file operations | 2 | |

---

### TOOL FUNCTIONS AND MCP

| Feature | Description | Phase | Status |
|---------|-------------|-------|--------|
| File Tool Functions | Add read folder, read text file and write text file operations | 1 | |
| Allowed Folder List (White list) | Allow user to specify allowable folders for tool functions | 1 | |
| Prohibited Folder List (Black list) | Configure folders that tool functions are not allowed to access | 1 | |
| Binary File Reading | Tool functions to read Word, Excel and PDF files | 1 | |
| Binary File Writing | Tool functions to write Word, Excel and PDF | 1 | |
| PowerPoint Read and Write | Tool functions or skills to read and write PowerPoint files | 1 | |
| Allowed Command List | List of commands available to the shell tool | 1 | |
| Basic Shell | INterim tool function to support shell operations (bassh and windows command prompt) | 1 | |
| Secure Shell | Implement internal shell with virtual file system (candidate mvdan). Disable basic shells. | 1 | |
| MCP Server Integration | 20+ pre-installed Model Context Protocol servers (Google, Slack, GitHub, data tools, etc.) | 2 | |
| Native Enterprise Integrations | Top 10 optimized connectors: Slack, Google Workspace, Microsoft 365, Salesforce, HubSpot, Notion, Jira, GitHub, Zoom, Zapier | 2 | |
| MCP Enterprise Controls (Post-MVP) | Whitelist/blacklist servers; approval workflows; security scanning; usage monitoring; data policies | 2 | |
| MCP Server Sandboxing | Each MCP server isolated in separate process; resource limits; no direct filesystem access | 2 | |
| MCP Monitoring (Post-MVP) | Dashboard showing active MCP connections, API call volume, error rates, top servers | 2 | |

---

### WORKFLOWS

| Feature | Description | Phase | Status |
|---------|-------------|-------|--------|
| Chat-to-Workflow Progression | Background agent  detects repetitive prompts; suggests automation with "Make this a workflow" button | 1 | |
| Workflow Templates (MVP) | 50+ curated templates across Marketing, Sales, Operations, Finance, HR departments | 2 | |
| Integration Actions | Discoverable action library; drag-and-drop in workflow builder; input/output mapping | 2 | |
| Template Activation | Activate templates via chat ("Set up [template name]"); guided setup flow | 2 | |
| Workflow Creation Methods | Multiple methods: chat-based conversion, AI-assisted creation, GUI builder, YAML editing (Post-MVP) | 2 | |
| Workflow Execution | Sequential and parallel step execution; real-time status tracking; results display | 2 | |
| Portable Workflow Engine | Cloud-portable architecture; zero Electron dependencies; runs locally or in cloud without modification | 2 | |
| Capability-Based Sandboxing | Workflows run with user's security context; capability tokens for filesystem, network, git access | 2 | |
| Workflow Marketplace (Post-MVP) | User publishing, security scanning, trust indicators, freemium pricing model | 2 | |
| My Workflows Project | Personal project automatically created for each user; stores personal workflows and installed templates | 2 | |
| Workflow Approval Controls | Admin approval for org-wide workflows with external integrations | 2 | |

---

### GOVERNANCE

| Feature | Description | Phase | Status |
|---------|-------------|-------|--------|
| Event Monitorring and Capture | Capture or filter process, system and user events related to governance | 1 | |
| Governance Data and Display | Reporting or dashboard of governance data | 2 | |
| Progressive Governance | Phase 1 (Pilot): permissive + monitoring. Phase 2 (Department): RBAC. Phase 3 (Enterprise): full controls | 2 | |
| Data Classification Policies | PII restrictions; geo-restrictions (GDPR); workflow-level access controls | 2 | |
| SOC 2 Type II Alignment | Encryption, audit logs, RBAC, secure credential storage | 2 | |

---

### ANALYTICS & REPORTING

| Feature | Description | Phase | Status |
|---------|-------------|-------|--------|
| Admin Adoption Dashboard | Real-time metrics: active users, workflows created, executions, estimated time saved | 2 | |
| Usage Analytics | Daily active users, execution trends, top workflows, department adoption rates | 2 | |
| Department Dashboards | Team-specific metrics; time savings per team member; workflow sharing activity | 2 | |
| Security Monitoring | Failed authentication attempts, unusual usage patterns, credential expiration alerts | 2 | |
| Compliance Reports | Pre-built reports (Monthly Usage, Department Adoption, Security Audit); export formats (CSV/JSON/PDF) | 2 | |


---

## Vocabulary

| Term | Definition |
|------|-----------|
| **Branch** | Alternative conversation path created via "Retry" with modified prompts |
| **Project** | Shared workspace containing threads, workflows, and files |
| **Workflow** | Reusable multi-step AI automation task |
| **Template** | Pre-built workflow marked as reusable and forkable |
| **Chat-to-Workflow** | Platform automatically detects repetitive prompts and suggests automation |
| **MCP** | Model Context Protocol; open ecosystem of 257+ community servers for AI integrations |
| **Native Integration** | Optimized API connector for enterprise applications |
| **RBAC** | Role-Based Access Control; user permissions based on assigned roles |
| **Presigned URL** | Time-limited URL for direct file access to cloud storage |
| **Progressive Governance** | Controls scale from permissive (pilot phase) to restricted (enterprise phase) |
| **Portable Engine** | Workflow architecture that runs identically in local desktop or cloud environments |

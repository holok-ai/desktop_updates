# Product Requirements Document: Holokai Desktop Phase 2

**Document Version:** 1.0
**Date:** 2025-11-25
**Status:** Draft
**Author:** Product Team
**Stakeholders:** Engineering, Design, QA

---

## 1. Executive Summary

### 1.1 Product Overview

Holokai Desktop Phase 2 extends the existing Electron-based desktop application with collaborative features, workflow automation, and enhanced thread management. Building on the Phase 1 foundation (basic chat, SSO authentication, local caching), Phase 2 introduces project-based collaboration, reusable workflow templates, message branching for conversation exploration, and insights/reporting capabilities.

### 1.2 Vision Statement

Enable teams to collaborate on AI-powered conversations and automate repetitive AI tasks through a secure, performant desktop application that works seamlessly both online and offline.

### 1.3 Business Objectives

| Objective | Target | Measurement |
|-----------|--------|-------------|
| Increase team adoption | 40% of users in shared projects | Project membership metrics |
| Reduce repetitive prompting | 25% reduction in duplicate prompts | Workflow execution vs manual prompts |
| Improve conversation quality | 15% increase in continued threads | Thread length and retry usage |
| Enterprise readiness | SOC 2 compliance requirements met | Security audit |

### 1.4 Success Metrics

- **Adoption:** 50% of active users create or join a project within 30 days
- **Engagement:** Average 3+ threads per project per week
- **Efficiency:** 20+ workflow executions per active workflow
- **Retention:** 80% monthly active user retention

---

## 2. User Personas

### 2.1 Individual Professional (Alex)

**Profile:** Software developer, data analyst, or content creator who uses AI daily for work tasks.

**Goals:**
- Quickly access previous AI conversations
- Explore alternative responses without losing context
- Reuse successful prompt patterns

**Pain Points:**
- Loses track of useful conversations
- Has to re-type similar prompts repeatedly
- Can't easily compare different AI responses

**Phase 2 Value:** Thread branching for exploration, personal workflows for automation, improved organization.

### 2.2 Team Lead (Jordan)

**Profile:** Engineering manager or team lead coordinating AI usage across a team.

**Goals:**
- Share useful AI conversations with team
- Standardize prompt patterns across team
- Track team AI usage and effectiveness

**Pain Points:**
- No visibility into how team uses AI
- Knowledge trapped in individual accounts
- Inconsistent AI interaction quality

**Phase 2 Value:** Projects for collaboration, shared workflows, insights dashboard.

### 2.3 Enterprise Admin (Morgan)

**Profile:** IT administrator or security officer responsible for AI tool governance.

**Goals:**
- Ensure secure AI usage
- Maintain compliance and audit trails
- Control access and permissions

**Pain Points:**
- Shadow AI usage without oversight
- No centralized access control
- Difficult to audit AI interactions

**Phase 2 Value:** Role-based access control, audit-ready insights, SSO integration.

---

## 3. Feature Summary

### 3.1 Feature Overview

| Feature | Priority | Complexity | Phase 2 Scope |
|---------|----------|------------|---------------|
| Thread Management with Branching | P0 | Medium | Full |
| Project Collaboration | P0 | High | Full |
| Workflow Templates | P1 | High | Core features |
| Insights Dashboard | P1 | Medium | Basic metrics |
| File Attachments (Project) | P1 | Medium | Full |
| Desktop Core Enhancements | P0 | Low | Full |
| UI/UX Improvements | P1 | Medium | Full |
| Real-time Collaboration | P2 | High | Polling only (WebSocket deferred) |

### 3.2 Feature Breakdown

#### 3.2.1 Thread Management with Branching (P0)

**Description:** Enhanced conversation management with tree-based message structure supporting retry/exploration branches.

**User Stories:**
- As a user, I want to retry a prompt with modifications without losing the original response
- As a user, I want to explore up to 2 alternative paths from any point in a conversation
- As a user, I want threads to auto-generate titles after the second exchange
- As a user, I want to copy a previous prompt to quickly reuse it

**Key Requirements:**
- Message tree structure via `parentMessageId`
- Maximum 2 retry branches per divergence point (branchIndex 0-2)
- Visual lane-based UI for viewing branches
- Auto-title generation after 2nd exchange (max 50 chars)
- Copy prompt to input box functionality
- Copy response/code to system clipboard

**Acceptance Criteria:**
- [ ] User can click "Retry" on any user message to create a branch
- [ ] Branch limit (2) is enforced with clear user feedback
- [ ] Context assembly follows the correct branch path
- [ ] Titles auto-generate and can be manually edited
- [ ] All clipboard operations work across platforms

#### 3.2.2 Project Collaboration (P0)

**Description:** Shared workspaces for team collaboration on AI conversations and workflows.

**User Stories:**
- As a team lead, I want to create a project and invite team members
- As a team member, I want to view and contribute to shared conversations
- As an admin, I want to control who can create, edit, or delete content
- As a user, I want to move personal threads into a project

**Key Requirements:**
- Project CRUD with metadata (color, icon, tags)
- Three member roles: View, Edit, Admin
- Thread ownership transfer (personal ↔ project)
- Project-level file storage via Storage Service
- Cache invalidation via polling (30-second interval)

**Role Permissions:**

| Action | View | Edit | Admin |
|--------|------|------|-------|
| Read threads/workflows/files | ✓ | ✓ | ✓ |
| Issue prompts | ✓ | ✓ | ✓ |
| Create content | | ✓ | ✓ |
| Edit own content | | ✓ | ✓ |
| Delete own content | | ✓ | ✓ |
| Delete any content | | | ✓ |
| Manage members | | | ✓ |
| Project settings | | | ✓ |

**Acceptance Criteria:**
- [ ] Projects appear in sidebar with visual distinction
- [ ] Member invitation works via email or user search
- [ ] Role changes take effect immediately
- [ ] Thread move preserves all messages and attachments
- [ ] File storage correctly routes to Storage Service for project threads

#### 3.2.3 Workflow Templates (P1)

**Description:** Reusable AI task sequences that can be saved, shared, and executed.

**User Stories:**
- As a user, I want to save a multi-step AI interaction as a reusable template
- As a team member, I want to use workflows created by others
- As a user, I want to fork and customize a workflow template
- As a user, I want to see execution history and results

**Key Requirements:**
- Workflow definition: inputs, steps, outputs
- Personal vs project scope
- Template flag with versioning
- Fork capability with parent tracking
- Execution engine with status tracking
- Step-level results and timing

**Acceptance Criteria:**
- [ ] User can create workflow with defined inputs and steps
- [ ] Workflow executes steps in correct order (sequential/parallel)
- [ ] Execution status updates in real-time
- [ ] Fork creates independent copy with link to original
- [ ] Execution history shows all runs with results

#### 3.2.4 Insights Dashboard (P1)

**Description:** Analytics and reporting for AI usage patterns and team activity.

**User Stories:**
- As a user, I want to see my AI usage summary
- As a team lead, I want to understand team activity patterns
- As an admin, I want to generate audit reports

**Key Requirements:**
- Dashboard with summary metrics
- User activity over time (prompts, tokens, threads)
- Thread topic analysis
- Project/workflow activity metrics
- Desktop info (cache, storage, version)
- Report writer with export (CSV, JSON, PDF)

**Acceptance Criteria:**
- [ ] Dashboard loads within 2 seconds
- [ ] Activity charts show correct time ranges
- [ ] Reports can be saved and re-run
- [ ] Export generates valid files in all formats

#### 3.2.5 File Attachments (P1)

**Description:** File upload/download for thread messages with appropriate storage routing.

**User Stories:**
- As a user, I want to attach files to my prompts
- As a user, I want to download files from AI responses
- As a team member, I want to access files attached by others

**Key Requirements:**
- Personal threads: local filesystem storage
- Project threads: Storage Service with presigned URLs
- Supported types: images, documents, code files
- Size limits: 10MB per file, 50MB per message
- Local cache for project files (encrypted, 3-day TTL)

**Acceptance Criteria:**
- [ ] Drag-and-drop file attachment works
- [ ] Paste image from clipboard works
- [ ] Project files accessible to all members
- [ ] Large files show upload progress
- [ ] Cached files are encrypted at rest

#### 3.2.6 Desktop Core Enhancements (P0)

**Description:** Platform infrastructure improvements for reliability and user experience.

**User Stories:**
- As a user, I want to receive notifications for important events
- As a user, I want my window position and preferences remembered
- As a user, I want to open threads directly from links

**Key Requirements:**
- System notifications (native OS)
- Toast notifications (in-app)
- Window state persistence
- User preferences persistence
- Deep linking (`holokai://` protocol)
- Auto-updates with user control
- Offline queue for operations

**Deep Link Routes:**
- `holokai://thread/{id}` - Open thread
- `holokai://project/{id}` - Open project
- `holokai://workflow/{id}` - Open workflow
- `holokai://settings` - Open settings
- `holokai://invite/{code}` - Accept invitation

**Acceptance Criteria:**
- [ ] Notifications appear for new messages, mentions, invites
- [ ] Window restores to previous size/position
- [ ] Deep links work when app is running or closed
- [ ] Auto-update prompts user before installing
- [ ] Offline operations sync when connection restored

#### 3.2.7 UI/UX Improvements (P1)

**Description:** Enhanced user interface following existing design system.

**User Stories:**
- As a user, I want keyboard shortcuts for common actions
- As a user, I want a system tray icon for quick access
- As a user, I want accessible UI that works with screen readers

**Key Requirements:**
- Application menu bar (File, Edit, View, Window, Help)
- System tray with status and quick actions
- Keyboard shortcuts (new thread, search, settings, etc.)
- Drag-and-drop (files, thread reordering)
- Native dialogs (file picker, confirm)
- WCAG 2.1 AA accessibility baseline

**Design System Alignment:**
- Primary color: `#3b82f6`
- Font: Inter, system-ui fallback
- Border radius: 6px
- Dark mode: class-based (`.dark`)
- Component library: PrimeNG Lara Light Blue

**Acceptance Criteria:**
- [ ] All shortcuts work on Windows, macOS, Linux
- [ ] System tray shows connection status
- [ ] Focus management supports keyboard navigation
- [ ] Color contrast meets WCAG AA standards

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
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                  │
│         │                   │                   │                           │
│         └───────────────────┼───────────────────┘                           │
│                             │                                                │
│                    ┌────────┴────────┐                                      │
│                    │  DESKTOP APP    │                                      │
│                    │ (Electron/Svelte)│                                      │
│                    └─────────────────┘                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Technology Stack

| Layer | Technology |
|-------|------------|
| Desktop Framework | Electron 39.x |
| UI Framework | Svelte 5.x |
| Styling | Tailwind CSS 3.4.x + PrimeNG |
| State | Svelte Stores |
| Backend | Spring Boot (Moku API) |
| Database | PostgreSQL |
| File Storage | S3/Azure Blob (via Storage Service) |
| Authentication | SSO with JWT |

### 4.3 Data Architecture

**Storage Split:**

| Data Type | Personal | Project |
|-----------|----------|---------|
| Thread metadata | Local + Moku | Moku API |
| Messages | Local (encrypted) | Moku API (cached) |
| Files | Local filesystem | Storage Service |

**Cache Strategy:**

| Cache | Personal | Project |
|-------|----------|---------|
| Thread list | LRU, no TTL | LRU + 5min TTL |
| Messages | LRU, no TTL | LRU + 2min TTL |
| Files | Permanent | 3-day TTL, encrypted |

### 4.4 Security Architecture

- **Authentication:** SSO exchange code flow with CSRF protection
- **Token Storage:** Electron safeStorage (OS keychain)
- **Data Encryption:** AES-256-GCM for cached messages/files
- **Key Rotation:** 8-hour encryption key rotation
- **IPC Security:** contextIsolation, sandbox, CSP

---

## 5. Dependencies and Integrations

### 5.1 Platform Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| Holo API | LLM prompt execution, streaming | Existing |
| Moku API | User/project/thread management | Requires updates |
| Storage Service | Project file storage | Existing |
| SSO Provider | Authentication | Existing |

### 5.2 Moku API Updates Required

New endpoints needed:
- Project CRUD and member management
- Thread branching support (parentMessageId, branchIndex)
- Workflow CRUD and execution
- Insights/reporting queries
- Project update polling

Database changes:
- Update `desktop_threads` with ownership columns
- Update `desktop_messages` with branching columns
- New tables: `projects`, `project_members`, `workflows`, `workflow_executions`, `saved_reports`

### 5.3 Third-Party Dependencies

| Dependency | Purpose | License |
|------------|---------|---------|
| Electron | Desktop framework | MIT |
| Svelte | UI framework | MIT |
| Tailwind CSS | Styling | MIT |
| PrimeNG | Components | MIT |
| better-sqlite3 | Local cache | MIT |

---

## 6. Release Scope

### 6.1 MVP (Phase 2.0)

**In Scope:**
- Thread branching (max 2 retries)
- Auto-title generation
- Clipboard operations
- Project CRUD
- Member roles (view/edit/admin)
- Thread move (personal ↔ project)
- Project file storage
- Basic insights dashboard
- User activity metrics
- Notifications (system + toast)
- State persistence
- Deep linking
- Menu bar and system tray
- Keyboard shortcuts

**Out of Scope (Future):**
- Real-time collaboration (WebSocket)
- Advanced workflow orchestration (MCP integration)
- Topic analysis (requires ML)
- Report scheduling
- Organization-level projects
- Project templates
- Presence indicators

### 6.2 Release Phases

| Phase | Features | Target |
|-------|----------|--------|
| 2.0-alpha | Thread branching, clipboard, core desktop | Week 1-2 |
| 2.0-beta | Projects, members, file storage | Week 3-4 |
| 2.1 | Workflows (basic), insights | Week 5-6 |
| 2.2 | UI polish, accessibility, performance | Week 7-8 |

### 6.3 Feature Flags

| Flag | Description | Default |
|------|-------------|---------|
| `enableBranching` | Thread retry branching | true |
| `enableProjects` | Project collaboration | true |
| `enableWorkflows` | Workflow templates | false (beta) |
| `enableInsights` | Insights dashboard | true |
| `enablePolling` | Project cache polling | true |

---

## 7. Risks and Mitigations

### 7.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Cache invalidation delays | Users see stale data | Medium | 30s polling + manual refresh |
| Large thread performance | UI lag with 1000+ messages | Medium | Virtual scrolling, pagination |
| File upload failures | Lost work | Low | Retry logic, progress feedback |
| Encryption key loss | Data inaccessible | Low | Key derivation from credentials |

### 7.2 Product Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Low project adoption | Feature underutilized | Medium | Onboarding flow, templates |
| Complex branching UI | User confusion | Medium | Clear visual design, tooltips |
| Workflow learning curve | Low workflow usage | High | Simple templates, wizard |

### 7.3 Dependencies Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Moku API delays | Feature blocked | Medium | Parallel development, mocks |
| Storage Service changes | Integration breaks | Low | API versioning, contracts |

---

## 8. Open Questions

| Question | Owner | Status |
|----------|-------|--------|
| Organization-level project visibility rules? | Product | Deferred |
| Maximum project size limits? | Engineering | TBD |
| Workflow step types beyond LLM calls? | Product | Deferred |
| Real-time presence requirements? | Product | Deferred |
| Audit log retention period? | Security | TBD |

---

## 9. Appendices

### 9.1 Related Documents

| Document | Description |
|----------|-------------|
| `thread-management-requirements-2025-11-25.md` | Thread branching details |
| `project-requirements-2025-11-25.md` | Project collaboration details |
| `thread-loading-caching-requirements-2025-11-25.md` | Cache architecture |
| `insights-requirements-2025-11-25.md` | Dashboard and reporting |
| `desktop-core-requirements-2025-11-25.md` | Platform infrastructure |
| `ui-ux-requirements-2025-11-25.md` | UI/UX specifications |
| `architecture-2025-11-25.md` | Technical architecture |
| `moku-api-specification-2025-11-25.md` | API specification |
| `database-schema-2025-11-25.md` | Database schema |

### 9.2 Glossary

| Term | Definition |
|------|------------|
| Branch | Alternative conversation path from a retry point |
| Branch Index | 0=original, 1-2=retry branches |
| Project | Shared workspace containing threads, workflows, files |
| Workflow | Reusable multi-step AI task sequence |
| Template | Workflow marked as reusable/forkable |
| Fork | Copy of a workflow with link to original |
| Presigned URL | Time-limited URL for direct file access |
| TTL | Time-to-live for cache entries |
| LRU | Least Recently Used cache eviction policy |

### 9.3 Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-25 | Product Team | Initial draft |

---

_Product Requirements Document - Holokai Desktop Phase 2_

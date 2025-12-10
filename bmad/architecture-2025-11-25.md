# Holokai Desktop Architecture

**Date:** 2025-11-25 (Updated: 2025-11-26)
**Version:** 2.1
**Status:** Architecture Design
**Phase:** Enterprise MVP

## Document Overview

This document describes the complete system architecture for Holokai Desktop Enterprise MVP, incorporating:
- Tool orchestration and workflows
- Project collaboration with file sharing
- Insights and reporting
- Enhanced thread management with branching
- **Chat-to-Workflow progression** (Enterprise MVP differentiator)
- **MCP integration ecosystem** (Enterprise MVP differentiator)

**Builds Upon:** `ai/desktop-system-architecture.md` (Phase 1 v1.0.3)

**Companion Documents:**
- **`chat-to-workflow-architecture-2025-11-26.md`** - Detailed architecture for chat-to-workflow progression (Feature #1: "Make this a workflow" button, Feature #2: Automatic suggestions, Feature #3: Template marketplace)
- **`mcp-integration-architecture-2025-11-26.md`** - Detailed architecture for MCP integration with organizational repository model (Three-tier: Holo → Moku → Desktop)
- **`architecture-validation-report-2025-11-26.md`** - Gap analysis vs. Enterprise MVP PRD

---

## 1. High-Level Architecture

### 1.1 Platform Services

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HOLOKAI PLATFORM SERVICES                            │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │    HOLO API      │  │    MOKU API      │  │  STORAGE SERVICE │          │
│  │  (Chat/Prompts)  │  │   (Management)   │  │     (Files)      │          │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤          │
│  │ • Prompt routing │  │ • Users/Orgs     │  │ • File upload    │          │
│  │ • Streaming      │  │ • Projects       │  │ • Presigned URLs │          │
│  │ • Audit logging  │  │ • Threads        │  │ • Access control │          │
│  │ • Model access   │  │ • Workflows      │  │ • Blob adapters  │          │
│  │                  │  │ • Insights API   │  │                  │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│           │                     │                     │                     │
│           └─────────────────────┼─────────────────────┘                     │
│                                 │                                            │
│                    ┌────────────┴────────────┐                              │
│                    │     DESKTOP APP         │                              │
│                    │  (Electron + Svelte)    │                              │
│                    └─────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Service Responsibilities

| Service | Responsibility | Technology |
|---------|---------------|------------|
| **Holo API** | LLM prompt execution, streaming, audit logging | API Gateway |
| **Moku API** | Users, orgs, projects, threads, workflows, insights | Spring Boot REST |
| **Storage Service** | File upload/download, presigned URLs, blob storage | REST + S3/Azure/MinIO |
| **Desktop App** | UI, local caching, orchestration | Electron + Svelte |

---

## 2. Desktop Application Architecture

### 2.1 Technology Stack (Unchanged from Phase 1)

| Layer | Technology | Version |
|-------|------------|---------|
| Desktop Framework | Electron | 39.x |
| UI Framework | Svelte | 5.x |
| CSS Framework | Tailwind CSS | 3.4.x |
| Component Library | PrimeNG | 17.x |
| State Management | Svelte Stores | Built-in |
| Styling | CSS Custom Properties | - |
| Language | TypeScript | 5.x |

### 2.2 Process Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MAIN PROCESS (Node.js)                               │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     CORE SERVICES                                   │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │     │
│  │  │ AuthService │ │TokenRefresh │ │ StateStore  │ │NotificationSvc│  │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     API CLIENTS                                     │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                   │     │
│  │  │ HoloAPI     │ │ MokuAPI     │ │ StorageAPI  │                   │     │
│  │  │ Client      │ │ Client      │ │ Client      │                   │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                   │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     DOMAIN SERVICES                                 │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │     │
│  │  │ThreadService│ │ProjectSvc   │ │WorkflowSvc  │ │InsightsSvc  │  │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                   │     │
│  │  │ FileService │ │ToolOrchest │ │DeepLinkHndlr│                   │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                   │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     CACHE LAYER                                     │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │     │
│  │  │ThreadCache  │ │ProjectCache │ │ FileCache   │ │WorkflowCache│  │     │
│  │  │ (Dual LRU)  │ │   (LRU)     │ │(Encrypted)  │ │   (LRU)     │  │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     INFRASTRUCTURE                                  │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                   │     │
│  │  │SecureStorage│ │Encryption   │ │ConnectionMgr│                   │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                   │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                       RENDERER PROCESS (Svelte)                              │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     PAGES / ROUTES                                  │     │
│  │  /login │ /home │ /thread/:id │ /project/:id │ /workflow/:id       │     │
│  │  /insights │ /settings                                              │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     UI COMPONENTS                                   │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │     │
│  │  │ Sidebar     │ │ ThreadList  │ │ ChatWindow  │ │MessageBranch│  │     │
│  │  │ (Primary/   │ │             │ │             │ │ Lanes       │  │     │
│  │  │  Secondary) │ │             │ │             │ │             │  │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │     │
│  │  │ ProjectView │ │WorkflowEdit │ │ Dashboard   │ │ ReportWriter│  │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     STORES (Svelte)                                 │     │
│  │  authStore │ threadStore │ projectStore │ workflowStore            │     │
│  │  settingsStore │ notificationStore                                  │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 IPC API (Context Bridge)

The desktop app exposes a comprehensive IPC API through Electron's context bridge, providing secure communication between the renderer and main processes. The API is organized into 11 namespaces covering authentication, threads, projects, workflows, files, insights, preferences, notifications, system, dialogs, and clipboard operations.

**Key API Namespaces:**
- **auth**: SSO login/logout, token management, session expiration events
- **threads**: Thread CRUD, prompt submission with branching, title generation
- **projects**: Project management, member operations, update polling
- **workflows**: Workflow CRUD, execution, forking, real-time execution updates
- **files**: Upload/download, project storage operations, cache management
- **insights**: Dashboard data, activity metrics, report generation/export
- **preferences**: User settings management, theme change notifications
- **notifications**: History, read status management, real-time notification events
- **system**: App info, logs, update checks and installation
- **dialog**: File open/save dialogs, confirmation dialogs
- **clipboard**: Text and formatted content operations

**→ See detailed IPC handler definitions:** [`architecture-detailed-code-2025-11-25.md` § 1.1](./architecture-detailed-code-2025-11-25.md#11-context-bridge-preload)

---

## 3. Data Architecture

### 3.1 Data Model Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATA MODEL RELATIONSHIPS                            │
│                                                                              │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │    USER     │────────►│   PROJECT   │◄────────│   MEMBER    │           │
│  └─────────────┘  owns   └─────────────┘  joins  └─────────────┘           │
│         │                       │                                           │
│         │ owns                  │ contains                                  │
│         ▼                       ▼                                           │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │   THREAD    │◄────────│   THREAD    │────────►│   MESSAGE   │           │
│  │ (personal)  │         │  (project)  │  has    │   (tree)    │           │
│  └─────────────┘         └─────────────┘         └─────────────┘           │
│         │                       │                       │                   │
│         │                       │                       │ has               │
│         ▼                       ▼                       ▼                   │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │    FILE     │         │    FILE     │         │ ATTACHMENT  │           │
│  │   (local)   │         │  (Storage)  │         │             │           │
│  └─────────────┘         └─────────────┘         └─────────────┘           │
│                                                                              │
│  ┌─────────────┐         ┌─────────────┐                                   │
│  │  WORKFLOW   │────────►│  EXECUTION  │                                   │
│  │ (template)  │  runs   │  (instance) │                                   │
│  └─────────────┘         └─────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Core Entities

The data model includes six primary entity types with well-defined relationships and behaviors:

**Core Entities:**
- **Thread & Message**: Support branching with tree structure (`parentMessageId`, `branchIndex`), auto-title generation, personal vs project types
- **Project & ProjectMember**: Multi-tenant project management with role-based access (view/edit/admin)
- **Workflow & WorkflowExecution**: Template-based workflows with execution tracking and forking support
- **FileAttachment & ProjectFile**: Split storage model (local for personal, remote for projects) with shared reference semantics

**Key Design Patterns:**
- **Branch Attachment Behavior**: Attachments use shared references (not copies) across retry branches - files are immutable once uploaded
  - Same attachments across branches = same `fileId` references
  - Removing attachment = exclude from new branch's array
  - Adding attachment = new `fileId` created
  - File deletion only when no message references exist
- **Storage Split**: Personal threads use local filesystem, project threads use Storage Service
- **UUID Generation**: Thread IDs are desktop-generated (UUID v4) for offline-first support
- **Auto-Titling**: Threads get titles automatically after 2nd message exchange

**→ See complete interface definitions:** [`architecture-detailed-code-2025-11-25.md` § 2](./architecture-detailed-code-2025-11-25.md#2-core-entity-interfaces)

### 3.3 Storage Split

| Data Type | Personal | Project |
|-----------|----------|---------|
| Thread metadata | ThreadRepository (cached) + Moku | Moku API (cached) |
| Messages | ThreadRepository (encrypted, compressed) | Moku API (cached) |
| File content | Local filesystem | Storage Service |
| File metadata | ThreadRepository | Moku API |
| Workflows | WorkflowRepository + Moku | Moku API |

### 3.4 ThreadRepository Architecture

The desktop uses a **ThreadRepository** instead of SQLite for local data persistence. This provides compression, encryption, and LRU cache management.

ThreadRepository provides compressed, encrypted local storage for personal threads with LRU cache management, lazy message loading (paginated in chunks of 50), and single-file storage format (.dat files).

**Key methods:** `getThread`, `saveThread`, `getMessages` (with pagination), cache management

**→ See ThreadRepository interface:** [`architecture-detailed-code-2025-11-25.md` § 2.1](./architecture-detailed-code-2025-11-25.md#21-thread-interfaces)

#### Storage Format

```
~/.holokai/
├── cache/
│   ├── threads/
│   │   ├── {threadId}.dat      # Compressed + encrypted thread + messages
│   │   └── ...
│   ├── index.json              # LRU index with access timestamps
│   └── cache.meta              # Cache statistics
└── config/
    └── preferences.json
```

#### Key Features

| Feature | Implementation |
|---------|----------------|
| **Compression** | gzip compression before encryption (typically 60-80% reduction) |
| **Encryption** | AES-256-GCM with key derived from user credentials |
| **LRU Cache** | Max entries configurable (default: 100 threads), evicts least recently used |
| **Lazy Loading** | Messages loaded in chunks of 50 for large threads |
| **Single File** | Each thread stored as single `.dat` file (metadata + all messages) |

#### Lazy Loading for Large Threads

For threads with many messages, the repository supports pagination:

```typescript
// Initial load - get most recent 50 messages
const result = await threadRepo.getMessages(threadId, { limit: 50 });
// result: { messages: [...], hasMore: true, cursor: "msg-id-50" }

// Load more - get next 50 messages
const moreResult = await threadRepo.getMessages(threadId, {
  limit: 50,
  before: result.cursor
});
// result: { messages: [...], hasMore: true, cursor: "msg-id-100" }
```

#### Cache Policy

| Condition | Action |
|-----------|--------|
| Cache exceeds max entries | Evict LRU threads until under limit |
| Thread accessed | Update access timestamp, move to front of LRU |
| Thread modified | Save immediately, update access timestamp |
| User logout | Clear all cached data |
| Manual clear | User can clear cache from Settings |

---

## 4. Cache Architecture

### 4.1 Dual Cache Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CACHE ARCHITECTURE                                  │
│                                                                              │
│  PERSONAL CACHES (No TTL)              PROJECT CACHES (With TTL)            │
│  ─────────────────────────             ─────────────────────────            │
│                                                                              │
│  ┌─────────────────────┐               ┌─────────────────────┐              │
│  │ Thread Cache        │               │ Thread Cache        │              │
│  │ • Max: 100 threads  │               │ • Max: 50/project   │              │
│  │ • LRU eviction      │               │ • TTL: 5 minutes    │              │
│  │ • No TTL            │               │ • LRU eviction      │              │
│  └─────────────────────┘               └─────────────────────┘              │
│                                                                              │
│  ┌─────────────────────┐               ┌─────────────────────┐              │
│  │ Message Cache       │               │ Message Cache       │              │
│  │ • Max: 1000 total   │               │ • Max: 500/project  │              │
│  │ • LRU eviction      │               │ • TTL: 2 minutes    │              │
│  │ • AES-256 encrypted │               │ • AES-256 encrypted │              │
│  │ • gzip compressed   │               │ • gzip compressed   │              │
│  └─────────────────────┘               └─────────────────────┘              │
│                                                                              │
│  ┌─────────────────────┐               ┌─────────────────────┐              │
│  │ File Cache          │               │ File Cache          │              │
│  │ • Local filesystem  │               │ • Max: configurable │              │
│  │ • Permanent         │               │ • TTL: 3 days       │              │
│  │ • No encryption     │               │ • AES-256 encrypted │              │
│  └─────────────────────┘               └─────────────────────┘              │
│                                                                              │
│  SHARED CACHES                                                               │
│  ─────────────                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐                           │
│  │ Project Cache       │  │ Workflow Cache      │                           │
│  │ • Max: 50 projects  │  │ • Max: 100          │                           │
│  │ • TTL: 10 minutes   │  │ • TTL: 10 minutes   │                           │
│  └─────────────────────┘  └─────────────────────┘                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Cache Invalidation

**TTL-Based (Project Data):**
- Thread list: 5 minutes
- Messages: 2 minutes
- Projects: 10 minutes
- Workflows: 10 minutes
- File cache: 3 days

**Polling (MVP):**
- Active project: poll every 30 seconds
- Check for updates since last poll
- Invalidate on changes detected

**Event-Based (Future - RabbitMQ):**
- Subscribe to project queue
- Real-time invalidation events
- Eliminate polling

---

## 5. Service Architecture

### 5.1 Main Process Services

The main process is organized into five layers: **Core** (auth, state, notifications), **API** (Holo, Moku, Storage clients), **Domain** (business logic services), **Cache** (with encryption), and **Infrastructure** (deep links, updates, tray).

**→ See complete service layer structure:** [`architecture-detailed-code-2025-11-25.md` § 3.1](./architecture-detailed-code-2025-11-25.md#31-service-layer-file-structure)

### 5.2 Thread Service (with Branching)

ThreadService manages thread lifecycle including creation, prompt submission with branching support, context assembly for branches, retry branch creation, auto-title generation, and thread migration between personal/project contexts.

**Key methods:** `createThread`, `submitPrompt`, `assembleContext`, `createRetry`, `generateTitle`, `moveThread`

**→ See ThreadService class definition:** [`architecture-detailed-code-2025-11-25.md` § 3.2](./architecture-detailed-code-2025-11-25.md#32-threadservice-class)

### 5.3 File Service (Storage Split)

FileService handles upload/download with automatic storage routing - personal threads use local filesystem, project threads use Storage Service with presigned URLs and encrypted local caching.

**Key features:** Storage type detection, presigned URL handling, encrypted cache layer, download resumption

**→ See FileService class definition:** [`architecture-detailed-code-2025-11-25.md` § 3.3](./architecture-detailed-code-2025-11-25.md#33-fileservice-class)

---

## 6. Workflow & Tool Orchestration

### 6.1 Execution Engine Architecture

The workflow execution engine uses **Desktop-Side Orchestration** with a **Function/Tool Calling Native** approach. The Desktop app runs workflows locally, step-by-step, with each step mapping to deterministic function calls.

#### Design Decisions

**Orchestration Location (Phase 2 MVP: Desktop-Side)**

| Approach | Phase | Decision |
|----------|-------|----------|
| **Desktop-Side Orchestration** | ✅ Phase 2 MVP | Simple, works offline, supports local tools (MCP, filesystem) |
| Hybrid (Desktop + Server) | Phase 3+ | Adds resumability across app restarts, server visibility |
| Server-Side (Moku Managed) | Future | For long-running workflows, requires worker infrastructure |

**Execution Architecture (Function/Tool Calling Native)**

Four architectures were evaluated:

| Architecture | Considered | Decision |
|--------------|------------|----------|
| **Function/Tool Calling Native** | ✅ Selected | Best fit - deterministic, maps to existing IPC, clear audit trail |
| Progressive Prompt Injection | Evaluated | Too reliant on LLM following instructions; less deterministic |
| RAG-Based Skill Router | Evaluated | Overkill for defined workflows; better for skill discovery |
| ReAct Agent Loop | Evaluated | Higher token cost; better for open-ended tasks than predefined steps |

#### MVP Constraints

- Workflows execute entirely on Desktop
- If app closes mid-execution, workflow is marked failed (user can restart)
- Best suited for short workflows (1-10 steps)
- All local tools (MCP servers, file system) fully supported

#### Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW EXECUTION ENGINE (Desktop)                       │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                    WorkflowExecutionEngine                          │     │
│  │                                                                      │     │
│  │  1. Load workflow definition                                        │     │
│  │  2. Resolve input parameters                                        │     │
│  │  3. Create execution record (Moku API)                              │     │
│  │  4. For each step in order:                                         │     │
│  │     ├── Evaluate condition (if present)                             │     │
│  │     ├── Resolve input variable references                           │     │
│  │     ├── Execute step by type (tool/mcp/prompt/parallel)            │     │
│  │     ├── Store output in variable context                            │     │
│  │     ├── Write audit event (Moku API)                                │     │
│  │     └── Update execution progress                                   │     │
│  │  5. Mark execution complete/failed                                  │     │
│  │                                                                      │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  Step Executors:                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ ToolExecutor│ │ MCPExecutor │ │PromptExecutor│ │ParallelExec │           │
│  │             │ │             │ │             │ │             │           │
│  │ Native tools│ │ MCP servers │ │ Holo API    │ │ Promise.all │           │
│  │ via IPC     │ │ via stdio   │ │ LLM call    │ │ fan-out     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Core Implementation

```typescript
// src-electron/services/domain/workflow-execution.engine.ts

interface ExecutionContext {
  executionId: string;
  workflowId: string;
  variables: Map<string, unknown>;  // Step outputs stored here
  auditEvents: AuditEvent[];
}

class WorkflowExecutionEngine {
  constructor(
    private toolExecutor: ToolExecutor,
    private mcpExecutor: MCPExecutor,
    private promptExecutor: PromptExecutor,
    private mokuAPI: MokuAPIClient,
    private auditService: AuditService
  ) {}

  async execute(
    workflow: Workflow,
    inputs: Record<string, unknown>,
    threadId: string
  ): Promise<WorkflowExecution> {
    // 1. Create execution record
    const execution = await this.mokuAPI.createExecution({
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      threadId,
      parameterValues: inputs,
      status: 'running'
    });

    const context: ExecutionContext = {
      executionId: execution.id,
      workflowId: workflow.id,
      variables: new Map(Object.entries(inputs)),
      auditEvents: []
    };

    // 2. Write workflow_start audit event
    await this.auditService.write({
      executionId: execution.id,
      threadId,
      type: 'workflow_start',
      payload: {
        workflowId: workflow.id,
        workflowName: workflow.name,
        workflowVersion: workflow.version,
        parameters: inputs
      }
    });

    try {
      // 3. Execute steps in order
      for (const step of workflow.steps.sort((a, b) => a.order - b.order)) {
        await this.executeStep(step, context, threadId);
      }

      // 4. Mark complete
      await this.mokuAPI.updateExecution(execution.id, {
        status: 'completed',
        completedAt: new Date().toISOString()
      });

      await this.auditService.write({
        executionId: execution.id,
        threadId,
        type: 'workflow_complete',
        payload: {
          workflowId: workflow.id,
          status: 'completed',
          totalSteps: workflow.steps.length
        }
      });

      return { ...execution, status: 'completed' };

    } catch (error) {
      // 5. Handle failure
      await this.mokuAPI.updateExecution(execution.id, {
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date().toISOString()
      });

      await this.auditService.write({
        executionId: execution.id,
        threadId,
        type: 'workflow_failed',
        payload: { error: error.message }
      });

      throw error;
    }
  }

  private async executeStep(
    step: WorkflowStep,
    context: ExecutionContext,
    threadId: string
  ): Promise<void> {
    // Evaluate condition if present
    if (step.condition && !this.evaluateCondition(step.condition, context)) {
      return; // Skip step
    }

    // Resolve input variable references (e.g., "{{ticketId}}" → actual value)
    const resolvedInputs = this.resolveInputs(step.inputs, context);

    // Write step_start event
    await this.auditService.write({
      executionId: context.executionId,
      threadId,
      type: 'workflow_step_start',
      payload: { stepId: step.id, stepName: step.name, stepType: step.type }
    });

    const startTime = Date.now();
    let output: unknown;

    // Execute by type
    switch (step.type) {
      case 'tool':
        output = await this.toolExecutor.execute(step.toolId!, resolvedInputs);
        break;

      case 'mcp':
        output = await this.mcpExecutor.execute(
          step.mcpServer!,
          step.mcpCommand!,
          resolvedInputs
        );
        break;

      case 'prompt':
        output = await this.promptExecutor.execute(
          step.promptTemplate!,
          resolvedInputs,
          threadId
        );
        break;

      case 'parallel':
        output = await Promise.all(
          step.parallelSteps!.map(s => this.executeStep(s, context, threadId))
        );
        break;

      case 'condition':
        // Condition-only step (branching logic)
        break;
    }

    // Store output if variable name specified
    if (step.outputVariable && output !== undefined) {
      context.variables.set(step.outputVariable, output);
    }

    // Write step_complete event
    await this.auditService.write({
      executionId: context.executionId,
      threadId,
      type: 'workflow_step_complete',
      payload: {
        stepId: step.id,
        stepName: step.name,
        status: 'completed',
        durationMs: Date.now() - startTime,
        output: step.outputVariable ? { [step.outputVariable]: output } : undefined
      }
    });
  }

  private resolveInputs(
    inputs: Record<string, string>,
    context: ExecutionContext
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        const varName = value.slice(2, -2);
        resolved[key] = context.variables.get(varName);
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  private evaluateCondition(condition: string, context: ExecutionContext): boolean {
    // Simple condition evaluation (e.g., "ticketInfo.status === 'open'")
    // Uses safe evaluation with context variables
    try {
      const fn = new Function(...context.variables.keys(), `return ${condition}`);
      return fn(...context.variables.values());
    } catch {
      return false;
    }
  }
}
```

#### Step Executors

Three executor classes handle workflow steps: **ToolExecutor** (native Electron tools via IPC), **MCPExecutor** (Model Context Protocol server commands), and **PromptExecutor** (LLM calls via Holo API with template variable resolution).

**→ See executor class implementations:** [`architecture-detailed-code-2025-11-25.md` § 4](./architecture-detailed-code-2025-11-25.md#4-workflow-executors)

#### Error Handling & Recovery

| Scenario | Behavior |
|----------|----------|
| Step fails with `onError: 'stop'` | Workflow marked failed, execution stops |
| Step fails with `onError: 'skip'` | Step skipped, continue to next step |
| Step fails with `onError: 'retry'` | Retry up to 3 times with exponential backoff |
| App closes mid-execution | Execution marked 'failed', can be restarted manually |
| Network error | Show error to user, allow manual retry |

#### Phase 3: Hybrid Orchestration

Phase 3 will add **Hybrid (Desktop + Server Coordination)** for improved resilience:

```
Desktop                         Moku API
    │                              │
    ├── POST /execute ────────────►│ (create execution record)
    │                              │
    ├── Execute step 1             │
    ├── PUT /step-complete ───────►│ (checkpoint progress)
    │                              │
    │   [App closes]               │
    │                              │
    │   [App reopens]              │
    ├── GET /execution ───────────►│
    │   ◄──── Resume from step 2 ──┤
    │                              │
    └── Continue execution         │
```

**Phase 3+ Enhancements:**
- **Resumable executions**: Checkpoint state to Moku, resume on app restart
- **Server visibility**: Track all executions across devices
- **Server-side execution**: Moku workers for long-running workflows (Phase 4+)
- **ReAct mode**: Optional LLM-driven step selection for complex tasks

### 6.2 Orchestration Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     TOOL ORCHESTRATION LAYER                                 │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                    TOOL ORCHESTRATOR                                │     │
│  │                                                                      │     │
│  │  ┌─────────────────────────────────────────────────────────────┐   │     │
│  │  │              WORKFLOW PLANNER                                │   │     │
│  │  │   Natural Language → Execution Plan                          │   │     │
│  │  └─────────────────────────────────────────────────────────────┘   │     │
│  │                              │                                      │     │
│  │                              ▼                                      │     │
│  │  ┌─────────────────────────────────────────────────────────────┐   │     │
│  │  │              EXECUTION ENGINE                                │   │     │
│  │  │   Sequential │ Parallel │ Fan-out                           │   │     │
│  │  └─────────────────────────────────────────────────────────────┘   │     │
│  │                              │                                      │     │
│  │          ┌───────────────────┼───────────────────┐                 │     │
│  │          ▼                   ▼                   ▼                 │     │
│  │  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │     │
│  │  │Native Tool  │     │ MCP Server  │     │   LLM Call  │          │     │
│  │  │  Manager    │     │  Manager    │     │             │          │     │
│  │  └─────────────┘     └─────────────┘     └─────────────┘          │     │
│  │          │                   │                   │                 │     │
│  │          ▼                   ▼                   ▼                 │     │
│  │  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │     │
│  │  │FileToolSvc  │     │ GitHub MCP  │     │  Holo API   │          │     │
│  │  │ShellToolSvc │     │ Database MCP│     │             │          │     │
│  │  │  ...        │     │  ...        │     │             │          │     │
│  │  └─────────────┘     └─────────────┘     └─────────────┘          │     │
│  │                                                                      │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │              AUDIT & UNDO ENGINE                                    │     │
│  │   Execution logging │ Reversibility tracking │ Undo capability     │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Tool Schema

Tool schema defines the contract for workflow steps including metadata (id, name, category, icon), function signature (parameters with JSON schema, returns type), and configuration (timeout, retryPolicy, costEstimate).

**→ See complete Tool interface:** [`architecture-detailed-code-2025-11-25.md` § 5.1](./architecture-detailed-code-2025-11-25.md#51-tool-definition-interface)

---

## 7. Security Architecture

### 7.1 Security Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY ARCHITECTURE                                │
│                                                                              │
│  AUTHENTICATION                                                              │
│  ──────────────                                                              │
│  • SSO Exchange Code Flow (pseudo-PKCE)                                     │
│  • State parameter CSRF protection                                          │
│  • 5-minute exchange code TTL                                               │
│  • 15-minute access token, 10-minute refresh                                │
│                                                                              │
│  TOKEN STORAGE                                                               │
│  ─────────────                                                               │
│  • Electron safeStorage (OS keychain)                                       │
│  • Never in renderer process                                                 │
│  • Auto-clear on logout                                                      │
│                                                                              │
│  DATA ENCRYPTION                                                             │
│  ───────────────                                                             │
│  • Message cache: AES-256-GCM + gzip                                        │
│  • File cache: AES-256-GCM                                                  │
│  • 8-hour key rotation                                                       │
│  • Clear on screen lock                                                      │
│                                                                              │
│  IPC SECURITY                                                                │
│  ────────────                                                                │
│  • contextIsolation: true                                                    │
│  • nodeIntegration: false                                                    │
│  • sandbox: true                                                             │
│  • Allowlist-based contextBridge                                            │
│                                                                              │
│  CONTENT SECURITY                                                            │
│  ────────────────                                                            │
│  • CSP with nonces                                                           │
│  • No unsafe-inline                                                          │
│  • Restricted connect-src                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Access Control

| Role | Thread | Workflow | Files | Members |
|------|--------|----------|-------|---------|
| View | Read, Prompt | Read, Execute | Read, Download | - |
| Edit | Create, Edit own | Create, Edit own | Upload, Delete own | - |
| Admin | Delete any | Delete any | Delete any | Manage |

---

## 8. UI Architecture

### 8.1 Component Hierarchy

```
App
├── Layout
│   ├── PrimarySidebar (64px collapsed, 240px expanded)
│   │   ├── Navigation icons
│   │   ├── Project list
│   │   └── User menu
│   │
│   ├── SecondarySidebar (280px, collapsible)
│   │   ├── ThreadList (with search)
│   │   ├── ProjectFiles
│   │   └── WorkflowList
│   │
│   └── MainContent
│       ├── ThreadView
│       │   ├── MessageList (with branching lanes)
│       │   ├── PromptInput (with attachments)
│       │   └── ModelSelector
│       │
│       ├── ProjectView
│       │   ├── ProjectHeader
│       │   ├── ThreadsTab
│       │   ├── WorkflowsTab
│       │   ├── FilesTab
│       │   └── MembersTab
│       │
│       ├── WorkflowView
│       │   ├── WorkflowEditor
│       │   ├── ExecutionHistory
│       │   └── PlanPreview
│       │
│       ├── InsightsView
│       │   ├── Dashboard
│       │   ├── ActivityView
│       │   ├── TopicsView
│       │   ├── ProjectActivityView
│       │   ├── DesktopInfoView
│       │   └── ReportWriter
│       │
│       └── SettingsView
│           ├── GeneralSettings
│           ├── NotificationSettings
│           ├── CacheSettings
│           └── AboutSection
│
├── Modals
│   ├── BaseModal (backdrop blur)
│   ├── ConfirmDialog
│   ├── MemberInviteModal
│   └── FilePreviewModal
│
├── Overlays
│   ├── ToastContainer
│   └── UpdateBanner
│
└── SystemTray
    └── TrayMenu
```

### 8.2 Design System Reference

| Token | Value |
|-------|-------|
| Primary Color | `#3b82f6` / `var(--primary-color)` |
| Font Family | Inter, system-ui |
| Border Radius | 6px / `var(--border-radius)` |
| Content Padding | 20px / `var(--content-padding)` |
| Inline Spacing | 8px / `var(--inline-spacing)` |
| Transition | `all 0.2s ease` |
| Focus Ring | `focus:ring-2 focus:ring-blue-500` |
| Dark Mode | `.dark` class on `<html>` |

---

## 9. API Endpoints Summary

### 9.1 Moku API

**Threads:**
- `GET /api/threads` - List with pagination
- `GET /api/threads/{id}` - Get thread
- `GET /api/threads/{id}/messages` - Get messages
- `POST /api/threads` - Create
- `PATCH /api/threads/{id}` - Update
- `POST /api/threads/{id}/move` - Move to project
- `DELETE /api/threads/{id}` - Delete

**Projects:**
- `GET /api/projects` - List user's projects
- `GET /api/projects/{id}` - Get project
- `POST /api/projects` - Create
- `PATCH /api/projects/{id}` - Update
- `DELETE /api/projects/{id}` - Delete
- `GET /api/projects/{id}/members` - List members
- `POST /api/projects/{id}/members` - Add member
- `DELETE /api/projects/{id}/members/{memberId}` - Remove
- `GET /api/projects/{id}/threads` - List project threads
- `GET /api/projects/{id}/updates` - Check for changes

**Workflows:**
- `GET /api/workflows` - List
- `GET /api/workflows/{id}` - Get
- `POST /api/workflows` - Create
- `PATCH /api/workflows/{id}` - Update
- `DELETE /api/workflows/{id}` - Delete
- `POST /api/workflows/{id}/fork` - Fork template
- `POST /api/workflows/{id}/execute` - Execute
- `GET /api/workflows/{id}/executions` - Execution history

**Insights:**
- `GET /api/insights/dashboard` - Dashboard data
- `GET /api/insights/activity` - User activity
- `GET /api/insights/topics` - Thread topics
- `GET /api/insights/projects` - Project activity
- `GET /api/insights/workflows` - Workflow metrics
- `POST /api/insights/reports/run` - Run report
- `GET /api/insights/reports` - List saved reports

### 9.2 Storage Service

- `POST /projects/{p}/threads/{t}/files/upload-url` - Get upload URL
- `POST /files/{id}/upload-complete` - Confirm upload
- `GET /files/{id}/download-url` - Get download URL
- `GET /projects/{p}/files` - List files
- `DELETE /files/{id}` - Delete file
- `GET /projects/{p}/storage` - Storage stats
- `POST /files/validate` - Batch cache validation

### 9.3 Holo API

- `POST /api/chat` - Submit prompt (streaming)
- `GET /api/models` - Available models

---

## 10. Implementation Phases

### Phase 2.1: Core Infrastructure
- [ ] ThreadRepository with compression, encryption, LRU
- [ ] Lazy loading for large threads (50 message chunks)
- [ ] Dual cache implementation (personal/project)
- [ ] LRU eviction with TTL
- [ ] Encrypted file cache
- [ ] Polling service for projects

### Phase 2.2: Thread Enhancements
- [ ] Message tree structure
- [ ] Branch visualization (lanes)
- [ ] Retry flow (max 2 branches)
- [ ] Auto-title generation
- [ ] Clipboard operations

### Phase 2.3: Projects & Collaboration
- [ ] Project CRUD
- [ ] Member management
- [ ] Role-based access
- [ ] Project file storage
- [ ] Thread move functionality

### Phase 2.4: Workflows
- [ ] Workflow CRUD
- [ ] Template/instance model
- [ ] Execution engine
- [ ] Tool orchestration
- [ ] Audit logging

### Phase 2.5: Insights & Reporting
- [ ] Dashboard
- [ ] Activity views
- [ ] Report writer
- [ ] Export functionality

### Phase 2.6: UI/UX Polish
- [ ] Menu bar implementation
- [ ] System tray
- [ ] Keyboard shortcuts
- [ ] Drag and drop
- [ ] Accessibility audit

---

## 11. Key Decisions Summary

| Decision | Value |
|----------|-------|
| Architecture | Electron + Svelte, main/renderer process separation |
| API Pattern | REST with JWT auth, presigned URLs for files |
| Local Storage | ThreadRepository (no SQLite) with compression + encryption + LRU |
| Cache Strategy | Dual cache (personal/project), LRU + TTL |
| Encryption | AES-256-GCM for messages/files, 8-hour key rotation |
| Thread Branching | Tree structure via parentMessageId, max 2 retries |
| Large Threads | Lazy loading in chunks of 50 messages |
| File Storage | Personal=local, Project=Storage Service |
| Collaboration | Polling (MVP), RabbitMQ (future) |
| Offline Mode | **Not supported** - requires network connection |
| State Persistence | JSON file with versioned migrations |
| UI Framework | Tailwind + PrimeNG, CSS custom properties |
| Dark Mode | Class-based selector (`.dark`) |

---

_Architecture design document - 2025-11-25_

---

## 12. Chat-to-Workflow Progression Architecture

### 12.1 Overview

**Purpose:** Enable employees to progress from ad-hoc chat interactions to automated workflows without learning workflow builders. This is the core differentiator for achieving 80%+ adoption rates vs. 20-30% for traditional enterprise tools.

**Target Metric:** 40%+ of active users create their first workflow within 30 days.

**Detailed Architecture:** See `chat-to-workflow-architecture-2025-11-26.md` for complete specifications, UI mockups, code samples, and implementation details.

### 12.2 Three Core Features

#### Feature #1: "Make This a Workflow" Button

**Trigger:** User receives successful assistant response (>50 tokens, no errors)

**User Flow:**
```
Assistant Response
   ↓
User sees "🤖 Make this a workflow" button
   ↓
Click → 3-step wizard opens:
   1. Name & Description (auto-generated)
   2. Input Variables (auto-detected: emails, numbers, dates)
   3. Confirmation
   ↓
Workflow created & saved to library
   ↓
[Run now] [Schedule it] [View in Workflows]
```

**Key Components:**
- **UI:** `MakeWorkflowButton.svelte`, `WorkflowCreationModal.svelte`
- **Service:** `ThreadService.createWorkflowFromMessage(messageId)`
- **IPC API:** `workflows.createFromMessage(messageId)`
- **Variable Detection:** Regex-based detection for emails, numbers, dates

**Implementation Effort:** 3-5 days

---

#### Feature #2: Automatic Workflow Suggestions

**Trigger:** Background pattern detection (Moku API runs hourly ML job)

**User Flow:**
```
Moku API Pattern Detection (Hourly)
   ↓
Detects repetitive chat patterns (3+ similar prompts in 30 days)
   ↓
Creates WorkflowSuggestion record
   ↓
Desktop polls GET /workflows/suggestions
   ↓
Shows toast notification (max 1/day):
   "🤖 Pattern Detected
    You've summarized emails 15 times this month.
    Want me to automate this?"
   ↓
User clicks [Yes, automate it]
   ↓
Workflow creation modal opens (pre-filled from pattern)
```

**Key Components:**
- **UI:** `SuggestionToast.svelte`
- **Service:** `WorkflowSuggestionService`
  - `getSuggestions(userId)` - Fetch from Moku API
  - `dismissSuggestion(id)` - User clicked "Not now"
  - `neverSuggest(id)` - Blacklist pattern
  - `acceptSuggestion(id)` - Create workflow from suggestion
- **Background Job:** Polls Moku API every hour
- **State Persistence:** Tracks `lastSuggestionShown` timestamp (avoid fatigue)

**Pattern Detection (Moku API Backend):**
1. For each active user:
   - Fetch messages from last 30 days
   - Generate embeddings (OpenAI `text-embedding-3-small`)
   - Cluster by cosine similarity (threshold: 0.85)
   - Identify clusters with 3+ messages
   - Create `WorkflowSuggestion` record
2. Desktop polls suggestions hourly

**Implementation Effort:** 3-5 days

---

#### Feature #3: Template Marketplace (Chat Activation)

**Trigger:** User types template activation phrase in chat

**Examples:**
- "Set up daily standup report"
- "Install the email summary workflow"
- "Show me marketing templates"

**User Flow:**
```
User types: "Set up daily standup report"
   ↓
Desktop detects intent → Searches templates (fuzzy match)
   ↓
Assistant shows template details:
   - What it does (benefits)
   - Required inputs (Slack channel, time, projects)
   - Usage count (social proof)
   ↓
User fills inputs → Clicks [Activate workflow]
   ↓
Moku API clones template → Creates user workflow
   ↓
Confirmation: "✓ Daily Standup Report activated!"
```

**50+ Curated Templates:**
- **Marketing (10):** Social scheduler, SEO optimizer, competitor monitoring, etc.
- **Sales (10):** Lead qualifier, proposal generator, CRM updater, etc.
- **Operations (10):** Expense processor, project reporter, incident handler, etc.
- **Finance (10):** Financial reports, budget analyzer, invoice approval, etc.
- **HR (10):** Job description writer, candidate screener, onboarding, etc.

**Key Components:**
- **Service:** `TemplateMarketplaceService`
  - `searchTemplates(query)` - Fuzzy search (fuse.js)
  - `getTemplatesByCategory(category)`
  - `activateTemplate(id, inputs)` - Clone & configure
- **UI:** `TemplateActivationModal.svelte` (input collection with validation)
- **Intent Detection:** `IntentDetectionService.detectTemplateIntent(message)`
- **IPC APIs:** `templates.search()`, `templates.activate()`

**Implementation Effort:** 4-6 days

---

### 12.3 Service Architecture

**New Services Required:**

```
src-electron/services/
├── workflows/
│   ├── workflow-suggestion.service.ts       # Feature #2
│   └── template-marketplace.service.ts      # Feature #3
├── chat/
│   └── intent-detection.service.ts          # Feature #3
└── domain/
    └── thread.service.ts                    # Extended for Feature #1
        └── createWorkflowFromMessage()
```

**Extended Services:**

Chat-to-workflow IPC API includes three methods: **convertThreadToWorkflow** (analyzes thread, generates workflow definition), **suggestWorkflowFromThread** (detects automation patterns, returns suggestions), and **installTemplate** (fetches and installs marketplace workflows).

**→ See chat-to-workflow IPC definitions:** [`architecture-detailed-code-2025-11-25.md` § 6](./architecture-detailed-code-2025-11-25.md#6-chat-to-workflow-ipc-api)

### 12.5 Moku API Dependencies

**Required Endpoints:**

```
# Pattern Detection (Feature #2)
GET  /workflows/suggestions?userId={id}&status=pending
PATCH /workflows/suggestions/:id (update status: dismissed/accepted/blacklisted)
POST /workflows/suggestions/:id/accept (create workflow from suggestion)

# Workflow from Message (Feature #1)
POST /workflows/from-message
Body: { messageId, userId }
Response: { workflow }

# Template Marketplace (Feature #3)
GET  /workflow-templates?category={category}&featured={bool}
GET  /workflow-templates/:id
POST /workflow-templates/:id/activate
Body: { userId, inputs }
Response: { workflow }
```

**Background Jobs (Moku API):**
- **Pattern Detection:** Runs hourly for each active user
  - Fetch messages (last 30 days)
  - Generate embeddings (OpenAI `text-embedding-3-small`)
  - Cluster by cosine similarity (>0.85)
  - Create `WorkflowSuggestion` records for clusters with 3+ messages

### 12.6 UI Components

**New Svelte Components:**

```
src/lib/components/
├── chat/
│   └── MakeWorkflowButton.svelte            # Feature #1
├── workflows/
│   ├── WorkflowCreationModal.svelte         # Feature #1 (3-step wizard)
│   ├── SuggestionToast.svelte               # Feature #2
│   └── TemplateActivationModal.svelte       # Feature #3 (input collection)
```

### 12.7 Implementation Timeline

**Total Effort:** 10-16 days (2-3 weeks) with 2 developers

**Week 1:**
- Developer A: Feature #1 ("Make this a workflow" button)
- Developer B: Feature #3 UI (Template Marketplace)

**Week 2:**
- Developer A: Feature #2 (Workflow Suggestions)
- Developer B: Feature #3 Integration (Intent Detection + Chat)

**Week 3:**
- Both: End-to-end testing, bug fixes, UI polish

### 12.8 Success Criteria

**Feature Validation:**
- ✅ Button appears on all eligible assistant responses
- ✅ Variable detection identifies 80%+ of common variables
- ✅ Suggestion toast shows max 1/day (no fatigue)
- ✅ Fuzzy search returns relevant templates (>80% accuracy)
- ✅ Input validation prevents invalid configurations

**User Adoption Metrics (90 days post-launch):**
- ✅ **40%+ progression rate** - 40% of users create first workflow within 30 days
- ✅ **80%+ workflow adoption** - Created workflows executed 20+ times
- ✅ **<7 days time-to-value** - First workflow created within 7 days
- ✅ **60%+ template usage** - Most workflows created from templates
- ✅ **30%+ suggestion acceptance** - Users accept vs. dismiss suggestions

### 12.9 External Dependencies

- **fuse.js** - Fuzzy search library for template marketplace (`npm install fuse.js`)
- **OpenAI Embeddings API** - Pattern detection (Moku API backend uses `text-embedding-3-small`)

---

## 13. MCP Integration Architecture

### 13.1 Overview

**Purpose:** Enable Holokai Desktop to integrate with 257+ community tools via the Model Context Protocol (MCP), with organizational control managed by Moku API and support provided by Holo Platform.

**See:** `mcp-integration-architecture-2025-11-26.md` for complete technical design.

**Key Characteristics:**
- **Three-Tier Architecture:** Holo Platform (registry/support) → Moku API (org control/credentials) → Desktop App (client/orchestration)
- **Organizational Repository:** Moku manages which MCP servers are enabled per organization
- **Sandboxed Execution:** Each MCP server runs as isolated child process with resource limits
- **Credential Management:** Moku stores encrypted credentials (AES-256-GCM), Desktop fetches per-session
- **20 Official Servers:** Pre-bundled with Desktop installer, supported by Holo Platform

### 13.2 Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TIER 1: HOLO PLATFORM                               │
│                      (Support & Registry Management)                         │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  MCP Server Registry                                                  │   │
│  │  • 20+ officially supported servers (GitHub, Slack, Jira, etc.)     │   │
│  │  • Server manifests (version, executable, resource limits)          │   │
│  │  • Health monitoring across all organizations                       │   │
│  │  • Version management and update distribution                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TIER 2: MOKU API                                    │
│                    (Organizational Control Layer)                            │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Database Tables                                                      │   │
│  │  • organization_mcp_servers (which servers enabled per org)         │   │
│  │  • user_mcp_credentials (encrypted API keys, AES-256-GCM)           │   │
│  │  • mcp_server_registry (synced from Holo)                           │   │
│  │                                                                       │   │
│  │  API Endpoints                                                        │   │
│  │  • GET /mcp/servers (enabled servers for org)                       │   │
│  │  • GET /mcp/registry (available servers from Holo)                  │   │
│  │  • POST /mcp/credentials (set user credentials)                     │   │
│  │  • GET /mcp/credentials/:serverId (fetch for Desktop injection)    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TIER 3: DESKTOP APP                                  │
│                     (MCP Client & Orchestration)                             │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  MCP Services (Main Process)                                         │   │
│  │                                                                       │   │
│  │  MCPOrchestrator                    MCPServerManager                 │   │
│  │  • Initialize all enabled servers   • Spawn child processes          │   │
│  │  • Discover tools from servers      • Apply resource limits          │   │
│  │  • Route tool calls to servers      • Health monitoring & restart    │   │
│  │                                                                       │   │
│  │  MCPClient                          MCPCredentialService             │   │
│  │  • JSON-RPC stdio communication     • Fetch credentials from Moku    │   │
│  │  • tools/list, tools/call           • Inject as environment vars     │   │
│  │                                                                       │   │
│  │  MCPActionRegistry                                                    │   │
│  │  • Registry of all discovered tools across servers                   │   │
│  │  • Execute tools within workflow steps                               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.3 MCP Server Lifecycle

```
User Login
   │
   ├─> MCPOrchestrator.initialize(userId, orgId)
   │       │
   │       ├─> Fetch enabled servers from Moku API
   │       │   GET /mcp/servers?organizationId={orgId}
   │       │   Response: [{ serverId, version, config }, ...]
   │       │
   │       └─> For each enabled server:
   │           │
   │           ├─> MCPServerManager.spawn()
   │           │   • Fetch manifest from Holo registry
   │           │   • Get credentials from Moku API
   │           │   • Spawn child process (npm, python, etc.)
   │           │   • Apply resource limits (512MB RAM, 1 CPU, 60s timeout)
   │           │
   │           ├─> MCPClient.connect()
   │           │   • Establish JSON-RPC stdio connection
   │           │   • Listen to stdout for responses
   │           │   • Write to stdin for requests
   │           │
   │           └─> MCPClient.listTools()
   │               • Call tools/list JSON-RPC method
   │               • Register tools in MCPActionRegistry
   │
   └─> User can now execute MCP tools in workflows or manual actions
```

### 13.4 Core Components

#### 13.4.1 MCPOrchestrator Service
**Location:** `src-electron/services/mcp/mcp-orchestrator.service.ts`

**Responsibilities:**
- Initialize all enabled MCP servers for user's organization on login
- Discover all available tools from connected servers
- Route tool execution requests to appropriate server
- Coordinate health monitoring and auto-restart

**Key Methods:**
- `initialize(userId: string, organizationId: string): Promise<void>` - Start all enabled servers
- `executeAction(serverId: string, toolName: string, params: any): Promise<any>` - Execute tool call
- `getAvailableTools(): Tool[]` - Return all discovered tools
- `shutdown(): Promise<void>` - Gracefully stop all servers

#### 13.4.2 MCPServerManager Service
**Location:** `src-electron/services/mcp/mcp-server-manager.service.ts`

**Responsibilities:**
- Spawn MCP server child processes with sandboxing
- Apply OS-level resource limits (memory, CPU, timeout)
- Monitor process health and handle crashes
- Auto-restart failed servers (up to 3 attempts with exponential backoff)

**Key Methods:**
- `spawn(serverId: string, manifest: Manifest, credentials: any): Promise<ChildProcess>` - Start server process
- `kill(serverId: string): Promise<void>` - Stop server process
- `getHealth(serverId: string): HealthStatus` - Check if server is responsive

**Resource Limits (per server):**
- **Max Memory:** 512MB
- **Max CPU:** 1 core
- **Timeout:** 60 seconds per tool call
- **Restart Policy:** Max 3 attempts, exponential backoff (1s, 2s, 4s)

#### 13.4.3 MCPClient Service
**Location:** `src-electron/services/mcp/mcp-client.service.ts`

**Responsibilities:**
- Implement MCP protocol JSON-RPC over stdio
- Send `tools/list` and `tools/call` requests
- Parse JSON-RPC responses from stdout
- Handle protocol errors and timeouts

**Key Methods:**
- `connect(serverId: string, process: ChildProcess): Promise<MCPConnection>` - Establish connection
- `listTools(serverId: string): Promise<Tool[]>` - Discover available tools
- `callTool(serverId: string, toolName: string, params: any): Promise<any>` - Execute tool

#### 13.4.4 MCPCredentialService
**Location:** `src-electron/services/mcp/mcp-credential.service.ts`

**Responsibilities:**
- Fetch encrypted credentials from Moku API per-session
- Inject credentials as environment variables when spawning server processes
- Never persist credentials locally (fetch on-demand)

**Key Methods:**
- `getCredentials(serverId: string, userId: string): Promise<Record<string, string>>` - Fetch from Moku
- `injectCredentials(env: NodeJS.ProcessEnv, credentials: any): NodeJS.ProcessEnv` - Add to process env

**Credential Flow:**
1. Desktop calls Moku API: `GET /mcp/credentials/:serverId?userId={userId}`
2. Moku decrypts stored credentials (AES-256-GCM)
3. Moku returns credentials over HTTPS
4. Desktop injects as env vars: `GITHUB_TOKEN`, `SLACK_API_KEY`, etc.
5. Credentials never written to disk

#### 13.4.5 MCPActionRegistry Service
**Location:** `src-electron/services/mcp/mcp-action-registry.service.ts`

**Responsibilities:**
- Maintain registry of all discovered tools from all connected servers
- Enable workflow engine to execute MCP tools as workflow steps
- Provide tool search/filter capabilities for UI

**Key Methods:**
- `registerTool(serverId: string, tool: Tool): void` - Add tool to registry
- `getToolsByCategory(category: string): Tool[]` - Filter tools by category
- `executeTool(toolId: string, params: any): Promise<any>` - Execute via MCPOrchestrator

### 13.5 Integration with Workflow Execution Engine

MCP tools can be used as workflow steps:

```yaml
# Example workflow YAML with MCP actions
steps:
  - name: "Create GitHub Issue"
    type: "mcp_action"
    server_id: "github"
    tool_name: "create_issue"
    inputs:
      repository: "{{inputs.repo}}"
      title: "{{inputs.issue_title}}"
      body: "{{inputs.issue_body}}"
    output: "github_issue_url"
```

**Workflow Engine Extension:**
```typescript
// src-electron/services/workflows/workflow-execution.service.ts
async executeStep(step: WorkflowStep): Promise<any> {
  if (step.type === 'mcp_action') {
    return await this.mcpOrchestrator.executeAction(
      step.server_id,
      step.tool_name,
      this.resolveInputs(step.inputs)
    );
  }
  // ... other step types
}
```

### 13.6 20 Official Pre-Bundled Servers

The following MCP servers are bundled with Desktop installer and officially supported by Holo Platform:

| Category | Server | Description |
|----------|--------|-------------|
| **Version Control** | `github` | Issues, PRs, commits, repos |
|  | `gitlab` | Projects, merge requests, pipelines |
| **Communication** | `slack` | Channels, messages, files |
|  | `discord` | Servers, channels, messages |
| **Project Management** | `jira` | Issues, boards, sprints |
|  | `linear` | Issues, projects, cycles |
|  | `asana` | Tasks, projects, teams |
| **Documentation** | `notion` | Pages, databases, blocks |
|  | `confluence` | Spaces, pages, attachments |
| **Cloud Storage** | `google-drive` | Files, folders, sharing |
|  | `dropbox` | Files, folders, sharing |
|  | `onedrive` | Files, folders, sharing |
| **Productivity** | `google-calendar` | Events, calendars |
|  | `google-sheets` | Spreadsheets, formulas |
|  | `airtable` | Bases, tables, records |
| **CRM** | `salesforce` | Leads, opportunities, accounts |
|  | `hubspot` | Contacts, deals, companies |
| **DevOps** | `aws` | EC2, S3, Lambda, CloudWatch |
|  | `kubernetes` | Pods, services, deployments |
| **Databases** | `postgresql` | Query, schema management |

**Installation:** Servers are packaged with Desktop installer using `npm` or `python` dependencies.

### 13.7 UI Components

**Settings → Integrations Page**

Component: `src/lib/pages/settings/IntegrationsTab.svelte`

Features:
- List all available MCP servers (from Moku API)
- Show enabled/disabled status per organization
- Configure credentials (modal form with password fields)
- Test connection (spawn server, call `tools/list`)
- View available tools per server

### 13.8 Success Criteria

**Functionality:**
- ✅ **20 official servers** pre-bundled and auto-discovered
- ✅ **Organization control** via Moku API (enable/disable per org)
- ✅ **Credential management** (encrypted storage, per-session fetch)
- ✅ **Sandboxed execution** with resource limits enforced
- ✅ **Workflow integration** (MCP tools as workflow steps)

**Performance:**
- ✅ **<1 second initialization** per server on login
- ✅ **<500ms tool execution latency** (excludes external API calls)
- ✅ **<100MB memory overhead** for MCP orchestration layer

**Security:**
- ✅ **No local credential storage** (fetch per-session from Moku)
- ✅ **Process isolation** (each server in separate sandboxed process)
- ✅ **Resource limits enforced** (512MB RAM, 1 CPU, 60s timeout)
- ✅ **TLS for credential fetch** (HTTPS to Moku API)

**Adoption (90 days post-launch):**
- ✅ **60%+ users configure at least 1 MCP integration**
- ✅ **5+ average integrations per organization**
- ✅ **30%+ workflows use MCP tools** (vs manual actions)

### 13.9 Implementation Timeline

**Total Effort:** 20-30 days (4-6 weeks) with 2 developers

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1: Core MCP Infrastructure** | 8-12 days | MCPOrchestrator, MCPServerManager, MCPClient, JSON-RPC protocol |
| **Phase 2: Credential Management** | 4-6 days | MCPCredentialService, Moku API endpoints, encrypted storage |
| **Phase 3: Workflow Integration** | 3-5 days | MCPActionRegistry, workflow engine extension, YAML schema |
| **Phase 4: UI & Testing** | 5-7 days | Settings page, connection testing, 20 server validation |

### 13.10 External Dependencies

- **Moku API Extensions:**
  - `/mcp/servers` endpoint (organization MCP configuration)
  - `/mcp/credentials` endpoint (encrypted credential storage/fetch)
  - `/mcp/registry` endpoint (sync from Holo registry)
  - Database schema: `organization_mcp_servers`, `user_mcp_credentials`, `mcp_server_registry`

- **Holo Platform Extensions:**
  - MCP Server Registry (20+ official servers)
  - Server manifest management (version, executable, resource limits)
  - Health monitoring dashboard (cross-organization visibility)

- **Desktop Dependencies:**
  - No new npm packages required (Node.js child_process and stdio are built-in)

---

## 14. Key Decisions Summary (Updated)

| Decision | Value | Notes |
|----------|-------|-------|
| Architecture | Electron + Svelte, main/renderer process separation | |
| API Pattern | REST with JWT auth, presigned URLs for files | |
| Local Storage | ThreadRepository (no SQLite) with compression + encryption + LRU | |
| Cache Strategy | Dual cache (personal/project), LRU + TTL | |
| Encryption | AES-256-GCM for messages/files, 8-hour key rotation | |
| Thread Branching | Tree structure via parentMessageId, max 2 retries | |
| Large Threads | Lazy loading in chunks of 50 messages | |
| File Storage | Personal=local, Project=Storage Service | |
| Collaboration | Polling (MVP), RabbitMQ (future) | |
| Offline Mode | **Not supported** - requires network connection | |
| State Persistence | JSON file with versioned migrations | |
| UI Framework | Tailwind + PrimeNG, CSS custom properties | |
| Dark Mode | Class-based selector (`.dark`) | |
| **Chat-to-Workflow** | **3 features: Button, Suggestions, Templates** | **Enterprise MVP differentiator** |
| **Pattern Detection** | **ML-based (OpenAI embeddings + clustering)** | **Moku API hourly background job** |
| **Template Fuzzy Search** | **fuse.js library, threshold: 0.4** | **Top 5 matches returned** |
| **Suggestion Frequency** | **Max 1 toast per day** | **Avoid user fatigue** |
| **MCP Integration** | **Three-tier: Holo → Moku → Desktop** | **Enterprise MVP differentiator** |
| **MCP Organizational Control** | **Moku API manages enabled servers per org** | **Admins control via Moku dashboard** |
| **MCP Credential Management** | **AES-256-GCM encrypted in Moku, fetched per-session** | **Never stored locally on Desktop** |
| **MCP Sandboxing** | **Child process, 512MB RAM, 1 CPU, 60s timeout** | **OS-enforced resource limits** |
| **MCP Official Servers** | **20 pre-bundled servers** | **GitHub, Slack, Jira, Notion, AWS, etc.** |

---

_Architecture design document - 2025-11-25 (Updated 2025-11-26 with Chat-to-Workflow & MCP Integration)_

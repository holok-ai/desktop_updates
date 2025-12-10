# Architecture Addendum: Portable Workflow Engine & Marketplace
## Holokai Desktop - Workflow Requirements Architecture

**Date:** 2025-11-26
**Version:** 1.0
**Status:** Architecture Design
**Phase:** Enterprise MVP (Portable Engine) + Post-MVP (Marketplace)

**Companion to:** `architecture-2025-11-25.md`
**Requirements:** `workflow-engine-requirements.md`, `prd-desktop-enterprise-mvp-2025-11-26.md` §3.7-3.8

---

## Document Overview

This addendum extends the main architecture document with detailed designs for:
1. **Portable Workflow Engine** (MVP - Month 4): Cloud-portable execution engine with zero desktop dependencies
2. **Workflow Marketplace** (Post-MVP - Month 6): User-created workflows with publishing, curation, freemium model
3. **"My Workflows" Concept** (MVP): Personal project model for workflow management

**Design Principle:** Build portable from day 1 to avoid expensive refactoring when adding cloud execution (Month 6+).

---

## 1. System Architecture Overview

### 1.1 Portable Workflow Engine Position

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HOLOKAI PLATFORM SERVICES                            │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │    HOLO API      │  │    MOKU API      │  │  STORAGE SERVICE │          │
│  │  (Chat/Prompts)  │  │   (Management)   │  │     (Files)      │          │
│  │                  │  │                  │  │                  │          │
│  │                  │  │  + Workflows     │  │  + Workflow      │          │
│  │                  │  │  + Templates     │  │    Files (URLs)  │          │
│  │                  │  │  + Marketplace   │  │                  │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│           │                     │                     │                     │
│           └─────────────────────┼─────────────────────┘                     │
│                                 │                                            │
│                    ┌────────────┴────────────┐                              │
│                    │     DESKTOP APP         │                              │
│                    │  (Electron + Svelte)    │                              │
│                    │                         │                              │
│                    │  ┌───────────────────┐  │                              │
│                    │  │ PORTABLE WORKFLOW │  │  ◄── Zero Electron deps      │
│                    │  │     ENGINE        │  │  ◄── Storage abstraction     │
│                    │  │                   │  │  ◄── Embedded AI client      │
│                    │  │  (Standalone      │  │  ◄── Bundled runtimes        │
│                    │  │   Node.js)        │  │                              │
│                    │  └───────────────────┘  │                              │
│                    └─────────────────────────┘                              │
│                                 │                                            │
│                    ┌────────────┴────────────┐                              │
│                    │  MCP SERVERS (Optional) │                              │
│                    │  (Sandboxed, isolated)  │                              │
│                    └─────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘

                                 │
                                 │  Post-MVP (Month 6+)
                                 ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLOUD RUNTIME                                      │
│                                                                              │
│                    ┌─────────────────────────┐                              │
│                    │  PORTABLE WORKFLOW      │                              │
│                    │     ENGINE              │  ◄── Same codebase           │
│                    │                         │  ◄── Same workflows          │
│                    │  (AWS Lambda /          │  ◄── Zero changes            │
│                    │   GCP Cloud Run /       │                              │
│                    │   Azure Functions)      │                              │
│                    └────────┬────────────────┘                              │
│                             │                                                │
│                    ┌────────┴────────────┐                                  │
│                    │  Cloud Storage      │                                  │
│                    │  (S3, Azure Blob,   │                                  │
│                    │   Google Cloud)     │                                  │
│                    └─────────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Architectural Layers

| Layer | Responsibility | Portability |
|-------|---------------|-------------|
| **Workflow Engine Core** | Parse, validate, execute workflows | ✅ 100% portable (zero Electron deps) |
| **Storage Service Abstraction** | File access via URLs (not paths) | ✅ Backend-agnostic (local, S3, Azure) |
| **Embedded AI Client** | Anthropic API integration | ✅ Works local + cloud (API-based) |
| **Bundled Runtimes** | Node.js, Python, Bash interpreters | ✅ Included in package |
| **Capability Enforcer** | Permission checks, resource limits | ✅ RBAC/SSO context inheritance |
| **Desktop Integration** | UI, IPC, state management | ❌ Desktop-only (MVP) |
| **Cloud Triggers** | API, webhooks, scheduled execution | ⏳ Post-MVP only |

---

## 2. Portable Workflow Engine Architecture

### 2.1 Design Constraints (Critical)

**Prohibited Dependencies:**
- ❌ Electron APIs (`ipcRenderer`, `ipcMain`, `dialog`, etc.)
- ❌ Local file paths (`/Users/`, `C:\Users\`, `__dirname`, `process.cwd()`)
- ❌ OS-specific features (Windows Registry, macOS Keychain, Linux DBus)
- ❌ Desktop UI frameworks (React, Vue, Svelte)

**Required Design:**
- ✅ Storage service abstraction (file URLs, not paths)
- ✅ Platform-agnostic runtime (Node.js >= 18)
- ✅ Memory-based state (persisted via storage service)
- ✅ Stateless execution (can run as Lambda/Cloud Function)

### 2.2 Workflow Engine Core Components

```typescript
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PORTABLE WORKFLOW ENGINE                              │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     ENGINE CORE                                     │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │     │
│  │  │WorkflowParser│ │StepExecutor│ │StateManager│ │ErrorHandler│  │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     RUNTIME SERVICES                                │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                   │     │
│  │  │ AIClient    │ │ScriptRunner │ │ContextAsm  │                   │     │
│  │  │(Anthropic)  │ │(JS/Py/Bash) │ │            │                   │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                   │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     STORAGE ABSTRACTION                             │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                   │     │
│  │  │StorageClient│ │URLResolver  │ │FileCache    │                   │     │
│  │  │ (Interface) │ │             │ │             │                   │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                   │     │
│  │         │                                                            │     │
│  │         ├─► LocalStorageService (MVP)                               │     │
│  │         ├─► S3StorageService (Post-MVP)                             │     │
│  │         └─► AzureBlobStorageService (Post-MVP)                      │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     SECURITY & GOVERNANCE                           │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                   │     │
│  │  │Capability   │ │ResourceLimit│ │RBACContext  │                   │     │
│  │  │Enforcer     │ │Monitor      │ │Injector     │                   │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                   │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Storage Service Abstraction

**Interface Design:**

```typescript
// src/workflow-engine/storage/StorageService.ts
interface StorageService {
  // Core file operations
  readFile(url: string): Promise<string>;
  writeFile(url: string, content: string): Promise<void>;
  deleteFile(url: string): Promise<void>;
  fileExists(url: string): Promise<boolean>;
  listFiles(directory: string): Promise<string[]>;

  // File metadata
  getFileMetadata(url: string): Promise<FileMetadata>;

  // URL generation for AI prompts
  getFileURL(path: string): Promise<string>;

  // Binary content
  readFileBinary(url: string): Promise<Buffer>;
  writeFileBinary(url: string, content: Buffer): Promise<void>;
}

interface FileMetadata {
  size: number;
  created: Date;
  modified: Date;
  mimeType: string;
}
```

**URL Schemes:**

| Scheme | Description | Example | Resolved Path (MVP) |
|--------|-------------|---------|---------------------|
| `workflow://` | Files within workflow package | `workflow://templates/output.md` | `~/.holokai/workflows/{id}/templates/output.md` |
| `project://` | Files in current project | `project://docs/prd.md` | `/project/.holokai/docs/prd.md` |
| `personal://` | Files in "My Workflows" | `personal://outputs/result.md` | `~/.holokai/My Workflows/outputs/result.md` |
| `marketplace://` | Files in marketplace (read-only) | `marketplace://{author}/{workflow}/README.md` | `~/.holokai/marketplace/{author}/{workflow}/README.md` |

**Backend Implementations:**

```typescript
// MVP: Local filesystem backend
class LocalStorageService implements StorageService {
  private basePaths = {
    'workflow': path.join(os.homedir(), '.holokai', 'workflows'),
    'project': process.env.CURRENT_PROJECT_PATH,
    'personal': path.join(os.homedir(), '.holokai', 'My Workflows'),
    'marketplace': path.join(os.homedir(), '.holokai', 'marketplace'),
  };

  async readFile(url: string): Promise<string> {
    const filepath = this.resolveURL(url);
    return fs.readFile(filepath, 'utf-8');
  }

  private resolveURL(url: string): string {
    const { protocol, path } = this.parseURL(url);
    const basePath = this.basePaths[protocol];
    if (!basePath) throw new Error(`Unknown protocol: ${protocol}`);
    return path.join(basePath, path);
  }
}

// Post-MVP: S3 backend
class S3StorageService implements StorageService {
  private s3Client: S3Client;
  private bucketName: string;

  async readFile(url: string): Promise<string> {
    const key = this.resolveURL(url);
    const command = new GetObjectCommand({ Bucket: this.bucketName, Key: key });
    const response = await this.s3Client.send(command);
    return response.Body.transformToString();
  }

  async getFileURL(path: string): Promise<string> {
    const key = this.resolveURL(path);
    const command = new GetObjectCommand({ Bucket: this.bucketName, Key: key });
    return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }
}
```

### 2.4 Embedded AI Client

**Interface:**

```typescript
// src/workflow-engine/ai/AIClient.ts
interface AIClient {
  // Text generation
  generate(prompt: string, context?: AIContext): Promise<string>;

  // Streaming generation
  generateStream(prompt: string, context?: AIContext): AsyncIterator<string>;

  // Structured extraction
  extract<T>(prompt: string, schema: Schema<T>): Promise<T>;

  // Multi-turn conversation
  chat(messages: Message[]): Promise<string>;
}

interface AIContext {
  files?: string[];      // File URLs to include in context
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}
```

**Implementation (Anthropic):**

```typescript
class AnthropicAIClient implements AIClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generate(prompt: string, context?: AIContext): Promise<string> {
    // Load file contents if URLs provided
    const fileContents = context?.files
      ? await Promise.all(context.files.map(url => storageService.readFile(url)))
      : [];

    const fullPrompt = [
      ...fileContents.map(content => `<file>\n${content}\n</file>`),
      prompt
    ].join('\n\n');

    const message = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: context?.maxTokens ?? 4096,
      temperature: context?.temperature ?? 1.0,
      system: context?.systemPrompt,
      messages: [{ role: 'user', content: fullPrompt }]
    });

    return message.content[0].text;
  }

  async *generateStream(prompt: string, context?: AIContext): AsyncIterator<string> {
    const fileContents = context?.files
      ? await Promise.all(context.files.map(url => storageService.readFile(url)))
      : [];

    const fullPrompt = [
      ...fileContents.map(content => `<file>\n${content}\n</file>`),
      prompt
    ].join('\n\n');

    const stream = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: context?.maxTokens ?? 4096,
      stream: true,
      messages: [{ role: 'user', content: fullPrompt }]
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield chunk.delta.text;
      }
    }
  }
}
```

### 2.5 Bundled Runtimes & Script Execution

**Supported Languages:**
- JavaScript/TypeScript (Node.js runtime - already available)
- Python (bundled with Desktop installer - python3 executable)
- Bash (bundled with Desktop installer - bash executable)

**Script Execution Architecture:**

```typescript
// src/workflow-engine/runtime/ScriptRunner.ts
interface ScriptRunner {
  execute(script: Script, context: ExecutionContext): Promise<ScriptResult>;
}

interface Script {
  language: 'javascript' | 'python' | 'bash';
  code: string;
  capabilities: string[];  // ['filesystem:read', 'network:https', etc.]
}

interface ExecutionContext {
  variables: Record<string, unknown>;
  workingDirectory: string;  // URL scheme (project://, personal://)
  userContext: {
    userId: string;
    jwt: string;  // For API calls with RBAC
  };
  resourceLimits: {
    memoryMB: number;
    timeoutSeconds: number;
    cpuCores: number;
  };
}

interface ScriptResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode: number;
  durationMs: number;
}
```

**Implementation:**

```typescript
class NodeScriptRunner implements ScriptRunner {
  async execute(script: Script, context: ExecutionContext): Promise<ScriptResult> {
    // Check capabilities before execution
    this.checkCapabilities(script.capabilities, context.userContext);

    const startTime = Date.now();

    try {
      // Create isolated VM context
      const sandbox = {
        // Inject storage service (NOT raw filesystem)
        storage: this.createStorageProxy(context.workingDirectory, script.capabilities),

        // Inject AI client
        ai: new AnthropicAIClient(process.env.ANTHROPIC_API_KEY),

        // Inject variables
        ...context.variables,

        // Inject user context (for API calls)
        userContext: context.userContext,
      };

      // Execute in VM with timeout
      const vm = new VM({
        timeout: context.resourceLimits.timeoutSeconds * 1000,
        sandbox,
        eval: false,  // Disable eval for security
      });

      const result = vm.run(script.code);

      return {
        success: true,
        output: String(result),
        exitCode: 0,
        durationMs: Date.now() - startTime,
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        exitCode: 1,
        durationMs: Date.now() - startTime,
      };
    }
  }

  private createStorageProxy(workingDir: string, capabilities: string[]): Partial<StorageService> {
    // Only expose storage methods if capability granted
    if (!capabilities.includes('filesystem:read')) {
      return {};  // No file access
    }

    return {
      readFile: (path) => {
        // Resolve relative paths against working directory
        const url = path.startsWith('workflow://') ? path : `${workingDir}/${path}`;
        return storageService.readFile(url);
      },
      writeFile: capabilities.includes('filesystem:write')
        ? (path, content) => {
            const url = path.startsWith('workflow://') ? path : `${workingDir}/${path}`;
            return storageService.writeFile(url, content);
          }
        : undefined,  // Not allowed
    };
  }
}
```

### 2.6 Capability-Based Sandboxing

**Permission Model:**

```typescript
// src/workflow-engine/security/CapabilityEnforcer.ts
interface CapabilityEnforcer {
  checkPermission(capability: string, userContext: UserContext): boolean;
  enforceResourceLimits(execution: WorkflowExecution): void;
}

// Capability format: {resource}:{action}[:{scope}]
// Examples:
//   filesystem:read
//   filesystem:write:project
//   network:https:github.com
//   git:read
//   bash:execute

class DefaultCapabilityEnforcer implements CapabilityEnforcer {
  checkPermission(capability: string, userContext: UserContext): boolean {
    const [resource, action, scope] = capability.split(':');

    // Check if user approved this capability during workflow installation
    const userApprovals = this.getUserApprovals(userContext.userId);
    if (!userApprovals.includes(capability)) {
      throw new PermissionDeniedError(`Capability not approved: ${capability}`);
    }

    // Check RBAC permissions from Moku API
    if (resource === 'filesystem' && action === 'write') {
      // User must have 'edit' role in project to write files
      const projectRole = this.getUserRoleInProject(userContext);
      if (projectRole !== 'edit' && projectRole !== 'admin') {
        throw new PermissionDeniedError('User does not have write access to project');
      }
    }

    // Check network scope restrictions
    if (resource === 'network' && scope) {
      // Only allow HTTPS to specified domain
      if (!this.isAllowedDomain(scope)) {
        throw new PermissionDeniedError(`Network access to ${scope} not allowed`);
      }
    }

    return true;
  }

  enforceResourceLimits(execution: WorkflowExecution): void {
    const limits = execution.resourceLimits;

    // Memory limit
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    if (memoryUsage > limits.memoryMB) {
      throw new ResourceLimitExceededError('Memory limit exceeded');
    }

    // Timeout enforcement (handled by script runner VM timeout)

    // CPU limit (soft limit - log warning if exceeded)
    const cpuUsage = process.cpuUsage();
    if (cpuUsage.user > limits.cpuCores * 1e9) {  // 1 second per core
      console.warn('CPU usage high - may be throttled');
    }
  }
}
```

**User Approval Flow (MVP):**

1. User installs workflow from marketplace
2. Desktop shows permission disclosure dialog:
   ```
   This workflow requests:
   ✓ Filesystem: Read/Write in workspace
   ✓ Network: HTTPS requests to github.com
   ✓ Git: Read repository history
   ✓ Bash: Execute shell commands

   Risk Score: Medium Risk

   [Cancel] [Approve & Install]
   ```
3. User approves → capabilities stored in `user_workflow_approvals` table (Moku API)
4. During execution, `CapabilityEnforcer` checks approvals before allowing script actions

### 2.7 State Management

**Memory-Based State (MVP):**

```typescript
// src/workflow-engine/state/StateManager.ts
interface StateManager {
  saveCheckpoint(execution: WorkflowExecution): Promise<void>;
  loadCheckpoint(executionId: string): Promise<WorkflowExecution | null>;
  clearCheckpoint(executionId: string): Promise<void>;

  // Undo support (only for reversible steps)
  canUndo(execution: WorkflowExecution, stepIndex: number): boolean;
  undo(execution: WorkflowExecution, stepIndex: number): Promise<void>;
}

class InMemoryStateManager implements StateManager {
  private checkpoints = new Map<string, WorkflowExecution>();

  async saveCheckpoint(execution: WorkflowExecution): Promise<void> {
    // Save to memory for duration of execution
    this.checkpoints.set(execution.id, JSON.parse(JSON.stringify(execution)));

    // Optionally persist to storage service for resumability (post-MVP)
    // await storageService.writeFile(
    //   `project://.holokai/workflow-state/${execution.id}.json`,
    //   JSON.stringify(execution)
    // );
  }

  async loadCheckpoint(executionId: string): Promise<WorkflowExecution | null> {
    return this.checkpoints.get(executionId) ?? null;
  }

  async clearCheckpoint(executionId: string): Promise<void> {
    this.checkpoints.delete(executionId);
  }

  canUndo(execution: WorkflowExecution, stepIndex: number): boolean {
    const step = execution.steps[stepIndex];
    return step.reversible === true;  // Only steps marked as reversible
  }

  async undo(execution: WorkflowExecution, stepIndex: number): Promise<void> {
    const step = execution.steps[stepIndex];
    if (!step.reversible) {
      throw new Error('Step is not reversible');
    }

    // Execute undo action (specific to step type)
    if (step.undoAction) {
      await this.executeStep(step.undoAction, execution.context);
    }

    // Roll back state to previous checkpoint
    execution.currentStepIndex = stepIndex - 1;
  }
}
```

---

## 3. "My Workflows" Personal Project Model

### 3.1 Conceptual Design

**Key Principle:** Every user has a **"My Workflows"** personal project that behaves identically to team projects, but is private to the user. This eliminates special-casing personal vs. team workflows.

**Structure:**

```
My Workflows (userId: "user-123", type: "personal")
├── .holokai/
│   ├── config.yaml              # User variables
│   │   └── user_name: "Peter"
│   │   └── email: "peter@holokai.ai"
│   │   └── output_folder: "{project-root}/outputs"
│   └── workflows/
│       ├── marketplace/         # Installed from marketplace
│       │   ├── holokai-official/release-notes/
│       │   │   ├── manifest.json
│       │   │   ├── workflow.yaml
│       │   │   ├── instructions.md
│       │   │   └── templates/output.md
│       │   └── peter/my-workflow/
│       │       └── ...
│       └── custom/              # User-created workflows
│           ├── personal-templates/
│           └── meeting-notes/
└── outputs/                     # Workflow outputs

Team Project (projectId: "proj-456", type: "team")
├── .holokai/
│   ├── config.yaml              # Project variables
│   │   └── project_name: "Holokai Desktop"
│   │   └── team_name: "Core Team"
│   │   └── output_folder: "{project-root}/docs"
│   └── workflows/
│       ├── marketplace/         # Project-specific (git-ignored in .gitignore)
│       └── custom/              # Team workflows (git-committed)
│           └── deploy-production/
└── docs/                        # Project outputs
```

### 3.2 Data Model

```typescript
// "My Workflows" is just a special project with type="personal"
interface Project {
  id: string;
  name: string;
  type: 'personal' | 'team';     // NEW field
  ownerId: string;               // userId for personal, creatorId for team
  organizationId?: string;
  // ... rest of fields same as existing Project interface
}

// Auto-create "My Workflows" on user signup:
async function createUserPersonalProject(userId: string): Promise<Project> {
  return {
    id: `${userId}-personal`,   // Deterministic ID
    name: 'My Workflows',
    type: 'personal',
    ownerId: userId,
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
```

### 3.3 Project Isolation

**No Config Merging, No Cross-Project Access:**

```typescript
// When executing a workflow in "My Workflows":
const config = await loadConfig('personal://My Workflows/.holokai/config.yaml');
// Returns: { user_name: "Peter", output_folder: "~/My Workflows/outputs", ... }

// When executing a workflow in "Team Project":
const config = await loadConfig('project://Team Project/.holokai/config.yaml');
// Returns: { project_name: "Holokai Desktop", output_folder: "/project/docs", ... }

// Workflows CANNOT access files from other projects:
await storageService.readFile('personal://My Workflows/secret.txt');  // ✅ OK if in personal context
await storageService.readFile('project://Team Project/file.txt');    // ❌ ERROR if in personal context
```

**Enforcement:**

```typescript
class StorageServiceWithIsolation implements StorageService {
  async readFile(url: string): Promise<string> {
    const { protocol, path } = parseURL(url);

    // Check if URL protocol matches current execution context
    if (protocol === 'project' && this.currentContext.projectId !== this.resolveProjectId(url)) {
      throw new CrossProjectAccessError('Cannot access files from other projects');
    }

    return this.backend.readFile(url);
  }
}
```

---

## 4. Workflow Marketplace Architecture (Post-MVP - Month 6)

### 4.1 Marketplace Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WORKFLOW MARKETPLACE SYSTEM                           │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     DESKTOP APP (Client)                            │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                   │     │
│  │  │ Marketplace │ │ Workflow    │ │ Installation│                   │     │
│  │  │ Browser     │ │ Creator     │ │ Manager     │                   │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                   │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                 │                                            │
│                                 │ API calls                                  │
│                                 ▼                                            │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     MOKU API (Backend)                              │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │     │
│  │  │Marketplace  │ │ Publishing  │ │ Security    │ │ Payment     │  │     │
│  │  │ API         │ │ Pipeline    │ │ Scanner     │ │ Processor   │  │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                 │                                            │
│                                 │ Storage                                    │
│                                 ▼                                            │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     STORAGE SERVICE                                 │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                   │     │
│  │  │ Workflow    │ │ Review      │ │ Publisher   │                   │     │
│  │  │ Packages    │ │ Queue       │ │ Profiles    │                   │     │
│  │  │ (.wfpkg)    │ │             │ │             │                   │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                   │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Publishing Pipeline

**Flow:**

```
Developer submits workflow (.wfpkg file)
  ↓
Automated Security Scan
  - Malware detection (ClamAV + custom rules)
  - Vulnerability scanning (Snyk, npm audit)
  - Code obfuscation detection
  - Suspicious network calls
  ↓
Syntax Validation
  - manifest.json schema validation
  - workflow.yaml schema validation
  - instructions.md XML validation
  - Template syntax check (Handlebars)
  ↓
Human Review Queue
  - Code quality review (linting, best practices)
  - Security review (permissions, data access)
  - Documentation review (README accuracy)
  - Test execution (automated QA)
  ↓
Approve → Publish to Marketplace
   OR
Reject → Feedback to developer
```

**Database Schema (Moku API):**

```sql
CREATE TABLE marketplace_workflows (
  id UUID PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  version VARCHAR(20) NOT NULL,  -- Semver
  tier VARCHAR(20) NOT NULL,  -- basic, intermediate
  category VARCHAR(100),
  tags TEXT[],
  description TEXT,
  long_description TEXT,
  pricing_type VARCHAR(20) DEFAULT 'free',  -- free, premium
  price_cents INT DEFAULT 0,
  package_url TEXT NOT NULL,  -- S3 URL to .wfpkg file
  icon_url TEXT,
  homepage TEXT,
  repository TEXT,
  license VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected, disabled
  review_notes TEXT,
  install_count INT DEFAULT 0,
  rating_avg DECIMAL(3, 2),
  rating_count INT DEFAULT 0,
  last_scanned_at TIMESTAMP,
  security_scan_result JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(author_id, name, version)
);

CREATE TABLE workflow_reviews (
  id UUID PRIMARY KEY,
  workflow_id UUID REFERENCES marketplace_workflows(id),
  user_id UUID REFERENCES users(id),
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE publisher_profiles (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES users(id),
  display_name VARCHAR(255),
  bio TEXT,
  website TEXT,
  github TEXT,
  verified BOOLEAN DEFAULT FALSE,
  reputation_score INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_workflow_approvals (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  workflow_id UUID REFERENCES marketplace_workflows(id),
  capabilities TEXT[],  -- Approved capabilities
  approved_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, workflow_id)
);
```

### 4.3 Trust & Safety

**Security Scanning Service:**

```typescript
// src/marketplace/security/SecurityScanner.ts
interface SecurityScanner {
  scan(packageFile: Buffer): Promise<ScanResult>;
}

interface ScanResult {
  passed: boolean;
  riskScore: 'low' | 'medium' | 'high';
  findings: Finding[];
}

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'malware' | 'vulnerability' | 'obfuscation' | 'suspicious';
  description: string;
  location?: string;  // File path or line number
}

class WorkflowSecurityScanner implements SecurityScanner {
  async scan(packageFile: Buffer): Promise<ScanResult> {
    const findings: Finding[] = [];

    // 1. Malware scan with ClamAV
    const malwareResult = await this.scanMalware(packageFile);
    findings.push(...malwareResult);

    // 2. Extract and scan scripts
    const scripts = await this.extractScripts(packageFile);
    for (const script of scripts) {
      // Check for obfuscation
      if (this.isObfuscated(script.code)) {
        findings.push({
          severity: 'high',
          category: 'obfuscation',
          description: 'Code obfuscation detected',
          location: script.filename,
        });
      }

      // Check for suspicious patterns
      const suspiciousPatterns = this.detectSuspiciousPatterns(script.code);
      findings.push(...suspiciousPatterns);

      // Dependency vulnerability scan (npm, pip)
      if (script.language === 'javascript') {
        const vulns = await this.scanNpmDependencies(script.code);
        findings.push(...vulns);
      }
    }

    // 3. Calculate risk score
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const highCount = findings.filter(f => f.severity === 'high').length;

    const riskScore = criticalCount > 0 || highCount > 2 ? 'high'
      : highCount > 0 ? 'medium'
      : 'low';

    return {
      passed: criticalCount === 0 && highCount < 3,
      riskScore,
      findings,
    };
  }

  private detectSuspiciousPatterns(code: string): Finding[] {
    const findings: Finding[] = [];

    // Check for data exfiltration patterns
    if (/fetch.*http(?!s)/.test(code)) {
      findings.push({
        severity: 'medium',
        category: 'suspicious',
        description: 'HTTP (non-HTTPS) network call detected',
      });
    }

    // Check for encoded data (possible obfuscation)
    if (/atob\(|fromCharCode/.test(code)) {
      findings.push({
        severity: 'medium',
        category: 'obfuscation',
        description: 'Base64 decoding detected (possible obfuscation)',
      });
    }

    // Check for dynamic code execution
    if (/eval\(|Function\(|new\s+Function/.test(code)) {
      findings.push({
        severity: 'high',
        category: 'suspicious',
        description: 'Dynamic code execution detected (eval, Function constructor)',
      });
    }

    return findings;
  }
}
```

### 4.4 Freemium Business Model

**Revenue Flow:**

```
User purchases premium workflow ($9.99)
  ↓
Stripe Payment Processing
  ↓
Holokai receives $9.99
  ↓
Revenue Split:
  - Creator: $6.99 (70%)
  - Holokai: $3.00 (30%)
  ↓
Monthly Payout to Creator (via Stripe Connect)
```

**Pricing Tiers:**

| Tier | Creator Price Range | Holokai Fee | Example Use Case |
|------|---------------------|-------------|------------------|
| Free | $0.00 | $0.00 | Community workflows, open-source |
| Premium | $0.99 - $9.99 | 30% | Simple automation workflows |
| Pro | $10.00 - $49.99 | 30% | Complex multi-step workflows |
| Enterprise | $50.00+ | Negotiated | Custom workflows with support |

**Creator Incentives:**

1. **Holokai License Grants:** $50K/year total pool
   - Top 10% of creators by install count receive grants ($500-$5,000/year)
   - Criteria: >100 installs, >4.0 rating, active maintenance

2. **Reputation System:**
   - Leaderboards: "Most Installed", "Highest Rated", "Trending This Month"
   - Badges: "Top Contributor", "Rising Star", "Verified Publisher"
   - Profile page with stats, portfolio, testimonials

3. **Revenue Sharing:**
   - Creators keep 70% of premium workflow sales
   - Monthly payouts via Stripe Connect (minimum $100 threshold)

---

## 5. Cloud Execution Architecture (Post-MVP - Month 6+)

### 5.1 Trigger Modes

| Mode | Description | Use Case | Implementation |
|------|-------------|----------|----------------|
| **Desktop Delegate** | User clicks "Run" in desktop → desktop calls cloud API | Long-running workflows, server-side execution | Desktop sends workflow ID + inputs to cloud API |
| **Web UI** | Browser-based workflow execution (holokai.ai/workflows) | Lightweight access without desktop app | Web app calls same cloud API |
| **API/Webhooks** | Programmatic invocation via REST API | Git push → deploy workflow, Issue created → triage workflow | `POST /api/workflows/{id}/execute` |
| **Scheduled** | Cron-like scheduling for recurring workflows | Daily reports, weekly backups, monthly cleanup | Cloud scheduler → workflow execution API |

### 5.2 Cloud Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AWS ARCHITECTURE                                  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     API GATEWAY                                     │     │
│  │  POST /workflows/{id}/execute                                       │     │
│  └────────────────────────────┬───────────────────────────────────────┘     │
│                               │                                              │
│                               ▼                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     AWS LAMBDA                                      │     │
│  │  ┌──────────────────────────────────────────────────────────────┐  │     │
│  │  │  PORTABLE WORKFLOW ENGINE (Same code as Desktop!)           │  │     │
│  │  │  - No changes needed                                         │  │     │
│  │  │  - Same workflow.yaml files                                  │  │     │
│  │  │  - Same script execution                                     │  │     │
│  │  └──────────────────────────────────────────────────────────────┘  │     │
│  └────────────────────────────┬───────────────────────────────────────┘     │
│                               │                                              │
│                               ▼                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     S3 STORAGE SERVICE                              │     │
│  │  - Workflow packages (.wfpkg)                                       │     │
│  │  - Workflow files (templates, scripts)                              │     │
│  │  - Execution state (checkpoints)                                    │     │
│  │  - Output files                                                     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Lambda Configuration:**

```yaml
# serverless.yml
service: holokai-workflow-engine

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  memorySize: 1024  # 1GB RAM
  timeout: 900  # 15 minutes max
  environment:
    ANTHROPIC_API_KEY: ${env:ANTHROPIC_API_KEY}
    S3_BUCKET: holokai-workflow-storage
    STORAGE_BACKEND: s3

functions:
  executeWorkflow:
    handler: dist/lambda.executeWorkflow
    events:
      - http:
          path: /workflows/{id}/execute
          method: POST
          cors: true

resources:
  Resources:
    WorkflowStorageBucket:
      Type: AWS::S3::Bucket
      Properties:
        BucketName: holokai-workflow-storage
        VersioningConfiguration:
          Status: Enabled
```

### 5.3 Benefits of Portable Design

| Benefit | Local (MVP) | Cloud (Post-MVP) |
|---------|-------------|------------------|
| **Same Codebase** | Workflow engine runs in Electron main process | Same engine runs in AWS Lambda (zero code changes) |
| **Same Workflows** | workflow.yaml files work as-is | Same workflow.yaml files work in cloud |
| **Storage Abstraction** | `LocalStorageService` backend | `S3StorageService` backend (swap backend, same interface) |
| **No Refactoring** | Build portable from day 1 | Deploy to cloud without architecture changes |
| **Hybrid Execution** | N/A | Heavy workflows in cloud, light workflows local |
| **Multi-Cloud** | N/A | Can run on AWS, GCP, Azure (swap storage backend) |

---

## 6. Implementation Roadmap

### 6.1 MVP (Month 4) - Portable Engine Foundation

**Phase 1: Core Engine (Weeks 1-2)**
- [ ] Implement `WorkflowParser` (parse workflow.yaml)
- [ ] Implement `StepExecutor` (execute workflow steps sequentially)
- [ ] Implement `StateManager` (in-memory checkpoints)
- [ ] Implement `ErrorHandler` (graceful failures, retry logic)

**Phase 2: Storage & AI (Weeks 2-3)**
- [ ] Implement `StorageService` interface
- [ ] Implement `LocalStorageService` backend (MVP)
- [ ] Implement URL resolution (`workflow://`, `project://`, `personal://`)
- [ ] Implement `AIClient` interface (Anthropic)
- [ ] Test file access via URLs (no local paths)

**Phase 3: Script Execution & Security (Weeks 3-4)**
- [ ] Implement `ScriptRunner` (Node.js VM, Python subprocess, Bash subprocess)
- [ ] Implement `CapabilityEnforcer` (permission checks, RBAC integration)
- [ ] Implement resource limits (memory, CPU, timeout)
- [ ] Test sandboxed script execution

**Phase 4: Desktop Integration (Week 4)**
- [ ] Integrate workflow engine into Electron main process
- [ ] Implement IPC API for workflow execution
- [ ] Implement "My Workflows" personal project creation
- [ ] Test end-to-end workflow execution from Desktop UI

**Success Criteria (MVP):**
- ✅ Workflow engine has zero Electron dependencies
- ✅ Workflows access files via storage service URLs (not local paths)
- ✅ Scripts run with capability enforcement and resource limits
- ✅ "My Workflows" personal project auto-created for users

---

### 6.2 Post-MVP (Month 6) - Marketplace & Cloud

**Phase 1: Marketplace Backend (Weeks 1-2)**
- [ ] Implement marketplace database schema
- [ ] Implement publishing pipeline (scan → review → test → approve)
- [ ] Implement security scanner (malware, vulnerabilities, obfuscation)
- [ ] Implement payment processing (Stripe integration)

**Phase 2: Marketplace UI (Weeks 2-3)**
- [ ] Implement workflow browser (search, categories, filters)
- [ ] Implement workflow detail page (permissions, trust indicators, reviews)
- [ ] Implement installation flow (permission disclosure, approval)
- [ ] Implement workflow creator UI (AI-assisted, GUI builder)

**Phase 3: Cloud Deployment (Weeks 3-4)**
- [ ] Deploy workflow engine to AWS Lambda
- [ ] Implement S3StorageService backend
- [ ] Implement cloud trigger modes (API, webhooks, scheduled)
- [ ] Test same workflows running local vs cloud

**Success Criteria (Post-MVP):**
- ✅ Marketplace with 100+ published workflows
- ✅ Freemium model functional (free + premium workflows)
- ✅ Trust & safety (security scans, ratings, verified publishers)
- ✅ Same workflows run local and cloud without modification

---

## 7. Related Documents

| Document | Description |
|----------|-------------|
| `workflow-engine-requirements.md` | Complete workflow requirements specification |
| `prd-desktop-enterprise-mvp-2025-11-26.md` §3.7-3.8 | PRD sections for workflow marketplace & portable engine |
| `architecture-2025-11-25.md` | Main architecture document |
| `workflow-requirements-alignment-analysis.md` | Gap analysis between requirements and existing docs |

---

**End of Architecture Addendum**

# Epic Technical Specification: Portable Workflow Engine

Date: 2025-11-26
Author: Peter
Epic ID: 10
Status: Draft

---

## Overview

Epic 10 implements the portable workflow execution engine - a **critical architectural foundation** for Holokai Desktop that enables workflows to run locally in MVP (Month 4) and in the cloud (Post-MVP Month 6+) **with zero code changes**. This epic addresses PRD §3.8 Portable Workflow Engine requirements by building a cloud-portable execution engine with **zero Electron dependencies**, storage service abstraction (file URLs not paths), embedded AI client, capability-based sandboxing, and bundled runtimes (Node.js, Python, Bash). The design principle is "portable from day 1" to avoid expensive refactoring when adding cloud execution (Month 6+), enabling hybrid local/cloud workflows, scheduled execution, API triggers, and multi-cloud deployment. This epic **blocks Epic 7 (Workflows) and Epic 9 (User Workflow Marketplace)** as it provides the core execution infrastructure they depend on.

## Objectives and Scope

**In Scope:**
- **Storage service abstraction** (E10-S1): URL-based file access (`workflow://`, `project://`, `personal://`, `marketplace://`), LocalStorageService backend for MVP, S3/Azure backends stubbed for post-MVP, project isolation enforcement
- **Portable execution engine core** (E10-S2): WorkflowParser (workflow.yaml + instructions.md parsing), StepExecutor (sequential + conditional step execution), StateManager (in-memory checkpoints), ErrorHandler (retry logic, graceful failures), embedded AIClient (Anthropic API), bundled runtimes (Node.js, Python, Bash, Go)
- **Capability-based sandboxing** (E10-S3): Permission model (`{resource}:{action}:{scope}`), CapabilityEnforcer (permission checks, RBAC/SSO context inheritance), resource limits (512MB RAM, 1 core CPU, 60s timeout), user approval flow with per-version capability approvals and differential approval for updates
- **Script execution infrastructure** (E10-S4): ScriptRunner implementations (NodeScriptRunner with vm2, PythonScriptRunner subprocess, BashScriptRunner subprocess, GoScriptRunner subprocess), capability injection (storage proxy, AI client, user context), timeout enforcement
- **Zero Electron dependencies**: Engine can run in plain Node.js without Electron (critical constraint)
- **Design validation**: Same workflow.yaml files work local (MVP) and cloud (post-MVP) without modification

**Out of Scope (Post-MVP - Month 6+):**
- Cloud deployment (AWS Lambda, GCP Cloud Run, Azure Functions)
- S3/Azure Blob storage backend implementations (stubbed interfaces only in MVP)
- Cloud trigger modes (API, webhooks, scheduled execution - local execution only in MVP)
- Workflow marketplace integration (Epic 9 handles marketplace, this epic only provides execution)
- Advanced workflow orchestration (parallel step execution, advanced conditionals - basic sequential + simple conditionals only in MVP)
- State persistence to storage service (in-memory only in MVP - resumability deferred)
- Multi-step undo/replay (reversible steps tracked but undo logic deferred)
- Advanced monitoring/telemetry (basic logging only in MVP)

## System Architecture Alignment

This epic implements the portable workflow engine architectural layer (Architecture Addendum §2) with the following alignment:

**Components Added:**
- **WorkflowParser (Engine Core)** - Parse workflow.yaml and instructions.md (XML format), validate structure, extract step definitions
- **StepExecutor (Engine Core)** - Execute workflow steps sequentially (Basic tier) or with conditionals (Intermediate tier), pass outputs between steps
- **StateManager (Engine Core)** - Save in-memory execution checkpoints, support resumability (post-MVP)
- **ErrorHandler (Engine Core)** - Retry logic (3 attempts, exponential backoff), graceful failures, error reporting
- **StorageService Interface (Storage Abstraction)** - File operations via URLs (readFile, writeFile, deleteFile, fileExists, listFiles, getFileMetadata, getFileURL)
- **LocalStorageService (Storage Abstraction)** - MVP backend mapping URL schemes to local filesystem paths (`~/.holokai/workflows/{id}/`, `~/.holokai/My Workflows/`, etc.)
- **AIClient (Runtime Services)** - Embedded Anthropic API client (generate, generateStream, extract, chat methods)
- **ScriptRunner (Runtime Services)** - Execute JavaScript (vm2 sandbox), Python (subprocess), Bash (subprocess) with capability injection
- **CapabilityEnforcer (Security)** - Permission checks before script execution, RBAC/SSO context inheritance, resource limit monitoring

**Architectural Constraints (CRITICAL):**
- **Prohibited Dependencies:**
  - ❌ Electron APIs (`ipcRenderer`, `ipcMain`, `dialog`, `webContents`, etc.)
  - ❌ Local file paths (`/Users/`, `C:\Users\`, `__dirname`, `process.cwd()`)
  - ❌ OS-specific features (Windows Registry, macOS Keychain)
  - ❌ Desktop UI frameworks (Svelte, React)
- **Required Design:**
  - ✅ Storage service abstraction (file URLs, not paths)
  - ✅ Platform-agnostic runtime (Node.js >= 18)
  - ✅ Memory-based state (no external database dependency)
  - ✅ Stateless execution (can run as Lambda/Cloud Function)
- **Module Organization:** Workflow engine lives in `src/workflow-engine/` directory separate from Electron code (`src/main/`, `src/renderer/`)
- **No imports from:** `electron`, `@electron/remote`, or Electron-specific libraries allowed in workflow engine code
- **Data Flow (MVP):**
  User triggers workflow in Desktop UI → Electron IPC call to main process → Main process delegates to WorkflowEngine.execute() → Engine parses workflow → Executes steps via ScriptRunner → Returns results → Main process sends to renderer → UI displays results

**Data Flow:**
User triggers workflow → Desktop UI → IPC → Main process → `WorkflowEngine.execute()` → WorkflowParser → StepExecutor → ScriptRunner (sandboxed execution) → StorageService (file I/O via URLs) → AIClient (Anthropic API) → Results → Main process → IPC → UI

**Post-MVP Cloud Flow (Design Validation):**
API Gateway → AWS Lambda → `WorkflowEngine.execute()` (same code!) → S3StorageService (swap backend) → Anthropic API → Results → API response

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs | Owner |
|--------|---------------|--------|---------|-------|
| **WorkflowParser** (Engine Core) | Parse workflow.yaml + instructions.md, validate structure | workflow.yaml path, instructions.md path | Parsed workflow definition (steps, variables, metadata) | E10-S2 |
| **StepExecutor** (Engine Core) | Execute workflow steps (sequential, conditional), pass outputs | Parsed workflow, execution context | Step results, final output | E10-S2 |
| **StateManager** (Engine Core) | Save/load in-memory checkpoints, support undo | Workflow execution state | Checkpoint snapshots | E10-S2 |
| **ErrorHandler** (Engine Core) | Retry failed steps, graceful degradation, error reporting | Step execution errors | Retry attempts, error messages | E10-S2 |
| **StorageService (Interface)** (Storage Abstraction) | File operations abstraction | File URLs (`workflow://`, `project://`, etc.) | File contents, metadata | E10-S1 |
| **LocalStorageService** (Storage Abstraction) | Map URLs to local filesystem paths (MVP backend) | File URLs | Local file paths, file I/O operations | E10-S1 |
| **S3StorageService** (Storage Abstraction) | Map URLs to S3 keys (Post-MVP backend - stubbed) | File URLs | S3 presigned URLs, S3 operations | E10-S1 (stub only) |
| **AIClient** (Runtime Services) | Anthropic API integration | Prompts, file URLs for context | AI-generated text (streaming or complete) | E10-S2 |
| **ScriptRunner (Interface)** (Runtime Services) | Execute scripts in isolated contexts | Script code, language, capabilities | Script results, stdout/stderr | E10-S4 |
| **NodeScriptRunner** (Runtime Services) | Execute JavaScript in vm2 sandbox | JavaScript code, execution context | Script output, errors | E10-S4 |
| **PythonScriptRunner** (Runtime Services) | Execute Python via subprocess | Python code, execution context | Script output, errors | E10-S4 |
| **BashScriptRunner** (Runtime Services) | Execute Bash via subprocess | Bash code, execution context | Script output, errors | E10-S4 |
| **GoScriptRunner** (Runtime Services) | Execute Go via subprocess (go run) | Go code, execution context | Script output, errors | E10-S4 |
| **CapabilityEnforcer** (Security) | Permission checks, RBAC integration, resource limits | Requested capabilities, user context | Permission granted/denied, resource monitoring | E10-S3 |

### Data Models and Contracts

**Workflow Definition (workflow.yaml):**

```yaml
# Example workflow.yaml
name: "daily-standup-report"
description: "Generate daily standup report from meeting notes"
author: "Peter"
version: "1.0.0"
tier: "intermediate"  # basic, intermediate, advanced

inputs:
  meeting_notes_file:
    type: "file"
    required: true
    description: "Path to meeting notes markdown file"
  date:
    type: "date"
    default: "{{today}}"

steps:
  - id: "load-notes"
    type: "read_file"
    file: "{{meeting_notes_file}}"
    output: "notes_content"

  - id: "generate-summary"
    type: "ai_generate"
    prompt: "Summarize these meeting notes into a standup report: {{notes_content}}"
    output: "summary"

  - id: "save-report"
    type: "write_file"
    file: "project://reports/standup-{{date}}.md"
    content: "{{summary}}"

outputs:
  report_file: "project://reports/standup-{{date}}.md"

capabilities:
  - "filesystem:read:project"
  - "filesystem:write:project"
  - "ai:generate"

resource_limits:
  memory_mb: 512
  timeout_seconds: 60
```

**Parsed Workflow Interface:**

```typescript
interface ParsedWorkflow {
  name: string;
  description: string;
  author: string;
  version: string;
  tier: 'basic' | 'intermediate' | 'advanced';
  inputs: Record<string, WorkflowInput>;
  steps: WorkflowStep[];
  outputs: Record<string, string>;
  capabilities: string[];
  resourceLimits: ResourceLimits;
}

interface WorkflowInput {
  type: 'string' | 'number' | 'boolean' | 'file' | 'date';
  required: boolean;
  default?: unknown;
  description?: string;
}

interface WorkflowStep {
  id: string;
  type: 'read_file' | 'write_file' | 'ai_generate' | 'run_script' | 'conditional';
  [key: string]: unknown;  // Step-specific parameters
}

interface ResourceLimits {
  memoryMB: number;      // Default: 512
  timeoutSeconds: number; // Default: 60
  cpuCores: number;      // Default: 1
}
```

**Execution Context:**

```typescript
interface ExecutionContext {
  workflowId: string;
  executionId: string;
  variables: Record<string, unknown>;  // Input values + step outputs
  workingDirectory: string;            // URL scheme (project://, personal://)
  userContext: UserContext;
  resourceLimits: ResourceLimits;
  capabilities: string[];
}

interface UserContext {
  userId: string;
  jwt: string;       // For API calls with RBAC
  projectId?: string;
  role?: 'view' | 'edit' | 'admin';
}
```

**Script Interface:**

```typescript
interface Script {
  language: 'javascript' | 'python' | 'bash' | 'go';
  code: string;
  capabilities: string[];
}

interface ScriptResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode: number;
  durationMs: number;
}
```

**StorageService Interface (Critical for Portability):**

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

  // URL generation for AI prompts (presigned URLs for cloud)
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

| Scheme | Description | Example | Resolved Path (MVP LocalStorageService) |
|--------|-------------|---------|----------------------------------------|
| `workflow://` | Files within workflow package | `workflow://templates/output.md` | `~/.holokai/workflows/{id}/templates/output.md` |
| `project://` | Files in current project | `project://docs/prd.md` | `/project/.holokai/docs/prd.md` |
| `personal://` | Files in "My Workflows" | `personal://outputs/result.md` | `~/.holokai/My Workflows/outputs/result.md` |
| `marketplace://` | Files in marketplace (read-only) | `marketplace://{author}/{workflow}/README.md` | `~/.holokai/marketplace/{author}/{workflow}/README.md` |

**Database Schema (Moku API - for user workflow approvals):**

```sql
-- Capability approvals (user grants permissions during workflow installation)
-- Per-version approvals: users re-approve when capabilities change in updates
CREATE TABLE user_workflow_approvals (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  version VARCHAR(20) NOT NULL,  -- Workflow version (e.g., "1.0.0", "2.1.3")
  capabilities TEXT[] NOT NULL,  -- Array of approved capabilities for this version
  approved_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, workflow_id, version)  -- Per-version uniqueness
);

CREATE INDEX idx_user_workflow_approvals_user ON user_workflow_approvals(user_id);
CREATE INDEX idx_user_workflow_approvals_workflow ON user_workflow_approvals(workflow_id);
CREATE INDEX idx_user_workflow_approvals_version ON user_workflow_approvals(workflow_id, version);
```

### APIs and Interfaces

**WorkflowEngine Public API:**

```typescript
// src/workflow-engine/WorkflowEngine.ts
export class WorkflowEngine {
  constructor(
    private storageService: StorageService,
    private aiClient: AIClient,
    private capabilityEnforcer: CapabilityEnforcer
  ) {}

  /**
   * Execute a workflow
   * @param workflowPath - URL to workflow.yaml (e.g., "project://.holokai/workflows/my-workflow/workflow.yaml")
   * @param inputs - Input values for workflow variables
   * @param userContext - User authentication and authorization context
   * @returns Execution results
   */
  async execute(
    workflowPath: string,
    inputs: Record<string, unknown>,
    userContext: UserContext
  ): Promise<ExecutionResult> {
    // 1. Parse workflow
    const workflow = await this.parser.parse(workflowPath);

    // 2. Validate capabilities
    await this.capabilityEnforcer.checkPermissions(workflow.capabilities, userContext);

    // 3. Create execution context
    const context: ExecutionContext = {
      workflowId: workflow.name,
      executionId: generateId(),
      variables: { ...inputs },
      workingDirectory: this.resolveWorkingDirectory(workflowPath),
      userContext,
      resourceLimits: workflow.resourceLimits,
      capabilities: workflow.capabilities,
    };

    // 4. Execute steps
    const results = await this.stepExecutor.executeSteps(workflow.steps, context);

    return {
      success: true,
      outputs: results.outputs,
      durationMs: results.durationMs,
    };
  }
}

interface ExecutionResult {
  success: boolean;
  outputs: Record<string, unknown>;
  error?: string;
  durationMs: number;
}
```

**StepExecutor API:**

```typescript
// src/workflow-engine/executor/StepExecutor.ts
export class StepExecutor {
  async executeSteps(
    steps: WorkflowStep[],
    context: ExecutionContext
  ): Promise<{ outputs: Record<string, unknown>; durationMs: number }> {
    const startTime = Date.now();
    const outputs: Record<string, unknown> = {};

    for (const step of steps) {
      // Check if step has conditional
      if (step.if && !this.evaluateCondition(step.if, context)) {
        continue;  // Skip step
      }

      // Execute step based on type
      let result: unknown;
      switch (step.type) {
        case 'read_file':
          result = await this.storageService.readFile(this.resolveVariables(step.file, context));
          break;

        case 'write_file':
          await this.storageService.writeFile(
            this.resolveVariables(step.file, context),
            this.resolveVariables(step.content, context)
          );
          result = true;
          break;

        case 'ai_generate':
          result = await this.aiClient.generate(
            this.resolveVariables(step.prompt, context),
            { files: step.context_files }
          );
          break;

        case 'run_script':
          const scriptResult = await this.scriptRunner.execute({
            language: step.language,
            code: step.code,
            capabilities: context.capabilities,
          }, context);
          result = scriptResult.output;
          break;

        case 'conditional':
          // Nested conditional logic
          if (this.evaluateCondition(step.condition, context)) {
            result = await this.executeSteps(step.then_steps, context);
          } else if (step.else_steps) {
            result = await this.executeSteps(step.else_steps, context);
          }
          break;

        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      // Store step output
      if (step.output) {
        context.variables[step.output] = result;
        outputs[step.output] = result;
      }
    }

    return { outputs, durationMs: Date.now() - startTime };
  }

  private resolveVariables(template: string, context: ExecutionContext): string {
    // Replace {{variable}} placeholders
    return template.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
      return String(context.variables[varName] ?? '');
    });
  }

  private evaluateCondition(condition: string, context: ExecutionContext): boolean {
    // Simple condition evaluation (e.g., "{{status}} === 'success'")
    const resolved = this.resolveVariables(condition, context);
    return eval(resolved);  // NOTE: Use safe evaluator in production (e.g., js-interpreter)
  }
}
```

**AIClient API:**

```typescript
// src/workflow-engine/ai/AIClient.ts
export interface AIClient {
  generate(prompt: string, context?: AIContext): Promise<string>;
  generateStream(prompt: string, context?: AIContext): AsyncIterator<string>;
  extract<T>(prompt: string, schema: Schema<T>): Promise<T>;
  chat(messages: Message[]): Promise<string>;
}

interface AIContext {
  files?: string[];      // File URLs to include in context (loaded via storageService)
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

// Implementation using Anthropic SDK
export class AnthropicAIClient implements AIClient {
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

**ScriptRunner API:**

```typescript
// src/workflow-engine/runtime/ScriptRunner.ts
export interface ScriptRunner {
  execute(script: Script, context: ExecutionContext): Promise<ScriptResult>;
}

// Node.js implementation (vm2 sandbox)
export class NodeScriptRunner implements ScriptRunner {
  async execute(script: Script, context: ExecutionContext): Promise<ScriptResult> {
    const startTime = Date.now();

    try {
      // Create sandbox with injected services
      const sandbox = {
        // Storage service proxy (only expose methods if capability granted)
        storage: this.createStorageProxy(context.workingDirectory, script.capabilities),

        // AI client
        ai: this.aiClient,

        // Variables from workflow
        ...context.variables,

        // User context for API calls
        userContext: context.userContext,

        // Console (for debugging)
        console: {
          log: (...args: unknown[]) => console.log('[Workflow Script]', ...args),
        },
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
    const canRead = capabilities.includes('filesystem:read');
    const canWrite = capabilities.includes('filesystem:write');

    return {
      readFile: canRead
        ? (path) => {
            const url = path.startsWith('workflow://') ? path : `${workingDir}/${path}`;
            return this.storageService.readFile(url);
          }
        : undefined,

      writeFile: canWrite
        ? (path, content) => {
            const url = path.startsWith('workflow://') ? path : `${workingDir}/${path}`;
            return this.storageService.writeFile(url, content);
          }
        : undefined,

      // Only expose other methods if capabilities granted
      fileExists: canRead
        ? (path) => this.storageService.fileExists(this.resolveURL(path, workingDir))
        : undefined,
    };
  }
}

// Python implementation (subprocess)
export class PythonScriptRunner implements ScriptRunner {
  async execute(script: Script, context: ExecutionContext): Promise<ScriptResult> {
    const startTime = Date.now();

    try {
      // Inject variables via environment variables
      const env = {
        ...process.env,
        ...Object.fromEntries(
          Object.entries(context.variables).map(([k, v]) => [`WORKFLOW_${k.toUpperCase()}`, String(v)])
        ),
      };

      // Execute via subprocess
      const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
        const proc = spawn('python3', ['-c', script.code], {
          env,
          timeout: context.resourceLimits.timeoutSeconds * 1000,
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => stdout += data.toString());
        proc.stderr.on('data', (data) => stderr += data.toString());

        proc.on('close', (code) => {
          resolve({ stdout, stderr, exitCode: code ?? 0 });
        });

        proc.on('error', reject);
      });

      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.stderr || undefined,
        exitCode: result.exitCode,
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
}

// Bash implementation (subprocess)
export class BashScriptRunner implements ScriptRunner {
  async execute(script: Script, context: ExecutionContext): Promise<ScriptResult> {
    const startTime = Date.now();

    try {
      // Execute via subprocess
      const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
        const proc = spawn('bash', ['-c', script.code], {
          cwd: context.workingDirectory,  // Set working directory
          timeout: context.resourceLimits.timeoutSeconds * 1000,
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => stdout += data.toString());
        proc.stderr.on('data', (data) => stderr += data.toString());

        proc.on('close', (code) => {
          resolve({ stdout, stderr, exitCode: code ?? 0 });
        });

        proc.on('error', reject);
      });

      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.stderr || undefined,
        exitCode: result.exitCode,
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
}

// Go implementation (subprocess)
export class GoScriptRunner implements ScriptRunner {
  async execute(script: Script, context: ExecutionContext): Promise<ScriptResult> {
    const startTime = Date.now();

    try {
      // Write script to temp file (Go requires source file)
      const tempFile = path.join(os.tmpdir(), `workflow-${Date.now()}.go`);
      await fs.writeFile(tempFile, script.code);

      // Execute via subprocess: go run <file>
      const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
        const proc = spawn('go', ['run', tempFile], {
          cwd: context.workingDirectory,
          timeout: context.resourceLimits.timeoutSeconds * 1000,
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => stdout += data.toString());
        proc.stderr.on('data', (data) => stderr += data.toString());

        proc.on('close', (code) => {
          // Clean up temp file
          fs.unlink(tempFile).catch(() => {});
          resolve({ stdout, stderr, exitCode: code ?? 0 });
        });

        proc.on('error', (err) => {
          fs.unlink(tempFile).catch(() => {});
          reject(err);
        });
      });

      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.stderr || undefined,
        exitCode: result.exitCode,
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
}
```

**CapabilityEnforcer API:**

```typescript
// src/workflow-engine/security/CapabilityEnforcer.ts
export interface CapabilityEnforcer {
  checkPermission(capability: string, userContext: UserContext): Promise<boolean>;
  checkPermissions(capabilities: string[], userContext: UserContext): Promise<void>;
  enforceResourceLimits(execution: WorkflowExecution): void;
}

export class DefaultCapabilityEnforcer implements CapabilityEnforcer {
  async checkPermissions(capabilities: string[], userContext: UserContext): Promise<void> {
    for (const capability of capabilities) {
      const granted = await this.checkPermission(capability, userContext);
      if (!granted) {
        throw new PermissionDeniedError(`Capability not approved: ${capability}`);
      }
    }
  }

  async checkPermission(capability: string, userContext: UserContext): Promise<boolean> {
    const [resource, action, scope] = capability.split(':');

    // 1. Check user approvals (from user_workflow_approvals table)
    const userApprovals = await this.getUserApprovals(userContext.userId);
    if (!userApprovals.includes(capability)) {
      throw new PermissionDeniedError(`Capability not approved by user: ${capability}`);
    }

    // 2. Check RBAC permissions
    if (resource === 'filesystem' && action === 'write') {
      // User must have 'edit' role in project to write files
      if (userContext.role !== 'edit' && userContext.role !== 'admin') {
        throw new PermissionDeniedError('User does not have write access to project');
      }
    }

    // 3. Check network scope restrictions
    if (resource === 'network' && scope) {
      if (!this.isAllowedDomain(scope)) {
        throw new PermissionDeniedError(`Network access to ${scope} not allowed`);
      }
    }

    return true;
  }

  enforceResourceLimits(execution: WorkflowExecution): void {
    const limits = execution.resourceLimits;

    // Memory limit check
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    if (memoryUsage > limits.memoryMB) {
      throw new ResourceLimitExceededError(`Memory limit exceeded: ${memoryUsage}MB > ${limits.memoryMB}MB`);
    }

    // Timeout enforcement (handled by VM/subprocess timeout)

    // CPU limit (soft limit - log warning)
    const cpuUsage = process.cpuUsage();
    if (cpuUsage.user > limits.cpuCores * 1e9) {
      console.warn('CPU usage high - workflow may be throttled');
    }
  }

  private async getUserApprovals(userId: string): Promise<string[]> {
    // Query Moku API for user's approved capabilities
    // SELECT capabilities FROM user_workflow_approvals WHERE user_id = ?
    return [];  // Placeholder - implement with Moku API client
  }

  private isAllowedDomain(domain: string): boolean {
    // Whitelist of allowed domains for network access
    const allowedDomains = ['github.com', 'api.anthropic.com', 'api.openai.com'];
    return allowedDomains.includes(domain);
  }
}
```

### Workflows and Sequencing

**Workflow Execution Flow (MVP Local):**

1. **User triggers workflow in Desktop UI**
   - User clicks "Run Workflow" button in UI
   - UI collects input values (e.g., file path, date range)

2. **IPC call to main process**
   - Renderer: `ipcRenderer.invoke('workflow:execute', { workflowPath, inputs })`
   - Main process IPC handler receives request

3. **Main process delegates to WorkflowEngine**
   - Main handler: `await workflowEngine.execute(workflowPath, inputs, userContext)`
   - User context includes userId, JWT, projectId, role (from existing auth service)

4. **WorkflowParser parses workflow.yaml**
   - Load workflow.yaml from storage service: `await storageService.readFile(workflowPath)`
   - Parse YAML structure (using `js-yaml` library)
   - Load instructions.md if present (XML format, using `xml2js`)
   - Validate required fields (name, steps, capabilities)
   - Extract step dependencies (sequential order)

5. **CapabilityEnforcer checks permissions**
   - For each capability in workflow.capabilities:
     - Check user approvals in `user_workflow_approvals` table (Moku API query)
     - Check RBAC permissions (e.g., write permission requires edit role)
     - Throw PermissionDeniedError if any capability denied

6. **StepExecutor executes workflow steps**
   - Iterate through workflow.steps sequentially
   - For each step:
     - Check conditional (`if` attribute) - skip if condition false
     - Execute step based on type:
       - **read_file**: `await storageService.readFile(url)`
       - **write_file**: `await storageService.writeFile(url, content)`
       - **ai_generate**: `await aiClient.generate(prompt, { files: contextFiles })`
       - **run_script**: `await scriptRunner.execute(script, context)`
       - **conditional**: Recursively execute then_steps or else_steps
     - Store step output in context.variables (for next steps to reference)
     - Save checkpoint to StateManager (in-memory)

7. **Script execution (if run_script step)**
   - Determine language from file extension or explicit language field
   - **JavaScript**: NodeScriptRunner creates vm2 sandbox with injected storage/AI/variables
   - **Python**: PythonScriptRunner spawns subprocess with env vars
   - **Bash**: BashScriptRunner spawns subprocess with working directory
   - **Go**: GoScriptRunner writes code to temp file, spawns `go run <file>`
   - Enforce timeout (resourceLimits.timeoutSeconds)
   - Capture stdout/stderr
   - Return ScriptResult to StepExecutor

8. **Error handling (if step fails)**
   - ErrorHandler catches exception
   - Retry logic: Attempt up to 3 times with exponential backoff (1s, 2s, 4s)
   - If still failing after 3 attempts:
     - Check if step marked as critical (workflow.yaml `critical: true`)
     - If critical: Abort workflow with error
     - If non-critical: Log error, continue to next step (graceful degradation)

9. **Return results to main process**
   - StepExecutor returns final outputs: `{ outputs: { report_file: "..." }, durationMs: 5234 }`
   - WorkflowEngine returns ExecutionResult to main process

10. **IPC sends results to renderer**
    - Main process: `webContents.send('workflow:complete', { success: true, outputs, durationMs })`
    - Renderer receives event, updates UI with results

**Workflow Installation Flow (Capability Approval):**

1. **User clicks "Install Workflow" in marketplace**
   - UI shows workflow details, including requested capabilities

2. **Permission disclosure dialog**
   - Desktop displays modal:
     ```
     This workflow requests:
     ✓ Filesystem: Read/Write in workspace
     ✓ Network: HTTPS requests to github.com
     ✓ Git: Read repository history
     ✓ Bash: Execute shell commands

     Risk Score: Medium Risk

     [Cancel] [Approve & Install]
     ```

3. **User approves**
   - UI sends IPC call: `ipcRenderer.invoke('workflow:approve', { workflowId, capabilities })`

4. **Main process stores approval in Moku API**
   - `POST /api/workflows/approvals` with `{ userId, workflowId, capabilities }`
   - Moku API inserts row into `user_workflow_approvals` table

5. **Workflow installed**
   - Download workflow package to `~/.holokai/workflows/{id}/`
   - Extract workflow.yaml, instructions.md, templates, scripts
   - Workflow now available in user's "My Workflows" library

**Storage URL Resolution Flow:**

1. **Workflow step references file**
   - Step definition: `file: "project://docs/prd.md"`

2. **StorageService.readFile() called**
   - URL parser extracts protocol: `project`
   - URL parser extracts path: `docs/prd.md`

3. **Backend resolution (LocalStorageService MVP)**
   - Look up base path for `project://` protocol
   - Base path: `/project/.holokai/` (from current project context)
   - Resolve full path: `/project/.holokai/docs/prd.md`
   - Validate path (prevent directory traversal attacks)
   - Check project isolation (ensure URL protocol matches current execution context)

4. **File I/O operation**
   - Node.js `fs.readFile('/project/.holokai/docs/prd.md', 'utf-8')`
   - Return file contents to caller

5. **Post-MVP cloud resolution (S3StorageService)**
   - Look up S3 bucket and key prefix for `project://` protocol
   - Resolve S3 key: `projects/{projectId}/docs/prd.md`
   - Generate presigned URL (expires in 1 hour)
   - Return presigned URL to caller (for AI context assembly)
   - OR: Directly fetch file from S3 using AWS SDK

**AI Context Assembly Flow:**

1. **Workflow step specifies context files**
   - Step definition:
     ```yaml
     - id: "generate-analysis"
       type: "ai_generate"
       prompt: "Analyze these requirements and suggest improvements"
       context_files:
         - "project://docs/prd.md"
         - "project://docs/architecture.md"
     ```

2. **AIClient.generate() loads context files**
   - For each URL in context_files:
     - `const content = await storageService.readFile(url)`
     - Wrap in XML tags: `<file>\n${content}\n</file>`

3. **Assemble full prompt**
   - Concatenate file contents + user prompt:
     ```
     <file>
     [PRD content...]
     </file>

     <file>
     [Architecture content...]
     </file>

     Analyze these requirements and suggest improvements
     ```

4. **Call Anthropic API**
   - `await anthropicClient.messages.create({ messages: [{ role: 'user', content: fullPrompt }] })`

5. **Return AI response**
   - Extract text from Anthropic response
   - Return to StepExecutor as step output

## Non-Functional Requirements

### Performance

**Response Time Targets:**
- Workflow execution startup: <5s (parse + validate + permission checks)
- Step execution (read_file): <100ms for files <10MB
- Step execution (ai_generate): <10s for prompts <5,000 tokens (depends on Anthropic API)
- Step execution (run_script JavaScript): <1s for simple scripts, <60s with timeout
- Full workflow execution: <60s default timeout (configurable per workflow)

**Resource Limits (Default per workflow):**
- Memory: 512MB heap (configurable in workflow.yaml)
- CPU: 1 core soft limit (log warning if exceeded)
- Timeout: 60 seconds per step (configurable)
- Concurrent workflows: Max 5 simultaneous executions per user (prevent resource exhaustion)

**Scalability (Post-MVP Cloud):**
- Lambda cold start: <3s (with bundled runtimes)
- Lambda warm execution: <1s overhead (workflow execution time dominates)
- Concurrent Lambda executions: 100+ (configurable based on org tier)

### Security

**Capability-Based Permissions:**
- **Format**: `{resource}:{action}[:{scope}]`
- **Examples**:
  - `filesystem:read` - Read any file in workflow context
  - `filesystem:write:project` - Write files only in project directory
  - `network:https:github.com` - HTTPS requests to github.com only
  - `git:read` - Read git repository history
  - `bash:execute` - Execute bash commands (highest risk)

**Permission Enforcement:**
- User must approve capabilities during workflow installation (mandatory disclosure)
- CapabilityEnforcer checks approvals before each script execution
- RBAC integration: Scripts inherit user's role (view/edit/admin) - cannot escalate privileges
- No capability = no access (deny by default)

**Sandboxing:**
- **JavaScript**: vm2 sandbox with no access to Node.js APIs (eval disabled)
- **Python**: Subprocess isolation (no shared memory with main process)
- **Bash**: Subprocess isolation with restricted environment variables
- **Resource limits**: Memory, CPU, timeout enforced at runtime
- **Network restrictions**: Only HTTPS allowed, domain whitelist enforced

**Storage Isolation:**
- **Project isolation**: Workflows cannot access files from other projects
  - Example: Workflow in "My Workflows" cannot read `project://Team Project/secret.txt`
  - Enforced by StorageService checking execution context projectId
- **Cross-project access error**: Throw `CrossProjectAccessError` if attempted

**Data Protection:**
- JWT tokens passed to scripts for API calls (inherit user permissions)
- Secrets stored in Moku API (encrypted), never in workflow.yaml
- API keys accessed via environment variables (injected by engine, not hardcoded)

**Audit Logging:**
- All workflow executions logged: userId, workflowId, timestamp, duration, success/failure
- Permission checks logged: approved capabilities, denied attempts
- Stored in Moku API `audit_log` table for compliance reporting

### Reliability/Availability

**Error Handling:**
- **Retry logic**: Failed steps retried 3 times with exponential backoff (1s, 2s, 4s delays)
- **Graceful failures**: Non-critical steps can fail without aborting workflow
- **Error reporting**: Detailed error messages to user (step id, error type, suggestion)
- **Rollback**: Steps marked as reversible can be undone (undo logic deferred to post-MVP)

**State Management:**
- **Checkpoints**: Execution state saved after each step (in-memory in MVP)
- **Resumability**: Load checkpoint and resume from last successful step (post-MVP - requires persistent storage)
- **Cleanup**: Checkpoints cleared after workflow completion or failure

**Network Resilience:**
- **Anthropic API**: Retry on 429 (rate limit), 500, 502, 503 errors with exponential backoff
- **Storage Service**: Retry on network timeouts (S3/Azure transient failures in post-MVP)
- **Timeout handling**: Step-level timeouts prevent indefinite hangs

**Resource Exhaustion Prevention:**
- Max 5 concurrent workflow executions per user (prevent resource DoS)
- Memory monitoring: Abort if heap usage exceeds limit
- Timeout enforcement: Kill scripts that exceed timeoutSeconds

### Observability

**Metrics:**
- `workflow.execution.duration` - P50/P95/P99 execution time by workflowId
- `workflow.execution.success_rate` - Percentage of successful executions
- `workflow.step.duration` - P50/P95/P99 step execution time by step type (read_file, ai_generate, run_script)
- `workflow.script.timeout_rate` - Percentage of scripts killed due to timeout
- `workflow.capability.denied_rate` - Percentage of permission denials
- `workflow.ai.token_usage` - Total tokens used by AI steps
- `workflow.concurrent_executions` - Current number of active workflows

**Logging:**
- **INFO:** Workflow execution started (workflowId, userId, inputs)
- **INFO:** Step executed (stepId, type, duration, output size)
- **INFO:** Workflow execution completed (workflowId, totalDuration, stepCount)
- **WARN:** Step retrying (stepId, attempt: 2/3, error)
- **WARN:** Resource limit approaching (memoryUsage: 450MB / 512MB)
- **ERROR:** Workflow execution failed (workflowId, failedStepId, error)
- **ERROR:** Permission denied (capability, userId, workflowId)
- **ERROR:** Resource limit exceeded (memoryMB, timeoutSeconds)

**Tracing:**
- Distributed trace: Desktop UI → IPC → WorkflowEngine → StepExecutor → ScriptRunner → StorageService → Anthropic API
- Trace workflow execution across services: Main process → Moku API (permission check) → Anthropic API (AI generation) → S3 (post-MVP)
- Span timing for each step type to identify performance bottlenecks

**Alerting:**
- Alert if workflow execution failure rate > 10% (critical issue)
- Alert if permission denial rate > 5% (capability misconfiguration)
- Alert if script timeout rate > 20% (resource limits too restrictive)
- Alert if AI token usage > 1M tokens/day (cost monitoring)

## Dependencies and Integrations

**Internal Dependencies (BLOCKERS):**
- **E4-S2: State Persistence / KeyManager** - NEEDED for secure storage of workflow execution state (optional for MVP - in-memory state sufficient)
  - Workflow engine can checkpoint to encrypted storage via KeyManager
  - **Mitigation:** E10-S2 implements in-memory StateManager, defer persistent checkpoints to post-MVP
- **No hard blockers** - Workflow engine is foundational and has no dependencies on other epics

**External Dependencies:**
- **Anthropic SDK (`@anthropic-ai/sdk`)** - Required for AI generation steps
  - Version: 0.68.x+
  - API key stored in environment variable (not in workflow.yaml)
- **vm2** - Required for JavaScript script sandboxing
  - Version: 3.9.x+
  - Isolated VM execution with timeout support
- **Node.js** - Runtime for workflow engine
  - Version: 18+
  - Must support async/await, ES modules
- **Python** - Bundled runtime for Python scripts
  - Version: 3.9+ (bundled with Desktop installer)
- **Bash** - Bundled runtime for Bash scripts
  - Version: 4.0+ (bundled with Desktop installer)

**Integration Points:**

**1. Moku API Integration:**
- **User workflow approvals** - Query `user_workflow_approvals` table for capability checks
- **RBAC context** - Get user's role in project for permission enforcement
- **Audit logging** - POST execution events to audit_log table
- **JWT token** - Passed from auth service for API authorization

**2. Storage Service Integration (Post-MVP):**
- **S3StorageService** - Swap LocalStorageService with S3 backend for cloud execution
- **Presigned URLs** - Generate URLs for AI context files (S3 presigned URLs valid for 1 hour)
- **File uploads** - Direct uploads to S3 via presigned URLs (no proxy through desktop)

**3. Auth Service Integration:**
- **User context** - userId, JWT token passed from existing auth service (PRD §4.4 SSO)
- **Role-based permissions** - Scripts inherit user's RBAC role (view, edit, admin)

**4. Desktop IPC Integration (MVP):**
- **Workflow execution IPC** - Main process exposes `workflow:execute` handler
- **Progress events** - Main process sends `workflow:progress` events to renderer (step completion, percentage)
- **Results** - Main process sends `workflow:complete` event with outputs

## Acceptance Criteria (Authoritative)

**AC-1: Storage Service Abstraction - E10-S1**
- [ ] StorageService interface defined with 9 methods (readFile, writeFile, deleteFile, fileExists, listFiles, getFileMetadata, getFileURL, readFileBinary, writeFileBinary)
- [ ] URL scheme parser correctly extracts protocol and path from `workflow://`, `project://`, `personal://`, `marketplace://` URLs
- [ ] LocalStorageService backend functional (all methods implemented using Node.js fs module)
- [ ] URL schemes mapped to local filesystem paths: `workflow://` → `~/.holokai/workflows/{id}/`, `project://` → `/project/.holokai/`, `personal://` → `~/.holokai/My Workflows/`, `marketplace://` → `~/.holokai/marketplace/`
- [ ] Project isolation enforced: Workflows cannot access files from other projects (CrossProjectAccessError thrown)
- [ ] File URLs generated correctly for AI prompts (returns local file paths in MVP, presigned URLs in post-MVP)
- [ ] S3StorageService and AzureBlobStorageService stubbed (interfaces implemented, methods throw "Not implemented in MVP")

**AC-2: Portable Execution Engine Core - E10-S2**
- [ ] Workflow engine has zero Electron dependencies (can run in plain Node.js without Electron - validated by test harness)
- [ ] WorkflowParser correctly parses workflow.yaml (using js-yaml library) and instructions.md (XML format, using xml2js)
- [ ] Workflow structure validated: required fields present (name, steps, capabilities), step definitions valid
- [ ] StepExecutor executes workflow steps sequentially (Basic tier) and with conditionals (Intermediate tier)
- [ ] Step outputs passed to next steps via context.variables (variable resolution with `{{varName}}` syntax)
- [ ] StateManager saves checkpoints in memory (no external database dependency)
- [ ] ErrorHandler gracefully handles failures with retry logic (3 attempts, exponential backoff: 1s, 2s, 4s)
- [ ] AIClient functional (can call Anthropic API with streaming and non-streaming generation)
- [ ] AI context assembly: Files loaded via storageService.readFile(url) and included in prompts
- [ ] Bundled runtimes included: Node.js (native), Python (bundled), Bash (bundled), Go (bundled)
- [ ] Language detection from file extension (.js, .py, .sh, .go) works correctly
- [ ] Engine can run standalone (Node.js test harness outside Electron passes all tests)

**AC-3: Capability-Based Sandboxing - E10-S3**
- [ ] Capability format defined: `{resource}:{action}[:{scope}]` (e.g., `filesystem:read`, `filesystem:write:project`, `network:https:github.com`)
- [ ] CapabilityEnforcer.checkPermission() verifies user approved capability during workflow installation
- [ ] Permission check queries user_workflow_approvals table in Moku API
- [ ] RBAC/SSO context integrated: Scripts inherit user permissions (view role cannot write files, even if capability approved)
- [ ] RBAC check: getUserRoleInProject(userContext) >= 'edit' required for write operations
- [ ] Resource limits enforced: memory (512MB default), CPU (1 core soft limit), timeout (60s default)
- [ ] Permission denial throws PermissionDeniedError with clear message
- [ ] Resource limit exceeded throws ResourceLimitExceededError
- [ ] Storage proxy prevents unauthorized file access (scripts call storage.readFile(), not raw fs.readFile())
- [ ] All capability enforcement tests pass (approved → allowed, unapproved → denied, RBAC integration)

**AC-4: Script Execution Infrastructure - E10-S4**
- [ ] ScriptRunner interface defined with execute(script, context) method
- [ ] NodeScriptRunner executes JavaScript in isolated VM (vm2 library) with timeout
- [ ] NodeScriptRunner sandbox includes: storage proxy, ai client, workflow variables, userContext
- [ ] NodeScriptRunner disables eval() for security (VM option: eval: false)
- [ ] PythonScriptRunner executes Python via subprocess (spawn('python3', ['-c', code]))
- [ ] PythonScriptRunner injects variables via environment variables (WORKFLOW_* prefix)
- [ ] BashScriptRunner executes Bash via subprocess (spawn('bash', ['-c', code]))
- [ ] BashScriptRunner sets working directory to workflow context
- [ ] GoScriptRunner executes Go via subprocess (spawn('go', ['run', tempFile]))
- [ ] GoScriptRunner writes code to temp file and cleans up after execution
- [ ] Timeout enforcement works: scripts killed after resourceLimits.timeoutSeconds
- [ ] Capability injection works: storage, AI client available in sandbox only if capabilities granted
- [ ] Script errors captured and returned in ScriptResult (success: false, error message, exitCode, duration)
- [ ] All script execution tests pass (JavaScript, Python, Bash, Go with various scenarios)

**AC-5: Zero Electron Dependencies Validation**
- [ ] Workflow engine module located in `src/workflow-engine/` directory (separate from `src/main/`, `src/renderer/`)
- [ ] No imports from `electron`, `@electron/remote`, or Electron-specific libraries in workflow engine code
- [ ] All dependencies are platform-agnostic (Node.js only: fs, path, vm2, js-yaml, xml2js, @anthropic-ai/sdk)
- [ ] Test harness runs workflow engine in plain Node.js (not Electron) and all tests pass
- [ ] StorageService uses URLs (not local paths) for all file operations
- [ ] AIClient uses Anthropic API (platform-agnostic, works local and cloud)

## Traceability Mapping

| AC ID | PRD Reference | Spec Section | Component/API | Test Approach |
|-------|---------------|--------------|---------------|---------------|
| AC-1 | PRD §3.8.2 (Storage Abstraction) | Data Models §4.2, APIs §4.3 | StorageService, LocalStorageService | Unit: URL parsing, path resolution, file I/O<br>Integration: Project isolation enforcement<br>Security: Cross-project access blocked |
| AC-2 | PRD §3.8.1, 3.8.4 (Engine Core) | Services §4.1, Workflows §4.4 | WorkflowParser, StepExecutor, AIClient | Unit: YAML parsing, step execution logic, AI context assembly<br>Integration: End-to-end workflow execution<br>Performance: Execution time measurement<br>Portability: Standalone Node.js test harness |
| AC-3 | PRD §3.8.5 (Sandboxing), Arch Addendum §2.6 | APIs §4.3, Services §4.1 | CapabilityEnforcer | Unit: Permission checks, RBAC integration<br>Integration: Moku API approval queries<br>Security: Permission denial, resource limits |
| AC-4 | Arch Addendum §2.5 (Script Execution) | APIs §4.3, Workflows §4.4 | NodeScriptRunner, PythonScriptRunner, BashScriptRunner, GoScriptRunner | Unit: Script execution, sandbox injection, timeout<br>Integration: Capability injection<br>Security: Sandbox isolation, capability enforcement |
| AC-5 | PRD §3.8.1 (Zero Electron Deps) | Architecture Alignment §3 | All workflow engine modules | Static analysis: Dependency graph validation<br>Integration: Standalone Node.js execution<br>Portability: Same code runs local + cloud (post-MVP) |

## Risks, Assumptions, Open Questions

**Risks:**

1. **RISK:** Portable design may slow MVP development velocity compared to Electron-first approach
   - **Impact:** High - 2-3 weeks additional development time
   - **Probability:** Medium
   - **Mitigation:** Accept velocity trade-off for long-term cloud portability; prototype early to validate feasibility; use established patterns (StorageService abstraction) to minimize complexity

2. **RISK:** Storage abstraction could break existing code that assumes local filesystem paths
   - **Impact:** Medium - refactoring required if existing code couples to local paths
   - **Probability:** Low - workflow engine is new code (no existing implementation to break)
   - **Mitigation:** Implement abstraction layer that wraps local filesystem; migrate incrementally; validate with integration tests

3. **RISK:** Script sandboxing (vm2) performance overhead could make workflows too slow
   - **Impact:** Medium - user frustration if workflows take >10s for simple tasks
   - **Probability:** Low - vm2 has minimal overhead (<50ms) for typical scripts
   - **Mitigation:** Benchmark early with realistic workflows; optimize hot paths; consider lazy permission checking (check once at workflow start, not per step)

4. **RISK:** Bundled runtimes (Python + Bash + Go) could increase Desktop installer size significantly
   - **Impact:** Low - acceptable trade-off for portable execution and broader workflow marketplace adoption
   - **Probability:** High - Python + Bash + Go add ~80MB to installer (Python ~40MB, Bash ~10MB, Go ~30MB)
   - **Mitigation:** ~80MB increase acceptable for Desktop installer (typical installers 100-300MB); Go enables DevOps/infrastructure automation workflows (popular in marketplace); defer cloud optimization (cloud runtimes are separate Docker images, not bundled); document installer size increase in release notes

5. **RISK:** Capability-based permissions may confuse users (too granular, permission fatigue)
   - **Impact:** Medium - users may reject workflows due to unclear permission requests
   - **Probability:** Medium - capability model is unfamiliar to non-technical users
   - **Mitigation:** Group capabilities into user-friendly categories ("File Access", "Network Access", "Code Execution"); show risk score (Low/Medium/High); provide clear explanations in permission disclosure dialog; default to denying high-risk capabilities

**Assumptions:**

1. **ASSUMPTION:** Same-day cloud portability is more valuable than fastest possible MVP development
   - **Validation:** PRD §3.8 explicitly requires portable design to avoid refactoring; validated with stakeholders
   - **Impact if wrong:** 6+ months of refactoring when adding cloud execution (vs. 2-3 weeks upfront)

2. **ASSUMPTION:** LocalStorageService → S3StorageService swap is straightforward (no architectural changes needed)
   - **Validation:** Prototype S3StorageService interface; validate presigned URL workflow works identically to local file access
   - **Impact if wrong:** Post-MVP cloud deployment delayed by refactoring

3. **ASSUMPTION:** In-memory state management sufficient for MVP (no persistent checkpoints needed)
   - **Validation:** User workflows expected to complete in <60s (no long-running workflows in MVP)
   - **Impact if wrong:** Add StateManager persistence to storage service in post-MVP (architecture already supports it)

4. **ASSUMPTION:** Capability-based permissions provide sufficient security without complex policy engine
   - **Validation:** Security review with CISO; compare to Docker capabilities, Android permissions (established patterns)
   - **Impact if wrong:** Add policy engine in post-MVP (capabilities are foundation, policies can layer on top)

**Open Questions:**

~~1. **QUESTION:** Should workflow engine support parallel step execution in MVP, or defer to post-MVP?~~
   - **DECISION:** NO - Sequential + conditionals only in MVP. Parallel execution deferred to post-MVP.
   - **Decided by:** Product/Architecture review (2025-11-27)
   - **Rationale:** Parallel execution adds complexity (dependency graphs, race condition handling); defer until user demand validated

~~2. **QUESTION:** Should StateManager persist checkpoints to storage service in MVP for resumability?~~
   - **DECISION:** NO - In-memory checkpoints only. Persistent resumability deferred to post-MVP.
   - **Decided by:** Product/Architecture review (2025-11-27)
   - **Rationale:** Resume-after-crash capability adds storage service dependency and complexity; defer until cloud execution (Month 6+)

~~3. **QUESTION:** Should workflow engine support custom script interpreters (e.g., Ruby, Go) or only Node.js, Python, Bash?~~
   - **DECISION:** YES - Add Go runtime in addition to Node.js, Python, Bash (4 runtimes total in MVP).
   - **Decided by:** Product/Architecture review (2025-11-27)
   - **Rationale:** Go is increasingly popular for DevOps/automation workflows; bundled runtime adds ~30MB (acceptable); enables broader workflow marketplace adoption
   - **Implementation:** Bundle Go 1.21+ executable with Desktop installer, detect .go file extension

~~4. **QUESTION:** Should capability approvals be stored per-workflow or per-workflow-version (for marketplace updates)?~~
   - **DECISION:** Per-version with shortened approval/review process for minor updates.
   - **Decided by:** Product/Architecture review (2025-11-27)
   - **Rationale:** Per-version ensures users re-approve when capabilities change in marketplace updates; implement fast-track approval for version updates that don't add new capabilities (auto-approve if capabilities subset of previous approval)
   - **Implementation:** `user_workflow_approvals` table schema: `(user_id, workflow_id, version, capabilities_approved[], approved_at)`. When updating workflow: if new capabilities ⊆ old capabilities, skip approval dialog; else show differential approval ("Version 2.0 requests 2 new capabilities: network:https:api.github.com, git:write")

~~5. **QUESTION:** Should workflow engine support workflow-to-workflow invocation (nested workflows)?~~
   - **DECISION:** NO - Workflow-to-workflow invocation (nested workflows) is NOT supported
   - **Decided by:** Product review (2025-11-27)
   - **Rationale:** Nested workflows add significant complexity (circular dependency detection, stack depth limits, error propagation, debugging complexity); MVP focuses on single workflow execution; feature deferred to Advanced tier (post-MVP) or future enterprise features
   - **Implementation:**
     - Workflow engine executes single workflow only (no nested invocation)
     - WorkflowParser validation: Reject workflow definitions with nested workflow invocation syntax
     - Error message if user attempts nested workflows: "Nested workflow invocation not supported in current version. Consider using multiple sequential steps instead."
     - Future: If adding nested workflows, implement DAG validation (cycle detection), max depth limits (default: 5 levels), and proper error context propagation

## Test Strategy Summary

**Test Levels:**

**1. Unit Tests (Target: 90% coverage - higher than typical due to critical nature)**
- **WorkflowParser:**
  - YAML parsing (valid workflow.yaml, invalid syntax, missing required fields)
  - XML parsing (instructions.md, nested steps, conditionals)
  - Variable extraction (inputs, defaults, system variables)
- **StepExecutor:**
  - Sequential execution (3 steps, outputs passed correctly)
  - Conditional execution (if/else logic, condition evaluation)
  - Variable resolution ({{varName}} replacement, nested variables)
  - Error handling (step failure, graceful degradation, critical steps)
- **StateManager:**
  - Checkpoint save/load (in-memory Map, serialization)
  - Checkpoint cleanup (after workflow completion)
  - Undo logic (reversible steps, undo action execution - stub in MVP)
- **StorageService:**
  - URL parsing (protocol extraction, path extraction, validation)
  - LocalStorageService backend (file I/O, directory creation, path validation)
  - Project isolation (cross-project access blocked, CrossProjectAccessError thrown)
- **AIClient:**
  - Context assembly (file loading, prompt concatenation)
  - Anthropic API integration (mocked responses, streaming, error handling)
- **ScriptRunner:**
  - JavaScript execution (vm2 sandbox, timeout, sandbox injection)
  - Python execution (subprocess, env vars, stdout/stderr capture)
  - Bash execution (subprocess, working directory, timeout)
- **CapabilityEnforcer:**
  - Permission checks (approved → allowed, unapproved → denied)
  - RBAC integration (role checks, permission escalation blocked)
  - Resource limits (memory, CPU, timeout enforcement)

**2. Integration Tests**
- **End-to-end workflow execution:** Parse workflow.yaml → Execute 3 steps (read_file, ai_generate, write_file) → Verify outputs
- **Storage service integration:** Workflow reads from `project://docs/prd.md` → LocalStorageService resolves to local path → File loaded correctly
- **AI context assembly:** Workflow step with context_files → AIClient loads files via StorageService → Anthropic API called with full prompt
- **Script execution with capabilities:** JavaScript script calls `storage.readFile()` → CapabilityEnforcer checks permission → StorageService proxy allows access
- **Project isolation enforcement:** Workflow in "My Workflows" attempts to read `project://Team Project/file.txt` → CrossProjectAccessError thrown
- **Retry logic:** Step fails with network error → ErrorHandler retries 3 times with exponential backoff → Success on 2nd attempt
- **Timeout enforcement:** JavaScript script runs infinite loop → NodeScriptRunner kills after 60s → ScriptResult.error = "Timeout exceeded"

**3. Standalone Test Harness (Critical for Portability Validation)**
- **Purpose:** Validate workflow engine runs in plain Node.js without Electron
- **Setup:** Create `tests/standalone/` directory with Node.js entry point (not Electron)
- **Tests:**
  - Run WorkflowEngine.execute() with sample workflow.yaml
  - Execute all step types (read_file, write_file, ai_generate, run_script, conditional)
  - Verify zero Electron dependencies (no imports fail)
  - Validate StorageService uses URLs (not local paths)
  - Confirm AIClient works (Anthropic API calls succeed)
- **CI Integration:** Run standalone tests in GitHub Actions (Node.js environment, not Electron)

**4. Security Tests**
- **Capability enforcement:** Attempt to execute script without approved capability → PermissionDeniedError
- **RBAC integration:** User with 'view' role attempts filesystem:write → PermissionDeniedError
- **Sandbox escape:** JavaScript script attempts `require('fs')` → vm2 blocks access
- **Resource limits:** Script allocates 600MB memory → ResourceLimitExceededError
- **Cross-project access:** Workflow in Project A attempts to read file from Project B → CrossProjectAccessError
- **Malicious URL:** Workflow attempts `workflow://../../../etc/passwd` → Path validation blocks directory traversal

**5. Performance Tests**
- **Workflow startup:** Measure time from execute() call to first step execution (target: <5s)
- **Step execution latency:** Measure read_file, write_file, ai_generate, run_script step times
- **AI context assembly:** Load 5 files (50MB total) into AI context → Measure time (target: <10s)
- **Script execution overhead:** Execute simple JavaScript script (console.log("hello")) → Measure vm2 overhead (target: <50ms)
- **Concurrent workflows:** Run 10 workflows simultaneously → Verify resource limits prevent thrashing

**Test Frameworks & Tools:**
- **Vitest** - Unit and integration tests
- **Node.js Test Harness** - Standalone portability validation
- **Anthropic SDK Mock** - Mock AI API responses for deterministic tests
- **vm2** - JavaScript sandbox (also used for script execution tests)

**Edge Cases to Test:**

1. **Empty workflow:** workflow.yaml with zero steps → Parser validation error
2. **Circular variable references:** `{{varA}}` references `{{varB}}`, `{{varB}}` references `{{varA}}` → Detect infinite loop
3. **Missing file:** Workflow step references `project://nonexistent.txt` → Error with clear message "File not found"
4. **Malformed YAML:** workflow.yaml with invalid syntax → Parser error with line number
5. **Capability mismatch:** Workflow declares `filesystem:read` but script calls `storage.writeFile()` → Permission denied
6. **Timeout edge case:** Script completes in exactly 60.000s → No timeout error (within limit)
7. **Large file:** Workflow loads 500MB file into AI context → Memory limit enforced (or error if exceeds)
8. **Nested conditionals:** `if → if → if` (3 levels deep) → Correctly evaluates all conditions
9. **Python subprocess crash:** Python script calls `sys.exit(1)` → ScriptResult.exitCode = 1, error captured
10. **Storage backend swap:** Run same workflow with LocalStorageService, then S3StorageService (post-MVP) → Verify identical results

**Test Data Strategy:**
- **Sample workflows:** Create 10+ realistic workflow.yaml files (standup report, expense processor, deploy script, etc.)
- **Fixture files:** Pre-populate `~/.holokai/workflows/test-workflow/` with template files, scripts
- **Mock user approvals:** Seed `user_workflow_approvals` table with test data (approved capabilities)
- **Mock project context:** Set up test projects with known file structure for isolation tests

**Continuous Integration:**
- All unit/integration tests run on every PR
- Standalone test harness runs on every commit (validate portability)
- Security tests run on every commit (capability enforcement critical)
- Performance tests run nightly, alert on >10% regression
- Post-MVP cloud deployment tests run after S3StorageService implemented

**Definition of Done for Epic 10:**
- All unit tests pass (90%+ coverage)
- All integration tests pass (workflow execution, storage, AI, scripts)
- Standalone test harness passes (zero Electron dependencies validated)
- Security tests pass (capability enforcement, RBAC, sandboxing)
- Performance benchmarks met (startup <5s, script overhead <50ms)
- No P0/P1 bugs open
- Documentation complete (StorageService interface, workflow.yaml schema, capability format)
- Design validation: Prototype S3StorageService swap works without code changes (validate post-MVP cloud readiness)

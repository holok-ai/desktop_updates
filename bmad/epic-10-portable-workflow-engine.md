# Epic 10: Portable Workflow Engine

**Priority:** P0 (Critical - Architectural Foundation, MUST complete in MVP Month 4)
**Owner:** Peter
**Description:** Build cloud-portable workflow execution engine with zero desktop dependencies, storage service abstraction, embedded AI client, capability-based sandboxing, and bundled runtimes. This is the **architectural foundation** that enables workflows to run locally (MVP) and in the cloud (post-MVP) without code changes.

**Related Documents:**
- PRD §3.8: Portable Workflow Engine
- Architecture Addendum: `architecture-workflow-engine-marketplace-addendum-2025-11-26.md` §2
- Requirements: `workflow-engine-requirements.md` §3

**Critical Constraint:** The workflow engine MUST have ZERO Electron dependencies and ZERO local file path dependencies. This is non-negotiable for cloud portability.

---

## Epic Overview

This epic builds the core workflow execution infrastructure that will power both chat-to-workflow (PRD §3.2) and user-created workflows (Epic 9). The engine is designed to be **portable from day 1**, eliminating expensive refactoring when adding cloud execution in Month 6+.

**Why This is Critical:**
- **Avoid Technical Debt:** Building portable now prevents 6+ months of refactoring later
- **Enables Future Features:** Cloud execution, scheduled workflows, API triggers all depend on portable engine
- **Competitive Advantage:** Hybrid local/cloud execution is unique in the market

**Design Principles:**
1. **Portable from Day 1:** Never assume local filesystem or Electron APIs exist
2. **Storage Abstraction:** All file access via URLs (not paths)
3. **Stateless Execution:** Engine can run as stateless cloud function
4. **Security First:** Capability-based sandboxing, RBAC/SSO integration
5. **Cloud Ready:** Multiple trigger modes, zero refactoring needed

---

## Stories

### E10-S1: Storage Service Abstraction for Workflows

**Size:** M
**Priority:** P0 (Critical - Foundation)
**Description:** Implement storage service abstraction layer with file URL schemes (`workflow://`, `project://`, `personal://`), local filesystem backend (MVP), and cloud storage backends (post-MVP).

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Storage abstraction | PRD | §3.8.2 |
| URL schemes | Architecture Addendum | §2.3 |
| Interface design | Workflow Requirements | Appendix B |

**Tasks:**
- [ ] Define `StorageService` interface
  ```typescript
  interface StorageService {
    readFile(url: string): Promise<string>;
    writeFile(url: string, content: string): Promise<void>;
    deleteFile(url: string): Promise<void>;
    fileExists(url: string): Promise<boolean>;
    listFiles(directory: string): Promise<string[]>;
    getFileMetadata(url: string): Promise<FileMetadata>;
    getFileURL(path: string): Promise<string>;  // For AI prompts
    readFileBinary(url: string): Promise<Buffer>;
    writeFileBinary(url: string, content: Buffer): Promise<void>;
  }
  ```
- [ ] Implement URL scheme parser
  - [ ] Parse `workflow://`, `project://`, `personal://`, `marketplace://`
  - [ ] Extract protocol and path components
  - [ ] Validate URL format
- [ ] Implement `LocalStorageService` backend (MVP)
  - [ ] Map URL schemes to local filesystem paths:
    - `workflow://` → `~/.holokai/workflows/{id}/`
    - `project://` → `/project/.holokai/`
    - `personal://` → `~/.holokai/My Workflows/`
    - `marketplace://` → `~/.holokai/marketplace/`
  - [ ] Implement all `StorageService` methods using Node.js `fs` module
  - [ ] Add path validation (prevent directory traversal attacks)
- [ ] Implement `S3StorageService` backend (Post-MVP)
  - [ ] Map URL schemes to S3 keys
  - [ ] Implement using AWS SDK v3
  - [ ] Generate presigned URLs for `getFileURL()` (3600s expiry)
  - [ ] Handle multipart uploads for large files
- [ ] Implement `AzureBlobStorageService` backend (Post-MVP)
  - [ ] Map URL schemes to Azure Blob paths
  - [ ] Implement using Azure Storage SDK
  - [ ] Generate SAS tokens for `getFileURL()`
- [ ] Add project isolation enforcement
  - [ ] Check current execution context before allowing file access
  - [ ] Throw `CrossProjectAccessError` if attempting cross-project access
  - [ ] Example: workflow in "My Workflows" cannot read `project://Team Project/file.txt`
- [ ] Test storage service with all URL schemes
  - [ ] Test read/write/delete operations
  - [ ] Test project isolation (cross-project access blocked)
  - [ ] Test file URL generation for AI prompts

**Acceptance Criteria:**
- [ ] `StorageService` interface defined and documented
- [ ] URL scheme parser correctly extracts protocol and path
- [ ] `LocalStorageService` functional (all methods work with local filesystem)
- [ ] Project isolation enforced (workflows cannot access other projects' files)
- [ ] File URLs generated correctly for AI prompts
- [ ] `S3StorageService` and `AzureBlobStorageService` stubbed (implementation deferred to post-MVP)

---

### E10-S2: Portable Execution Engine Core

**Size:** L
**Priority:** P0 (Critical - Foundation)
**Description:** Build workflow execution engine core with zero Electron dependencies: workflow parser, step executor, state manager, error handler, embedded AI client, and bundled runtimes.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Zero desktop dependencies | PRD | §3.8.1 |
| Engine components | Architecture Addendum | §2.2 |
| AI client | Architecture Addendum | §2.4 |
| State management | Architecture Addendum | §2.7 |

**Tasks:**
- [ ] Create standalone workflow engine module (zero Electron deps)
  - [ ] Create `src/workflow-engine/` directory (separate from Electron code)
  - [ ] No imports from `electron`, `@electron/remote`, or Electron-specific libraries
  - [ ] All dependencies must be platform-agnostic (Node.js only)
- [ ] Implement `WorkflowParser`
  - [ ] Parse `workflow.yaml` (using `js-yaml` library)
  - [ ] Parse `instructions.md` (XML format, using `xml2js`)
  - [ ] Validate workflow structure (required fields, step definitions)
  - [ ] Extract step dependencies (sequential vs parallel execution)
- [ ] Implement `StepExecutor`
  - [ ] Execute workflow steps sequentially (Basic tier)
  - [ ] Execute workflow steps with conditionals (Intermediate tier)
  - [ ] Handle step types: Ask User, Generate Output, Run Script, Conditional
  - [ ] Collect step inputs and outputs
  - [ ] Pass outputs from previous steps to next steps
- [ ] Implement `StateManager` (in-memory, MVP)
  - [ ] Save execution state checkpoints
  - [ ] Load checkpoints for resumability (post-MVP)
  - [ ] Support undo for reversible steps
  - [ ] Clear checkpoints after execution completes
  - [ ] No external database dependency (memory-only)
- [ ] Implement `ErrorHandler`
  - [ ] Graceful failures (workflow continues if step fails and is non-critical)
  - [ ] Retry logic (max 3 attempts, exponential backoff)
  - [ ] Error reporting (detailed error messages to user)
  - [ ] Rollback for failed transactions (if step marked as reversible)
- [ ] Implement embedded `AIClient` (Anthropic API)
  - [ ] `generate(prompt, context)` - Single completion
  - [ ] `generateStream(prompt, context)` - Streaming completion
  - [ ] `extract(prompt, schema)` - Structured extraction
  - [ ] `chat(messages)` - Multi-turn conversation
  - [ ] Context assembly: Load files via `storageService.readFile(url)`
- [ ] Implement bundled runtimes
  - [ ] Node.js runtime (already available - native)
  - [ ] Python runtime (bundle python3 executable with Desktop installer)
  - [ ] Bash runtime (bundle bash executable with Desktop installer)
  - [ ] Go runtime (bundle Go 1.21+ executable with Desktop installer)
  - [ ] Language detection from file extension (.js, .py, .sh, .go)
- [ ] Test standalone engine (outside Electron)
  - [ ] Create test harness in `src/workflow-engine/__tests__/`
  - [ ] Run workflow parsing, execution, state management tests in Node.js (not Electron)
  - [ ] Verify zero Electron dependencies (no imports fail)

**Acceptance Criteria:**
- [ ] Workflow engine module has zero Electron dependencies (can run in plain Node.js)
- [ ] `WorkflowParser` correctly parses workflow.yaml and instructions.md
- [ ] `StepExecutor` executes workflow steps sequentially and with conditionals
- [ ] `StateManager` saves checkpoints in memory (no external DB)
- [ ] `ErrorHandler` gracefully handles failures with retry logic
- [ ] `AIClient` functional (can call Anthropic API and assemble file context)
- [ ] Bundled runtimes included (Node.js, Python, Bash, Go)
- [ ] Engine can run standalone (Node.js test harness, no Electron)

---

### E10-S3: Capability-Based Sandboxing

**Size:** L
**Priority:** P0 (Critical - Security)
**Description:** Implement capability-based script sandboxing with permission tokens, RBAC/SSO context inheritance, resource limits (memory, CPU, timeout), and user approval flow.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Capability model | PRD | §3.8.5 |
| Sandboxing | Architecture Addendum | §2.6 |
| Permission disclosure | PRD | §3.7.2 (Workflow Marketplace) |
| RBAC integration | Workflow Requirements | §3.4 |

**Tasks:**
- [ ] Define capability format
  - [ ] Format: `{resource}:{action}[:{scope}]`
  - [ ] Examples: `filesystem:read`, `filesystem:write:project`, `network:https:github.com`, `git:read`, `bash:execute`
  - [ ] Store in `user_workflow_approvals` table (Moku API)
- [ ] Implement `CapabilityEnforcer`
  - [ ] `checkPermission(capability, userContext)` - Verify user approved capability
  - [ ] `enforceResourceLimits(execution)` - Check memory, CPU, timeout
  - [ ] Throw `PermissionDeniedError` if capability not approved
  - [ ] Throw `ResourceLimitExceededError` if limits exceeded
- [ ] Implement permission approval flow (MVP)
  - [ ] Desktop shows permission disclosure dialog before workflow installation:
    ```
    This workflow requests:
    ✓ Filesystem: Read/Write in workspace
    ✓ Network: HTTPS requests to github.com
    ✓ Git: Read repository history
    ✓ Bash: Execute shell commands

    Risk Score: Medium Risk

    [Cancel] [Approve & Install]
    ```
  - [ ] User approves → store in `user_workflow_approvals` table
  - [ ] User rejects → cancel installation
- [ ] Integrate RBAC/SSO context
  - [ ] Scripts inherit user's JWT token for API calls
  - [ ] Check user's role in project before allowing `filesystem:write`
  - [ ] Example: User with 'view' role cannot write files, even if capability approved
  - [ ] RBAC check: `getUserRoleInProject(userContext) >= 'edit'` for write operations
- [ ] Implement resource limits
  - [ ] Memory limit: 512MB default (configurable per workflow)
  - [ ] CPU limit: 1 core (soft limit, log warning if exceeded)
  - [ ] Timeout: 60 seconds default (configurable per step)
  - [ ] Enforce in `ScriptRunner` (VM timeout, process monitoring)
- [ ] Implement storage proxy for scripts
  - [ ] Scripts call `storage.readFile(path)` (not raw `fs.readFile()`)
  - [ ] Proxy checks `filesystem:read` capability before allowing access
  - [ ] Proxy resolves relative paths against workflow working directory
  - [ ] Example: Script in `project://` context cannot read `personal://` files
- [ ] Test capability enforcement
  - [ ] Test permission check (approved capability → allowed, unapproved → denied)
  - [ ] Test resource limits (memory, timeout enforcement)
  - [ ] Test RBAC integration (view role → no write access)
  - [ ] Test storage proxy (cross-project access blocked)

**Acceptance Criteria:**
- [ ] Capability format defined and documented
- [ ] `CapabilityEnforcer` checks permissions before allowing script actions
- [ ] Permission approval dialog shows before workflow installation
- [ ] RBAC/SSO context integrated (scripts inherit user permissions)
- [ ] Resource limits enforced (memory, CPU, timeout)
- [ ] Storage proxy prevents unauthorized file access
- [ ] All capability enforcement tests pass

---

### E10-S4: Script Execution Infrastructure

**Size:** M
**Priority:** P0 (Critical - Functionality)
**Description:** Implement `ScriptRunner` for executing JavaScript, Python, and Bash scripts in isolated contexts with capability injection, timeout enforcement, and result handling.

**Requirement References:**
| Task | Document | Section |
|------|----------|---------|
| Script execution | PRD | §3.8.4 |
| Runtime implementation | Architecture Addendum | §2.5 |
| Capability injection | Architecture Addendum | §2.6 |

**Tasks:**
- [ ] Define `ScriptRunner` interface
  ```typescript
  interface ScriptRunner {
    execute(script: Script, context: ExecutionContext): Promise<ScriptResult>;
  }

  interface Script {
    language: 'javascript' | 'python' | 'bash';
    code: string;
    capabilities: string[];
  }

  interface ExecutionContext {
    variables: Record<string, unknown>;
    workingDirectory: string;  // URL scheme (project://, personal://)
    userContext: { userId: string; jwt: string };
    resourceLimits: { memoryMB: number; timeoutSeconds: number; cpuCores: number };
  }

  interface ScriptResult {
    success: boolean;
    output?: string;
    error?: string;
    exitCode: number;
    durationMs: number;
  }
  ```
- [ ] Implement `NodeScriptRunner` (JavaScript)
  - [ ] Use `vm2` library for isolated VM execution
  - [ ] Create sandbox with injected: `storage`, `ai`, `variables`, `userContext`
  - [ ] Disable `eval()` for security (VM option: `eval: false`)
  - [ ] Enforce timeout via VM `timeout` option
  - [ ] Catch errors and return in `ScriptResult`
- [ ] Implement `PythonScriptRunner`
  - [ ] Execute via child process: `spawn('python3', ['-c', script.code])`
  - [ ] Inject variables via environment variables
  - [ ] Inject storage proxy via stdin JSON protocol
  - [ ] Enforce timeout via `child_process` timeout option
  - [ ] Capture stdout/stderr and return in `ScriptResult`
- [ ] Implement `BashScriptRunner`
  - [ ] Execute via child process: `spawn('bash', ['-c', script.code])`
  - [ ] Inject variables via environment variables
  - [ ] Set working directory to workflow context
  - [ ] Enforce timeout via child process
  - [ ] Capture stdout/stderr
- [ ] Implement capability injection
  - [ ] Before script execution, check all requested capabilities via `CapabilityEnforcer`
  - [ ] Inject storage proxy with only approved methods (e.g., no `writeFile` if `filesystem:write` not approved)
  - [ ] Inject AI client if needed
  - [ ] Inject user context (userId, JWT) for API calls
- [ ] Test script execution
  - [ ] Test JavaScript execution with vm2 sandbox
  - [ ] Test Python execution via subprocess
  - [ ] Test Bash execution via subprocess
  - [ ] Test timeout enforcement (script killed after limit)
  - [ ] Test capability injection (storage, AI client available in sandbox)
  - [ ] Test error handling (script errors captured and returned)

**Acceptance Criteria:**
- [ ] `ScriptRunner` interface defined and documented
- [ ] `NodeScriptRunner` executes JavaScript in isolated VM (vm2)
- [ ] `PythonScriptRunner` executes Python via subprocess
- [ ] `BashScriptRunner` executes Bash via subprocess
- [ ] `GoScriptRunner` executes Go via subprocess (go run)
- [ ] Capability injection works (storage, AI, variables available in scripts)
- [ ] Timeout enforcement works (scripts killed after limit)
- [ ] Error handling works (errors captured and returned)
- [ ] All script execution tests pass (JavaScript, Python, Bash, Go)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Zero Electron Dependencies** | 100% portable | Workflow engine runs in Node.js (not Electron) |
| **Storage Abstraction** | All file access via URLs | Zero direct filesystem paths in engine code |
| **Execution Performance** | <5s startup, <60s execution | Workflow execution latency (P95) |
| **Security** | Zero capability violations | Capability enforcement tests pass |
| **Cloud Readiness** | Same code, zero changes | Workflow engine deploys to AWS Lambda without modification (post-MVP) |

---

## Dependencies

**Blocked By:**
- None (this is the foundation epic - no dependencies)

**Blocks:**
- Epic 7 (Project Workflows) - Needs workflow engine for execution
- Epic 9 (User Workflow Marketplace) - Needs portable engine for user workflows
- Chat-to-workflow (PRD §3.2) - Needs engine for workflow execution

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Portable design slows MVP development** | High | Medium | Accept velocity trade-off for long-term cloud portability; prototype early to validate feasibility |
| **Storage abstraction breaks existing code** | Low | High | Implement abstraction layer that wraps existing local filesystem; migrate incrementally |
| **Script sandboxing performance overhead** | Low | Medium | Benchmark early; optimize hot paths; consider lazy permission checking |
| **Bundled runtimes increase installer size** | Medium | Low | Python + Bash + Go add ~80MB (Python ~40MB, Bash ~10MB, Go ~30MB); acceptable for Desktop installer; Go enables broader workflow marketplace adoption for DevOps/infrastructure automation; defer cloud optimization |

---

## Cloud Execution Roadmap (Post-MVP - Month 6+)

**Post-MVP Enhancements:**
- [ ] Deploy portable engine to AWS Lambda (same code, zero changes)
- [ ] Implement S3StorageService backend (swap backend, same interface)
- [ ] Add cloud trigger modes (API, webhooks, scheduled)
- [ ] Implement hybrid execution (heavy workflows → cloud, light workflows → local)
- [ ] Add execution state sync (cloud executions visible in desktop)

**Design Validation:**
When we deploy to cloud in Month 6:
- ✅ **Zero refactoring** needed (engine code unchanged)
- ✅ **Same workflows** work in cloud (workflow.yaml files unchanged)
- ✅ **Swap backend** (LocalStorageService → S3StorageService)
- ✅ **Multiple triggers** (desktop, web UI, API, scheduled)

This proves the portable design was worth the MVP investment.

---

**End of Epic 10**

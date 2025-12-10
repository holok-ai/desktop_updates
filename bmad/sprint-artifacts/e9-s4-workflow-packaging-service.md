# Story 9.4: Workflow Packaging Service

Status: ready-for-dev

## Story

As a **workflow creator**,
I want **workflows to be packaged into standardized, validated .wfpkg bundles with integrity verification**,
so that **workflows can be securely distributed, installed, and verified in the marketplace**.

## Acceptance Criteria

1. **AC-4.1**: Workflow directory correctly packaged into .wfpkg bundle (ZIP format)
   - All required files included (manifest.json, workflow.yaml, instructions.md, templates)
   - Optional scripts included if present
   - ZIP compression using DEFLATE algorithm
   - Package structure matches expected format

2. **AC-4.2**: Manifest.json validated against JSON schema (required fields, version format)
   - JSON schema validation using ajv library
   - Required fields enforced: name, version, tier, author, license, description, category, permissions
   - Version format validated (semantic versioning X.Y.Z)
   - Author object validated (name, email required; url optional)
   - License validated (SPDX identifier)
   - Permissions/capabilities array validated

3. **AC-4.3**: .wfpkg file correctly compressed (can be extracted with standard zip tools)
   - Package created using jszip library
   - Standard ZIP format (compatible with 7-Zip, WinZip, macOS Archive Utility)
   - Proper directory structure maintained
   - File permissions preserved where possible

4. **AC-4.4**: SHA-256 hash generated for package integrity
   - Hash computed from complete .wfpkg buffer
   - Hash format: 64-character hexadecimal string
   - Hash included in submission metadata
   - Hash used for integrity verification on installation

5. **AC-4.5**: Package extraction works (round-trip: directory → package → extract)
   - Extract method handles .wfpkg buffers
   - All files extracted to correct paths
   - Directory structure recreated accurately
   - Manifest validation after extraction succeeds

## Tasks / Subtasks

- [ ] **Task 1: Implement WorkflowPackagingService class** (AC: 4.1, 4.2, 4.3, 4.4, 4.5)
  - [ ] 1.1: Create `WorkflowPackagingService.ts` in `electron/services/`
  - [ ] 1.2: Implement `createPackage(workflowDir: string)` method
    - Read manifest.json from workflow directory
    - Validate manifest using validateManifest() method
    - Create JSZip instance
    - Add manifest.json to root of ZIP
    - Add workflow.yaml to root of ZIP
    - Add instructions.md to root of ZIP
    - Add all template files to templates/ directory in ZIP
    - Add all script files (if present) to scripts/ directory in ZIP
    - Generate buffer with compression: DEFLATE
    - Compute SHA-256 hash of buffer
    - Return { buffer: Buffer, hash: string }
  - [ ] 1.3: Implement `validateManifest(workflowDir: string)` method
    - Load manifest.json from workflow directory
    - Parse JSON
    - Validate against JSON schema using ajv
    - Check required fields: name, version, tier, author, license, description, category, permissions, files
    - Validate version format using semver library (X.Y.Z)
    - Validate tier enum: Basic | Intermediate | Advanced
    - Validate author object: name (required), email (required), url (optional)
    - Validate license: SPDX identifier string
    - Validate permissions: array of capability strings
    - Throw descriptive error if validation fails
    - Return validated WorkflowManifest object
  - [ ] 1.4: Implement `extractPackage(packageBuffer: Buffer, outputDir: string)` method
    - Load ZIP from buffer using JSZip.loadAsync()
    - Iterate over all files in ZIP
    - For each file: extract to outputDir preserving directory structure
    - Create directories recursively as needed
    - Write file contents to disk
    - Handle errors gracefully (corrupted ZIP, disk full, etc.)
  - [ ] 1.5: Add error handling and logging
    - Log package creation start/completion
    - Log validation errors with specific field details
    - Log extraction progress
    - Throw typed errors: ManifestValidationError, PackageCreationError, ExtractionError

- [ ] **Task 2: Define WorkflowManifest TypeScript interface** (AC: 4.2)
  - [ ] 2.1: Create `types/workflow.ts` with WorkflowManifest interface
    - name: string
    - version: string (semantic versioning)
    - tier: 'Basic' | 'Intermediate' | 'Advanced'
    - author: { name: string, email: string, url?: string }
    - license: string (SPDX identifier)
    - description: string
    - category: WorkflowCategory enum
    - tags: string[]
    - permissions: string[] (capability strings)
    - files: { manifest: 'manifest.json', workflow: 'workflow.yaml', instructions: 'instructions.md', templates: string[], scripts?: string[] }
  - [ ] 2.2: Create WorkflowCategory enum
    - Documentation | Code Generation | Testing | Deployment | Data Analysis | Email Automation | Issue Tracking | Release Management | Other
  - [ ] 2.3: Export SecurityScanResult interface (for future use in E9-S5)
    - riskScore: 'Low' | 'Medium' | 'High'
    - findings: SecurityFinding[]
    - lastScannedAt: Date
    - scannerVersion: string

- [ ] **Task 3: Create JSON schema for manifest validation** (AC: 4.2)
  - [ ] 3.1: Create `schemas/workflow-manifest.schema.json`
  - [ ] 3.2: Define JSON schema with:
    - Required properties: name, version, tier, author, license, description, category, permissions, files
    - String format validation for version (regex: ^\d+\.\d+\.\d+$)
    - Enum validation for tier: ["Basic", "Intermediate", "Advanced"]
    - Object validation for author with required name, email
    - Array validation for permissions, tags, templates
    - Additional properties: false (strict validation)
  - [ ] 3.3: Load schema in WorkflowPackagingService constructor
  - [ ] 3.4: Initialize ajv with schema for validation

- [ ] **Task 4: Add IPC handlers for packaging operations** (AC: 4.1, 4.5)
  - [ ] 4.1: Register `workflow:package` IPC handler in `ipc-handlers/workflow.ts`
    - Handler receives workflowDir path
    - Calls WorkflowPackagingService.createPackage()
    - Returns { success: boolean, hash?: string, error?: string }
  - [ ] 4.2: Register `workflow:extract` IPC handler
    - Handler receives packagePath and outputDir
    - Reads .wfpkg file as buffer
    - Calls WorkflowPackagingService.extractPackage()
    - Returns { success: boolean, error?: string }
  - [ ] 4.3: Register `workflow:validate-manifest` IPC handler
    - Handler receives workflowDir path
    - Calls WorkflowPackagingService.validateManifest()
    - Returns { valid: boolean, manifest?: WorkflowManifest, errors?: ValidationError[] }
  - [ ] 4.4: Add TypeScript types to preload.ts for context bridge
    - Expose workflow.package, workflow.extract, workflow.validateManifest methods

- [ ] **Task 5: Write unit tests for WorkflowPackagingService** (AC: 4.1, 4.2, 4.3, 4.4, 4.5)
  - [ ] 5.1: Create `tests/unit/services/WorkflowPackagingService.test.ts`
  - [ ] 5.2: Test createPackage() success case
    - Setup fixture workflow directory with all required files
    - Call createPackage()
    - Assert buffer is returned
    - Assert hash is 64-character hex string
    - Extract buffer and verify contents
  - [ ] 5.3: Test createPackage() with scripts
    - Setup fixture with optional scripts
    - Verify scripts included in package
  - [ ] 5.4: Test validateManifest() success case
    - Valid manifest.json fixture
    - Assert validation passes
    - Assert WorkflowManifest object returned
  - [ ] 5.5: Test validateManifest() failure cases
    - Missing required field → throw ManifestValidationError
    - Invalid version format → throw error
    - Invalid tier value → throw error
    - Invalid author object → throw error
    - Invalid license → throw error
  - [ ] 5.6: Test extractPackage() success case
    - Create .wfpkg buffer
    - Extract to temp directory
    - Verify all files present
    - Verify file contents match original
  - [ ] 5.7: Test extractPackage() with corrupted ZIP
    - Pass invalid buffer
    - Assert error thrown gracefully
  - [ ] 5.8: Test SHA-256 hash consistency
    - Package same workflow twice
    - Assert hashes are identical

- [ ] **Task 6: Write integration tests for packaging workflow** (AC: 4.5)
  - [ ] 6.1: Create `tests/integration/workflow-packaging.test.ts`
  - [ ] 6.2: Test full round-trip: directory → package → extract → validate
    - Create test workflow directory
    - Package into .wfpkg
    - Extract to new directory
    - Validate manifest in extracted directory
    - Compare original and extracted files (content equality)
  - [ ] 6.3: Test package creation via IPC
    - Invoke workflow:package IPC handler
    - Verify .wfpkg file created
    - Verify hash returned
  - [ ] 6.4: Test manifest validation via IPC
    - Invoke workflow:validate-manifest IPC handler
    - Test valid and invalid manifests
    - Verify error messages

- [ ] **Task 7: Add dependencies to package.json** (AC: 4.1, 4.2, 4.3, 4.4)
  - [ ] 7.1: Add `jszip@3.x` (MIT/GPL3 license) for ZIP creation/extraction
  - [ ] 7.2: Add `ajv@8.x` (MIT license) for JSON schema validation
  - [ ] 7.3: Add `semver@7.x` (ISC license) for version validation
  - [ ] 7.4: Add types: `@types/jszip`, `@types/semver`
  - [ ] 7.5: Run `npm install` to update lock file

- [ ] **Task 8: Create test fixtures for workflow packages** (AC: 4.1, 4.2, 4.5)
  - [ ] 8.1: Create `tests/fixtures/workflows/valid-workflow/` directory
    - manifest.json (valid)
    - workflow.yaml (valid)
    - instructions.md
    - templates/output.md
  - [ ] 8.2: Create `tests/fixtures/workflows/workflow-with-scripts/` directory
    - Include scripts/process.js in fixture
  - [ ] 8.3: Create `tests/fixtures/workflows/invalid-manifest/` directory
    - manifest.json with missing required field
  - [ ] 8.4: Create `tests/fixtures/workflows/invalid-version/` directory
    - manifest.json with invalid version format (e.g., "1.0")

## Dev Notes

### Package Format Specification

**.wfpkg Structure:**
```
workflow-name.wfpkg (ZIP archive)
├── manifest.json          # Workflow metadata and schema
├── workflow.yaml          # Workflow definition (steps, config)
├── instructions.md        # User-facing instructions
├── templates/             # Output templates directory
│   ├── template.md        # Handlebars template
│   └── output.html        # Additional templates (optional)
└── scripts/               # Optional scripts directory
    └── process.js         # Optional custom scripts
```

**Manifest.json Schema (Required Fields):**
- `name` (string): Workflow name (e.g., "Email Summarizer")
- `version` (string): Semantic version (e.g., "1.0.0")
- `tier` (enum): "Basic" | "Intermediate" | "Advanced"
- `author` (object): { name, email, url? }
- `license` (string): SPDX identifier (e.g., "MIT", "Apache-2.0")
- `description` (string): Short description (1-2 sentences)
- `category` (string): WorkflowCategory enum value
- `tags` (array): Searchable tags
- `permissions` (array): Capability strings (e.g., ["filesystem:read", "network:https:github.com"])
- `files` (object): File paths within package

### Dependency Resolution

- **jszip**: Industry-standard library for ZIP creation/extraction in Node.js
  - Used by 10M+ projects
  - Supports compression, streaming, and standard ZIP format
  - MIT/GPL3 dual license (MIT preferred)

- **ajv**: Most popular JSON schema validator for JavaScript
  - Used by 100M+ projects
  - Fast, standards-compliant (JSON Schema draft-07)
  - Provides detailed validation error messages
  - MIT license

- **semver**: Standard library for semantic versioning
  - Used by npm, yarn, and 50M+ projects
  - Validates, compares, and parses semantic versions
  - ISC license

### Integration with Epic 10 Portable Workflow Engine

- .wfpkg bundles created in E9-S4 will be executed by Epic 10's WorkflowEngine
- Epic 10 will extract .wfpkg and execute workflow.yaml using portable engine
- Capabilities declared in manifest.json will be enforced by Epic 10's CapabilityEnforcer
- Storage abstraction (Epic 10) ensures workflows use URL schemes, not direct file paths

### Security Considerations

- **Manifest Validation**: Strict JSON schema prevents malformed packages
- **Capability Declaration**: All required permissions must be declared upfront
- **Hash Integrity**: SHA-256 hash ensures package hasn't been tampered with during download
- **ZIP Bomb Protection**: Consider adding max decompressed size limit (defer to E9-S5 security scanner)
- **Path Traversal Prevention**: Validate extracted file paths don't escape outputDir (../../../etc/passwd)

### Architecture Alignment

- **Component**: WorkflowPackagingService (Electron Main Process)
- **Location**: `electron/services/WorkflowPackagingService.ts`
- **IPC Channels**: `workflow:package`, `workflow:extract`, `workflow:validate-manifest`
- **Dependencies**: jszip (ZIP), ajv (validation), semver (versioning), crypto (hashing - Node.js built-in)
- **References**:
  - Tech Spec §4.1 (Services and Modules)
  - Tech Spec §4.3 (APIs and Interfaces)
  - Architecture §1 (Multi-process Electron architecture)
  - Architecture §2 (IPC Communication patterns)

### Testing Standards

- **Unit Tests**: Vitest with mocked file system
- **Integration Tests**: Vitest with real file system and temp directories
- **Coverage Target**: 90%+ for WorkflowPackagingService
- **Test Fixtures**: Located in `tests/fixtures/workflows/`
- **CI/CD**: All tests run on every PR

### Project Structure Notes

- Follows Electron main process service pattern (Architecture §1)
- IPC handlers follow `{domain}:{action}` naming convention (Architecture §2)
- TypeScript interfaces defined separately in `types/` directory
- JSON schemas stored in `schemas/` directory for reusability
- Error classes extend Error with typed fields for better error handling

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-9.md - §4.1 Services and Modules]
- [Source: docs/sprint-artifacts/tech-spec-epic-9.md - §4.2 Data Models and Contracts]
- [Source: docs/sprint-artifacts/tech-spec-epic-9.md - §4.3 APIs and Interfaces - WorkflowPackagingService]
- [Source: docs/sprint-artifacts/tech-spec-epic-9.md - §6 Dependencies and Integrations]
- [Source: docs/architecture.md - §1 Multi-Process Electron Architecture]
- [Source: docs/architecture.md - §2 IPC Communication]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e9-s4-workflow-packaging-service.context.xml

- docs/sprint-artifacts/e9-s4-workflow-packaging-service.context.xml



### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

# Brainstorming Session Results

**Session Date:** 2025-11-25
**Facilitator:** BMad Brainstorming Facilitator
**Participant:** Peter

## Session Start

**Approach Selected:** Progressive Technique Flow

**Techniques Planned:**
1. Mind Mapping (divergent) - Map all data types and their relationships
2. First Principles Thinking (deep) - Challenge storage assumptions, derive from fundamentals
3. SCAMPER Method (structured) - Refine and optimize the emerging design

**Rationale:** Start broad to capture all storage needs, go deep to establish core principles, then systematically refine into actionable architecture.

## Executive Summary

**Topic:** File Storage Architecture for Holokai Desktop

**Session Goals:** Design a system-wide file storage concept that supports project file sharing, integrates with the existing thread/audit architecture, and provides a foundation for the orchestration layer.

**Context from Previous Session:**
- Tool Orchestrator needs to store tool definitions → handled by desktop repository patterns
- Workflows need persistent storage → relational DB for templates
- Audit logs need to be stored and queryable → Holo provides this
- MCP server configs need to persist → handled by desktop repository patterns
- **Project file sharing** → Core focus of this session

**Techniques Used:** Mind Mapping, First Principles Thinking, SCAMPER

**Total Ideas Generated:** 15

### Key Themes Identified:

1. **Storage Service as New Backend** - Dedicated service for file storage, managed by Moku, accessible to Desktop
2. **REST + Presigned URLs** - Universal access pattern supporting S3, Azure, MinIO, and local filesystem
3. **Attachment Metadata in Audit** - File references travel with thread metadata through Holo → Moku
4. **Local Cache with Security** - Desktop caches files with gzip compression + AES-256 encryption

## Technique Sessions

### Mind Mapping (Divergent)

**Initial exploration identified 5 storage categories:**

| Category | Examples | Outcome |
|----------|----------|---------|
| 1. Chat Data | Threads, messages, attachments | **In scope** - project file sharing |
| 2. Tool Data | Native tool defs, MCP configs | Out of scope - desktop repository patterns |
| 3. Workflow Data | Definitions, templates, plans | **In scope** - relational DB for templates |
| 4. Config Data | Settings, API keys, preferences | Out of scope - existing patterns |
| 5. Audit Data | Execution logs, history | Out of scope - Holo provides |

**Refined scope:** Categories 1 (project file attachments) and 3 (workflow templates in DB)

### First Principles Thinking (Deep)

**Key Questions Explored:**

**Q1: Where must shared project files physically live?**
- NOT local filesystem (inaccessible to other project members)
- Must be: Holokai Storage Service (new)
- NOT Holo (chat proxy, not storage)
- Managed by Moku, accessible to Desktop via user security context

**Q2: How do threads currently work?**
- Thread ID created on Desktop
- Prompts sent to Holo (proxy) with metadata
- Holo records to audit (PostgreSQL JSONB)
- Desktop queries Moku API for thread history
- Moku returns full metadata including any attachments

**Q3: How should file attachments integrate?**
- Upload file to Storage Service → get fileId
- Include `attachments` array in request metadata to Holo
- Holo records metadata in audit (JSONB handles this naturally)
- Other project members query Moku → get attachment references
- Download via Storage Service presigned URL

### SCAMPER Refinement

| SCAMPER | Question | Decision |
|---------|----------|----------|
| **Substitute** | REST vs CIFS? | REST + presigned URLs (MinIO doesn't support CIFS) |
| **Combine** | Upload + metadata? | Yes - multipart upload returns metadata |
| **Adapt** | From S3 patterns? | Presigned URLs for direct blob access |
| **Modify** | Limits configurable? | Yes - org-level via Moku |
| **Put to other uses** | Workflow storage? | No - use relational DB |
| **Eliminate** | Move/rename ops? | Yes - not needed |
| **Rearrange** | CIFS vs REST? | REST chosen for universal compatibility |

## Architecture

### Platform Services Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     HOLOKAI PLATFORM SERVICES                        │
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │     HOLO     │    │     MOKU     │    │   STORAGE SERVICE    │   │
│  │  (Chat Proxy)│    │  (Management)│    │   (File Storage)     │   │
│  ├──────────────┤    ├──────────────┤    ├──────────────────────┤   │
│  │ • Route to   │    │ • Providers  │    │ • Project files      │   │
│  │   providers  │    │ • Models     │    │ • Shared attachments │   │
│  │ • Streaming  │    │ • Prompts    │    │ • Access control     │   │
│  │ • Audit rec  │    │ • Users/Orgs │    │   (via user context) │   │
│  │              │    │ • Guardrails │    │ • Presigned URLs     │   │
│  │              │    │ • Threads API│    │                      │   │
│  └──────────────┘    └──────────────┘    └──────────────────────┘   │
│                                                                      │
│  Desktop accesses all via user security context                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Storage Service Design

**Blob Storage Adapters:**

| Provider | Use Case | Notes |
|----------|----------|-------|
| **AWS S3** | Production (AWS) | Native presigned URL support |
| **Azure Blob** | Production (Azure) | SAS token support |
| **MinIO** | Self-hosted | S3-compatible |
| **File System** | Local development | Simple, no dependencies |

**Access Control:**

| Operation | View Member | Full Member | Requires Right |
|-----------|-------------|-------------|----------------|
| List | ✓ | ✓ | |
| Download | ✓ | ✓ | |
| Upload | | ✓ | |
| Delete | | | `project.file.delete` |
| Stats | ✓ | ✓ | |

**System Limits (Org-configurable via Moku):**
- File size: 1MB - 25MB range
- Files per project: 100 - 10,000 range

### Storage Service API

**Base URL:** `https://storage.holokai.com/v1`

| # | Endpoint | Method | Purpose |
|---|----------|--------|---------|
| 1 | `/projects/{projectId}/threads/{threadId}/files/upload-url` | POST | Get presigned upload URL |
| 2 | `/files/{fileId}/upload-complete` | POST | Confirm upload complete |
| 3 | `/files/{fileId}/download-url` | GET | Get presigned download URL |
| 4 | `/projects/{projectId}/threads/{threadId}/files` | GET | List thread files |
| 5 | `/projects/{projectId}/files` | GET | List project files |
| 6 | `/files/{fileId}` | DELETE | Delete file |
| 7 | `/projects/{projectId}/storage` | GET | Storage stats |
| 8 | `/files/validate` | POST | Batch cache validation |

**Upload Flow:**
```
1. POST /projects/{p}/threads/{t}/files/upload-url
   Body: { filename, mimeType, sizeBytes }
   Response: { fileId, uploadUrl, expiresAt }

2. PUT {uploadUrl} with binary data (direct to blob)

3. POST /files/{fileId}/upload-complete
   Storage Service verifies and records metadata
```

**Download Flow:**
```
1. GET /files/{fileId}/download-url
   Response: { url, expiresAt, etag }

2. GET {url} (direct from blob)

3. Desktop caches locally (gzip + encrypt)
```

### Desktop Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DESKTOP FILE STORAGE                              │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              ProjectFileService (Main Process)                 │  │
│  │                                                                 │  │
│  │  • upload(projectId, threadId, file): FileAttachment          │  │
│  │  • download(fileId): Buffer                                    │  │
│  │  • list(projectId, threadId?): FileMetadata[]                 │  │
│  │  • delete(fileId): void                                        │  │
│  │  • getStats(projectId): StorageStats                          │  │
│  │  • clearCache(): void                                          │  │
│  └──────────────────────┬────────────────────────────────────────┘  │
│                         │                                            │
│           ┌─────────────┴─────────────┐                             │
│           │                           │                             │
│           ▼                           ▼                             │
│  ┌─────────────────┐        ┌─────────────────┐                    │
│  │ StorageApiClient│        │  FileCacheRepo  │                    │
│  │                 │        │                 │                    │
│  │ • Presigned URLs│        │ • gzip + AES    │                    │
│  │ • Auth headers  │        │ • manifest.json │                    │
│  │ • Error handling│        │ • eviction (3d) │                    │
│  └─────────────────┘        │ • size limit    │                    │
│                             └─────────────────┘                    │
│                                                                      │
│  Settings:                                                           │
│  • maxCacheSize: user-configurable (< available disk)               │
│  • cacheEvictionDays: 3 (default)                                   │
│  • "Clear All Cache" button                                          │
└─────────────────────────────────────────────────────────────────────┘
```

**Cache Structure:**
```
userData/holokai/desktop/file-cache/
├── <projectId>/
│   ├── <fileId>.enc          # gzip + AES-256-GCM encrypted
│   └── manifest.json         # metadata + cachedAt + etag
└── cache-settings.json       # maxSize, evictionDays
```

**Cache Security:**
- Compression: gzip before encryption
- Encryption: AES-256-GCM
- Key management: Electron safeStorage (OS keychain)

### Thread Integration

**Message Data Model Update:**
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
  versions?: Array<{ content: string; editedAt: number }>;
  attachments?: FileAttachment[];  // NEW
}

interface FileAttachment {
  fileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
}
```

**Integration Flow:**
```
User attaches file to project thread message:

1. Desktop → Storage Service: upload file → fileId
2. Desktop → Holo: prompt with attachments in metadata
3. Holo → audit DB: records metadata (JSONB)
4. Other member → Moku API: GET thread → includes attachments
5. Desktop renders attachment in message UI
6. Click → Storage Service presigned URL → download → cache
```

## Idea Categorization

### Immediate Opportunities (MVP)

| # | Idea |
|---|------|
| 1 | Storage Service with REST + presigned URLs |
| 2 | Blob adapters: S3, Azure, MinIO, Filesystem |
| 3 | Upload/download API endpoints |
| 4 | File metadata in PostgreSQL |
| 5 | Access control via user security context |
| 6 | Desktop ProjectFileService |
| 7 | Desktop StorageApiClient |
| 8 | Desktop FileCacheRepo (gzip + AES) |
| 9 | Attachment metadata in Holo audit |
| 10 | Desktop UI for attachments in messages |

### Future Innovations

| # | Idea |
|---|------|
| 11 | Batch download (multiple files) |
| 12 | CDN fronting for download performance |
| 13 | Chunked upload for large files |

### Insights and Learnings

1. **MinIO doesn't support CIFS** - REST + presigned URLs is the universal pattern
2. **Audit JSONB is flexible** - Attachment metadata fits naturally in existing flow
3. **No Moku API changes needed** - Already returns full metadata
4. **Cache security is essential** - Files may contain sensitive project data
5. **Presigned URLs decouple concerns** - Storage Service handles auth, blob handles transfer

## Action Planning

### Top 3 Priority Ideas

#### #1 Priority: Storage Service Core

- **Rationale:** Foundation - everything else depends on this
- **Next steps:**
  1. Define IBlobStorageProvider interface
  2. Implement FileSystemProvider (local dev)
  3. Implement S3Provider (production)
  4. Create PostgreSQL schema for file metadata
  5. Build REST API (8 endpoints)
  6. Add presigned URL generation
  7. Implement access control checks
- **Resources needed:**
  - AWS S3 / MinIO test environment
  - PostgreSQL instance

#### #2 Priority: Desktop Integration

- **Rationale:** Enables user-facing functionality
- **Next steps:**
  1. Create ProjectFileService (main process)
  2. Create StorageApiClient (HTTP client)
  3. Create FileCacheRepo (gzip + AES)
  4. Add IPC handlers for file operations
  5. Update Message type with attachments
  6. Build attachment UI component
  7. Wire upload flow (file → Storage → Holo metadata)
  8. Wire download flow (presigned URL → cache → display)
- **Resources needed:**
  - Storage Service running
  - UI design for attachment component

#### #3 Priority: Cache Management

- **Rationale:** Performance and user control
- **Next steps:**
  1. Implement cache eviction (time-based, default 3 days)
  2. Implement cache size limit (user-configurable)
  3. Add "Clear All Cache" to settings UI
  4. Add cache size display in settings
  5. Test encryption/decryption with safeStorage
- **Resources needed:**
  - Desktop settings UI updates

## Reflection and Follow-up

### What Worked Well

- **First Principles Thinking** clarified the Holo/Moku/Storage separation
- **SCAMPER** helped eliminate CIFS complexity (MinIO incompatibility)
- Understanding existing audit/metadata flow simplified integration design

### Areas for Further Exploration

1. **Workflow template storage** - Confirmed relational DB, needs schema design
2. **Large file handling** - Chunked upload for files near size limit
3. **Offline mode** - How should Desktop behave when Storage Service unavailable?

### Questions That Emerged

1. Should Desktop pre-fetch attachments when loading a project thread?
2. How to handle attachment deletion when file is referenced in multiple messages?
3. Should there be a "project files" view separate from thread attachments?

### Next Session Planning

- **Suggested topic:** Workflow Template Storage - design relational schema for workflow definitions
- **Preparation needed:** Review workflow data model from orchestrator session

---

## Key Decisions Summary

| Decision | Value |
|----------|-------|
| Storage access pattern | REST + Presigned URLs |
| Blob backends | S3, Azure Blob, MinIO, File System |
| Cache encryption | AES-256-GCM via safeStorage |
| Cache compression | gzip before encryption |
| Cache eviction | Time-based (default 3 days) |
| Cache size limit | User-configurable |
| File size limit | Org-configurable (1-25MB) |
| Files per project | Org-configurable (100-10,000) |
| Delete permission | Rights-based (`project.file.delete`) |
| Attachment tracking | Metadata in Holo audit (JSONB) |
| Moku API changes | None needed |

---

_Session facilitated using the BMAD CIS brainstorming framework_

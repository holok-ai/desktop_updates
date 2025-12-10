# Holokai Desktop Architecture - Detailed Code Reference

**Date:** 2025-11-25
**Version:** 2.1
**Status:** Code Reference
**Parent Document:** `architecture-2025-11-25.md`

## Document Purpose

This document contains detailed code implementations, interface definitions, class signatures, and IPC handler definitions extracted from the main architecture document to improve readability and maintainability.

**For conceptual architecture, diagrams, and design decisions, see:** `architecture-2025-11-25.md`

---

## Table of Contents

1. [IPC API Definitions](#1-ipc-api-definitions)
2. [Core Entity Interfaces](#2-core-entity-interfaces)
3. [Service Class Definitions](#3-service-class-definitions)
4. [Workflow Executors](#4-workflow-executors)
5. [Tool Schemas](#5-tool-schemas)
6. [Chat-to-Workflow IPC API](#6-chat-to-workflow-ipc-api)

---

## 1. IPC API Definitions

### 1.1 Context Bridge (Preload)

**Extracted from:** Architecture Section 2.3 (lines 158-267)

The IPC API exposes all main process functionality to the renderer process through a secure context bridge. This follows Electron best practices with context isolation enabled.

```typescript
// src-electron/preload.ts
contextBridge.exposeInMainWorld('api', {
  // Authentication
  auth: {
    login: () => invoke('auth:login'),
    logout: () => invoke('auth:logout'),
    getUser: () => invoke('auth:getUser'),
    onExpired: (cb) => on('auth:expired', cb)
  },

  // Threads
  threads: {
    list: (params) => invoke('threads:list', params),
    get: (id) => invoke('threads:get', id),
    create: (data) => invoke('threads:create', data),
    submit: (threadId, parentId, prompt, branchIndex) =>
      invoke('threads:submit', threadId, parentId, prompt, branchIndex),
    move: (id, target) => invoke('threads:move', id, target),
    delete: (id) => invoke('threads:delete', id),
    generateTitle: (id) => invoke('threads:generateTitle', id),
    onStream: (cb) => on('threads:stream', cb)
  },

  // Projects
  projects: {
    list: () => invoke('projects:list'),
    get: (id) => invoke('projects:get', id),
    create: (data) => invoke('projects:create', data),
    update: (id, data) => invoke('projects:update', id, data),
    delete: (id) => invoke('projects:delete', id),
    getMembers: (id) => invoke('projects:getMembers', id),
    addMember: (id, member) => invoke('projects:addMember', id, member),
    removeMember: (id, memberId) => invoke('projects:removeMember', id, memberId),
    checkUpdates: (id, since) => invoke('projects:checkUpdates', id, since)
  },

  // Workflows
  workflows: {
    list: (params) => invoke('workflows:list', params),
    get: (id) => invoke('workflows:get', id),
    create: (data) => invoke('workflows:create', data),
    update: (id, data) => invoke('workflows:update', id, data),
    delete: (id) => invoke('workflows:delete', id),
    execute: (id, inputs) => invoke('workflows:execute', id, inputs),
    fork: (id) => invoke('workflows:fork', id),
    onExecutionUpdate: (cb) => on('workflows:executionUpdate', cb)
  },

  // Files
  files: {
    upload: (projectId, threadId, file) =>
      invoke('files:upload', projectId, threadId, file),
    download: (fileId) => invoke('files:download', fileId),
    list: (projectId, threadId) => invoke('files:list', projectId, threadId),
    delete: (fileId) => invoke('files:delete', fileId),
    getStats: (projectId) => invoke('files:getStats', projectId),
    clearCache: () => invoke('files:clearCache')
  },

  // Insights
  insights: {
    getDashboard: () => invoke('insights:dashboard'),
    getActivity: (range) => invoke('insights:activity', range),
    getTopics: (filter) => invoke('insights:topics', filter),
    getProjectActivity: (range) => invoke('insights:projectActivity', range),
    getWorkflowActivity: (filter) => invoke('insights:workflowActivity', filter),
    runReport: (config) => invoke('insights:runReport', config),
    saveReport: (config) => invoke('insights:saveReport', config),
    listReports: () => invoke('insights:listReports'),
    exportReport: (result, format) => invoke('insights:exportReport', result, format)
  },

  // Preferences
  preferences: {
    get: () => invoke('preferences:get'),
    set: (prefs) => invoke('preferences:set', prefs),
    onThemeChanged: (cb) => on('preferences:themeChanged', cb)
  },

  // Notifications
  notifications: {
    getHistory: () => invoke('notifications:history'),
    markRead: (id) => invoke('notifications:markRead', id),
    markAllRead: () => invoke('notifications:markAllRead'),
    onNotification: (cb) => on('notifications:new', cb)
  },

  // System
  system: {
    getInfo: () => invoke('system:info'),
    getLogs: (level, limit) => invoke('system:logs', level, limit),
    checkForUpdates: () => invoke('system:checkUpdates'),
    installUpdate: () => invoke('system:installUpdate')
  },

  // Dialogs
  dialog: {
    openFile: (options) => invoke('dialog:openFile', options),
    saveFile: (options) => invoke('dialog:saveFile', options),
    confirm: (options) => invoke('dialog:confirm', options)
  },

  // Clipboard
  clipboard: {
    write: (text) => invoke('clipboard:write', text),
    writeWithFormats: (data) => invoke('clipboard:writeWithFormats', data)
  }
});
```

---

## 2. Core Entity Interfaces

**Extracted from:** Architecture Section 3.2 (lines 307-462)

This section defines all core data entities used throughout the application, including threads with branching support, projects, workflows, and file attachments.

### 2.1 Thread Interfaces

Thread entities support message branching (tree structure) for retry functionality.

```typescript
interface Thread {
  id: string;                    // UUID v4 (desktop-generated)
  title: string | null;          // auto-generated after 2nd exchange
  type: 'personal' | 'project';
  ownerId: string;               // userId or projectId
  projectId?: string;
  createdBy: string;
  status: 'active' | 'archived' | 'deleted';
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  metadata?: {
    model?: string;
    [key: string]: unknown;
  };
}

interface Message {
  id: string;
  threadId: string;
  parentMessageId: string | null;  // tree structure
  branchIndex: number;              // 0=original, 1-2=retries
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  attachments?: FileAttachment[];
  metadata?: {
    model?: string;
    provider?: string;
    tokens?: { prompt: number; completion: number; total: number };
  };
}
```

**Branch Attachment Behavior:**

When a user creates a retry branch from a message that has attachments:
- **Retry without editing attachments:** Shared reference - new message points to same `fileId` (saves storage)
- **Retry with removed attachment:** New message excludes that `fileId` from its `attachments` array
- **Retry with new attachment added:** New file uploaded, new `fileId` created
- **Retry with replaced attachment:** Old `fileId` excluded, new `fileId` added

**Key Design Decision:** Attachments use shared references (not copies). Files are immutable once uploaded.

### 2.2 Project Interfaces

Projects enable collaboration with role-based access control.

```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  organizationId?: string;
  status: 'active' | 'archived' | 'deleted';
  createdAt: number;
  updatedAt: number;
  metadata?: {
    color?: string;
    icon?: string;
    tags?: string[];
    settings?: {
      defaultModel?: string;
      maxStorageBytes?: number;
    };
  };
}

interface ProjectMember {
  id: string;
  projectId: string;
  userId?: string;
  organizationId?: string;
  role: 'view' | 'edit' | 'admin';
  createdBy: string;
  createdAt: number;
  expiresAt?: number;
}
```

### 2.3 Workflow Interfaces

Workflows support templates, versioning, and execution tracking.

```typescript
interface Workflow {
  id: string;
  name: string;
  description?: string;
  scope: 'personal' | 'project';
  ownerId: string;
  projectId?: string;
  isTemplate: boolean;
  version: number;
  parentId?: string;            // forked from
  status: 'draft' | 'active' | 'archived';
  definition: WorkflowDefinition;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
}
```

### 2.4 File Interfaces

Files are stored locally for personal threads and in Storage Service for project threads.

```typescript
interface FileAttachment {
  fileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
  storageType: 'local' | 'remote';  // personal vs project
}

interface ProjectFile {
  fileId: string;
  projectId: string;
  threadId?: string;
  messageId?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  type: 'input' | 'output';
  uploadedBy: string;
  uploadedAt: string;
}
```

---

## 3. Service Class Definitions

**Extracted from:** Architecture Section 5.2 and 5.3 (lines 623-661, 665-748)

This section provides the service layer file structure and key service implementations for thread and file management.

### 3.1 Service Layer File Structure

The main process uses a layered service architecture organized by responsibility.

```typescript
// Service layer organization
src-electron/
├── services/
│   ├── core/
│   │   ├── auth.service.ts           // SSO, token management
│   │   ├── token-refresh.service.ts  // Auto refresh
│   │   ├── state-store.service.ts    // Preferences, window state
│   │   ├── notification.service.ts   // System + toast notifications
│   │   └── encryption.service.ts     // AES-256-GCM
│   │
│   ├── api/
│   │   ├── holo-api.client.ts        // LLM operations
│   │   ├── moku-api.client.ts        // Management API
│   │   └── storage-api.client.ts     // File operations
│   │
│   ├── domain/
│   │   ├── thread.service.ts         // Thread CRUD + branching
│   │   ├── project.service.ts        // Project management
│   │   ├── workflow.service.ts       // Workflow execution
│   │   ├── file.service.ts           // Upload/download
│   │   └── insights.service.ts       // Dashboard, reports
│   │
│   ├── cache/
│   │   ├── thread.cache.ts           // Dual cache (personal/project)
│   │   ├── project.cache.ts          // Project + member cache
│   │   ├── file.cache.ts             // Encrypted file cache
│   │   └── cache-manager.ts          // LRU, TTL, eviction
│   │
│   ├── repositories/
│   │   ├── thread.repository.ts      // Compressed, encrypted, LRU cache
│   │   ├── workflow.repository.ts    // Workflow local storage
│   │   └── base.repository.ts        // Common compression/encryption logic
│   │
│   └── infrastructure/
│       ├── deep-link.handler.ts      // holokai:// routing
│       ├── update.service.ts         // Auto-updater
│       └── tray.service.ts           // System tray
```

### 3.2 ThreadService Class

The ThreadService handles thread lifecycle, message branching, and context assembly.

```typescript
class ThreadService {
  // Create new thread with first prompt
  async createThread(request: {
    model: string;
    prompt: string;
    type: 'personal' | 'project';
    projectId?: string;
  }): Promise<Thread>;

  // Submit prompt (supports branching)
  async submitPrompt(
    threadId: string,
    parentMessageId: string,
    prompt: string,
    branchIndex?: number
  ): Promise<Message>;

  // Assemble context for branch
  assembleContext(threadId: string, messageId: string): Message[];

  // Create retry branch
  async createRetry(
    threadId: string,
    originalMessageId: string,
    newPrompt: string
  ): Promise<Message>;

  // Auto-title after 2nd exchange
  async generateTitle(threadId: string): Promise<string>;

  // Move between personal/project
  async moveThread(threadId: string, target: MoveTarget): Promise<Thread>;
}
```

### 3.3 FileService Class

The FileService manages file uploads/downloads with storage split between local and remote.

```typescript
class FileService {
  async upload(
    threadId: string,
    file: File
  ): Promise<FileAttachment> {
    const thread = await this.threadService.get(threadId);

    if (thread.type === 'personal') {
      // Local storage
      return this.localStorage.save(threadId, file);
    } else {
      // Storage Service (presigned URL)
      const { uploadUrl, fileId } = await this.storageAPI.getUploadUrl(
        thread.projectId,
        threadId,
        { filename: file.name, mimeType: file.type, sizeBytes: file.size }
      );
      await this.uploadToPresignedUrl(uploadUrl, file);
      await this.storageAPI.confirmUpload(fileId);
      return { fileId, storageType: 'remote', ... };
    }
  }

  async download(attachment: FileAttachment): Promise<Buffer> {
    if (attachment.storageType === 'local') {
      return this.localStorage.read(attachment.fileId);
    } else {
      // Check cache first
      const cached = await this.fileCache.get(attachment.fileId);
      if (cached) return cached;

      // Download via presigned URL
      const { url } = await this.storageAPI.getDownloadUrl(attachment.fileId);
      const data = await this.downloadFromUrl(url);

      // Cache locally (encrypted)
      await this.fileCache.set(attachment.fileId, data);
      return data;
    }
  }
}
```

---

## 4. Workflow Executors

**Extracted from:** Architecture Section 6.1 (lines 1023-1068)

This section defines the step executor classes responsible for executing different workflow step types.

### 4.1 Tool Executor

Executes native Electron tools via IPC registry.

```typescript
// Tool Executor - Native Electron tools via IPC
class ToolExecutor {
  async execute(toolId: string, inputs: Record<string, unknown>): Promise<unknown> {
    const tool = this.toolRegistry.get(toolId);
    if (!tool) throw new Error(`Unknown tool: ${toolId}`);
    return tool.execute(inputs);
  }
}
```

### 4.2 MCP Executor

Executes Model Context Protocol server commands.

```typescript
// MCP Executor - Model Context Protocol servers
class MCPExecutor {
  async execute(
    server: string,
    command: string,
    inputs: Record<string, unknown>
  ): Promise<unknown> {
    const mcpServer = await this.mcpManager.getServer(server);
    return mcpServer.call(command, inputs);
  }
}
```

### 4.3 Prompt Executor

Executes LLM prompts via Holo API with template variable resolution.

```typescript
// Prompt Executor - LLM calls via Holo API
class PromptExecutor {
  async execute(
    promptTemplate: string,
    inputs: Record<string, unknown>,
    threadId: string
  ): Promise<string> {
    // Resolve template variables
    let prompt = promptTemplate;
    for (const [key, value] of Object.entries(inputs)) {
      prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    // Call Holo API
    const response = await this.holoAPI.chat({
      threadId,
      prompt,
      stream: false
    });

    return response.content;
  }
}
```

---

## 5. Tool Schemas

**Extracted from:** Architecture Section 6.2 (lines 1152-1171)

This section defines the schema structure for tool definitions and functions.

### 5.1 Tool Definition Interface

Tools can be either native Electron tools or MCP server tools.

```typescript
interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  source: 'native' | 'mcp';
  functions: ToolFunction[];
}

interface ToolFunction {
  name: string;
  description: string;
  parameters: JSONSchema;
  returns: JSONSchema;
  isReversible: 'yes' | 'no' | 'unknown';
}
```

---

## 6. Chat-to-Workflow IPC API

**Extracted from:** Architecture Section 12.4 and 12.5 (lines 1588-1621)

This section defines the IPC API and service interfaces for the chat-to-workflow progression features.

### 6.1 Workflow Converter Service Interface

Extended ThreadService method for creating workflows from messages.

```typescript
// ThreadService - NEW METHOD
async createWorkflowFromMessage(messageId: string): Promise<{
  suggestedName: string;
  suggestedDescription: string;
  detectedInputs: Array<{ name: string; defaultValue: string; type: string }>;
  promptTemplate: string;
}>
```

### 6.2 Chat-to-Workflow IPC Methods

Complete IPC API for all three chat-to-workflow features.

```typescript
// Feature #1: "Make this a workflow" button
window.api.workflows.createFromMessage(messageId)
  → { suggestedName, suggestedDescription, detectedInputs, promptTemplate }

// Feature #2: Workflow Suggestions
window.api.workflows.getSuggestions(userId) → WorkflowSuggestion[]
window.api.workflows.dismissSuggestion(id) → void
window.api.workflows.neverSuggestPattern(id) → void
window.api.workflows.acceptSuggestion(id) → Workflow

// Feature #3: Template Marketplace
window.api.templates.search(query) → WorkflowTemplate[]
window.api.templates.getByCategory(category) → WorkflowTemplate[]
window.api.templates.get(templateId) → WorkflowTemplate
window.api.templates.activate(templateId, inputs) → Workflow
window.api.templates.getFeatured() → WorkflowTemplate[]

// Event Listeners (Main → Renderer)
window.api.on('workflows:suggestionAvailable', callback)
```

### 6.3 Moku API Endpoint Requirements

Required backend endpoints for chat-to-workflow features.

```typescript
// Pattern Detection (Feature #2)
GET  /workflows/suggestions?userId={id}&status=pending
PATCH /workflows/suggestions/:id (update status: dismissed/accepted/blacklisted)
POST /workflows/suggestions/:id/accept (create workflow from suggestion)

// Workflow from Message (Feature #1)
POST /workflows/from-message
Body: { messageId, userId }
Response: { workflow }

// Template Marketplace (Feature #3)
GET  /workflow-templates?category={category}&featured={bool}
GET  /workflow-templates/:id
POST /workflow-templates/:id/activate
Body: { userId, inputs }
Response: { workflow }
```

---

## End of Code Reference Document

This document contains all detailed code implementations extracted from the main architecture document. For conceptual architecture, design decisions, and diagrams, refer to `architecture-2025-11-25.md`.


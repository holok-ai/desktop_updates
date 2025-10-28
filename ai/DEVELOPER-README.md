# Desktop App Developer Guide

This guide helps you quickly understand how to build features in the Electron desktop app following our architectural patterns.

## Quick Start Checklist

When building a new feature, ask yourself:

1. **Does it need data from the main process?** → Add IPC handlers
2. **Does it involve multiple steps?** → Consider a Facade pattern
3. **Can users trigger it from a menu?** → Register with MenuNavigationService
4. **Does it handle sensitive data?** → Use secure storage and audit logging

## Architecture at a Glance

### Two-Process Model

**Main Process (Node.js):**

- Manages app lifecycle, windows, and native OS features
- Handles all data operations (Moku API calls, secure storage)
- Exposes functionality via IPC handlers
- Services: AuthService, ThreadService, ModelService, etc.

**Renderer Process (Svelte):**

- Runs the UI in a sandboxed browser environment
- Communicates with main process via Context Bridge (no direct Node access)
- Uses Svelte stores for state management
- Components are menu-agnostic and trigger-agnostic

## Building a New Feature

### Step 1: Define Your IPC API (Main Process)

**Location:** `src-electron/preload.ts`

Group related operations under a logical namespace:

```typescript
contextBridge.exposeInMainWorld('electron', {
  // Your feature namespace
  projects: {
    getAll: () => ipcRenderer.invoke('projects:get-all'),
    create: (data: CreateProjectData) => ipcRenderer.invoke('projects:create', data),
    archive: (id: string) => ipcRenderer.invoke('projects:archive', id),
  },
});
```

### Step 2: Create Service Class (Main Process)

**Location:** `src-electron/services/ProjectService.ts`

```typescript
export class ProjectService {
  constructor(
    private mokuClient: MokuAPIClient,
    private logger: typeof log,
  ) {}

  async getAllProjects(): Promise<Project[]> {
    try {
      this.logger.info('Fetching all projects');
      const response = await this.mokuClient.get('/projects');
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch projects', { error });
      throw error;
    }
  }

  async createProject(data: CreateProjectData): Promise<Project> {
    // Always call Moku API - no local database
    return this.mokuClient.post('/projects', data);
  }
}
```

**Key Points:**

- All data operations go through Moku API (no SQLite/local DB)
- Log with context but never log sensitive data
- Let errors bubble up to IPC handlers

### Step 3: Register IPC Handlers (Main Process)

**Location:** `src-electron/ipc/handlers.ts`

```typescript
export function registerIPCHandlers(projectService: ProjectService) {
  ipcMain.handle('projects:get-all', async () => {
    return projectService.getAllProjects();
  });

  ipcMain.handle('projects:create', async (_, data: CreateProjectData) => {
    return projectService.createProject(data);
  });
}
```

### Step 4: Create Service Wrapper (Renderer Process)

**Location:** `src/lib/services/project.service.ts`

Simple CRUD operations → Use service wrapper only:

```typescript
export class ProjectService {
  async getAllProjects(): Promise<Project[]> {
    return window.electronAPI.projects.getAll();
  }

  async createProject(data: CreateProjectData): Promise<Project> {
    return window.electronAPI.projects.create(data);
  }
}

// Export singleton instance
export const projectService = new ProjectService();
```

### Step 5: Create Facade (Only for Complex Workflows)

**Location:** `src/lib/services/project.facade.ts`

Multi-step operations → Use Facade pattern:

```typescript
import { projectService } from './project.service';
import { threadService } from './thread.service';
import { settingsService } from './settings.service';

export class ProjectFacade {
  async initializeNewProject(name: string): Promise<void> {
    // Step 1: Create project
    const project = await projectService.createProject({ name });

    // Step 2: Create default thread
    await threadService.create({
      projectId: project.id,
      name: 'Default Chat',
    });

    // Step 3: Update user preferences
    await settingsService.set('lastProjectId', project.id);
  }
}

// Export singleton instance
export const projectFacade = new ProjectFacade();
```

**When to use Facades:**

- Coordinating 3+ service calls in sequence
- Complex error recovery across services
- Logic that multiple components would duplicate

### Step 6: Build Your Component

**Location:** `src/lib/components/ProjectList.svelte`

Components should be **trigger-agnostic** (work via routes, menus, or links):

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { projectService } from '$lib/services/project.service';
  // OR for complex workflows:
  // import { projectFacade } from '$lib/services/project.facade';
  import type { Project } from '$lib/types';

  let projects: Project[] = [];
  let displayCreateDialog = false;

  // Check for menu-triggered actions via page data or navigation state
  // (implementation depends on your router setup)

  onMount(async () => {
    // Load data - same code regardless of how component was activated
    await loadProjects();
  });

  async function loadProjects() {
    projects = await projectService.getAllProjects();
  }

  async function createProject(name: string) {
    const newProject = await projectService.createProject({ name });
    projects = [...projects, newProject];
    displayCreateDialog = false;
  }
</script>

<div class="project-list">
  <h1>Projects</h1>

  {#each projects as project (project.id)}
    <div class="project-item">{project.name}</div>
  {/each}

  {#if displayCreateDialog}
    <!-- Create dialog component -->
  {/if}
</div>
```

**Component Rules:**

- ✅ Components never listen to menu events directly
- ✅ All data loading happens in `onMount`
- ✅ Use reactive statements for derived data
- ✅ Import service wrappers for CRUD, facades for workflows

### Step 7: Add Menu Integration (If Needed)

**Location:** `src/lib/services/menu-navigation.service.ts`

```typescript
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { get } from 'svelte/store';

export class MenuNavigationService {
  setupProjectMenuHandlers(): void {
    window.electronAPI.onMenuCommand('menu:view-projects', () => {
      const currentPath = get(page).url.pathname;
      if (currentPath === '/projects') {
        // Refresh if already there
        goto('/projects', { invalidateAll: true });
      } else {
        goto('/projects');
      }
    });

    window.electronAPI.onMenuCommand('menu:new-project', () => {
      // Navigate with state flag for dialog
      goto('/projects?openDialog=true');
    });
  }
}

export const menuNavigationService = new MenuNavigationService();
```

**Menu-to-Route Pattern:**

- Menu clicks → MenuNavigationService translates to navigation actions
- Components check URL parameters or page stores for action flags
- Same component code works for all triggers (menu, link, programmatic)

## Logging and Auditing

### Local Logging (electron-log)

**Use in both processes:**

```typescript
import log from 'electron-log';

// Main process
log.info('Project created', { projectId, userId });
log.error('API call failed', { endpoint, statusCode, error });

// Renderer process (via preload)
window.electron.log.info('User action', { action: 'create-project' });
```

**What to log:**

- ✅ App lifecycle events (startup, shutdown)
- ✅ API success/failures with context
- ✅ Navigation and state changes
- ❌ Never log tokens, passwords, or PII

### Auditing (Holo Audit Service)

**Use for user actions:**

```typescript
// In main process service
await this.auditService.log({
  event: 'project.created',
  userId: user.id,
  metadata: { projectId, name },
});
```

**What to audit:**

- User authentication events (login, logout, SSO)
- Chat and prompt-response activities
- Thread/project management actions
- Application start/stop

**Note:** Desktop SSO relies on the Holokai Moku web SSO for OAuth providers and authentication handshake.

## Security Guidelines

**Always follow these rules:**

1. **Sensitive Data:**
   - Store API keys using `safeStorage` in main process only
   - Never pass tokens through renderer process
   - Never log passwords, tokens, or PII

2. **IPC Input Validation:**
   - Validate all parameters in IPC handlers
   - Use TypeScript types for compile-time safety
   - Sanitize user input before API calls

3. **Svelte Security:**
   - Use `{@html}` directive only with sanitized content
   - Never render untrusted HTML directly
   - Svelte automatically escapes content by default

## Testing Your Feature

```typescript
// Service wrapper test (Vitest)
import { describe, it, expect, vi } from 'vitest';

describe('ProjectService', () => {
  it('should fetch projects', async () => {
    const mockProjects = [{ id: '1', name: 'Test' }];
    vi.spyOn(window.electronAPI.projects, 'getAll').mockResolvedValue(mockProjects);

    const result = await projectService.getAllProjects();
    expect(result).toEqual(mockProjects);
  });
});

// Facade test (mock service wrappers)
describe('ProjectFacade', () => {
  it('should initialize project workflow', async () => {
    const createProjectSpy = vi
      .spyOn(projectService, 'createProject')
      .mockResolvedValue({ id: '1', name: 'Test' });
    const createThreadSpy = vi.spyOn(threadService, 'create').mockResolvedValue({ id: 'thread1' });

    await projectFacade.initializeNewProject('Test');

    expect(createProjectSpy).toHaveBeenCalled();
    expect(createThreadSpy).toHaveBeenCalled();
  });
});
```

## Common Patterns Reference

| Pattern              | Use When                         | Example                                |
| -------------------- | -------------------------------- | -------------------------------------- |
| **Service Wrapper**  | Single IPC call, simple CRUD     | `ProjectIpcService.getAll()`           |
| **Facade**           | Multi-step workflow, 3+ services | `ProjectFacade.initializeNewProject()` |
| **Menu Integration** | Feature accessible via app menu  | MenuNavigationService handler          |
| **Router State**     | Menu needs to trigger action     | `state: { openDialog: true }`          |
| **Svelte Store**     | Complex UI state management      | Svelte stores for reactive data        |

## Key Architectural Principles

1. **Process Separation:** Main does I/O and security, renderer does UI
2. **Data Source:** All persistence via Moku API (no local database)
3. **Menu Handling:** Centralized in MenuNavigationService
4. **Component Design:** Trigger-agnostic, data loading in onMount
5. **Service Layers:** Wrappers for IPC calls, Facades for workflows
6. **Svelte Stores:** Reactive state management with stores
7. **Security First:** Context isolation, input validation, audit logging

## Svelte Stores State Management

Use Svelte stores for reactive state management across components:

```typescript
// src/lib/stores/threads.store.ts
import { writable, derived } from 'svelte/store';
import type { Thread } from '$lib/types';

function createThreadsStore() {
  const { subscribe, set, update } = writable<Thread[]>([]);

  return {
    subscribe,
    setThreads: (threads: Thread[]) => set(threads),
    addThread: (thread: Thread) => update((threads) => [...threads, thread]),
    removeThread: (id: string) => update((threads) => threads.filter((t) => t.id !== id)),
    updateThread: (id: string, updates: Partial<Thread>) =>
      update((threads) => threads.map((t) => (t.id === id ? { ...t, ...updates } : t))),
  };
}

export const threadsStore = createThreadsStore();
export const activeThreadId = writable<string | null>(null);
export const isLoading = writable<boolean>(false);

// Derived store for active thread
export const activeThread = derived(
  [threadsStore, activeThreadId],
  ([$threads, $activeThreadId]) => $threads.find((t) => t.id === $activeThreadId) || null,
);
```

**Use in component:**

```svelte
<script lang="ts">
  import { threadsStore, activeThread } from '$lib/stores/threads.store';

  // Access store values with $ prefix (auto-subscribe/unsubscribe)
  $: console.log('Current threads:', $threadsStore);
  $: console.log('Active thread:', $activeThread);

  async function loadThreads() {
    const threads = await threadService.getAll();
    threadsStore.setThreads(threads);
  }
</script>

<div>
  {#each $threadsStore as thread (thread.id)}
    <div>{thread.name}</div>
  {/each}
</div>
```

## Getting Help

- **Architecture details:** See `ARCHITECTURE.md` in this folder
- **IPC reference:** Check `src-electron/preload.ts` for available APIs
- **Component examples:** Review existing components in `src/lib/components/`
- **Service examples:** See `AuthService` and `ThreadService` in `src-electron/services/`
- **Svelte documentation:** https://svelte.dev/docs

---

**Remember:** Start simple with service wrappers, add facades only when needed, keep components menu-agnostic, and always think about security!

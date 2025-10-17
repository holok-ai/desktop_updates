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

**Renderer Process (Angular 18):**
- Runs the UI in a sandboxed browser environment
- Communicates with main process via Context Bridge (no direct Node access)
- Uses NgRx Signals for state management
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
    create: (data: CreateProjectData) => 
      ipcRenderer.invoke('projects:create', data),
    archive: (id: string) => 
      ipcRenderer.invoke('projects:archive', id)
  }
})
```

### Step 2: Create Service Class (Main Process)

**Location:** `src-electron/services/ProjectService.ts`

```typescript
export class ProjectService {
  constructor(
    private mokuClient: MokuAPIClient,
    private logger: typeof log
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

**Location:** `src/app/services/project-ipc.service.ts`

Simple CRUD operations → Use service wrapper only:

```typescript
@Injectable({ providedIn: 'root' })
export class ProjectIpcService {
  async getAllProjects(): Promise<Project[]> {
    return window.electron.projects.getAll();
  }

  async createProject(data: CreateProjectData): Promise<Project> {
    return window.electron.projects.create(data);
  }
}
```

### Step 5: Create Facade (Only for Complex Workflows)

**Location:** `src/app/services/project.facade.ts`

Multi-step operations → Use Facade pattern:

```typescript
@Injectable({ providedIn: 'root' })
export class ProjectFacade {
  constructor(
    private projectIpc: ProjectIpcService,
    private threadIpc: ThreadIpcService,
    private settingsIpc: SettingsIpcService
  ) {}

  async initializeNewProject(name: string): Promise<void> {
    // Step 1: Create project
    const project = await this.projectIpc.createProject({ name });
    
    // Step 2: Create default thread
    await this.threadIpc.create({ 
      projectId: project.id,
      name: 'Default Chat'
    });
    
    // Step 3: Update user preferences
    await this.settingsIpc.set('lastProjectId', project.id);
  }
}
```

**When to use Facades:**
- Coordinating 3+ service calls in sequence
- Complex error recovery across services
- Logic that multiple components would duplicate

### Step 6: Build Your Component

**Location:** `src/app/components/project-list/project-list.component.ts`

Components should be **trigger-agnostic** (work via routes, menus, or links):

```typescript
@Component({
  selector: 'app-project-list',
  standalone: true,
  templateUrl: './project-list.component.html'
})
export class ProjectListComponent implements OnInit {
  projects = signal<Project[]>([]);
  
  constructor(
    private projectIpc: ProjectIpcService,  // Simple CRUD
    // OR
    private projectFacade: ProjectFacade,    // Complex workflows
    private router: Router
  ) {
    // Check for menu-triggered actions via router state
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras?.state?.['openCreateDialog']) {
      this.displayCreateDialog = true;
    }
  }

  ngOnInit() {
    // Load data - same code regardless of how component was activated
    this.loadProjects();
  }

  private async loadProjects() {
    const data = await this.projectIpc.getAllProjects();
    this.projects.set(data);
  }
}
```

**Component Rules:**
- ✅ Components never listen to menu events directly
- ✅ All data loading happens in `ngOnInit`
- ✅ Check router state for action flags (e.g., open dialog)
- ✅ Inject service wrappers for CRUD, facades for workflows

### Step 7: Add Menu Integration (If Needed)

**Location:** `src/app/services/menu-navigation.service.ts`

```typescript
private setupProjectMenuHandlers(): void {
  window.electron.menu.onViewProjects(() => {
    if (this.router.url === '/projects') {
      this.reloadCurrentRoute();  // Refresh if already there
    } else {
      this.router.navigate(['/projects']);
    }
  });
  
  window.electron.menu.onNewProject(() => {
    // Pass state to open create dialog
    this.router.navigate(['/projects'], {
      state: { openCreateDialog: true }
    });
  });
}
```

**Menu-to-Route Pattern:**
- Menu clicks → MenuNavigationService translates to router.navigate()
- Components detect state via `router.getCurrentNavigation()`
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
  metadata: { projectId, name }
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

3. **Angular Security:**
   - Use DomSanitizer for dynamic content
   - Never use `innerHTML` with untrusted data
   - Trust Angular's built-in XSS protection

## Testing Your Feature

```typescript
// Service wrapper test
it('should fetch projects', async () => {
  spyOn(window.electron.projects, 'getAll')
    .and.returnValue(Promise.resolve(mockProjects));
  
  const result = await service.getAllProjects();
  expect(result).toEqual(mockProjects);
});

// Facade test (mock service wrappers)
it('should initialize project workflow', async () => {
  const projectIpcSpy = jasmine.createSpyObj('ProjectIpcService', ['createProject']);
  const threadIpcSpy = jasmine.createSpyObj('ThreadIpcService', ['create']);
  
  facade = new ProjectFacade(projectIpcSpy, threadIpcSpy);
  await facade.initializeNewProject('Test');
  
  expect(projectIpcSpy.createProject).toHaveBeenCalled();
  expect(threadIpcSpy.create).toHaveBeenCalled();
});
```

## Common Patterns Reference

| Pattern | Use When | Example |
|---------|----------|---------|
| **Service Wrapper** | Single IPC call, simple CRUD | `ProjectIpcService.getAll()` |
| **Facade** | Multi-step workflow, 3+ services | `ProjectFacade.initializeNewProject()` |
| **Menu Integration** | Feature accessible via app menu | MenuNavigationService handler |
| **Router State** | Menu needs to trigger action | `state: { openDialog: true }` |
| **Signal Store** | Complex UI state management | NgRx Signals for reactive data |

## Key Architectural Principles

1. **Process Separation:** Main does I/O and security, renderer does UI
2. **Data Source:** All persistence via Moku API (no local database)
3. **Menu Handling:** Centralized in MenuNavigationService
4. **Component Design:** Trigger-agnostic, data loading in ngOnInit
5. **Service Layers:** Wrappers for IPC calls, Facades for workflows
6. **NgRx Signals:** Reactive state management with signals
7. **Security First:** Context isolation, input validation, audit logging

## NgRx Signals State Management

Use NgRx Signals for reactive state management in components:

```typescript
import { signalStore, withState, withMethods } from '@ngrx/signals';

// Define a store
export const ThreadsStore = signalStore(
  { providedIn: 'root' },
  withState({
    threads: [] as Thread[],
    activeThreadId: null as string | null,
    isLoading: false
  }),
  withMethods((store) => ({
    setThreads(threads: Thread[]) {
      patchState(store, { threads });
    },
    setActiveThread(id: string) {
      patchState(store, { activeThreadId: id });
    }
  }))
);

// Use in component
@Component({ ... })
export class ThreadListComponent {
  threadsStore = inject(ThreadsStore);
  
  ngOnInit() {
    // Access signal values
    console.log(this.threadsStore.threads());
    // Update state
    this.threadsStore.setThreads(newThreads);
  }
}
```

## Getting Help

- **Architecture details:** See `architecture.md` in this folder
- **IPC reference:** Check `src-electron/preload.ts` for available APIs
- **Component examples:** Review `ThreadListComponent` and `ChatWindowComponent`
- **Service examples:** See `AuthService` and `ThreadService` in `src-electron/services/`

---

**Remember:** Start simple with service wrappers, add facades only when needed, keep components menu-agnostic, and always think about security!

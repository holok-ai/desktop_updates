# Electron + Svelte Prototype

This is a reference implementation demonstrating best practices for building Electron applications with Svelte and TypeScript.

## Architecture Overview

This prototype demonstrates:

- **Context Bridge**: Secure IPC communication between renderer and main process
- **IPC Handlers**: Organized domain-specific handlers in the main process
- **Svelte Stores**: Type-safe reactive stores that wrap Electron APIs
- **Reactive State**: Svelte's reactive primitives for reactive UI updates
- **Event Broadcasting**: Real-time updates across all windows
- **Modern UI**: Clean, responsive interface with Svelte's component system

## Project Structure

```
electron-svelte/
├── src/                          # Svelte application
│   ├── lib/
│   │   ├── services/             # Service layer
│   │   │   ├── electron.service.ts   # Electron API wrapper
│   │   │   └── thread.service.ts     # Domain service example
│   │   ├── stores/               # Svelte stores
│   │   │   ├── auth.store.ts     # Authentication state
│   │   │   └── thread.store.ts   # Thread state management
│   │   └── components/           # Reusable components
│   │       ├── layout/
│   │       │   ├── AppLayout.svelte  # Main layout
│   │       │   ├── Header.svelte     # Top header
│   │       │   └── Navbar.svelte     # Sidebar navigation
│   ├── routes/                   # Page components
│   │   ├── +page.svelte          # Home page
│   │   ├── login/
│   │   │   └── +page.svelte      # Login page
│   │   └── threads/
│   │       └── +page.svelte      # Threads CRUD example
│   ├── app.html                  # HTML entry point
│   ├── app.css                   # Global styles
│   └── main.ts                   # Svelte bootstrap
│
├── src-electron/                 # Electron main process
│   ├── ipc-handlers/             # IPC handlers by domain
│   │   ├── thread-handler.ts     # Thread operations
│   │   └── system-handler.ts     # System operations
│   ├── main.ts                   # Electron main process
│   └── preload.ts                # Preload script with Context Bridge
│
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── tsconfig.electron.json        # Electron TypeScript config
└── vite.config.ts                # Vite configuration
```

## Key Concepts

### 1. Context Bridge (Preload Script)

The `preload.ts` file exposes a secure API to the renderer process using `contextBridge`:

```typescript
// src-electron/preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  thread: {
    getAll: () => ipcRenderer.invoke('thread:getAll'),
    create: (data) => ipcRenderer.invoke('thread:create', data),
    // ... more methods
  }
});
```

### 2. IPC Handlers (Main Process)

The `ipc-handlers/` directory contains domain-specific handlers:

```typescript
// src-electron/ipc-handlers/thread-handler.ts
export function registerThreadHandlers() {
  ipcMain.handle('thread:getAll', async () => {
    // Implementation
  });
}
```

### 3. Svelte Services (Renderer)

Services wrap the Electron API with type safety:

```typescript
// src/lib/services/thread.service.ts
export class ThreadService {
  async createThread(data: ThreadData): Promise<Thread> {
    return window.electronAPI.thread.create(data);
  }
}
```

### 4. Svelte Stores (State Management)

Stores provide reactive state management using Svelte's built-in reactivity:

```typescript
// src/lib/stores/thread.store.ts
import { writable } from 'svelte/store';

function createThreadStore() {
  const { subscribe, set, update } = writable<Thread[]>([]);
  
  return {
    subscribe,
    setThreads: (threads: Thread[]) => set(threads),
    addThread: (thread: Thread) => update(threads => [...threads, thread])
  };
}

export const threads = createThreadStore();
```

### 5. Real-time Updates

Changes broadcast to all windows via events:

```typescript
// Main process
broadcast('thread:created', newThread);

// Renderer process (in store or component)
electronAPI.thread.onThreadCreated((thread) => {
  threads.addThread(thread);
});
```

## Getting Started

### Important: WSL Users

**⚠️ If you're using WSL (Windows Subsystem for Linux), you cannot run Electron directly from WSL bash.** Electron is a GUI application and requires native Windows support.

**Options for WSL Users:**

1. **Recommended: Use Windows Terminal with PowerShell or CMD** (not WSL bash)
   ```powershell
   # Open PowerShell or CMD in Windows
   cd C:\Projects\repos\holokai\desktop\prototypes\electron-svelte
   npm install
   npm run electron:dev
   ```

2. **Alternative: Install GUI Support in WSL2** (Windows 11 or recent Windows 10 with WSLg)
   ```bash
   # Update WSL to get WSLg support
   wsl --update
   
   # Install required libraries
   sudo apt-get update
   sudo apt-get install -y libgbm1 libnss3 libnspr4 libasound2 \
     libatk-bridge2.0-0 libatk1.0-0 libcups2 libdrm2 libxcomposite1 \
     libxdamage1 libxfixes3 libxrandr2 libxkbcommon0 libpango-1.0-0 libcairo2
   ```

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install
```

### Development - Two Options

#### Option 1: Simple Two-Terminal Approach (Recommended for Windows)

This is the most reliable method, especially on Windows:

**Terminal 1 - Start Vite Dev Server:**
```bash
npm run dev
```
Wait for "ready in" message showing the local server URL.

**Terminal 2 - Start Electron:**
```bash
npm run build:electron
npm run electron
```

Now both are running:
- Vite dev server watches for changes and hot-reloads
- Electron window displays the app
- To see Svelte changes: They auto-reload in Electron
- To see Electron changes: Close and restart with `npm run electron`

#### Option 2: Automated Watch Mode

```bash
# This runs everything automatically
npm run electron:dev
```

**Note:** If the Electron window doesn't open automatically, use Option 1 instead.

### Building for Production

```bash
# Build both Svelte and Electron
npm run build:prod

# Package as executable (creates installers)
npm run package
```

## Available Scripts

- `npm run dev` - Start Vite dev server (browser mode)
- `npm run build` - Build Svelte application
- `npm run preview` - Preview production build
- `npm run build:electron` - Build Electron main process
- `npm run build:prod` - Build both Svelte and Electron
- `npm run electron` - Run Electron (requires prior build)
- `npm run electron:dev` - Development mode with hot reload
- `npm run package` - Create distributable packages
- `npm run check` - Run Svelte type checking

## Technology Stack

- **Electron**: Desktop application framework
- **Svelte**: Reactive frontend framework
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server

## Security Features

✓ **Node Integration**: Disabled in renderer  
✓ **Context Isolation**: Enabled  
✓ **Remote Module**: Disabled  
✓ **Context Bridge**: Secure IPC communication  
✓ **Content Security Policy**: Configured in main process  

## Svelte Advantages

### Compared to Angular

1. **Smaller Bundle Size**: Svelte compiles to vanilla JavaScript with no runtime overhead
2. **Simpler Syntax**: Less boilerplate, more readable code
3. **True Reactivity**: Built-in reactivity without observables or change detection
4. **Faster Performance**: No virtual DOM diffing
5. **Easier Learning Curve**: Less framework-specific concepts to learn

### Reactive Examples

**Angular:**
```typescript
// Component with change detection
export class ThreadsComponent {
  threads = signal<Thread[]>([]);
  
  ngOnInit() {
    this.threadService.getThreads().subscribe(
      threads => this.threads.set(threads)
    );
  }
}
```

**Svelte:**
```svelte
<script lang="ts">
  // Automatic reactivity
  let threads: Thread[] = [];
  
  onMount(async () => {
    threads = await threadService.getThreads();
  });
</script>
```

## Learning Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Svelte Documentation](https://svelte.dev/docs)
- [Svelte Tutorial](https://svelte.dev/tutorial)
- [Electron Security](https://www.electronjs.org/docs/tutorial/security)

## Notes

### Why Svelte?

Svelte provides a simpler, more intuitive development experience:
- **True reactivity**: No need for observables, signals, or change detection
- **Less boilerplate**: Components are just HTML, CSS, and JavaScript
- **Better performance**: Compiles to efficient vanilla JavaScript
- **Smaller bundles**: No framework runtime in production
- **Easier testing**: Components are just functions and modules

### Why Stores?

Svelte stores provide:
- Simple, reactive state management
- Type safety with TypeScript
- Cross-component state sharing
- Built-in subscription management
- Easy testing and mocking

### Event Broadcasting

The prototype demonstrates how to keep multiple windows synchronized using event broadcasting. When one window creates/updates/deletes a thread, all windows receive the update immediately through stores.

## Extending This Prototype

To add new functionality:

1. **Define the API** in `preload.ts`
2. **Create IPC handlers** in `src-electron/ipc-handlers/`
3. **Register handlers** in `main.ts`
4. **Create service** in `src/lib/services/`
5. **Create store** (if needed) in `src/lib/stores/`
6. **Build UI components** in `src/routes/` or `src/lib/components/`

## Comparison with Angular Version

| Feature | Angular Version | Svelte Version |
|---------|----------------|----------------|
| Bundle Size | ~500KB+ | ~50-100KB |
| Reactivity | NgRx Signals | Built-in reactivity |
| Components | Class-based + decorators | Function-based, simple |
| State Management | NgRx Signals stores | Svelte stores |
| Learning Curve | Steeper (DI, RxJS, etc.) | Gentler |
| Performance | Virtual DOM + Change Detection | Compiled, no runtime |
| Build Tool | Angular CLI | Vite (faster) |

## License

MIT

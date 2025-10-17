# Electron + Angular Prototype

This is a reference implementation demonstrating best practices for building Electron applications with Angular and TypeScript.

## Architecture Overview

This prototype demonstrates:

- **Context Bridge**: Secure IPC communication between renderer and main process
- **IPC Handlers**: Organized domain-specific handlers in the main process
- **Angular Services**: Type-safe services that wrap Electron APIs
- **Reactive State**: RxJS observables for reactive UI updates
- **Event Broadcasting**: Real-time updates across all windows
- **PrimeNG UI**: Professional component library with theming

## Project Structure

```
electron-angular/
├── src/                          # Angular application
│   ├── app/
│   │   ├── core/
│   │   │   └── services/         # Angular services
│   │   │       ├── electron.service.ts   # Electron API wrapper
│   │   │       └── thread.service.ts     # Domain service example
│   │   ├── layout/               # Layout components
│   │   │   ├── app-layout.component.*    # Main layout
│   │   │   └── components/
│   │   │       ├── header.component.*    # Top header (mobile)
│   │   │       └── navbar.component.*    # Sidebar navigation
│   │   └── pages/                # Page components
│   │       ├── home/             # Home page
│   │       └── threads/          # Threads CRUD example
│   ├── assets/                   # Static assets
│   ├── index.html                # HTML entry point
│   ├── main.ts                   # Angular bootstrap
│   └── styles.css                # Global styles
│
├── src-electron/                 # Electron main process
│   ├── ipc-handlers/             # IPC handlers by domain
│   │   ├── thread-handler.ts     # Thread operations
│   │   └── system-handler.ts     # System operations
│   ├── main.ts                   # Electron main process
│   └── preload.ts                # Preload script with Context Bridge
│
├── angular.json                  # Angular configuration
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── tsconfig.app.json             # Angular TypeScript config
└── tsconfig.electron.json        # Electron TypeScript config
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

### 3. Angular Services (Renderer)

Services wrap the Electron API with type safety and reactive patterns:

```typescript
// src/app/core/services/thread.service.ts
export class ThreadService {
  async createThread(data: ThreadData): Promise<Thread> {
    return this.electronService.api.thread.create(data);
  }
}
```

### 4. Real-time Updates

Changes broadcast to all windows via events:

```typescript
// Main process
broadcast('thread:created', newThread);

// Renderer process
electronAPI.thread.onThreadCreated((thread) => {
  // Handle update
});
```

## Getting Started

### Important: WSL Users

**⚠️ If you're using WSL (Windows Subsystem for Linux), you cannot run Electron directly from WSL bash.** Electron is a GUI application and requires native Windows support.

**Options for WSL Users:**

1. **Recommended: Use Windows Terminal with PowerShell or CMD** (not WSL bash)
   ```powershell
   # Open PowerShell or CMD in Windows
   cd C:\Projects\repos\holokai\desktop-prototypes\electron-angular
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

3. **Development Workflow for WSL Users:**
   - Use WSL for Angular development: `npm start` (runs in browser)
   - Use Windows PowerShell/CMD for Electron testing: `npm run electron:dev`

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

**Terminal 1 - Start Angular Dev Server:**
```bash
npm start
```
Wait for "Application bundle generation complete" message.

**Terminal 2 - Start Electron:**
```bash
npm run build:electron
npm run electron
```

Now both are running:
- Angular dev server watches for changes and hot-reloads
- Electron window displays the app
- To see Angular changes: They auto-reload in Electron
- To see Electron changes: Close and restart with `npm run electron`

#### Option 2: Automated Watch Mode (May Have Issues on Windows)

```bash
# This attempts to run everything automatically
npm run electron:dev
```

**Note:** If the Electron window doesn't open automatically, use Option 1 instead.

### Building for Production

```bash
# Build both Angular and Electron
npm run build:prod

# Package as executable (creates installers)
npm run package
```

## Available Scripts

- `npm start` - Start Angular dev server (browser mode)
- `npm run build` - Build Angular application
- `npm run build:electron` - Build Electron main process
- `npm run build:prod` - Build both Angular and Electron
- `npm run electron` - Run Electron (requires prior build)
- `npm run electron:dev` - Development mode with hot reload
- `npm run package` - Create distributable packages

## Technology Stack

- **Electron**: Desktop application framework
- **Angular**: Frontend framework
- **TypeScript**: Type-safe JavaScript
- **PrimeNG**: UI component library
- **RxJS**: Reactive programming

## Security Features

✓ **Node Integration**: Disabled in renderer  
✓ **Context Isolation**: Enabled  
✓ **Remote Module**: Disabled  
✓ **Context Bridge**: Secure IPC communication  
✓ **Content Security Policy**: Can be configured  

## Learning Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Angular Documentation](https://angular.io/docs)
- [PrimeNG Documentation](https://primeng.org)
- [Electron Security](https://www.electronjs.org/docs/tutorial/security)

## Notes

### Why Context Bridge?

Context Bridge provides secure, controlled exposure of APIs to the renderer process while maintaining security boundaries. It prevents the renderer from accessing Node.js APIs directly.

### Why Separate IPC Handlers?

Organizing handlers by domain (threads, users, files, etc.) makes the codebase maintainable and scalable. Each handler module is responsible for a specific area of functionality.

### Why Angular Services?

Services provide:
- Type safety for IPC calls
- Reactive state management with RxJS
- Consistent error handling
- Easy testing and mocking

### Event Broadcasting

The prototype demonstrates how to keep multiple windows synchronized using event broadcasting. When one window creates/updates/deletes a thread, all windows receive the update immediately.

## Extending This Prototype

To add new functionality:

1. **Define the API** in `preload.ts`
2. **Create IPC handlers** in `src-electron/ipc-handlers/`
3. **Register handlers** in `main.ts`
4. **Create Angular service** in `src/app/core/services/`
5. **Build UI components** in `src/app/pages/`

## License

MIT

# Holokai Desktop Application

[![CI/CD Pipeline](https://github.com/YOUR_ORG/holokai-desktop/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_ORG/holokai-desktop/actions/workflows/ci.yml)

This is the **Holokai Desktop application** built with Electron and Svelte, demonstrating best practices for building secure, performant desktop applications with modern web technologies.

## Project Overview

The Holokai Desktop application is an Electron-based AI chat client that serves as part of the broader Holokai AI platform ecosystem. This application showcases:

- **Modern desktop architecture** with Electron and Svelte
- **Secure SSO integration** with the existing Moku web application
- **Multi-LLM support** for various AI providers (Claude, OpenAI, Ollama, Perplexity)
- **Enterprise-ready** with air-gapped deployment capabilities
- **API-based persistence** - no local databases, all data via Moku REST APIs

## Why Svelte?

Svelte was chosen as the UI framework for Holokai Desktop due to its unique advantages:

- **Compile-time optimization**: No virtual DOM overhead, resulting in faster runtime performance
- **Smaller bundle sizes**: ~50-100KB vs 500KB+ for traditional frameworks
- **True reactivity**: Built into the compiler, no need for complex state management libraries
- **Simpler mental model**: Components are just HTML, CSS, and JavaScript
- **Faster development**: Less boilerplate, more intuitive API
- **Better developer experience**: Excellent TypeScript support and tooling

## Architecture Overview

The application implements a secure two-process Electron architecture:

```
┌─────────────────────────────────────────────────────────┐
│                   ELECTRON MAIN PROCESS                 │
│                                                         │
│  ┌────────────────────────────────────────────────┐     │
│  │  IPC Handler Layer                             │     │
│  │  - Authentication handlers                     │     │
│  │  - Thread management handlers                  │     │
│  │  - Settings handlers                           │     │
│  └────────────────────────────────────────────────┘     │
│                                                         │
│  ┌────────────────────────────────────────────────┐     │
│  │  Services Layer                                │     │
│  │  - AuthService (SSO/OAuth orchestration)       │     │
│  │  - MokuAPIClient (REST API integration)        │     │
│  │  - SecureStorageService (token storage)        │     │
│  └────────────────────────────────────────────────┘     │
│                                                         │
└──────────────────────┬──────────────────────────────────┘
                       │
                  Context Bridge
                       │
┌──────────────────────▼───────────────────────────────────┐
│           ELECTRON RENDERER PROCESS (Svelte)            │
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │  Svelte Components & Routing                   │      │
│  │  - Login, Threads, Chat UI components          │      │
│  │  - SvelteKit routing with hash mode            │      │
│  └────────────────────────────────────────────────┘      │
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │  Svelte Stores (State Management)              │      │
│  │  - auth.store.ts (user, authentication state)  │      │
│  │  - thread.store.ts (thread list, active)       │      │
│  │  - models.store.ts (LLM providers)             │      │
│  └────────────────────────────────────────────────┘      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Authentication Flow (Exchange Code Flow)

The application implements a secure **Exchange Code Flow** for authentication:

1. **Desktop detects no token** → Opens browser to `https://moku.holokai.app/login/desktop`
2. **User logs in via Moku web** (OAuth2 with Google/Microsoft/etc.)
3. **Moku generates exchange code** → Redirects to `holokai://home?code=xyz`
4. **Desktop intercepts code** via custom protocol handler
5. **Exchange code for JWT** → POST `/api/auth/exchange-code`
6. **Exchange JWT for access token** → POST `/api/auth/token/refresh`
7. **Store token securely** using Electron's `safeStorage` API

See `ai/ARCHITECTURE.md` Section 9 for complete authentication flow details.

## Project Structure

```
holokai/desktop/                  # Application root
├── src/                          # Svelte application
│   ├── lib/
│   │   ├── services/             # Service layer (IPC wrappers)
│   │   │   ├── electron.service.ts   # Base Electron API wrapper
│   │   │   ├── auth.service.ts       # Authentication IPC wrapper
│   │   │   └── thread.service.ts     # Thread operations wrapper
│   │   ├── stores/               # Svelte stores for state
│   │   │   ├── auth.store.ts     # Authentication state
│   │   │   └── thread.store.ts   # Thread state management
│   │   └── components/           # Reusable UI components
│   ├── routes/                   # SvelteKit pages
│   │   ├── +page.svelte          # Home page
│   │   ├── login/
│   │   │   └── +page.svelte      # Login page
│   │   └── threads/
│   │       └── +page.svelte      # Thread management
│   ├── app.html                  # HTML entry point
│   └── app.css                   # Global styles
│
├── src-electron/                 # Electron main process
│   ├── ipc/
│   │   └── eventHandlers/        # IPC handlers by domain
│   │       ├── AuthEventHandler.ts    # Auth operations
│   │       └── ThreadEventHandler.ts  # Thread operations
│   ├── services/                 # Business logic services
│   │   ├── AuthService.ts        # SSO/OAuth orchestration
│   │   ├── MokuAPIClient.ts      # Moku API integration
│   │   └── SecureStorageService.ts    # Token encryption
│   ├── main.ts                   # Electron main entry
│   └── preload.ts                # Context Bridge definition
│
├── ai/                           # Documentation
│   ├── ARCHITECTURE.md           # Complete architecture guide
│   ├── coding-instructions.md    # Development guidelines
│   └── DEVELOPER-README.md       # Developer onboarding
│
└── tests/                        # Test suites
    ├── unit/                     # Unit tests
    ├── integration/              # IPC integration tests
    └── e2e/                      # End-to-end tests
```

## Key Implementation Patterns

### 1. Context Bridge (Secure IPC)

The preload script exposes a secure, grouped API:

```typescript
// src-electron/preload.ts
contextBridge.exposeInMainWorld('electron', {
  auth: {
    startOAuthFlow: () => ipcRenderer.invoke('auth:start-oauth'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getUser: () => ipcRenderer.invoke('auth:get-user'),
  },
  threads: {
    getAll: () => ipcRenderer.invoke('threads:get-all'),
    create: (data) => ipcRenderer.invoke('threads:create', data),
    delete: (id) => ipcRenderer.invoke('threads:delete', id),
  },
});
```

### 2. Service Wrappers (Renderer Process)

Svelte components use TypeScript service wrappers for IPC calls:

```typescript
// src/lib/services/thread.service.ts
export class ThreadService {
  async createThread(data: ThreadData): Promise<Thread> {
    return window.electron.threads.create(data);
  }

  async getAllThreads(): Promise<Thread[]> {
    return window.electron.threads.getAll();
  }
}
```

### 3. Svelte Stores (State Management)

Reactive state management using Svelte's built-in stores:

```typescript
// src/lib/stores/thread.store.ts
import { writable } from 'svelte/store';

function createThreadStore() {
  const { subscribe, set, update } = writable<Thread[]>([]);

  return {
    subscribe,
    setThreads: (threads: Thread[]) => set(threads),
    addThread: (thread: Thread) => update((threads) => [...threads, thread]),
  };
}

export const threads = createThreadStore();
```

### 4. Menu Navigation Service

Menu commands are centralized through a navigation service:

```typescript
// src/lib/services/menuNavigation.service.ts
class MenuNavigationService {
  constructor() {
    // Register all menu handlers
    window.electron.menu.onGetThreads(() => {
      if (get(page).url.pathname === '/threads') {
        this.reloadCurrentRoute();
      } else {
        goto('/threads');
      }
    });
  }

  private reloadCurrentRoute() {
    invalidateAll(); // SvelteKit's way to reload data
  }
}
```

Components remain menu-agnostic, responding only to route activation.

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

### Prerequisites

- Node.js 18+ and npm
- Windows, macOS, or Linux with GUI support

### Important: WSL Users

**⚠️ If you're using WSL (Windows Subsystem for Linux), you cannot run Electron directly from WSL bash.** Electron is a GUI application and requires native Windows support.

**Options for WSL Users:**

1. **Recommended: Use Windows Terminal with PowerShell or CMD** (not WSL bash)

   ```powershell
   # Open PowerShell or CMD in Windows
   cd C:\Projects\repos\holokai\desktop
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

### Installation

```bash
# Install dependencies
npm install
```

### Development

**Option 1: Two-Terminal Approach (Recommended)**

Terminal 1 - Start Vite Dev Server:

```bash
npm run dev
```

Terminal 2 - Build and Run Electron:

```bash
npm run build:electron
npm run electron
```

**Option 2: Automated Watch Mode**

```bash
npm run electron:dev
```

### Building for Production

```bash
# Build both Svelte and Electron
npm run build:prod

# Create distributable packages
npm run package
```

## Bundle Size Analysis

To analyze and optimize bundle size:

1. **Install the visualizer plugin:**

   ```bash
   npm install --save-dev rollup-plugin-visualizer
   ```

2. **Add to vite.config.ts:**

   ```typescript
   import { visualizer } from 'rollup-plugin-visualizer';

   export default defineConfig({
     plugins: [
       svelte(),
       visualizer({
         open: true,
         gzipSize: true,
         brotliSize: true,
         filename: 'dist/stats.html',
       }),
     ],
     // ... rest of config
   });
   ```

3. **Build the project:**

   ```bash
   npm run build
   ```

4. **View the analysis:**

   The visualizer will automatically open `dist/stats.html` in your browser, showing:
   - Interactive treemap of bundle contents
   - Size of each module and dependency
   - Gzip and Brotli compressed sizes
   - Identify opportunities for code splitting or optimization

5. **Remove when done:**

   Remove the visualizer import and plugin from vite.config.ts to keep production builds clean.

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
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run type-check` - Run TypeScript type checking
- `npm run test:unit` - Run unit tests
- `npm run test:integration` - Run integration tests
- `npm run test:e2e` - Run E2E tests
- `npm run test:coverage` - Run tests with coverage report
- `npm run security:deps` - Check for dependency vulnerabilities
- `npm run security:secrets` - Scan for hardcoded secrets
- `npm run security:lockfile` - Validate lockfile integrity

## CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment. The pipeline automatically runs on every push and pull request.

**Pipeline includes**:
- Linting and type checking
- Security scanning
- Unit, integration, and E2E tests (across Linux, macOS, Windows)
- Multi-platform builds
- Automated packaging for releases

**For detailed CI/CD documentation**, see [`docs/ci-cd-setup.md`](docs/ci-cd-setup.md) which includes:
- Complete pipeline architecture
- Job descriptions and timeouts
- Running checks locally
- Troubleshooting guide
- Performance optimization tips

## Technology Stack

- **Electron**: Desktop application framework
- **Svelte**: Reactive UI framework
- **SvelteKit**: Application framework for Svelte
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **electron-log**: Logging for Electron applications
- **electron-store**: Settings persistence
- **Axios**: HTTP client for API calls

## Security Features

✓ **Context Isolation**: Enabled - renderer cannot access Node APIs  
✓ **Node Integration**: Disabled in renderer process  
✓ **Secure Token Storage**: Using Electron's `safeStorage` API  
✓ **Content Security Policy**: Configured in main process  
✓ **HTTPS Only**: All Moku API calls use HTTPS  
✓ **OAuth PKCE**: Enhanced OAuth security via Moku web  
✓ **Sandboxed Renderer**: Renderer process runs in sandbox  
✓ **Input Validation**: All IPC parameters validated in main process

## Development Guidelines

### Coding Standards

Refer to `ai/coding-instructions.md` for detailed guidelines on:

- File and folder naming conventions
- IPC organization patterns
- Service wrapper and facade patterns
- Logging and auditing requirements
- Security best practices

### Svelte Best Practices

**Component Structure:**

- Single-file components with `<script>`, markup, and `<style>`
- Use `<script lang="ts">` for TypeScript
- Export props: `export let propName: Type`
- Keep component logic in script section

**Reactivity:**

- Variables are reactive by default when reassigned
- Reactive declarations: `$: derived = source * 2`
- Reactive statements: `$: if (condition) { doSomething(); }`
- Store subscriptions: `$authStore.user` (auto-subscribe/unsubscribe)

**State Management:**

- Use `writable()`, `readable()`, and `derived()` stores
- Keep stores focused on single domains
- Custom stores can add methods
- Update stores using `set()` or `update()`

**Performance:**

- Use `{#key}` blocks to force re-rendering
- Implement virtual scrolling for large lists
- Lazy load components dynamically using `import()`
- Use `tick()` to await DOM updates
- Optimize list rendering with keyed `{#each}` blocks

See `ai/coding-instructions.md` for complete Svelte guidelines.

## Testing

```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run specific E2E test file
npm run test:e2e -- tests/e2e/thread-management.spec.ts

# Run E2E tests with UI mode (debugging)
npm run test:e2e -- --ui

# Run E2E tests in debug mode
npm run test:e2e -- --debug
```

Tests use:

- **Vitest** for unit testing
- **Svelte Testing Library** for component tests
- **Playwright** for E2E testing

Mock IPC calls in tests using Vitest spies on `window.electron.*` methods.

### Testing Details

- Structure under `tests/`: `unit/`, `integration/ipc/`, `e2e/`, `setup/`, `fixtures/`.
- Global setup `tests/setup/test-setup.ts` stubs `window.electronAPI` and jsdom gaps.
- Coverage: run `npm run test:coverage` for text, HTML, and lcov; thresholds enforced.
- Reports: Vitest JUnit at `test-results/vitest-junit.xml`, Playwright JUnit at `test-results/playwright-junit.xml`, HTML at `playwright-report/`.

### E2E Testing

End-to-end tests use Playwright with Electron to test the full application flow. Tests run in **serial mode** with a shared Electron instance for performance.

**Key Features:**

- **Fast Authentication**: Centralized fixture using real tokens (96% faster than manual login)
- **Real Electron Environment**: Tests run against actual Electron app, not browser
- **Comprehensive Coverage**: Authentication, threads, chat, projects, settings, markdown rendering

**Quick Start:**

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test suite
npm run test:e2e -- tests/e2e/thread-management.spec.ts --reporter=line

# Debug mode (step through tests)
npm run test:e2e -- tests/e2e/chat.spec.ts --debug
```

**Authentication Fixture:**

Tests use `launchAuthenticatedApp()` from `tests/fixtures/electron-auth.ts` which injects real authentication tokens, eliminating the need for manual login:

```typescript
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

test.describe.serial('My Test Suite', () => {
  let app: ElectronApplication;

  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
  });

  test('my test', async () => {
    const page = await getFirstWindow(app);
    // Test is already authenticated!
  });
});
```

**Important Patterns:**

- Always navigate to homepage first (30s wait for models to load)
- Use unique timestamps in test data to avoid conflicts
- Tests run in serial mode - state carries over between tests
- After reload, app returns to homepage - navigate back to thread if needed

**For detailed documentation**, see [`docs/e2e-testing-guide.md`](docs/e2e-testing-guide.md) which includes:

- Complete test coverage matrix
- Authentication fixture documentation
- Known issues and workarounds
- Debugging techniques
- Best practices and troubleshooting

## Extending the Application

To add new functionality:

1. **Define the API** in `preload.ts`
2. **Create IPC handlers** in `src-electron/ipc/eventHandlers/`
3. **Register handlers** in `main.ts`
4. **Create service wrapper** in `src/lib/services/`
5. **Create store** (if needed) in `src/lib/stores/`
6. **Build UI components** in `src/routes/` or `src/lib/components/`

## Documentation

- [`ai/ARCHITECTURE.md`](ai/ARCHITECTURE.md) - Complete system architecture
- [`ai/coding-instructions.md`](ai/coding-instructions.md) - Development guidelines
- [`ai/DEVELOPER-README.md`](ai/DEVELOPER-README.md) - Developer onboarding
- [`QUICK_START.md`](QUICK_START.md) - Quick setup guide
- [`CONTRIBUTING.md`](CONTRIBUTING.md) - How to contribute
- [`docs/e2e-testing-guide.md`](docs/e2e-testing-guide.md) - E2E testing documentation
- [`docs/ci-cd-setup.md`](docs/ci-cd-setup.md) - CI/CD pipeline documentation
- [`docs/testing-checklist.md`](docs/testing-checklist.md) - Pre-commit testing checklist

## Svelte Advantages

### True Reactivity

Svelte's compiler transforms your declarative components into efficient imperative code that surgically updates the DOM, eliminating the need for virtual DOM diffing.

### Smaller Bundle Size

Applications typically ship with 50-100KB of JavaScript compared to 500KB+ for traditional frameworks, resulting in faster initial load times.

### Simpler Mental Model

No need to learn complex state management patterns or lifecycle hooks. Svelte components are just HTML, CSS, and JavaScript with intuitive reactive assignments.

### Better Performance

Without the overhead of a virtual DOM or runtime framework, Svelte applications have faster initial render, smoother animations, and lower memory usage.

### Developer Experience

Built-in TypeScript support, excellent IDE integration, clear error messages, and a gentle learning curve make development more enjoyable and productive.

## License

MIT

## 1. Overview

## 2. Architecture Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   ELECTRON MAIN PROCESS                 │
│                                                         │
│  ┌────────────────────────────────────────────────┐     │
│  │  Application Lifecycle Manager                 │     │
│  │  - Window management                           │     │
│  │  - Auto-updater                                │     │
│  │  - Tray icon / Menu                            │     │
│  └────────────────────────────────────────────────┘     │
│                                                         │
│  ┌────────────────────────────────────────────────┐     │
│  │  IPC Handler Layer                             │     │
│  │  - Authentication handlers                     │     │
│  │  - Thread management handlers                  │     │
│  │  - Settings handlers                           │     │
│  │  - File system operations                      │     │
│  └────────────────────────────────────────────────┘     │
│                                                         │
│  ┌────────────────────────────────────────────────┐     │
│  │  Services Layer                                │     │
│  │  - AuthService (OAuth flow orchestration)      │     │
│  │  - MokuAPIClient (thread/message persistence)  │     │
│  │  - SecureStorageService (credentials)          │     │
│  │  - LoggingService (electron-log)               │     │
│  └────────────────────────────────────────────────┘     │
│                                                         │
│  ┌────────────────────────────────────────────────┐     │
│  │  Data Persistence                              │     │
│  │  - Moku API (threads, messages via REST)       │     │
│  │  - Electron Store (app settings, preferences)  │     │
│  │  - Secure Storage (API keys, tokens)           │     │
│  └────────────────────────────────────────────────┘     │
│                                                         │
└──────────────────────┬──────────────────────────────────┘
                       │
                  IPC Bridge
                       │
┌──────────────────────▼───────────────────────────────────┐
│                 ELECTRON RENDERER PROCESS                │
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │  Svelte + UI Components                        │      │
│  │  - LoginScreenComponent                        │      │
│  │  - ThreadListComponent                         │      │
│  │  - ChatWindowComponent (reused from lib)       │      │
│  │  - ModelSelectorComponent                      │      │
│  │  - SidebarComponent                            │      │
│  └────────────────────────────────────────────────┘      │
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │  State Management (NgRx Signals)               │      │
│  │  - AuthStore (user, isAuthenticated)           │      │
│  │  - ThreadsStore (thread list, active thread)   │      │
│  │  - ModelsStore (available models, selected)    │      │
│  └────────────────────────────────────────────────┘      │
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │  Business Logic (from chat-component)          │      │
│  │  - ChatService                                 │      │
│  │  - ChatProviderFactory                         │      │
│  │  - Provider implementations                    │      │
│  │    • ClaudeChatProvider                        │      │
│  │    • OpenAIChatProvider                        │      │
│  │    • OllamaChatProvider                        │      │
│  └────────────────────────────────────────────────┘      │
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │  Menu Integration Layer                        │      │
│  │  - MenuNavigationService (menu interceptor)    │      │
│  │    Translates menu commands → router actions   │      │
│  │    Components remain menu-agnostic             │      │
│  └────────────────────────────────────────────────┘      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Process Communication Flow

```
User Action (Renderer)
    ↓
Angular Component
    ↓
IPC Call via window.electron.* (Context Bridge)
    ↓
Main Process IPC Handler
    ↓
Service Layer (AuthService / Moku API Client)
    ↓
External APIs (OAuth Provider / Moku API)
    ↓
Response back through IPC
    ↓
NgRx Signal Store Update
    ↓
UI Re-render (Angular change detection)
```

---

## 3. Technology Stack

### 3.1 Core Technologies

| Technology           | Version | Purpose                                 |
| -------------------- | ------- | --------------------------------------- |
| **Electron**         | 28.x    | Desktop app framework                   |
| **Angular**          | 18.x    | UI framework with standalone components |
| **NgRx Signals**     | 18.x    | Lightweight reactive state management   |
| **TypeScript**       | 5.3.x   | Type safety                             |
| **Electron Builder** | 24.x    | Packaging & distribution                |

### 3.2 UI & Styling

| Technology                | Purpose                                      |
| ------------------------- | -------------------------------------------- |
| **Tailwind CSS**          | Utility-first styling (shared with Moku web) |
| **Holokai Design Tokens** | Consistent theming via CSS custom properties |
| **PrimeNG**               | Angular UI component library                 |
| **Lucide Angular**        | Icon library                                 |

### 3.3 Key Dependencies

**Production Dependencies:**

- `@angular/core`, `@angular/common`, `@angular/router` (^18.0.0) - Angular framework
- `@ngrx/signals` (^18.0.0) - State management
- `@holokai/chat-component` (^1.0.0) - Chat functionality
- `primeng` (^17.0.0) - UI component library
- `primeicons` (^7.0.0) - Icon set for PrimeNG
- `electron-store` (^8.1.0) - Settings persistence
- `electron-log` (^5.0.0) - Logging
- `axios` (^1.6.0) - HTTP client

**Development Dependencies:**

- `@angular-devkit/build-angular`, `@angular/cli`, `@angular/compiler-cli` (^18.0.0) - Build tools
- `electron` (^28.0.0) - Desktop framework
- `electron-builder` (^24.9.0) - Packaging
- `jasmine-core` (^5.1.0), `karma` (^6.4.0) - Testing

**Note:** No local database dependency (like SQLite) is included. All chat data persistence is handled via the Moku API.

---

## 4. Main Process Design

### 4.1 Context Bridge for Method and Data Definition

The main process will use a ContextBridge with groupings to logically organize features into categories as shown below:

```typescript
// src-electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electron', {
  // Auth operations
  auth: {
    startOAuthFlow: () => ipcRenderer.invoke('auth:start-oauth'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    refreshToken: (refreshToken: string) => ipcRenderer.invoke('auth:refresh-token', refreshToken),
    getUser: () => ipcRenderer.invoke('auth:get-user'),
  },

  // Thread operations
  threads: {
    getAll: () => ipcRenderer.invoke('threads:get-all'),
    create: (data: CreateThreadData) => ipcRenderer.invoke('threads:create', data),
    delete: (id: string) => ipcRenderer.invoke('threads:delete', id),
    update: (id: string, data: UpdateThreadData) => ipcRenderer.invoke('threads:update', id, data),
    syncMessage: (threadId: string, message: any) =>
      ipcRenderer.invoke('threads:syncMessage', threadId, message),
  },

  // Model operations
  models: {
    getAvailable: () => ipcRenderer.invoke('models:get-available'),
    testConnection: (provider: string, apiKey: string) =>
      ipcRenderer.invoke('models:test-connection', provider, apiKey),
  },

  // Settings operations
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:get-all'),
  },

  // System operations
  system: {
    getVersion: () => ipcRenderer.invoke('system:get-version'),
    checkForUpdates: () => ipcRenderer.invoke('system:check-updates'),
    openExternal: (url: string) => ipcRenderer.invoke('system:open-external', url),
  },
});
```

### 4.2 IPC Handlers Use Service Classes

The IPC Handler Process will use service classes (or another design pattern if appropriate) for each Context Bridge grouping. For example, all Thread operations are performed in a Thread service class.

```typescript
// src-electron/ipc/handlers.ts
import { ipcMain } from 'electron';
import { AuthService } from '../services/AuthService';
import { ThreadService } from '../services/ThreadService';
import { ModelService } from '../services/ModelService';

export function registerIPCHandlers(
  authService: AuthService,
  threadService: ThreadService,
  modelService: ModelService,
) {
  // Auth handlers
  ipcMain.handle('auth:start-oauth', async () => {
    return authService.startOAuthFlow();
  });

  ipcMain.handle('auth:logout', async () => {
    return authService.logout();
  });

  ipcMain.handle('auth:refresh-token', async (_, refreshToken: string) => {
    return authService.refreshAccessToken(refreshToken);
  });

  // Thread handlers - All data fetched from Moku API
  ipcMain.handle('threads:get-all', async () => {
    return threadService.getAllThreads(); // Calls Moku API
  });

  ipcMain.handle('threads:create', async (_, data: CreateThreadData) => {
    return threadService.createThread(data); // Calls Moku API
  });

  ipcMain.handle('threads:delete', async (_, id: string) => {
    return threadService.deleteThread(id); // Calls Moku API
  });

  ipcMain.handle('threads:syncMessage', async (_, threadId: string, message: any) => {
    return threadService.syncMessage(threadId, message); // Sends to Moku API
  });

  // Model handlers
  ipcMain.handle('models:get-available', async () => {
    return modelService.getAvailableModels();
  });

  ipcMain.handle('models:test-connection', async (_, provider: string, apiKey: string) => {
    return modelService.testProviderConnection(provider, apiKey);
  });
}
```

# 5. Render Process

## 5.1 Using Services to Access IPCs

The Render process should use a "Service Wrapper + Facade Pattern" for communicating with the host process via IPC.

Key Points:
Service wrappers: One service per IPC domain, one method per IPC call - focused and single-purpose
Facades: Coordinate multiple service wrappers for complex user workflows (e.g. app initialization, multi-step imports)
Component usage: Inject service wrappers for simple isolated operations, inject facades for complex multi-step scenarios
Typical application: 5-8 service wrappers covering all IPC domains, only 2-3 facades for the most complex workflows
Error handling: Service wrappers handle IPC-level errors (network, timeout), facades handle business logic errors (coordination failures, partial success)
Testing strategy: Mock service wrappers in tests, test facades with mocked service wrappers

Development approach: Always start with service wrappers first, add facades only when components duplicate the same multi-step coordination logic

## 5.2 Menu Navigation and Routing Architecture

### 5.2.1 MenuNavigationService Pattern

The desktop application uses a centralized **MenuNavigationService** to handle all menu commands from the Electron main process. This service acts as an "interceptor" between menu events and Angular Router navigation, ensuring components remain menu-agnostic.

**Key Principle:** Components never listen to menu events directly. They only respond to route activation (ngOnInit), making them simpler and more testable.

### 5.2.2 Architecture Flow

```
User clicks Electron Menu (Main Process)
    ↓
Menu Handler: webContents.send('menu:command')
    ↓
Context Bridge: Exposes onMenuCommand() listener
    ↓
MenuNavigationService: Translates to Router navigation
    ↓
Angular Router: Activates route
    ↓
Component: ngOnInit loads data
    ↓
No menu-specific code in component!
```

### 5.2.3 Implementation Pattern

**MenuNavigationService Responsibilities:**

- Listen to ALL menu events from main process via Context Bridge
- Translate menu commands into Angular Router navigation
- Decide whether to navigate to new route or refresh current route
- Pass state to components via router state when needed (e.g., open dialog)
- Centralize all menu logic in one place

**Example Menu Handler:**

```typescript
private setupFileMenuHandlers(): void {
  // Menu: File → Get Threads
  window.electron.menu.onGetThreads(() => {
    if (this.router.url === '/threads') {
      // Already on threads page - reload it
      this.reloadCurrentRoute();
    } else {
      // Navigate to threads page
      this.router.navigate(['/threads']);
    }
  });

  // Menu: File → New Thread
  window.electron.menu.onNewThread(() => {
    // Navigate and pass state to open dialog
    this.router.navigate(['/threads'], {
      state: { openCreateDialog: true }
    });
  });
}
```

**Route Reloading Pattern:**

```typescript
private reloadCurrentRoute(): void {
  const currentUrl = this.router.url;
  // Navigate to empty route (skipLocationChange prevents URL change)
  this.router.navigateByUrl('/', { skipLocationChange: true })
    .then(() => {
      // Navigate back - component is destroyed and recreated
      this.router.navigateByUrl(currentUrl);
    });
}
```

### 5.2.4 Component Design (Menu-Agnostic)

Components are designed to work identically whether activated by:

- Route navigation (user clicks link/button)
- Menu command (user clicks Electron menu)
- Deep link (custom protocol URL)
- Programmatic navigation

**Pattern:**

```typescript
@Component({ ... })
export class ThreadListComponent implements OnInit {
  constructor(
    private threadService: ThreadService,
    private router: Router
  ) {
    // Check router state for flags from menu
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras?.state?.['openCreateDialog']) {
      this.displayCreateDialog = true;
    }
  }

  ngOnInit() {
    // Simple: Just load data
    this.loadThreads();
    // No menu listeners needed!
  }
}
```

**Benefits:**

- ✅ Components have zero menu-specific code
- ✅ All menu logic centralized in MenuNavigationService
- ✅ Easy to test components (no menu dependencies)
- ✅ Menu changes don't affect components
- ✅ Components work in any context (web, Electron, tests)

### 5.2.5 Routing Configuration

The application uses **hash-based routing** (`#/`) which is recommended for Electron:

- Works with `file://` protocol without server configuration
- No need for server-side rewrites
- Deep linking support
- Browser history API works normally

**Configuration:**

```typescript
bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(
      routes,
      // Enable hash routing
      withHashLocation(),
      // Allow reloading same route (for menu refresh commands)
      withRouterConfig({ onSameUrlNavigation: 'reload' }),
    ),
  ],
});
```

### 5.2.6 Initialization

MenuNavigationService is initialized at app startup via `APP_INITIALIZER` to ensure menu handlers are registered before any user interaction:

```typescript
{
  provide: APP_INITIALIZER,
  useFactory: (menuNavigationService: MenuNavigationService) => {
    return () => {
      // Service constructor has already registered handlers
      console.log('MenuNavigationService initialized');
    };
  },
  deps: [MenuNavigationService],
  multi: true
}
```

### 5.2.7 Menu-to-Route Mapping

Example of an expected menu to route mapping is below:

| Menu Command       | Route Action                   | Component Behavior  |
| ------------------ | ------------------------------ | ------------------- |
| File → Get Threads | Navigate to `/threads`         | Loads thread list   |
| File → New Thread  | Navigate to `/threads` + state | Opens create dialog |
| File → Settings    | Navigate to `/settings`        | Shows settings      |
| File → Refresh     | Reload current route           | Re-runs ngOnInit    |
| Recent → Thread X  | Navigate to `/thread/:id`      | Shows thread detail |

### 5.2.8 Design Principles

**Separation of Concerns:**

- **Frontend Router**: Handles UI navigation within renderer process
- **IPC Communication**: Handles data fetching between renderer and main
- **Menu Service**: Translates menu commands to router actions
- These layers are separate and should not be conflated

**Component Responsibilities:**

- Components focus on WHAT to do (display data, handle user input)
- Components don't care HOW they were activated (route, menu, etc.)
- Data loading happens in ngOnInit regardless of activation source

**Trigger-Agnostic Design:**

- Same component code works for route navigation and menu commands
- No conditional logic based on activation source
- Single data loading method used by all triggers

## 5.1.1 Service Wrappers

Service wrappers are thin Angular services that directly correspond to IPC domains (auth, threads, models) from the Contect Bridge. Each service method wraps exactly one IPC call with type safety, error handling, and retry logic. Service wrappers are used for CRUD operations, simple actions and small sets of method calls.

## 5.1.2 Facade plus Service Wrappers

For complex service interaction, a Facade should be used. Facades orchestrate multiple service wrappers to handle complex multi-step workflows, coordinating timing, error recovery, and state management across several operations behind a simplified API.

# 6. Auditting and Local Logging

Implement two types of logging:
auditting - uses the Holo audit service
local logging - logs startup, loading, configuration, communication and fatal errors

## 6.1 Auditting

Write events and actions to the Holokai Audit Q. These include:

- application start up and shut down
- user SSO login, redirect, revokje, and logout
- prompt-response activities such as chat, thread and project
- thread management actions

## 6.2 Logging

Write events to the local log file such as:

- application start up and shut down
- dependency load and version information
- communication connection success and failures
- host resource access

**Application logging should be created in the main process and made available to the render process using preload.**

Use `electron-log` for logging in both main and renderer processes: `import log from 'electron-log'`.

Log levels should be used appropriately: `log.error()` for errors, `log.warn()` for warnings, `log.info()` for general info, `log.debug()` for verbose output.

Always sanitize sensitive data before logging: `log.info('User logged in', { userId: user.id })` (never log tokens or passwords).

**Never write sensitive data to logs**, including API keys, tokens, passwords, personal identifying information, or full request/response bodies containing sensitive fields.

Include context objects for structured logging: `log.error('API call failed', { endpoint, statusCode, error })`.

Log files are automatically managed by electron-log and stored in the OS-specific app data directory.

---

## 7. LLM Requirements

The desktop application must support integration with multiple Large Language Model (LLM) providers through a unified abstraction layer.

### 7.1 Multi-Provider Support

**REQ-LLM-01: Provider Abstraction Interface**
The application shall implement a provider-agnostic interface (`IChatProvider`) that standardizes chat operations across all LLM providers.

Each provider implementation must support both streaming and non-streaming response modes.

```typescript
interface IChatProvider {
  chat(request: ChatRequest, onTokenReceived?: (token: string) => void): Promise<void>;
  chatWithOptions(
    request: ChatRequestWithOptions,
    onTokenReceived?: (token: string) => void,
  ): Promise<void>;
}
```

**REQ-LLM-02: Supported Providers**
The application shall support the following LLM providers at minimum: (Anthropic) Claude, OpenAI, Ollama and Perplexity with architecture designed for easy addition of new providers through factory pattern instantiation.

### 7.2 Message Format and Conversion

**REQ-LLM-03: Universal Message Format**
The application shall maintain an internal universal message format that is provider-agnostic, with converter classes responsible for translating between the internal format and each provider's specific API requirements.

**REQ-LLM-04: Conversation History**
The application shall preserve complete conversation context across all LLM interactions, maintaining message history in the internal format and converting to provider-specific format only at the point of API invocation.

### 7.3 Performance Auditing

**REQ-LLM-05: Token Metrics Collection**
The application shall collect performance metrics for each LLM interaction, including prompt token count, completion token count, total tokens, time to first token, total duration, and tokens per second.

**REQ-LLM-06: Audit Data Persistence**
The application shall support audit logging of LLM prompts and responses by either application logging or autid logging.

### 7.4 File and Content Handling

**REQ-LLM-07: Multi-Modal Input Support**
The application shall support attachment of files to LLM prompts, with automatic detection of text vs. binary files and appropriate encoding (UTF-8 for text, Base64 for binary) before transmission to providers. The application shall support uploading images for processing by image generating LLMs, such as

**REQ-LLM-08: Markdown and Code Rendering**
The application shall render LLM responses with proper markdown formatting and syntax-highlighted code blocks using marked.js for mark down text and prism.js for syntax highlighting of common programming languages including JavaScript, TypeScript, Python, CSS, and Bash.

**REQ-LLM-09: Image Rendering**
The application should support rendering LLM responses as images when the response format is returned as a base64-encoded image rather than text.

Note: this design should use the same IChatProvider interface and provide a handler for the response format, rather than creating an IImageProvider interface for image generating models like Gemini 2.5 Flash Image/"nano-bananas".

### 7.5 Error Handling and Recovery

**REQ-LLM-10: Provider Error Management**
The application shall gracefully handle provider-specific errors with appropriate user feedback, logging failures without exposing sensitive API details while maintaining audit trail for troubleshooting.

---

## 8. Security Considerations

### 8.1 Security Checklist

- ✅ **Context Isolation**: Enabled - renderer cannot access Node APIs
- ✅ **Node Integration**: Disabled in renderer process
- ✅ **Content Security Policy**: Strict CSP headers prevent XSS
- ✅ **Secure Storage**: API keys and tokens encrypted using safeStorage
- ✅ **HTTPS Only**: All external API calls over HTTPS
- ✅ **Input Validation**: All IPC parameters validated in main process
- ✅ **OAuth PKCE**: Enhanced OAuth security prevents code interception
- ✅ **No eval()**: No dynamic code execution anywhere
- ✅ **Sandboxed Renderer**: Renderer process runs in sandbox
- ✅ **Angular Security**: Built-in XSS protection via DomSanitizer

### 8.2 Electron Security Configuration

**BrowserWindow Settings:**

- nodeIntegration: false
- contextIsolation: true
- sandbox: true
- webSecurity: true
- allowRunningInsecureContent: false
- preload script path specified

**Content Security Policy Headers:**
Applied via session.webRequest.onHeadersReceived interceptor:

- default-src 'self'
- script-src 'self'
- style-src 'self' 'unsafe-inline' (required for Angular/Tailwind)
- img-src 'self' data: https:
- connect-src 'self' https://api.anthropic.com https://api.openai.com
- font-src 'self' data:
- object-src 'none'
- base-uri 'self'
- form-action 'self'

### 8.3 Data Protection

**Sensitive Data Handling:**

- API keys never passed through renderer process
- Tokens stored encrypted in main process only
- Passwords never logged or persisted
- PII handled according to privacy policy
- All sensitive operations logged without exposing secrets

**Dependencies:** Electron safeStorage, electron-log

## 9. Authentication Workflow (Exchange Code Flow)

The desktop application uses an **Exchange Code Flow** for secure authentication. The desktop app spawns a browser with a Moku web URL that indicates a desktop user is logging in. Moku web authenticates via OAuth2. After login, Moku web generates a one-time-use exchange code and redirects the user back to the desktop app with the exchange code. The desktop calls a Moku API endpoint to exchange the code for a JWT token. Desktop then calls the refresh endpoint to obtain the access token with app permissions.

### 9.1 Authentication Flow

```
╔════════════════════════════════════════════════════════════════════════════╗
║                    DESKTOP SSO - EXCHANGE CODE FLOW                        ║
╚════════════════════════════════════════════════════════════════════════════╝

┌─────────────┐                                                  ┌─────────────┐
│   DESKTOP   │                                                  │  MOKU WEB   │
└──────┬──────┘                                                  └──────┬──────┘
       │                                                                 │
       │ 1. No token detected                                           │
       ├─────────────────────────────────────────────────────────────→ │
       │        Spawn browser to                                        │
       │  moku.holokai.app/login/desktop                               │
       │                                                                 │
       │                                                    2. User logs in (OAuth2)
       │                                                                 │
       │                                    3. POST /api/auth/apiKey     │
       │                              ┌────────────────────────────────→│
       │                              │      (generates JWT token)       │
       │                              │                                  │
       │                              │    Returns: { apiKey: "jwt" }   │
       │                              │←────────────────────────────────┤
       │                              │                                  │
       │                       4. POST /api/auth/generate-exchange-code │
       │                              ┌────────────────────────────────→│
       │                              │      (apiKey in request)         │
       │                              │                                  │
       │                              │    Returns: { code: "xyz" }     │
       │                              │←────────────────────────────────┤
       │                              │                                  │
       │    5. Redirect: holokai://home?code=xyz                        │
       │←─────────────────────────────────────────────────────────────│
       │                                                                 │
       │ 6. Parse code from URI                                         │
       │                                                                 │
       │ 7. POST /api/auth/exchange-code                              │
       ├────────────────────────────────────────────────────────────→ │
       │        { code: "xyz" }                                         │
       │                                                                 │
       │           Returns: { apiKey: "jwt" }                          │
       │←────────────────────────────────────────────────────────────┤
       │                                                                 │
       │ 8. POST /api/auth/token/refresh                              │
       ├────────────────────────────────────────────────────────────→ │
       │        { apiKey: "jwt" }                                       │
       │                                                                 │
       │    Returns: { accessToken: "jwt-with-app-access" }           │
       │←────────────────────────────────────────────────────────────┤
       │                                                                 │
       │ 9. Store accessToken securely                                  │
       │ ✓ Done - Use for all API calls                               │
       │                                                                 │

═══════════════════════════════════════════════════════════════════════════════
```

### 9.2 Step-by-Step Flow

**Step 1: Desktop Detects No Token**

On first launch or after token expiration, the desktop app detects it lacks a valid access token. It spawns the system default browser to:

```
https://moku.holokai.app/login/desktop
```

This URL is stored as a configuration setting in the desktop app, allowing for different environments (dev, staging, prod).

**Step 2: User Logs in via OAuth2**

User logs in through Moku web using OAuth2. Moku web handles authentication with Identity Providers (Google, Microsoft, Okta, etc.) and creates a user session upon successful authentication.

Note: Desktop app does NOT interact with external IDPs directly. Moku web manages all OAuth provider integrations.

**Step 3: Generate API Key**

After successful authentication, Moku web calls its backend to generate a JWT token (apiKey) for the authenticated user:

```
POST /api/auth/apiKey
```

Response:

```json
{
  "apiKey": "eyJhbGc...[JWT-TOKEN]...XYZ"
}
```

**Step 4: Generate Exchange Code**

Moku web calls its backend to generate a one-time-use exchange code:

```
POST /api/auth/generate-exchange-code

Body: { "apiKey": "eyJhbGc...[JWT-TOKEN]...XYZ" }
```

Response:

```json
{
  "code": "exc_xyz123abc456"
}
```

**Step 5: Redirect to Desktop**

Moku web redirects the browser back to the desktop app using the custom protocol:

```
holokai://home?code=exc_xyz123abc456
```

**Step 6: Desktop Intercepts Code**

Desktop's custom protocol handler (registered at app startup) intercepts the redirect.

Electron main process:

- Listens for `open-url` event
- Extracts query parameter: `code=exc_xyz123abc456`
- Passes code to AuthService for token exchange

**Step 7: Exchange Code for API Key**

Desktop calls Moku backend to exchange the code for the apiKey:

```
POST https://api.moku.holokai.app/api/auth/exchange-code

Body: { "code": "exc_xyz123abc456" }
```

Response:

```json
{
  "apiKey": "eyJhbGc...[JWT-TOKEN]...XYZ"
}
```

Error responses:

- 401 if code not found
- 401 if code expired
- 401 if code already used

**Step 8: Exchange API Key for Access Token**

Desktop calls Moku backend to exchange apiKey for accessToken with app permissions:

```
POST https://api.moku.holokai.app/api/auth/token/refresh

Body: { "apiKey": "eyJhbGc...[JWT-TOKEN]...XYZ" }
```

Response:

```json
{
  "accessToken": "eyJhbGc...[JWT-WITH-APP-ACCESS]...XYZ"
}
```

**Step 9: Store Access Token**

Desktop app stores the accessToken securely:

```typescript
// In-memory (Main Process)
this.accessToken = accessToken;
this.tokenExpiresAt = Date.now() + 3600 * 1000 - 60 * 1000; // 1-hour minus 60s buffer

// Persistent (Encrypted via OS)
await store.set('moku_access_token', accessToken);
```

Desktop uses this accessToken for all subsequent Moku API calls (in Authorization header).

### 9.3 Re-Authentication Flow

This is the flow for most app launches.

1. **App Starts**: Electron app launches

2. **Check for Token**: Load stored accessToken from memory/storage

3. **Validate Token**: Check if token is still valid (not expired)

4. **If Valid**: Load app normally - use accessToken for API calls

5. **If Expired or Missing**: Restart full authentication flow (Step 1)

6. **If Token Refresh Available**: Call token refresh endpoint with cached apiKey

```
POST https://api.moku.holokai.app/api/auth/token/refresh

Body: { "apiKey": "<cached-api-key>" }
```

7. **Load App**: Desktop now has valid accessToken and proceeds to main UI

### 9.4 Secure Token Storage

**Access Token Storage:**

- **In-Memory**: Main process keeps current accessToken in memory
- **Expiration Tracking**: Calculated as `now + expiresIn - 60s` (1-minute safety buffer)
- **Never Persisted**: Access tokens are NOT written to disk

**API Key Storage (Optional):**

- Desktop may optionally cache the apiKey briefly for token refresh
- If cached, stored in Electron Store (can be encrypted via OS)
- Should expire after 24 hours or on app restart
- Only used for token refresh, never exposed to renderer

**Security Implementation:**

```typescript
// src-electron/services/AuthService.ts

export class AuthService {
  private accessToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private apiKey: string | null = null; // Optional, short-lived cache

  async exchangeCodeForTokens(code: string): Promise<void> {
    try {
      // Exchange code for apiKey
      const exchangeResponse = await axios.post(
        'https://api.moku.holokai.app/api/auth/exchange-code',
        { code },
      );
      const apiKey = exchangeResponse.data.apiKey;

      // Cache apiKey briefly (optional)
      this.apiKey = apiKey;

      // Exchange apiKey for accessToken
      const tokenResponse = await axios.post(
        'https://api.moku.holokai.app/api/auth/token/refresh',
        { apiKey },
      );

      const { accessToken, expires_in } = tokenResponse.data;

      // Store tokens
      this.accessToken = accessToken;
      this.tokenExpiresAt = Date.now() + expires_in * 1000 - 60 * 1000;

      // Notify renderer that auth succeeded
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send('auth:success', { userId: extractUserFromToken(accessToken) });
      });
    } catch (error) {
      logger.error('Token exchange failed', error);
      this.cleanup();
      throw error;
    }
  }

  async refreshAccessToken(): Promise<void> {
    if (this.isTokenValid()) {
      return; // Token still valid, no refresh needed
    }

    if (!this.apiKey && !this.hasStoredApiKey()) {
      // No apiKey available - need full re-authentication
      throw new Error('Re-authentication required');
    }

    try {
      const apiKey = this.apiKey || (await store.get('cached_api_key'));
      const response = await axios.post('https://api.moku.holokai.app/api/auth/token/refresh', {
        apiKey,
      });

      const { accessToken, expires_in } = response.data;
      this.accessToken = accessToken;
      this.tokenExpiresAt = Date.now() + expires_in * 1000 - 60 * 1000;
    } catch (error) {
      logger.error('Token refresh failed', error);
      this.cleanup();
      throw error;
    }
  }

  isTokenValid(): boolean {
    return this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt;
  }

  getAccessToken(): string {
    return this.accessToken || '';
  }

  private cleanup(): void {
    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.apiKey = null;
    store.delete('cached_api_key');
  }
}
```

### 9.5 Custom Protocol Registration

**Windows (Registry):**
Electron Builder automatically creates registry entries during installation:

```
HKEY_CURRENT_USER\Software\Classes\holokai
  @= "URL: Holokai Protocol"
  "URL Protocol" = ""
  \shell\open\command
    @= "C:\\Program Files\\Holokai\\Holokai.exe" \"%1\"
```

**macOS (Info.plist):**

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.holokai.app</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>holokai</string>
    </array>
  </dict>
</array>
```

**Linux (Desktop Entry):**

```ini
[Desktop Entry]
Name=Holokai
Exec=holokai %U
Type=Application
MimeType=x-scheme-handler/holokai
```

### 9.6 Error Scenarios

**Browser Launch Fails:**

- Display error: "Unable to open browser. Check your default browser settings."
- User can copy custom protocol URL manually
- Log error with system info

**User Closes Browser Without Logging In:**

- Desktop detects no callback after 5+ minute timeout
- Show: "Login window closed. Please try again."
- Allow user to retry authentication

**Exchange Code Expired:**

- Desktop receives 401: "Code expired"
- Show: "Login took too long. Please try again."
- User restarts authentication flow

**Code Already Used (Replay Attack):**

- First exchange succeeds
- Subsequent attempts with same code return 401
- Main process prevents accidental reuse

**Invalid API Key:**

- Exchange code returns valid apiKey
- But token refresh fails with 401
- Show: "Login failed. Please try again."
- Restart full authentication

### 9.7 Key Benefits

✅ **Token never visible in browser** — Only exchange code passes through URL  
✅ **One-time-use code** — Code becomes invalid after first exchange (security)  
✅ **No localhost listener needed** — Desktop uses custom protocol callback  
✅ **Minimal backend changes** — Only 2 new endpoints required  
✅ **Secure token handoff** — Custom protocol is OS-managed  
✅ **Stateless desktop** — No session cookies or complex state management  
✅ **Cross-platform** — Works on Windows, macOS, and Linux

### 9.8 Security Considerations

**HTTPS Enforcement:**

- All Moku API calls use HTTPS only
- Desktop validates SSL certificates
- No insecure HTTP fallback

**Code Security:**

- Exchange code is cryptographically random (256-bit)
- 5-minute TTL prevents brute force attacks
- One-time use prevents replay attacks
- Invalidated immediately after successful exchange

**Token Security:**

- Access tokens never logged or exposed
- Short-lived (1 hour) reduces window of compromise
- API key briefly cached only for token refresh
- Stored in OS credential managers when persisted

**Session Security:**

- Server-side session expires after timeout
- Browser login creates isolated session
- No cookies shared between browser and desktop
- User can log out from either context independently

### 9.9 Required Endpoints

| Endpoint                           | Method | Input               | Output                   | Called By   | Notes                               |
| ---------------------------------- | ------ | ------------------- | ------------------------ | ----------- | ----------------------------------- |
| `/api/auth/apiKey`                 | GET    | None                | `{ apiKey: "jwt" }`      | Moku Web    | User must be authenticated          |
| `/api/auth/generate-exchange-code` | POST   | `{ apiKey: "jwt" }` | `{ code: "xyz" }`        | Moku Web    | Generates one-time code (5 min TTL) |
| `/api/auth/exchange-code`          | POST   | `{ code: "xyz" }`   | `{ apiKey: "jwt" }`      | Desktop App | Invalidates code after use          |
| `/api/auth/token/refresh`          | POST   | `{ apiKey: "jwt" }` | `{ accessToken: "jwt" }` | Desktop App | Adds app permissions to token       |

---

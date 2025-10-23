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

| Technology | Version | Purpose |
|------------|---------|---------|
| **Electron** | 28.x | Desktop app framework |
| **Angular** | 18.x | UI framework with standalone components |
| **NgRx Signals** | 18.x | Lightweight reactive state management |
| **TypeScript** | 5.3.x | Type safety |
| **Electron Builder** | 24.x | Packaging & distribution |

### 3.2 UI & Styling

| Technology | Purpose |
|------------|---------|
| **Tailwind CSS** | Utility-first styling (shared with Moku web) |
| **Holokai Design Tokens** | Consistent theming via CSS custom properties |
| **PrimeNG** | Angular UI component library |
| **Lucide Angular** | Icon library |

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
import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electron', {
  // Auth operations
  auth: {
    startOAuthFlow: () => ipcRenderer.invoke('auth:start-oauth'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    refreshToken: (refreshToken: string) => 
      ipcRenderer.invoke('auth:refresh-token', refreshToken),
    getUser: () => ipcRenderer.invoke('auth:get-user')
  },
  
  // Thread operations
  threads: {
    getAll: () => ipcRenderer.invoke('threads:get-all'),
    create: (data: CreateThreadData) => 
      ipcRenderer.invoke('threads:create', data),
    delete: (id: string) => ipcRenderer.invoke('threads:delete', id),
    update: (id: string, data: UpdateThreadData) => 
      ipcRenderer.invoke('threads:update', id, data),
    syncMessage: (threadId: string, message: any) =>
      ipcRenderer.invoke('threads:syncMessage', threadId, message)
  },
  
  // Model operations
  models: {
    getAvailable: () => ipcRenderer.invoke('models:get-available'),
    testConnection: (provider: string, apiKey: string) =>
      ipcRenderer.invoke('models:test-connection', provider, apiKey)
  },
  
  // Settings operations
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any) => 
      ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:get-all')
  },
  
  // System operations
  system: {
    getVersion: () => ipcRenderer.invoke('system:get-version'),
    checkForUpdates: () => ipcRenderer.invoke('system:check-updates'),
    openExternal: (url: string) => 
      ipcRenderer.invoke('system:open-external', url)
  }
})
```

### 4.2 IPC Handlers Use Service Classes 

The IPC Handler Process will use service classes (or another design pattern if appropriate) for each Context Bridge grouping. For example, all Thread  operations are performed in a Thread service class. 

```typescript
// src-electron/ipc/handlers.ts
import { ipcMain } from 'electron'
import { AuthService } from '../services/AuthService'
import { ThreadService } from '../services/ThreadService'
import { ModelService } from '../services/ModelService'

export function registerIPCHandlers(
  authService: AuthService,
  threadService: ThreadService,
  modelService: ModelService
) {
  // Auth handlers
  ipcMain.handle('auth:start-oauth', async () => {
    return authService.startOAuthFlow()
  })
  
  ipcMain.handle('auth:logout', async () => {
    return authService.logout()
  })
  
  ipcMain.handle('auth:refresh-token', async (_, refreshToken: string) => {
    return authService.refreshAccessToken(refreshToken)
  })
  
  // Thread handlers - All data fetched from Moku API
  ipcMain.handle('threads:get-all', async () => {
    return threadService.getAllThreads() // Calls Moku API
  })
  
  ipcMain.handle('threads:create', async (_, data: CreateThreadData) => {
    return threadService.createThread(data) // Calls Moku API
  })
  
  ipcMain.handle('threads:delete', async (_, id: string) => {
    return threadService.deleteThread(id) // Calls Moku API
  })

  ipcMain.handle('threads:syncMessage', async (_, threadId: string, message: any) => {
    return threadService.syncMessage(threadId, message) // Sends to Moku API
  })
  
  // Model handlers
  ipcMain.handle('models:get-available', async () => {
    return modelService.getAvailableModels()
  })
  
  ipcMain.handle('models:test-connection', async (_, provider: string, apiKey: string) => {
    return modelService.testProviderConnection(provider, apiKey)
  })
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
      withRouterConfig({ onSameUrlNavigation: 'reload' })
    )
  ]
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

| Menu Command | Route Action | Component Behavior |
|--------------|--------------|--------------------|
| File → Get Threads | Navigate to `/threads` | Loads thread list |
| File → New Thread | Navigate to `/threads` + state | Opens create dialog |
| File → Settings | Navigate to `/settings` | Shows settings |
| File → Refresh | Reload current route | Re-runs ngOnInit |
| Recent → Thread X | Navigate to `/thread/:id` | Shows thread detail |

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

## 5.1.1  Service Wrappers 

Service wrappers are thin Angular services that directly correspond to IPC domains (auth, threads, models) from the Contect Bridge. Each service method wraps exactly one IPC call with type safety, error handling, and retry logic. Service wrappers are used for CRUD operations, simple actions and small sets of method calls. 

## 5.1.2  Facade plus Service Wrappers 

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
  chatWithOptions(request: ChatRequestWithOptions, onTokenReceived?: (token: string) => void): Promise<void>;
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
The application shall collect  performance metrics for each LLM interaction, including prompt token count, completion token count, total tokens, time to first token, total duration, and tokens per second.

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

---
## 9. Authentication Workflow

The desktop application uses OAuth 2.0 with PKCE (Proof Key for Code Exchange) for secure authentication. **Moku API acts as an OAuth Client/Proxy**, facilitating authentication through external Identity Providers (IDPs) such as Google, Microsoft, Okta, or other enterprise SSO systems. This pass-through architecture provides Single Sign-On (SSO) capability while maintaining Moku's own token system for API access.

### Quick Overview

**Initial Authentication (First-Time Login):**
1. **Client Setup** - Register custom protocol (`holokai://`) and store client ID in Electron main process
2. **Generate PKCE Values** - Create code_verifier, code_challenge, and state parameter; store in memory (5-min timeout)
3. **Launch Browser** - Open system browser with Moku's authorization URL containing PKCE challenge and state
4. **Moku Redirects to IDP** - Moku API redirects browser to external IDP (Google/Microsoft/Okta)
5. **IDP Authentication** - User authenticates with external IDP; IDP redirects back to Moku with IDP authorization code
6. **Moku Processes IDP Response** - Moku exchanges IDP code for IDP tokens, creates/links Moku user, generates Moku authorization code
7. **Desktop Receives Callback** - Moku redirects to desktop with Moku authorization code
8. **Token Exchange** - Desktop validates state, exchanges Moku code + code_verifier for Moku tokens
9. **Token Storage** - Store Moku access_token in memory, refresh_token in encrypted safeStorage (OS credential manager)
10. **Token Refresh** - When access_token expires, use refresh_token to get new Moku tokens without browser interaction

**Re-Authentication (99% of use cases):**
- App starts → Check safeStorage for refresh_token → Decrypt → Call Moku token endpoint → Get new tokens → Load app

**Security Features:**
- ✅ PKCE prevents authorization code interception
- ✅ State parameter prevents CSRF attacks
- ✅ 60-second authorization code expiration
- ✅ One-time use codes (replay attack prevention)
- ✅ Encrypted token storage via OS credential managers
- ✅ Access tokens in memory only (never persisted)
- ✅ Enterprise SSO integration (Google, Microsoft, Okta, etc.)
- ✅ MFA/2FA handled by external IDP

---

### 9.1 Initial Authentication Flow

**Step 1: Client ID and Custom Protocol (Desktop)**

The Electron Main process has a constant variable containing the client id.

In your Electron app, you register your custom protocol (e.g., holokai://) using `app.setAsDefaultProtocolClient('holokai')`. This tells the operating system that any link starting with holokai:// should be opened by your Electron app.

**Step 2: Electron App (Before Browser)**

- Generates a code_verifier: 32+ byte random string (base64url encoded)
- Creates a SHA-256 hash of it called the code_challenge
- Generate a 32-byte random value for state, encoded as hexadecimal characters
- Electron Main process stores the code verifier and code challenge using an in-memory store with a timeout (default of 5 minutes)

**Step 3: Electron → Browser**

Launches the system browser with authorization URL:
```
https://moku.com/api/oauth/authorize
  ?client_id={CLIENT_ID}
  &redirect_uri=holokai://home
  &code_challenge={CODE_CHALLENGE}
  &code_challenge_method=S256
  &state={STATE}
  &response_type=code
  &scope={SCOPES}  // Optional, e.g., "read write"
```

Note: All parameters must be properly URL-encoded.

If browser fails to open:
- Display error message: "Unable to open browser. Please check your default browser settings."
- Perform cleanup (delete code_verifier, code_challenge, state from memory)
- Log error with system info
- Provide manual URL option for user to copy/paste

**Step 4: Moku API (OAuth Client) - Initial Processing**

Moku API receives authorization request.

VALIDATE REQUEST:
- Verify client_id is valid and registered
- Verify redirect_uri exactly matches whitelisted value ('holokai://home')
- Verify all required parameters present (client_id, redirect_uri, code_challenge, code_challenge_method, state, response_type)
- Verify code_challenge_method is 'S256'

If validation fails:
- Return error to redirect_uri with error code
- Example: `holokai://home?error=invalid_request&error_description=...&state={STATE}`

STORE DESKTOP REQUEST:
- Store desktop's code_challenge, redirect_uri, state in session (associated with session ID)
- This will be needed after IDP authentication completes

REDIRECT TO EXTERNAL IDP:
Moku redirects browser to external Identity Provider (Google, Microsoft, Okta, etc.):
```
https://accounts.google.com/o/oauth2/v2/auth
  ?client_id={MOKU_CLIENT_ID_AT_GOOGLE}
  &redirect_uri=https://moku.com/api/oauth/callback/google
  &response_type=code
  &scope=openid profile email
  &state={SESSION_ID}
```

Note: Each IDP has its own authorization URL and parameters.

**Step 5: External IDP Authentication**

User authenticates with the external IDP:
- User enters credentials at Google/Microsoft/Okta
- User consents to share profile information with Moku
- IDP may perform MFA/2FA if configured

IDP redirects back to Moku's callback:
```
https://moku.com/api/oauth/callback/google?code={IDP_CODE}&state={SESSION_ID}
```

**Step 6: Moku API - Process IDP Response**

Moku receives callback from IDP.

EXCHANGE IDP CODE FOR IDP TOKENS:
```
POST https://oauth2.googleapis.com/token

{
  "code": "{IDP_CODE}",
  "client_id": "{MOKU_CLIENT_ID_AT_GOOGLE}",
  "client_secret": "{MOKU_CLIENT_SECRET_AT_GOOGLE}",
  "redirect_uri": "https://moku.com/api/oauth/callback/google",
  "grant_type": "authorization_code"
}
```

IDP RESPONSE:
```json
{
  "access_token": "{IDP_ACCESS_TOKEN}",
  "id_token": "{JWT_WITH_USER_INFO}",
  "refresh_token": "{IDP_REFRESH_TOKEN}",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

EXTRACT USER INFORMATION:
- Parse id_token JWT to extract user info (email, name, sub/user_id)
- Or call IDP's userinfo endpoint with access_token

CREATE OR LINK MOKU USER:
- Look up user by email in Moku database
- If user exists: Link IDP account to existing Moku user
- If new user: Create new Moku user record with IDP information
- Store IDP's user_id (sub) for future linking

GENERATE MOKU AUTHORIZATION CODE:
- Create unique Moku authorization_code
- Set expiration: 60 seconds from creation
- Retrieve stored desktop request data (code_challenge, redirect_uri, state) from session
- Associate authorization_code with:
  * Moku user_id
  * Desktop's code_challenge
  * Desktop's redirect_uri
  * Desktop's state
  * created_at timestamp

REDIRECT to desktop app:
`holokai://home?code={MOKU_AUTHORIZATION_CODE}&state={DESKTOP_STATE}`

Note: This is Moku's authorization code, NOT the IDP's code.

**Step 7: Electron App (Token Exchange)**

App receives deep link via open-url event: `holokai://home?...`

VALIDATE DEEP LINK:
- Verify URL starts with 'holokai://home'
- Parse query parameters

CHECK FOR ERRORS:
If 'error' parameter present:
- Extract error and error_description
- Log/display error to user
- Perform cleanup (remove code_verifier, state from memory)
- Exit flow

EXTRACT PARAMETERS:
- code (authorization_code)
- state

VALIDATE STATE:
- Retrieve stored state from in-memory cache
- If not found (timeout or missing):
  * Log error "State not found or expired"
  * Perform cleanup
  * Exit flow
- Compare received state with stored state
- If mismatch:
  * Log security warning "State mismatch - possible CSRF attack"
  * Perform cleanup
  * Exit flow
- If match: Delete state from memory (one-time use)

EXCHANGE CODE FOR TOKENS:
```
POST /api/oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "{AUTHORIZATION_CODE}",
  "client_id": "{CLIENT_ID}",
  "code_verifier": "{CODE_VERIFIER}",
  "redirect_uri": "holokai://home"
}
```

CLEANUP IN-MEMORY STORAGE:
- Delete code_verifier
- Delete code_challenge
- State already deleted after verification

ON ERROR:
- Perform full cleanup
- Display error to user
- Log for debugging

**Step 8: Moku API - Token Issuance**

Moku backend receives token request at: `POST /api/oauth/token`

Note: This validates the **Moku authorization code** (generated in Step 6), NOT the IDP code.

Validate:
- Verify all required parameters present (grant_type, code, client_id, code_verifier, redirect_uri)
- Verify grant_type is 'authorization_code'
- Verify client_id is valid (desktop-client)

CHECK MOKU CODE STATUS:
- Verify Moku authorization code has not already been used (detect replay attacks)
- If already used:
  * Log security alert "Authorization code reuse detected"
  * Revoke any tokens issued with this code (if applicable)
  * Return 400: `{"error": "invalid_grant", "error_description": "Code already used"}`

CHECK CODE EXPIRATION:
- Calculate: current_time - code.created_at
- If > 60 seconds:
  * Return 400: `{"error": "invalid_grant", "error_description": "Authorization code expired"}`

VALIDATE REDIRECT_URI:
- Compare request redirect_uri with stored redirect_uri from Step 4
- If mismatch:
  * Log security warning "Redirect URI mismatch"
  * Return 400: `{"error": "invalid_grant", "error_description": "Redirect URI mismatch"}`

VALIDATE PKCE:
- Hash received code_verifier using SHA-256
- Encode hash as base64url
- Compare with stored code_challenge (from Step 4)
- If mismatch:
  * Log security alert "PKCE verification failed - possible attack"
  * Return 400: `{"error": "invalid_grant", "error_description": "Code verifier invalid"}`

ALL CHECKS PASSED - ISSUE MOKU TOKENS:
- Mark Moku authorization_code as used (or delete it)
- Generate Moku access_token:
  * Format: JWT or opaque token
  * Expiration: 3600 seconds (1 hour) recommended
  * Include: moku_user_id, client_id, scope, issued_at, expires_at
  * Note: This is a Moku token, not the IDP token
- Generate Moku refresh_token:
  * Cryptographically secure random string
  * Store in database with: moku_user_id, client_id, created_at
  * Optionally link to IDP refresh token for future IDP token refresh
  * Optional: Set expiration (e.g., 30 days, 90 days, or no expiration)

RETURN SUCCESS RESPONSE:
```
HTTP 200 OK
Content-Type: application/json

{
  "access_token": "{MOKU_ACCESS_TOKEN}",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "{MOKU_REFRESH_TOKEN}",
  "scope": "{SCOPES}"
}
```

Note: Desktop receives **Moku tokens**, which it will use for all Moku API calls.

ON ANY VALIDATION FAILURE:
- Do NOT issue tokens
- Log the failure with details
- Return appropriate OAuth error response

**Step 9: Electron App Main Process Stores the Moku Access Token and Refresh Token**

VALIDATE RESPONSE:
- Verify all required fields present
- Verify token_type is "Bearer"
- Verify expires_in is reasonable (> 0)
- If validation fails: log error, perform cleanup, display error to user

STORE TOKENS:

In-memory (Main Process):
- access_token
- token_expires_at = Date.now() + (expires_in * 1000) - 60000  // 1-min safety buffer
- token_type

Electron app keeps the access token in memory, available for any api calls to Moku API.

Persistent Storage (safeStorage):
- Electron app securely stores the Refresh Token (and only the refresh token) on the user's machine using safeStorage, an API built directly into Electron. It encrypts data using the operating system's native credential manager (macOS Keychain, Windows Credential Vault, Linux Keyring).

On an OAuth failure or timeout, the Electron app should cleanup to allow the user to attempt another login workflow. Cleanup includes removing the code verifier and state from memory, resetting any workflow variables and clearing the access token and refresh token values.

**Step 10: Token Refresh (When Moku Access Token Expires)**

When making API calls to Moku:

1. Check if moku_access_token exists and is not expired
2. If expired or missing, request token refresh from Moku API:

```
POST /api/oauth/token
Content-Type: application/json

{
  "grant_type": "refresh_token",
  "refresh_token": "{MOKU_REFRESH_TOKEN}",
  "client_id": "{CLIENT_ID}"
}
```

Note: This uses the **Moku refresh token**, not the IDP refresh token.

3. Moku server response:

```json
{
  "access_token": "new_moku_token",
  "refresh_token": "new_moku_refresh_token",  // If using rotation
  "expires_in": 3600
}
```

Note: Moku may optionally use the stored IDP refresh token to get a fresh IDP token if needed, but this is transparent to the desktop app.

4. Update storage:
   - Store new `access_token` in memory
   - Update `token_expires_at`
   - Store new `refresh_token` in `safeStorage` (if rotated)

5. If refresh fails (401):
   - Clear all tokens
   - Restart OAuth flow from Step 2 (will trigger full IDP authentication again)

### 9.2 Re-Authentication Flow (User Restarts Desktop)

This is the flow that will happen 99% of the time.

1. **App Starts**: The Electron app launches.

2. **Check for Token**: It looks for the encrypted refresh token in safeStorage.

3. **Decrypt Token**: If the token exists, it reads and decrypts the refresh token:

```javascript
import { safeStorage } from 'electron';

const encryptedToken = await store.get('refresh_token');
const refreshToken = safeStorage.decryptString(encryptedToken);
```

4. **Refresh the Session**: Your app makes a direct, background API call to your Moku `/api/oauth/token` endpoint. This does not involve opening the browser.

```
POST /api/oauth/token

{
  "grant_type": "refresh_token",
  "refresh_token": "...the_decrypted_token...",
  "client_id": "moku-desktop-app"
}
```

5. **Get New Tokens**: Your Moku API validates the refresh token and returns a new Access Token and (optionally, but recommended) a new Refresh Token.

6. **Load App**: The app is now fully authenticated. It loads the user's data and proceeds to the main UI.

### 9.3 Backend Requirements

Moku Spring backend needs to be configured as an **OAuth 2.0 Client** (not Authorization Server), acting as a proxy/broker between the desktop app and external IDPs.

**Required Moku API Endpoints:**
- `GET /api/oauth/authorize` - Initial authorization endpoint (receives desktop request, redirects to IDP)
- `GET /api/oauth/callback/{provider}` - IDP callback endpoint (receives IDP response, processes authentication)
- `POST /api/oauth/token` - Token endpoint for exchanging Moku codes and refreshing Moku tokens

**Configuration Requirements:**

**Desktop Client Registration (in Moku):**
- client_id: `desktop-client` or similar
- Whitelisted redirect URIs: `holokai://home`
- Authorization code expiration: 60 seconds
- Access token expiration: 3600 seconds (1 hour) recommended
- Support for PKCE (code_challenge_method: S256)

**IDP Registration (Moku as OAuth Client at each IDP):**

For each external IDP (Google, Microsoft, Okta), register Moku as an OAuth client:

**Google:**
- Register at: https://console.cloud.google.com/apis/credentials
- Redirect URI: `https://moku.com/api/oauth/callback/google`
- Scopes: `openid profile email`
- Get: client_id, client_secret

**Microsoft:**
- Register at: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps
- Redirect URI: `https://moku.com/api/oauth/callback/microsoft`
- Scopes: `openid profile email`
- Get: client_id, client_secret, tenant_id

**Okta:**
- Register in Okta Admin Console
- Redirect URI: `https://moku.com/api/oauth/callback/okta`
- Scopes: `openid profile email`
- Get: client_id, client_secret, issuer_url

**Spring Boot Configuration (application.yml):**

```yaml
spring:
  security:
    oauth2:
      client:
        registration:
          google:
            client-id: ${GOOGLE_CLIENT_ID}
            client-secret: ${GOOGLE_CLIENT_SECRET}
            scope: openid,profile,email
            redirect-uri: "{baseUrl}/api/oauth/callback/google"
            authorization-grant-type: authorization_code
            
          microsoft:
            client-id: ${MICROSOFT_CLIENT_ID}
            client-secret: ${MICROSOFT_CLIENT_SECRET}
            scope: openid,profile,email
            redirect-uri: "{baseUrl}/api/oauth/callback/microsoft"
            authorization-grant-type: authorization_code
            
          okta:
            client-id: ${OKTA_CLIENT_ID}
            client-secret: ${OKTA_CLIENT_SECRET}
            scope: openid,profile,email
            redirect-uri: "{baseUrl}/api/oauth/callback/okta"
            authorization-grant-type: authorization_code
            
        provider:
          microsoft:
            authorization-uri: https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize
            token-uri: https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
            user-info-uri: https://graph.microsoft.com/oidc/userinfo
            jwk-set-uri: https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys
            user-name-attribute: sub
            
          okta:
            authorization-uri: ${OKTA_ISSUER}/v1/authorize
            token-uri: ${OKTA_ISSUER}/v1/token
            user-info-uri: ${OKTA_ISSUER}/v1/userinfo
            jwk-set-uri: ${OKTA_ISSUER}/v1/keys
            user-name-attribute: sub

moku:
  oauth:
    desktop-client:
      id: desktop-client
      redirect-uri: holokai://home
      authorization-code-ttl: 60  # seconds
      access-token-ttl: 3600  # seconds (1 hour)
```

**Database Schema Requirements:**

```sql
-- Moku Users table
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- IDP Account Links
CREATE TABLE user_idp_accounts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  provider VARCHAR(50) NOT NULL,  -- 'google', 'microsoft', 'okta'
  provider_user_id VARCHAR(255) NOT NULL,  -- IDP's user ID (sub)
  provider_email VARCHAR(255),
  provider_refresh_token TEXT,  -- Optional: store IDP refresh token
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY unique_provider_account (provider, provider_user_id)
);

-- Moku Authorization Codes (temporary)
CREATE TABLE authorization_codes (
  code VARCHAR(255) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  client_id VARCHAR(255) NOT NULL,
  code_challenge VARCHAR(255) NOT NULL,
  redirect_uri VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Moku Refresh Tokens
CREATE TABLE refresh_tokens (
  token VARCHAR(255) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  client_id VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP,  -- NULL for no expiration
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Key Implementation Points:**

1. **User Linking:** Match users by email from IDP, create new users if needed
2. **Token Separation:** Desktop receives Moku tokens; IDP tokens are only used internally by Moku
3. **PKCE Validation:** Validate desktop's code_verifier against stored code_challenge
4. **Session Management:** Use server-side sessions to track desktop's PKCE parameters during IDP flow
5. **Error Handling:** Properly handle IDP authentication failures and redirect errors to desktop
6. **Security:** Never expose IDP tokens or credentials to desktop client

**Spring Security Configuration Example:**

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/oauth/**").permitAll()
                .anyRequest().authenticated()
            )
            .oauth2Login(oauth2 -> oauth2
                .authorizationEndpoint(authorization -> authorization
                    .baseUri("/api/oauth/authorize")
                )
                .redirectionEndpoint(redirection -> redirection
                    .baseUri("/api/oauth/callback/*")
                )
                .userInfoEndpoint(userInfo -> userInfo
                    .userService(customOAuth2UserService())
                )
                .successHandler(oAuth2AuthenticationSuccessHandler())
            );
        return http.build();
    }
    
    @Bean
    public OAuth2UserService<OAuth2UserRequest, OAuth2User> customOAuth2UserService() {
        return new CustomOAuth2UserService();
    }
    
    @Bean
    public AuthenticationSuccessHandler oAuth2AuthenticationSuccessHandler() {
        return new DesktopOAuth2SuccessHandler();
    }
}
```

---




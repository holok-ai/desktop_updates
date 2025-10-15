## 1. Overview 

## 2. Architecture Overview

### 2.1 High-Level Architecture

```
┌───────────────────────────────────────────────────────────┐
│                   ELECTRON MAIN PROCESS                   │
│                                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │  Application Lifecycle Manager                 │     │
│  │  - Window management                           │     │
│  │  - Auto-updater                                │     │
│  │  - Tray icon / Menu                            │     │
│  └────────────────────────────────────────────────┘     │
│                                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │  IPC Handler Layer                             │     │
│  │  - Authentication handlers                     │     │
│  │  - Thread management handlers                  │     │
│  │  - Settings handlers                           │     │
│  │  - File system operations                      │     │
│  └────────────────────────────────────────────────┘     │
│                                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │  Services Layer                                │     │
│  │  - AuthService (OAuth flow orchestration)      │     │
│  │  - MokuAPIClient (thread/message persistence)  │     │
│  │  - SecureStorageService (credentials)          │     │
│  │  - LoggingService (electron-log)               │     │
│  └────────────────────────────────────────────────┘     │
│                                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │  Data Persistence                              │     │
│  │  - Moku API (threads, messages via REST)       │     │
│  │  - Electron Store (app settings, preferences)  │     │
│  │  - Secure Storage (API keys, tokens)           │     │
│  └────────────────────────────────────────────────┘     │
│                                                           │
└──────────────────────┬───────────────────────────────────┘
                       │
                  IPC Bridge
                       │
┌──────────────────────▼───────────────────────────────────┐
│                 ELECTRON RENDERER PROCESS                 │
│                                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │  Angular 18 UI Components                      │     │
│  │  - LoginScreenComponent                        │     │
│  │  - ThreadListComponent                         │     │
│  │  - ChatWindowComponent (reused from lib)       │     │
│  │  - ModelSelectorComponent                      │     │
│  │  - SidebarComponent                            │     │
│  └────────────────────────────────────────────────┘     │
│                                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │  State Management (NgRx Signals)               │     │
│  │  - AuthStore (user, isAuthenticated)           │     │
│  │  - ThreadsStore (thread list, active thread)   │     │
│  │  - ModelsStore (available models, selected)    │     │
│  └────────────────────────────────────────────────┘     │
│                                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │  Business Logic (from chat-component)          │     │
│  │  - ChatService                                 │     │
│  │  - ChatProviderFactory                         │     │
│  │  - Provider implementations                    │     │
│  │    • ClaudeChatProvider                        │     │
│  │    • OpenAIChatProvider                        │     │
│  │    • OllamaChatProvider                        │     │
│  └────────────────────────────────────────────────┘     │
│                                                           │
└───────────────────────────────────────────────────────────┘
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

## 4. Worker Process Design

### 4.1 Context Bridge for Method and Data Definition

The worker will use a ContextBridge with groupings to logically organize features into categories as shown below:

```typescript
// preload/index.ts
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
// main/ipc/handlers.ts
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

## 5.1.1  Service Wrappers 

Service wrappers are thin Angular services that directly correspond to IPC domains (auth, threads, models) from the Contect Bridge. Each service method wraps exactly one IPC call with type safety, error handling, and retry logic. Service wrappers are used for CRUD operations, simple actions and small sets of method calls. 

## 5.1.2  Facade plus Service Wrappers 

For complex service interaction, a Facade should be used. Facades orchestrate multiple service wrappers to handle complex multi-step workflows, coordinating timing, error recovery, and state management across several operations behind a simplified API.

# 6. Auditting and Local Logging

Implement two types of logging: 
auditting - uses the Holo audit service 
local logging - logs startup, loading, configuration, communication and fatal errors 

## 6.1 Auditting

Write events and actions to the Holokai Holo Audit Q. These include:
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

Use `electron-log` for logging in both main and renderer processes: `import log from 'electron-log'`.

Log levels should be used appropriately: `log.error()` for errors, `log.warn()` for warnings, `log.info()` for general info, `log.debug()` for verbose output.

Always sanitize sensitive data before logging: `log.info('User logged in', { userId: user.id })` (never log tokens or passwords).

**Never write sensitive data to logs**, including API keys, tokens, passwords, personal identifying information, or full request/response bodies containing sensitive fields.

Include context objects for structured logging: `log.error('API call failed', { endpoint, statusCode, error })`.

Log files are automatically managed by electron-log and stored in the OS-specific app data directory.

---

## 7. Security Considerations

### 7.1 Security Checklist

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

### 7.2 Electron Security Configuration

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

### 7.3 Data Protection

**Sensitive Data Handling:**
- API keys never passed through renderer process
- Tokens stored encrypted in main process only
- Passwords never logged or persisted
- PII handled according to privacy policy
- All sensitive operations logged without exposing secrets

**Dependencies:** Electron safeStorage, electron-log

---




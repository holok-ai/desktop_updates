# Desktop Core Requirements

**Date:** 2025-11-25
**Status:** Requirements Definition
**Purpose:** Define foundational desktop application requirements including authentication, security, and platform services integration

## Executive Summary

This document defines the core infrastructure requirements for Holokai Desktop:

1. **Authentication** - SSO via exchange code flow, token management
2. **Security** - Token storage, encryption, secure IPC
3. **Platform Integration** - Holo, Moku, and Storage Service connections
4. **Offline Support** - Graceful degradation when services unavailable
5. **Updates** - Auto-update mechanism
6. **Notifications** - System notifications for events and alerts
7. **State Persistence** - Window state, user preferences
8. **Deep Linking** - Protocol handling for various app actions

### Relationship to Existing Documents

| Document | Relationship |
|----------|--------------|
| `ai/revised-sso.md` | SSO flow (incorporated here) |
| `ai/desktop-system-architecture.md` | System architecture context |
| `thread-loading-caching-requirements-2025-11-25.md` | Cache architecture |
| `project-requirements-2025-11-25.md` | Project and collaboration features |

---

## 1. Authentication

### 1.1 SSO Exchange Code Flow

Desktop authenticates via browser-based SSO with a one-time exchange code:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SSO EXCHANGE CODE FLOW                                    │
│                                                                              │
│  1. Desktop detects no token                                                │
│  2. Desktop spawns browser → moku.holokai.app/login/desktop                 │
│  3. User authenticates via OAuth2 (Google, Microsoft, etc.)                 │
│  4. Moku Web generates exchange code (one-time, 5 min TTL)                  │
│  5. Moku Web redirects → holokai://home?code=xyz                            │
│  6. Desktop extracts code, calls POST /api/auth/exchange-code               │
│  7. Desktop receives apiKey, calls POST /api/auth/token/refresh             │
│  8. Desktop stores accessToken securely                                      │
│  9. Desktop uses accessToken for all API calls                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Authentication Sequence

```typescript
class AuthService {
  async initiateLogin(): Promise<void> {
    // 1. Generate state for CSRF protection
    const state = crypto.randomUUID();
    await this.storeState(state);

    // 2. Open browser to Moku login
    const loginUrl = `${MOKU_WEB_URL}/login/desktop?state=${state}`;
    shell.openExternal(loginUrl);

    // 3. Wait for protocol callback (holokai://home?code=xyz&state=abc)
  }

  async handleCallback(url: string): Promise<void> {
    const params = new URL(url).searchParams;
    const code = params.get('code');
    const state = params.get('state');

    // 4. Verify state matches
    if (!await this.verifyState(state)) {
      throw new Error('Invalid state - possible CSRF attack');
    }

    // 5. Exchange code for apiKey
    const { apiKey } = await this.mokuAPI.exchangeCode(code);

    // 6. Refresh to get accessToken with app permissions
    const { accessToken, expiresAt } = await this.mokuAPI.refreshToken(apiKey);

    // 7. Store securely
    await this.tokenStore.save({
      accessToken,
      apiKey,
      expiresAt
    });
  }
}
```

### 1.3 Custom Protocol Registration

Desktop registers `holokai://` protocol handler:

```typescript
// Main process - app startup
if (process.defaultApp) {
  app.setAsDefaultProtocolClient('holokai', process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient('holokai');
}

// Handle protocol callback
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (url.startsWith('holokai://home')) {
    authService.handleCallback(url);
  }
});

// Windows: handle second instance
app.on('second-instance', (event, commandLine) => {
  const url = commandLine.find(arg => arg.startsWith('holokai://'));
  if (url) {
    authService.handleCallback(url);
  }
});
```

### 1.4 Token Management

```typescript
interface TokenData {
  accessToken: string;       // JWT for API calls
  apiKey: string;            // For refresh operations
  expiresAt: number;         // Epoch ms
  userId: string;            // Extracted from token
  organizationId?: string;   // If org member
}

class TokenStore {
  // Uses Electron safeStorage for encryption
  async save(data: TokenData): Promise<void>;
  async load(): Promise<TokenData | null>;
  async clear(): Promise<void>;

  isExpired(data: TokenData): boolean {
    // Consider expired 5 minutes before actual expiry
    return Date.now() > data.expiresAt - (5 * 60 * 1000);
  }
}
```

### 1.5 Token Refresh

```typescript
class TokenRefreshService {
  private refreshTimer: NodeJS.Timeout | null = null;

  async startAutoRefresh(): Promise<void> {
    const token = await this.tokenStore.load();
    if (!token) return;

    // Schedule refresh 10 minutes before expiry
    const refreshAt = token.expiresAt - (10 * 60 * 1000);
    const delay = Math.max(0, refreshAt - Date.now());

    this.refreshTimer = setTimeout(() => this.refresh(), delay);
  }

  private async refresh(): Promise<void> {
    try {
      const token = await this.tokenStore.load();
      const { accessToken, expiresAt } = await this.mokuAPI.refreshToken(token.apiKey);

      await this.tokenStore.save({
        ...token,
        accessToken,
        expiresAt
      });

      // Schedule next refresh
      this.startAutoRefresh();
    } catch (error) {
      // If refresh fails, trigger re-login
      this.eventBus.emit('auth:expired');
    }
  }

  stop(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
```

### 1.6 Logout

```typescript
async function logout(): Promise<void> {
  // 1. Clear local token
  await tokenStore.clear();

  // 2. Clear caches
  await threadCache.clearAll();
  await projectCache.clearAll();
  await fileCache.clearAll();

  // 3. Stop background services
  tokenRefreshService.stop();
  pollingService.stop();

  // 4. Navigate to login screen
  window.location.href = '/login';

  // 5. Optionally revoke token on server
  // await mokuAPI.revokeToken(token.apiKey);
}
```

### 1.7 Authentication API Endpoints

| Endpoint | Method | Input | Output | Notes |
|----------|--------|-------|--------|-------|
| `/api/auth/apiKey` | GET | None | `{ apiKey }` | Existing; requires auth |
| `/api/auth/generate-exchange-code` | POST | `{ apiKey }` | `{ code }` | New; 5 min TTL |
| `/api/auth/exchange-code` | POST | `{ code }` | `{ apiKey }` | New; one-time use |
| `/api/auth/token/refresh` | POST | `{ apiKey }` | `{ accessToken, expiresAt }` | Existing |

---

## 2. Security

### 2.1 Token Storage

Tokens stored using Electron's safeStorage API (OS keychain integration):

```typescript
import { safeStorage } from 'electron';

class SecureTokenStore {
  private readonly storePath: string;

  async save(data: TokenData): Promise<void> {
    const json = JSON.stringify(data);
    const encrypted = safeStorage.encryptString(json);
    await fs.writeFile(this.storePath, encrypted);
  }

  async load(): Promise<TokenData | null> {
    try {
      const encrypted = await fs.readFile(this.storePath);
      const json = safeStorage.decryptString(encrypted);
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    await fs.unlink(this.storePath).catch(() => {});
  }
}
```

### 2.2 Local Data Encryption

All sensitive local data encrypted at rest:

| Data Type | Encryption | Key Management |
|-----------|------------|----------------|
| Access tokens | safeStorage (OS keychain) | OS-managed |
| Thread messages | AES-256-GCM | Derived from user key |
| Cached files | AES-256-GCM | Derived from user key |
| Local settings | None (not sensitive) | N/A |

```typescript
class EncryptionService {
  private key: Buffer | null = null;

  async initialize(userId: string): Promise<void> {
    // Derive encryption key from user-specific data
    const keyMaterial = await safeStorage.decryptString(
      await this.loadKeyMaterial()
    );
    this.key = crypto.pbkdf2Sync(
      keyMaterial,
      userId,
      100000,
      32,
      'sha256'
    );
  }

  encrypt(data: Buffer): Buffer {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
  }

  decrypt(data: Buffer): Buffer {
    const iv = data.subarray(0, 16);
    const authTag = data.subarray(16, 32);
    const encrypted = data.subarray(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }
}
```

### 2.3 IPC Security

Secure communication between main and renderer processes:

```typescript
// Main process - expose only specific APIs
contextBridge.exposeInMainWorld('api', {
  // Auth
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getUser: () => ipcRenderer.invoke('auth:getUser'),

  // Threads
  getThreads: (params) => ipcRenderer.invoke('threads:list', params),
  getThread: (id) => ipcRenderer.invoke('threads:get', id),
  createThread: (data) => ipcRenderer.invoke('threads:create', data),

  // Projects
  getProjects: () => ipcRenderer.invoke('projects:list'),
  // ... etc
});

// Renderer cannot access Node.js APIs directly
// contextIsolation: true, nodeIntegration: false
```

### 2.4 Content Security Policy

```typescript
// Main window CSP
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",  // For Svelte/Tailwind
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.holokai.com wss://*.holokai.com",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'"
].join('; ');

mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [csp]
    }
  });
});
```

---

## 3. Platform Services Integration

### 3.1 Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PLATFORM SERVICES                                    │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │    HOLO API      │  │    MOKU API      │  │  STORAGE SERVICE │          │
│  │  (Chat/Prompts)  │  │   (Management)   │  │     (Files)      │          │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤          │
│  │ • Prompt routing │  │ • Users/Orgs     │  │ • File upload    │          │
│  │ • Streaming      │  │ • Projects       │  │ • Presigned URLs │          │
│  │ • Audit logging  │  │ • Threads        │  │ • Access control │          │
│  │                  │  │ • Workflows      │  │                  │          │
│  │                  │  │ • Insights       │  │                  │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│           │                     │                     │                     │
│           └─────────────────────┼─────────────────────┘                     │
│                                 │                                            │
│                    ┌────────────┴────────────┐                              │
│                    │     DESKTOP APP         │                              │
│                    │  (Electron + Svelte)    │                              │
│                    └─────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 API Client Configuration

```typescript
interface ServiceConfig {
  holo: {
    baseUrl: string;      // https://holo.holokai.com
    timeout: number;      // 120000ms for streaming
  };
  moku: {
    baseUrl: string;      // https://moku.holokai.com
    timeout: number;      // 30000ms
  };
  storage: {
    baseUrl: string;      // https://storage.holokai.com
    timeout: number;      // 60000ms for uploads
  };
}

// Environment-based configuration
const config: ServiceConfig = {
  holo: {
    baseUrl: process.env.HOLO_API_URL || 'https://holo.holokai.com',
    timeout: 120000
  },
  moku: {
    baseUrl: process.env.MOKU_API_URL || 'https://moku.holokai.com',
    timeout: 30000
  },
  storage: {
    baseUrl: process.env.STORAGE_API_URL || 'https://storage.holokai.com',
    timeout: 60000
  }
};
```

### 3.3 Base API Client

```typescript
class ApiClient {
  constructor(
    private config: { baseUrl: string; timeout: number },
    private tokenStore: TokenStore
  ) {}

  async request<T>(
    method: string,
    path: string,
    options?: RequestOptions
  ): Promise<T> {
    const token = await this.tokenStore.load();
    if (!token) {
      throw new AuthError('No token available');
    }

    if (this.tokenStore.isExpired(token)) {
      throw new AuthError('Token expired');
    }

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
        ...options?.headers
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(this.config.timeout)
    });

    if (response.status === 401) {
      this.eventBus.emit('auth:expired');
      throw new AuthError('Unauthorized');
    }

    if (!response.ok) {
      throw new ApiError(response.status, await response.text());
    }

    return response.json();
  }

  async stream(
    path: string,
    body: unknown,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    // SSE streaming for Holo API responses
  }
}
```

### 3.4 Service Clients

```typescript
// Holo API Client
class HoloApiClient extends ApiClient {
  async prompt(request: PromptRequest): Promise<PromptResponse>;
  async streamPrompt(request: PromptRequest, onChunk: (text: string) => void): Promise<void>;
}

// Moku API Client
class MokuApiClient extends ApiClient {
  // Auth
  async exchangeCode(code: string): Promise<{ apiKey: string }>;
  async refreshToken(apiKey: string): Promise<{ accessToken: string; expiresAt: number }>;

  // Threads
  async getThreads(params?: ThreadListParams): Promise<PaginatedResponse<Thread>>;
  async getThread(id: string): Promise<Thread>;
  async createThread(data: CreateThreadRequest): Promise<Thread>;
  async updateThread(id: string, data: UpdateThreadRequest): Promise<Thread>;
  async deleteThread(id: string): Promise<void>;
  async moveThread(id: string, target: MoveTarget): Promise<Thread>;

  // Projects
  async getProjects(): Promise<Project[]>;
  async getProject(id: string): Promise<Project>;
  async createProject(data: CreateProjectRequest): Promise<Project>;
  // ... etc

  // Workflows
  async getWorkflows(params?: WorkflowListParams): Promise<Workflow[]>;
  // ... etc

  // Insights
  async getDashboard(): Promise<DashboardData>;
  // ... etc
}

// Storage Service Client
class StorageApiClient extends ApiClient {
  async getUploadUrl(projectId: string, threadId: string, file: FileMetadata): Promise<UploadUrlResponse>;
  async confirmUpload(fileId: string): Promise<void>;
  async getDownloadUrl(fileId: string): Promise<DownloadUrlResponse>;
  async deleteFile(fileId: string): Promise<void>;
  async listFiles(projectId: string, threadId?: string): Promise<ProjectFile[]>;
  async getStorageStats(projectId: string): Promise<StorageStats>;
}
```

---

## 4. Offline Support

### 4.1 Offline Capabilities

| Feature | Offline Behavior |
|---------|------------------|
| View personal threads | Full access (local cache) |
| View personal messages | Full access (local cache) |
| Create new prompts | Queued for sync |
| View project threads | Cached data only |
| View project messages | Cached data only |
| Create project content | Blocked (requires sync) |
| Upload files | Queued for sync |
| View cached files | Full access |

### 4.2 Connection State Management

```typescript
type ConnectionState = 'online' | 'offline' | 'degraded';

class ConnectionManager {
  private state: ConnectionState = 'online';
  private checkInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    // Initial check
    await this.checkConnections();

    // Periodic health check
    this.checkInterval = setInterval(() => this.checkConnections(), 30000);

    // Listen for network changes
    window.addEventListener('online', () => this.checkConnections());
    window.addEventListener('offline', () => this.setState('offline'));
  }

  private async checkConnections(): Promise<void> {
    if (!navigator.onLine) {
      this.setState('offline');
      return;
    }

    try {
      const results = await Promise.allSettled([
        this.pingService('holo'),
        this.pingService('moku'),
        this.pingService('storage')
      ]);

      const allOk = results.every(r => r.status === 'fulfilled');
      const someOk = results.some(r => r.status === 'fulfilled');

      if (allOk) {
        this.setState('online');
      } else if (someOk) {
        this.setState('degraded');
      } else {
        this.setState('offline');
      }
    } catch {
      this.setState('offline');
    }
  }

  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.eventBus.emit('connection:changed', state);
    }
  }

  getState(): ConnectionState {
    return this.state;
  }
}
```

### 4.3 Offline Queue

```typescript
interface QueuedAction {
  id: string;
  type: 'prompt' | 'upload' | 'update';
  data: unknown;
  createdAt: number;
  retryCount: number;
}

class OfflineQueue {
  private queue: QueuedAction[] = [];

  async add(action: Omit<QueuedAction, 'id' | 'createdAt' | 'retryCount'>): Promise<string> {
    const item: QueuedAction = {
      ...action,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      retryCount: 0
    };
    this.queue.push(item);
    await this.persist();
    return item.id;
  }

  async processQueue(): Promise<void> {
    if (this.connectionManager.getState() === 'offline') {
      return;
    }

    for (const action of this.queue) {
      try {
        await this.processAction(action);
        await this.remove(action.id);
      } catch (error) {
        action.retryCount++;
        if (action.retryCount >= 3) {
          await this.remove(action.id);
          this.eventBus.emit('queue:failed', action);
        }
      }
    }
  }

  private async processAction(action: QueuedAction): Promise<void> {
    switch (action.type) {
      case 'prompt':
        await this.holoAPI.prompt(action.data as PromptRequest);
        break;
      case 'upload':
        await this.storageAPI.upload(action.data as UploadRequest);
        break;
      // ... etc
    }
  }
}
```

### 4.4 UI Indicators

```svelte
<!-- Connection status indicator -->
{#if connectionState === 'offline'}
  <div class="status-bar offline">
    Offline - Some features unavailable
  </div>
{:else if connectionState === 'degraded'}
  <div class="status-bar degraded">
    Limited connectivity - Some services unavailable
  </div>
{/if}

<!-- Queued actions indicator -->
{#if queuedCount > 0}
  <div class="queue-indicator">
    {queuedCount} pending {queuedCount === 1 ? 'action' : 'actions'}
  </div>
{/if}
```

---

## 5. Auto-Update

### 5.1 Update Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTO-UPDATE FLOW                                     │
│                                                                              │
│  1. App checks for updates on startup (and periodically)                    │
│  2. If update available, download in background                              │
│  3. Show notification to user                                                │
│  4. User chooses: Install Now or Install on Quit                            │
│  5. App restarts with new version                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Update Configuration

```typescript
import { autoUpdater } from 'electron-updater';

class UpdateService {
  initialize(): void {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      this.eventBus.emit('update:checking');
    });

    autoUpdater.on('update-available', (info) => {
      this.eventBus.emit('update:available', info);
    });

    autoUpdater.on('update-not-available', () => {
      this.eventBus.emit('update:not-available');
    });

    autoUpdater.on('download-progress', (progress) => {
      this.eventBus.emit('update:progress', progress);
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.eventBus.emit('update:ready', info);
      this.showUpdateNotification(info);
    });

    autoUpdater.on('error', (error) => {
      this.eventBus.emit('update:error', error);
    });
  }

  async checkForUpdates(): Promise<void> {
    await autoUpdater.checkForUpdates();
  }

  installNow(): void {
    autoUpdater.quitAndInstall(false, true);
  }

  private showUpdateNotification(info: UpdateInfo): void {
    new Notification({
      title: 'Update Ready',
      body: `Version ${info.version} is ready to install`
    }).show();
  }
}
```

### 5.3 Update Settings

```typescript
interface UpdateSettings {
  autoCheck: boolean;           // Check on startup
  checkInterval: number;        // Hours between checks (default 24)
  autoDownload: boolean;        // Download without asking
  autoInstallOnQuit: boolean;   // Install when app closes
  channel: 'stable' | 'beta';   // Update channel
}
```

---

## 6. Application Lifecycle

### 6.1 Startup Sequence

```typescript
async function bootstrap(): Promise<void> {
  // 1. Initialize logging
  await logger.initialize();

  // 2. Load configuration
  await config.load();

  // 3. Initialize secure storage
  await secureStorage.initialize();

  // 4. Check for updates
  updateService.checkForUpdates();

  // 5. Load authentication state
  const token = await tokenStore.load();

  if (token && !tokenStore.isExpired(token)) {
    // 6a. Valid token - initialize services
    await initializeServices(token);
    await createMainWindow('/home');
  } else {
    // 6b. No token or expired - show login
    await createMainWindow('/login');
  }

  // 7. Start background services
  tokenRefreshService.startAutoRefresh();
  connectionManager.initialize();
}

async function initializeServices(token: TokenData): Promise<void> {
  // Initialize encryption with user context
  await encryptionService.initialize(token.userId);

  // Initialize API clients
  holoAPI.setToken(token.accessToken);
  mokuAPI.setToken(token.accessToken);
  storageAPI.setToken(token.accessToken);

  // Load cached data
  await threadCache.initialize();
  await projectCache.initialize();
}
```

### 6.2 Shutdown Sequence

```typescript
app.on('before-quit', async (event) => {
  event.preventDefault();

  // 1. Stop background services
  tokenRefreshService.stop();
  pollingService.stop();
  connectionManager.stop();

  // 2. Persist any pending data
  await threadCache.flush();
  await offlineQueue.persist();

  // 3. Close database connections
  await database.close();

  // 4. Allow quit
  app.exit(0);
});
```

---

## 7. Error Handling

### 7.1 Global Error Handler

```typescript
class ErrorHandler {
  handle(error: Error, context?: string): void {
    // Log error
    logger.error(error.message, {
      stack: error.stack,
      context
    });

    // Categorize and respond
    if (error instanceof AuthError) {
      this.handleAuthError(error);
    } else if (error instanceof NetworkError) {
      this.handleNetworkError(error);
    } else if (error instanceof ApiError) {
      this.handleApiError(error);
    } else {
      this.handleUnknownError(error);
    }
  }

  private handleAuthError(error: AuthError): void {
    // Clear token and redirect to login
    tokenStore.clear();
    this.eventBus.emit('auth:expired');
  }

  private handleNetworkError(error: NetworkError): void {
    // Show offline indicator
    this.eventBus.emit('connection:error', error.message);
  }

  private handleApiError(error: ApiError): void {
    // Show user-friendly error message
    this.eventBus.emit('error:api', {
      status: error.status,
      message: this.getUserMessage(error)
    });
  }
}
```

### 7.2 Error Types

```typescript
class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

class NetworkError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'NetworkError';
  }
}

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`API Error ${status}: ${body}`);
    this.name = 'ApiError';
  }
}
```

---

## 8. Notifications

### 8.1 Notification Types

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NOTIFICATION SYSTEM                                  │
│                                                                              │
│  SYSTEM NOTIFICATIONS (OS-level)                                            │
│  ─────────────────────────────────                                          │
│  • Update ready to install                                                   │
│  • Workflow completed (background)                                           │
│  • Project invitation received                                               │
│  • Offline queue processed                                                   │
│                                                                              │
│  IN-APP NOTIFICATIONS (Toast/Banner)                                        │
│  ────────────────────────────────────                                        │
│  • Connection status changes                                                 │
│  • Prompt completed (when app backgrounded)                                  │
│  • File upload/download complete                                             │
│  • Error messages                                                            │
│  • Project member activity (new thread, new message)                        │
│                                                                              │
│  BADGE NOTIFICATIONS                                                         │
│  ────────────────────                                                        │
│  • Unread project updates (dock/taskbar badge)                              │
│  • Pending queue items                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Notification Data Model

```typescript
interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  action?: NotificationAction;
  metadata?: Record<string, unknown>;
}

type NotificationType =
  | 'update'           // App update available/ready
  | 'workflow'         // Workflow execution complete
  | 'project'          // Project invitation, member activity
  | 'sync'             // Offline queue processed
  | 'prompt'           // Prompt response ready
  | 'file'             // Upload/download complete
  | 'error'            // Error occurred
  | 'connection';      // Connection status change

interface NotificationAction {
  label: string;
  action: string;      // IPC action to invoke
  payload?: unknown;
}
```

### 8.3 Notification Service

```typescript
class NotificationService {
  private history: AppNotification[] = [];
  private readonly maxHistory = 100;

  // System notification (OS-level)
  async showSystemNotification(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): Promise<void> {
    const n = new Notification({
      title: notification.title,
      body: notification.body,
      silent: false
    });

    if (notification.action) {
      n.on('click', () => {
        this.handleAction(notification.action!);
        mainWindow?.focus();
      });
    }

    n.show();
    this.addToHistory(notification);
  }

  // In-app toast notification
  showToast(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): void {
    this.eventBus.emit('notification:toast', notification);
    this.addToHistory(notification);
  }

  // Badge count (dock/taskbar)
  setBadgeCount(count: number): void {
    if (process.platform === 'darwin') {
      app.dock.setBadge(count > 0 ? count.toString() : '');
    } else if (process.platform === 'win32') {
      mainWindow?.setOverlayIcon(
        count > 0 ? this.createBadgeIcon(count) : null,
        count > 0 ? `${count} notifications` : ''
      );
    }
  }

  // Get notification history
  getHistory(): AppNotification[] {
    return this.history;
  }

  // Mark as read
  markRead(id: string): void {
    const notification = this.history.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.updateBadgeCount();
    }
  }

  // Mark all as read
  markAllRead(): void {
    this.history.forEach(n => n.read = true);
    this.setBadgeCount(0);
  }

  private addToHistory(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): void {
    this.history.unshift({
      ...notification,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      read: false
    });

    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory);
    }

    this.updateBadgeCount();
  }

  private updateBadgeCount(): void {
    const unread = this.history.filter(n => !n.read).length;
    this.setBadgeCount(unread);
  }

  private handleAction(action: NotificationAction): void {
    this.eventBus.emit(`notification:action:${action.action}`, action.payload);
  }
}
```

### 8.4 Notification Settings

```typescript
interface NotificationSettings {
  enabled: boolean;                    // Master toggle
  systemNotifications: boolean;        // OS-level notifications
  sound: boolean;                      // Play sound

  // Per-type settings
  types: {
    update: boolean;
    workflow: boolean;
    project: boolean;
    sync: boolean;
    prompt: boolean;
    file: boolean;
    error: boolean;
    connection: boolean;
  };

  // Quiet hours
  quietHours: {
    enabled: boolean;
    start: string;    // "22:00"
    end: string;      // "08:00"
  };
}
```

### 8.5 In-App Toast Component

```svelte
<!-- Toast notification container -->
<div class="toast-container">
  {#each toasts as toast (toast.id)}
    <div
      class="toast toast-{toast.type}"
      transition:fly={{ y: -20, duration: 200 }}
    >
      <div class="toast-content">
        <strong>{toast.title}</strong>
        <p>{toast.body}</p>
      </div>
      {#if toast.action}
        <button on:click={() => handleAction(toast)}>
          {toast.action.label}
        </button>
      {/if}
      <button class="close" on:click={() => dismiss(toast.id)}>×</button>
    </div>
  {/each}
</div>

<script>
  let toasts: AppNotification[] = [];

  eventBus.on('notification:toast', (notification) => {
    toasts = [...toasts, notification];

    // Auto-dismiss after 5 seconds (unless error)
    if (notification.type !== 'error') {
      setTimeout(() => dismiss(notification.id), 5000);
    }
  });

  function dismiss(id: string) {
    toasts = toasts.filter(t => t.id !== id);
  }
</script>
```

---

## 9. State Persistence

### 9.1 Persisted State Categories

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STATE PERSISTENCE                                    │
│                                                                              │
│  WINDOW STATE                          USER PREFERENCES                      │
│  ────────────                          ────────────────                      │
│  • Position (x, y)                     • Theme (light/dark/system)          │
│  • Size (width, height)                • Font size                           │
│  • Maximized state                     • Notification settings               │
│  • Display (multi-monitor)             • Default model                       │
│  • Sidebar collapsed                   • Auto-save drafts                    │
│                                        • Keyboard shortcuts                  │
│                                                                              │
│  APPLICATION STATE                     CACHE SETTINGS                        │
│  ─────────────────                     ──────────────                        │
│  • Last active project                 • Max cache size                      │
│  • Last active thread                  • Cache eviction days                 │
│  • Recent files                        • Offline queue retention             │
│  • Search history                                                            │
│  • Model usage history                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 State Data Models

```typescript
interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isFullScreen: boolean;
  displayId?: string;         // For multi-monitor
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  sidebarCollapsed: boolean;
  defaultModel?: string;
  autoSaveDrafts: boolean;
  notifications: NotificationSettings;
  shortcuts: Record<string, string>;   // action -> keybinding
}

interface ApplicationState {
  lastProjectId?: string;
  lastThreadId?: string;
  recentFiles: RecentFile[];
  searchHistory: string[];
  modelHistory: string[];       // Recently used models
  sidebarWidth: number;
}

interface RecentFile {
  path: string;
  name: string;
  accessedAt: number;
}

interface PersistedState {
  window: WindowState;
  preferences: UserPreferences;
  application: ApplicationState;
  version: number;              // For migrations
}
```

### 9.3 State Store

```typescript
class StateStore {
  private state: PersistedState;
  private readonly storePath: string;
  private saveDebounce: NodeJS.Timeout | null = null;

  constructor() {
    this.storePath = path.join(app.getPath('userData'), 'state.json');
    this.state = this.loadOrDefault();
  }

  private loadOrDefault(): PersistedState {
    try {
      const data = fs.readFileSync(this.storePath, 'utf-8');
      const state = JSON.parse(data);
      return this.migrate(state);
    } catch {
      return this.getDefaultState();
    }
  }

  private getDefaultState(): PersistedState {
    return {
      window: {
        width: 1200,
        height: 800,
        isMaximized: false,
        isFullScreen: false
      },
      preferences: {
        theme: 'system',
        fontSize: 'medium',
        sidebarCollapsed: false,
        autoSaveDrafts: true,
        notifications: {
          enabled: true,
          systemNotifications: true,
          sound: true,
          types: {
            update: true,
            workflow: true,
            project: true,
            sync: true,
            prompt: true,
            file: true,
            error: true,
            connection: true
          },
          quietHours: { enabled: false, start: '22:00', end: '08:00' }
        },
        shortcuts: {}
      },
      application: {
        recentFiles: [],
        searchHistory: [],
        modelHistory: [],
        sidebarWidth: 280
      },
      version: 1
    };
  }

  // Get state
  get<K extends keyof PersistedState>(key: K): PersistedState[K] {
    return this.state[key];
  }

  // Update state (partial)
  set<K extends keyof PersistedState>(key: K, value: Partial<PersistedState[K]>): void {
    this.state[key] = { ...this.state[key], ...value };
    this.scheduleSave();
  }

  // Debounced save to disk
  private scheduleSave(): void {
    if (this.saveDebounce) {
      clearTimeout(this.saveDebounce);
    }
    this.saveDebounce = setTimeout(() => this.save(), 1000);
  }

  private save(): void {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.state, null, 2));
    } catch (error) {
      logger.error('Failed to save state', { error });
    }
  }

  // Force immediate save (on quit)
  flush(): void {
    if (this.saveDebounce) {
      clearTimeout(this.saveDebounce);
    }
    this.save();
  }

  private migrate(state: PersistedState): PersistedState {
    // Handle state migrations between versions
    const current = this.getDefaultState();

    if (state.version < current.version) {
      // Merge with defaults to add new fields
      return {
        ...current,
        ...state,
        window: { ...current.window, ...state.window },
        preferences: { ...current.preferences, ...state.preferences },
        application: { ...current.application, ...state.application },
        version: current.version
      };
    }

    return state;
  }
}
```

### 9.4 Window State Management

```typescript
class WindowManager {
  private mainWindow: BrowserWindow | null = null;

  createMainWindow(route: string): BrowserWindow {
    const windowState = stateStore.get('window');

    this.mainWindow = new BrowserWindow({
      x: windowState.x,
      y: windowState.y,
      width: windowState.width,
      height: windowState.height,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    // Restore maximized state
    if (windowState.isMaximized) {
      this.mainWindow.maximize();
    }

    // Track window state changes
    this.mainWindow.on('resize', () => this.saveWindowState());
    this.mainWindow.on('move', () => this.saveWindowState());
    this.mainWindow.on('maximize', () => this.saveWindowState());
    this.mainWindow.on('unmaximize', () => this.saveWindowState());

    // Validate window is on a visible display
    this.ensureWindowVisible();

    this.mainWindow.loadURL(`file://${__dirname}/index.html#${route}`);
    return this.mainWindow;
  }

  private saveWindowState(): void {
    if (!this.mainWindow) return;

    const bounds = this.mainWindow.getBounds();
    const isMaximized = this.mainWindow.isMaximized();
    const isFullScreen = this.mainWindow.isFullScreen();

    // Only save bounds if not maximized/fullscreen
    if (!isMaximized && !isFullScreen) {
      stateStore.set('window', {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized,
        isFullScreen
      });
    } else {
      stateStore.set('window', { isMaximized, isFullScreen });
    }
  }

  private ensureWindowVisible(): void {
    if (!this.mainWindow) return;

    const bounds = this.mainWindow.getBounds();
    const displays = screen.getAllDisplays();

    // Check if window is visible on any display
    const isVisible = displays.some(display => {
      const { x, y, width, height } = display.bounds;
      return (
        bounds.x >= x &&
        bounds.y >= y &&
        bounds.x + bounds.width <= x + width &&
        bounds.y + bounds.height <= y + height
      );
    });

    // If not visible, center on primary display
    if (!isVisible) {
      this.mainWindow.center();
    }
  }
}
```

### 9.5 Preferences IPC

```typescript
// Expose preferences to renderer
contextBridge.exposeInMainWorld('preferences', {
  get: () => ipcRenderer.invoke('preferences:get'),
  set: (prefs: Partial<UserPreferences>) => ipcRenderer.invoke('preferences:set', prefs),
  getTheme: () => ipcRenderer.invoke('preferences:getTheme'),
  setTheme: (theme: 'light' | 'dark' | 'system') => ipcRenderer.invoke('preferences:setTheme', theme),
  onThemeChanged: (callback: (theme: string) => void) => {
    ipcRenderer.on('preferences:themeChanged', (_, theme) => callback(theme));
  }
});

// Main process handlers
ipcMain.handle('preferences:get', () => stateStore.get('preferences'));

ipcMain.handle('preferences:set', (_, prefs: Partial<UserPreferences>) => {
  stateStore.set('preferences', prefs);
});

ipcMain.handle('preferences:setTheme', (_, theme: 'light' | 'dark' | 'system') => {
  stateStore.set('preferences', { theme });

  // Apply theme
  const effectiveTheme = theme === 'system'
    ? nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    : theme;

  mainWindow?.webContents.send('preferences:themeChanged', effectiveTheme);
});
```

---

## 10. Deep Linking

### 10.1 Supported Deep Link Routes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DEEP LINK ROUTES                                     │
│                                                                              │
│  holokai://                                                                  │
│  ├── home                              → Open app / home screen             │
│  ├── home?code=xyz&state=abc           → SSO callback                       │
│  ├── thread/{threadId}                 → Open specific thread               │
│  ├── project/{projectId}               → Open specific project              │
│  ├── project/{projectId}/thread/{id}   → Open thread in project context    │
│  ├── workflow/{workflowId}             → Open workflow                      │
│  ├── workflow/{workflowId}/run         → Run workflow                       │
│  ├── invite/{inviteCode}               → Accept project invitation          │
│  └── settings                          → Open settings                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Deep Link Handler

```typescript
class DeepLinkHandler {
  private pendingUrl: string | null = null;

  initialize(): void {
    // Handle protocol on macOS
    app.on('open-url', (event, url) => {
      event.preventDefault();
      this.handleUrl(url);
    });

    // Handle protocol on Windows (second instance)
    app.on('second-instance', (event, commandLine) => {
      const url = commandLine.find(arg => arg.startsWith('holokai://'));
      if (url) {
        this.handleUrl(url);
      }
      // Focus existing window
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    // Check launch args for deep link
    const launchUrl = process.argv.find(arg => arg.startsWith('holokai://'));
    if (launchUrl) {
      this.pendingUrl = launchUrl;
    }
  }

  // Process pending URL after app is ready
  processPending(): void {
    if (this.pendingUrl) {
      this.handleUrl(this.pendingUrl);
      this.pendingUrl = null;
    }
  }

  private handleUrl(url: string): void {
    try {
      const parsed = new URL(url);
      const path = parsed.hostname + parsed.pathname;
      const params = Object.fromEntries(parsed.searchParams);

      this.route(path, params);
    } catch (error) {
      logger.error('Invalid deep link URL', { url, error });
    }
  }

  private route(path: string, params: Record<string, string>): void {
    // SSO callback
    if (path === 'home' && params.code) {
      authService.handleCallback(`holokai://home?code=${params.code}&state=${params.state}`);
      return;
    }

    // Ensure authenticated for other routes
    if (!authService.isAuthenticated()) {
      // Store intended destination, redirect to login
      stateStore.set('application', { pendingDeepLink: { path, params } });
      this.navigateTo('/login');
      return;
    }

    // Route to destination
    switch (true) {
      case path === 'home':
        this.navigateTo('/home');
        break;

      case path.startsWith('thread/'):
        const threadId = path.replace('thread/', '');
        this.navigateTo(`/thread/${threadId}`);
        break;

      case path.startsWith('project/') && path.includes('/thread/'):
        const [, projectId, , threadId2] = path.split('/');
        this.navigateTo(`/project/${projectId}/thread/${threadId2}`);
        break;

      case path.startsWith('project/'):
        const projId = path.replace('project/', '');
        this.navigateTo(`/project/${projId}`);
        break;

      case path.startsWith('workflow/') && path.endsWith('/run'):
        const workflowId = path.replace('workflow/', '').replace('/run', '');
        this.navigateTo(`/workflow/${workflowId}`, { autoRun: true });
        break;

      case path.startsWith('workflow/'):
        const wfId = path.replace('workflow/', '');
        this.navigateTo(`/workflow/${wfId}`);
        break;

      case path.startsWith('invite/'):
        const inviteCode = path.replace('invite/', '');
        this.handleInvite(inviteCode);
        break;

      case path === 'settings':
        this.navigateTo('/settings');
        break;

      default:
        logger.warn('Unknown deep link path', { path });
        this.navigateTo('/home');
    }
  }

  private navigateTo(route: string, state?: Record<string, unknown>): void {
    if (mainWindow) {
      mainWindow.webContents.send('navigate', { route, state });
    }
  }

  private async handleInvite(inviteCode: string): Promise<void> {
    try {
      const invitation = await mokuAPI.getInvitation(inviteCode);

      // Show confirmation dialog
      const result = await dialog.showMessageBox(mainWindow!, {
        type: 'question',
        title: 'Project Invitation',
        message: `You've been invited to join "${invitation.projectName}"`,
        detail: `Invited by ${invitation.invitedBy}\nRole: ${invitation.role}`,
        buttons: ['Accept', 'Decline'],
        defaultId: 0
      });

      if (result.response === 0) {
        await mokuAPI.acceptInvitation(inviteCode);
        this.navigateTo(`/project/${invitation.projectId}`);
        notificationService.showToast({
          type: 'project',
          title: 'Invitation Accepted',
          body: `You joined "${invitation.projectName}"`
        });
      }
    } catch (error) {
      notificationService.showToast({
        type: 'error',
        title: 'Invalid Invitation',
        body: 'This invitation is invalid or has expired'
      });
    }
  }
}
```

### 10.3 Generating Deep Links

```typescript
class DeepLinkGenerator {
  // Generate shareable links
  static thread(threadId: string): string {
    return `holokai://thread/${threadId}`;
  }

  static project(projectId: string): string {
    return `holokai://project/${projectId}`;
  }

  static projectThread(projectId: string, threadId: string): string {
    return `holokai://project/${projectId}/thread/${threadId}`;
  }

  static workflow(workflowId: string, autoRun = false): string {
    return autoRun
      ? `holokai://workflow/${workflowId}/run`
      : `holokai://workflow/${workflowId}`;
  }

  static invite(inviteCode: string): string {
    return `holokai://invite/${inviteCode}`;
  }
}

// Copy deep link to clipboard
async function copyDeepLink(type: string, id: string): Promise<void> {
  let link: string;

  switch (type) {
    case 'thread':
      link = DeepLinkGenerator.thread(id);
      break;
    case 'project':
      link = DeepLinkGenerator.project(id);
      break;
    case 'workflow':
      link = DeepLinkGenerator.workflow(id);
      break;
    default:
      return;
  }

  await clipboard.writeText(link);
  notificationService.showToast({
    type: 'file',
    title: 'Link Copied',
    body: 'Deep link copied to clipboard'
  });
}
```

---

## 11. Implementation Checklist

### 11.1 Authentication

- [ ] Register `holokai://` protocol handler
- [ ] Implement SSO initiation flow
- [ ] Implement exchange code callback handler
- [ ] Implement token storage with safeStorage
- [ ] Implement token refresh service
- [ ] Implement logout flow
- [ ] Add CSRF state validation

### 11.2 Security

- [ ] Configure safeStorage for tokens
- [ ] Implement encryption service for local data
- [ ] Configure IPC security (contextBridge)
- [ ] Set Content Security Policy
- [ ] Audit and limit exposed APIs

### 11.3 Platform Integration

- [ ] Implement HoloApiClient
- [ ] Implement MokuApiClient
- [ ] Implement StorageApiClient
- [ ] Add request interceptors for auth
- [ ] Add response interceptors for errors

### 11.4 Offline Support

- [ ] Implement ConnectionManager
- [ ] Implement OfflineQueue
- [ ] Add UI indicators for connection state
- [ ] Handle queue processing on reconnect

### 11.5 Auto-Update

- [ ] Configure electron-updater
- [ ] Implement UpdateService
- [ ] Add update notification UI
- [ ] Configure update channels (stable/beta)

### 11.6 Notifications

- [ ] Implement NotificationService
- [ ] System notifications (OS-level)
- [ ] In-app toast notifications
- [ ] Badge count (dock/taskbar)
- [ ] Notification history
- [ ] Notification settings UI
- [ ] Quiet hours support

### 11.7 State Persistence

- [ ] Implement StateStore with migrations
- [ ] Window state persistence (position, size, maximized)
- [ ] Multi-monitor display handling
- [ ] User preferences persistence
- [ ] Application state persistence
- [ ] Preferences IPC handlers
- [ ] Theme switching support

### 11.8 Deep Linking

- [ ] Implement DeepLinkHandler
- [ ] Route: thread/{id}
- [ ] Route: project/{id}
- [ ] Route: project/{id}/thread/{id}
- [ ] Route: workflow/{id}
- [ ] Route: workflow/{id}/run
- [ ] Route: invite/{code}
- [ ] Route: settings
- [ ] Implement DeepLinkGenerator
- [ ] Copy deep link to clipboard

---

## 12. Key Decisions Summary

| Decision | Value |
|----------|-------|
| SSO method | Exchange code flow (pseudo-PKCE) |
| Token storage | Electron safeStorage (OS keychain) |
| Local encryption | AES-256-GCM |
| IPC security | contextBridge with allowlist |
| Offline mode | Read-only for personal, queued writes |
| Update mechanism | electron-updater, auto-download |
| Health check interval | 30 seconds |
| Token refresh | 10 minutes before expiry |
| Exchange code TTL | 5 minutes |
| Notification history | 100 items max |
| Toast auto-dismiss | 5 seconds (errors persist) |
| State persistence | JSON file with versioned migrations |
| Window state save | Debounced 1 second |
| Default window size | 1200 x 800 |
| Default theme | System preference |
| Deep link protocol | holokai:// |

---

_Desktop core requirements defined - 2025-11-25_

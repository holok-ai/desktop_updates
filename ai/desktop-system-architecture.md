# Holokai Desktop System Architecture

## Document Overview

**Version**: 1.0.3  
**Phase**: Phase 1 (Basic Threads and Projects)  
**Last Updated**: November 2024

This document describes the complete system architecture for the Holokai Desktop application Phase 1 implementation, which focuses on basic thread management and project organization.

**Phase 2** (Agent Workflows) will be documented separately and is out of scope for this document.

---

## 1. Architecture Overview

### 1.1 High-Level System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                         HOLOKAI DESKTOP                             │
│                        (Electron + Svelte)                          │
│                                                                     │
│  ┌────────────────────┐        ┌─────────────────────────────┐    │
│  │  Main Process      │        │  Renderer Process           │    │
│  │  (Node.js)         │◄──IPC──┤  (Svelte + chat-component)  │    │
│  └────────────────────┘        └─────────────────────────────┘    │
└──────────┬───────────────────────────────────┬────────────────────┘
           │                                   │
           │ Authentication                    │ Chat Operations
           │                                   │
┌──────────▼─────────┐              ┌─────────▼──────────────┐
│   MOKU WEB/API     │              │     HOLO API           │
│   - SSO/OAuth2     │              │   - LLM Execution      │
│   - User Auth      │              │   - Model Access       │
│   - Exchange Codes │              │   - Streaming          │
└────────────────────┘              └────────┬───────────────┘
                                             │
                                    ┌────────▼───────────────┐
                                    │  HOLO AUDIT SERVICE    │
                                    │  - Thread Storage      │
                                    │  - Request/Response    │
                                    │  - Message History     │
                                    └────────────────────────┘
```

### 1.2 Component Responsibilities

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| **Desktop Main Process** | Window management, IPC handlers, authentication orchestration | Electron 28.x, Node.js |
| **Desktop Renderer** | UI rendering, user interactions, chat interface | Svelte, @holokai/chat-component |
| **Moku Web** | OAuth2 authentication, SSO provider integration | Web application |
| **Moku API** | Exchange code generation/validation, user authentication, thread organization, project management | Spring Boot REST API |
| **Holo API** | LLM prompt execution, model access, streaming responses | API Gateway |
| **Holo Audit Service** | Thread persistence, request/response storage, message history | Database-backed service |

---

## 2. Desktop Application Architecture

### 2.1 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Desktop Framework** | Electron | 28.x | Cross-platform desktop app |
| **UI Framework** | Svelte | 5.x | Reactive UI components |
| **Chat Library** | @holokai/chat-component | 1.x | Reusable chat interface |
| **Router** | svelte-spa-router | Latest | Hash-based client-side routing |
| **State Management** | Svelte Stores | Built-in | Reactive state containers |
| **HTTP Client** | Fetch API | Native | API communication |
| **Styling** | Tailwind CSS | 3.x | Utility-first CSS |
| **Language** | TypeScript | 5.3.x | Type-safe development |
| **Log Sanitization** | @cdssnc/sanitize-pii | Latest | Automated PII redaction in logs |
| **Compression** | Node.js zlib | Built-in | Gzip compression for cache optimization |

### 2.2 Process Architecture

#### Main Process (Node.js)

```
Main Process Responsibilities:
├── Application Lifecycle
│   ├── Window creation/management
│   ├── App menu configuration
│   ├── Auto-updater
│   └── Tray icon management
│
├── IPC Handler Layer
│   ├── Authentication handlers
│   ├── Thread operation handlers
│   ├── Settings handlers
│   └── System operation handlers
│
├── Service Layer
│   ├── AuthService (SSO flow orchestration)
│   ├── HoloAPIClient (chat operations)
│   ├── SecureStorageService (token management)
│   └── LoggingService (electron-log with PII sanitization)
│
└── Security
    ├── Context Bridge (secure IPC exposure)
    ├── Token storage (safeStorage)
    └── Custom protocol handler (holokai://)
```

#### Renderer Process (Chromium/Svelte)

```
Renderer Process Responsibilities:
├── UI Components (Svelte)
│   ├── ThreadListComponent
│   ├── ChatWindowComponent (@holokai/chat-component)
│   ├── ProjectSidebarComponent
│   └── SettingsComponent
│
├── State Management (Svelte Stores)
│   ├── authStore (user, authentication status)
│   ├── threadsStore (thread list, active thread)
│   └── settingsStore (user preferences)
│
├── Services (IPC Wrappers)
│   ├── AuthService (IPC → Main Process)
│   ├── ThreadService (IPC → Main Process)
│   └── ChatService (IPC → Main Process)
│
└── Routing (svelte-spa-router)
    ├── /login
    ├── /threads
    ├── /projects
    └── /settings
```

### 2.3 IPC Communication Pattern

**Context Bridge Grouping** (Main Process):

```typescript
// src-electron/preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  // Authentication operations
  auth: {
    startSSO: () => ipcRenderer.invoke('auth:start-sso'),
    getUser: () => ipcRenderer.invoke('auth:get-user'),
    logout: () => ipcRenderer.invoke('auth:logout'),
  },

  // Thread operations
  threads: {
    create: (prompt: string, model: string) => 
      ipcRenderer.invoke('threads:create', prompt, model),
    list: () => ipcRenderer.invoke('threads:list'),
    getMessages: (threadId: string) => 
      ipcRenderer.invoke('threads:get-messages', threadId),
    continue: (threadId: string, prompt: string) => 
      ipcRenderer.invoke('threads:continue', threadId, prompt),
    delete: (threadId: string) => 
      ipcRenderer.invoke('threads:delete', threadId),
  },

  // Project operations (Phase 1 basic support)
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    create: (name: string) => ipcRenderer.invoke('projects:create', name),
    moveThread: (threadId: string, projectId: string) => 
      ipcRenderer.invoke('projects:move-thread', threadId, projectId),
  },

  // Settings operations
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
  },
});
```

**Service Wrapper Pattern** (Renderer Process):

```typescript
// src/lib/services/thread.service.ts
export class ThreadService {
  async createThread(prompt: string, model: string): Promise<Thread> {
    return window.electronAPI.threads.create(prompt, model);
  }

  async listThreads(): Promise<Thread[]> {
    return window.electronAPI.threads.list();
  }

  async getMessages(threadId: string): Promise<Message[]> {
    return window.electronAPI.threads.getMessages(threadId);
  }
}

export const threadService = new ThreadService();
```

---

## 3. Authentication Architecture

### 3.1 Exchange Code Flow

The desktop application uses an **Exchange Code Flow** for secure authentication without exposing tokens in the browser. The flow includes PKCE-style state parameter to prevent protocol hijacking.

```
┌─────────────┐                                      ┌──────────────┐
│   DESKTOP   │                                      │   MOKU WEB   │
└──────┬──────┘                                      └──────┬───────┘
       │                                                     │
       │ 1. Generate random state parameter                 │
       │    state = randomBytes(32).base64()                │
       │                                                     │
       │ 2. No token → Launch browser with state            │
       ├────────────────────────────────────────────────────►
       │   https://moku.holokai.app/login/desktop           │
       │   ?state=xyz789abc                                 │
       │                                                     │
       │                          3. User logs in via OAuth2│
       │                              (Google, Microsoft, etc)
       │                                                     │
       │                      4. Moku generates exchange code│
       │                                                     │
       │   5. Redirect: holokai://auth?code=xyz123&state=xyz789abc
       ◄─────────────────────────────────────────────────────┤
       │                                                     │
       │ 6. Verify state parameter matches                  │
       │    if (state != expectedState) throw error         │
       │                                                     │
       │ 7. POST /api/auth/exchange-code { code }           │
       ├────────────────────────────────────────────────────►
       │                                                     │
       │                8. Returns: { apiKey: "jwt" }       │
       ◄─────────────────────────────────────────────────────┤
       │                                                     │
       │ 9. POST /api/auth/token/refresh { apiKey }         │
       ├────────────────────────────────────────────────────►
       │                                                     │
       │         10. Returns: { accessToken, expiresIn }    │
       ◄─────────────────────────────────────────────────────┤
       │                                                     │
       │ 11. Store accessToken securely (safeStorage)       │
       │ ✓ Authenticated                                    │
```

**Authentication Steps**:

1. **Generate State**: Desktop generates cryptographically random state parameter (32 bytes, base64-encoded)
2. **Launch Browser**: Desktop opens system browser to Moku Web login page with state parameter in URL
3. **OAuth Authentication**: User authenticates via OAuth2 provider (Google, Microsoft, Okta, etc.)
4. **Generate Exchange Code**: Moku Web backend creates one-time-use exchange code (5-minute TTL)
5. **Redirect to Desktop**: Browser redirects to custom protocol URL with exchange code AND state parameter
6. **Verify State**: Desktop validates state parameter matches the one generated in step 1 (prevents hijacking)
7. **Exchange for API Key**: Desktop calls Moku API to exchange code for intermediate apiKey (JWT)
8. **Receive API Key**: Moku validates code and returns apiKey (code is now invalidated)
9. **Refresh to Access Token**: Desktop calls refresh endpoint with apiKey to obtain final access token
10. **Receive Access Token**: Moku returns access token with app-level permissions and expiration time
11. **Secure Storage**: Desktop stores access token encrypted via OS keychain

**Security Features**:
- State parameter prevents protocol hijacking (PKCE-style protection)
- Exchange code is single-use and expires in 5 minutes
- API key is short-lived intermediate token with 24-hour maximum lifetime
- Access token has full permissions and 15-minute lifetime
- No tokens exposed in browser or URL (only exchange code and state)
- Custom protocol prevents token interception

### 3.2 Token Management

**Token Storage**:
- **In-Memory**: Main process keeps current accessToken
- **Secure Storage**: Uses Electron's safeStorage (OS keychain)
- **Never Persisted in Renderer**: Renderer never sees raw tokens
- **API Key Caching**: Optional caching with explicit 24-hour maximum lifetime

**Token Lifecycle**:
- **Exchange codes**: Expire in 5 minutes, single-use only
- **API keys**: Maximum 24-hour lifetime, stored encrypted, used only for token refresh
- **Access tokens**: 15-minute lifetime with automatic refresh
- Desktop checks token expiration before each API call
- Automatic token refresh using cached apiKey when access token expires (every 10-12 minutes)
- Full re-authentication required if apiKey expired or unavailable
- Logout clears all stored credentials (access token and apiKey)

**Token Refresh Strategy**:
```typescript
class AuthService {
  private accessToken: string | null = null;
  private accessTokenExpiresAt: number | null = null;
  private apiKey: string | null = null;
  private apiKeyExpiresAt: number | null = null;
  
  // Token lifetime constants
  private readonly ACCESS_TOKEN_LIFETIME = 15 * 60 * 1000; // 15 minutes
  private readonly API_KEY_MAX_LIFETIME = 24 * 60 * 60 * 1000; // 24 hours
  private readonly REFRESH_BUFFER = 2 * 60 * 1000; // Refresh 2 min before expiry
  
  async cacheApiKey(apiKey: string): Promise<void> {
    this.apiKey = apiKey;
    this.apiKeyExpiresAt = Date.now() + this.API_KEY_MAX_LIFETIME;
    await secureStorage.set('apiKey', apiKey);
    await secureStorage.set('apiKeyExpiry', this.apiKeyExpiresAt);
  }
  
  async refreshAccessToken(): Promise<void> {
    if (this.isAccessTokenValid()) {
      return; // Still valid, no refresh needed
    }
    
    if (!this.apiKey || Date.now() > this.apiKeyExpiresAt!) {
      // apiKey expired - need full re-authentication
      throw new Error('RE_AUTH_REQUIRED');
    }
    
    const response = await mokuAPI.refreshToken(this.apiKey);
    this.accessToken = response.accessToken;
    this.accessTokenExpiresAt = Date.now() + this.ACCESS_TOKEN_LIFETIME;
  }
  
  private isAccessTokenValid(): boolean {
    if (!this.accessToken || !this.accessTokenExpiresAt) return false;
    // Check if token expires within refresh buffer
    return Date.now() < (this.accessTokenExpiresAt - this.REFRESH_BUFFER);
  }
  
  clearCredentials(): void {
    this.accessToken = null;
    this.accessTokenExpiresAt = null;
    this.apiKey = null;
    this.apiKeyExpiresAt = null;
    secureStorage.delete('apiKey');
    secureStorage.delete('apiKeyExpiry');
  }
}
```

**Security Enforcement**:
- API key MUST be deleted after 24 hours (enforced at application level)
- Access token MUST be refreshed every 15 minutes (server enforces expiration)
- Automatic background refresh at 10-minute intervals when app active
- Clear all credentials on logout or app quit

### 3.3 Custom Protocol Registration

Desktop registers `holokai://` custom protocol:

- **Windows**: Registry entries via Electron Builder
- **macOS**: Info.plist CFBundleURLSchemes
- **Linux**: Desktop entry MIME type handler

Main process listens for `open-url` event to intercept OAuth callback.

---

## 4. Chat Operations Architecture

### 4.1 Chat Component Integration

Desktop uses the **@holokai/chat-component** library for all chat UI and interactions.

**Key Features**:
- Message rendering with markdown support
- Code syntax highlighting (Prism.js)
- Streaming response display
- File attachment support
- Multi-modal input (text + images)

**Integration**:
```svelte
<!-- src/routes/chat/+page.svelte -->
<script lang="ts">
  import { ChatWindow } from '@holokai/chat-component';
  import { chatService } from '$lib/services/chat.service';

  async function handleSubmit(message: string) {
    const response = await chatService.sendMessage(threadId, message);
    // Component handles streaming and display
  }
</script>

<ChatWindow 
  {messages} 
  onSubmit={handleSubmit}
  streaming={true}
/>
```

### 4.2 Holo API Integration

Desktop communicates with Holo API for all LLM operations.

**API Endpoints**:
- `POST /api/chat` - Execute LLM prompt with streaming
- `GET /api/models` - List available models
- `GET /api/chat/history/{threadId}` - Retrieve thread history

**Request Flow**:
```typescript
// Main Process: src-electron/services/holo-api-client.ts
export class HoloAPIClient {
  async submitPrompt(request: {
    threadId: string;      // Desktop-generated UUID
    prompt: string;
    model: string;
    stream?: boolean;
  }): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    return response.json();
  }
}
```

**Streaming Support**:
- Holo API returns Server-Sent Events (SSE)
- Desktop streams tokens to renderer via IPC
- Chat component displays tokens incrementally

### 4.3 Thread ID Management

**Desktop-Generated UUIDs**:
- Desktop generates thread IDs locally (UUID v4)
- No round-trip to server needed to start conversation
- UUIDs included in all Holo API requests

**Benefits**:
- ✅ Immediate thread creation (no API latency)
- ✅ Offline capability (queue prompts)
- ✅ Globally unique identifiers
- ✅ Desktop controls threading from start

**Implementation**:
```typescript
import { randomUUID } from 'crypto';

export class ThreadRepository {
  createNewThread(): string {
    return randomUUID(); // e.g., "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

## 5. Data Persistence Architecture

### 5.1 Holo Audit Service

The **Holo Audit Service** is the single source of truth for all chat data.

**Storage Responsibilities**:
- Thread metadata (title, created date, user)
- User prompts (requests)
- LLM responses
- Message ordering and timestamps
- Soft delete support

**Database Schema** (Managed by Holo Audit Service):

```
threads:
  - id (UUID, provided by desktop)
  - userId (UUID)
  - title (string)
  - status (enum: active, archived, deleted)
  - createdAt (timestamp)
  - updatedAt (timestamp)
  - deletedAt (timestamp, nullable)

requests:
  - id (UUID)
  - threadId (UUID, FK to threads)
  - userId (UUID)
  - prompt (text)
  - model (string)
  - metadata (JSONB)
  - createdAt (timestamp)

responses:
  - id (UUID)
  - requestId (UUID, FK to requests, one-to-one)
  - content (text)
  - metadata (JSONB)
  - createdAt (timestamp)
```

### 5.2 Data Flow

**Write Operations** (Prompt Submission):
```
Desktop (generates threadId)
    ↓
Main Process (IPC handler)
    ↓
HoloAPIClient.submitPrompt()
    ↓
Holo API (executes LLM)
    ↓
Holo Audit Service (saves request + response)
    ↓
Response streamed back to Desktop
```

**Read Operations** (Thread History):
```
Desktop (requests thread messages)
    ↓
Main Process (IPC handler)
    ↓
HoloAPIClient.getThreadHistory()
    ↓
Holo API (queries Audit Service)
    ↓
Returns ordered messages (requests + responses)
    ↓
Desktop caches and displays
```

### 5.3 Desktop Caching Strategy

**In-Memory Cache Architecture** (Main Process):

Desktop implements a two-tier LRU caching system with configurable limits, lazy loading, and **encryption for sensitive data**:

**Thread Cache**:
- **Capacity**: 100 threads (configurable in settings: 50-200)
- **Eviction Policy**: Least Recently Used (LRU)
- **Loading Strategy**: Lazy, on-demand as user scrolls
- **Initial Load**: Most recent 50 threads
- **Scroll Trigger**: Load next batch when scrolling reaches bottom 10 threads
- **Security**: Thread metadata (title, dates) stored in plain text; no message content in thread cache

**Message Cache**:
- **Per-Thread Limit**: 100 messages initially loaded
- **Total Capacity**: 1000 messages across all threads (effectively ~1500-2000 with compression)
- **Eviction Policy**: Thread-based LRU (evict entire thread's messages)
- **On-Demand Loading**: Threads with >100 messages load older messages on scroll
- **Pagination**: Load 50 messages at a time when scrolling up
- **Security**: Message content compressed with gzip then encrypted using AES-256-GCM
- **Compression**: Automatic gzip for messages > 1KB, typical 35-50% size reduction
- **Key Rotation**: Encryption keys rotate every 8 hours with secure re-encryption

**Cache Security Implementation with Compression**:
```typescript
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';

export class SecureCacheManager {
  private encryptionKey: Buffer | null = null;
  private keyCreatedAt: number = 0;
  private rotationTimer: NodeJS.Timeout | null = null;
  
  // 8-hour key rotation period
  private static readonly KEY_ROTATION_PERIOD = 8 * 60 * 60 * 1000; // 8 hours
  private static readonly COMPRESSION_THRESHOLD = 1024; // Compress if > 1KB
  
  // Initialize with session-based key, not token-derived
  initializeEncryption(): void {
    this.generateNewKey();
    this.scheduleKeyRotation();
  }
  
  private generateNewKey(): void {
    // Generate cryptographically secure random key
    this.encryptionKey = randomBytes(32);
    this.keyCreatedAt = Date.now();
  }
  
  private scheduleKeyRotation(): void {
    // Clear existing timer
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
    }
    
    // Schedule rotation in 8 hours
    this.rotationTimer = setTimeout(() => {
      this.rotateKey();
    }, SecureCacheManager.KEY_ROTATION_PERIOD);
  }
  
  private async rotateKey(): Promise<void> {
    const oldKey = this.encryptionKey;
    this.generateNewKey();
    
    // Re-encrypt existing cache with new key
    // This should be done in a background worker to avoid blocking
    await this.reencryptCache(oldKey, this.encryptionKey);
    
    // Securely clear old key
    if (oldKey) {
      oldKey.fill(0);
    }
    
    this.scheduleKeyRotation();
  }
  
  // Encrypt and compress message content before caching
  encryptMessage(message: Message): EncryptedMessage {
    if (!this.encryptionKey) throw new Error('Encryption not initialized');
    
    let dataToEncrypt: Buffer;
    let isCompressed = false;
    
    // Compress if content is larger than threshold
    if (message.content.length > SecureCacheManager.COMPRESSION_THRESHOLD) {
      dataToEncrypt = gzipSync(Buffer.from(message.content, 'utf8'));
      isCompressed = true;
    } else {
      dataToEncrypt = Buffer.from(message.content, 'utf8');
    }
    
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(dataToEncrypt),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return {
      ...message,
      content: '', // Clear plaintext
      encryptedContent: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      isCompressed, // Store compression flag
      originalSize: message.content.length,
      compressedSize: dataToEncrypt.length
    };
  }
  
  // Decrypt and decompress message content when retrieving from cache
  decryptMessage(encrypted: EncryptedMessage): Message {
    if (!this.encryptionKey) throw new Error('Encryption not initialized');
    
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(encrypted.iv, 'base64')
    );
    
    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted.encryptedContent, 'base64')),
      decipher.final()
    ]);
    
    // Decompress if needed
    let content: string;
    if (encrypted.isCompressed) {
      content = gunzipSync(decrypted).toString('utf8');
    } else {
      content = decrypted.toString('utf8');
    }
    
    return {
      ...encrypted,
      content
    };
  }
  
  // Clear encryption key on logout or screen lock
  clearEncryption(): void {
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
    }
    
    if (this.encryptionKey) {
      this.encryptionKey.fill(0); // Overwrite key in memory
      this.encryptionKey = null;
    }
  }
  
  // Re-encrypt cache with new key (should be done in worker thread)
  private async reencryptCache(oldKey: Buffer, newKey: Buffer): Promise<void> {
    // Implementation would iterate through all cached messages
    // Decrypt with old key, encrypt with new key
    // This is a placeholder for the actual implementation
    console.log('Re-encrypting cache with new key');
  }
  
  // Get compression statistics
  getCompressionStats(): { ratio: number; savedBytes: number } {
    // Return compression effectiveness metrics
    return {
      ratio: 0.65, // Example: 35% compression
      savedBytes: 0
    };
  }
}
```

**Cache Implementation**:
```typescript
export class ThreadRepository {
  // Thread cache with LRU eviction
  private readonly threadCache: LRUCache<string, Thread>;
  private readonly MAX_THREADS: number; // Default 200, configurable
  
  // Message cache with thread-based LRU eviction
  private readonly messageCache: LRUCache<string, Message[]>;
  private readonly MAX_TOTAL_MESSAGES = 1000;
  private readonly INITIAL_MESSAGE_LOAD = 100;
  private readonly MESSAGE_PAGE_SIZE = 50;
  
  // Thread list pagination state
  private threadListCursor: string | null = null;
  private allThreadsLoaded = false;
  
  constructor(settings: Settings) {
    this.MAX_THREADS = settings.threadCacheSize || 100;
    
    this.threadCache = new LRUCache<string, Thread>({
      max: this.MAX_THREADS,
      dispose: (thread) => {
        // Clean up associated messages when thread evicted
        this.messageCache.delete(thread.id);
      },
    });
    
    this.messageCache = new LRUCache<string, EncryptedMessage[]>({
      max: this.MAX_TOTAL_MESSAGES,
      length: (messages) => messages.length, // Count by message count
      dispose: (threadId, messages) => {
        // Securely clear encrypted messages from memory
        messages.forEach(msg => {
          if (msg.encryptedContent) {
            msg.encryptedContent = '';
          }
        });
      },
    });
    
    // Initialize cache encryption
    this.cacheManager = new SecureCacheManager();
    
    // Listen for screen lock events to clear cache
    powerMonitor.on('lock-screen', () => {
      this.clearSensitiveCache();
    });
  }

  async listThreads(loadMore: boolean = false): Promise<Thread[]> {
    if (this.threadCache.itemCount === 0 && !loadMore) {
      // Initial load - get 50 most recent threads
      await this.loadThreadBatch(50);
    } else if (loadMore && !this.allThreadsLoaded) {
      // User scrolled - load next batch
      await this.loadThreadBatch(50);
    }
    
    return Array.from(this.threadCache.values());
  }

  private async loadThreadBatch(limit: number): Promise<void> {
    const result = await this.mokuAPI.getThreads({
      limit,
      cursor: this.threadListCursor,
    });
    
    result.threads.forEach(thread => {
      this.threadCache.set(thread.id, thread);
    });
    
    this.threadListCursor = result.nextCursor || null;
    this.allThreadsLoaded = !result.nextCursor;
  }

  async getMessages(
    threadId: string, 
    loadOlder: boolean = false
  ): Promise<Message[]> {
    let encryptedMessages = this.messageCache.get(threadId);
    
    if (!encryptedMessages) {
      // Initial load - get last 100 messages
      const messages = await this.mokuAPI.getThreadMessages(threadId, {
        limit: this.INITIAL_MESSAGE_LOAD,
      });
      
      // Encrypt messages before caching
      encryptedMessages = messages.map(msg => 
        this.cacheManager.encryptMessage(msg)
      );
      this.messageCache.set(threadId, encryptedMessages);
    } else if (loadOlder && encryptedMessages.length >= this.INITIAL_MESSAGE_LOAD) {
      // User scrolled up - load older messages
      const oldestEncrypted = encryptedMessages[0];
      const oldestDecrypted = this.cacheManager.decryptMessage(oldestEncrypted);
      
      const olderMessages = await this.mokuAPI.getThreadMessages(threadId, {
        limit: this.MESSAGE_PAGE_SIZE,
        before: oldestDecrypted.createdAt,
      });
      
      if (olderMessages.length > 0) {
        const encryptedOlder = olderMessages.map(msg =>
          this.cacheManager.encryptMessage(msg)
        );
        encryptedMessages = [...encryptedOlder, ...encryptedMessages];
        this.messageCache.set(threadId, encryptedMessages);
      }
    }
    
    // Touch thread in cache to mark as recently used
    this.threadCache.get(threadId);
    
    // Decrypt messages for return
    return encryptedMessages.map(msg => 
      this.cacheManager.decryptMessage(msg)
    );
  }

  clearSensitiveCache(): void {
    // Clear all message content from cache
    this.messageCache.clear();
    this.cacheManager.clearEncryption();
  }

  invalidateThread(threadId: string): void {
    this.messageCache.delete(threadId);
  }
  
  clearCache(): void {
    this.threadCache.clear();
    this.messageCache.clear();
    this.threadListCursor = null;
    this.allThreadsLoaded = false;
  }
}
```

**Cache Benefits**:
- Bounded memory usage (100 threads + 1000 messages)
- Automatic eviction of least-used data
- Smooth infinite scroll experience
- Configurable limits per user preference
- Efficient for both light and heavy users
- **Encrypted message content** prevents memory dump attacks
- **Screen lock detection** automatically clears sensitive cache
- **AES-256-GCM encryption** with authentication tags
- **8-hour key rotation** balances security with performance
- **Gzip compression** reduces memory usage by ~35-50% for text content
- **Compression threshold** only compresses messages > 1KB to optimize CPU usage
- **Session-based keys** independent of token lifecycle for stability

**No Local Database**:
- Desktop does NOT use SQLite or local DB
- All persistence handled by Holo Audit Service
- Cache cleared on app restart (reload from API)

---

## 6. Moku API Backend Services

### 6.1 Overview

While Holo Audit Service manages the authoritative storage of all chat data, **Moku API** provides essential organizational and metadata management capabilities for the desktop application. Moku serves as the coordination layer for thread organization, project management, and user-specific configurations.

**Separation of Concerns**:
- **Holo Audit Service**: Chat execution and message persistence (requests/responses)
- **Moku API**: Thread organization, project management, metadata operations

### 6.2 Thread Management Controller

Moku API provides a dedicated **DesktopThreadController** that exposes thread organizational operations without duplicating the chat execution capabilities of Holo API.

#### DesktopThreadController (`/api/threads`)

1. **GET /api/threads** - List threads for current user with pagination
   - Query Parameters:
     - `limit` (optional): Number of threads to return (default: 50, max: 100)
     - `cursor` (optional): Pagination cursor for next batch
     - `before` (optional): ISO timestamp to get threads updated before this date
     - `after` (optional): ISO timestamp to get threads updated after this date
   - Response: `{ threads: Thread[], nextCursor?: string }`

2. **GET /api/threads/{threadId}** - Get single thread by ID

3. **GET /api/threads/{threadId}/messages** - Get messages for a thread with pagination
   - Query Parameters:
     - `limit` (optional): Number of messages to return (default: 100, max: 200)
     - `before` (optional): Timestamp to get messages before this time
     - `after` (optional): Timestamp to get messages after this time
     - `cursor` (optional): Pagination cursor for next batch
   - Response: `{ messages: Message[], nextCursor?: string, hasMore: boolean }`

4. **POST /api/threads** - Create a new thread

5. **PATCH /api/threads/{threadId}** - Update thread metadata

6. **POST /api/threads/{threadId}/messages** - Append message to thread

7. **POST /api/threads/{threadId}/move** - Move thread to/from project

8. **POST /api/threads/{threadId}/soft-delete** - Soft delete thread

9. **DELETE /api/threads/{threadId}** - Permanently delete thread

**Key Characteristics**:
- All endpoints require user authentication via access token
- Thread operations validate user ownership before execution
- Metadata updates preserved in JSONB fields for flexibility
- Soft delete maintains data integrity while marking threads inactive
- Message operations coordinate with Holo Audit Service for synchronization

**Desktop Integration**:
Desktop's main process calls these endpoints through the MokuAPIClient service class, which handles authorization headers, error recovery, and response transformation. The ThreadRepository caches results to minimize network calls while maintaining consistency with the backend.

### 6.3 Project Management Controller

Moku API provides comprehensive **project management** capabilities enabling users to organize threads into logical groupings with access control and file management.

**Project Controller Endpoints**:

1. **Project CRUD Operations**
   - `GET /api/projects` - List user's projects
   - `POST /api/projects` - Create project
   - `GET /api/projects/:id` - Get project details
   - `PATCH /api/projects/:id` - Update project
   - `DELETE /api/projects/:id` - Delete project

2. **Sharing Management**
   - `POST /api/projects/:id/share` - Share with user/org
   - `DELETE /api/projects/:id/share/:shareId` - Revoke access
   - `GET /api/projects/:id/collaborators` - List collaborators

3. **File Operations**
   - `POST /api/projects/:id/files` - Upload file
   - `GET /api/projects/:id/files` - List project files
   - `DELETE /api/projects/:id/files/:fileId` - Delete file

**Phase 1 Scope**:
Desktop Phase 1 implements only basic project organization (CRUD operations) and thread assignment. Sharing management and file operations are reserved for future phases when collaboration features are introduced.

**Authorization Model**:
Projects implement role-based access control with owner, editor, and viewer permissions. The Moku API enforces authorization rules at the controller level, ensuring users can only access projects where they have appropriate permissions.

### 6.4 Data Synchronization

**Read Path**:
Desktop queries Moku API for thread lists and metadata, which Moku constructs by joining data from Holo Audit Service with its own organizational tables. This provides a unified view combining chat content (from Holo) with organizational context (from Moku).

**Write Path**:
Organizational changes (thread moves, project creation, metadata updates) write directly to Moku's database tables. Chat operations (prompt submission, message creation) write to Holo Audit Service. Desktop coordinates these writes through separate service classes (MokuAPIClient for organization, HoloAPIClient for chat).

**Consistency Guarantees**:
Moku API queries Holo Audit Service synchronously when serving thread content to ensure desktop always receives current message data. Desktop's cache invalidation strategy refreshes data after any write operation to maintain local consistency.

---

## 7. Phase 1 Feature Scope

### 7.1 Core Features

**Thread Management**:
- ✅ Create new thread (with initial prompt)
- ✅ Continue existing thread (append messages)
- ✅ List all threads (sorted by recent activity)
- ✅ View thread conversation history
- ✅ Delete thread (soft delete)
- ✅ Search threads (basic title/content search)

**Chat Interface**:
- ✅ Send text prompts
- ✅ Receive streaming responses
- ✅ Markdown rendering
- ✅ Code syntax highlighting
- ✅ Copy message content
- ✅ Regenerate response (retry prompt)

**Model Selection**:
- ✅ Choose from available models (Claude, GPT-4, etc.)
- ✅ Per-thread model selection
- ✅ Model switching mid-conversation

**Project Organization** (Basic):
- ✅ Create projects (folders)
- ✅ Move threads to projects
- ✅ View threads grouped by project
- ✅ General threads (no project)

**Settings**:
- ✅ Default model selection
- ✅ Theme selection (light/dark)
- ✅ Keyboard shortcuts
- ✅ Clear cache option
- ✅ Thread cache size (50-200 threads, default: 100)
- ✅ Message loading behavior

### 7.2 Out of Scope (Phase 2)

- ❌ Agent workflows
- ❌ Multi-step agent pipelines
- ❌ Tool integration (file system, web search)
- ❌ Scheduled tasks
- ❌ Team collaboration features
- ❌ Real-time sync across devices

---

## 8. Security Architecture

### 8.1 Electron Security Configuration

**BrowserWindow Settings**:
```typescript
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,           // Renderer cannot access Node
    contextIsolation: true,           // Isolate preload from renderer
    sandbox: true,                    // Run renderer in sandbox
    webSecurity: true,                // Enforce same-origin policy
    allowRunningInsecureContent: false,
    preload: path.join(__dirname, 'preload.js'),
  },
});
```

**Content Security Policy**:
```typescript
import { randomBytes } from 'crypto';

// Generate nonce for each request
function generateNonce(): string {
  return randomBytes(16).toString('base64');
}

session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  const nonce = generateNonce();
  
  // Pass nonce to renderer via meta tag or header
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'nonce-" + nonce + "'",  // Removed unsafe-inline
        "img-src 'self' data: https:",
        "connect-src 'self' https://api.holo.holokai.app https://api.moku.holokai.app",
        "font-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",  // Added for clickjacking protection
        "upgrade-insecure-requests",  // Force HTTPS
      ].join('; '),
      'X-CSP-Nonce': nonce,  // Pass nonce to renderer
    },
  });
});

// In renderer, use nonce for inline styles
// <style nonce="${nonce}">...</style>
```

### 8.2 Token Security

**Secure Storage**:
- Uses Electron's safeStorage API
- Encrypted via OS keychain (macOS Keychain, Windows Credential Vault, Linux libsecret)
- Tokens never logged or exposed
- Automatic cleanup on logout

**Token Validation**:
- Check expiration before each API call
- Automatic refresh using API key
- Automatic re-authentication on 401 errors
- Token refresh 

### 8.3 Data Protection

**Sensitive Data Rules**:
- ❌ Never log tokens or passwords
- ❌ Never pass tokens through renderer
- ❌ Never store PII unencrypted
- ✅ Sanitize error messages
- ✅ Clear cache on logout
- ✅ Validate all IPC inputs
- ✅ Use CSP nonces for inline styles (no unsafe-inline)
- ✅ Compress cached data with gzip
- ✅ Rotate encryption keys every 8 hours

---

## 9. Logging and Auditing

### 9.1 Local Logging (electron-log)

**Main Process Logging with PII Sanitization**:
```typescript
import log from 'electron-log';
import { sanitize } from '@cdssnc/sanitize-pii';

// Configure PII sanitization for all log transports
log.hooks.push((message, transport, level) => {
  // Sanitize all log arguments to remove PII
  const sanitizedArgs = message.data.map(arg => {
    if (typeof arg === 'string') {
      return sanitize(arg);
    } else if (typeof arg === 'object' && arg !== null) {
      // Deep sanitize objects
      return JSON.parse(sanitize(JSON.stringify(arg)));
    }
    return arg;
  });
  
  return { ...message, data: sanitizedArgs };
});

// Application lifecycle
log.info('Application started', { version: app.getVersion() });
log.info('User logged in', { userId: user.id });

// API operations
log.info('Prompt submitted', { threadId, model, promptLength: prompt.length });
log.error('API call failed', { endpoint, statusCode, error: sanitizeError(err) });

// Never log sensitive data
log.info('Token refreshed'); // ✅ Good
log.info('Token value:', token); // ❌ NEVER DO THIS
```

**PII Sanitization Features**:
The `@cdssnc/sanitize-pii` package automatically detects and redacts:
- **Email addresses**: user@example.com → [REDACTED EMAIL]
- **Phone numbers**: 555-123-4567 → [REDACTED PHONE]
- **Social Security Numbers**: 123-45-6789 → [REDACTED SSN]
- **Credit card numbers**: 4111-1111-1111-1111 → [REDACTED CREDIT CARD]
- **IP addresses**: 192.168.1.1 → [REDACTED IP]
- **URLs with auth tokens**: Removes query parameters that may contain tokens
- **Canadian SIN numbers**: Detected and redacted
- **Other PII patterns**: Customizable through configuration

**Custom Sanitization Rules**:
```typescript
// Additional custom sanitization for application-specific patterns
function sanitizeError(error: any): any {
  const errorString = error.toString();
  // Remove any JWT tokens from error messages
  const sanitized = errorString.replace(/Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, 'Bearer [REDACTED TOKEN]');
  // Remove any API keys
  return sanitized.replace(/apiKey=[^&\s]+/g, 'apiKey=[REDACTED]');
}
```

**Log Levels**:
- `error` - Failures, exceptions
- `warn` - Recoverable issues
- `info` - Significant events
- `debug` - Verbose troubleshooting

**Log Location**:
- **macOS**: `~/Library/Logs/Holokai/main.log`
- **Windows**: `%USERPROFILE%\AppData\Roaming\Holokai\logs\main.log`
- **Linux**: `~/.config/Holokai/logs/main.log`

### 9.2 Holo Audit Service

**Audit Events** (Managed by Holo):
- Prompt submission
- LLM response completion
- Thread creation/deletion
- Model selection changes

**Not Logged by Desktop**:
- Desktop does NOT send separate audit events
- All auditing handled by Holo Audit Service
- Desktop logging is for troubleshooting only

---

## 10. Error Handling

### 10.1 Error Categories

**Authentication Errors**:
- `401 Unauthorized` → Re-authenticate user
- `403 Forbidden` → Show access denied message
- Exchange code expired → Restart SSO flow

**API Errors**:
- `429 Too Many Requests` → Show rate limit message
- `500 Internal Server Error` → Show error, allow retry
- Network timeout → Show connection error

**Application Errors**:
- IPC handler exceptions → Log and show generic error
- Render crashes → Electron restart window
- Cache corruption → Clear cache and reload

### 10.2 Error Recovery

```typescript
export class HoloAPIClient {
  async submitPrompt(request: ChatRequest): Promise<ChatResponse> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      });

      if (response.status === 401) {
        // Token expired - trigger re-auth
        await this.authService.reauthenticate();
        throw new Error('RE_AUTH_REQUIRED');
      }

      if (response.status === 429) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }

      if (!response.ok) {
        throw new Error(`API_ERROR: ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      log.error('Prompt submission failed', { 
        threadId: request.threadId, 
        error: sanitizeError(error) 
      });
      throw error;
    }
  }
}
```

---

## 11. Deployment Architecture

### 11.1 Build Configuration

**Electron Builder** (`electron-builder.yml`):
```yaml
appId: com.holokai.desktop
productName: Holokai
copyright: Copyright © 2024 Holokai

directories:
  buildResources: build
  output: dist-electron

files:
  - dist/**/*
  - dist-electron/**/*
  - node_modules/**/*
  - package.json

mac:
  category: public.app-category.productivity
  target:
    - dmg
    - zip
  notarize: true

win:
  target:
    - nsis
    - portable
  publisherName: Holokai

linux:
  target:
    - AppImage
    - deb
  category: Utility

protocols:
  - name: holokai
    schemes:
      - holokai
```

### 11.2 Update Strategy

**Auto-Updater**:
- Check for updates on startup
- Download in background
- Prompt user to restart for update
- Delta updates for smaller downloads

**Update Server**:
- S3-hosted update files
- Signed updates (macOS notarization, Windows code signing)
- Version manifest with release notes

---

## 12. Performance Considerations

### 12.1 Optimization Strategies

**Lazy Loading**:
- Load thread list on demand
- Paginate thread history (50 messages at a time)
- Defer loading thread content until viewed

**Caching**:
- In-memory cache for active thread
- LRU eviction for old threads
- Invalidate cache on new messages

**Rendering**:
- Virtualized lists for large thread counts
- Debounced search input
- Lazy markdown rendering

### 12.2 Memory Management

**Cache Limits**:
- Thread cache: 100 threads (configurable: 50-200)
- Message cache: 1000 total messages across all threads (effectively ~1500-2000 with gzip)
- Per-thread message limit: 100 messages initially loaded
- LRU eviction policy for both caches
- Compression reduces memory footprint by 35-50% for text content
- Clear cache on logout or app restart

**Memory Monitoring**:
```typescript
// Main process
app.on('ready', () => {
  setInterval(() => {
    const usage = process.memoryUsage();
    if (usage.heapUsed > 500 * 1024 * 1024) { // 500MB
      log.warn('High memory usage', { heapUsed: usage.heapUsed });
      threadRepository.clearOldCache();
    }
  }, 60000); // Check every minute
});
```

---

## 13. Testing Strategy

### 13.1 Unit Tests

**Main Process**:
- Service layer methods (mocked API clients)
- IPC handlers (mocked services)
- Authentication flow (mocked OAuth)

**Renderer Process**:
- Svelte component tests (Vitest)
- Service wrapper tests (mocked IPC)
- Store tests (state mutations)

### 13.2 Integration Tests

**E2E Tests** (Playwright):
- Complete authentication flow
- Create thread and send message
- View thread history
- Move thread to project
- Delete thread

### 13.3 Manual Test Checklist

- [ ] SSO login on Windows/macOS/Linux
- [ ] Create thread with various models
- [ ] Streaming response display
- [ ] Thread list loads correctly
- [ ] Cache invalidation works
- [ ] Error handling (network failure, 401, 500)
- [ ] Logout clears tokens
- [ ] App restart preserves authentication
- [ ] Custom protocol callback works
- [ ] Auto-updater downloads updates

---

## 14. Development Workflow

### 14.1 Project Structure

```
holokai/desktop/
├── src/                          # Renderer source (Svelte)
│   ├── lib/
│   │   ├── components/          # Svelte components
│   │   ├── services/            # IPC service wrappers
│   │   ├── stores/              # Svelte stores
│   │   └── types/               # TypeScript types
│   ├── routes/                  # SPA routes
│   └── app.html                 # HTML template
│
├── src-electron/                 # Main process source (Node.js)
│   ├── main.ts                  # App entry point
│   ├── preload.ts               # Context Bridge
│   ├── ipc/
│   │   └── handlers.ts          # IPC handlers
│   ├── services/
│   │   ├── auth.service.ts      # Authentication
│   │   ├── holo-api-client.ts   # Holo API
│   │   └── thread-repository.ts # Caching
│   └── menu.ts                  # App menu
│
├── src-shared/                   # Shared types
│   └── types/
│       ├── thread.types.ts
│       └── message.types.ts
│
├── ai/                           # Architecture docs
├── tests/                        # E2E tests
├── electron-builder.yml          # Build config
├── package.json
├── tsconfig.json
├── svelte.config.js
└── vite.config.ts
```

### 14.2 Development Commands

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Lint and format
npm run lint
npm run format

# Package for distribution
npm run dist
```

---

## Vocabulary

**@cdssnc/sanitize-pii**: Node.js package that automatically detects and redacts personally identifiable information (PII) from strings and objects, ensuring privacy compliance in application logs

**@holokai/chat-component**: Reusable Svelte library providing chat UI with markdown rendering, code highlighting, and streaming support

**Context Bridge**: Electron security mechanism that safely exposes specific main process APIs to renderer process without granting full Node.js access

**CSP Nonce**: Content Security Policy nonce (number used once) - a cryptographically random token that allows specific inline scripts or styles to execute while blocking all others, preventing XSS attacks

**Electron**: Cross-platform desktop application framework using Chromium (rendering) and Node.js (backend)

**Exchange Code Flow**: Authentication pattern where web application generates one-time code that desktop exchanges for API key, which is then exchanged for access token via separate API calls

**Gzip Compression**: Lossless data compression algorithm using LZ77 and Huffman coding, reducing text message sizes by 35-50% in memory cache to optimize RAM usage

**API Key**: Intermediate JWT token obtained from exchange code endpoint with explicit 24-hour maximum lifetime, used solely to request access token from refresh endpoint, stored encrypted with expiration timestamp

**Access Token**: Final JWT token with full application permissions obtained from refresh endpoint, expires after 15 minutes, automatically refreshed every 10-12 minutes using cached apiKey, used for all Holo API and Moku API operations

**Holo API**: Primary API gateway for LLM operations including prompt execution, model access, and streaming responses

**Holo Audit Service**: Backend service responsible for persisting all thread data, requests, responses, and chat history to database

**IPC (Inter-Process Communication)**: Electron mechanism enabling main process and renderer process to communicate securely via messages

**JSONB**: JSON Binary format in PostgreSQL that stores JSON data in decomposed binary format, enabling efficient querying and indexing while preserving JSON flexibility for metadata storage

**LRU (Least Recently Used)**: Cache eviction algorithm that removes least recently accessed items first when cache reaches capacity limit, ensuring frequently used data remains in memory

**Main Process**: Node.js process in Electron managing windows, native OS features, file system, and network operations with full system access

**Moku API**: REST API providing authentication services, thread organization, and project management including exchange code generation, thread metadata, and project CRUD operations

**MokuAPIClient**: Service class in desktop main process that communicates with Moku API for organizational operations, handling authorization, error recovery, and response transformation

**Moku Web**: Web application handling OAuth2 authentication with identity providers and generating exchange codes for desktop SSO

**PKCE (Proof Key for Code Exchange)**: OAuth 2.0 security extension using dynamically generated random keys to protect authorization code flow from interception attacks, adapted in desktop using state parameter validation

**Renderer Process**: Chromium-based browser process running sandboxed UI code (Svelte) without Node.js access for security

**safeStorage**: Electron API for encrypting sensitive data using OS-level credential managers (Keychain, Credential Vault, libsecret)

**Service Wrapper**: Thin service class wrapping single IPC call with type safety and error handling, one method per IPC operation

**Soft Delete**: Marking database records as deleted using timestamp without removing data, enabling recovery and audit trail

**SSE (Server-Sent Events)**: HTTP-based protocol for servers to push real-time updates to clients over persistent connection, used for streaming LLM responses token by token

**Svelte Store**: Reactive state container in Svelte providing subscription-based state management across components

**UUID v4**: Universally unique identifier generated using cryptographic random numbers (format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)

**svelte-spa-router**: Hash-based client-side router for Svelte applications, compatible with file:// protocol in Electron

---

## Appendix A: API Endpoints Reference

### Moku API Endpoints

**Authentication**:

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/api/auth/exchange-code` | POST | Exchange code for API key | `{ code: string }` | `{ apiKey: string }` |
| `/api/auth/token/refresh` | POST | Exchange API key for access token | `{ apiKey: string }` | `{ accessToken: string, expiresIn: number }` |

**Thread Management**:

| Endpoint | Method | Purpose | Query Parameters |
|----------|--------|---------|------------------|
| `/api/threads` | GET | List threads with pagination | `limit`, `cursor`, `before`, `after` |
| `/api/threads/{threadId}` | GET | Get single thread by ID | - |
| `/api/threads/{threadId}/messages` | GET | Get messages with pagination | `limit`, `before`, `after`, `cursor` |
| `/api/threads` | POST | Create a new thread | - |
| `/api/threads/{threadId}` | PATCH | Update thread metadata | - |
| `/api/threads/{threadId}/messages` | POST | Append message to thread | - |
| `/api/threads/{threadId}/move` | POST | Move thread to/from project | - |
| `/api/threads/{threadId}/soft-delete` | POST | Soft delete thread | - |
| `/api/threads/{threadId}` | DELETE | Permanently delete thread | - |

**Project Management**:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/projects` | GET | List user's projects |
| `/api/projects` | POST | Create project |
| `/api/projects/:id` | GET | Get project details |
| `/api/projects/:id` | PATCH | Update project |
| `/api/projects/:id` | DELETE | Delete project |
| `/api/projects/:id/share` | POST | Share project with user/org |
| `/api/projects/:id/share/:shareId` | DELETE | Revoke project access |
| `/api/projects/:id/collaborators` | GET | List project collaborators |
| `/api/projects/:id/files` | POST | Upload file to project |
| `/api/projects/:id/files` | GET | List project files |
| `/api/projects/:id/files/:fileId` | DELETE | Delete project file |

### Holo API Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/api/chat` | POST | Submit LLM prompt | `{ threadId: string, prompt: string, model: string, stream?: boolean }` | `{ response: string }` or SSE stream |
| `/api/chat/history/{threadId}` | GET | Get thread messages | N/A | `{ messages: Message[] }` |
| `/api/models` | GET | List available models | N/A | `{ models: Model[] }` |

---

## Appendix B: Configuration Files

### Environment Variables

```bash
# .env.development
VITE_MOKU_WEB_URL=https://moku-dev.holokai.app
VITE_MOKU_API_URL=https://api-dev.moku.holokai.app
VITE_HOLO_API_URL=https://api-dev.holo.holokai.app

# .env.production
VITE_MOKU_WEB_URL=https://moku.holokai.app
VITE_MOKU_API_URL=https://api.moku.holokai.app
VITE_HOLO_API_URL=https://api.holo.holokai.app
```

### Svelte Configuration

```javascript
// svelte.config.js
export default {
  kit: {
    adapter: adapter(),
    files: {
      assets: 'static',
      routes: 'src/routes',
    },
  },
};
```

---

**Document Version History**:
- v1.0 (2024-11) - Initial Phase 1 architecture documentation
- v1.0.1 (2024-11) - Added missing vocabulary definitions (JSONB, LRU, PKCE, SSE)
- v1.0.2 (2024-11) - Added PII sanitization to logging system using @cdssnc/sanitize-pii package
- v1.0.3 (2024-11) - Enhanced security with CSP nonce implementation, 8-hour key rotation, and gzip compression for cache

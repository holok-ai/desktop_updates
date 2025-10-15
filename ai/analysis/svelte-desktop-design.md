# Holokai Desktop Application - Design Document (Svelte)

**Project:** Holokai AI Desktop Client  
**Framework:** Svelte 5 + Electron  
**Version:** 1.0  
**Date:** October 14, 2025  
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Technology Stack](#3-technology-stack)
4. [Component Architecture](#4-component-architecture)
5. [State Management](#5-state-management)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Data Flow & Communication](#7-data-flow--communication)
8. [Security Considerations](#8-security-considerations)
9. [File Structure](#9-file-structure)
10. [Development Setup](#10-development-setup)
11. [Build & Distribution](#11-build--distribution)
12. [Testing Strategy](#12-testing-strategy)
13. [Performance Optimization](#13-performance-optimization)
14. [Future Considerations](#14-future-considerations)

---

## 1. Executive Summary

### 1.1 Purpose

This document outlines the technical design for the Holokai Desktop application, a cross-platform Electron-based desktop client that provides a native experience for interacting with multiple AI providers (Claude, OpenAI, Ollama). The application leverages **Svelte 5** for the UI layer, **Svelte stores** for state management, and integrates with the existing `@holokai/chat-component` library for chat functionality.

### 1.2 Key Design Goals

- **Cross-platform compatibility**: Windows, macOS, Linux
- **Native feel**: OS-integrated UI with proper window controls, notifications, and system integration
- **Security**: Secure OAuth flows, credential storage via Electron safeStorage, IPC sandboxing
- **Performance**: Compiler-based approach with zero runtime overhead, efficient bundle sizes
- **Maintainability**: Clear separation of concerns, reusable components, comprehensive testing
- **Cloud-first**: All chat data persisted to Moku API - no local database

### 1.3 Target Users

- Consultants and professionals requiring desktop AI chat capabilities
- Users who prefer native applications over web interfaces
- Teams needing multi-provider AI access in a unified interface

---

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
│  │  Svelte 5 UI Components                        │     │
│  │  - LoginScreen.svelte                          │     │
│  │  - ThreadList.svelte                           │     │
│  │  - ChatWindow.svelte (reused from component)   │     │
│  │  - ModelSelector.svelte                        │     │
│  │  - Sidebar.svelte                              │     │
│  └────────────────────────────────────────────────┘     │
│                                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │  State Management (Svelte Stores)              │     │
│  │  - authStore (user, isAuthenticated)           │     │
│  │  - threadsStore (thread list, active thread)   │     │
│  │  - modelsStore (available models, selected)    │     │
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
Svelte Component
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
Svelte Store Update
    ↓
UI Re-render (Svelte reactivity)
```

---

## 3. Technology Stack

### 3.1 Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Electron** | 28.x | Desktop app framework |
| **Svelte** | 5.x | UI framework with compiler-based reactivity |
| **TypeScript** | 5.3.x | Type safety |
| **Vite** | 5.x | Build tool & dev server |
| **Electron Builder** | 24.x | Packaging & distribution |

### 3.2 UI & Styling

| Technology | Purpose |
|------------|---------|
| **Tailwind CSS** | Utility-first styling |
| **Holokai Design Tokens** | Consistent theming (CSS custom properties) |
| **Lucide Icons** | Icon library |

### 3.3 Key Dependencies

```json
{
  "dependencies": {
    "svelte": "^5.0.0",
    "@holokai/chat-component": "^1.0.0",
    "electron-store": "^8.1.0",
    "electron-log": "^5.0.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.0",
    "vite": "^5.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.1.0",
    "@testing-library/svelte": "^4.0.0"
  }
}
```

**Note:** No local database dependency (like SQLite) is included. All chat data persistence is handled via the Moku API.

---

## 4. Component Architecture

### 4.1 Component Hierarchy

```
App.svelte (Root)
│
├── LoginScreen.svelte (Full-screen overlay)
│   ├── OAuthButton.svelte
│   └── Logo.svelte
│
├── AppLayout.svelte (Main authenticated layout)
│   │
│   ├── Sidebar.svelte (Left panel)
│   │   ├── ThreadList.svelte
│   │   │   └── ThreadItem.svelte
│   │   ├── NewThreadButton.svelte
│   │   └── UserProfile.svelte
│   │
│   └── MainContent.svelte (Right panel)
│       │
│       ├── ChatHeader.svelte
│       │   ├── ModelSelector.svelte
│       │   └── ThreadTitle.svelte
│       │
│       ├── ChatWindow.svelte (from @holokai/chat-component)
│       │   ├── MessageList.svelte
│       │   │   └── MessageItem.svelte
│       │   ├── MessageInput.svelte
│       │   └── StreamingIndicator.svelte
│       │
│       └── ChatFooter.svelte
│           └── StatusBar.svelte
```

### 4.2 Key Components

#### 4.2.1 LoginScreen.svelte

```svelte
<script lang="ts">
  import { authStore } from '$lib/stores/auth'
  import OAuthButton from './OAuthButton.svelte'
  
  let isLoading = $state(false)
  
  async function handleLogin() {
    isLoading = true
    try {
      await authStore.login()
    } catch (error) {
      console.error('Login failed:', error)
    } finally {
      isLoading = false
    }
  }
</script>

<div class="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
  <div class="w-full max-w-md space-y-8 p-8">
    <div class="text-center">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
        Welcome to Holokai
      </h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        Sign in to continue
      </p>
    </div>
    
    <OAuthButton 
      loading={isLoading} 
      onclick={handleLogin}
    />
  </div>
</div>
```

#### 4.2.2 ThreadList.svelte

```svelte
<script lang="ts">
  import { threadsStore } from '$lib/stores/threads'
  import ThreadItem from './ThreadItem.svelte'
  
  const { threads, activeThreadId } = threadsStore
  
  function selectThread(threadId: string) {
    threadsStore.setActiveThread(threadId)
  }
  
  function deleteThread(threadId: string) {
    threadsStore.deleteThread(threadId)
  }
</script>

<div class="flex flex-col h-full">
  <div class="flex-1 overflow-y-auto p-4 space-y-2">
    {#each $threads as thread (thread.id)}
      <ThreadItem
        {thread}
        active={thread.id === $activeThreadId}
        onselect={() => selectThread(thread.id)}
        ondelete={() => deleteThread(thread.id)}
      />
    {/each}
  </div>
</div>
```

#### 4.2.3 ModelSelector.svelte

```svelte
<script lang="ts">
  import { modelsStore } from '$lib/stores/models'
  import { ChevronDown } from 'lucide-svelte'
  
  const { availableModels, selectedModel } = modelsStore
  
  function handleChange(event: Event) {
    const target = event.target as HTMLSelectElement
    modelsStore.setSelectedModel(target.value)
  }
</script>

<div class="relative">
  <select
    value={$selectedModel}
    onchange={handleChange}
    class="appearance-none bg-white dark:bg-gray-800 border border-gray-300 
           dark:border-gray-600 rounded-lg px-4 py-2 pr-10 
           focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    {#each $availableModels as model (model.id)}
      <option value={model.id}>
        {model.name}
      </option>
    {/each}
  </select>
  <ChevronDown 
    class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 
           text-gray-500 pointer-events-none"
  />
</div>
```

---

## 5. State Management

### 5.1 Svelte Store Architecture

Svelte 5's runes-based reactivity provides a streamlined state management approach. We'll use custom stores for global state.

#### 5.1.1 Auth Store

```typescript
// lib/stores/auth.ts
import { writable, derived } from 'svelte/store'

interface User {
  id: string
  email: string
  name: string
}

function createAuthStore() {
  const { subscribe, set, update } = writable<{
    user: User | null
    accessToken: string | null
    refreshToken: string | null
  }>({
    user: null,
    accessToken: null,
    refreshToken: null
  })

  return {
    subscribe,
    
    async login() {
      // Trigger OAuth flow via IPC
      const result = await window.electron.auth.startOAuthFlow()
      
      if (result.success) {
        set({
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        })
      } else {
        throw new Error(result.error)
      }
    },

    async logout() {
      await window.electron.auth.logout()
      set({
        user: null,
        accessToken: null,
        refreshToken: null
      })
    },

    async refreshAccessToken() {
      const state = get(authStore)
      if (!state.refreshToken) return

      const result = await window.electron.auth.refreshToken(state.refreshToken)
      if (result.success) {
        update(s => ({
          ...s,
          accessToken: result.accessToken
        }))
      } else {
        // Refresh failed, force re-login
        await this.logout()
      }
    }
  }
}

export const authStore = createAuthStore()

export const isAuthenticated = derived(
  authStore,
  $auth => !!$auth.user && !!$auth.accessToken
)
```

#### 5.1.2 Threads Store

```typescript
// lib/stores/threads.ts
import { writable, derived, get } from 'svelte/store'

interface Thread {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  provider: 'claude' | 'openai' | 'ollama'
  model: string
}

function createThreadsStore() {
  const threads = writable<Thread[]>([])
  const activeThreadId = writable<string | null>(null)
  const isLoading = writable(false)

  return {
    threads: { subscribe: threads.subscribe },
    activeThreadId: { subscribe: activeThreadId.subscribe },
    isLoading: { subscribe: isLoading.subscribe },

    activeThread: derived(
      [threads, activeThreadId],
      ([$threads, $activeThreadId]) =>
        $threads.find(t => t.id === $activeThreadId)
    ),

    async loadThreads() {
      isLoading.set(true)
      try {
        // Fetch from Moku API via IPC
        const result = await window.electron.threads.getAll()
        threads.set(result)
      } finally {
        isLoading.set(false)
      }
    },

    async createThread(provider: string, model: string) {
      // Create via Moku API
      const result = await window.electron.threads.create({ provider, model })
      threads.update(t => [...t, result])
      activeThreadId.set(result.id)
      return result
    },

    async deleteThread(threadId: string) {
      // Delete via Moku API
      await window.electron.threads.delete(threadId)
      threads.update(t => t.filter(thread => thread.id !== threadId))
      
      const currentActive = get(activeThreadId)
      if (currentActive === threadId) {
        const remaining = get(threads)
        activeThreadId.set(remaining[0]?.id || null)
      }
    },

    setActiveThread(threadId: string) {
      activeThreadId.set(threadId)
    }
  }
}

export const threadsStore = createThreadsStore()
```

#### 5.1.3 Models Store

```typescript
// lib/stores/models.ts
import { writable, derived } from 'svelte/store'

interface Model {
  id: string
  name: string
  provider: 'claude' | 'openai' | 'ollama'
  contextWindow: number
  supportsStreaming: boolean
}

function createModelsStore() {
  const models = writable<Model[]>([])
  const selectedModelId = writable<string | null>(null)

  return {
    models: { subscribe: models.subscribe },
    selectedModelId: { subscribe: selectedModelId.subscribe },

    availableModels: derived(models, $models => $models),
    
    selectedModel: derived(
      [models, selectedModelId],
      ([$models, $selectedModelId]) =>
        $models.find(m => m.id === $selectedModelId)
    ),

    async loadModels() {
      const result = await window.electron.models.getAvailable()
      models.set(result)
      
      const current = get(selectedModelId)
      if (!current && result.length > 0) {
        selectedModelId.set(result[0].id)
      }
    },

    setSelectedModel(modelId: string) {
      selectedModelId.set(modelId)
    }
  }
}

export const modelsStore = createModelsStore()
```

---

## 6. Authentication & Authorization

### 6.1 OAuth 2.0 Flow with PKCE

The application uses OAuth 2.0 with PKCE (Proof Key for Code Exchange) for secure authentication.

#### 6.1.1 Flow Diagram

```
┌─────────┐                                          ┌─────────┐
│  User   │                                          │  Auth   │
│         │                                          │ Server  │
└────┬────┘                                          └────┬────┘
     │                                                    │
     │ 1. Click "Sign In"                                │
     │─────────────────────────────────────►             │
     │                                     Main Process  │
     │                                     generates:    │
     │                                     - code_verifier│
     │                                     - code_challenge│
     │                                                    │
     │ 2. Open browser with OAuth URL                    │
     │    + code_challenge                               │
     │────────────────────────────────────────────────► │
     │                                                    │
     │ 3. User authenticates                             │
     │ ◄─────────────────────────────────────────────── │
     │                                                    │
     │ 4. Redirect to holokai://callback?code=XXX        │
     │ ◄─────────────────────────────────────────────── │
     │                                                    │
     │    Main Process intercepts custom protocol        │
     │                                                    │
     │ 5. Exchange code for tokens                       │
     │    POST /token                                    │
     │    + code                                         │
     │    + code_verifier                                │
     │────────────────────────────────────────────────► │
     │                                                    │
     │ 6. Returns access_token + refresh_token           │
     │ ◄─────────────────────────────────────────────── │
     │                                                    │
     │    Store tokens securely (safeStorage)            │
     │                                                    │
```

#### 6.1.2 Main Process Auth Service

```typescript
// main/services/AuthService.ts
import { BrowserWindow, shell } from 'electron'
import crypto from 'crypto'
import axios from 'axios'

export class AuthService {
  private codeVerifier: string | null = null
  
  generatePKCEPair() {
    // Generate random code verifier
    this.codeVerifier = crypto.randomBytes(32).toString('base64url')
    
    // Create code challenge
    const codeChallenge = crypto
      .createHash('sha256')
      .update(this.codeVerifier)
      .digest('base64url')
    
    return { codeVerifier: this.codeVerifier, codeChallenge }
  }
  
  async startOAuthFlow(): Promise<AuthResult> {
    const { codeChallenge } = this.generatePKCEPair()
    
    const authUrl = new URL('https://auth.holokai.com/oauth/authorize')
    authUrl.searchParams.set('client_id', process.env.OAUTH_CLIENT_ID!)
    authUrl.searchParams.set('redirect_uri', 'holokai://callback')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('scope', 'read write')
    
    // Open in default browser
    await shell.openExternal(authUrl.toString())
    
    // The callback will be intercepted by protocol handler
    // Return promise that resolves when auth completes
    return new Promise((resolve) => {
      // Store resolver to be called by protocol handler
      this.authResolver = resolve
    })
  }
  
  async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    const response = await axios.post('https://auth.holokai.com/oauth/token', {
      grant_type: 'authorization_code',
      code,
      code_verifier: this.codeVerifier,
      client_id: process.env.OAUTH_CLIENT_ID,
      redirect_uri: 'holokai://callback'
    })
    
    return response.data
  }
  
  async handleCallback(url: string) {
    const urlObj = new URL(url)
    const code = urlObj.searchParams.get('code')
    
    if (!code) {
      this.authResolver?.({ success: false, error: 'No code received' })
      return
    }
    
    try {
      const tokens = await this.exchangeCodeForTokens(code)
      const user = await this.fetchUserInfo(tokens.access_token)
      
      // Store tokens securely
      await this.secureStorageService.setTokens(tokens)
      
      this.authResolver?.({
        success: true,
        user,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token
      })
    } catch (error) {
      this.authResolver?.({ success: false, error: error.message })
    }
  }
}
```

### 6.2 Secure Token Storage

```typescript
// main/services/SecureStorageService.ts
import { safeStorage } from 'electron'
import Store from 'electron-store'

interface SecureData {
  accessToken?: Buffer
  refreshToken?: Buffer
  apiKeys?: Record<string, Buffer>
}

export class SecureStorageService {
  private store: Store<SecureData>
  
  constructor() {
    this.store = new Store({
      name: 'secure-storage',
      encryptionKey: 'holokai-desktop-v1'
    })
  }
  
  async setAccessToken(token: string) {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token)
      this.store.set('accessToken', encrypted)
    } else {
      throw new Error('Encryption not available')
    }
  }
  
  async getAccessToken(): Promise<string | null> {
    const encrypted = this.store.get('accessToken')
    if (!encrypted) return null
    
    return safeStorage.decryptString(encrypted)
  }
  
  async setAPIKey(provider: string, apiKey: string) {
    const keys = this.store.get('apiKeys', {})
    keys[provider] = safeStorage.encryptString(apiKey)
    this.store.set('apiKeys', keys)
  }
  
  async getAPIKey(provider: string): Promise<string | null> {
    const keys = this.store.get('apiKeys', {})
    const encrypted = keys[provider]
    if (!encrypted) return null
    
    return safeStorage.decryptString(encrypted)
  }
  
  clearAll() {
    this.store.clear()
  }
}
```

---

## 7. Data Flow & Communication

### 7.1 IPC Architecture

#### 7.1.1 Context Bridge (Preload Script)

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

#### 7.1.2 Main Process IPC Handlers

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

### 7.2 Chat Integration

The application integrates the `@holokai/chat-component` library, which handles the actual chat functionality.

```svelte
<script lang="ts">
  import { ChatWindow } from '@holokai/chat-component'
  import { threadsStore } from '$lib/stores/threads'
  import { modelsStore } from '$lib/stores/models'
  import { onMount } from 'svelte'
  
  const { activeThread } = threadsStore
  const { selectedModel } = modelsStore
  
  let apiKey = $state<string | null>(null)
  
  $effect(() => {
    if ($selectedModel) {
      window.electron.settings.get(`apiKey_${$selectedModel.provider}`)
        .then(key => apiKey = key)
    }
  })
  
  async function handleMessageSent(message: Message) {
    // Sync to Moku API via main process
    if ($activeThread) {
      await window.electron.threads.syncMessage($activeThread.id, message)
    }
  }
</script>

{#if apiKey && $selectedModel}
  <ChatWindow
    provider={$selectedModel.provider}
    model={$selectedModel.id}
    {apiKey}
    threadId={$activeThread?.id}
    onMessageSent={handleMessageSent}
    class="flex-1"
  />
{:else}
  <div class="flex items-center justify-center h-full">
    <p class="text-gray-500">Please configure API keys in settings</p>
  </div>
{/if}
```

### 7.3 Moku API Client Service

All thread and message data is persisted to the Moku API. The main process includes a service to handle these RESTful operations:

```typescript
// electron/services/MokuAPIClient.ts
import axios, { AxiosInstance } from 'axios'
import { app } from 'electron'

interface Thread {
  id: string
  title: string
  provider: string
  model: string
  createdAt: string
  updatedAt: string
}

interface Message {
  id: string
  threadId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export class MokuAPIClient {
  private client: AxiosInstance
  private accessToken: string | null = null

  constructor(baseURL: string = 'https://api.holokai.com') {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Holokai-Desktop/${app.getVersion()}`
      }
    })

    // Add auth interceptor
    this.client.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`
      }
      return config
    })
  }

  setAccessToken(token: string) {
    this.accessToken = token
  }

  // Thread operations
  async getThreads(): Promise<Thread[]> {
    const response = await this.client.get('/v1/threads')
    return response.data
  }

  async getThread(threadId: string): Promise<Thread> {
    const response = await this.client.get(`/v1/threads/${threadId}`)
    return response.data
  }

  async createThread(data: {
    title?: string
    provider: string
    model: string
  }): Promise<Thread> {
    const response = await this.client.post('/v1/threads', data)
    return response.data
  }

  async updateThread(threadId: string, data: Partial<Thread>): Promise<Thread> {
    const response = await this.client.patch(`/v1/threads/${threadId}`, data)
    return response.data
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.client.delete(`/v1/threads/${threadId}`)
  }

  // Message operations
  async getMessages(threadId: string): Promise<Message[]> {
    const response = await this.client.get(`/v1/threads/${threadId}/messages`)
    return response.data
  }

  async createMessage(threadId: string, message: {
    role: 'user' | 'assistant'
    content: string
  }): Promise<Message> {
    const response = await this.client.post(
      `/v1/threads/${threadId}/messages`,
      message
    )
    return response.data
  }

  // Batch sync for offline support (future)
  async syncMessages(threadId: string, messages: Message[]): Promise<void> {
    await this.client.post(`/v1/threads/${threadId}/messages/batch`, {
      messages
    })
  }
}
```

### 7.4 Main Process Thread Service

The main process service coordinates between IPC handlers and the Moku API:

```typescript
// electron/services/ThreadService.ts
import { MokuAPIClient } from './MokuAPIClient'
import { SecureStorageService } from './SecureStorageService'
import log from 'electron-log'

export class ThreadService {
  constructor(
    private mokuAPI: MokuAPIClient,
    private secureStorage: SecureStorageService
  ) {}

  async getAllThreads() {
    try {
      log.info('Fetching all threads from Moku API')
      const threads = await this.mokuAPI.getThreads()
      log.info(`Retrieved ${threads.length} threads`)
      return threads
    } catch (error) {
      log.error('Failed to fetch threads:', error)
      throw new Error('Failed to load threads from server')
    }
  }

  async createThread(data: { provider: string; model: string }) {
    try {
      log.info('Creating new thread:', { provider: data.provider, model: data.model })
      const thread = await this.mokuAPI.createThread({
        title: 'New Conversation',
        ...data
      })
      log.info('Thread created:', thread.id)
      return thread
    } catch (error) {
      log.error('Failed to create thread:', error)
      throw new Error('Failed to create thread')
    }
  }

  async deleteThread(threadId: string) {
    try {
      log.info('Deleting thread:', threadId)
      await this.mokuAPI.deleteThread(threadId)
      log.info('Thread deleted:', threadId)
    } catch (error) {
      log.error('Failed to delete thread:', error)
      throw new Error('Failed to delete thread')
    }
  }

  async syncMessage(threadId: string, message: any) {
    try {
      log.info('Syncing message to Moku API:', { threadId, role: message.role })
      await this.mokuAPI.createMessage(threadId, {
        role: message.role,
        content: message.content
      })
      log.info('Message synced successfully')
    } catch (error) {
      log.error('Failed to sync message:', error)
      // Don't throw - allow chat to continue even if sync fails
      // Could implement retry queue here for offline resilience
    }
  }
}
```

---

## 8. Security Considerations

### 8.1 Security Checklist

- ✅ **Context Isolation**: Enabled to prevent renderer from accessing Node APIs
- ✅ **Node Integration**: Disabled in renderer process
- ✅ **Content Security Policy**: Strict CSP headers
- ✅ **Secure Storage**: API keys and tokens encrypted using `safeStorage`
- ✅ **HTTPS Only**: All external API calls over HTTPS
- ✅ **Input Validation**: All IPC parameters validated
- ✅ **OAuth PKCE**: Enhanced OAuth security
- ✅ **No eval()**: No dynamic code execution
- ✅ **Sandboxed Renderer**: Renderer process runs in sandbox

### 8.2 Electron Security Configuration

```typescript
// main/index.ts
const mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  webPreferences: {
    // Security settings
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    
    // Preload script
    preload: path.join(__dirname, 'preload.js')
  }
})

// Set CSP headers
mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "connect-src 'self' https://api.anthropic.com https://api.openai.com",
        "font-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'"
      ].join('; ')
    }
  })
})
```

---

## 9. File Structure

```
holokai-desktop/
├── package.json
├── electron-builder.json
├── tsconfig.json
├── vite.config.ts
│
├── src/                          # Renderer process (Svelte)
│   ├── main.ts                   # Svelte app entry
│   ├── App.svelte                # Root component
│   │
│   ├── lib/
│   │   ├── components/           # Svelte components
│   │   │   ├── auth/
│   │   │   │   ├── LoginScreen.svelte
│   │   │   │   └── OAuthButton.svelte
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.svelte
│   │   │   │   ├── Sidebar.svelte
│   │   │   │   └── MainContent.svelte
│   │   │   ├── threads/
│   │   │   │   ├── ThreadList.svelte
│   │   │   │   ├── ThreadItem.svelte
│   │   │   │   └── NewThreadButton.svelte
│   │   │   ├── chat/
│   │   │   │   ├── ChatHeader.svelte
│   │   │   │   ├── ChatFooter.svelte
│   │   │   │   ├── ModelSelector.svelte
│   │   │   │   └── StatusBar.svelte
│   │   │   └── settings/
│   │   │       ├── SettingsModal.svelte
│   │   │       ├── APIKeyInput.svelte
│   │   │       └── ThemeToggle.svelte
│   │   │
│   │   ├── stores/               # Svelte stores
│   │   │   ├── auth.ts
│   │   │   ├── threads.ts
│   │   │   ├── models.ts
│   │   │   └── settings.ts
│   │   │
│   │   └── utils/                # Utilities
│   │       └── shortcuts.ts
│   │
│   ├── assets/                   # Static assets
│   │   ├── styles/
│   │   │   ├── app.css
│   │   │   └── tokens.css        # Holokai design tokens
│   │   └── icons/
│   │
│   └── types/                    # TypeScript types
│       ├── electron.d.ts
│       ├── thread.ts
│       └── models.ts
│
├── electron/                     # Main process
│   ├── main.ts                   # Electron main entry
│   ├── preload.ts                # Context bridge
│   │
│   ├── services/                 # Business logic
│   │   ├── AuthService.ts
│   │   ├── ThreadService.ts
│   │   ├── ModelService.ts
│   │   ├── SecureStorageService.ts
│   │   ├── MokuAPIClient.ts      # RESTful API client for persistence
│   │   └── LoggingService.ts
│   │
│   ├── ipc/                      # IPC handlers
│   │   ├── handlers.ts
│   │   ├── auth.ts
│   │   ├── threads.ts
│   │   └── settings.ts
│   │
│   └── utils/                    # Utilities
│       ├── crypto.ts
│       └── logger.ts
│
├── tests/                        # Test files
│   ├── unit/
│   │   ├── components/
│   │   └── stores/
│   ├── integration/
│   └── e2e/
│
└── resources/                    # Build resources
    ├── icon.png
    ├── icon.icns                 # macOS
    └── icon.ico                  # Windows
```

---

## 10. Development Setup

### 10.1 Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Git

### 10.2 Installation

```bash
# Clone repository
git clone https://github.com/holokai/desktop.git
cd desktop

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your OAuth credentials
```

### 10.3 Development Commands

```bash
# Run in development mode
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint

# Type check
pnpm type-check
```

### 10.4 Environment Variables

```env
# .env
VITE_OAUTH_CLIENT_ID=your_client_id
VITE_OAUTH_REDIRECT_URI=holokai://callback
VITE_MOKU_API_URL=https://api.holokai.com
VITE_APP_VERSION=1.0.0
```

---

## 11. Build & Distribution

### 11.1 Build Configuration

```json
{
  "build": {
    "appId": "com.holokai.desktop",
    "productName": "Holokai",
    "directories": {
      "output": "dist",
      "buildResources": "resources"
    },
    "files": [
      "dist-electron/**/*",
      "dist/**/*",
      "package.json"
    ],
    "mac": {
      "category": "public.app-category.productivity",
      "target": ["dmg", "zip"],
      "icon": "resources/icon.icns",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist"
    },
    "win": {
      "target": ["nsis", "portable"],
      "icon": "resources/icon.ico"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "icon": "resources/icon.png",
      "category": "Utility"
    }
  }
}
```

### 11.2 Auto-Update Configuration

```typescript
// electron/main.ts
import { autoUpdater } from 'electron-updater'

// Configure auto-updater
autoUpdater.checkForUpdatesAndNotify()

autoUpdater.on('update-available', () => {
  // Notify user
})

autoUpdater.on('update-downloaded', () => {
  // Prompt user to restart
})
```

---

## 12. Testing Strategy

### 12.1 Unit Tests (Vitest + Testing Library)

```typescript
// tests/unit/stores/auth.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { get } from 'svelte/store'
import { authStore } from '$lib/stores/auth'

describe('Auth Store', () => {
  beforeEach(() => {
    // Mock window.electron
    vi.stubGlobal('window', {
      electron: {
        auth: {
          startOAuthFlow: vi.fn(),
          logout: vi.fn()
        }
      }
    })
  })
  
  it('should initialize with null user', () => {
    const state = get(authStore)
    expect(state.user).toBeNull()
  })
  
  it('should set user on successful login', async () => {
    const mockUser = { id: '1', email: 'test@test.com', name: 'Test' }
    
    window.electron.auth.startOAuthFlow.mockResolvedValue({
      success: true,
      user: mockUser,
      accessToken: 'token123',
      refreshToken: 'refresh123'
    })
    
    await authStore.login()
    
    const state = get(authStore)
    expect(state.user).toEqual(mockUser)
  })
})
```

### 12.2 Component Tests

```typescript
// tests/unit/components/ThreadList.spec.ts
import { render, fireEvent } from '@testing-library/svelte'
import { describe, it, expect, vi } from 'vitest'
import ThreadList from '$lib/components/threads/ThreadList.svelte'
import { threadsStore } from '$lib/stores/threads'

describe('ThreadList', () => {
  it('renders threads from store', () => {
    const { getAllByTestId } = render(ThreadList)
    
    // Mock threads in store
    threadsStore.threads.set([
      { id: '1', title: 'Thread 1', createdAt: '2025-01-01' },
      { id: '2', title: 'Thread 2', createdAt: '2025-01-02' }
    ])
    
    expect(getAllByTestId('thread-item')).toHaveLength(2)
  })
  
  it('calls selectThread when thread is clicked', async () => {
    const selectThreadSpy = vi.spyOn(threadsStore, 'setActiveThread')
    
    const { getByTestId } = render(ThreadList)
    const threadItem = getByTestId('thread-item')
    
    await fireEvent.click(threadItem)
    
    expect(selectThreadSpy).toHaveBeenCalled()
  })
})
```

### 12.3 E2E Tests (Playwright)

```typescript
// tests/e2e/auth.spec.ts
import { test, expect, _electron as electron } from '@playwright/test'

test('complete authentication flow', async () => {
  const app = await electron.launch({ args: ['.'] })
  const window = await app.firstWindow()
  
  // Should show login screen
  await expect(window.locator('text=Sign in')).toBeVisible()
  
  // Click sign in button
  await window.click('button:has-text("Sign in with OAuth")')
  
  // Mock OAuth callback
  await app.evaluate(({ ipcMain }) => {
    ipcMain.emit('auth:callback', null, 'holokai://callback?code=test123')
  })
  
  // Should show main app
  await expect(window.locator('text=New Thread')).toBeVisible()
  
  await app.close()
})
```

---

## 13. Performance Optimization

### 13.1 Svelte 5 Runes for Reactivity

```svelte
<script lang="ts">
  import { threadsStore } from '$lib/stores/threads'
  
  // Fine-grained reactivity with runes
  let activeThread = $derived(
    $threadsStore.find(t => t.id === $activeThreadId)
  )
  
  // Computed values are automatically memoized
  let threadCount = $derived($threadsStore.length)
</script>
```

### 13.2 Lazy Loading

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  
  let SettingsModal
  let showSettings = $state(false)
  
  async function openSettings() {
    if (!SettingsModal) {
      // Lazy load component
      const module = await import('$lib/components/settings/SettingsModal.svelte')
      SettingsModal = module.default
    }
    showSettings = true
  }
</script>

{#if showSettings && SettingsModal}
  <svelte:component this={SettingsModal} />
{/if}
```

### 13.3 Virtual Scrolling

```svelte
<script lang="ts">
  import { VirtualList } from 'svelte-virtual-scroll-list'
  import { threadsStore } from '$lib/stores/threads'
  import ThreadItem from './ThreadItem.svelte'
  
  const { threads } = threadsStore
</script>

<VirtualList
  data={$threads}
  key="id"
  itemHeight={72}
  component={ThreadItem}
/>
```

---

## 14. Future Considerations

### 14.1 Planned Features

- **Offline Mode**: Local caching with sync queue for when network is unavailable
- **Multi-Window**: Support for separate settings/preferences window
- **Plugin System**: Allow custom AI provider plugins
- **Theme Support**: Custom themes beyond light/dark
- **Export/Import**: Backup threads to local files
- **Local Search**: Client-side search through synced threads

### 14.2 Performance Optimizations

- Message pagination for long threads
- Background thread sync
- Debounced API calls
- Service worker for caching (if implementing offline mode)

### 14.3 Monitoring and Analytics

- Error reporting (Sentry or similar)
- Usage analytics (privacy-respecting)
- Performance metrics
- Crash reporting

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Context Bridge** | Electron API for secure IPC between main and renderer |
| **PKCE** | Proof Key for Code Exchange - OAuth security extension |
| **IPC** | Inter-Process Communication between Electron processes |
| **Renderer Process** | Chromium process running UI code |
| **Main Process** | Node.js process managing app lifecycle |
| **Custom Protocol** | App-specific URL scheme (holokai://) |
| **Provider Pattern** | Design pattern for pluggable implementations |
| **Runes** | Svelte 5's signals-based reactivity primitives |
| **Derived State** | Computed values that update automatically |
| **Store** | Reactive state container in Svelte |
| **AppData** | User-specific application data directory |

---

## Appendix B: References

- [Electron Documentation](https://www.electronjs.org/docs)
- [Svelte 5 Documentation](https://svelte.dev/)
- [Svelte Stores](https://svelte.dev/docs/svelte-store)
- [OAuth 2.0 PKCE Specification](https://datatracker.ietf.org/doc/html/rfc7636)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Anthropic API Documentation](https://docs.anthropic.com/)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [electron-log Documentation](https://github.com/megahertz/electron-log)

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-14 | Architecture Team | Initial version (Svelte variant) |

---

**Approval**

This document requires approval from:
- [ ] Technical Lead
- [ ] Security Team
- [ ] Product Owner

---

*End of Document*
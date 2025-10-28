# Holokai Desktop Application - Design Document (Vue.js)

**Project:** Holokai AI Desktop Client  
**Framework:** Vue 3 + Electron  
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

This document outlines the technical design for the Holokai Desktop application, a cross-platform Electron-based desktop client that provides a native experience for interacting with multiple AI providers (Claude, OpenAI, Ollama). The application leverages **Vue 3 with Composition API** for the UI layer, **Pinia** for state management, and integrates with the existing `@holokai/chat-component` library for chat functionality.

### 1.2 Key Design Goals

- **Cross-platform compatibility**: Windows, macOS, Linux
- **Native feel**: OS-integrated UI with proper window controls, notifications, and system integration
- **Security**: Secure OAuth flows, credential storage via Electron safeStorage, IPC sandboxing
- **Performance**: Efficient rendering, lazy loading, optimized bundle sizes
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
│  │  Vue 3 UI Components                           │     │
│  │  - LoginScreen.vue                             │     │
│  │  - ThreadList.vue                              │     │
│  │  - ChatWindow.vue (reused from component)      │     │
│  │  - ModelSelector.vue                           │     │
│  │  - Sidebar.vue                                 │     │
│  └────────────────────────────────────────────────┘     │
│                                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │  State Management (Pinia Stores)               │     │
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
Vue Component
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
Pinia Store Update
    ↓
UI Re-render (Vue reactivity)
```

---

## 3. Technology Stack

### 3.1 Core Technologies

| Technology           | Version | Purpose                           |
| -------------------- | ------- | --------------------------------- |
| **Electron**         | 28.x    | Desktop app framework             |
| **Vue**              | 3.4.x   | UI framework with Composition API |
| **Pinia**            | 2.1.x   | State management                  |
| **TypeScript**       | 5.3.x   | Type safety                       |
| **Vite**             | 5.x     | Build tool & dev server           |
| **Electron Builder** | 24.x    | Packaging & distribution          |

### 3.2 UI & Styling

| Technology                | Purpose                                    |
| ------------------------- | ------------------------------------------ |
| **Tailwind CSS**          | Utility-first styling                      |
| **Holokai Design Tokens** | Consistent theming (CSS custom properties) |
| **Headless UI**           | Accessible component primitives            |
| **Lucide Icons**          | Icon library                               |

### 3.3 Key Dependencies

```json
{
  "dependencies": {
    "vue": "^3.4.0",
    "pinia": "^2.1.0",
    "@holokai/chat-component": "^1.0.0",
    "electron-store": "^8.1.0",
    "electron-log": "^5.0.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.0",
    "vite": "^5.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.1.0",
    "@vue/test-utils": "^2.4.0"
  }
}
```

**Note:** No local database dependency (like SQLite) is included. All chat data persistence is handled via the Moku API.

---

## 4. Component Architecture

### 4.1 Component Hierarchy

```
App.vue (Root)
│
├── LoginScreen.vue (Full-screen overlay)
│   ├── OAuthButton.vue
│   └── Logo.vue
│
├── AppLayout.vue (Main authenticated layout)
│   │
│   ├── Sidebar.vue (Left panel)
│   │   ├── ThreadList.vue
│   │   │   └── ThreadItem.vue
│   │   ├── NewThreadButton.vue
│   │   └── UserProfile.vue
│   │
│   └── MainContent.vue (Right panel)
│       │
│       ├── ChatHeader.vue
│       │   ├── ModelSelector.vue
│       │   └── ThreadTitle.vue
│       │
│       ├── ChatWindow.vue (from @holokai/chat-component)
│       │   ├── MessageList.vue
│       │   │   └── MessageItem.vue
│       │   ├── MessageInput.vue
│       │   └── StreamingIndicator.vue
│       │
│       └── ChatFooter.vue
│           └── StatusBar.vue
```

### 4.2 Key Components

#### 4.2.1 LoginScreen.vue

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import OAuthButton from './OAuthButton.vue';

const authStore = useAuthStore();
const isLoading = ref(false);

async function handleLogin() {
  isLoading.value = true;
  try {
    await authStore.login();
  } catch (error) {
    console.error('Login failed:', error);
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div class="w-full max-w-md space-y-8 p-8">
      <div class="text-center">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Welcome to Holokai</h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">Sign in to continue</p>
      </div>

      <OAuthButton :loading="isLoading" @click="handleLogin" />
    </div>
  </div>
</template>
```

#### 4.2.2 ThreadList.vue

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useThreadsStore } from '@/stores/threads';
import ThreadItem from './ThreadItem.vue';

const threadsStore = useThreadsStore();

const threads = computed(() => threadsStore.threads);
const activeThreadId = computed(() => threadsStore.activeThreadId);

function selectThread(threadId: string) {
  threadsStore.setActiveThread(threadId);
}

function deleteThread(threadId: string) {
  threadsStore.deleteThread(threadId);
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex-1 overflow-y-auto p-4 space-y-2">
      <ThreadItem
        v-for="thread in threads"
        :key="thread.id"
        :thread="thread"
        :active="thread.id === activeThreadId"
        @select="selectThread(thread.id)"
        @delete="deleteThread(thread.id)"
      />
    </div>
  </div>
</template>
```

#### 4.2.3 ModelSelector.vue

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useModelsStore } from '@/stores/models';
import { ChevronDown } from 'lucide-vue-next';

const modelsStore = useModelsStore();

const availableModels = computed(() => modelsStore.availableModels);
const selectedModel = computed({
  get: () => modelsStore.selectedModel,
  set: (value) => modelsStore.setSelectedModel(value),
});
</script>

<template>
  <div class="relative">
    <select
      v-model="selectedModel"
      class="appearance-none bg-white dark:bg-gray-800 border border-gray-300 
             dark:border-gray-600 rounded-lg px-4 py-2 pr-10 
             focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option v-for="model in availableModels" :key="model.id" :value="model.id">
        {{ model.name }}
      </option>
    </select>
    <ChevronDown
      class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 
             text-gray-500 pointer-events-none"
    />
  </div>
</template>
```

---

## 5. State Management

### 5.1 Pinia Store Architecture

Pinia provides a modular, TypeScript-friendly state management solution with excellent devtools integration.

#### 5.1.1 Auth Store

```typescript
// stores/auth.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface User {
  id: string;
  email: string;
  name: string;
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null);
  const accessToken = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);

  // Getters
  const isAuthenticated = computed(() => !!user.value && !!accessToken.value);

  // Actions
  async function login() {
    // Trigger OAuth flow via IPC
    const result = await window.electron.auth.startOAuthFlow();

    if (result.success) {
      user.value = result.user;
      accessToken.value = result.accessToken;
      refreshToken.value = result.refreshToken;
    } else {
      throw new Error(result.error);
    }
  }

  async function logout() {
    await window.electron.auth.logout();
    user.value = null;
    accessToken.value = null;
    refreshToken.value = null;
  }

  async function refreshAccessToken() {
    const result = await window.electron.auth.refreshToken(refreshToken.value!);
    if (result.success) {
      accessToken.value = result.accessToken;
    } else {
      // Refresh failed, force re-login
      await logout();
    }
  }

  return {
    user,
    accessToken,
    isAuthenticated,
    login,
    logout,
    refreshAccessToken,
  };
});
```

#### 5.1.2 Threads Store

```typescript
// stores/threads.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface Thread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  provider: 'claude' | 'openai' | 'ollama';
  model: string;
}

export const useThreadsStore = defineStore('threads', () => {
  // State
  const threads = ref<Thread[]>([]);
  const activeThreadId = ref<string | null>(null);
  const isLoading = ref(false);

  // Getters
  const activeThread = computed(() => threads.value.find((t) => t.id === activeThreadId.value));

  const sortedThreads = computed(() =>
    [...threads.value].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    ),
  );

  // Actions
  async function loadThreads() {
    isLoading.value = true;
    try {
      // Fetch from Moku API via IPC
      const result = await window.electron.threads.getAll();
      threads.value = result;
    } finally {
      isLoading.value = false;
    }
  }

  async function createThread(provider: string, model: string) {
    // Create via Moku API
    const result = await window.electron.threads.create({ provider, model });
    threads.value.push(result);
    activeThreadId.value = result.id;
    return result;
  }

  async function deleteThread(threadId: string) {
    // Delete via Moku API
    await window.electron.threads.delete(threadId);
    threads.value = threads.value.filter((t) => t.id !== threadId);

    if (activeThreadId.value === threadId) {
      activeThreadId.value = threads.value[0]?.id || null;
    }
  }

  function setActiveThread(threadId: string) {
    activeThreadId.value = threadId;
  }

  return {
    threads,
    activeThreadId,
    activeThread,
    sortedThreads,
    isLoading,
    loadThreads,
    createThread,
    deleteThread,
    setActiveThread,
  };
});
```

#### 5.1.3 Models Store

```typescript
// stores/models.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface Model {
  id: string;
  name: string;
  provider: 'claude' | 'openai' | 'ollama';
  contextWindow: number;
  supportsStreaming: boolean;
}

export const useModelsStore = defineStore('models', () => {
  // State
  const models = ref<Model[]>([]);
  const selectedModelId = ref<string | null>(null);

  // Getters
  const selectedModel = computed(() => models.value.find((m) => m.id === selectedModelId.value));

  const availableModels = computed(() => models.value);

  const modelsByProvider = computed(() => {
    const grouped: Record<string, Model[]> = {};
    models.value.forEach((model) => {
      if (!grouped[model.provider]) {
        grouped[model.provider] = [];
      }
      grouped[model.provider].push(model);
    });
    return grouped;
  });

  // Actions
  async function loadModels() {
    const result = await window.electron.models.getAvailable();
    models.value = result;

    if (!selectedModelId.value && models.value.length > 0) {
      selectedModelId.value = models.value[0].id;
    }
  }

  function setSelectedModel(modelId: string) {
    selectedModelId.value = modelId;
  }

  return {
    models,
    selectedModelId,
    selectedModel,
    availableModels,
    modelsByProvider,
    loadModels,
    setSelectedModel,
  };
});
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
import { BrowserWindow, shell } from 'electron';
import crypto from 'crypto';
import axios from 'axios';

export class AuthService {
  private codeVerifier: string | null = null;

  generatePKCEPair() {
    // Generate random code verifier
    this.codeVerifier = crypto.randomBytes(32).toString('base64url');

    // Create code challenge
    const codeChallenge = crypto.createHash('sha256').update(this.codeVerifier).digest('base64url');

    return { codeVerifier: this.codeVerifier, codeChallenge };
  }

  async startOAuthFlow(): Promise<AuthResult> {
    const { codeChallenge } = this.generatePKCEPair();

    const authUrl = new URL('https://auth.holokai.com/oauth/authorize');
    authUrl.searchParams.set('client_id', process.env.OAUTH_CLIENT_ID!);
    authUrl.searchParams.set('redirect_uri', 'holokai://callback');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('scope', 'read write');

    // Open in default browser
    await shell.openExternal(authUrl.toString());

    // The callback will be intercepted by protocol handler
    // Return promise that resolves when auth completes
    return new Promise((resolve) => {
      // Store resolver to be called by protocol handler
      this.authResolver = resolve;
    });
  }

  async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    const response = await axios.post('https://auth.holokai.com/oauth/token', {
      grant_type: 'authorization_code',
      code,
      code_verifier: this.codeVerifier,
      client_id: process.env.OAUTH_CLIENT_ID,
      redirect_uri: 'holokai://callback',
    });

    return response.data;
  }

  async handleCallback(url: string) {
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');

    if (!code) {
      this.authResolver?.({ success: false, error: 'No code received' });
      return;
    }

    try {
      const tokens = await this.exchangeCodeForTokens(code);
      const user = await this.fetchUserInfo(tokens.access_token);

      // Store tokens securely
      await this.secureStorageService.setTokens(tokens);

      this.authResolver?.({
        success: true,
        user,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
    } catch (error) {
      this.authResolver?.({ success: false, error: error.message });
    }
  }
}
```

### 6.2 Secure Token Storage

```typescript
// main/services/SecureStorageService.ts
import { safeStorage } from 'electron';
import Store from 'electron-store';

interface SecureData {
  accessToken?: Buffer;
  refreshToken?: Buffer;
  apiKeys?: Record<string, Buffer>;
}

export class SecureStorageService {
  private store: Store<SecureData>;

  constructor() {
    this.store = new Store({
      name: 'secure-storage',
      encryptionKey: 'holokai-desktop-v1',
    });
  }

  async setAccessToken(token: string) {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token);
      this.store.set('accessToken', encrypted);
    } else {
      throw new Error('Encryption not available');
    }
  }

  async getAccessToken(): Promise<string | null> {
    const encrypted = this.store.get('accessToken');
    if (!encrypted) return null;

    return safeStorage.decryptString(encrypted);
  }

  async setAPIKey(provider: string, apiKey: string) {
    const keys = this.store.get('apiKeys', {});
    keys[provider] = safeStorage.encryptString(apiKey);
    this.store.set('apiKeys', keys);
  }

  async getAPIKey(provider: string): Promise<string | null> {
    const keys = this.store.get('apiKeys', {});
    const encrypted = keys[provider];
    if (!encrypted) return null;

    return safeStorage.decryptString(encrypted);
  }

  clearAll() {
    this.store.clear();
  }
}
```

---

## 7. Data Flow & Communication

### 7.1 IPC Architecture

#### 7.1.1 Context Bridge (Preload Script)

```typescript
// preload/index.ts
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

#### 7.1.2 Main Process IPC Handlers

```typescript
// main/ipc/handlers.ts
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

### 7.2 Chat Integration

The application integrates the `@holokai/chat-component` library, which handles the actual chat functionality.

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ChatWindow } from '@holokai/chat-component';
import { useThreadsStore } from '@/stores/threads';
import { useModelsStore } from '@/stores/models';
import { useAuthStore } from '@/stores/auth';

const threadsStore = useThreadsStore();
const modelsStore = useModelsStore();
const authStore = useAuthStore();

const activeThread = computed(() => threadsStore.activeThread);
const selectedModel = computed(() => modelsStore.selectedModel);

// Get API key for selected provider from secure storage
const apiKey = ref<string | null>(null);

watch(
  selectedModel,
  async (model) => {
    if (model) {
      apiKey.value = await window.electron.settings.get(`apiKey_${model.provider}`);
    }
  },
  { immediate: true },
);

// Chat configuration
const chatConfig = computed(() => ({
  provider: selectedModel.value?.provider || 'claude',
  model: selectedModel.value?.id || 'claude-sonnet-4-20250514',
  apiKey: apiKey.value || '',
  threadId: activeThread.value?.id,
  onMessageSent: async (message: Message) => {
    // Sync to Moku API via main process
    await window.electron.threads.syncMessage(activeThread.value!.id, message);
  },
}));
</script>

<template>
  <div class="flex flex-col h-full">
    <ChatWindow v-if="apiKey" v-bind="chatConfig" class="flex-1" />
    <div v-else class="flex items-center justify-center h-full">
      <p class="text-gray-500">Please configure API keys in settings</p>
    </div>
  </div>
</template>
```

### 7.3 Moku API Client Service

All thread and message data is persisted to the Moku API. The main process includes a service to handle these RESTful operations:

```typescript
// electron/services/MokuAPIClient.ts
import axios, { AxiosInstance } from 'axios';
import { app } from 'electron';

interface Thread {
  id: string;
  title: string;
  provider: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  threadId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export class MokuAPIClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor(baseURL: string = 'https://api.holokai.com') {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Holokai-Desktop/${app.getVersion()}`,
      },
    });

    // Add auth interceptor
    this.client.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  // Thread operations
  async getThreads(): Promise<Thread[]> {
    const response = await this.client.get('/v1/threads');
    return response.data;
  }

  async getThread(threadId: string): Promise<Thread> {
    const response = await this.client.get(`/v1/threads/${threadId}`);
    return response.data;
  }

  async createThread(data: { title?: string; provider: string; model: string }): Promise<Thread> {
    const response = await this.client.post('/v1/threads', data);
    return response.data;
  }

  async updateThread(threadId: string, data: Partial<Thread>): Promise<Thread> {
    const response = await this.client.patch(`/v1/threads/${threadId}`, data);
    return response.data;
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.client.delete(`/v1/threads/${threadId}`);
  }

  // Message operations
  async getMessages(threadId: string): Promise<Message[]> {
    const response = await this.client.get(`/v1/threads/${threadId}/messages`);
    return response.data;
  }

  async createMessage(
    threadId: string,
    message: {
      role: 'user' | 'assistant';
      content: string;
    },
  ): Promise<Message> {
    const response = await this.client.post(`/v1/threads/${threadId}/messages`, message);
    return response.data;
  }

  // Batch sync for offline support (future)
  async syncMessages(threadId: string, messages: Message[]): Promise<void> {
    await this.client.post(`/v1/threads/${threadId}/messages/batch`, {
      messages,
    });
  }
}
```

### 7.4 Main Process Thread Service

The main process service coordinates between IPC handlers and the Moku API:

```typescript
// electron/services/ThreadService.ts
import { MokuAPIClient } from './MokuAPIClient';
import { SecureStorageService } from './SecureStorageService';
import log from 'electron-log';

export class ThreadService {
  constructor(
    private mokuAPI: MokuAPIClient,
    private secureStorage: SecureStorageService,
  ) {}

  async getAllThreads() {
    try {
      log.info('Fetching all threads from Moku API');
      const threads = await this.mokuAPI.getThreads();
      log.info(`Retrieved ${threads.length} threads`);
      return threads;
    } catch (error) {
      log.error('Failed to fetch threads:', error);
      throw new Error('Failed to load threads from server');
    }
  }

  async createThread(data: { provider: string; model: string }) {
    try {
      log.info('Creating new thread:', { provider: data.provider, model: data.model });
      const thread = await this.mokuAPI.createThread({
        title: 'New Conversation',
        ...data,
      });
      log.info('Thread created:', thread.id);
      return thread;
    } catch (error) {
      log.error('Failed to create thread:', error);
      throw new Error('Failed to create thread');
    }
  }

  async deleteThread(threadId: string) {
    try {
      log.info('Deleting thread:', threadId);
      await this.mokuAPI.deleteThread(threadId);
      log.info('Thread deleted:', threadId);
    } catch (error) {
      log.error('Failed to delete thread:', error);
      throw new Error('Failed to delete thread');
    }
  }

  async syncMessage(threadId: string, message: any) {
    try {
      log.info('Syncing message to Moku API:', { threadId, role: message.role });
      await this.mokuAPI.createMessage(threadId, {
        role: message.role,
        content: message.content,
      });
      log.info('Message synced successfully');
    } catch (error) {
      log.error('Failed to sync message:', error);
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
    preload: path.join(__dirname, 'preload.js'),
  },
});

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
        "form-action 'self'",
      ].join('; '),
    },
  });
});
```

### 8.3 API Key Management

```vue
<script setup lang="ts">
import { ref } from 'vue';

const apiKeys = ref({
  claude: '',
  openai: '',
  ollama: '',
});

async function saveAPIKey(provider: string) {
  const key = apiKeys.value[provider];

  // Test connection first
  const testResult = await window.electron.models.testConnection(provider, key);

  if (testResult.success) {
    // Save encrypted
    await window.electron.settings.set(`apiKey_${provider}`, key);

    // Clear from memory
    apiKeys.value[provider] = '';

    // Show success message
  } else {
    // Show error
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium mb-2">Claude API Key</label>
      <input
        v-model="apiKeys.claude"
        type="password"
        class="w-full px-4 py-2 border rounded-lg"
        placeholder="sk-ant-..."
      />
      <button @click="saveAPIKey('claude')">Save</button>
    </div>
  </div>
</template>
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
├── src/                          # Renderer process (Vue)
│   ├── main.ts                   # Vue app entry
│   ├── App.vue                   # Root component
│   │
│   ├── components/               # Vue components
│   │   ├── auth/
│   │   │   ├── LoginScreen.vue
│   │   │   └── OAuthButton.vue
│   │   ├── layout/
│   │   │   ├── AppLayout.vue
│   │   │   ├── Sidebar.vue
│   │   │   └── MainContent.vue
│   │   ├── threads/
│   │   │   ├── ThreadList.vue
│   │   │   ├── ThreadItem.vue
│   │   │   └── NewThreadButton.vue
│   │   ├── chat/
│   │   │   ├── ChatHeader.vue
│   │   │   ├── ChatFooter.vue
│   │   │   ├── ModelSelector.vue
│   │   │   └── StatusBar.vue
│   │   └── settings/
│   │       ├── SettingsModal.vue
│   │       ├── APIKeyInput.vue
│   │       └── ThemeToggle.vue
│   │
│   ├── stores/                   # Pinia stores
│   │   ├── auth.ts
│   │   ├── threads.ts
│   │   ├── models.ts
│   │   └── settings.ts
│   │
│   ├── composables/              # Vue composables
│   │   ├── useChat.ts
│   │   ├── useThreads.ts
│   │   └── useKeyboardShortcuts.ts
│   │
│   ├── router/                   # Vue Router (if needed)
│   │   └── index.ts
│   │
│   ├── assets/                   # Static assets
│   │   ├── styles/
│   │   │   ├── main.css
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
    "files": ["dist-electron/**/*", "dist/**/*", "package.json"],
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
import { autoUpdater } from 'electron-updater';

// Configure auto-updater
autoUpdater.checkForUpdatesAndNotify();

autoUpdater.on('update-available', () => {
  // Notify user
});

autoUpdater.on('update-downloaded', () => {
  // Prompt user to restart
});
```

---

## 12. Testing Strategy

### 12.1 Unit Tests (Vitest + Vue Test Utils)

```typescript
// tests/unit/stores/auth.spec.ts
import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth';

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());

    // Mock window.electron
    vi.stubGlobal('window', {
      electron: {
        auth: {
          startOAuthFlow: vi.fn(),
          logout: vi.fn(),
        },
      },
    });
  });

  it('should initialize with null user', () => {
    const authStore = useAuthStore();
    expect(authStore.user).toBeNull();
    expect(authStore.isAuthenticated).toBe(false);
  });

  it('should set user on successful login', async () => {
    const mockUser = { id: '1', email: 'test@test.com', name: 'Test' };

    window.electron.auth.startOAuthFlow.mockResolvedValue({
      success: true,
      user: mockUser,
      accessToken: 'token123',
      refreshToken: 'refresh123',
    });

    const authStore = useAuthStore();
    await authStore.login();

    expect(authStore.user).toEqual(mockUser);
    expect(authStore.isAuthenticated).toBe(true);
  });
});
```

### 12.2 Component Tests

```typescript
// tests/unit/components/ThreadList.spec.ts
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect } from 'vitest';
import ThreadList from '@/components/threads/ThreadList.vue';
import { useThreadsStore } from '@/stores/threads';

describe('ThreadList', () => {
  it('renders threads from store', () => {
    const wrapper = mount(ThreadList, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              threads: {
                threads: [
                  { id: '1', title: 'Thread 1', createdAt: '2025-01-01' },
                  { id: '2', title: 'Thread 2', createdAt: '2025-01-02' },
                ],
              },
            },
          }),
        ],
      },
    });

    expect(wrapper.findAll('[data-test="thread-item"]')).toHaveLength(2);
  });

  it('calls selectThread when thread is clicked', async () => {
    const wrapper = mount(ThreadList, {
      global: {
        plugins: [createTestingPinia()],
      },
    });

    const threadsStore = useThreadsStore();
    const threadItem = wrapper.find('[data-test="thread-item"]');

    await threadItem.trigger('click');

    expect(threadsStore.setActiveThread).toHaveBeenCalled();
  });
});
```

### 12.3 E2E Tests (Playwright)

```typescript
// tests/e2e/auth.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';

test('complete authentication flow', async () => {
  const app = await electron.launch({ args: ['.'] });
  const window = await app.firstWindow();

  // Should show login screen
  await expect(window.locator('text=Sign in')).toBeVisible();

  // Click sign in button
  await window.click('button:has-text("Sign in with OAuth")');

  // Mock OAuth callback
  await app.evaluate(({ ipcMain }) => {
    ipcMain.emit('auth:callback', null, 'holokai://callback?code=test123');
  });

  // Should show main app
  await expect(window.locator('text=New Thread')).toBeVisible();

  await app.close();
});
```

---

## 13. Performance Optimization

### 13.1 Lazy Loading

```typescript
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/settings',
      component: () => import('@/views/SettingsView.vue'),
    },
  ],
});
```

### 13.2 Virtual Scrolling

```vue
<script setup lang="ts">
import { useVirtualList } from '@vueuse/core';
import { computed } from 'vue';
import { useThreadsStore } from '@/stores/threads';

const threadsStore = useThreadsStore();
const threads = computed(() => threadsStore.sortedThreads);

const { list, containerProps, wrapperProps } = useVirtualList(threads, {
  itemHeight: 72,
  overscan: 5,
});
</script>

<template>
  <div v-bind="containerProps" class="h-full overflow-y-auto">
    <div v-bind="wrapperProps">
      <ThreadItem v-for="{ data: thread, index } in list" :key="thread.id" :thread="thread" />
    </div>
  </div>
</template>
```

### 13.3 Memoization

```typescript
// composables/useChat.ts
import { computed } from 'vue';
import { useThreadsStore } from '@/stores/threads';

export function useChat() {
  const threadsStore = useThreadsStore();

  // Memoize expensive computations
  const threadStats = computed(() => {
    return threadsStore.threads.map((thread) => ({
      id: thread.id,
      messageCount: thread.messages?.length || 0,
      lastMessageAt: thread.updatedAt,
    }));
  });

  return { threadStats };
}
```

---

## 14. Future Considerations

### 14.1 Planned Features

- **Offline Mode**: Local caching with sync queue for when network is unavailable
- **Multi-Window**: Support for separate settings/preferences window
- **Plugin System**: Allow custom AI provider plugins
- **Theme Support**: Custom themes beyond light/dark
- **Export/Import**: Backup threads to local files
- **Vue Router Integration**: Multi-view navigation
- **Local Search**: Client-side search through synced threads

### 14.2 Performance Optimizations

- Virtual scrolling for large thread lists
- Message pagination for long threads
- Lazy loading of thread content
- Background thread sync
- Pinia action debouncing

### 14.3 Monitoring and Analytics

- Error reporting (Sentry or similar)
- Usage analytics (privacy-respecting)
- Performance metrics
- Crash reporting
- **Centralized log aggregation** (optional)

---

## Appendix A: Glossary

| Term                 | Definition                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Context Bridge**   | Electron API for secure IPC between main and renderer                                                                 |
| **PKCE**             | Proof Key for Code Exchange - OAuth security extension                                                                |
| **IPC**              | Inter-Process Communication between Electron processes                                                                |
| **Renderer Process** | Chromium process running UI code                                                                                      |
| **Main Process**     | Node.js process managing app lifecycle                                                                                |
| **Custom Protocol**  | App-specific URL scheme (holokai://)                                                                                  |
| **Provider Pattern** | Design pattern for pluggable implementations                                                                          |
| **Composition API**  | Vue 3's modern API for component logic composition                                                                    |
| **Pinia**            | Official state management library for Vue 3                                                                           |
| **Reactive**         | Vue's reactivity system for state management                                                                          |
| **Log Transport**    | Output destination for logs (console, file, remote)                                                                   |
| **Log Rotation**     | Automatic archival of old logs when size limit reached                                                                |
| **AppData**          | User-specific application data directory (Windows: %APPDATA%, macOS: ~/Library/Application Support, Linux: ~/.config) |

---

## Appendix B: References

- [Electron Documentation](https://www.electronjs.org/docs)
- [Vue 3 Documentation](https://vuejs.org/)
- [Pinia Documentation](https://pinia.vuejs.org/)
- [Vue Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [OAuth 2.0 PKCE Specification](https://datatracker.ietf.org/doc/html/rfc7636)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Anthropic API

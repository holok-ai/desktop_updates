# Holokai Desktop Application - Design Document (Angular)

**Project:** Holokai AI Desktop Client  
**Framework:** Angular 18 + Electron  
**Version:** 1.0  
**Date:** October 15, 2025  
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
9. [Sharing Code with Moku Web](#9-sharing-code-with-moku-web)
10. [File Structure](#10-file-structure)
11. [Development Setup](#11-development-setup)
12. [Build & Distribution](#12-build--distribution)
13. [Testing Strategy](#13-testing-strategy)
14. [Performance Optimization](#14-performance-optimization)
15. [Future Considerations](#15-future-considerations)

---

## 1. Executive Summary

### 1.1 Purpose

This document outlines the technical design for the Holokai Desktop application, a cross-platform Electron-based desktop client that provides a native experience for interacting with multiple AI providers (Claude, OpenAI, Ollama). The application leverages **Angular 18 with standalone components** for the UI layer, **NgRx Signals** for state management, and integrates with the existing `@holokai/chat-component` library for chat functionality.

### 1.2 Key Design Goals

- **Cross-platform compatibility**: Windows, macOS, Linux
- **Native feel**: OS-integrated UI with proper window controls, notifications, and system integration
- **Security**: Secure OAuth flows, credential storage via Electron safeStorage, IPC sandboxing
- **Performance**: Optimized change detection, efficient rendering, lazy loading
- **Maintainability**: Clear separation of concerns, reusable components, comprehensive testing
- **Cloud-first**: All chat data persisted to Moku API - no local database
- **Code sharing**: Maximum reuse of CSS, TypeScript, and design tokens from Moku web project

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

## 4. Component Architecture

### 4.1 Component Hierarchy

```
AppComponent (Root)
│
├── LoginScreenComponent (Full-screen overlay)
│   ├── OAuthButtonComponent
│   └── LogoComponent
│
├── AppLayoutComponent (Main authenticated layout)
│   │
│   ├── SidebarComponent (Left panel)
│   │   ├── ThreadListComponent
│   │   │   └── ThreadItemComponent
│   │   ├── NewThreadButtonComponent
│   │   └── UserProfileComponent
│   │
│   └── MainContentComponent (Right panel)
│       │
│       ├── ChatHeaderComponent
│       │   ├── ModelSelectorComponent
│       │   └── ThreadTitleComponent
│       │
│       ├── ChatWindowComponent (from @holokai/chat-component)
│       │   ├── MessageListComponent
│       │   │   └── MessageItemComponent
│       │   ├── MessageInputComponent
│       │   └── StreamingIndicatorComponent
│       │
│       └── ChatFooterComponent
│           └── StatusBarComponent
```

### 4.2 Key Components

#### 4.2.1 LoginScreenComponent

**Purpose:** Full-screen authentication interface displayed when user is not authenticated.

**Responsibilities:**
- Display OAuth login button
- Handle loading state during authentication
- Call AuthStore.login() method
- Show error messages on authentication failure

**Dependencies:** AuthStore, OAuthButtonComponent

#### 4.2.2 ThreadListComponent

**Purpose:** Display scrollable list of all chat threads with selection and deletion capabilities.

**Responsibilities:**
- Render thread items from ThreadsStore
- Handle thread selection via click events
- Support thread deletion with confirmation
- Show active thread with visual indicator
- Auto-scroll to active thread

**Dependencies:** ThreadsStore, ThreadItemComponent

#### 4.2.3 ModelSelectorComponent

**Purpose:** Dropdown for selecting AI provider and model.

**Responsibilities:**
- Display available models from ModelsStore
- Update selected model on change
- Group models by provider
- Show model metadata (context window, capabilities)

**Dependencies:** ModelsStore, PrimeNG Dropdown

#### 4.2.4 ChatContainerComponent

**Purpose:** Integration wrapper for @holokai/chat-component library.

**Responsibilities:**
- Configure chat component with active model and thread
- Load API key for selected provider from secure storage
- Handle message sent events and sync to Moku API
- Show placeholder when no API key configured

**Dependencies:** ThreadsStore, ModelsStore, ChatWindowComponent from @holokai/chat-component

---

## 5. State Management

### 5.1 NgRx Signals Architecture

NgRx Signals provides lightweight, reactive state management with fine-grained reactivity. Unlike traditional NgRx, Signals avoid boilerplate while maintaining type safety and predictable state updates.

### 5.2 Store Design

#### 5.2.1 AuthStore

**State:**
- user (User object with id, email, name)
- accessToken (encrypted OAuth token)
- refreshToken (for token renewal)

**Computed:**
- isAuthenticated (derived from user and accessToken presence)

**Methods:**
- login() - Initiates OAuth flow via IPC
- logout() - Clears tokens and user data
- refreshAccessToken() - Renews expired access token

**Dependencies:** Electron IPC (window.electron.auth)

#### 5.2.2 ThreadsStore

**State:**
- threads (array of Thread objects)
- activeThreadId (currently selected thread)
- isLoading (fetch/operation state)

**Computed:**
- activeThread (finds thread by activeThreadId)
- sortedThreads (threads sorted by updatedAt desc)

**Methods:**
- loadThreads() - Fetches all threads from Moku API
- createThread(provider, model) - Creates new thread and sets as active
- deleteThread(threadId) - Removes thread and adjusts active selection
- setActiveThread(threadId) - Updates active thread selection

**Dependencies:** Electron IPC (window.electron.threads)

#### 5.2.3 ModelsStore

**State:**
- models (array of available Model objects)
- selectedModelId (currently selected model)

**Computed:**
- selectedModel (finds model by selectedModelId)
- availableModels (all models array)
- modelsByProvider (models grouped by provider)

**Methods:**
- loadModels() - Fetches available models from main process
- setSelectedModel(modelId) - Updates selected model

**Dependencies:** Electron IPC (window.electron.models)

---

## 6. Authentication & Authorization

### 6.1 OAuth 2.0 Flow with PKCE

The application implements OAuth 2.0 with PKCE (Proof Key for Code Exchange) for enhanced security. This prevents authorization code interception attacks.

#### 6.1.1 Flow Overview

**Step 1:** User clicks "Sign In" button in renderer process.

**Step 2:** Renderer calls window.electron.auth.startOAuthFlow() via IPC.

**Step 3:** Main process generates code_verifier (random 32-byte string) and code_challenge (SHA-256 hash).

**Step 4:** Main process constructs OAuth URL with code_challenge and opens system browser.

**Step 5:** User authenticates with OAuth provider in browser.

**Step 6:** Browser redirects to custom protocol URL (holokai://callback?code=XXX).

**Step 7:** Electron intercepts custom protocol and extracts authorization code.

**Step 8:** Main process exchanges code + code_verifier for access_token and refresh_token.

**Step 9:** Tokens stored in encrypted storage via safeStorage API.

**Step 10:** User data fetched and returned to renderer process.

**Step 11:** AuthStore updates state, triggering UI navigation to main app.

#### 6.1.2 Main Process Components

**AuthService:**
- Manages OAuth flow lifecycle
- Generates PKCE challenge pairs
- Opens system browser for authentication
- Handles custom protocol callbacks
- Exchanges authorization codes for tokens
- Fetches user profile information

**Custom Protocol Handler:**
- Registers holokai:// protocol with OS
- Intercepts OAuth redirect callbacks
- Extracts authorization code from URL
- Triggers token exchange

**Dependencies:** Electron shell API, crypto module, axios for HTTP requests

### 6.2 Secure Token Storage

**SecureStorageService:**
- Uses Electron safeStorage API for encryption
- Stores encrypted tokens in electron-store
- Provides get/set methods for tokens and API keys
- Implements clear() for logout
- Checks encryption availability before storing

**Storage Strategy:**
- Access tokens encrypted with OS-level encryption (Keychain on macOS, Credential Vault on Windows)
- Refresh tokens stored separately from access tokens
- API keys per provider stored in separate keys
- All sensitive data encrypted before persistence

**Dependencies:** Electron safeStorage, electron-store

---

## 7. Data Flow & Communication

### 7.1 IPC Architecture

#### 7.1.1 Context Bridge (Preload Script)

**Purpose:** Secure bridge between renderer and main process using contextBridge API.

**Exposed APIs:**
- auth (startOAuthFlow, logout, refreshToken, getUser)
- threads (getAll, create, delete, update, syncMessage)
- models (getAvailable, testConnection)
- settings (get, set, getAll)
- system (getVersion, checkForUpdates, openExternal)

**Security:** Uses ipcRenderer.invoke for async communication. Never exposes Node.js or Electron APIs directly to renderer.

**Dependencies:** Electron contextBridge, ipcRenderer

#### 7.1.2 Main Process IPC Handlers

**Handler Registration:**
All IPC handlers registered in main process startup using ipcMain.handle(). Each handler delegates to appropriate service class.

**Handler Categories:**
- Authentication handlers (OAuth flow, logout, token refresh)
- Thread management (CRUD operations via Moku API)
- Model operations (list available, test connections)
- Settings persistence (get/set configuration)
- System operations (version, updates, external links)

**Error Handling:**
All handlers wrap operations in try-catch and return structured responses with success/error status.

**Dependencies:** Electron ipcMain, service classes (AuthService, ThreadService, ModelService)

### 7.2 Chat Integration

**ChatWindowComponent Integration:**
The @holokai/chat-component library is integrated as a standalone Angular component. The desktop app wraps it in ChatContainerComponent.

**Configuration:**
- Provider and model from ModelsStore
- API key loaded from secure storage via settings IPC
- ThreadId from ThreadsStore
- Message sent events captured and synced to Moku API

**Message Synchronization:**
When user sends message, ChatWindowComponent emits messageSent event. Desktop app catches event and calls window.electron.threads.syncMessage() to persist to Moku API.

**Dependencies:** @holokai/chat-component, ThreadsStore, ModelsStore

### 7.3 Moku API Client Service

**MokuAPIClient (Main Process):**
RESTful HTTP client for all thread and message persistence operations.

**API Endpoints:**
- GET /v1/threads (list all threads)
- POST /v1/threads (create thread)
- GET /v1/threads/:id (get single thread)
- PATCH /v1/threads/:id (update thread)
- DELETE /v1/threads/:id (delete thread)
- GET /v1/threads/:id/messages (list messages)
- POST /v1/threads/:id/messages (create message)
- POST /v1/threads/:id/messages/batch (batch sync)

**Authentication:**
Access token injected via request interceptor. Token managed by AuthService.

**Error Handling:**
Failed requests logged and thrown. No local fallback - all persistence requires API connectivity.

**Dependencies:** axios, electron-log

### 7.4 Thread Service (Main Process)

**ThreadService:**
Coordinates between IPC handlers and MokuAPIClient. Adds logging and error translation.

**Methods:**
- getAllThreads() - Fetches threads from API, logs count
- createThread(data) - Creates thread, logs result
- deleteThread(threadId) - Deletes thread, logs success
- syncMessage(threadId, message) - Syncs message, doesn't throw on failure to allow offline operation

**Logging:**
All operations logged with electron-log including timestamps, thread IDs, and error details.

**Dependencies:** MokuAPIClient, SecureStorageService, electron-log

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

## 9. Sharing Code with Moku Web

### 9.1 Overview

The Holokai Desktop application maximizes code reuse from the Moku web project located at `C:\projects\repos\holokai\moku\web`. This strategy ensures **visual consistency**, **reduces duplication**, **accelerates development**, and **maintains design system adherence** across web and desktop platforms.

### 9.2 Shared CSS and Design Tokens

#### 9.2.1 Design Tokens (tokens.css)

**Location:** `C:\projects\repos\holokai\moku\web\src\styles\tokens.css`

**Contains:**
- Complete color system via CSS custom properties (--color-primary, --color-secondary, --surface-*, etc.)
- Typography scale (--h1-size through --h6-size, --body-lg-size, etc.)
- Font weights (--weight-regular, --weight-semibold, etc.)
- Spacing system (--grid-sm, --grid-md, --grid-lg, --grid-xl)
- Border radii (--radius-1 through --radius-4)
- Box shadows (--shadow-1 through --shadow-6)
- Dark mode variants

**Integration Strategy:**
Reference tokens.css directly in angular.json styles array using relative path to moku/web directory. This ensures single source of truth for all design tokens.

**Benefit:** Any design token updates in Moku web automatically propagate to desktop app on next build.

#### 9.2.2 Tailwind Configuration

**Location:** `C:\projects\repos\holokai\moku\web\tailwind.config.js`

**Contains:**
- Responsive breakpoints (sm: 481px, md: 769px, lg: 1280px)
- Extended color palette mapped to CSS custom properties
- Extended spacing scale mapped to grid units
- Extended border radius mapped to design tokens
- Extended box shadows mapped to shadow tokens
- Typography configuration using design tokens
- PrimeNG plugin integration

**Integration Strategy:**
Copy tailwind.config.js from Moku web to desktop project. Update content paths to match desktop src structure. Maintains identical utility class generation.

**Benefit:** All Tailwind classes behave identically between web and desktop. Component styles are fully portable.

#### 9.2.3 Additional Shared Styles

**Shareable Files from moku/web/src/styles:**
- `core.css` - Base resets and global styles
- `components.css` - Common component patterns
- `dark.css` - Dark mode theme variables
- `layout.css` - Layout utilities and grid system

**Integration Strategy:**
Import shared styles in desktop styles.css using @import or add to angular.json styles array. Selectively include only needed stylesheets to minimize bundle size.

### 9.3 Shared TypeScript Code

#### 9.3.1 Type Definitions

**Shareable Types:**
- User interface (id, email, name, role)
- Thread interface (id, title, createdAt, updatedAt, provider, model)
- Message interface (id, threadId, role, content, timestamp)
- Model interface (id, name, provider, contextWindow, supportsStreaming)
- API response types
- Configuration types

**Integration Strategy:**
Create shared TypeScript package or use path mapping in tsconfig.json to reference types from Moku web. Maintain single source of truth for domain models.

#### 9.3.2 Utility Functions

**Shareable Utilities:**
- Date formatting functions
- String manipulation (truncate, sanitize)
- Validation helpers (email, URL)
- Markdown parsing utilities
- Color manipulation functions

**Integration Strategy:**
Extract shared utilities to separate package or reference via path aliases. Ensure no browser-specific or Node-specific code in shared utilities.

#### 9.3.3 HTTP Client Interceptors

**Shareable Interceptors:**
- Authentication token injection
- Error handling and retry logic
- Request/response logging
- API base URL configuration

**Integration Strategy:**
Adapt Angular interceptors from Moku web for use in desktop renderer process. Replace HttpClient calls with IPC calls in desktop-specific services.

### 9.4 Component Libraries

#### 9.4.1 PrimeNG Components

**Shared Configuration:**
Moku web uses PrimeNG for UI components. Desktop app uses same PrimeNG version with identical theme configuration.

**Shareable Assets:**
- PrimeNG theme customization CSS
- Component override styles from `primeng-overrides.css`
- Table styling from `primeng-table.css`

**Integration Strategy:**
Use same PrimeNG version (^17.0.0) and import same override stylesheets. This ensures button, input, dropdown, and table components look identical.

**Note:** Desktop app may not need all PrimeNG components used in web. Import only required components to reduce bundle size.

#### 9.4.2 @holokai/chat-component

**Library Location:** Separate package published to npm or referenced via local path.

**Shared Functionality:**
- Complete chat UI (message list, input, streaming indicator)
- Provider abstraction (ClaudeChatProvider, OpenAIChatProvider, OllamaChatProvider)
- Message rendering with markdown support
- File attachment handling
- Streaming response display

**Integration Strategy:**
Both web and desktop applications import @holokai/chat-component. Desktop provides API keys via secure storage while web uses server-side proxy. Component remains framework-agnostic or provides Angular wrapper.

### 9.5 Assets and Icons

**Shared Assets:**
- Brand logos and wordmarks
- Lucide icon set (via lucide-angular package)
- Empty state illustrations
- Avatar placeholders

**Integration Strategy:**
Copy static assets from moku/web/src/assets to desktop project. Alternatively, use symlinks or shared assets folder in monorepo structure.

### 9.6 Code Sharing Best Practices

**Version Synchronization:**
Keep shared dependencies (Angular, PrimeNG, Tailwind, TypeScript) at same versions between web and desktop to avoid compatibility issues.

**Abstraction Layers:**
When sharing business logic, abstract platform-specific code (HTTP vs IPC, localStorage vs electron-store) behind interfaces.

**Testing:**
Shared code should have comprehensive unit tests. Run same test suite against both web and desktop implementations.

**Documentation:**
Document which files are shared and their locations. Update both projects when shared code changes.

**Build Process:**
Consider monorepo structure with shared packages for easier code sharing and version management.

---

## 10. File Structure

```
holokai-desktop/
├── package.json
├── electron-builder.json
├── tsconfig.json
├── angular.json
├── tailwind.config.js (copied from moku/web)
│
├── src/                          # Renderer process (Angular)
│   ├── main.ts                   # Angular bootstrap
│   ├── index.html
│   ├── styles.css                # Global styles
│   │
│   ├── app/
│   │   ├── app.component.ts      # Root component
│   │   ├── app.config.ts         # App configuration
│   │   ├── app.routes.ts         # Routing (if needed)
│   │   │
│   │   ├── components/           # Angular components
│   │   │   ├── auth/
│   │   │   │   ├── login-screen.component.ts
│   │   │   │   └── oauth-button.component.ts
│   │   │   ├── layout/
│   │   │   │   ├── app-layout.component.ts
│   │   │   │   ├── sidebar.component.ts
│   │   │   │   └── main-content.component.ts
│   │   │   ├── threads/
│   │   │   │   ├── thread-list.component.ts
│   │   │   │   ├── thread-item.component.ts
│   │   │   │   └── new-thread-button.component.ts
│   │   │   ├── chat/
│   │   │   │   ├── chat-container.component.ts
│   │   │   │   ├── chat-header.component.ts
│   │   │   │   ├── chat-footer.component.ts
│   │   │   │   ├── model-selector.component.ts
│   │   │   │   └── status-bar.component.ts
│   │   │   └── settings/
│   │   │       ├── settings-modal.component.ts
│   │   │       ├── api-key-input.component.ts
│   │   │       └── theme-toggle.component.ts
│   │   │
│   │   ├── stores/               # NgRx Signal stores
│   │   │   ├── auth.store.ts
│   │   │   ├── threads.store.ts
│   │   │   ├── models.store.ts
│   │   │   └── settings.store.ts
│   │   │
│   │   ├── services/             # Angular services
│   │   │   ├── electron-ipc.service.ts
│   │   │   └── keyboard-shortcuts.service.ts
│   │   │
│   │   └── shared/               # Shared utilities
│   │       ├── types/
│   │       ├── constants/
│   │       └── utils/
│   │
│   ├── assets/                   # Static assets
│   │   ├── icons/
│   │   └── images/
│   │
│   └── styles/                   # Shared styles
│       ├── tokens.css            # Symlink to moku/web/src/styles/tokens.css
│       ├── components.css        # Copied from moku/web
│       └── dark.css              # Copied from moku/web
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
│   │   ├── MokuAPIClient.ts
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

## 11. Development Setup

### 11.1 Prerequisites

- Node.js 18+ with npm or pnpm
- Git for version control
- Platform-specific build tools (Windows: Visual Studio Build Tools, macOS: Xcode Command Line Tools)

### 11.2 Installation Steps

Clone repository, install dependencies via package manager, configure environment variables in .env file for OAuth credentials and API URLs.

### 11.3 Development Commands

- Development mode: Runs Electron with hot reload for Angular app
- Build: Compiles Angular app and Electron main process
- Test: Runs unit and integration tests
- Lint: Checks TypeScript and template code style
- Type check: Validates TypeScript types

### 11.4 Environment Configuration

Required environment variables: OAuth client ID, OAuth redirect URI (holokai://callback), Moku API base URL, application version.

---

## 12. Build & Distribution

### 12.1 Build Configuration

Electron Builder configuration includes:
- Application ID (com.holokai.desktop)
- Product name (Holokai)
- Build directories for output and resources
- Platform-specific settings for macOS (DMG, code signing), Windows (NSIS installer), and Linux (AppImage, DEB)

### 12.2 Code Signing

**macOS:**
- Developer ID certificate required
- Hardened runtime enabled
- Entitlements file for security features
- Notarization for Gatekeeper

**Windows:**
- Code signing certificate (EV preferred)
- Timestamp server for long-term validity

### 12.3 Auto-Update

Electron Updater integration for automatic update checks. App checks for updates on launch and periodically. Users notified when updates available with option to install and restart.

**Dependencies:** electron-updater

---

## 13. Testing Strategy

### 13.1 Unit Testing

**Framework:** Jasmine + Karma for Angular components and services.

**Coverage:**
- Component logic and template bindings
- Store state management (signals, computed, methods)
- Service methods and error handling
- Utility functions

**Mocking:** Electron IPC calls mocked using Jasmine spies.

### 13.2 Integration Testing

**Focus:**
- IPC communication between renderer and main process
- Store coordination with components
- API client integration with services
- OAuth flow end-to-end

**Tools:** Custom test harnesses for Electron IPC testing.

### 13.3 End-to-End Testing

**Framework:** Playwright with Electron support.

**Test Scenarios:**
- Complete authentication flow
- Thread creation and deletion
- Model switching
- Message sending and receiving
- Settings persistence
- Multi-window scenarios

### 13.4 Security Testing

**Manual Audits:**
- CSP policy validation
- IPC surface area review
- Token storage encryption verification
- OAuth flow security checklist

**Dependencies:** jasmine-core, karma, @angular/platform-browser-dynamic, playwright

---

## 14. Performance Optimization

### 14.1 Angular Performance

**Change Detection:**
- OnPush strategy for all components
- Signals for fine-grained reactivity
- Avoid template expressions, use computed signals
- Minimize component tree depth

**Lazy Loading:**
- Route-level code splitting (if routing used)
- Dynamic component loading for modals
- Defer heavy libraries until needed

**Bundle Optimization:**
- Tree shaking for unused code
- PrimeNG component cherry-picking
- Source map generation only in dev

### 14.2 Rendering Optimization

**Virtual Scrolling:**
- Implement virtual scroll for thread list with many items
- CDK virtual scroll for message list in long threads

**Throttling/Debouncing:**
- Debounce search inputs
- Throttle scroll event handlers
- Rate limit API calls

### 14.3 Data Management

**Caching:**
- Cache thread list in ThreadsStore
- Cache model list in ModelsStore
- Invalidate on mutations

**Pagination:**
- Load messages in batches for long threads
- Infinite scroll for thread history

### 14.4 Electron-Specific

**Process Management:**
- Keep main process lean, avoid heavy computation
- Use worker threads for CPU-intensive tasks if needed
- Minimize IPC call frequency

**Memory Management:**
- Limit message history in renderer
- Clear unused component references
- Monitor heap size in production

---

## 15. Future Considerations

### 15.1 Planned Features

- **Offline Mode**: Local message queue with sync when connectivity restored
- **Multi-Window Support**: Separate windows for settings, thread history
- **Plugin System**: Third-party AI provider integrations
- **Advanced Theming**: Custom color schemes beyond light/dark
- **Export/Import**: Thread backup to local files or cloud storage
- **Search**: Full-text search across all threads and messages
- **Voice Input**: Speech-to-text for message composition
- **Screen Sharing**: Capture and share screenshots in chat

### 15.2 Performance Enhancements

- **Incremental Loading**: Load thread list in batches
- **Background Sync**: Sync messages in background without blocking UI
- **Preloading**: Prefetch likely-to-be-opened threads
- **Service Workers**: Cache static assets (if moving to web technologies)

### 15.3 Developer Experience

- **Monorepo Structure**: Share code between web and desktop in unified repo
- **Shared Component Library**: Extract common components to separate package
- **Storybook**: Component development and documentation
- **CI/CD**: Automated testing and building on commit

### 15.4 Monitoring and Telemetry

- **Error Reporting**: Sentry or similar for crash reports
- **Analytics**: Privacy-respecting usage analytics
- **Performance Metrics**: Monitor app startup time, memory usage
- **User Feedback**: In-app feedback mechanism

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Context Bridge** | Electron API for secure IPC between main and renderer |
| **PKCE** | Proof Key for Code Exchange - OAuth security extension |
| **IPC** | Inter-Process Communication between Electron processes |
| **Renderer Process** | Chromium process running UI code (Angular app) |
| **Main Process** | Node.js process managing app lifecycle and native APIs |
| **Custom Protocol** | App-specific URL scheme (holokai://) for OAuth callbacks |
| **NgRx Signals** | Lightweight reactive state management for Angular |
| **Signal** | Fine-grained reactive primitive in Angular/NgRx |
| **Computed** | Derived value that updates automatically from signals |
| **Standalone Component** | Angular component without NgModule |
| **safeStorage** | Electron API for OS-level credential encryption |
| **AppData** | User-specific application data directory |

---

## Appendix B: References

- [Electron Documentation](https://www.electronjs.org/docs)
- [Angular Documentation](https://angular.dev/)
- [NgRx Signals Documentation](https://ngrx.io/guide/signals)
- [PrimeNG Documentation](https://primeng.org/)
- [OAuth 2.0 PKCE Specification](https://datatracker.ietf.org/doc/html/rfc7636)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Anthropic API Documentation](https://docs.anthropic.com/)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [electron-log Documentation](https://github.com/megahertz/electron-log)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-15 | Architecture Team | Initial version (Angular variant) |

---

**Approval**

This document requires approval from:
- [ ] Technical Lead
- [ ] Security Team
- [ ] Product Owner

---

*End of Document*
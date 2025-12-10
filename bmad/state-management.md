# State Management Documentation

## Overview

Holokai Desktop uses **Svelte 5 writable stores** for state management, following a simple yet effective pattern for managing application state across components.

## Store Architecture

### Pattern: Custom Store Factory

Each domain entity has a dedicated store module that wraps Svelte's `writable` store with typed interfaces and domain-specific methods.

```
src/lib/stores/
├── auth.store.ts         # Authentication state
├── project.store.ts      # Project list management
├── thread.store.ts       # Thread/conversation list
├── navigation-guard.store.ts  # Route guarding
└── titleGeneration.store.ts   # Title generation state
```

## Store Implementations

### 1. Authentication Store (`auth.store.ts`)

**Purpose:** Manages user authentication state across the application.

**State Interface:**
```typescript
interface AuthState {
  user: UserProfile | null;
  tokens: null;  // Never exposed to renderer
  isAuthenticated: boolean;
}
```

**Exports:**
- `authStore` - Main store with `setUser`, `setAuthState`, `logout` methods
- `isAuthenticated` - Derived store (boolean)
- `currentUser` - Derived store (UserProfile | null)

**Usage Pattern:**
```typescript
import { authStore, isAuthenticated } from '$lib/stores/auth.store';

// Subscribe to auth changes
$: if ($isAuthenticated) { /* user logged in */ }

// Update auth state
authStore.setAuthState(newState);
```

### 2. Thread Store (`thread.store.ts`)

**Purpose:** Manages the list of chat threads/conversations.

**State:** `Thread[]`

**Methods:**
- `setThreads(threads)` - Replace all threads
- `addThread(thread)` - Add and sort by createdAt
- `updateThread(thread)` - Update existing thread
- `deleteThread(threadId)` - Remove thread

**IPC Integration:**
```typescript
export function initThreadUpdateListener(): () => void {
  return window.electronAPI.thread.onThreadUpdated((updatedThread) => {
    threads.updateThread(updatedThread);
  });
}
```

### 3. Project Store (`project.store.ts`)

**Purpose:** Manages project list for organizing threads.

**State:** `Project[]`

**Methods:**
- `setProjects(projects)` - Replace all projects
- `addProject(project)` - Add and sort by updatedAt
- `updateProject(project)` - Update existing project
- `deleteProject(projectId)` - Remove project

### 4. Navigation Guard Store (`navigation-guard.store.ts`)

**Purpose:** Manages unsaved changes warnings before navigation.

### 5. Title Generation Store (`titleGeneration.store.ts`)

**Purpose:** Tracks thread title auto-generation status.

## Data Flow Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Component  │───▶│   Service   │───▶│    Store    │     │
│  │  (Svelte)   │◀───│  (electron  │◀───│  (writable) │     │
│  │             │    │   .service) │    │             │     │
│  └─────────────┘    └──────┬──────┘    └─────────────┘     │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │ IPC (invoke/on)
┌────────────────────────────┼─────────────────────────────────┐
│                    Main Process                              │
│                            ▼                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ IPC Handler │───▶│  Repository │───▶│electron-store│     │
│  └─────────────┘    └─────────────┘    │   (JSON)    │     │
│                                         └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Real-time Sync Pattern

Stores subscribe to IPC events from the main process for real-time updates:

1. **Component** calls service method (e.g., `threadService.create()`)
2. **Service** invokes IPC handler via `window.electronAPI.thread.create()`
3. **Main process** persists data and emits event (`thread:created`)
4. **Store listener** receives event and updates local state
5. **Components** re-render via Svelte reactivity

## Best Practices Observed

1. **Typed Interfaces** - All stores have explicit TypeScript interfaces
2. **Immutable Updates** - Use spread operators for state updates
3. **Sorted Collections** - Auto-sort by timestamp on add
4. **Cleanup Functions** - IPC listeners return cleanup functions
5. **Derived Stores** - Use `derived()` for computed state
6. **Separation of Concerns** - Stores only manage state, services handle IPC

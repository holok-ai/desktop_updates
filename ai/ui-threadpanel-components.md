# Thread Panel Components

**Version:** 1.6
**Date:** 2026-01-31
**Status:** Implementation Ready

---

## Related Documents

| Document | Description |
|----------|-------------|
| **ui-threadpanel-overview.md** | Architecture and design principles |
| **ui-threadpanel-layout.md** | Layout system and file structure |
| **ui-threadpanel.view.chat.md** | Chat view and message timeline |
| **ui-threadpanel.view.branching.md** | Branch visualization view |
| **ui-threadpanel.view.execution.md** | Thread execution view |
| **ui-threadpanel.view.prompt.md** | Prompt list view |
| **ui-threadpanel.view.file.md** | File browser and manager view |
| **system-thread-multiplexing.md** | Stream multiplexing architecture |
| **Section 13-14** | Multi-view layout management system (LayoutConfig, ThreadLayoutSelector) |

---

## 1. Overview

This document defines the component hierarchy, state management architecture, and shared UI components for the Thread Panel. The Thread Panel uses a hierarchical state machine to prevent race conditions and cascading effects when authentication, project, thread, or connection status changes occur.

The Thread Panel integrates with the stream multiplexing system (see `system-thread-multiplexing.md`) to support concurrent chat streams across multiple branches within a thread. The Thread Panel also supports flexible multi-view layouts allowing users to display multiple views simultaneously while enforcing the constraint that only one instance of each view type can be displayed per layout.

---

## 2. Requirements

| # | Requirement |
|---|-------------|
| 1 | Prevent race conditions when switching authentication, project, or thread context |
| 2 | Cancel in-flight async operations when context changes before completion |
| 3 | Ensure child contexts (thread) cannot initialize until parent contexts (project, auth) are ready |
| 4 | Provide single dispatch entry point for all state-changing operations |
| 5 | Display appropriate loading states during context transitions |
| 6 | Maintain thread-level status indicator showing connection, streaming, and error states |
| 7 | Support 5 switchable views: Chat, Execution, Branching, Prompt, and File |
| 8 | Preserve scroll position when switching between views |
| 9 | Coordinate service initialization and cleanup on mount/unmount |
| 10 | Handle streaming timeouts and errors with clear user feedback |
| 11 | Support multiple concurrent streams per thread (branch-level streaming) |
| 12 | Display per-branch streaming status with 7-phase indicators |
| **Layout Management** | |
| 13 | Support 5 multi-view layout templates (single-col, vertical-split, col-left-split, col-right-split, quad-split) |
| 14 | User can select layout template from toolbar |
| 15 | Enforce constraint: only one instance of each view type per layout |
| 16 | Each pane displays one of 5 views independently |
| 17 | Layout configuration persists across thread switches |
| 18 | Responsive behavior: collapse multi-pane layouts to single-column on screens < 900px |

---

## 3. Component Tree

```
ThreadPanel.svelte (main orchestrator, ~1,000 lines)
├─ ThreadHeader.svelte (~150 lines)
│  ├─ ThreadBreadcrumb.svelte (existing, reuse)
│  ├─ ThreadTitle.svelte (~80 lines)
│  ├─ ThreadStatusIndicator.svelte (NEW, ~250 lines)
│  ├─ ThreadActions.svelte (~100 lines)
│  └─ ThreadLayoutSelector.svelte (NEW, ~150 lines)
│
├─ Layout Container (Grid/Flex based on LayoutConfig.template)
│  │
│  ├─ ThreadPanelView (for pane 1, ~150 lines)
│  │  ├─ ThreadPanelViewControls (~80 lines)
│  │  │  ├─ Close button (removes pane)
│  │  │  ├─ View swap dropdown
│  │  │  └─ Pin/fullscreen button
│  │  │
│  │  └─ ThreadChatView (one of 5 views)
│  │     ├─ uses: useThreadView() composable
│  │     ├─ MessageTimeline.svelte (~250 lines)
│  │     │  ├─ MessageItem.svelte (~150 lines)
│  │     │  └─ BranchBoxItem.svelte (~100 lines)
│  │     └─ MessageComposerArea.svelte (~150 lines)
│  │
│  ├─ ThreadPanelView (for pane 2, ~150 lines)
│  │  ├─ ThreadPanelViewControls (~80 lines)
│  │  └─ ThreadBranchingView
│  │     ├─ uses: useThreadView() composable
│  │     ├─ BranchingCanvas.svelte (~300 lines)
│  │     ├─ BranchingNode.svelte (~200 lines)
│  │     ├─ BranchingToolbar.svelte (~100 lines)
│  │     └─ BranchingDetailPanel.svelte (~150 lines)
│  │
│  ├─ ThreadPanelView (for pane 3, ~150 lines)
│  │  ├─ ThreadPanelViewControls (~80 lines)
│  │  └─ ThreadExecutionView
│  │     ├─ uses: useThreadView() composable
│  │     ├─ InstructionFileEditor.svelte (~200 lines)
│  │     ├─ ExecutionControls.svelte (~100 lines)
│  │     ├─ ExecutionHistory.svelte (~150 lines)
│  │     └─ ExecutionFrequencyChart.svelte (~100 lines)
│  │
│  └─ ThreadPanelView (for pane 4, ~150 lines)
│     ├─ ThreadPanelViewControls (~80 lines)
│     └─ ThreadPromptView or ThreadFileView
│        ├─ ThreadPromptView (if Prompt view)
│        │  ├─ uses: useThreadView() composable
│        │  ├─ PromptList.svelte (~50 lines)
│        │  └─ PromptItem.svelte (~100 lines)
│        │
│        └─ ThreadFileView (if File view)
│           ├─ uses: ProjectService
│           ├─ FileTree.svelte (~150 lines)
│           ├─ FolderItem.svelte (~120 lines)
│           ├─ FileItem.svelte (~140 lines)
│           └─ FileMetadataTooltip.svelte (~100 lines)
│
└─ Modals (shared)
   ├─ VariationModal.svelte (existing, reuse)
   ├─ MessageVersionHistory.svelte (existing, reuse)
   └─ MoveThreadModal.svelte (existing, reuse)

Total new code: ~6,500 lines (layout wrapper + views)
Reused code: ~1,500 lines
Total: ~8,000 lines (vs 3,437 in ChatPane)
```

### 3.1 Component File Structure

ThreadPanel components reside in `src/lib/components/threadpanel/`:

```
src/lib/components/threadpanel/
├── ThreadPanel.svelte              # Main orchestrator (~1,000 lines)
├── ThreadHeader.svelte             # Header with title, status, actions
├── ThreadTitle.svelte              # Editable thread title
├── ThreadStatusIndicator.svelte    # 7-phase status display
├── ThreadActions.svelte            # Action buttons
├── ThreadLayoutSelector.svelte     # Layout template selector
│
├── ThreadPanelView.svelte          # Pane wrapper (~150 lines)
├── ThreadPanelViewControls.svelte  # Pane controls (~80 lines)
│
├── viewchat/                       # Chat View components
│   ├── ThreadChatView.svelte       # Chat view container
│   ├── MessageTimeline.svelte      # Message list with branches
│   ├── MessageItem.svelte          # Single message display
│   ├── MessageComposerArea.svelte  # Message input component
│   └── BranchBoxItem.svelte        # Branch variation display
│
├── viewprompt/                     # Prompt View components
│   ├── ThreadPromptView.svelte     # Prompt view container
│   ├── PromptList.svelte           # Prompt list wrapper
│   └── PromptItem.svelte           # Single prompt item
│
├── viewexecution/                  # Execution View components
│   ├── ThreadExecutionView.svelte  # Execution view container
│   ├── InstructionFileEditor.svelte
│   ├── ExecutionControls.svelte
│   ├── ExecutionHistory.svelte
│   └── ExecutionFrequencyChart.svelte
│
├── viewbranching/                  # Branching View components
│   ├── ThreadBranchingView.svelte  # Branching view container
│   ├── BranchingGraphCanvas.svelte # SVG canvas
│   ├── BranchingGraphNode.svelte   # Graph node
│   └── BranchingDetailPanel.svelte # Node detail panel
│
└── viewfile/                       # File View components
    ├── ThreadFileView.svelte       # File browser container
    ├── FileTree.svelte             # Hierarchical tree
    ├── FolderItem.svelte           # Folder display
    ├── FileItem.svelte             # File with tooltips
    └── FileMetadataTooltip.svelte  # Metadata display
```

---

## 3.2 ThreadPanel (Main Orchestrator)

**Responsibilities:**
- Initialize layout based on `LayoutConfig`
- Render array of `ThreadPanelView` components
- Manage layout template selection
- Coordinate state machine with all views
- Handle adding/removing panes
- Persist layout changes to store

**Size Estimate:** ~1,000 lines

### 3.2.1 Props

```typescript
interface Props {
  thread: Thread;
  messages: Message[];
  onNavigate?: (threadId: string) => void;
}
```

### 3.2.2 Key State

```typescript
let layoutConfig: ThreadLayoutConfig = $state({
  template: 'quad-split',
  panes: [
    { id: 'pane-1', viewType: 'chat', focused: true },
    { id: 'pane-2', viewType: 'branching', focused: false },
    { id: 'pane-3', viewType: 'execution', focused: false },
    { id: 'pane-4', viewType: 'prompt', focused: false },
  ],
  modifiedAt: Date.now(),
});
```

### 3.2.3 Key Methods

- `handleLayoutChange(template)`: Apply new layout template
- `handleRemovePane(paneId)`: Remove pane, validate layout
- `handleSwapView(paneId, newViewType)`: Change view in pane
- `handleAddPane(viewType)`: Add new pane (if not at max)
- `handlePaneFocus(paneId)`: Set focused pane for keyboard nav

---

## 3.3 ThreadPanelView (Pane Wrapper)

**Responsibilities:**
- Render pane container with controls
- Host one of the 5 view components
- Manage per-pane scroll position
- Pass view-specific props to view component
- Handle pane-level events (close, swap, etc.)

**Size Estimate:** ~150 lines

### 3.3.1 Props

```typescript
interface Props {
  paneId: string;
  paneConfig: PaneConfig;
  isFocused: boolean;
  onRemove: (paneId: string) => void;
  onSwapView: (paneId: string, viewType: ViewType) => void;
  onFocus: (paneId: string) => void;
}
```

### 3.3.2 Template Structure

```svelte
<div class="pane" class:focused={isFocused} onclick={() => onFocus(paneId)}>
  <ThreadPanelViewControls
    {paneId}
    viewType={paneConfig.viewType}
    {onRemove}
    {onSwapView}
  />
  
  <div class="pane-content">
    {#if paneConfig.viewType === 'chat'}
      <ThreadChatView />
    {:else if paneConfig.viewType === 'branching'}
      <ThreadBranchingView />
    {:else if paneConfig.viewType === 'execution'}
      <ThreadExecutionView />
    {:else if paneConfig.viewType === 'prompt'}
      <ThreadPromptView />
    {:else if paneConfig.viewType === 'file'}
      <ThreadFileView />
    {/if}
  </div>
</div>
```

---

## 3.4 ThreadPanelViewControls

**Responsibilities:**
- Display control buttons for pane
- Close button (remove pane)
- View swap dropdown (change view type)
- Optional: Pin, fullscreen, menu

**Size Estimate:** ~80 lines

### 3.4.1 Props

```typescript
interface Props {
  paneId: string;
  viewType: ViewType;
  onRemove: (paneId: string) => void;
  onSwapView: (paneId: string, newViewType: ViewType) => void;
}
```

### 3.4.2 Controls

- **Close (×)** - Calls `onRemove(paneId)`
- **Swap (⧉)** - Opens dropdown with 4 other view options (not current view)
- **Menu (⋯)** - Optional: Full-screen, pin, settings

---

## 3.5 View Component Interface (Base Pattern)

All 5 view components follow a consistent interface pattern (no formal base class, but shared contract):

```typescript
interface ThreadViewComponent {
  // All views accept these props
  // (actual implementation varies per view)
}

// Example: ThreadChatView.svelte
interface ChatViewProps {
  // Views use useThreadView() to access state
  // See section 4.2 for full interface
}
```

**Key Pattern:**
- All views use `useThreadView()` composable to access thread state
- Views do NOT manage layout or pane concerns
- Views focus entirely on their domain (chat, execution, etc.)
- State flows from ThreadStateMachine → useThreadView → Views
- Views dispatch events back through machine, not parent component

**View Initialization:**
```svelte
<script lang="ts">
  import { useThreadView } from '$lib/composables/useThreadView.svelte';
  
  const view = useThreadView({
    viewId: 'chat',  // or 'execution', 'branching', 'prompt', 'file'
    onActivate: () => { /* view gained focus */ },
    onDeactivate: () => { /* view lost focus */ },
  });
</script>

<!-- Component body uses view context for all state/actions -->
{#if view.isLoading}
  <LoadingSpinner />
{:else if view.isReady}
  <!-- Render view content -->
{/if}
```

**View Responsibilities:**
- Read state from `view` context (view.messages, view.activeThread, etc.)
- Subscribe to relevant events (`view.onStreamToken`, etc.)
- Dispatch actions through `view.dispatch(event)`
- Manage scroll position with `view.setScrollContainer()`
- Register keyboard shortcuts with `view.registerShortcut()`
- No direct state mutation
- No parent component dependency (other than props)

---

## 4. useThreadView Composable

All five views (Chat, Execution, Branching, Prompt, File) share common functionality through the `useThreadView` composable. This provides consistent access to thread state, lifecycle management, scroll handling, and keyboard shortcuts.

**Design Principle:** The composable does NOT use `$effect()` for state changes. All state flows through the ThreadStateMachine via `dispatch()`. Views read state from the machine and trigger actions through explicit method calls and event subscriptions, not reactive side effects.

### 4.1 Shared Functionality

| Category | Shared Functionality |
|----------|---------------------|
| **State Access** | Read-only access to machine state via getters |
| **Lifecycle** | Mount/unmount hooks, cleanup registration, visibility callbacks |
| **Scroll** | Save/restore scroll position, scroll-to-message, scroll-to-bottom |
| **Keyboard** | Register/unregister view-specific shortcuts |
| **Actions** | Dispatch events to machine (single entry point) |
| **Subscriptions** | Subscribe to machine events for view-specific reactions |
| **Filtering** | Computed filters for messages by role, branch |
| **Logging** | Consistent view-level logging with view name prefix |

### 4.2 Interface Definition

```typescript
interface ThreadViewContext {
  // =========================================================================
  // State (read-only from ThreadStateMachine)
  // =========================================================================
  
  readonly currentThread: Thread | null;
  readonly messages: Message[];
  readonly project: Project | null;
  readonly user: User | null;
  readonly isReady: boolean;
  readonly error: string | null;
  readonly isLoading: boolean;
  
  // Branch-level streaming state
  readonly activeBranches: Map<string, BranchState>;
  readonly hasActiveStreams: boolean;

  // =========================================================================
  // Computed State (derived from machine state)
  // =========================================================================
  
  readonly userMessages: Message[];
  readonly assistantMessages: Message[];
  readonly hasMessages: boolean;
  readonly hasBranches: boolean;
  readonly threadTitle: string;

  // =========================================================================
  // Actions (all go through machine dispatch)
  // =========================================================================
  
  dispatch(event: PanelEvent): Promise<void>;
  refreshMessages(): Promise<void>;
  navigateToMessage(messageId: string): void;
  createVariation(message: Message): void;
  
  // Branch-level actions
  cancelBranch(branchId: string): Promise<void>;
  cancelAllBranches(): Promise<void>;

  // =========================================================================
  // Event Subscriptions (replaces $effect for view-specific reactions)
  // =========================================================================
  
  onStreamToken(callback: (branchId: string, token: string) => void): () => void;
  onStreamStatus(callback: (branchId: string, phase: StreamPhase, message?: string) => void): () => void;
  onStreamComplete(callback: (branchId: string, message: Message) => void): () => void;
  onMessageAdded(callback: (message: Message) => void): () => void;

  // =========================================================================
  // Scroll Management (explicit method calls, no effects)
  // =========================================================================
  
  saveScrollPosition(): void;
  restoreScrollPosition(): void;
  scrollToMessage(messageId: string, behavior?: ScrollBehavior): void;
  scrollToBottom(behavior?: ScrollBehavior): void;
  isAtBottom(): boolean;
  setScrollContainer(element: HTMLElement): void;

  // =========================================================================
  // Keyboard Shortcuts
  // =========================================================================
  
  registerShortcut(shortcut: KeyboardShortcut): void;
  unregisterShortcut(key: string): void;
  unregisterAllShortcuts(): void;

  // =========================================================================
  // Lifecycle (explicit calls, no effects)
  // =========================================================================
  
  onCleanup(fn: () => void): void;
  readonly isVisible: boolean;
  setVisible(visible: boolean): void;

  // =========================================================================
  // Logging
  // =========================================================================
  
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void;
}

interface KeyboardShortcut {
  key: string;
  modifiers?: ('ctrl' | 'shift' | 'alt' | 'meta')[];
  handler: (event: KeyboardEvent) => void;
  description?: string;
  preventDefault?: boolean;
}
```

### 4.3 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **No `$effect()` in composable** | Prevents cascading effects; all state flows through machine |
| **Subscription pattern** | Views subscribe to events, not state changes |
| **Getters instead of `$derived`** | Composable reads machine state on-demand |
| **Explicit method calls** | `setScrollContainer()`, `setVisible()` called in `onMount` |
| **Local state for view-specific UI** | Zoom, selection, expansion stays local |
| **Machine state for shared data** | Messages, thread, streaming go through machine |
| **Branch-level streaming** | Each branch tracks its own phase and status |

### 4.4 Benefits

| Benefit | Description |
|---------|-------------|
| **No cascading effects** | Subscriptions react to events, don't create new effects |
| **Single source of truth** | All shared state flows through ThreadStateMachine |
| **Predictable updates** | Machine dispatch is the only way to change shared state |
| **Testable** | Composable tested by dispatching events and checking state |
| **Clear data flow** | Actions → Machine → Subscriptions → View updates |
| **Memory safe** | Subscriptions cleaned up automatically on unmount |
| **Branch-aware** | Supports concurrent streams with per-branch status |

---

## 5. Hierarchical State Machine

The Thread Panel uses a hierarchical state machine to prevent race conditions when context changes occur. Each level (Auth → Project → Thread) must be in a "ready" state before children can initialize.

### 5.1 State Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│ AuthStateMachine                                            │
│ States: idle → authenticating → authenticated → error       │
│ Ready when: authenticated                                   │
├─────────────────────────────────────────────────────────────┤
│ ↓ (only proceeds when auth.ready)                          │
├─────────────────────────────────────────────────────────────┤
│ ProjectStateMachine                                         │
│ States: idle → loading → ready → error                      │
│ Ready when: ready                                           │
│ Resets to: idle (when auth changes)                        │
├─────────────────────────────────────────────────────────────┤
│ ↓ (only proceeds when project.ready)                       │
├─────────────────────────────────────────────────────────────┤
│ ThreadStateMachine                                          │
│ States: idle → loading → ready → error                      │
│ Ready when: ready                                           │
│ Resets to: idle (when project OR auth changes)             │
│ Streaming: tracked per-branch in activeBranches             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 State and Event Definitions

```typescript
// =========================================================================
// State Types
// =========================================================================

type AuthState = 'idle' | 'authenticating' | 'authenticated' | 'error';
type ProjectState = 'idle' | 'loading' | 'ready' | 'error';
type ThreadState = 'idle' | 'loading' | 'ready' | 'error';

/** Message status (persisted in ThreadRepository) */
type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error';

/** 
 * Stream phase (7 values) - real-time UI state from StreamManager
 * See system-thread-multiplexing.md for phase transition diagram
 */
type StreamPhase = 
  | 'initializing'  // Setting up request
  | 'sending'       // Request sent, waiting for response
  | 'receiving'     // Receiving tokens from model
  | 'tool_call'     // Tool is executing
  | 'finalizing'    // Stream ending, cleanup
  | 'complete'      // Done successfully
  | 'error';        // Failed

/** Per-branch streaming state */
interface BranchState {
  branchId: string;
  model: string;
  status: MessageStatus;      // Persisted status from repository
  phase: StreamPhase;         // Real-time phase for UI styling
  statusMessage?: string;     // Pass-through message from provider (e.g., "List folders")
  content: string;            // Accumulated content
  error?: string;
}

// =========================================================================
// Context
// =========================================================================

interface PanelContext {
  auth: { 
    state: AuthState; 
    user: User | null; 
    error: string | null; 
  };
  project: { 
    state: ProjectState; 
    project: Project | null; 
    error: string | null; 
  };
  thread: { 
    state: ThreadState; 
    currentThread: Thread | null; 
    messages: Message[]; 
    activeBranches: Map<string, BranchState>;
    error: string | null;
  };
}

// =========================================================================
// Events
// =========================================================================

type PanelEvent =
  // Auth events
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; user: User }
  | { type: 'AUTH_FAILURE'; error: string }
  | { type: 'AUTH_LOGOUT' }
  // Project events
  | { type: 'PROJECT_SELECT'; projectId: string }
  | { type: 'PROJECT_LOADED'; project: Project }
  | { type: 'PROJECT_ERROR'; error: string }
  | { type: 'PROJECT_CLEAR' }
  // Thread events
  | { type: 'THREAD_SELECT'; threadId: string; branchIds: string[] }
  | { type: 'THREAD_LOADED'; thread: Thread; messages: Message[]; branches: Map<string, BranchState> }
  | { type: 'THREAD_ERROR'; error: string }
  | { type: 'THREAD_CLEAR' }
  // Streaming events (branch-level)
  | { type: 'STREAM_START'; branchId: string }
  | { type: 'STREAM_TOKEN'; branchId: string; token: string }
  | { type: 'STREAM_STATUS'; branchId: string; phase: StreamPhase; message?: string }
  | { type: 'STREAM_COMPLETE'; branchId: string; message: Message }
  | { type: 'STREAM_ERROR'; branchId: string; error: string }
  | { type: 'STREAM_CANCEL'; branchId: string }
  | { type: 'STREAM_CANCEL_ALL' }
  // Message events
  | { type: 'MESSAGE_SEND'; content: string; branchId?: string }
  | { type: 'MESSAGE_SEND_BRANCHED'; content: string; models: BranchConfig[] }
  | { type: 'MESSAGE_ADDED'; message: Message }
  | { type: 'MESSAGES_REFRESH' };

/** Configuration for a branched send */
interface BranchConfig {
  branchId: string;
  appSlug: string;
  providerType: string;
  model: string;
  config: ProviderConfig;
}
```

### 5.3 Benefits

| Benefit | Description |
|---------|-------------|
| **No race conditions** | Single dispatch entry point serializes all state changes |
| **Automatic cleanup** | AbortController cancels in-flight operations on context change |
| **Clear dependencies** | Child states wait for parent ready states |
| **No cascading effects** | Events don't trigger other events — single dispatch handles all logic |
| **Debuggable** | All state changes logged through dispatch |
| **Testable** | Machine can be tested independently with event sequences |
| **Branch-aware** | Per-branch streaming state with 7-phase tracking |

---

## 6. ThreadComponent.svelte (Main Orchestrator)

**Responsibilities:**
- Manage active view (Chat/Execution/Branching/Prompt/File)
- Coordinate with ThreadStateMachine
- Handle keyboard shortcuts
- Render header, tabs, active view
- Show global modals
- Manage layout selection

**Size Estimate:** ~800 lines

### 6.1 Props

```typescript
interface Props {
  thread: Thread;
  messages: Message[];
  activeBranchId: string;
  onNavigate: (threadId: string) => void;
}
```

### 6.2 Key Methods

- `handleViewChange(viewType)`: Switch active view
- `handleLayoutChange(template)`: Change layout
- `handleSendMessage(content, branchId)`: Send message via state machine
- `handleCreateVariation(message)`: Create branch variation

---

## 7. ThreadHeader.svelte

**Responsibilities:**
- Display breadcrumb (if project thread)
- Show thread title (with edit capability)
- Render ThreadStatusIndicator
- Show ThreadActions

**Size Estimate:** ~150 lines

### 7.1 Props

```typescript
interface Props {
  title: string;
  status: StreamPhase | null;
  activeBranches: Map<string, BranchState>;
  onTitleChange: (newTitle: string) => void;
}
```

---

## 8. ThreadStatusIndicator.svelte

Displays streaming status with support for all 7 StreamPhases.

**Responsibilities:**
- Display per-branch status indicators
- Show 7-phase status: initializing, sending, receiving, tool_call, finalizing, complete, error
- Display pass-through status messages from providers (e.g., "List folders", "Found 6 files")
- Animate state transitions

**Size Estimate:** ~250 lines

### 8.1 Phase Display Mapping

```typescript
const phaseConfig: Record<StreamPhase, { icon: string; color: string; defaultText: string }> = {
  initializing: { icon: '○', color: 'muted',   defaultText: 'Initializing...' },
  sending:      { icon: '○', color: 'muted',   defaultText: 'Sending...' },
  receiving:    { icon: '●', color: 'accent',  defaultText: 'Receiving...' },
  tool_call:    { icon: '◐', color: 'accent',  defaultText: 'Processing...' },
  finalizing:   { icon: '○', color: 'warning', defaultText: 'Finalizing...' },
  complete:     { icon: '✓', color: 'success', defaultText: 'Complete' },
  error:        { icon: '✕', color: 'error',   defaultText: 'Error' },
};

function getStatusText(branch: BranchState): string {
  // Pass-through message takes priority over default phase text
  return branch.statusMessage || phaseConfig[branch.phase].defaultText;
}
```

---

## 9. ThreadViewTabs.svelte

**Responsibilities:**
- Render icon tabs for 5 views
- Highlight active view
- Emit view change events

**Size Estimate:** ~100 lines

### 9.1 Props

```typescript
interface Props {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}
```

---

## 10. View Components

### 10.1 ThreadChatView.svelte

**Responsibilities:**
- Display message timeline
- Handle message composer
- Manage scroll position
- Show branch variations

**Size Estimate:** ~400 lines

### 10.2 ThreadExecutionView.svelte

**Responsibilities:**
- Display instruction editor
- Show execution controls
- Display execution history
- Show frequency chart

**Size Estimate:** ~350 lines

### 10.3 ThreadBranchingView.svelte

**Responsibilities:**
- Render SVG branch graph
- Handle node interactions
- Show metadata on hover
- Support zoom/pan

**Size Estimate:** ~500 lines

### 10.4 ThreadPromptView.svelte

**Responsibilities:**
- Display prompt list
- Support expand/collapse
- Show prompt metadata

**Size Estimate:** ~200 lines

### 10.5 ThreadFileView.svelte

**Responsibilities:**
- Display hierarchical file tree
- Handle file/folder CRUD operations
- Show metadata tooltips
- Support keyboard navigation

**Size Estimate:** ~300 lines

#### 10.5.1 Props

```typescript
interface Props {
  projectId: string;
  rootPath?: string;
}
```

#### 10.5.2 Key Methods

- `expandFolder(path)`: Expand folder in tree
- `selectFile(path)`: Select file (highlight)
- `openFile(path)`: Open file for editing
- `createFile(path)`: Create new file
- `renameFile(oldPath, newPath)`: Rename file
- `deleteFile(path)`: Delete file

#### 10.5.3 Sub-components

- **FileTree.svelte**: Recursive tree renderer (~150 lines)
- **FolderItem.svelte**: Folder display with expand icon (~120 lines)
- **FileItem.svelte**: File display with context menu (~140 lines)
- **FileMetadataTooltip.svelte**: Tooltip with file metadata (~100 lines)

---

## 11. Global Stores

**File:** `src/lib/stores/thread-view.store.ts`

```typescript
import { writable } from 'svelte/store';

export type ViewType = 'chat' | 'execution' | 'branching' | 'prompt' | 'file';

interface ThreadViewState {
  activeView: ViewType;
  viewHistory: ViewType[];
  scrollPositions: Record<ViewType, number>;
}

export const threadViewState = writable<ThreadViewState>({
  activeView: 'chat',
  viewHistory: ['chat'],
  scrollPositions: {},
});

interface BranchSelectionState {
  activeBranchIndex: number | null;
  selectedBranchIds: string[];
  hiddenForkPoints: Set<string>;
  branchSelectionTime: number | null;
}

export const branchSelectionState = writable<BranchSelectionState>({
  activeBranchIndex: null,
  selectedBranchIds: [],
  hiddenForkPoints: new Set(),
  branchSelectionTime: null,
});
```

---

## 12. ThreadStatusService

**File:** `src/lib/services/thread-status.service.ts`

```typescript
import { threadStateMachine } from '$lib/machines/thread-state.machine.svelte';
import type { StreamPhase } from '$lib/machines/thread-state.machine.svelte';

class ThreadStatusService {
  /** Get aggregated status message for the thread */
  getStatusMessage(): string | null {
    if (threadStateMachine.error) return threadStateMachine.error;
    
    const branches = threadStateMachine.activeBranches;
    for (const [, branch] of branches) {
      if (branch.statusMessage) return branch.statusMessage;
      if (branch.phase === 'receiving') return 'Receiving response...';
      if (branch.phase === 'tool_call') return 'Executing tool...';
      if (branch.phase === 'sending') return 'Sending...';
    }
    
    return null;
  }

  /** Get overall indicator state based on active branches */
  getIndicatorState(): StreamPhase {
    if (threadStateMachine.error) return 'error';
    
    const branches = threadStateMachine.activeBranches;
    
    // Priority: error > tool_call > receiving > sending > initializing > finalizing > complete
    const phasePriority: StreamPhase[] = [
      'error', 'tool_call', 'receiving', 'sending', 'initializing', 'finalizing', 'complete'
    ];
    
    for (const phase of phasePriority) {
      for (const [, branch] of branches) {
        if (branch.phase === phase) return phase;
      }
    }
    
    return 'complete';
  }

  /** Check if any branch has active streaming */
  hasActiveStreams(): boolean {
    return threadStateMachine.hasActiveStreams;
  }
}

export const threadStatusService = new ThreadStatusService();
```

---

## 13. Layout Management (LayoutConfig)

**File:** `src/lib/types/layout.ts`

```typescript
export type ViewType = 'chat' | 'execution' | 'branching' | 'prompt' | 'file';
export type LayoutTemplate = 'single-col' | 'vertical-split' | 'col-left-split' | 'col-right-split' | 'quad-split';

interface PaneConfig {
  id: string;              // Unique identifier (pane-1, pane-2, etc.)
  viewType: ViewType;      // Which view in this pane
  focused: boolean;        // Keyboard focus
  cssClass?: string;       // Layout styling class
  scrollPosition?: number;  // Per-pane scroll state
}

interface ThreadLayoutConfig {
  template: LayoutTemplate;
  panes: PaneConfig[];
  modifiedAt: number;
  name?: string;           // Optional user-defined name
}
```

---

## 14. ThreadLayoutSelector Component

**File:** `src/lib/components/threadpanel/ThreadLayoutSelector.svelte`

**Responsibilities:**
- Display 5 layout buttons in header
- Validate layout changes
- Emit layout change events
- Show visual preview on hover

**Size Estimate:** ~150 lines

### 14.1 Props

```typescript
interface Props {
  currentLayout: LayoutTemplate;
  onLayoutChange: (template: LayoutTemplate) => void;
}
```

### 14.2 Layout Buttons

| Icon | Template | Label | Panes |
|------|----------|-------|-------|
| ≡ | single-col | Single | 1 |
| ⬌ | vertical-split | Split | 2 (left-right) |
| ⬅ | col-left-split | Left | 3 (left tall, right split) |
| ➡ | col-right-split | Right | 3 (left split, right tall) |
| ▦ | quad-split | Grid | 4 (2x2) |

---

## Summary of Changes (v1.5 → v1.6)

| Section | Change |
|---------|--------|
| **Related Documents** | Added ui-threadpanel.view.file.md |
| **Requirements** | Updated req 7: 4 → 5 views (added File) |
| **Component Tree** | Added ThreadFileView with sub-components (~300 lines) |
| **Component Tree** | Updated total code lines: ~6,500 → ~7,290 lines |
| **File Structure** | Added viewfile/ folder with 5 component files |
| **useThreadView** | File View uses ProjectService instead of state machine |
| **5. Hierarchical State Machine** | All reference to views updated (4 → 5) |
| **View Components** | Added section 10.5 ThreadFileView |
| **Global Stores** | Updated ViewType union to include 'file' |
| **Layout Management** | ViewType union updated to include 'file' |

---

## Vocabulary

| Term | Definition |
|------|-----------|
| **ThreadPanel** | Main container component for all thread UI. Manages layout, views, and state machine coordination. |
| **View** | One of five distinct presentation modes: Chat, Execution, Branching, Prompt, File. Each is independent and receives shared state from ThreadStateMachine. |
| **Pane** | A rectangular area within the layout that displays one View. A layout can have 1-4 panes (initially). Each pane displays one view type, enforced by single-instance constraint. |
| **ThreadStateMachine** | Hierarchical state machine that coordinates Auth → Project → Thread contexts. Serializes all state changes through single dispatch() entry point. Prevents race conditions and cascading effects. |
| **BranchState** | Per-branch streaming metadata tracked in machine's activeBranches Map. Includes phase (7 values), status (persisted), content (accumulated tokens), and optional statusMessage (pass-through from provider). |
| **StreamPhase** | Real-time streaming phase with 7 states: initializing, sending, receiving, tool_call, finalizing, complete, error. Independent of persisted message.status. |
| **MessageStatus** | Persisted status stored in Message entity (pending, streaming, complete, error). Distinguishable from StreamPhase, which is ephemeral UI state. |
| **useThreadView** | Composable providing views with read-only access to thread state, subscription mechanism for reactions, and explicit methods for scroll/keyboard/lifecycle management. No $effect() in composable. |
| **Layout Template** | Pre-defined configuration of panes: single-col, vertical-split, col-left-split, col-right-split, quad-split. User selects from toolbar. |
| **Single-Instance Constraint** | Architectural rule: only one instance of each view type can be displayed per layout. Prevents state duplication and simplifies streaming coordination. |
| **Pass-through Message** | statusMessage field from StreamManager provider (e.g., "List folders", "Found 6 files"). Overrides default phase text in status indicator. |
| **Branch Variation** | Alternative response generated by sending message to multiple models simultaneously, each in own branch with 4-digit branchId. |

---

**End of Document**

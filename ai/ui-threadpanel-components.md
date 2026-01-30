# Thread Panel Components

**Version:** 1.5
**Date:** 2026-01-28
**Status:** Implementation Ready

---

## Related Documents

| Document | Description |
|----------|-------------|
| **ui-threadpanel-overview.md** | Architecture and design principles |
| **ui-threadpanel-layout.md** | File structure and service layer |
| **ui-threadpanel.view.chat.md** | Chat view and message timeline |
| **ui-threadpanel.view.branching.md** | Branch visualization view |
| **ui-threadpanel.view.execution.md** | Thread execution view |
| **ui-threadpanel.view.prompt.md** | Prompt list view |
| **system-thread-multiplexing.md** | Stream multiplexing architecture |

---

## 1. Overview

This document defines the component hierarchy, state management architecture, and shared UI components for the Thread Panel. The Thread Panel uses a hierarchical state machine to prevent race conditions and cascading effects when authentication, project, thread, or connection status changes occur.

The Thread Panel integrates with the stream multiplexing system (see `system-thread-multiplexing.md`) to support concurrent chat streams across multiple branches within a thread.

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
| 7 | Support 4 switchable views: Chat, Execution, Branching, and Prompt |
| 8 | Preserve scroll position when switching between views |
| 9 | Coordinate service initialization and cleanup on mount/unmount |
| 10 | Handle streaming timeouts and errors with clear user feedback |
| 11 | Support multiple concurrent streams per thread (branch-level streaming) |
| 12 | Display per-branch streaming status with 7-phase indicators |

---

## 3. Component Tree

```
ThreadComponent.svelte (orchestrator, ~800 lines)
├─ ThreadHeader.svelte (~150 lines)
│  ├─ ThreadBreadcrumb.svelte (existing, reuse)
│  ├─ ThreadTitle.svelte (~80 lines)
│  ├─ ThreadStatusIndicator.svelte (NEW, ~250 lines)
│  └─ ThreadActions.svelte (~100 lines)
│
├─ ThreadViewTabs.svelte (NEW, ~100 lines)
│  └─ TabButton.svelte
│
├─ ThreadChatView.svelte (~400 lines)
│  ├─ uses: useThreadView() composable
│  ├─ MessageTimeline.svelte (~250 lines)
│  │  ├─ MessageItem.svelte (~150 lines)
│  │  │  └─ MessageBubble.svelte (existing, reuse)
│  │  └─ BranchBoxItem.svelte (~100 lines)
│  │     └─ BranchLane.svelte (existing, reuse)
│  └─ MessageComposerArea.svelte (NEW, ~150 lines)
│
├─ ThreadExecutionView.svelte (NEW, ~350 lines)
│  ├─ uses: useThreadView() composable
│  ├─ InstructionFileEditor.svelte (~200 lines)
│  ├─ ExecutionControls.svelte (~100 lines)
│  ├─ ExecutionHistory.svelte (~150 lines)
│  └─ ExecutionFrequencyChart.svelte (~100 lines)
│
├─ ThreadBranchingView.svelte (NEW, ~500 lines)
│  ├─ uses: useThreadView() composable
│  ├─ BranchingCanvas.svelte (SVG-based, ~300 lines)
│  ├─ BranchingNode.svelte (~200 lines)
│  ├─ BranchingToolbar.svelte (~100 lines)
│  └─ BranchingDetailPanel.svelte (~150 lines)
│
├─ ThreadPromptView.svelte (NEW, ~200 lines)
│  ├─ uses: useThreadView() composable
│  ├─ PromptList.svelte (~50 lines)
│  └─ PromptItem.svelte (~100 lines)
│
└─ Modals (shared)
   ├─ VariationModal.svelte (existing, reuse)
   ├─ MessageVersionHistory.svelte (existing, reuse)
   └─ MoveThreadModal.svelte (existing, reuse)

Total new code: ~5,000 lines
Reused code: ~1,500 lines
Total: ~6,500 lines (vs 3,437 in ChatPane)
```

### 3.1 Compoent File Structure 

 ThreadPanel components reside in `src/lib/components/threadpanel/`:

```
src/lib/components/threadpanel/
├── ThreadComponent.svelte          # Main orchestrator (~800 lines)
├── ThreadHeader.svelte             # Header with title, status, actions
├── ThreadTitle.svelte              # Editable thread title
├── ThreadStatusIndicator.svelte    # 7-phase status display
├── ThreadActions.svelte            # Action buttons
├── ThreadViewTabs.svelte           # View tab navigation
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
└── viewbranching/                  # Branching View components
    ├── ThreadBranchingView.svelte  # Branching view container
    ├── BranchingGraphCanvas.svelte # SVG canvas
    ├── BranchingGraphNode.svelte   # Graph node
    └── BranchingDetailPanel.svelte # Node detail panel
---

## 4. ThreadViewBase Composable

All four views (Chat, Execution, Branching, Prompt) share common functionality through the `useThreadView` composable. This provides consistent access to thread state, lifecycle management, scroll handling, and keyboard shortcuts.

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

### 4.3 Implementation

**File:** `src/lib/composables/useThreadView.svelte.ts`

```typescript
import { onMount } from 'svelte';
import { get } from 'svelte/store';
import { threadStateMachine } from '$lib/machines/thread-state.machine.svelte';
import { threadViewState } from '$lib/stores/thread-view.store';
import type { Message, Thread, Project, User } from '$lib/types';
import type { PanelEvent, StreamPhase, BranchState } from '$lib/machines/thread-state.machine.svelte';

export interface UseThreadViewOptions {
  viewId: 'chat' | 'execution' | 'branching' | 'prompt';
  onActivate?: () => void;
  onDeactivate?: () => void;
  autoRestoreScroll?: boolean;
  autoSaveScroll?: boolean;
}

export function useThreadView(options: UseThreadViewOptions): ThreadViewContext {
  const { 
    viewId, 
    onActivate, 
    onDeactivate, 
    autoRestoreScroll = true, 
    autoSaveScroll = true 
  } = options;
  
  // =========================================================================
  // Internal State (NOT reactive - managed explicitly)
  // =========================================================================
  
  let scrollContainer: HTMLElement | null = null;
  let _isVisible = false;
  const registeredShortcuts = new Map<string, KeyboardShortcut>();
  const cleanupFunctions: (() => void)[] = [];
  const eventSubscribers = {
    streamToken: new Set<(branchId: string, token: string) => void>(),
    streamStatus: new Set<(branchId: string, phase: StreamPhase, message?: string) => void>(),
    streamComplete: new Set<(branchId: string, message: Message) => void>(),
    messageAdded: new Set<(message: Message) => void>(),
  };

  // =========================================================================
  // State Accessors (read from machine on-demand)
  // =========================================================================
  
  function getCurrentThread(): Thread | null {
    return threadStateMachine.currentThread;
  }
  
  function getMessages(): Message[] {
    return threadStateMachine.messages;
  }
  
  function getProject(): Project | null {
    return threadStateMachine.project;
  }
  
  function getUser(): User | null {
    return threadStateMachine.user;
  }
  
  function getIsReady(): boolean {
    return threadStateMachine.isThreadReady;
  }
  
  function getActiveBranches(): Map<string, BranchState> {
    return threadStateMachine.activeBranches;
  }
  
  function getHasActiveStreams(): boolean {
    return threadStateMachine.hasActiveStreams;
  }
  
  function getError(): string | null {
    return threadStateMachine.error;
  }
  
  function getIsLoading(): boolean {
    return threadStateMachine.context.thread.state === 'loading';
  }

  // =========================================================================
  // Computed State (pure functions)
  // =========================================================================
  
  function getUserMessages(): Message[] {
    return getMessages().filter(m => m.role === 'user');
  }
  
  function getAssistantMessages(): Message[] {
    return getMessages().filter(m => m.role === 'assistant');
  }
  
  function getHasMessages(): boolean {
    return getMessages().length > 0;
  }
  
  function getHasBranches(): boolean {
    const messages = getMessages();
    const lanes = new Set(messages.map(m => m.branchId.split('.')[1]));
    return lanes.size > 1;
  }
  
  function getThreadTitle(): string {
    const thread = getCurrentThread();
    return thread?.title || thread?.id?.slice(0, 8) || 'Untitled Thread';
  }

  // =========================================================================
  // Actions (all go through machine dispatch)
  // =========================================================================
  
  async function dispatch(event: PanelEvent): Promise<void> {
    log('debug', `Dispatching ${event.type}`, event);
    
    // Dispatch to machine
    await threadStateMachine.dispatch(event);
    
    // Notify subscribers based on event type
    if (event.type === 'STREAM_TOKEN') {
      eventSubscribers.streamToken.forEach(cb => cb(event.branchId, event.token));
    } else if (event.type === 'STREAM_STATUS') {
      eventSubscribers.streamStatus.forEach(cb => cb(event.branchId, event.phase, event.message));
    } else if (event.type === 'STREAM_COMPLETE') {
      eventSubscribers.streamComplete.forEach(cb => cb(event.branchId, event.message));
    } else if (event.type === 'MESSAGE_ADDED') {
      eventSubscribers.messageAdded.forEach(cb => cb(event.message));
    }
  }
  
  async function refreshMessages(): Promise<void> {
    await dispatch({ type: 'MESSAGES_REFRESH' });
  }
  
  function navigateToMessage(messageId: string): void {
    window.dispatchEvent(new CustomEvent('thread:navigate-to-message', {
      detail: { messageId, viewId }
    }));
  }
  
  function createVariation(message: Message): void {
    window.dispatchEvent(new CustomEvent('thread:create-variation', {
      detail: { message, viewId }
    }));
  }
  
  async function cancelBranch(branchId: string): Promise<void> {
    await dispatch({ type: 'STREAM_CANCEL', branchId });
  }
  
  async function cancelAllBranches(): Promise<void> {
    await dispatch({ type: 'STREAM_CANCEL_ALL' });
  }

  // =========================================================================
  // Event Subscriptions (replaces $effect pattern)
  // =========================================================================
  
  function onStreamToken(callback: (branchId: string, token: string) => void): () => void {
    eventSubscribers.streamToken.add(callback);
    return () => eventSubscribers.streamToken.delete(callback);
  }
  
  function onStreamStatus(callback: (branchId: string, phase: StreamPhase, message?: string) => void): () => void {
    eventSubscribers.streamStatus.add(callback);
    return () => eventSubscribers.streamStatus.delete(callback);
  }
  
  function onStreamComplete(callback: (branchId: string, message: Message) => void): () => void {
    eventSubscribers.streamComplete.add(callback);
    return () => eventSubscribers.streamComplete.delete(callback);
  }
  
  function onMessageAdded(callback: (message: Message) => void): () => void {
    eventSubscribers.messageAdded.add(callback);
    return () => eventSubscribers.messageAdded.delete(callback);
  }

  // =========================================================================
  // Scroll Management (explicit calls only)
  // =========================================================================
  
  function setScrollContainer(element: HTMLElement): void {
    scrollContainer = element;
    log('debug', 'Scroll container set');
  }
  
  function saveScrollPosition(): void {
    if (!scrollContainer) return;
    
    const position = scrollContainer.scrollTop;
    threadViewState.update(s => ({
      ...s,
      scrollPositions: { ...s.scrollPositions, [viewId]: position }
    }));
    log('debug', `Saved scroll position: ${position}`);
  }
  
  function restoreScrollPosition(): void {
    if (!scrollContainer) return;
    
    const position = get(threadViewState).scrollPositions[viewId] ?? 0;
    scrollContainer.scrollTop = position;
    log('debug', `Restored scroll position: ${position}`);
  }
  
  function scrollToMessage(messageId: string, behavior: ScrollBehavior = 'smooth'): void {
    if (!scrollContainer) return;
    
    const element = scrollContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (element) {
      element.scrollIntoView({ behavior, block: 'center' });
      log('debug', `Scrolled to message: ${messageId}`);
    }
  }
  
  function scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
    if (!scrollContainer) return;
    scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior });
  }
  
  function isAtBottom(): boolean {
    if (!scrollContainer) return true;
    const threshold = 50;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    return scrollHeight - scrollTop - clientHeight < threshold;
  }

  // =========================================================================
  // Keyboard Shortcuts
  // =========================================================================
  
  function registerShortcut(shortcut: KeyboardShortcut): void {
    const key = buildShortcutKey(shortcut);
    registeredShortcuts.set(key, shortcut);
    log('debug', `Registered shortcut: ${key}`);
  }
  
  function unregisterShortcut(key: string): void {
    registeredShortcuts.delete(key);
  }
  
  function unregisterAllShortcuts(): void {
    registeredShortcuts.clear();
  }
  
  function buildShortcutKey(shortcut: KeyboardShortcut): string {
    const mods = shortcut.modifiers?.sort().join('+') || '';
    return mods ? `${mods}+${shortcut.key}` : shortcut.key;
  }
  
  function handleKeyDown(event: KeyboardEvent): void {
    if (!_isVisible) return;
    
    const key = buildShortcutKey({
      key: event.key,
      modifiers: [
        event.ctrlKey && 'ctrl',
        event.shiftKey && 'shift',
        event.altKey && 'alt',
        event.metaKey && 'meta',
      ].filter(Boolean) as ('ctrl' | 'shift' | 'alt' | 'meta')[]
    });
    
    const shortcut = registeredShortcuts.get(key);
    if (shortcut) {
      if (shortcut.preventDefault !== false) event.preventDefault();
      shortcut.handler(event);
    }
  }

  // =========================================================================
  // Lifecycle (explicit calls, no $effect)
  // =========================================================================
  
  function onCleanup(fn: () => void): void {
    cleanupFunctions.push(fn);
  }
  
  function setVisible(visible: boolean): void {
    const wasVisible = _isVisible;
    _isVisible = visible;
    
    if (visible && !wasVisible) {
      log('info', 'View activated');
      if (autoRestoreScroll) {
        requestAnimationFrame(() => restoreScrollPosition());
      }
      onActivate?.();
    } else if (!visible && wasVisible) {
      log('info', 'View deactivated');
      if (autoSaveScroll) saveScrollPosition();
      onDeactivate?.();
    }
  }

  // =========================================================================
  // Logging
  // =========================================================================
  
  function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    const prefix = `[${viewId.charAt(0).toUpperCase() + viewId.slice(1)}View]`;
    const logFn = console[level] || console.log;
    if (data !== undefined) {
      logFn(prefix, message, data);
    } else {
      logFn(prefix, message);
    }
  }

  // =========================================================================
  // Setup & Teardown (onMount only, no $effect)
  // =========================================================================
  
  onMount(() => {
    log('info', 'Mounted');
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      log('info', 'Unmounting');
      window.removeEventListener('keydown', handleKeyDown);
      unregisterAllShortcuts();
      cleanupFunctions.forEach(fn => {
        try { fn(); } catch (e) { log('error', 'Cleanup error', e); }
      });
    };
  });

  // =========================================================================
  // Return Context (getters for on-demand state access)
  // =========================================================================
  
  return {
    // State (getters read from machine)
    get currentThread() { return getCurrentThread(); },
    get messages() { return getMessages(); },
    get project() { return getProject(); },
    get user() { return getUser(); },
    get isReady() { return getIsReady(); },
    get activeBranches() { return getActiveBranches(); },
    get hasActiveStreams() { return getHasActiveStreams(); },
    get error() { return getError(); },
    get isLoading() { return getIsLoading(); },
    
    // Computed
    get userMessages() { return getUserMessages(); },
    get assistantMessages() { return getAssistantMessages(); },
    get hasMessages() { return getHasMessages(); },
    get hasBranches() { return getHasBranches(); },
    get threadTitle() { return getThreadTitle(); },
    
    // Actions
    dispatch,
    refreshMessages,
    navigateToMessage,
    createVariation,
    cancelBranch,
    cancelAllBranches,
    
    // Subscriptions
    onStreamToken,
    onStreamStatus,
    onStreamComplete,
    onMessageAdded,
    
    // Scroll
    saveScrollPosition,
    restoreScrollPosition,
    scrollToMessage,
    scrollToBottom,
    isAtBottom,
    setScrollContainer,
    
    // Keyboard
    registerShortcut,
    unregisterShortcut,
    unregisterAllShortcuts,
    
    // Lifecycle
    onCleanup,
    get isVisible() { return _isVisible; },
    setVisible,
    
    // Logging
    log,
  };
}
```

### 4.4 Usage in View Components

**Key Pattern:** Components use `onMount` for setup and subscriptions for view-specific reactions (like auto-scroll) instead of `$effect()`. This prevents cascading effects and keeps all state changes flowing through the machine.

**ThreadChatView.svelte:**
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { useThreadView } from '$lib/composables/useThreadView.svelte';
  import MessageComposerArea from './MessageComposerArea.svelte';

  interface Props {
    thread: Thread;
    messages: Message[];
    activeBranchId: string;
    onCreateVariation: (message: Message) => void;
  }

  const { thread, messages, activeBranchId, onCreateVariation }: Props = $props();

  const view = useThreadView({
    viewId: 'chat',
    onActivate: () => {
      if (view.isAtBottom()) {
        view.scrollToBottom('instant');
      }
    },
  });

  // Local view state (not in machine)
  let hiddenForkPoints = $state(new Set<string>());
  let timelineElement: HTMLDivElement | undefined;

  // Register shortcuts
  view.registerShortcut({
    key: 'Escape',
    handler: () => { hiddenForkPoints = new Set(); },
    description: 'Clear selection',
  });

  view.registerShortcut({
    key: 'End',
    modifiers: ['ctrl'],
    handler: () => view.scrollToBottom(),
    description: 'Scroll to bottom',
  });

  // Setup on mount - NO $effect() needed
  onMount(() => {
    if (timelineElement) {
      view.setScrollContainer(timelineElement);
    }

    // Subscribe to stream tokens for auto-scroll (branch-aware)
    const unsubToken = view.onStreamToken((branchId, token) => {
      if (view.isAtBottom()) {
        view.scrollToBottom('instant');
      }
    });

    return () => {
      unsubToken();
    };
  });

  async function handleSendMessage(content: string, branchId: string) {
    await view.dispatch({ type: 'MESSAGE_SEND', content, branchId });
  }
</script>

{#if view.isLoading}
  <LoadingSpinner message="Loading messages..." />
{:else if view.error}
  <ErrorDisplay error={view.error} onRetry={view.refreshMessages} />
{:else if !view.hasMessages}
  <EmptyState message="No messages yet. Start a conversation!" />
{:else}
  <div class="thread-chat-view">
    <div class="message-timeline" bind:this={timelineElement}>
      {#each view.messages as message (message.id)}
        <MessageItem
          {message}
          branchState={view.activeBranches.get(message.branchId)}
          onCreateVariation={() => onCreateVariation(message)}
        />
      {/each}
    </div>

    {#if view.hasActiveStreams}
      <button class="cancel-all" onclick={() => view.cancelAllBranches()}>
        Cancel All
      </button>
    {/if}

    <MessageComposerArea
      {activeBranchId}
      disabled={view.hasActiveStreams}
      onSendMessage={handleSendMessage}
    />
  </div>
{/if}
```

### 4.5 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **No `$effect()` in composable** | Prevents cascading effects; all state flows through machine |
| **Subscription pattern** | Views subscribe to events, not state changes |
| **Getters instead of `$derived`** | Composable reads machine state on-demand |
| **Explicit method calls** | `setScrollContainer()`, `setVisible()` called in `onMount` |
| **Local state for view-specific UI** | Zoom, selection, expansion stays local |
| **Machine state for shared data** | Messages, thread, streaming go through machine |
| **Branch-level streaming** | Each branch tracks its own phase and status |

### 4.6 Benefits

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

### 5.3 ThreadStateMachine Implementation

**File:** `src/lib/machines/thread-state.machine.svelte.ts`

```typescript
import type { User, Project, Thread, Message } from '$lib/types';
import { chatStreamService } from '$lib/services/chat-stream.service';

const INITIAL_CONTEXT: PanelContext = {
  auth: { state: 'idle', user: null, error: null },
  project: { state: 'idle', project: null, error: null },
  thread: { 
    state: 'idle', 
    currentThread: null, 
    messages: [], 
    activeBranches: new Map(),
    error: null 
  },
};

class ThreadStateMachine {
  private _context = $state<PanelContext>(INITIAL_CONTEXT);
  private pendingOperation: AbortController | null = null;

  // =========================================================================
  // Derived Ready States
  // =========================================================================

  readonly isAuthReady = $derived(this._context.auth.state === 'authenticated');
  
  readonly isProjectReady = $derived(
    this.isAuthReady && this._context.project.state === 'ready'
  );
  
  readonly isThreadReady = $derived(
    this.isProjectReady && this._context.thread.state === 'ready'
  );
  
  readonly hasActiveStreams = $derived(() => {
    for (const [, branch] of this._context.thread.activeBranches) {
      if (!['complete', 'error'].includes(branch.phase)) {
        return true;
      }
    }
    return false;
  });

  // =========================================================================
  // Public Accessors
  // =========================================================================

  get context() { return this._context; }
  get user() { return this._context.auth.user; }
  get project() { return this._context.project.project; }
  get currentThread() { return this._context.thread.currentThread; }
  get messages() { return this._context.thread.messages; }
  get activeBranches() { return this._context.thread.activeBranches; }
  get error() { 
    return this._context.thread.error 
      ?? this._context.project.error 
      ?? this._context.auth.error; 
  }

  // =========================================================================
  // Single Dispatch Entry Point
  // =========================================================================

  async dispatch(event: PanelEvent): Promise<void> {
    console.log('[Machine] Event:', event.type);

    if (this.shouldCancelPending(event)) {
      this.cancelPendingOperations();
    }

    switch (event.type) {
      // ---------------------------------------------------------------------
      // Auth Events
      // ---------------------------------------------------------------------
      
      case 'AUTH_LOGOUT':
        this.resetThread();
        this.resetProject();
        this._context.auth = { state: 'idle', user: null, error: null };
        break;

      case 'AUTH_SUCCESS':
        this._context.auth = { state: 'authenticated', user: event.user, error: null };
        break;

      case 'AUTH_FAILURE':
        this._context.auth = { state: 'error', user: null, error: event.error };
        break;

      // ---------------------------------------------------------------------
      // Project Events
      // ---------------------------------------------------------------------
      
      case 'PROJECT_SELECT':
        if (!this.isAuthReady) return;
        this.resetThread();
        this._context.project = { state: 'loading', project: null, error: null };
        await this.loadProject(event.projectId);
        break;

      case 'PROJECT_CLEAR':
        this.resetThread();
        this.resetProject();
        break;

      // ---------------------------------------------------------------------
      // Thread Events
      // ---------------------------------------------------------------------
      
      case 'THREAD_SELECT':
        if (!this.isProjectReady) return;
        this.resetThread();
        this._context.thread = { 
          ...this._context.thread, 
          state: 'loading', 
          error: null 
        };
        await this.loadThread(event.threadId, event.branchIds);
        break;

      case 'THREAD_LOADED':
        this._context.thread = {
          state: 'ready',
          currentThread: event.thread,
          messages: event.messages,
          activeBranches: event.branches,
          error: null,
        };
        break;

      case 'THREAD_ERROR':
        this._context.thread = {
          ...this._context.thread,
          state: 'error',
          error: event.error,
        };
        break;

      case 'THREAD_CLEAR':
        this.resetThread();
        break;

      // ---------------------------------------------------------------------
      // Streaming Events (branch-level)
      // ---------------------------------------------------------------------
      
      case 'STREAM_TOKEN':
        this.updateBranch(event.branchId, branch => ({
          ...branch,
          content: branch.content + event.token,
          status: 'streaming',
        }));
        break;

      case 'STREAM_STATUS':
        this.updateBranch(event.branchId, branch => ({
          ...branch,
          phase: event.phase,
          statusMessage: event.message,
        }));
        break;

      case 'STREAM_COMPLETE':
        this.updateBranch(event.branchId, branch => ({
          ...branch,
          status: 'complete',
          phase: 'complete',
          statusMessage: undefined,
        }));
        // Add completed message to messages array
        this._context.thread = {
          ...this._context.thread,
          messages: [...this._context.thread.messages, event.message],
        };
        break;

      case 'STREAM_ERROR':
        this.updateBranch(event.branchId, branch => ({
          ...branch,
          status: 'error',
          phase: 'error',
          error: event.error,
        }));
        break;

      case 'STREAM_CANCEL':
        await chatStreamService.cancelBranch(event.branchId);
        break;

      case 'STREAM_CANCEL_ALL':
        await chatStreamService.cancelAll();
        break;

      // ---------------------------------------------------------------------
      // Message Events
      // ---------------------------------------------------------------------
      
      case 'MESSAGE_SEND':
        if (!this.isThreadReady) return;
        await this.sendMessage(event.content, event.branchId);
        break;

      case 'MESSAGE_SEND_BRANCHED':
        if (!this.isThreadReady) return;
        await this.sendBranchedMessage(event.content, event.models);
        break;

      case 'MESSAGE_ADDED':
        this._context.thread = {
          ...this._context.thread,
          messages: [...this._context.thread.messages, event.message],
        };
        break;

      case 'MESSAGES_REFRESH':
        if (!this._context.thread.currentThread) return;
        const messages = await window.electronAPI.thread.getMessages(
          this._context.thread.currentThread.id
        );
        this._context.thread = { ...this._context.thread, messages };
        break;
    }
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private updateBranch(branchId: string, updater: (branch: BranchState) => BranchState): void {
    const branches = new Map(this._context.thread.activeBranches);
    const existing = branches.get(branchId);
    if (existing) {
      branches.set(branchId, updater(existing));
      this._context.thread = { ...this._context.thread, activeBranches: branches };
    }
  }

  private async loadProject(projectId: string): Promise<void> {
    const controller = new AbortController();
    this.pendingOperation = controller;

    try {
      const project = await window.electronAPI.project.get(projectId);
      if (controller.signal.aborted) return;
      this._context.project = { state: 'ready', project, error: null };
    } catch (error) {
      if (!controller.signal.aborted) {
        this._context.project = { 
          state: 'error', 
          project: null, 
          error: error instanceof Error ? error.message : 'Failed to load project'
        };
      }
    } finally {
      if (this.pendingOperation === controller) this.pendingOperation = null;
    }
  }

  private async loadThread(threadId: string, branchIds: string[]): Promise<void> {
    const controller = new AbortController();
    this.pendingOperation = controller;

    try {
      // Use chatStreamService for proper subscription sequence
      const result = await chatStreamService.viewThread(
        threadId,
        branchIds,
        // Callback for real-time updates - route to dispatch
        (branchId, state) => {
          // Don't dispatch during initial load
          if (this._context.thread.state === 'ready') {
            this.updateBranch(branchId, () => state);
          }
        }
      );

      if (controller.signal.aborted) return;

      // Get thread metadata
      const thread = await window.electronAPI.thread.get(threadId);
      if (controller.signal.aborted) return;

      // Get messages (includes status)
      const messages = await window.electronAPI.thread.getMessages(threadId);
      if (controller.signal.aborted) return;

      this._context.thread = {
        state: 'ready',
        currentThread: thread,
        messages,
        activeBranches: result,
        error: null,
      };

    } catch (error) {
      if (!controller.signal.aborted) {
        this._context.thread = {
          ...this._context.thread,
          state: 'error',
          error: error instanceof Error ? error.message : 'Failed to load thread',
        };
      }
    } finally {
      if (this.pendingOperation === controller) this.pendingOperation = null;
    }
  }

  private async sendMessage(content: string, branchId?: string): Promise<void> {
    const threadId = this._context.thread.currentThread!.id;
    const targetBranchId = branchId || this.getNextBranchId();

    // Create user message locally
    const userMessage: Message = {
      id: crypto.randomUUID(),
      threadId,
      branchId: targetBranchId,
      role: 'user',
      content,
      status: 'complete',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Add to messages
    this._context.thread = {
      ...this._context.thread,
      messages: [...this._context.thread.messages, userMessage],
    };

    // Start stream via chatStreamService
    await chatStreamService.startStream(threadId, targetBranchId, content, this._context.thread.messages);
  }

  private async sendBranchedMessage(content: string, models: BranchConfig[]): Promise<void> {
    const threadId = this._context.thread.currentThread!.id;

    // Create user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      threadId,
      branchId: models[0].branchId, // Use first branch for user message
      role: 'user',
      content,
      status: 'complete',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this._context.thread = {
      ...this._context.thread,
      messages: [...this._context.thread.messages, userMessage],
    };

    // Start branched streams via chatStreamService
    await chatStreamService.startBranched(threadId, content, models, this._context.thread.messages);
  }

  private getNextBranchId(): string {
    // Calculate next branch ID based on current messages
    const messages = this._context.thread.messages;
    const maxRow = Math.max(0, ...messages.map(m => parseInt(m.branchId.split('.')[0], 10)));
    return `${maxRow + 1}.0.0.0`;
  }

  private resetProject(): void {
    this._context.project = { state: 'idle', project: null, error: null };
  }

  private resetThread(): void {
    chatStreamService.cleanup();
    this._context.thread = { 
      state: 'idle', 
      currentThread: null, 
      messages: [], 
      activeBranches: new Map(),
      error: null 
    };
  }

  private cancelPendingOperations(): void {
    this.pendingOperation?.abort();
    this.pendingOperation = null;
    chatStreamService.cleanup();
  }

  private shouldCancelPending(event: PanelEvent): boolean {
    return ['AUTH_LOGOUT', 'PROJECT_SELECT', 'PROJECT_CLEAR', 'THREAD_SELECT', 'THREAD_CLEAR']
      .includes(event.type);
  }
}

export const threadStateMachine = new ThreadStateMachine();
export type { PanelEvent, PanelContext, BranchState, StreamPhase, MessageStatus, BranchConfig };
```

### 5.4 Benefits

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

## 6. ChatStreamService

The `chatStreamService` handles IPC communication with the backend StreamManager. It encapsulates subscription management, stream lifecycle, and routes IPC events to the state machine.

**File:** `src/lib/services/chat-stream.service.ts`

```typescript
import type { StreamMessage, StartStreamParams } from '$electron/services/chat/stream-manager.js';
import type { StreamPhase, StreamStatus } from '$electron/services/chat/stream-types.js';
import type { Message, MessageStatus } from '$lib/types';

/** Per-branch state tracked by the service */
export interface BranchState {
  branchId: string;
  model: string;
  status: MessageStatus;
  phase: StreamPhase;
  statusMessage?: string;
  content: string;
  error?: string;
}

type BranchUpdateCallback = (branchId: string, state: BranchState) => void;

class ChatStreamService {
  private currentThreadId: string | null = null;
  private branches = new Map<string, BranchState>();
  private unsubscribe: (() => void) | null = null;
  private onUpdate: BranchUpdateCallback | null = null;

  // =========================================================================
  // View Thread (Subscribe → Load → Listen)
  // =========================================================================

  async viewThread(
    threadId: string,
    branchIds: string[],
    onUpdate: BranchUpdateCallback
  ): Promise<Map<string, BranchState>> {
    this.cleanup();
    this.currentThreadId = threadId;
    this.onUpdate = onUpdate;

    // 1. Subscribe to branches (so we don't miss any tokens)
    await window.electronAPI.chat.subscribe(threadId, branchIds);

    // 2. Load messages WITH status from repository
    const messages = await window.electronAPI.thread.getMessages(threadId);

    // 3. Initialize branch states from message.status
    for (const branchId of branchIds) {
      const msg = messages.find((m: Message) => m.branchId === branchId);
      this.branches.set(branchId, {
        branchId,
        model: msg?.model || 'unknown',
        status: msg?.status || 'pending',
        phase: this.statusToPhase(msg?.status),
        content: msg?.content || '',
        error: msg?.error,
      });
    }

    // 4. Set up IPC listener for real-time updates
    this.unsubscribe = window.electronAPI.chat.onStreamMessage((msg) => {
      if (msg.threadId === this.currentThreadId) {
        this.handleMessage(msg);
      }
    });

    return new Map(this.branches);
  }

  // =========================================================================
  // Start Stream (Single Branch)
  // =========================================================================

  async startStream(
    threadId: string,
    branchId: string,
    content: string,
    messages: Message[]
  ): Promise<void> {
    // Initialize branch state
    this.branches.set(branchId, {
      branchId,
      model: 'default', // Will be set by actual start params
      status: 'pending',
      phase: 'initializing',
      content: '',
    });

    await window.electronAPI.chat.addSubscription(threadId, branchId);
    this.onUpdate?.(branchId, this.branches.get(branchId)!);

    // Note: Actual chat.start() call requires full StartStreamParams
    // which would come from the UI/machine with appSlug, config, etc.
  }

  // =========================================================================
  // Start Branched (Multiple Concurrent Streams)
  // =========================================================================

  async startBranched(
    threadId: string,
    prompt: string,
    models: Array<{
      branchId: string;
      appSlug: string;
      providerType: string;
      model: string;
      config: any;
    }>,
    messages: Message[]
  ): Promise<void> {
    // Initialize branch states as pending
    for (const m of models) {
      this.branches.set(m.branchId, {
        branchId: m.branchId,
        model: m.model,
        status: 'pending',
        phase: 'initializing',
        content: '',
      });
      await window.electronAPI.chat.addSubscription(threadId, m.branchId);
      this.onUpdate?.(m.branchId, this.branches.get(m.branchId)!);
    }

    // Build request for each branch
    const branches = models.map(m => ({
      branchId: m.branchId,
      appSlug: m.appSlug,
      providerType: m.providerType,
      model: m.model,
      config: m.config,
      request: {
        messages,
        thread_guid: threadId,
        branch_id: m.branchId,
      },
    }));

    // Start all streams
    const results = await window.electronAPI.chat.startBranched(threadId, branches);

    // Handle immediate failures
    for (const r of results) {
      if (!r.success) {
        const state = this.branches.get(r.branchId);
        if (state) {
          state.status = 'error';
          state.phase = 'error';
          state.error = r.error;
          this.onUpdate?.(r.branchId, { ...state });
        }
      }
    }
  }

  // =========================================================================
  // Cancel Operations
  // =========================================================================

  async cancelBranch(branchId: string): Promise<void> {
    if (this.currentThreadId) {
      await window.electronAPI.chat.cancel(this.currentThreadId, branchId);
      const state = this.branches.get(branchId);
      if (state) {
        state.status = 'error';
        state.phase = 'error';
        state.error = 'Cancelled by user';
        this.onUpdate?.(branchId, { ...state });
      }
    }
  }

  async cancelAll(): Promise<void> {
    if (this.currentThreadId) {
      await window.electronAPI.chat.cancelThread(this.currentThreadId);
      for (const [branchId, state] of this.branches) {
        if (state.status === 'streaming' || state.status === 'pending') {
          state.status = 'error';
          state.phase = 'error';
          state.error = 'Cancelled by user';
          this.onUpdate?.(branchId, { ...state });
        }
      }
    }
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  cleanup(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    window.electronAPI.chat.unsubscribe();
    this.branches.clear();
    this.currentThreadId = null;
    this.onUpdate = null;
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private handleMessage(msg: StreamMessage): void {
    const state = this.branches.get(msg.branchId);
    if (!state) return;

    switch (msg.type) {
      case 'token':
        state.content += (msg.payload as { token: string }).token;
        state.status = 'streaming';
        break;

      case 'status':
        const { phase, message } = msg.payload as StreamStatus;
        state.phase = phase;
        state.statusMessage = message;
        break;

      case 'complete':
        state.status = 'complete';
        state.phase = 'complete';
        state.statusMessage = undefined;
        break;

      case 'error':
        state.status = 'error';
        state.phase = 'error';
        state.error = (msg.payload as { message: string }).message;
        break;
    }

    this.onUpdate?.(msg.branchId, { ...state });
  }

  private statusToPhase(status?: MessageStatus): StreamPhase {
    switch (status) {
      case 'pending': return 'initializing';
      case 'streaming': return 'receiving';
      case 'complete': return 'complete';
      case 'error': return 'error';
      default: return 'initializing';
    }
  }
}

export const chatStreamService = new ChatStreamService();
```

---

## 7. ThreadComponent.svelte (Main Orchestrator)

**Responsibilities:**
- Manage active view (Chat/Execution/Branching/Prompt)
- Coordinate with ThreadPanelMachine
- Handle keyboard shortcuts
- Render header, tabs, active view
- Show global modals

**Size Estimate:** ~800 lines

---

## 8. ThreadHeader.svelte

**Responsibilities:**
- Display breadcrumb (if project thread)
- Show thread title (with edit capability)
- Render ThreadStatusIndicator
- Show ThreadActions

**Size Estimate:** ~150 lines

---

## 9. ThreadStatusIndicator.svelte

Displays streaming status with support for all 7 StreamPhases.

**Responsibilities:**
- Display per-branch status indicators
- Show 7-phase status: initializing, sending, receiving, tool_call, finalizing, complete, error
- Display pass-through status messages from providers (e.g., "List folders", "Found 6 files")
- Animate state transitions

**Size Estimate:** ~250 lines

### 9.1 Interface

```typescript
interface Props {
  activeBranches: Map<string, BranchState>;
}
```

### 9.2 Phase Display Mapping

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

### 9.3 Implementation Sketch

```svelte
<script lang="ts">
  import type { BranchState, StreamPhase } from '$lib/machines/thread-panel.machine.svelte';

  interface Props {
    activeBranches: Map<string, BranchState>;
  }

  const { activeBranches }: Props = $props();

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
    return branch.statusMessage || phaseConfig[branch.phase].defaultText;
  }

  function isActive(phase: StreamPhase): boolean {
    return !['complete', 'error'].includes(phase);
  }
</script>

<div class="status-indicator">
  {#each [...activeBranches.values()] as branch (branch.branchId)}
    {@const config = phaseConfig[branch.phase]}
    <div class="branch-status" class:active={isActive(branch.phase)}>
      <span class="icon color-{config.color}" class:spinning={isActive(branch.phase)}>
        {config.icon}
      </span>
      <span class="model">{branch.model}</span>
      <span class="text">{getStatusText(branch)}</span>
    </div>
  {/each}
</div>

<style>
  .branch-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
  }

  .color-muted { color: var(--color-muted); }
  .color-accent { color: var(--color-accent); }
  .color-warning { color: var(--color-warning); }
  .color-success { color: var(--color-success); }
  .color-error { color: var(--color-error); }

  .spinning {
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
```

---

## 10. ThreadViewTabs.svelte

**Responsibilities:**
- Render icon tabs for 4 views
- Highlight active view
- Emit view change events

**Size Estimate:** ~100 lines

---

## 11. Global Stores

**File:** `src/lib/stores/thread-view.store.ts`

```typescript
import { writable } from 'svelte/store';

export type ViewType = 'chat' | 'execution' | 'branching' | 'prompt';

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

## Summary of Changes (v1.3 → v1.4)

| Section | Change |
|---------|--------|
| **5.2** | Added `StreamPhase` (7 values) and `MessageStatus` types |
| **5.2** | Changed `thread` context to `currentThread` |
| **5.2** | Added `activeBranches: Map<string, BranchState>` for per-branch streaming |
| **5.2** | Updated `THREAD_SELECT` event to include `branchIds` |
| **5.2** | Added branch-level events: `STREAM_STATUS`, `STREAM_CANCEL`, `STREAM_CANCEL_ALL`, `MESSAGE_SEND_BRANCHED` |
| **5.3** | Machine uses `chatStreamService` instead of direct IPC calls |
| **5.3** | Thread loading follows Subscribe → Load → Listen sequence |
| **6** | NEW: Added `ChatStreamService` section |
| **9** | Updated `ThreadStatusIndicator` to support all 7 StreamPhases |
| **9** | Added pass-through status message display (e.g., "List folders") |
| **12** | Updated `ThreadStatusService` for multi-branch status |
| **4.2** | Updated `ThreadViewContext` for branch-level state and actions |
| **4.3** | Updated subscriptions for branch-aware callbacks |

---

**End of Document**

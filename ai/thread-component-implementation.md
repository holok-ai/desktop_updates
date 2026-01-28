# Thread Component Implementation Design

**Version:** 1.0
**Date:** 2026-01-25
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Requirements](#2-requirements)
3. [Current ChatPane Analysis](#3-current-chatpane-analysis)
4. [Thread Component Architecture](#4-thread-component-architecture)
5. [Component Breakdown](#5-component-breakdown)
6. [State Management Strategy](#6-state-management-strategy)
7. [View Implementation Details](#7-view-implementation-details)
8. [Service Layer Design](#8-service-layer-design)
9. [Integration & Toggle Mechanism](#9-integration--toggle-mechanism)
10. [Migration Strategy](#10-migration-strategy)
11. [Testing Strategy](#11-testing-strategy)
12. [Performance Considerations](#12-performance-considerations)
13. [Implementation Phases](#13-implementation-phases)
14. [Risk Assessment & Open Questions](#14-risk-assessment--open-questions)

---

## 1. Executive Summary

This document provides a comprehensive design for implementing the new Thread Component architecture to replace the existing monolithic ChatPane.svelte component. The Thread Component will introduce a modular, view-based architecture supporting multiple interaction modes while maintaining backward compatibility during development.

**Key Goals:**
- Replace 3,437-line ChatPane.svelte with modular architecture (~80% code reduction in main orchestrator)
- Support 4 distinct thread views: Chat, Execution, Branching, Prompt
- Implement thread status indicator with connection/model feedback
- Enable keyboard toggle between old and new implementations (Cmd/Ctrl-Shift-T)
- Maintain full feature parity with existing ChatPane functionality
- Support project breadcrumb navigation

**Design Principles:**
1. **Separation of Concerns** - Each view, component, and service has single responsibility
2. **Composition over Inheritance** - Views compose shared components rather than extending
3. **Testability** - All business logic extracted to services with pure functions where possible
4. **Progressive Enhancement** - New component runs alongside old during development
5. **Type Safety** - Full TypeScript types throughout architecture

**Related Documentation:**
- **Branch ID System:** See `system-branching-id.md` for complete specification of hierarchical message identification
- **Thread Repository Design:** See `thread-repository-design.md` for backend persistence architecture
- **Requirements:** See `chat-component-redesign-notes.md` for original requirements

---

## 2. Requirements

**Complete requirements, use cases, Q&A, and risk assessment have been extracted to:**
- **`thread-component-requirements.md`** - Comprehensive requirements document

**Summary of Key Requirements:**
- Replace 3,437-line ChatPane with modular architecture (~800 line orchestrator)
- Support 4 distinct views: Chat, Execution, Branching, Prompt
- Implement thread status indicator with 3-circle feedback
- Enable keyboard toggle (Cmd/Ctrl-Shift-T) between old/new components
- All branch IDs must use 4-digit format (see `system-branching-id.md`)
- Desktop-only, no tablet/mobile support
- WCAG 2.1 Level AA accessibility compliance
- 95% unit test coverage target

**Refer to `thread-component-requirements.md` for:**
- Complete functional requirements (FR-001 to FR-809)
- Non-functional requirements (NFR-001 to NFR-305)
- Detailed use cases and scenarios
- Questions & answers (resolved and open)
- Risk assessment (R-001 to R-108)
- Success criteria and go/no-go decision points

---

## 3. Current ChatPane Analysis

### 3.1 Architecture Overview

**File:** `src/lib/components/ChatPane.svelte`
**Size:** 3,437 lines
**Complexity:** Very High (God Component anti-pattern)

ChatPane.svelte is a monolithic component handling:
- Message display and timeline rendering
- Chat service orchestration and streaming
- Branch/variation management
- Thread state synchronization
- User input and message composition
- Message editing and regeneration
- UI interactions (title editing, comments, modals)

### 3.2 Key Problems

| Problem | Impact | Severity |
|---------|--------|----------|
| **God Component** | 35+ state variables in single scope | CRITICAL |
| **Tangled Concerns** | Streaming, branching, state sync, UI all intertwined | HIGH |
| **Complex Derived Logic** | Timeline generation 90+ lines, multiple nested loops | HIGH |
| **Tight Service Coupling** | 6 service imports with direct calls throughout | HIGH |
| **State Fragmentation** | Thread state, branch selection, streaming state scattered | HIGH |
| **Branching Complexity** | Multiple context assembly paths, fork point logic intricate | HIGH |
| **Poor Testability** | Business logic embedded in component, no isolation | MEDIUM |

### 3.3 State Variables (35+)

**Thread & Model State:** currentThread, modelName, modelUrl, modelProvider, currentProviderConfig, threadLoadedIds, isHandlingVariation

**Chat Service State:** chatServiceCreated, responseText, isStreaming, showStreamingIndicator, error, isOnline

**Branching State:** activeBranchIndex, hiddenForkPoints, showBranchControls, streamingBranchIndex, selectedBranchContextMessageId, streamingTextByBranch, sendingBranchIndex, sendingBranchContextMessageId, _branchSelectionTime

**Variation/Mutation State:** showVariationModalFor, variationError, isCreatingVariation, hasCreatedVariations, allowAutoSelection

**UI State:** toast, showMoveModal, showVersionsFor, showComments, isEditingTitle, editedTitle, titleError, isSavingTitle

**Streaming/Timeout State:** streamingNoResponseTimeout, streamingIdleTimeout, streamingLastTokenAt

### 3.4 Components Used

- MessageBubble - Individual message rendering
- BranchLane - Branch/variation container
- BranchIndicator - Current branch ID display
- BranchSwitcher - Branch dropdown
- VariationModal - Variation creation dialog
- MessageVersionHistory - Edit history modal
- MoveThreadModal - Thread move dialog
- MarkdownRenderer - Markdown content rendering
- Composer (snippet) - Message input

### 3.5 Services Used

- MessageTransmitter - Response processing, message creation, retries
- networkService - Network status monitoring
- threadService - Backend thread operations
- outboxService - Message persistence/retry queue
- storageService - Local storage access
- FileWriteEventService - File write notifications

### 3.6 Reusable Elements

**Components to Reuse:**
- MessageBubble (with minor modifications for view contexts)
- BranchLane (core component for branch display)
- MarkdownRenderer (no changes needed)
- VariationModal (minor updates for new context)

**Services to Reuse:**
- MessageTransmitter (no changes)
- networkService (no changes)
- threadService (no changes)
- outboxService (no changes)
- storageService (no changes)

**Utility Functions to Extract:**
- branch-utils.ts functions (already external, minor updates needed)
- Timeline generation logic (extract to service)
- Branch box calculation (extract to service)

### 3.7 Thread Storage and Persistence

**Architecture:** Thread Repository Service (existing, located in `src-electron/repository/thread-repository.ts`)

**Key Capabilities:**

1. **Thread Loading:**
   - Threads loaded paged at **50 threads per page**
   - All threads cached in thread repository
   - Messages loaded and cached per thread
   - Repository loads all messages for a thread if not already loaded

2. **Message Caching:**
   - UI sends prompts (identified by thread_id and branch_id) to thread-repository for caching
   - UI sends responses (identified by thread_id and branch_id) to thread-repository for caching
   - Messages flagged with `isLocal` to distinguish from synced messages

3. **Synchronization:**
   - Thread repository checks for updated threads periodically
   - Updates cache with new, updated, or removed threads
   - Synchronizes thread messages with Moku API
   - When message received from Moku API with same thread_id and branch_id:
     - If local message has `isLocal` flag, replace with remote version
     - Remote message is authoritative source

4. **Storage Backend:**
   - Primary storage: Moku API (PostgreSQL with ltree for branch IDs - see `system-branching-id.md`)
   - Local cache: Thread repository in-memory cache
   - Thread execution data: `desktop_thread` table with `thread_parent_id` for execution tracking

**Integration with New Thread Component:**
- ThreadComponent subscribes to thread repository for thread/message updates
- All message sends go through repository for caching before API call
- Repository handles local-to-remote message reconciliation
- Uses 4-digit branch IDs for hierarchical message ordering (see `system-branching-id.md`)

---

## 4. Thread Component Architecture

### 4.1 High-Level Component Tree

```
ThreadComponent.svelte (orchestrator, ~800 lines)
├─ ThreadHeader.svelte
│  ├─ ThreadBreadcrumb.svelte (already exists, reuse)
│  ├─ ThreadTitle.svelte
│  ├─ ThreadStatusIndicator.svelte (NEW)
│  └─ ThreadActions.svelte
│
├─ ThreadViewTabs.svelte (NEW)
│  └─ TabButton.svelte
│
├─ ThreadChatView.svelte
│  ├─ MessageTimeline.svelte
│  │  ├─ MessageItem.svelte
│  │  │  └─ MessageBubble.svelte (reuse)
│  │  └─ BranchBoxItem.svelte
│  │     └─ BranchLane.svelte (reuse)
│  └─ ComposerArea.svelte
│     └─ Composer (snippet, passed as prop)
│
├─ ThreadExecutionView.svelte (NEW)
│  ├─ InstructionFileEditor.svelte
│  ├─ ExecutionControls.svelte
│  ├─ ExecutionHistory.svelte
│  └─ ExecutionFrequencyChart.svelte
│
├─ ThreadBranchingView.svelte (NEW)
│  ├─ BranchingGraphCanvas.svelte (SVG-based)
│  └─ BranchingGraphNode.svelte
│
├─ ThreadPromptView.svelte (NEW)
│  ├─ PromptList.svelte
│  └─ PromptItem.svelte
│
└─ Modals (shared)
   ├─ VariationModal.svelte (reuse)
   ├─ MessageVersionHistory.svelte (reuse)
   └─ MoveThreadModal.svelte (reuse)
```

### 4.2 Service Layer

```typescript
// New services to create
services/
├─ thread-view-state.service.ts      // View switching, state persistence
├─ streaming.service.ts              // Token handling, accumulation, timeouts
├─ branch-context.service.ts         // Branch selection, context building
├─ timeline-builder.service.ts       // Timeline generation, branch box calculation
├─ thread-status.service.ts          // Status indicator state machine
└─ execution-runner.service.ts       // Thread execution (Execution View)

// Existing services (reuse)
services/
├─ message-transmitter.service.ts    // Already exists
├─ thread.service.ts                 // Already exists
├─ outbox.service.ts                 // Already exists
├─ network.service.ts                // Already exists
└─ storage.service.ts                // Already exists
```

### 4.3 Data Flow

```
User Interaction (e.g., Send Message)
  ↓
ThreadComponent (orchestrator)
  ↓
ThreadChatView (view-specific logic)
  ↓
ComposerArea (emits sendMessage event)
  ↓
StreamingService.initiateStream()
  ↓
window.electronAPI.chat.chat()
  ↓
Token events → StreamingService.handleToken()
  ↓
ThreadStatusIndicator (visual feedback)
  ↓
MessageTimeline (update display)
```

### 4.4 State Management Strategy

**Approach:** Hybrid - Svelte stores for global state, local `$state` for component-specific state

**Global Stores (Svelte stores):**
- `threadViewState` - Current active view, view-specific settings
- `threadStreamingState` - Streaming status, response text, branch-specific streaming
- `threadStatusState` - Status indicator state (idle/connecting/sending/receiving/error)
- `branchSelectionState` - Active branch, selected branches, hidden fork points

**Component-Level State:**
- UI state (modal visibility, editing flags)
- Derived values (timeline, branch boxes)
- Temporary input buffers

**Rationale:**
- Global stores enable view switching without losing state
- Component state keeps UI concerns isolated
- Services interact with stores, components subscribe
- Easier testing (mock stores, test services independently)

---

## 5. Component Breakdown

### 5.1 ThreadComponent.svelte (Main Orchestrator)

**Responsibilities:**
- Manage active view (Chat/Execution/Branching/Prompt)
- Coordinate services initialization/cleanup
- Handle keyboard shortcuts
- Render header, tabs, active view
- Show global modals

**Props:**
```typescript
interface ThreadComponentProps {
  thread?: Thread | null;
  messages?: Message[];
  composer?: Snippet<[ComposerContext]>;
}
```

**State:**
```typescript
let activeView = $state<'chat' | 'execution' | 'branching' | 'prompt'>('chat');
let showMoveModal = $state(false);
let showVariationModal = $state<Message | null>(null);
let showVersionHistory = $state<{ messageId: string; content: string } | undefined>(undefined);
```

**Key Methods:**
```typescript
function switchView(view: ViewType): void
function handleKeyboardShortcut(event: KeyboardEvent): void
function initializeServices(): void
function cleanupServices(): void
```

**Size Estimate:** ~800 lines (down from 3,437)

---

### 5.2 ThreadHeader.svelte

**Responsibilities:**
- Display breadcrumb (if project thread)
- Show thread title (with edit capability)
- Render ThreadStatusIndicator
- Show ThreadActions (comments, move thread)

**Props:**
```typescript
interface ThreadHeaderProps {
  thread: Thread;
  messages: Message[];
  isEditMode?: boolean;
  onTitleChange?: (newTitle: string) => void;
  onToggleComments?: () => void;
  onMoveThread?: () => void;
}
```

**Composition:**
```svelte
<header class="thread-header">
  <ThreadBreadcrumb {thread} {messages} />
  <ThreadTitle bind:title={thread.title} {isEditMode} {onTitleChange} />
  <ThreadStatusIndicator />
  <ThreadActions {onToggleComments} {onMoveThread} />
</header>
```

**Size Estimate:** ~150 lines

---

### 5.3 ThreadStatusIndicator.svelte (NEW)

**Responsibilities:**
- Display 3-circle status indicator
- Show connection/model interaction feedback
- Animate state transitions
- Provide tooltips for each state

**Props:**
```typescript
interface ThreadStatusIndicatorProps {
  // No props - subscribes to threadStatusState store
}
```

**State Machine:**
```typescript
type StatusState =
  | 'idle'           // All circles background color
  | 'connecting'     // Circle 1 pulsing
  | 'sending'        // Circle 1 green
  | 'receiving'      // Circle 1 clear, Circle 2 blue
  | 'tool-executing' // Circle 2 yellow
  | 'error'          // Circle 3 red
```

**State Transitions:**
```
idle → connecting (on chat service init)
connecting → sending (on message send)
sending → receiving (on first token)
receiving → tool-executing (on tool call detected)
tool-executing → receiving (on tool result)
receiving → idle (on STOP token)
* → error (on error, persists until next prompt)
```

**Parallel Streaming Behavior:**
- When streaming 3 variations in parallel:
  - **Any prompt being sent** → Circle 1 green (sending)
  - **Any response being received** → Circle 2 blue (receiving)
- Status shows **thread-level** state (not per-message)

**Visual Design:**
```
┌─────────────────────────────────┐
│  ○ ○ ○                          │
│  └─┬─┘                          │
│    └─ Status text (optional)    │
└─────────────────────────────────┘

States:
○ ● ○  = Circle 1 green (sending)
○ ○ ●  = Circle 2 blue (receiving)
○ ○ 🔴 = Circle 3 red (error - persists until next prompt)
```

**Size Estimate:** ~200 lines

---

### 5.4 ThreadViewTabs.svelte (NEW)

**Responsibilities:**
- Render icon tabs for 4 views
- Highlight active view
- Emit view change events
- Show tooltips

**Props:**
```typescript
interface ThreadViewTabsProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  availableViews?: ViewType[]; // Allow hiding views conditionally
}
```

**Icons:**
- Chat View: font or letter icon 
- Execution View: gear icon
- Timeline View: clock / stopwatch icon
- Prompt View:  document icon

**Layout:**
```svelte
<nav class="thread-view-tabs" role="tablist">
  {#each views as view}
    <button
      role="tab"
      aria-selected={activeView === view}
      aria-label={view.label}
      title={view.tooltip}
      onclick={() => onViewChange(view)}
    >
      <Icon name={view.icon} />
    </button>
  {/each}
</nav>
```

**Size Estimate:** ~100 lines

---

### 5.5 ThreadChatView.svelte

**Responsibilities:**
- Render MessageTimeline
- Handle message sending (main input)
- Manage branch visibility toggling
- Handle variation creation
- Manage streaming state within chat context

**Props:**
```typescript
interface ThreadChatViewProps {
  thread: Thread;
  messages: Message[];
  composer: Snippet<[ComposerContext]>;
  onCreateVariation: (message: Message) => void;
  onSendMessage: (content: string, context: MessageContext) => Promise<void>;
}
```

**State:**
```typescript
let activeBranchIndex = $state<number | null>(null);
let hiddenForkPoints = $state(new Set<string>());
let isStreaming = $state(false);
```

**Composition:**
```svelte
<div class="thread-chat-view">
  <MessageTimeline
    {messages}
    {activeBranchIndex}
    {hiddenForkPoints}
    {isStreaming}
    onToggleBranches={handleToggleBranches}
    onSelectBranch={handleSelectBranch}
    onCreateVariation={handleCreateVariation}
  />

  <ComposerArea
    {composer}
    disabled={isMainInputDisabled}
    onSendMessage={handleSendMessage}
  />
</div>
```

**Size Estimate:** ~400 lines

---

### 5.6 MessageTimeline.svelte

**Responsibilities:**
- Render interleaved messages and branch boxes
- Handle scroll management
- Apply message exclusion rules
- Render streaming indicator

**Props:**
```typescript
interface MessageTimelineProps {
  messages: Message[];
  activeBranchIndex: number | null;
  hiddenForkPoints: Set<string>;
  isStreaming: boolean;
  streamingText?: string;
  onToggleBranches: (forkPointId: string) => void;
  onSelectBranch: (branchIndex: number, messageId: string) => void;
  onCreateVariation: (message: Message) => void;
}
```

**Timeline Generation:**
- Uses `TimelineBuilderService.buildTimeline(messages, options)`
- Service returns array of `TimelineItem` (message or branch box)
- Component just renders items in order

**Size Estimate:** ~250 lines

---

### 5.7 ThreadExecutionView.svelte (NEW)

**Responsibilities:**
- Display/edit instruction file
- Show execution controls (Run, Stop)
- Display execution history
- Show frequency chart

**Props:**
```typescript
interface ThreadExecutionViewProps {
  thread: Thread;
  onRunExecution: () => Promise<void>;
  onStopExecution: () => void;
}
```

**State:**
```typescript
let instructionFileContent = $state('');
let executionHistory = $state<ExecutionRecord[]>([]);
let isRunning = $state(false);
```

**Composition:**
```svelte
<div class="thread-execution-view">
  <InstructionFileEditor
    bind:content={instructionFileContent}
    onSave={handleSaveInstructions}
  />

  <ExecutionControls
    {isRunning}
    onRun={handleRun}
    onStop={handleStop}
  />

  <ExecutionHistory
    records={executionHistory}
    onSelectRecord={handleSelectRecord}
  />

  <ExecutionFrequencyChart
    records={executionHistory}
  />
</div>
```

**Data Model:**
```typescript
interface ExecutionRecord {
  id: string;
  threadId: string;
  executedAt: number; // timestamp
  executedBy: string; // user ID or name
  status: 'success' | 'error' | 'stopped';
  duration: number; // milliseconds
  resultSummary?: string;
}
```

**Size Estimate:** ~350 lines

---

### 5.8 ThreadBranchingView.svelte (NEW)

**Responsibilities:**
- Render SVG-based branch visualization
- Handle node clicks (navigate to message in Chat View)
- Show branch metadata (model, tokens, timing)
- Handle zoom/pan controls

**Props:**
```typescript
interface ThreadBranchingViewProps {
  thread: Thread;
  messages: Message[];
  onNodeClick: (messageId: string) => void;
}
```

**State:**
```typescript
let graphData = $state<BranchGraphData | null>(null);
let zoomLevel = $state(1.0);
let panOffset = $state({ x: 0, y: 0 });
```

**Graph Data Structure:**
```typescript
interface BranchGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphNode {
  id: string;           // message ID
  branchId: string;     // 4-digit format (see system-branching-id.md)
  position: { x: number; y: number };
  type: 'user' | 'assistant' | 'branch-point';
  metadata: {
    modelName?: string;
    tokens?: number;
    duration?: number;
    timestamp: number;
  };
}

interface GraphEdge {
  from: string;        // node ID
  to: string;          // node ID
  type: 'main' | 'branch' | 'selected';
}
```

**Layout Algorithm:**
- Use tree layout (left-to-right or top-to-bottom)
- Branch lanes stacked vertically
- Tool iterations shown as micro-nodes
- Selected branches highlighted with thicker edges

**Size Estimate:** ~500 lines

---

### 5.9 ThreadPromptView.svelte (NEW)

**Responsibilities:**
- Render compact list of prompts
- Show expand/collapse controls
- Display responses on expansion
- Handle "Collapse All" / "Expand All"

**Props:**
```typescript
interface ThreadPromptViewProps {
  thread: Thread;
  messages: Message[];
}
```

**State:**
```typescript
let expandedPrompts = $state(new Set<string>()); // message IDs
let showAllResponses = $state(false);
```

**Composition:**
```svelte
<div class="thread-prompt-view">
  <div class="prompt-view-controls">
    <button onclick={handleExpandAll}>Expand All</button>
    <button onclick={handleCollapseAll}>Collapse All</button>
  </div>

  <PromptList>
    {#each userMessages as message}
      <PromptItem
        {message}
        expanded={expandedPrompts.has(message.id)}
        responses={getResponsesForPrompt(message.id)}
        onToggle={() => handleTogglePrompt(message.id)}
      />
    {/each}
  </PromptList>
</div>
```

**Size Estimate:** ~200 lines

---

## 6. State Management Strategy

### 6.1 Global Stores

**File:** `src/lib/stores/thread-view.store.ts`

```typescript
import { writable, derived } from 'svelte/store';

// View state
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

// Streaming state
interface StreamingState {
  isStreaming: boolean;
  responseText: string;
  streamingBranchId: string | null;
  streamingTextByBranch: Map<string, string>;
  error: string | null;
}

export const streamingState = writable<StreamingState>({
  isStreaming: false,
  responseText: '',
  streamingBranchId: null,
  streamingTextByBranch: new Map(),
  error: null,
});

// Status indicator state
export type StatusIndicatorState =
  | 'idle'
  | 'connecting'
  | 'sending'
  | 'receiving'
  | 'tool-executing'
  | 'error'
  | 'rate-limited'
  | 'disconnected';

interface StatusState {
  state: StatusIndicatorState;
  message: string | null;
  timestamp: number;
}

export const threadStatusState = writable<StatusState>({
  state: 'idle',
  message: null,
  timestamp: Date.now(),
});

// Branch selection state
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

// Derived store: is main input disabled?
export const isMainInputDisabled = derived(
  branchSelectionState,
  ($branchSelection) => {
    // Logic extracted from ChatPane
    // Returns true if branches exist but not all fork points have selection
    return false; // Placeholder
  }
);
```

### 6.2 Service Singletons

Services are instantiated as singletons and interact with stores:

```typescript
// services/streaming.service.ts
class StreamingService {
  private tokenListener: ((token: string) => void) | null = null;

  initializeStream(params: StreamParams): void {
    streamingState.update(s => ({ ...s, isStreaming: true, responseText: '' }));
    this.setupTokenListener(params);
  }

  handleToken(token: string): void {
    streamingState.update(s => ({
      ...s,
      responseText: s.responseText + token
    }));
  }

  completeStream(): void {
    streamingState.update(s => ({ ...s, isStreaming: false }));
    this.cleanupTokenListener();
  }
}

export const streamingService = new StreamingService();
```

### 6.3 Component State vs Store State

**Use Component State (`$state`) for:**
- UI-specific state (modal visibility, input focus)
- Temporary buffers (draft text, form inputs)
- Derived values specific to component (filtered lists)
- Animation state

**Use Store State for:**
- State that persists across view switches
- State shared between multiple components
- State that services need to read/write
- State that should be testable independently

---

## 7. View Implementation Details

### 7.1 Thread Chat View

**Current:** Implemented in ChatPane.svelte (majority of 3,437 lines)
**New:** ThreadChatView.svelte (~400 lines)

**Key Changes:**
- Extract timeline generation to `TimelineBuilderService`
- Extract branch context assembly to `BranchContextService`
- Extract streaming logic to `StreamingService`
- Use stores for state that needs to persist across view switches

#### 7.1.1 Branching UI Workflow

**Detailed Branching Behavior** (from redesign notes):

1. **Branch Creation:**
   - After prompt + model response streaming completes, UI enables "branch" icon under prompt
   - Clicking branch icon displays modal dialog with two options:
     - **Prompt Branch:** Modify current prompt (creates 2 lanes max)
     - **Model Branch:** Select up to 9 other models with same prompt

2. **Prompt Branch:**
   - User shown current prompt in modal
   - Can modify prompt text
   - Press "Create Branch" → creates lane with new prompt
   - **2 lanes max:** Original prompt (lane 0) + modified prompt (lane 1)

3. **Model Branch:**
   - User selects up to 9 different models from list
   - Each model gets its own lane (up to 9 lanes)
   - User can edit prompt before pressing "Send" in each lane
   - **Lane header shows model name** for identification
   - All lanes process in parallel

4. **Branch Header:**
   - Shows branch status: "Open" or "Closed"
   - Shows branch type: "Model Branch" or "Prompt Branch"

5. **Lane Structure:**
   - Each lane contains:
     - Model name (in header for model branches)
     - Zero or more ChatMessages (prompt + response pairs)
     - "Continue With This Branch" button (at bottom)
   - User can enter prompts into any lane until satisfied

6. **Branch Decision:**
   - User clicks "Continue With This Branch" button in selected lane
   - Branch closes (status → "Closed")
   - Thread continues using context of selected lane
   - If model branch: thread adopts selected lane's model going forward

7. **Branch Visibility:**
   - After branch closed: Shows only selected lane
   - "Show Branch" button reveals all lanes (read-only)
   - User cannot edit or enter prompts in closed branch
   - Can view all prompts/responses from other lanes

**Timeline Rendering:**
```typescript
// TimelineBuilderService.buildTimeline()
export interface TimelineItem {
  type: 'message' | 'branch-box';
  key: string;
  data: Message | BranchBox;
  position: number; // for sorting
}

buildTimeline(
  messages: Message[],
  options: {
    activeBranchIndex: number | null;
    hiddenForkPoints: Set<string>;
    excludedMessageIds: Set<string>;
  }
): TimelineItem[] {
  // 1. Calculate branch boxes
  const branchBoxes = this.calculateBranchBoxes(messages);

  // 2. Determine excluded messages
  const excluded = this.calculateExcludedMessages(messages, branchBoxes);

  // 3. Interleave messages and branch boxes
  const timeline = this.interleaveItems(messages, branchBoxes, excluded);

  // 4. Apply fork point hiding
  const filtered = this.applyForkPointHiding(timeline, options.hiddenForkPoints);

  return filtered;
}
```

**Branch Context Assembly:**
```typescript
// BranchContextService.buildContext()
buildContext(
  messages: Message[],
  options: {
    branchId?: string;
    selectedBranchIds: string[];
    includeLocalOnly: boolean;
  }
): Message[] {
  if (options.selectedBranchIds.length > 0) {
    return buildContextFromSelectedBranches(
      messages,
      options.selectedBranchIds,
      options.includeLocalOnly
    );
  } else {
    return assembleContext(messages, options.branchId);
  }
}
```

---

### 7.2 Thread Execution View

**Current:** Does not exist
**New:** ThreadExecutionView.svelte (~350 lines)

**Availability:** Only available for **project threads** (not available for general threads)

**Purpose:** Allows users to execute a thread by running all prompts sequentially with an instruction file prepended to system prompt. Useful for automated workflows (e.g., "download PR, build code, run lint, analyze").

**Components:**

#### 7.2.1 InstructionFileEditor.svelte

```typescript
interface InstructionFileEditorProps {
  content: string;
  onSave: (content: string) => Promise<void>;
}
```

**Instruction File Format:**
- **File Type:** Markdown (.md)
- **Generation:** Initially generated by LLM from examining user prompts/responses
- **Storage:** Stored in project file list (shared with all project members)
- **Required:** No - instruction file can be empty

**File Structure:**
```markdown
# Title
[Up to 100 character name or title]

## Description
[Any length description of the purpose of the prompts]

## Prompt Variables
[Data elements in the prompts that should change when run again]
- variable_name: description
- another_variable: description

## Input Files
[Blank templates (e.g., issue template) or instructions (e.g., security-scanning-rules.md)]
- template.md
- security-rules.md

## Outputs
[One or more outputs to be produced]
- Output 1: PDF report with analysis results
- Output 2: GitHub issue with findings

## Tools Used
[List of Desktop tool functions that were run - informational]
- Read file
- Execute command
- Create issue
```

**Features:**
- Markdown syntax highlighting
- Auto-save (debounced)
- Validation (title max 100 chars)
- Preview mode toggle
- Can be empty (not required)

**Implementation:**
- Use CodeMirror or Monaco editor for rich editing
- Store instruction file in project file list (Moku API)
- Thread metadata references instruction file by path

#### 7.2.2 ExecutionControls.svelte

```typescript
interface ExecutionControlsProps {
  isRunning: boolean;
  onRun: () => Promise<void>;
  onStop: () => void;
}
```

**Features:**
- "Run" button (disabled when running)
- "Stop" button (visible only when running)
- Status indicator (running/stopped)

#### 7.2.3 ExecutionHistory.svelte

```typescript
interface ExecutionHistoryProps {
  records: ExecutionRecord[];  // Limited to past 15 executions
  onSelectRecord: (recordId: string) => void;
}
```

**Features:**
- Table or list showing **past 15 executions**
- Columns: Timestamp, User (email), Duration, Status
- Click to view execution details
- Sort by timestamp (most recent first)

**Data Source:**
- Fetch from backend API: `GET /api/threads/{threadId}/executions?limit=15`
- Backend stores in Moku API `desktop_thread` table
- Execution threads use `thread_parent_id` to reference original thread

**Data Model:**
```typescript
interface ExecutionRecord {
  id: string;              // Execution thread ID
  threadId: string;        // Parent thread ID
  thread_parent_id: string; // Reference to original thread
  executedAt: number;      // Timestamp
  executedBy: string;      // User email
  status: 'success' | 'error' | 'stopped';
  duration: number;        // Milliseconds
  resultSummary?: string;
}
```

#### 7.2.4 ExecutionFrequencyChart.svelte

```typescript
interface ExecutionFrequencyChartProps {
  records: ExecutionRecord[];
}
```

**Features:**
- Small line or bar chart showing execution frequency over time
- **Variable scale based on date range:**
  - **14 days or less:** Daily scale (each bar = 1 day)
  - **15-70 days:** Weekly scale (each bar = 1 week)
  - **71-356 days:** Monthly scale (each bar = 1 month)
- Shows up to **past year** of execution data
- Tooltip on hover showing count and date range
- Auto-adjusts scale based on available data

**Implementation:**
- Use Chart.js or Recharts
- Aggregate records by appropriate time bucket:
  ```typescript
  function getTimeBucket(records: ExecutionRecord[]): 'day' | 'week' | 'month' {
    const oldest = Math.min(...records.map(r => r.executedAt));
    const daysSinceOldest = (Date.now() - oldest) / (1000 * 60 * 60 * 24);

    if (daysSinceOldest <= 14) return 'day';
    if (daysSinceOldest <= 70) return 'week';
    return 'month';
  }
  ```

---

### 7.3 Thread Branching View

**Current:** Does not exist
**New:** ThreadBranchingView.svelte (~500 lines)

**Layout Algorithm:**

```typescript
// services/branch-graph-layout.service.ts

export class BranchGraphLayoutService {
  generateLayout(messages: Message[]): BranchGraphData {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // 1. Parse branch IDs and build tree structure
    const tree = this.buildBranchTree(messages);

    // 2. Assign positions using tree layout algorithm
    //    (row = depth, lane = sibling index)
    const positions = this.calculatePositions(tree);

    // 3. Create nodes
    for (const message of messages) {
      nodes.push({
        id: message.id,
        branchId: message.branchId,
        position: positions.get(message.id)!,
        type: message.role === 'user' ? 'user' : 'assistant',
        metadata: {
          modelName: message.modelId,
          tokens: message.metadata?.tokens as number,
          duration: message.metadata?.duration as number,
          timestamp: message.createdAt,
        },
      });
    }

    // 4. Create edges (parent -> child relationships)
    for (const message of messages) {
      const parent = this.findParentMessage(message, messages);
      if (parent) {
        edges.push({
          from: parent.id,
          to: message.id,
          type: this.getEdgeType(message, parent),
        });
      }
    }

    return { nodes, edges };
  }

  private getEdgeType(child: Message, parent: Message): 'main' | 'branch' | 'selected' {
    // Determine edge type based on branch IDs
    // See system-branching-id.md for branch ID format details
    // Main branch: lane 0, Branch: lane 1+, Selected: in selectedBranchIds
  }
}
```

**Rendering:**
```svelte
<svg class="branching-graph" viewBox="0 0 {width} {height}">
  <!-- Edges (lines connecting nodes) -->
  {#each graphData.edges as edge}
    <line
      x1={nodes.find(n => n.id === edge.from).position.x}
      y1={nodes.find(n => n.id === edge.from).position.y}
      x2={nodes.find(n => n.id === edge.to).position.x}
      y2={nodes.find(n => n.id === edge.to).position.y}
      class="edge edge-{edge.type}"
      stroke={getEdgeColor(edge.type)}
      stroke-width={edge.type === 'selected' ? 3 : 1}
    />
  {/each}

  <!-- Nodes (circles/rects for messages) -->
  {#each graphData.nodes as node}
    <BranchingGraphNode
      {node}
      onclick={() => handleNodeClick(node.id)}
    />
  {/each}
</svg>
```

**Interaction:**
- Click node → switch to Chat View and scroll to message
- Hover node → show tooltip with metadata
- Zoom/pan controls (mouse wheel, drag)

---

### 7.4 Thread Prompt View

**Current:** Does not exist
**New:** ThreadPromptView.svelte (~200 lines)

**Purpose:** Compact view showing only user prompts in bullet form, allowing quick overview of thread inputs

**Navigation Behavior:**
- Clicking on a **branch, lane, or closure** → Navigates to Thread Chat View and scrolls to start of branch point
- Clicking **prompt** → Expands to show responses inline

**Rendering:**
```svelte
<div class="thread-prompt-view">
  <div class="prompt-view-controls">
    <button onclick={handleExpandAll}>Expand All</button>
    <button onclick={handleCollapseAll}>Collapse All</button>
    <label>
      <input type="checkbox" bind:checked={showAllResponses} />
      Show all variations
    </label>
  </div>

  <ul class="prompt-list">
    {#each userMessages as message, index}
      <PromptItem
        prompt={message}
        responses={getResponsesForPrompt(message.id)}
        expanded={expandedPrompts.has(message.id)}
        {showAllResponses}
        onToggle={() => handleTogglePrompt(message.id)}
      />
    {/each}
  </ul>
</div>
```

**PromptItem.svelte:**
```svelte
<li class="prompt-item">
  <button class="prompt-header" onclick={onToggle}>
    <span class="expand-icon">{expanded ? '▼' : '▶'}</span>
    <span class="prompt-number">{index + 1}</span>
    <span class="prompt-preview">{truncate(prompt.content, 100)}</span>
    <span class="response-count">({responses.length} response{responses.length !== 1 ? 's' : ''})</span>
  </button>

  {#if expanded}
    <ul class="response-list">
      {#each responses as response}
        <li class="response-item">
          <div class="response-metadata">
            <span class="model-name">{response.modelId}</span>
            <span class="timestamp">{formatTimestamp(response.createdAt)}</span>
          </div>
          <MarkdownRenderer content={response.content} />
        </li>
      {/each}
    </ul>
  {/if}
</li>
```

**getResponsesForPrompt() Logic:**
```typescript
function getResponsesForPrompt(promptMessageId: string): Message[] {
  const promptMessage = messages.find(m => m.id === promptMessageId);
  if (!promptMessage) return [];

  // Parse branch ID (format: row.lane.message.tool_sequence)
  // See system-branching-id.md for details
  const [row, lane, msg] = promptMessage.branchId.split('.').map(Number);

  // Find assistant messages in same branch
  const responses = messages.filter(m => {
    if (m.role !== 'assistant') return false;
    const [mRow, mLane, mMsg] = m.branchId.split('.').map(Number);
    return mRow === row && mLane === lane && mMsg === msg + 1;
  });

  // If showAllResponses, also find variations (different lanes)
  if (showAllResponses) {
    const variations = messages.filter(m => {
      if (m.role !== 'assistant') return false;
      const [mRow, mLane, mMsg] = m.branchId.split('.').map(Number);
      return mRow === row && mLane !== lane && mMsg === msg + 1;
    });
    responses.push(...variations);
  }

  return responses;
}
```

---

## 8. Service Layer Design

### 8.1 StreamingService

**File:** `src/lib/services/streaming.service.ts`

```typescript
import { streamingState, threadStatusState } from '$lib/stores/thread-view.store';
import type { DesktopChatRequest } from '../../../src-electron/preload';

export interface StreamParams {
  request: DesktopChatRequest;
  branchId?: string;
}

class StreamingService {
  private tokenListener: ((token: string) => void) | null = null;
  private idleTimeout: ReturnType<typeof setTimeout> | null = null;
  private noResponseTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastTokenAt = 0;

  private readonly IDLE_TIMEOUT_MS = 60000;
  private readonly NO_RESPONSE_TIMEOUT_MS = 60000;

  /**
   * Initialize streaming for a chat request
   */
  async initiateStream(params: StreamParams): Promise<void> {
    // Clear previous state
    this.cleanup();

    // Update status
    threadStatusState.set({ state: 'sending', message: null, timestamp: Date.now() });

    // Set up token listener
    this.setupTokenListener(params.branchId);

    // Start no-response timeout
    this.noResponseTimeout = setTimeout(() => {
      this.handleTimeout('No response received from model');
    }, this.NO_RESPONSE_TIMEOUT_MS);

    // Update streaming state
    streamingState.update(s => ({
      ...s,
      isStreaming: true,
      responseText: '',
      streamingBranchId: params.branchId ?? null,
      error: null,
    }));

    // Make API call (handled by caller, this just sets up state)
    console.log('[StreamingService] Stream initialized');
  }

  /**
   * Set up token listener
   */
  private setupTokenListener(branchId?: string): void {
    this.tokenListener = (token: string) => {
      this.handleToken(token, branchId);
    };

    window.electronAPI.chat.onToken(this.tokenListener);
  }

  /**
   * Handle incoming token
   */
  private handleToken(token: string, branchId?: string): void {
    this.lastTokenAt = Date.now();

    // Clear no-response timeout (first token received)
    if (this.noResponseTimeout) {
      clearTimeout(this.noResponseTimeout);
      this.noResponseTimeout = null;
    }

    // Update status to receiving (if not already)
    threadStatusState.update(s =>
      s.state === 'sending' ? { state: 'receiving', message: null, timestamp: Date.now() } : s
    );

    // Restart idle timeout
    this.restartIdleTimeout();

    // Update streaming state
    streamingState.update(s => {
      const newResponseText = s.responseText + token;

      // Update branch-specific text if in branch
      if (branchId) {
        const newStreamingTextByBranch = new Map(s.streamingTextByBranch);
        const currentBranchText = newStreamingTextByBranch.get(branchId) ?? '';
        newStreamingTextByBranch.set(branchId, currentBranchText + token);

        return {
          ...s,
          responseText: newResponseText,
          streamingTextByBranch: newStreamingTextByBranch,
        };
      }

      return { ...s, responseText: newResponseText };
    });
  }

  /**
   * Restart idle timeout
   */
  private restartIdleTimeout(): void {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
    }

    this.idleTimeout = setTimeout(() => {
      const elapsed = Date.now() - this.lastTokenAt;
      if (elapsed >= this.IDLE_TIMEOUT_MS) {
        this.handleTimeout('Stream idle timeout: no tokens received for 60 seconds');
      }
    }, this.IDLE_TIMEOUT_MS);
  }

  /**
   * Handle streaming timeout
   */
  private handleTimeout(message: string): void {
    console.error('[StreamingService] Timeout:', message);

    streamingState.update(s => ({
      ...s,
      isStreaming: false,
      error: message,
    }));

    threadStatusState.set({ state: 'error', message, timestamp: Date.now() });

    this.cleanup();
  }

  /**
   * Complete streaming successfully
   */
  completeStream(): void {
    console.log('[StreamingService] Stream completed');

    streamingState.update(s => ({
      ...s,
      isStreaming: false,
    }));

    threadStatusState.set({ state: 'idle', message: null, timestamp: Date.now() });

    this.cleanup();
  }

  /**
   * Handle streaming error
   */
  handleError(error: string): void {
    console.error('[StreamingService] Error:', error);

    streamingState.update(s => ({
      ...s,
      isStreaming: false,
      error,
    }));

    threadStatusState.set({ state: 'error', message: error, timestamp: Date.now() });

    this.cleanup();
  }

  /**
   * Clean up listeners and timeouts
   */
  private cleanup(): void {
    if (this.tokenListener) {
      window.electronAPI.chat.removeTokenListener(this.tokenListener);
      this.tokenListener = null;
    }

    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }

    if (this.noResponseTimeout) {
      clearTimeout(this.noResponseTimeout);
      this.noResponseTimeout = null;
    }
  }
}

export const streamingService = new StreamingService();
```

---

### 8.2 TimelineBuilderService

**File:** `src/lib/services/timeline-builder.service.ts`

```typescript
import type { Message } from '$lib/types/thread.type';
import { getBranchMessages, getVariationsForBranch } from '$lib/utils/branch-utils';

export interface TimelineItem {
  type: 'message' | 'branch-box';
  key: string;
  data: Message | BranchBox;
  position: number;
}

export interface BranchBox {
  branchIndex: number;
  userMessage: Message;
  assistantMessage: Message | null;
  allMessages: Message[];
}

export interface TimelineOptions {
  activeBranchIndex: number | null;
  hiddenForkPoints: Set<string>;
  selectedBranchIds: string[];
  branchSelectionTime: number | null;
}

class TimelineBuilderService {
  /**
   * Build timeline with interleaved messages and branch boxes
   */
  buildTimeline(messages: Message[], options: TimelineOptions): TimelineItem[] {
    const branchBoxes = this.calculateBranchBoxes(messages);
    const excludedMessageIds = this.calculateExcludedMessages(messages, branchBoxes, options);
    const timeline = this.interleaveItems(messages, branchBoxes, excludedMessageIds);

    return timeline;
  }

  /**
   * Calculate branch boxes (variations at fork points)
   */
  calculateBranchBoxes(messages: Message[]): BranchBox[] {
    const boxes: BranchBox[] = [];
    const variations = getVariationsForBranch(messages);

    let branchIndex = 0;
    for (const variation of variations) {
      const branchMessages = getBranchMessages(messages, variation.branchId);
      const userMessage = branchMessages.find(m => m.role === 'user') ?? variation;
      const assistantMessage = branchMessages.find(m => m.role === 'assistant') ?? null;

      boxes.push({
        branchIndex: branchIndex++,
        userMessage,
        assistantMessage,
        allMessages: branchMessages,
      });
    }

    return boxes;
  }

  /**
   * Calculate which messages should be excluded (shown in branch boxes instead)
   */
  private calculateExcludedMessages(
    messages: Message[],
    branchBoxes: BranchBox[],
    options: TimelineOptions
  ): Set<string> {
    const excluded = new Set<string>();

    // Exclude messages that are shown in branch boxes
    for (const box of branchBoxes) {
      for (const message of box.allMessages) {
        excluded.add(message.id);
      }
    }

    // Additional logic for hiding messages after fork point if branch selected
    // (complex logic from ChatPane lines 966-981)
    // TODO: Extract and refine

    return excluded;
  }

  /**
   * Interleave messages and branch boxes into single timeline
   */
  private interleaveItems(
    messages: Message[],
    branchBoxes: BranchBox[],
    excludedMessageIds: Set<string>
  ): TimelineItem[] {
    const items: TimelineItem[] = [];

    // Add messages
    for (const message of messages) {
      if (!excludedMessageIds.has(message.id)) {
        items.push({
          type: 'message',
          key: message.id,
          data: message,
          position: message.createdAt,
        });
      }
    }

    // Add branch boxes
    for (const box of branchBoxes) {
      items.push({
        type: 'branch-box',
        key: `branch-${box.branchIndex}`,
        data: box,
        position: box.userMessage.createdAt,
      });
    }

    // Sort by position (timestamp)
    items.sort((a, b) => a.position - b.position);

    return items;
  }
}

export const timelineBuilderService = new TimelineBuilderService();
```

---

### 8.3 BranchContextService

**File:** `src/lib/services/branch-context.service.ts`

```typescript
import type { Message } from '$lib/types/thread.type';
import { assembleContext, buildContextFromSelectedBranches } from '$lib/utils/branch-utils';

export interface ContextOptions {
  branchId?: string;
  selectedBranchIds: string[];
  includeLocalOnly: boolean;
}

class BranchContextService {
  /**
   * Build context for sending message
   */
  buildContext(messages: Message[], options: ContextOptions): Message[] {
    if (options.selectedBranchIds.length > 0) {
      return buildContextFromSelectedBranches(
        messages,
        options.selectedBranchIds,
        options.includeLocalOnly
      );
    } else if (options.branchId) {
      return assembleContext(messages, options.branchId);
    } else {
      // No branch context, return all main branch messages
      return messages.filter(m => m.branchId.endsWith('.0.0.0'));
    }
  }

  /**
   * Get next branch ID for new message in context
   * See system-branching-id.md for branch ID format
   */
  getNextBranchId(messages: Message[], currentBranchId?: string): string {
    // Use existing utility function (branch-utils.ts)
    return getNextSequentialBranchId(messages, currentBranchId);
  }
}

export const branchContextService = new BranchContextService();
```

---

### 8.4 ThreadStatusService

**File:** `src/lib/services/thread-status.service.ts`

```typescript
import { threadStatusState } from '$lib/stores/thread-view.store';
import type { StatusIndicatorState } from '$lib/stores/thread-view.store';

class ThreadStatusService {
  /**
   * Transition to new state
   */
  setState(state: StatusIndicatorState, message?: string): void {
    threadStatusState.set({
      state,
      message: message ?? null,
      timestamp: Date.now(),
    });
  }

  /**
   * Connection state machine transitions
   */
  onConnecting(): void {
    this.setState('connecting', 'Connecting to model...');
  }

  onSending(): void {
    this.setState('sending', 'Sending message...');
  }

  onReceiving(): void {
    this.setState('receiving', 'Receiving response...');
  }

  onToolExecuting(toolName: string): void {
    this.setState('tool-executing', `Executing tool: ${toolName}`);
  }

  onIdle(): void {
    this.setState('idle');
  }

  onError(message: string): void {
    this.setState('error', message);
  }

  onRateLimited(retryAfter?: number): void {
    const message = retryAfter
      ? `Rate limited. Retry in ${retryAfter}s`
      : 'Rate limited';
    this.setState('rate-limited', message);
  }

  onDisconnected(): void {
    this.setState('disconnected', 'Connection lost');
  }
}

export const threadStatusService = new ThreadStatusService();
```

---

### 8.5 ExecutionRunnerService (for Thread Execution View)

**File:** `src/lib/services/execution-runner.service.ts`

```typescript
import type { Thread } from '../../../src-electron/preload';
import type { Message } from '$lib/types/thread.type';

export interface ExecutionRecord {
  id: string;
  threadId: string;
  executedAt: number;
  executedBy: string;
  status: 'success' | 'error' | 'stopped';
  duration: number;
  resultSummary?: string;
}

class ExecutionRunnerService {
  private isRunning = false;
  private abortController: AbortController | null = null;

  /**
   * Run thread execution
   */
  async runThread(thread: Thread, instructionFile: string): Promise<ExecutionRecord> {
    if (this.isRunning) {
      throw new Error('Execution already in progress');
    }

    this.isRunning = true;
    this.abortController = new AbortController();

    const startTime = Date.now();

    try {
      // 1. Load thread messages
      const messages = await window.electronAPI.thread.getMessages(thread.id);

      // 2. Extract prompts (user messages)
      const prompts = messages.filter(m => m.role === 'user');

      // 3. For each prompt, send with instruction file prepended to system prompt
      const results: Message[] = [];

      for (const prompt of prompts) {
        if (this.abortController.signal.aborted) {
          throw new Error('Execution stopped by user');
        }

        // Send prompt with instruction file
        const response = await this.sendPromptWithInstructions(thread, prompt, instructionFile);
        results.push(response);
      }

      const duration = Date.now() - startTime;

      // 4. Create execution record
      const record: ExecutionRecord = {
        id: crypto.randomUUID(),
        threadId: thread.id,
        executedAt: startTime,
        executedBy: 'current-user', // TODO: Get from auth service
        status: 'success',
        duration,
        resultSummary: `${results.length} prompts executed successfully`,
      };

      // 5. Save record to backend
      await this.saveExecutionRecord(record);

      return record;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      const record: ExecutionRecord = {
        id: crypto.randomUUID(),
        threadId: thread.id,
        executedAt: startTime,
        executedBy: 'current-user',
        status: error.message.includes('stopped') ? 'stopped' : 'error',
        duration,
        resultSummary: error.message,
      };

      await this.saveExecutionRecord(record);

      throw error;
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  /**
   * Stop running execution
   */
  stopExecution(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Send prompt with instruction file prepended
   */
  private async sendPromptWithInstructions(
    thread: Thread,
    prompt: Message,
    instructionFile: string
  ): Promise<Message> {
    // Prepend instruction file to system prompt
    const systemPrompt = instructionFile + '\n\n' + (thread.metadata?.systemPrompt ?? '');

    // Send via chat API (similar to normal message send)
    // TODO: Implement using existing chat service
    return prompt; // Placeholder
  }

  /**
   * Save execution record to backend
   */
  private async saveExecutionRecord(record: ExecutionRecord): Promise<void> {
    // POST /api/threads/{threadId}/executions
    await fetch(`/api/threads/${record.threadId}/executions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
  }

  /**
   * Fetch execution history
   */
  async getExecutionHistory(threadId: string): Promise<ExecutionRecord[]> {
    // GET /api/threads/{threadId}/executions
    const response = await fetch(`/api/threads/${threadId}/executions`);
    return response.json();
  }
}

export const executionRunnerService = new ExecutionRunnerService();
```

---

## 9. Integration & Toggle Mechanism

### 9.1 Keyboard Shortcut Toggle

**File:** `src/routes/+layout.svelte` (or app-level component)

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';

  // Global flag for toggling between old and new component
  export const useNewThreadComponent = writable(false);

  onMount(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Cmd-Shift-T (Mac) or Ctrl-Shift-T (Windows)
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'T') {
        event.preventDefault();
        useNewThreadComponent.update(v => !v);
        console.log('[App] Toggled thread component:', !v);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });
</script>
```

### 9.2 Conditional Rendering in Thread Route

**File:** `src/routes/thread/[id]/+page.svelte` (or equivalent)

```svelte
<script lang="ts">
  import { useNewThreadComponent } from '../+layout.svelte';
  import ChatPane from '$lib/components/ChatPane.svelte';
  import ThreadComponent from '$lib/components/ThreadComponent.svelte';
  import type { Thread } from '../../../src-electron/preload';
  import type { Message } from '$lib/types/thread.type';

  interface Props {
    thread: Thread;
    messages: Message[];
  }

  let { thread, messages }: Props = $props();
</script>

{#if $useNewThreadComponent}
  <ThreadComponent {thread} {messages} {composer}>
    {#snippet composer({ sendMessage, isStreaming, disabled })}
      <!-- Composer component here -->
    {/snippet}
  </ThreadComponent>
{:else}
  <ChatPane {thread} {messages} {composer}>
    {#snippet composer({ sendMessage, isStreaming, disabled })}
      <!-- Composer component here -->
    {/snippet}
  </ChatPane>
{/if}
```

### 9.3 Toast Notification on Toggle

**Enhancement:** Show toast notification when toggling to inform user

```typescript
import { toast } from '$lib/stores/toast.store';

useNewThreadComponent.subscribe(value => {
  if (value) {
    toast.set('Switched to new Thread Component (Beta)');
  } else {
    toast.set('Switched to legacy Chat Pane');
  }
});
```

---

## 10. Migration Strategy

### 10.1 Phased Approach

#### Phase 1: Foundation (Weeks 1-2)
- Create service layer (StreamingService, TimelineBuilderService, BranchContextService)
- Create stores (thread-view.store.ts)
- Create ThreadComponent.svelte skeleton
- Implement keyboard toggle mechanism
- Extract reusable utilities from ChatPane

**Deliverable:** Empty ThreadComponent that can be toggled but shows "Coming Soon"

#### Phase 2: Thread Chat View (Weeks 3-5)
- Implement ThreadChatView.svelte
- Implement MessageTimeline.svelte
- Port message rendering logic
- Port branching logic
- Port streaming logic
- Achieve feature parity with ChatPane for basic chat

**Deliverable:** Functional Thread Chat View with branching support

#### Phase 3: Header & Status Indicator (Week 6)
- Implement ThreadHeader.svelte
- Implement ThreadStatusIndicator.svelte
- Integrate ThreadStatusService
- Add breadcrumb support

**Deliverable:** Complete header with status feedback

#### Phase 4: View Tabs & Prompt View (Week 7)
- Implement ThreadViewTabs.svelte
- Implement ThreadPromptView.svelte
- Enable view switching

**Deliverable:** Two working views (Chat + Prompt)

#### Phase 5: Branching View (Weeks 8-9)
- Implement BranchGraphLayoutService
- Implement ThreadBranchingView.svelte
- Implement SVG rendering
- Add interaction (click to navigate)

**Deliverable:** Graphical branch visualization

#### Phase 6: Execution View (Weeks 10-11)
- Implement ThreadExecutionView.svelte
- Implement ExecutionRunnerService
- Create backend API endpoints
- Create database schema for executions
- Implement instruction file editor
- Implement execution history & chart

**Deliverable:** Fully functional Execution View

#### Phase 7: Testing & Polish (Weeks 12-13)
- Unit tests for all services
- Integration tests for views
- E2E tests for critical flows
- Accessibility audit (WCAG 2.1 AA)
- Performance optimization
- Bug fixes

**Deliverable:** Production-ready Thread Component

#### Phase 8: Gradual Rollout (Week 14)
- Enable for internal users (toggle default to new component)
- Gather feedback
- Fix critical issues
- Documentation

#### Phase 9: Full Migration (Week 15)
- Make new component default
- Deprecate old ChatPane
- Remove toggle (or keep as fallback)

### 10.2 Rollback Plan

- Keep ChatPane.svelte in codebase until Phase 9
- Toggle allows instant rollback if critical bugs found
- Feature flag in backend config for server-side control

---

## 11. Testing Strategy

### 11.1 Unit Tests

**Services:**
```typescript
// streaming.service.test.ts
describe('StreamingService', () => {
  it('should initialize stream state correctly', () => {});
  it('should handle tokens and update response text', () => {});
  it('should complete stream and clean up', () => {});
  it('should handle timeout correctly', () => {});
  it('should handle errors and set error state', () => {});
});

// timeline-builder.service.test.ts
describe('TimelineBuilderService', () => {
  it('should calculate branch boxes correctly', () => {});
  it('should exclude messages shown in branch boxes', () => {});
  it('should interleave messages and branch boxes', () => {});
  it('should handle empty message list', () => {});
});

// branch-context.service.test.ts
describe('BranchContextService', () => {
  it('should build context from selected branches', () => {});
  it('should build context from single branch', () => {});
  it('should get next branch ID correctly', () => {});
});
```

**Components:**
```typescript
// ThreadStatusIndicator.test.ts
describe('ThreadStatusIndicator', () => {
  it('should render idle state with background circles', () => {});
  it('should show green circle when sending', () => {});
  it('should show blue circle when receiving', () => {});
  it('should show red circle on error', () => {});
  it('should animate state transitions', () => {});
});
```

### 11.2 Integration Tests

```typescript
// ThreadChatView.integration.test.ts
describe('ThreadChatView Integration', () => {
  it('should send message and display streaming response', async () => {});
  it('should create variation and show branch boxes', async () => {});
  it('should select branch and hide fork point', async () => {});
  it('should handle error during streaming', async () => {});
});

// ViewSwitching.integration.test.ts
describe('View Switching', () => {
  it('should preserve scroll position when switching views', () => {});
  it('should load data for new view on first visit', () => {});
  it('should handle view switch during streaming', () => {});
});
```

### 11.3 E2E Tests

```typescript
// thread-component.e2e.test.ts
describe('Thread Component E2E', () => {
  it('should toggle between old and new component with keyboard shortcut', () => {});
  it('should send message and receive response in Chat View', () => {});
  it('should create variation and switch branches', () => {});
  it('should navigate to Branching View and click node', () => {});
  it('should run thread execution and view history', () => {});
  it('should expand prompts in Prompt View', () => {});
});
```

### 11.4 Accessibility Testing

- **Keyboard Navigation:** All interactive elements accessible via Tab/Shift-Tab
- **Screen Readers:** ARIA labels, roles, live regions for streaming
- **Focus Management:** Proper focus trap in modals
- **Color Contrast:** WCAG AA compliance (4.5:1 for text)
- **Reduced Motion:** Respect `prefers-reduced-motion` for animations

---

## 12. Performance Considerations

### 12.1 Potential Bottlenecks

| Area | Risk | Mitigation |
|------|------|------------|
| **Timeline Generation** | Recalculates on every message change | Use memoization (Svelte $derived with stable references) |
| **Branch Box Calculation** | Nested loops over messages | Optimize algorithm, cache results |
| **SVG Rendering (Branching View)** | Large threads with 100+ messages | Use virtualization, render only visible nodes |
| **Streaming Updates** | Frequent DOM updates per token | Batch updates (requestAnimationFrame) |
| **Store Subscriptions** | Many components subscribing to same store | Use derived stores to minimize updates |

### 12.2 Optimization Strategies

1. **Memoization:**
   ```typescript
   const timeline = $derived.by(() => {
     return timelineBuilderService.buildTimeline(messages, options);
   });
   ```

2. **Virtualized Rendering:**
   - Use `svelte-virtual` for long message lists
   - Only render messages in viewport + buffer

3. **Lazy Loading:**
   - Load execution history on demand (when Execution View opened)
   - Load branching graph data on demand (when Branching View opened)

4. **Debouncing:**
   - Debounce instruction file save (500ms)
   - Debounce scroll position save (100ms)

5. **Web Workers:**
   - Offload branch graph layout calculation to worker
   - Offload heavy timeline calculations to worker

---

## 13. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Tasks:**
1. Create `src/lib/stores/thread-view.store.ts`
2. Create `src/lib/services/streaming.service.ts`
3. Create `src/lib/services/timeline-builder.service.ts`
4. Create `src/lib/services/branch-context.service.ts`
5. Create `src/lib/services/thread-status.service.ts`
6. Create `src/lib/components/ThreadComponent.svelte` (skeleton)
7. Implement keyboard toggle in app layout
8. Write unit tests for services

**Success Criteria:**
- Keyboard toggle switches between ChatPane and ThreadComponent
- ThreadComponent shows "Coming Soon" message
- All service unit tests pass

### Phase 2: Thread Chat View (Weeks 3-5)

**Tasks:**
1. Create `ThreadChatView.svelte`
2. Create `MessageTimeline.svelte`
3. Create `MessageItem.svelte`
4. Create `BranchBoxItem.svelte`
5. Port message rendering logic from ChatPane
6. Port branching logic (variation creation, selection)
7. Port streaming logic using StreamingService
8. Create `ComposerArea.svelte`
9. Wire up event handlers
10. Write integration tests

**Success Criteria:**
- Can send messages and see streaming responses
- Can create variations and see branch boxes
- Can select branches and toggle visibility
- Feature parity with ChatPane for core chat functionality

### Phase 3: Header & Status Indicator (Week 6)

**Tasks:**
1. Create `ThreadHeader.svelte`
2. Create `ThreadStatusIndicator.svelte`
3. Create `ThreadTitle.svelte`
4. Create `ThreadActions.svelte`
5. Integrate ThreadBreadcrumb (already exists)
6. Implement status state machine
7. Wire up status transitions (idle → sending → receiving)
8. Add CSS animations for status transitions
9. Write component tests

**Success Criteria:**
- Header displays thread title, breadcrumb, status indicator
- Status indicator shows correct states during message flow
- Smooth animations between states

### Phase 4: View Tabs & Prompt View (Week 7)

**Tasks:**
1. Create `ThreadViewTabs.svelte`
2. Create `ThreadPromptView.svelte`
3. Create `PromptList.svelte`
4. Create `PromptItem.svelte`
5. Implement view switching logic
6. Implement expand/collapse functionality
7. Implement "Expand All" / "Collapse All"
8. Add scroll position persistence
9. Write integration tests

**Success Criteria:**
- Can switch between Chat View and Prompt View
- Prompt View shows all user prompts
- Can expand prompts to see responses
- Scroll position preserved when switching views

### Phase 5: Branching View (Weeks 8-9)

**Tasks:**
1. Create `BranchGraphLayoutService.service.ts`
2. Create `ThreadBranchingView.svelte`
3. Create `BranchingGraphCanvas.svelte`
4. Create `BranchingGraphNode.svelte`
5. Implement tree layout algorithm
6. Implement SVG rendering
7. Implement zoom/pan controls
8. Implement node click → navigate to Chat View
9. Add metadata tooltips
10. Write tests

**Success Criteria:**
- Branching View displays graphical representation of thread
- Can click nodes to navigate to message in Chat View
- Can zoom and pan graph
- Shows metadata (model, tokens, timing)

### Phase 6: Execution View (Weeks 10-11)

**Tasks:**
1. Create backend API endpoints (`POST /api/threads/{id}/executions`, `GET /api/threads/{id}/executions`)
2. Create database migration for `thread_executions` table
3. Create `ExecutionRunnerService.service.ts`
4. Create `ThreadExecutionView.svelte`
5. Create `InstructionFileEditor.svelte`
6. Create `ExecutionControls.svelte`
7. Create `ExecutionHistory.svelte`
8. Create `ExecutionFrequencyChart.svelte`
9. Implement instruction file save/load
10. Implement thread execution logic
11. Implement stop execution
12. Wire up UI to service
13. Write tests

**Success Criteria:**
- Can edit and save instruction file
- Can run thread execution
- Can view execution history
- Chart shows execution frequency

### Phase 7: Testing & Polish (Weeks 12-13)

**Tasks:**
1. Write remaining unit tests (95% coverage target)
2. Write integration tests for all views
3. Write E2E tests for critical flows
4. Accessibility audit using axe-core
5. Performance profiling and optimization
6. Fix bugs identified during testing
7. Code review and refactoring
8. Documentation (inline comments, README updates)

**Success Criteria:**
- 95% unit test coverage
- All critical paths covered by E2E tests
- WCAG 2.1 AA compliance
- No performance regressions vs. ChatPane

### Phase 8: Gradual Rollout (Week 14)

**Tasks:**
1. Enable new component for internal team (QA)
2. Gather feedback via survey/issue tracker
3. Monitor error logs and performance metrics
4. Fix critical issues
5. Update user documentation

**Success Criteria:**
- Internal users can use new component
- No critical bugs blocking usage
- Positive feedback from internal team

### Phase 9: Full Migration (Week 15)

**Tasks:**
1. Make new component default (change toggle default to `true`)
2. Announce to users
3. Monitor for issues
4. Deprecate old ChatPane
5. (Optional) Remove old ChatPane code

**Success Criteria:**
- New component is default for all users
- Old ChatPane can be removed or kept as emergency fallback

---

## 14. Risk Assessment & Open Questions

**Complete risk assessment, open questions, and mitigation strategies have been moved to:**
- **`thread-component-requirements.md`** - Section 5 (Risk Assessment) and Section 6 (Open Questions)

**Summary of Key Risks:**
- Complex branching logic breaks (HIGH likelihood, CRITICAL impact)
- Performance regression on large threads (MEDIUM/HIGH)
- Streaming reliability issues (MEDIUM/HIGH)
- Database migration failures (LOW/CRITICAL)
- Sync merge bugs (HIGH/HIGH)

**Key Open Questions:**
- Thread Status Control state machine details
- Error recovery flows
- Branching View layout algorithm
- Tool execution status display
- Execution history retention policy

**Refer to `thread-component-requirements.md` for:**
- Complete risk assessment table with mitigation strategies (R-001 to R-108)
- Critical success factors
- Open questions with recommendations
- Go/no-go decision criteria

---

## Appendix A: File Structure

```
src/lib/
├─ components/
│  ├─ ThreadComponent.svelte (~800 lines)
│  ├─ threads/
│  │  ├─ ThreadHeader.svelte (~150 lines)
│  │  ├─ ThreadTitle.svelte (~80 lines)
│  │  ├─ ThreadStatusIndicator.svelte (~200 lines)
│  │  ├─ ThreadActions.svelte (~100 lines)
│  │  ├─ ThreadViewTabs.svelte (~100 lines)
│  │  ├─ chat/
│  │  │  ├─ ThreadChatView.svelte (~400 lines)
│  │  │  ├─ MessageTimeline.svelte (~250 lines)
│  │  │  ├─ MessageItem.svelte (~150 lines)
│  │  │  ├─ BranchBoxItem.svelte (~100 lines)
│  │  │  └─ ComposerArea.svelte (~100 lines)
│  │  ├─ execution/
│  │  │  ├─ ThreadExecutionView.svelte (~350 lines)
│  │  │  ├─ InstructionFileEditor.svelte (~200 lines)
│  │  │  ├─ ExecutionControls.svelte (~100 lines)
│  │  │  ├─ ExecutionHistory.svelte (~150 lines)
│  │  │  └─ ExecutionFrequencyChart.svelte (~100 lines)
│  │  ├─ branching/
│  │  │  ├─ ThreadBranchingView.svelte (~500 lines)
│  │  │  ├─ BranchingGraphCanvas.svelte (~300 lines)
│  │  │  └─ BranchingGraphNode.svelte (~100 lines)
│  │  └─ prompt/
│  │     ├─ ThreadPromptView.svelte (~200 lines)
│  │     ├─ PromptList.svelte (~50 lines)
│  │     └─ PromptItem.svelte (~100 lines)
│  └─ (reuse existing)
│     ├─ ThreadBreadcrumb.svelte
│     ├─ MessageBubble.svelte
│     ├─ BranchLane.svelte
│     ├─ MarkdownRenderer.svelte
│     └─ modals/
│        ├─ VariationModal.svelte
│        ├─ MessageVersionHistory.svelte
│        └─ MoveThreadModal.svelte
├─ services/
│  ├─ streaming.service.ts (~300 lines)
│  ├─ timeline-builder.service.ts (~250 lines)
│  ├─ branch-context.service.ts (~150 lines)
│  ├─ thread-status.service.ts (~100 lines)
│  ├─ execution-runner.service.ts (~200 lines)
│  └─ branch-graph-layout.service.ts (~300 lines)
├─ stores/
│  └─ thread-view.store.ts (~200 lines)
└─ utils/
   └─ branch-utils.ts (already exists, minor updates)

Total new code: ~5,000 lines
Reused code: ~1,500 lines
Total: ~6,500 lines (vs 3,437 in ChatPane)

Difference: More lines total, but much more modular and maintainable
```

---

## Appendix B: API Endpoints

**New endpoints required for Thread Execution View:**

```
POST   /api/threads/{threadId}/executions
  Request:
    {
      instructionFile: string;
      executedBy: string;
    }
  Response:
    {
      id: string;
      threadId: string;
      executedAt: number;
      executedBy: string;
      status: 'success' | 'error' | 'stopped';
      duration: number;
      resultSummary?: string;
    }

GET    /api/threads/{threadId}/executions
  Query params:
    ?limit=50&offset=0&sort=executedAt,desc
  Response:
    {
      total: number;
      items: ExecutionRecord[];
    }

GET    /api/threads/{threadId}/executions/{executionId}
  Response:
    ExecutionRecord with detailed results

DELETE /api/threads/{threadId}/executions/{executionId}
  (Optional: allow deleting old execution records)
```

**Database Schema:**

```sql
CREATE TABLE thread_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  executed_by VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'error', 'stopped')),
  duration INTEGER NOT NULL, -- milliseconds
  result_summary TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_thread_executions_thread_id ON thread_executions(thread_id);
CREATE INDEX idx_thread_executions_executed_at ON thread_executions(executed_at DESC);
```

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **Thread Component** | New modular architecture replacing ChatPane |
| **View** | One of 4 modes: Chat, Execution, Branching, Prompt |
| **Thread Chat View** | Default view showing messages and branches |
| **Thread Execution View** | View for running threads as automated workflows |
| **Thread Branching View** | Graphical SVG visualization of branch structure |
| **Thread Prompt View** | Compact bullet list of prompts with expandable responses |
| **Thread Status Indicator** | 3-circle visual feedback for connection/model state |
| **Branch ID** | 4-digit hierarchical identifier: row.lane.message.tool_sequence |
| **Row** | Position moving down thread (1-indexed) |
| **Lane** | Branch variation at same row (0-indexed, 0 = main) |
| **Message** | Position within lane (0-indexed) |
| **Tool Sequence** | Tool iteration within message (0-indexed) |
| **Fork Point** | Location in thread where variations diverge |
| **Branch Box** | UI container showing variation messages at fork point |
| **Timeline** | Interleaved rendering of messages and branch boxes |
| **Instruction File** | User-defined text prepended to system prompt for executions |
| **Execution Record** | Historical record of thread execution run |

---

**End of Document**

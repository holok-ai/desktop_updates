# Thread Panel Chat View

**Version:** 1.2
**Date:** 2026-01-27
**Status:** Implementation Ready

---

## Related Documents

| Document | Description |
|----------|-------------|
| **ui-threadpanel-overview.md** | Architecture and design principles |
| **ui-threadpanel-components.md** | Header, tabs, status indicator |
| **system-branching-id.md** | Branch ID system specification |

---

## 1. Overview

The Chat View is the primary interface for conversational interaction, displaying messages in a timeline format with support for branching conversations. It handles message composition, streaming responses, and branch selection while maintaining scroll position and visibility state.

---

## 2. Requirements

| ID | Requirement |
|----|-------------|
| **FR-101** | Display messages in branch hierarchy order (not timestamp) |
| **FR-102** | Support streaming responses with token-by-token display |
| **FR-103** | Enable prompt variation creation (max 2 lanes) |
| **FR-104** | Enable model variation creation (up to 9 models) |
| **FR-105** | Show "Continue With This Branch" button at bottom of each lane |
| **FR-106** | Display branch status (Open/Closed) in branch header |
| **FR-107** | Display branch type (Model/Prompt variation) in branch header |
| **FR-108** | Show "Show Branch" button for closed branches (read-only) |
| **FR-111** | Scroll position persists when switching views |
| **FR-112** | Render markdown content in assistant responses with syntax highlighting |
| **FR-113** | Allow toggling visibility of branches at each fork point |
| **FR-114** | Maintain scroll position when new messages arrive (auto-scroll only if at bottom) |
| **FR-115** | Provide message composer for sending new prompts |
| **FR-116** | Handle streaming timeouts with appropriate error display |

---

## 3. ThreadChatView.svelte

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

**Template:**
```svelte
<div class="thread-chat-view">
  <MessageTimeline
    {messages}
    {activeBranchIndex}
    {hiddenForkPoints}
    {isStreaming}
    streamingText={$streamingState.responseText}
    onToggleBranches={handleToggleBranches}
    onSelectBranch={handleSelectBranch}
    onCreateVariation={handleCreateVariation}
  />

  <ComposerArea
    {composer}
    disabled={$isMainInputDisabled}
    onSendMessage={handleSendMessage}
  />
</div>
```

**Key Methods:**
```typescript
async function handleSendMessage(content: string): Promise<void> {
  // Build context using BranchContextService
  const context = branchContextService.buildContext(messages, {
    branchId: currentBranchId,
    selectedBranchIds: $branchSelectionState.selectedBranchIds,
    includeLocalOnly: true
  });

  // Initiate streaming
  await streamingService.initiateStream({ request, branchId });

  // Send via Electron API
  await window.electronAPI.chat.chat(request);
}

function handleToggleBranches(forkPointId: string): void {
  hiddenForkPoints = new Set(hiddenForkPoints);
  if (hiddenForkPoints.has(forkPointId)) {
    hiddenForkPoints.delete(forkPointId);
  } else {
    hiddenForkPoints.add(forkPointId);
  }
}
```

**Size Estimate:** ~400 lines

---

## 4. MessageTimeline.svelte

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
```typescript
// Use TimelineBuilderService
const timeline = $derived(() => {
  return timelineBuilderService.buildTimeline(messages, {
    activeBranchIndex,
    hiddenForkPoints,
    selectedBranchIds: $branchSelectionState.selectedBranchIds,
    branchSelectionTime: $branchSelectionState.branchSelectionTime
  });
});
```

**Template:**
```svelte
<div class="message-timeline" bind:this={timelineContainer}>
  {#each timeline as item}
    {#if item.type === 'message'}
      <MessageItem
        message={item.data}
        onCreateVariation={onCreateVariation}
      />
    {:else}
      <BranchBoxItem
        branchBox={item.data}
        isActive={activeBranchIndex === item.data.branchIndex}
        onSelectBranch={onSelectBranch}
      />
    {/if}
  {/each}

  {#if isStreaming && streamingText}
    <div class="streaming-indicator">
      <MarkdownRenderer content={streamingText} />
    </div>
  {/if}
</div>
```

**Size Estimate:** ~250 lines

---

## 5. StreamingService

**File:** `src/lib/services/streaming.service.ts`

**Purpose:** Manages token streaming from LLM responses with timeout handling

```typescript
export interface StreamParams {
  request: DesktopChatRequest;
  branchId?: string;
}

class StreamingService {
  private readonly IDLE_TIMEOUT_MS = 60000;
  private readonly NO_RESPONSE_TIMEOUT_MS = 60000;

  async initiateStream(params: StreamParams): Promise<void>;
  private setupTokenListener(branchId?: string): void;
  private handleToken(token: string, branchId?: string): void;
  private restartIdleTimeout(): void;
  private handleTimeout(message: string): void;
  completeStream(): void;
  handleError(error: string): void;
  private cleanup(): void;
}

export const streamingService = new StreamingService();
```

---

## 6. TimelineBuilderService

**File:** `src/lib/services/timeline-builder.service.ts`

**Purpose:** Generates message timeline with interleaved messages and branch boxes

```typescript
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
  buildTimeline(messages: Message[], options: TimelineOptions): TimelineItem[];
  calculateBranchBoxes(messages: Message[]): BranchBox[];
  private calculateExcludedMessages(...): Set<string>;
  private interleaveItems(...): TimelineItem[];
}

export const timelineBuilderService = new TimelineBuilderService();
```

---

## 7. BranchContextService

**File:** `src/lib/services/branch-context.service.ts`

**Purpose:** Assembles message context for LLM API calls

```typescript
export interface ContextOptions {
  branchId?: string;
  selectedBranchIds: string[];
  includeLocalOnly: boolean;
}

class BranchContextService {
  buildContext(messages: Message[], options: ContextOptions): Message[];
  getNextBranchId(messages: Message[], currentBranchId?: string): string;
}

export const branchContextService = new BranchContextService();
```

---

**End of Document**

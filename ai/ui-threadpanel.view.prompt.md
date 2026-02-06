# Thread Panel Prompt View

**Version:** 1.2
**Date:** 2026-01-30
**Status:** Implementation Ready

---

## Related Documents

| Document | Description |
|----------|-------------|
| **ui-threadpanel-overview.md** | Architecture and design principles |
| **ui-threadpanel-layout.md** | Component tree and file structure |
| **system-branching-id.md** | Branch ID system specification |

---

## 1. Overview

The Prompt View provides a compact, accordion-style list of all user prompts in a thread with their associated responses. Users can expand individual prompts to see full content and responses, toggle visibility of response variations, and quickly navigate through the conversation structure. A cycling response visibility mode (Ctrl+Down) allows rapid navigation through different levels of response detail.

---

## 2. Requirements

| # | Requirement |
|---|-------------|
| 1 | Display numbered list of user prompts in collapsed accordion format |
| 2 | Show prompt preview text (first ~100 characters) in collapsed state |
| 3 | Expand prompt on click to show full content and assistant response(s) |
| 4 | Display variation count badge when multiple responses exist for a prompt |
| 5 | Provide "Expand All" button to open all prompts simultaneously |
| 6 | Provide "Collapse All" button to close all prompts simultaneously |
| 7 | Show model badge and timestamp on each response |
| 8 | Toggle "Show all variations" to display responses from alternate branches |
| 9 | Support keyboard navigation between prompts (↑/↓, Enter to toggle) |
| 10 | Render response content as markdown with syntax highlighting |
| 11 | Support Ctrl+Down arrow to cycle response visibility: prompts only → prompts + 1 line → full response → prompts only |

---

## 3. Response Visibility Cycling (Ctrl+Down)

### 3.1 Overview

The Ctrl+Down arrow key cycles through three response visibility states for the currently selected prompt. This enables rapid exploration of response content without expanding/collapsing.

### 3.2 Visibility States

```
┌─────────────────────────────────────────┐
│ State 1: Prompt Only                    │
│ (User sees just the prompt preview)     │
└─────────────────────────────────────────┘
            ↓ Ctrl+Down
┌─────────────────────────────────────────┐
│ State 2: Prompt + 1 Line Response       │
│ (User sees first line of response)      │
└─────────────────────────────────────────┘
            ↓ Ctrl+Down
┌─────────────────────────────────────────┐
│ State 3: Prompt + Full Response         │
│ (User sees complete response)           │
└─────────────────────────────────────────┘
            ↓ Ctrl+Down
┌─────────────────────────────────────────┐
│ State 1: Prompt Only (cycles back)      │
└─────────────────────────────────────────┘
```

### 3.3 State Details

**State 1: Prompts Only** – Compact list view, no response visible
```
▶ #2  Explain quantum computing in simple terms   [3 vars]
```

**State 2: Prompts + 1 Line Response** – Prompt with first line of response
```
▼ #2  Explain quantum computing in simple terms   [3 vars]
  ASSISTANT (gpt-4o) 2:34 PM:
  Quantum computing uses quantum bits (qubits) that can exist...
```

**State 3: Prompts + Full Response** – Complete response visible
```
▼ #2  Explain quantum computing in simple terms   [3 vars]
  USER:
  Explain quantum computing in simple terms
  ──────────────────────────────────────────
  ASSISTANT (gpt-4o) 2:34 PM:
  Quantum computing uses quantum bits (qubits) that can exist
  in multiple states simultaneously, unlike classical bits...
```

### 3.4 Behavior

- **Per-prompt state:** Each prompt tracks its own visibility state independently
- **Navigation preserves state:** Moving to another prompt (↑/↓) and returning preserves the cycling state
- **Works with variations:** When multiple responses exist, the first response is shown; variations accessible via "Show all variations"
- **Focus required:** Ctrl+Down only cycles the currently focused/selected prompt

---

## 3. ThreadPromptView.svelte

**Responsibilities:**
- Render compact list of prompts
- Show expand/collapse controls
- Display responses on expansion
- Handle "Collapse All" / "Expand All"
- Track visibility state per prompt for Ctrl+Down cycling

**Props:**
```typescript
interface ThreadPromptViewProps {
  thread: Thread;
  messages: Message[];
}
```

**State:**
```typescript
// Type for response visibility: 'hidden' | 'one-line' | 'full'
type ResponseVisibility = 'hidden' | 'one-line' | 'full';

let expandedPrompts = $state(new Set<string>()); // message IDs
let showAllResponses = $state(false);
let responseVisibility = $state(new Map<string, ResponseVisibility>()); // per-prompt visibility state
let selectedPromptId = $state<string | null>(null); // for keyboard navigation
```

**Template:**
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

  <PromptList>
    {#each userMessages as message, index}
      <PromptItem
        {message}
        {index}
        expanded={expandedPrompts.has(message.id)}
        responses={getResponsesForPrompt(message.id)}
        {showAllResponses}
        visibilityState={responseVisibility.get(message.id) || 'hidden'}
        focused={selectedPromptId === message.id}
        onToggle={() => handleTogglePrompt(message.id)}
        onFocus={() => handlePromptFocus(message.id)}
      />
    {/each}
  </PromptList>
</div>
```

**Key Methods:**
```typescript
function getResponsesForPrompt(promptMessageId: string): Message[] {
  const promptMessage = messages.find(m => m.id === promptMessageId);
  if (!promptMessage) return [];

  // Parse branch ID (format: row.lane.message.tool_iteration)
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

function handleExpandAll(): void {
  expandedPrompts = new Set(userMessages.map(m => m.id));
}

function handleCollapseAll(): void {
  expandedPrompts = new Set();
}

function handleTogglePrompt(messageId: string): void {
  expandedPrompts = new Set(expandedPrompts);
  if (expandedPrompts.has(messageId)) {
    expandedPrompts.delete(messageId);
  } else {
    expandedPrompts.add(messageId);
  }
}

function handlePromptFocus(messageId: string): void {
  selectedPromptId = messageId;
}

function handleCycleResponseVisibility(messageId: string): void {
  const currentState = responseVisibility.get(messageId) || 'hidden';
  let nextState: ResponseVisibility;
  
  switch (currentState) {
    case 'hidden':
      nextState = 'one-line';
      // Auto-expand the prompt if collapsing response visibility
      expandedPrompts.add(messageId);
      break;
    case 'one-line':
      nextState = 'full';
      expandedPrompts.add(messageId);
      break;
    case 'full':
      nextState = 'hidden';
      // Keep expanded until next cycle completes
      break;
  }
  
  responseVisibility.set(messageId, nextState);
}

function handleKeyDown(event: KeyboardEvent): void {
  if (!selectedPromptId) return;
  
  // Ctrl+Down arrow: cycle response visibility
  if (event.ctrlKey && event.key === 'ArrowDown') {
    event.preventDefault();
    handleCycleResponseVisibility(selectedPromptId);
  }
  
  // Up/Down arrow: navigate prompts
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    const currentIndex = userMessages.findIndex(m => m.id === selectedPromptId);
    if (currentIndex === -1) return;
    
    const nextIndex = event.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex >= 0 && nextIndex < userMessages.length) {
      selectedPromptId = userMessages[nextIndex].id;
    }
  }
  
  // Enter: toggle expanded state
  if (event.key === 'Enter') {
    handleTogglePrompt(selectedPromptId);
  }
}
```

**Derived Values:**
```typescript
const userMessages = $derived(
  messages.filter(m => m.role === 'user')
);
```

**Size Estimate:** ~250 lines (expanded from ~200 to accommodate cycling)

---

## 4. Sub-Components

### 4.1 PromptList.svelte

**Responsibilities:**
- Container for prompt items
- Handle list layout and spacing

**Props:**
```typescript
interface PromptListProps {
  children: Snippet;
}
```

**Template:**
```svelte
<ul class="prompt-list">
  {@render children()}
</ul>

<style>
  .prompt-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
</style>
```

**Size Estimate:** ~50 lines

### 4.2 PromptItem.svelte

**Responsibilities:**
- Display single prompt with expand/collapse
- Show prompt number and preview
- Render responses with cycling visibility states
- Show variation count badge
- Handle Ctrl+Down cycling state visually

**Props:**
```typescript
export interface PromptItemProps {
  message: Message;
  index: number;
  expanded: boolean;
  responses: Message[];
  showAllResponses: boolean;
  visibilityState: 'hidden' | 'one-line' | 'full'; // NEW
  focused: boolean;                                  // NEW
  onToggle: () => void;
  onFocus: () => void;                              // NEW
}
```

**Render Logic:**
```typescript
function shouldShowResponse(visibilityState): boolean {
  return visibilityState !== 'hidden';
}

function getResponsePreview(response: Message): string {
  const lines = response.content.split('\n');
  return lines[0] || '';  // First line only for 'one-line' state
}

function getResponseToDisplay(visibilityState, response): string {
  switch (visibilityState) {
    case 'hidden':
      return '';
    case 'one-line':
      return getResponsePreview(response);
    case 'full':
      return response.content;
  }
}
```

**Size Estimate:** ~120 lines (expanded from ~100)

---

## 5. Visual Layout

### Collapsed State

```
┌──────────────────────────────────────────────────────────────┐
│ [Expand All] [Collapse All]  ☐ Show all variations           │
├──────────────────────────────────────────────────────────────┤
│ ▶ #1  What is the capital of France?                         │
├──────────────────────────────────────────────────────────────┤
│ ▶ #2  Explain quantum computing in simple terms   [3 vars]   │
├──────────────────────────────────────────────────────────────┤
│ ▶ #3  Write a haiku about programming                        │
└──────────────────────────────────────────────────────────────┘
```

### State 2: Prompt + 1 Line Response

```
┌──────────────────────────────────────────────────────────────┐
│ ▼ #2  Explain quantum computing in simple terms   [3 vars]   │
│                                                               │
│ ASSISTANT (gpt-4o) 2:34 PM:                                  │
│ Quantum computing uses quantum bits (qubits)...              │
└──────────────────────────────────────────────────────────────┘
```

### State 3: Prompt + Full Response

```
┌──────────────────────────────────────────────────────────────┐
│ ▼ #2  Explain quantum computing in simple terms   [3 vars]   │
│                                                               │
│ USER:                                                        │
│ Explain quantum computing in simple terms                    │
│ ──────────────────────────────────────────────────────────── │
│ ASSISTANT (gpt-4o) 2:34 PM:                                  │
│ Quantum computing uses quantum bits (qubits) that can        │
│ exist in multiple states simultaneously, unlike classical    │
│ bits that are either 0 or 1. This allows quantum            │
│ computers to process certain types of problems much          │
│ faster than traditional computers...                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Down` | Cycle response visibility: prompts only → 1 line → full → prompts only |
| `Enter` | Toggle selected prompt expand/collapse |
| `↑` / `↓` | Navigate prompts |
| `Ctrl+E` | Expand all |
| `Ctrl+Shift+E` | Collapse all |

---

**End of Document**

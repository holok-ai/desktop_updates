# Thread Panel Prompt View

**Version:** 1.1
**Date:** 2026-01-27
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

The Prompt View provides a compact, accordion-style list of all user prompts in a thread with their associated responses. Users can expand individual prompts to see full content and responses, toggle visibility of response variations, and quickly navigate through the conversation structure.

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

---

## 3. ThreadPromptView.svelte

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
        onToggle={() => handleTogglePrompt(message.id)}
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
```

**Derived Values:**
```typescript
const userMessages = $derived(
  messages.filter(m => m.role === 'user')
);
```

**Size Estimate:** ~200 lines

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
- Render responses when expanded
- Show variation count badge

**Props:**
```typescript
interface PromptItemProps {
  message: Message;
  index: number;
  expanded: boolean;
  responses: Message[];
  showAllResponses: boolean;
  onToggle: () => void;
}
```

**Size Estimate:** ~100 lines

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

### Expanded State

```
┌──────────────────────────────────────────────────────────────┐
│ [Expand All] [Collapse All]  ☑ Show all variations           │
├──────────────────────────────────────────────────────────────┤
│ ▶ #1  What is the capital of France?                         │
├──────────────────────────────────────────────────────────────┤
│ ▼ #2  Explain quantum computing in simple terms   [3 vars]   │
│ ┌────────────────────────────────────────────────────────────│
│ │ USER:                                                      │
│ │ Explain quantum computing in simple terms                  │
│ │──────────────────────────────────────────────────────────  │
│ │ ASSISTANT (gpt-4o) 2:34 PM:                                │
│ │ Quantum computing uses quantum bits (qubits)...            │
│ │──────────────────────────────────────────────────────────  │
│ │ ASSISTANT (claude-3) 2:35 PM:                              │
│ │ Imagine a computer that can try all answers at once...     │
│ │──────────────────────────────────────────────────────────  │
│ │ ASSISTANT (gemini-pro) 2:35 PM:                            │
│ │ Traditional computers use bits that are either 0 or 1...   │
│ └────────────────────────────────────────────────────────────│
├──────────────────────────────────────────────────────────────┤
│ ▶ #3  Write a haiku about programming                        │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Toggle selected prompt |
| `↑` / `↓` | Navigate prompts |
| `Ctrl+E` | Expand all |
| `Ctrl+Shift+E` | Collapse all |

---

**End of Document**

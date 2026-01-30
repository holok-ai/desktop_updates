# Branch ID System Design

**Version:** 1.0
**Date:** 2026-01-25
**Status:** Approved

---

## Table of Contents

1. [Overview](#1-overview)
2. [Requirements](#2-requirements)
3. [Branch ID Format Specification](#3-branch-id-format-specification)
4. [Component Definitions](#4-component-definitions)
5. [Examples](#5-examples)
6. [Components Using Branch IDs](#6-components-using-branch-ids)
7. [Services Using Branch IDs](#7-services-using-branch-ids)
8. [Database Storage](#8-database-storage)
9. [Ordering and Comparison](#9-ordering-and-comparison)
10. [Integration Points](#10-integration-points)

---

## 1. Overview

The Branch ID system provides a hierarchical identification scheme for messages, prompts, responses, branches, and tool iterations within a thread. This system enables:

- **Deterministic Ordering** - Messages ordered by hierarchy, not timestamps
- **Branch Management** - Clear identification of variations and alternatives
- **Tool Tracking** - Separate identification of tool call iterations
- **Concurrent Editing** - Multiple users can work on different branches

**Format:** `{ROW}.{LANE}.{MESSAGE}.{TOOL_ITERATION}`

**Example:** `"2.1.0.1"` = Row 2, Lane 1, Message 0, Tool Iteration 1

---

## 2. Requirements

### 2.1 Core Requirements

| Requirement| Description | Priority |
|------------|-------------|----------|
| **REQ-1**  | All branch IDs **must** use 4-digit format | CRITICAL |
| **REQ-2**  | Branch IDs **must** be unique within a thread | CRITICAL |
| **REQ-2**  | Branch IDs **must** support numeric ordering (not lexicographic) | HIGH | Confirmed |
| **REQ-4**  | Branch IDs **must** be stored in PostgreSQL ltree format | HIGH |
| **REQ-5**  | System **must** support up to 9 lanes per branch point | MEDIUM |
| **REQ-6**  | System **must** support unlimited messages per lane | MEDIUM |
| **REQ-7**  | System **must** support unlimited tool iterations per message | MEDIUM |
| **REQ-8**  | Branch IDs **must** be immutable once created | HIGH |
| **REQ-9**  | Row numbering: 1-based (first message = row 1) | HIGH | Confirmed |
| **REQ-10** | Lane numbering: 0-based (0 = main, 1-9 = variations) | HIGH | Confirmed |
| **REQ-11** | Message numbering: 0-based (position within lane) | HIGH | Confirmed |
| **REQ-12** | Tool iteration numbering: 0-based (0 = no tools) | HIGH | Confirmed |

### 2.2 Use Cases

1. **Message Ordering**
   - Thread displays messages in branch hierarchy order
   - Deterministic sorting without timestamp manipulation

2. **Branch Variations**
   - User creates prompt variation → new lane with incremented lane number
   - User tests multiple models → each model gets unique lane

3. **Tool Iteration Tracking**
   - Model calls tool → tool_iteration = 1
   - Model calls same tool again → tool_iteration = 2
   - Preserves order of tool execution sequence

4. **Context Assembly**
   - When building message context for LLM, select messages by branch path
   - Include only messages from selected branches

5. **Synchronization**
   - Local messages identified by (thread_id, branch_id)
   - Remote messages from Moku API matched by branch_id
   - Replace local with remote when sync occurs

---

## 3. Branch ID Format Specification

### 3.1 Format Definition

```
branch_id = {ROW}.{LANE}.{MESSAGE}.{TOOL_ITERATION}

Where:
  ROW           = 1-based integer (position moving down thread)
  LANE          = 0-based integer (0 = main, 1+ = variations)
  MESSAGE       = 0-based integer (position within lane)
  TOOL_ITERATION = 0-based integer (tool call sequence)
```

### 3.2 Component Ranges

| Component | Range | Description |
|-----------|-------|-------------|
| **ROW** | 1 - ∞ | First message is row 1, increments for each new row |
| **LANE** | 0 - 9 | 0 = main branch, 1-9 = variations (max 9 variations) |
| **MESSAGE** | 0 - ∞ | First message in lane is 0, increments sequentially |
| **TOOL_ITERATION** | 0 - ∞ | 0 = no tool calls, 1+ = tool execution sequence |

### 3.3 Validation Rules

```typescript
function validateBranchId(branchId: string): boolean {
  const parts = branchId.split('.');

  // Must have exactly 4 parts
  if (parts.length !== 4) {
    return false;
  }

  // All parts must be numeric
  const [row, lane, message, toolIteration] = parts.map(p => parseInt(p, 10));
  if ([row, lane, message, toolIteration].some(isNaN)) {
    return false;
  }

  // Row must be >= 1
  if (row < 1) {
    return false;
  }

  // Lane, message, toolIteration must be >= 0
  if (lane < 0 || message < 0 || toolIteration < 0) {
    return false;
  }

  return true;
}
```

---

## 4. Component Definitions

### 4.1 Row

**Definition:** A Row represents a position as you move down a thread. A Row may contain either a **Branch** or a **ChatMessage**.

**Characteristics:**
- **1-based indexing** (first row = 1)
- **Sequential** - rows increment as thread progresses
- **Type:** Can be main message (lane 0) or branch point (lane 1+)

**Examples:**
- Row 1: First message in thread (`1.0.0.0`)
- Row 2: Second message OR branch point at row 2
- Row 5: Fifth position in thread

### 4.2 Lane

**Definition:** A Lane is one path through a branch point. Lane 0 is the main branch, lanes 1-9 are variations.

**Characteristics:**
- **0-based indexing** (main = 0, first variation = 1)
- **Branch Context:** Lanes only meaningful at branch points (where row has multiple lanes)
- **Maximum:** 9 variations per branch point (lanes 0-9)

**Types:**
- **Main Lane (0):** Original, unmodified flow
- **Prompt Variation Lane (1):** User modified the prompt text
- **Model Variation Lanes (1-9):** Testing same prompt with different models

**Examples:**
- `2.0.0.0`: Row 2, main lane
- `2.1.0.0`: Row 2, variation lane 1
- `2.2.0.0`: Row 2, variation lane 2

### 4.3 Message

**Definition:** Position of a message within a lane. Each prompt and response is a separate message.

**Characteristics:**
- **0-based indexing** (first message in lane = 0)
- **Sequential within lane** - increments for each new message
- **Prompt/Response pairs:** User message = N, Assistant response = N+1

**Examples:**
- `1.0.0.0`: First message in main lane
- `1.0.1.0`: Second message in main lane
- `2.1.0.0`: First message in variation lane 1

### 4.4 Tool Iteration

**Definition:** Sequence number for tool execution iterations within a single message response.

**Characteristics:**
- **0-based indexing** (no tools = 0, first tool = 1)
- **Sequential per message** - increments for each tool call
- **Preserves execution order** - tool results appear in order called

**Examples:**
- `2.0.0.0`: Message with no tool calls
- `2.0.0.1`: First tool call result for message at 2.0.0
- `2.0.0.2`: Second tool call result for message at 2.0.0

---

## 5. Examples

### 5.1 Simple Thread (No Branches)

```
1.0.0.0  - User: "What is the weather today?"
1.0.1.0  - Assistant: "It's sunny and 72°F"
2.0.0.0  - User: "What about tomorrow?"
2.0.1.0  - Assistant: "Tomorrow will be cloudy with a high of 68°F"
```

**Explanation:**
- All messages on main lane (lane 0)
- Rows increment for each user message
- Messages alternate between user (0) and assistant (1)

### 5.2 Thread with Tool Calls

```
1.0.0.0  - User: "Read the contents of config.json"
1.0.1.0  - Assistant: (thinking)
1.0.1.1  - Tool: read_file(config.json) → returns content
1.0.1.2  - Tool: validate_json(content) → returns valid
1.0.2.0  - Assistant: "Here's the config file content: {...}"
```

**Explanation:**
- User message at 1.0.0.0
- Assistant starts response at 1.0.1.0
- Two tool calls: 1.0.1.1 and 1.0.1.2
- Final assistant response at 1.0.2.0

### 5.3 Prompt Variation Branch

**User creates variation of prompt at row 2:**

```
1.0.0.0  - User: "Explain quantum computing"
1.0.1.0  - Assistant: "Quantum computing uses qubits..."

--- Branch Point at Row 2 ---
2.0.0.0  - User: "Now explain in simple terms" (original)
2.0.1.0  - Assistant: "In simple terms, quantum computers..."

2.1.0.0  - User: "Explain with an analogy" (variation)
2.1.1.0  - Assistant: "Think of quantum computing like..."

--- User selects lane 1, thread continues ---
3.0.0.0  - User: "Can you give me an example?"
3.0.1.0  - Assistant: "Sure! Imagine a coin that is both heads..."
```

**Explanation:**
- Row 2 has two lanes: main (0) and variation (1)
- Each lane has its own prompt and response
- After user selects lane 1, thread continues with row 3 on main lane

### 5.4 Model Variation Branch

**User tests prompt with 3 different models:**

```
1.0.0.0  - User: "Write a haiku about coding"

--- Branch Point at Row 2 (3 model variations) ---
2.0.0.0  - User: "Write a haiku about coding" (GPT-4)
2.0.1.0  - Assistant: "Code flows like water / Bugs hide in shadowed corners / Debug brings the light"

2.1.0.0  - User: "Write a haiku about coding" (Claude Sonnet)
2.1.1.0  - Assistant: "Functions compile clean / Variables dance through RAM / Syntax brings order"

2.2.0.0  - User: "Write a haiku about coding" (Gemini)
2.2.1.0  - Assistant: "Loops execute fast / Arrays hold the data tight / Logic solves the task"

--- User selects lane 2 (Gemini), thread continues ---
3.0.0.0  - User: "Now write a limerick"
3.0.1.0  - Assistant: "There once was a coder named Sue..."
```

**Explanation:**
- Row 2 has three lanes: 0 (GPT-4), 1 (Claude), 2 (Gemini)
- Same prompt across all lanes
- Each model produces different response
- After selection, thread continues on main lane with selected model

### 5.5 Complex Branch with Tool Calls

```
1.0.0.0  - User: "Analyze the sales data"

--- Branch Point at Row 2 (2 approaches) ---
2.0.0.0  - User: "Use Python to analyze sales" (original)
2.0.1.0  - Assistant: (preparing)
2.0.1.1  - Tool: execute_code("import pandas...") → returns chart
2.0.2.0  - Assistant: "Here's the analysis: [chart]"

2.1.0.0  - User: "Use SQL to analyze sales" (variation)
2.1.1.0  - Assistant: (preparing)
2.1.1.1  - Tool: execute_query("SELECT * FROM sales") → returns table
2.1.1.2  - Tool: generate_chart(data) → returns visualization
2.1.2.0  - Assistant: "Here's the SQL analysis: [chart]"
```

**Explanation:**
- Two lanes showing different analysis approaches
- Lane 0: Single tool call (Python)
- Lane 1: Two tool calls (SQL query + chart generation)
- Tool iterations tracked with 4th digit

### 5.6 Deeply Nested Branches

```
1.0.0.0  - User: "Explain recursion"
1.0.1.0  - Assistant: "Recursion is when a function calls itself..."

--- Branch Point at Row 2 ---
2.0.0.0  - User: "Show me an example"
2.0.1.0  - Assistant: "Here's a factorial function..."

2.1.0.0  - User: "Show me with fibonacci"
2.1.1.0  - Assistant: "Here's fibonacci: fib(n) = ..."

--- Branch Point at Row 3 (continuation of lane 1) ---
3.0.0.0  - User: "Can you optimize it?" (continuing from 2.0)
3.0.1.0  - Assistant: "Here's an optimized version with memoization..."

3.1.0.0  - User: "Add error handling" (variation at row 3)
3.1.1.0  - Assistant: "Here's the version with error handling..."
```

**Explanation:**
- Multiple branch points at different rows
- Each branch can have its own continuation
- Row numbers continue sequentially regardless of lane

---

## 6. Components Using Branch IDs

### 6.1 UI Components

| Component | Purpose | Branch ID Usage |
|-----------|---------|-----------------|
| **MessageBubble** | Display individual message | Shows message with branchId for debugging/display |
| **BranchLane** | Container for branch variation | Groups messages by lane (e.g., all 2.1.*.* messages) |
| **BranchIndicator** | Shows current branch in header | Displays current branchId being viewed |
| **BranchSwitcher** | Dropdown to switch branches | Lists available lanes at current row |
| **MessageTimeline** | Main message display area | Sorts and filters messages by branchId hierarchy |
| **MessageItem** | Wrapper for message in timeline | Passes branchId to children |
| **BranchBoxItem** | Displays branch variations | Shows all lanes for a given row |
| **ThreadBranchingView** | SVG graph visualization | Renders nodes with branchId as label |
| **PromptItem** | Prompt list item | Uses branchId to find associated responses |

### 6.2 Data Models

```typescript
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error';

interface Message {
  id: string;                    // UUID
  branchId: string;              // 4-digit format: "row.lane.message.tool_iteration"
  threadId: string;              // Parent thread
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;                // Model used for generation
  status: MessageStatus;         // Streaming lifecycle state
  error?: string;                // Error message if status === 'error'
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

interface Thread {
  id: string;
  title: string;
  currentBranchId: string;       // Current branch being viewed
  metadata?: {
    selectedBranchIds?: string[];  // Array of selected branch IDs
    [key: string]: unknown;
  };
}

interface BranchState {
  branchId: string;
  model: string;
  status: MessageStatus;         // Persisted status from repository
  phase: StreamPhase;            // Real-time phase for UI styling
  statusMessage?: string;        // Real-time message for display
  content: string;
  error?: string;
}

interface BranchBox {
  branchIndex: number;
  userMessage: Message;          // Has branchId
  assistantMessage: Message | null;  // Has branchId
  allMessages: Message[];        // All messages in this lane
}
```

---

## 7. Services Using Branch IDs

### 7.1 ChatStreamService

**Purpose:** Manages token streaming state in the UI for LLM responses

**Location:** `src/lib/services/chat-stream.service.ts` (frontend)

**Branch ID Usage:**
- Tracks which branches are currently streaming
- Maintains per-branch state: `Map<branchId, BranchState>`
- Allows parallel streaming across multiple branches

**Key Methods:**
```typescript
class ChatStreamService {
  viewThread(threadId: string, branchIds: string[], onUpdate: BranchUpdateCallback): Promise<Map<string, BranchState>>
  startBranched(threadId: string, prompt: string, models: ModelConfig[], messages: Message[]): Promise<void>
  cancelBranch(branchId: string): Promise<void>
  cancelAll(): Promise<void>
  cleanup(): void
}
```

See **system-thread-multiplexing.md § Sample UI Implementation** for complete implementation.

### 7.2 TimelineBuilderService

**Purpose:** Generates message timeline with interleaved messages and branch boxes

**Branch ID Usage:**
- Parses branchId to extract row/lane/message/tool
- Groups messages by row to identify branch points
- Sorts messages by branchId hierarchy
- Filters messages based on selected branches

**Key Methods:**
```typescript
class TimelineBuilderService {
  buildTimeline(messages: Message[], options: TimelineOptions): TimelineItem[]
  calculateBranchBoxes(messages: Message[]): BranchBox[]
  compareMessages(a: Message, b: Message): number  // Compares by branchId
}
```

### 7.3 BranchContextService

**Purpose:** Assembles message context for LLM API calls

**Branch ID Usage:**
- Filters messages by selected branch path
- Builds context from specific lane
- Generates next sequential branchId for new messages

**Key Methods:**
```typescript
class BranchContextService {
  buildContext(messages: Message[], options: ContextOptions): Message[]
  getNextBranchId(messages: Message[], currentBranchId?: string): string
  filterByBranchPath(messages: Message[], branchPath: string): Message[]
}
```

### 7.4 Thread Repository Service

**Purpose:** Manages thread and message persistence, caching, streaming updates, and synchronization

**Branch ID Usage:**
- All messages indexed by (threadId, branchId)
- Streaming updates target specific branchId
- Sync matches local/remote by branchId
- Queries filter by branchId prefix

**Consolidated Interface:**
```typescript
// src-electron/services/thread/thread-repository.ts

export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error';

export interface Message {
  id: string;
  threadId: string;
  branchId: string;                    // 4-digit format: "row.lane.message.tool_iteration"
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  status: MessageStatus;
  error?: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// CRUD Operations
// ─────────────────────────────────────────────────────────────

/** Create a new message */
export async function createMessage(message: Omit<Message, 'id' | 'createdAt' | 'updatedAt'>): Promise<Message>;

/** Create assistant message placeholder before streaming starts */
export async function createAssistantMessage(
  threadId: string,
  branchId: string,
  model: string
): Promise<Message>;

/** Get a single message by threadId and branchId */
export async function getMessage(threadId: string, branchId: string): Promise<Message | null>;

/** Get all messages for a thread */
export async function getMessages(threadId: string): Promise<Message[]>;

/** Update an existing message */
export async function updateMessage(threadId: string, branchId: string, updates: Partial<Message>): Promise<void>;

/** Delete a message */
export async function deleteMessage(threadId: string, branchId: string): Promise<void>;

// ─────────────────────────────────────────────────────────────
// Streaming Operations (called by StreamManager)
// ─────────────────────────────────────────────────────────────

/** Set message status during streaming lifecycle */
export async function setMessageStatus(
  threadId: string,
  branchId: string,
  status: MessageStatus,
  error?: string
): Promise<void>;

/** Append token to message content during streaming */
export async function appendToken(
  threadId: string,
  branchId: string,
  token: string
): Promise<void>;

// ─────────────────────────────────────────────────────────────
// Query Operations
// ─────────────────────────────────────────────────────────────

/** Get messages matching a branch prefix (e.g., "2.1" for all messages in row 2, lane 1) */
export async function getMessagesByBranchPrefix(
  threadId: string,
  branchIdPrefix: string
): Promise<Message[]>;

/** Get all messages in a specific lane */
export async function getMessagesInLane(
  threadId: string,
  row: number,
  lane: number
): Promise<Message[]>;

/** Get all variations at a specific row */
export async function getVariationsAtRow(
  threadId: string,
  row: number
): Promise<Message[]>;

// ─────────────────────────────────────────────────────────────
// Sync Operations (for Moku API integration)
// ─────────────────────────────────────────────────────────────

/** Cache a message locally (from API response or optimistic update) */
export async function cacheMessage(
  threadId: string,
  branchId: string,
  message: Message
): Promise<void>;

/** Sync local messages with remote Moku API */
export async function syncMessages(threadId: string): Promise<void>;
// Implementation: Match by branchId, replace local with remote when branchId matches
```

**Key Operations by Use Case:**

| Use Case | Methods |
|----------|---------| 
| Start streaming | `createAssistantMessage()`, `setMessageStatus('streaming')` |
| During streaming | `appendToken()` |
| Complete streaming | `setMessageStatus('complete')` |
| Error during streaming | `setMessageStatus('error', message)` |
| Load thread view | `getMessages()` |
| Query branch variations | `getMessagesByBranchPrefix()`, `getVariationsAtRow()` |
| Sync with server | `syncMessages()`, `cacheMessage()` |

### 7.5 Branch Utilities (branch-utils.ts)

**Purpose:** Utility functions for branch manipulation

**Branch ID Usage:**
- Parse branchId into components
- Compare branchIds for sorting
- Generate next branchId in sequence
- Extract row number from branchId
- Check if branchId is in a specific branch path

**Key Functions:**
```typescript
export function parseBranchId(branchId: string): { row: number; lane: number; message: number; tool: number }
export function compareBranchIds(a: string, b: string): number
export function getNextSequentialBranchId(messages: Message[], currentBranchId?: string): string
export function getRowNumber(branchId: string): number
export function isInBranchPath(branchId: string, pathPrefix: string): boolean
export function getBranchMessages(messages: Message[], branchId: string): Message[]
export function getVariationsForBranch(messages: Message[]): Message[]
```

---

## 8. Database Storage

### 8.1 PostgreSQL ltree Extension

Branch IDs are stored using PostgreSQL's `ltree` type, which provides:
- Efficient hierarchical queries
- Native ordering support
- Index optimization for tree structures

**Schema:**
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  thread_id UUID NOT NULL,
  branch_id LTREE NOT NULL,  -- Stores "1.0.0.0" as ltree
  role VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  metadata JSONB,

  CONSTRAINT unique_thread_branch UNIQUE (thread_id, branch_id)
);

-- Index for efficient branch queries
CREATE INDEX idx_messages_branch_id ON messages USING GIST (branch_id);
CREATE INDEX idx_messages_thread_branch ON messages (thread_id, branch_id);
```

### 8.2 Querying by Branch

**Get all messages in a thread, ordered by branch:**
```sql
SELECT * FROM messages
WHERE thread_id = $1
ORDER BY branch_id;
```

**Get all messages in a specific lane:**
```sql
SELECT * FROM messages
WHERE thread_id = $1
  AND branch_id <@ '2.1'  -- All messages under row 2, lane 1
ORDER BY branch_id;
```

**Get messages at a specific row:**
```sql
SELECT * FROM messages
WHERE thread_id = $1
  AND branch_id ~ '2.*{1}'  -- Row 2, any lane/message/tool
ORDER BY branch_id;
```

---

## 9. Ordering and Comparison

### 9.1 Comparison Algorithm

Messages are ordered by comparing branch IDs component-wise:

```typescript
function compareBranchIds(a: string, b: string): number {
  const partsA = a.split('.').map(p => parseInt(p, 10));
  const partsB = b.split('.').map(p => parseInt(p, 10));

  // Compare each component left to right
  for (let i = 0; i < 4; i++) {
    const numA = partsA[i];
    const numB = partsB[i];

    if (numA !== numB) {
      return numA - numB;
    }
  }

  return 0;  // Identical
}
```

### 9.2 Sort Examples

**Input (unsorted):**
```
2.1.0.0
1.0.0.0
2.0.1.0
1.0.1.1
2.0.0.0
1.0.1.0
```

**Output (sorted):**
```
1.0.0.0  (row 1, main lane, message 0, no tools)
1.0.1.0  (row 1, main lane, message 1, no tools)
1.0.1.1  (row 1, main lane, message 1, tool iteration 1)
2.0.0.0  (row 2, main lane, message 0, no tools)
2.0.1.0  (row 2, main lane, message 1, no tools)
2.1.0.0  (row 2, variation lane 1, message 0, no tools)
```

### 9.3 Lexicographic vs Numeric

**Important:** Branch IDs must be compared **numerically**, not lexicographically.

**Why?**
- Lexicographic: "10.0.0.0" < "2.0.0.0" (incorrect!)
- Numeric: 10.0.0.0 > 2.0.0.0 (correct!)

**Implementation:**
Always parse components as integers before comparison.

---

## 10. Integration Points

### 10.1 Message Creation

When creating a new message:

```typescript
function createMessage(
  threadId: string,
  role: 'user' | 'assistant',
  content: string,
  currentBranchId?: string
): Message {
  // Get next sequential branch ID
  const branchId = getNextSequentialBranchId(existingMessages, currentBranchId);

  return {
    id: crypto.randomUUID(),
    branchId,  // 4-digit format
    threadId,
    role,
    content,
    createdAt: Date.now(),
  };
}
```

### 10.2 Variation Creation

When user creates a variation:

```typescript
function createVariation(
  originalMessage: Message,
  variationType: 'prompt' | 'model'
): string {
  const parts = originalMessage.branchId.split('.').map(Number);
  const [row, lane, message, tool] = parts;

  // Find next available lane at this row
  const nextLane = findNextAvailableLane(row);

  // Variation starts at message 0 in new lane
  return `${row}.${nextLane}.0.0`;
}
```

### 10.3 Tool Iteration Tracking

When model calls a tool:

```typescript
function createToolMessage(
  parentMessage: Message,
  toolName: string,
  toolResult: unknown
): Message {
  const parts = parentMessage.branchId.split('.').map(Number);
  const [row, lane, message, tool] = parts;

  // Increment tool iteration
  const nextToolIteration = tool + 1;
  const branchId = `${row}.${lane}.${message}.${nextToolIteration}`;

  return {
    id: crypto.randomUUID(),
    branchId,
    threadId: parentMessage.threadId,
    role: 'assistant',
    content: `Tool: ${toolName}\nResult: ${JSON.stringify(toolResult)}`,
    createdAt: Date.now(),
  };
}
```

### 10.4 Context Assembly for API

When sending messages to LLM API:

```typescript
function assembleContextForAPI(
  allMessages: Message[],
  selectedBranchIds: string[]
): Message[] {
  if (selectedBranchIds.length === 0) {
    // No branches selected, use main lane only
    return allMessages.filter(m => m.branchId.split('.')[1] === '0');
  }

  // Include messages from selected branches
  const context: Message[] = [];

  for (const branchId of selectedBranchIds) {
    const branchPath = getBranchPath(branchId);  // e.g., "2.1"
    const branchMessages = allMessages.filter(m =>
      m.branchId.startsWith(branchPath)
    );
    context.push(...branchMessages);
  }

  // Sort by branch hierarchy
  context.sort((a, b) => compareBranchIds(a.branchId, b.branchId));

  return context;
}
```

---

## Appendix A: Terminology Glossary

| Term | Definition |
|------|------------|
| **Branch ID** | Hierarchical identifier in format `row.lane.message.tool_sequence` |
| **Row** | Position moving down thread (1-indexed) |
| **Lane** | Branch path at a row (0 = main, 1-9 = variations) |
| **Message** | Position within a lane (0-indexed) |
| **Tool Iteration** | Sequence of tool calls (0 = none, 1+ = iterations) |
| **Main Branch** | Lane 0 (original, unmodified flow) |
| **Variation** | Lane 1-9 (prompt or model variations) |
| **Branch Point** | Row with multiple lanes (e.g., row 2 has lanes 0, 1, 2) |
| **Fork Point** | Synonym for branch point |
| **ltree** | PostgreSQL extension for hierarchical data |

---

**End of Document**

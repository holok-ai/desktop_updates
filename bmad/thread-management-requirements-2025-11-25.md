# Thread Management Requirements

**Date:** 2025-11-25
**Status:** Requirements Definition
**Purpose:** Define thread lifecycle, message branching, and conversation flows

## Executive Summary

This document defines the core thread management functionality for Holokai Desktop:
1. **Thread creation** - UUID assignment, model selection, initial prompt
2. **Conversation flow** - history as context, local + audit storage
3. **Message branching** - retry creates parallel lanes, max 2 branches per point
4. **Auto-title generation** - triggered after second exchange
5. **Copy command** - quick prompt reuse within thread

### Relationship to Existing Documents

| Document | Relationship |
|----------|--------------|
| `thread-loading-caching-requirements-2025-11-25.md` | Caching and project thread support |
| `brainstorming-session-file-storage-2025-11-25.md` | Attachment storage |
| `ai/thread-methods.md` | Base architecture |

---

## 1. Thread Creation Flow

### 1.1 Sequence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         THREAD CREATION FLOW                                 │
│                                                                              │
│  1. User selects model from dropdown                                         │
│  2. User enters prompt in input box                                          │
│  3. User presses Enter (or clicks Send)                                      │
│  4. Desktop generates UUID v4 for threadId                                   │
│  5. Desktop creates thread record (personal or project)                      │
│  6. Desktop submits to Holo API:                                             │
│     - prompt, threadId, userId, model, projectId (if project thread)        │
│  7. Holo routes to provider, streams response                                │
│  8. Holo records to audit: prompt + response + metadata                      │
│  9. Desktop displays streamed response                                       │
│  10. Desktop stores message pair locally (encrypted)                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Thread Initialization

```typescript
interface ThreadCreateRequest {
  model: string;              // e.g., "claude-3-opus", "gpt-4"
  prompt: string;             // initial user prompt
  type: 'personal' | 'project';
  projectId?: string;         // required if type='project'
}

async function createThread(request: ThreadCreateRequest): Promise<Thread> {
  // 1. Generate IDs
  const threadId = crypto.randomUUID();
  const messageId = crypto.randomUUID();

  // 2. Create thread record
  const thread: Thread = {
    id: threadId,
    title: null,              // auto-generated after 2nd exchange
    type: request.type,
    ownerId: request.type === 'personal' ? userId : request.projectId!,
    projectId: request.projectId,
    createdBy: userId,
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: {
      model: request.model
    }
  };

  // 3. Create first message
  const message: Message = {
    id: messageId,
    threadId,
    parentMessageId: null,    // first message has no parent
    branchIndex: 0,
    role: 'user',
    content: request.prompt,
    createdAt: Date.now()
  };

  // 4. Save locally
  await threadRepository.create(thread);
  await messageRepository.create(message);

  // 5. Submit to Holo API
  const response = await holoAPI.prompt({
    threadId,
    messages: [{ role: 'user', content: request.prompt }],
    model: request.model,
    projectId: request.projectId
  });

  // 6. Save response message
  const responseMessage: Message = {
    id: crypto.randomUUID(),
    threadId,
    parentMessageId: messageId,
    branchIndex: 0,
    role: 'assistant',
    content: response.content,
    createdAt: Date.now(),
    metadata: {
      model: request.model,
      provider: response.provider,
      tokens: response.usage
    }
  };

  await messageRepository.create(responseMessage);

  return thread;
}
```

### 1.3 Model Selection

- Model dropdown populated from user's available models (via Moku API)
- Last-used model remembered per thread type (personal vs project)
- Project threads may have model restrictions (configured at project level)

---

## 2. Message Data Model

### 2.1 Core Structure

```typescript
interface Message {
  id: string;                           // UUID v4
  threadId: string;                     // parent thread
  parentMessageId: string | null;       // null for first message, enables branching
  branchIndex: number;                  // 0 = original path, 1-2 = retry branches

  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  deletedAt?: number;

  // Versioning (for edits before submit)
  versions?: Array<{
    content: string;
    editedAt: number;
  }>;

  // File attachments
  attachments?: FileAttachment[];

  // Provider metadata (assistant messages)
  metadata?: {
    model?: string;
    provider?: string;
    tokens?: {
      prompt: number;
      completion: number;
      total: number;
    };
    [key: string]: unknown;
  };
}
```

### 2.2 Branching Structure

Messages form a tree structure via `parentMessageId`:

```
Message Tree Example:
─────────────────────

[M1: user] ──► [M2: assistant] ──► [M3: user] ──► [M4: assistant] ──► [M5: user] ...
    │              │                   │
    │              │                   └──► [M3a: user (retry)] ──► [M4a: assistant] ...
    │              │                   │         branchIndex: 1
    │              │                   │
    │              │                   └──► [M3b: user (retry)] ──► [M4b: assistant] ...
    │              │                             branchIndex: 2
    │              │
    parentMessageId: null   parentMessageId: M1
```

**Key Rules:**
- `parentMessageId: null` = root message (first in thread)
- `branchIndex: 0` = original conversation path
- `branchIndex: 1` = first retry branch at that point
- `branchIndex: 2` = second retry branch at that point
- Maximum 2 retry branches per divergence point (branchIndex 1 and 2)

### 2.3 Branch Constraints

```typescript
const MAX_BRANCHES_PER_POINT = 2;

function canCreateRetry(parentMessageId: string): boolean {
  const existingBranches = messages.filter(m =>
    m.parentMessageId === parentMessageId &&
    m.branchIndex > 0
  );
  return existingBranches.length < MAX_BRANCHES_PER_POINT;
}

function getNextBranchIndex(parentMessageId: string): number {
  const existingBranches = messages.filter(m =>
    m.parentMessageId === parentMessageId &&
    m.branchIndex > 0
  );
  if (existingBranches.length === 0) return 1;
  if (existingBranches.length === 1) return 2;
  throw new Error('Maximum branches reached');
}
```

---

## 3. Conversation Flow

### 3.1 Context Assembly

When submitting a prompt, Desktop assembles the conversation history following the current branch path:

```typescript
function assembleContext(threadId: string, currentMessageId: string): Message[] {
  const context: Message[] = [];
  let messageId: string | null = currentMessageId;

  // Walk backwards from current message to root
  while (messageId) {
    const message = messageRepository.get(messageId);
    if (!message) break;
    context.unshift(message);  // prepend to maintain order
    messageId = message.parentMessageId;
  }

  return context;
}

// Example: If user is on branch M4a, context is [M1, M2, M3a, M4a]
// NOT [M1, M2, M3, M4, M5] (the original path)
```

### 3.2 Prompt Submission

```typescript
async function submitPrompt(
  threadId: string,
  parentMessageId: string,
  prompt: string,
  branchIndex: number = 0
): Promise<Message> {
  // 1. Assemble context from parent path
  const context = assembleContext(threadId, parentMessageId);

  // 2. Create user message
  const userMessage: Message = {
    id: crypto.randomUUID(),
    threadId,
    parentMessageId,
    branchIndex,
    role: 'user',
    content: prompt,
    createdAt: Date.now()
  };

  await messageRepository.create(userMessage);

  // 3. Build messages array for Holo API
  const messages = [
    ...context.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: prompt }
  ];

  // 4. Submit to Holo
  const thread = await threadRepository.get(threadId);
  const response = await holoAPI.prompt({
    threadId,
    messages,
    model: thread.metadata?.model,
    projectId: thread.projectId
  });

  // 5. Save response
  const assistantMessage: Message = {
    id: crypto.randomUUID(),
    threadId,
    parentMessageId: userMessage.id,
    branchIndex,
    role: 'assistant',
    content: response.content,
    createdAt: Date.now(),
    metadata: {
      model: thread.metadata?.model,
      provider: response.provider,
      tokens: response.usage
    }
  };

  await messageRepository.create(assistantMessage);

  // 6. Trigger auto-title if needed
  await maybeGenerateTitle(threadId);

  return assistantMessage;
}
```

### 3.3 Storage Locations

| Location | Data | Purpose |
|----------|------|---------|
| **Desktop (local)** | Full messages, encrypted | Fast access, offline capability |
| **Holo Audit (PostgreSQL)** | Prompts + responses + metadata | Compliance, analytics, sharing |
| **Moku API** | Thread metadata, message refs | Project thread queries |

---

## 4. Retry Flow (Branching)

### 4.1 User Experience

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            RETRY FLOW                                        │
│                                                                              │
│  Original Thread:                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ [User: How do I implement auth?]                                     │    │
│  │ [Assistant: Here are 3 approaches...]                                │    │
│  │ [User: Tell me more about JWT]           [Retry] [Copy]              │    │
│  │ [Assistant: JWT consists of...]                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  After clicking [Retry] on "Tell me more about JWT":                        │
│  ┌────────────────────────────────┐ ┌────────────────────────────────┐     │
│  │ [User: How do I implement...   │ │                                │     │
│  │ [Assistant: Here are 3...      │ │    (Empty retry lane)          │     │
│  │ [User: Tell me more about JWT] │ │ [Prompt box with copied text]  │     │
│  │ [Assistant: JWT consists of...]│ │                                │     │
│  │ ...continues...                │ │                                │     │
│  └────────────────────────────────┘ └────────────────────────────────┘     │
│         Original Lane                      Retry Lane                       │
│                                                                              │
│  User edits prompt in retry lane, submits:                                  │
│  - Context: [M1, M2] (history UP TO the retry point)                        │
│  - NOT: [M1, M2, M3, M4, ...] (full original path)                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Retry Implementation

```typescript
interface RetryRequest {
  threadId: string;
  originalMessageId: string;   // the user message being retried
  newPrompt: string;           // edited prompt (may be same as original)
}

async function createRetry(request: RetryRequest): Promise<Message> {
  const originalMessage = await messageRepository.get(request.originalMessageId);

  if (originalMessage.role !== 'user') {
    throw new Error('Can only retry user messages');
  }

  // Get the parent of the original message (the context endpoint)
  const contextEndpoint = originalMessage.parentMessageId;

  // Check branch limit
  if (!canCreateRetry(contextEndpoint)) {
    throw new Error('Maximum retry branches reached (2)');
  }

  const branchIndex = getNextBranchIndex(contextEndpoint);

  // Submit with context up to (but not including) the original message
  return submitPrompt(
    request.threadId,
    contextEndpoint,
    request.newPrompt,
    branchIndex
  );
}
```

### 4.3 Branch Continuation

After a retry, user can continue on either branch:

```typescript
// User clicks in retry lane and types new prompt
async function continueOnBranch(
  threadId: string,
  lastMessageInBranch: string,  // the assistant response in the retry lane
  newPrompt: string
): Promise<Message> {
  const lastMessage = await messageRepository.get(lastMessageInBranch);

  // Continue with same branchIndex as the branch we're on
  return submitPrompt(
    threadId,
    lastMessageInBranch,
    newPrompt,
    lastMessage.branchIndex
  );
}
```

### 4.4 Visual Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BRANCH VISUALIZATION                                                        │
│                                                                              │
│  Single column until branch point:                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Message 1                                                            │    │
│  │ Message 2                                                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  At branch point, split into lanes:                                         │
│  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐         │
│  │ Original (idx 0)  │ │ Retry 1 (idx 1)   │ │ Retry 2 (idx 2)   │         │
│  │ Message 3         │ │ Message 3a        │ │ Message 3b        │         │
│  │ Message 4         │ │ Message 4a        │ │ (empty or...)     │         │
│  │ Message 5         │ │ ...               │ │                   │         │
│  └───────────────────┘ └───────────────────┘ └───────────────────┘         │
│                                                                              │
│  Each lane is independently scrollable                                      │
│  Active lane (where user is typing) highlighted                             │
│  Max 3 lanes visible (original + 2 retries)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Auto-Title Generation

### 5.1 Trigger Condition

Title generation is triggered after the **second prompt+response exchange** completes:

```typescript
async function maybeGenerateTitle(threadId: string): Promise<void> {
  const thread = await threadRepository.get(threadId);

  // Skip if title already exists
  if (thread.title) return;

  // Count complete exchanges (user + assistant pairs) on main branch
  const mainBranchMessages = await messageRepository.getByThread(threadId)
    .filter(m => m.branchIndex === 0);

  const exchanges = countExchanges(mainBranchMessages);

  // Trigger after 2nd exchange
  if (exchanges >= 2) {
    await generateTitle(threadId, mainBranchMessages);
  }
}

function countExchanges(messages: Message[]): number {
  let exchanges = 0;
  let expectingAssistant = false;

  for (const msg of messages) {
    if (msg.role === 'user') {
      expectingAssistant = true;
    } else if (msg.role === 'assistant' && expectingAssistant) {
      exchanges++;
      expectingAssistant = false;
    }
  }

  return exchanges;
}
```

### 5.2 Title Generation

```typescript
async function generateTitle(threadId: string, messages: Message[]): Promise<void> {
  // Take first 2 exchanges (4 messages: user, assistant, user, assistant)
  const contextMessages = messages.slice(0, 4);

  const prompt = `Based on this conversation, generate a concise title of 50 characters or less. Return ONLY the title, no quotes or explanation.

Conversation:
${contextMessages.map(m => `${m.role}: ${m.content}`).join('\n\n')}

Title:`;

  const thread = await threadRepository.get(threadId);

  const response = await holoAPI.prompt({
    threadId,
    messages: [{ role: 'user', content: prompt }],
    model: thread.metadata?.model,
    projectId: thread.projectId,
    metadata: {
      purpose: 'title_generation',
      excludeFromHistory: true  // don't add to thread history
    }
  });

  // Extract and sanitize title
  let title = response.content.trim();
  if (title.length > 50) {
    title = title.substring(0, 47) + '...';
  }

  // Update thread
  await threadRepository.update(threadId, {
    title,
    updatedAt: Date.now()
  });
}
```

### 5.3 Title Generation Rules

| Rule | Value |
|------|-------|
| Trigger | After 2nd exchange completes |
| Input | First 2 exchanges (4 messages) |
| Max length | 50 characters |
| Model | Same as thread's model |
| Audit | Marked as `excludeFromHistory: true` |
| Retry | User can manually edit title anytime |

---

## 6. Clipboard Operations

### 6.1 Clipboard Actions Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CLIPBOARD OPERATIONS                                    │
│                                                                              │
│  INTERNAL COPY (Copy button)                                                │
│  ────────────────────────────                                                │
│  • Copies prompt text to input box at end of thread                         │
│  • Does NOT use system clipboard                                            │
│  • User can edit before submitting                                          │
│                                                                              │
│  CLIPBOARD COPY (Copy Response / OS Copy)                                   │
│  ─────────────────────────────────────────                                   │
│  • Copies to system clipboard                                               │
│  • Supports plain text and markdown formats                                 │
│  • Works with selected text or full message                                 │
│                                                                              │
│  CLIPBOARD PASTE                                                             │
│  ───────────────                                                             │
│  • Paste text into prompt input                                             │
│  • Paste images as attachments (if supported)                               │
│  • Paste files as attachments                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Copy Operations

**Internal Copy (to input box):**
```typescript
// Copy button under user prompt - copies to input box
function copyPromptToInput(messageId: string): void {
  const message = messageRepository.get(messageId);

  if (message.role !== 'user') {
    throw new Error('Can only copy user prompts');
  }

  // Set the input box content
  promptInputStore.set(message.content);

  // Focus the input box
  promptInputElement.focus();
}
```

**Clipboard Copy (to system clipboard):**
```typescript
import { clipboard } from 'electron';

// Copy message content to system clipboard
async function copyToClipboard(messageId: string, format: 'text' | 'markdown' = 'text'): Promise<void> {
  const message = await messageRepository.get(messageId);

  if (format === 'markdown') {
    // Copy as markdown (preserves code blocks, etc.)
    clipboard.writeText(message.content);
  } else {
    // Copy as plain text (strip markdown formatting)
    const plainText = stripMarkdown(message.content);
    clipboard.writeText(plainText);
  }

  // Show confirmation toast
  notificationService.showToast({
    type: 'file',
    title: 'Copied',
    body: 'Message copied to clipboard'
  });
}

// Copy selected text
function copySelection(): void {
  const selection = window.getSelection()?.toString();
  if (selection) {
    clipboard.writeText(selection);
  }
}

// Copy code block specifically
function copyCodeBlock(code: string, language?: string): void {
  clipboard.writeText(code);

  notificationService.showToast({
    type: 'file',
    title: 'Code Copied',
    body: language ? `${language} code copied to clipboard` : 'Code copied to clipboard'
  });
}
```

### 6.3 Paste Operations

```typescript
// Handle paste in prompt input
async function handlePaste(event: ClipboardEvent): Promise<void> {
  const clipboardData = event.clipboardData;
  if (!clipboardData) return;

  // Check for files (images, documents)
  const files = Array.from(clipboardData.files);
  if (files.length > 0) {
    event.preventDefault();
    await handleFilePaste(files);
    return;
  }

  // Check for images from clipboard (screenshot)
  const items = Array.from(clipboardData.items);
  const imageItem = items.find(item => item.type.startsWith('image/'));
  if (imageItem) {
    event.preventDefault();
    const blob = imageItem.getAsFile();
    if (blob) {
      await handleImagePaste(blob);
    }
    return;
  }

  // Text paste - let default behavior handle it
  // (or process for special handling like URL detection)
}

// Handle pasted files
async function handleFilePaste(files: File[]): Promise<void> {
  const thread = currentThreadStore.get();
  if (!thread) return;

  for (const file of files) {
    // Validate file size and type
    if (!isValidAttachment(file)) {
      notificationService.showToast({
        type: 'error',
        title: 'Invalid File',
        body: `${file.name} cannot be attached (size or type not supported)`
      });
      continue;
    }

    // Add as pending attachment
    await addPendingAttachment(thread.id, file);
  }
}

// Handle pasted image (screenshot)
async function handleImagePaste(blob: Blob): Promise<void> {
  const thread = currentThreadStore.get();
  if (!thread) return;

  // Generate filename for pasted image
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `pasted-image-${timestamp}.png`;

  const file = new File([blob], filename, { type: blob.type });
  await addPendingAttachment(thread.id, file);

  notificationService.showToast({
    type: 'file',
    title: 'Image Added',
    body: 'Pasted image added as attachment'
  });
}
```

### 6.4 Clipboard Data Formats

```typescript
// When copying assistant responses with code
function copyWithFormats(message: Message): void {
  // Write both plain text and HTML formats
  clipboard.write({
    text: message.content,
    html: markdownToHtml(message.content)
  });
}

// Check clipboard contents
function getClipboardContents(): ClipboardContents {
  return {
    text: clipboard.readText(),
    html: clipboard.readHTML(),
    hasImage: clipboard.readImage().isEmpty() === false,
    formats: clipboard.availableFormats()
  };
}

interface ClipboardContents {
  text: string;
  html: string;
  hasImage: boolean;
  formats: string[];
}
```

### 6.5 UI Placement

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MESSAGE UI                                                                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ User                                                      12:30 PM  │    │
│  │ How do I implement authentication in a Node.js app?                 │    │
│  │                                                                      │    │
│  │                                          [Retry] [Copy]             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Assistant                                                 12:30 PM  │    │
│  │ There are several approaches to implementing authentication...      │    │
│  │                                                                      │    │
│  │  ```javascript                                                       │    │
│  │  const jwt = require('jsonwebtoken');            [Copy Code]        │    │
│  │  ```                                                                 │    │
│  │                                                                      │    │
│  │                                                    [Copy Response]  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  BUTTON LEGEND:                                                              │
│  [Retry]         - Create retry branch (user messages only)                 │
│  [Copy]          - Copy to input box (user messages only)                   │
│  [Copy Code]     - Copy code block to clipboard                             │
│  [Copy Response] - Copy full response to clipboard                          │
│                                                                              │
│  Buttons visible on hover or always visible (user preference)               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.6 Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Copy selected text | Ctrl+C | Cmd+C |
| Copy full message | Ctrl+Shift+C | Cmd+Shift+C |
| Paste | Ctrl+V | Cmd+V |
| Paste without formatting | Ctrl+Shift+V | Cmd+Shift+V |

---

## 7. Thread Navigation

### 7.1 Active Branch Tracking

```typescript
interface ThreadViewState {
  threadId: string;
  activeBranchPath: string[];   // array of messageIds representing current path
  activeLeafMessageId: string;  // last message in active branch
  expandedBranches: Set<string>; // branch points with visible retry lanes
}

// When user clicks in a branch lane, update active path
function setActiveBranch(messageId: string): void {
  const path = buildPathToRoot(messageId);
  viewState.activeBranchPath = path;
  viewState.activeLeafMessageId = messageId;
}

function buildPathToRoot(messageId: string): string[] {
  const path: string[] = [];
  let currentId: string | null = messageId;

  while (currentId) {
    path.unshift(currentId);
    const message = messageRepository.get(currentId);
    currentId = message?.parentMessageId ?? null;
  }

  return path;
}
```

### 7.2 Branch Collapse/Expand

```typescript
// User can collapse retry lanes to focus on one branch
function toggleBranchVisibility(branchPointMessageId: string): void {
  if (viewState.expandedBranches.has(branchPointMessageId)) {
    viewState.expandedBranches.delete(branchPointMessageId);
  } else {
    viewState.expandedBranches.add(branchPointMessageId);
  }
}
```

---

## 8. Implementation Checklist

### 8.1 Data Model Updates

- [ ] Add `parentMessageId` to Message interface
- [ ] Add `branchIndex` to Message interface
- [ ] Update message repository for tree queries
- [ ] Add thread title generation flag/timestamp

### 8.2 Core Functions

- [ ] `createThread()` - thread initialization flow
- [ ] `submitPrompt()` - context assembly and submission
- [ ] `createRetry()` - branch creation with limit check
- [ ] `assembleContext()` - walk tree to build history
- [ ] `generateTitle()` - auto-title after 2nd exchange
- [ ] `copyPromptToInput()` - internal copy command

### 8.3 UI Components

- [ ] Branch lane visualization
- [ ] Retry button on user messages
- [ ] Copy button on user messages
- [ ] Copy Response button on assistant messages
- [ ] Copy Code button on code blocks
- [ ] Branch collapse/expand controls
- [ ] Active branch highlighting
- [ ] Model selector dropdown

### 8.4 Clipboard Operations

- [ ] `copyToClipboard()` - copy message to system clipboard
- [ ] `copyCodeBlock()` - copy code block to clipboard
- [ ] `handlePaste()` - paste text into input
- [ ] `handleFilePaste()` - paste files as attachments
- [ ] `handleImagePaste()` - paste screenshots as attachments
- [ ] Clipboard format support (text, HTML, markdown)
- [ ] Keyboard shortcuts (Ctrl/Cmd+C, Ctrl/Cmd+V, etc.)

### 8.5 API Integration

- [ ] Holo API prompt submission with context
- [ ] Audit exclusion for title generation calls
- [ ] Moku API for available models

---

## 9. Key Decisions Summary

| Decision | Value |
|----------|-------|
| Thread ID generation | UUID v4, generated by Desktop |
| Message tree structure | `parentMessageId` links |
| Max retry branches | 2 per divergence point |
| Branch index values | 0 = original, 1 = first retry, 2 = second retry |
| Retry context | History up to branch point (not full thread) |
| Auto-title trigger | After 2nd exchange |
| Auto-title max length | 50 characters |
| Auto-title input | First 2 exchanges (4 messages) |
| Copy button behavior | Internal copy to input box |
| Copy Response behavior | System clipboard (text/markdown) |
| Copy Code behavior | System clipboard (plain text) |
| Paste images | Convert to attachment |
| Paste files | Add as pending attachment |

---

_Thread management requirements defined - 2025-11-25_

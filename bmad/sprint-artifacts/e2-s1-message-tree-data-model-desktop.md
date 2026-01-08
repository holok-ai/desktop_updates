# Story 2.1: Message Tree Data Model (Desktop)

Status: ready-for-dev

## Story

As a desktop developer,
I want to update the message model to support parent-child relationships,
so that messages can form a tree structure for branching conversations.

## Acceptance Criteria

1. Messages form valid tree via parentMessageId (TM §2.1)
2. Context assembly follows correct branch path by walking up tree (TM §2.3)
3. Branch limit (max 9 variations = branchIndex 0-9) enforced locally before API call (TM §2.2)
4. MessageRepository queries support tree operations (get by parent, get branches)
5. Root messages have parentMessageId = null
6. assembleContext() returns ordered array from root to current message

## Tasks / Subtasks

- [ ] Update Message interface with tree fields (AC: #1, #5)
  - [ ] Add to src/types/message.ts: parentMessageId: string | null, branchIndex: 0-9 (number)
  - [ ] Update MessageDTO interface to match
  - [ ] Update message creation/parsing functions

- [ ] Update MessageRepository for tree queries (AC: #4)
  - [ ] Add getMessagesByParentId(parentId): Get children of specific message
  - [ ] Add getBranchesForMessage(messageId): Get all branches (different branchIndex) for same parent
  - [ ] Add getRootMessages(threadId): Get messages with parentMessageId = null
  - [ ] Update getMessagesForThread() to include branch info

- [ ] Implement assembleContext() for branch path (AC: #2, #6)
  - [ ] Create src/utils/contextAssembler.ts
  - [ ] Walk up tree from current message via parentMessageId links
  - [ ] Collect messages in array
  - [ ] Reverse array for root-to-current order
  - [ ] Return ordered array for LLM context

- [ ] Implement getNextBranchIndex() with limit check (AC: #3)
  - [ ] Query existing branches for given parentMessageId
  - [ ] Find max branchIndex currently used (0-9)
  - [ ] Return next index if < 9
  - [ ] Throw error "Maximum variation branches reached (max: 9)" if at limit
  - [ ] Use for client-side validation before API call

- [ ] Update cache support for branched messages (AC: #1)
  - [ ] Update ThreadCache to store tree structure
  - [ ] Invalidate branch cache when new branch created
  - [ ] Cache assembleContext() results for performance

## Dev Notes

**Architecture Overview:**

Desktop does NOT use a local database. All data is stored in Moku through the Moku API. The branching architecture uses three tables:

1. **llm_requests**: Stores all user prompts sent to LLMs
2. **llm_responses**: Stores all LLM responses (auto-joined via request_id)
3. **desktop_messages**: Provides branch structure metadata ONLY for branched conversations

**Key Concepts:**
- Linear conversations (no branches) do NOT create desktop_messages records
- desktop_messages ONLY tracks user requests that are part of branches
- Content is never duplicated - desktop_messages references llm_requests via `request_id`
- Branch structure is identified by `branch_point_request_id` (where branches diverge)

**desktop_messages Fields:**
- `id`: Unique identifier (generated)
- `request_id`: Links to llm_requests.id for THIS message's content
- `branch_point_request_id`: Links to llm_requests.id where branches diverge
- `parent_message_id`: Links to previous desktop_messages.id in chain (null for first in branch)
- `branch_index`: Distinguishes sibling branches (0-10)

**Example Conversation with Branching:**

```
Linear messages (no desktop_messages needed):
Message 0: "What is TypeScript?" (llm_request: req0)
  └─ Response 0 (llm_response for req0) ← auto-linked

Message 1: "Tell me more" (llm_request: req1)
  └─ Response 1 (llm_response for req1) ← auto-linked

(USER CREATES BRANCH - two variations of next prompt)

Branch 0:
Message 2a: "How about examples?" (llm_request: req2a)
  desktop_messages:
    id=dm_abc,
    request_id=req2a,
    branch_point_request_id=req1, ← where branches diverge
    parent_message_id=null, ← first in branch
    branch_index=0
  └─ Response 2a (llm_response for req2a) ← auto-linked

Message 3a: "More details?" (llm_request: req3a)
  desktop_messages:
    id=dm_def,
    request_id=req3a,
    branch_point_request_id=req1, ← same divergence point
    parent_message_id=dm_abc, ← chains to previous
    branch_index=0

Branch 1 (sibling of Branch 0):
Message 2b: "Explain with code" (llm_request: req2b)
  desktop_messages:
    id=dm_ghi,
    request_id=req2b,
    branch_point_request_id=req1, ← same divergence point
    parent_message_id=null, ← first in branch
    branch_index=1
  └─ Response 2b (llm_response for req2b) ← auto-linked
```

**API Call Sequence for Linear Conversation:**

```typescript
// 1. User types prompt in Desktop UI

// 2. Desktop assembles context from previous messages
const context = await assembleContext(threadId, lastMessageId);

// 3. Desktop → Moku API: Send chat request
const response = await mokuApi.post('/api/chat/completions', {
  threadId: threadId,
  model: 'claude-sonnet-4',
  messages: [
    ...context,
    { role: 'user', content: userPrompt }
  ]
});

// 4. Moku API automatically:
//    - Creates llm_request record (with threadId)
//    - Calls Claude API
//    - Creates llm_response record (linked via request_id)
//    - Returns response

// 5. NO desktop_messages records created (linear conversation)

// 6. Desktop displays response in UI
```

**API Call Sequence for Creating a Branch:**

```typescript
// User clicks "Create variation" on Message 1 (req1)

// 1. Desktop retrieves existing branches at this point
const existingBranches = await mokuApi.get(
  `/api/threads/${threadId}/branches?branch_point=${req1}`
);
const nextBranchIndex = existingBranches.length; // e.g., 0 or 1

// 2. Desktop → Moku API: Create branch request
const branchResponse = await mokuApi.post('/api/chat/completions', {
  threadId: threadId,
  model: 'claude-sonnet-4',
  messages: [...context, { role: 'user', content: variationPrompt }],
  // Branch metadata
  branchPointRequestId: req1,
  branchIndex: nextBranchIndex
});

// 3. Moku API:
//    - Creates llm_request (id=req2a)
//    - Calls Claude API
//    - Creates llm_response
//    - Creates desktop_messages record:
//      {
//        id: generated UUID,
//        request_id: req2a,
//        branch_point_request_id: req1,
//        parent_message_id: null,
//        branch_index: nextBranchIndex
//      }
//    - Returns response

// 4. Desktop updates UI to show branch indicator
```

**API Call Sequence for Continuing in a Branch:**

```typescript
// User types next message in Branch 0

// 1. Desktop identifies current branch context
const currentBranch = desktop_messages.find(dm => dm.id === currentBranchId);
// currentBranch.request_id = req2a
// currentBranch.branch_point_request_id = req1

// 2. Desktop → Moku API: Continue branch
const response = await mokuApi.post('/api/chat/completions', {
  threadId: threadId,
  model: 'claude-sonnet-4',
  messages: [...branchContext, { role: 'user', content: nextPrompt }],
  // Continue in same branch
  branchPointRequestId: req1,
  branchIndex: 0,
  parentBranchMessageId: currentBranch.id
});

// 3. Moku API:
//    - Creates llm_request (id=req3a)
//    - Calls Claude API
//    - Creates llm_response
//    - Creates desktop_messages record:
//      {
//        id: generated UUID,
//        request_id: req3a,
//        branch_point_request_id: req1,
//        parent_message_id: currentBranch.id, ← chains to previous
//        branch_index: 0
//      }
```

**Tree Structure (for desktop_messages):**
- First message in branch: parent_message_id = null, branch_index = 0-10
- Continuation messages: parent_message_id = previous desktop_messages.id, same branch_index
- All messages in branch: same branch_point_request_id

**Context Assembly Algorithm:**

The desktop must assemble context by:
1. Loading all llm_requests for the thread
2. If in a branch, loading desktop_messages for branch structure
3. Walking the branch chain via parent_message_id
4. Retrieving llm_requests via desktop_messages.request_id
5. Building ordered array from conversation start to current message

```typescript
function assembleContext(threadId: string, currentBranchMessageId: string | null): Message[] {
  // 1. Load all llm_requests for thread
  const allRequests = await mokuApi.get(`/api/threads/${threadId}/requests`);

  // 2. If no branch, return linear conversation
  if (!currentBranchMessageId) {
    return allRequests.map(req => ({
      role: 'user',
      content: req.prompt,
      response: req.response // auto-joined from llm_responses
    }));
  }

  // 3. Load branch structure
  const branchMessages = await mokuApi.get(
    `/api/threads/${threadId}/branch-messages`
  );

  // 4. Walk branch chain
  const branchChain: string[] = [];
  let current = branchMessages.find(dm => dm.id === currentBranchMessageId);

  while (current) {
    branchChain.unshift(current.request_id); // Add to front
    if (current.parent_message_id) {
      current = branchMessages.find(dm => dm.id === current.parent_message_id);
    } else {
      // Reached first message in branch, add branch_point
      branchChain.unshift(current.branch_point_request_id);
      current = null;
    }
  }

  // 5. Build context from request chain
  return branchChain.map(reqId => {
    const req = allRequests.find(r => r.id === reqId);
    return {
      role: 'user',
      content: req.prompt,
      response: req.response
    };
  });
}
```

**Dependencies:**
- E1-S3: Backend Message API with branching support

**File Locations:**
- src/types/message.ts
- src/repositories/message.repository.ts (or in ThreadRepository)
- src/utils/contextAssembler.ts

### References

- [Source: docs/epics-and-stories-2025-11-25.md §E2-S1]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e2-s1-message-tree-data-model-desktop.context.xml

### Agent Model Used

<!-- To be filled by dev agent during implementation -->

### Debug Log References

<!-- To be filled by dev agent during implementation -->

### Completion Notes List

<!-- To be filled by dev agent during implementation -->

### File List

<!-- To be filled by dev agent during implementation -->

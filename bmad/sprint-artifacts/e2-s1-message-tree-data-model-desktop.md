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

**Tree Structure:**
- Root messages: parentMessageId = null, branchIndex = 0
- Child messages: parentMessageId = parent UUID, branchIndex = 0-9
- Branch siblings: same parentMessageId, different branchIndex (max 10 branches per parent)

**Context Assembly Algorithm:**
```typescript
function assembleContext(messageId: string): Message[] {
  const path: Message[] = [];
  let current = getMessage(messageId);

  while (current) {
    path.unshift(current); // Add to front
    current = current.parentMessageId ? getMessage(current.parentMessageId) : null;
  }

  return path; // [root, ..., current]
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

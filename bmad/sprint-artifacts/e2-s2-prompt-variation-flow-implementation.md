# Story 2.2: Prompt Variation Flow Implementation

Status: ready-for-dev

## Story

As a user,
I want to create variations of my prompts with modifications,
so that I can refine responses without losing conversation context.

## Acceptance Criteria

1. "Create Variation" button visible on user messages only (not assistant) (TM §3.1)
2. Clicking "Create Variation" opens input with original prompt pre-filled (TM §3.1)
3. Original attachments shown as editable chips (ARCH §3.2)
4. User can remove/add attachments before submitting (ARCH §3.2)
5. Kept attachments use shared fileId references, not copies (ARCH §3.2)
6. User can edit prompt text before submitting (TM §3.1)
7. Clear error message when branch limit reached (TM §3.3)
8. Prompt variation creates new message with correct parentMessageId and branchIndex

## Tasks / Subtasks

- [ ] Add "Create Variation" button to user messages
  - [ ] Create PromptVariationButton.svelte component
  - [ ] Show only on role='user' messages
  - [ ] Position in message action bar (hover reveal)
  - [ ] Disable if branch limit reached, show tooltip

- [ ] Implement prompt variation modal/input
  - [ ] Pre-populate input with original message content
  - [ ] Focus and select all text
  - [ ] Show "Create Variation" button label
  - [ ] Copy attachment references to input

- [ ] Handle attachment management
  - [ ] Display attachments as editable chips
  - [ ] Add X button to remove attachments
  - [ ] Enable file picker for new attachments
  - [ ] Maintain shared fileId references (no duplication)

- [ ] Implement createPromptVariation() in ThreadService
  - [ ] Calculate next branchIndex via getNextBranchIndex()
  - [ ] Set parentMessageId to parent of original message
  - [ ] Generate client_message_id for idempotency
  - [ ] Submit to API with modified content/attachments

- [ ] Handle errors gracefully
  - [ ] Catch "Maximum variation branches reached" error
  - [ ] Show toast with user-friendly message
  - [ ] Keep modal open to preserve edits

## Dev Notes

**Prompt Variation Logic:**
```typescript
// Original message: {id: 'msg-2', parentMessageId: 'msg-1', branchIndex: 0}
// Prompt variation creates: {id: 'msg-3', parentMessageId: 'msg-1', branchIndex: 1}
```

**Dependencies:** E2-S1 (tree data model), E1-S3 (backend branching API)

**Files:** src/components/PromptVariationButton.svelte, src/services/ThreadService.ts

### References
- [Source: docs/epics-and-stories-2025-11-25.md §E2-S2]

## Dev Agent Record
### Context Reference
- [Story Context XML](e2-s2-prompt-variation-flow-implementation.context.xml)
### Agent Model Used
<!-- To be filled during implementation -->
### Debug Log References
<!-- To be filled during implementation -->
### Completion Notes List
<!-- To be filled during implementation -->
### File List
<!-- To be filled during implementation -->

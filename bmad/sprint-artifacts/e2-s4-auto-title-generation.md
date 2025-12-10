# Story 2.4: Auto-Title Generation

Status: ready-for-dev

## Story

As a user,
I want threads to automatically generate meaningful titles,
so that I can easily identify conversations in the thread list.

## Acceptance Criteria

1. Title generated after 2nd assistant response (4 messages total on main branch) (TM §4.1)
2. Title max 50 characters, truncated with ellipsis if longer (TM §4.2)
3. Title editable by user after generation (TM §4.3)
4. No duplicate generation calls for same thread (TM §4.1)
5. Skip if title already exists (manually set or previously generated)
6. Uses thread's configured model for generation
7. Generation happens asynchronously without blocking UI

## Tasks / Subtasks

- [ ] Detect 2nd exchange completion trigger (AC: #1, #4, #5)
  - [ ] Listen for new message events in ThreadService
  - [ ] Count messages on main branch (branchIndex = 0 only)
  - [ ] Check for pattern: user → assistant → user → assistant
  - [ ] Verify thread.title is null or empty
  - [ ] Set flag to prevent duplicate triggers: `titleGenerationTriggered: true`
  - [ ] Store flag in thread metadata

- [ ] Generate title using LLM (AC: #2, #6, #7)
  - [ ] Create `src/services/TitleGenerationService.ts`
  - [ ] Build title generation prompt:
    ```
    System: Generate a concise title (max 50 chars) for this conversation.
    Context: [first 2 exchanges]
    Instructions: Return only the title, no quotes or explanations.
    ```
  - [ ] Call LLM via thread's configured model (thread.modelConfig)
  - [ ] Parse response: strip quotes, trim whitespace
  - [ ] Truncate to 50 characters, add "..." if truncated
  - [ ] Handle generation errors: log error, use fallback "Untitled Thread"
  - [ ] Run async, don't block user interaction

- [ ] Update thread title in UI and backend (AC: #1, #7)
  - [ ] Call MokuAPI: PATCH /api/threads/{id} with {title: generatedTitle}
  - [ ] Update threadStore with new title
  - [ ] Update ThreadRepository cache
  - [ ] Refresh thread list sidebar
  - [ ] Show subtle toast: "Thread title generated"

- [ ] Implement manual title editing (AC: #3)
  - [ ] Make title clickable in thread header
  - [ ] Show inline text input on click
  - [ ] Pre-fill with current title
  - [ ] Focus input, select all text
  - [ ] Save on Enter key or blur event
  - [ ] Cancel on Escape key (revert to original)
  - [ ] Call API to update title
  - [ ] Show validation error if title > 200 chars

- [ ] Add title generation settings (AC: #6)
  - [ ] Add setting: "Auto-generate thread titles" toggle (default: true)
  - [ ] Check setting before triggering generation
  - [ ] Persist in StateStore

- [ ] Handle edge cases (AC: #4, #5, #7)
  - [ ] Skip if thread already has title
  - [ ] Skip if auto-generation disabled in settings
  - [ ] Skip if model doesn't support title generation (fallback to "Untitled")
  - [ ] Handle API errors gracefully (don't break thread)
  - [ ] Retry once on network failure

## Dev Notes

### Architecture Patterns and Constraints

**Trigger Logic:**
```typescript
// After receiving new message
if (
  thread.title === null &&
  !thread.titleGenerationTriggered &&
  getMainBranchMessageCount(thread.id) === 4 &&
  settings.autoGenerateTitles
) {
  generateTitleAsync(thread.id);
  thread.titleGenerationTriggered = true;
}
```

**Title Generation Prompt:**
```
System: You are a helpful assistant that generates concise conversation titles.

Context:
User: [first user message]
Assistant: [first assistant response]
User: [second user message]
Assistant: [second assistant response]

Generate a title for this conversation. Requirements:
- Maximum 50 characters
- Descriptive and specific
- No quotes or punctuation at the end
- Return only the title, nothing else

Title:
```

**Async Execution:**
- Run in background worker/promise
- Don't block UI or message sending
- Update UI when complete via store update

### Project Structure Notes

**File Locations:**
- `src/services/TitleGenerationService.ts` - Title generation logic
- `src/components/ThreadHeader.svelte` - Title display and editing
- `src/components/EditableTitle.svelte` - Inline title editor
- `src/stores/threadStore.ts` - Title updates

**API Integration:**
- PATCH /api/threads/{id} with {title: string}
- Uses MokuAPIClient for HTTP calls

### Testing Framework

**Unit Tests:**
- TitleGenerationService.generateTitle() with mock LLM responses
- Truncation logic (50 char limit)
- Trigger detection (4 messages on main branch)

**Integration Tests:**
- Full flow: 4 messages → title generated → UI updated
- Manual title editing saves correctly
- Skip generation if title exists

**E2E Tests:**
- Send 4 messages, verify title appears in sidebar
- Click title, edit, save, verify update
- Disable auto-generation setting, verify no title generated

### References

- [Source: docs/epics-and-stories-2025-11-25.md §E2-S4]

### Learnings from Previous Stories

**From E2-S1:**
- Message counting on main branch (branchIndex = 0)
- Thread metadata storage

**From E2-S2:**
- Async operations without blocking UI

## Dev Agent Record

### Context Reference
- [Story Context XML](e2-s4-auto-title-generation.context.xml)

### Agent Model Used

<!-- To be filled by dev agent during implementation -->

### Debug Log References

<!-- To be filled by dev agent during implementation -->

### Completion Notes List

<!-- To be filled by dev agent during implementation -->

### File List

<!-- To be filled by dev agent during implementation -->

# Annotation System Integration Checklist

Use this checklist to ensure proper integration of the annotation system into ChatPane.

## Pre-Integration (5 minutes)

### Understanding Phase

- [ ] Read `annotations-summary.md` for overview
- [ ] Read `annotations-integration.md` for detailed steps
- [ ] Review `annotations-quick-reference.md` for API reference
- [ ] Understand current ChatPane.svelte structure
- [ ] Identify where messages are rendered

**Key Question:** Where in ChatPane is `{m.content}` rendered?

---

## Phase 1: Setup (15 minutes)

### 1.1 Add Imports

```typescript
// File: src/lib/components/ChatPane.svelte
```

- [ ] Import all 7 annotation components

  ```typescript
  import TextSelectionHandler from '$lib/components/TextSelectionHandler.svelte';
  import HighlightRenderer from '$lib/components/HighlightRenderer.svelte';
  import SelectionPopup from '$lib/components/SelectionPopup.svelte';
  import CommentInputModal from '$lib/components/CommentInputModal.svelte';
  import CommentDisplay from '$lib/components/CommentDisplay.svelte';
  import AnnotationNavigator from '$lib/components/AnnotationNavigator.svelte';
  import AnnotationSidebar from '$lib/components/AnnotationSidebar.svelte';
  ```

- [ ] Import annotation service

  ```typescript
  import { annotationService } from '$lib/services/annotation.service';
  ```

- [ ] Import annotation store

  ```typescript
  import {
    loadAnnotationsForThread,
    getAnnotationsForMessage,
    getAnnotationsForThread,
    selectedAnnotationId,
    annotationCreationState,
    initializeAnnotationListeners,
  } from '$lib/stores/annotation.store';
  ```

- [ ] Import types
  ```typescript
  import type { Annotation, HighlightRange } from '../../../src-shared/types/annotation.types';
  ```

### 1.2 Add State Variables

- [ ] Add UI state variables

  ```typescript
  let showAnnotationSidebar = $state(false);
  let selectionPopupVisible = $state(false);
  let selectionPopupPosition = $state({ x: 0, y: 0 });
  let commentModalVisible = $state(false);
  let commentModalSubmitting = $state(false);
  let currentAnnotationIndex = $state(0);
  ```

- [ ] Add cleanup reference
  ```typescript
  let cleanupAnnotationListeners: (() => void) | null = null;
  ```

### 1.3 Verify Compilation

- [ ] Run `npm run dev`
- [ ] Check for import errors
- [ ] Fix any TypeScript errors

**Checkpoint:** App should compile without errors.

---

## Phase 2: Initialize Listeners (10 minutes)

### 2.1 Add Initialization Logic

- [ ] Find or create `onMount` hook in ChatPane
- [ ] Add annotation listener initialization

  ```typescript
  onMount(() => {
    // Initialize annotation event listeners
    cleanupAnnotationListeners = initializeAnnotationListeners();

    return () => {
      cleanupAnnotationListeners?.();
    };
  });
  ```

### 2.2 Add Thread Change Effect

- [ ] Add effect to load annotations when thread changes
  ```typescript
  $effect(() => {
    if (currentThread?.id) {
      loadAnnotationsForThread(currentThread.id);
    }
  });
  ```

### 2.3 Test Listeners

- [ ] Add console.log to verify listeners work
- [ ] Create test annotation (via IPC in devtools)
- [ ] Verify event fires

**Checkpoint:** Listeners initialized and responding to events.

---

## Phase 3: Replace Message Rendering (30 minutes)

### 3.1 Locate Message Content

- [ ] Find where `{m.content}` is rendered
- [ ] Note the parent element and any existing classes
- [ ] Check if there's conditional rendering for user vs assistant

### 3.2 Implement Conditional Rendering

- [ ] Replace simple `<div>{m.content}</div>` with conditional:
  ```svelte
  {#if m.role === 'assistant'}
    <!-- Assistant messages support annotations -->
    <TextSelectionHandler
      messageId={m.id}
      messageContent={m.content}
      enabled={!editingMessageId}
      onTextSelected={(data) => {
        annotationCreationState.set({
          messageId: data.messageId,
          range: data.range,
          isCreating: true,
        });
        selectionPopupPosition = data.position;
        selectionPopupVisible = true;
      }}
      onSelectionCleared={() => {
        selectionPopupVisible = false;
      }}
    >
      {#snippet children()}
        <HighlightRenderer
          content={m.content}
          annotations={$getAnnotationsForMessage(m.id)}
          selectedAnnotationId={$selectedAnnotationId}
          onHighlightClick={(annotation) => {
            selectedAnnotationId.set(annotation.id);
            showAnnotationSidebar = true;
          }}
        />
      {/snippet}
    </TextSelectionHandler>
  {:else}
    <!-- User messages remain simple -->
    <div class="message-content">{m.content}</div>
  {/if}
  ```

### 3.3 Preserve Styling

- [ ] Ensure existing message styling still applies
- [ ] Check that attachments still render correctly
- [ ] Verify timestamps and metadata display properly

### 3.4 Test Message Rendering

- [ ] View thread with multiple messages
- [ ] Verify user messages render normally
- [ ] Verify assistant messages render with HighlightRenderer
- [ ] Check that messages without annotations render correctly

**Checkpoint:** Messages render correctly with new components.

---

## Phase 4: Add Popups and Modals (20 minutes)

### 4.1 Add SelectionPopup

- [ ] Find appropriate location (after messages loop, before closing tags)
- [ ] Add SelectionPopup component:
  ```svelte
  <SelectionPopup
    visible={selectionPopupVisible}
    position={selectionPopupPosition}
    onAddComment={() => {
      selectionPopupVisible = false;
      commentModalVisible = true;
    }}
    onDismiss={() => {
      selectionPopupVisible = false;
      annotationCreationState.set({
        messageId: null,
        range: null,
        isCreating: false,
      });
    }}
  />
  ```

### 4.2 Add CommentInputModal

- [ ] Add CommentInputModal component:

  ```svelte
  <CommentInputModal
    visible={commentModalVisible}
    selectedText={$annotationCreationState.range?.text || ''}
    submitting={commentModalSubmitting}
    onSubmit={async (commentText) => {
      const state = $annotationCreationState;
      if (!currentThread || !state.messageId || !state.range) return;

      commentModalSubmitting = true;

      const result = await annotationService.createAnnotation({
        messageId: state.messageId,
        threadId: currentThread.id,
        range: state.range,
        commentText,
        style: 'default',
      });

      commentModalSubmitting = false;

      if (result.success) {
        commentModalVisible = false;
        annotationCreationState.set({
          messageId: null,
          range: null,
          isCreating: false,
        });
        // Show success toast if available
      } else {
        // Show error toast
        console.error('Failed to add comment:', result.error);
      }
    }}
    onCancel={() => {
      commentModalVisible = false;
      annotationCreationState.set({
        messageId: null,
        range: null,
        isCreating: false,
      });
    }}
  />
  ```

### 4.3 Test Annotation Creation Flow

- [ ] Select text in assistant message
- [ ] Verify popup appears near selection
- [ ] Click "Add Comment"
- [ ] Verify modal opens
- [ ] Type comment and submit
- [ ] Verify annotation created
- [ ] Verify highlight appears in message

**Checkpoint:** Can create annotations end-to-end.

---

## Phase 5: Add Navigation (25 minutes)

### 5.1 Add AnnotationNavigator

- [ ] Add navigator component:
  ```svelte
  {#if currentThread}
    {@const threadAnnotations = $getAnnotationsForThread(currentThread.id)}
    {#if threadAnnotations.length > 0}
      <AnnotationNavigator
        annotations={threadAnnotations}
        currentIndex={currentAnnotationIndex}
        onNavigateNext={() => {
          if (currentAnnotationIndex < threadAnnotations.length - 1) {
            currentAnnotationIndex++;
            selectedAnnotationId.set(threadAnnotations[currentAnnotationIndex].id);
            scrollToAnnotation(threadAnnotations[currentAnnotationIndex]);
          }
        }}
        onNavigatePrevious={() => {
          if (currentAnnotationIndex > 0) {
            currentAnnotationIndex--;
            selectedAnnotationId.set(threadAnnotations[currentAnnotationIndex].id);
            scrollToAnnotation(threadAnnotations[currentAnnotationIndex]);
          }
        }}
        onClose={() => {
          selectedAnnotationId.set(null);
          currentAnnotationIndex = 0;
        }}
      />
    {/if}
  {/if}
  ```

### 5.2 Implement scrollToAnnotation Helper

- [ ] Add helper function:

  ```typescript
  function scrollToAnnotation(annotation: Annotation): void {
    const highlightEl = document.querySelector(`[data-annotation-id="${annotation.id}"]`);

    if (highlightEl) {
      highlightEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }
  ```

### 5.3 Test Navigation

- [ ] Create 3+ annotations in a thread
- [ ] Verify navigator appears
- [ ] Click "Next" button
- [ ] Verify page scrolls to next annotation
- [ ] Try "Previous" button
- [ ] Test keyboard shortcuts (←/→, K/J)
- [ ] Verify counter updates correctly

**Checkpoint:** Navigation works smoothly.

---

## Phase 6: Add Sidebar (20 minutes)

### 6.1 Add AnnotationSidebar

- [ ] Add sidebar component:
  ```svelte
  {#if currentThread}
    <AnnotationSidebar
      visible={showAnnotationSidebar}
      annotations={$getAnnotationsForThread(currentThread.id)}
      currentUserId={currentUser?.id}
      onClose={() => {
        showAnnotationSidebar = false;
      }}
      onAnnotationClick={(annotation) => {
        selectedAnnotationId.set(annotation.id);
        const threadAnnotations = $getAnnotationsForThread(currentThread.id);
        currentAnnotationIndex = threadAnnotations.findIndex((a) => a.id === annotation.id);
        scrollToAnnotation(annotation);
      }}
      onAddReply={async (annotationId, parentCommentId) => {
        // Implement reply logic
        const comment = prompt('Enter your reply:');
        if (comment) {
          await annotationService.addComment({
            annotationId,
            text: comment,
            replyTo: parentCommentId,
          });
        }
      }}
      onEditComment={async (annotationId, commentId, currentText) => {
        const newText = prompt('Edit comment:', currentText);
        if (newText && newText !== currentText) {
          await annotationService.updateComment({
            annotationId,
            commentId,
            text: newText,
          });
        }
      }}
      onDeleteComment={async (annotationId, commentId) => {
        if (confirm('Delete this comment?')) {
          await annotationService.deleteComment({
            annotationId,
            commentId,
          });
        }
      }}
      onDeleteAnnotation={async (annotationId) => {
        if (confirm('Delete this annotation and all its comments?')) {
          await annotationService.deleteAnnotation(annotationId);
        }
      }}
    />
  {/if}
  ```

### 6.2 Add Sidebar Toggle Button (Optional)

- [ ] Find toolbar in ChatPane
- [ ] Add button to toggle sidebar:
  ```svelte
  <button
    class="icon-button"
    onclick={() => {
      showAnnotationSidebar = !showAnnotationSidebar;
    }}
    aria-label="Toggle annotations sidebar"
    title="Annotations"
  >
    💬
    {#if $getAnnotationsForThread(currentThread?.id || '').length > 0}
      <span class="badge">
        {$getAnnotationsForThread(currentThread?.id || '').length}
      </span>
    {/if}
  </button>
  ```

### 6.3 Test Sidebar

- [ ] Click sidebar toggle button
- [ ] Verify sidebar slides in from right
- [ ] Verify all annotations listed
- [ ] Click an annotation in sidebar
- [ ] Verify page scrolls to that annotation
- [ ] Test reply, edit, delete actions
- [ ] Test close button and backdrop click

**Checkpoint:** Sidebar fully functional.

---

## Phase 7: Styling and Polish (30 minutes)

### 7.1 Adjust CSS

- [ ] Ensure highlights don't break message layout
- [ ] Check z-index for popups and modals
- [ ] Verify sidebar doesn't overlap important UI
- [ ] Test responsive design (mobile/tablet)
- [ ] Check dark/light theme compatibility

### 7.2 Add Animations

- [ ] Verify smooth transitions for popups
- [ ] Check modal fade-in/out animations
- [ ] Test sidebar slide animation
- [ ] Ensure no janky scrolling

### 7.3 Add Loading States

- [ ] Show spinner while creating annotation
- [ ] Disable buttons during async operations
- [ ] Add optimistic updates where appropriate

### 7.4 Error Handling

- [ ] Test error scenarios (network failure, etc.)
- [ ] Add user-friendly error messages
- [ ] Implement retry logic if needed

**Checkpoint:** UI polished and professional.

---

## Phase 8: Testing (45 minutes)

### 8.1 Happy Path Testing

- [ ] Create annotation
- [ ] View highlight
- [ ] Click highlight
- [ ] Navigate with keyboard
- [ ] Open sidebar
- [ ] Reply to comment
- [ ] Edit comment
- [ ] Delete comment
- [ ] Delete annotation

### 8.2 Edge Case Testing

- [ ] Very long selection (1000+ chars)
- [ ] Empty thread (no annotations)
- [ ] Thread with 100+ annotations
- [ ] Special characters in comments
- [ ] Emoji in selected text
- [ ] Rapid navigation (spam Next button)
- [ ] Multiple windows open (sync test)

### 8.3 Accessibility Testing

- [ ] Navigate with Tab key only
- [ ] Test with screen reader
- [ ] Verify focus indicators visible
- [ ] Check color contrast
- [ ] Test keyboard shortcuts

### 8.4 Performance Testing

- [ ] Load thread with 100+ annotations
- [ ] Measure render time (should be < 300ms)
- [ ] Test navigation speed
- [ ] Check memory usage

### 8.5 Regression Testing

- [ ] Verify existing ChatPane features still work
- [ ] Check thread loading
- [ ] Test message sending
- [ ] Verify attachments work
- [ ] Test thread switching

**Checkpoint:** All tests passing.

---

## Phase 9: Final Checks (15 minutes)

### 9.1 Code Quality

- [ ] Run linter: `npm run lint`
- [ ] Fix any warnings
- [ ] Run TypeScript check: `npm run type-check`
- [ ] Ensure no console.logs left in code

### 9.2 Documentation

- [ ] Add inline comments for complex logic
- [ ] Update ChatPane component documentation
- [ ] Note any gotchas or special considerations

### 9.3 Commit Preparation

- [ ] Stage changes: `git add src/lib/components/ChatPane.svelte`
- [ ] Review diff carefully
- [ ] Write clear commit message

**Checkpoint:** Ready to commit.

---

## Phase 10: Integration Complete (5 minutes)

### 10.1 Final Verification

- [ ] Restart dev server
- [ ] Load app fresh
- [ ] Do one complete annotation flow
- [ ] Verify persistence (restart app, annotations still there)

### 10.2 Commit

- [ ] Commit changes with message:

  ```
  feat: Integrate annotation system into ChatPane

  - Added text selection and highlight rendering
  - Implemented comment creation and display
  - Added navigation controls and sidebar
  - Full keyboard and accessibility support

  Closes #106
  ```

### 10.3 Documentation

- [ ] Update CHANGELOG.md
- [ ] Add entry to release notes
- [ ] Update user-facing documentation if needed

**Checkpoint:** Integration complete! 🎉

---

## Total Estimated Time

- **Pre-Integration:** 5 minutes
- **Phase 1 (Setup):** 15 minutes
- **Phase 2 (Listeners):** 10 minutes
- **Phase 3 (Rendering):** 30 minutes
- **Phase 4 (Popups):** 20 minutes
- **Phase 5 (Navigation):** 25 minutes
- **Phase 6 (Sidebar):** 20 minutes
- **Phase 7 (Polish):** 30 minutes
- **Phase 8 (Testing):** 45 minutes
- **Phase 9 (Final):** 15 minutes
- **Phase 10 (Complete):** 5 minutes

**Total:** ~3.5 hours

---

## Troubleshooting

### Issue: Highlights not appearing

**Solution:** Check that `loadAnnotationsForThread` is called when thread loads.

### Issue: Popup appears in wrong position

**Solution:** Verify `selectionPopupPosition` is being set correctly in `onTextSelected`.

### Issue: Navigator keyboard shortcuts not working

**Solution:** Check that `AnnotationNavigator` component is mounted and `window` event listeners are attached.

### Issue: Sidebar doesn't close

**Solution:** Verify `showAnnotationSidebar` state is being updated in `onClose` callback.

### Issue: Performance slow with many annotations

**Solution:** Implement virtual scrolling in sidebar for 100+ annotations.

---

## Success Criteria

✅ All phases completed  
✅ All tests passing  
✅ No linter errors  
✅ Code committed  
✅ Documentation updated

**Status:** Ready for production! 🚀

---

**Document Version:** 1.0  
**Last Updated:** November 12, 2025  
**Author:** AI Assistant

# Annotation System - Quick Reference Card

## 🚀 Quick Start (30 seconds)

### For Developers

```typescript
// 1. Import service
import { annotationService } from '$lib/services/annotation.service';
import { loadAnnotationsForThread, getAnnotationsForMessage } from '$lib/stores/annotation.store';

// 2. Load annotations
await loadAnnotationsForThread(threadId);

// 3. Get annotations for a message
const annotations = $getAnnotationsForMessage(messageId);

// 4. Create annotation
await annotationService.createAnnotation({
  messageId: 'msg_123',
  threadId: 'thread_456',
  range: { start: 10, end: 25, text: 'selected text' },
  commentText: 'Great point!',
  style: 'default',
});
```

### For Users

1. **Select text** in AI response
2. **Click "Add Comment"** in popup
3. **Type comment** and press `Cmd+Enter`
4. **Navigate** with `←/→` or `K/J`

---

## 📚 Component Reference

| Component              | Purpose                | Location                |
| ---------------------- | ---------------------- | ----------------------- |
| `TextSelectionHandler` | Detects text selection | Wrap message content    |
| `HighlightRenderer`    | Shows highlights       | Replace message div     |
| `SelectionPopup`       | Add comment button     | Floating near selection |
| `CommentInputModal`    | Comment entry          | Full-screen modal       |
| `CommentDisplay`       | Show comments          | In message or sidebar   |
| `AnnotationNavigator`  | Navigation widget      | Bottom-right fixed      |
| `AnnotationSidebar`    | List all annotations   | Right slide-in panel    |

---

## 🎯 Common Tasks

### Create Annotation

```typescript
const result = await annotationService.createAnnotation({
  messageId: message.id,
  threadId: currentThread.id,
  range: { start: 0, end: 10, text: 'Hello world' },
  commentText: 'Nice greeting!',
  style: 'default', // or 'important', 'question', 'suggestion'
});

if (result.success) {
  console.log('Created:', result.annotation);
} else {
  console.error('Error:', result.error);
}
```

### Add Reply

```typescript
await annotationService.addComment({
  annotationId: 'anno_123',
  text: 'I agree!',
  replyTo: 'comment_456', // optional parent comment
});
```

### Edit Comment

```typescript
await annotationService.updateComment({
  annotationId: 'anno_123',
  commentId: 'comment_456',
  text: 'Updated text',
});
```

### Delete Annotation

```typescript
await annotationService.deleteAnnotation('anno_123');
```

### Load & Display

```typescript
// In Svelte component
import { getAnnotationsForMessage } from '$lib/stores/annotation.store';

// In template
{#each $getAnnotationsForMessage(message.id) as annotation}
  <HighlightRenderer {annotation} />
{/each}
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut           | Action                        |
| ------------------ | ----------------------------- |
| `←` or `K`         | Previous annotation           |
| `→` or `J`         | Next annotation               |
| `Esc`              | Close modal/navigator/sidebar |
| `Cmd/Ctrl + Enter` | Submit comment                |
| `Tab`              | Navigate UI                   |
| `Enter` / `Space`  | Activate focused element      |

---

## 🎨 Highlight Styles

```typescript
type AnnotationStyle =
  | 'default' // 🔵 Blue - General comments
  | 'important' // 🔴 Red - Critical issues
  | 'question' // 🟡 Yellow - Questions
  | 'suggestion'; // 🟢 Green - Improvements
```

**Usage:**

```typescript
style: 'important'; // Red highlight
```

---

## 🔒 Authorization Rules

| Action            | Requirement      |
| ----------------- | ---------------- |
| Create annotation | Thread access    |
| Add comment       | Thread access    |
| Edit comment      | Comment owner    |
| Delete comment    | Comment owner    |
| Delete annotation | Annotation owner |

---

## 📊 Data Structures

### Annotation

```typescript
interface Annotation {
  id: UUID; // 'anno_abc123'
  messageId: UUID; // 'msg_456'
  threadId: UUID; // 'thread_789'
  range: HighlightRange; // { start, end, text }
  comments: AnnotationComment[]; // Array of comments
  style: AnnotationStyle; // 'default' | 'important' | ...
  createdAt: number; // Epoch milliseconds
  updatedAt: number; // Epoch milliseconds
  userId?: string; // Creator ID
  deletedAt?: number | null; // Soft delete
}
```

### HighlightRange

```typescript
interface HighlightRange {
  start: number; // Character offset (0-based, inclusive)
  end: number; // Character offset (0-based, exclusive)
  text: string; // The actual highlighted text
}
```

### Comment

```typescript
interface AnnotationComment {
  id: UUID; // 'comment_xyz'
  userId?: string; // Author ID
  text: string; // Comment content
  createdAt: number; // Epoch milliseconds
  updatedAt?: number; // Epoch milliseconds
  replyTo?: UUID; // Parent comment (for threading)
  deletedAt?: number | null; // Soft delete
}
```

---

## 🔔 Event Listeners

```typescript
// Subscribe to events
const cleanup = annotationService.onAnnotationCreated((data) => {
  console.log('New annotation:', data.annotation);
});

// Cleanup when done
cleanup();
```

**Available Events:**

- `onAnnotationCreated(callback)`
- `onAnnotationDeleted(callback)`
- `onCommentAdded(callback)`
- `onCommentUpdated(callback)`
- `onCommentDeleted(callback)`

---

## 🧪 Testing Checklist

### Manual Testing

- [ ] Select text in assistant message
- [ ] Add comment via popup
- [ ] View highlight with badge
- [ ] Click highlight to view comments
- [ ] Navigate with keyboard (←/→)
- [ ] Open annotation sidebar
- [ ] Reply to comment
- [ ] Edit own comment
- [ ] Delete own comment
- [ ] Delete annotation
- [ ] Test with 100+ annotations
- [ ] Test real-time sync (2 windows)
- [ ] Test persistence (restart app)

### Accessibility Testing

- [ ] Keyboard-only navigation
- [ ] Screen reader compatibility
- [ ] Focus indicators visible
- [ ] ARIA labels present
- [ ] Tab order logical
- [ ] Color contrast sufficient

---

## 🐛 Troubleshooting

### Annotations Not Appearing

```typescript
// Check if loaded
await loadAnnotationsForThread(threadId);

// Check store
console.log($getAnnotationsForMessage(messageId));

// Check IPC
const result = await annotationService.getAnnotationsByMessage(messageId);
console.log(result);
```

### Real-time Updates Not Working

```typescript
// Ensure listeners initialized
useEffect(() => {
  const cleanup = initializeAnnotationListeners();
  return cleanup;
}, []);
```

### Performance Issues

```typescript
// Use lazy loading
await loadAnnotationsForMessage(messageId); // Load only what's needed

// Check annotation count
const annotations = $getAnnotationsForThread(threadId);
console.log('Count:', annotations.length); // Should be < 1000 for best perf
```

---

## 📖 Full Documentation

- **Integration Guide:** `docs/features/annotations-integration.md`
- **API Reference:** `docs/features/annotations-api.md`
- **Summary:** `docs/features/annotations-summary.md`
- **User Flows:** `docs/features/annotations-user-flow.md`

---

## 💡 Pro Tips

1. **Batch Loading:** Load annotations at thread level, not message level
2. **Event Cleanup:** Always cleanup event listeners in `onDestroy`
3. **Authorization:** UI should check ownership before showing edit/delete
4. **Validation:** Validate range before creating annotation
5. **Error Handling:** Always check `result.success` before accessing data
6. **Performance:** Use virtual scrolling for 500+ annotations in sidebar

---

## 🎓 Common Patterns

### Wrap Message Content

```svelte
{#if message.role === 'assistant'}
  <TextSelectionHandler
    messageId={message.id}
    messageContent={message.content}
    enabled={true}
    onTextSelected={handleSelection}
    onSelectionCleared={handleClearSelection}
  >
    {#snippet children()}
      <HighlightRenderer
        content={message.content}
        annotations={$getAnnotationsForMessage(message.id)}
        selectedAnnotationId={$selectedAnnotationId}
        onHighlightClick={handleHighlightClick}
      />
    {/snippet}
  </TextSelectionHandler>
{/if}
```

### Handle Selection

```typescript
function handleSelection(data: {
  messageId: string;
  range: HighlightRange;
  position: { x: number; y: number };
}) {
  annotationCreationState.set({
    messageId: data.messageId,
    range: data.range,
    isCreating: true,
  });
  selectionPopupPosition = data.position;
  selectionPopupVisible = true;
}
```

### Create Annotation from Selection

```typescript
async function handleAddComment(commentText: string) {
  const state = $annotationCreationState;
  if (!currentThread || !state.messageId || !state.range) return;

  const result = await annotationService.createAnnotation({
    messageId: state.messageId,
    threadId: currentThread.id,
    range: state.range,
    commentText,
    style: 'default',
  });

  if (result.success) {
    // Success!
    commentModalVisible = false;
    annotationCreationState.set({
      messageId: null,
      range: null,
      isCreating: false,
    });
  }
}
```

---

## 📞 Need Help?

- Read the full docs: `docs/features/`
- Check the API reference: `annotations-api.md`
- Review user flows: `annotations-user-flow.md`
- See integration guide: `annotations-integration.md`

---

**Version:** 1.0  
**Last Updated:** November 12, 2025  
**Status:** Production Ready ✅

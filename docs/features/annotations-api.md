# Annotation System API Documentation

## Overview

The annotation system allows users to highlight text sections in AI responses and add comments for discussion and feedback.

## Architecture

```
┌─────────────────────────────────────┐
│         Renderer (Svelte)           │
│  ┌─────────────────────────────┐   │
│  │  UI Components              │   │
│  │  - TextSelectionHandler     │   │
│  │  - HighlightRenderer        │   │
│  │  - CommentDisplay           │   │
│  │  - AnnotationNavigator      │   │
│  └──────────┬──────────────────┘   │
│             │                       │
│  ┌──────────▼──────────────────┐   │
│  │  annotation.service.ts      │   │
│  └──────────┬──────────────────┘   │
│             │                       │
│  ┌──────────▼──────────────────┐   │
│  │  annotation.store.ts        │   │
│  │  (Svelte stores)            │   │
│  └──────────┬──────────────────┘   │
└─────────────┼───────────────────────┘
              │ IPC
┌─────────────▼───────────────────────┐
│         Main Process                │
│  ┌─────────────────────────────┐   │
│  │  annotation-handler.ts      │   │
│  │  (IPC handlers)             │   │
│  └──────────┬──────────────────┘   │
│             │                       │
│  ┌──────────▼──────────────────┐   │
│  │  annotation-repository.ts   │   │
│  │  (Disk persistence)         │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

## Data Model

### Annotation

```typescript
interface Annotation {
  id: UUID; // Unique annotation ID
  messageId: UUID; // Message being annotated
  threadId: UUID; // Thread containing message
  range: HighlightRange; // Text range
  comments: AnnotationComment[]; // Array of comments
  createdAt: number; // Creation timestamp (epoch ms)
  updatedAt: number; // Last update timestamp (epoch ms)
  userId?: string; // Creator user ID
  deletedAt?: number | null; // Soft delete timestamp
  style?: 'default' | 'important' | 'question' | 'suggestion';
}
```

### HighlightRange

```typescript
interface HighlightRange {
  start: number; // Character offset (0-based, inclusive)
  end: number; // Character offset (0-based, exclusive)
  text: string; // The highlighted text
}
```

### AnnotationComment

```typescript
interface AnnotationComment {
  id: UUID; // Unique comment ID
  userId?: string; // Comment author
  text: string; // Comment content
  createdAt: number; // Creation timestamp
  updatedAt?: number; // Update timestamp
  replyTo?: UUID; // Parent comment ID (for threading)
  deletedAt?: number | null; // Soft delete
}
```

## Frontend API

### AnnotationService

Located: `src/lib/services/annotation.service.ts`

#### Methods

##### createAnnotation

```typescript
async createAnnotation(request: CreateAnnotationRequest): Promise<
  { success: true; annotation: Annotation } |
  { success: false; error: string }
>
```

**Request:**

```typescript
interface CreateAnnotationRequest {
  messageId: UUID;
  threadId: UUID;
  range: HighlightRange;
  commentText: string;
  style?: 'default' | 'important' | 'question' | 'suggestion';
}
```

**Example:**

```typescript
const result = await annotationService.createAnnotation({
  messageId: 'msg_123',
  threadId: 'thread_456',
  range: { start: 10, end: 25, text: 'selected text' },
  commentText: 'This needs clarification',
  style: 'question',
});
```

##### addComment

```typescript
async addComment(request: AddCommentRequest): Promise<
  { success: true; comment: AnnotationComment; annotation: Annotation } |
  { success: false; error: string }
>
```

**Request:**

```typescript
interface AddCommentRequest {
  annotationId: UUID;
  text: string;
  replyTo?: UUID; // Optional parent comment ID
}
```

##### updateComment

```typescript
async updateComment(request: UpdateCommentRequest): Promise<
  { success: true; comment: AnnotationComment; annotation: Annotation } |
  { success: false; error: string }
>
```

##### deleteComment

```typescript
async deleteComment(request: DeleteCommentRequest): Promise<
  { success: true } |
  { success: false; error: string }
>
```

##### deleteAnnotation

```typescript
async deleteAnnotation(annotationId: UUID): Promise<
  { success: true } |
  { success: false; error: string }
>
```

##### getAnnotationsByMessage

```typescript
async getAnnotationsByMessage(messageId: UUID): Promise<
  { success: true; annotations: Annotation[] } |
  { success: false; error: string }
>
```

##### getAnnotationsByThread

```typescript
async getAnnotationsByThread(threadId: UUID): Promise<
  { success: true; annotations: Annotation[] } |
  { success: false; error: string }
>
```

##### Event Listeners

```typescript
// Subscribe to annotation created
onAnnotationCreated(callback: (data: {
  threadId: string;
  messageId: string;
  annotation: Annotation;
}) => void): () => void

// Subscribe to annotation deleted
onAnnotationDeleted(callback: (data: {
  threadId: string;
  messageId: string;
  annotationId: string;
}) => void): () => void

// Subscribe to comment added
onCommentAdded(callback: (data: {
  threadId: string;
  messageId: string;
  annotationId: string;
  comment: AnnotationComment;
}) => void): () => void

// Subscribe to comment updated
onCommentUpdated(callback: (data: {
  threadId: string;
  messageId: string;
  annotationId: string;
  comment: AnnotationComment;
}) => void): () => void

// Subscribe to comment deleted
onCommentDeleted(callback: (data: {
  threadId: string;
  messageId: string;
  annotationId: string;
  commentId: string;
}) => void): () => void
```

### Annotation Store

Located: `src/lib/stores/annotation.store.ts`

#### Stores

```typescript
// Writable stores
selectedAnnotationId: Writable<string | null>
annotationCreationState: Writable<{
  messageId: string | null;
  range: HighlightRange | null;
  isCreating: boolean;
}>

// Derived stores
getAnnotationsForMessage(messageId: string): Readable<Annotation[]>
getAnnotationsForThread(threadId: string): Readable<Annotation[]>
```

#### Functions

```typescript
// Load annotations for a message
loadAnnotationsForMessage(messageId: string): Promise<void>

// Load annotations for a thread
loadAnnotationsForThread(threadId: string): Promise<void>

// Initialize real-time event listeners
initializeAnnotationListeners(): () => void

// State management (called automatically by events)
addAnnotationToState(annotation: Annotation): void
updateAnnotationInState(annotation: Annotation): void
removeAnnotationFromState(
  annotationId: string,
  messageId: string,
  threadId: string
): void
```

## Backend API

### IPC Handlers

Located: `src-electron/ipc-handlers/annotation-handler.ts`

All handlers require authentication and enforce authorization rules.

#### Channels

##### annotation:create

**Input:** `CreateAnnotationRequest`
**Output:** `{ success: true; annotation: Annotation } | ErrorResponse`

**Authorization:**

- User must be authenticated
- User must have access to the thread
- Range must be valid and within message bounds

##### annotation:addComment

**Input:** `AddCommentRequest`
**Output:** `{ success: true; comment: AnnotationComment; annotation: Annotation } | ErrorResponse`

**Authorization:**

- User must be authenticated
- User must have access to the thread

##### annotation:updateComment

**Input:** `UpdateCommentRequest`
**Output:** `{ success: true; comment: AnnotationComment; annotation: Annotation } | ErrorResponse`

**Authorization:**

- User must be authenticated
- User must be the comment owner

##### annotation:deleteComment

**Input:** `DeleteCommentRequest`
**Output:** `{ success: true; annotationId: string; commentId: string } | ErrorResponse`

**Authorization:**

- User must be authenticated
- User must be the comment owner

##### annotation:delete

**Input:** `annotationId: string`
**Output:** `{ success: true; annotationId: string } | ErrorResponse`

**Authorization:**

- User must be authenticated
- User must be the annotation owner

##### annotation:getByMessage

**Input:** `messageId: string`
**Output:** `{ success: true; annotations: Annotation[] } | ErrorResponse`

##### annotation:getByThread

**Input:** `threadId: string`
**Output:** `{ success: true; annotations: Annotation[] } | ErrorResponse`

##### annotation:getById

**Input:** `annotationId: string`
**Output:** `{ success: true; annotation: Annotation } | ErrorResponse`

#### Broadcast Events

These events are sent to all windows when changes occur:

- `annotation:created` - When annotation is created
- `annotation:deleted` - When annotation is deleted
- `annotation:commentAdded` - When comment is added
- `annotation:commentUpdated` - When comment is updated
- `annotation:commentDeleted` - When comment is deleted

### Repository

Located: `src-electron/repository/annotation-repository.ts`

#### Methods

```typescript
// Create annotation
createAnnotation(params: {
  messageId: string;
  threadId: string;
  range: HighlightRange;
  commentText: string;
  userId?: string;
  style?: Annotation['style'];
}): Annotation

// Add comment
addComment(params: {
  annotationId: string;
  text: string;
  userId?: string;
  replyTo?: string;
}): AnnotationComment

// Update comment
updateComment(params: {
  annotationId: string;
  commentId: string;
  text: string;
}): AnnotationComment

// Delete comment (soft delete)
deleteComment(annotationId: string, commentId: string): boolean

// Delete annotation (soft delete)
deleteAnnotation(annotationId: string): boolean

// Hard delete annotation (permanent)
hardDeleteAnnotation(annotationId: string): boolean

// Query methods
getAnnotation(annotationId: string): Annotation | null
getAnnotationsForMessage(messageId: string): Annotation[]
getAnnotationsForThread(threadId: string): Annotation[]

// Cleanup
deleteAnnotationsForThread(threadId: string): number
```

## Validation Rules

### Range Validation

- `start` must be >= 0
- `end` must be > `start`
- `end` must be <= message content length
- `text` length must equal `end - start`
- `text` must match `messageContent.substring(start, end)`

### Comment Validation

- Text must not be empty after trimming
- Text must be <= 10KB
- No special character restrictions (supports markdown, code, etc.)

### Authorization Rules

1. **Create Annotation**
   - User must own the thread or have read access

2. **Add Comment**
   - User must have access to the thread

3. **Update Comment**
   - User must be the comment author

4. **Delete Comment**
   - User must be the comment author

5. **Delete Annotation**
   - User must be the annotation creator

## Storage

### Location

Annotations are stored in: `{userData}/annotations-storage.json`

### Format

```json
{
  "version": 1,
  "annotations": [
    {
      "id": "anno_abc123",
      "messageId": "msg_456",
      "threadId": "thread_789",
      "range": {
        "start": 10,
        "end": 25,
        "text": "selected text"
      },
      "comments": [
        {
          "id": "comment_xyz",
          "userId": "user_123",
          "text": "This needs clarification",
          "createdAt": 1699123456789,
          "deletedAt": null
        }
      ],
      "createdAt": 1699123456789,
      "updatedAt": 1699123456789,
      "userId": "user_123",
      "deletedAt": null,
      "style": "question"
    }
  ]
}
```

## Error Codes

| Code                       | Description                        |
| -------------------------- | ---------------------------------- |
| `THREAD_ACCESS_DENIED`     | User doesn't have access to thread |
| `ANNOTATION_ACCESS_DENIED` | User doesn't have permission       |
| `THREAD_NOT_FOUND`         | Thread doesn't exist               |
| `MESSAGE_NOT_FOUND`        | Message doesn't exist              |
| `ANNOTATION_NOT_FOUND`     | Annotation doesn't exist           |
| `COMMENT_NOT_FOUND`        | Comment doesn't exist              |
| `RANGE_OUT_OF_BOUNDS`      | Text range exceeds message length  |
| `INVALID_RANGE`            | Range is malformed                 |
| `RANGE_TEXT_MISMATCH`      | Highlighted text doesn't match     |
| `COMMENT_EMPTY`            | Comment text is empty              |
| `COMMENT_TOO_LONG`         | Comment exceeds 10KB               |
| `NOT_COMMENT_OWNER`        | User doesn't own the comment       |
| `NOT_ANNOTATION_OWNER`     | User doesn't own the annotation    |

## Performance

### Optimization Strategies

1. **Lazy Loading**: Annotations loaded per-thread, not globally
2. **Indexing**: Fast lookups by message ID and thread ID
3. **Caching**: Svelte stores cache annotations in memory
4. **Debouncing**: Text selection debounced at 100ms
5. **Efficient Rendering**: HighlightRenderer optimized for 100+ annotations

### Benchmarks

- Annotation creation: < 50ms
- Load 100 annotations: < 100ms
- Render 100 highlights: < 300ms
- Navigation (prev/next): < 10ms

## Security

### Input Sanitization

- All text inputs trimmed
- Range bounds validated
- Comment length limited to 10KB
- No XSS vulnerabilities (Svelte escapes by default)

### Authorization

- All operations require authentication
- Ownership checked on delete/edit
- Thread access validated on all operations

### Data Privacy

- Annotations stored locally only
- No telemetry/analytics by default
- Soft deletes preserve audit trail

# Auto-Title Thread After First Prompt

## Summary

When a user sends the first prompt in a newly created thread, the app automatically generates a concise, descriptive title derived from the prompt. This ensures threads are discoverable in lists and exports without requiring manual titling.

## Implementation Status

✅ **IMPLEMENTED** - Feature complete and tested with 38 passing unit tests

## Design

- **Trigger**: Generation occurs automatically after the first assistant response
- **Service**: Local `TitleGeneratorService` with intelligent sanitization and truncation
- **UI Feedback**: Chat header displays animated "..." indicator during generation
- **Persistence**: Title applied to `thread.title` and mirrored to `thread.metadata.title`
- **Performance**: <1s generation time (typically <100ms for local processing)

## Security & Privacy

- **Sanitization**: Automatically removes sensitive data:
  - URLs (http://, https://, www.)
  - Email addresses
  - File paths (Unix: `/path/to/file`, Windows: `C:\path\to\file`, relative: `./file`)
  - Path-like patterns (e.g., `src/components/Button`)
- **Length Limits**: Max 80 characters with word-boundary aware truncation
- **Special Characters**: Collapses whitespace, preserves question marks and exclamation points

## Fallbacks & Uniqueness

- **Fallback**: "New Thread" used when:
  - Prompt is empty or whitespace-only
  - Sanitization results in empty string
  - Generation encounters an error
- **Uniqueness**: Automatic numeric suffixes (e.g., "My Thread (2)", "My Thread (3)")
- **Case-Insensitive**: Uniqueness checking is case-insensitive

## Implementation Details

### Backend Components

**1. TitleGeneratorService** (`src-electron/services/title-generator.service.ts`)

- Core title generation logic
- Configurable (max length, fallback title, skip words)
- Methods:
  - `generateTitle(prompt: string): string` - Main generation
  - `ensureUniqueTitle(candidate: string, existing: string[]): string` - Uniqueness

**2. ThreadRepository** (`src-electron/repository/thread-repository.ts`)

- Integrated into `addAssistantResponse()` method
- Automatically generates title when:
  - First assistant response arrives
  - Thread has no title or empty title
- Fetches existing titles for uniqueness checking

**3. Thread Handler** (`src-electron/ipc-handlers/thread-handler.ts`)

- Emits IPC events for UI feedback:
  - `thread:titleGenerationStarted` - Before generation
  - `thread:titleGenerationFinished` - After generation with new title
- Events emitted in both `addAssistantResponse` and `savePromptAndResponses` handlers

### Frontend Components

**1. Preload** (`src-electron/preload.ts`)

- Exposes event listeners:
  - `onTitleGenerationStarted(callback: (data: { threadId }) => void)`
  - `onTitleGenerationFinished(callback: (data: { threadId, title }) => void)`

**2. Title Generation Store** (`src/lib/stores/titleGeneration.store.ts`)

- Global state management for title generation status
- Methods:
  - `startGeneration(threadId: string)`
  - `finishGeneration(threadId, title: string)`
  - `isGenerating(threadId: string): boolean`
- Derived store: `isThreadGeneratingTitle(threadId): boolean`
- Auto-initialized in `src/main.ts` via `initTitleGenerationListeners()`

**3. ChatPane** (`src/lib/components/ChatPane.svelte`)

- Displays animated "..." indicator during generation
- Updates automatically when title is generated
- Accessibility: `aria-live="polite"` for screen readers

**4. Thread List** (`src/routes/threads/+page.svelte`)

- Automatically updates when `thread:updated` event fires
- No additional changes needed (reactive to thread store)

## Title Generation Logic

### Sanitization Pipeline

1. Remove URLs, emails, file paths
2. Collapse multiple spaces
3. Remove leading/trailing whitespace and punctuation

### Filler Word Removal

Common filler phrases removed from beginning (case-sensitive):

- "please", "can you", "could you", "would you"
- "i want", "i need", "help me"

### Truncation

- Max length: 80 characters (configurable)
- Word-boundary aware (prefers breaking at spaces)
- Appends "..." when truncated

### Capitalization

- First letter capitalized after filler word removal

## Tests

**Unit Tests** (`tests/unit/services/title-generator.service.spec.ts`)

- ✅ 38 tests passing
- Coverage areas:
  - Sanitization (URLs, emails, paths)
  - Truncation and word boundaries
  - Filler word removal
  - Uniqueness checking
  - Configuration options
  - Edge cases (Unicode, emojis, special characters)
  - Performance (<1s requirement)

## Configuration

Default configuration (can be customized):

```typescript
{
  maxLength: 80,
  minLength: 60,
  fallbackTitle: 'New Thread',
  skipWords: ['please', 'can you', 'could you', 'would you', 'i want', 'i need', 'help me']
}
```

## Future Enhancements

- **AI-Powered Titles**: Replace local generator with backend AI service
  - Keep same IPC contract for seamless upgrade
  - Potential for more contextual, intelligent titles
- **User Preferences**: Allow users to configure:
  - Title length preferences
  - Custom fallback titles
  - Enable/disable auto-titling
- **Title Suggestions**: Offer multiple title options for user selection

## Performance Metrics

- **Generation Time**: <100ms average (well under 1s NFR)
- **Total Latency**: <1s from response to title display
- **Memory**: Minimal overhead (stateless service)

## Accessibility

- Screen reader support via `aria-live="polite"` announcements
- Visual indicator (animated "...") for sighted users
- No keyboard interaction required (automatic)

# Optimistic Message Rendering Implementation

## Overview

This document describes the implementation of optimistic message rendering in the chat interface. Messages appear instantly when sent (< 100ms), with visual feedback about their delivery status.

## Architecture

### Core Components

1. **Message Status Types** (`src/lib/types/thread.type.ts`)
   - `sending`: Message is being sent to the backend
   - `sent`: Message successfully delivered
   - `failed`: Message delivery failed (with retry option)
   - `pending_offline`: Message queued while offline

2. **Outbox Service** (`src/lib/services/outbox.service.ts`)
   - Manages pending messages using IndexedDB for resilience
   - Handles retry logic with exponential backoff
   - Max 3 retry attempts per message
   - 10-second timeout for each send attempt
   - Persists messages across browser refresh

3. **Network Service** (`src/lib/services/network.service.ts`)
   - Monitors online/offline status
   - Provides reactive stores for network state
   - Triggers automatic resend when connection restored

4. **MessageBubble Component** (`src/lib/components/MessageBubble.svelte`)
   - Displays message status indicators
   - Shows retry button for failed messages
   - Visual feedback: opacity 0.5 for pending, 1.0 for sent
   - Pulse animation for sending status

5. **ChatPane Updates** (`src/lib/components/ChatPane.svelte`)
   - Implements optimistic rendering
   - Coordinates outbox, network, and persistence
   - Handles automatic retry on failure
   - Processes pending queue when coming online

## User Experience

### Happy Path
1. User types message and clicks Send
2. Message appears immediately with "Sending..." status (opacity 0.5)
3. Within 2s, status updates to "Sent" with full opacity
4. Timestamp shows local time

### Failure Path
1. Message fails to send after 10s timeout
2. Status changes to "Failed" with red warning icon
3. Retry button appears inline
4. User can manually retry up to 3 times
5. Original timestamp and content preserved

### Offline Mode
1. Network service detects offline status
2. Message renders with "Offline" status
3. Added to pending queue in IndexedDB
4. Auto-resends when connection restored (FIFO order)

## Technical Implementation

### Message Flow

```
User clicks Send
   ↓
Generate client_message_id (UUID)
   ↓
Render optimistically (< 100ms)
   ↓
Add to outbox (IndexedDB)
   ↓
Check network status
   ↓
If online: Persist to memory storage
   ↓
Update status to 'sent' on success
   OR
   ↓
Update status to 'failed' on error
   ↓
Schedule retry (if < max retries)
```

### Performance Optimizations

- **Svelte Reactivity**: Messages array uses immutable updates for efficient DOM diffing
- **Transition Duration**: 300ms CSS transitions for status changes
- **Timeout**: 10s limit prevents indefinite blocking
- **IndexedDB**: Async operations don't block UI thread
- **Batch Updates**: Status changes batched with Svelte's reactive system

### Accessibility

- Status changes announced via `aria-label` on retry button
- Visual indicators use both color and icon/text
- Keyboard accessible retry action
- Screen reader friendly status text

## Testing

### Unit Tests
- `tests/unit/services/outbox.service.spec.ts`: Outbox CRUD, retry logic
- `tests/unit/services/network.service.spec.ts`: Online/offline detection

### E2E Tests
- `tests/e2e/optimistic-rendering.spec.ts`:
  - Scenario 1: Display Message Instantly (< 100ms)
  - Scenario 2: Message Send Failure (timeout + retry)
  - Scenario 3: Offline Mode (queue + auto-resend)
  - Scenario 4: Multiple Messages (consistency + scroll)

## Configuration

### Constants (in `outbox.service.ts`)
- `MAX_RETRIES`: 3
- `RETRY_DELAY`: 2000ms (2s between retries)
- `TIMEOUT_MS`: 10000ms (10s timeout)
- `DB_NAME`: 'HolokaiOutbox'

### Status Indicators
- ● (sending) - Pulsing dot
- ✓ (sent) - Checkmark
- ⚠ (failed) - Warning triangle
- ○ (pending_offline) - Empty circle

## Future Enhancements

1. **Exponential Backoff**: Progressive retry delays (2s, 4s, 8s)
2. **Network Quality**: Adjust timeout based on connection speed
3. **Batch Send**: Group multiple pending messages in single request
4. **Analytics**: Track UX latency metrics (p50, p95, p99)
5. **Message Queue UI**: Show count of pending messages in header

## Dependencies

- IndexedDB API (browser native)
- Svelte stores for reactivity
- Navigator.onLine API for network detection
- Electron IPC for message persistence

## Migration Notes

No data migration required. Existing messages without status field default to 'sent'. New messages automatically include status tracking.


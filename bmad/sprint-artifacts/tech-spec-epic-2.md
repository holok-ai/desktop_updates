# Epic Technical Specification: Thread Branching

Date: 2025-11-26
Author: Peter
Epic ID: 2
Status: Draft

---

## Overview

Epic 2 implements a message tree structure enabling users to create prompt variations and alternative conversation branches without losing original responses. This feature addresses the core user need (US-13 from PRD §3.2) to explore different prompt variations while maintaining conversation history. The implementation supports up to 9 variation branches per divergence point (branchIndex: 0=original, 1-9=variations) with visual lane-based UI representation, automatic title generation after the second exchange, and enhanced clipboard operations for copying/pasting between branches.

## Objectives and Scope

**In Scope:**
- Message tree data model with `parentMessageId` and `branchIndex` fields
- "Create Variation" button on user messages with prompt editing capability
- Branch creation flow with maximum 9 variation branches per divergence point
- Lane-based branch visualization UI component
- Automatic thread title generation after 2nd message exchange
- Enhanced clipboard operations (copy-to-input, copy-to-clipboard, copy code blocks)
- Paste handling with support for images and files
- Context assembly for branched conversations (including sibling branches)
- Branch limit validation and user feedback

**Out of Scope:**
- More than 9 variation branches per message (enforced limit per PRD §3.2.2)
- Merging or collapsing branches
- Branch comparison/diff views
- Undo/redo for branch operations (deferred to Phase 3)
- Branch-specific permissions or access control
- Export of individual branches (only full thread export supported)

## System Architecture Alignment

This epic extends the existing thread architecture (Architecture §3, §5.2) with tree-structured message relationships:

**Components Modified:**
- **MessageRepository (Desktop)** - Extended to support parentMessageId queries and branch traversal
- **ThreadService** - Enhanced submit() method signature to accept `(threadId, parentId, prompt, branchIndex)`
- **ThreadCache** - Updated cache invalidation strategy for branch operations
- **ChatWindow UI** - New MessageBranch component for lane visualization (Architecture §8.1)

**Architectural Constraints:**
- Maximum 9 variation branches enforced at service layer (PRD §3.2.2)
- Message tree stored in local SQLite (`desktop_messages` table with `parentMessageId`, `branchIndex` columns per Architecture §10.3)
- Synchronization with Moku API requires branch-aware conflict resolution
- Clipboard operations maintain desktop-first architecture with fallback to web clipboard API

**Data Flow:**
User clicks "Create Variation" → Edit prompt → ThreadService.submit(parentId, branchIndex) → Check branch limit → Create new message → Update tree → Refresh UI lanes

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs | Owner |
|--------|---------------|--------|---------|-------|
| **MessageRepository** | CRUD operations for messages with tree queries | `parentMessageId`, `branchIndex`, `threadId` | `Message[]`, tree traversal results | E2-S1 |
| **ThreadService** | Branch creation, limit validation, context assembly | `submitRequest(parentId, prompt, branchIndex)` | `Message`, branch validation errors | E2-S2 |
| **ThreadCache** | Cache messages with branch-aware invalidation | Cache keys with branch structure | Cached message trees | E2-S1 |
| **BranchVisualizationUI** | Lane-based rendering of message branches | Message tree data | React components for lanes | E2-S3 |
| **AutoTitleService** | Generate thread titles after 2nd exchange | Thread messages (first 2 exchanges) | Title string (50 char max) | E2-S4 |
| **ClipboardService** | Copy/paste operations with format handling | Message content, images, files | Clipboard data, paste events | E2-S5, E2-S6 |

### Data Models and Contracts

**Message Entity (Enhanced for Tree Structure):**

```typescript
interface Message {
  id: string;
  threadId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;

  // Tree structure fields (NEW)
  parentMessageId: string | null;  // null for root messages
  branchIndex: 0=original, 1-9=variations

  // Existing fields
  attachments?: Attachment[];
  metadata?: MessageMetadata;
  status: 'pending' | 'complete' | 'error';
}
```

**Database Schema (desktop_messages table):**

```sql
CREATE TABLE desktop_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  parent_message_id TEXT,           -- FK to desktop_messages.id
  branch_index INTEGER DEFAULT 0,   -- 0-9
  attachments TEXT,                 -- JSON
  metadata TEXT,                    -- JSON
  status TEXT NOT NULL,
  deleted_at INTEGER,               -- Soft delete timestamp (NULL = not deleted)

  FOREIGN KEY (thread_id) REFERENCES desktop_threads(id),
  FOREIGN KEY (parent_message_id) REFERENCES desktop_messages(id)
);

CREATE INDEX idx_messages_parent ON desktop_messages(parent_message_id);
CREATE INDEX idx_messages_thread_tree ON desktop_messages(thread_id, parent_message_id, branch_index);
CREATE INDEX idx_messages_deleted ON desktop_messages(deleted_at); -- For filtering out deleted messages
```

**Branch Validation Contract:**

```typescript
interface BranchLimitCheck {
  parentMessageId: string;
  existingBranches: number;  // Count of siblings with same parentMessageId
  canCreateBranch: boolean;  // true if existingBranches < 2
  errorMessage?: string;     // "Maximum 9 variation branches per message"
}
```

**Thread Title Generation Contract:**

```typescript
interface TitleGenerationRequest {
  threadId: string;
  messages: Message[];  // First 2 exchanges (4 messages total)
}

interface TitleGenerationResponse {
  title: string;        // Max 50 characters
  confidence: number;   // 0-1 confidence score
  fallback: boolean;    // true if using fallback logic
}
```

### APIs and Interfaces

**ThreadService.submit() - Enhanced Signature:**

```typescript
async submit(
  threadId: string,
  parentMessageId: string,
  prompt: string,
  branchIndex?: number
): Promise<Message> {
  // 1. Validate branch limit
  const siblings = await this.getSiblingBranches(parentMessageId);
  if (siblings.length >= 2 && branchIndex === undefined) {
    throw new BranchLimitError('Maximum 9 variation branches per message');
  }

  // 2. Assign branchIndex (auto-increment or explicit)
  const finalBranchIndex = branchIndex ?? siblings.length;

  // 3. Create user message with tree metadata
  const userMessage = await this.messageRepo.create({
    threadId,
    parentMessageId,
    branchIndex: finalBranchIndex,
    role: 'user',
    content: prompt
  });

  // 4. Assemble context (include parent + sibling branches)
  const context = await this.assembleContext(threadId, parentMessageId);

  // 5. Submit to AI service
  const response = await this.aiService.generate(context);

  // 6. Save assistant response
  const assistantMessage = await this.messageRepo.create({
    threadId,
    parentMessageId: userMessage.id,
    branchIndex: 0,  // Assistant responses always branchIndex 0
    role: 'assistant',
    content: response
  });

  return assistantMessage;
}
```

**MessageRepository - New Methods:**

```typescript
interface IMessageRepository {
  // Existing methods
  create(message: Partial<Message>): Promise<Message>;
  findByThread(threadId: string): Promise<Message[]>;

  // NEW: Tree query methods (all filter out soft-deleted messages: WHERE deleted_at IS NULL)
  getSiblingBranches(parentMessageId: string): Promise<Message[]>;
  getMessageTree(threadId: string): Promise<MessageTreeNode[]>;
  getPathToRoot(messageId: string): Promise<Message[]>;

  // NEW: Soft delete method
  softDelete(messageId: string): Promise<void>;  // Sets deleted_at = NOW()
  restoreDeleted(messageId: string): Promise<void>;  // Sets deleted_at = NULL
}
```

**IPC Handlers (Electron):**

```typescript
// renderer → main process
ipcRenderer.invoke('threads:submit', {
  threadId,
  parentMessageId,
  prompt,
  branchIndex
});

ipcRenderer.invoke('threads:getBranches', {
  parentMessageId
});

ipcRenderer.invoke('threads:validateBranchLimit', {
  parentMessageId
});

// NEW: Soft delete handler
ipcRenderer.invoke('messages:softDelete', {
  messageId
});

ipcRenderer.invoke('messages:restore', {
  messageId
});
```

**Clipboard API:**

```typescript
interface ClipboardService {
  copyToInput(messageId: string): Promise<void>;
  copyToClipboard(content: string, format: 'text' | 'markdown'): Promise<void>;
  copyCodeBlock(code: string, language: string): Promise<void>;
  handlePaste(event: ClipboardEvent): Promise<PasteResult>;
}
```

### Workflows and Sequencing

**Prompt Variation Flow Sequence:**

1. **User Initiates Prompt Variation**
   - User hovers over user message → "Create Variation" button appears
   - User clicks "Create Variation" button
   - UI displays prompt editor pre-filled with original prompt

2. **Prompt Editing** (optional)
   - User modifies prompt text
   - Attachments from original message carried forward by default
   - User can add/remove attachments

3. **Branch Limit Validation**
   - Frontend calls `threads:validateBranchLimit(parentMessageId)`
   - Backend counts existing siblings: `SELECT COUNT(*) WHERE parent_message_id = ? AND role = 'user'`
   - If count >= 9, show error: "Maximum 9 variation branches per message"
   - Otherwise, proceed

4. **Branch Creation**
   - Frontend calls `threads:submit(threadId, parentMessageId, prompt, branchIndex)`
   - Backend creates user message with `branchIndex = sibling_count`
   - Backend assembles context (path to root + sibling branches for awareness)
   - Backend submits to AI service
   - Backend creates assistant response with `parentMessageId = new_user_message.id`

5. **UI Update**
   - Frontend receives new messages via IPC response
   - BranchVisualization component detects new branch
   - Renders new lane next to existing lanes
   - Auto-scrolls to show new branch

**Context Assembly for Branched Conversations:**

```
Root Message (id: A)
├── User: "Explain quantum physics" (branchIndex: 0, id: B)
│   └── Assistant: "Quantum physics is..." (id: C)
│       └── User: "Tell me more about entanglement" (branchIndex: 0, id: D)
│           └── Assistant: "Entanglement is..." (id: E) ← CURRENT
├── User: "Explain quantum physics simply" (branchIndex: 1, id: F)
│   └── Assistant: "In simple terms..." (id: G)
└── User: "Explain quantum physics for kids" (branchIndex: 2, id: H)
    └── Assistant: "Imagine..." (id: I)

Context for message E: [A, B, C, D] (path to root, excluding siblings)
Context includes metadata about siblings F and H for AI awareness but not full content
```

**Auto-Title Generation Trigger:**

1. After assistant response is saved
2. Check: `message_count = SELECT COUNT(*) FROM desktop_messages WHERE thread_id = ? AND role = 'user'`
3. If `message_count == 2` (exactly 2 user messages, meaning 2nd exchange complete)
4. Call `AutoTitleService.generateTitle(threadId, first_4_messages)`
5. Update `desktop_threads.title` column
6. Emit event to refresh thread list UI

## Non-Functional Requirements

### Performance

**Response Time Targets:**
- Branch limit validation: <50ms (single COUNT query)
- Message tree retrieval: <200ms for threads up to 100 messages
- Context assembly for branched conversations: <500ms (includes sibling branch metadata)
- UI lane rendering: 60fps for up to 3 visible branches simultaneously
- Auto-title generation: <3 seconds (AI call, async, non-blocking)
- "Create Variation" button interaction: <100ms from click to prompt editor display

**Throughput:**
- Support concurrent branch creation across multiple threads
- Handle up to 10 branch operations per second per user without degradation

**UI Performance:**
- Lane scrolling maintains 60fps
- Branch visualization renders within 16ms per frame
- No UI blocking during async operations (title generation, AI responses)

### Security

**Authorization:**
- Branch operations inherit thread-level permissions (no new attack surface)
- If user can write to thread, they can create branches
- No RBAC changes required for Epic 2
- User context from Epic 1's authorization service applies to all branch operations

**Input Sanitization:**
- Clipboard paste operations sanitize HTML/scripts before insertion (XSS prevention)
- File paste validates file types against allowlist (images, PDFs only per PRD File Attachments spec)
- Reject executable files, scripts, and unknown MIME types

**Data Protection:**
- Branch metadata stored in same SQLite database as messages (encrypted at rest per existing Desktop security model)
- No new PII or sensitive data introduced by branching feature
- Clipboard operations use Electron's secure clipboard API

### Reliability/Availability

**Transactional Integrity:**
- Branch creation uses SQLite transactions: atomic commit of (user message + assistant response) or full rollback
- Concurrent branch creation handled via optimistic locking on parent message
- If two users attempt to create 3rd branch simultaneously, second request fails gracefully with clear error

**Graceful Degradation:**
- If auto-title generation fails (AI timeout, API error), thread remains functional with default title "New Thread"
- If clipboard API unavailable (rare), fallback to manual copy via context menu
- If branch visualization component crashes, fall back to linear message view with branch indicators

**Error Recovery:**
- Failed branch creation: user can attempt again immediately (state not corrupted)
- SQLite transaction failures logged and reported to user: "Unable to create branch, please try again"
- Cache invalidation failures: worst case is stale UI until next refresh (non-critical)

**Data Consistency:**
- Branch index constraints enforced at database level (CHECK constraint: branch_index IN (0-9))
- Orphaned messages prevented by foreign key constraints
- Tree cycles prevented by application logic (parentMessageId cannot reference descendants)

### Observability

**Metrics:**
- `branch.creation.duration` - Time to create branch (P50, P95, P99)
- `branch.validation.duration` - Time to validate branch limit
- `branch.limit.violations` - Count of attempts to create 3rd branch (per thread)
- `title.generation.success_rate` - Percentage of successful auto-title generations
- `title.generation.duration` - AI call latency for title generation
- `tree.depth.distribution` - Histogram of tree depths (alert if >5 levels indicates UX issue)
- `clipboard.paste.errors` - Count of paste validation failures by type

**Logging:**
- **INFO:** Branch created (threadId, parentMessageId, branchIndex, userId)
- **INFO:** Auto-title generated (threadId, title, duration)
- **WARN:** Branch limit violation attempt (threadId, userId, existingBranches)
- **WARN:** Title generation fallback used (threadId, error reason)
- **ERROR:** Branch creation transaction failure (threadId, error details)
- **ERROR:** Tree traversal errors (threadId, operation, stack trace)
- **ERROR:** Clipboard paste sanitization blocked malicious content (threat type)

**Tracing:**
- Distributed trace for full prompt variation flow: UI click → validation → branch creation → AI call → UI update
- Trace context assembly operations (especially for deep trees)
- Instrument SQLite query execution for tree operations

**Alerting:**
- Alert if branch creation P95 > 1 second (performance degradation)
- Alert if title generation success rate < 95% (AI service issues)
- Alert if tree depth >5 for any thread (potential UX problem requiring investigation)

## Dependencies and Integrations

**Internal Dependencies (BLOCKERS):**
- **E1-S1: Database Schema Migration** - MUST be complete before E2-S1 can start
  - Requires `parent_message_id` and `branch_index` columns in `desktop_messages` table
  - Requires indexes: `idx_messages_parent`, `idx_messages_thread_tree`
- **E1-S2: Thread API Updates** - MUST be complete before E2-S2 can implement prompt variation flow
  - Requires ThreadService.submit() interface defined
- **E1-S3: Message API Updates** - MUST be complete before E2-S1 can implement tree queries
  - Requires MessageRepository interface with CRUD operations

**External Package Dependencies:**
- **react-window** (^1.8.10) - Virtual scrolling for lane rendering (NEW dependency)
  - Lighter weight than react-virtualized
  - Required for 60fps performance with multiple lanes
- **Electron Clipboard API** - Native module (existing dependency, no version change)
- **SQLite** (better-sqlite3 ^9.x) - Existing dependency, no changes needed

**Integration Points:**

**1. Moku API Synchronization (Future - Out of Scope for Epic 2):**
- Branch metadata (`parentMessageId`, `branchIndex`) must sync to cloud
- Requires conflict resolution strategy for concurrent branch creation across devices
- Deferred to post-MVP Phase 3

**2. AI Service Integration (Existing):**
- Context assembly changes: include sibling branch metadata for AI awareness
- No API changes required to existing AI service interface
- Title generation uses same AI service endpoint

**3. File Attachments (Epic 5 dependency):**
- Clipboard paste with images requires File Service from E5-S1
- Branch creation with attachments requires attachment handling from E5
- **Mitigation:** E2-S6 (Paste Operations) can be implemented with text-only paste initially, image paste added when E5 complete

**4. Desktop Core Services:**
- Notification system (E4-S1): notify user when title auto-generated
- State persistence (E4-S2): cache invalidation for branch operations
- No blocking dependencies, graceful degradation if services unavailable

## Acceptance Criteria (Authoritative)

**AC-1: Message Tree Structure (E2-S1)**
- [ ] `desktop_messages` table has `parent_message_id` column (TEXT, nullable, FK to desktop_messages.id)
- [ ] `desktop_messages` table has `branch_index` column (INTEGER, default 0, CHECK constraint: IN (0-9))
- [ ] `desktop_messages` table has `deleted_at` column (INTEGER, nullable) for soft deletes
- [ ] Indexes created: `idx_messages_parent`, `idx_messages_thread_tree`, `idx_messages_deleted`
- [ ] MessageRepository.getSiblingBranches(parentMessageId) returns all non-deleted messages with same parent (WHERE deleted_at IS NULL)
- [ ] MessageRepository.getPathToRoot(messageId) returns ancestor chain excluding siblings and soft-deleted messages
- [ ] MessageRepository.softDelete(messageId) sets deleted_at timestamp, removes from UI but preserves in database
- [ ] Soft-deleted messages excluded from all tree queries (getSiblingBranches, getMessageTree, getPathToRoot)
- [ ] Soft-deleted messages remain queryable for audit/compliance via direct database access
- [ ] Context assembly includes path to root, sibling branches excluded from full content (metadata only)
- [ ] ThreadCache updated to handle branch-aware invalidation

**AC-2: Prompt Variation Button and Branch Creation (E2-S2)**
- [ ] "Create Variation" button appears on hover over any user message
- [ ] Clicking "Create Variation" opens prompt editor pre-filled with original prompt text
- [ ] Attachments from original message carried forward by default in editor
- [ ] User can edit prompt and modify attachments before submitting prompt variation
- [ ] Branch creation validates limit: if 2 siblings exist, show error "Maximum 9 variation branches per message"
- [ ] New branch assigned branchIndex = count of existing siblings (0-9)
- [ ] User message created with correct parentMessageId and branchIndex
- [ ] AI response saved with parentMessageId = new user message ID, branchIndex = 0
- [ ] Full prompt variation flow completes in <2 seconds (excluding AI generation time)

**AC-3: Branch Visualization UI (E2-S3)**
- [ ] Branched messages render in separate vertical lanes (side-by-side layout)
- [ ] Maximum 10 lanes visible simultaneously (original + 9 variations)
- [ ] Lane scrolling maintains 60fps performance (measured via DevTools)
- [ ] Active branch visually highlighted with border or background color
- [ ] User can click to switch between branches
- [ ] Lane rendering uses react-window for virtualization
- [ ] Graceful fallback to linear view if BranchVisualization component crashes

**AC-4: Auto-Title Generation (E2-S4)**
- [ ] Title generation triggers automatically after exactly 2nd user message in thread
- [ ] Title generated via AI call using first 2 exchanges (4 messages total)
- [ ] Title maximum 50 characters, truncated with "..." if longer
- [ ] Fallback to "New Thread" if AI generation fails or times out (>3s)
- [ ] Thread list UI updates within 1 second of title generation
- [ ] No UI blocking during title generation (async operation)
- [ ] Success rate metric tracked: `title.generation.success_rate`

**AC-5: Clipboard Copy Operations (E2-S5)**
- [ ] Copy-to-input button copies message text to input field
- [ ] Copy-to-clipboard button copies message as plain text to system clipboard
- [ ] Copy code block button preserves syntax and language identifier
- [ ] All copy operations complete in <100ms
- [ ] User receives visual feedback (toast/notification) on successful copy

**AC-6: Clipboard Paste Operations (E2-S6)**
- [ ] Paste text inserts into input field at cursor position
- [ ] Paste image creates attachment preview (requires E5 File Service)
- [ ] Paste validates file types against allowlist (images: png/jpg/gif, PDFs)
- [ ] Paste sanitizes HTML content to prevent XSS attacks
- [ ] Executable files, scripts, and unknown MIME types rejected with error message
- [ ] Paste error logging: `clipboard.paste.errors` metric by type

## Traceability Mapping

| AC ID | PRD Reference | Spec Section | Component/API | Test Approach |
|-------|---------------|--------------|---------------|---------------|
| AC-1 | PRD §3.2.2 (Message tree) | Data Models §4.2 | MessageRepository, desktop_messages schema | Unit: tree query tests (getSiblingBranches, getPathToRoot)<br>Integration: E2E message creation with parent relationships |
| AC-2 | PRD §3.2.2 (Prompt variation button) | APIs & Workflows §4.3, §4.4 | ThreadService.submit(), BranchLimitCheck | Unit: branch validation logic, limit enforcement<br>Integration: Full prompt variation flow with prompt editing<br>E2E: UI click → branch creation → AI response |
| AC-3 | Architecture §8.1 (Lane UI) | Services §4.1 | BranchVisualizationUI component, react-window | Visual regression tests (Percy/Chromatic)<br>Performance: FPS monitoring during scroll (Lighthouse) |
| AC-4 | PRD §3.2.2 (Auto-title) | Workflows §4.4 | AutoTitleService, AI integration | Unit: title generation with mocked AI<br>Integration: trigger after 2nd message<br>E2E: verify title appears in thread list |
| AC-5 | PRD §3.2 (Clipboard) | APIs §4.3 | ClipboardService.copy*() methods | Unit: clipboard API mocks<br>Manual: actual system clipboard verification |
| AC-6 | PRD §3.2 (Paste), FS §3.2 | APIs §4.3 | ClipboardService.handlePaste() | Unit: XSS sanitization with malicious inputs<br>Integration: file type validation<br>Security: fuzzing with various MIME types |

## Risks, Assumptions, Open Questions

**Risks:**

1. **RISK:** Deep message trees (>10 levels) may cause performance degradation in context assembly
   - **Impact:** High - affects core prompt variation functionality
   - **Mitigation:** Monitor tree depth metrics, alert if >5 levels; implement context window limits for AI

2. **RISK:** Concurrent branch creation across devices (when Moku API sync added) could create conflicts
   - **Impact:** Medium - data consistency issues
   - **Mitigation:** Deferred to Phase 3; design conflict resolution strategy before cloud sync implementation

3. **RISK:** Branch visualization UI complexity may delay Epic 2 delivery
   - **Impact:** Medium - affects timeline
   - **Mitigation:** Start E2-S3 early with prototype; consider phased rollout (linear view with branch indicators first, lanes later)

4. **RISK:** React-window dependency adds new external package, potential security/maintenance burden
   - **Impact:** Low - standard package with good maintenance
   - **Mitigation:** Evaluate alternatives (react-virtualized, custom implementation) during E2-S3 spike

**Assumptions:**

1. **ASSUMPTION:** Users will rarely create more than 2-3 variation branches per message (hence limit of 2)
   - **Validation:** Track branch creation patterns in Alpha; adjust limit if needed

2. **ASSUMPTION:** Title generation via AI will succeed >95% of the time
   - **Validation:** Monitor `title.generation.success_rate` metric; implement better fallback if needed

3. **ASSUMPTION:** SQLite transaction performance sufficient for concurrent branch operations
   - **Validation:** Load testing during E2-S2 implementation

4. **ASSUMPTION:** Epic 1 database schema migration will include parent_message_id and branch_index columns
   - **Validation:** Coordinate with E1-S1 developer; confirm schema design before E2 starts

**Open Questions:**

~~1. **QUESTION:** Should branch limit be configurable per user/organization, or hardcoded at 2?~~
   - **DECISION:** Hardcoded at 2 branches maximum per message
   - **Decided by:** Product review (2025-11-27)
   - **Rationale:** Users can compare more than 2 options sequentially (essentially 2 at a time). Limiting to 2 simplifies UX and prevents overwhelming branch complexity. Sequential comparison pattern: compare branches 1 & 2, pick winner, create new branch from winner to compare against another option.
   - **Implementation:** Enforce max 2 siblings via branch limit validation (existing design already implements this)

~~2. **QUESTION:** How should context assembly handle very deep trees (>10 levels)? Truncate oldest branches?~~
   - **DECISION:** No special handling needed for deep trees
   - **Decided by:** Architecture review (2025-11-27)
   - **Rationale:** A branch becomes less interesting the deeper it gets (natural user behavior - users stop exploring uninteresting branches). Branches are simply threads, so "depth" is not a technical concern. No truncation or special logic required - standard context assembly (path to root) handles all depths efficiently.
   - **Implementation:** No changes needed; existing tree traversal (`getPathToRoot()`) handles arbitrary depth

~~3. **QUESTION:** Should we show "branch created" notifications to user, or silent operation?~~
   - **DECISION:** NO notifications - silent operation
   - **Decided by:** UX review (2025-11-27)
   - **Rationale:** Since the user is explicitly creating branches via "Create Variation" button, no notification needed. User action → immediate visual feedback (new branch appears in UI) is sufficient. Notification would be redundant and noisy.
   - **Implementation:** No notification system integration required for branching

~~4. **QUESTION:** What happens to branches when original message deleted? Cascade delete or preserve orphaned branches?~~
   - **DECISION:** Soft delete - remove from UI display and hierarchy, preserve in database
   - **Decided by:** Architecture review (2025-11-27)
   - **Rationale:** Request-response pairs stay in LLM database for audit/compliance. Soft delete removes branch from UI and hierarchy (`deleted_at` timestamp set), but message records remain queryable for audit logs. This approach maintains data integrity while cleaning up UI.
   - **Implementation:** Add `deleted_at` column to `desktop_messages` table; filter queries by `WHERE deleted_at IS NULL`; UI "delete" sets `deleted_at = NOW()`, doesn't remove database rows

## Test Strategy Summary

**Test Levels:**

**1. Unit Tests (Target: 85% coverage)**
- **MessageRepository tree queries:**
  - `getSiblingBranches()` returns correct siblings, excludes soft-deleted messages
  - `getPathToRoot()` returns ancestor chain, excludes siblings and soft-deleted messages
  - Edge cases: orphaned messages, circular references (should be impossible but test defense)
- **Soft delete operations:**
  - `softDelete()` sets deleted_at timestamp correctly
  - Soft-deleted messages excluded from getSiblingBranches() and getPathToRoot()
  - Soft-deleted messages remain in database (SELECT without WHERE deleted_at IS NULL filter)
  - `restoreDeleted()` clears deleted_at timestamp (restore functionality)
- **Branch limit validation logic:**
  - Correctly counts existing siblings (excludes soft-deleted siblings)
  - Rejects 3rd branch attempt
  - Handles concurrent branch creation
- **Context assembly algorithm (CRITICAL):**
  - Test with various tree shapes: linear, wide (many siblings), deep (>5 levels)
  - Verify sibling metadata included, full content excluded
  - Performance: <500ms for 100-message threads
- **Title generation:**
  - Mock AI responses
  - Test truncation (>50 chars)
  - Test fallback on AI failure
- **Clipboard sanitization:**
  - XSS attack vectors: `<script>`, `javascript:`, `onerror=`
  - File type validation: accept images/PDFs, reject executables

**2. Integration Tests**
- **Full prompt variation flow:** UI click → validation → branch creation → AI call → UI update → verify state
- **Auto-title trigger:** Create 2nd message → verify title generated → verify UI updated
- **Cache invalidation:** Create branch → verify cache cleared → verify fresh data loaded
- **SQLite transaction rollback:** Simulate AI failure → verify no orphaned user messages
- **Cross-epic integration:** Branch creation with attachments (when E5 complete)

**3. E2E Tests (Playwright)**
- **Happy path:** User creates prompt variation, edits prompt, receives new response in new lane
- **Branch limit:** User creates 2 variations successfully, 3rd shows error message
- **Branch visualization:** Verify 3 lanes render, user can switch between them, scroll works
- **Copy/paste operations:** Copy message to clipboard, paste into new thread, verify content
- **Thread sync:** Branch created → syncs to Moku API (when cloud sync implemented)

**4. Performance Tests**
- **Benchmark tree retrieval:** Measure P50/P95/P99 for threads with 10/50/100 messages
- **FPS monitoring:** Record lane scrolling performance via DevTools Performance panel
- **Branch creation latency:** Measure end-to-end from click to UI update (exclude AI time)
- **Stress test:** Create 100 threads with 3 branches each, measure system impact

**5. Property-Based Tests (fast-check library)**
- **Generate random valid message trees:**
  - Random depth (1-15 levels)
  - Random branching factor (0-2 siblings per message)
  - Verify no cycles, no orphans, no invalid branchIndex
- **Verify context assembly invariants:**
  - Path to root always contains exactly N messages (where N = tree depth)
  - No duplicate messages in path
  - Sibling branches never in path content
- **Verify branch index constraints:**
  - branchIndex always 0-9
  - No gaps (if branchIndex 2 exists, branchIndex 1 also exists)

**Test Frameworks & Tools:**
- **Vitest** - Unit and integration tests
- **Playwright** - E2E tests
- **fast-check** - Property-based testing
- **Lighthouse CI** - Performance regression detection
- **Percy/Chromatic** - Visual regression testing for lane UI
- **DevTools Performance API** - FPS measurement

**Edge Cases to Test:**

1. **Deep trees (>10 levels):** Verify no stack overflow, acceptable performance
2. **Concurrent branch creation:** Two users create variations of same message simultaneously
3. **Soft delete edge cases:**
   - Soft delete message with child branches → children become orphaned in UI but remain in database
   - Soft delete parent message → descendants excluded from tree queries
   - Restore soft-deleted message → message reappears in UI hierarchy
   - Branch limit validation counts only non-deleted siblings (deleted sibling doesn't count toward limit of 2)
   - Query audit log for soft-deleted messages → messages still accessible for compliance
4. **Clipboard edge cases:**
   - Empty clipboard
   - Malformed HTML
   - Extremely large paste (>1MB)
   - Binary files disguised as text
5. **Title generation edge cases:**
   - AI timeout (>3s)
   - AI returns empty string
   - AI returns >50 chars
   - Network failure during title generation
6. **SQLite edge cases:**
   - Database locked during branch creation
   - Disk full during write
   - Foreign key constraint violation

**Test Data Strategy:**
- **Synthetic tree generator:** Create deterministic test trees with known properties
- **Real-world samples:** Export actual thread trees from Alpha testing for regression tests
- **Mutation testing:** Use Stryker to verify test quality (target: 80% mutation score)

**Continuous Integration:**
- All tests run on every PR
- E2E tests run on staging before production deploy
- Performance tests run nightly, alert on >10% regression
- Visual regression tests require manual approval for intentional UI changes

**Definition of Done for Epic 2:**
- All unit tests pass (85%+ coverage)
- All integration tests pass
- All E2E tests pass in Chrome, Firefox, Safari
- Performance benchmarks meet targets (tree queries <200ms, UI 60fps)
- Security tests pass (XSS sanitization, file validation)
- Visual regression tests approved
- No P0/P1 bugs open

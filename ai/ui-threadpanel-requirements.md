# Thread Component Requirements

**Version:** 1.3
**Date:** 2026-01-27
**Status:** Approved
**Source Documents:**
- `thread-component-implementation.md`
- `thread-repository-implementation-impact.md`
- `chat-component-redesign-notes.md`

---

## Table of Contents

1. [Functional Requirements](#1-functional-requirements)
2. [Non-Functional Requirements](#2-non-functional-requirements)
3. [Use Cases & Scenarios](#3-use-cases--scenarios)
4. [Questions & Answers](#4-questions--answers)
5. [Risk Assessment](#5-risk-assessment)
6. [Open Questions](#6-open-questions)
7. [Success Criteria](#7-success-criteria)
8. [Migration Requirements](#8-migration-requirements)

---

## 1. Functional Requirements

### 1.1 Core Thread Component Requirements

| ID | Requirement | Priority | Status | Source |
|----|-------------|----------|--------|--------|
| **FR-001** | Replace 3,437-line ChatPane.svelte with modular architecture (~800 line orchestrator) | HIGH | Planned | Implementation |
| **FR-002** | Support 5 distinct thread views: Chat, Execution, Branching, Prompt, File | HIGH | Planned | Implementation |
| **FR-002a** | Multiple views can be displayed simultaneously within layout system | HIGH | Planned | Architecture Overview (1.3) |
| **FR-002b** | Only one instance of each view type can be displayed per layout | HIGH | Planned | Architecture Overview (1.3) |
| **FR-003** | Implement thread status indicator with connection/model feedback | MEDIUM | Planned | Implementation |
| **FR-003a** | Display text, images, video, and audio content in views | HIGH | Planned | Architecture Overview (1) |
| **FR-004** | Enable keyboard toggle between old and new implementations (Cmd/Ctrl-Shift-T) | HIGH | Planned | Implementation |
| **FR-005** | Maintain full feature parity with existing ChatPane functionality | CRITICAL | Planned | Implementation |
| **FR-006** | Support project breadcrumb navigation | MEDIUM | Planned | Implementation |
| **FR-007** | Desktop-only support (no tablet/mobile) | HIGH | Confirmed | Implementation |
| **FR-008** | Threads loaded paged at 50 per page, all cached | HIGH | Confirmed | Implementation |
| **FR-009** | Messages loaded and cached per thread | HIGH | Confirmed | Implementation |

### 1.2 Thread Chat View Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| **FR-101** | Display messages in branch hierarchy order (not timestamp) | CRITICAL | Planned |
| **FR-102** | Support streaming responses with token-by-token display | CRITICAL | Planned |
| **FR-103** | Enable prompt variation creation (max 2 lanes) | HIGH | Planned |
| **FR-104** | Enable model variation creation (up to 9 models) | HIGH | Planned |
| **FR-105** | Show "Continue With This Branch" button at bottom of each lane | HIGH | Confirmed |
| **FR-106** | Display branch status (Open/Closed) in branch header | MEDIUM | Planned |
| **FR-107** | Display branch type (Model/Prompt variation) in branch header | MEDIUM | Planned |
| **FR-108** | Show "Show Branch" button for closed branches (read-only) | MEDIUM | Planned |
| **FR-109** | User can switch views during active streaming | HIGH | Confirmed |
| **FR-110** | User can switch threads during active streaming | HIGH | Confirmed |
| **FR-111** | Scroll position persists when switching views | MEDIUM | Confirmed |
| **FR-112** | Render markdown content in assistant responses with syntax highlighting | HIGH | Planned |
| **FR-113** | Allow toggling visibility of branches at each fork point | HIGH | Planned |
| **FR-114** | Maintain scroll position when new messages arrive (auto-scroll only if at bottom) | MEDIUM | Planned |
| **FR-115** | Provide message composer for sending new prompts | CRITICAL | Planned |
| **FR-116** | Handle streaming timeouts with appropriate error display | HIGH | Planned |

### 1.3 Thread Execution View Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| **FR-201** | Only available for project threads | CRITICAL | Confirmed |
| **FR-202** | No special permissions required | MEDIUM | Confirmed |
| **FR-203** | Instruction file format: Markdown (.md) | HIGH | Confirmed |
| **FR-204** | Instruction file fields: title, description, prompt variables, input files, outputs, tools used | HIGH | Confirmed |
| **FR-205** | Instruction file can be empty (not required) | MEDIUM | Confirmed |
| **FR-206** | Instruction file stored in project file list (shared with all project members) | HIGH | Confirmed |
| **FR-207** | Show past 15 executions in history | HIGH | Confirmed |
| **FR-208** | Execution data stored in desktop_thread table with thread_parent_id | HIGH | Confirmed |
| **FR-209** | Variable scale graph: 14 days=daily, 70 days=weekly, 356 days=monthly | MEDIUM | Confirmed |
| **FR-210** | Graph shows up to past year of execution data | MEDIUM | Confirmed |
| **FR-211** | Display editable instruction file with markdown syntax highlighting | HIGH | Planned |
| **FR-212** | Provide Run button to execute all prompts with instruction file prepended | HIGH | Planned |
| **FR-213** | Provide Stop button to abort running execution | HIGH | Planned |
| **FR-214** | Show execution progress indicator while running | MEDIUM | Planned |
| **FR-215** | Record execution results (success, error, stopped) with duration and timestamp | HIGH | Planned |
| **FR-216** | Allow selecting a history record to view execution details | MEDIUM | Planned |
| **FR-217** | Support aborting execution mid-stream via AbortController | HIGH | Planned |

### 1.4 Thread Branching View Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| **FR-301** | SVG-based graphical visualization of thread structure | HIGH | Planned |
| **FR-302** | Show branch points and branch selections | HIGH | Planned |
| **FR-303** | Display model names, prompt/response times, tokens | MEDIUM | Planned |
| **FR-304** | Click node → navigate to Thread Chat View at that message | HIGH | Planned |
| **FR-305** | Support zoom and pan controls | MEDIUM | Planned |
| **FR-306** | Future: Floating side panel in Thread Chat View | LOW | Future |
| **FR-307** | Support 5 zoom levels: Overview, Branch, Message, Detail, and Inspect | HIGH | Planned |
| **FR-308** | Highlight selected node and show detail panel with full message content | HIGH | Planned |
| **FR-309** | Display tool call inputs and outputs at Inspect zoom level | MEDIUM | Planned |
| **FR-310** | Show message status indicators (complete, error, streaming) at all zoom levels | MEDIUM | Planned |
| **FR-311** | Fit-to-view button to auto-scale graph to viewport | MEDIUM | Planned |
| **FR-312** | Support keyboard shortcuts for zoom, pan, and navigation | MEDIUM | Planned |

### 1.5 Thread Prompt View Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| **FR-401** | Show only user prompts in compact bullet form | HIGH | Planned |
| **FR-402** | Click prompt → expand to show responses inline | HIGH | Planned |
| **FR-403** | Click branch/lane/closure → navigate to Thread Chat View at branch point | HIGH | Confirmed |
| **FR-404** | "Expand All" and "Collapse All" controls | MEDIUM | Planned |

### 1.6 Thread Layout System Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| **FR-501** | Support flexible layout system allowing multiple views to be arranged | HIGH | Planned |
| **FR-502** | Support side-by-side view arrangement (e.g., Chat View + Branching View) | HIGH | Planned |
| **FR-503** | Enforce one-instance-per-view-type constraint (only one Chat View at a time) | HIGH | Planned |
| **FR-504** | Remember user's view layout preferences across sessions | MEDIUM | Planned |
| **FR-505** | Support dragging views to reorder or resize panes | MEDIUM | Planned |
| **FR-506** | Support collapsing/hiding views to maximize active view | MEDIUM | Planned |

### 1.7 Thread Status Indicator Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| **FR-601** | Display 3 circles showing connection/model interaction state | HIGH | Planned |
| **FR-602** | Thread-level status (not per-message) | HIGH | Confirmed |
| **FR-603** | Circle 1 green when any prompt is being sent | HIGH | Confirmed |
| **FR-604** | Circle 2 blue when any response is being received | HIGH | Confirmed |
| **FR-605** | Circle 3 red on error | HIGH | Confirmed |
| **FR-606** | Error state persists until next prompt is issued by user | HIGH | Confirmed |
| **FR-607** | Support states: idle, connecting, sending, receiving, tool-executing, error | HIGH | Planned |

### 1.8 Branch ID Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| **FR-701** | All branch IDs **must** use 4-digit format: row.lane.message.tool_sequence | CRITICAL | Confirmed |
| **FR-702** | Branch IDs **must** be unique within a thread | CRITICAL | Confirmed |
| **FR-703** | Branch IDs **must** support numeric ordering (not lexicographic) | HIGH | Confirmed |
| **FR-704** | Branch IDs **must** be stored in PostgreSQL ltree format | HIGH | Confirmed |
| **FR-705** | System **must** support up to 9 lanes per branch point | MEDIUM | Confirmed |
| **FR-706** | System **must** support unlimited messages per lane | MEDIUM | Confirmed |
| **FR-707** | System **must** support unlimited tool iterations per message | MEDIUM | Confirmed |
| **FR-708** | Branch IDs **must** be immutable once created | HIGH | Confirmed |
| **FR-709** | Row numbering: 1-based (first message = row 1) | HIGH | Confirmed |
| **FR-710** | Lane numbering: 0-based (0 = main, 1-9 = variations) | HIGH | Confirmed |
| **FR-711** | Message numbering: 0-based (position within lane) | HIGH | Confirmed |
| **FR-712** | Tool iteration numbering: 0-based (0 = no tools) | HIGH | Confirmed |

### 1.9 Message Interface Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| **FR-801** | `branchId` field must be 4-digit format (BREAKING CHANGE from 3-digit) | CRITICAL | Planned |
| **FR-802** | `clientMessageId` must be required (BREAKING CHANGE from optional) | HIGH | Planned |
| **FR-803** | `syncState` field must be added (NEW) | HIGH | Planned |
| **FR-804** | `apiId` field should be added (NEW, optional) | MEDIUM | Planned |

### 1.10 Message Synchronization Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| **FR-901** | Fetch last 50 messages from API for partial sync | HIGH | Planned |
| **FR-902** | Match local messages to API messages by clientMessageId | CRITICAL | Planned |
| **FR-903** | Replace local message with API version when match found | CRITICAL | Planned |
| **FR-904** | Preserve local-only messages that weren't matched | CRITICAL | Planned |
| **FR-905** | Never delete local messages during sync | CRITICAL | Planned |
| **FR-906** | Handle sync failures gracefully | HIGH | Planned |
| **FR-907** | Support offline message creation | HIGH | Planned |

---

## 2. Non-Functional Requirements

### 2.1 Performance Requirements

| ID | Requirement | Priority | Target |
|----|-------------|----------|--------|
| **NFR-001** | Message refresh: 95% less data fetched (50 msgs vs 1000 msgs) | HIGH | Confirmed |
| **NFR-002** | Sync latency: < 500ms for 50 messages | HIGH | Target |
| **NFR-003** | Memory per message: +10% acceptable (5KB → 5.5KB) | MEDIUM | Acceptable |
| **NFR-004** | Timeline generation: No worse than O(n log n) | HIGH | Maintained |
| **NFR-005** | Support threads with 1000+ messages without degradation | HIGH | Required |
| **NFR-006** | Main orchestrator: ~800 lines (80% reduction from 3,437) | MEDIUM | Target |

### 2.2 Accessibility Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| **NFR-101** | WCAG 2.1 Level AA compliance | HIGH | Open Issue |
| **NFR-102** | Keyboard navigation for all interactive elements | HIGH | Open Issue |
| **NFR-103** | Screen reader support with ARIA labels | HIGH | Open Issue |
| **NFR-104** | Proper focus management in modals | HIGH | Planned |
| **NFR-105** | Color contrast: 4.5:1 minimum for text | HIGH | Required |
| **NFR-106** | Respect `prefers-reduced-motion` for animations | MEDIUM | Planned |

### 2.3 Browser/Platform Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| **NFR-201** | Desktop-only (no tablet/mobile support) | CRITICAL | Confirmed |
| **NFR-202** | Minimum width: 1024px (horizontal scroll if narrower) | MEDIUM | Recommended |
| **NFR-203** | Support Electron runtime | CRITICAL | Required |
| **NFR-204** | No analytics tracking on toggle | LOW | Confirmed |

### 2.4 Code Quality Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| **NFR-301** | 95% unit test coverage target | HIGH | Target |
| **NFR-302** | All critical paths covered by E2E tests | HIGH | Required |
| **NFR-303** | Full TypeScript types throughout | HIGH | Required |
| **NFR-304** | All business logic extracted to testable services | HIGH | Required |
| **NFR-305** | Pure functions where possible in services | MEDIUM | Preferred |

---

## 3. Use Cases & Scenarios

### 3.1 Basic Message Flow

**UC-001: Send Message and Receive Response**

**Primary Actor:** User

**Preconditions:**
- Thread is open in Chat View
- User has composed a message

**Main Flow:**
1. User types message in composer
2. User presses Send
3. System displays user message with branchId "N.0.0.0" (where N = next row)
4. Thread Status Indicator shows Circle 1 green (sending)
5. System creates local message with `syncState: LOCAL_ONLY` and `clientMessageId`
6. System caches message in thread repository
7. System sends message to API with branchId
8. Thread Status Indicator changes to Circle 2 blue (receiving)
9. System displays streaming response tokens as received
10. Thread Status Indicator returns to idle
11. System caches assistant response locally
12. System triggers background sync to replace local message with API version

**Postconditions:**
- Message displayed in thread timeline
- Message cached locally with `syncState: SYNCED`
- Thread ordered by branch hierarchy

---

### 3.2 Branch Variation Creation

**UC-002: Create Prompt Variation**

**Primary Actor:** User

**Preconditions:**
- Thread has at least one prompt-response pair
- User wants to try a different prompt

**Main Flow:**
1. User clicks "branch" icon under prompt at row N
2. System displays VariationModal with two options: Prompt Branch, Model Branch
3. User selects "Prompt Branch"
4. System shows current prompt text in editable field
5. User modifies prompt text
6. User clicks "Create Branch"
7. System creates lane 1 at row N with branchId "N.1.0.0"
8. System displays branch with 2 lanes:
   - Lane 0: Original prompt + response
   - Lane 1: Modified prompt (no response yet)
9. System enables input in lane 1
10. User can continue entering prompts in either lane
11. User selects "Continue With This Branch" in lane 1
12. System closes branch (status → Closed)
13. System continues thread using lane 1 context

**Postconditions:**
- Branch created at row N with 2 lanes
- Branch closed after selection
- "Show Branch" button available to view read-only history

---

**UC-003: Create Model Variation**

**Primary Actor:** User

**Preconditions:**
- Thread has at least one prompt-response pair
- User wants to compare different models

**Main Flow:**
1. User clicks "branch" icon under prompt at row N
2. System displays VariationModal
3. User selects "Model Branch"
4. System displays list of available models (up to 9)
5. User selects 3 models: GPT-4, Claude Sonnet, Gemini
6. System creates 3 lanes at row N:
   - Lane 0 (N.0.0.0): GPT-4
   - Lane 1 (N.1.0.0): Claude Sonnet
   - Lane 2 (N.2.0.0): Gemini
7. System copies prompt to all lanes
8. User can edit prompt in any lane before pressing "Send"
9. User presses "Send" in all lanes (or selectively)
10. System streams responses in parallel
11. Thread Status Indicator shows green (sending) while any lane sending
12. Thread Status Indicator shows blue (receiving) while any lane receiving
13. User reviews responses from all models
14. User selects "Continue With This Branch" in lane 2 (Gemini)
15. System closes branch
16. System adopts Gemini as model for future messages

**Postconditions:**
- Branch created with 3 model variations
- Branch closed after model selection
- Thread continues with selected model

---

### 3.3 Tool Iteration Tracking

**UC-004: Message with Multiple Tool Calls**

**Primary Actor:** System (LLM)

**Preconditions:**
- User has sent prompt requiring tool usage
- Model supports tool calling

**Main Flow:**
1. User sends prompt: "Read config.json and validate it"
2. System assigns branchId "5.0.0.0" (row 5, main lane)
3. Model response indicates tool use: `read_file`
4. System creates tool message with branchId "5.0.0.1" (tool iteration 1)
5. System executes `read_file("config.json")`
6. System displays tool result under prompt
7. Model response indicates second tool use: `validate_json`
8. System creates tool message with branchId "5.0.0.2" (tool iteration 2)
9. System executes `validate_json(content)`
10. System displays validation result
11. Model generates final response
12. System creates assistant message with branchId "5.0.1.0" (next message in lane)
13. System displays final response

**Postconditions:**
- Messages ordered: 5.0.0.0 → 5.0.0.1 → 5.0.0.2 → 5.0.1.0
- Tool iterations tracked with 4th digit
- Timeline displays in correct order

---

### 3.4 Message Synchronization

**UC-005: Sync Local Messages with API**

**Primary Actor:** System (background process)

**Preconditions:**
- User has created messages locally
- Messages marked with `syncState: LOCAL_ONLY`

**Main Flow:**
1. System triggers sync after message send completes
2. System calls `syncRecentMessages(threadId, limit: 50)`
3. System fetches last 50 messages from Moku API
4. System builds map of local messages by clientMessageId
5. For each API message:
   - If `clientMessageId` matches local message:
     - Replace local message with API version
     - Update `syncState: SYNCED`
     - Set `apiId` to API message ID
     - Mark as synced
   - If no match found:
     - Add API message to thread (new message from another user)
     - Mark as synced
6. System preserves local-only messages without matches
7. System resorts messages by branch hierarchy
8. System updates UI to reflect synced state

**Postconditions:**
- Local messages matched to API versions
- New remote messages added
- Local-only messages preserved
- Timeline displays in correct order

**Exception Flow (Sync Failure):**
1. API call fails or times out
2. System logs error
3. System leaves messages as `LOCAL_ONLY`
4. System schedules retry
5. User can continue working offline

---

### 3.5 View Switching During Streaming

**UC-006: Switch Views While Streaming**

**Primary Actor:** User

**Preconditions:**
- Message is actively streaming in Chat View
- Response tokens being displayed

**Main Flow:**
1. User is viewing Chat View
2. Assistant response is streaming (Circle 2 blue)
3. User clicks "Branching View" tab
4. System persists Chat View scroll position
5. System switches to Branching View
6. Streaming continues in background
7. User explores branching visualization
8. User clicks "Chat View" tab
9. System restores scroll position
10. System displays completed response

**Postconditions:**
- Streaming completed successfully
- View switching did not interrupt stream
- Scroll position preserved

---

### 3.6 Thread Execution

**UC-007: Execute Thread with Instruction File**

**Primary Actor:** User (Project Member)

**Preconditions:**
- Thread belongs to a project
- Thread has instruction file created
- Thread has prompts to execute

**Main Flow:**
1. User opens Thread Execution View
2. System displays instruction file editor
3. System shows past 15 executions in history
4. System displays frequency graph
5. User reviews/edits instruction file
6. User clicks "Run" button
7. System disables "Run" button
8. System shows "Stop" button
9. System creates new thread with `thread_parent_id` = original thread
10. System prepends instruction file to system prompt
11. System executes each prompt in sequence:
    - Send prompt 1 → wait for response
    - Send prompt 2 → wait for response
    - Continue until all prompts executed
12. System creates execution record:
    - `executedAt`: timestamp
    - `executedBy`: current user email
    - `status`: 'success'
    - `duration`: milliseconds
13. System stores record in `desktop_thread` table
14. System updates execution history display
15. System updates frequency graph
16. System enables "Run" button

**Postconditions:**
- Execution record created
- History updated with new execution
- Graph updated with new data point

**Exception Flow (User Stops Execution):**
1. User clicks "Stop" button during execution
2. System aborts current prompt
3. System creates execution record with `status: 'stopped'`
4. System updates history

---

## 4. Questions & Answers

### 4.1 Resolved Questions

#### Q1: Thread Status Control Behavior
- **Q:** Does the status control show per-message status or thread-level status?
- **A:** Thread-level status
- **Q:** If streaming 3 variations in parallel, how are the circles shown?
- **A:** Any prompt shows green (circle 1), any response shows blue (circle 2)
- **Q:** Does error state persist or auto-dismiss?
- **A:** Error state persists until next prompt is issued by user

#### Q2: View Switching Behavior
- **Q:** When switching from Chat View to Branching View, does scroll position persist?
- **A:** Yes
- **Q:** Are views lazily instantiated or all mounted on load?
- **A:** No preference (implementation can decide)
- **Q:** Can user switch views during active streaming?
- **A:** **YES** - User can switch between views AND between threads during streaming

#### Q3: Thread Execution View Scope
- **Q:** Is this view only available for project threads?
- **A:** Yes
- **Q:** Does it require special permissions?
- **A:** No
- **Q:** Can instruction file be empty, or is it required?
- **A:** Not required (can be empty)

#### Q4: Branch ID Format
- **Q:** Is `.0` required or optional (e.g., "1.0" vs "1.0.0.0")?
- **A:** Branch ID **requires 4 digits** - all IDs must be in format `row.lane.message.tool_sequence`
- **Q:** How are branch IDs compared - lexicographically or numerically?
- **A:** Numerically (parse each component as integer)

#### Q5: Integration Strategy
- **Q:** Should there be analytics tracking when users toggle between old/new component?
- **A:** No
- **Q:** What's the eventual deprecation plan for old ChatPane?
- **A:** Delete it after migration complete

#### Q6: Data Fetching Strategy
- **Q:** How are threads loaded?
- **A:** Paged at 50 threads per page, all cached in thread repository
- **Q:** How are messages loaded?
- **A:** All messages for a thread loaded and cached when thread opened

#### Q7: Responsive Design
- **Q:** Should it support tablet/mobile?
- **A:** No, desktop-only

---

## 5. Risk Assessment

### 5.1 Thread Component Implementation Risks

| Risk ID | Risk | Likelihood | Impact | Mitigation |
|---------|------|------------|--------|------------|
| **R-001** | Complex branching logic breaks | HIGH | CRITICAL | Extensive testing, gradual rollout, keep ChatPane as fallback |
| **R-002** | Performance regression on large threads (1000+ msgs) | MEDIUM | HIGH | Performance testing with large datasets, optimization before rollout |
| **R-003** | Streaming reliability issues | MEDIUM | HIGH | Robust error handling, timeout management, testing with various models |
| **R-004** | Scope creep (especially Execution/Branching Views) | HIGH | MEDIUM | Prioritize Chat View, defer advanced features if needed |
| **R-005** | Timeline generation bugs | MEDIUM | HIGH | Extract to service, extensive unit tests, visual regression tests |
| **R-006** | Accessibility issues | MEDIUM | MEDIUM | Audit early and often, follow WCAG guidelines from start |
| **R-007** | User confusion with toggle mechanism | LOW | LOW | Toast notification, eventually remove toggle |
| **R-008** | Breaking changes in backend API | LOW | CRITICAL | API versioning, coordinate with backend team |

### 5.2 Thread Repository Migration Risks

| Risk ID | Risk | Likelihood | Impact | Mitigation |
|---------|------|------------|--------|------------|
| **R-101** | Incorrect branch ordering after migration | MEDIUM | HIGH | Extensive testing with real conversation trees |
| **R-102** | Sync merge bugs (local-to-API matching fails) | HIGH | HIGH | Comprehensive unit tests, staged rollout |
| **R-103** | Branch ID generation errors (invalid format) | MEDIUM | CRITICAL | Strict validation, fail fast on errors, extensive tests |
| **R-104** | Database migration failures | LOW | CRITICAL | Test migration on copy of production DB first, have rollback plan |
| **R-105** | Performance degradation from branch comparison | LOW | MEDIUM | Performance testing with 1000+ messages, caching |
| **R-106** | Lost messages during sync | LOW | CRITICAL | Never delete local messages, only replace matched ones |
| **R-107** | Timestamp-based code still present causing conflicts | MEDIUM | HIGH | Audit all code for timestamp manipulation, remove |
| **R-108** | UI generates 3-digit IDs instead of 4-digit | HIGH | CRITICAL | Update all message creation points, add validation |

### 5.3 Critical Success Factors

**Thread Component:**
1. ✅ ChatPane kept as fallback during development
2. ✅ Keyboard toggle works reliably
3. ✅ Streaming works across all views
4. ✅ Branch selection/navigation functions correctly
5. ✅ Performance matches or exceeds current ChatPane

**Thread Repository Migration:**
1. ✅ Database migration must complete successfully
   - Test on production copy first
   - Verify all messages converted to 4-digit
   - Have rollback plan ready
2. ✅ All code generating branch IDs must use 4-digit format
   - UI message creation
   - Branch variation creation
   - Tool iteration handling
   - Test coverage for all paths
3. ✅ Sync mechanism must be reliable
   - Never lose local messages
   - Handle API failures gracefully
   - Preserve offline messages
4. ✅ Message ordering must be correct
   - Tool iterations appear after their message
   - Branch variations grouped at same row
   - No out-of-order messages

---

## 6. Open Questions

### 6.1 High Priority (Need Resolution Before Implementation)

**OQ-001: Thread Status Control State Machine**
- What states beyond idle/sending/receiving/error are needed?
- How does it interact with tool execution tooltips?
- Should connecting/disconnected states be shown?
- **Recommendation:** Add connecting, tool-executing states; defer disconnected for now

**OQ-002: Error Recovery Flows**
- What happens if streaming stops mid-response?
- If branch creation fails?
- If sync with backend fails?
- If network loss during message send?
- **Recommendation:** Define in Phase 7 (Testing & Polish) after observing real failures

**OQ-003: Thread Status Control + Tool Execution**
- Should tool execution show specific tool name or generic "Running tool..."?
- Should tools have dedicated status indicator separate from main status?
- **Status:** Open

**OQ-004: Icon Selection for View Tabs**
- Specific icons for Chat, Execution, Branching, Prompt views?
- Icon size, spacing requirements?
- **Current:** Font/letter, Gear, Clock/stopwatch, Document icons
- **Status:** Needs final approval

### 6.2 Medium Priority (Can Be Decided During Implementation)

**OQ-005: Branching View Layout**
- Should layout be left-to-right or top-to-bottom?
- How to handle very wide branches (20+ lanes)?
- Should there be a "flatten" option for complex branches?
- **Recommendation:** Top-to-bottom with horizontal lanes, virtualize if >20 lanes

**OQ-006: Execution History Data Retention**
- How long should execution records be kept? (Past 15 shown, but total retention?)
- Should old records be automatically archived/deleted?
- **Recommendation:** Keep all records indefinitely, show most recent 15 in UI

**OQ-007: Responsive Design - Narrow Windows**
- What about narrow desktop windows (< 1024px)?
- **Recommendation:** Minimum width 1024px, horizontal scroll if narrower

**OQ-008: View Instantiation Strategy**
- Should views be lazily instantiated or all mounted on load?
- **Status:** No preference, implementation decides

### 6.3 Low Priority (Nice to Have)

**OQ-009: Floating Side Panel for Branching View**
- How should architecture accommodate future floating side panel?
- Is it just CSS, or does it need state management?
- **Status:** Future capability, defer for now

**OQ-010: Branch Ordering - Numeric vs Lexicographic**
- Confirmed numeric, but need clarity on ltree behavior
- **Status:** Documented in system-branching-id.md

---

## 7. Success Criteria

### 7.1 Functional Success Criteria

| Criterion | Description | Measurement |
|-----------|-------------|-------------|
| **SC-001** | Feature parity with ChatPane | All ChatPane features work in Thread Component |
| **SC-002** | 4-digit branch IDs working | All messages use 4-digit format, validation passes |
| **SC-003** | Message ordering correct | Messages display in branch hierarchy order, no out-of-order |
| **SC-004** | Sync mechanism reliable | Local messages sync to API, offline messages preserved |
| **SC-005** | All 4 views functional | Chat, Execution, Branching, Prompt views all work |
| **SC-006** | Branch creation works | Prompt and model variations create correctly |
| **SC-007** | Tool iterations tracked | Tool calls appear in correct order with 4th digit |
| **SC-008** | Thread execution works | Instruction file + execution history + graph functional |

### 7.2 Non-Functional Success Criteria

| Criterion | Description | Target |
|-----------|-------------|--------|
| **SC-101** | Code reduction | Main orchestrator ≤ 800 lines (vs 3,437 in ChatPane) |
| **SC-102** | Performance maintained | No regression on large threads (1000+ messages) |
| **SC-103** | Test coverage | ≥ 95% unit test coverage |
| **SC-104** | Accessibility compliance | WCAG 2.1 Level AA |
| **SC-105** | Migration success | Database migration completes with 0 data loss |
| **SC-106** | Sync performance | Partial sync < 500ms for 50 messages |

### 7.3 Go/No-Go Decision Criteria

**GO** if:
- ✅ Database migration tested successfully on production copy
- ✅ All unit tests pass (95%+ coverage)
- ✅ Performance tests show no degradation
- ✅ Rollback plan tested and ready
- ✅ Team has capacity for 10-week effort
- ✅ All HIGH priority requirements implemented
- ✅ Critical success factors met

**NO-GO** if:
- ❌ Database migration fails on test
- ❌ Performance issues detected (>20% regression)
- ❌ Team lacks capacity
- ❌ Critical bugs found in testing
- ❌ Data loss risk identified
- ❌ Accessibility blockers found

---

## 8. Migration Requirements

### 8.1 Database Migration

**MR-001: Branch ID Format Migration**
- **Requirement:** Convert all 3-digit branch IDs to 4-digit
- **Method:** Append `.0` to all existing branch IDs
- **SQL:**
  ```sql
  UPDATE messages
  SET branch_id = CONCAT(branch_id::text, '.0')::ltree
  WHERE nlevel(branch_id) = 3;
  ```
- **Validation:** Verify all messages have 4-digit branch IDs after migration
- **Rollback:** Restore from backup if issues found

**MR-002: Message Interface Fields**
- **Requirement:** Add `syncState`, `apiId` fields to existing messages
- **Default Values:**
  - `syncState`: Set to `SYNCED` for all existing messages (already on server)
  - `apiId`: Copy from `id` field
- **Priority:** HIGH

### 8.2 Code Migration

**MR-101: Remove Timestamp Manipulation**
- **Locations:**
  - `thread-repository.ts` lines 420-424
  - Any other timestamp hacks in codebase
- **Requirement:** Remove all timestamp manipulation code
- **Impact:** Messages ordered by branch ID, not timestamp

**MR-102: Update Branch ID Normalization**
- **Current:** `normalizeBranchId()` caps at 3 digits
- **New:** Validates 4-digit format, throws error if invalid
- **Priority:** CRITICAL

**MR-103: Update Message Creation**
- **Requirement:** All message creation must generate 4-digit branch IDs
- **Locations:**
  - UI message composition
  - Branch variation creation
  - Tool iteration handling
  - Thread execution
- **Priority:** CRITICAL

**MR-104: Update Message Sorting**
- **Current:** Sort by `createdAt` timestamp
- **New:** Sort by `branchId` numerically
- **Priority:** HIGH

### 8.3 UI Migration

**MR-201: Conditional Rendering**
- **Requirement:** Toggle between ChatPane and ThreadComponent via keyboard shortcut
- **Implementation:**
  ```typescript
  {#if $useNewThreadComponent}
    <ThreadComponent />
  {:else}
    <ChatPane />
  {/if}
  ```
- **Priority:** HIGH

**MR-202: Toast Notifications**
- **Requirement:** Show toast when toggling components
- **Messages:**
  - "Switched to new Thread Component (Beta)"
  - "Switched to legacy Chat Pane"
- **Priority:** LOW

### 8.4 Phased Rollout

**Phase 1: Database Migration** (Week 1)
1. Create database backup
2. Test migration script on production copy
3. Run migration on production (off-hours)
4. Verify all messages converted
5. Monitor for issues

**Phase 2: Code Deployment** (Week 2)
1. Deploy new code to staging
2. Test all critical paths
3. Run performance tests
4. Deploy to beta users (10%)
5. Monitor logs for errors

**Phase 3: Gradual Rollout** (Week 2-3)
1. 25% of users
2. Monitor sync errors, ordering issues
3. 50% of users
4. 100% of users

**Phase 4: Cleanup** (Week 4)
1. Remove temporary logging
2. Optimize performance
3. Document any issues found
4. Plan future enhancements

**Phase 5: ChatPane Removal** (Week 5+)
1. Make ThreadComponent default
2. Remove keyboard toggle
3. Delete ChatPane.svelte
4. Clean up unused code

### 8.5 Rollback Plan

**If Critical Issues Discovered:**

**Immediate Rollback:**
1. Revert code deployment
2. Restore database from backup (if needed)
3. Users lose any messages created during new version
4. Investigate issues

**Partial Rollback:**
1. Disable automatic sync (feature flag)
2. Keep branch ordering
3. Keep 4-digit branch IDs
4. Investigate sync-specific issues

**Prerequisites for Rollback:**
- ✅ Database backup tested and verified
- ✅ Rollback procedure documented
- ✅ Team trained on rollback process
- ✅ Feature flags implemented for critical features

---

## Appendix A: Requirement Traceability

| Source Document | Requirements Extracted | Status |
|-----------------|------------------------|--------|
| `thread-component-implementation.md` | FR-001 to FR-612, NFR-001 to NFR-305, R-001 to R-008, OQ-001 to OQ-010 | Complete |
| `thread-repository-implementation-impact.md` | FR-701 to FR-809, R-101 to R-108, MR-001 to MR-202 | Complete |
| `chat-component-redesign-notes.md` | FR-101 to FR-401, Use Cases | Complete |
| `system-branching-id.md` | FR-601 to FR-612 | Referenced |

---

## Appendix B: Definitions

| Term | Definition |
|------|------------|
| **Thread Component** | New modular architecture replacing ChatPane.svelte |
| **ChatPane** | Legacy 3,437-line monolithic component |
| **Branch ID** | Hierarchical identifier: row.lane.message.tool_sequence |
| **Row** | Position moving down thread (1-based) |
| **Lane** | Branch path at a row (0 = main, 1-9 = variations) |
| **Message** | Position within a lane (0-based) |
| **Tool Iteration** | Sequence of tool calls (0-based) |
| **Sync State** | Message synchronization status: LOCAL_ONLY, SYNCED, SYNC_FAILED |
| **Client Message ID** | Unique client-generated ID for idempotency |
| **Partial Sync** | Fetch last N messages (default 50) instead of full thread |

---

**End of Document**

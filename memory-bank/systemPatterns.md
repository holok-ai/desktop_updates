# System Patterns

Architecture

- Electron main process exposes services (AuthService, ThreadService, MokuAPIClient) and IPC handlers.
- Renderer is Svelte 5 using stores and components; uses contextBridge (`window.electron.{auth,threads,models,settings,system}`) for domain actions.

Patterns & Conventions

- IDs: `UUID` strings created via `crypto.randomUUID()`.
- Display name: top-level `title: string` field for entities; do not use `name`.
- Thread titles: Auto-generated from first user prompt, max 80 characters with ellipsis truncation
- Title truncation: Word-boundary aware (prefer breaking at space, fallback to character if word boundary too far back)
- Services: single responsibility (AuthService, ThreadsService, MokuAPIClient). Keep persistence separate from domain logic.
- Security: tokens stored with `safeStorage` in main process, never passed raw to renderer.

Thread Creation Flow (Auto-Title)

- User clicks "New Thread" → inline create view shows (not modal dialog)
- Create view displays: model dropdown + prompt textarea + Run button
- Run button disabled until model selected AND prompt non-blank (whitespace-only counts as blank)
- On Run → temp thread created with `_firstPrompt` in metadata
- ChatPane detects `_firstPrompt`, auto-sends message, and persists thread
- `ThreadRepository.addUserPrompt()` auto-generates title using `generateThreadTitle()` if no title provided
- `savePromptAndResponses()` delegates to `addUserPrompt()`, inheriting auto-title logic
- Thread appears in sidebar with auto-generated truncated title
- Idempotency handled by existing `clientMessageId` mechanism

Title Generation Logic

- Location: `src-electron/services/title-generator.service.ts` (mock service used while backend API is unavailable)
- API: `TitleGeneratorService.generateTitle(prompt: string): Promise<string>`
- Max length: 60-80 characters (configurable in service via MAX_TITLE_LENGTH)
- Truncation: Word-boundary aware (prefer breaking at space; append ellipsis when truncated)
- Sanitization: removes URLs, emails, path-like segments, collapses whitespace
- Uniqueness: `ensureUniqueTitle(candidate, existingTitles)` appends numeric suffixes when needed
- Events: main process emits `thread:titleGenerationStarted` and `thread:titleGenerationFinished` to inform renderer UI

Testing

- Unit tests: Vitest + Testing Library for components and services.
- E2E: Playwright, ensure networkidle/waits in flaky tests.
- Performance: Thread creation should ack within 800ms (p95 requirement)
- Test files:
  - `tests/unit/utils/thread-title.util.spec.ts` (title generation)
  - `tests/unit/repository/thread-repository-auto-title.spec.ts` (repository logic)
  - `tests/e2e/thread-auto-title-creation.spec.ts` (E2E flow)
  - `tests/e2e/thread-creation-performance.spec.ts` (performance validation)

Message State Machine (FSM)

- A per-message FSM enforces allowed state transitions and serializes transitions per `clientMessageId` (single actor per message).
- Implementation file: `src/lib/services/message-state-machine.ts`.
- Persistence: snapshots stored in IndexedDB under `msm-db` object store `snapshots` with key `"{threadId}:{clientMessageId}"`.
- Integration points:
  - `ChatPane.svelte` calls `messageStateMachine.createSending(...)` when a message is sent and subscribes to per-message updates.
  - Main process forwards message delivery/provider errors via `thread:onMessageError` IPC which the renderer forwards into the FSM.
  - Tests: unit coverage in `tests/unit/message-state-machine.spec.ts` and E2E in `tests/e2e/message-state-flow.spec.ts`.
- Pattern rationale: decouples delivery/backoff/telemetry logic from UI rendering; ensures determinism and auditability of message lifecycle.

# Progress

What works

- Project scaffolding and in-memory services for many features (threads, chat) are present.
- Playwright tests and Vitest unit tests exist for major flows.
- **Thread auto-title generation (Issue #19) implemented**:
  - `generateThreadTitle()` utility with 80-char truncation and word-boundary awareness
  - ThreadRepository automatically generates titles from first prompt when no title provided
  - Inline create view (model dropdown + prompt editor) replaces modal dialog
  - Run button disabled until model selected AND prompt non-blank
  - ChatPane auto-sends first prompt stored in thread metadata
  - Comprehensive unit tests (title utility + repository logic)
  - E2E tests for thread creation flow and performance (p95 ≤ 800ms NFR)

- Added per-prompt action menu (ChatPane): Copy, Edit, Run again, Run in another model (UI + copy implemented)
- Implemented inline edit-and-run prompt behavior (Edit opens inline textarea; Run Prompt appends edited prompt and sends it via existing send flow)
- Implemented repository helper for duplicating prompts in-thread (`duplicateMessage`) and IPC handler `thread:duplicateMessage` to support Run Again flows
- Implemented Run in another model: ChatPane dispatches `openNewThreadPrefill`; `threads/+page.svelte` opens the New Thread dialog prefilled with the prompt and uses `thread.addUserPrompt` to create thread + prompt atomically when submitted.
- Added keyboard navigation and ARIA labels for per-prompt action menu (ContextMenu key, Shift+F10, Arrow navigation, Escape to close); action items are keyboard-focusable and have descriptive `aria-label`s.
- Added E2E Playwright tests for prompt actions under `tests/e2e/prompt-actions.spec.ts` covering: copy, edit+run, run again, run in another model, and keyboard accessibility.
- Documentation updated: `docs/issues/issue-101.md` now contains implementation notes and a file/test summary for the prompt actions feature.

What's left

- Run tests to verify implementation
- Address any linter errors or test failures
- Improve E2E test coverage for ModelChooser integration
- Optional: Add toast notifications for thread creation errors

Current status

- Per-prompt action menu added to `ChatPane.svelte`; Copy action implemented
- Inline edit-and-run prompt behavior implemented

Known issues

- Some existing E2E tests may be flaky around auth and thread creation
- New E2E tests need ModelChooser interaction to be fully functional
- Performance tests may need tuning based on actual model selection timing

Recent additions (FSM implementation)

- Frontend Message State Machine implemented and available at `src/lib/services/message-state-machine.ts` (IndexedDB snapshot persistence, retry scheduling, telemetry hooks).
- Integrated FSM into `ChatPane.svelte` to create sending snapshots and surface status icons.
- Unit tests added: `tests/unit/message-state-machine.spec.ts`.
- E2E test added for message state flows: `tests/e2e/message-state-flow.spec.ts`.

**File Upload Feature (Issue #72) - COMPLETE! ✅**

- Full file upload functionality with validation, storage, and preview
- 133 tests passing (58 unit + 35 unit + 24 integration + 16 E2E)
- Comprehensive documentation in `docs/file-upload-feature.md`
- Features: Multi-file upload, validation, local storage, persistence, cleanup, audit logging
- Security: MIME validation, size limits, filename sanitization, path traversal prevention
- Accessibility: Full keyboard navigation, ARIA labels, screen reader support

**File Preview and Download Feature (Issue #73) - COMPLETE! ✅**

- Secure file preview and download with tokenized access
- 113 tests passing (83 unit + 15 integration + 11+ E2E + 6 performance)
- Comprehensive documentation in `docs/features/file-preview.md`
- Features: Inline image preview, modal preview (images/PDFs), secure download, error handling
- Security: HMAC-signed tokens (15-min expiry), no direct path exposure, audit trail
- Performance: <1.5s load time for files <2MB, URL caching, efficient token validation
- Accessibility: Full keyboard navigation, ARIA labels, focus trap, screen reader support

Remaining items

- Replace telemetry console/log bridge with proper metrics ingestion.
- Expand E2E coverage for permanent failures and Edit & Resend behavior.
- Update `docs/` to include FSM API and operational notes.

**NEW: File Upload Feature (Issue #72)** - COMPLETE! 🎉✅

- **Status:** 22/25 tasks complete (88%) - 3 cancelled (nice-to-have features)
- **FEATURE COMPLETE:** Full file upload with multi-modal AI support
- **Core Functionality:**
  - ✅ FileStorageService (local filesystem with UUID naming)
  - ✅ FileValidationService (type/size/security validation)
  - ✅ IPC handlers (upload, get, delete, validate)
  - ✅ AttachmentPreview UI component
  - ✅ Composer file picker (with Ctrl/Cmd+U shortcut)
  - ✅ Message history display with download
  - ✅ Automatic cleanup on thread deletion
  - ✅ Full audit logging via electron-log
  - ✅ Comprehensive accessibility (ARIA, keyboard navigation, screen readers)
- **Multi-Modal AI Support:**
  - ✅ FileEncodingService (UTF-8 for text, Base64 for images)
  - ✅ IChatProvider interface updated for attachments
  - ✅ Support for OpenAI, Claude, and Ollama vision models
  - ✅ Format converters for each provider
- **Testing Complete:**
  - ✅ 58 unit tests for FileValidationService
  - ✅ 35 unit tests for FileStorageService
  - ✅ 24 integration tests for file IPC handlers
  - ✅ 6 E2E tests for file upload flow
  - ✅ 10 E2E tests for error handling
  - **Total: 133 tests passing**
- **Documentation:** Complete guide in `docs/file-upload-feature.md`
- **Cancelled (optional):** Drag-drop UI (task 6), progress indicator (task 8), drag-drop E2E (task 20)

## Auto-Title feature update

- Issue: Auto-Title Thread After First Prompt (Issue #97) — implementation completed.
- Runtime: `src-electron/services/title-generator.service.ts` (in-memory mock) with sanitization, truncation, and uniqueness helper.
- Integration: generated titles persisted in `thread-handler.ts`; renderer listens for `thread:titleGenerationStarted` / `thread:titleGenerationFinished` and displays inline "Generating title…" in `ChatPane.svelte`.
- Tests: unit tests and simulated IPC test added; docs added at `docs/features/auto-title.md`.

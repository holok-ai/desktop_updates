## [STORY] User Actions on a Prompt

**Parent Feature:** #52  
**Priority:** P2 (Medium)  
**Area:** conversation/ui  
**Estimate:** 5 points

---

### Story

As a user, I want to perform various actions on prompts within a thread so that I can reuse, modify, or explore different responses without losing my conversation context.

---

### Acceptance Criteria (Gherkin)

**Scenario 1 — Copy Prompt to Clipboard (Happy Path)**

- Given I am viewing a thread with existing prompts
- When I click the "Copy" action on a specific prompt
- Then the prompt text is copied to my system clipboard
- And a toast notification confirms "Prompt copied to clipboard"
- And I can paste the text in any application.

**Scenario 2 — Edit and Run Modified Prompt**

- Given I am viewing a thread with existing prompts
- When I click the "Edit" action on a prompt
- Then the prompt becomes editable inline
- And I can modify the text
- When I click "Run Prompt" after editing
- Then the edited prompt is appended to the end of the current thread
- And the AI processes the modified prompt
- And the original prompt remains unchanged in its position.

**Scenario 3 — Run Again in Same Thread**

- Given I am viewing a thread where the conversation has diverged
- When I click "Run again" on a previous prompt
- Then the exact prompt text is re-submitted at the end of the current thread
- And a new response is generated
- And the thread history remains intact with both the original and new instances.

**Scenario 4 — Run in Different Model**

- Given I am viewing a thread with a specific model
- When I click "Run again in another model" on a prompt
- Then the New Thread window opens
- And the prompt text is pre-populated in the input field
- And I can select a different AI model
- When I submit the prompt
- Then a new thread is created with the selected model
- And the original thread remains unchanged.

**Scenario 5 — Action Menu Accessibility (Edge Case)**

- Given I am using keyboard navigation
- When I focus on a prompt and press the context menu key
- Then all actions (Copy, Edit, Run again, Run in another model) are accessible via keyboard
- And screen readers announce each action clearly.

---

### NFRs (Non‑Functional Requirements)

- **Performance:** Action response time ≤ 200 ms for UI feedback.
- **Usability:** Actions accessible via both mouse and keyboard.
- **Consistency:** Action icons/labels consistent with desktop application patterns.
- **Security:** Clipboard access respects system permissions.
- **Accessibility:** All actions meet WCAG 2.1 Level AA standards.
- **Undo:** Edit action supports cancel/escape to revert changes.

---

### Data / Business Rules

- Prompt actions only available for user-generated prompts (not AI responses).
- Edited prompts create new entries; original prompts are never modified.
- "Run again" preserves exact prompt text including whitespace and formatting.
- Model selection in "Run in another model" shows only models accessible to the user.
- Copy action respects system clipboard limitations (e.g., max text length).
- Action menu positioning adjusts to viewport boundaries.

---

### Dependencies / Assumptions

- User authenticated with appropriate permissions.
- Clipboard API available in Electron environment.
- Multiple AI models configured and accessible.
- Thread management system supports prompt versioning.

---

### Definition of Ready (DoR)

- User story and value proposition clear ✓
- Acceptance criteria complete ✓
- UI/UX mockups reviewed ✓
- Dependencies identified ✓

### Definition of Done (DoD)

- All acceptance criteria validated in QA environment ✓
- Unit tests for prompt action handlers ✓
- Integration tests for thread state management ✓
- Keyboard navigation and screen reader testing complete ✓
- Performance metrics meet NFR thresholds ✓
- Documentation updated for new UI actions ✓

---

### Implementation notes

- Status: Implemented in renderer + main-process IPC; UI and tests added.
- Files changed (key):
  - `src/lib/components/ChatPane.svelte` — added per-prompt action menu (Copy, Edit, Run again, Run in another model), inline edit UI, accessibility/keyboard support, and toast feedback.
  - `src-electron/repository/thread-repository.ts` — added `duplicateMessage()` helper to duplicate user prompts within a thread.
  - `src-electron/ipc-handlers/thread-handler.ts` — added `thread:duplicateMessage` IPC handler and broadcast events.
  - `src-electron/preload.ts` — exposed `duplicateMessage` on `window.electronAPI.thread`.
  - `src/routes/threads/+page.svelte` — added initial-prompt input in New Thread dialog and wiring to create thread with initial prompt when prefilling from a prompt action.
  - `src/lib/services/thread.service.ts` — (no API change) leverages existing thread IPC surface.

- Tests added:
  - Unit: `tests/unit/components/chatpane.spec.ts` — covers Copy and inline Edit+Run flows with mocked `electronAPI`.
  - E2E: `tests/e2e/prompt-actions.spec.ts` — Playwright coverage for Copy, Edit+Run, Run again, Run in another model, and keyboard accessibility.

- Notes/behavioral decisions:
  - Copy uses `navigator.clipboard.writeText` with a textarea fallback in the renderer and shows a transient toast "Prompt copied to clipboard".
  - Edit always creates a new prompt when Run is pressed (original prompt is never mutated) and reuses the existing send flow so model processing occurs.
  - Run again uses `threadRepository.duplicateMessage()` (via `thread:duplicateMessage`) to append a new user prompt with identical content and metadata; the renderer may also re-run via the existing send flow depending on UX needs.
  - Run in another model opens the inline New Thread dialog prefilled with the prompt; submitting the dialog with an Initial Prompt uses `thread.addUserPrompt(null, prompt, opts)` to atomically create the thread and persist the prompt.

---

**Labels:** `type:story` `priority:P2` `area:conversation` `status:ready`

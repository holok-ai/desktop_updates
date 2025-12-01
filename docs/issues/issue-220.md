## Simplify Thread Creation UI - Remove Title/Description Fields

**Priority:** P1 (High)  
**Area:** `area:conversation-frontend` / `area:ui`  
**Estimate:** 3 points

**Bug Description**  
The current "Create New Thread" UI requires users to enter a title and description before starting a conversation, which is not how modern AI chat applications work (Claude, ChatGPT, etc.). Users should be able to start chatting immediately with just model selection and an initial prompt.

\*\* For now, the model field can be filled with demo data.

**Current Behavior**

- User clicks "Create New Thread"
- Modal/form appears requiring:
  - Title (text input)
  - Description (text area)
  - Model selection
  - Status field (unclear purpose)
- User must fill these fields before starting conversation
- Extra friction prevents quick thread creation

**Expected Behavior**

- User clicks "Create New Thread"
- Simplified form appears with only:
  - Model selector (with default model pre-selected)
  - Initial prompt input field
- User types prompt and sends
- Thread is created immediately and opens in thread view
- Thread appears in thread list (title auto-generated from prompt for backend purposes)

---

### Acceptance Criteria (Gherkin)

**Scenario 1 — Simplified Thread Creation Form**

- **Given** I click "Create New Thread",  
  **When** the creation interface appears,  
  **Then** I see only a model selector and prompt input field,  
  **And** the default model is pre-selected,  
  **And** no title or description fields are visible,  
  **And** no status field is visible.

**Scenario 2 — Default Model Pre-Selected**

- **Given** the thread creation form is open,  
  **When** I view the model selector,  
  **Then** a default model is already selected (e.g., Claude Sonnet or ChatGPT 4o),  
  **And** I can change the model if desired,  
  **And** I can immediately start typing my prompt.

**Scenario 3 — Create Thread with Initial Prompt**

- **Given** I have the thread creation form open,  
  **When** I type my initial prompt and click send,  
  **Then** a new thread is created immediately,  
  **And** the prompt is sent to the selected model,  
  **And** the thread view opens showing my prompt and response,  
  **And** the thread appears in the thread list.

**Scenario 4 — Keyboard Shortcuts Work**

- **Given** I have the thread creation form open with text in the prompt field,  
  **When** I press Enter,  
  **Then** the thread is created and prompt is sent,  
  **And** Shift+Enter creates a new line in the prompt field.

---

### Thread Behavior Expectations

**What Changes:**

- Thread creation form simplified (title/description/status fields removed)
- Model selector becomes primary UI element with default
- Immediate prompt input and send
- Streamlined, one-step thread creation

**What Stays the Same:**

- Thread creation button location (to be addressed in separate ticket)
- Thread list display format
- Thread navigation
- Model switching capability
- Thread editing/management features

---

### NFRs

- **Performance**: Form opens instantly, no loading delays
- **Accessibility**:
  - Tab to model selector, tab to prompt field, tab to send button
  - Enter key sends prompt (Shift+Enter for new line)
  - Screen reader announces "Create New Thread" form
  - Auto-focus prompt input on form open
- **Browser Support**: Chrome, Firefox, Safari, Edge (latest 2)
- **Validation**: Prompt field cannot be empty (disable send button or show error)

---

### Dependencies

- Mockup from Kevin showing simplified form layout
- Thread creation API must accept title parameter (already exists)

---

### Definition of Ready

- Mockup provided and attached ✓
- Mockup approved by product team ✓
- Thread creation API documented ✓
- Default model determined ✓

### Definition of Done

- Title and description fields removed from thread creation ✓
- Status field removed from thread creation ✓
- Model selector displayed with default model pre-selected ✓
- Prompt input field is primary focus and auto-focused ✓
- Thread created immediately on prompt send ✓
- Thread view opens after creation ✓
- Thread appears in thread list ✓
- Enter key sends, Shift+Enter adds new line ✓
- Form matches mockup styling and positioning exactly ✓
- Keyboard navigation functional ✓
- No console errors ✓
- Code review + QA complete ✓
- Product/design signoff ✓

---

**Related Issues:**

- Thread creation button placement (separate ticket needed)
- Thread response/chat UI styling (separate ticket needed)
- Thread title display in sidebar (future sidebar redesign)
- Smart AI title generation (future enhancement)

## Relocate New Thread Button to Sidebar Top

**Priority:** P1 (High)  
**Area:** `area:conversation-frontend` / `area:ui`  
**Estimate:** 2 points

**Bug Description**  
The "New Thread" button is currently located in the chat window/workspace area, which is inconsistent with modern chat applications (Claude, ChatGPT, Slack) that place the create button above the list of threads in the Activity List sidebar. . The button should be moved to the top of the Activity List Threads sidebar for better discoverability and consistency.

**Current Behavior**

- "New Thread" button and text appears in the chat window/workspace area (right side)
- Button placement inconsistent with sidebar navigation pattern
- Not immediately visible when viewing thread list

**Expected Behavior (Per Mockup)**

- "New Thread" button and text positioned at the top of the Threads sidebar
- The "New Thread" visually should consist of a small "+" icon (consistent with the Moku Web "add/new" icon) followed by the text "New Thread ..."- Button above the thread list
- Prominent and easily discoverable
- No "New Thread" button in chat window/workspace area
- Clicking button opens thread creation interface (from #220)
- All positioning and styling per mockup

---

### Acceptance Criteria (Gherkin)

The "New Thread" visually should consist of a small "+" icon (consistent with the Moku Web "add/new" icon) followed by the text "New Thread ..."

**Scenario 1 — New Thread Button at Top of Sidebar**

- **Given** I am viewing the Threads sidebar,  
  **When** I look at the top of the sidebar,  
  **Then** I see a "New Thread" button and text prominently displayed,  
  **And** the button is positioned above the thread list,  
  **And** the button styling matches the mockup exactly.

**Scenario 2 — No Button in Chat Window**

- **Given** I have opened a thread or am viewing the chat workspace,  
  **When** I look at the chat window area,  
  **Then** I do not see a "New Thread" button,  
  **And** the only "New Thread" button is in the sidebar.

**Scenario 3 — Click Button Opens Thread Creation**

- **Given** the "New Thread" button is visible in the sidebar,  
  **When** I click the button,  
  **Then** the thread creation page is diplayed
  **And** I can immediately start creating a new thread.

**Scenario 4 — Button Keyboard Accessible**

- **Given** I am navigating with keyboard,  
  **When** I tab to the "New Thread" button,  
  **Then** the button receives focus with clear visual indicator,  
  **And** pressing Enter or Space activates the button.

---

### Thread Behavior Expectations

**What Changes:**

- "New Thread" button moved from chat window to sidebar top
- Button becomes part of sidebar navigation structure
- Button always visible when sidebar is visible

**What Stays the Same:**

- Button functionality (opens thread creation interface)
- Keyboard shortcuts for creating threads (if any)

---

### Definition of Done

- "New Thread" button appears at top of Threads sidebar ✓
- Button positioned above thread list ✓
- No "New Thread" button in chat window/workspace ✓
- Click button opens thread creation interface ✓
- Button styling matches mockup exactly ✓
- Button keyboard accessible (Tab, Enter/Space) ✓
- Focus indicator visible and clear ✓
- Accessibility requirements met ✓
- No console errors ✓
- Code review + QA complete ✓
- Product/design signoff ✓

---

**Related Issues:**

- #220 (Thread creation UI - where button navigates to)

# Story 8.5: Accessibility Audit

Status: ready-for-dev

## Story

As a **Holokai Desktop user with accessibility needs**,
I want **the application to meet WCAG 2.1 AA accessibility standards**,
so that **I can use screen readers, keyboard navigation, and high-contrast modes to effectively interact with all application features**.

## Acceptance Criteria

### AC-5.1: All interactive elements have ARIA labels and semantic HTML roles
- Buttons use `<button>` tag (not `<div role="button">`)
- Form inputs have associated `<label>` or `aria-label`
- Navigation uses `<nav>` landmark
- Main content uses `<main>` landmark

### AC-5.2: Keyboard navigation works throughout app with visible focus indicators
- Tab key cycles through interactive elements in logical order
- Focus indicator shows 2px blue outline (4.5:1 contrast ratio)
- Skip links available: "Skip to main content", "Skip to sidebar"

### AC-5.3: Screen reader testing passes on NVDA (Windows) and VoiceOver (macOS)
- All buttons announce label and role ("Send Message, button")
- Form inputs announce label and value ("Username, edit text, Peter")
- Dialogs announce title and instructions on open
- Loading states announce "Loading..." to screen reader

### AC-5.4: Color contrast meets WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text)
- Automated axe-core audit shows zero contrast violations
- Manual verification: all text readable in high-contrast mode

### AC-5.5: Focus trap works correctly for modals and dialogs (focus cannot escape)
- Tab/Shift+Tab cycle through dialog elements only
- Esc closes dialog and restores focus to trigger element
- Clicking outside dialog does not remove focus trap (intentional modal behavior)

### AC-5.6: High-contrast mode compatible (no information conveyed by color alone)
- Icons have text labels or tooltips
- Buttons distinguishable in high-contrast mode (borders, not just color)
- Selected state indicated by border + background (not color only)

### AC-5.7: Automated accessibility audit (axe-core) runs in CI and reports zero critical/serious violations
- CI pipeline fails if any critical/serious violations detected
- Audit report saved as artifact for manual review

## Tasks / Subtasks

- [ ] **Task 1: Audit color contrast** (AC: 5.4)
  - [ ] Install and configure axe-core and Lighthouse for automated testing
  - [ ] Run automated tools (axe, Lighthouse) on all major views (Threads, Settings, Projects)
  - [ ] Check all text/background combinations manually
  - [ ] Verify 4.5:1 contrast ratio for normal text (under 18pt or 14pt bold)
  - [ ] Verify 3:1 contrast ratio for large text (18pt+ or 14pt+ bold)
  - [ ] Document all contrast failures with component names and color values
  - [ ] Fix identified contrast issues by adjusting colors in Tailwind config
  - [ ] Re-run audit to verify fixes

- [ ] **Task 2: Add ARIA labels to interactive elements** (AC: 5.1, 5.3)
  - [ ] Audit all icon-only buttons (e.g., send, retry, settings) and add aria-label
  - [ ] Add aria-describedby for complex controls (e.g., file upload with restrictions)
  - [ ] Add role attributes where semantic HTML not used (e.g., custom dropdowns)
  - [ ] Add aria-live regions for dynamic content (e.g., message streaming, notifications)
  - [ ] Add aria-expanded for collapsible sections (e.g., thread details, project members)
  - [ ] Ensure form inputs have associated labels or aria-label
  - [ ] Add semantic HTML landmarks: `<nav>`, `<main>`, `<aside>` for sidebar
  - [ ] Replace non-semantic `<div>` buttons with `<button>` tags

- [ ] **Task 3: Ensure keyboard navigation works** (AC: 5.2)
  - [ ] Test Tab order through all components (Sidebar → Thread List → Message Input → Settings)
  - [ ] Ensure all interactive elements are focusable (buttons, links, inputs)
  - [ ] Add skip links at top of page: "Skip to main content", "Skip to sidebar"
  - [ ] Support Escape key to close modals and dialogs
  - [ ] Support arrow keys for navigating thread list and project list
  - [ ] Ensure focus indicators are visible on all focusable elements (2px blue outline, 4.5:1 contrast)
  - [ ] Test keyboard shortcuts (Cmd/Ctrl+N, Cmd/Ctrl+K) work without mouse

- [ ] **Task 4: Implement focus trap for modals and dialogs** (AC: 5.5)
  - [ ] Install or implement focus-trap library for modal components
  - [ ] Apply focus trap to all dialog/modal components (Settings, New Thread, About)
  - [ ] Ensure Tab/Shift+Tab cycle through dialog elements only (no escape to background)
  - [ ] Store previous focus element before opening dialog
  - [ ] Restore focus to trigger element when dialog closes via Esc or close button
  - [ ] Test focus trap with screen reader (ensure no confusing jumps)

- [ ] **Task 5: Test with screen readers** (AC: 5.3)
  - [ ] Test with VoiceOver on macOS: navigate threads, create thread, send message
  - [ ] Test with NVDA on Windows: same workflow as VoiceOver
  - [ ] Verify all interactive elements announce label and role correctly
  - [ ] Verify form inputs announce label and current value
  - [ ] Verify dialogs announce title and instructions on open
  - [ ] Verify loading states announce "Loading..." or "Sending message..."
  - [ ] Verify error messages are announced immediately (aria-live="assertive")
  - [ ] Document and fix any confusing or missing announcements

- [ ] **Task 6: Ensure high-contrast mode compatibility** (AC: 5.6)
  - [ ] Enable Windows High-Contrast Mode and test all UI elements
  - [ ] Verify all icons have text labels or tooltips (no icon-only meanings)
  - [ ] Verify buttons are distinguishable by borders/outlines, not just color
  - [ ] Verify selected state uses border + background, not color alone
  - [ ] Verify connection status indicators (tray, sidebar) have text alternatives
  - [ ] Test dark mode compatibility with high-contrast settings
  - [ ] Fix any elements that rely solely on color for information

- [ ] **Task 7: Set up automated accessibility testing in CI** (AC: 5.7)
  - [ ] Integrate axe-core into existing test suite (Vitest or Playwright)
  - [ ] Create accessibility test that runs axe.run() on all major views
  - [ ] Configure axe-core to fail on critical/serious violations
  - [ ] Set up CI pipeline to run accessibility tests on every PR
  - [ ] Configure CI to save accessibility audit report as artifact
  - [ ] Add badge or status check to PR showing accessibility test results

- [ ] **Task 8: Document and fix identified issues**
  - [ ] Create issues for each accessibility problem found (use GitHub issues or project tracker)
  - [ ] Prioritize issues by impact: Critical (blocks usage) > Serious (major inconvenience) > Moderate > Minor
  - [ ] Fix all critical and serious issues before story completion
  - [ ] Document remaining moderate/minor issues for future sprints
  - [ ] Update component documentation with accessibility notes (e.g., "Use aria-label for icon buttons")

## Dev Notes

### WCAG 2.1 AA Standards Overview

This story ensures compliance with WCAG 2.1 Level AA standards. Key requirements:

- **Perceivable**: Content must be presentable in multiple ways (color contrast, alt text, text-to-speech)
- **Operable**: UI components must be keyboard-accessible and provide sufficient time for interaction
- **Understandable**: Information and UI operation must be clear
- **Robust**: Content must work with assistive technologies (screen readers)

### Color Contrast Requirements

- **Normal text** (<18pt or <14pt bold): 4.5:1 minimum contrast ratio
- **Large text** (≥18pt or ≥14pt bold): 3:1 minimum contrast ratio
- **UI components and graphics**: 3:1 minimum contrast ratio

Use tools like [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) or browser DevTools to verify ratios.

### ARIA Best Practices

From [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/):

- **Prefer semantic HTML** over ARIA roles (e.g., `<button>` instead of `<div role="button">`)
- **Use aria-label** for icon-only buttons: `<button aria-label="Send message">📤</button>`
- **Use aria-describedby** for additional context: `<input aria-describedby="password-hint" />`
- **Use aria-live** for dynamic content: `<div aria-live="polite">Message sent</div>`
- **Use aria-expanded** for collapsible sections: `<button aria-expanded="false">Details</button>`

### Keyboard Navigation Patterns

Standard keyboard shortcuts for accessibility:

- **Tab**: Move focus to next interactive element
- **Shift+Tab**: Move focus to previous interactive element
- **Enter/Space**: Activate button or link
- **Escape**: Close modal or dialog
- **Arrow keys**: Navigate lists or menus
- **Home/End**: Jump to first/last item in list

### Focus Management

Focus indicators must be visible and meet 3:1 contrast ratio against background. Consider:

- Default focus styles often insufficient (browser defaults too subtle)
- Use consistent focus indicator across all components (e.g., 2px blue outline)
- Ensure focus visible on all states (default, hover, active)
- Avoid `outline: none` without providing alternative focus style

### Screen Reader Testing

**VoiceOver (macOS):**
- Enable: System Preferences > Accessibility > VoiceOver
- Quick toggle: Cmd+F5
- Navigate: VO+Arrow keys (VO = Ctrl+Option)

**NVDA (Windows):**
- Download: [nvaccess.org](https://www.nvaccess.org/)
- Quick toggle: Ctrl+Alt+N
- Navigate: Arrow keys

**Testing checklist:**
- All interactive elements announce label and role
- Form inputs announce label, value, and validation errors
- Dialogs announce title on open
- Loading states announce progress
- Error messages announced immediately

### Component-Specific Notes

**MessageInput component:**
- Add aria-label to send button ("Send message")
- Add aria-label to attachment button ("Attach file")
- Ensure file attachments have descriptive labels (filename + size)

**ThreadList component:**
- Use semantic `<nav>` element
- Add aria-label to thread items ("Thread: Feature brainstorming, 3 messages, last updated 2 hours ago")
- Support arrow key navigation

**Modal/Dialog components:**
- Implement focus trap (Tab/Shift+Tab cycle within dialog)
- Set focus to first interactive element on open
- Restore focus to trigger element on close
- Add aria-modal="true" and role="dialog"

**CommandPalette component:**
- Implement combobox ARIA pattern (role="combobox", aria-expanded, aria-controls)
- Announce search results count ("5 results found")
- Support arrow key navigation through results

### Testing Tools

**Automated:**
- **axe-core**: Accessibility testing engine (npm: @axe-core/cli, @axe-core/playwright)
- **Lighthouse**: Chrome DevTools > Lighthouse > Accessibility audit
- **WAVE**: Browser extension for visual accessibility evaluation

**Manual:**
- **Screen readers**: VoiceOver (macOS), NVDA (Windows), JAWS (Windows, paid)
- **Keyboard navigation**: Unplug mouse and navigate entire app with keyboard
- **High-contrast mode**: Windows Settings > Ease of Access > High contrast

### Integration with Existing Architecture

From Architecture §2.3 (Renderer Process):
- Svelte 5 components already use semantic HTML where possible
- Tailwind CSS provides accessible color palettes (need verification)
- Focus management can leverage Svelte's `use:action` for focus trap

From Architecture §5 (Testing):
- Integrate axe-core into existing Vitest unit tests
- Add accessibility E2E tests using Playwright + axe-playwright
- Run accessibility tests in CI alongside existing test suite

### Accessibility Audit Data Models

From tech spec, the AccessibilityAuditReport interface:

```typescript
interface A11yAuditReport {
  timestamp: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  violations: Array<{
    rule: string;           // e.g., 'color-contrast'
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
    description: string;
    elements: string[];     // CSS selectors
    remediation: string;
  }>;
  passes: number;
  incomplete: number;
  summary: {
    totalViolations: number;
    criticalCount: number;
    seriousCount: number;
    compliant: boolean;
  };
}
```

This structure should be used for reporting audit results in CI.

### FocusManager Service

From tech spec, a FocusManager service should be created to handle focus trapping:

```typescript
// FocusManager (Desktop Renderer)
// Manage focus for dialogs and modals
// Input: Dialog open/close events
// Output: Focus trap, restore previous focus on close
```

Implementation approach:
- Create `src/renderer/services/FocusManager.ts`
- Implement `trapFocus(element: HTMLElement): () => void` - returns cleanup function
- Implement `restoreFocus(element: HTMLElement): void`
- Store reference to last focused element before modal opens
- Use `querySelectorAll` to find all focusable elements in dialog
- Add event listeners for Tab/Shift+Tab to cycle focus

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-8.md §E8-S5 - Acceptance Criteria]
- [Source: docs/sprint-artifacts/tech-spec-epic-8.md §Detailed Design - AccessibilityAuditor, FocusManager]
- [Source: docs/epics-and-stories-2025-11-25.md §E8-S5 - Story breakdown]
- [Source: docs/architecture.md §2.3 - Renderer Process components]
- [Source: docs/architecture.md §5 - Testing Architecture]
- [WCAG 2.1 AA Guidelines](https://www.w3.org/WAI/WCAG21/quickref/?versions=2.1&levels=aa)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [axe-core Documentation](https://github.com/dequelabs/axe-core)
- [Electron Accessibility](https://www.electronjs.org/docs/latest/tutorial/accessibility)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e8-s5-accessibility-audit.context.xml

- docs/sprint-artifacts/e8-s5-accessibility-audit.context.xml



### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

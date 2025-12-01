## Description

Three modal components (DeleteProjectModal, MoveThreadModal, ProjectFormModal) repeat code for overlay handling, escape key detection, click-outside behavior, error display, and button layouts. Approximately 75% of the code and CSS is duplicated across these files.

This refactoring ticket extracts common modal behavior into a reusable BaseModal component that uses Svelte's snippet pattern for content injection. The BaseModal handles all the boilerplate (overlay clicks, keyboard events, button management) while child components focus solely on their specific form content and validation logic.

The result is consistent modal behavior across the application, a single source of truth for modal styling, and dramatic code reduction. Future modals can be created in just a few lines by composing with BaseModal.

## Impact

**Priority:** HIGH
**Code Reduction:** ~200 lines
**Complexity Reduction:** Eliminates duplicate modal infrastructure across 3 components
**Maintainability:** Single source of truth for modal behavior and styling

---

## Files and Line Numbers to Refactor

### Duplicate Patterns to Extract

| Pattern                                              | File                        | Lines        | Replace With              |
| ---------------------------------------------------- | --------------------------- | ------------ | ------------------------- |
| **Modal Overlay & Event Handling**                   |                             |              |                           |
| `<div class="modal-overlay" onclick={handleCancel}>` | `DeleteProjectModal.svelte` | 67-74        | `<BaseModal>` wrapper     |
| `<div class="modal-overlay" onclick={handleCancel}>` | `MoveThreadModal.svelte`    | 116-123      | `<BaseModal>` wrapper     |
| `<div class="modal-overlay" onclick={handleCancel}>` | `ProjectFormModal.svelte`   | 80-87        | `<BaseModal>` wrapper     |
| **Escape Key Handler**                               |                             |              |                           |
| `function handleKeydown(event: KeyboardEvent)`       | `DeleteProjectModal.svelte` | 58-62        | Handled by BaseModal      |
| `function handleKeydown(event: KeyboardEvent)`       | `MoveThreadModal.svelte`    | 107-111      | Handled by BaseModal      |
| `function handleKeydown(event: KeyboardEvent)`       | `ProjectFormModal.svelte`   | 69-75        | Handled by BaseModal      |
| **Cancel Handler**                                   |                             |              |                           |
| `function handleCancel()`                            | `DeleteProjectModal.svelte` | 52-56        | Handled by BaseModal      |
| `function handleCancel()`                            | `MoveThreadModal.svelte`    | 100-105      | Handled by BaseModal      |
| `function handleCancel()`                            | `ProjectFormModal.svelte`   | 62-67        | Handled by BaseModal      |
| **Error Display**                                    |                             |              |                           |
| `{#if error}<div class="error">`                     | `DeleteProjectModal.svelte` | ~85          | `error` prop to BaseModal |
| `{#if error}<div class="error-message">`             | `MoveThreadModal.svelte`    | ~130         | `error` prop to BaseModal |
| `{#if error}<div class="error-message">`             | `ProjectFormModal.svelte`   | ~95          | `error` prop to BaseModal |
| **Button Layout**                                    |                             |              |                           |
| Cancel/Submit button structure                       | `DeleteProjectModal.svelte` | ~95-105      | BaseModal handles buttons |
| Cancel/Move button structure                         | `MoveThreadModal.svelte`    | ~185-195     | BaseModal handles buttons |
| Cancel/Save button structure                         | `ProjectFormModal.svelte`   | ~115-125     | BaseModal handles buttons |
| **Modal CSS**                                        |                             |              |                           |
| `.modal-overlay`, `.modal-content` styles            | All 3 files                 | ~75% overlap | Moved to BaseModal        |

**Total duplicate code:** ~200 lines across 3 files

---

## Testing Requirements

### 1. BaseModal Component Tests

- Test modal opens when `show` prop is true
- Test modal closes when `show` prop is false
- Test Escape key triggers cancel event
- Test clicking overlay triggers cancel event
- Test clicking modal content does NOT close modal (stopPropagation)
- Test submit button triggers submit event
- Test cancel button triggers cancel event
- Test buttons disabled when `isSubmitting` is true
- Test error message displays when `error` prop provided
- Test custom submit label displays correctly

### 2. Refactored Modal Integration Tests

- **DeleteProjectModal**: Test delete confirmation flow works with BaseModal
- **MoveThreadModal**: Test thread move flow works with BaseModal
- **ProjectFormModal**: Test create/edit project flow works with BaseModal
- Test all modals maintain their specific business logic
- Test all modals can be opened and closed independently

### 3. Accessibility Tests

- Test modal has proper ARIA attributes (`role="dialog"`)
- Test modal traps focus when open
- Test keyboard navigation works (Tab, Escape)
- Test screen reader announcements work correctly

### 4. Edge Cases

- Test modal with very long content scrolls correctly
- Test multiple modals can exist without conflicts
- Test rapid open/close doesn't break state
- Test modal with no error message displays correctly

### 5. Visual Regression Tests

- Test all three refactored modals look identical to originals
- Test modal animations/transitions still work
- Test modal styling on different screen sizes

---

## Implementation Code

### Step 1: Create BaseModal Component

Create file: `src/lib/components/modals/BaseModal.svelte`

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const {
    show,
    title,
    error,
    isSubmitting,
    submitLabel = 'Submit',
    cancelLabel = 'Cancel',
    content,
  } = $props<{
    show: boolean;
    title: string;
    error?: string;
    isSubmitting: boolean;
    submitLabel?: string;
    cancelLabel?: string;
    content: import('svelte').Snippet;
  }>();

  const dispatch = createEventDispatcher();

  function handleCancel() {
    dispatch('cancel');
  }

  function handleSubmit() {
    dispatch('submit');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleCancel();
    }
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={handleCancel} onkeydown={handleKeydown} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_keys a11y_no_static_element_interactions -->
    <div
      class="modal-content"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-labelledby="modal-title"
      tabindex="0"
    >
      <h2 id="modal-title">{title}</h2>

      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      {@render content()}

      <div class="modal-actions">
        <button class="btn-secondary" onclick={handleCancel} disabled={isSubmitting}>
          {cancelLabel}
        </button>
        <button class="btn-primary" onclick={handleSubmit} disabled={isSubmitting}>
          {submitLabel}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--surface-card, #1e293b);
    border: 1px solid var(--surface-border, #334155);
    border-radius: 8px;
    padding: 2rem;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
  }

  .modal-content h2 {
    margin: 0 0 1rem 0;
    color: var(--text-primary, #f8fafc);
    font-size: 1.5rem;
  }

  .error-message {
    background: #fee;
    color: #c00;
    padding: 0.75rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
  }

  .btn-secondary,
  .btn-primary {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .btn-secondary {
    background: var(--surface-overlay, rgba(148, 163, 184, 0.12));
    color: var(--text-primary, #f8fafc);
    border: 1px solid var(--surface-border, rgba(148, 163, 184, 0.35));
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--surface-hover, rgba(148, 163, 184, 0.2));
  }

  .btn-primary {
    background: var(--primary-color, #2563eb);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--primary-color-dark, #1d4ed8);
  }

  .btn-secondary:disabled,
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
```

### Step 2: Usage Example - Refactor ProjectFormModal

**Before (ProjectFormModal.svelte - 140 lines):**

```svelte
<script lang="ts">
  import { projectService } from '$lib/services/project.service';

  let projectName = $state('');
  let projectDescription = $state('');
  let isSubmitting = $state(false);
  let error = $state('');

  function handleCancel() {
    projectName = '';
    projectDescription = '';
    error = '';
    show = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleCancel();
    }
  }

  async function handleSubmit() {
    if (!projectName.trim()) {
      error = 'Project name is required';
      return;
    }
    isSubmitting = true;
    // ... submission logic
  }
</script>

{#if show}
  <div class="modal-overlay" onclick={handleCancel} onkeydown={handleKeydown}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <h2>{isEditMode ? 'Edit Project' : 'Create Project'}</h2>
      {#if error}<div class="error-message">{error}</div>{/if}
      <input bind:value={projectName} placeholder="Project name" />
      <textarea bind:value={projectDescription} placeholder="Description" />
      <div class="modal-actions">
        <button onclick={handleCancel} disabled={isSubmitting}>Cancel</button>
        <button onclick={handleSubmit} disabled={isSubmitting}>
          {isEditMode ? 'Update' : 'Create'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ~50 lines of CSS */
</style>
```

**After (ProjectFormModal.svelte - ~60 lines):**

```svelte
<script lang="ts">
  import BaseModal from './BaseModal.svelte';
  import { projectService } from '$lib/services/project.service';

  let projectName = $state('');
  let projectDescription = $state('');
  let isSubmitting = $state(false);
  let error = $state('');

  const isEditMode = $derived(!!project);
  const modalTitle = $derived(isEditMode ? 'Edit Project' : 'Create Project');
  const submitLabel = $derived(isEditMode ? 'Update' : 'Create');

  async function handleSubmit() {
    if (!projectName.trim()) {
      error = 'Project name is required';
      return;
    }
    isSubmitting = true;
    // ... submission logic
  }

  function handleCancel() {
    projectName = '';
    projectDescription = '';
    error = '';
    show = false;
  }
</script>

<BaseModal
  bind:show
  title={modalTitle}
  {error}
  {isSubmitting}
  {submitLabel}
  on:cancel={handleCancel}
  on:submit={handleSubmit}
>
  {#snippet content()}
    <input bind:value={projectName} placeholder="Project name" class="form-input" />
    <textarea
      bind:value={projectDescription}
      placeholder="Description (optional)"
      class="form-textarea"
    />
  {/snippet}
</BaseModal>

<style>
  .form-input,
  .form-textarea {
    /* Component-specific styles only */
  }
</style>
```

**Lines saved:** ~80 lines per modal × 3 modals = ~240 lines total

---

## Refactoring Checklist

- [ ] Create `src/lib/components/modals/BaseModal.svelte` with all required functionality
- [ ] Refactor `ProjectFormModal.svelte` to use BaseModal
- [ ] Refactor `DeleteProjectModal.svelte` to use BaseModal
- [ ] Refactor `MoveThreadModal.svelte` to use BaseModal
- [ ] Remove duplicate CSS from all modal files
- [ ] Write unit tests for BaseModal
- [ ] Run full test suite and verify all modals work identically
- [ ] Visual regression testing
- [ ] Code review

---

## Acceptance Criteria

- [ ] BaseModal component created with all required functionality
- [ ] All 3 modal components refactored to use BaseModal
- [ ] ~200+ lines of duplicate code removed
- [ ] All existing modal functionality works identically
- [ ] Unit tests written for BaseModal (10+ test cases)
- [ ] Integration tests pass for all refactored modals
- [ ] Keyboard navigation works (Escape, Tab)
- [ ] Accessibility attributes correct (ARIA roles)
- [ ] Visual appearance unchanged from original modals
- [ ] No console errors or warnings
- [ ] Code review completed

---

## Related Issues

Part of UI refactoring initiative. See `ai/ui-tasks.md` for full context.

## Notes

- This refactoring should be done carefully as modals are user-facing
- Consider feature flag or gradual rollout
- Test thoroughly on different screen sizes
- Ensure backwards compatibility with any modal-specific behaviors

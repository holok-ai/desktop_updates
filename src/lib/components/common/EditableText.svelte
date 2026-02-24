<script lang="ts">
  /**
   * EditableText — inline click-to-edit text.
   *
   * Renders the value using any HTML element (`tag` prop). Clicking the text
   * (or pressing Enter when focused) activates an inline input. Confirm with
   * Enter or the ✓ button; cancel with Escape or the ✗ button.
   *
   * The editing input inherits font size, weight, and color from the tag
   * element automatically, so it looks identical to the text it replaces.
   *
   * @prop value       — Current text value (bindable).
   * @prop tag         — HTML element for display/editing wrapper ('h1'–'h4', 'p', 'span', 'div'…).
   * @prop class       — Extra CSS classes forwarded to both the display and editing element.
   * @prop placeholder — Shown when value is empty.
   * @prop readonly    — When true, editing is disabled.
   * @prop onChange    — Called with the trimmed new value when an edit is committed.
   */

  interface Props {
    value: string;
    /** HTML element used to render the text. Default: 'div'. */
    tag?: string;
    /** Extra CSS class(es) applied to both the display and editing elements. */
    class?: string;
    /** Placeholder text shown when value is empty. */
    placeholder?: string;
    /** Disables editing when true. */
    readonly?: boolean;
    /** Called with the new value after a successful commit. */
    onChange?: (value: string) => void;
  }

  let {
    value = $bindable(''),
    tag = 'div',
    class: className = '',
    placeholder = '',
    readonly = false,
    onChange,
  }: Props = $props();

  let isEditing = $state(false);
  let editValue = $state('');
  let inputRef: HTMLInputElement | undefined = $state();

  function startEditing() {
    if (readonly) return;
    editValue = value;
    isEditing = true;
    setTimeout(() => {
      inputRef?.focus();
      inputRef?.select();
    }, 0);
  }

  function commitEdit() {
    if (!isEditing) return;
    isEditing = false;
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      value = trimmed;
      onChange?.(trimmed);
    }
  }

  function cancelEdit() {
    isEditing = false;
    editValue = value;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  }

  function handleDisplayKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startEditing();
    }
  }
</script>

{#if isEditing}
  <!--
    Use the same tag for the editing wrapper so the heading's global font styles
    (h1, h2, h3 …) cascade to the input via `font: inherit`.
  -->
  <svelte:element this={tag} class="editable-editing {className}">
    <input
      bind:this={inputRef}
      bind:value={editValue}
      class="editable-input"
      {placeholder}
      onblur={commitEdit}
      onkeydown={handleKeydown}
      aria-label="Edit text"
    />
    <span class="edit-actions">
      <button
        class="edit-btn confirm"
        onmousedown={(e) => e.preventDefault()}
        onclick={commitEdit}
        title="Confirm (Enter)"
        aria-label="Confirm edit"
      >
        <i class="pi pi-check"></i>
      </button>
      <button
        class="edit-btn cancel"
        onmousedown={(e) => e.preventDefault()}
        onclick={cancelEdit}
        title="Cancel (Escape)"
        aria-label="Cancel edit"
      >
        <i class="pi pi-times"></i>
      </button>
    </span>
  </svelte:element>
{:else}
  <svelte:element
    this={tag}
    class="editable-display {className}"
    class:editable={!readonly}
    role={readonly ? undefined : 'button'}
    onclick={readonly ? undefined : startEditing}
    onkeydown={readonly ? undefined : handleDisplayKeydown}
    tabindex={readonly ? undefined : 0}
    title={readonly ? undefined : 'Click to edit'}
  >
    {value || placeholder}
  </svelte:element>
{/if}

<style>
  /* ── Display mode ───────────────────────────────────────────────── */

  .editable-display {
    cursor: default;
    border-radius: 4px;
    transition: background 0.15s ease;
  }

  .editable-display.editable {
    cursor: text;
  }

  .editable-display.editable:hover {
    background: color-mix(in srgb, var(--primary-color, #646cff) 6%, transparent);
  }

  .editable-display.editable:focus {
    outline: 2px solid color-mix(in srgb, var(--primary-color, #646cff) 40%, transparent);
    outline-offset: 2px;
  }

  /* ── Editing mode ───────────────────────────────────────────────── */

  .editable-editing {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    /* Reset heading margin so layout doesn't shift when toggling */
    margin-top: 0;
    margin-bottom: 0;
  }

  .editable-input {
    flex: 1;
    /* Inherit from the heading element so font-size/weight/color all match */
    font: inherit;
    color: inherit;
    background: transparent;
    border: none;
    border-bottom: 2px solid var(--primary-color, #646cff);
    outline: none;
    padding: 0;
    min-width: 0;
    line-height: inherit;
  }

  /* ── Edit action buttons ────────────────────────────────────────── */

  .edit-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .edit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.7rem;
    padding: 0;
    transition:
      background 0.15s,
      color 0.15s;
  }

  .edit-btn.confirm {
    background: color-mix(in srgb, var(--primary-color, #646cff) 15%, transparent);
    color: var(--primary-color, #646cff);
  }

  .edit-btn.confirm:hover {
    background: var(--primary-color, #646cff);
    color: white;
  }

  .edit-btn.cancel {
    background: transparent;
    color: var(--text-secondary, #666);
  }

  .edit-btn.cancel:hover {
    background: var(--surface-hover, #f0f0f0);
    color: var(--text-primary, #111);
  }
</style>

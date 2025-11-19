<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    show = $bindable(false),
    title,
    error = '',
    isSubmitting = false,
    submitLabel = 'Submit',
    cancelLabel = 'Cancel',
    submitDisabled = false,
    showHint = true,
    hintText = '',
    buttonVariant = 'primary',
    oncancel,
    onsubmit,
    content,
  }: {
    show: boolean;
    title: string;
    error?: string;
    isSubmitting?: boolean;
    submitLabel?: string;
    cancelLabel?: string;
    submitDisabled?: boolean;
    showHint?: boolean;
    hintText?: string;
    buttonVariant?: 'primary' | 'danger';
    oncancel: () => void;
    onsubmit: () => void;
    content: Snippet;
  } = $props();

  function handleCancel() {
    oncancel();
  }

  function handleSubmit() {
    onsubmit();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleCancel();
    } else if (event.key === 'Enter' && event.metaKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  const defaultHintText = $derived('Tip: Press Esc to cancel or ⌘+Enter to submit');
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={handleCancel} onkeydown={handleKeydown} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
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
        <button type="button" class="btn-secondary" onclick={handleCancel} disabled={isSubmitting}>
          {cancelLabel}
        </button>
        <button
          type="button"
          class="btn-{buttonVariant}"
          onclick={handleSubmit}
          disabled={isSubmitting || submitDisabled}
        >
          {submitLabel}
        </button>
      </div>

      {#if showHint}
        <div class="hint">{hintText || defaultHintText}</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--modal-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--surface-ground);
    border-radius: 8px;
    padding: 24px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    max-height: 80vh;
    overflow-y: auto;
  }

  h2 {
    margin: 0 0 20px 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .error-message {
    padding: 10px 12px;
    background: var(--error-bg);
    border: 1px solid var(--error-color);
    border-radius: 6px;
    color: var(--error-color);
    font-size: 14px;
    margin-bottom: 16px;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 20px;
  }

  button {
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .btn-secondary {
    background: var(--surface-overlay);
    color: var(--text-primary);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--surface-hover);
  }

  .btn-primary {
    background: var(--primary-color);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-danger {
    background: var(--error-color);
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    filter: brightness(0.9);
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .hint {
    margin-top: 16px;
    font-size: 12px;
    color: var(--text-secondary);
    text-align: center;
  }

  .hint :global(kbd) {
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 3px;
    padding: 2px 6px;
    font-family: monospace;
    font-size: 11px;
  }
</style>

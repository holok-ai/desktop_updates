<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { focusTrap } from '$lib/actions/focusTrap';

  let { threadId, currentTitle }: { threadId: string; currentTitle: string } = $props();

  const dispatch = createEventDispatcher<{
    confirm: { threadId: string; newTitle: string };
    cancel: void;
  }>();

  let newTitle = $state('');
  let isSubmitting = $state(false);

  // Sync newTitle when currentTitle prop changes
  $effect(() => {
    newTitle = currentTitle;
  });

  const isValid = $derived(newTitle.trim().length > 0 && newTitle.trim() !== currentTitle);

  async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    isSubmitting = true;
    dispatch('confirm', { threadId, newTitle: newTitle.trim() });
    // Parent will handle closing and loading state
  }

  function handleCancel(): void {
    dispatch('cancel');
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      handleCancel();
    }
  }

  function focus(node: HTMLInputElement) {
    node.focus();
    node.select(); // Select text for easier replacement
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="dialog-overlay"
  onclick={handleCancel}
  onkeydown={(e) => e.key === 'Escape' && handleCancel()}
  role="button"
  tabindex="-1"
  aria-label="Close modal"
>
  <div
    class="dialog"
    use:focusTrap
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    aria-labelledby="rename-dialog-title"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="dialog-header">
      <h2 id="rename-dialog-title">Rename Thread</h2>
      <button class="close-button" onclick={handleCancel} aria-label="Close dialog" type="button">
        <i class="pi pi-times"></i>
      </button>
    </div>

    <form class="dialog-content" onsubmit={handleSubmit}>
      <div class="form-group">
        <div class="label-with-counter">
          <label for="thread-title">Thread Title</label>
          <span class="char-counter" class:error={newTitle.length > 100}>
            {newTitle.length}/100
          </span>
        </div>
        <input
          id="thread-title"
          type="text"
          bind:value={newTitle}
          placeholder="Enter thread title"
          disabled={isSubmitting}
          maxlength="100"
          use:focus
          aria-invalid={newTitle.length > 100 ? 'true' : 'false'}
        />
      </div>

      <div class="dialog-actions">
        <button type="button" class="btn-secondary" onclick={handleCancel} disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" class="btn-primary" disabled={!isValid || isSubmitting}>
          {isSubmitting ? 'Renaming...' : 'Rename'}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  /* Override: global .dialog-header uses gap, this needs space-between */
  .dialog-header {
    justify-content: space-between;
  }

  .label-with-counter {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .char-counter {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .char-counter.error {
    color: #ef4444;
    font-weight: 600;
  }

  .form-group input {
    width: 100%;
    padding: 12px 16px;
    font-size: 14px;
    color: var(--text-primary);
    background: var(--surface-overlay, #1e293b);
    border: 1px solid var(--surface-border, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--primary-color, #3b82f6);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color, #3b82f6) 25%, transparent);
    background: var(--surface-main);
  }

  .form-group input[aria-invalid='true'] {
    border-color: #ef4444;
  }

  .form-group input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>

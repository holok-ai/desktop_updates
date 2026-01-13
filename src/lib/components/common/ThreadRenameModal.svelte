<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  let { threadId, currentTitle }: { threadId: string; currentTitle: string } = $props();

  const dispatch = createEventDispatcher<{
    confirm: { threadId: string; newTitle: string };
    cancel: void;
  }>();

  let newTitle = $state(currentTitle);
  let isSubmitting = $state(false);
  
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
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    aria-labelledby="rename-dialog-title"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="dialog-header">
      <h2 id="rename-dialog-title">Rename Thread</h2>
      <button
        class="close-button"
        onclick={handleCancel}
        aria-label="Close dialog"
        type="button"
      >
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
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
  }

  .dialog {
    background: var(--surface-main);
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
  }

  .dialog-header h2 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .close-button {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .close-button:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
  }

  .dialog-content {
    padding: 24px;
  }

  .form-group {
    margin-bottom: 24px;
  }

  .form-group label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
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

  .dialog-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .dialog-actions button {
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-primary);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--surface-hover);
  }

  .btn-primary {
    background: #3b82f6;
    border: none;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-primary:disabled,
  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>


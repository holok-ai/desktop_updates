<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  let { threadId, threadTitle }: { threadId: string; threadTitle: string } = $props();

  const dispatch = createEventDispatcher<{
    confirm: void;
    cancel: void;
  }>();

  let isDeleting = $state(false);

  function handleConfirm(): void {
    if (isDeleting) return;
    isDeleting = true;
    dispatch('confirm');
    // Parent will handle closing and loading state
  }

  function handleCancel(): void {
    dispatch('cancel');
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && !isDeleting) {
      handleCancel();
    }
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
    aria-labelledby="delete-dialog-title"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="dialog-header">
      <i class="pi pi-exclamation-triangle warning-icon"></i>
      <h2 id="delete-dialog-title">Delete Thread</h2>
    </div>

    <div class="dialog-content">
      <p class="warning-text">
        Are you sure you want to delete <strong>"{threadTitle}"</strong>?
      </p>
      <p class="warning-subtext">
        This will permanently delete all messages in this thread. This action cannot be undone.
      </p>

      <div class="dialog-actions">
        <button
          type="button"
          class="btn-secondary"
          onclick={handleCancel}
          disabled={isDeleting}
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn-danger"
          onclick={handleConfirm}
          disabled={isDeleting}
        >
          {isDeleting ? 'Deleting...' : 'Delete Thread'}
        </button>
      </div>
    </div>
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
    gap: 12px;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
  }

  .warning-icon {
    font-size: 24px;
    color: #ef4444;
  }

  .dialog-header h2 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .dialog-content {
    padding: 24px;
  }

  .warning-text {
    font-size: 14px;
    color: var(--text-primary);
    margin: 0 0 12px 0;
    line-height: 1.5;
  }

  .warning-text strong {
    font-weight: 600;
    color: var(--text-primary);
  }

  .warning-subtext {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0 0 24px 0;
    line-height: 1.5;
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

  .btn-danger {
    background: #ef4444;
    border: none;
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background: #dc2626;
  }

  .btn-danger:disabled,
  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>


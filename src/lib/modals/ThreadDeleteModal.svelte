<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  let { threadTitle }: { threadId: string; threadTitle: string } = $props();

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
  /* All base modal styles are in app.css */
</style>


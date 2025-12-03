<script lang="ts">
  import {
    confirmModalStore,
    hideConfirmModal,
    type ConfirmModalState,
  } from '$lib/stores/navigation-guard.store';

  let modalState: ConfirmModalState = $state({
    show: false,
    message: '',
    onStay: null,
    onDiscard: null,
  });

  // Subscribe to the store
  $effect(() => {
    const unsubscribe = confirmModalStore.subscribe((state) => {
      modalState = state;
    });
    return unsubscribe;
  });

  function handleStay() {
    if (modalState.onStay) {
      modalState.onStay();
    } else {
      hideConfirmModal();
    }
  }

  function handleDiscard() {
    if (modalState.onDiscard) {
      modalState.onDiscard();
    } else {
      hideConfirmModal();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!modalState.show) return;
    if (event.key === 'Escape') {
      handleStay(); // Escape = stay on page
    }
  }

  function handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleStay(); // Clicking overlay = stay on page
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if modalState.show}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={handleOverlayClick} role="presentation">
    <div
      class="modal-content"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
    >
      <h2 id="confirm-title">Unsaved Changes</h2>
      <p id="confirm-message" class="message">{modalState.message}</p>

      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick={handleDiscard}> Cancel </button>
        <button type="button" class="btn-primary" onclick={handleStay}> OK </button>
      </div>
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
    background: var(--modal-overlay, rgba(0, 0, 0, 0.5));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .modal-content {
    background: var(--surface-ground, #fff);
    border-radius: 12px;
    padding: 24px;
    max-width: 420px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  h2 {
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .message {
    margin: 0 0 24px 0;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-secondary);
    white-space: pre-line;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  button {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .btn-secondary {
    background: var(--surface-overlay, #f3f4f6);
    color: var(--text-primary);
  }

  .btn-secondary:hover {
    background: var(--surface-hover, #e5e7eb);
  }

  .btn-primary {
    background: var(--primary-color, #3b82f6);
    color: white;
  }

  .btn-primary:hover {
    opacity: 0.9;
  }
</style>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { projectService } from '$lib/services/project.service';
  import type { Project } from '../../../../src-electron/preload';

  let { show = $bindable(false), project = $bindable<Project | null>(null) } = $props();

  const dispatch = createEventDispatcher();

  let deleteThreads = $state(false);
  let isDeleting = $state(false);
  let error = $state('');
  let threadCount = $state(0);

  $effect(() => {
    if (project && show) {
      loadThreadCount();
    }
  });

  async function loadThreadCount() {
    if (!project) return;
    try {
      threadCount = await projectService.getThreadCount(project.id);
    } catch (err) {
      console.error('Failed to load thread count:', err);
      threadCount = 0;
    }
  }

  async function handleConfirm() {
    if (!project) return;

    isDeleting = true;
    error = '';

    try {
      await projectService.deleteProject(project.id, deleteThreads);
      show = false;
      deleteThreads = false;
      dispatch('deleted');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete project';
    } finally {
      isDeleting = false;
    }
  }

  function handleCancel() {
    deleteThreads = false;
    error = '';
    show = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleCancel();
    }
  }
</script>

{#if show && project}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={handleCancel} onkeydown={handleKeydown} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-content warning" onclick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="modal-title" tabindex="0">
      <div class="warning-icon">⚠️</div>
      <h2 id="modal-title">Delete Project</h2>

      <p class="warning-text">
        Are you sure you want to delete <strong>{project.name}</strong>?
      </p>

      {#if threadCount > 0}
        <div class="thread-info">
          <p>This project contains <strong>{threadCount} thread{threadCount !== 1 ? 's' : ''}</strong>.</p>

          <label class="checkbox-label">
            <input type="checkbox" bind:checked={deleteThreads} disabled={isDeleting} />
            <span>Delete all threads in this project</span>
          </label>

          {#if !deleteThreads}
            <p class="info-note">
              If unchecked, threads will be unassigned from this project.
            </p>
          {:else}
            <p class="warning-note">
              ⚠️ This will permanently delete all threads. This action cannot be undone.
            </p>
          {/if}
        </div>
      {/if}

      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick={handleCancel} disabled={isDeleting}>
          Cancel
        </button>
        <button type="button" class="btn-danger" onclick={handleConfirm} disabled={isDeleting}>
          {isDeleting ? 'Deleting...' : 'Delete Project'}
        </button>
      </div>

      <div class="hint">
        Tip: Press <kbd>Esc</kbd> to cancel
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
  }

  .modal-content.warning {
    border: 2px solid var(--error-color);
  }

  .warning-icon {
    font-size: 48px;
    text-align: center;
    margin-bottom: 16px;
  }

  h2 {
    margin: 0 0 16px 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    text-align: center;
  }

  .warning-text {
    margin-bottom: 20px;
    font-size: 15px;
    color: var(--text-primary);
    text-align: center;
  }

  .warning-text strong {
    color: var(--error-color);
  }

  .thread-info {
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    padding: 16px;
    margin-bottom: 16px;
  }

  .thread-info p {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: var(--text-primary);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 14px;
    color: var(--text-primary);
    margin-bottom: 12px;
  }

  .checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .checkbox-label input[type="checkbox"]:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .info-note {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 8px 0 0 0;
    font-style: italic;
  }

  .warning-note {
    font-size: 13px;
    color: var(--error-color);
    margin: 8px 0 0 0;
    font-weight: 500;
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

  kbd {
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 3px;
    padding: 2px 6px;
    font-family: monospace;
    font-size: 11px;
  }
</style>


<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { threadService } from '$lib/services/thread.service';
  import { projectService } from '$lib/services/project.service';
  import { projects } from '$lib/stores/project.store';
  import type { Thread } from '../../../../src-electron/preload';
  import type { Project } from '$lib/types/project.type';
  import type { GUID } from '$lib/types/app.type';

  let { show = $bindable(false), thread = $bindable<Thread | null>(null) }: { show: boolean; thread: Thread | null } = $props();

  const dispatch = createEventDispatcher();

  let selectedProjectId = $state<GUID | null>(null);
  let isMoving = $state(false);
  let error = $state('');
  let showPrivacyConfirmation = $state(false);
  let privacyMode = $state<string>('');
  let contextHandling = $state<string>('merge');

  $effect(() => {
    if (show && thread) {
      // Initialize selected project to current project or null
      selectedProjectId = thread.metadata?.projectId as GUID | null;
      // Load projects if not already loaded
      if ($projects.length === 0) {
        void projectService.loadProjects();
      }
    }
  });

  function getCurrentProjectId(): GUID | null {
    if (!thread) return null;
    return (thread.metadata?.projectId as GUID | undefined) ?? null;
  }

  function getCurrentProject(): Project | null {
    const currentId = getCurrentProjectId();
    if (!currentId) return null;
    return $projects.find((p) => p.id === currentId) ?? null;
  }

  function getTargetProject(): Project | null {
    if (!selectedProjectId) return null;
    return $projects.find((p) => p.id === selectedProjectId) ?? null;
  }

  function needsPrivacyConfirmation(): boolean {
    const current = getCurrentProject();
    const target = getTargetProject();
    if (!current || !target) return false;
    const currentPrivacy = (current.metadata?.privacyMode as string | undefined) ?? 'default';
    const targetPrivacy = (target.metadata?.privacyMode as string | undefined) ?? 'default';
    return currentPrivacy !== targetPrivacy;
  }

  async function handleConfirm() {
    if (!thread) return;

    const currentProjectId = getCurrentProjectId();
    const targetProjectId = selectedProjectId;
    if (currentProjectId === targetProjectId) {
      // No change, just close
      show = false;
      return;
    }

    // Check if privacy confirmation is needed
    if (needsPrivacyConfirmation() && !showPrivacyConfirmation) {
      showPrivacyConfirmation = true;
      return;
    }

    isMoving = true;
    error = '';

    try {
      const options: { privacyMode?: string; contextHandling?: string } = {};
      if (showPrivacyConfirmation) {
        if (privacyMode) options.privacyMode = privacyMode;
        if (contextHandling) options.contextHandling = contextHandling;
      }

      await threadService.moveToProject(thread.id, targetProjectId, options);
      show = false;
      showPrivacyConfirmation = false;
      dispatch('moved', { threadId: thread.id, projectId: targetProjectId });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to move thread';
    } finally {
      isMoving = false;
    }
  }

  function handleCancel() {
    selectedProjectId = getCurrentProjectId();
    error = '';
    showPrivacyConfirmation = false;
    privacyMode = '';
    contextHandling = 'merge';
    show = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleCancel();
    }
  }
</script>

{#if show && thread}
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
      <h2 id="modal-title">Move Thread</h2>

      {#if !showPrivacyConfirmation}
        <p class="info-text">
          Move <strong>{thread.title || 'Untitled Thread'}</strong> to a different location.
        </p>

        <div class="form-group">
          <label for="project-select">Destination</label>
          <select
            id="project-select"
            bind:value={selectedProjectId}
            disabled={isMoving}
            class="project-select"
          >
            <option value="">General History (Unscoped)</option>
            {#each $projects as project}
              <option value={project.id}>{project.title}</option>
            {/each}
          </select>
        </div>

        {#if getCurrentProjectId() !== null && selectedProjectId === null}
          <div class="info-box">
            <p>
              Moving this thread to general history will remove it from its current project. The
              thread will be visible in the general thread list.
            </p>
          </div>
        {/if}
      {:else}
        <div class="privacy-warning">
          <div class="warning-icon">⚠️</div>
          <h3>Privacy Mode Change Detected</h3>
          <p>
            The target project has a different privacy mode than the current project. How would you
            like to handle context and memories?
          </p>

          <div class="form-group">
            <label for="privacy-mode">Privacy Mode</label>
            <select id="privacy-mode" bind:value={privacyMode} disabled={isMoving}>
              <option value="">Use target project's default</option>
              <option value="isolated">Isolated (no context sharing)</option>
              <option value="shared">Shared (context available)</option>
              <option value="private">Private (encrypted)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="context-handling">Context Handling</label>
            <select id="context-handling" bind:value={contextHandling} disabled={isMoving}>
              <option value="merge">Merge (combine with project context)</option>
              <option value="reset">Reset (clear existing context)</option>
              <option value="isolate">Isolate (keep separate)</option>
            </select>
          </div>
        </div>
      {/if}

      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick={handleCancel} disabled={isMoving}>
          Cancel
        </button>
        <button type="button" class="btn-primary" onclick={handleConfirm} disabled={isMoving}>
          {#if isMoving}
            Moving...
          {:else if showPrivacyConfirmation}
            Confirm Move
          {:else}
            Move Thread
          {/if}
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

  h2 {
    margin: 0 0 16px 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
  }

  h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .info-text {
    margin-bottom: 20px;
    font-size: 14px;
    color: var(--text-primary);
  }

  .info-text strong {
    color: var(--primary-color);
  }

  .form-group {
    margin-bottom: 16px;
  }

  label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .project-select,
  select {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    font-size: 14px;
    background: var(--surface-overlay);
    color: var(--text-primary);
    transition: border-color 0.2s;
    cursor: pointer;
  }

  select:focus {
    outline: none;
    border-color: var(--primary-color);
  }

  select:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .info-box {
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 16px;
  }

  .info-box p {
    margin: 0;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .privacy-warning {
    background: var(--surface-overlay);
    border: 1px solid var(--warning-color);
    border-radius: 6px;
    padding: 16px;
    margin-bottom: 16px;
  }

  .warning-icon {
    font-size: 32px;
    color: var(--warning-color);
    text-align: center;
    margin-bottom: 12px;
  }

  .privacy-warning p {
    margin: 0 0 16px 0;
    font-size: 14px;
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

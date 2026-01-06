<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import BaseModal from './BaseModal.svelte';
  import { projectService } from '$lib/services/project.service';
  import type { GUID } from "$lib/types/app.type";

  // Accept minimal project data (can be from sidebar or full Project object)
  let {
    show = $bindable(false),
    project = $bindable<{ id: string; title?: string; name?: string } | null>(null),
  }: { 
    show: boolean; 
    project: { id: string; title?: string; name?: string } | null;
  } = $props();

  const dispatch = createEventDispatcher();

  let deleteThreads = $state(false);
  let isDeleting = $state(false);
  let error = $state('');
  let threadCount = $state(0);

  // Get display title from either title or name field
  const projectTitle = $derived(project ? (project.title || project.name || 'Untitled Project') : 'Untitled Project');
  const submitLabel = $derived(isDeleting ? 'Deleting...' : 'Delete Project');

  $effect(() => {
    if (project && show) {
      loadThreadCount();
    }
  });

  async function loadThreadCount() {
    if (!project) return;
    try {
      threadCount = await projectService.getThreadCount(project.id as GUID);
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
      await projectService.deleteProject(project.id as GUID, deleteThreads);
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
</script>

{#if project}
  <BaseModal
    bind:show
    title="Delete Project"
    {error}
    isSubmitting={isDeleting}
    {submitLabel}
    buttonVariant="danger"
    oncancel={handleCancel}
    onsubmit={handleConfirm}
  >
    {#snippet content()}
      <div class="warning-icon">⚠️</div>

      <p class="warning-text">
        Are you sure you want to delete <strong>{projectTitle}</strong>?
      </p>

      {#if threadCount > 0}
        <div class="thread-info">
          <p>
            This project contains <strong>{threadCount} thread{threadCount !== 1 ? 's' : ''}</strong
            >.
          </p>

          <label class="checkbox-label">
            <input type="checkbox" bind:checked={deleteThreads} disabled={isDeleting} />
            <span>Delete all threads in this project</span>
          </label>

          {#if !deleteThreads}
            <p class="info-note">If unchecked, threads will be unassigned from this project.</p>
          {:else}
            <p class="warning-note">
              ⚠️ This will permanently delete all threads. This action cannot be undone.
            </p>
          {/if}
        </div>
      {/if}
    {/snippet}
  </BaseModal>
{/if}

<style>
  /* Component-specific styles only - modal infrastructure handled by BaseModal */

  .warning-icon {
    font-size: 48px;
    text-align: center;
    margin-bottom: 16px;
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

  .checkbox-label input[type='checkbox'] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .checkbox-label input[type='checkbox']:disabled {
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
</style>

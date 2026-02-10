<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { projectService } from '$lib/services/project.service';
  import { toastStore } from '$lib/services/toast.service';
  import type { GUID } from '$lib/types/app.type';

  let {
    show = $bindable(false),
    project = $bindable<{ id: string; title?: string; name?: string } | null>(null),
  }: {
    show: boolean;
    project: { id: string; title?: string; name?: string } | null;
  } = $props();

  const dispatch = createEventDispatcher();

  let isDeleting = $state(false);

  const projectTitle = $derived(
    project ? project.title || 'Untitled Project' : 'Untitled Project',
  );

  async function handleConfirm() {
    if (!project || isDeleting) return;

    isDeleting = true;

    try {
      await projectService.deleteProject(project.id as GUID, false);
      toastStore.success(`Project "${projectTitle}" deleted successfully`);
      show = false;
      dispatch('deleted');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project';
      toastStore.error(errorMessage);
    } finally {
      isDeleting = false;
    }
  }

  function handleCancel() {
    if (isDeleting) return;
    show = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !isDeleting) {
      handleCancel();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show && project}
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
        <h2 id="delete-dialog-title">Delete Project</h2>
      </div>

      <div class="dialog-content">
        <p class="warning-text">
          Are you sure you want to delete <strong>"{projectTitle}"</strong>?
        </p>
        <p class="warning-subtext">This action cannot be undone.</p>

        <div class="dialog-actions">
          <button type="button" class="btn-secondary" onclick={handleCancel} disabled={isDeleting}>
            Cancel
          </button>
          <button type="button" class="btn-danger" onclick={handleConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete Project'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* All base modal styles are in app.css */
</style>

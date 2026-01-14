<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Thread } from '../../../../src-electron/preload';
  import { ROUTE } from '$lib/constants/route.constant';
  import { projects } from '$lib/stores/project.store';

  const dispatch = createEventDispatcher();

  const { 
    thread, 
    isSelected, 
    showActions
  } = $props<{
    thread: Thread;
    isSelected: boolean;
    showActions?: boolean;
  }>();

  // Determine if thread is in a project or personal space
  const isProjectThread = $derived(!!thread.metadata?.projectId);

  // Check if user has write permissions to any projects
  const hasWritePermissions = $derived(
    Array.isArray($projects) && $projects.some((p) => p.userRole === 'owner' || p.userRole === 'editor')
  );

  function handleClick() {
    dispatch('click', { id: thread.id, label: thread.title, route: ROUTE.THREADS });
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    dispatch('delete', { id: thread.id });
  }

  function handleRename(e: MouseEvent) {
    e.stopPropagation();
    dispatch('rename', { id: thread.id, label: thread.title });
  }

  function handleCopy(e: MouseEvent) {
    e.stopPropagation();
    // If thread is in a project, copy to personal; otherwise copy to project
    if (isProjectThread) {
      dispatch('copyToPersonal', { thread });
    } else {
      dispatch('copyToProject', { thread });
    }
  }

  function formatDate(date: Date | number): string {
    const d = typeof date === 'number' ? new Date(date) : date;

    // Automatically uses the user's browser locale
    return new Intl.DateTimeFormat(undefined, {
      month: 'numeric',
      day: 'numeric',
    }).format(d);
  }

  function getModelName(thread: Thread): string {
    const modelTitle = thread.metadata?.modelTitle;
    if (typeof modelTitle === 'string') {
      return modelTitle;
    }
    return 'unknown';
  }
</script>

<div
  class="thread-item"
  class:selected={isSelected}
  onclick={handleClick}
  role="menuitem"
  tabindex="0"
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  <div class="thread-content">
    <div class="thread-title-container">
      <div class="thread-title">{thread.title}</div>
      {#if showActions}
        <div class="thread-actions">
          <button
            class="action-button copy"
            title={isProjectThread ? "Copy to Personal" : "Copy to Project"}
            onclick={handleCopy}
            disabled={!isProjectThread && !hasWritePermissions}
          >
            <i class="pi pi-copy"></i>
          </button>
          <button
            class="action-button edit"
            title="Edit"
            onclick={handleRename}
          >
            <i class="pi pi-pencil"></i>
          </button>
          <button class="action-button delete" title="Delete" onclick={handleDelete}>
            <i class="pi pi-trash"></i>
          </button>
        </div>
      {/if}
    </div>
    <div class="thread-meta">
      <span>{formatDate(thread.createdAt)}</span>
      <span>{getModelName(thread)}</span>
    </div>
  </div>
</div>

<style>
  .thread-title-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .thread-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
    border-radius: 0.375rem;
    margin: 0.125rem 0.5rem;
    position: relative;
  }

  .thread-item:hover {
    background-color: var(--surface-hover);
  }

  .thread-item.selected {
    border-color: var(--primary-color);
    background-color: transparent;
  }

  .thread-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .thread-title {
    font-size: 11pt;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .thread-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 9pt;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .thread-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    opacity: 0.7;
    flex-shrink: 0;
  }

  .thread-item:hover .thread-actions,
  .thread-actions:hover {
    opacity: 1;
  }

  .action-button {
    background: transparent;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    transition: background-color 0.15s ease;
    flex-shrink: 0;
  }

  .action-button:hover:not(:disabled) {
    background-color: var(--surface-hover);
  }

  .action-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .action-button.copy {
    color: var(--text-primary);
  }

  .action-button.edit {
    color: var(--action-edit-color);
  }

  .action-button.delete {
    color: var(--action-delete-color);
  }

  .action-button i {
    font-size: 0.875rem;
  }
</style>

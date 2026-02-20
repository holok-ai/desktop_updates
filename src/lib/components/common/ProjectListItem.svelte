<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Project } from '$lib/types/project.type';
  import { ROUTE } from '$lib/constants/route.constant';

  const dispatch = createEventDispatcher();

  const {
    project,
    isSelected,
    showActions = true,
  } = $props<{
    project: Project;
    isSelected: boolean;
    showActions?: boolean;
  }>();

  function onClick() {
    dispatch('click', { id: project.id, label: project.title, route: ROUTE.PROJECTS });
  }

  function onDelete(e: MouseEvent) {
    e.stopPropagation();
    dispatch('delete', { id: project.id });
  }
</script>

<div
  class="project-item"
  class:selected={isSelected}
  onclick={onClick}
  role="menuitem"
  tabindex="0"
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onClick();
    }
  }}
>
  <div class="project-content">
    <div class="project-title-container">
      <div class="project-title">{project.title}</div>
      {#if showActions}
        <div class="project-actions">
          <button class="action-button delete" title="Delete" onclick={onDelete}>
            <i class="pi pi-trash"></i>
          </button>
        </div>
      {/if}
    </div>
    <div class="project-meta">
      <span>{project.description}</span>
    </div>
  </div>
</div>

<style>
  .project-item {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
    border-radius: 0.375rem;
    margin: 0.125rem 0.5rem;
  }

  .project-item:hover {
    background-color: var(--surface-hover);
  }

  .project-item.selected {
    border-color: var(--primary-color);
    background-color: transparent;
  }

  .project-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .project-title-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .project-title {
    font-size: 11pt;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 9pt;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .project-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    opacity: 0.7;
    flex-shrink: 0;
  }

  .project-item:hover .project-actions,
  .project-actions:hover {
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

  .action-button:hover {
    background-color: var(--surface-hover);
  }

  .action-button.delete {
    color: var(--action-delete-color);
  }

  .action-button i {
    font-size: 0.875rem;
  }
</style>

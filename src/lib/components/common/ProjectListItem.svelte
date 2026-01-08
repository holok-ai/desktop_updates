<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Project } from '$lib/types/project.type';
  import { ROUTE } from '$lib/constants/route.constant';

  const dispatch = createEventDispatcher();

  const { project, isSelected, showActions = true } = $props<{
    project: Project;
    isSelected: boolean;
    showActions?: boolean;
  }>();

  let isHovered = $state(false);

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
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => (isHovered = false)}
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
      {#if showActions && isHovered}
        <div class="action-buttons">
          <button class="btn-icon-sm delete" title="Delete" onclick={onDelete}>
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
    background-color: var(--thread-list-hover-bg);
  }

  .project-item.selected {
    border-color: var(--accent-color);
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
    color: var(--thread-list-title-color);
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
    color: var(--thread-list-meta-color);
    line-height: 1.4;
  }

  .action-buttons {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }

  .btn-icon-sm.delete {
    color: var(--error-color);
  }
</style>

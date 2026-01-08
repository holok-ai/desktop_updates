<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Project } from '$lib/types/project.type';
  import { ROUTE } from '$lib/constants/route.constant';

  const dispatch = createEventDispatcher();

  const { project, isSelected } = $props<{
    project: Project;
    isSelected: boolean;
  }>();

  function onClick() {
    dispatch('click', { id: project.id, label: project.name, route: ROUTE.PROJECTS });
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
  <div class="thread-content">
    <div class="thread-title-container">
      <div class="thread-title">{project.name}</div>
    </div>
    {#if project.description}
      <div class="thread-meta">
        <span>{project.description}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .thread-title-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .project-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
    border-radius: 0.375rem;
    margin: 0.125rem 0.5rem;
  }

  .project-item:hover {
    background-color: var(--thread-list-hover-bg, rgba(255, 255, 255, 0.05));
  }

  .project-item.selected {
    border-color: #3b82f6;
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
    color: var(--thread-list-title-color, #fff);
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
    color: var(--thread-list-meta-color, rgba(255, 255, 255, 0.7));
    line-height: 1.4;
  }
</style>

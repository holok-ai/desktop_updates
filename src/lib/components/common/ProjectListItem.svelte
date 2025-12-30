<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Project } from '$lib/types/project.type';
  import { ROUTE } from '$lib/constants/route.constant';
  import '../../../lib/styles/moku-colors.css';

  const dispatch = createEventDispatcher();

  const { project, isSelected, showDelete = false } = $props<{
    project: Project;
    isSelected: boolean;
    showDelete?: boolean;
  }>();

  let isHovered = $state(false);

  // AC-3: Extract color and icon from metadata
  const projectColor = $derived(
    (project.metadata?.color as string) || 'default'
  );
  
  const projectIcon = $derived(
    (project.metadata?.icon as string) || 'folder'
  );

  function onClick() {
    dispatch('click', { id: project.id, label: project.title, route: ROUTE.PROJECTS });
  }

  function onDeleteClick(event: MouseEvent) {
    event.stopPropagation(); // Prevent navigation
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
  <!-- AC-3: Project icon and color indicator -->
  <div class="project-visual">
    <!-- Color indicator (12px circle) -->
    <div 
      class="moku-color-indicator moku-color-{projectColor}"
      aria-label="Project color: {projectColor}"
    ></div>
    
    <!-- Project icon placeholder (Lucide icons would go here) -->
    <div class="project-icon" title="Icon: {projectIcon}">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <!-- Folder icon as default -->
        <path
          d="M2 2C1.44772 2 1 2.44772 1 3V13C1 13.5523 1.44772 14 2 14H14C14.5523 14 15 13.5523 15 13V5C15 4.44772 14.5523 4 14 4H8L6 2H2Z"
          fill="currentColor"
          opacity="0.7"
        />
      </svg>
    </div>
  </div>

  <div class="thread-content">
    <div class="thread-title-container">
      <div class="thread-title">{project.title}</div>
      
      <!-- AC-7: Delete button (trash icon) - visible only to owner on hover -->
      {#if showDelete && isHovered}
        <button
          class="delete-button"
          onclick={onDeleteClick}
          title="Delete project"
          aria-label="Delete project"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 2V1C6 0.447715 6.44772 0 7 0H9C9.55228 0 10 0.447715 10 1V2H13C13.5523 2 14 2.44772 14 3C14 3.55228 13.5523 4 13 4H12.9199L12.1986 13.0898C12.1158 14.1616 11.2042 15 10.1283 15H5.87166C4.79576 15 3.88418 14.1616 3.80136 13.0898L3.08008 4H3C2.44772 4 2 3.55228 2 3C2 2.44772 2.44772 2 3 2H6ZM8 2H7V1H9V2H8ZM10.9166 4H5.08342L5.79544 12.9632C5.81496 13.2323 6.03951 13.4444 6.30921 13.4444H9.69079C9.96049 13.4444 10.185 13.2323 10.2046 12.9632L10.9166 4Z"
              fill="currentColor"
            />
          </svg>
        </button>
      {/if}
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
    background-color: var(--thread-list-hover-bg, rgba(255, 255, 255, 0.05));
  }

  .project-item.selected {
    border-color: #3b82f6;
    background-color: transparent;
  }

  /* AC-3: Project visual elements (icon + color) */
  .project-visual {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .project-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
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

  /* AC-7: Delete button styling */
  .delete-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 3px;
    background-color: transparent;
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .delete-button:hover {
    background-color: var(--error-bg, rgba(239, 68, 68, 0.1));
    color: var(--error-color, #ef4444);
  }

  .delete-button:active {
    transform: scale(0.95);
  }
</style>

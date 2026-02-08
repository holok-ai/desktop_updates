<script lang="ts">
  import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
  import type { Project } from '$lib/types/project.type';
  import { favorites } from '$lib/stores/favorite.store';

  let { project }: { project: Project } = $props();

  const isFav = $derived($favorites.some((e) => e.id === project.id));

  function toggleFavorite() {
    favorites.toggleFavorite(project.id, 'project');
  }
</script>

<div class="detail-header">
  <div class="header-info">
    <ProjectIcon
      icon={typeof project.metadata?.icon === 'string' ? project.metadata.icon : undefined}
      color={typeof project.metadata?.color === 'string' ? project.metadata.color : undefined}
      size={48}
      iconSize={24}
    />

    <div class="project-meta">
      <h1 class="project-title">{project.title}</h1>
      {#if project.description}
        <p class="project-description">{project.description}</p>
      {/if}
    </div>
  </div>

  <button
    class="favorite-star"
    class:is-favorited={isFav}
    onclick={toggleFavorite}
    title={isFav ? 'Remove from favorites' : 'Add to favorites'}
    aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
  >
    <i class="pi {isFav ? 'pi-star-fill' : 'pi-star'}"></i>
  </button>
</div>

<style>
  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 24px;
    border-bottom: 1px solid var(--border-color);
    background: var(--background-secondary);
  }

  .header-info {
    display: flex;
    gap: 16px;
    flex: 1;
    min-width: 0; /* Allow text truncation */
  }

  .project-meta {
    flex: 1;
    min-width: 0;
  }

  .project-title {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 8px 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project-description {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .favorite-star {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    background: transparent;
    border-radius: 6px;
    color: var(--text-secondary, #666);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    flex-shrink: 0;
    font-size: 18px;
    align-self: center;
  }

  .favorite-star:hover {
    background: var(--surface-hover, #f0f0f0);
    color: #f59e0b;
  }

  .favorite-star.is-favorited {
    color: #f59e0b;
  }

  .favorite-star.is-favorited:hover {
    color: #d97706;
  }

  /* Dark mode adjustments */
  :global(.dark-mode) .detail-header {
    background: var(--background-secondary);
    border-bottom-color: var(--border-color);
  }
</style>



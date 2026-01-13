<script lang="ts">
  import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';
  import type { Project } from '$lib/types/project.type';

  let { project }: { project: Project } = $props();
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

  /* Dark mode adjustments */
  :global(.dark-mode) .detail-header {
    background: var(--background-secondary);
    border-bottom-color: var(--border-color);
  }
</style>



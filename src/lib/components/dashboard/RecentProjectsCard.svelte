<script lang="ts">
  /**
   * RecentProjectsCard - Displays recent projects with navigation
   */
  import DashboardCard from './DashboardCard.svelte';
  import { push } from 'svelte-spa-router';
  import type { Project } from '$lib/types/project.type';

  const { recentProjects } = $props<{
    recentProjects: Project[];
  }>();

  function navigateToProject(projectId: string) {
    push(`/projects?projectId=${projectId}`);
  }

  function formatDate(dateStr: string | number): string {
    const date = typeof dateStr === 'number' ? new Date(dateStr) : new Date(dateStr);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const hasProjects = $derived((recentProjects?.length || 0) > 0);
</script>

<DashboardCard title="Recent Projects" icon="pi-folder">
  {#snippet children()}
    {#if hasProjects}
      <div class="projects-list">
        {#each recentProjects as project}
          <button class="project-item" onclick={() => navigateToProject(project.id)}>
            <div class="project-info">
              <span class="project-title">{project.name}</span>
              {#if project.description}
                <span class="project-description">{project.description}</span>
              {/if}
            </div>
            <div class="project-meta">
              <span class="project-date">{formatDate(project.updatedAt)}</span>
              <i class="pi pi-chevron-right"></i>
            </div>
          </button>
        {/each}
      </div>
      <div class="card-footer">
        <a href="#/projects" class="view-all-link">View all projects</a>
      </div>
    {:else}
      <div class="empty-state">
        <i class="pi pi-folder empty-icon"></i>
        <p class="empty-text">No projects yet</p>
        <p class="empty-hint">Create your first project to get started</p>
        <a href="#/projects" class="create-project-btn">
          <i class="pi pi-plus"></i>
          Create Project
        </a>
      </div>
    {/if}
  {/snippet}
</DashboardCard>

<style>
  .projects-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
  }

  .project-item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .project-item:hover {
    background: var(--surface-hover, rgba(0, 0, 0, 0.05));
    border-color: var(--primary-color);
    transform: translateX(2px);
  }

  .project-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
  }

  .project-title {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project-description {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .project-date {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .pi-chevron-right {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .card-footer {
    margin-top: auto;
    padding-top: 1rem;
    border-top: 1px solid var(--surface-border);
    display: flex;
    justify-content: flex-end;
  }

  .view-all-link {
    font-size: 0.875rem;
    color: var(--primary-color);
    text-decoration: none;
    font-weight: 500;
    transition: opacity 0.2s ease;
  }

  .view-all-link:hover {
    opacity: 0.8;
    text-decoration: underline;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    text-align: center;
    flex: 1;
  }

  .empty-icon {
    font-size: 3rem;
    color: var(--text-secondary);
    opacity: 0.4;
    margin-bottom: 1rem;
  }

  .empty-text {
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
  }

  .empty-hint {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0 0 1.5rem 0;
    max-width: 300px;
  }

  .create-project-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--primary-color);
    color: white;
    border-radius: 6px;
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
    transition: opacity 0.2s ease;
  }

  .create-project-btn:hover {
    opacity: 0.9;
  }
</style>

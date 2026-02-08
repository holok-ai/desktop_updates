<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { projects } from '$lib/stores/project.store';
  import { projectService } from '$lib/services/project.service';
  import type { Project } from '$lib/types/project.type';
  import { ROUTE } from '$lib/constants/route.constant';
  import { isAuthenticated } from '$lib/stores/auth.store';
  import { toastStore } from '$lib/services/toast.service';

  let isLoading = $state(true);
  let errorMessage = $state<string | null>(null);

  function formatDateTime(date: Date | number): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    const dateStr = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
    const timeStr = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
    return `${dateStr} ${timeStr}`;
  }

  // Auth guard
  $effect(() => {
    if (!$isAuthenticated) {
      toastStore.show('Please log in to access Projects.', { variant: 'info' });
      push(ROUTE.LOGIN);
    }
  });

  onMount(async () => {
    try {
      await projectService.loadProjects();
    } catch (error) {
      console.error('Failed to load projects:', error);
      errorMessage = 'Failed to load projects';
    } finally {
      isLoading = false;
    }
  });

  function handleProjectClick(project: Project) {
    push(`${ROUTE.PROJECTS}?projectId=${encodeURIComponent(project.id)}`);
  }

  function handleCreateProject() {
    push(`${ROUTE.PROJECTS}?create=true`);
  }
</script>

<div class="projects-page">
  {#if errorMessage}
    <div class="error-banner" role="alert">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{errorMessage}</span>
      <button class="error-close" onclick={() => (errorMessage = null)} aria-label="Dismiss error">
        <i class="pi pi-times"></i>
      </button>
    </div>
  {/if}

  <div class="projects-header">
    <button class="btn-holokai" onclick={handleCreateProject}>
      <i class="pi pi-plus"></i>
      New Project
    </button>
  </div>

  {#if isLoading}
    <div class="loading">
      <i class="pi pi-spin pi-spinner"></i>
      <p>Loading projects...</p>
    </div>
  {:else if $projects.length === 0}
    <div class="empty-state">
      <i class="pi pi-folder-open"></i>
      <h2>No Projects Yet</h2>
      <p>Create your first project to get started organizing your work</p>
      <button class="btn-holokai" onclick={handleCreateProject}>
        <i class="pi pi-plus"></i>
        Create Project
      </button>
    </div>
  {:else}
    <div class="projects-grid">
      {#each $projects as project (project.id)}
        <button class="project-card" onclick={() => handleProjectClick(project)}>
          <div class="project-card-header">
            <h3 class="project-title">{project.title}</h3>
            <span class="project-type-badge">{project.type}</span>
          </div>
          {#if project.description}
            <p class="project-description">{project.description}</p>
          {/if}
          <div class="project-card-footer">
            <span class="project-last-opened">Last opened on {formatDateTime(project.updatedAt)}</span>
            {#if project.type === 'shared'}
              <span class="project-owner">{project.createdBy}</span>
            {/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .projects-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 1rem 2rem 2rem 2rem; /* Reduced top padding from 2rem to 1rem */
    overflow-y: auto;
    background: var(--surface-main);
  }

  .projects-header {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-bottom: 2rem;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 1rem;
    color: var(--text-secondary);
  }

  .loading i {
    font-size: 2rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 1rem;
    color: var(--text-secondary);
    text-align: center;
    padding: 2rem;
  }

  .empty-state i {
    font-size: 4rem;
    color: var(--text-tertiary);
    margin-bottom: 1rem;
  }

  .empty-state h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .empty-state p {
    font-size: 1rem;
    max-width: 400px;
    margin: 0 0 1.5rem 0;
  }

  .projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .project-card {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.5rem;
    background: var(--surface-card);
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
  }

  :global(html.dark) .project-card {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .project-card:hover {
    background: var(--surface-hover);
    border-color: var(--primary-color);
  }

  .project-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .project-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .project-type-badge {
    font-size: 0.875rem;
    font-style: italic;
    color: var(--text-secondary);
    text-transform: capitalize;
    flex-shrink: 0;
  }

  .project-description {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .project-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .project-last-opened {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project-owner {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background: var(--error-color, #ef4444);
    color: white;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
  }

  .error-banner i {
    font-size: 1.1rem;
  }

  .error-close {
    margin-left: auto;
    background: transparent;
    border: none;
    color: white;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s ease;
  }

  .error-close:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>

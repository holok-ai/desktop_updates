<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { projects } from '$lib/stores/project.store';
  import { projectService } from '$lib/services/project.service';
  import type { Project } from '$lib/types/project.type';
  import { ROUTE } from '$lib/constants/route.constant';
  import { isAuthenticated } from '$lib/stores/auth.store';
  import { toastStore } from '$lib/services/toast.service';
  import ProjectIcon from '$lib/components/common/ProjectIcon.svelte';

  let isLoading = $state(true);
  let errorMessage = $state<string | null>(null);

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
    <h1>Projects</h1>
    <button class="btn-primary" onclick={handleCreateProject}>
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
      <button class="btn-primary" onclick={handleCreateProject}>
        <i class="pi pi-plus"></i>
        Create Project
      </button>
    </div>
  {:else}
    <div class="projects-grid">
      {#each $projects as project (project.id)}
        <button class="project-card" onclick={() => handleProjectClick(project)}>
          <div class="project-icon-wrapper">
            <ProjectIcon
              icon={typeof project.metadata?.icon === 'string' ? project.metadata.icon : undefined}
              color={typeof project.metadata?.color === 'string' ? project.metadata.color : undefined}
              size={48}
              iconSize={24}
            />
          </div>
          <div class="project-info">
            <h3 class="project-title">{project.title}</h3>
            {#if project.description}
              <p class="project-description">{project.description}</p>
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
    padding: 2rem;
    overflow-y: auto;
    background: var(--surface-main);
  }

  .projects-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .projects-header h1 {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .btn-primary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--primary-color, #4f46e5);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary:hover {
    background: var(--primary-color-hover, #4338ca);
    transform: translateY(-1px);
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
    gap: 1rem;
    padding: 1.5rem;
    background: var(--surface-secondary, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--surface-border);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
  }

  .project-card:hover {
    background: var(--surface-hover, rgba(255, 255, 255, 0.08));
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .project-icon-wrapper {
    flex-shrink: 0;
  }

  .project-info {
    flex: 1;
    min-width: 0;
  }

  .project-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

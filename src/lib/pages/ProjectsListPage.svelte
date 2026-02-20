<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { projects } from '$lib/stores/project.store';
  import { projectService } from '$lib/services/project.service';
  import type { Project } from '$lib/types/project.type';
  import { ROUTE } from '$lib/constants/route.constant';
  import { isAuthenticated } from '$lib/stores/auth.store';
  import { toastStore } from '$lib/services/toast.service';
  import { favorites } from '$lib/stores/favorite.store';
  import ProjectCreateModal from '$lib/modals/ProjectCreateModal.svelte';
  import ProjectRename from '$lib/modals/ProjectRename.svelte';
  import ProjectDelete from '$lib/modals/ProjectDelete.svelte';

  let isLoading = $state(true);
  let errorMessage = $state<string | null>(null);
  let showCreateModal = $state(false);
  let showRenameModal = $state(false);
  let showDeleteModal = $state(false);
  let projectToRename = $state<Project | null>(null);
  let projectToDelete = $state<Project | null>(null);
  let openMenuProjectId = $state<string | null>(null);
  let deleteConfirmationRequired = $state(true);

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
      const [, s] = await Promise.all([
        projectService.loadProjects(),
        window.electronAPI.settings.getAll(),
      ]);
      deleteConfirmationRequired = s.deleteConfirmationRequired ?? true;
    } catch (error) {
      console.error('Failed to load projects:', error);
      errorMessage = 'Failed to load projects';
    } finally {
      isLoading = false;
    }
  });

  function handleProjectClick(project: Project) {
    push(`${ROUTE.PROJECTS_VIEW}?projectId=${encodeURIComponent(project.id)}`);
  }

  function handleCreateProject() {
    showCreateModal = true;
  }

  function toggleMenu(projectId: string, e: MouseEvent) {
    e.stopPropagation();
    openMenuProjectId = openMenuProjectId === projectId ? null : projectId;
  }

  function closeMenu() {
    openMenuProjectId = null;
  }

  function isFavorited(projectId: string): boolean {
    return $favorites.some((e) => e.id === projectId);
  }

  function handleMakeFavorite(project: Project, e: MouseEvent) {
    e.stopPropagation();
    favorites.toggleFavorite(project.id, 'project');
    closeMenu();
  }

  function handleRename(project: Project, e: MouseEvent) {
    e.stopPropagation();
    projectToRename = project;
    showRenameModal = true;
    closeMenu();
  }

  async function handleRenameConfirmed(
    event: CustomEvent<{ projectId: string; newTitle: string }>,
  ) {
    const { projectId, newTitle } = event.detail;

    try {
      await projectService.updateProject(projectId as any, { title: newTitle });
      toastStore.show('Project renamed', { variant: 'success' });
      showRenameModal = false;
      projectToRename = null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to rename project';
      toastStore.show(errorMessage, { variant: 'error' });
    }
  }

  function handleRenameCancel() {
    showRenameModal = false;
    projectToRename = null;
  }

  async function handleDeleteDirect(project: Project) {
    try {
      await projectService.deleteProject(project.id as any, false);
      toastStore.show(`Project "${project.title}" deleted successfully`, { variant: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete project';
      toastStore.show(msg, { variant: 'error' });
    }
  }

  function handleDelete(project: Project, e: MouseEvent) {
    e.stopPropagation();
    closeMenu();
    if (deleteConfirmationRequired) {
      projectToDelete = project;
      showDeleteModal = true;
    } else {
      void handleDeleteDirect(project);
    }
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.project-menu-container')) {
      closeMenu();
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

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
        <div
          class="project-card"
          onclick={() => handleProjectClick(project)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleProjectClick(project);
            }
          }}
          role="button"
          tabindex="0"
          aria-label="Open project {project.title}"
        >
          <div class="project-card-header">
            <h3 class="project-title">{project.title}</h3>
            <div class="project-menu-container">
              <button
                class="project-menu-button"
                onclick={(e) => toggleMenu(project.id, e)}
                aria-label="Project menu"
              >
                ⋯
              </button>
              {#if openMenuProjectId === project.id}
                <div class="project-menu-dropdown">
                  <button class="menu-item" onclick={(e) => handleMakeFavorite(project, e)}>
                    {isFavorited(project.id) ? 'Remove Favorite' : 'Make Favorite'}
                  </button>
                  <button class="menu-item" onclick={(e) => handleRename(project, e)}>
                    Rename
                  </button>
                  <hr class="menu-divider" />
                  <button class="menu-item delete" onclick={(e) => handleDelete(project, e)}>
                    Delete Project
                  </button>
                </div>
              {/if}
            </div>
          </div>
          {#if project.description}
            <p class="project-description">{project.description}</p>
          {/if}
          <div class="project-card-footer">
            <span class="project-last-opened">Opened {formatDateTime(project.updatedAt)}</span>
            <span class="project-type-badge">{project.type}</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<ProjectCreateModal bind:show={showCreateModal} />

{#if showRenameModal && projectToRename}
  <ProjectRename
    projectId={projectToRename.id}
    currentTitle={projectToRename.title}
    on:confirm={handleRenameConfirmed}
    on:cancel={handleRenameCancel}
  />
{/if}

<ProjectDelete bind:show={showDeleteModal} bind:project={projectToDelete} />

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
    padding: 1.1rem 1.5rem 1.5rem 1.5rem;
    background: var(--surface-card);
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
    position: relative;
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
    font-size: 0.75rem;
    font-style: italic;
    color: var(--text-secondary);
    text-transform: capitalize;
    flex-shrink: 0;
  }

  .project-menu-button {
    background: transparent;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .project-menu-button:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
  }

  .project-menu-container {
    position: relative;
  }

  .project-menu-dropdown {
    position: absolute;
    top: calc(100% + 2px);
    right: 0;
    background: #ffffff;
    border: 1px solid var(--input-border);
    border-radius: 0.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 160px;
    z-index: 1000;
    padding: 0.25rem 0;
  }

  :global(html.dark) .project-menu-dropdown {
    background: #2a2a2a;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  }

  .menu-item {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s ease;
    display: block;
  }

  .menu-item:hover:not(:disabled) {
    background-color: var(--surface-hover);
  }

  .menu-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .menu-item.delete {
    color: var(--action-delete-color, #ef4444);
  }

  .menu-divider {
    margin: 0.25rem 0;
    border: none;
    border-top: 1px solid var(--input-border);
    opacity: 0.5;
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

<script lang="ts">
  import { onMount } from 'svelte';
  import { querystring, replace } from 'svelte-spa-router';
  import { projects } from '$lib/stores/project.store';
  import { projectService } from '$lib/services/project.service';
  import type { Project } from '../../../src-electron/preload';
  import { ROUTE } from '$lib/constants/route.constant';
  import ProjectFormModal from '$lib/components/modals/ProjectFormModal.svelte';
  import DeleteProjectModal from '$lib/components/modals/DeleteProjectModal.svelte';

  let selectedProject: Project | null = $state(null);
  let isLoading = $state(true);
  let showFormModal = $state(false);
  let showDeleteModal = $state(false);
  let projectToEdit: Project | null = $state(null);
  let projectToDelete: Project | null = $state(null);
  let threadCount = $state(0);

  onMount(async () => {
    isLoading = true;
    try {
      await projectService.loadProjects();

      const params = new URLSearchParams((window as any).location?.search ?? '');
      if (!params.get('projectId') && !params.get('createProject')) {
        // If no projectId in URL, restore last selected from localStorage
        try {
          const last = window.localStorage.getItem('lastProjectId');
          if (last) {
            const found = $projects.find((p) => p.id === last);
            if (found) {
              selectedProject = found;
              void replace(`${ROUTE.PROJECTS}?projectId=${encodeURIComponent(last)}`);
            }
          }
        } catch {
          // ignore
        }
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      isLoading = false;
    }
  });

  $effect(() => {
    const unsubscribe = querystring.subscribe((qs: string | undefined) => {
      const params = new URLSearchParams(qs ?? '');

      // Check for ?createProject param to open create modal
      if (params.has('createProject') && !showFormModal) {
        handleCreate();
        void replace(ROUTE.PROJECTS);
      }

      const projectId = params.get('projectId');
      if (projectId) {
        const found = $projects.find((project) => project.id === projectId);
        if (found) {
          selectedProject = found;
          loadThreadCount(found.id);
        } else {
          // Project not found (possibly deleted), clear selection
          selectedProject = null;
          replace(ROUTE.PROJECTS);
        }
      } else {
        selectedProject = null;
      }
    });
    return unsubscribe;
  });

  async function loadThreadCount(projectId: string) {
    try {
      threadCount = await projectService.getThreadCount(projectId);
    } catch (error) {
      console.error('Failed to load thread count:', error);
      threadCount = 0;
    }
  }

  function handleEdit() {
    if (selectedProject) {
      projectToEdit = selectedProject;
      showFormModal = true;
    }
  }

  function handleCreate() {
    projectToEdit = null;
    showFormModal = true;
  }

  function handleDelete() {
    if (selectedProject) {
      projectToDelete = selectedProject;
      showDeleteModal = true;
    }
  }

  function handleDeleteSuccess() {
    selectedProject = null;
    window.localStorage.removeItem('lastProjectId');
    replace(ROUTE.PROJECTS);
  }
</script>

<div class="projects-page">
  {#if isLoading}
    <div class="loading">Loading projects...</div>
  {:else if !selectedProject}
    <div class="no-selection">
      <h2>Projects</h2>
      <p>Select a project from the sidebar to view details</p>
      <button onclick={handleCreate}>Create New Project</button>
    </div>
  {:else}
    <div class="project-detail">
      <div class="project-header">
        <div class="project-info">
          <h1>{selectedProject.name}</h1>
          {#if selectedProject.description}
            <p class="description">{selectedProject.description}</p>
          {/if}
        </div>
        <div class="project-actions">
          <button class="btn-secondary" onclick={handleEdit}>
            <i class="pi pi-pencil"></i> Edit
          </button>
          <button class="btn-danger" onclick={handleDelete}>
            <i class="pi pi-trash"></i> Delete
          </button>
        </div>
      </div>

      <div class="project-stats">
        <div class="stat-card">
          <div class="stat-label">Threads</div>
          <div class="stat-value">{threadCount}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Created</div>
          <div class="stat-value">{new Date(selectedProject.createdAt).toLocaleDateString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Last Updated</div>
          <div class="stat-value">{new Date(selectedProject.updatedAt).toLocaleDateString()}</div>
        </div>
      </div>

      <div class="project-content">
        <h3>Project Threads</h3>
        {#if threadCount === 0}
          <div class="empty-threads">
            <p>No threads in this project yet</p>
          </div>
        {:else}
          <p>This project contains {threadCount} thread{threadCount !== 1 ? 's' : ''}</p>
        {/if}
      </div>
    </div>
  {/if}
</div>

<ProjectFormModal bind:show={showFormModal} bind:project={projectToEdit} />
<DeleteProjectModal bind:show={showDeleteModal} bind:project={projectToDelete} on:deleted={handleDeleteSuccess} />

<style>
  .projects-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--surface-main);
    padding: 2rem;
    overflow-y: auto;
  }

  .loading,
  .no-selection {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-secondary);
  }

  .no-selection h2 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }

  .no-selection p {
    margin: 0 0 2rem 0;
  }

  .no-selection button {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: opacity 0.2s;
  }

  .no-selection button:hover {
    opacity: 0.9;
  }

  .project-detail {
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }

  .project-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--surface-border);
  }

  .project-info h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
    color: var(--text-primary);
  }

  .description {
    margin: 0;
    color: var(--text-secondary);
    font-size: 1rem;
  }

  .project-actions {
    display: flex;
    gap: 0.75rem;
  }

  .btn-secondary,
  .btn-danger {
    padding: 10px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-secondary {
    background: var(--surface-overlay);
    color: var(--text-primary);
  }

  .btn-secondary:hover {
    background: var(--surface-hover);
  }

  .btn-danger {
    background: var(--error-color);
    color: white;
  }

  .btn-danger:hover {
    filter: brightness(0.9);
  }

  .project-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    padding: 1.5rem;
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .project-content {
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    padding: 1.5rem;
  }

  .project-content h3 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
    color: var(--text-primary);
  }

  .project-content p {
    margin: 0;
    color: var(--text-secondary);
  }

  .empty-threads {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
  }

  .empty-threads p {
    margin: 0;
  }
</style>

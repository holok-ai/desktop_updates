<script lang="ts">
  import { onMount } from 'svelte';
  import { querystring, replace } from 'svelte-spa-router';
  import { projects } from '$lib/stores/project.store';
  import { threads } from '$lib/stores/thread.store';
  import { projectService } from '$lib/services/project.service';
  import { threadService } from '$lib/services/thread.service';
  import type { Project, Thread } from '../../../src-electron/preload';
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
  let threadsLoading = $state(false);

  onMount(async () => {
    isLoading = true;
    let offUpdated: (() => void) | null = null;
    let offDeleted: (() => void) | null = null;
    try {
      await projectService.loadProjects();
      // Ensure threads are loaded for listing in project view
      try {
        await threadService.getAll();
      } catch (e) {
        console.error('Failed to load threads:', e);
      }
      // Keep threadCount in sync with live updates
      try {
        offUpdated = window.electronAPI.thread.onThreadUpdated(async () => {
          if (selectedProject) {
            await loadThreadCount(selectedProject.id);
          }
        });
        offDeleted = window.electronAPI.thread.onThreadDeleted(async () => {
          if (selectedProject) {
            await loadThreadCount(selectedProject.id);
          }
        });
      } catch {
        // ignore if IPC not available
      }

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
    return () => {
      try {
        if (offUpdated) offUpdated();
        if (offDeleted) offDeleted();
      } catch {
        // ignore
      }
    };
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
          // Ensure threads list is fresh when switching projects
          // No special refresh loop; list reacts to $threads via IPC updates
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

  // Keep threads fresh on first load
  onMount(async () => {
    try {
      threadsLoading = true;
      await threadService.getAll();
    } finally {
      threadsLoading = false;
    }
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

  // Project threads list (reactive without $derived)
  let projectThreads: Thread[] = $state([]);

  $effect(() => {
    if (!selectedProject) {
      projectThreads = [];
      return;
    }
    const pid = selectedProject.id;
    const filtered = $threads
      .filter((t) => (t.metadata?.projectId as string | undefined) === pid)
      .sort((a, b) => {
        const at = new Date((a as any).updatedAt ?? a.createdAt).getTime();
        const bt = new Date((b as any).updatedAt ?? b.createdAt).getTime();
        return bt - at;
      });
    projectThreads = filtered;
  });

  // Debug: verify selection and filtering react when switching projects
  $effect(() => {
    // Logs will appear in renderer DevTools (Cmd+Opt+I)
    try {
      console.log('[Projects] selectedProject:', selectedProject?.id, selectedProject?.name);
      console.log(
        '[Projects] projectThreads:',
        projectThreads.map((t) => ({ id: t.id, title: t.title, pid: (t.metadata as any)?.projectId })),
      );
    } catch {
      // ignore
    }
  });
  function openThread(threadId: string) {
    replace(`${ROUTE.THREADS}?threadId=${encodeURIComponent(threadId)}`);
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
        {#if threadsLoading}
          <div class="empty-threads">
            <p>Loading threads...</p>
          </div>
        {:else if projectThreads.length === 0}
          <div class="empty-threads">
            <p>
              {#if threadCount > 0}
                No visible threads found yet. Try switching views or reopening Threads.
              {:else}
                No threads in this project yet
              {/if}
            </p>
          </div>
        {:else}
          <ul class="thread-list">
            {#each projectThreads as t}
              <li>
                <button class="thread-item" onclick={() => openThread(t.id)} title={t.title}>
                  <span class="thread-title">{t.title || 'Untitled'}</span>
                  <span class="thread-updated">
                    {new Date((t as any).updatedAt ?? t.createdAt).toLocaleString()}
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  {/if}
</div>

<ProjectFormModal bind:show={showFormModal} bind:project={projectToEdit} />
<DeleteProjectModal
  bind:show={showDeleteModal}
  bind:project={projectToDelete}
  on:deleted={handleDeleteSuccess}
/>

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

  .thread-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .thread-item {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    color: var(--text-primary);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
    text-align: left;
  }

  .thread-item:hover {
    background: var(--surface-hover);
    border-color: var(--primary-color);
  }

  .thread-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1 1 auto;
    min-width: 0;
  }

  .thread-updated {
    color: var(--text-secondary);
    font-size: 0.85rem;
    flex: 0 0 auto;
    white-space: nowrap;
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

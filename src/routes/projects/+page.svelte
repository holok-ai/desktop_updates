<script lang="ts">
  import { onMount } from 'svelte';
  import { querystring, replace, push } from 'svelte-spa-router';
  import { projects } from '$lib/stores/project.store';
  import { threads } from '$lib/stores/thread.store';
  import { projectService } from '$lib/services/project.service';
  import { threadService } from '$lib/services/thread.service';
  import type { Project } from '$lib/types/project.type.js';
  import { ROUTE } from '$lib/constants/route.constant';
  import ProjectFormModal from '$lib/components/modals/ProjectFormModal.svelte';
  import DeleteProjectModal from '$lib/components/modals/DeleteProjectModal.svelte';
  import type { Thread } from '../../../src-electron/preload';
  import type { GUID } from '$lib/types/app.type.js';
  import { storageService } from '$lib/services/storage.service';
  import ProjectFormPanel from '$lib/components/projects/ProjectFormPanel.svelte';
  import ProjectDetailView from '$lib/components/projects/ProjectDetailView.svelte';
  import { clearUnsavedChanges } from '$lib/stores/navigation-guard.store';
  import { isAuthenticated } from '$lib/stores/auth.store';
  import { toastStore } from '$lib/services/toast.service';

  import { selectedProjectStore } from '$lib/stores/selected-project.store';

  let showCreatePanel = $state(false); // Track if we should show create panel
  let isLoading = $state(true);
  let showFormModal = $state(false);
  let showDeleteModal = $state(false);
  let projectToEdit: Project | null = $state(null);
  let projectToDelete: Project | null = $state(null);
  let _threadCount = $state(0);
  let _threadsLoading = $state(false);
  let errorMessage = $state<string | null>(null);
  let loadingProjectId: string | null = null; // Guard against multiple simultaneous loads

  // Auth guard: redirect to login if not authenticated
  $effect(() => {
    if (!$isAuthenticated) {
      toastStore.show('Please log in to access Projects.', { variant: 'info' });
      push(ROUTE.LOGIN);
    }
  });

  // Derive selectedProject from store so it auto-updates
  const selectedProject = $derived($selectedProjectStore);

  onMount(() => {
    isLoading = true;
    let offUpdated: (() => void) | null = null;
    let offDeleted: (() => void) | null = null;

    // Run async initialization
    (async () => {
      try {
        await projectService.loadProjects();
        // We no longer load all threads here. 
        // ProjectDetailView will fetch threads for the selected project.
        
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
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        isLoading = false;
      }
    })();

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

      // Check for ?create param to show create panel
      if (params.has('create')) {
        selectedProjectStore.clear();
        showCreatePanel = true;
        storageService.removeLastProjectId();
        return; // Stop here to show create panel
      } else {
        showCreatePanel = false;
      }

      const projectId = params.get('projectId') as GUID | null;
      if (projectId) {
        // Only check if project exists, don't access store reactively
        const currentProjects = $projects; // Capture once, don't make reactive
        const found = currentProjects.find((project) => project.id === projectId);
        if (found) {
          // Only fetch if this is a new project selection AND not already loading
          if (selectedProject?.id !== projectId && loadingProjectId !== projectId) {
            loadingProjectId = projectId;
            selectedProjectStore.select(projectId);
            // Load full project details with members
            (async () => {
              try {
                await projectService.getProjectById(projectId);
                await loadThreadCount(projectId);
              } catch (error) {
                console.error('Failed to load project details:', error);
              } finally {
                if (loadingProjectId === projectId) {
                  loadingProjectId = null;
                }
              }
            })();
          }
          // Ensure threads list is fresh when switching projects
          // No special refresh loop; list reacts to $threads via IPC updates
        } else {
          // Project not found (possibly deleted), clear selection
          selectedProjectStore.clear();
          storageService.removeLastProjectId();
          replace(ROUTE.PROJECTS);
        }
      } else {
        // No projectId in URL - show empty state
        selectedProjectStore.clear();
      }
    });
    return unsubscribe;
  });

  // Keep threads fresh on first load
  onMount(async () => {
    try {
      _threadsLoading = true;
      await threadService.getAll();
    } finally {
      _threadsLoading = false;
    }
  });

  async function loadThreadCount(projectId: GUID) {
    try {
      _threadCount = await projectService.getThreadCount(projectId);
    } catch (error) {
      console.error('Failed to load thread count:', error);
      _threadCount = 0;
      errorMessage = `Failed to load thread count: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  function _handleEdit() {
    if (selectedProject) {
      projectToEdit = selectedProject;
      showFormModal = true;
    }
  }

  function _handleCreate() {
    projectToEdit = null;
    showFormModal = false;
    selectedProjectStore.clear();
    storageService.removeLastProjectId();
    replace(ROUTE.PROJECTS);
  }

  function _handleDelete() {
    if (selectedProject) {
      projectToDelete = selectedProject;
      showDeleteModal = true;
    }
  }

  function handleDeleteSuccess() {
    selectedProjectStore.clear();
    storageService.removeLastProjectId();
    replace(ROUTE.PROJECTS);
  }

  function _openThreadById(threadId: string, projectId?: string | null) {
    if (projectId) {
      storageService.setLastProjectId(projectId);
    }
    storageService.setLastThreadId(threadId);
    const params = new URLSearchParams();
    params.set('threadId', threadId);
    if (projectId) {
      params.set('projectId', projectId);
    }
    replace(`${ROUTE.THREADS}?${params.toString()}`);
  }

  // Project threads list (reactive without $derived)
  let _projectThreads: Thread[] = $state([]);

  $effect(() => {
    if (!selectedProject) {
      _projectThreads = [];
      return;
    }
    const pid = selectedProject.id;
    const filtered = $threads
      .filter((t) => t.metadata?.projectId === pid)
      .sort((a, b) => {
        const at = new Date((a as any).updatedAt ?? a.createdAt).getTime();
        const bt = new Date((b as any).updatedAt ?? b.createdAt).getTime();
        return bt - at;
      });
    _projectThreads = filtered;
  });

  $effect(() => {
    if (selectedProject) {
      clearUnsavedChanges('add-project');
    }
  });

  function handleProjectCreated(event: CustomEvent<{ projectId: string }>) {
    const projectId = event.detail.projectId;
    if (!projectId) {
      return;
    }
    selectedProjectStore.select(projectId);
    storageService.setLastProjectId(projectId);
    replace(`${ROUTE.PROJECTS}?projectId=${encodeURIComponent(projectId)}`);
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
  {#if isLoading}
    <div class="loading">Loading projects...</div>
  {:else if showCreatePanel || !selectedProject}
    <!-- Show create form when ?create=true OR no project selected -->
    <ProjectFormPanel mode="create" on:created={handleProjectCreated} />
  {:else}
    <!-- E3-S6: Use ProjectDetailView component for tabbed dashboard -->
    <ProjectDetailView />
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
    overflow-y: auto;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-secondary);
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

  .error-banner span {
    flex: 1;
  }

  .error-close {
    background: transparent;
    border: none;
    color: white;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .error-close:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>

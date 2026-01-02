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
  import ThreadListItem from '$lib/components/common/ThreadListItem.svelte';
  import type { Thread } from '../../../src-electron/preload';
  import type { GUID } from '$lib/types/app.type.js';
  import { storageService } from '$lib/services/storage.service';
  import ProjectCreatePanel from '$lib/components/projects/ProjectCreatePanel.svelte';
  import ProjectDetailView from '$lib/components/projects/ProjectDetailView.svelte';
  import { clearUnsavedChanges } from '$lib/stores/navigation-guard.store';
  import { isAuthenticated } from '$lib/stores/auth.store';
  import { toastStore } from '$lib/services/toast.service';

  let selectedProjectId: string | null = $state(null);
  let showCreatePanel = $state(false); // Track if we should show create panel
  let isLoading = $state(true);
  let showFormModal = $state(false);
  let showDeleteModal = $state(false);
  let projectToEdit: Project | null = $state(null);
  let projectToDelete: Project | null = $state(null);
  let threadCount = $state(0);
  let threadsLoading = $state(false);
  let errorMessage = $state<string | null>(null);

  // Auth guard: redirect to login if not authenticated
  $effect(() => {
    if (!$isAuthenticated) {
      toastStore.show('Please log in to access Projects.', { variant: 'info' });
      push(ROUTE.LOGIN);
    }
  });

  // Derive selectedProject from store so it auto-updates
  const selectedProject = $derived(
    selectedProjectId ? ($projects.find((p) => p.id === selectedProjectId) ?? null) : null,
  );

  onMount(() => {
    isLoading = true;
    let offUpdated: (() => void) | null = null;
    let offDeleted: (() => void) | null = null;

    // Run async initialization
    (async () => {
      try {
        await projectService.loadProjects();
        // Load all threads including project_only ones for project views
        try {
          await threadService.getAll({ includeProjectOnly: true });
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
        selectedProjectId = null;
        showCreatePanel = true;
        storageService.removeLastProjectId();
        return; // Stop here to show create panel
      } else {
        showCreatePanel = false;
      }

      const projectId = params.get('projectId') as GUID | null;
      if (projectId) {
        const found = $projects.find((project) => project.id === projectId);
        if (found) {
          selectedProjectId = projectId;
          // Load full project details with members
          (async () => {
            try {
              await projectService.getProjectById(projectId);
              await loadThreadCount(projectId);
            } catch (error) {
              console.error('Failed to load project details:', error);
            }
          })();
          // Ensure threads list is fresh when switching projects
          // No special refresh loop; list reacts to $threads via IPC updates
        } else {
          // Project not found (possibly deleted), clear selection
          selectedProjectId = null;
          storageService.removeLastProjectId();
          replace(ROUTE.PROJECTS);
        }
      } else {
        // No projectId in URL - show empty state
        selectedProjectId = null;
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

  async function loadThreadCount(projectId: GUID) {
    try {
      threadCount = await projectService.getThreadCount(projectId);
    } catch (error) {
      console.error('Failed to load thread count:', error);
      threadCount = 0;
      errorMessage = `Failed to load thread count: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
    showFormModal = false;
    selectedProjectId = null;
    storageService.removeLastProjectId();
    replace(ROUTE.PROJECTS);
  }

  function handleDelete() {
    if (selectedProject) {
      projectToDelete = selectedProject;
      showDeleteModal = true;
    }
  }

  function handleDeleteSuccess() {
    selectedProjectId = null;
    storageService.removeLastProjectId();
    replace(ROUTE.PROJECTS);
  }

  function openThreadById(threadId: string, projectId?: string | null) {
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
  let projectThreads: Thread[] = $state([]);

  $effect(() => {
    if (!selectedProject) {
      projectThreads = [];
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
    projectThreads = filtered;
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
    selectedProjectId = projectId;
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
    <ProjectCreatePanel on:created={handleProjectCreated} />
  {:else}
    <!-- E3-S6: Use ProjectDetailView component for tabbed dashboard -->
    <ProjectDetailView project={selectedProject} />
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

  .project-thread-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1rem;
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

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-secondary);
    font-size: 1.1rem;
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
  .badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .badge.personal {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.35);
    color: #3b82f6;
  }

  .badge.shared {
    background: rgba(168, 85, 247, 0.1);
    border-color: rgba(168, 85, 247, 0.35);
    color: #a855f7;
  }

  .members-section {
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .members-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
    color: var(--text-primary);
  }

  .members-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .member-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--surface-main);
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    transition: background 0.2s;
  }

  .member-item:hover {
    background: var(--surface-hover);
  }

  .member-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .member-name {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .member-email {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .member-role {
    display: flex;
    align-items: center;
  }

  .role-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 500;
    text-transform: capitalize;
  }

  .role-badge.role-owner {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #ef4444;
  }

  .role-badge.role-editor {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.35);
    color: #3b82f6;
  }

  .role-badge.role-viewer {
    background: rgba(107, 114, 128, 0.1);
    border: 1px solid rgba(107, 114, 128, 0.35);
    color: #6b7280;
  }
</style>

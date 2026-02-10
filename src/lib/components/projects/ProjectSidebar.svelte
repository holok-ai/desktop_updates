<!--
  ProjectSidebar.svelte
  E3-S4: Project Sidebar UI - Secondary Sidebar Content
  
  Displays Personal and Shared projects grouped by type
  Integrates with ProjectService for CRUD operations
  Shows delete action for owners only
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { projectService } from '$lib/services/project.service';
  import { projects } from '$lib/stores/project.store';
  import ProjectListItem from '../common/ProjectListItem.svelte';
  import { deleteProjectModalStore } from '$lib/stores/delete-project-modal.store';
  import { toastStore } from '$lib/services/toast.service';
  import { push, querystring } from 'svelte-spa-router';
  import { ROUTE } from '$lib/constants/route.constant';
  import type { GUID } from '$lib/types/app.type';

  // Props
  const { collapsed = false } = $props<{ collapsed?: boolean }>();

  // Loading and error states
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Selected project state (from URL)
  let selectedProjectId = $state<string | null>(null);

  // Derive personal and shared projects from store
  // AC-2: Group by type - "Personal" (type=personal) and "Shared" (type=shared)
  const personalProjects = $derived(
    $projects
      .filter((p) => p.type === 'personal')
      .sort((a, b) => {
        // Sort by name
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
      })
  );

  const sharedProjects = $derived(
    $projects
      .filter((p) => p.type === 'shared')
      .sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
      })
  );

  // Track selected project from URL query params
  $effect(() => {
    const unsub = querystring.subscribe((qs: string | undefined) => {
      const params = new URLSearchParams(qs ?? '');
      const pid = params.get('projectId');
      selectedProjectId = pid;
    });
    return unsub;
  });

  // Load projects on mount
  onMount(async () => {
    await loadProjects();
  });

  async function loadProjects(): Promise<void> {
    isLoading = true;
    error = null;

    try {
      await projectService.loadProjects();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load projects';
      console.error('[ProjectSidebar] Load error:', err);
    } finally {
      isLoading = false;
    }
  }

  // AC-4: Navigate to project creation view
  function handleNewProject(): void {
    push(`${ROUTE.PROJECTS}?create=true`);
  }

  // AC-9: Handle project item click - navigate to project detail
  function handleProjectClick(event: CustomEvent<{ id: string }>): void {
    const projectId = event.detail.id;
    push(`${ROUTE.PROJECTS_VIEW}?projectId=${projectId}`);
  }

  // Permission check state (only loading indicator needed)
  let isCheckingPermission = $state(false);

  /**
   * Handle delete click from project list item
   * Fetches project details to check userRole before showing delete modal
   */
  async function handleDeleteClick(event: CustomEvent<{ id: string }>): Promise<void> {
    const projectId = event.detail.id as GUID;
    isCheckingPermission = true;

    try {
      // Fetch full project details to check userRole
      const project = await projectService.getProjectById(projectId);
      
      if (!project) {
        toastStore.show('Project not found', { variant: 'error' });
        return;
      }

      // Check if user is owner
      if (project.userRole === 'owner') {
        // Open global delete modal via store
        deleteProjectModalStore.open({
          id: project.id as GUID,
          title: project.title || 'Untitled Project',
        });
      } else {
        // Show permission error via toast
        toastStore.show(
          `Only project owners can delete projects.`,
          { variant: 'error' }
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check permissions';
      toastStore.show(errorMessage, { variant: 'error' });
      console.error('[ProjectSidebar] Permission check error:', err);
    } finally {
      isCheckingPermission = false;
    }
  }
</script>

<div class="project-sidebar">
  <!-- AC-4: New Project button - full-width -->
  {#if !collapsed}
    <div class="new-project-container">
      <button
        class="new-project-btn"
        onclick={handleNewProject}
        disabled={isLoading}
        aria-label="Create new project"
      >
        <i class="pi pi-plus"></i>
        <span>New Project ...</span>
      </button>
    </div>
  {/if}

  <!-- Error banner -->
  {#if error && !collapsed}
    <div class="error-banner">
      <span>⚠️ {error}</span>
      <button class="retry-button" onclick={loadProjects}>Retry</button>
    </div>
  {/if}

  <!-- Loading state -->
  {#if isLoading && !collapsed}
    <div class="loading-container">
      <i class="pi pi-spin pi-spinner text-2xl text-primary"></i>
      <p>Loading projects...</p>
    </div>
  {:else if !collapsed}
    <!-- Project list -->
    <div class="project-list">
      <!-- AC-2: Personal Projects Section -->
      <div class="project-section">
        <h3 class="section-header">Personal</h3>
        {#if personalProjects.length === 0}
          <div class="empty-state">
            <p>No personal projects</p>
          </div>
        {:else}
          {#each personalProjects as project (project.id)}
            <ProjectListItem
              {project}
              isSelected={selectedProjectId === project.id}
              on:click={handleProjectClick}
              on:delete={handleDeleteClick}
            />
          {/each}
        {/if}
      </div>

      <!-- AC-2: Shared Projects Section -->
      <div class="project-section">
        <h3 class="section-header">Shared</h3>
        {#if sharedProjects.length === 0}
          <div class="empty-state">
            <p>No shared projects</p>
          </div>
        {:else}
          {#each sharedProjects as project (project.id)}
            <ProjectListItem
              {project}
              isSelected={selectedProjectId === project.id}
              on:click={handleProjectClick}
              on:delete={handleDeleteClick}
            />
          {/each}
        {/if}
      </div>

      <!-- Empty state when no projects at all -->
      {#if personalProjects.length === 0 && sharedProjects.length === 0}
        <div class="empty-state-main">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect
              x="8"
              y="16"
              width="48"
              height="40"
              rx="4"
              stroke="currentColor"
              stroke-width="2"
              fill="none"
            />
            <path d="M8 24H56" stroke="currentColor" stroke-width="2" />
            <circle cx="16" cy="20" r="2" fill="currentColor" />
            <circle cx="22" cy="20" r="2" fill="currentColor" />
            <circle cx="28" cy="20" r="2" fill="currentColor" />
          </svg>
          <h4>No projects yet</h4>
          <p>Create your first project to get started</p>
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- Loading overlay for permission check -->
  {#if isCheckingPermission}
    <div class="checking-overlay">
      <i class="pi pi-spin pi-spinner text-3xl text-white"></i>
      <p>Checking permissions...</p>
    </div>
  {/if}
</div>

<style>
  /* AC-1: Secondary Sidebar (280px fixed width) */
  .project-sidebar {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--surface-sidebar-secondary);
    color: var(--text-primary);
    border-right: 1px solid var(--border-sidebar);
    overflow: hidden;
  }

  /* New Project button - matches New Thread styling */
  .new-project-container {
    padding: 0 1rem 0.75rem 1rem;
  }

  .new-project-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.625rem 0.875rem;
    background: var(--surface-sidebar-secondary);
    color: var(--text-primary);
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .new-project-btn:hover:not(:disabled) {
    background-color: var(--thread-list-hover-bg);
  }

  .new-project-btn:focus {
    outline: none;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 35%, transparent);
  }

  .new-project-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Error banner */
  .error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background-color: var(--error-bg);
    border-bottom: 1px solid color-mix(in srgb, var(--error-color) 35%, transparent);
    font-size: 13px;
    color: var(--error-color);
  }

  .retry-button {
    padding: 0.25rem 0.5rem;
    border: 1px solid currentColor;
    border-radius: 3px;
    background-color: transparent;
    color: currentColor;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-button:hover {
    background-color: color-mix(in srgb, var(--error-color) 20%, transparent);
  }

  /* Loading state */
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    gap: 1rem;
  }

  /* Project list */
  .project-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* AC-2: Section grouping */
  .project-section {
    margin-bottom: 1.5rem;
  }

  .section-header {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
    padding: 1rem 1rem 0.5rem;
    margin: 0;
  }

  /* Empty states */
  .empty-state {
    padding: 0.5rem 1rem;
    font-size: 13px;
    color: var(--text-secondary);
    font-style: italic;
  }

  .empty-state-main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.5rem;
    text-align: center;
    gap: 1rem;
  }

  .empty-state-main svg {
    color: var(--text-secondary);
    opacity: 0.5;
  }

  .empty-state-main h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .empty-state-main p {
    margin: 0;
    font-size: 14px;
    color: var(--text-secondary);
  }

  /* Scrollbar styling */
  .project-list::-webkit-scrollbar {
    width: 6px;
  }

  .project-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .project-list::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 3px;
  }

  .project-list::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  /* Checking overlay */
  .checking-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    z-index: 9999;
  }

  .checking-overlay p {
    color: white;
    font-size: 14px;
  }
</style>


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
  let isRefreshing = $state(false);
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

  // AC-5: Refresh button handler - invalidate cache and reload
  async function handleRefresh(): Promise<void> {
    isRefreshing = true;
    error = null;

    try {
      await projectService.loadProjects(true);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to refresh projects';
      console.error('[ProjectSidebar] Refresh error:', err);
    } finally {
      isRefreshing = false;
    }
  }

  // AC-4: Navigate to project creation view
  function handleNewProject(): void {
    push(`${ROUTE.PROJECTS}?create=true`);
  }

  // AC-9: Handle project item click - navigate to project detail
  function handleProjectClick(event: CustomEvent<{ id: string }>): void {
    const projectId = event.detail.id;
    push(`${ROUTE.PROJECTS}?projectId=${projectId}`);
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
          title: project.title || project.name || 'Untitled Project',
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
  <!-- Header with action buttons -->
  {#if !collapsed}
    <div class="sidebar-header">
      <h2 class="sidebar-title">Projects</h2>
      <div class="action-buttons">
      <!-- AC-4: Refresh button -->
      <button
        class="icon-button"
        onclick={handleRefresh}
        disabled={isRefreshing || isLoading}
        title="Refresh projects"
        aria-label="Refresh projects"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          class:spinning={isRefreshing}
        >
          <path
            d="M13.65 2.35C12.2 0.9 10.21 0 8 0 3.58 0 0 3.58 0 8s3.58 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L9 7h7V0l-2.35 2.35z"
            fill="currentColor"
          />
        </svg>
      </button>

      <!-- AC-4: New Project button -->
      <button
        class="primary-button"
        onclick={handleNewProject}
        disabled={isLoading}
        aria-label="Create new project"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 0C7.44772 0 7 0.447715 7 1V7H1C0.447715 7 0 7.44772 0 8C0 8.55228 0.447715 9 1 9H7V15C7 15.5523 7.44772 16 8 16C8.55228 16 9 15.5523 9 15V9H15C15.5523 9 16 8.55228 16 8C16 7.44772 15.5523 7 15 7H9V1C9 0.447715 8.55228 0 8 0Z"
            fill="currentColor"
          />
        </svg>
        <span>New</span>
      </button>
    </div>
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
      <div class="spinner"></div>
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
          <button class="create-first-button" onclick={handleNewProject}>
            Create Project
          </button>
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- Loading overlay for permission check -->
  {#if isCheckingPermission}
    <div class="checking-overlay">
      <div class="spinner"></div>
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
    background-color: var(--sidebar-bg, #1a1a1a);
    color: var(--text-primary, #ffffff);
    overflow: hidden;
  }

  /* Header */
  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  }

  .sidebar-title {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* Icon button (Refresh) */
  .icon-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background-color: transparent;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .icon-button:hover:not(:disabled) {
    background-color: var(--surface-hover, rgba(255, 255, 255, 0.05));
    color: var(--text-primary, #ffffff);
  }

  .icon-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .icon-button svg.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Primary button (New Project) */
  .primary-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border: none;
    border-radius: 4px;
    background-color: var(--button-primary-bg, #3b82f6);
    color: var(--button-primary-text, #ffffff);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .primary-button:hover:not(:disabled) {
    background-color: var(--button-primary-hover, #2563eb);
  }

  .primary-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Error banner */
  .error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background-color: var(--error-bg, rgba(239, 68, 68, 0.1));
    border-bottom: 1px solid var(--error-border, rgba(239, 68, 68, 0.3));
    font-size: 13px;
    color: var(--error-text, #ef4444);
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
    background-color: var(--error-bg, rgba(239, 68, 68, 0.2));
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

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--surface-border, rgba(255, 255, 255, 0.1));
    border-top-color: var(--accent-color, #3b82f6);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
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
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
    padding: 1rem 1rem 0.5rem;
    margin: 0;
  }

  /* Empty states */
  .empty-state {
    padding: 0.5rem 1rem;
    font-size: 13px;
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
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
    color: var(--text-secondary, rgba(255, 255, 255, 0.3));
  }

  .empty-state-main h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #ffffff);
  }

  .empty-state-main p {
    margin: 0;
    font-size: 14px;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  }

  .create-first-button {
    margin-top: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    background-color: var(--button-primary-bg, #3b82f6);
    color: var(--button-primary-text, #ffffff);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .create-first-button:hover {
    background-color: var(--button-primary-hover, #2563eb);
  }

  /* Scrollbar styling */
  .project-list::-webkit-scrollbar {
    width: 6px;
  }

  .project-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .project-list::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
    border-radius: 3px;
  }

  .project-list::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.3));
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

  .checking-overlay .spinner {
    width: 32px;
    height: 32px;
  }

  .checking-overlay p {
    color: white;
    font-size: 14px;
  }
</style>


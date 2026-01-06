<script lang="ts">
  import { querystring, replace, push } from 'svelte-spa-router';
  import { ROUTE } from '$lib/constants/route.constant';
  import { projectService } from '$lib/services/project.service';
  import { threadService } from '$lib/services/thread.service';
  import { toastStore } from '$lib/services/toast.service';
  import ProjectEditPanel from '$lib/components/projects/ProjectEditPanel.svelte';
  import { PROJECT_ICON_SVGS } from '$lib/constants/project-icons';
  import type { Project } from '$lib/types/project.type';
  import ProjectThreadsTab from '$lib/components/projects/detail-tabs/ProjectThreadsTab.svelte';
  import ProjectMembersTab from '$lib/components/projects/detail-tabs/ProjectMembersTab.svelte';
  import ProjectFilesTab from '$lib/components/projects/detail-tabs/ProjectFilesTab.svelte';
  import ProjectSettingsTab from '$lib/components/projects/detail-tabs/ProjectSettingsTab.svelte';

  // Props
  let { project }: { project: Project | null } = $props();

  // Tab state
  type TabId = 'threads' | 'members' | 'files' | 'settings' | 'edit';
  let activeTab = $state<TabId>('threads');
  let isRefreshing = $state(false);
  let refreshError = $state<string | null>(null);
  // Threads tab badge count (emitted by ProjectThreadsTab)
  let threadCount = $state(0);
  let threadsReloadToken = $state(0);

  // Member count for badge display
  const memberCount = $derived(project?.members?.length ?? 0);

  // RBAC: Check if current user is owner (can edit project)
  const isOwner = $derived(project?.userRole === 'owner');
  const canEditProject = $derived(isOwner);

  // Sync tab state with URL query parameter
  $effect(() => {
    const unsubscribe = querystring.subscribe((qs: string | undefined) => {
      const params = new URLSearchParams(qs ?? '');
      const tabParam = params.get('tab') as TabId | null;
      
      // Validate tab parameter and set active tab
      if (tabParam && ['threads', 'members', 'files', 'settings', 'edit'].includes(tabParam)) {
        activeTab = tabParam;
      } else if (!tabParam) {
        // Default to threads tab if no tab param
        activeTab = 'threads';
      }
    });
    return unsubscribe;
  });

  /**
   * Change active tab and update URL
   * When Settings tab is clicked, redirect to edit mode if user has permission
   */
  function setActiveTab(tab: TabId): void {
    const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    
    // Keep projectId param
    const projectId = params.get('projectId');
    
    // Build new URL with tab parameter
    const newParams = new URLSearchParams();
    if (projectId) {
      newParams.set('projectId', projectId);
    }
    
    // If Settings tab is clicked and user can edit, go to edit mode instead
    if (tab === 'settings' && canEditProject) {
      newParams.set('tab', 'edit');
    } else {
      newParams.set('tab', tab);
    }
    
    replace(`${ROUTE.PROJECTS}?${newParams.toString()}`);
  }

  /**
   * Navigate to a thread in the project context
   */
  function handleThreadClick(event: CustomEvent<{ id: string; label: string; route?: string }>): void {
    const { id } = event.detail;
    if (!project) return;

    // Navigate to threads page with both threadId and projectId
    const params = new URLSearchParams();
    params.set('threadId', id);
    params.set('projectId', project.id);
    
    push(`${ROUTE.THREADS}?${params.toString()}`);
  }

  /**
   * Handle thread deletion
   */
  async function handleThreadDelete(event: CustomEvent<{ id: string }>): Promise<void> {
    const { id } = event.detail;
    
    try {
      const ok = await threadService.delete(id);
      if (!ok) {
        throw new Error('Failed to delete thread');
      }
      toastStore.show('Thread deleted', { variant: 'success' });
    } catch (error) {
      refreshError = error instanceof Error ? error.message : 'Failed to delete thread';
      toastStore.show(refreshError, { variant: 'error' });
    }
  }

  /**
   * Create new thread in project context
   */
  function handleNewThread(): void {
    if (!project) return;

    // Navigate to threads page with createThread flag and projectId
    const params = new URLSearchParams();
    params.set('createThread', 'true');
    params.set('projectId', project.id);
    
    push(`${ROUTE.THREADS}?${params.toString()}`);
  }

  /**
   * Handle project updated from edit panel
   */
  function handleProjectUpdated(event: CustomEvent<{ projectId: string }>): void {
    toastStore.show('Project updated successfully', { variant: 'success' });
  }

  /**
   * Refresh project data and active tab content
   */
  async function handleRefresh(): Promise<void> {
    if (!project) return;
    
    isRefreshing = true;
    refreshError = null;
    
    try {
      // 1. Refresh project data (will update cache via service)
      await projectService.getProjectById(project.id);
      
      // 2. Refresh tab-specific data based on active tab
      switch (activeTab) {
        case 'threads':
          // Ask threads tab to reload
          threadsReloadToken += 1;
          break;
        
        case 'members':
          // Members are already refreshed with project data
          // No additional API call needed
          break;
        
        case 'files':
          // Files tab is placeholder - no data to refresh
          break;
        
        case 'settings':
          // Settings data already refreshed with project data
          break;
      }
      
      // Show success toast
      toastStore.show('Project refreshed successfully', { variant: 'success' });
      
      console.log(`✅ Refreshed project: ${project.title}, active tab: ${activeTab}`);
    } catch (error) {
      refreshError = error instanceof Error ? error.message : 'Failed to refresh project';
      console.error('❌ Refresh error:', error);
      
      // Show error toast
      toastStore.show(refreshError, { variant: 'error' });
    } finally {
      isRefreshing = false;
    }
  }

  // Tab configuration
  const tabs: Array<{ id: TabId; label: string; icon: string; badge?: number }> = $derived([
    { id: 'threads', label: 'Threads', icon: 'pi-comments', badge: threadCount },
    { id: 'members', label: 'Members', icon: 'pi-users', badge: memberCount },
    { id: 'files', label: 'Files', icon: 'pi-folder' },
    { id: 'settings', label: 'Settings', icon: 'pi-cog' },
  ]);
</script>

{#if project}
  <div class="project-detail-view">
    <!-- Header with project info and refresh button -->
    <div class="detail-header">
      <div class="header-info">
        <div 
          class="project-icon" 
          style="background-color: {project.metadata?.color || '#3B82F6'};"
        >
          {#if project.metadata?.icon && typeof project.metadata.icon === 'string' && PROJECT_ICON_SVGS[project.metadata.icon]}
            <svg width="24" height="24" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d={PROJECT_ICON_SVGS[project.metadata.icon]} fill="currentColor" />
            </svg>
          {:else}
            <svg width="24" height="24" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d={PROJECT_ICON_SVGS['folder']} fill="currentColor" />
            </svg>
          {/if}
        </div>
        <div class="project-meta">
          <h1 class="project-title">{project.title}</h1>
          {#if project.description}
            <p class="project-description">{project.description}</p>
          {/if}
        </div>
      </div>
      
      <div class="header-actions">
        <button
          class="btn-icon"
          onclick={handleRefresh}
          disabled={isRefreshing}
          aria-label="Refresh project"
          title="Refresh project"
        >
          <i class="pi pi-refresh {isRefreshing ? 'spinning' : ''}"></i>
        </button>
      </div>
    </div>

    {#if refreshError}
      <div class="error-banner" role="alert">
        <i class="pi pi-exclamation-triangle"></i>
        <span>{refreshError}</span>
        <button
          class="btn-close"
          onclick={() => (refreshError = null)}
          aria-label="Dismiss error"
        >
          <i class="pi pi-times"></i>
        </button>
      </div>
    {/if}

    <!-- Tab navigation -->
    <div class="tab-nav" role="tablist" aria-label="Project sections">
      {#each tabs as tab}
        <button
          class="tab-button {activeTab === tab.id ? 'active' : ''}"
          onclick={() => setActiveTab(tab.id)}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls="{tab.id}-panel"
          id="{tab.id}-tab"
        >
          <i class="pi {tab.icon}"></i>
          <span>{tab.label}</span>
          {#if tab.badge !== undefined && tab.badge > 0}
            <span class="tab-badge">{tab.badge}</span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Tab content -->
    <div class="tab-content">
      {#if activeTab === 'threads'}
        <div
          id="threads-panel"
          role="tabpanel"
          aria-labelledby="threads-tab"
          class="tab-panel"
        >
          <ProjectThreadsTab
            projectId={project.id}
            reloadToken={threadsReloadToken}
            on:threadClick={handleThreadClick}
            on:newThread={handleNewThread}
            on:threadDelete={handleThreadDelete}
            on:threadCountChanged={(e) => (threadCount = e.detail.count)}
            on:error={(e) => {
              refreshError = e.detail.message;
              toastStore.show(e.detail.message, { variant: 'error' });
            }}
          />
        </div>
      {:else if activeTab === 'members'}
        <div
          id="members-panel"
          role="tabpanel"
          aria-labelledby="members-tab"
          class="tab-panel"
        >
          <ProjectMembersTab {project} />
        </div>
      {:else if activeTab === 'files'}
        <div
          id="files-panel"
          role="tabpanel"
          aria-labelledby="files-tab"
          class="tab-panel"
        >
          <ProjectFilesTab />
        </div>
      {:else if activeTab === 'settings'}
        <div
          id="settings-panel"
          role="tabpanel"
          aria-labelledby="settings-tab"
          class="tab-panel"
        >
          <ProjectSettingsTab {project} />
        </div>
      {:else if activeTab === 'edit'}
        <div
          id="edit-panel"
          role="tabpanel"
          aria-labelledby="edit-tab"
          class="tab-panel"
        >
          {#if project && canEditProject}
            <ProjectEditPanel 
              {project}
              on:updated={handleProjectUpdated}
            />
          {:else}
            <div class="empty-state">
              <i class="pi pi-lock"></i>
              <h3>No Permission</h3>
              <p>You don't have permission to edit this project</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{:else}
  <div class="empty-state">
    <i class="pi pi-folder-open"></i>
    <p>No project selected</p>
  </div>
{/if}

<style>
  /* 
   * Note: Some CSS classes are flagged as "unused" by the linter because they use dynamic
   * class names (e.g., role-{member.memberRole.toLowerCase()}). These are intentional and
   * should not be removed. The linter cannot detect dynamic Svelte class bindings.
   */
  .project-detail-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--background);
  }

  /* Header */
  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 24px;
    border-bottom: 1px solid var(--border-color);
    background: var(--background-secondary);
  }

  .header-info {
    display: flex;
    gap: 16px;
    flex: 1;
    min-width: 0; /* Allow text truncation */
  }

  .project-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 8px;
    /* Background color set via inline style from metadata.color */
    color: white;
    font-size: 24px;
    flex-shrink: 0;
  }

  .project-meta {
    flex: 1;
    min-width: 0;
  }

  .project-title {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 8px 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project-description {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--background);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-icon:hover:not(:disabled) {
    background: var(--background-hover);
    border-color: var(--border-color-hover);
  }

  .btn-icon:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-icon i {
    font-size: 18px;
  }

  .spinning {
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

  /* Error banner */
  .error-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 24px;
    background: var(--error-background);
    border-bottom: 1px solid var(--error-border);
    color: var(--error-text);
  }

  .error-banner i.pi-exclamation-triangle {
    font-size: 18px;
    flex-shrink: 0;
  }

  .error-banner span {
    flex: 1;
    font-size: 14px;
  }

  .btn-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: var(--error-text);
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .btn-close:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  /* Tab navigation */
  .tab-nav {
    display: flex;
    padding: 0 24px;
    border-bottom: 1px solid var(--border-color);
    background: var(--background-secondary);
    overflow-x: auto;
  }

  .tab-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .tab-button:hover:not(.active) {
    color: var(--text-primary);
    background: var(--background-hover);
  }

  .tab-button.active {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
  }

  .tab-button i {
    font-size: 16px;
  }

  .tab-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--primary-color);
    color: var(--text-on-primary);
    font-size: 12px;
    font-weight: 600;
    margin-left: 8px;
  }

  .tab-button:not(.active) .tab-badge {
    background: var(--text-secondary);
    color: var(--background);
    opacity: 0.6;
  }

  /* Tab content */
  .tab-content {
    flex: 1;
    overflow: auto;
  }

  .tab-panel {
    height: 100%;
    padding: 24px;
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    color: var(--text-secondary);
    text-align: center;
    padding: 40px;
  }

  .empty-state i {
    font-size: 24px;
    opacity: 0.3;
  }

  .empty-state h3 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: var(--text-primary);
  }

  .empty-state p {
    font-size: 14px;
    margin: 0 0 24px 0;
    max-width: 4000px;
  }

  /* Dark mode adjustments */
  :global(.dark-mode) .detail-header {
    background: var(--background-secondary);
    border-bottom-color: var(--border-color);
  }

  :global(.dark-mode) .tab-nav {
    background: var(--background-secondary);
    border-bottom-color: var(--border-color);
  }

  :global(.dark-mode) .btn-icon {
    background: var(--background);
    border-color: var(--border-color);
  }

  :global(.dark-mode) .btn-icon:hover:not(:disabled) {
    background: var(--background-hover);
  }

</style>


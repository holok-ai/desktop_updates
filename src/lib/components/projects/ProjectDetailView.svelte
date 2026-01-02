<script lang="ts">
  import { querystring, replace, push } from 'svelte-spa-router';
  import { ROUTE } from '$lib/constants/route.constant';
  import { threads } from '$lib/stores/thread.store';
  import { projectService } from '$lib/services/project.service';
  import { threadService } from '$lib/services/thread.service';
  import { toastStore } from '$lib/services/toast.service';
  import ThreadListItem from '$lib/components/common/ThreadListItem.svelte';
  import ProjectFormModal from '$lib/components/modals/ProjectFormModal.svelte';
  import type { Project } from '$lib/types/project.type';

  // Props
  let { project }: { project: Project | null } = $props();

  // Tab state
  type TabId = 'threads' | 'members' | 'files' | 'settings';
  let activeTab = $state<TabId>('threads');
  let isRefreshing = $state(false);
  let refreshError = $state<string | null>(null);

  // Modal state for Settings tab
  let showEditModal = $state(false);
  let projectToEdit = $state<Project | null>(null);

  // Filter threads by current project
  const projectThreads = $derived(
    project
      ? $threads.filter((t) => {
          const threadProjectId = t.metadata?.projectId as string | undefined;
          return threadProjectId === project.id;
        })
      : []
  );

  // Thread count for badge display
  const threadCount = $derived(projectThreads.length);

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
      if (tabParam && ['threads', 'members', 'files', 'settings'].includes(tabParam)) {
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
    newParams.set('tab', tab);
    
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
      // TODO: Implement thread deletion via service
      // await threadService.softDelete(id);
      console.log('Delete thread:', id);
    } catch (error) {
      console.error('Failed to delete thread:', error);
      refreshError = error instanceof Error ? error.message : 'Failed to delete thread';
    }
  }

  /**
   * Handle thread rename
   */
  function handleThreadRename(event: CustomEvent<{ id: string; label: string }>): void {
    const { id, label } = event.detail;
    
    // TODO: Implement thread rename via modal
    console.log('Rename thread:', id, label);
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
   * Open edit project modal (Settings tab)
   */
  function handleEditProject(): void {
    if (!project || !canEditProject) return;
    
    projectToEdit = project;
    showEditModal = true;
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
          // Reload threads for this project
          await threadService.getAll({ includeProjectOnly: true });
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
        <div class="project-icon">
          <i class="pi pi-folder"></i>
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
          {#if projectThreads.length === 0}
            <div class="empty-state">
              <i class="pi pi-comments"></i>
              <h3>No threads yet</h3>
              <p>Create a new thread to get started with this project</p>
              <button class="btn-primary" onclick={handleNewThread}>
                <i class="pi pi-plus"></i>
                <span>New Thread</span>
              </button>
            </div>
          {:else}
            <div class="thread-list-header">
              <h2 class="thread-list-title">Threads ({threadCount})</h2>
              <button class="btn-primary" onclick={handleNewThread}>
                <i class="pi pi-plus"></i>
                <span>New Thread</span>
              </button>
            </div>
            <div class="thread-list">
              {#each projectThreads as thread (thread.id)}
                <ThreadListItem
                  {thread}
                  isSelected={false}
                  showActions={true}
                  on:click={handleThreadClick}
                  on:rename={handleThreadRename}
                  on:delete={handleThreadDelete}
                />
              {/each}
            </div>
          {/if}
        </div>
      {:else if activeTab === 'members'}
        <div
          id="members-panel"
          role="tabpanel"
          aria-labelledby="members-tab"
          class="tab-panel"
        >
          {#if !project?.members || project.members.length === 0}
            <div class="empty-state">
              <i class="pi pi-users"></i>
              <h3>You're the only member</h3>
              <p>Invite team members to collaborate on this project</p>
              <p class="info-note">
                <i class="pi pi-info-circle"></i>
                Member management will be available in Settings
              </p>
            </div>
          {:else}
            <div class="members-section">
              <div class="members-header">
                <h2 class="members-title">Members ({project.members.length})</h2>
              </div>

              <!-- Active Members List -->
              <div class="members-list">
                {#each project.members as member (member.id)}
                  <div class="member-card">
                    <div class="member-avatar">
                      <i class="pi pi-user"></i>
                    </div>
                    <div class="member-info">
                      <div class="member-name">{member.userName}</div>
                      <div class="member-email">{member.email}</div>
                    </div>
                    <div class="member-role">
                      <span class="role-badge role-{member.memberRole.toLowerCase()}">
                        {member.memberRole}
                      </span>
                    </div>
                  </div>
                {/each}
              </div>

              <!-- Pending Invitations (Future) -->
              <div class="pending-invitations">
                <h3 class="section-title">Pending Invitations</h3>
                <div class="empty-invitations">
                  <i class="pi pi-envelope"></i>
                  <p>No pending invitations</p>
                </div>
              </div>

              <!-- Info Note -->
              <div class="info-banner">
                <i class="pi pi-info-circle"></i>
                <span>To invite members or manage roles, use the Settings tab or project actions menu.</span>
              </div>
            </div>
          {/if}
        </div>
      {:else if activeTab === 'files'}
        <div
          id="files-panel"
          role="tabpanel"
          aria-labelledby="files-tab"
          class="tab-panel"
        >
          <div class="placeholder-future">
            <div class="placeholder-icon">
              <i class="pi pi-folder"></i>
            </div>
            <h3 class="placeholder-title">File Management</h3>
            <p class="placeholder-description">
              File management for project collaboration will be available in a future update.
            </p>
            <div class="placeholder-features">
              <h4>Coming Soon:</h4>
              <ul>
                <li>
                  <i class="pi pi-check"></i>
                  <span>Upload and share files with team members</span>
                </li>
                <li>
                  <i class="pi pi-check"></i>
                  <span>Version control and file history</span>
                </li>
                <li>
                  <i class="pi pi-check"></i>
                  <span>File preview and inline comments</span>
                </li>
                <li>
                  <i class="pi pi-check"></i>
                  <span>Integration with Storage Service (S3/Azure)</span>
                </li>
              </ul>
            </div>
            <div class="placeholder-note">
              <i class="pi pi-info-circle"></i>
              <span>This feature is planned for Phase 3 (Epic 9: File Attachments)</span>
            </div>
          </div>
        </div>
      {:else if activeTab === 'settings'}
        <div
          id="settings-panel"
          role="tabpanel"
          aria-labelledby="settings-tab"
          class="tab-panel"
        >
          {#if project}
            <div class="settings-section">
              <!-- Header with Edit button -->
              <div class="settings-header">
                <h2 class="settings-title">Project Settings</h2>
                {#if canEditProject}
                  <button class="btn-secondary" onclick={handleEditProject}>
                    <i class="pi pi-pencil"></i>
                    <span>Edit Project</span>
                  </button>
                {/if}
              </div>

              <!-- Project Details -->
              <div class="settings-group">
                <h3 class="group-title">Details</h3>
                <div class="settings-grid">
                  <!-- Title -->
                  <div class="setting-item">
                    <div class="setting-label">Project Title</div>
                    <div class="setting-value">{project.title}</div>
                  </div>

                  <!-- Description -->
                  <div class="setting-item full-width">
                    <div class="setting-label">Description</div>
                    <div class="setting-value">
                      {project.description || 'No description provided'}
                    </div>
                  </div>

                  <!-- Type -->
                  <div class="setting-item">
                    <div class="setting-label">Type</div>
                    <div class="setting-value">
                      <span class="type-badge type-{project.type}">
                        {project.type === 'shared' ? 'Shared' : 'Personal'}
                      </span>
                    </div>
                  </div>

                  <!-- Status -->
                  <div class="setting-item">
                    <div class="setting-label">Status</div>
                    <div class="setting-value">
                      <span class="status-badge status-{project.active ? 'active' : 'inactive'}">
                        {project.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <!-- Created -->
                  <div class="setting-item">
                    <div class="setting-label">Created</div>
                    <div class="setting-value">
                      {new Date(project.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </div>

                  <!-- Updated -->
                  <div class="setting-item">
                    <div class="setting-label">Last Updated</div>
                    <div class="setting-value">
                      {new Date(project.updatedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Appearance (if metadata exists) -->
              {#if project.metadata}
                <div class="settings-group">
                  <h3 class="group-title">Appearance</h3>
                  <div class="settings-grid">
                    <!-- Color -->
                    {#if typeof project.metadata.color === 'string'}
                      <div class="setting-item">
                        <div class="setting-label">Color</div>
                        <div class="setting-value">
                          <div class="color-indicator" style="background-color: {project.metadata.color}"></div>
                        </div>
                      </div>
                    {/if}

                    <!-- Icon -->
                    {#if typeof project.metadata.icon === 'string'}
                      <div class="setting-item">
                        <div class="setting-label">Icon</div>
                        <div class="setting-value">
                          <i class="pi pi-{project.metadata.icon}"></i>
                          <span>{project.metadata.icon}</span>
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}

              <!-- Info Notes -->
              <div class="settings-info">
                <div class="info-box">
                  <i class="pi pi-info-circle"></i>
                  <div>
                    <strong>Note:</strong> To delete this project, use the delete button in the sidebar.
                    {#if !canEditProject}
                      Only the project owner can edit or delete this project.
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Edit Project Modal -->
  <ProjectFormModal bind:show={showEditModal} bind:project={projectToEdit} />
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
    background: var(--primary-color);
    color: var(--text-on-primary);
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

  /* Thread list */
  .thread-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .thread-list-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: var(--primary-color);
    color: var(--text-on-primary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary:hover {
    background: var(--primary-color-hover);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .btn-primary:active {
    transform: translateY(0);
  }

  .btn-primary i {
    font-size: 14px;
  }

  .thread-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* Members section */
  .members-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .members-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .members-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .members-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .member-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--background-secondary);
    transition: all 0.2s;
  }

  .member-card:hover {
    border-color: var(--border-color-hover);
    background: var(--background-hover);
  }

  .member-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--primary-color);
    color: var(--text-on-primary);
    font-size: 20px;
    flex-shrink: 0;
  }

  .member-info {
    flex: 1;
    min-width: 0;
  }

  .member-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .member-email {
    font-size: 13px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .member-role {
    flex-shrink: 0;
  }

  .role-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    text-transform: capitalize;
  }

  .role-badge.role-owner {
    background: var(--error-background);
    color: var(--error-text);
  }

  .role-badge.role-editor {
    background: var(--warning-background);
    color: var(--warning-text);
  }

  .role-badge.role-viewer {
    background: var(--info-background);
    color: var(--info-text);
  }

  /* Pending invitations */
  .pending-invitations {
    padding-top: 24px;
    border-top: 1px solid var(--border-color);
  }

  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 16px 0;
  }

  .empty-invitations {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px;
    border: 1px dashed var(--border-color);
    border-radius: 8px;
    color: var(--text-secondary);
    text-align: center;
  }

  .empty-invitations i {
    font-size: 48px;
    margin-bottom: 12px;
    opacity: 0.3;
  }

  .empty-invitations p {
    font-size: 14px;
    margin: 0;
  }

  /* Info banner */
  .info-banner {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    background: var(--info-background);
    border: 1px solid var(--info-border);
    color: var(--info-text);
    font-size: 14px;
    line-height: 1.5;
  }

  .info-banner i {
    font-size: 18px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .info-note {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 8px;
  }

  .info-note i {
    font-size: 14px;
    opacity: 0.7;
  }

  /* Placeholder for future features */
  .placeholder-future {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 600px;
    margin: 0 auto;
    padding: 60px 40px;
    text-align: center;
  }

  .placeholder-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--background-secondary);
    border: 2px solid var(--border-color);
    margin-bottom: 24px;
  }

  .placeholder-icon i {
    font-size: 40px;
    color: var(--text-secondary);
    opacity: 0.5;
  }

  .placeholder-title {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 12px 0;
  }

  .placeholder-description {
    font-size: 15px;
    color: var(--text-secondary);
    margin: 0 0 32px 0;
    line-height: 1.6;
  }

  .placeholder-features {
    width: 100%;
    text-align: left;
    padding: 24px;
    border-radius: 8px;
    background: var(--background-secondary);
    border: 1px solid var(--border-color);
  }

  .placeholder-features h4 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 16px 0;
    text-align: center;
  }

  .placeholder-features ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .placeholder-features li {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .placeholder-features li i {
    font-size: 16px;
    color: var(--success-text);
    flex-shrink: 0;
    margin-top: 2px;
  }

  .placeholder-note {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 24px;
    padding: 12px 16px;
    border-radius: 6px;
    background: var(--info-background);
    border: 1px solid var(--info-border);
    color: var(--info-text);
    font-size: 13px;
  }

  .placeholder-note i {
    font-size: 16px;
    flex-shrink: 0;
  }

  /* Settings section */
  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .settings-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--background);
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: var(--background-hover);
    border-color: var(--border-color-hover);
  }

  .btn-secondary i {
    font-size: 14px;
  }

  .settings-group {
    padding: 24px;
    border-radius: 8px;
    background: var(--background-secondary);
    border: 1px solid var(--border-color);
  }

  .group-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 20px 0;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
  }

  .setting-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .setting-item.full-width {
    grid-column: 1 / -1;
  }

  .setting-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .setting-value {
    font-size: 15px;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .type-badge,
  .status-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    text-transform: capitalize;
  }

  .type-badge.type-shared {
    background: var(--primary-background);
    color: var(--primary-text);
  }

  .type-badge.type-personal {
    background: var(--info-background);
    color: var(--info-text);
  }

  .status-badge.status-active {
    background: var(--success-background);
    color: var(--success-text);
  }

  .status-badge.status-inactive {
    background: var(--error-background);
    color: var(--error-text);
  }

  .color-indicator {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
  }

  .settings-info {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .info-box {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border-radius: 8px;
    background: var(--info-background);
    border: 1px solid var(--info-border);
    color: var(--info-text);
    font-size: 14px;
    line-height: 1.6;
  }

  .info-box i {
    font-size: 18px;
    flex-shrink: 0;
    margin-top: 2px;
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
    font-size: 64px;
    margin-bottom: 16px;
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
    max-width: 400px;
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


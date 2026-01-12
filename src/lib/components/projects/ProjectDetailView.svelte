<script lang="ts">
  import { selectedProjectStore } from '$lib/stores/selected-project.store';
  import { querystring, replace, push } from 'svelte-spa-router';
  import { ROUTE } from '$lib/constants/route.constant';
  import { threadService } from '$lib/services/thread.service';
  import { toastStore } from '$lib/services/toast.service';
  import ProjectFormPanel from '$lib/components/projects/ProjectFormPanel.svelte';
  import ProjectHeader from '$lib/components/projects/ProjectHeader.svelte';
  import ProjectTabNavigation, { type ProjectTab } from '$lib/components/projects/ProjectTabNavigation.svelte';
  import ProjectThreadsTab from '$lib/components/projects/detail-tabs/ProjectThreadsTab.svelte';
  import ProjectMembersTab from '$lib/components/projects/detail-tabs/ProjectMembersTab.svelte';
  import ProjectFilesTab from '$lib/components/projects/detail-tabs/ProjectFilesTab.svelte';
  import ProjectSettingsTab from '$lib/components/projects/detail-tabs/ProjectSettingsTab.svelte';
  import ThreadRenameModal from '$lib/components/common/ThreadRenameModal.svelte';
  import ThreadDeleteModal from '$lib/components/common/ThreadDeleteModal.svelte';

  // Selected project from store
  const project = $derived($selectedProjectStore);

  // Tab state
  type TabId = 'threads' | 'members' | 'files' | 'settings' | 'edit';
  let activeTab = $state<TabId>('threads');
  // Threads tab badge count (emitted by ProjectThreadsTab)
  let threadCount = $state(0);
  let threadsReloadToken = $state(0);

  // Thread rename/delete state
  let showThreadRenameModal = $state(false);
  let showThreadDeleteModal = $state(false);
  let threadToRename = $state<{ id: string; title: string } | null>(null);
  let threadToDelete = $state<{ id: string; title: string } | null>(null);

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
  function setActiveTab(tabId: string): void {
    const tab = tabId as TabId;
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
   * Handle thread rename
   */
  function handleThreadRename(event: CustomEvent<{ id: string; label: string }>): void {
    const { id, label } = event.detail;
    threadToRename = { id, title: label };
    showThreadRenameModal = true;
  }

  /**
   * Handle thread rename confirmed
   */
  async function handleThreadRenameConfirmed(event: CustomEvent<{ threadId: string; newTitle: string }>): Promise<void> {
    const { threadId, newTitle } = event.detail;
    
    try {
      const result = await threadService.rename(threadId, newTitle);
      
      if (result.success) {
        toastStore.show('Thread renamed', { variant: 'success' });
        showThreadRenameModal = false;
        threadToRename = null;
        // Trigger reload
        threadsReloadToken++;
      } else {
        // Handle validation errors from backend
        let errorMsg = result.error || 'Failed to rename thread';
        if (result.code === 'TITLE_EMPTY') {
          errorMsg = 'Thread title cannot be empty';
        } else if (result.code === 'TITLE_TOO_LONG') {
          errorMsg = 'Thread title is too long (max 100 characters)';
        }
        toastStore.show(errorMsg, { variant: 'error' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to rename thread';
      toastStore.show(errorMessage, { variant: 'error' });
    }
  }

  /**
   * Handle thread deletion
   */
  async function handleThreadDelete(event: CustomEvent<{ id: string }>): Promise<void> {
    const { id } = event.detail;
    
    // Find thread to get its title
    const thread = await threadService.getThread(id);
    if (!thread) {
      toastStore.show('Thread not found', { variant: 'error' });
      return;
    }
    
    threadToDelete = { id, title: thread.title };
    showThreadDeleteModal = true;
  }

  /**
   * Handle thread deletion confirmed
   */
  async function handleThreadDeleteConfirmed(): Promise<void> {
    if (!threadToDelete) return;
    
    try {
      const ok = await threadService.delete(threadToDelete.id);
      if (!ok) {
        throw new Error('Failed to delete thread');
      }
      toastStore.show('Thread deleted', { variant: 'success' });
      showThreadDeleteModal = false;
      threadToDelete = null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete thread';
      toastStore.show(errorMessage, { variant: 'error' });
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
  function handleProjectUpdated(): void {
    toastStore.show('Project updated successfully', { variant: 'success' });
  }

  // Tab configuration
  const tabs: ProjectTab[] = $derived([
    { id: 'threads', label: 'Threads', icon: 'pi-comments', badge: threadCount },
    { id: 'members', label: 'Members', icon: 'pi-users', badge: memberCount },
    { id: 'files', label: 'Files', icon: 'pi-folder' },
    { id: 'settings', label: 'Settings', icon: 'pi-cog' },
  ]);
</script>

{#if project}
  <div class="project-detail-view">
    <ProjectHeader {project} />

    <ProjectTabNavigation {tabs} activeTab={activeTab} onTabChange={setActiveTab} />

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
            on:threadRename={handleThreadRename}
            on:newThread={handleNewThread}
            on:threadDelete={handleThreadDelete}
            on:threadCountChanged={(e) => (threadCount = e.detail.count)}
            on:error={(e) => {
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
          <ProjectMembersTab />
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
          <ProjectSettingsTab />
        </div>
      {:else if activeTab === 'edit'}
        <div
          id="edit-panel"
          role="tabpanel"
          aria-labelledby="edit-tab"
          class="tab-panel"
        >
          {#if project && canEditProject}
            <ProjectFormPanel 
              mode="edit"
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

  <!-- Thread Rename Modal -->
  {#if showThreadRenameModal && threadToRename}
    <ThreadRenameModal
      threadId={threadToRename.id}
      currentTitle={threadToRename.title}
      on:confirm={handleThreadRenameConfirmed}
      on:cancel={() => {
        showThreadRenameModal = false;
        threadToRename = null;
      }}
    />
  {/if}

  <!-- Thread Delete Modal -->
  {#if showThreadDeleteModal && threadToDelete}
    <ThreadDeleteModal
      threadId={threadToDelete.id}
      threadTitle={threadToDelete.title}
      on:confirm={handleThreadDeleteConfirmed}
      on:cancel={() => {
        showThreadDeleteModal = false;
        threadToDelete = null;
      }}
    />
  {/if}
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
    max-width: 400px;
  }

</style>


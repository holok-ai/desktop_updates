<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { SidebarActivity } from '$lib/types/sidebar.type';
  import ThreadListItem from '../common/ThreadListItem.svelte';
  import ProjectSidebar from '../projects/ProjectSidebar.svelte';
  import { threadService } from '$lib/services/thread.service';
  import { threads } from '$lib/stores/thread.store';
  import { ROUTE } from '$lib/constants/route.constant';
  import { push, querystring, location } from 'svelte-spa-router';
  import type { Thread } from '../../../../src-electron/preload';
  import { storageService } from '$lib/services/storage.service';
  import ThreadRenameModal from '$lib/components/common/ThreadRenameModal.svelte';
  import MoveThreadModal from '$lib/components/modals/MoveThreadModal.svelte';
  import { requestNavigation } from '$lib/stores/navigation-guard.store';
  import { toastStore } from '$lib/services/toast.service';

  const { activity } = $props<{ activity: SidebarActivity | null }>();
  const dispatch = createEventDispatcher();

  // Resize state
  const MIN_WIDTH = 200;
  const MAX_WIDTH = 600;
  const DEFAULT_WIDTH = 280;

  let customWidth = $state(DEFAULT_WIDTH);
  let isResizing = $state(false);
  let startX = $state(0);
  let startWidth = $state(0);

  let isCollapsed = $state(true); // Start collapsed by default
  let selectedThreadId: string | null = $state(null);
  let showRenameModal = $state(false);
  let threadToRename: { id: string; title: string } | null = $state(null);
  let showCopyModal = $state(false);
  let threadToCopy: Thread | null = $state(null);

  let selectedProjectId: string | null = $state(null);
  let currentRoute = $state('');

  // Track current route
  $effect(() => {
    const unsub = location.subscribe((path: string) => {
      currentRoute = path;
    });
    return unsub;
  });

  // Determine activity type based on actual route AND querystring
  // If on /threads route with projectId param, show projects, not threads
  const isThreadActivity = $derived.by(() => {
    const params = new URLSearchParams($querystring ?? '');
    const hasProjectId = params.has('projectId');

    // If viewing a thread with projectId, it's a project thread, not a general thread
    if (currentRoute.startsWith(ROUTE.THREADS) && hasProjectId) {
      return false;
    }

    return currentRoute.startsWith(ROUTE.THREADS) ||
      (activity?.route === ROUTE.THREADS || activity?.id === 'threads');
  });

  const isProjectsActivity = $derived.by(() => {
    const params = new URLSearchParams($querystring ?? '');
    const hasProjectId = params.has('projectId');

    // If on /threads route with projectId, treat it as projects activity
    if (currentRoute.startsWith(ROUTE.THREADS) && hasProjectId) {
      return true;
    }

    return currentRoute.startsWith(ROUTE.PROJECTS) &&
      (activity?.route === ROUTE.PROJECTS || activity?.id === 'projects');
  });

  const activityTitle = $derived(activity?.label ?? 'Activity');

  onMount(async () => {
    // Restore custom width from storage
    customWidth = storageService.getActivityListWidth();
    // Always start collapsed on app launch (home page)
    isCollapsed = true;

    await getThreadItems();
  });

  // Auto-expand sidebar when navigating to Threads or Projects
  // Keep collapsed on home page and login page
  $effect(() => {
    if (currentRoute.startsWith(ROUTE.THREADS) || currentRoute.startsWith(ROUTE.PROJECTS)) {
      // Expand sidebar when user navigates to these routes
      isCollapsed = false;
    } else if (currentRoute === ROUTE.HOME || currentRoute === '/' || currentRoute === ROUTE.LOGIN) {
      // Keep collapsed on home page and login page
      isCollapsed = true;
    }
  });

  $effect(() => {
    const unsub = querystring.subscribe((qs: string | undefined) => {
      const params = new URLSearchParams(qs ?? '');

      // Handle thread selection
      const tid = params.get('threadId');
      if (tid) {
        selectedThreadId = tid;
        storageService.setLastThreadId(tid);
      } else {
        // Clear selection when no threadId in URL
        selectedThreadId = null;
      }

      // Handle project selection
      const pid = params.get('projectId');
      if (pid) {
        selectedProjectId = pid;
        storageService.setLastProjectId(pid);
      } else {
        // Clear selection when no projectId in URL
        selectedProjectId = null;
      }
    });
    return unsub;
  });

  let filteredThreads = $state<Thread[]>([]);

  $effect(() => {
    const isThreadsView = activity?.route === ROUTE.THREADS || activity?.id === 'threads';
    const isHomeView = activity?.route === ROUTE.HOME || activity?.id === 'home';

    // Filter threads based on current view.
    // Requirement: any thread with a projectId should NOT appear in the main Threads activity list.
    let visibleThreads = $threads;
    if (isThreadsView || isHomeView) {
      // Show only personal threads (no projectId).
      visibleThreads = $threads.filter((t) => !t.metadata?.projectId);
    }

    filteredThreads = visibleThreads;
  });

  function select(item: { id: string; label: string; route?: string }) {
    const proceed = () => {
      dispatch('select', item);
      selectedThreadId = item.id;
      storageService.setLastThreadId(item.id);
      if (!selectedProjectId) {
        storageService.removeLastProjectId();
      }

      const route = (item as SidebarActivity).route;

      switch (route) {
        case ROUTE.THREADS: {
          selectedThreadId = item.id;
          storageService.setLastThreadId(item.id);
          if (!selectedProjectId) {
            storageService.removeLastProjectId();
          }
          const params = new URLSearchParams();
          params.set('threadId', item.id);
          if (selectedProjectId) {
            params.set('projectId', selectedProjectId);
            storageService.setLastProjectId(selectedProjectId);
          }
          push(`${ROUTE.THREADS}?${params.toString()}`);
          break;
        }
        default:
          break;
      }
    };

    // If no unsaved changes, requestNavigation returns true and we proceed immediately
    if (requestNavigation(proceed)) {
      proceed();
    }
  }

  function toggleSidebar() {
    isCollapsed = !isCollapsed;
    storageService.setActivityListCollapsed(isCollapsed);
  }

  // Resize handlers
  function handleResizeStart(e: MouseEvent) {
    isResizing = true;
    startX = e.clientX;
    startWidth = customWidth;
    e.preventDefault();
  }

  function handleResizeMove(e: MouseEvent) {
    if (!isResizing) return;

    const delta = e.clientX - startX;
    const newWidth = startWidth + delta;

    // Clamp width between min and max
    customWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
  }

  function handleResizeEnd() {
    if (isResizing) {
      isResizing = false;
      // Save the custom width to storage
      storageService.setActivityListWidth(customWidth);
    }
  }

  // Add global mouse event listeners for resize
  $effect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  });

  async function getThreadItems() {
    try {
      // Load all threads (including project_only) - filtering happens in UI
      await threadService.getAll({ includeProjectOnly: true });
    } catch (error) {
      console.error('Failed to load threads:', error);
    }
  }

  /**
   * Handle rename thread action
   */
  function handleRenameStart(item: { id: string; label: string }) {
    threadToRename = { id: item.id, title: item.label };
    showRenameModal = true;
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
        showRenameModal = false;
        threadToRename = null;
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
   * Navigate to thread creation interface
   */
  function handleNewThread() {
    const proceed = () => {
      // Clear any selected thread and navigate to threads page (shows create form)
      selectedThreadId = null;
      storageService.removeLastThreadId();
      push(ROUTE.THREADS);
    };

    if (requestNavigation(proceed)) proceed();
  }
</script>

<aside
  class="activity-list-sidebar transition-all duration-300 {isCollapsed && 'collapsed'}"
  style="width: {isCollapsed ? 'var(--sidebar-secondary-collapsed, 48px)' : `${customWidth}px`};"
  aria-label="Activity list sidebar"
>
  <div class="{isCollapsed ? 'p-0' : 'p-4'} flex items-center justify-between gap-2">
    {#if !isCollapsed}
      <span class="activity-title">{activityTitle}</span>
    {/if}
    <button
      class="collapse-toggle-btn"
      onclick={toggleSidebar}
      aria-label="Collapse/Expand Activity List"
    >
      <i class={isCollapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'}></i>
    </button>
  </div>

  <!-- New Thread button - only visible for Threads activity when not collapsed -->
  {#if isThreadActivity && !isCollapsed}
    <div class="new-thread-container">
      <button class="new-thread-btn" onclick={handleNewThread} aria-label="Create new thread">
        <i class="pi pi-plus"></i>
        <span>New Thread ...</span>
      </button>
    </div>
  {/if}

  <div class="sidebar-scroll flex-1 overflow-y-auto">
    {#if isProjectsActivity}
      <!-- E3-S4: Use dedicated ProjectSidebar component for projects -->
      <ProjectSidebar collapsed={isCollapsed} />
    {:else}
      <ul class="list-items">
        {#if isThreadActivity}
          {#if filteredThreads.length === 0 && !isCollapsed}
            <div class="empty-state">
              <p>No threads available yet.</p>
            </div>
          {:else if !isCollapsed}
            {#each filteredThreads as thread (thread.id)}
              <ThreadListItem
                {thread}
                isSelected={selectedThreadId === thread.id}
                showActions={true}
                on:click={(e) => void select(e.detail)}
                on:rename={(e) => {
                  const item = e.detail as { id: string; label: string };
                  handleRenameStart(item);
                }}
                on:delete={async (e) => {
                  const item = e.detail as { id: string };
                  if (item?.id?.startsWith('temp_')) {
                    threads.deleteThread(item.id);
                    return;
                  }
                  try {
                    await threadService.softDelete(item.id);
                  } catch (err) {
                    console.error('Failed to delete thread', err);
                  }
                }}
                on:copyToPersonal={(e) => {
                  const { thread } = e.detail as { thread: Thread };
                  threadToCopy = thread;
                  showCopyModal = true;
                }}
                on:copyToProject={(e) => {
                  const { thread } = e.detail as { thread: Thread };
                  threadToCopy = thread;
                  showCopyModal = true;
                }}
              />
            {/each}
          {/if}
        {/if}
      </ul>
    {/if}
  </div>

  <!-- Resize handle -->
  {#if !isCollapsed}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="resize-handle {isResizing ? 'resizing' : ''}"
      onmousedown={handleResizeStart}
      role="separator"
      aria-label="Resize activity list"
      aria-orientation="vertical"
    ></div>
  {/if}
</aside>

<!-- Thread Rename Modal -->
{#if showRenameModal && threadToRename}
  <ThreadRenameModal
    threadId={threadToRename.id}
    currentTitle={threadToRename.title}
    on:confirm={handleThreadRenameConfirmed}
    on:cancel={() => {
      showRenameModal = false;
      threadToRename = null;
    }}
  />
{/if}

<!-- Move/Copy Thread Modal -->
{#if showCopyModal && threadToCopy}
  <MoveThreadModal
    bind:show={showCopyModal}
    bind:thread={threadToCopy}
    on:copied={async (e) => {
      const { threadId, projectId, destinationName } = e.detail as {
        threadId: string;
        projectId: string | null;
        destinationName: string;
      };
      showCopyModal = false;
      threadToCopy = null;
      
      // Refresh thread list
      await getThreadItems();
      
      // Navigate to the new thread
      const params = new URLSearchParams();
      params.set('threadId', threadId);
      if (projectId) {
        params.set('projectId', projectId);
      }
      push(`${ROUTE.THREADS}?${params.toString()}`);
      
      toastStore.success(`Thread copied to ${destinationName}`);
    }}
  />
{/if}

<style>
  .activity-list-sidebar {
    box-shadow: var(--sidebar-secondary-box-shadow);
    background: var(--surface-sidebar-secondary);
    color: var(--text-primary);
    border-right: 1px solid var(--border-sidebar);
    transition: width 0.3s ease;
    height: 100vh;
    display: flex;
    flex-direction: column;
    position: relative;
    --sidebar-item-text-color: #0a1624;
    --sidebar-item-icon-color: #0a1624;
    --sidebar-item-active-bg: rgba(10, 22, 36, 0.08);
    --sidebar-item-active-text-color: #0a1624;
    --sidebar-item-menu-text-color: #0a1624;
    --sidebar-item-menu-background: #fff;
    --sidebar-accordion-title-color: #0a1624;
    --thread-list-title-color: #0a1624;
    --thread-list-meta-color: rgba(10, 22, 36, 0.7);
    --thread-list-hover-bg: rgba(10, 22, 36, 0.08);
    --thread-list-action-color: #0a1624;
    --thread-list-action-hover-bg: rgba(10, 22, 36, 0.12);
  }

  /* New Thread button styles */
  .new-thread-container {
    padding: 0 1rem 0.75rem 1rem;
  }

  .new-thread-btn {
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

  .new-thread-btn:hover {
    background-color: var(--thread-list-hover-bg);
  }

  .new-thread-btn:focus {
    outline: none;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 35%, transparent);
  }

  .collapse-toggle-btn {
    background: transparent;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    padding: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    border-radius: 0.375rem;
  }

  .collapse-toggle-btn:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  :global(html.dark) .collapse-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .collapse-toggle-btn:focus {
    outline: none;
    background: rgba(0, 0, 0, 0.08);
  }

  :global(html.dark) .collapse-toggle-btn:focus {
    background: rgba(255, 255, 255, 0.15);
  }

  .collapse-toggle-btn i {
    font-size: 1.25rem;
  }

  .resize-handle {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
    background: transparent;
    transition: background-color 0.2s ease;
    z-index: 10;
  }

  .resize-handle:hover,
  .resize-handle.resizing {
    background: rgba(59, 130, 246, 0.3);
  }

  :global(html.dark) .resize-handle:hover,
  :global(html.dark) .resize-handle.resizing {
    background: rgba(59, 130, 246, 0.5);
  }

  .resize-handle::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 2px;
    height: 40px;
    background: var(--border-sidebar);
    border-radius: 1px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .resize-handle:hover::after,
  .resize-handle.resizing::after {
    opacity: 0.5;
  }
  .activity-title {
    flex: 1;
    font-weight: 600;
    font-size: 16px;
    display: flex;
    align-items: center;
    gap: var(--inline-spacing);
  }
  .activity-list-sidebar.collapsed .activity-title,
  .activity-list-sidebar.collapsed span {
    display: none;
  }

  .list-items {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    padding: var(--content-padding) 0;
    margin: 0;
    gap: var(--inline-spacing);
    transition:
      padding 0.2s,
      gap 0.2s;
  }

  .activity-list-sidebar.collapsed {
    padding: 6px;
    padding-top: 1rem;
  }

  .activity-list-sidebar.collapsed .list-items {
    align-items: center;
    justify-content: flex-start;
    padding-top: var(--inline-spacing);
  }
  .sidebar-scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0; /* important for flex scroll containers */
    will-change: transform; /* prevents visual flicker during collapse */
    scrollbar-color: color-mix(in srgb, var(--surface-0) 70%, transparent) transparent;
  }

  .sidebar-scroll::-webkit-scrollbar {
    width: 6px;
  }

  .sidebar-scroll::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--surface-0) 25%, transparent);
    border-radius: 3px;
  }

  .empty-state {
    text-align: center;
    padding: 1.5rem;
    color: rgba(10, 22, 36, 0.6);
  }
  :global(html.dark) .activity-list-sidebar,
  :global(:root.dark) .activity-list-sidebar {
    --sidebar-item-text-color: #fff;
    --sidebar-item-icon-color: #fff;
    --sidebar-item-active-bg: rgba(255, 255, 255, 0.12);
    --sidebar-item-active-text-color: #fff;
    --sidebar-item-menu-text-color: #fff;
    --sidebar-item-menu-background: var(--surface-main);
    --sidebar-accordion-title-color: #fff;
    --thread-list-title-color: #fff;
    --thread-list-meta-color: rgba(255, 255, 255, 0.7);
    --thread-list-hover-bg: rgba(255, 255, 255, 0.08);
    --thread-list-action-color: #fff;
    --thread-list-action-hover-bg: rgba(255, 255, 255, 0.12);
  }

  :global(html.dark) .activity-list-sidebar .empty-state,
  :global(:root.dark) .activity-list-sidebar .empty-state {
    color: rgba(255, 255, 255, 0.7);
  }
</style>

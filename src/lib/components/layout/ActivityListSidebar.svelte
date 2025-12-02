<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { SidebarActivity } from '$lib/types/sidebar.type';
  import ThreadListItem from '../common/ThreadListItem.svelte';
  import ProjectListItem from '../common/ProjectListItem.svelte';
  import { threadService } from '$lib/services/thread.service';
  import { threads } from '$lib/stores/thread.store';
  import { ROUTE } from '$lib/constants/route.constant';
  import { push, querystring } from 'svelte-spa-router';
  import { projects } from '$lib/stores/project.store';
  import type { Thread } from '../../../../src-electron/preload';
  import type { Project } from '$lib/types/project.type';
  import { storageService } from '$lib/services/storage.service';
  import BaseModal from '$lib/components/modals/BaseModal.svelte';
  import { requestNavigation } from '$lib/stores/navigation-guard.store';

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

  let isCollapsed = $state(false);
  let selectedThreadId: string | null = $state(null);
  let renamingThreadId: string | null = $state(null);
  let renamingThreadTitle: string = $state('');
  let showRenameModal = $state(false);
  let renameError = $state('');

  let selectedProjectId: string | null = $state(null);

  const isThreadActivity = $derived(
    activity?.route === ROUTE.THREADS || activity?.id === 'threads',
  );
  const isProjectsActivity = $derived(
    activity?.route === ROUTE.PROJECTS || activity?.id === 'projects',
  );

  const activityTitle = $derived(activity?.label ?? 'Activity');

  onMount(async () => {
    // Restore custom width and collapsed state from storage
    customWidth = storageService.getActivityListWidth();
    isCollapsed = storageService.getActivityListCollapsed();

    await getThreadItems();
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
  const hasListItems = $derived(
    isThreadActivity
      ? filteredThreads.length > 0
      : isProjectsActivity
        ? $projects.length > 0
        : false,
  );

  let lastActivityId: string | null = $state(null);
  let lastHasItemsState: boolean | null = $state(null);

  $effect(() => {
    const isThreadsView = activity?.route === ROUTE.THREADS || activity?.id === 'threads';
    const isHomeView = activity?.route === ROUTE.HOME || activity?.id === 'home';

    // Filter threads based on current view and privacy mode (no project filtering)
    let visibleThreads = $threads;
    if (isThreadsView || isHomeView) {
      // When viewing general threads or home, show threads from default mode projects + threads without projects
      // Exclude threads from project_only projects
      visibleThreads = $threads.filter((t) => {
        const projectId = t.metadata?.projectId as string | undefined;
        if (!projectId) return true; // Include threads not in any project

        const project = $projects.find((p) => p.id === projectId);
        // If project not found, include it (might not be loaded yet or might be deleted)
        // If project found, only include if it's NOT project_only mode
        return !project || project.privacyMode !== 'project_only';
      });
    }

    filteredThreads = visibleThreads;
  });

  $effect(() => {
    const currentActivityId = activity?.id ?? null;
    if (currentActivityId !== lastActivityId || lastHasItemsState !== hasListItems) {
      isCollapsed = !hasListItems;
      lastActivityId = currentActivityId;
      lastHasItemsState = hasListItems;
    }
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

  function selectProject(project: Project) {
    const proceed = () => {
      selectedProjectId = project.id;
      storageService.setLastProjectId(project.id);
      dispatch('select', {
        id: project.id,
        label: project.title,
        route: ROUTE.PROJECTS,
      });
      push(`${ROUTE.PROJECTS}?projectId=${encodeURIComponent(project.id)}`);
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
    renamingThreadId = item.id;
    renamingThreadTitle = item.label;
    renameError = '';
    showRenameModal = true;
  }

  /**
   * Save renamed thread title
   */
  async function handleRenameSave() {
    if (!renamingThreadId) return;

    renameError = '';

    try {
      const result = await (window.electronAPI.thread as any).renameThread(
        renamingThreadId,
        renamingThreadTitle,
      );

      if (result.success) {
        // Thread store will be updated via thread:updated event listener
        renamingThreadId = null;
        renamingThreadTitle = '';
        showRenameModal = false;
      } else {
        // Map error codes to user-friendly messages
        const errorMessages: Record<string, string> = {
          TITLE_EMPTY: 'Title cannot be empty',
          TITLE_TOO_SHORT: 'Title is too short',
          TITLE_TOO_LONG: 'Title cannot exceed 200 characters',
          TITLE_DUPLICATE: 'A thread with this title already exists',
          TITLE_INVALID_CHARACTERS: 'Title contains invalid characters',
        };
        renameError = errorMessages[result.code || ''] || result.error || 'Failed to rename thread';
        console.error('Failed to rename thread:', result.error);
      }
    } catch (error) {
      renameError = error instanceof Error ? error.message : 'Failed to rename thread';
      console.error('Error renaming thread:', error);
    }
  }

  /**
   * Cancel rename operation
   */
  function handleRenameCancel() {
    renamingThreadId = null;
    renamingThreadTitle = '';
    renameError = '';
    showRenameModal = false;
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
  <div class="sidebar-scroll flex-1 overflow-y-auto">
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
            />
          {/each}
        {/if}
      {:else if isProjectsActivity}
        {#if $projects.length === 0 && !isCollapsed}
          <div class="empty-state">
            <p>No projects available yet.</p>
          </div>
        {:else if !isCollapsed}
          {#each $projects as project (project.id)}
            <ProjectListItem
              {project}
              isSelected={selectedProjectId === project.id}
              on:click={(e) => {
                const item = e.detail as { id: string; label: string; route?: string };
                const foundProject = $projects.find((p) => p.id === item.id);
                if (foundProject) {
                  selectProject(foundProject);
                }
              }}
            />
          {/each}
        {/if}
      {/if}
    </ul>
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

<!-- Rename thread modal dialog -->
<BaseModal
  bind:show={showRenameModal}
  title="Rename Thread"
  error={renameError}
  submitLabel="Save"
  cancelLabel="Cancel"
  submitDisabled={!renamingThreadTitle.trim() || renamingThreadTitle.length > 200}
  oncancel={handleRenameCancel}
  onsubmit={handleRenameSave}
>
  {#snippet content()}
    <div class="form-group">
      <label for="rename-title">Title</label>
      <input
        id="rename-title"
        type="text"
        bind:value={renamingThreadTitle}
        placeholder="Enter thread title"
        maxlength="200"
        aria-label="Thread title input"
        data-testid="title-input"
      />
      <div
        class="char-counter"
        class:warning={renamingThreadTitle.length > 180}
        data-testid="char-counter"
      >
        {200 - renamingThreadTitle.length} characters remaining
      </div>
    </div>
  {/snippet}
</BaseModal>

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

  /* Modal-specific form styles */
  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .form-group input {
    width: 100%;
    padding: 0.75rem;
    background: var(--input-background);
    border: 1px solid var(--input-border);
    border-radius: 0.5rem;
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-group input::placeholder {
    color: var(--text-secondary);
  }

  .char-counter {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .char-counter.warning {
    color: var(--error-color);
  }
</style>

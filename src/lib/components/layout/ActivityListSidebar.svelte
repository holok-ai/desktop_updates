<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { SidebarActivity } from '$lib/types/sidebar.type';
  import SidebarItem from '../common/SidebarItem.svelte';
  import AccordionSection from '../common/AccordionSection.svelte';
  import ThreadListItem from '../common/ThreadListItem.svelte';
  import { threadService } from '$lib/services/thread.service';
  import { threads } from '$lib/stores/thread.store';
  import { ROUTE } from '$lib/constants/route.constant';
  import { push, querystring } from 'svelte-spa-router';
  import { projects } from '$lib/stores/project.store';
  import type { Thread } from '../../../../src-electron/preload';
  import { storageService } from '$lib/services/storage.service';

  const { activity } = $props<{ activity: SidebarActivity | null }>();
  const dispatch = createEventDispatcher();

  let isCollapsed = $state(false);
  let agentItems = $state<SidebarActivity[]>([]);
  let lastActivityId: string | null = null;

  let threadItems = $state<SidebarActivity[]>([]);
  let selectedThreadId: string | null = $state(null);
  let renamingThreadId: string | null = $state(null);
  let renamingThreadTitle: string = $state('');

  let selectedProjectId: string | null = $state(null);
  let openMenuId: string | null = $state(null); // Track which item's menu is open globally

  function handleMenuToggle(item: { id: string } | null) {
    if (!item) {
      // Close any open menu
      openMenuId = null;
      return;
    }
    // If clicking the same menu, close it; otherwise open the new one
    openMenuId = openMenuId === item.id ? null : item.id;
  }

  const navigationOptions: SidebarActivity[] = [
    {
      id: 'new-thread',
      label: 'New Thread',
      shortLabel: 'New',
      icon: 'pi pi-pen-to-square',
      onClick: () => push(`${ROUTE.THREADS}?createThread`),
    },
    {
      id: 'new-project',
      label: 'New Project',
      shortLabel: 'New',
      icon: 'pi pi-folder-plus',
      onClick: () => push(`${ROUTE.PROJECTS}?createProject`),
    },
    {
      id: 'search-thread',
      label: 'Search Thread',
      shortLabel: 'Search',
      icon: 'pi pi-search',
      onClick: () => push(`${ROUTE.THREADS}?search`),
    },
  ];

  onMount(async () => {
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
        // Fallback to last selected from localStorage
        selectedThreadId = storageService.getLastThreadId();
      }

      // Handle project selection
      const pid = params.get('projectId');
      if (pid) {
        selectedProjectId = pid;
        storageService.setLastProjectId(pid);
      } else {
        // Fallback to last selected from localStorage
        selectedProjectId = storageService.getLastProjectId();
      }
    });
    return unsub;
  });

  $effect(() => {
    if (lastActivityId === activity?.id) return;

    agentItems = getAgentItems();

    lastActivityId = activity?.id ?? null;
  });

  let filteredThreads = $state<Thread[]>([]);

  let lastSelectedProjectId: string | null = $state(null);
  $effect(() => {
    // Reload threads when project selection changes to ensure we have the latest data
    if (selectedProjectId !== lastSelectedProjectId && selectedProjectId !== null) {
      lastSelectedProjectId = selectedProjectId;
      void getThreadItems();
    } else if (selectedProjectId === null) {
      lastSelectedProjectId = null;
    }
  });

  $effect(() => {
    const isThreadsView = activity?.route === ROUTE.THREADS || activity?.id === 'threads';
    const isHomeView = activity?.route === ROUTE.HOME || activity?.id === 'home';

    // Filter threads based on current view and privacy mode
    let visibleThreads = $threads;
    if (selectedProjectId) {
      // Whenever a project is selected, show only its threads (for both home + projects view)
      visibleThreads = $threads.filter(
        (t) => (t.metadata?.projectId as string | undefined) === selectedProjectId,
      );
    } else if (isThreadsView || isHomeView) {
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
    threadItems = visibleThreads.map((t) => ({ id: t.id, label: t.title, route: ROUTE.THREADS }));
  });

  function select(item: { id: string; label: string }) {
    openMenuId = null; // Close any open menu when selecting an item
    dispatch('select', item);
    selectedThreadId = item.id;
    storageService.setLastThreadId(item.id);

    const route = (item as SidebarActivity).route;

    switch (route) {
      case ROUTE.THREADS:
        selectedThreadId = item.id;
        storageService.setLastThreadId(item.id);
        push(`${ROUTE.THREADS}?threadId=${encodeURIComponent(item.id)}`);
        break;
      case ROUTE.PROJECTS:
        selectedProjectId = item.id;
        storageService.setLastProjectId(item.id);
        push(`${ROUTE.PROJECTS}?projectId=${encodeURIComponent(item.id)}`);
        break;
      default:
        break;
    }
  }

  function toggleSidebar() {
    isCollapsed = !isCollapsed;
  }

  function getAgentItems() {
    return [
      { id: 'agent-1', label: 'Assistant Bot' },
      { id: 'agent-2', label: 'Marketing Bot' },
    ];
  }

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
    openMenuId = null; // Close any open menu
    renamingThreadId = item.id;
    renamingThreadTitle = item.label;
  }

  /**
   * Save renamed thread title
   */
  async function handleRenameSave(newTitle: string) {
    if (!renamingThreadId) return;

    try {
      const result = await (window.electronAPI.thread as any).renameThread(
        renamingThreadId,
        newTitle,
      );

      if (result.success) {
        // Thread store will be updated via thread:updated event listener
        renamingThreadId = null;
        renamingThreadTitle = '';
      } else {
        // Show error to user
        console.error('Failed to rename thread:', result.error);
        throw new Error(result.error || 'Failed to rename thread');
      }
    } catch (error) {
      console.error('Error renaming thread:', error);
      throw error;
    }
  }

  /**
   * Cancel rename operation
   */
  function handleRenameCancel() {
    renamingThreadId = null;
    renamingThreadTitle = '';
  }
</script>

<aside
  class="activity-list-sidebar transition-all duration-300 {isCollapsed && 'collapsed'}"
  aria-label="Activity list sidebar"
>
  <div class="{isCollapsed ? 'p-0' : 'p-4'} flex items-center justify-between gap-2">
    {#if !isCollapsed}
      <span class="activity-title text-white">{'Organization Name'}</span>
    {/if}
    <button
      class="{!isCollapsed &&
        'p-0'} bg-transparent text-black dark:text-white border-none cursor-pointer text-secondary font-size-1-4 text-center mt-2 focus:outline-none"
      onclick={toggleSidebar}
      aria-label="Collapse/Expand Activity List"
    >
      <i class={isCollapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'}></i>
    </button>
  </div>
  <div class="sidebar-scroll flex-1 overflow-y-auto">
    <ul class="list-items">
      {#if activity?.route === ROUTE.HOME || activity?.id === 'home'}
        {#each navigationOptions as item}
          <SidebarItem isSelected={false} {item} {isCollapsed} on:click={() => item.onClick?.()} />
        {/each}
        {#if !isCollapsed}
          <AccordionSection
            title="Agents"
            isSubsection={true}
            isSidebarCollapsed={isCollapsed}
            items={agentItems}
            selectedId={null}
            {openMenuId}
            on:toggleMenu={(e) => handleMenuToggle(e.detail)}
          />
          <AccordionSection
            title="Threads"
            isSidebarCollapsed={isCollapsed}
            items={threadItems}
            isSubsection={true}
            showActions={true}
            selectedId={activity?.id === 'threads' ? selectedThreadId : null}
            {openMenuId}
            on:click={(e) => select(e.detail)}
            on:toggleMenu={(e) => handleMenuToggle(e.detail)}
            on:rename={(e) => {
              const item = e.detail as { id: string; label: string };
              handleRenameStart(item);
            }}
            on:delete={async (e) => {
              const item = e.detail as { id: string };
              if (item?.id?.startsWith('temp_')) {
                // Remove ephemeral thread locally
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
        {/if}
      {/if}
      {#if activity?.route === ROUTE.THREADS || activity?.id === 'threads'}
        {#if !isCollapsed}
          {#each filteredThreads as thread (thread.id)}
            <ThreadListItem
              {thread}
              isSelected={selectedThreadId === thread.id}
              showActions={true}
              on:click={(e) => select(e.detail)}
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
      {/if}
      {#if (activity?.route === ROUTE.PROJECTS || activity?.id === 'projects') && selectedProjectId}
        {#if filteredThreads.length === 0}
          <div class="empty-state">
            <p>No threads in this project yet.</p>
          </div>
        {:else if !isCollapsed}
          {#each filteredThreads as thread (thread.id)}
            <ThreadListItem
              {thread}
              isSelected={selectedThreadId === thread.id}
              showActions={true}
              on:rename={(e) => {
                const item = e.detail as { id: string; label: string };
                handleRenameStart(item);
              }}
              on:click={(e: { detail: { id: string; label: string } }) => select(e.detail)}
              on:toggleMenu={(e) => handleMenuToggle(e.detail)}
              on:delete={async (e: CustomEvent<{ id: string }>) => {
                const item = e.detail;
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
      {/if}
    </ul>
  </div>
</aside>

<!-- Rename thread modal dialog -->
{#if renamingThreadId}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="dialog-overlay"
    onclick={handleRenameCancel}
    tabindex="0"
    role="dialog"
    aria-label="Rename thread dialog"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="dialog"
      onclick={(e) => e.stopPropagation()}
      tabindex="0"
      role="button"
      data-testid="thread-title-editor"
    >
      <h2 class="mb-6">Rename Thread</h2>

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

      <div class="dialog-actions">
        <button
          class="text-white"
          onclick={handleRenameCancel}
          aria-label="Cancel rename"
          data-testid="cancel-button">Cancel</button
        >
        <button
          class="primary"
          onclick={() => handleRenameSave(renamingThreadTitle)}
          disabled={!renamingThreadTitle.trim() || renamingThreadTitle.length > 200}
          aria-label="Save new thread title"
          data-testid="save-button"
        >
          Save
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .activity-list-sidebar {
    box-shadow: var(--sidebar-secondary-box-shadow);
    width: var(--sidebar-secondary-width);
    background: var(--surface-sidebar-secondary);
    color: var(--text-primary);
    border-right: 1px solid var(--border-sidebar);
    transition: all 0.3s ease;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .activity-list-sidebar.collapsed {
    width: var(--sidebar-secondary-collapsed, 48px);
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
    color: rgba(255, 255, 255, 0.7);
  }
  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--modal-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .dialog {
    background: var(--surface-main);
    padding: 2rem;
    border-radius: 12px;
    min-width: 500px;
    max-width: 90%;
    border: 1px solid var(--border-sidebar);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  }

  .dialog h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1.5rem 0;
  }

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

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 2rem;
  }

  .dialog-actions button {
    padding: 0.625rem 1.25rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
  }

  .dialog-actions button.text-white {
    background: var(--surface-card);
    color: var(--text-primary);
  }

  .dialog-actions button.text-white:hover {
    background: var(--surface-overlay);
  }

  .dialog-actions button.primary {
    background: var(--primary-color);
    color: white;
  }

  .dialog-actions button.primary:hover:not(:disabled) {
    background: #2563eb;
  }

  .dialog-actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .mb-6 {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    color: var(--text-primary);
  }
</style>

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { Thread } from '../../../../src-electron/preload';
  import { ROUTE } from '$lib/constants/route.constant';
  import { projects } from '$lib/stores/project.store';

  const dispatch = createEventDispatcher();

  const { 
    thread, 
    isSelected, 
    showActions
  } = $props<{
    thread: Thread;
    isSelected: boolean;
    showActions?: boolean;
  }>();

  // Context menu state
  let showContextMenu = $state(false);
  let contextMenuX = $state(0);
  let contextMenuY = $state(0);
  let contextMenuRef = $state<HTMLDivElement | null>(null);

  // Event listener references for proper cleanup
  let closeMenuListener: ((e: MouseEvent) => void) | null = null;
  let handleEscapeListener: ((e: KeyboardEvent) => void) | null = null;
  let handleCloseAllListener: (() => void) | null = null;

  // Determine if thread is in a project or personal space
  const isProjectThread = $derived(!!thread.metadata?.projectId);

  // Check if user has write permissions to any projects
  const hasWritePermissions = $derived(
    Array.isArray($projects) && $projects.some((p) => p.userRole === 'owner' || p.userRole === 'editor')
  );

  function handleClick() {
    dispatch('click', { id: thread.id, label: thread.title, route: ROUTE.THREADS });
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    closeContextMenu();
    dispatch('delete', { id: thread.id });
  }

  function handleCopyToPersonal(e: MouseEvent) {
    e.stopPropagation();
    closeContextMenu();
    dispatch('copyToPersonal', { thread });
  }

  function handleCopyToProject(e: MouseEvent) {
    e.stopPropagation();
    closeContextMenu();
    dispatch('copyToProject', { thread });
  }

  function handleRename(e: MouseEvent) {
    e.stopPropagation();
    closeContextMenu();
    dispatch('rename', { id: thread.id, label: thread.title });
  }

  // Positioning constants
  const SIDEBAR_MENU_OFFSET_X = 24;
  const SIDEBAR_MENU_OFFSET_Y = -80;
  const CONTEXT_MENU_WIDTH = 200;
  const CONTEXT_MENU_HEIGHT = 60;
  const VIEWPORT_PADDING = 8;
  const SIDEBAR_LAYOUT_THRESHOLD = 400; // px width to detect sidebar vs main content

  function calculateContextMenuPosition(
    e: MouseEvent,
    rect: DOMRect
  ): { x: number; y: number } {
    const isSidebarLayout = rect.width < SIDEBAR_LAYOUT_THRESHOLD;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x: number;
    let y: number;

    if (isSidebarLayout) {
      // Sidebar layout: position on left side with fixed offset
      x = SIDEBAR_MENU_OFFSET_X;
      y = rect.top + SIDEBAR_MENU_OFFSET_Y;
    } else {
      // Main content layout: position near cursor with smart fallbacks
      x = e.clientX + 4;
      y = e.clientY + 4;

      // Adjust horizontal if menu would go off right edge
      if (x + CONTEXT_MENU_WIDTH > viewportWidth - VIEWPORT_PADDING) {
        x = e.clientX - CONTEXT_MENU_WIDTH - 4;
      }

      // Adjust vertical if menu would go off bottom edge
      if (y + CONTEXT_MENU_HEIGHT > viewportHeight - VIEWPORT_PADDING) {
        y = e.clientY - CONTEXT_MENU_HEIGHT - 4;
      }
    }

    // Final boundary checks for both layouts
    // Ensure menu doesn't go off the bottom
    if (y + CONTEXT_MENU_HEIGHT > viewportHeight - VIEWPORT_PADDING) {
      y = viewportHeight - CONTEXT_MENU_HEIGHT - VIEWPORT_PADDING;
    }

    // Ensure menu doesn't go off the top
    if (y < VIEWPORT_PADDING) {
      y = VIEWPORT_PADDING;
    }

    // Ensure menu doesn't go off the left
    if (x < VIEWPORT_PADDING) {
      x = VIEWPORT_PADDING;
    }

    return { x, y };
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Close any existing context menu first (from other thread items)
    closeAllContextMenus();

    // Get the thread item element to position menu relative to it
    const threadItem = e.currentTarget as HTMLElement;
    const rect = threadItem.getBoundingClientRect();

    // Calculate menu position
    const { x, y } = calculateContextMenuPosition(e, rect);

    showContextMenu = true;
    contextMenuX = x;
    contextMenuY = y;

    setupContextMenuClose();
  }

  // Close all context menus (dispatch custom event to close menus in other components)
  function closeAllContextMenus() {
    document.dispatchEvent(new CustomEvent('closeAllContextMenus'));
  }

  function setupContextMenuClose() {
    // Create event listener functions
    closeMenuListener = (e: MouseEvent) => {
      if (contextMenuRef && !contextMenuRef.contains(e.target as Node)) {
        closeContextMenu();
      }
    };

    handleEscapeListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeContextMenu();
      }
    };

    handleCloseAllListener = () => {
      closeContextMenu();
    };

    // Use requestAnimationFrame for better timing and check if menu is still open
    requestAnimationFrame(() => {
      if (showContextMenu && closeMenuListener && handleEscapeListener && handleCloseAllListener) {
        document.addEventListener('click', closeMenuListener);
        document.addEventListener('keydown', handleEscapeListener);
        document.addEventListener('closeAllContextMenus', handleCloseAllListener);
      }
    });
  }

  function closeContextMenu() {
    showContextMenu = false;
    
    // Clean up event listeners with proper references
    if (closeMenuListener) {
      document.removeEventListener('click', closeMenuListener);
      closeMenuListener = null;
    }
    if (handleEscapeListener) {
      document.removeEventListener('keydown', handleEscapeListener);
      handleEscapeListener = null;
    }
    if (handleCloseAllListener) {
      document.removeEventListener('closeAllContextMenus', handleCloseAllListener);
      handleCloseAllListener = null;
    }
  }

  function formatDate(date: Date | number): string {
    const d = typeof date === 'number' ? new Date(date) : date;

    // Automatically uses the user's browser locale
    return new Intl.DateTimeFormat(undefined, {
      month: 'numeric',
      day: 'numeric',
    }).format(d);
  }

  function getModelName(thread: Thread): string {
    const modelTitle = thread.metadata?.modelTitle;
    if (typeof modelTitle === 'string') {
      return modelTitle;
    }
    return 'unknown';
  }

  // Cleanup on unmount
  onMount(() => {
    return () => {
      closeContextMenu();
    };
  });
</script>

<div
  class="thread-item"
  class:selected={isSelected}
  onclick={handleClick}
  oncontextmenu={onContextMenu}
  role="menuitem"
  tabindex="0"
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  <div class="thread-content">
    <div class="thread-title-container">
      <div class="thread-title">{thread.title}</div>
      {#if showActions}
        <div class="thread-actions">
          <button
            class="action-button edit"
            title="Edit"
            onclick={handleRename}
          >
            <i class="pi pi-pencil"></i>
          </button>
          <button class="action-button delete" title="Delete" onclick={handleDelete}>
            <i class="pi pi-trash"></i>
          </button>
        </div>
      {/if}
    </div>
    <div class="thread-meta">
      <span>{formatDate(thread.createdAt)}</span>
      <span>{getModelName(thread)}</span>
    </div>
  </div>
</div>

{#if showContextMenu}
  <div
    bind:this={contextMenuRef}
    class="context-menu"
    style="left: {contextMenuX}px; top: {contextMenuY}px;"
    role="menu"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => {
      if (e.key === 'Escape') {
        closeContextMenu();
      }
    }}
  >
    {#if isProjectThread}
      <button 
        class="context-menu-item" 
        onclick={handleCopyToPersonal}
        aria-label="Copy thread to personal workspace"
      >
        <i class="pi pi-copy"></i>
        <span>Copy to Personal</span>
      </button>
    {:else}
      <button
        class="context-menu-item"
        onclick={handleCopyToProject}
        disabled={!hasWritePermissions}
        title={!hasWritePermissions ? 'No write permissions to any projects' : ''}
        aria-label={!hasWritePermissions ? 'Copy to project (no permissions)' : 'Copy thread to project'}
      >
        <i class="pi pi-copy"></i>
        <span>Copy to Project...</span>
      </button>
    {/if}
  </div>
{/if}

<style>
  .thread-title-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .thread-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
    border-radius: 0.375rem;
    margin: 0.125rem 0.5rem;
    position: relative;
  }

  .thread-item:hover {
    background-color: var(--surface-hover);
  }

  .thread-item.selected {
    border-color: var(--primary-color);
    background-color: transparent;
  }

  .thread-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .thread-title {
    font-size: 11pt;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .thread-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 9pt;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .thread-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    opacity: 0.7;
    flex-shrink: 0;
  }

  .thread-item:hover .thread-actions,
  .thread-actions:hover {
    opacity: 1;
  }

  .action-button {
    background: transparent;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    transition: background-color 0.15s ease;
    flex-shrink: 0;
  }

  .action-button:hover:not(:disabled) {
    background-color: var(--surface-hover);
  }

  .action-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .action-button.edit {
    color: var(--action-edit-color);
  }

  .action-button.delete {
    color: var(--action-delete-color);
  }

  .action-button i {
    font-size: 0.875rem;
  }

  /* Context Menu Styles */
  .context-menu {
    position: fixed;
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 4px;
    min-width: 200px;
    max-width: 250px;
    z-index: 9999;
    animation: contextMenuFadeIn 0.15s ease-out;
  }

  @keyframes contextMenuFadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .context-menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.15s ease;
    text-align: left;
  }

  .context-menu-item:hover:not(:disabled) {
    background: var(--surface-hover);
  }

  .context-menu-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .context-menu-item:disabled:hover {
    background: transparent;
  }

  .context-menu-item i {
    font-size: 14px;
    width: 16px;
    text-align: center;
    flex-shrink: 0;
  }
</style>

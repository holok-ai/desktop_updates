<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Thread } from '../../../../src-electron/preload';
  import { ROUTE } from '$lib/constants/route.constant';
  import { projects } from '$lib/stores/project.store';
  import { favorites } from '$lib/stores/favorite.store';

  const dispatch = createEventDispatcher();

  const { thread, isSelected, showActions } = $props<{
    thread: Thread;
    isSelected: boolean;
    showActions?: boolean;
  }>();

  // Determine if thread is in a project or personal space
  const isProjectThread = $derived(!!thread.metadata?.projectId);

  // Check if user has write permissions to any projects
  const hasWritePermissions = $derived(
    Array.isArray($projects) &&
      $projects.some((p) => p.userRole === 'owner' || p.userRole === 'editor'),
  );

  // Check if this thread is a favorite
  const isFav = $derived($favorites.some((e) => e.id === thread.id));

  let showMenu = $state(false);
  let menuElement = $state<HTMLDivElement | null>(null);
  let openUpward = $state(false);

  function handleClick() {
    dispatch('click', { id: thread.id, label: thread.title, route: ROUTE.THREADS });
  }

  function toggleMenu(e: MouseEvent) {
    e.stopPropagation();
    showMenu = !showMenu;

    if (!showMenu) {
      // Check if menu would overflow at bottom
      const button = e.currentTarget as HTMLElement;
      const rect = button.getBoundingClientRect();
      const menuHeight = 120; // Approximate height of 3 menu items
      const spaceBelow = window.innerHeight - rect.bottom;
      openUpward = spaceBelow < menuHeight;
    }
  }

  function handleClickOutside(e: MouseEvent) {
    if (menuElement && !menuElement.contains(e.target as Node)) {
      showMenu = false;
    }
  }

  $effect(() => {
    if (showMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  });

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    dispatch('delete', { id: thread.id });
  }

  function handleRename(e: MouseEvent) {
    e.stopPropagation();
    dispatch('rename', { id: thread.id, label: thread.title });
  }

  function handleCopy(e: MouseEvent) {
    e.stopPropagation();
    // If thread is in a project, copy to personal; otherwise copy to project
    if (isProjectThread) {
      dispatch('copyToPersonal', { thread });
    } else {
      dispatch('copyToProject', { thread });
    }
  }

  function handleToggleFavorite(e: MouseEvent) {
    e.stopPropagation();
    favorites.toggleFavorite(thread.id, 'thread');
    showMenu = false;
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
</script>

<div
  class="thread-item"
  class:selected={isSelected}
  onclick={handleClick}
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
          <button class="action-button menu-trigger" title="More actions" onclick={toggleMenu}>
            ⋯
          </button>
          {#if showMenu}
            <div class="context-menu" class:upward={openUpward} role="menu" bind:this={menuElement}>
              <button class="menu-item" role="menuitem" onclick={handleToggleFavorite}>
                <i
                  class="pi {isFav ? 'pi-star-fill' : 'pi-star'}"
                  style="margin-right: 6px; font-size: 12px;"
                ></i>
                {isFav ? 'Remove favorite' : 'Make favorite'}
              </button>
              <button class="menu-item" role="menuitem" onclick={handleRename}> Rename </button>
              <button
                class="menu-item"
                role="menuitem"
                onclick={handleCopy}
                disabled={!isProjectThread && !hasWritePermissions}
              >
                Change project
              </button>
              <hr class="menu-divider" />
              <button class="menu-item delete" role="menuitem" onclick={handleDelete}>
                Delete
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
    <div class="thread-meta">
      <span>{formatDate(thread.createdAt)}</span>
      <span>{getModelName(thread)}</span>
    </div>
  </div>
</div>

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
    position: relative;
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

  .action-button.menu-trigger {
    font-size: 1.25rem;
    line-height: 1;
    padding: 0.25rem 0.5rem;
  }

  .context-menu {
    position: absolute;
    top: calc(100% + 2px);
    right: 0;
    background: #ffffff;
    border: 1px solid var(--input-border);
    border-radius: 0.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 160px;
    z-index: 1000;
    padding: 0.25rem 0;
  }

  :global(html.dark) .context-menu {
    background: #2a2a2a;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  }

  .context-menu.upward {
    top: auto;
    bottom: calc(100% + 2px);
  }

  .menu-divider {
    margin: 0.25rem 0;
    border: none;
    border-top: 1px solid var(--input-border);
    opacity: 0.5;
  }

  .menu-item {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s ease;
    display: block;
  }

  .menu-item:hover:not(:disabled) {
    background-color: var(--surface-hover);
  }

  .menu-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .menu-item.delete {
    color: var(--action-delete-color, #ef4444);
  }
</style>

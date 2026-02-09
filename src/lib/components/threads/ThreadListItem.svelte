<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { ROUTE } from '$lib/constants/route.constant';
  import type { Thread } from '../../../../src-electron/preload';
  import { threadService } from '$lib/services/thread.service';
  import { toastStore } from '$lib/services/toast.service';
  import { favorites } from '$lib/stores/favorite.store';
  import ThreadRenameModal from '$lib/modals/ThreadRenameModal.svelte';
  import ThreadDeleteModal from '$lib/modals/ThreadDeleteModal.svelte';

  interface Props {
    thread: Thread;
    projectId?: string | null;
  }

  let { thread, projectId = null }: Props = $props();
  let showMenu = $state(false);
  let showRenameModal = $state(false);
  let showDeleteModal = $state(false);

  const isFav = $derived($favorites.some((e) => e.id === thread.id));

  function handleToggleFavorite(event: MouseEvent) {
    event.stopPropagation();
    favorites.toggleFavorite(thread.id, 'thread');
    showMenu = false;
  }

  function formatDateTime(date: Date | number): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    const dateStr = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
    const timeStr = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
    return `${dateStr} ${timeStr}`;
  }

  function handleClick() {
    const params = new URLSearchParams();
    params.set('threadId', thread.id);

    if (projectId) {
      // Project thread context: use PROJECT_THREAD route
      params.set('projectId', projectId);
      push(`${ROUTE.PROJECT_THREAD}?${params.toString()}`);
    } else {
      // General thread context: use THREAD route (new ThreadPage)
      push(`${ROUTE.THREAD}?${params.toString()}`);
    }
  }

  function handleMenuClick(event: MouseEvent) {
    event.stopPropagation();
    showMenu = !showMenu;
  }

  function handleRename(event: MouseEvent) {
    event.stopPropagation();
    showMenu = false;
    showRenameModal = true;
  }

  async function handleRenameConfirmed(event: CustomEvent<{ threadId: string; newTitle: string }>) {
    const { threadId, newTitle } = event.detail;

    try {
      const result = await threadService.rename(threadId, newTitle);

      if (result.success) {
        toastStore.show('Thread renamed', { variant: 'success' });
        showRenameModal = false;
      } else {
        // Handle validation errors
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

  function handleRenameCancel() {
    showRenameModal = false;
  }

  function handleMove(event: MouseEvent) {
    event.stopPropagation();
    showMenu = false;
    // TODO: Implement move
    console.log('Move thread:', thread.id);
  }

  function handleDelete(event: MouseEvent) {
    event.stopPropagation();
    showMenu = false;
    showDeleteModal = true;
  }

  async function handleDeleteConfirmed() {
    try {
      await threadService.delete(thread.id);
      toastStore.show('Thread deleted successfully', { variant: 'success' });
      showDeleteModal = false;
    } catch (error) {
      console.error('Failed to delete thread:', error);
      toastStore.show('Failed to delete thread', { variant: 'error' });
      showDeleteModal = false;
    }
  }

  function handleDeleteCancel() {
    showDeleteModal = false;
  }

  function handleClickOutside(event: MouseEvent) {
    if (showMenu) {
      showMenu = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="thread-item-container">
  <button class="thread-item" onclick={handleClick}>
    <div class="thread-item-title">{thread.title || 'Untitled Thread'}</div>
    <div class="thread-item-info">
      <span class="thread-item-date">Last updated on {formatDateTime(thread.updatedAt)}</span>
      <span class="thread-item-model">{thread.metadata?.modelTitle || ''}</span>
    </div>
  </button>

  <div class="menu-container">
    <button class="menu-trigger" onclick={handleMenuClick} aria-label="Thread options">
      <i class="pi pi-ellipsis-h"></i>
    </button>

    {#if showMenu}
      <div class="context-menu" role="menu">
        <button class="menu-item" role="menuitem" onclick={handleToggleFavorite}>
          <span>{isFav ? 'Remove Favorite' : 'Make Favorite'}</span>
        </button>
        <button class="menu-item" role="menuitem" onclick={handleRename}>
          <span>Rename</span>
        </button>
        <button class="menu-item" role="menuitem" onclick={handleMove}>
          <span>Move</span>
        </button>
        <div class="menu-separator"></div>
        <button class="menu-item menu-item-danger" role="menuitem" onclick={handleDelete}>
          <span>Delete Thread</span>
        </button>
      </div>
    {/if}
  </div>
</div>

{#if showRenameModal}
  <ThreadRenameModal
    threadId={thread.id}
    currentTitle={thread.title || 'Untitled Thread'}
    on:confirm={handleRenameConfirmed}
    on:cancel={handleRenameCancel}
  />
{/if}

{#if showDeleteModal}
  <ThreadDeleteModal
    threadId={thread.id}
    threadTitle={thread.title || 'Untitled Thread'}
    on:confirm={handleDeleteConfirmed}
    on:cancel={handleDeleteCancel}
  />
{/if}

<style>
  .thread-item-container {
    position: relative;
    display: flex;
    align-items: stretch;
    border-bottom: 1px solid var(--surface-border);
  }

  .thread-item-container:hover {
    background: var(--surface-hover);
  }

  .thread-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem 0.5rem 0.5rem 0;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    flex: 1;
  }

  .thread-item:focus {
    outline: 2px solid var(--primary-color);
    outline-offset: -2px;
  }

  .thread-item-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .thread-item-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    gap: 1rem;
  }

  .thread-item-date {
    flex: 1;
  }

  .thread-item-model {
    flex-shrink: 0;
    font-style: italic;
  }

  .menu-container {
    position: relative;
    display: flex;
    align-items: flex-start;
    padding-top: 0.5rem;
  }

  .menu-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
    opacity: 0.5;
  }

  .thread-item-container:hover .menu-trigger {
    opacity: 1;
  }

  .menu-trigger:hover {
    background: var(--surface-hover);
  }

  .menu-trigger i {
    font-size: 14px;
  }

  /* Thread-specific menu positioning */
  .menu-container .context-menu {
    top: calc(100% + 4px);
    right: 0;
  }
</style>

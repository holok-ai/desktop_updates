<script lang="ts">
  import { threadFacade as threadService } from '$lib/services/thread-facade';
  import { favorites } from '$lib/stores/favorite.store';
  import SuggestedText from '$lib/components/common/SuggestedText.svelte';
  import { observerStore } from '$lib/observer/observer.store';
  import { ObserverTaskType } from '../../../../src-shared/types/observer.types';

  interface Props {
    threadId: string | null;
    title: string;
    onTitleChange?: (newTitle: string) => void;
  }

  let { threadId = null, title = $bindable(''), onTitleChange }: Props = $props();

  let showTokens = $state(false);
  let showStatus = $state(false);

  const isFav = $derived(threadId ? $favorites.some((e) => e.id === threadId) : false);

  const suggestedTitle = $derived(
    threadId
      ? ($observerStore.suggestions.get(`${threadId}:${ObserverTaskType.RenameTitle}`) ?? null)
      : null,
  );

  function toggleFavorite() {
    if (threadId) {
      favorites.toggleFavorite(threadId, 'thread', title, `/thread/${threadId}`);
    }
  }

  async function handleTitleChange(newTitle: string) {
    title = newTitle;
    onTitleChange?.(newTitle);
    if (threadId) {
      observerStore.dismissSuggestion(threadId, ObserverTaskType.RenameTitle);
      try {
        await threadService.rename(threadId, newTitle);
      } catch (err) {
        console.error('[ThreadPageHeader] Failed to rename thread:', err);
      }
    }
  }

  function handleSuggestionDiscard() {
    if (threadId) {
      observerStore.dismissSuggestion(threadId, ObserverTaskType.RenameTitle);
    }
  }
</script>

<header class="thread-page-header">
  <div class="header-content" role="group">
    <div class="header-left">
      <SuggestedText
        tag="h1"
        class="thread-title"
        bind:value={title}
        suggestedText={suggestedTitle}
        onChange={handleTitleChange}
        onDiscard={handleSuggestionDiscard}
        placeholder="Untitled Thread"
      />
    </div>

    <div class="header-commands">
      <button
        class="header-cmd favorite-star"
        class:is-favorited={isFav}
        onclick={toggleFavorite}
        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
        aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
      >
        <i class="pi {isFav ? 'pi-star-fill' : 'pi-star'}"></i>
      </button>
      <button
        class="header-cmd"
        class:active={showTokens}
        onclick={() => (showTokens = !showTokens)}
        title="Show token count"
        aria-label="Toggle token count"
      >
        <i class="pi pi-hashtag"></i>
      </button>
      <button
        class="header-cmd"
        class:active={showStatus}
        onclick={() => (showStatus = !showStatus)}
        title="Show status"
        aria-label="Toggle status"
      >
        <i class="pi pi-info-circle"></i>
      </button>
    </div>
  </div>
</header>

<style>
  .thread-page-header {
    border-bottom: 1px solid var(--surface-border, #e0e0e0);
    background: var(--surface-card, #fff);
    flex-shrink: 0;
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    min-height: 48px;
  }

  .header-left {
    flex: 1;
    min-width: 0;
  }

  :global(.thread-title) {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary, #111);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.4;
  }

  .header-commands {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
    opacity: 0;
    visibility: hidden;
    transition:
      opacity 0.15s ease,
      visibility 0.15s ease;
  }

  .header-content:hover .header-commands {
    opacity: 1;
    visibility: visible;
  }

  .header-cmd {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    border-radius: 4px;
    color: var(--text-secondary, #666);
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;
  }

  .header-cmd:hover {
    background: var(--surface-hover, #f0f0f0);
    color: var(--text-primary, #111);
  }

  .header-cmd.active {
    background: color-mix(in srgb, var(--primary-color, #646cff) 15%, transparent);
    color: var(--primary-color, #646cff);
  }

  .favorite-star.is-favorited {
    color: #f59e0b;
  }

  /* Keep the favorited star always visible even when header-commands is hidden */
  .header-content:not(:hover) .header-commands:has(.favorite-star.is-favorited) {
    opacity: 1;
    visibility: visible;
  }

  .header-cmd.favorite-star:hover {
    color: #f59e0b;
  }

  .header-cmd.favorite-star.is-favorited:hover {
    color: #d97706;
  }
</style>

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
  let _showStatus = $state(false);
  let showFavTooltip = $state(false);
  let _showStatusTooltip = $state(false);

  const isFav = $derived(threadId ? $favorites.some((e) => e.id === threadId) : false);

  const suggestedTitle = $derived(
    threadId
      ? ($observerStore.suggestions.get(`${threadId}:${ObserverTaskType.RenameTitle}`) ?? null)
      : null,
  );

  const contextStatus = $derived(
    threadId != null ? $observerStore.contextStatus.get(threadId) : undefined,
  );

  function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  function formatPercent(ratio: number): string {
    return `${Math.round(ratio * 100)}%`;
  }

  function formatTimestamp(ts?: number): string {
    if (!ts) return 'Never';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

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

    <div class="header-commands" class:panel-open={showTokens}>
      <!-- Favorite -->
      <div
        class="cmd-anchor"
        role="group"
        onmouseenter={() => (showFavTooltip = true)}
        onmouseleave={() => (showFavTooltip = false)}
      >
        <button
          class="header-cmd favorite-star"
          class:is-favorited={isFav}
          onclick={toggleFavorite}
          aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
        >
          <i class="pi {isFav ? 'pi-star-fill' : 'pi-star'}"></i>
        </button>
        {#if showFavTooltip}
          <div class="cmd-tooltip" role="tooltip">
            {isFav ? 'Remove from favorites' : 'Add to favorites'}
          </div>
        {/if}
      </div>

      <!-- Token count -->
      <div
        class="cmd-anchor"
        role="group"
        onmouseenter={() => (showTokens = true)}
        onmouseleave={() => (showTokens = false)}
      >
        <button class="header-cmd" aria-label="Token count">
          <i class="pi pi-hashtag"></i>
        </button>
        {#if showTokens}
          <div class="token-panel" role="dialog" aria-label="Token information">
            {#if contextStatus}
              <div class="token-row model-row">
                <span class="token-label">Model</span>
                <span class="token-value model-name">{contextStatus.modelAccessName}</span>
              </div>
              <div class="token-divider"></div>
              <div class="token-row">
                <span class="token-label">Max context</span>
                <span class="token-value"
                  >{formatTokens(contextStatus.maximumTokenCount)} tokens</span
                >
              </div>
              <div class="token-row">
                <span class="token-label">Current usage</span>
                <span class="token-value">
                  {formatTokens(contextStatus.currentTokenCount)} tokens ({formatPercent(
                    contextStatus.percentUsed,
                  )})
                </span>
              </div>
              <div class="token-row">
                <span class="token-label">Compact at</span>
                <span class="token-value">
                  {formatTokens(contextStatus.compactThresholdTokenCount)} tokens ({formatPercent(
                    contextStatus.compactThresholdRatio,
                  )})
                </span>
              </div>
              <div class="token-row">
                <span class="token-label">Last compact</span>
                <span class="token-value"
                  >{formatTimestamp(contextStatus.lastCompactTimestamp)}</span
                >
              </div>
            {:else}
              <div class="token-row">
                <span class="token-label">Context status unavailable</span>
              </div>
              <div class="token-row muted">Send a message to enable context tracking.</div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Status (hidden)
      <div
        class="cmd-anchor"
        role="group"
        onmouseenter={() => (showStatusTooltip = true)}
        onmouseleave={() => (showStatusTooltip = false)}
      >
        <button
          class="header-cmd"
          class:active={showStatus}
          onclick={() => (showStatus = !showStatus)}
          aria-label="Toggle status"
        >
          <i class="pi pi-info-circle"></i>
        </button>
        {#if showStatusTooltip}
          <div class="cmd-tooltip" role="tooltip">Show status</div>
        {/if}
      </div>
      -->
    </div>
  </div>
</header>

<style>
  .thread-page-header {
    border-bottom: 1px solid var(--surface-border, #e0e0e0);
    background: var(--surface-card, #fff);
    flex-shrink: 0;
    position: relative;
    z-index: 10;
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

  .header-content:hover .header-commands,
  .header-commands.panel-open {
    opacity: 1;
    visibility: visible;
  }

  /* Keep the favorited star always visible */
  .header-content:not(:hover) .header-commands:has(.favorite-star.is-favorited) {
    opacity: 1;
    visibility: visible;
  }

  .cmd-anchor {
    position: relative;
    display: flex;
    align-items: center;
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

  /* .header-cmd.active — unused while Status button is hidden
  .header-cmd.active {
    background: color-mix(in srgb, var(--primary-color, #646cff) 15%, transparent);
    color: var(--primary-color, #646cff);
  } */

  .favorite-star.is-favorited {
    color: #f59e0b;
  }

  .header-cmd.favorite-star:hover {
    color: #f59e0b;
  }

  .header-cmd.favorite-star.is-favorited:hover {
    color: #d97706;
  }

  /* ── Small text tooltip ── */
  .cmd-tooltip {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    background: var(--surface-tooltip, #1a1a1a);
    color: #fff;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    padding: 4px 8px;
    border-radius: 4px;
    pointer-events: none;
    z-index: 200;
  }

  /* ── Token panel ── */
  .token-panel {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 300px;
    background: var(--surface-overlay, var(--surface-card, #fff));
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 8px;
    padding: 0.625rem 0.75rem 0.875rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    z-index: 200;
  }

  .token-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
    font-size: 0.75rem;
    line-height: 1.5;
    color: var(--text-primary);
  }

  .token-row.muted {
    color: var(--text-secondary);
    font-style: italic;
    justify-content: flex-start;
  }

  .model-row {
    align-items: center;
  }

  .token-label {
    color: var(--text-secondary);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .token-value {
    font-weight: 500;
    text-align: right;
    word-break: break-all;
  }

  .model-name {
    font-size: 0.6875rem;
    font-family: monospace;
    color: var(--text-primary);
    opacity: 0.8;
  }

  .token-divider {
    height: 1px;
    background: var(--surface-border, #e0e0e0);
    margin: 0.25rem 0;
  }
</style>

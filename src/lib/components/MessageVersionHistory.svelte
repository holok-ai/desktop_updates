<script lang="ts">
  import { threadService } from '$lib/services/thread.service';
  import type { MessageVersion } from '$lib/types/thread.type';

  interface Props {
    threadId: string;
    messageId: string;
    currentContent: string;
    onClose: () => void;
  }

  let { threadId, messageId, currentContent, onClose }: Props = $props();

  let versions = $state<MessageVersion[]>([]);
  let loading = $state(true);
  let error = $state('');

  async function loadVersions() {
    try {
      loading = true;
      const result = await threadService.getMessageVersions(threadId, messageId);

      if (result.success) {
        versions = result.versions;
      } else {
        error = result.error;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load versions';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    loadVersions();
  });
</script>

<div class="modal-overlay" onclick={onClose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="modal-content"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal-header">
      <h3>Edit History</h3>
      <button class="close-button" onclick={onClose} aria-label="Close">×</button>
    </div>

    <div class="modal-body">
      {#if loading}
        <div class="loading">Loading history...</div>
      {:else if error}
        <div class="error">{error}</div>
      {:else}
        <div class="versions-list">
          <!-- Current version -->
          <div class="version-item current">
            <div class="version-header">
              <span class="version-badge current-badge">Current Version</span>
              <span class="version-date">Now</span>
            </div>
            <div class="version-content">{currentContent}</div>
          </div>

          <!-- Previous versions -->
          {#if versions.length > 0}
            {#each versions.slice().reverse() as version, index}
              <div class="version-item">
                <div class="version-header">
                  <span class="version-badge">Version {versions.length - index}</span>
                  <span class="version-date">{new Date(version.editedAt).toLocaleString()}</span>
                </div>
                <div class="version-content">{version.content}</div>
              </div>
            {/each}
          {:else}
            <div class="no-previous-versions">No previous versions</div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-overlay {
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
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal-content {
    background: var(--surface-card);
    border-radius: var(--border-radius);
    max-width: 700px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 calc(var(--inline-spacing) * 2) calc(var(--inline-spacing) * 4) 0
      color-mix(in srgb, var(--surface-900) 12%, transparent);
    animation: slideUp 0.2s ease;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(var(--content-padding) * 0.8) var(--content-padding);
    border-bottom: 1px solid var(--surface-border);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--text-primary);
  }

  .close-button {
    outline: none;
    background: transparent;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: var(--text-secondary);
    line-height: 1;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius);
    transition: background 0.2s;
  }

  .close-button:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
  }

  .modal-body {
    padding: var(--content-padding);
    overflow-y: auto;
    flex: 1;
  }

  .loading,
  .error,
  .no-previous-versions {
    text-align: center;
    padding: calc(var(--content-padding) * 1.5);
    color: var(--text-secondary);
  }

  .error {
    color: var(--error-color);
  }

  .versions-list {
    display: flex;
    flex-direction: column;
    gap: var(--content-padding);
  }

  .version-item {
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius);
    padding: var(--content-padding);
    transition: box-shadow 0.2s;
  }

  .version-item:hover {
    box-shadow: 0 var(--inline-spacing) calc(var(--inline-spacing) * 2) 0
      color-mix(in srgb, var(--surface-900) 8%, transparent);
  }

  .version-item.current {
    border: 2px solid var(--primary-color);
  }

  .version-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: calc(var(--inline-spacing) * 1.5);
    font-size: 14px;
  }

  .version-badge {
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--surface-100);
    padding: calc(var(--inline-spacing) / 2) var(--inline-spacing);
    border-radius: var(--border-radius);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .version-badge.current-badge {
    background: var(--primary-color);
    color: var(--primary-color-text);
  }

  .version-date {
    color: var(--surface-400);
    font-size: 12px;
  }

  .version-content {
    padding: calc(var(--inline-spacing) * 1.5);
    background: var(--surface-card);
    border-radius: var(--border-radius);
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  .version-item.current .version-content {
    background: var(--surface-card);
    font-weight: 500;
  }

  .no-previous-versions {
    font-style: italic;
    color: var(--surface-400);
    padding: var(--content-padding);
  }
</style>

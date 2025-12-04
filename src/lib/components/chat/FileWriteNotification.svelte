<script lang="ts">
  import MarkdownRenderer from '../MarkdownRenderer.svelte';

  export let filePath: string;
  export let created: boolean;
  export let bytesWritten: number;
  export let content: string;
  export let previousSizeBytes: number | null = null;
  export let overwriteRequested: boolean | null = null;
  export let error: string | null = null;
  export let status: 'pending' | 'complete' = 'complete';

  let showContent = false;

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  }

  function getLanguageFromPath(path: string): string {
    const lower = path.toLowerCase();
    if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'ts';
    if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'js';
    if (lower.endsWith('.json')) return 'json';
    if (lower.endsWith('.md')) return 'md';
    if (lower.endsWith('.svelte')) return 'svelte';
    if (lower.endsWith('.vue')) return 'vue';
    if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return 'yaml';
    if (lower.endsWith('.html')) return 'html';
    if (lower.endsWith('.css') || lower.endsWith('.scss')) return 'css';
    return '';
  }

  function getFriendlyError(message: string | null, path: string): string | null {
    if (!message) return null;
    if (message.startsWith('ACCESS_DENIED')) {
      return `${path} is not in your allowed directories. Add the parent folder in Settings to enable writes.`;
    }
    if (message.startsWith('FILE_EXISTS')) {
      return `${path} already exists. Ask me to overwrite it if you want to replace the contents.`;
    }
    return message;
  }

  $: language = getLanguageFromPath(filePath);
  $: previewMarkdown = '```' + language + '\n' + content + '\n```';

  $: isError = !!error;
  $: friendlyError = getFriendlyError(error, filePath);
  $: isPending = status === 'pending';
  $: iconClass = isError
    ? 'pi pi-exclamation-triangle'
    : isPending
      ? 'pi pi-spin pi-spinner'
      : 'pi pi-pencil';
  $: operationLabel = created ? 'Creating file:' : 'Updating file:';
</script>

<div class="file-write-notification" class:error={isError} class:pending={isPending}>
  <div class="header">
    <i class={iconClass}></i>
    <div class="title">
      {#if isError}
        <div class="operation">Cannot write file</div>
      {:else}
        <div class="operation">{operationLabel}</div>
      {/if}
      <div class="file-path">{filePath}</div>
    </div>
  </div>

  {#if isError}
    <div class="details error-text">{friendlyError}</div>
  {:else}
    <div class="details">
      {#if !created}
        <div class="row">
          {#if typeof previousSizeBytes === 'number'}
            <span>Overwriting existing file (was {formatBytes(previousSizeBytes)})</span>
          {:else if overwriteRequested}
            <span>Overwriting existing file</span>
          {:else}
            <span>Updating existing file</span>
          {/if}
        </div>
      {/if}
      {#if isPending}
        <div class="row">
          <span>Writing file...</span>
        </div>
      {:else}
        <div class="row">
          <span>{formatBytes(bytesWritten)} written</span>
        </div>
      {/if}
    </div>

    <div class="actions">
      <button type="button" onclick={() => (showContent = !showContent)}>
        {showContent ? 'Hide content' : 'Show content'}
      </button>
    </div>

    {#if showContent}
      <div class="content-preview">
        <MarkdownRenderer content={previewMarkdown} enableCopy={true} />
      </div>
    {/if}
  {/if}
</div>

<style>
  .file-write-notification {
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius);
    padding: var(--inline-spacing) var(--content-padding);
    margin: var(--inline-spacing) 0;
    background: var(--surface-card);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .file-write-notification.error {
    border-color: var(--error-color);
    background: var(--error-bg, rgba(248, 113, 113, 0.08));
  }

  .file-write-notification.pending {
    border-color: var(--surface-border);
    background: var(--surface-ground);
  }

  .header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .header i {
    font-size: 1rem;
  }

  .title {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .operation {
    font-weight: 600;
  }

  .file-path {
    font-family: var(
      --font-mono,
      ui-monospace,
      SFMono-Regular,
      Menlo,
      Monaco,
      Consolas,
      'Liberation Mono',
      'Courier New',
      monospace
    );
    font-size: 0.85rem;
    color: var(--text-secondary);
    word-break: break-all;
  }

  .details {
    font-size: 0.85rem;
    color: var(--text-secondary);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .actions {
    margin-top: 0.25rem;
  }

  .actions button {
    border-radius: var(--border-radius);
    border: 1px solid var(--surface-border);
    background: var(--surface-overlay);
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .actions button:hover {
    background: var(--surface-hover);
  }

  .content-preview {
    margin-top: 0.25rem;
  }

  .error-text {
    color: var(--error-color);
    font-size: 0.85rem;
  }
</style>

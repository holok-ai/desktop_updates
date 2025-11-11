<script lang="ts">
  import type { Attachment } from '../../../src-shared/types/attachment.types';

  interface Props {
    attachment: Attachment;
    mode?: 'preview' | 'history'; // preview = before send, history = in message
    onRemove?: () => void;
    onDownload?: () => void;
  }

  let { attachment, mode = 'preview', onRemove, onDownload }: Props = $props();

  // Determine if file is an image
  const isImage = $derived(
    attachment.mimeType.startsWith('image/') &&
      ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(attachment.mimeType),
  );

  // Get file icon based on MIME type
  function getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType === 'text/plain') return '📝';
    if (mimeType === 'text/markdown') return '📝';
    if (mimeType === 'application/json') return '📊';
    if (mimeType === 'text/csv') return '📊';
    if (
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
      return '📊';
    return '📎';
  }

  // Format file size
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Get status color
  const statusColor = $derived(
    attachment.status === 'success'
      ? 'text-green-600'
      : attachment.status === 'failed'
        ? 'text-red-600'
        : 'text-blue-600',
  );

  // Get status icon
  const statusIcon = $derived(
    attachment.status === 'success' ? '✓' : attachment.status === 'failed' ? '✗' : '⟳',
  );
</script>

<div
  class="attachment-preview flex items-center gap-3 p-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
  role="group"
  aria-label={`Attachment: ${attachment.filename}, ${formatFileSize(attachment.size)}`}
  aria-describedby={`attachment-status-${attachment.id}`}
>
  <!-- Thumbnail or Icon -->
  <div class="flex-shrink-0">
    {#if isImage && attachment.url}
      <img src={attachment.url} alt={attachment.filename} class="w-12 h-12 object-cover rounded" />
    {:else}
      <div class="w-12 h-12 flex items-center justify-center text-3xl bg-gray-100 rounded">
        {getFileIcon(attachment.mimeType)}
      </div>
    {/if}
  </div>

  <!-- File Info -->
  <div class="flex-1 min-w-0">
    <div class="flex items-center gap-2">
      <p class="text-sm font-medium text-gray-900 truncate" title={attachment.filename}>
        {attachment.filename}
      </p>
      {#if attachment.status !== 'success'}
        <span
          id={`attachment-status-${attachment.id}`}
          class={`text-xs ${statusColor}`}
          role="status"
          aria-live="polite"
        >
          {statusIcon}
          {attachment.status === 'uploading' ? 'Uploading...' : 'Failed'}
        </span>
      {/if}
    </div>
    <p class="text-xs text-gray-500">
      {formatFileSize(attachment.size)}
      {#if attachment.status === 'uploading'}
        <span class="ml-1 text-blue-600">• Uploading...</span>
      {/if}
    </p>
    {#if attachment.error}
      <p class="text-xs text-red-600 mt-1" role="alert">
        {attachment.error}
      </p>
    {/if}
  </div>

  <!-- Actions -->
  <div class="flex-shrink-0 flex items-center gap-2">
    {#if mode === 'preview' && onRemove}
      <button
        type="button"
        onclick={onRemove}
        onkeydown={(e) => {
          if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            onRemove?.();
          }
        }}
        class="p-1 text-gray-400 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
        aria-label={`Remove ${attachment.filename} (Press Delete or Backspace)`}
        title="Remove (Delete/Backspace)"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    {/if}

    {#if mode === 'history' && attachment.status === 'success' && onDownload}
      <button
        type="button"
        onclick={onDownload}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onDownload?.();
          }
        }}
        class="p-1 text-gray-400 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        aria-label={`Download ${attachment.filename} (Press Enter)`}
        title="Download (Enter)"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
      </button>
    {/if}
  </div>
</div>

<style>
  .attachment-preview {
    max-width: 400px;
  }
</style>

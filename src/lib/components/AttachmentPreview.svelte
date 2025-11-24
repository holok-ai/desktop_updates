<script lang="ts">
  import type { Attachment } from '../../../src-shared/types/attachment.types';

  interface Props {
    attachment: Attachment;
    mode?: 'preview' | 'history'; // preview = before send, history = in message
    onRemove?: () => void;
    onDownload?: () => void;
    onPreview?: () => void;
    inlinePreviewUrl?: string; // Optional inline preview URL for small images
  }

  let {
    attachment,
    mode = 'preview',
    onRemove,
    onDownload,
    onPreview,
    inlinePreviewUrl,
  }: Props = $props();

  // Determine if file is an image
  const isImage = $derived(
    attachment.mimeType.startsWith('image/') &&
      ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(attachment.mimeType),
  );

  // Determine if file is previewable (images and PDFs)
  const isPreviewable = $derived(isImage || attachment.mimeType === 'application/pdf');

  // Check if should display inline (small images in history mode)
  const MAX_INLINE_SIZE = 500 * 1024; // 500KB
  const shouldShowInline = $derived(
    mode === 'history' && isImage && attachment.size <= MAX_INLINE_SIZE && inlinePreviewUrl,
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

  const STATUS_CLASS = {
    success: 'status-success',
    failed: 'status-failed',
    uploading: 'status-progress',
  } as const;

  const STATUS_ICON = {
    success: '✓',
    failed: '✗',
    uploading: '⟳',
  } as const;

  const statusClass = $derived(STATUS_CLASS[attachment.status] ?? STATUS_CLASS.uploading);
  const statusIcon = $derived(STATUS_ICON[attachment.status] ?? STATUS_ICON.uploading);
</script>

<div
  class="attachment-preview-container"
  role="group"
  aria-label={`Attachment: ${attachment.filename}, ${formatFileSize(attachment.size)}`}
  aria-describedby={`attachment-status-${attachment.id}`}
>
  <!-- Inline Image Preview (for small images <500KB) -->
  {#if shouldShowInline}
    <button
      type="button"
      onclick={() => onPreview?.()}
      class="inline-preview-button"
      aria-label={`Click to preview ${attachment.filename} in full size`}
    >
      <img
        src={inlinePreviewUrl}
        alt={attachment.filename}
        class="inline-preview-image"
        loading="lazy"
      />
    </button>
  {/if}

  <!-- Compact Attachment Info -->
  <div class="attachment-preview">
    <!-- Thumbnail or Icon -->
    <div class="attachment-thumbnail">
      {#if isImage && !shouldShowInline && attachment.url}
        <img src={attachment.url} alt={attachment.filename} class="thumbnail-image" />
      {:else if isImage && !shouldShowInline && inlinePreviewUrl}
        <img src={inlinePreviewUrl} alt={attachment.filename} class="thumbnail-image" />
      {:else}
        <div class="thumbnail-placeholder">
          {getFileIcon(attachment.mimeType)}
        </div>
      {/if}
    </div>

    <!-- File Info -->
    <div class="attachment-info">
      <div class="attachment-header">
        <p class="attachment-filename" title={attachment.filename}>
          {attachment.filename}
        </p>
        {#if attachment.status !== 'success'}
          <span
            id={`attachment-status-${attachment.id}`}
            class={`attachment-status ${statusClass}`}
            role="status"
            aria-live="polite"
          >
            {statusIcon}
            {attachment.status === 'uploading' ? 'Uploading...' : 'Failed'}
          </span>
        {/if}
      </div>
      <p class="attachment-meta">
        {formatFileSize(attachment.size)}
        {#if attachment.status === 'uploading'}
          <span class="attachment-meta-highlight">• Uploading...</span>
        {/if}
      </p>
      {#if attachment.error}
        <p class="attachment-error" role="alert" aria-live="assertive">
          {attachment.error}
        </p>
      {/if}
      {#if mode === 'history' && attachment.status === 'success' && !attachment.localPath}
        <p class="attachment-warning" role="status" aria-live="polite">
          ⚠️ File may no longer be available
        </p>
      {/if}
    </div>

    <!-- Actions -->
    <div class="attachment-actions">
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
          class="attachment-action attachment-action-remove"
          aria-label={`Remove ${attachment.filename} (Press Delete or Backspace)`}
          title="Remove (Delete/Backspace)"
        >
          <svg
            class="attachment-action-icon"
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

      {#if mode === 'history' && attachment.status === 'success'}
        {#if isPreviewable && onPreview}
          <button
            type="button"
            onclick={onPreview}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPreview?.();
              }
            }}
            class="attachment-action attachment-action-preview"
            aria-label={`Preview ${attachment.filename} (Press Enter)`}
            title="Preview (Enter)"
          >
            <svg
              class="attachment-action-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </button>
        {/if}
        {#if onDownload}
          <button
            type="button"
            onclick={onDownload}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onDownload?.();
              }
            }}
            class="attachment-action attachment-action-download"
            aria-label={`Download ${attachment.filename} (Press Enter)`}
            title="Download (Enter)"
          >
            <svg
              class="attachment-action-icon"
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
      {/if}
    </div>
  </div>
</div>

<style>
  .attachment-preview-container {
    max-width: 600px;
  }

  .inline-preview-button {
    display: block;
    width: 100%;
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius);
    overflow: hidden;
    background: var(--surface-100);
    transition: background 0.2s ease;
    cursor: pointer;
  }

  .inline-preview-button:hover {
    background: var(--surface-hover);
  }

  .inline-preview-image {
    display: block;
    max-width: 100%;
    max-height: 16rem;
    object-fit: contain;
    margin: 0 auto;
    pointer-events: none;
  }

  .attachment-preview {
    display: flex;
    align-items: center;
    gap: var(--content-padding);
    padding: var(--inline-spacing) var(--content-padding);
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius);
    background: var(--surface-card);
    transition:
      background 0.2s ease,
      border-color 0.2s ease;
  }

  .attachment-preview:hover {
    background: var(--surface-hover);
    border-color: var(--surface-border);
  }

  .attachment-thumbnail {
    flex-shrink: 0;
  }

  .thumbnail-image {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: var(--border-radius);
  }

  .thumbnail-placeholder {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    background: var(--surface-100);
    border-radius: var(--border-radius);
  }

  .attachment-info {
    flex: 1;
    min-width: 0;
  }

  .attachment-header {
    display: flex;
    align-items: center;
    gap: var(--inline-spacing);
  }

  .attachment-filename {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .attachment-status {
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .status-success {
    color: var(--green-500);
  }

  .status-progress {
    color: var(--primary-color);
  }

  .status-failed {
    color: var(--red-500);
  }

  .attachment-meta {
    font-size: 12px;
    color: var(--text-secondary);
    margin: calc(var(--inline-spacing) / 2) 0 0;
  }

  .attachment-meta-highlight {
    color: var(--primary-color);
    margin-left: var(--inline-spacing);
  }

  .attachment-error {
    font-size: 12px;
    color: var(--error-color);
    margin-top: calc(var(--inline-spacing) / 2);
  }

  .attachment-warning {
    font-size: 12px;
    color: var(--yellow-600);
    margin-top: calc(var(--inline-spacing) / 2);
  }

  .attachment-actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--inline-spacing);
  }

  .attachment-action {
    background: transparent;
    border: none;
    padding: var(--inline-spacing);
    border-radius: var(--border-radius);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .attachment-action:hover {
    color: var(--primary-color);
  }

  .attachment-action-remove {
    color: var(--red-500);
  }

  .attachment-action-remove:hover {
    color: var(--red-400);
  }

  .attachment-action-preview {
    color: var(--primary-color);
  }

  .attachment-action-download {
    color: var(--primary-color);
  }

  .attachment-action-icon {
    width: 20px;
    height: 20px;
  }
</style>

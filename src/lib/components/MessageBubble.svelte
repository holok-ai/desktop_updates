<script lang="ts">
  import { MESSAGE_STATUS } from '$lib/constants/status.constant';
  import type { Message } from '$lib/types/thread.type';
  import type { MessageStatus } from '$lib/types/status.type';
  import { createEventDispatcher } from 'svelte';
  import type { Attachment } from '../../../src-shared/types/attachment.types';
  import AttachmentPreview from './AttachmentPreview.svelte';

  interface Props {
    message: Message;
    onRetry?: (messageId: string) => void;
    onEdit?: (messageId: string, currentContent: string) => void;
    onShowVersions?: (messageId: string) => void;
    threadId?: string;
    isStreaming?: boolean;
  }

  const dispatch = createEventDispatcher<{ copied: { message: string } }>();

  const STATUS_ICON = {
    [MESSAGE_STATUS.SENDING]: '●',
    [MESSAGE_STATUS.SENT]: '✓',
    [MESSAGE_STATUS.FAILED]: '⚠',
    [MESSAGE_STATUS.PENDING_OFFLINE]: '○',
  } as const;

  const STATUS_TEXT = {
    [MESSAGE_STATUS.SENDING]: 'Sending...',
    [MESSAGE_STATUS.SENT]: 'Sent',
    [MESSAGE_STATUS.FAILED]: 'Failed',
    [MESSAGE_STATUS.PENDING_OFFLINE]: 'Offline',
  } as const;

  let { message, onRetry, onEdit, onShowVersions, isStreaming = false, threadId }: Props = $props();

  let isEditingInline = $state(false);
  let editedContent = $state('');
  const inlinePreviewUrls = new Map<string, string>();

  function getStatusIcon(status?: MessageStatus): string {
    if (!status) return '';
    return STATUS_ICON[status];
  }

  function getStatusText(status?: MessageStatus): string {
    if (!status) return '';
    return STATUS_TEXT[status];
  }

  function getOpacity(status?: MessageStatus): number {
    return status === MESSAGE_STATUS.SENDING || status === MESSAGE_STATUS.PENDING_OFFLINE ? 0.5 : 1;
  }

  function handleRetry() {
    if (onRetry && message.id) {
      onRetry(message.id);
    }
  }

  async function handleCopy() {
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(message.content);
      } else {
        const ta = document.createElement('textarea');
        ta.value = message.content;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      dispatch('copied', { message: 'Prompt copied to clipboard' });
    } catch (error) {
      console.error('Copy failed', error);
      dispatch('copied', { message: 'Failed to copy prompt' });
    }
  }

  async function getInlinePreviewUrl(attachment: Attachment): Promise<string | undefined> {
    if (!threadId) return undefined;

    const MAX_INLINE_SIZE = 500 * 1024; // 500KB
    const cacheKey = `${threadId}:${attachment.id}`;
    if (inlinePreviewUrls.has(cacheKey)) {
      return inlinePreviewUrls.get(cacheKey);
    }

    if (attachment.size > MAX_INLINE_SIZE) {
      return undefined;
    }

    try {
      const userId = 'current-user'; // TODO: Get from auth store
      const result = await window.electronAPI.file.preview({
        threadId,
        fileId: attachment.id,
        userId,
      });

      if (result.success && result.token && result.fileInfo?.canInlinePreview) {
        const fileData = await window.electronAPI.file.getWithToken({ token: result.token });
        if (fileData.success && fileData.buffer) {
          const uint8Array = new Uint8Array(fileData.buffer as any);
          const blob = new Blob([uint8Array], { type: result.fileInfo.mimeType });
          const url = URL.createObjectURL(blob);
          inlinePreviewUrls.set(cacheKey, url);
          return url;
        }
      }
    } catch (err) {
      console.error('Error generating inline preview:', err);
    }

    return undefined;
  }

  async function previewAttachment(attachment: Attachment) {
    if (!threadId) return;
    // TODO: Implement preview attachment
    console.log('Previewing attachment:', threadId, attachment.id, attachment.filename);
  }

  async function downloadAttachment(attachment: Attachment) {
    if (!threadId) return;
    // TODO: Implement download attachment
    console.log('Downloading attachment:', threadId, attachment.id, attachment.filename);
  }

  function handleEdit() {
    isEditingInline = true;
    editedContent = message.content;
  }

  function handleCancelEdit() {
    isEditingInline = false;
    editedContent = '';
  }

  function handleSaveEdit() {
    if (onEdit && message.id && editedContent.trim() && !isStreaming) {
      onEdit(message.id, editedContent.trim());
      isEditingInline = false;
      editedContent = '';
    }
  }

  function handleShowVersions() {
    if (onShowVersions && message.id) {
      onShowVersions(message.id);
    }
  }
</script>

<div
  class="message {message.role}"
  style="opacity: {getOpacity(message.status)}"
  class:sending={message.status === MESSAGE_STATUS.SENDING}
  class:failed={message.status === MESSAGE_STATUS.FAILED}
>
  {#if isEditingInline}
    <div class="message-content editing">
      <textarea
        bind:value={editedContent}
        rows={Math.max(3, editedContent.split('\n').length)}
        class="edit-textarea"
        onkeydown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelEdit();
          }
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSaveEdit();
          }
        }}
      ></textarea>
      <div class="edit-actions">
        <button class="save-button" onclick={handleSaveEdit} disabled={!editedContent.trim() || isStreaming}>
          {isStreaming ? 'Sending...' : 'Save & Regenerate'}
        </button>
        <button class="cancel-button" onclick={handleCancelEdit} disabled={isStreaming}>
          Cancel
        </button>
        <span class="edit-hint">Ctrl/⌘+Enter to save, Esc to cancel</span>
      </div>
    </div>
  {:else}
    <div class="message-content">{message.content}</div>
  {/if}
  <div class="message-footer">
    <span class="message-meta">
      {new Date(message.createdAt).toLocaleString()}
      {#if message.isEdited}
        <span class="edited-indicator" title="Message was edited">✎ Edited</span>
      {/if}
    </span>
    {#if message.status}
      <span class="message-status" class:status-failed={message.status === MESSAGE_STATUS.FAILED}>
        <span class="status-icon">{getStatusIcon(message.status)}</span>
        <span class="status-text">{getStatusText(message.status)}</span>
      </span>
    {/if}
    <div class="message-actions">
      <button class="copy-button" type="button" onclick={handleCopy} aria-label="Copy message">
        📋
      </button>
      {#if message.role === 'user' && onEdit && message.status !== MESSAGE_STATUS.SENDING}
        <button class="action-button" onclick={handleEdit} aria-label="Edit message" title="Edit message">
          ✎
        </button>
      {/if}
      {#if message.isEdited}
        <button class="action-button" onclick={handleShowVersions} aria-label="View edit history" title="View edit history">
          📜
        </button>
      {/if}
      {#if message.status === MESSAGE_STATUS.FAILED && onRetry}
        <button class="retry-button" onclick={handleRetry} aria-label="Retry sending message">
          Retry
        </button>
      {/if}
    </div>
  </div>
  {#if message.error}
    <div class="error-text">{message.error}</div>
  {/if}
  {#if message.metadata?.attachments && message.metadata.attachments.length > 0}
    <div class="message-attachments">
      {#each message.metadata.attachments as attachment (attachment.id)}
        {#await threadId ? getInlinePreviewUrl(attachment) : undefined}
          <AttachmentPreview
            {attachment}
            mode="history"
            onPreview={() => previewAttachment(attachment)}
            onDownload={() => downloadAttachment(attachment)}
          />
        {:then inlineUrl}
          <AttachmentPreview
            {attachment}
            mode="history"
            inlinePreviewUrl={inlineUrl}
            onPreview={() => previewAttachment(attachment)}
            onDownload={() => downloadAttachment(attachment)}
          />
        {/await}
      {/each}
    </div>
  {/if}
</div>

<style>
  .message {
    margin-bottom: 1rem;
    transition: opacity 0.3s ease;
    position: relative;
  }

  .message.sending {
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 0.3;
    }
  }

  .message.user .message-content {
    background: var(--surface-card);
    padding: 0.5rem;
    border-radius: 6px;
  }

  .message.assistant .message-content {
    background: var(--surface-card);
    padding: 0.5rem;
    border-radius: 6px;
  }

  .message.failed .message-content {
    border: 1px solid #ef4444;
  }

  .message-content.editing {
    padding: 0;
    background: transparent;
  }

  .edit-textarea {
    width: 100%;
    padding: 0.5rem;
    border: 2px solid #646cff;
    border-radius: 6px;
    font-family: inherit;
    font-size: inherit;
    resize: vertical;
    min-height: 60px;
    background: var(--surface-card);
  }

  .edit-textarea:focus {
    outline: none;
    border-color: #535bf2;
    box-shadow: 0 0 0 3px rgba(100, 108, 255, 0.1);
  }

  .edit-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .save-button {
    background: #646cff;
    color: white;
    border: none;
    padding: 0.375rem 0.75rem;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s;
    font-weight: 500;
  }

  .save-button:hover:not(:disabled) {
    background: #535bf2;
  }

  .save-button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .cancel-button {
    background: #f0f0f0;
    color: #333;
    border: 1px solid #ccc;
    padding: 0.375rem 0.75rem;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-button:hover {
    background: #e0e0e0;
  }

  .edit-hint {
    font-size: 0.7rem;
    color: #888;
    font-style: italic;
    margin-left: auto;
  }

  .message-actions {
    position: absolute;
    right: 0.5rem;
    top: 0;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .copy-button {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid transparent;
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-size: 0.85rem;
    cursor: pointer;
    color: inherit;
    transition: background 0.2s ease, border-color 0.2s ease;
  }

  .copy-button:hover {
    background: rgba(148, 163, 184, 0.12);
    border-color: rgba(148, 163, 184, 0.35);
  }

  .copy-button:focus {
    outline: none;
    border-color: rgba(100, 108, 255, 0.28);
    box-shadow: 0 0 0 4px rgba(100, 108, 255, 0.08);
  }

  .message-content.editing {
    padding: 0;
    background: transparent;
  }

  .edit-textarea {
    width: 100%;
    padding: 0.5rem;
    border: 2px solid #646cff;
    border-radius: 6px;
    font-family: inherit;
    font-size: inherit;
    resize: vertical;
    min-height: 60px;
    background: var(--surface-card);
  }

  .edit-textarea:focus {
    outline: none;
    border-color: #535bf2;
    box-shadow: 0 0 0 3px rgba(100, 108, 255, 0.1);
  }

  .edit-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .save-button {
    background: #646cff;
    color: white;
    border: none;
    padding: 0.375rem 0.75rem;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s;
    font-weight: 500;
  }

  .save-button:hover:not(:disabled) {
    background: #535bf2;
  }

  .save-button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .cancel-button {
    background: #f0f0f0;
    color: #333;
    border: 1px solid #ccc;
    padding: 0.375rem 0.75rem;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-button:hover {
    background: #e0e0e0;
  }

  .edit-hint {
    font-size: 0.7rem;
    color: #888;
    font-style: italic;
    margin-left: auto;
  }

  .message-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .message-meta {
    font-size: 0.75rem;
    color: #666;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .edited-indicator {
    font-style: italic;
    color: #888;
    font-size: 0.7rem;
  }

  .message-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .action-button {
    background: transparent;
    color: #666;
    border: 1px solid #ccc;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-button:hover {
    background: #f0f0f0;
    color: #333;
    border-color: #999;
  }

  .message-status {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: #666;
  }

  .status-icon {
    font-size: 0.625rem;
  }

  .status-failed {
    color: #ef4444;
  }

  .retry-button {
    background: #ef4444;
    color: white;
    border: none;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .retry-button:hover {
    background: #dc2626;
  }

  .error-text {
    font-size: 0.75rem;
    color: #ef4444;
    margin-top: 0.25rem;
  }

  .message-attachments {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 600px;
  }
</style>


<script lang="ts">
  import { MESSAGE_STATUS } from '$lib/constants/status.constant';
  import type { Message } from '$lib/types/thread.type';
  import type { MessageStatus } from '$lib/types/status.type';
  import MarkdownRenderer from './MarkdownRenderer.svelte';

  interface Props {
    message: Message;
    onRetry?: (messageId: string) => void;
    onEdit?: (messageId: string, currentContent: string) => void;
    onShowVersions?: (messageId: string) => void;
    isStreaming?: boolean;
  }

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

  let { message, onRetry, onEdit, onShowVersions, isStreaming = false }: Props = $props();

  let isEditingInline = $state(false);
  let editedContent = $state('');

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
    <div class="message-content">
      <MarkdownRenderer content={message.content} enableCopy={true} />
    </div>
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
</div>

<style>
  .message {
    margin-bottom: 1rem;
    transition: opacity 0.3s ease;
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
</style>


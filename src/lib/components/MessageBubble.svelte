<script lang="ts">
  import { MESSAGE_STATUS } from '$lib/constants/status.constant';
  import type { Message } from '$lib/types/thread.type';
  import type { MessageStatus } from '$lib/types/status.type';

  interface Props {
    message: Message;
    onRetry?: (messageId: string) => void;
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

  let { message, onRetry }: Props = $props();

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
</script>

<div
  class="message {message.role}"
  style="opacity: {getOpacity(message.status)}"
  class:sending={message.status === MESSAGE_STATUS.SENDING}
  class:failed={message.status === MESSAGE_STATUS.FAILED}
>
  <div class="message-content">{message.content}</div>
  <div class="message-footer">
    <span class="message-meta">{new Date(message.createdAt).toLocaleString()}</span>
    {#if message.status}
      <span class="message-status" class:status-failed={message.status === MESSAGE_STATUS.FAILED}>
        <span class="status-icon">{getStatusIcon(message.status)}</span>
        <span class="status-text">{getStatusText(message.status)}</span>
      </span>
    {/if}
    {#if message.status === MESSAGE_STATUS.FAILED && onRetry}
      <button class="retry-button" onclick={handleRetry} aria-label="Retry sending message">
        Retry
      </button>
    {/if}
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

  .message-footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .message-meta {
    font-size: 0.75rem;
    color: #666;
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


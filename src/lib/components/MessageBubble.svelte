<script lang="ts">
  import { MESSAGE_STATUS } from '$lib/constants/status.constant';
  import type { Message } from '$lib/types/thread.type';
  import type { MessageStatus } from '$lib/types/status.type';
  import MarkdownRenderer from './MarkdownRenderer.svelte';
  import { onDestroy } from 'svelte';
  import type { Attachment, ResponseComment } from '../../../src-shared/types/attachment.types';
  import AttachmentPreview from './AttachmentPreview.svelte';
  import CommentBubbleIcon from './CommentBubbleIcon.svelte';
  import CommentDisplay from './CommentDisplay.svelte';
  import CommentEditor from './CommentEditor.svelte';
  import { threadService } from '$lib/services/thread.service';
  import VariationButton from './branching/VariationButton.svelte';
  import { canCreateVariation } from '$lib/utils/branch-utils';
  import {
    copyToClipboard,
    copyResponse,
    copyToInput,
    getCopyFormat,
    setCopyFormat,
    type CopyFormat,
  } from '$lib/services/clipboard.service';

  interface Props {
    message: Message;
    messages?: Message[];
    onRetry?: (messageId: string) => void;
    onEdit?: (messageId: string, currentContent: string) => void;
    onShowVersions?: (messageId: string) => void;
    onCreateVariation?: (messageId: string) => void;
    threadId?: string;
    isStreaming?: boolean;
    showComments?: boolean;
  }

  let {
    message,
    messages = [],
    onRetry,
    onEdit,
    onShowVersions,
    onCreateVariation,
    isStreaming = false,
    threadId,
    showComments = false,
  }: Props = $props();

  let isEditingInline = $state(false);

  const canCreateVariationForMessage = $derived(() => {
    if (message.role !== 'user') return false;
    try {
      // Check if this message can have variations created
      return canCreateVariation(message);
    } catch {
      return false;
    }
  });
  let editedContent = $state('');
  // Cache for inline preview blob URLs: key is `${threadId}:${attachment.id}`, value is the blob URL
  // URLs are populated in getInlinePreviewUrl() when attachments are rendered (line 342)
  const inlinePreviewUrls = new Map<string, string>();

  // Comment functionality
  let isEditingComment = $state(false);
  let isAddingComment = $state(false);
  const comment = $derived(message.metadata?.comment as ResponseComment | undefined);
  const hasComment = $derived(comment && comment.content.trim().length > 0);

  // Cancel editing when showComments changes from true to false
  // But allow editing even when showComments is false (user clicked icon)
  let prevShowComments = $state(false);
  $effect(() => {
    // Only cancel if showComments changed from true to false
    if (prevShowComments && !showComments) {
      isEditingComment = false;
      isAddingComment = false;
    }
    prevShowComments = showComments;
  });

  function getOpacity(status?: MessageStatus): number {
    return status === MESSAGE_STATUS.SENDING || status === MESSAGE_STATUS.PENDING_OFFLINE ? 0.5 : 1;
  }

  function handleRetry() {
    if (onRetry && message.id) {
      onRetry(message.id);
    }
  }

  // Copy state
  let showCopyMenu = $state(false);
  let copyFormat = $state<CopyFormat>(getCopyFormat());

  async function handleCopyToClipboard() {
    if (message.role === 'assistant') {
      await copyResponse(message.content, copyFormat);
    } else {
      await copyToClipboard(message.content);
    }
  }

  async function handleCopyAs(format: CopyFormat) {
    setCopyFormat(format);
    copyFormat = format;
    await copyResponse(message.content, format);
    showCopyMenu = false;
  }

  function handleCopyToInput() {
    copyToInput(message.content);
  }

  /**
   * Get or create an inline preview URL for an attachment.
   * URLs are cached in inlinePreviewUrls map to avoid re-creating blob URLs.
   * Called from template when rendering attachments (line 342).
   */
  async function getInlinePreviewUrl(attachment: Attachment): Promise<string | undefined> {
    if (!threadId) return undefined;

    const MAX_INLINE_SIZE = 500 * 1024; // 500KB
    const cacheKey = `${threadId}:${attachment.id}`;
    // Check cache first
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
          // Store the blob URL in the cache map for reuse
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

  // Comment handlers
  function handleCommentClick() {
    // If already editing/adding, cancel (hide editor)
    if (isEditingComment || isAddingComment) {
      isEditingComment = false;
      isAddingComment = false;
      return;
    }

    if (hasComment) {
      // Edit existing comment
      isEditingComment = true;
      isAddingComment = false;
    } else {
      // Add new comment
      isAddingComment = true;
      isEditingComment = false;
    }
  }

  async function handleCommentSave(commentText: string) {
    if (!threadId || !message.id) return;

    try {
      const result = await threadService.updateMessageComment(threadId, message.id, commentText);
      if (result.success) {
        isEditingComment = false;
        isAddingComment = false;
      } else {
        console.error('Failed to save comment:', result.error);
      }
    } catch (error) {
      console.error('Error saving comment:', error);
    }
  }

  async function handleCommentDelete() {
    if (!threadId || !message.id) return;

    try {
      const result = await threadService.updateMessageComment(threadId, message.id, null);
      if (result.success) {
        isEditingComment = false;
        isAddingComment = false;
      } else {
        console.error('Failed to delete comment:', result.error);
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  }

  function handleCommentCancel() {
    isEditingComment = false;
    isAddingComment = false;
  }

  // Cleanup blob URLs when component is destroyed to prevent memory leaks
  function cleanupInlinePreviewUrls() {
    inlinePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    inlinePreviewUrls.clear();
  }

  onDestroy(() => {
    cleanupInlinePreviewUrls();
  });
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
        <button
          class="save-button"
          onclick={handleSaveEdit}
          disabled={!editedContent.trim() || isStreaming}
        >
          {isStreaming ? 'Sending...' : 'Save & Regenerate'}
        </button>
        <button class="cancel-button" onclick={handleCancelEdit} disabled={isStreaming}>
          Cancel
        </button>
        <span class="edit-hint">⌘+Enter to save, Esc to cancel</span>
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
    <div class="message-actions">
      {#if message.status !== MESSAGE_STATUS.SENDING}
        {#if message.role === 'user'}
          <!-- Copy to input for user messages -->
          <button
            class="action-button"
            type="button"
            onclick={handleCopyToInput}
            aria-label="Copy to input"
            title="Copy to input"
          >
            ↵
          </button>
        {:else}
          <!-- Copy dropdown for assistant messages -->
          <div class="copy-dropdown">
            <button
              class="copy-button"
              type="button"
              onclick={handleCopyToClipboard}
              aria-label="Copy response"
              title="Copy as {copyFormat}"
            >
              📋
            </button>
            <button
              class="copy-menu-btn"
              type="button"
              onclick={() => (showCopyMenu = !showCopyMenu)}
              aria-label="Copy format options"
              title="Copy options"
            >
              ▾
            </button>
            {#if showCopyMenu}
              <div class="copy-menu">
                <button onclick={() => handleCopyAs('text')}>
                  {copyFormat === 'text' ? '✓ ' : ''}Copy as Text
                </button>
                <button onclick={() => handleCopyAs('markdown')}>
                  {copyFormat === 'markdown' ? '✓ ' : ''}Copy as Markdown
                </button>
              </div>
            {/if}
          </div>
        {/if}
      {/if}
      {#if message.role === 'user' && onEdit && message.status !== MESSAGE_STATUS.SENDING}
        <button
          class="action-button"
          onclick={handleEdit}
          aria-label="Edit message"
          title="Edit message"
        >
          ✎
        </button>
      {/if}
      {#if message.role === 'user' && onCreateVariation && message.status !== MESSAGE_STATUS.SENDING}
        <VariationButton
          {message}
          onclick={() => onCreateVariation?.(message.id)}
          disabled={isStreaming}
          canCreate={canCreateVariationForMessage()}
        />
      {/if}
      {#if message.isEdited}
        <button
          class="action-button"
          onclick={handleShowVersions}
          aria-label="View edit history"
          title="View edit history"
        >
          📜
        </button>
      {/if}
      {#if message.status === MESSAGE_STATUS.FAILED && onRetry}
        <button class="retry-button" onclick={handleRetry} aria-label="Retry sending message">
          Retry
        </button>
      {/if}
      {#if message.role === 'assistant'}
        <CommentBubbleIcon {comment} onclick={handleCommentClick} />
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
  {#if isEditingComment && comment}
    <CommentEditor
      initialValue={comment.content}
      onsave={handleCommentSave}
      oncancel={handleCommentCancel}
      ondelete={handleCommentDelete}
    />
  {:else if isAddingComment}
    <CommentEditor
      placeholder="Enter your comment about this response..."
      onsave={handleCommentSave}
      oncancel={handleCommentCancel}
    />
  {:else if showComments && hasComment && comment}
    <CommentDisplay {comment} onedit={handleCommentClick} ondelete={handleCommentDelete} />
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

  .message.user {
    display: flex;
    justify-content: flex-end;
    flex-direction: column;
    align-items: end;
  }

  .message.user .message-content {
    background: var(--surface-card);
    padding: 0.5rem;
    border-radius: 6px;
    text-align: left;
    max-width: 80%;
  }

  .message.assistant .message-content {
    background: transparent;
    padding: 0.5rem;
    border-radius: 6px;
    text-align: left;
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
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .message.user .message-actions {
    left: 0.5rem;
    right: auto;
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
    transition:
      background 0.2s ease,
      border-color 0.2s ease;
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
    gap: 0.5rem;
    margin-top: 0.25rem;
    position: relative;
  }

  .message.user .message-footer {
    justify-content: flex-end;
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

  .copy-dropdown {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .copy-menu-btn {
    background: transparent;
    border: none;
    padding: 0 4px;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 10px;
  }

  .copy-menu-btn:hover {
    color: var(--text-primary);
  }

  .copy-menu {
    position: absolute;
    top: 100%;
    right: 0;
    background: var(--surface-main);
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10;
    min-width: 140px;
    overflow: hidden;
  }

  .copy-menu button {
    display: block;
    width: 100%;
    padding: 8px 12px;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .copy-menu button:hover {
    background: var(--surface-hover);
  }
</style>

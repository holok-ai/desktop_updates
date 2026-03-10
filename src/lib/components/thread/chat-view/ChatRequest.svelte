<script lang="ts">
  /**
   * ChatRequest — displays a user prompt with attachments and click-cycle info.
   * Represents the "request" half of a ChatMessage pair.
   */
  import ChatRequestInformation from './ChatRequestInformation.svelte';
  import RedactedText from './RedactedText.svelte';
  import type { ChatLayout } from '$lib/types/app.type';
  import type { AttachmentDisplay } from '$lib/types/artifact-display.type';

  interface Props {
    content: string;
    createdAt: number;
    modelId?: string | null;
    userName?: string;
    chatLayout: ChatLayout;
    /** Attachment data with Document Mode eligibility */
    attachments?: AttachmentDisplay[];
    /** Font size in pixels from settings */
    fontSize?: number;
    /** Current branch ID for this request */
    branchId?: string;
    /** Guard execution status for this request */
    guardStatus?: 'none' | 'pass' | 'fail' | 'fail-context';
    /** Guard error reason when guardStatus is 'fail' or 'fail-context' */
    guardError?: string;
    /** Callback when Document Mode badge is clicked */
    onActivateDocumentMode?: (attachment: AttachmentDisplay) => void;
  }

  let {
    content,
    createdAt,
    modelId = null,
    userName = 'You',
    chatLayout,
    attachments = [],
    fontSize = 14,
    branchId: _branchId,
    guardStatus = 'none',
    guardError = '',
    onActivateDocumentMode,
  }: Props = $props();

  let alignClass = $derived.by(() => {
    switch (chatLayout) {
      case 'right-left':
        return 'align-right';
      case 'left-left':
      case 'left-right':
      default:
        return 'align-left';
    }
  });
</script>

<div class="chat-request {alignClass}">
  <div class="request-bubble">
    {#if guardStatus === 'fail'}
      <RedactedText {content} {guardError} {fontSize} />
    {:else}
      <div class="prompt-text" style="font-size: {fontSize}px">{content}</div>
    {/if}

    {#if attachments.length > 0}
      <div class="attachments" role="list" aria-label="Attachments">
        {#each attachments as att}
          <span class="attachment-chip" role="listitem">
            <i class="pi pi-paperclip"></i>
            {att.filename}
          </span>
          {#if att.isDocumentEligible}
            <button
              class="doc-mode-badge"
              title="Activate Document Mode"
              onclick={() => onActivateDocumentMode?.(att)}
            >
              <i class="pi pi-pencil"></i>
              <span>Document Mode</span>
            </button>
          {/if}
        {/each}
      </div>
    {/if}

    <div class="request-meta">
      <ChatRequestInformation {createdAt} {modelId} {userName} />
    </div>
  </div>
</div>

<style>
  .chat-request {
    display: flex;
    max-width: 80%;
  }

  .chat-request.align-left {
    align-self: flex-start;
  }

  .chat-request.align-right {
    align-self: flex-end;
  }

  .chat-request.indent {
    margin-left: 2rem;
  }

  .request-bubble {
    background: color-mix(in srgb, var(--primary-color, #646cff) 10%, var(--surface-card, #fff));
    border: 1px solid color-mix(in srgb, var(--primary-color, #646cff) 20%, transparent);
    border-radius: 12px 12px 12px 2px;
    padding: 0.625rem 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .align-right .request-bubble {
    border-radius: 12px 12px 2px 12px;
  }

  .prompt-text {
    line-height: 1.5;
    color: var(--text-primary, #111);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .attachment-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.5rem;
    font-size: 0.75rem;
    background: color-mix(in srgb, var(--text-secondary, #666) 8%, transparent);
    border-radius: 6px;
    color: var(--text-secondary, #666);
  }

  .attachment-chip i {
    font-size: 0.7rem;
  }

  .doc-mode-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.5rem;
    font-size: 0.7rem;
    background: color-mix(in srgb, var(--primary-color, #646cff) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--primary-color, #646cff) 25%, transparent);
    border-radius: 6px;
    color: var(--primary-color, #646cff);
    cursor: pointer;
    transition: background 0.15s;
  }

  .doc-mode-badge:hover {
    background: color-mix(in srgb, var(--primary-color, #646cff) 20%, transparent);
  }

  .doc-mode-badge i {
    font-size: 0.6rem;
  }

  .request-meta {
    display: flex;
    justify-content: flex-end;
  }
</style>

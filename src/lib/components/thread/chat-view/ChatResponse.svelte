<script lang="ts">
  /**
   * ChatResponse — displays an assistant response with markdown rendering.
   * Includes ResponseText (MarkdownRenderer), ToolDetails, and Files sections.
   */
  import MarkdownRenderer from '$lib/components/MarkdownRenderer.svelte';
  import ToolCallDetails from './ToolCallDetails.svelte';
  import type { ChatLayout } from '$lib/types/app.type';
  import type { ToolCall } from '$lib/types/tool-call.type';

  interface Props {
    content: string;
    chatLayout: ChatLayout;
    /** Whether this response is still being streamed */
    isStreaming?: boolean;
    /** Tool calls during/after this response */
    tools?: ToolCall[];
    /** File outputs from the response */
    files?: string[];
    /** Font size in pixels from settings */
    fontSize?: number;
    /** Guard execution status for the request that produced this response */
    guardStatus?: 'none' | 'pass' | 'fail' | 'fail-context';
    /** Guard error reason when guardStatus is 'fail' or 'fail-context' */
    guardError?: string;
  }

  let {
    content,
    chatLayout,
    isStreaming = false,
    tools = [],
    files = [],
    fontSize = 14,
    guardStatus = 'none',
    guardError = '',
  }: Props = $props();

  let toolsExpanded = $state(false);
  let guardExpanded = $state(false);

  let alignClass = $derived.by(() => {
    switch (chatLayout) {
      case 'right-left':
        return 'align-left';
      case 'left-left':
        return 'align-left indent';
      case 'left-right':
      default:
        return 'align-right';
    }
  });
</script>

<div class="chat-response {alignClass}">
  <div class="response-bubble">
    {#if content}
      <div class="response-text" style="font-size: {fontSize}px">
        <MarkdownRenderer {content} {fontSize} enableCopy={true} />
      </div>
    {/if}

    {#if isStreaming && !content}
      <div class="streaming-indicator">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    {/if}

    {#if isStreaming && tools.length > 0}
      <ToolCallDetails {tools} />
    {/if}

    {#if !isStreaming && (guardStatus !== 'none' || tools.length > 0)}
      {#if toolsExpanded && tools.length > 0}
        <ToolCallDetails {tools} />
      {/if}
      {#if guardExpanded && (guardStatus === 'fail' || guardStatus === 'fail-context') && guardError}
        <div class="guard-error-detail">
          <span class="guard-error-text">{guardError}</span>
        </div>
      {/if}
      <div class="tools-chip-row">
        {#if guardStatus === 'pass'}
          <span class="guard-chip guard-pass">
            <i class="pi pi-shield"></i>
            <span>Guard: Pass</span>
          </span>
        {:else if guardStatus === 'fail' || guardStatus === 'fail-context'}
          <button
            class="guard-chip guard-fail"
            title={guardError || 'Guard failed'}
            onclick={() => (guardExpanded = !guardExpanded)}
          >
            <i class="pi pi-shield"></i>
            <span>Guard: Fail</span>
            <i class="pi {guardExpanded ? 'pi-chevron-up' : 'pi-chevron-down'} chevron-icon"></i>
          </button>
        {/if}
        {#if tools.length > 0}
          <button class="tools-chip" onclick={() => (toolsExpanded = !toolsExpanded)}>
            <i class="pi pi-cog"></i>
            <span>{tools.length} call{tools.length !== 1 ? 's' : ''}</span>
            <i class="pi {toolsExpanded ? 'pi-chevron-up' : 'pi-chevron-down'} chevron-icon"></i>
          </button>
        {/if}
      </div>
    {/if}

    {#if files.length > 0}
      <div class="file-outputs" role="list" aria-label="Output files">
        {#each files as fname}
          <span class="file-chip" role="listitem">
            <i class="pi pi-file"></i>
            {fname}
          </span>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .chat-response {
    display: flex;
    max-width: 85%;
  }

  .chat-response.align-left {
    align-self: flex-start;
  }

  .chat-response.align-right {
    align-self: flex-end;
  }

  .chat-response.indent {
    margin-left: 2rem;
  }

  .response-bubble {
    background: var(--surface-card, #fff);
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 12px 12px 12px 2px;
    padding: 0.625rem 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 40px;
  }

  .align-right .response-bubble {
    border-radius: 12px 12px 2px 12px;
  }

  .response-text {
    line-height: 1.5;
    color: var(--text-primary, #111);
  }

  /* Streaming dots animation */
  .streaming-indicator {
    display: flex;
    gap: 0.3rem;
    padding: 0.25rem 0;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-secondary, #666);
    animation: bounce 1.2s infinite ease-in-out;
  }

  .dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes bounce {
    0%,
    80%,
    100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    40% {
      transform: translateY(-4px);
      opacity: 1;
    }
  }

  /* Tools chip (shown after streaming completes) */
  .tools-chip-row {
    display: flex;
    gap: 0.375rem;
  }

  .tools-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.55rem;
    font-size: 0.72rem;
    background: color-mix(in srgb, var(--text-secondary, #666) 8%, transparent);
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 6px;
    color: var(--text-secondary, #666);
    cursor: pointer;
    transition: background 0.15s;
  }

  .tools-chip:hover {
    background: color-mix(in srgb, var(--text-secondary, #666) 14%, transparent);
  }

  .tools-chip i {
    font-size: 0.65rem;
  }

  .chevron-icon {
    opacity: 0.6;
  }

  /* Guard status chip */
  .guard-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.55rem;
    font-size: 0.72rem;
    border-radius: 6px;
    border: 1px solid;
  }

  .guard-chip i {
    font-size: 0.65rem;
  }

  .guard-pass {
    background: color-mix(in srgb, rgb(34, 197, 94) 10%, transparent);
    border-color: color-mix(in srgb, rgb(34, 197, 94) 30%, transparent);
    color: rgb(22, 163, 74);
  }

  .guard-fail {
    background: color-mix(in srgb, rgb(239, 68, 68) 10%, transparent);
    border-color: color-mix(in srgb, rgb(239, 68, 68) 30%, transparent);
    color: rgb(220, 38, 38);
    cursor: pointer;
    transition: background 0.15s;
  }

  .guard-fail:hover {
    background: color-mix(in srgb, rgb(239, 68, 68) 18%, transparent);
  }

  /* Guard error detail (expandable) */
  .guard-error-detail {
    padding: 0.4rem 0.6rem;
    font-size: 0.75rem;
    line-height: 1.4;
    background: color-mix(in srgb, rgb(239, 68, 68) 6%, transparent);
    border: 1px solid color-mix(in srgb, rgb(239, 68, 68) 20%, transparent);
    border-radius: 6px;
    color: rgb(220, 38, 38);
  }

  .guard-error-text {
    word-break: break-word;
  }

  /* File outputs */
  .file-outputs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    padding-top: 0.25rem;
    border-top: 1px solid var(--surface-border, #e0e0e0);
  }

  .file-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.5rem;
    font-size: 0.75rem;
    background: color-mix(in srgb, var(--text-secondary, #666) 8%, transparent);
    border-radius: 6px;
    color: var(--text-secondary, #666);
  }

  .file-chip i {
    font-size: 0.7rem;
  }
</style>

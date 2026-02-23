<script lang="ts">
  /**
   * ChatResponse — displays an assistant response with markdown rendering.
   * Includes ResponseText (MarkdownRenderer), ToolDetails, and Files sections.
   */
  import MarkdownRenderer from '$lib/components/MarkdownRenderer.svelte';
  import type { ChatLayout } from '$lib/types/app.type';

  interface Props {
    content: string;
    chatLayout: ChatLayout;
    /** Whether this response is still being streamed */
    isStreaming?: boolean;
    /** Tool usage details (name → status) */
    tools?: Array<{ name: string; status: string }>;
    /** File outputs from the response */
    files?: string[];
    /** Font size in pixels from settings */
    fontSize?: number;
  }

  let {
    content,
    chatLayout,
    isStreaming = false,
    tools = [],
    files = [],
    fontSize = 14,
  }: Props = $props();

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

    {#if tools.length > 0}
      <div class="tool-details">
        {#each tools as tool}
          <div class="tool-item">
            <i class="pi pi-wrench"></i>
            <span class="tool-name">{tool.name}</span>
            <span class="tool-status" class:complete={tool.status === 'complete'}>
              {tool.status}
            </span>
          </div>
        {/each}
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

  /* Tool details */
  .tool-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-top: 0.25rem;
    border-top: 1px solid var(--surface-border, #e0e0e0);
    font-size: 0.75rem;
  }

  .tool-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: var(--text-secondary, #666);
  }

  .tool-item i {
    font-size: 0.7rem;
  }

  .tool-name {
    font-weight: 500;
  }

  .tool-status {
    margin-left: auto;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .tool-status.complete {
    color: #10b981;
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

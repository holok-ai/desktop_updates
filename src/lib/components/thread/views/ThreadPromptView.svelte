<script lang="ts">
  /**
   * ThreadPromptView — read-only prompt-centric view of a thread.
   *
   * Shows ChatRequests (user prompts) with progressive response reveal:
   *   Ctrl+Down cycles:  hidden → 1 line → 3 lines → full → hidden
   *   Ctrl+Up cycles backwards.
   *
   * No composer. No streaming. Follows chatLayout alignment.
   */
  import { onMount } from 'svelte';
  import ChatRequest from '../ChatRequest.svelte';
  import MarkdownRenderer from '$lib/components/MarkdownRenderer.svelte';
  import type { Message } from '$lib/types/thread.type';
  import type { ChatLayout } from '$lib/types/app.type';
  import { threadService, type DisplayItem } from '$lib/services/thread.service';

  /** Response reveal levels */
  const REVEAL_HIDDEN = 0;
  const REVEAL_ONE_LINE = 1;
  const REVEAL_THREE_LINES = 2;
  const REVEAL_FULL = 3;
  const REVEAL_LEVEL_COUNT = 4;

  interface Props {
    messages: Message[];
    chatLayout: ChatLayout;
  }

  let { messages = [], chatLayout }: Props = $props();

  // ── State ──
  let fontSize = $state(14); // Font size from settings

  // Load font size from settings
  onMount(async () => {
    try {
      const settings = await window.electronAPI.settings.getAll();
      fontSize = settings.chatFontSize ?? 14;
    } catch (err) {
      console.error('[ThreadPromptView] Failed to load font size setting:', err);
    }
  });

  // ── Build display items using thread service ──
  let displayItems = $derived.by(() => {
    return threadService.buildDisplayItems(messages, false, '');
  });

  // ── Per-pair reveal level tracking ──
  // Map from request message id → reveal level (0..3)
  let revealLevels = $state<Record<string, number>>({});

  function getRevealLevel(requestId: string): number {
    return revealLevels[requestId] ?? REVEAL_HIDDEN;
  }

  /** Advance all pairs' reveal level by +1 (with wrap) */
  function cycleAllForward() {
    const updated: Record<string, number> = {};
    for (const item of displayItems) {
      if (item.type === 'message') {
        if (item.pair.response) {
          const current = getRevealLevel(item.pair.request.id);
          updated[item.pair.request.id] = (current + 1) % REVEAL_LEVEL_COUNT;
        }
      } else {
        // Handle branch - cycle all lanes
        for (const lane of item.lanes) {
          for (const pair of lane.messagePairs) {
            if (pair.response) {
              const current = getRevealLevel(pair.request.id);
              updated[pair.request.id] = (current + 1) % REVEAL_LEVEL_COUNT;
            }
          }
        }
      }
    }
    revealLevels = { ...revealLevels, ...updated };
  }

  /** Retreat all pairs' reveal level by -1 (with wrap) */
  function cycleAllBackward() {
    const updated: Record<string, number> = {};
    for (const item of displayItems) {
      if (item.type === 'message') {
        if (item.pair.response) {
          const current = getRevealLevel(item.pair.request.id);
          updated[item.pair.request.id] = (current - 1 + REVEAL_LEVEL_COUNT) % REVEAL_LEVEL_COUNT;
        }
      } else {
        // Handle branch - cycle all lanes
        for (const lane of item.lanes) {
          for (const pair of lane.messagePairs) {
            if (pair.response) {
              const current = getRevealLevel(pair.request.id);
              updated[pair.request.id] = (current - 1 + REVEAL_LEVEL_COUNT) % REVEAL_LEVEL_COUNT;
            }
          }
        }
      }
    }
    revealLevels = { ...revealLevels, ...updated };
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.ctrlKey && e.key === 'ArrowDown') {
      e.preventDefault();
      cycleAllForward();
    } else if (e.ctrlKey && e.key === 'ArrowUp') {
      e.preventDefault();
      cycleAllBackward();
    }
  }

  // ── Response text helpers ──
  /** Get the first N lines from a string */
  function firstNLines(text: string, n: number): string {
    const lines = text.split('\n');
    if (lines.length <= n) return text;
    return lines.slice(0, n).join('\n');
  }

  /** Strip HTML and markdown formatting from text */
  function stripFormatting(text: string): string {
    let cleaned = text;

    // Remove HTML tags
    cleaned = cleaned.replace(/<[^>]*>/g, '');

    // Remove markdown code blocks
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');

    // Remove inline code
    cleaned = cleaned.replace(/`[^`]+`/g, '');

    // Remove markdown images
    cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

    // Remove markdown links
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Remove markdown bold
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/__([^_]+)__/g, '$1');

    // Remove markdown italic
    cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
    cleaned = cleaned.replace(/_([^_]+)_/g, '$1');

    // Remove markdown headers
    cleaned = cleaned.replace(/^#+\s+/gm, '');

    // Remove list markers
    cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, '');
    cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, '');

    // Remove blockquote markers
    cleaned = cleaned.replace(/^>\s+/gm, '');

    // Collapse multiple whitespace (including newlines) to single space
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Trim leading/trailing whitespace
    cleaned = cleaned.trim();

    return cleaned;
  }

  /** Get the visible response content based on reveal level */
  function getVisibleResponse(content: string, level: number): string {
    switch (level) {
      case REVEAL_ONE_LINE:
        const stripped = stripFormatting(content);
        return stripped.substring(0, 100);
      case REVEAL_THREE_LINES:
        return firstNLines(content, 3);
      case REVEAL_FULL:
        return content;
      default:
        return '';
    }
  }

  /** Check if response content is truncated at given level */
  function isTruncated(content: string, level: number): boolean {
    if (level === REVEAL_FULL || level === REVEAL_HIDDEN) return false;
    if (level === REVEAL_ONE_LINE) return content.length > 100;
    const lineCount = content.split('\n').length;
    if (level === REVEAL_THREE_LINES) return lineCount > 3;
    return false;
  }

  // ── Response alignment (mirrors ChatResponse) ──
  function responseAlignClass(layout: ChatLayout): string {
    switch (layout) {
      case 'right-left':
        return 'align-left';
      case 'left-left':
        return 'align-left indent';
      case 'left-right':
      default:
        return 'align-right';
    }
  }

  /** Reveal level label for the indicator badge */
  function revealLabel(level: number): string {
    switch (level) {
      case REVEAL_ONE_LINE: return '1 line';
      case REVEAL_THREE_LINES: return '3 lines';
      case REVEAL_FULL: return 'full';
      default: return '';
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="thread-prompt-view">
  {#if displayItems.length === 0}
    <div class="empty-state">
      <i class="pi pi-pencil"></i>
      <p>No prompts in this thread yet.</p>
    </div>
  {:else}
    <div class="prompt-list">
      {#each displayItems as item (item.type === 'message' ? item.pair.request.id : item.id)}
        {#if item.type === 'message'}
          {@const pair = item.pair}
        <div class="prompt-entry">
          <!-- User prompt -->
          <ChatRequest
            content={pair.request.content}
            createdAt={pair.request.createdAt}
            modelId={pair.request.modelId}
            {chatLayout}
            {fontSize}
          />

          <!-- Response preview (progressive reveal) -->
          {#if pair.response && getRevealLevel(pair.request.id) > REVEAL_HIDDEN}
            {@const level = getRevealLevel(pair.request.id)}
            {@const visibleContent = getVisibleResponse(pair.response.content, level)}
            {@const truncated = isTruncated(pair.response.content, level)}

            <div class="response-preview {responseAlignClass(chatLayout)}">
              <div class="preview-bubble" class:one-line={level === REVEAL_ONE_LINE}>
                {#if level === REVEAL_ONE_LINE}
                  <div class="preview-text plain-text" style="font-size: {fontSize}px">
                    {visibleContent}
                  </div>
                {:else}
                  <div class="preview-text">
                    <MarkdownRenderer content={visibleContent} {fontSize} enableCopy={false} />
                  </div>
                {/if}
                {#if truncated}
                  <div class="truncation-fade"></div>
                {/if}
<!--                 <span class="reveal-badge">{revealLabel(level)}</span>  -->
              </div>
            </div>
          {/if}
        </div>
        {:else}
          <!-- Branch display - show all lanes -->
          <div class="branch-entry">
            <div class="branch-header">Branch with {item.lanes.length} lanes</div>
            <div class="branch-lanes">
              {#each item.lanes as lane (lane.id)}
                <div class="branch-lane">
                  <div class="lane-header">
                    {#if lane.modelName}
                      <span class="lane-model">{lane.modelName}</span>
                    {/if}
                  </div>
                  {#each lane.messagePairs as pair (pair.request.id)}
                    <div class="prompt-entry">
                      <ChatRequest
                        content={pair.request.content}
                        createdAt={pair.request.createdAt}
                        modelId={pair.request.modelId}
                        {chatLayout}
                        {fontSize}
                      />
                      {#if pair.response && getRevealLevel(pair.request.id) > REVEAL_HIDDEN}
                        {@const level = getRevealLevel(pair.request.id)}
                        {@const visibleContent = getVisibleResponse(pair.response.content, level)}
                        {@const truncated = isTruncated(pair.response.content, level)}
                        <div class="response-preview {responseAlignClass(chatLayout)}">
                          <div class="preview-bubble" class:one-line={level === REVEAL_ONE_LINE}>
                            {#if level === REVEAL_ONE_LINE}
                              <div class="preview-text plain-text" style="font-size: {fontSize}px">
                                {visibleContent}
                              </div>
                            {:else}
                              <div class="preview-text markdown-text">
                                <MarkdownRenderer content={visibleContent} {fontSize} enableCopy={false} />
                              </div>
                            {/if}
                            {#if truncated}
                              <div class="truncation-fade"></div>
                            {/if}
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>

    <!-- Keyboard hint at bottom -->
    <div class="keyboard-hint">
      <kbd>Ctrl</kbd> + <kbd>&darr;</kbd> reveal response
      &nbsp;&middot;&nbsp;
      <kbd>Ctrl</kbd> + <kbd>&uarr;</kbd> hide response
    </div>
  {/if}
</div>

<style>
  .thread-prompt-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--text-secondary, #666);
    gap: 0.75rem;
    padding: 2rem;
  }

  .empty-state i {
    font-size: 2.5rem;
    opacity: 0.4;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.9rem;
  }

  .prompt-list {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .prompt-entry {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  /* Response preview (mirrors ChatResponse alignment) */
  .response-preview {
    display: flex;
    max-width: 85%;
    position: relative;
  }

  .response-preview.align-left {
    align-self: flex-start;
  }

  .response-preview.align-right {
    align-self: flex-end;
  }

  .response-preview.indent {
    margin-left: 2rem;
  }

  .preview-bubble {
    background: var(--surface-card, #fff);
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 12px 12px 12px 2px;
    padding: 0.625rem 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 40px;
    position: relative;
    overflow: hidden;
  }

  .preview-bubble.one-line {
    overflow: visible;
  }

  .align-right .preview-bubble {
    border-radius: 12px 12px 2px 12px;
  }

  .preview-text {
    line-height: 1.5;
    color: var(--text-primary, #111);
  }

  .preview-text.plain-text {
    white-space: pre-wrap;
    word-break: break-word;
    color: #000;
    padding-top: 0.5rem;
  }

  /* Fade overlay when truncated */
  .truncation-fade {
    position: absolute;
    bottom: 24px;
    left: 0;
    right: 0;
    height: 2rem;
    background: linear-gradient(transparent, var(--surface-card, #fff));
    pointer-events: none;
  }

  .reveal-badge {
    align-self: flex-end;
    font-size: 0.65rem;
    color: var(--text-secondary, #666);
    background: color-mix(in srgb, var(--text-secondary, #666) 10%, transparent);
    padding: 0.1rem 0.4rem;
    border-radius: 8px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    flex-shrink: 0;
  }

  /* Keyboard hint footer */
  .keyboard-hint {
    flex-shrink: 0;
    padding: 0.5rem 1rem;
    text-align: center;
    font-size: 0.7rem;
    color: var(--text-secondary, #666);
    border-top: 1px solid var(--surface-border, #e0e0e0);
    background: var(--surface-card, #fff);
  }

  .keyboard-hint kbd {
    display: inline-block;
    padding: 0.05rem 0.35rem;
    font-size: 0.65rem;
    font-family: inherit;
    background: var(--surface-hover, #f0f0f0);
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 3px;
    box-shadow: 0 1px 0 var(--surface-border, #e0e0e0);
  }

  /* Branch styles */
  .branch-entry {
    margin: 1rem 0;
    border: 2px solid var(--surface-border, #e0e0e0);
    border-radius: 8px;
    background: var(--surface-main, #fff);
  }

  .branch-header {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary, #666);
    border-bottom: 1px solid var(--surface-border, #e0e0e0);
    background: var(--surface-card, #fafafa);
  }

  .branch-lanes {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    overflow-x: auto;
  }

  .branch-lane {
    flex: 1;
    min-width: 300px;
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 6px;
    background: var(--surface-main, #fff);
    padding: 0.5rem;
  }

  .lane-header {
    padding: 0.375rem 0.5rem;
    margin-bottom: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-secondary, #666);
    border-bottom: 1px solid var(--surface-border, #e0e0e0);
  }

  .lane-model {
    font-weight: 500;
  }
</style>

<script lang="ts">
  /**
   * RedactedText — displays a "Message blocked by guard" placeholder that
   * expands on click to reveal the original text and the guard's reason.
   * Includes a copy button so the user can grab the text, edit it, and retry.
   */

  interface Props {
    /** The original user prompt that was blocked */
    content: string;
    /** Guard error reason/message */
    guardError: string;
    /** Font size in pixels from settings */
    fontSize?: number;
  }

  let { content, guardError, fontSize = 14 }: Props = $props();

  let expanded = $state(false);
  let copied = $state(false);

  function toggle() {
    expanded = !expanded;
  }

  function copyText(e: MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }
</script>

<div
  class="redacted"
  class:expanded
  role="button"
  tabindex="0"
  onclick={toggle}
  onkeydown={(e) => e.key === 'Enter' && toggle()}
>
  <div class="redacted-header">
    <i class="pi pi-shield"></i>
    <span class="redacted-label">Message blocked by guard</span>
    <!-- <i class="pi pi-chevron-{expanded ? 'up' : 'down'} chevron"></i> -->
  </div>

  {#if expanded}
    <div class="redacted-body">
      <div class="guard-reason">
        <i class="pi pi-exclamation-triangle"></i>
        <span>{guardError}</span>
      </div>

      <div class="original-text-container">
        <div class="original-text-header">
          <span class="original-text-label">Original message</span>
          <button
            class="copy-btn"
            onclick={copyText}
            title="Copy to clipboard"
            aria-label="Copy original text"
          >
            <i class="pi pi-{copied ? 'check' : 'copy'}"></i>
          </button>
        </div>
        <div class="original-text" style="font-size: {fontSize}px">{content}</div>
      </div>
    </div>
  {/if}
</div>

<style>
  .redacted {
    cursor: pointer;
    border-radius: 8px;
    background: color-mix(in srgb, var(--text-secondary, #666) 6%, transparent);
    border: 1px solid color-mix(in srgb, var(--text-secondary, #666) 12%, transparent);
    padding: 0.5rem 0.75rem;
    transition: background 0.15s ease;
    user-select: none;
  }

  .redacted:hover {
    background: color-mix(in srgb, var(--text-secondary, #666) 10%, transparent);
  }

  .redacted-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary, #666);
    font-size: 0.85rem;
  }

  .redacted-header .pi-shield {
    font-size: 0.8rem;
  }

  .redacted-label {
    flex: 1;
  }

  .redacted-body {
    margin-top: 0.625rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    user-select: text;
  }

  .guard-reason {
    display: flex;
    align-items: flex-start;
    gap: 0.375rem;
    font-size: 0.8rem;
    color: var(--error-color, #e74c3c);
    line-height: 1.4;
  }

  .guard-reason .pi-exclamation-triangle {
    font-size: 0.75rem;
    margin-top: 0.15rem;
    flex-shrink: 0;
  }

  .original-text-container {
    border-radius: 6px;
    background: color-mix(in srgb, var(--text-secondary, #666) 5%, transparent);
    border: 1px solid color-mix(in srgb, var(--text-secondary, #666) 10%, transparent);
    overflow: hidden;
  }

  .original-text-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.25rem 0.5rem;
    border-bottom: 1px solid color-mix(in srgb, var(--text-secondary, #666) 8%, transparent);
  }

  .original-text-label {
    font-size: 0.7rem;
    color: var(--text-secondary, #666);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .copy-btn {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.2rem;
    border-radius: 4px;
    color: var(--text-secondary, #666);
    font-size: 0.75rem;
    transition:
      color 0.15s ease,
      background 0.15s ease;
  }

  .copy-btn:hover {
    color: var(--text-primary, #111);
    background: color-mix(in srgb, var(--text-secondary, #666) 10%, transparent);
  }

  .original-text {
    padding: 0.5rem;
    line-height: 1.5;
    color: var(--text-primary, #111);
    white-space: pre-wrap;
    word-break: break-word;
    opacity: 0.7;
  }
</style>

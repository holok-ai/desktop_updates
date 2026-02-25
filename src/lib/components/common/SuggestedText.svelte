<script lang="ts">
  /**
   * SuggestedText — EditableText with an optional AI-suggested value.
   *
   * Renders exactly like EditableText until `suggestedText` is set, at which
   * point a compact suggestion strip appears below with keep / discard actions.
   * Keeping calls `onChange` with the suggestion and then `onKeep`; discarding
   * calls `onDiscard` so the parent can clean up the backing store entry.
   *
   * @prop value        — Current text value (bindable).
   * @prop suggestedText — AI-generated suggestion. Strip appears when set.
   * @prop tag          — HTML element forwarded to EditableText.
   * @prop class        — CSS class forwarded to EditableText.
   * @prop placeholder  — Forwarded to EditableText.
   * @prop readonly     — Forwarded to EditableText.
   * @prop onChange     — Called when value is committed (manual edit or keep).
   * @prop onKeep       — Called after the user accepts the suggestion.
   * @prop onDiscard    — Called after the user discards the suggestion.
   * @prop autoAcceptMs — Auto-accept after this many ms (0 = disabled).
   */

  import EditableText from './EditableText.svelte';

  interface Props {
    value: string;
    suggestedText?: string | null;
    tag?: string;
    class?: string;
    placeholder?: string;
    readonly?: boolean;
    onChange?: (value: string) => void;
    onDiscard?: () => void;
    autoAcceptMs?: number;
  }

  let {
    value = $bindable(''),
    suggestedText = null,
    tag = 'div',
    class: className = '',
    placeholder = '',
    readonly = false,
    onChange,
    onDiscard,
    autoAcceptMs = 0,
  }: Props = $props();

  let timeRemaining = $state(0);
  let timerId: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    if (suggestedText && autoAcceptMs > 0) {
      timeRemaining = Math.ceil(autoAcceptMs / 1000);
      timerId = setInterval(() => {
        timeRemaining -= 1;
        if (timeRemaining <= 0) {
          clearTimer();
          handleKeep();
        }
      }, 1000);
    }
    return () => clearTimer();
  });

  function clearTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function handleKeep() {
    if (!suggestedText) return;
    clearTimer();
    value = suggestedText;
    onChange?.(suggestedText);
  }

  function handleDiscard() {
    clearTimer();
    onDiscard?.();
  }
</script>

<div class="suggested-text-wrapper">
  {#if !suggestedText}
    <EditableText bind:value {tag} class={className} {placeholder} {readonly} {onChange} />
  {/if}

  {#if suggestedText}
    <div class="suggested-text">
      <span class="suggestion-label">{suggestedText}</span>
      <div class="suggestion-actions">
        <button
          class="suggestion-btn keep"
          onclick={handleKeep}
          title="Keep this suggestion"
          aria-label="Keep suggestion"
        >
          keep{#if timeRemaining > 0}
            ({timeRemaining}s){/if}
        </button>
        <button
          class="suggestion-btn discard"
          onclick={handleDiscard}
          title="Discard this suggestion"
          aria-label="Discard suggestion"
        >
          discard
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .suggested-text-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .suggested-text {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    animation: fadeSlideIn 0.3s ease-out;
  }

  @keyframes fadeSlideIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .suggestion-label {
    font-size: 1rem;
    font-weight: 600;
    color: var(--primary-color, #646cff);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.4;
  }

  .suggestion-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .suggestion-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.1rem 0.4rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 8pt;
    font-weight: 400;
    font-style: italic;
    color: #111;
    line-height: 1.4;
    outline: 1px solid #9ca3af;
    transition:
      background 0.15s,
      filter 0.15s;
  }

  .suggestion-btn.keep {
    background: #a8d5b5;
    color: #111;
  }

  .suggestion-btn.keep:hover {
    filter: brightness(0.93);
  }

  .suggestion-btn.discard {
    background: #e0a8a8;
    color: #111;
  }

  .suggestion-btn.discard:hover {
    filter: brightness(0.93);
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    suggestion: string;
    onKeep: () => void;
    onDiscard: () => void;
    autoAcceptMs?: number;
  }

  let { suggestion, onKeep, onDiscard, autoAcceptMs = 0 }: Props = $props();

  let timeRemaining = $state(0);
  let timerId: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    if (autoAcceptMs > 0) {
      timeRemaining = Math.ceil(autoAcceptMs / 1000);
      timerId = setInterval(() => {
        timeRemaining -= 1;
        if (timeRemaining <= 0) {
          clearTimer();
          onKeep();
        }
      }, 1000);
    }

    return () => {
      clearTimer();
    };
  });

  function clearTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function handleKeep() {
    clearTimer();
    onKeep();
  }

  function handleDiscard() {
    clearTimer();
    onDiscard();
  }
</script>

<div class="suggested-text">
  <span class="suggestion-label">{suggestion}</span>
  <div class="suggestion-actions">
    <button
      class="suggestion-btn keep"
      onclick={handleKeep}
      title="Keep this suggestion"
      aria-label="Keep suggestion"
    >
      <i class="pi pi-check"></i>
    </button>
    <button
      class="suggestion-btn discard"
      onclick={handleDiscard}
      title="Discard this suggestion"
      aria-label="Discard suggestion"
    >
      <i class="pi pi-times"></i>
    </button>
    {#if timeRemaining > 0}
      <span class="auto-accept-countdown" title="Auto-accepting in {timeRemaining}s">
        {timeRemaining}s
      </span>
    {/if}
  </div>
</div>

<style>
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
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .suggestion-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;
  }

  .suggestion-btn.keep {
    color: #16a34a;
  }

  .suggestion-btn.keep:hover {
    background: color-mix(in srgb, #16a34a 15%, transparent);
  }

  .suggestion-btn.discard {
    color: var(--text-secondary, #666);
  }

  .suggestion-btn.discard:hover {
    background: var(--surface-hover, #f0f0f0);
    color: var(--text-primary, #111);
  }

  .auto-accept-countdown {
    font-size: 0.7rem;
    color: var(--text-secondary, #888);
    min-width: 2rem;
    text-align: center;
  }
</style>

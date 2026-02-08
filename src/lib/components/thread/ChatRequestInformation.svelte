<script lang="ts">
  /**
   * ChatRequestInformation — click-cycle through date, model, and user info.
   * Each click advances to the next piece of information.
   */

  interface Props {
    createdAt: number;
    modelId?: string | null;
    userName?: string;
  }

  let { createdAt, modelId = null, userName = 'You' }: Props = $props();

  // Cycle through 3 display modes: date only, model+date, user+model+date
  let modeIndex = $state(0);
  const MODE_COUNT = 3;

  function cycle() {
    modeIndex = (modeIndex + 1) % MODE_COUNT;
  }

  function formatDate(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  let displayText = $derived.by(() => {
    const dateStr = formatDate(createdAt);
    const modelStr = modelId || 'Unknown model';

    switch (modeIndex) {
      case 0:
        // Show only date-time
        return dateStr;
      case 1:
        // Show model + date-time
        return `${modelStr} ${dateStr}`;
      case 2:
        // Show user + model + date-time
        return `${userName} ${modelStr} ${dateStr}`;
      default:
        return dateStr;
    }
  });
</script>

<button class="info-badge" onclick={cycle} title="Click to cycle info">
  <span class="info-text">{displayText}</span>
</button>

<style>
  .info-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.15rem 0.5rem;
    border: none;
    background: color-mix(in srgb, var(--text-secondary, #666) 10%, transparent);
    border-radius: 10px;
    color: var(--text-secondary, #666);
    font-size: 0.7rem;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .info-badge:hover {
    background: color-mix(in srgb, var(--text-secondary, #666) 18%, transparent);
  }

  .info-badge:focus {
    outline: none;
  }

  .info-text {
    line-height: 1;
  }
</style>

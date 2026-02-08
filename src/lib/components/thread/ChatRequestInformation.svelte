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

  type InfoMode = 'date' | 'model' | 'user';
  const MODES: InfoMode[] = ['date', 'model', 'user'];

  let modeIndex = $state(0);
  let currentMode = $derived(MODES[modeIndex]);

  function cycle() {
    modeIndex = (modeIndex + 1) % MODES.length;
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
    switch (currentMode) {
      case 'date':
        return formatDate(createdAt);
      case 'model':
        return modelId || 'Unknown model';
      case 'user':
        return userName;
      default:
        return '';
    }
  });

  let displayIcon = $derived.by(() => {
    switch (currentMode) {
      case 'date':
        return 'pi-clock';
      case 'model':
        return 'pi-microchip-ai';
      case 'user':
        return 'pi-user';
      default:
        return 'pi-info-circle';
    }
  });
</script>

<button class="info-badge" onclick={cycle} title="Click to cycle info">
  <i class="pi {displayIcon}"></i>
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

  .info-badge i {
    font-size: 0.7rem;
  }

  .info-text {
    line-height: 1;
  }
</style>

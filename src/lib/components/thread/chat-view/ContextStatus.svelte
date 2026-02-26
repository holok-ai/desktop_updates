<script lang="ts">
  /**
   * ContextStatus — Thermometer-style context window usage indicator.
   *
   * Always rendered. When no context data is available it shows a subtle
   * empty bar that blends with the composer background.
   *
   * On hover: shows a tooltip panel with token details and a Compact Now button.
   */
  import { observerStore } from '$lib/observer/observer.store';

  interface Props {
    threadId: string | null;
    onCompactNow?: () => void;
    width?: number;
    height?: number;
  }

  let { threadId, onCompactNow, width = 160, height = 10 }: Props = $props();

  // Reactive context status — subscribe directly to observerStore so $derived
  // picks up every setContextStatus() call without an intermediate derived layer.
  const status = $derived(
    threadId != null ? $observerStore.contextStatus.get(threadId) : undefined,
  );

  let isHovered = $state(false);

  // ── Computed display values ──

  function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  function formatPercent(ratio: number): string {
    return `${Math.round(ratio * 100)}%`;
  }

  /**
   * Interpolate between two hex colors based on a 0-1 ratio.
   * Simple linear RGB interpolation.
   */
  function interpolateColor(hex1: string, hex2: string, t: number): string {
    const parse = (h: string) => [
      parseInt(h.slice(1, 3), 16),
      parseInt(h.slice(3, 5), 16),
      parseInt(h.slice(5, 7), 16),
    ];
    const c1 = parse(hex1);
    const c2 = parse(hex2);
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  const GREEN = '#22c55e';
  const AMBER = '#eab308';
  const RED = '#ef4444';

  const fillColor = $derived((): string => {
    if (!status) return 'transparent';
    const p = status.percentUsed;
    if (p >= 0.9) return RED;
    if (p >= 0.75) return interpolateColor(AMBER, RED, (p - 0.75) / 0.15);
    if (p >= 0.5) return interpolateColor(GREEN, AMBER, (p - 0.5) / 0.25);
    return GREEN;
  });

  const fillPercent = $derived(status ? Math.min(status.percentUsed * 100, 100) : 0);
  const thresholdPercent = $derived(status ? status.compactThresholdRatio * 100 : 75);

  const canCompact = $derived(!!status && !!onCompactNow);

  // Tooltip last compact display
  function formatTimestamp(ts?: number): string {
    if (!ts) return 'Never';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div
  class="context-status-wrapper"
  style="width: {width}px;"
  role="status"
  aria-label="Context window usage"
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => (isHovered = false)}
>
  <!-- Thermometer bar -->
  <div
    class="thermometer"
    class:has-data={!!status}
    style="height: {height}px; border-radius: {Math.ceil(height / 2)}px;"
  >
    <!-- Fill layer -->
    {#if status && status.percentUsed > 0}
      <div
        class="fill"
        style="width: {fillPercent}%; background-color: {fillColor()}; border-radius: {Math.ceil(
          height / 2,
        )}px;"
      ></div>
    {/if}

    <!-- Compact threshold line -->
    {#if status}
      <div
        class="threshold-line"
        style="left: {thresholdPercent}%;"
      ></div>
    {/if}
  </div>

  <!-- Tooltip -->
  {#if isHovered}
    <div class="tooltip" role="tooltip">
      {#if status}
        <div class="tooltip-row model-row">
          <span class="tooltip-label">Model</span>
          <span class="tooltip-value model-name">{status.modelAccessName}</span>
        </div>
        <div class="tooltip-divider"></div>
        <div class="tooltip-row">
          <span class="tooltip-label">Max context</span>
          <span class="tooltip-value">{formatTokens(status.maximumTokenCount)} tokens</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Current usage</span>
          <span class="tooltip-value">
            {formatTokens(status.currentTokenCount)} tokens ({formatPercent(status.percentUsed)})
          </span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Compact at</span>
          <span class="tooltip-value">
            {formatTokens(status.compactThresholdTokenCount)} tokens ({formatPercent(
              status.compactThresholdRatio,
            )})
          </span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Last compact</span>
          <span class="tooltip-value">{formatTimestamp(status.lastCompactTimestamp)}</span>
        </div>
        <div class="tooltip-divider"></div>
        <button
          class="compact-btn"
          class:compact-btn-active={canCompact}
          disabled={!canCompact}
          onclick={() => canCompact && onCompactNow?.()}
          type="button"
        >
          Compact Now
        </button>
      {:else}
        <div class="tooltip-row">
          <span class="tooltip-label">Context status unavailable</span>
        </div>
        <div class="tooltip-row muted">Send a message to enable context tracking.</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .context-status-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: default;
    flex-shrink: 0;
  }

  /* ── Thermometer bar ── */
  .thermometer {
    width: 100%;
    position: relative;
    background: var(--surface-card, #fff);
    border: 1px solid transparent;
    overflow: visible;
    transition: border-color 0.2s ease;
  }

  .thermometer.has-data {
    border-color: var(--surface-border, #e0e0e0);
    background: color-mix(in srgb, var(--surface-card, #fff) 85%, var(--surface-border, #e0e0e0));
  }

  .fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    transition: width 0.4s ease, background-color 0.4s ease;
  }

  .threshold-line {
    position: absolute;
    top: -2px;
    bottom: -2px;
    width: 1.5px;
    background: rgba(0, 0, 0, 0.3);
    transform: translateX(-50%);
    z-index: 1;
    pointer-events: none;
  }

  :global(html.dark) .threshold-line {
    background: rgba(255, 255, 255, 0.35);
  }

  /* ── Tooltip ── */
  .tooltip {
    position: absolute;
    bottom: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    min-width: 220px;
    background: var(--surface-overlay, var(--surface-card, #fff));
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 8px;
    padding: 0.625rem 0.75rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    /* Prevent tooltip from closing when cursor moves into it */
    pointer-events: auto;
  }

  .tooltip-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
    font-size: 0.75rem;
    line-height: 1.5;
    color: var(--text-primary);
  }

  .tooltip-row.muted {
    color: var(--text-secondary);
    font-style: italic;
    justify-content: flex-start;
  }

  .model-row {
    align-items: center;
  }

  .tooltip-label {
    color: var(--text-secondary);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .tooltip-value {
    font-weight: 500;
    text-align: right;
    word-break: break-all;
  }

  .model-name {
    font-size: 0.6875rem;
    font-family: monospace;
    color: var(--text-primary);
    opacity: 0.8;
  }

  .tooltip-divider {
    height: 1px;
    background: var(--surface-border, #e0e0e0);
    margin: 0.25rem 0;
  }

  /* ── Compact Now button ── */
  .compact-btn {
    width: 100%;
    padding: 0.3rem 0.5rem;
    border-radius: 5px;
    border: 1px solid var(--surface-border, #e0e0e0);
    background: var(--surface-hover, #f0f0f0);
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: not-allowed;
    opacity: 0.55;
    transition: all 0.15s;
    text-align: center;
  }

  .compact-btn.compact-btn-active {
    cursor: pointer;
    opacity: 1;
    color: var(--text-primary);
    background: var(--surface-card, #fff);
  }

  .compact-btn.compact-btn-active:hover {
    background: var(--holokai-blue, #6b7eb8);
    color: #fff;
    border-color: var(--holokai-blue, #6b7eb8);
  }
</style>

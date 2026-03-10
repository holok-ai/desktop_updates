<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { aggregateStatus, showBadge, reliabilityStore } from '../../stores/reliability.store';
  import type { InterfaceStatusSnapshot } from '../../../../src-electron/preload';

  let isPanelOpen = $state(false);
  let wrapperEl = $state<HTMLDivElement | undefined>(undefined);
  let now = $state(Date.now());

  onMount(() => {
    reliabilityStore.init();

    // Tick every second so Up For / Last Used update live.
    const tickInterval = setInterval(() => {
      now = Date.now();
    }, 1000);

    // Refresh backend metrics every 5s (counts don't arrive via status-change events).
    const refreshInterval = setInterval(() => {
      void reliabilityStore.refresh();
    }, 5000);

    // Close panel when clicking outside the wrapper (capture phase so the
    // button's own onclick still toggles correctly).
    function handleOutsideClick(e: MouseEvent) {
      if (isPanelOpen && wrapperEl !== undefined && !wrapperEl.contains(e.target as Node)) {
        isPanelOpen = false;
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        isPanelOpen = false;
      }
    }

    document.addEventListener('click', handleOutsideClick, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearInterval(tickInterval);
      clearInterval(refreshInterval);
      document.removeEventListener('click', handleOutsideClick, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  });

  onDestroy(() => {
    reliabilityStore.reset();
  });

  const badgeLabel = $derived.by(() => {
    switch ($aggregateStatus) {
      case 'available':
        return 'Available';
      case 'reduced':
        return 'Reduced';
      case 'down':
        return 'Unavailable';
    }
  });

  const badgeColorClass = $derived.by(() => {
    switch ($aggregateStatus) {
      case 'available':
        return 'badge-available';
      case 'reduced':
        return 'badge-reduced';
      case 'down':
        return 'badge-down';
    }
  });

  const interfaces = $derived([
    { label: 'Moku System API', snapshot: $reliabilityStore.mokuApi },
    { label: 'Holo Chat API', snapshot: $reliabilityStore.holoApi },
    { label: 'Holo Notifications', snapshot: $reliabilityStore.holoNotifications },
  ]);

  function statusLabel(status: InterfaceStatusSnapshot['status']): string {
    switch (status) {
      case 'available':
        return 'Available';
      case 'not-available':
        return 'Checking...';
      case 'down':
        return 'Down';
      default:
        return 'Unknown';
    }
  }

  function statusColorClass(status: InterfaceStatusSnapshot['status']): string {
    switch (status) {
      case 'available':
        return 'status-available';
      case 'not-available':
        return 'status-checking';
      case 'down':
        return 'status-down';
      default:
        return 'status-unknown';
    }
  }

  function formatTimeAgo(epochMs: number | null): string {
    if (epochMs === null) return '—';
    const diff = now - epochMs;
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(epochMs).toLocaleDateString();
  }

  function formatDuration(epochMs: number | null): string {
    if (epochMs === null) return '—';
    const diff = now - epochMs;
    if (diff < 0) return '—';
    if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
    const totalMinutes = Math.floor(diff / 60_000);
    const totalHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (totalHours >= 24) {
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;
      return `${days}d ${hours}h ${minutes}m`;
    }
    if (totalHours > 0) return `${totalHours}h ${minutes}m`;
    return `${totalMinutes}m`;
  }
</script>

{#if $showBadge}
  <div class="badge-wrapper" bind:this={wrapperEl}>
    <button
      class="status-badge {badgeColorClass}"
      onclick={() => (isPanelOpen = !isPanelOpen)}
      aria-label="Interface status: {badgeLabel}"
      aria-expanded={isPanelOpen}
      aria-haspopup="true"
    >
      <span class="badge-dot"></span>
      <span class="badge-text">{badgeLabel}</span>
      <i class="pi pi-chevron-down badge-caret" class:caret-open={isPanelOpen}></i>
    </button>

    {#if isPanelOpen}
      <div class="status-panel" role="region" aria-label="Interface status details">
        {#each interfaces as iface, i}
          {#if i > 0}
            <div class="panel-divider"></div>
          {/if}
          <!-- Line 1: dot + name · status · up for -->
          <div class="iface-row1">
            <div class="iface-identity">
              <span class="iface-dot {statusColorClass(iface.snapshot.status)}"></span>
              <span class="iface-name">{iface.label}</span>
            </div>
            <span class="iface-status {statusColorClass(iface.snapshot.status)}">
              {statusLabel(iface.snapshot.status)}
            </span>
            <span class="iface-upfor">{formatDuration(iface.snapshot.timeFirstUp)}</span>
          </div>
          <!-- Line 2: messages/errors · last used -->
          <div class="iface-row2">
            <span
              >messages/errors: {iface.snapshot.messagesSentCount} / {iface.snapshot
                .errorCount}</span
            >
            <span>{formatTimeAgo(iface.snapshot.lastUseTime)}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .badge-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  /* ── Badge button ── */
  .status-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px 4px 10px;
    border: none;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .status-badge:hover {
    background: rgba(255, 255, 255, 0.14);
  }

  .badge-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .badge-text {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.85);
  }

  .badge-caret {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.6);
    transition: transform 0.15s ease;
  }

  .badge-caret.caret-open {
    transform: rotate(180deg);
  }

  .badge-available .badge-dot {
    background-color: var(--success-color);
  }

  .badge-reduced .badge-dot {
    background-color: var(--warning-color);
  }

  .badge-down .badge-dot {
    background-color: var(--error-color);
  }

  /* ── Dropdown panel — matches ContextStatus tooltip style ── */
  .status-panel {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 200;
    min-width: 280px;
    background: var(--surface-overlay, var(--surface-card, #fff));
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 8px;
    padding: 0.625rem 0.75rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .panel-divider {
    height: 1px;
    background: var(--surface-border, #e0e0e0);
    margin: 0.3rem 0;
  }

  /* Line 1: [dot name] — [status] — [up for] */
  .iface-row1 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    line-height: 1.5;
    color: var(--text-primary);
  }

  .iface-identity {
    display: flex;
    align-items: center;
    gap: 5px;
    flex: 1;
    min-width: 0;
  }

  .iface-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .iface-dot.status-available {
    background-color: var(--success-color);
  }

  .iface-dot.status-checking {
    background-color: var(--warning-color);
  }

  .iface-dot.status-down {
    background-color: var(--error-color);
  }

  .iface-dot.status-unknown {
    background-color: var(--text-secondary);
    opacity: 0.5;
  }

  .iface-name {
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .iface-status {
    font-size: 0.6875rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .iface-status.status-available {
    color: var(--success-color);
  }

  .iface-status.status-checking {
    color: var(--warning-color);
  }

  .iface-status.status-down {
    color: var(--error-color);
  }

  .iface-status.status-unknown {
    color: var(--text-secondary);
  }

  .iface-upfor {
    font-size: 0.6875rem;
    color: var(--text-secondary);
    white-space: nowrap;
    margin-left: auto;
  }

  /* Line 2: [N msg] · [N err] · [time ago] — spread across the row */
  .iface-row2 {
    display: flex;
    justify-content: space-between;
    font-size: 0.6875rem;
    color: var(--text-secondary);
    line-height: 1.4;
    padding-left: 11px; /* indent to align under name text */
  }
</style>

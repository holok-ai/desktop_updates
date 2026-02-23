<script lang="ts">
  interface Props {
    version: string;
    isInstalling: boolean;
    downloadPercent: number | null;
    onInstall: () => void;
    onDismiss: () => void;
  }

  let { version, isInstalling, downloadPercent, onInstall, onDismiss }: Props = $props();
</script>

<div
  class="dialog-overlay"
  onclick={isInstalling ? undefined : onDismiss}
  onkeydown={(e) => !isInstalling && e.key === 'Escape' && onDismiss()}
  role="button"
  tabindex="-1"
  aria-label="Close modal"
>
  <div
    class="dialog"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    aria-labelledby="install-update-title"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="dialog-header">
      <i class="pi pi-arrow-circle-up update-icon"></i>
      <h2 id="install-update-title">Update Available</h2>
    </div>

    <div class="dialog-content">
      <p>Version <strong>{version}</strong> is ready to install.</p>

      {#if isInstalling}
        <div class="download-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: {downloadPercent ?? 0}%"></div>
          </div>
          <span class="progress-label">{downloadPercent ?? 0}%</span>
        </div>
        <p class="progress-note">Downloading update — the app will restart when complete.</p>
      {:else}
        <div class="dialog-actions">
          <button type="button" class="btn-secondary" onclick={onDismiss}>Install Later</button>
          <button type="button" class="btn-primary" onclick={onInstall}>Install Now</button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .update-icon {
    color: var(--primary-color, #646cff);
    font-size: 1.1rem;
  }

  .download-progress {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin: 0.75rem 0 0.25rem;
  }

  .progress-bar {
    flex: 1;
    height: 6px;
    background: var(--surface-border, #e0e0e0);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--primary-color, #646cff);
    border-radius: 3px;
    transition: width 0.2s ease;
  }

  .progress-label {
    font-size: 0.8rem;
    color: var(--text-secondary, #666);
    min-width: 2.5rem;
    text-align: right;
  }

  .progress-note {
    font-size: 0.8rem;
    color: var(--text-secondary, #666);
    margin: 0;
  }
</style>

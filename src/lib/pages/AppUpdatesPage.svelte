<script lang="ts">
  import { onMount } from 'svelte';
  import InstallUpdateModal from '$lib/modals/InstallUpdateModal.svelte';
  import { toastStore } from '$lib/services/toast.service';

  let isLoading = $state(true);
  let appVersion = $state('');
  let latestVersion = $state('');
  let updateAvailable = $state(false);
  let autoCheckUpdates = $state(true);
  let autoInstallUpdates = $state(false);
  let isDevelopmentBuild = $state(false);

  let isCheckingUpdates = $state(false);
  let showInstallConfirm = $state(false);
  let isInstalling = $state(false);
  let downloadPercent = $state<number | null>(null);

  async function loadUpdateSettings() {
    const all = await window.electronAPI.settings.getAll();
    autoCheckUpdates = all.autoCheckUpdates ?? true;
    autoInstallUpdates = all.autoInstallUpdates ?? false;
    latestVersion = String(all.latestVersion ?? '');
    updateAvailable = Boolean(all.updateAvailable ?? false);
  }

  async function persistUpdatePreferences(
    nextAutoCheckUpdates: boolean,
    nextAutoInstallUpdates: boolean,
  ) {
    await window.electronAPI.settings.setMultiple({
      autoCheckUpdates: nextAutoCheckUpdates,
      autoInstallUpdates: nextAutoInstallUpdates,
    });
  }

  async function handleAutoCheckToggle(event: Event) {
    const previous = autoCheckUpdates;
    autoCheckUpdates = (event.target as HTMLInputElement).checked;

    try {
      await persistUpdatePreferences(autoCheckUpdates, autoInstallUpdates);
    } catch {
      autoCheckUpdates = previous;
      toastStore.show('Failed to save update preferences.', { variant: 'error' });
    }
  }

  async function handleAutoInstallToggle(event: Event) {
    const previous = autoInstallUpdates;
    autoInstallUpdates = (event.target as HTMLInputElement).checked;

    try {
      await persistUpdatePreferences(autoCheckUpdates, autoInstallUpdates);
    } catch {
      autoInstallUpdates = previous;
      toastStore.show('Failed to save update preferences.', { variant: 'error' });
    }
  }

  async function handleCheckForUpdates() {
    isCheckingUpdates = true;
    try {
      const message = await window.electronAPI.updater.getUpdateAvailability();
      toastStore.show(message, { variant: 'info' });

      await loadUpdateSettings();
      if (updateAvailable) {
        showInstallConfirm = true;
      }
    } catch {
      toastStore.show('Failed to check for updates.', { variant: 'error' });
    } finally {
      isCheckingUpdates = false;
    }
  }

  async function handleInstallNow() {
    isInstalling = true;
    downloadPercent = 0;

    const unsubscribeProgress = window.electronAPI.updater.onDownloadProgress((percent) => {
      downloadPercent = percent;
    });

    try {
      const result = await window.electronAPI.updater.updateNow();
      if (!result.success) {
        toastStore.show(result.error ?? 'Failed to start update download.', { variant: 'error' });
        showInstallConfirm = false;
        downloadPercent = null;
      }
      // If successful, quitAndInstall is called automatically and the app restarts.
    } catch {
      toastStore.show('Failed to start update download.', { variant: 'error' });
      showInstallConfirm = false;
      downloadPercent = null;
    } finally {
      unsubscribeProgress();
      isInstalling = false;
    }
  }

  onMount(async () => {
    const [version, devBuild] = await Promise.all([
      window.electronAPI.system.version(),
      window.electronAPI.updater.isDevelopmentBuild(),
    ]);

    appVersion = version;
    isDevelopmentBuild = devBuild;
    await loadUpdateSettings();
    isLoading = false;

    const query = window.location.hash.split('?')[1] ?? '';
    if (new URLSearchParams(query).get('checkNow') === '1') {
      await handleCheckForUpdates();
    }
  });
</script>

<div class="app-updates-page">
  {#if isLoading}
    <div class="loading">Loading update settings...</div>
  {:else}
    <div class="updates-content">
      <h2 class="panel-title">App Updates</h2>
      <div class="category-card">
        <div class="subgroup-row">
          <div class="subgroup-label">Version Info</div>
          <div class="subgroup-controls">
            <div class="info-row">
              <span class="info-key">Current Version</span>
              <span class="info-value">{appVersion}</span>
            </div>
            <div class="info-row">
              <span class="info-key">Available Version</span>
              <span class="info-value">
                {#if isDevelopmentBuild}
                  Not Available In Development
                {:else if latestVersion}
                  {latestVersion}{latestVersion === appVersion ? " (You've got the latest.)" : ''}
                {:else}
                  —
                {/if}
              </span>
            </div>
          </div>
        </div>

        <div class="subgroup-divider"></div>

        <div class="subgroup-row">
          <div class="subgroup-label">Preferences</div>
          <div class="subgroup-controls">
            <label class="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoCheckUpdates}
                onchange={(event) => void handleAutoCheckToggle(event)}
              />
              <span class="text-sm">Check for updates on startup?</span>
            </label>
            <label class="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoInstallUpdates}
                onchange={(event) => void handleAutoInstallToggle(event)}
              />
              <span class="text-sm">Install updates when available</span>
            </label>
          </div>
        </div>

        <div class="subgroup-divider"></div>

        <div class="subgroup-row">
          <div class="subgroup-label">Manual Check</div>
          <div class="subgroup-controls">
            <button
              class="btn-primary"
              onclick={handleCheckForUpdates}
              disabled={isCheckingUpdates}
            >
              {#if isCheckingUpdates}
                Checking...
              {:else}
                Check Now
              {/if}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

{#if showInstallConfirm}
  <InstallUpdateModal
    version={latestVersion}
    {isInstalling}
    {downloadPercent}
    onInstall={handleInstallNow}
    onDismiss={() => (showInstallConfirm = false)}
  />
{/if}

<style>
  .app-updates-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
  }

  .updates-content {
    max-width: 760px;
    margin-left: 2rem;
    margin-right: 1.5rem;
    padding-top: 1.5rem;
    padding-bottom: 1.5rem;
  }

  .panel-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .category-card {
    border-radius: 0.5rem;
    padding: 0;
    background: var(--surface-card);
  }

  .subgroup-row {
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: 1.5rem;
    padding: 1rem 1.25rem;
    align-items: start;
  }

  .subgroup-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-secondary);
    padding-top: 0.25rem;
    white-space: nowrap;
  }

  .subgroup-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }

  .subgroup-divider {
    height: 1px;
    background: var(--input-border);
    margin: 0 1.25rem;
  }

  .info-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
  }

  .info-key {
    color: var(--text-secondary);
    min-width: 100px;
  }

  .info-value {
    font-weight: 500;
  }

  .loading {
    text-align: center;
    padding: 3rem;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import type { AppSettings, AppThemeMode } from '$lib/types/app.type';
  import { APP_THEME_MODE } from '$lib/constants/app.constant';
  import { DEFAULT_HOLO_API_URL } from '../../../src-shared/constants/api.constant';
  import { applyTheme, persistTheme } from '$lib/services/theme.service';
  import { toastStore } from '$lib/services/toast.service';
  import FileToolsWhitelist from '$lib/components/settings/FileToolsWhitelist.svelte';

  type SettingsCategory = 'general' | 'appearance' | 'updates' | 'tools' | 'connections' | 'diagnostics';

  const categories: { id: SettingsCategory; label: string; icon: string }[] = [
    { id: 'general', label: 'General', icon: 'pi-cog' },
    { id: 'appearance', label: 'Appearance', icon: 'pi-palette' },
    { id: 'updates', label: 'Updates', icon: 'pi-refresh' },
    { id: 'tools', label: 'Tools', icon: 'pi-wrench' },
    { id: 'connections', label: 'Connections', icon: 'pi-link' },
    { id: 'diagnostics', label: 'Diagnostics', icon: 'pi-chart-bar' },
  ];

  let activeCategory: SettingsCategory = $state('general');

  let isLoading = $state(true);
  let appVersion = $state('');

  let settings: AppSettings = $state({
    mokuWebUrl: '',
    mokuApiUrl: '',
    holoApiUrl: DEFAULT_HOLO_API_URL,
    directoryWhitelist: [],
    theme: APP_THEME_MODE.LIGHT,
    autoUpdate: true,
    updateAvailable: false,
    latestVersion: '',
  });

  let savedSettings: AppSettings = $state({
    mokuWebUrl: '',
    mokuApiUrl: '',
    holoApiUrl: DEFAULT_HOLO_API_URL,
    directoryWhitelist: [],
    theme: APP_THEME_MODE.LIGHT,
    autoUpdate: true,
    updateAvailable: false,
    latestVersion: '',
  });

  onMount(async () => {
    const [all, version] = await Promise.all([
      window.electronAPI.settings.getAll(),
      window.electronAPI.system.version(),
    ]);

    settings = {
      mokuWebUrl: all.mokuWebUrl,
      mokuApiUrl: all.mokuApiUrl,
      holoApiUrl: all.holoApiUrl ?? DEFAULT_HOLO_API_URL,
      directoryWhitelist: [...(all.directoryWhitelist ?? [])],
      theme: (all.theme as AppThemeMode) || APP_THEME_MODE.LIGHT,
      autoUpdate: Boolean(all.autoUpdate ?? true),
      updateAvailable: Boolean(all.updateAvailable ?? false),
      latestVersion: String(all.latestVersion ?? ''),
    };
    savedSettings = {
      ...settings,
      directoryWhitelist: [...settings.directoryWhitelist],
    };
    appVersion = version;

    applyTheme(settings.theme);
    isLoading = false;
  });

  let holoApiUrlError = $state('');

  function normalizeBaseUrl(url: string): string {
    return url.replace(/\/+$/, '');
  }

  function validateHoloApiUrl(url: string): string {
    if (!url) return 'Holo API URL is required';
    if (!isValidUrl(url)) return 'Invalid Holo API URL';
    const normalized = normalizeBaseUrl(url);
    if (!isValidUrl(normalized)) return 'Invalid Holo API URL';
    return '';
  }

  // Handle paste event for bulk URL input
  function handleMokuWebUrlPaste(event: ClipboardEvent) {
    const pastedText = event.clipboardData?.getData('text');

    if (!pastedText) return;

    // Split by newlines (handle both \r\n and \n)
    const lines = pastedText.split(/\r?\n/).filter(line => line.trim().length > 0);

    // Check if we have 2 or more lines
    if (lines.length >= 2) {
      event.preventDefault(); // Prevent default paste behavior

      // Populate the three URL fields with the first 3 lines
      if (lines[0]) settings.mokuWebUrl = lines[0].trim();
      if (lines[1]) settings.mokuApiUrl = lines[1].trim();
      if (lines[2]) settings.holoApiUrl = lines[2].trim();

      console.log('[Settings] Bulk paste detected - populated 3 URL fields');
    }
    // If less than 2 lines, let the default paste behavior happen
  }

  async function saveSettings() {
    try {
      if (!isValidUrl(settings.mokuWebUrl)) throw new Error('Invalid Moku Web URL');
      if (!isValidUrl(settings.mokuApiUrl)) throw new Error('Invalid Moku API URL');
      const holoError = validateHoloApiUrl(settings.holoApiUrl);
      if (holoError) {
        holoApiUrlError = holoError;
        throw new Error(holoError);
      }

      settings.holoApiUrl = normalizeBaseUrl(settings.holoApiUrl);

      await window.electronAPI.settings.setMultiple({
        mokuWebUrl: settings.mokuWebUrl,
        mokuApiUrl: settings.mokuApiUrl,
        holoApiUrl: settings.holoApiUrl,
        directoryWhitelist: settings.directoryWhitelist,
        autoUpdate: settings.autoUpdate,
        updateAvailable: settings.updateAvailable,
        latestVersion: settings.latestVersion,
      });

      savedSettings = {
        ...settings,
        directoryWhitelist: [...settings.directoryWhitelist],
      };
      toastStore.show('Settings were saved successfully.', { variant: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toastStore.show(message, { variant: 'error' });
    }
  }

  function cancelSettings() {
    settings = {
      ...savedSettings,
      directoryWhitelist: [...savedSettings.directoryWhitelist],
    };
    holoApiUrlError = '';
    applyTheme(settings.theme);
    persistTheme(settings.theme);
  }

  function isValidUrl(url: string): boolean {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  $effect(() => {
    if (!isLoading) {
      holoApiUrlError = settings.holoApiUrl ? validateHoloApiUrl(settings.holoApiUrl) : '';
    }
  });

  // Immediate apply + persist theme
  $effect(() => {
    if (!isLoading) {
      applyTheme(settings.theme);
      persistTheme(settings.theme);
      void window.electronAPI.settings.set('theme', settings.theme);
    }
  });

  let hasChanges = $derived(
    JSON.stringify({
      mokuWebUrl: settings.mokuWebUrl,
      mokuApiUrl: settings.mokuApiUrl,
      holoApiUrl: settings.holoApiUrl,
      directoryWhitelist: settings.directoryWhitelist,
      autoUpdate: settings.autoUpdate,
    }) !==
    JSON.stringify({
      mokuWebUrl: savedSettings.mokuWebUrl,
      mokuApiUrl: savedSettings.mokuApiUrl,
      holoApiUrl: savedSettings.holoApiUrl,
      directoryWhitelist: savedSettings.directoryWhitelist,
      autoUpdate: savedSettings.autoUpdate,
    })
  );
</script>

<div class="settings-page">
  <div class="settings-body">
    <!-- Category sidebar -->
    <nav class="settings-sidebar">
      {#each categories as cat}
        <button
          class="sidebar-item"
          class:active={activeCategory === cat.id}
          onclick={() => (activeCategory = cat.id)}
        >
          <i class="pi {cat.icon} sidebar-icon"></i>
          <span>{cat.label}</span>
        </button>
      {/each}
    </nav>

    <!-- Settings content panel -->
    <div class="settings-panel">
      <div class="settings-scroll-area">
        <div class="settings-content">
          {#if isLoading}
            <div class="loading">Loading settings...</div>
          {:else}

            <!-- General -->
            {#if activeCategory === 'general'}
              <h2 class="panel-title">General</h2>
              <div class="rounded-lg p-4 bg-[var(--surface-card)] space-y-4">
                <p class="text-sm" style="color: var(--text-secondary);">
                  General application settings. Configure connections, appearance, and more using the categories on the left.
                </p>
                <div class="form-group">
                  <span class="block text-sm font-medium mb-1">Application Version</span>
                  <span class="text-sm">{appVersion}</span>
                </div>
              </div>
            {/if}

            <!-- Appearance -->
            {#if activeCategory === 'appearance'}
              <h2 class="panel-title">Appearance</h2>
              <div class="rounded-lg p-4 bg-[var(--surface-card)] space-y-4">
                <div class="form-group">
                  <span class="block text-sm font-medium mb-1">Theme</span>
                  <div class="flex items-center gap-6">
                    <label class="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="theme"
                        value={APP_THEME_MODE.DARK}
                        bind:group={settings.theme}
                      />
                      <span>Dark</span>
                    </label>
                    <label class="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="theme"
                        value={APP_THEME_MODE.LIGHT}
                        bind:group={settings.theme}
                      />
                      <span>Light</span>
                    </label>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Updates -->
            {#if activeCategory === 'updates'}
              <h2 class="panel-title">Updates</h2>
              <div class="rounded-lg p-4 bg-[var(--surface-card)] space-y-3">
                <div class="text-sm">
                  <span class="font-medium">Current Version:</span>
                  {appVersion}
                </div>
                <div class="text-sm">
                  <span class="font-medium">Update Available:</span>
                  {#if settings.updateAvailable}
                    Yes ({settings.latestVersion || 'unknown'})
                  {:else}
                    No
                  {/if}
                </div>
                <label class="inline-flex items-center gap-2">
                  <input id="auto-update" type="checkbox" bind:checked={settings.autoUpdate} />
                  <span>Enable automatic updates</span>
                </label>
              </div>
            {/if}

            <!-- Tools -->
            {#if activeCategory === 'tools'}
              <h2 class="panel-title">Tools</h2>
              <div class="rounded-lg p-4 bg-[var(--surface-card)]">
                <FileToolsWhitelist bind:paths={settings.directoryWhitelist} />
              </div>
            {/if}

            <!-- Connections -->
            {#if activeCategory === 'connections'}
              <h2 class="panel-title">Connections</h2>
              <div class="rounded-lg p-4 bg-[var(--surface-card)] space-y-4">
                <div class="form-group">
                  <label for="moku-web-url" class="block text-sm font-medium mb-1">Moku Web URL</label>
                  <input
                    id="moku-web-url"
                    type="url"
                    bind:value={settings.mokuWebUrl}
                    placeholder="https://moku.holokai.com"
                    class="w-full p-2 rounded border bg-transparent"
                    onpaste={handleMokuWebUrlPaste}
                  />
                  <small class="help-text">URL of the Moku web application</small>
                </div>

                <div class="form-group">
                  <label for="moku-api-url" class="block text-sm font-medium mb-1">Moku API URL</label>
                  <input
                    id="moku-api-url"
                    type="url"
                    bind:value={settings.mokuApiUrl}
                    placeholder="https://api.moku.holokai.com"
                    class="w-full p-2 rounded border bg-transparent"
                  />
                  <small class="help-text">URL of the Moku API server</small>
                </div>

                <div class="form-group">
                  <label for="holo-api-url" class="block text-sm font-medium mb-1">Holo API URL</label>
                  <input
                    id="holo-api-url"
                    type="url"
                    bind:value={settings.holoApiUrl}
                    placeholder={DEFAULT_HOLO_API_URL}
                    class="w-full p-2 rounded border bg-transparent"
                  />
                  <small class="help-text">The base URL for the Holo API endpoint</small>
                  {#if holoApiUrlError}
                    <div class="error-text">{holoApiUrlError}</div>
                  {/if}
                </div>
              </div>
            {/if}

            <!-- Diagnostics -->
            {#if activeCategory === 'diagnostics'}
              <h2 class="panel-title">Diagnostics</h2>
              <div class="rounded-lg p-4 bg-[var(--surface-card)] space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm">Application log file</span>
                  <button
                    class="btn-primary"
                    onclick={() => {
                      window.electronAPI.settings.openLogInVSCode();
                    }}
                  >
                    View Log
                  </button>
                </div>
              </div>
            {/if}

          {/if}
        </div>
      </div>

      <!-- Footer always visible -->
      {#if !isLoading}
        <div class="settings-footer">
          <div class="settings-actions">
            <button
              onclick={saveSettings}
              disabled={!hasChanges}
              class="btn-primary"
            >
              <i class="pi pi-check"></i>
              <span>Save</span>
            </button>
            <button
              onclick={cancelSettings}
              disabled={!hasChanges}
              class="btn-secondary"
            >
              <i class="pi pi-times"></i>
              <span>Cancel</span>
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .settings-page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .settings-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* Sidebar navigation */
  .settings-sidebar {
    display: flex;
    flex-direction: column;
    width: 200px;
    flex-shrink: 0;
    padding: 1rem 0;
    border-right: 1px solid var(--input-border);
    background: var(--surface-sidebar, var(--surface-main));
    overflow-y: auto;
  }

  .sidebar-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s, color 0.15s;
  }

  .sidebar-item:hover {
    background: var(--surface-hover, rgba(255, 255, 255, 0.05));
    color: var(--text-primary);
  }

  .sidebar-item.active {
    background: var(--surface-active, rgba(59, 130, 246, 0.1));
    color: var(--primary-color);
    font-weight: 600;
  }

  .sidebar-icon {
    font-size: 0.875rem;
    width: 1.25rem;
    text-align: center;
  }

  /* Right panel */
  .settings-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  .settings-scroll-area {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .settings-content {
    max-width: 700px;
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

  .settings-footer {
    flex-shrink: 0;
    padding: 1rem 1.5rem 1rem 2rem;
    border-top: 1px solid var(--input-border);
    background: var(--surface-main);
    box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.05);
  }

  :global(html.dark) .settings-footer {
    box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.2);
  }

  .settings-actions {
    max-width: 700px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .loading {
    text-align: center;
    padding: 3rem;
  }

  .help-text {
    display: block;
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  .error-text {
    font-size: 0.75rem;
    color: var(--error-color);
    margin-top: 0.25rem;
  }
</style>

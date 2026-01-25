<script lang="ts">
  import { onMount } from 'svelte';
  import type { AppSettings, AppThemeMode } from '$lib/types/app.type';
  import { APP_THEME_MODE } from '$lib/constants/app.constant';
  import { DEFAULT_HOLO_API_URL } from '../../../src-shared/constants/api.constant';
  import { applyTheme, persistTheme } from '$lib/services/theme.service';
  import { toastStore } from '$lib/services/toast.service';
  import FileToolsWhitelist from '$lib/components/settings/FileToolsWhitelist.svelte';

  let isLoading = true;
  let appVersion = '';

  let settings: AppSettings = {
    mokuWebUrl: '',
    mokuApiUrl: '',
    holoApiUrl: DEFAULT_HOLO_API_URL,
    directoryWhitelist: [],
    theme: APP_THEME_MODE.LIGHT,
    autoUpdate: true,
    updateAvailable: false,
    latestVersion: '',
    updateCachePath: '',
  };

  let savedSettings: AppSettings = { ...settings };

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
      updateCachePath: String(all.updateCachePath ?? ''),
    };
    savedSettings = {
      ...settings,
      directoryWhitelist: [...settings.directoryWhitelist],
    };
    appVersion = version;

    applyTheme(settings.theme);
    isLoading = false;
  });

  let holoApiUrlError = '';

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
        updateCachePath: settings.updateCachePath,
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

  $: if (!isLoading) {
    holoApiUrlError = settings.holoApiUrl ? validateHoloApiUrl(settings.holoApiUrl) : '';
  }

  // Immediate apply + persist theme
  $: if (!isLoading) {
    applyTheme(settings.theme);
    persistTheme(settings.theme);
    void window.electronAPI.settings.set('theme', settings.theme);
  }

  $: hasChanges =
    JSON.stringify({
      mokuWebUrl: settings.mokuWebUrl,
      mokuApiUrl: settings.mokuApiUrl,
      holoApiUrl: settings.holoApiUrl,
      directoryWhitelist: settings.directoryWhitelist,
      autoUpdate: settings.autoUpdate,
      updateCachePath: settings.updateCachePath,
    }) !==
    JSON.stringify({
      mokuWebUrl: savedSettings.mokuWebUrl,
      mokuApiUrl: savedSettings.mokuApiUrl,
      holoApiUrl: savedSettings.holoApiUrl,
      directoryWhitelist: savedSettings.directoryWhitelist,
      autoUpdate: savedSettings.autoUpdate,
      updateCachePath: savedSettings.updateCachePath,
    });
</script>

<div class="settings-page">
  <div class="settings-scroll-area">
    <div class="settings-content">
      <div class="flex justify-between items-center mb-6">
        <h1>Settings</h1>
      </div>

      {#if isLoading}
        <div class="loading">Loading settings...</div>
      {:else}
        <section class="mb-6">
          <h2 class="mb-2">Connection</h2>
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
              <small class="text-xs text-gray-500">URL of the Moku web application</small>
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
              <small class="text-xs text-gray-500">URL of the Moku API server</small>
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
              <small class="text-xs text-gray-500">The base URL for the Holo API endpoint</small>
              {#if holoApiUrlError}
                <div class="text-xs text-red-500 mt-1">{holoApiUrlError}</div>
              {/if}
            </div>
          </div>
        </section>

        <section class="mb-6">
          <h2 class="mb-2">Appearance</h2>
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
        </section>

        <section class="mb-6">
          <h2 class="mb-2">Allowed Directories</h2>
          <div class="rounded-lg p-4 bg-[var(--surface-card)]">
            <FileToolsWhitelist bind:paths={settings.directoryWhitelist} />
          </div>
        </section>

        <section class="mb-6">
          <h2 class="mb-2">Diagnostics</h2>
          <div class="rounded-lg p-4 bg-[var(--surface-card)] space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm">Application log file</span>
              <button
                class="px-3 py-1.5 text-sm bg-[var(--primary-color)] text-white rounded hover:opacity-90 transition-opacity"
                onclick={() => {
                  window.electronAPI.settings.openLogInVSCode();
                }}
              >
                View Log
              </button>
            </div>
          </div>
        </section>

        <section class="mb-6">
          <h2 class="mb-2">Updates</h2>
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
            <div class="form-group">
              <label for="update-cache-path" class="block text-sm font-medium mb-1">Download update files to</label>
              <div class="flex items-center gap-2">
                <input
                  id="update-cache-path"
                  type="text"
                  bind:value={settings.updateCachePath}
                  placeholder="Default cache path"
                  class="flex-1 p-2 rounded border bg-transparent"
                />
                <button
                  type="button"
                  class="px-3 py-2 text-sm bg-[var(--primary-color)] text-white rounded hover:opacity-90 transition-opacity"
                  onclick={async () => {
                    const selectedPath = await window.electronAPI.settings.selectUpdateCachePath(settings.updateCachePath || undefined);
                    if (selectedPath) {
                      settings.updateCachePath = selectedPath;
                    }
                  }}
                >
                  Browse
                </button>
              </div>
              <small class="text-xs text-gray-500">Directory where update files are stored</small>
            </div>
          </div>
        </section>
      {/if}
    </div>
  </div>

  {#if !isLoading}
    <div class="settings-footer">
      <div class="settings-actions flex items-center gap-3">
        <button
          onclick={saveSettings}
          disabled={!hasChanges}
          class="btn-primary px-3 py-2 rounded bg-blue-700 text-white disabled:bg-[var(--surface-sidebar-primary)] disabled:text-gray-400 inline-flex items-center gap-1"
        >
          <i class="pi pi-check text-xs text-white"></i>
          <span class="text-white">Save</span>
        </button>
        <button
          onclick={cancelSettings}
          disabled={!hasChanges}
          class="btn-secondary px-3 py-2 rounded bg-white text-black disabled:opacity-50 inline-flex items-center gap-1"
        >
          <i class="pi pi-times text-xs !text-black"></i>
          <span class="!text-black">Cancel</span>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .settings-page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .settings-scroll-area {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .settings-content {
    max-width: 800px;
    margin-left: 30px;
    margin-right: 1.5rem;
    padding-top: 1.5rem;
    padding-bottom: 1.5rem;
  }

  .settings-footer {
    flex-shrink: 0;
    padding: 1rem 1.5rem 1rem 30px;
    border-top: 1px solid var(--border-color, #e5e7eb);
    background: var(--background, #ffffff);
    box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.05);
  }

  .settings-actions {
    max-width: 800px;
  }

  .loading {
    text-align: center;
    padding: 3rem;
  }
</style>

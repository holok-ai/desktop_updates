<script lang="ts">
  import { onMount } from 'svelte';
  import type { AppSettings, AppThemeMode } from '$lib/types/app.type';
  import { APP_THEME_MODE } from '$lib/constants/app.constant';
  import { DEFAULT_HOLO_API_URL } from '../../../src-shared/constants/api.constant';
  import { applyTheme, persistTheme } from '$lib/services/theme.service';
  import FileToolsWhitelist from '$lib/components/settings/FileToolsWhitelist.svelte';

  let isLoading = true;
  let saveStatus = '';
  let appVersion = '';

  let settings: AppSettings = {
    mokuWebUrl: '',
    mokuApiUrl: '',
    holoApiUrl: DEFAULT_HOLO_API_URL,
    fileToolsWhitelist: [],
    theme: APP_THEME_MODE.LIGHT,
    autoUpdate: true,
    updateAvailable: false,
    latestVersion: '',
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
      fileToolsWhitelist: all.fileToolsWhitelist ?? [],
      theme: (all.theme as AppThemeMode) || APP_THEME_MODE.LIGHT,
      autoUpdate: Boolean(all.autoUpdate ?? true),
      updateAvailable: Boolean(all.updateAvailable ?? false),
      latestVersion: String(all.latestVersion ?? ''),
    };
    savedSettings = { ...settings };
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
        autoUpdate: settings.autoUpdate,
        updateAvailable: settings.updateAvailable,
        latestVersion: settings.latestVersion,
      });

      savedSettings = { ...settings };
      saveStatus = 'Settings saved successfully!';
      setTimeout(() => (saveStatus = ''), 3000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      saveStatus = `Error: ${message}`;
    }
  }

  function cancelSettings() {
    settings = { ...savedSettings };
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
      autoUpdate: settings.autoUpdate,
    }) !==
    JSON.stringify({
      mokuWebUrl: savedSettings.mokuWebUrl,
      mokuApiUrl: savedSettings.mokuApiUrl,
      holoApiUrl: savedSettings.holoApiUrl,
      autoUpdate: savedSettings.autoUpdate,
    });
</script>

<div class="mx-auto">
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
      </div>
    </section>

    <section class="mb-6">
      <h2 class="mb-2">File Tools</h2>
      <div class="rounded-lg p-4 bg-[var(--surface-card)]">
        <FileToolsWhitelist />
      </div>
    </section>

    <div class="settings-actions flex items-center gap-3">
      <button
        onclick={saveSettings}
        disabled={!hasChanges}
        class="btn-primary px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
      >
        Save
      </button>
      <button
        onclick={cancelSettings}
        disabled={!hasChanges}
        class="btn-secondary px-3 py-2 rounded border"
      >
        Cancel
      </button>
    </div>

    {#if saveStatus}
      <div class="status-message mt-3" class:error={saveStatus.includes('Error')}>
        {saveStatus}
      </div>
    {/if}
  {/if}
</div>

<style>
  .loading {
    text-align: center;
    padding: 3rem;
  }
  .status-message {
    font-size: 0.875rem;
  }
</style>

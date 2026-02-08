<script lang="ts">
  import { onMount } from 'svelte';
  import type {
    AppSettings,
    AppThemeMode,
    StartingPage,
    ThreadLayout,
    ChatLayout,
    Tool,
  } from '$lib/types/app.type';
  import {
    APP_THEME_MODE,
    STARTING_PAGE,
    STARTING_PAGE_LABELS,
    THREAD_LAYOUT,
    THREAD_LAYOUT_OPTIONS,
    CHAT_LAYOUT,
    CHAT_LAYOUT_LABELS,
    CHAT_FONT_SIZE_MIN,
    CHAT_FONT_SIZE_MAX,
    CHAT_FONT_SIZE_DEFAULT,
  } from '$lib/constants/app.constant';
  import { DEFAULT_HOLO_API_URL } from '../../../src-shared/constants/api.constant';
  import { applyTheme, persistTheme } from '$lib/services/theme.service';
  import { toastStore } from '$lib/services/toast.service';
  import FileToolsWhitelist from '$lib/components/settings/FileToolsWhitelist.svelte';

  type SettingsCategory =
    | 'general'
    | 'appearance'
    | 'updates'
    | 'tools'
    | 'connections'
    | 'diagnostics';

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
  let isCheckingUpdates = $state(false);

  // Placeholder tools list — connect to real data source later
  let availableTools: Tool[] = $state([
    { toolId: 'web-search', toolTitle: 'Web Search' },
    { toolId: 'file-reader', toolTitle: 'File Reader' },
    { toolId: 'code-interpreter', toolTitle: 'Code Interpreter' },
    { toolId: 'image-gen', toolTitle: 'Image Generation' },
  ]);

  let settings: AppSettings = $state({
    mokuWebUrl: '',
    mokuApiUrl: '',
    holoApiUrl: DEFAULT_HOLO_API_URL,
    directoryWhitelist: [],
    theme: APP_THEME_MODE.LIGHT,
    startingPage: STARTING_PAGE.CREATE_CHAT as StartingPage,
    showRecentList: true,
    threadLayout: THREAD_LAYOUT.SINGLE_COL as ThreadLayout,
    chatFontSize: CHAT_FONT_SIZE_DEFAULT,
    chatLayout: CHAT_LAYOUT.LEFT_RIGHT as ChatLayout,
    enabledTools: [],
    shellCommands: '',
    autoCheckUpdates: true,
    autoInstallUpdates: false,
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
    startingPage: STARTING_PAGE.CREATE_CHAT as StartingPage,
    showRecentList: true,
    threadLayout: THREAD_LAYOUT.SINGLE_COL as ThreadLayout,
    chatFontSize: CHAT_FONT_SIZE_DEFAULT,
    chatLayout: CHAT_LAYOUT.LEFT_RIGHT as ChatLayout,
    enabledTools: [],
    shellCommands: '',
    autoCheckUpdates: true,
    autoInstallUpdates: false,
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
      startingPage: (all.startingPage as StartingPage) || STARTING_PAGE.CREATE_CHAT,
      showRecentList: all.showRecentList ?? true,
      threadLayout: (all.threadLayout as ThreadLayout) || THREAD_LAYOUT.SINGLE_COL,
      chatFontSize: all.chatFontSize ?? CHAT_FONT_SIZE_DEFAULT,
      chatLayout: (all.chatLayout as ChatLayout) || CHAT_LAYOUT.LEFT_RIGHT,
      enabledTools: [...(all.enabledTools ?? [])],
      shellCommands: all.shellCommands ?? '',
      autoCheckUpdates: all.autoCheckUpdates ?? Boolean(all.autoUpdate ?? true),
      autoInstallUpdates: all.autoInstallUpdates ?? false,
      autoUpdate: Boolean(all.autoUpdate ?? true),
      updateAvailable: Boolean(all.updateAvailable ?? false),
      latestVersion: String(all.latestVersion ?? ''),
    };
    savedSettings = {
      ...settings,
      directoryWhitelist: [...settings.directoryWhitelist],
      enabledTools: [...settings.enabledTools],
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
    const lines = pastedText.split(/\r?\n/).filter((line) => line.trim().length > 0);

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
        startingPage: settings.startingPage,
        showRecentList: settings.showRecentList,
        threadLayout: settings.threadLayout,
        chatFontSize: settings.chatFontSize,
        chatLayout: settings.chatLayout,
        enabledTools: settings.enabledTools,
        shellCommands: settings.shellCommands,
        autoCheckUpdates: settings.autoCheckUpdates,
        autoInstallUpdates: settings.autoInstallUpdates,
        autoUpdate: settings.autoCheckUpdates, // keep legacy field in sync
        updateAvailable: settings.updateAvailable,
        latestVersion: settings.latestVersion,
      });

      savedSettings = {
        ...settings,
        directoryWhitelist: [...settings.directoryWhitelist],
        enabledTools: [...settings.enabledTools],
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
      enabledTools: [...savedSettings.enabledTools],
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

  function toggleTool(toolId: string) {
    if (settings.enabledTools.includes(toolId)) {
      settings.enabledTools = settings.enabledTools.filter((id) => id !== toolId);
    } else {
      settings.enabledTools = [...settings.enabledTools, toolId];
    }
  }

  async function handleCheckForUpdates() {
    isCheckingUpdates = true;
    try {
      const result = await window.electronAPI.settings.checkForUpdates();
      if (result.success) {
        toastStore.show('Checking for updates...', { variant: 'success' });
      } else {
        toastStore.show(result.error ?? 'Failed to check for updates', { variant: 'error' });
      }
    } catch {
      toastStore.show('Failed to check for updates', { variant: 'error' });
    } finally {
      isCheckingUpdates = false;
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
      startingPage: settings.startingPage,
      showRecentList: settings.showRecentList,
      threadLayout: settings.threadLayout,
      chatFontSize: settings.chatFontSize,
      chatLayout: settings.chatLayout,
      enabledTools: settings.enabledTools,
      shellCommands: settings.shellCommands,
      autoCheckUpdates: settings.autoCheckUpdates,
      autoInstallUpdates: settings.autoInstallUpdates,
    }) !==
      JSON.stringify({
        mokuWebUrl: savedSettings.mokuWebUrl,
        mokuApiUrl: savedSettings.mokuApiUrl,
        holoApiUrl: savedSettings.holoApiUrl,
        directoryWhitelist: savedSettings.directoryWhitelist,
        startingPage: savedSettings.startingPage,
        showRecentList: savedSettings.showRecentList,
        threadLayout: savedSettings.threadLayout,
        chatFontSize: savedSettings.chatFontSize,
        chatLayout: savedSettings.chatLayout,
        enabledTools: savedSettings.enabledTools,
        shellCommands: savedSettings.shellCommands,
        autoCheckUpdates: savedSettings.autoCheckUpdates,
        autoInstallUpdates: savedSettings.autoInstallUpdates,
      }),
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
                  General application settings. Configure connections, appearance, and more using
                  the categories on the left.
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
              <div class="rounded-lg p-4 bg-[var(--surface-card)] space-y-5">
                <!-- Starting Page -->
                <div class="form-group">
                  <label for="starting-page" class="block text-sm font-medium mb-1"
                    >Starting Page</label
                  >
                  <select
                    id="starting-page"
                    bind:value={settings.startingPage}
                    class="w-full p-2 rounded border bg-transparent"
                  >
                    {#each [...STARTING_PAGE_LABELS] as [value, label]}
                      <option {value}>{label}</option>
                    {/each}
                  </select>
                </div>

                <!-- Show Recent List -->
                <div class="form-group">
                  <label class="inline-flex items-center gap-2">
                    <input type="checkbox" bind:checked={settings.showRecentList} />
                    <span class="text-sm font-medium">Show Recent List</span>
                  </label>
                </div>

                <!-- Theme -->
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

                <!-- Thread Layout -->
                <div class="form-group">
                  <span class="block text-sm font-medium mb-2">Thread Layout</span>
                  <div class="thread-layout-grid">
                    {#each THREAD_LAYOUT_OPTIONS as opt}
                      <button
                        class="layout-option"
                        class:active={settings.threadLayout === opt.value}
                        onclick={() => (settings.threadLayout = opt.value as ThreadLayout)}
                        title={opt.description}
                      >
                        <span class="layout-icon">{opt.icon}</span>
                        <span class="layout-label">{opt.label}</span>
                        <span class="layout-desc">{opt.description}</span>
                      </button>
                    {/each}
                  </div>
                </div>

                <!-- Chat Text Font Size -->
                <div class="form-group">
                  <label for="chat-font-size" class="block text-sm font-medium mb-1">
                    Chat Text: <strong>{settings.chatFontSize}pt</strong>
                  </label>
                  <div class="flex items-center gap-3">
                    <span class="text-xs" style="color: var(--text-secondary)"
                      >{CHAT_FONT_SIZE_MIN}</span
                    >
                    <input
                      id="chat-font-size"
                      type="range"
                      min={CHAT_FONT_SIZE_MIN}
                      max={CHAT_FONT_SIZE_MAX}
                      bind:value={settings.chatFontSize}
                      class="flex-1"
                    />
                    <span class="text-xs" style="color: var(--text-secondary)"
                      >{CHAT_FONT_SIZE_MAX}</span
                    >
                  </div>
                </div>

                <!-- Chat Layout -->
                <div class="form-group">
                  <span class="block text-sm font-medium mb-1">Chat Layout</span>
                  <div class="flex flex-col gap-2">
                    {#each [...CHAT_LAYOUT_LABELS] as [value, label]}
                      <label class="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="chatLayout"
                          {value}
                          checked={settings.chatLayout === value}
                          onchange={() => (settings.chatLayout = value as ChatLayout)}
                        />
                        <span class="text-sm">{label}</span>
                      </label>
                    {/each}
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
                  <input type="checkbox" bind:checked={settings.autoCheckUpdates} />
                  <span>Automatically check for updates?</span>
                </label>
                <label class="inline-flex items-center gap-2">
                  <input type="checkbox" bind:checked={settings.autoInstallUpdates} />
                  <span>Install updates when available?</span>
                </label>
                <div>
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
            {/if}

            <!-- Tools -->
            {#if activeCategory === 'tools'}
              <h2 class="panel-title">Tools</h2>
              <div class="rounded-lg p-4 bg-[var(--surface-card)] space-y-5">
                <FileToolsWhitelist bind:paths={settings.directoryWhitelist} />

                <!-- Tools list -->
                <div class="form-group">
                  <span class="block text-sm font-medium mb-2">Enabled Tools</span>
                  <div class="tools-list">
                    {#each availableTools as tool}
                      <label class="inline-flex items-center gap-2 tool-item">
                        <input
                          type="checkbox"
                          checked={settings.enabledTools.includes(tool.toolId)}
                          onchange={() => toggleTool(tool.toolId)}
                        />
                        <span class="text-sm">{tool.toolTitle}</span>
                      </label>
                    {/each}
                  </div>
                </div>

                <!-- Commands -->
                <div class="form-group">
                  <label for="shell-commands" class="block text-sm font-medium mb-1">Commands</label
                  >
                  <input
                    id="shell-commands"
                    type="text"
                    bind:value={settings.shellCommands}
                    placeholder="ls, cat, grep, curl"
                    class="w-full p-2 rounded border bg-transparent"
                  />
                </div>
              </div>
            {/if}

            <!-- Connections -->
            {#if activeCategory === 'connections'}
              <h2 class="panel-title">Connections</h2>
              <div class="rounded-lg p-4 bg-[var(--surface-card)] space-y-4">
                <div class="form-group">
                  <label for="moku-web-url" class="block text-sm font-medium mb-1"
                    >Moku Web URL</label
                  >
                  <input
                    id="moku-web-url"
                    type="url"
                    bind:value={settings.mokuWebUrl}
                    placeholder="https://moku.holokai.com"
                    class="w-full p-2 rounded border bg-transparent"
                    onpaste={handleMokuWebUrlPaste}
                  />
                </div>

                <div class="form-group">
                  <label for="moku-api-url" class="block text-sm font-medium mb-1"
                    >Moku API URL</label
                  >
                  <input
                    id="moku-api-url"
                    type="url"
                    bind:value={settings.mokuApiUrl}
                    placeholder="https://api.moku.holokai.com"
                    class="w-full p-2 rounded border bg-transparent"
                  />
                </div>

                <div class="form-group">
                  <label for="holo-api-url" class="block text-sm font-medium mb-1"
                    >Holo API URL</label
                  >
                  <input
                    id="holo-api-url"
                    type="url"
                    bind:value={settings.holoApiUrl}
                    placeholder={DEFAULT_HOLO_API_URL}
                    class="w-full p-2 rounded border bg-transparent"
                  />
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
            <button onclick={saveSettings} disabled={!hasChanges} class="btn-primary">
              <i class="pi pi-check"></i>
              <span>Save</span>
            </button>
            <button onclick={cancelSettings} disabled={!hasChanges} class="btn-secondary">
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
    transition:
      background 0.15s,
      color 0.15s;
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

  .error-text {
    font-size: 0.75rem;
    color: var(--error-color);
    margin-top: 0.25rem;
  }

  /* Thread layout grid */
  .thread-layout-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.5rem;
  }

  .layout-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.75rem 0.5rem;
    border: 2px solid var(--input-border);
    border-radius: 0.5rem;
    background: transparent;
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s;
  }

  .layout-option:hover {
    border-color: var(--primary-color);
    background: var(--surface-hover, rgba(59, 130, 246, 0.05));
  }

  .layout-option.active {
    border-color: var(--primary-color);
    background: var(--surface-active, rgba(59, 130, 246, 0.1));
  }

  .layout-icon {
    font-size: 1.25rem;
  }

  .layout-label {
    font-size: 0.75rem;
    font-weight: 600;
  }

  .layout-desc {
    font-size: 0.625rem;
    color: var(--text-secondary);
    text-align: center;
  }

  /* Tools list */
  .tools-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
    border: 1px solid var(--input-border);
    border-radius: 0.375rem;
    max-height: 200px;
    overflow-y: auto;
  }

  .tool-item {
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
  }

  .tool-item:hover {
    background: var(--surface-hover, rgba(255, 255, 255, 0.05));
  }
</style>

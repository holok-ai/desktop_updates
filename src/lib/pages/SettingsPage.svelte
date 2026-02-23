<script lang="ts">
  import { onMount } from 'svelte';
  import type {
    AppSettings,
    AppThemeMode,
    AvatarType,
    StartingPage,
    ThreadLayout,
    ChatLayout,
    Tool as _Tool,
  } from '$lib/types/app.type';
  import type { ToolDefinition as _ToolDefinition } from '../../../src-electron/preload';
  import { defaultUserAvatar } from '$lib/types/app.type';
  import {
    APP_THEME_MODE,
    AVATAR_TYPE,
    AVATAR_COLORS,
    AVATAR_ICONS,
    STARTING_PAGE,
    THEME_OPTIONS,
    STARTING_PAGE_OPTIONS,
    THREAD_LAYOUT,
    THREAD_LAYOUT_OPTIONS,
    CHAT_LAYOUT,
    CHAT_LAYOUT_OPTIONS,
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
  let isDevelopmentBuild = $state(false);
  let showInstallConfirm = $state(false);
  let isInstalling = $state(false);

  // Tools list from ToolOrchestrator
  let availableTools: { toolId: string; toolTitle: string }[] = $state([]);

  let settings: AppSettings = $state({
    mokuWebUrl: '',
    mokuApiUrl: '',
    holoApiUrl: DEFAULT_HOLO_API_URL,
    directoryWhitelist: [],
    theme: APP_THEME_MODE.LIGHT,
    avatar: { ...defaultUserAvatar },
    startingPage: STARTING_PAGE.CREATE_CHAT as StartingPage,
    deleteConfirmationRequired: false,
    showRecentList: true,
    showFavoritesList: true,
    threadLayout: THREAD_LAYOUT.SINGLE_COL as ThreadLayout,
    chatFontSize: CHAT_FONT_SIZE_DEFAULT,
    chatLayout: CHAT_LAYOUT.LEFT_RIGHT as ChatLayout,
    enabledTools: [],
    shellCommands: '',
    windowsCommands: '',
    unixCommands: '',
    autoCheckUpdates: true,
    autoInstallUpdates: false,
    updateAvailable: false,
    latestVersion: '',
  });

  let savedSettings: AppSettings = $state({
    mokuWebUrl: '',
    mokuApiUrl: '',
    holoApiUrl: DEFAULT_HOLO_API_URL,
    directoryWhitelist: [],
    theme: APP_THEME_MODE.LIGHT,
    avatar: { ...defaultUserAvatar },
    startingPage: STARTING_PAGE.CREATE_CHAT as StartingPage,
    deleteConfirmationRequired: false,
    showRecentList: true,
    showFavoritesList: true,
    threadLayout: THREAD_LAYOUT.SINGLE_COL as ThreadLayout,
    chatFontSize: CHAT_FONT_SIZE_DEFAULT,
    chatLayout: CHAT_LAYOUT.LEFT_RIGHT as ChatLayout,
    enabledTools: [],
    shellCommands: '',
    windowsCommands: '',
    unixCommands: '',
    autoCheckUpdates: true,
    autoInstallUpdates: false,
    updateAvailable: false,
    latestVersion: '',
  });

  // Hidden file input ref for avatar image upload
  let avatarFileInput: HTMLInputElement | undefined = $state();

  function getAvatarBg(colorKey: string): string {
    return AVATAR_COLORS.find((c) => c.value === colorKey)?.bg ?? AVATAR_COLORS[0].bg;
  }

  function handleAvatarImageUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toastStore.show('Please select a PNG or image file', { variant: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      settings.avatar = {
        ...settings.avatar,
        type: AVATAR_TYPE.IMAGE as AvatarType,
        imageData: reader.result as string,
      };
    };
    reader.readAsDataURL(file);
  }

  onMount(async () => {
    const [all, version, devBuild] = await Promise.all([
      window.electronAPI.settings.getAll(),
      window.electronAPI.system.version(),
      window.electronAPI.updater.isDevelopmentBuild(),
    ]);
    isDevelopmentBuild = devBuild;

    settings = {
      mokuWebUrl: all.mokuWebUrl,
      mokuApiUrl: all.mokuApiUrl,
      holoApiUrl: all.holoApiUrl ?? DEFAULT_HOLO_API_URL,
      directoryWhitelist: [...(all.directoryWhitelist ?? [])],
      theme: (all.theme as AppThemeMode) || APP_THEME_MODE.LIGHT,
      avatar: all.avatar ? { ...defaultUserAvatar, ...all.avatar } : { ...defaultUserAvatar },
      startingPage: (all.startingPage as StartingPage) || STARTING_PAGE.CREATE_CHAT,
      deleteConfirmationRequired: all.deleteConfirmationRequired ?? false,
      showRecentList: all.showRecentList ?? true,
      showFavoritesList: all.showFavoritesList ?? true,
      threadLayout: (all.threadLayout as ThreadLayout) || THREAD_LAYOUT.SINGLE_COL,
      chatFontSize: all.chatFontSize ?? CHAT_FONT_SIZE_DEFAULT,
      chatLayout: (all.chatLayout as ChatLayout) || CHAT_LAYOUT.LEFT_RIGHT,
      enabledTools: [...(all.enabledTools ?? [])],
      shellCommands: all.shellCommands ?? '',
      windowsCommands: all.windowsCommands ?? '',
      unixCommands: all.unixCommands ?? '',
      autoCheckUpdates: all.autoCheckUpdates ?? true,
      autoInstallUpdates: all.autoInstallUpdates ?? false,
      updateAvailable: Boolean(all.updateAvailable ?? false),
      latestVersion: String(all.latestVersion ?? ''),
    };
    savedSettings = {
      ...settings,
      directoryWhitelist: [...settings.directoryWhitelist],
      enabledTools: [...settings.enabledTools],
      avatar: { ...settings.avatar },
    };
    appVersion = version;

    // Populate available tools from static_toolList
    if (all.static_toolList && all.static_toolList.length > 0) {
      availableTools = all.static_toolList.map((tool) => ({
        toolId: tool.name,
        toolTitle: tool.name,
      }));
    }

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

      // Serialize settings to plain objects to avoid Svelte proxy cloning issues
      await window.electronAPI.settings.setMultiple({
        mokuWebUrl: settings.mokuWebUrl,
        mokuApiUrl: settings.mokuApiUrl,
        holoApiUrl: settings.holoApiUrl,
        directoryWhitelist: [...settings.directoryWhitelist],
        avatar: { ...settings.avatar },
        startingPage: settings.startingPage,
        deleteConfirmationRequired: settings.deleteConfirmationRequired,
        showRecentList: settings.showRecentList,
        showFavoritesList: settings.showFavoritesList,
        threadLayout: settings.threadLayout,
        chatFontSize: settings.chatFontSize,
        chatLayout: settings.chatLayout,
        enabledTools: [...settings.enabledTools],
        shellCommands: settings.shellCommands,
        windowsCommands: settings.windowsCommands,
        unixCommands: settings.unixCommands,
        autoCheckUpdates: settings.autoCheckUpdates,
        autoInstallUpdates: settings.autoInstallUpdates,
        updateAvailable: settings.updateAvailable,
        latestVersion: settings.latestVersion,
      });

      savedSettings = {
        ...settings,
        directoryWhitelist: [...settings.directoryWhitelist],
        enabledTools: [...settings.enabledTools],
        avatar: { ...settings.avatar },
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
      avatar: { ...savedSettings.avatar },
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
      // see if there is an update
      const message = await window.electronAPI.updater.getUpdateAvailability();
      toastStore.show(message, { variant: 'info' });

      // now get the updated info from settings
      const updated = await window.electronAPI.settings.getAll();
      settings.latestVersion = updated.latestVersion ?? '';
      settings.updateAvailable = Boolean(updated.updateAvailable ?? false);

      if (settings.updateAvailable) {
        showInstallConfirm = true;
      }
    } catch {
      toastStore.show('Failed to check for updates', { variant: 'error' });
    } finally {
      isCheckingUpdates = false;
    }
  }

  async function handleInstallNow() {
    isInstalling = true;
    try {
      const result = await window.electronAPI.updater.updateNow();
      if (!result.success) {
        toastStore.show(result.error ?? 'Failed to start update download.', { variant: 'error' });
        showInstallConfirm = false;
      }
      // If successful, the app will quit and install — no need to hide the modal
    } catch {
      toastStore.show('Failed to start update download.', { variant: 'error' });
      showInstallConfirm = false;
    } finally {
      isInstalling = false;
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
      avatar: settings.avatar,
      startingPage: settings.startingPage,
      deleteConfirmationRequired: settings.deleteConfirmationRequired,
      showRecentList: settings.showRecentList,
      showFavoritesList: settings.showFavoritesList,
      threadLayout: settings.threadLayout,
      chatFontSize: settings.chatFontSize,
      chatLayout: settings.chatLayout,
      enabledTools: settings.enabledTools,
      shellCommands: settings.shellCommands,
      windowsCommands: settings.windowsCommands,
      unixCommands: settings.unixCommands,
      autoCheckUpdates: settings.autoCheckUpdates,
      autoInstallUpdates: settings.autoInstallUpdates,
    }) !==
      JSON.stringify({
        mokuWebUrl: savedSettings.mokuWebUrl,
        mokuApiUrl: savedSettings.mokuApiUrl,
        holoApiUrl: savedSettings.holoApiUrl,
        directoryWhitelist: savedSettings.directoryWhitelist,
        avatar: savedSettings.avatar,
        startingPage: savedSettings.startingPage,
        deleteConfirmationRequired: savedSettings.deleteConfirmationRequired,
        showRecentList: savedSettings.showRecentList,
        showFavoritesList: savedSettings.showFavoritesList,
        threadLayout: savedSettings.threadLayout,
        chatFontSize: savedSettings.chatFontSize,
        chatLayout: savedSettings.chatLayout,
        enabledTools: savedSettings.enabledTools,
        shellCommands: savedSettings.shellCommands,
        windowsCommands: savedSettings.windowsCommands,
        unixCommands: savedSettings.unixCommands,
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
            <!-- ==================== General ==================== -->
            {#if activeCategory === 'general'}
              <h2 class="panel-title">General</h2>
              <div class="category-card">
                <!-- Application Info -->
                <div class="subgroup-row">
                  <div class="subgroup-label">Application</div>
                  <div class="subgroup-controls">
                    <div class="info-row">
                      <span class="info-key">Version</span>
                      <span class="info-value">{appVersion}</span>
                    </div>
                  </div>
                </div>

                <div class="subgroup-divider"></div>

                <!-- Avatar -->
                <div class="subgroup-row">
                  <div class="subgroup-label">Avatar</div>
                  <div class="subgroup-controls">
                    <!-- Preview -->
                    <div class="avatar-preview-row">
                      <div
                        class="avatar-preview"
                        style:background-color={settings.avatar.type === 'image'
                          ? 'transparent'
                          : getAvatarBg(settings.avatar.bgColor)}
                      >
                        {#if settings.avatar.type === 'letters'}
                          <span class="avatar-letters">{settings.avatar.letters || 'Me'}</span>
                        {:else if settings.avatar.type === 'icon'}
                          <i class="pi {settings.avatar.icon} avatar-icon-display"></i>
                        {:else if settings.avatar.type === 'image' && settings.avatar.imageData}
                          <img src={settings.avatar.imageData} alt="Avatar" class="avatar-img" />
                        {:else}
                          <span class="avatar-letters">Me</span>
                        {/if}
                      </div>
                      <span class="text-xs" style="color: var(--text-secondary)">Preview</span>
                    </div>

                    <!-- Type selector -->
                    <div>
                      <span class="control-label">Type</span>
                      <div class="card-grid card-grid-3">
                        <button
                          class="option-card"
                          class:active={settings.avatar.type === 'letters'}
                          onclick={() =>
                            (settings.avatar = {
                              ...settings.avatar,
                              type: AVATAR_TYPE.LETTERS as AvatarType,
                            })}
                        >
                          <span class="option-card-icon">Aa</span>
                          <span class="option-card-label">Letters</span>
                        </button>
                        <button
                          class="option-card"
                          class:active={settings.avatar.type === 'icon'}
                          onclick={() =>
                            (settings.avatar = {
                              ...settings.avatar,
                              type: AVATAR_TYPE.ICON as AvatarType,
                            })}
                        >
                          <i class="pi pi-user option-card-icon" style="font-size: 1rem"></i>
                          <span class="option-card-label">Icon</span>
                        </button>
                        <button
                          class="option-card"
                          class:active={settings.avatar.type === 'image'}
                          onclick={() =>
                            (settings.avatar = {
                              ...settings.avatar,
                              type: AVATAR_TYPE.IMAGE as AvatarType,
                            })}
                        >
                          <span class="option-card-icon">🖼</span>
                          <span class="option-card-label">Image</span>
                        </button>
                      </div>
                    </div>

                    <!-- Letters input (when type === letters) -->
                    {#if settings.avatar.type === 'letters'}
                      <div>
                        <span class="control-label">Initials (1-3 characters)</span>
                        <input
                          type="text"
                          maxlength="3"
                          value={settings.avatar.letters}
                          oninput={(e) => {
                            const val = (e.target as HTMLInputElement).value.slice(0, 3);
                            settings.avatar = { ...settings.avatar, letters: val };
                          }}
                          placeholder="Me"
                          class="avatar-letters-input"
                        />
                      </div>
                    {/if}

                    <!-- Icon picker (when type === icon) -->
                    {#if settings.avatar.type === 'icon'}
                      <div>
                        <span class="control-label">Icon</span>
                        <div class="avatar-icon-grid">
                          {#each AVATAR_ICONS as ic}
                            <button
                              class="avatar-icon-option"
                              class:active={settings.avatar.icon === ic.value}
                              onclick={() =>
                                (settings.avatar = { ...settings.avatar, icon: ic.value })}
                              title={ic.label}
                            >
                              <i class="pi {ic.value}"></i>
                            </button>
                          {/each}
                        </div>
                      </div>
                    {/if}

                    <!-- Background color (when type !== image) -->
                    {#if settings.avatar.type !== 'image'}
                      <div>
                        <span class="control-label">Background Color</span>
                        <div class="avatar-color-grid">
                          {#each AVATAR_COLORS as color}
                            <button
                              class="avatar-color-swatch"
                              class:active={settings.avatar.bgColor === color.value}
                              style:background-color={color.bg}
                              onclick={() =>
                                (settings.avatar = { ...settings.avatar, bgColor: color.value })}
                              title={color.label}
                            ></button>
                          {/each}
                        </div>
                      </div>
                    {/if}

                    <!-- Image upload (when type === image) -->
                    {#if settings.avatar.type === 'image'}
                      <div>
                        <span class="control-label">Upload Image</span>
                        <input
                          bind:this={avatarFileInput}
                          type="file"
                          accept="image/png,image/jpeg,image/gif,image/webp"
                          onchange={handleAvatarImageUpload}
                          class="hidden"
                        />
                        <button class="btn-primary" onclick={() => avatarFileInput?.click()}>
                          Choose File
                        </button>
                      </div>
                    {/if}
                  </div>
                </div>

                <div class="subgroup-divider"></div>

                <!-- Confirmations -->
                <div class="subgroup-row">
                  <div class="subgroup-label">Confirmations</div>
                  <div class="subgroup-controls">
                    <label class="inline-flex items-center gap-2">
                      <input type="checkbox" bind:checked={settings.deleteConfirmationRequired} />
                      <span class="text-sm"
                        >Require confirmation to delete threads and projects?</span
                      >
                    </label>
                  </div>
                </div>
              </div>
            {/if}

            <!-- ==================== Appearance ==================== -->
            {#if activeCategory === 'appearance'}
              <h2 class="panel-title">Appearance</h2>
              <div class="category-card">
                <!-- Startup Page -->
                <div class="subgroup-row">
                  <div class="subgroup-label">Startup Page</div>
                  <div class="subgroup-controls">
                    <div class="card-grid card-grid-4">
                      {#each STARTING_PAGE_OPTIONS as opt}
                        <button
                          class="option-card"
                          class:active={settings.startingPage === opt.value}
                          onclick={() => (settings.startingPage = opt.value as StartingPage)}
                        >
                          <span class="option-card-icon">{opt.icon}</span>
                          <span class="option-card-label">{opt.label}</span>
                        </button>
                      {/each}
                    </div>
                  </div>
                </div>

                <div class="subgroup-divider"></div>

                <!-- Sidebar Options -->
                <div class="subgroup-row">
                  <div class="subgroup-label">Sidebar Options</div>
                  <div class="subgroup-controls">
                    <label class="inline-flex items-center gap-2">
                      <input type="checkbox" bind:checked={settings.showRecentList} />
                      <span class="text-sm">Show recent list</span>
                    </label>
                    <label class="inline-flex items-center gap-2">
                      <input type="checkbox" bind:checked={settings.showFavoritesList} />
                      <span class="text-sm">Show favorites list</span>
                    </label>
                  </div>
                </div>

                <div class="subgroup-divider"></div>

                <!-- Theme -->
                <div class="subgroup-row">
                  <div class="subgroup-label">Theme</div>
                  <div class="subgroup-controls">
                    <div class="card-grid card-grid-2">
                      {#each THEME_OPTIONS as opt}
                        <button
                          class="option-card"
                          class:active={settings.theme === opt.value}
                          onclick={() => (settings.theme = opt.value as AppThemeMode)}
                        >
                          <span class="option-card-icon">{opt.icon}</span>
                          <span class="option-card-label">{opt.label}</span>
                        </button>
                      {/each}
                    </div>
                  </div>
                </div>

                <div class="subgroup-divider"></div>

                <!-- Thread Format -->
                <div class="subgroup-row">
                  <div class="subgroup-label">Thread Format</div>
                  <div class="subgroup-controls space-y-4">
                    <!-- Thread View -->
                    <div>
                      <span class="control-label">Thread View</span>
                      <div class="card-grid card-grid-5">
                        {#each THREAD_LAYOUT_OPTIONS as opt}
                          <button
                            class="option-card"
                            class:active={settings.threadLayout === opt.value}
                            onclick={() => (settings.threadLayout = opt.value as ThreadLayout)}
                            title={opt.description}
                          >
                            <span class="option-card-icon">{opt.icon}</span>
                            <span class="option-card-label">{opt.label}</span>
                          </button>
                        {/each}
                      </div>
                    </div>

                    <!-- Chat Layout -->
                    <div>
                      <span class="control-label">Chat Layout</span>
                      <div class="card-grid card-grid-3">
                        {#each CHAT_LAYOUT_OPTIONS as opt}
                          <button
                            class="option-card"
                            class:active={settings.chatLayout === opt.value}
                            onclick={() => (settings.chatLayout = opt.value as ChatLayout)}
                          >
                            <span class="option-card-icon">{opt.icon}</span>
                            <span class="option-card-label">{opt.label}</span>
                          </button>
                        {/each}
                      </div>
                    </div>

                    <!-- Chat Text Size -->
                    <div>
                      <span class="control-label"
                        >Chat Text Size: <strong>{settings.chatFontSize}pt</strong></span
                      >
                      <div class="flex items-center gap-3 mt-1">
                        <span class="text-xs" style="color: var(--text-secondary)"
                          >{CHAT_FONT_SIZE_MIN}</span
                        >
                        <input
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
                  </div>
                </div>
              </div>
            {/if}

            <!-- ==================== Updates ==================== -->
            {#if activeCategory === 'updates'}
              <h2 class="panel-title">Updates</h2>
              <div class="category-card">
                <!-- Version Info -->
                <div class="subgroup-row">
                  <div class="subgroup-label">Version Info</div>
                  <div class="subgroup-controls">
                    <div class="info-row">
                      <span class="info-key">Current Version</span>
                      <span class="info-value">{appVersion}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-key">Latest Version</span>
                      <span class="info-value">
                        {#if isDevelopmentBuild}
                          Not Available In Development
                        {:else if settings.latestVersion}
                          {settings.latestVersion}{settings.latestVersion === appVersion
                            ? " (You've got the latest.)"
                            : ''}
                        {:else}
                          —
                        {/if}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="subgroup-divider"></div>

                <!-- Update Preferences -->
                <div class="subgroup-row">
                  <div class="subgroup-label">Preferences</div>
                  <div class="subgroup-controls">
                    <label class="inline-flex items-center gap-2">
                      <input type="checkbox" bind:checked={settings.autoCheckUpdates} />
                      <span class="text-sm">Check for updates on startup?</span>
                    </label>
                    <label class="inline-flex items-center gap-2">
                      <input type="checkbox" bind:checked={settings.autoInstallUpdates} />
                      <span class="text-sm">Install updates when available</span>
                    </label>
                  </div>
                </div>

                <div class="subgroup-divider"></div>

                <!-- Manual Check -->
                <div class="subgroup-row">
                  <div class="subgroup-label">Manual Check</div>
                  <div class="subgroup-controls">
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
                </div>
              </div>
            {/if}

            <!-- ==================== Tools ==================== -->
            {#if activeCategory === 'tools'}
              <h2 class="panel-title">Tools</h2>
              <div class="category-card">
                <!-- Allowed Directories -->
                <div class="subgroup-row">
                  <div class="subgroup-label">Allowed Directories</div>
                  <div class="subgroup-controls">
                    <FileToolsWhitelist bind:paths={settings.directoryWhitelist} />
                  </div>
                </div>

                <div class="subgroup-divider"></div>

                <!-- Enabled Tools -->
                <div class="subgroup-row">
                  <div class="subgroup-label">Enabled Tools</div>
                  <div class="subgroup-controls">
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
                </div>

                <div class="subgroup-divider"></div>

                <!-- Allowed Windows Commands -->
                <div class="subgroup-row">
                  <div class="subgroup-label">Allowed Windows Commands</div>
                  <div class="subgroup-controls">
                    <input
                      type="text"
                      bind:value={settings.windowsCommands}
                      placeholder="dir, type, findstr, curl"
                      class="w-full p-2 rounded border bg-transparent text-sm"
                    />
                  </div>
                </div>

                <div class="subgroup-divider"></div>

                <!-- Allowed Unix Commands -->
                <div class="subgroup-row">
                  <div class="subgroup-label">Allowed Unix Commands</div>
                  <div class="subgroup-controls">
                    <input
                      type="text"
                      bind:value={settings.unixCommands}
                      placeholder="ls, cat, grep, curl"
                      class="w-full p-2 rounded border bg-transparent text-sm"
                    />
                  </div>
                </div>
              </div>
            {/if}

            <!-- ==================== Connections ==================== -->
            {#if activeCategory === 'connections'}
              <h2 class="panel-title">Connections</h2>
              <div class="category-card">
                <!-- Moku Web URL -->
                <div class="subgroup-row">
                  <div class="subgroup-label">Moku Web URL</div>
                  <div class="subgroup-controls">
                    <input
                      id="moku-web-url"
                      type="url"
                      bind:value={settings.mokuWebUrl}
                      placeholder="https://moku.holokai.com"
                      class="w-full p-2 rounded border bg-transparent text-sm"
                      onpaste={handleMokuWebUrlPaste}
                    />
                  </div>
                </div>

                <div class="subgroup-divider"></div>

                <!-- Moku API URL -->
                <div class="subgroup-row">
                  <div class="subgroup-label">Moku API URL</div>
                  <div class="subgroup-controls">
                    <input
                      id="moku-api-url"
                      type="url"
                      bind:value={settings.mokuApiUrl}
                      placeholder="https://api.moku.holokai.com"
                      class="w-full p-2 rounded border bg-transparent text-sm"
                    />
                  </div>
                </div>

                <div class="subgroup-divider"></div>

                <!-- Holo API URL -->
                <div class="subgroup-row">
                  <div class="subgroup-label">Holo API URL</div>
                  <div class="subgroup-controls">
                    <input
                      id="holo-api-url"
                      type="url"
                      bind:value={settings.holoApiUrl}
                      placeholder={DEFAULT_HOLO_API_URL}
                      class="w-full p-2 rounded border bg-transparent text-sm"
                    />
                    {#if holoApiUrlError}
                      <div class="error-text">{holoApiUrlError}</div>
                    {/if}
                  </div>
                </div>
              </div>
            {/if}

            <!-- ==================== Diagnostics ==================== -->
            {#if activeCategory === 'diagnostics'}
              <h2 class="panel-title">Diagnostics</h2>
              <div class="category-card">
                <!-- Application Log -->
                <div class="subgroup-row">
                  <div class="subgroup-label">Application Log</div>
                  <div class="subgroup-controls">
                    <div>
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

{#if showInstallConfirm}
  <div class="install-overlay">
    <div class="install-modal">
      <p>Install version <strong>{settings.latestVersion}</strong>?</p>
      <div class="install-actions">
        <button class="btn-primary" onclick={handleInstallNow} disabled={isInstalling}>
          {isInstalling ? 'Downloading...' : 'Install Now'}
        </button>
        <button
          class="btn-secondary"
          onclick={() => (showInstallConfirm = false)}
          disabled={isInstalling}
        >
          I'll Do It Later
        </button>
      </div>
    </div>
  </div>
{/if}

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

  /* ── Sidebar navigation ── */
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

  /* ── Right panel ── */
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

  /* ── Category card (wraps all subgroups) ── */
  .category-card {
    border-radius: 0.5rem;
    padding: 0;
    background: var(--surface-card);
  }

  /* ── Subgroup row: label on the left, controls on the right ── */
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

  /* ── Control label (nested inside subgroup-controls) ── */
  .control-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 0.375rem;
  }

  /* ── Info rows (key-value pairs) ── */
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

  /* ── Compact card grid (for all option selectors) ── */
  .card-grid {
    display: grid;
    gap: 0.375rem;
  }

  .card-grid-2 {
    grid-template-columns: repeat(2, 1fr);
  }

  .card-grid-3 {
    grid-template-columns: repeat(3, 1fr);
  }

  .card-grid-4 {
    grid-template-columns: repeat(4, 1fr);
  }

  .card-grid-5 {
    grid-template-columns: repeat(5, 1fr);
  }

  .option-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
    padding: 0.5rem 0.375rem;
    border: 2px solid var(--input-border);
    border-radius: 0.375rem;
    background: transparent;
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s;
  }

  .option-card:hover {
    border-color: var(--primary-color);
    background: var(--surface-hover, rgba(59, 130, 246, 0.05));
  }

  .option-card.active {
    border-color: var(--primary-color);
    background: var(--surface-active, rgba(59, 130, 246, 0.1));
  }

  .option-card-icon {
    font-size: 1rem;
    line-height: 1;
  }

  .option-card-label {
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 1.2;
  }

  /* ── Footer ── */
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
    max-width: 760px;
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

  /* ── Tools list ── */
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

  /* ── Avatar editor ── */
  .avatar-preview-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .avatar-preview {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }

  .avatar-letters {
    font-size: 1rem;
    font-weight: 700;
    color: #fff;
    text-transform: uppercase;
    line-height: 1;
    letter-spacing: 0.5px;
  }

  .avatar-icon-display {
    font-size: 1.25rem;
    color: #fff;
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-letters-input {
    width: 80px;
    padding: 0.375rem 0.5rem;
    border-radius: 0.375rem;
    border: 1px solid var(--input-border);
    background: transparent;
    text-align: center;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .avatar-icon-grid {
    display: flex;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .avatar-icon-option {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--input-border);
    border-radius: 0.375rem;
    background: transparent;
    cursor: pointer;
    font-size: 1rem;
    transition:
      border-color 0.15s,
      background 0.15s;
  }

  .avatar-icon-option:hover {
    border-color: var(--primary-color);
    background: var(--surface-hover, rgba(59, 130, 246, 0.05));
  }

  .avatar-icon-option.active {
    border-color: var(--primary-color);
    background: var(--surface-active, rgba(59, 130, 246, 0.1));
  }

  .avatar-color-grid {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .avatar-color-swatch {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 3px solid transparent;
    cursor: pointer;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  .avatar-color-swatch:hover {
    box-shadow: 0 0 0 2px var(--primary-color);
  }

  .avatar-color-swatch.active {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px var(--primary-color);
  }

  .hidden {
    display: none;
  }

  .install-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .install-modal {
    background: var(--surface-card, #fff);
    border-radius: 10px;
    padding: 1.75rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
    color: var(--text-primary, #111);
    min-width: 280px;
  }

  .install-modal p {
    margin: 0;
    font-size: 0.9375rem;
  }

  .install-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }
</style>

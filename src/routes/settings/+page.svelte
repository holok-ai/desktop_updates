<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.store';
  import { APP_THEME_MODE, APP_THEME_MODE_STORAGE_KEY } from '$lib/constants/app.constant';
  import type { AppThemeMode } from '$lib/types/app.type';

  let isLoading = $state(false);
  let currentMode: AppThemeMode = $state(APP_THEME_MODE.LIGHT);

  onMount(() => {
    const stored = localStorage.getItem(APP_THEME_MODE_STORAGE_KEY) as AppThemeMode | null;
    setMode(stored === APP_THEME_MODE.DARK ? APP_THEME_MODE.DARK : APP_THEME_MODE.LIGHT);
  });

  function setMode(mode: AppThemeMode) {
    currentMode = mode;
    const html = document.documentElement;
    if (mode === APP_THEME_MODE.DARK) html.classList.add(APP_THEME_MODE.DARK);
    else html.classList.remove(APP_THEME_MODE.DARK);
    localStorage.setItem(APP_THEME_MODE_STORAGE_KEY, mode);
  }

  function toggleTheme() {
    setMode(currentMode === APP_THEME_MODE.DARK ? APP_THEME_MODE.LIGHT : APP_THEME_MODE.DARK);
  }

  async function handleLogout() {
    try {
      await window.electronAPI.auth.logout();
    } catch (e) {
      console.error('Logout failed', e);
    } finally {
      authStore.logout();
      // Ensure UI resets to login screen consistently in E2E
      location.reload();
    }
  }
</script>

<div class="mx-auto">
  <div class="flex justify-between items-center mb-6">
    <h1>Settings</h1>
  </div>

  {#if isLoading}
    <div class="loading">Loading settings...</div>
  {:else}
    <section class="mb-6">
      <h2 class="mb-4">Preferences</h2>
      <div class="rounded-lg p-4 bg-white dark:bg-black border border-gray-200 dark:border-none">
        <div class="preferences-row">
          <div>
            <span class="font-medium">Theme</span>
            <p class="text-sm">Switch between light and dark modes.</p>
          </div>
          <button
            class="toggle bg-white dark:bg-black"
            onclick={toggleTheme}
            aria-label="Toggle theme"
          >
            <i class={currentMode === APP_THEME_MODE.DARK ? 'pi pi-sun' : 'pi pi-moon'}></i>
            <span class="text-black dark:text-white"
              >{currentMode === APP_THEME_MODE.DARK ? 'Dark' : 'Light'}</span
            >
          </button>
        </div>
      </div>
    </section>

    <button class="logout" onclick={handleLogout} aria-label="Logout">Logout</button>
  {/if}
</div>

<style>
  .loading {
    text-align: center;
    padding: 3rem;
  }

  .preferences-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid #d0d0d0;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
  }

  .logout {
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid #ef4444;
    background: #ef4444;
    color: #fff;
    cursor: pointer;
  }
</style>

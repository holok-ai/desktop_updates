<script lang="ts">
  import { onMount } from 'svelte';

  let whitelistPaths = $state<string[]>([]);
  let newPath = $state('');
  let errorMessage = $state('');
  let isLoading = $state(true);

  onMount(async () => {
    await loadWhitelist();
    isLoading = false;
  });

  async function loadWhitelist() {
    try {
      whitelistPaths = await window.electronAPI.settings.getFileToolsWhitelist();
    } catch (error) {
      errorMessage = 'Failed to load whitelist';
      console.error('Failed to load whitelist:', error);
    }
  }

  async function addPath() {
    if (!newPath.trim()) {
      errorMessage = 'Path cannot be empty';
      return;
    }

    try {
      await window.electronAPI.settings.addWhitelistPath(newPath.trim());
      whitelistPaths = await window.electronAPI.settings.getFileToolsWhitelist();
      newPath = '';
      errorMessage = '';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to add path';
    }
  }

  async function selectFolder() {
    try {
      const path = await window.electronAPI.settings.selectFolder();
      if (path) {
        await window.electronAPI.settings.addWhitelistPath(path);
        whitelistPaths = await window.electronAPI.settings.getFileToolsWhitelist();
        errorMessage = '';
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to select folder';
    }
  }

  async function removePath(path: string) {
    try {
      await window.electronAPI.settings.removeWhitelistPath(path);
      whitelistPaths = await window.electronAPI.settings.getFileToolsWhitelist();
      errorMessage = '';
    } catch (error) {
      errorMessage = 'Failed to remove path';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      void addPath();
    }
  }
</script>

<div class="whitelist-section">
  <div class="mb-4">
    <h3 class="text-base font-semibold mb-1">File Tools Whitelist</h3>
    <p class="text-xs text-gray-500">
      Specify trusted folders for LLM file system access. LLMs can only read files within these
      folders when using file tools.
    </p>
  </div>

  {#if isLoading}
    <div class="text-sm text-gray-500">Loading whitelist...</div>
  {:else}
    <div class="mb-4">
      <div class="flex gap-2">
        <input
          type="text"
          bind:value={newPath}
          onkeydown={handleKeydown}
          placeholder="Enter folder path (e.g., /home/user/projects)"
          class="flex-1 p-2 rounded border bg-transparent text-sm"
        />
        <button
          onclick={addPath}
          class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
        >
          Add
        </button>
        <button
          onclick={selectFolder}
          class="px-4 py-2 rounded border hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
        >
          Browse...
        </button>
      </div>

      {#if errorMessage}
        <div class="mt-2 text-xs text-red-500">{errorMessage}</div>
      {/if}
    </div>

    {#if whitelistPaths.length === 0}
      <div class="text-sm text-gray-500 p-4 rounded border border-dashed">
        No whitelisted folders. Add folders to allow LLM file system access.
      </div>
    {:else}
      <ul class="space-y-2">
        {#each whitelistPaths as path}
          <li class="flex items-center justify-between p-3 rounded border bg-[var(--surface-card)]">
            <span class="text-sm font-mono flex-1 truncate" title={path}>{path}</span>
            <button
              onclick={() => removePath(path)}
              class="ml-3 px-3 py-1 rounded text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Remove
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>


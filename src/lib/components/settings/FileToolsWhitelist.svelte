<script lang="ts">
  // Paths are bound from parent settings state (save/cancel controlled at page level)
  let { paths = $bindable<string[]>() } = $props();

  let newPath = $state('');
  let errorMessage = $state('');

  function isAbsolutePath(p: string): boolean {
    // Basic cross-platform absolute path check: Unix (/foo) or Windows (C:\foo or C:/foo)
    return /^([A-Za-z]:[\\/]|\/)/.test(p);
  }

  function addPath() {
    const trimmed = newPath.trim();
    if (!trimmed) {
      errorMessage = 'Path cannot be empty';
      return;
    }

    if (!isAbsolutePath(trimmed)) {
      errorMessage = 'Path must be absolute (e.g., /Users/name/project or C:\\\\path\\\\to\\\\folder)';
      return;
    }

    if (paths.includes(trimmed)) {
      // Silently ignore duplicates
      errorMessage = '';
      newPath = '';
      return;
    }

    paths = [...paths, trimmed];
    newPath = '';
    errorMessage = '';
  }

  function selectFolder() {
    // Let parent handle actual folder picking & settings persistence; here we just mark change via callback
    void (async () => {
      try {
        const selected = await window.electronAPI.settings.selectFolder();
        if (!selected) return;

        if (!paths.includes(selected)) {
          paths = [...paths, selected];
        }
        errorMessage = '';
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : 'Failed to select folder';
      }
    })();
  }

  function removePath(pathToRemove: string) {
    paths = paths.filter((p: string) => p !== pathToRemove);
    errorMessage = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      addPath();
    }
  }
</script>

<div class="whitelist-section">
  <div class="mb-4">
    <h3 class="text-base font-semibold mb-1">Allow Access To Directories</h3>
    <p class="text-xs text-gray-500">
      Select directories where the Desktop application can read and write folders and files.
    </p>
  </div>

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
          class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm inline-flex items-center gap-1"
        >
          <i class="pi pi-plus text-xs"></i>
          <span class="text-white">Add</span>
        </button>
        <button
          onclick={selectFolder}
          class="px-4 py-2 rounded border bg-gray-900 hover:bg-gray-800 dark:hover:bg-gray-800 text-sm"
        >
          Browse...
        </button>
      </div>

      {#if errorMessage}
        <div class="mt-2 text-xs text-red-500">{errorMessage}</div>
      {/if}
    </div>

  {#if paths.length === 0}
    <div class="text-sm text-gray-500 p-4 rounded border border-dashed">
      No allowed directories. Use Add or Browse above to enter or select directories.
    </div>
  {:else}
    <ul class="space-y-2">
      {#each paths as path}
        <li class="flex items-center gap-3 p-3 rounded border bg-[var(--surface-card)]">
          <span class="text-sm font-mono flex-1 truncate" title={path}>{path}</span>
          <button
            onclick={() => removePath(path)}
            class="remove-btn flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded text-sm text-red-500 hover:text-red-400"
          >
            <i class="pi pi-trash"></i>
            <span class="text-white">Remove</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .remove-btn i {
    font-size: 0.75rem;
    width: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>

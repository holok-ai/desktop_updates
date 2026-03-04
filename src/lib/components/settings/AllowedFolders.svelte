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
      errorMessage =
        'Path must be absolute (e.g., /Users/name/project or C:\\\\path\\\\to\\\\folder)';
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
  <p class="help-text">
    Select directories where the Desktop application can read and write folders and files.
  </p>

  <div class="add-row">
    <input
      type="text"
      bind:value={newPath}
      onkeydown={handleKeydown}
      placeholder="Enter folder path (e.g., /home/user/projects)"
      class="flex-1 p-2 rounded border bg-transparent text-sm"
    />
    <button onclick={addPath} class="btn-primary">
      <i class="pi pi-plus"></i>
      <span>Add</span>
    </button>
    <button onclick={selectFolder} class="btn-primary">
      <i class="pi pi-folder"></i>
      <span>Browse...</span>
    </button>
  </div>

  {#if errorMessage}
    <div class="error-message">{errorMessage}</div>
  {/if}

  {#if paths.length === 0}
    <div class="no-folders-message">No allowed folders. Add folders using Add or Browse.</div>
  {:else}
    <ul class="space-y-2">
      {#each paths as path}
        <li class="path-item">
          <span class="path-text" title={path}>{path}</span>
          <button onclick={() => removePath(path)} class="btn-secondary remove-btn">
            <i class="pi pi-trash"></i>
            <span>Remove</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .whitelist-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .add-row {
    display: flex;
    gap: 0.5rem;
  }

  .help-text {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .error-message {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--error-color);
  }

  .no-folders-message {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .path-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 0.375rem;
    border: 1px solid var(--input-border);
    background: var(--input-background);
  }

  .path-text {
    font-size: 0.875rem;
    font-family: monospace;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-primary);
  }

  .remove-btn {
    flex-shrink: 0;
  }

  .remove-btn i {
    font-size: 0.75rem;
    color: var(--error-color);
  }
</style>

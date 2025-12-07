<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import type { ModelDetails } from '../../../src-electron/preload';

  const dispatch = createEventDispatcher();

  // Optional initial selection passed from parent (provider + id)
  export let initialSelection: { provider: string; id: string } | null = null;
  export let disabled: boolean = false;

  let models: ModelDetails[] = [];
  let loading = true;
  let error: string | null = null;
  let selectedKey: string = '';

  onMount(async () => {
    loading = true;
    try {
      // Fetch models from backend via IPC
      const fetchedModels = await window.electronAPI.models.listAll();
      models = fetchedModels;

      if (initialSelection) {
        selectedKey = initialSelection.provider + '::' + initialSelection.id;
      } else {
        // Select first model as default
        const pre = models[0];
        selectedKey = pre ? pre.provider + '::' + pre.id : '';
      }

      // Emit initial selection if any (mark as auto-selection)
      const m = parseSelected();
      if (m) dispatch('modelSelected', { model: m, isAuto: true });
    } catch (err: unknown) {
      // Make a best-effort error message
      error = (err as any)?.message ?? String(err);
    } finally {
      loading = false;
    }
  });

  function parseSelected(): ModelDetails | null {
    if (!selectedKey) return null;
    const parts = selectedKey.split('::');
    const provider = parts[0];
    const id = parts[1];
    const found = models.find((m) => m.provider === provider && m.id === id);
    return found ?? null;
  }

  function onChange() {
    const m = parseSelected();
    dispatch('modelSelected', { model: m, isAuto: false });
  }
</script>

<div class="model-chooser" role="group" aria-label="Model chooser">
  {#if loading}
    <div class="loading">Loading models…</div>
  {:else if error}
    <div class="error" role="alert">{error}</div>
  {:else}
    <label for="model-select" class="sr-only">Select model</label>
    <div class="control">
      <select
        id="model-select"
        bind:value={selectedKey}
        onchange={onChange}
        aria-label="Choose model"
        {disabled}
      >
        {#each models as m}
          <option value={m.provider + '::' + m.id}>{m.title}</option>
        {/each}
      </select>
    </div>
  {/if}
</div>

<style>
  .model-chooser {
    display: block;
    margin: var(--inline-spacing) 0;
  }
  .control {
    display: flex;
    gap: var(--inline-spacing);
    align-items: center;
  }
  select {
    padding: 12px;
    border-radius: var(--border-radius);
    border: 1px solid var(--surface-border);
    background: var(--surface-card);
    color: var(--text-primary);
    min-width: 200px;
  }

  select:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 20%, transparent);
  }

  .loading {
    color: var(--text-secondary);
  }
  .error {
    color: var(--error-color);
  }
  .sr-only {
    position: absolute !important;
    height: 1px;
    width: 1px;
    overflow: hidden;
    clip: rect(1px, 1px, 1px, 1px);
    white-space: nowrap;
  }
</style>

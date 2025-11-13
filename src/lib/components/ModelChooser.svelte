<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import type { MokuModel } from '../../../src-electron/preload';

  const dispatch = createEventDispatcher();

  // Optional initial selection passed from parent (provider + id)
  export let initialSelection: { provider: string; id: string } | null = null;
  export let disabled: boolean = false;

  let models: MokuModel[] = [];
  let loading = true;
  let error: string | null = null;
  let selectedKey: string = '';

  onMount(async () => {
    loading = true;
    try {
      // Guard window.electronAPI availability (web-only fallback or unexpected runtime)
      // If unavailable, provide a small in-component fallback list so the chooser
      // remains usable in non-Electron contexts (dev preview / web).
      const win: any = typeof window !== 'undefined' ? window : undefined;
      if (
        win &&
        win.electronAPI &&
        win.electronAPI.models &&
        typeof win.electronAPI.models.listAvailable === 'function'
      ) {
        models = await win.electronAPI.models.listAvailable();
      } else {
        // Fallback sample models for non-electron environments
        models = [
          {
            provider: 'openai',
            id: 'gpt-4o',
            title: 'GPT-4o',
            available: true,
            default: true,
            createdAt: Date.now(),
          },
          {
            provider: 'openai',
            id: 'gpt-3.5',
            title: 'GPT-3.5',
            available: true,
            createdAt: Date.now(),
          },
        ];
        // Do not treat this as an error; show no error so UI can function.
        error = null;
      }

      if (initialSelection) {
        selectedKey = initialSelection.provider + '::' + initialSelection.id;
      } else {
        const pre = models.find((m) => m.default) ?? models[0];
        selectedKey = pre ? pre.provider + '::' + pre.id : '';
      }

      // Emit initial selection if any
      const m = parseSelected();
      if (m) dispatch('modelSelected', m);
    } catch (err: unknown) {
      // Make a best-effort error message
      error = (err as any)?.message ?? String(err);
    } finally {
      loading = false;
    }
  });

  function parseSelected(): MokuModel | null {
    if (!selectedKey) return null;
    const parts = selectedKey.split('::');
    const provider = parts[0];
    const id = parts[1];
    const found = models.find((m) => m.provider === provider && m.id === id);
    return found ?? null;
  }

  function onChange() {
    const m = parseSelected();
    dispatch('modelSelected', m);
  }

  function confirm() {
    const m = parseSelected();
    if (m) dispatch('confirm', m);
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
        <option value="">-- Select a model --</option>
        {#each models as m}
          <option value={m.provider + '::' + m.id}>{m.title} — {m.provider}</option>
        {/each}
      </select>
      <button class="model-confirm" onclick={confirm} disabled={!selectedKey || disabled}>
        Use
      </button>
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
    padding: var(--inline-spacing);
    border-radius: var(--border-radius);
    border: 1px solid var(--surface-border);
    background: var(--surface-card);
    color: var(--text-primary);
  }
  .model-confirm {
    background: var(--primary-color);
    color: var(--primary-color-text);
    border: 1px solid var(--primary-color);
    padding: var(--inline-spacing) calc(var(--inline-spacing) * 2);
    border-radius: var(--border-radius);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .model-confirm:hover:not(:disabled) {
    background: var(--primary-600);
    border-color: var(--primary-600);
  }

  .model-confirm:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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

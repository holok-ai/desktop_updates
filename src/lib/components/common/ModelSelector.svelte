<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import type { ModelDetails } from '../../../../src-electron/preload';

  interface Props {
    selectedModelId?: string | null;
    disabled?: boolean;
    label?: string;
  }

  let {
    selectedModelId = $bindable(null),
    disabled = false,
    label = 'Model'
  }: Props = $props();

  const dispatch = createEventDispatcher<{
    select: {
      modelId: string;
      modelDetails: ModelDetails;
      appSlug: string;
      modelSlug: string;
    };
  }>();

  let showDropdown = $state(false);
  let availableModels: ModelDetails[] = $state([]);
  let loadingModels = $state(false);
  let containerRef: HTMLDivElement | undefined = $state();

  // Sorted models by application then model name
  const sortedModels = $derived.by(() => {
    return [...availableModels].sort((a, b) => {
      // First sort by provider/application
      const providerCompare = a.provider.localeCompare(b.provider);
      if (providerCompare !== 0) return providerCompare;
      // Then sort by model title
      return a.title.localeCompare(b.title);
    });
  });

  async function loadModels() {
    if (availableModels.length > 0) return;
    loadingModels = true;
    try {
      availableModels = await window.electronAPI.models.listAll();
      // Select first model by default if none selected
      if (!selectedModelId && availableModels.length > 0) {
        const firstModel = availableModels[0];
        selectedModelId = firstModel.accessName;
        // Dispatch initial selection
        const appSlug = firstModel.provider.toLowerCase().replace(/\s+/g, '-');
        const modelSlug = firstModel.accessName;
        dispatch('select', {
          modelId: firstModel.accessName,
          modelDetails: firstModel,
          appSlug,
          modelSlug
        });
      }
    } catch (error) {
      console.error('[ModelSelector] Error loading models:', error);
    } finally {
      loadingModels = false;
    }
  }

  function handleToggleDropdown() {
    if (!showDropdown) {
      loadModels();
    }
    showDropdown = !showDropdown;
  }

  async function handleSelectModel(modelId: string) {
    try {
      const modelDetails = availableModels.find((m) => m.accessName === modelId);
      if (!modelDetails) {
        console.error('[ModelSelector] Model not found:', modelId);
        return;
      }

      selectedModelId = modelId;
      showDropdown = false;

      // Extract appSlug and modelSlug from the model details
      const appSlug = modelDetails.provider.toLowerCase().replace(/\s+/g, '-');
      const modelSlug = modelDetails.accessName;

      dispatch('select', { modelId, modelDetails, appSlug, modelSlug });
    } catch (error) {
      console.error('[ModelSelector] Error selecting model:', error);
    }
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.model-selector-container') && showDropdown) {
      showDropdown = false;
    }
  }

  onMount(() => {
    // Load models on mount to select first model by default
    loadModels();

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  const displayText = $derived.by(() => {
    if (selectedModelId) {
      const model = availableModels.find(m => m.accessName === selectedModelId);
      if (model) {
        return `${model.title} (${model.provider})`;
      }
      return selectedModelId;
    }
    return 'Select model';
  });
</script>

<div class="model-selector-container" bind:this={containerRef}>
  {#if label}
    <label for="model-selector" class="model-selector-label">{label}</label>
  {/if}
  <button
    id="model-selector"
    class="model-selector-button"
    onclick={handleToggleDropdown}
    disabled={disabled}
    aria-label="Select model"
    title="Select model"
  >
    <span class="model-name">{displayText}</span>
    <span class="dropdown-arrow">▾</span>
  </button>

  {#if showDropdown}
    <div class="model-selector-dropdown">
      {#if loadingModels}
        <div class="dropdown-item loading">Loading models...</div>
      {:else if availableModels.length === 0}
        <div class="dropdown-item empty">No models available</div>
      {:else}
        {#each sortedModels as model (model.id)}
          <button
            class="dropdown-item"
            class:selected={model.accessName === selectedModelId}
            onclick={() => handleSelectModel(model.accessName)}
          >
            <input
              type="checkbox"
              checked={model.accessName === selectedModelId}
              readonly
              aria-hidden="true"
              tabindex="-1"
            />
            <span class="model-title">{model.title} ({model.provider})</span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .model-selector-container {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .model-selector-label {
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .model-selector-button {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    background: var(--surface-main);
    border: none;
    color: var(--text-primary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: color 0.2s;
    border-radius: 4px;
  }

  .model-selector-button:hover:not(:disabled) {
    color: var(--holokai-blue);
  }

  .model-selector-button:focus {
    outline: none;
  }

  .model-selector-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .model-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dropdown-arrow {
    font-size: 0.7rem;
    opacity: 0.6;
    color: var(--text-secondary);
    transition: color 0.2s;
    margin-left: 0.125rem;
  }

  .model-selector-button:hover:not(:disabled) .dropdown-arrow {
    color: var(--holokai-blue);
    opacity: 0.8;
  }

  .model-selector-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 0.25rem;
    background: var(--surface-main);
    border: 1px solid var(--input-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    max-height: 300px;
    overflow-y: auto;
    width: max-content;
  }

  :global(html.dark) .model-selector-dropdown {
    background: var(--surface-main);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s;
  }

  .dropdown-item:not(.loading):not(.empty):hover {
    background: var(--surface-hover);
  }

  .dropdown-item.selected {
    background: color-mix(in srgb, var(--primary-color) 10%, transparent);
  }

  .dropdown-item.loading,
  .dropdown-item.empty {
    cursor: default;
    color: var(--text-secondary);
  }

  .dropdown-item input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    flex-shrink: 0;
    pointer-events: none;
  }

  .model-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>

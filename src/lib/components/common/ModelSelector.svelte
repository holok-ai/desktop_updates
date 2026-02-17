<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import type { ModelDetails } from '../../../../src-electron/preload';
  import { modelService } from '$lib/services/model.service';

  interface Props {
    selectedModelId?: string | null;
    agentId?: string | null;
    disabled?: boolean;
    label?: string;
    dropdownDirection?: 'up' | 'down';
    backgroundColor?: string;
    allowMultipleSelections?: boolean;
  }

  let {
    selectedModelId = $bindable(null),
    agentId = null,
    disabled = false,
    label = 'Model',
    dropdownDirection = 'down',
    backgroundColor = 'var(--surface-main)',
    allowMultipleSelections = false,
  }: Props = $props();

  const dispatch = createEventDispatcher<{
    select: {
      modelId: string;
      modelDetails: ModelDetails;
      appSlug: string;
      modelSlug: string;
      selectedModelIds: string[]; // All selected model IDs
    };
  }>();

  let showDropdown = $state(false);
  let availableModels: ModelDetails[] = $state([]);
  let loadingModels = $state(false);
  let containerRef: HTMLDivElement | undefined = $state();

  // Always use array for storing selections
  let selectedModelIds = $state<string[]>([]);

  // Sync internal selectedModelIds with bound selectedModelId prop and dispatch select event
  $effect(() => {
    if (
      selectedModelId &&
      !selectedModelIds.includes(selectedModelId) &&
      availableModels.length > 0
    ) {
      selectedModelIds = [selectedModelId];

      // Find model details and dispatch select event so parent gets full model info
      const modelDetails = availableModels.find((m) => m.accessName === selectedModelId);
      if (modelDetails) {
        dispatch('select', {
          modelId: selectedModelId,
          modelDetails,
          appSlug: modelDetails.applicationSlug,
          modelSlug: modelDetails.slug,
          selectedModelIds: [selectedModelId],
        });
      }
    }
  });

  // Sorted models by application then model name
  const sortedModels = $derived.by(() => {
    return [...availableModels].sort((a, b) => {
      // First sort by application name
      const appCompare = a.applicationName.localeCompare(b.applicationName);
      if (appCompare !== 0) return appCompare;
      // Then sort by model title
      return a.title.localeCompare(b.title);
    });
  });

  async function loadModels() {
    if (availableModels.length > 0) return;
    loadingModels = true;
    try {
      // If agentId is provided, fetch models for that specific application
      if (agentId) {
        console.log('[ModelSelector] Loading models for agentId:', agentId);
        availableModels = await modelService.getModelsForApplication(agentId);
      } else {
        console.log('[ModelSelector] Loading all models');
        availableModels = await window.electronAPI.models.listAll();
      }

      console.log('[ModelSelector] Loaded models:', availableModels.length);

      // Select first model by default ONLY if none selected AND no modelId bound from parent
      if (selectedModelIds.length === 0 && !selectedModelId && availableModels.length > 0) {
        const firstModel = availableModels[0];
        selectedModelIds = [firstModel.accessName];
        selectedModelId = firstModel.accessName;
        // Dispatch initial selection
        const appSlug = firstModel.applicationSlug;
        const modelSlug = firstModel.slug;
        dispatch('select', {
          modelId: firstModel.accessName,
          modelDetails: firstModel,
          appSlug,
          modelSlug,
          selectedModelIds: [...selectedModelIds], // Include array in initial selection
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
      // Freeze display text to prevent popup movement
      frozenDisplayText = displayText;
    } else {
      // Clear frozen text when closing
      frozenDisplayText = '';
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

      if (allowMultipleSelections) {
        // Toggle selection in array
        if (selectedModelIds.includes(modelId)) {
          selectedModelIds = selectedModelIds.filter((id) => id !== modelId);
        } else {
          selectedModelIds = [...selectedModelIds, modelId];
        }
      } else {
        // Single selection - toggle if clicking same model, otherwise replace
        if (selectedModelIds.includes(modelId)) {
          selectedModelIds = [];
        } else {
          selectedModelIds = [modelId];
        }
        showDropdown = false;
      }

      // Update bindable selectedModelId to first item (for backward compatibility)
      selectedModelId = selectedModelIds[0] || null;

      // Extract appSlug and modelSlug from the model details
      const appSlug = modelDetails.applicationSlug;
      const modelSlug = modelDetails.slug;

      dispatch('select', {
        modelId,
        modelDetails,
        appSlug,
        modelSlug,
        selectedModelIds: [...selectedModelIds], // Pass all selected model IDs
      });
    } catch (error) {
      console.error('[ModelSelector] Error selecting model:', error);
    }
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.model-selector-container') && showDropdown) {
      showDropdown = false;
      frozenDisplayText = ''; // Clear frozen text when closing
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

  // Store display text when dropdown opens to prevent movement
  let frozenDisplayText = $state('');

  const displayText = $derived.by(() => {
    // If dropdown is open, use frozen text to prevent button width changes
    if (showDropdown && frozenDisplayText) {
      return frozenDisplayText;
    }

    if (selectedModelIds.length === 0) {
      return 'Select model';
    }

    if (selectedModelIds.length === 1) {
      const model = availableModels.find((m) => m.accessName === selectedModelIds[0]);
      if (model) {
        return `${model.title} (${model.applicationName.toLowerCase()})`;
      }
      return selectedModelIds[0];
    }

    // Multiple selections
    return `${selectedModelIds.length} models selected`;
  });
</script>

<div class="model-selector-container" bind:this={containerRef}>
  {#if label}
    <label for="model-selector" class="model-selector-label">{label}</label>
  {/if}
  <button
    type="button"
    id="model-selector"
    class="model-selector-button"
    style="background: {backgroundColor};"
    onclick={handleToggleDropdown}
    {disabled}
    aria-label="Select model"
    title="Select model"
  >
    <span class="model-name">{displayText}</span>
    <span class="dropdown-arrow">▾</span>
  </button>

  {#if showDropdown}
    <div
      class="model-selector-dropdown"
      class:dropdown-up={dropdownDirection === 'up'}
      class:dropdown-down={dropdownDirection === 'down'}
    >
      {#if loadingModels}
        <div class="dropdown-item loading">Loading models...</div>
      {:else if availableModels.length === 0}
        <div class="dropdown-item empty">No models available</div>
      {:else}
        {#each sortedModels as model (model.id)}
          <button
            type="button"
            class="dropdown-item"
            class:selected={selectedModelIds.includes(model.accessName)}
            onclick={() => handleSelectModel(model.accessName)}
            title={model.intendedUse || ''}
          >
            <input
              type="checkbox"
              checked={selectedModelIds.includes(model.accessName)}
              readonly
              aria-hidden="true"
              tabindex="-1"
            />
            <span class="model-title">{model.title} ({model.applicationName.toLowerCase()})</span>
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
    left: 0;
    background: var(--surface-main);
    border: 1px solid var(--input-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    max-height: 300px;
    overflow-y: auto;
    width: max-content;
  }

  .dropdown-up {
    bottom: 100%;
    margin-bottom: 0.25rem;
  }

  .dropdown-down {
    top: 100%;
    margin-top: 0.25rem;
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

  .dropdown-item input[type='checkbox'] {
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

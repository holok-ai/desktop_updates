<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import type { ModelDetails, ApplicationSummary } from '../../../src-electron/preload';

  const dispatch = createEventDispatcher();

  interface Props {
    initialSelection?: string | null;
    disabled?: boolean;
  }

  let { initialSelection = null, disabled = false }: Props = $props();

  let applications: ApplicationSummary[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);
  let selectedAgentId: string = $state('');
  let selectedModelId: string = $state('');

  // Derived state
  let selectedAgent: ApplicationSummary | null = $state(null);
  let availableModels: ModelDetails[] = $state([]);

  $effect(() => {
    selectedAgent = applications.find((app) => app.id === selectedAgentId) ?? null;
    availableModels = selectedAgent?.models ?? [];
  });

  onMount(async () => {
    // Reset state on mount
    applications = [];
    selectedAgentId = '';
    selectedModelId = '';
    error = null;
    loading = true;

    try {
      // Fetch applications (agents) from backend via IPC
      const fetchedApplications = await window.electronAPI.models.listAllApplications();
      applications = fetchedApplications;

      if (initialSelection) {
        selectedAgentId = initialSelection;
      } else {
        // Select first agent as default
        const firstAgent = applications[0];
        selectedAgentId = firstAgent ? firstAgent.id : '';
      }

      // Auto-select first model in the agent
      if (selectedAgentId) {
        const agent = applications.find((app) => app.id === selectedAgentId);
        if (agent && agent.models && agent.models.length > 0) {
          selectedModelId = agent.models[0].id;
          dispatchSelection(agent.models[0], true);
        }
      }
    } catch (err: unknown) {
      error = (err as any)?.message ?? String(err);
    } finally {
      loading = false;
    }
  });

  function dispatchSelection(model: ModelDetails, isAuto: boolean) {
    dispatch('modelSelected', { model, isAuto });
  }

  function onAgentChange() {
    const agent = applications.find((app) => app.id === selectedAgentId);
    if (agent && agent.models && agent.models.length > 0) {
      // Auto-select first model in the new agent
      selectedModelId = agent.models[0].id;
      dispatchSelection(agent.models[0], false);
    }
  }

  function onModelChange() {
    const model = availableModels.find((m) => m.id === selectedModelId);
    if (model) {
      dispatchSelection(model, false);
    }
  }
</script>

<div class="agent-chooser" role="group" aria-label="Agent chooser">
  {#if loading}
    <div class="loading">Loading agents…</div>
  {:else if error}
    <div class="error" role="alert">{error}</div>
  {:else}
    <label for="agent-select" class="sr-only">Select agent</label>
    <div class="control">
      <select
        id="agent-select"
        bind:value={selectedAgentId}
        onchange={onAgentChange}
        aria-label="Choose agent"
        {disabled}
      >
        {#each applications as app}
          <option value={app.id}>{app.title}</option>
        {/each}
      </select>
    </div>
  {/if}
</div>

<!-- Model selector component for parent to place near prompt -->
{#if availableModels.length > 1}
  <select
    class="model-selector-compact"
    bind:value={selectedModelId}
    onchange={onModelChange}
    aria-label="Choose model"
    {disabled}
  >
    {#each availableModels as model}
      <option value={model.id}>{model.accessName}</option>
    {/each}
  </select>
{:else if availableModels.length === 1}
  <div class="model-label-compact">
    {availableModels[0].accessName}
  </div>
{/if}

<style>
  .agent-chooser {
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

  .model-selector-compact {
    padding: 4px 8px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.8125rem;
    cursor: pointer;
    border-radius: 4px;
  }

  .model-selector-compact:hover {
    background: var(--surface-hover);
  }

  .model-selector-compact:focus {
    outline: none;
    background: var(--surface-overlay);
  }

  .model-label-compact {
    padding: 4px 8px;
    color: var(--text-secondary);
    font-size: 0.8125rem;
    font-style: italic;
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

<script lang="ts">
  /**
   * ModelListCard - Displays available LLM models grouped by provider
   */
  import DashboardCard from './DashboardCard.svelte';
  import type { ModelsByProvider } from '$lib/types/dashboard.type';

  const { availableModels } = $props<{
    availableModels: ModelsByProvider;
  }>();

  let expandedProviders = $state<Record<string, boolean>>({});

  function toggleProvider(provider: string) {
    expandedProviders[provider] = !expandedProviders[provider];
  }

  const providers = $derived(Object.keys(availableModels || {}));
  const hasModels = $derived(providers.length > 0);
</script>

<DashboardCard title="Available LLM Models" icon="pi-microchip">
  {#snippet children()}
    {#if hasModels}
      <div class="providers-list">
        {#each providers as provider}
          <div class="provider-section">
            <button
              class="provider-header"
              onclick={() => toggleProvider(provider)}
              aria-expanded={expandedProviders[provider] ?? false}
            >
              <span class="provider-name">{provider}</span>
              <div class="provider-meta">
                <span class="model-count">{availableModels[provider].length} models</span>
                <i
                  class="pi pi-chevron-down"
                  class:expanded={expandedProviders[provider]}
                ></i>
              </div>
            </button>

            {#if expandedProviders[provider]}
              <div class="models-list">
                {#each availableModels[provider] as model}
                  <div class="model-item">
                    <i class="pi pi-circle-fill model-dot"></i>
                    <span class="model-name">{model}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-state">
        <i class="pi pi-inbox empty-icon"></i>
        <p class="empty-text">No models available</p>
        <p class="empty-hint">Models will appear here once chat providers are configured</p>
      </div>
    {/if}
  {/snippet}
</DashboardCard>

<style>
  .providers-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .provider-section {
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    overflow: hidden;
  }

  .provider-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--surface-overlay);
    border: none;
    cursor: pointer;
    transition: background 0.2s ease;
    font-size: 0.9375rem;
  }

  .provider-header:hover {
    background: var(--surface-hover, rgba(0, 0, 0, 0.05));
  }

  .provider-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .provider-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .model-count {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .pi-chevron-down {
    font-size: 0.75rem;
    color: var(--text-secondary);
    transition: transform 0.2s ease;
  }

  .pi-chevron-down.expanded {
    transform: rotate(180deg);
  }

  .models-list {
    padding: 0.5rem 1rem 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: var(--surface-card);
  }

  .model-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 4px;
    transition: background 0.2s ease;
  }

  .model-item:hover {
    background: var(--surface-overlay);
  }

  .model-dot {
    font-size: 0.5rem;
    color: var(--primary-color);
  }

  .model-name {
    font-size: 0.875rem;
    color: var(--text-primary);
    font-family: 'Courier New', monospace;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    text-align: center;
    flex: 1;
  }

  .empty-icon {
    font-size: 3rem;
    color: var(--text-secondary);
    opacity: 0.4;
    margin-bottom: 1rem;
  }

  .empty-text {
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
  }

  .empty-hint {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0;
    max-width: 300px;
  }
</style>

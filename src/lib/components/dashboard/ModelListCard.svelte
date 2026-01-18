<script lang="ts">
  /**
   * ModelListCard - Displays available LLM models grouped by application
   */
  import DashboardCard from './DashboardCard.svelte';
  import { push } from 'svelte-spa-router';
  import { ROUTE } from '$lib/constants/route.constant';
  import type { ApplicationSummary } from '../../../src-electron/preload';

  const { availableApplications } = $props<{
    availableApplications: ApplicationSummary[];
  }>();

  let expandedApplications = $state<Record<string, boolean>>({});

  function toggleApplication(appId: string) {
    expandedApplications[appId] = !expandedApplications[appId];
  }

  function handleChatClick(event: MouseEvent, agentId: string) {
    event.stopPropagation();
    const params = new URLSearchParams();
    params.set('createThread', 'true');
    params.set('agentId', agentId);
    push(`${ROUTE.THREADS}?${params.toString()}`);
  }

  const hasApplications = $derived((availableApplications || []).length > 0);
</script>

<DashboardCard title="Models by Agent" icon="pi-microchip">
  {#snippet children()}
    {#if hasApplications}
      <div class="applications-list">
        {#each availableApplications as application}
          <div class="application-section">
            <div
              class="application-header"
              aria-expanded={expandedApplications[application.id] ?? false}
            >
              <button
                class="application-toggle"
                onclick={() => toggleApplication(application.id)}
              >
                <div class="application-info">
                  <span class="application-name">{application.title}</span>
                  <span class="provider-name">{application.provider}</span>
                </div>
              </button>
              <div class="application-meta">
                <button
                  class="chat-button"
                  onclick={(e) => handleChatClick(e, application.id)}
                  title="Start a chat with {application.title}"
                >
                  chat
                </button>
                <span class="model-count">{application.models?.length || 0} models</span>
                <button
                  class="chevron-button"
                  onclick={() => toggleApplication(application.id)}
                  aria-label={expandedApplications[application.id] ? 'Collapse models list' : 'Expand models list'}
                >
                  <i
                    class="pi pi-chevron-down"
                    class:expanded={expandedApplications[application.id]}
                  ></i>
                </button>
              </div>
            </div>

            {#if expandedApplications[application.id]}
              <div class="models-list">
                {#each application.models || [] as model}
                  <div class="model-item">
                    <i class="pi pi-circle-fill model-dot"></i>
                    <span class="model-name">{model.accessName}</span>
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
        <p class="empty-text">No applications available</p>
        <p class="empty-hint">Applications will appear here once configured</p>
      </div>
    {/if}
  {/snippet}
</DashboardCard>

<style>
  .applications-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .application-section {
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    overflow: hidden;
  }

  .application-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--surface-overlay);
    transition: background 0.2s ease;
    font-size: 0.9375rem;
  }

  .application-header:hover {
    background: var(--surface-hover, rgba(0, 0, 0, 0.05));
  }

  .application-toggle {
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    flex: 1;
  }

  .application-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .application-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .provider-name {
    font-size: 0.75rem;
    font-style: italic;
    color: var(--text-secondary);
    font-weight: 400;
  }

  .chevron-button {
    background: transparent;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .application-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .chat-button {
    padding: 0.375rem 0.75rem;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: lowercase;
  }

  .chat-button:hover {
    background: var(--primary-color-hover, #2563eb);
    transform: translateY(-1px);
  }

  .chat-button:active {
    transform: translateY(0);
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

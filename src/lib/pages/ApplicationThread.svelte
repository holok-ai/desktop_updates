<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { ROUTE } from '$lib/constants/route.constant';
  import type { ApplicationSummary } from '../../../src-electron/preload';
  import { isAuthenticated } from '$lib/stores/auth.store';
  import { toastStore } from '$lib/services/toast.service';
  import { threadService } from '$lib/services/thread.service';

  let applications = $state<ApplicationSummary[]>([]);
  let isLoading = $state(true);
  let errorMessage = $state<string | null>(null);

  // Auth guard: redirect to login if not authenticated
  $effect(() => {
    if (!$isAuthenticated) {
      toastStore.show('Please log in to view applications.', { variant: 'info' });
      push(ROUTE.LOGIN);
    }
  });

  onMount(async () => {
    await loadApplications();
  });

  async function loadApplications() {
    try {
      isLoading = true;
      applications = await window.electronAPI.models.listAllApplications();
    } catch (error) {
      console.error('[ApplicationThread] Failed to load applications:', error);
      errorMessage = error instanceof Error ? error.message : 'Failed to load applications';
      toastStore.show('Failed to load applications', { variant: 'error' });
    } finally {
      isLoading = false;
    }
  }

  async function handleApplicationSelect(app: ApplicationSummary) {
    const firstModel = app.models?.[0];
    if (!firstModel) {
      toastStore.show('No models available for this application', { variant: 'error' });
      return;
    }

    try {
      // create a thread
      const thread = await threadService.create(
        `New ${app.title} Chat`,
        null, // projectId - no project context
        app.id, // agentId
        app.slug, // applicationSlug
        firstModel.id, // initialModel
      );

      if (!thread || !thread.id) {
        throw new Error('Failed to create thread');
      }

      // Navigate to the new thread page
      const params = new URLSearchParams();
      params.set('threadId', thread.id);
      push(`${ROUTE.THREAD}?${params.toString()}`);
    } catch (error) {
      console.error('[ApplicationThread] Failed to create thread:', error);
      const message = error instanceof Error ? error.message : 'Failed to create thread';
      toastStore.show(message, { variant: 'error' });
    }
  }
</script>

<div class="application-thread-page">
  {#if errorMessage}
    <div class="error-banner">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{errorMessage}</span>
      <button class="error-close" onclick={() => (errorMessage = null)} aria-label="Dismiss error">
        <i class="pi pi-times"></i>
      </button>
    </div>
  {/if}

  <div class="page-header">
    <h2>Let's chat</h2>
  </div>

  <div class="applications-container">
    {#if isLoading}
      <div class="loading-state">
        <i class="pi pi-spin pi-spinner"></i>
        <p>Loading applications...</p>
      </div>
    {:else if applications.length === 0}
      <div class="empty-state">
        <i class="pi pi-inbox"></i>
        <p>No applications available</p>
        <button class="btn-secondary" onclick={loadApplications}>
          <i class="pi pi-refresh"></i>
          Retry
        </button>
      </div>
    {:else}
      <div class="applications-grid">
        {#each applications as app (app.id)}
          <button class="application-card" onclick={() => handleApplicationSelect(app)}>
            <div class="card-header">
              <h3 class="app-title">{app.title}</h3>
              <span class="app-provider">{app.description}</span>
            </div>

            <div class="card-footer">
              <span class="select-hint">Chat</span>
              <i class="pi pi-arrow-right"></i>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .application-thread-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--surface-main);
    overflow: hidden;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--error-bg);
    color: var(--error-color);
    border: 1px solid var(--error-color);
    border-radius: 0.5rem;
    margin: 1rem;
  }

  .error-banner i.pi-exclamation-triangle {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .error-banner span {
    flex: 1;
  }

  .error-close {
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    transition: background-color 0.15s ease;
  }

  .error-close:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  .page-header {
    padding: 2rem 2rem 1rem;
    border-bottom: 1px solid var(--surface-border);
  }

  .page-header h2 {
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .applications-container {
    flex: 1;
    overflow-y: auto;
    padding: 2rem;
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 4rem 2rem;
    color: var(--text-secondary);
  }

  .loading-state i,
  .empty-state i {
    font-size: 3rem;
    opacity: 0.5;
  }

  .loading-state p,
  .empty-state p {
    font-size: 1rem;
    margin: 0;
  }

  .applications-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .application-card {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.1rem 1.5rem 1.5rem 1.5rem;
    background: var(--surface-card);
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
    position: relative;
  }

  :global(html.dark) .application-card {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .application-card:hover {
    background: var(--surface-hover);
    border-color: var(--primary-color);
  }

  .card-header {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .app-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .app-provider {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .select-hint {
    font-weight: 500;
  }

  .application-card:hover .card-footer {
    color: var(--primary-color);
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: var(--surface-card);
    color: var(--text-primary);
    border: 1px solid var(--surface-border);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-secondary:hover {
    background: var(--surface-hover);
    border-color: var(--holokai-blue);
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import { querystring } from 'svelte-spa-router';

  let projectId = $state<string | null>(null);
  let loading = $state(false);
  let error = $state('');
  let instructions = $state('');
  let isEditing = $state(false);

  // Parse projectId from query string
  $effect(() => {
    const qs = $querystring;
    if (qs) {
      const params = new URLSearchParams(qs);
      const id = params.get('projectId');
      if (id && id !== projectId) {
        projectId = id;
        void loadProjectInstructions(id);
      }
    }
  });

  async function loadProjectInstructions(id: string) {
    loading = true;
    error = '';
    try {
      // TODO: Load project instructions
      console.log('Loading instructions for project:', id);
      instructions = '';
    } catch (e) {
      console.error('Failed to load project instructions:', e);
      error = e instanceof Error ? e.message : 'Failed to load project instructions';
    } finally {
      loading = false;
    }
  }

  async function saveInstructions() {
    if (!projectId) return;

    try {
      // TODO: Save project instructions
      console.log('Saving instructions for project:', projectId);
      isEditing = false;
    } catch (e) {
      console.error('Failed to save project instructions:', e);
      error = e instanceof Error ? e.message : 'Failed to save project instructions';
    }
  }
</script>

<div class="project-instructions-page">
  <div class="page-content">
    {#if loading}
      <div class="loading-state">Loading instructions...</div>
    {:else if error}
      <div class="error-state">{error}</div>
    {:else}
      <div class="instructions-editor">
        {#if isEditing}
          <textarea
            bind:value={instructions}
            placeholder="Enter project instructions..."
            class="instructions-textarea"
          ></textarea>
        {:else}
          <div class="instructions-display">
            {#if instructions}
              <pre>{instructions}</pre>
            {:else}
              <p class="empty-message">No instructions yet. Click Edit to add instructions.</p>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .project-instructions-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--surface-main, #fafafa);
  }

  .page-content {
    flex: 1;
    padding: 1.5rem;
    overflow-y: auto;
  }

  .loading-state,
  .error-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: var(--text-secondary);
  }

  .error-state {
    color: var(--error-color, #dc2626);
  }

  .instructions-editor {
    max-width: 1000px;
    margin: 0 auto;
  }

  .instructions-textarea {
    width: 100%;
    min-height: 400px;
    padding: 1rem;
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    line-height: 1.6;
    resize: vertical;
  }

  .instructions-display {
    padding: 1rem;
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    min-height: 400px;
  }

  .instructions-display pre {
    margin: 0;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .empty-message {
    color: var(--text-secondary);
    font-style: italic;
  }
</style>

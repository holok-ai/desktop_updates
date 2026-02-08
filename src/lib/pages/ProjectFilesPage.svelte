<script lang="ts">
  import { onMount } from 'svelte';
  import { querystring } from 'svelte-spa-router';

  let projectId = $state<string | null>(null);
  let loading = $state(false);
  let error = $state('');

  // Parse projectId from query string
  $effect(() => {
    const qs = $querystring;
    if (qs) {
      const params = new URLSearchParams(qs);
      const id = params.get('projectId');
      if (id && id !== projectId) {
        projectId = id;
        void loadProjectFiles(id);
      }
    }
  });

  async function loadProjectFiles(id: string) {
    loading = true;
    error = '';
    try {
      // TODO: Load project files
      console.log('Loading files for project:', id);
    } catch (e) {
      console.error('Failed to load project files:', e);
      error = e instanceof Error ? e.message : 'Failed to load project files';
    } finally {
      loading = false;
    }
  }
</script>

<div class="project-files-page">
  <header class="page-header">
    <h1>Project Files</h1>
  </header>

  <div class="page-content">
    {#if loading}
      <div class="loading-state">Loading files...</div>
    {:else if error}
      <div class="error-state">{error}</div>
    {:else}
      <div class="files-list">
        <p>Project Files page for project: {projectId}</p>
        <!-- TODO: Add virtual files and folders UI -->
      </div>
    {/if}
  </div>
</div>

<style>
  .project-files-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--surface-main, #fafafa);
  }

  .page-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--surface-border, #e0e0e0);
    background: var(--surface-card, #fff);
  }

  .page-header h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
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

  .files-list {
    max-width: 1200px;
    margin: 0 auto;
  }
</style>

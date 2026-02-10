<script lang="ts">
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

<div class="page-container">
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
  .files-list {
    max-width: 1200px;
    margin: 0 auto;
  }
</style>

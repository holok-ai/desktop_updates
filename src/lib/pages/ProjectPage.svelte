<script lang="ts">
  import { querystring } from 'svelte-spa-router';
  import ProjectDetailView from '$lib/components/projects/ProjectDetailView.svelte';
  import { selectedProjectStore } from '$lib/stores/selected-project.store';
  import { storageService } from '$lib/services/storage.service';

  let projectId = $state<string | null>(null);

  // Extract projectId from query string and update selected project
  $effect(() => {
    const params = new URLSearchParams($querystring);
    const id = params.get('projectId');
    if (id && id !== projectId) {
      projectId = id;
      selectedProjectStore.select(id);
      storageService.setLastProjectId(id);
    }
  });

  const selectedProject = $derived($selectedProjectStore);
</script>

<div class="project-page">
  {#if selectedProject}
    <ProjectDetailView />
  {:else}
    <div class="loading">
      <i class="pi pi-spin pi-spinner"></i>
      <p>Loading project...</p>
    </div>
  {/if}
</div>

<style>
  .project-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--surface-main);
    overflow-y: auto;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 1rem;
    color: var(--text-secondary);
  }

  .loading i {
    font-size: 2rem;
  }
</style>

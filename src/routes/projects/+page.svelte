<script lang="ts">
  import { querystring } from 'svelte-spa-router';
  import ProjectsListPage from '$lib/pages/ProjectsListPage.svelte';
  import ProjectPage from '$lib/pages/ProjectPage.svelte';

  // Show ProjectPage if projectId exists in query string, otherwise show ProjectsListPage
  const hasProjectId = $derived(() => {
    const params = new URLSearchParams($querystring);
    return params.has('projectId');
  });
</script>

{#if hasProjectId()}
  <ProjectPage />
{:else}
  <ProjectsListPage />
{/if}

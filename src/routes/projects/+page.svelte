<script lang="ts">
  import { querystring } from 'svelte-spa-router';
  import ProjectsListPage from '$lib/pages/ProjectsListPage.svelte';
  import Project from '$lib/pages/Project.svelte';

  // Show Project if projectId exists in query string, otherwise show ProjectsListPage
  const hasProjectId = $derived(() => {
    const params = new URLSearchParams($querystring);
    return params.has('projectId');
  });
</script>

{#if hasProjectId()}
  <Project />
{:else}
  <ProjectsListPage />
{/if}

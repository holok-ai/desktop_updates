<script lang="ts">
  import { threadFacade as threadService } from '$lib/services/thread-facade';
  import { projectService } from '$lib/services/project.service';
  import type { Thread } from '../../../src-electron/preload.js';
  import type { Project } from '$lib/types/project.type';
  import ThreadListItem from '$lib/components/threads/ThreadListItem.svelte';
  import ProjectListItem from '$lib/components/projects/ProjectListItem.svelte';

  let searchQuery = $state('');
  let hasSearched = $state(false);
  let isSearching = $state(false);

  let matchedThreads = $state<Thread[]>([]);
  let matchedProjects = $state<Project[]>([]);

  async function handleSearch() {
    if (!searchQuery.trim()) {
      matchedThreads = [];
      matchedProjects = [];
      hasSearched = true;
      return;
    }

    isSearching = true;
    hasSearched = false;

    try {
      const term = searchQuery.trim().toLowerCase();

      const [threadsResult, projectsResult] = await Promise.all([
        threadService.getAll(),
        projectService.loadProjects(),
      ]);

      const allThreads = threadsResult.success ? (threadsResult.data ?? []) : [];
      const allProjects = projectsResult.success ? (projectsResult.data ?? []) : [];

      matchedThreads = allThreads.filter((t) => t.title?.toLowerCase().includes(term));

      matchedProjects = allProjects.filter(
        (p) => p.title?.toLowerCase().includes(term) || p.description?.toLowerCase().includes(term),
      );

      hasSearched = true;
    } finally {
      isSearching = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      void handleSearch();
    }
  }
</script>

<div class="search-page">
  <div class="page-header">
    <h2>Search</h2>
  </div>

  <div class="search-container">
    <div class="search-input-wrapper">
      <div class="search-bar">
        <i class="pi pi-search"></i>
        <input
          type="text"
          bind:value={searchQuery}
          onkeydown={handleKeydown}
          placeholder="Search threads, projects, and more..."
        />
      </div>
      <button class="btn-holokai search-button" onclick={handleSearch} disabled={isSearching}>
        <i class="pi pi-search"></i>
        <span>{isSearching ? 'Searching...' : 'Search'}</span>
      </button>
    </div>
    {#if hasSearched}
      <p class="results-summary">
        {#if matchedThreads.length === 0 && matchedProjects.length === 0}
          No search results.
        {:else}
          Search found {matchedThreads.length}
          {matchedThreads.length === 1 ? 'thread' : 'threads'} and {matchedProjects.length}
          {matchedProjects.length === 1 ? 'project' : 'projects'}.
        {/if}
      </p>
      {#if matchedThreads.length > 0}
        <div class="results-list">
          {#each matchedThreads as thread (thread.id)}
            <ThreadListItem {thread} />
          {/each}
        </div>
      {/if}
      {#if matchedProjects.length > 0}
        <div class="results-list">
          {#each matchedProjects as project (project.id)}
            <ProjectListItem {project} />
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .search-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: auto;
    padding: 1rem 2rem 2rem 2rem;
  }

  .page-header {
    margin-bottom: 2rem;
  }

  .page-header h2 {
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .search-container {
    width: 100%;
  }

  .search-input-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .search-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--input-background);
    border: 1px solid var(--input-border);
    border-radius: 6px;
    transition: border-color 0.2s ease;
  }

  .search-bar:focus-within {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--input-focus-shadow);
  }

  .search-bar i {
    color: var(--text-secondary);
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .search-bar input {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    font-size: 0.9375rem;
    color: var(--text-primary);
  }

  .search-bar input::placeholder {
    color: var(--text-secondary);
  }

  .search-button {
    align-self: flex-start;
  }

  .results-list {
    display: flex;
    flex-direction: column;
    margin-top: 1rem;
  }

  .results-summary {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0.5rem 0 0 0;
  }
</style>

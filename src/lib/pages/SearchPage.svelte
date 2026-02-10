<script lang="ts">
  // Search page component
  let searchQuery = $state('');
  let hasSearched = $state(false);

  function handleSearch() {
    if (!searchQuery.trim()) {
      return;
    }
    hasSearched = true;
    // Search functionality will be implemented here
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }
</script>

<div class="search-page">
  <div class="search-container">
    <div class="search-input-wrapper">
      <div class="search-input-container">
        <div class="search-icon">
          <i class="pi pi-search"></i>
        </div>
        <input
          type="text"
          bind:value={searchQuery}
          onkeydown={handleKeydown}
          placeholder="Search threads, projects, and more..."
          class="search-input"
        />
      </div>
      <button
        class="btn-holokai search-button"
        onclick={handleSearch}
      >
        <i class="pi pi-search"></i>
        <span>Search</span>
      </button>
    </div>
    {#if hasSearched}
      <div class="search-results">
        {#if searchQuery}
          <p class="no-results">Search functionality coming soon...</p>
        {:else}
          <p class="no-results">Enter a search query</p>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .search-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: auto;
  }

  .search-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 1rem 2rem 2rem 2rem; /* Reduced top padding from 2rem to 1rem */
    width: 100%;
  }

  .search-input-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 2rem;
  }

  .search-input-container {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .search-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 16px;
    background: var(--surface-main);
    color: var(--text-primary);
    font-size: 18px;
  }

  .search-input {
    flex: 1;
    padding: 12px 16px;
    font-size: 16px;
    border: 1px solid var(--input-border);
    border-radius: 8px;
    background: var(--input-background);
    color: var(--text-primary);
    outline: none;
    transition: border-color 0.2s ease;
  }

  .search-input:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--input-focus-shadow);
  }

  .search-button {
    align-self: flex-end;
  }

  .search-results {
    margin-top: 2rem;
  }

  .no-results {
    color: var(--text-secondary);
    text-align: center;
    padding: 2rem;
  }
</style>

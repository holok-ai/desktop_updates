<script lang="ts">
  /**
   * ResourcesCard - Displays documentation and help resources
   */
  import DashboardCard from './DashboardCard.svelte';
  import type { ResourceLink } from '$lib/types/dashboard.type';

  const RESOURCES: ResourceLink[] = [
    {
      title: 'Getting Started Guide',
      url: '#',
      description: 'Learn the basics and get up and running quickly',
    },
    {
      title: 'API Documentation',
      url: '#',
      description: 'Complete API reference and integration guides',
    },
    {
      title: 'Video Tutorials',
      url: '#',
      description: 'Step-by-step video walkthroughs',
    },
    {
      title: 'Community Forum',
      url: '#',
      description: 'Ask questions and connect with other users',
    },
    {
      title: 'Release Notes',
      url: '#',
      description: 'Latest features and updates',
    },
  ];
</script>

<DashboardCard title="Help & Resources" icon="pi-book">
  {#snippet children()}
    <div class="resources-list">
      {#each RESOURCES as resource}
        <a href={resource.url} class="resource-item" target="_blank" rel="noopener noreferrer">
          <div class="resource-content">
            <div class="resource-header">
              <span class="resource-title">{resource.title}</span>
              <i class="pi pi-external-link external-icon"></i>
            </div>
            {#if resource.description}
              <p class="resource-description">{resource.description}</p>
            {/if}
          </div>
        </a>
      {/each}
    </div>
  {/snippet}
</DashboardCard>

<style>
  .resources-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
  }

  .resource-item {
    display: block;
    padding: 0.75rem;
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .resource-item:hover {
    background: var(--surface-hover, rgba(0, 0, 0, 0.05));
    border-color: var(--primary-color);
    transform: translateX(2px);
  }

  .resource-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .resource-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .resource-title {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .external-icon {
    font-size: 0.75rem;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .resource-description {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.4;
  }
</style>

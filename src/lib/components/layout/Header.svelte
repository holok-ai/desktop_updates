<script lang="ts">
  import StatusBadge from '../common/StatusBadge.svelte';
  import * as Breadcrumb from '$lib/components/ui/breadcrumb';
  import { projects } from '$lib/stores/project.store';
  import { threads } from '$lib/stores/thread.store';
  import { breadcrumbStore } from '$lib/stores/breadcrumb.store';

  function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  // Resolve display labels from the breadcrumb queue, using live store data for threads/projects
  const breadcrumbItems = $derived.by(() => {
    const queue = $breadcrumbStore;
    if (queue.length === 0) return null;

    return queue.map((entry, index) => {
      let label = entry.label;

      // Resolve dynamic labels from stores
      if (entry.threadId) {
        const thread = $threads.find((t) => t.id === entry.threadId);
        label = thread ? truncate(thread.title || 'Untitled', 47) : label;
      } else if (entry.projectId) {
        const project = $projects.find((p) => p.id === entry.projectId);
        label = project ? truncate(project.title || 'Untitled', 47) : label;
      }

      const isLast = index === queue.length - 1;
      return { label, isLink: !isLast };
    });
  });

  function handleBreadcrumbClick(index: number) {
    const queue = breadcrumbStore.get();
    if (index >= queue.length - 1) return; // Last item is current page, not clickable
    breadcrumbStore.navigateBack(index);
  }
</script>

<header>
  {#if breadcrumbItems}
    <div class="breadcrumb-wrapper">
      <Breadcrumb.Breadcrumb>
        <Breadcrumb.BreadcrumbList>
          {#each breadcrumbItems as item, index}
            {#if index > 0}
              <Breadcrumb.BreadcrumbSeparator>→</Breadcrumb.BreadcrumbSeparator>
            {/if}
            <Breadcrumb.BreadcrumbItem>
              {#if item.isLink}
                <Breadcrumb.BreadcrumbLink onclick={() => handleBreadcrumbClick(index)}>
                  {item.label}
                </Breadcrumb.BreadcrumbLink>
              {:else}
                <Breadcrumb.BreadcrumbPage>{item.label}</Breadcrumb.BreadcrumbPage>
              {/if}
            </Breadcrumb.BreadcrumbItem>
          {/each}
        </Breadcrumb.BreadcrumbList>
      </Breadcrumb.Breadcrumb>
    </div>
  {/if}

  <div class="header-right">
    <StatusBadge />
  </div>
</header>

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 42px;
    padding: 0 24px;
    background: var(--surface-sidebar-primary);
    border-bottom: 1px solid var(--surface-border);
    gap: 2rem;
  }

  .breadcrumb-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
  }

  .breadcrumb-wrapper :global([data-slot='breadcrumb-page']) {
    color: var(--sidebar-text-normal);
    font-size: 14px;
    font-weight: 500;
  }

  .breadcrumb-wrapper :global([data-slot='breadcrumb-list']) {
    color: var(--sidebar-text-normal);
  }

  .breadcrumb-wrapper :global([data-slot='breadcrumb-link']) {
    color: var(--sidebar-text-muted);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .breadcrumb-wrapper :global([data-slot='breadcrumb-link']:hover) {
    color: var(--sidebar-text-full);
    text-shadow: 0 0 0.01px currentColor;
  }

  .breadcrumb-wrapper :global([data-slot='breadcrumb-separator']) {
    color: var(--sidebar-text-dim);
    margin: 0 0.5rem;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
</style>

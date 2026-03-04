<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { ROUTE } from '../../constants/route.constant';
  import UserAvatar from '../common/UserAvatar.svelte';
  import * as Breadcrumb from '$lib/components/ui/breadcrumb';
  import { projects } from '$lib/stores/project.store';
  import { threads } from '$lib/stores/thread.store';
  import { breadcrumbStore } from '$lib/stores/breadcrumb.store';

  function handleLogoClick() {
    breadcrumbStore.clearAndPush({ label: 'New Thread', route: ROUTE.HOME });
    push(ROUTE.HOME);
  }

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

    const entry = queue[index];
    breadcrumbStore.popTo(index);
    push(entry.route);
  }
</script>

<header>
  <button class="logo" onclick={handleLogoClick}>Holokai</button>

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

  <UserAvatar />
</header>

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 56px;
    padding: 0 24px;
    background: var(--surface-sidebar-primary);
    border-bottom: 1px solid var(--surface-border);
    gap: 2rem;
  }

  .logo {
    font-size: 18px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.2s ease;
    outline: none;
    flex-shrink: 0;
  }

  .logo:hover {
    color: rgba(255, 255, 255, 1);
  }

  .logo:focus {
    outline: none;
  }

  .logo:focus:not(:focus-visible) {
    outline: none;
  }

  .breadcrumb-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    margin-left: 50px;
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
    font-weight: 700;
  }

  .breadcrumb-wrapper :global([data-slot='breadcrumb-separator']) {
    color: var(--sidebar-text-dim);
    margin: 0 0.5rem;
  }
</style>

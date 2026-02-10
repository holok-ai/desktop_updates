<script lang="ts">
  import { push, location, querystring } from 'svelte-spa-router';
  import { ROUTE } from '../../constants/route.constant';
  import UserAvatar from '../common/UserAvatar.svelte';
  import * as Breadcrumb from '$lib/components/ui/breadcrumb';
  import { projects } from '$lib/stores/project.store';
  import { threads } from '$lib/stores/thread.store';

  function handleLogoClick() {
    push(ROUTE.HOME);
  }

  function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  // Determine breadcrumb structure based on current route
  const breadcrumbData = $derived.by(() => {
    const path = $location;
    const qs = $querystring;
    const params = new URLSearchParams(qs ?? '');

    // Handle Project Thread: Projects → Project Name → Thread Title
    if (path === ROUTE.PROJECT_THREAD) {
      const projectId = params.get('projectId');
      const threadId = params.get('threadId');
      const project = projectId ? $projects.find(p => p.id === projectId) : null;
      const thread = threadId ? $threads.find(t => t.id === threadId) : null;

      // Show project name if available, thread title or loading indicator
      if (project) {
        return {
          items: [
            { label: 'Projects', isLink: true },
            { label: truncate(project.title, 47), isLink: true },
            { label: thread ? truncate(thread.title || 'Untitled', 47) : 'Loading...', isLink: false }
          ]
        };
      }

      // Fallback if project not yet loaded
      return {
        items: [
          { label: 'Projects', isLink: true },
          { label: 'Loading...', isLink: false }
        ]
      };
    }

    // Handle Thread view (new ThreadPage route)
    if (path === ROUTE.THREAD) {
      const threadId = params.get('threadId');
      if (threadId) {
        const thread = $threads.find(t => t.id === threadId);
        if (thread) {
          return {
            items: [
              { label: 'Threads', isLink: true },
              { label: truncate(thread.title || 'Untitled', 47), isLink: false }
            ]
          };
        }
        // Thread not yet in store - show loading
        return {
          items: [
            { label: 'Threads', isLink: true },
            { label: 'Loading...', isLink: false }
          ]
        };
      }
      // No threadId - new thread view
      return { items: [{ label: 'New Thread', isLink: false }] };
    }

    // Handle Threads list
    if (path === ROUTE.THREADS) {
      return { items: [{ label: 'Threads', isLink: false }] };
    }

    // Handle Projects list page
    if (path === ROUTE.PROJECTS) {
      return { items: [{ label: 'Projects', isLink: false }] };
    }

    // Handle Project detail view
    if (path === ROUTE.PROJECTS_VIEW) {
      const projectId = params.get('projectId');
      if (projectId) {
        const project = $projects.find(p => p.id === projectId);
        if (project) {
          return {
            items: [
              { label: 'Projects', isLink: true },
              { label: truncate(project.title, 47), isLink: false }
            ]
          };
        }
      }
      return { items: [{ label: 'Projects', isLink: false }] };
    }

    // Handle Project Members: Projects → Project Name → Members
    if (path === ROUTE.PROJECT_MEMBERS) {
      const projectId = params.get('projectId');
      const project = projectId ? $projects.find(p => p.id === projectId) : null;

      if (project) {
        return {
          items: [
            { label: 'Projects', isLink: true },
            { label: truncate(project.title, 47), isLink: true },
            { label: 'Members', isLink: false }
          ]
        };
      }

      return {
        items: [
          { label: 'Projects', isLink: true },
          { label: 'Loading...', isLink: false }
        ]
      };
    }

    // Handle Project Files: Projects → Project Name → Files
    if (path === ROUTE.PROJECT_FILES) {
      const projectId = params.get('projectId');
      const project = projectId ? $projects.find(p => p.id === projectId) : null;

      if (project) {
        return {
          items: [
            { label: 'Projects', isLink: true },
            { label: truncate(project.title, 47), isLink: true },
            { label: 'Files', isLink: false }
          ]
        };
      }

      return {
        items: [
          { label: 'Projects', isLink: true },
          { label: 'Loading...', isLink: false }
        ]
      };
    }

    // Handle Project Instructions: Projects → Project Name → Instructions
    if (path === ROUTE.PROJECT_INSTRUCTIONS) {
      const projectId = params.get('projectId');
      const project = projectId ? $projects.find(p => p.id === projectId) : null;

      if (project) {
        return {
          items: [
            { label: 'Projects', isLink: true },
            { label: truncate(project.title, 47), isLink: true },
            { label: 'Instructions', isLink: false }
          ]
        };
      }

      return {
        items: [
          { label: 'Projects', isLink: true },
          { label: 'Loading...', isLink: false }
        ]
      };
    }

    // Map other routes to single breadcrumb
    let label = null;
    if (path === ROUTE.NEW_THREAD) {
      label = 'New Thread';
    } else if (path === ROUTE.SETTINGS) {
      label = 'Settings';
    } else if (path === '/' || path === '/search' || path.startsWith('/search')) {
      label = 'Search';
    }

    return label ? { items: [{ label, isLink: false }] } : null;
  });

  function handleBreadcrumbClick(index: number) {
    const path = $location;
    const qs = $querystring;
    const params = new URLSearchParams(qs ?? '');

    if (!breadcrumbData?.items) return;

    const firstItem = breadcrumbData.items[0].label;

    // Handle PROJECTS_VIEW breadcrumb navigation
    if (path === ROUTE.PROJECTS_VIEW) {
      if (index === 0 && firstItem === 'Projects') {
        // Click on "Projects" → go to projects list
        push(ROUTE.PROJECTS);
      }
      return;
    }

    // Handle PROJECT_THREAD breadcrumb navigation
    if (path === ROUTE.PROJECT_THREAD) {
      if (index === 0 && firstItem === 'Projects') {
        // Click on "Projects" → go to projects list
        push(ROUTE.PROJECTS);
      } else if (index === 1) {
        // Click on project name → go to that project
        const projectId = params.get('projectId');
        if (projectId) {
          push(`${ROUTE.PROJECTS_VIEW}?projectId=${projectId}`);
        }
      }
      return;
    }

    // Handle project sub-pages (Members, Files, Instructions) breadcrumb navigation
    if (path === ROUTE.PROJECT_MEMBERS || path === ROUTE.PROJECT_FILES || path === ROUTE.PROJECT_INSTRUCTIONS) {
      if (index === 0 && firstItem === 'Projects') {
        // Click on "Projects" → go to projects list
        push(ROUTE.PROJECTS);
      } else if (index === 1) {
        // Click on project name → go to that project
        const projectId = params.get('projectId');
        if (projectId) {
          push(`${ROUTE.PROJECTS_VIEW}?projectId=${projectId}`);
        }
      }
      return;
    }

    // Handle other routes
    if (index === 0 && breadcrumbData.items.length > 1) {
      if (firstItem === 'Projects') {
        push(ROUTE.PROJECTS);
      } else if (firstItem === 'Threads') {
        push(ROUTE.THREADS);
      }
    }
  }
</script>

<header>
  <button class="logo" onclick={handleLogoClick}>Holokai</button>

  {#if breadcrumbData}
    <div class="breadcrumb-wrapper">
      <Breadcrumb.Breadcrumb>
        <Breadcrumb.BreadcrumbList>
          {#each breadcrumbData.items as item, index}
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

  .breadcrumb-wrapper :global([data-slot="breadcrumb-page"]) {
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    font-weight: 500;
  }

  .breadcrumb-wrapper :global([data-slot="breadcrumb-list"]) {
    color: rgba(255, 255, 255, 0.7);
  }

  .breadcrumb-wrapper :global([data-slot="breadcrumb-link"]) {
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .breadcrumb-wrapper :global([data-slot="breadcrumb-link"]:hover) {
    color: var(--holokai-blue);
  }

  .breadcrumb-wrapper :global([data-slot="breadcrumb-separator"]) {
    color: rgba(255, 255, 255, 0.5);
    margin: 0 0.5rem;
  }
</style>

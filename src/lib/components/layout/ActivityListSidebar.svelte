<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { SidebarActivity } from '$lib/types/sidebar.type';
  import SidebarItem from '../common/SidebarItem.svelte';
  import AccordionSection from '../common/AccordionSection.svelte';
  import { threadService } from '$lib/services/thread.service';
  import { projectService } from '$lib/services/project.service';
  import { threads } from '$lib/stores/thread.store';
  import { projects } from '$lib/stores/project.store';
  import { ROUTE } from '$lib/constants/route.constant';
  import { push, querystring } from 'svelte-spa-router';
  import type { RoutePath } from '$lib/types/route.type';
  import type { Project } from '$lib/types/project.type';
  import type { Thread } from '../../../../src-electron/preload';

  const { activity } = $props<{ activity: SidebarActivity | null }>();
  const dispatch = createEventDispatcher();

  let isCollapsed = $state(false);
  let agentItems = $state<SidebarActivity[]>([]);
  let lastActivityId: string | null = null;

  let threadItems = $state<SidebarActivity[]>([]);
  let groupedThreadSections = $state<{ title: string; items: SidebarActivity[] }[]>([]);
  let selectedThreadId: string | null = $state(null);

  let projectItems = $state<SidebarActivity[]>([]);
  let groupedProjectSections = $state<{ title: string; items: SidebarActivity[] }[]>([]);
  let selectedProjectId: string | null = $state(null);

  const navigationOptions: SidebarActivity[] = [
    {
      id: 'new-thread',
      label: 'New Thread',
      shortLabel: 'New',
      icon: 'pi pi-pen-to-square',
      onClick: () => push(`${ROUTE.THREADS}?createThread`),
    },
    {
      id: 'new-project',
      label: 'New Project',
      shortLabel: 'New',
      icon: 'pi pi-folder-plus',
      onClick: () => push(`${ROUTE.PROJECTS}?createProject`),
    },
    {
      id: 'search-thread',
      label: 'Search Thread',
      shortLabel: 'Search',
      icon: 'pi pi-search',
      onClick: () => push(`${ROUTE.THREADS}?search`),
    },
  ];

  onMount(async () => {
    await getThreadItems();
    await getProjectItems();
  });

  $effect(() => {
    const unsub = querystring.subscribe((qs: string | undefined) => {
      const params = new URLSearchParams(qs ?? '');

      // Handle thread selection
      const tid = params.get('threadId');
      if (tid) {
        selectedThreadId = tid;
        try {
          window.localStorage.setItem('lastThreadId', tid);
        } catch (error) {
          console.error('Failed to set lastThreadId', error);
        }
      } else {
        // Fallback to last selected from localStorage
        try {
          const last = window.localStorage.getItem('lastThreadId');
          selectedThreadId = last;
        } catch {
          selectedThreadId = null;
        }
      }

      // Handle project selection
      const pid = params.get('projectId');
      if (pid) {
        selectedProjectId = pid;
        try {
          window.localStorage.setItem('lastProjectId', pid);
        } catch (error) {
          console.error('Failed to set lastProjectId', error);
        }
      } else {
        // Fallback to last selected from localStorage
        try {
          const last = window.localStorage.getItem('lastProjectId');
          selectedProjectId = last;
        } catch {
          selectedProjectId = null;
        }
      }
    });
    return unsub;
  });

  $effect(() => {
    if (lastActivityId === activity?.id) return;

    agentItems = getAgentItems();

    lastActivityId = activity?.id ?? null;
  });

  $effect(() => {
    // Filter threads based on current view
    let filteredThreads = $threads;
    if (activity?.id === 'projects' && selectedProjectId) {
      // When viewing a project, show only threads in that project
      filteredThreads = $threads.filter(
        (t) => (t.metadata?.projectId as string | undefined) === selectedProjectId,
      );
    } else if (activity?.id === 'threads') {
      // When viewing threads, show only threads without a project (general history)
      filteredThreads = $threads.filter((t) => !(t.metadata?.projectId as string | undefined));
    }

    threadItems = filteredThreads.map((t) => ({ id: t.id, label: t.title, route: ROUTE.THREADS }));
    groupedThreadSections = getGroupByTime(filteredThreads, ROUTE.THREADS);

    projectItems = $projects.map((p) => ({ id: p.id, label: p.title, route: ROUTE.PROJECTS }));
    groupedProjectSections = getGroupByTime($projects, ROUTE.PROJECTS);
  });

  function select(item: { id: string; label: string }) {
    dispatch('select', item);
    selectedThreadId = item.id;
    try {
      window.localStorage.setItem('lastThreadId', item.id);
    } catch (error) {
      console.error('Failed to set lastThreadId', error);
    }

    const route = (item as SidebarActivity).route;

    switch (route) {
      case ROUTE.THREADS:
        selectedThreadId = item.id;
        try {
          window.localStorage.setItem('lastThreadId', item.id);
        } catch (error) {
          console.error('Failed to set lastThreadId', error);
        }
        push(`${ROUTE.THREADS}?threadId=${encodeURIComponent(item.id)}`);
        break;
      case ROUTE.PROJECTS:
        selectedProjectId = item.id;
        try {
          window.localStorage.setItem('lastProjectId', item.id);
        } catch (error) {
          console.error('Failed to set lastProjectId', error);
        }
        push(`${ROUTE.PROJECTS}?projectId=${encodeURIComponent(item.id)}`);
        break;
      default:
        break;
    }
  }

  function toggleSidebar() {
    isCollapsed = !isCollapsed;
  }

  function getGroupByTime(items: Project[] | Thread[], route: RoutePath) {
    const sections: Record<string, SidebarActivity[]> = {
      Recent: [],
      Yesterday: [],
      'Last 7 Days': [],
      'Last 30 Days': [],
      Older: [],
    };

    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const todayStart = startOfDay(now).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    const toItem = (id: string, label: string): SidebarActivity => ({
      id,
      label,
      route: ROUTE.THREADS,
    });

    const sorted = [...items].sort((a, b) => {
      const aTime = new Date((a as any).updatedAt ?? a.createdAt).getTime();
      const bTime = new Date((b as any).updatedAt ?? b.createdAt).getTime();
      return bTime - aTime;
    });

    for (const t of sorted) {
      const created = new Date((t as any).updatedAt ?? t.createdAt);
      const cStart = startOfDay(created).getTime();
      const diffDays = Math.floor((todayStart - cStart) / oneDayMs);

      const item = toItem(t.id, (t as Thread).title ?? (t as Project).title);
      if (diffDays === 0) sections.Recent.push(item);
      else if (diffDays === 1) sections.Yesterday.push(item);
      else if (diffDays <= 7) sections['Last 7 Days'].push(item);
      else if (diffDays <= 30) sections['Last 30 Days'].push(item);
      else sections.Older.push(item);
    }

    return [
      { title: 'Recent', items: sections.Recent },
      { title: 'Yesterday', items: sections.Yesterday },
      { title: 'Last 7 Days', items: sections['Last 7 Days'] },
      { title: 'Last 30 Days', items: sections['Last 30 Days'] },
      { title: 'Older', items: sections.Older },
    ].filter((s) => s.items.length > 0);
  }

  function getAgentItems() {
    return [
      { id: 'agent-1', label: 'Assistant Bot' },
      { id: 'agent-2', label: 'Marketing Bot' },
    ];
  }

  async function getProjectItems() {
    try {
      await projectService.loadProjects();
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  }

  async function getThreadItems() {
    try {
      await threadService.getAll();
    } catch (error) {
      console.error('Failed to load threads:', error);
    }
  }
</script>

<aside
  class="activity-list-sidebar transition-all duration-300 {isCollapsed && 'collapsed'}"
  aria-label="Activity list sidebar"
>
  <div class="{isCollapsed ? 'p-0' : 'p-4'} flex items-center justify-between gap-2">
    {#if !isCollapsed}
      <span class="activity-title">{'Organization Name'}</span>
    {/if}
    <button
      class="{!isCollapsed &&
        'p-0'} bg-transparent text-black dark:text-white border-none cursor-pointer text-secondary font-size-1-4 text-center mt-2 focus:outline-none"
      onclick={toggleSidebar}
      aria-label="Collapse/Expand Activity List"
    >
      <i class={isCollapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'}></i>
    </button>
  </div>
  <div class="sidebar-scroll flex-1 overflow-y-auto">
    <ul class="list-items">
      {#if activity?.id === 'home'}
        {#each navigationOptions as item}
          <SidebarItem isSelected={false} {item} {isCollapsed} on:click={() => item.onClick?.()} />
        {/each}
        <AccordionSection
          title="Agents"
          isSubsection={true}
          isSidebarCollapsed={isCollapsed}
          items={agentItems}
          selectedId={null}
        />
        <AccordionSection
          title="Projects"
          isSubsection={true}
          isSidebarCollapsed={isCollapsed}
          items={projectItems}
          selectedId={activity?.id === 'projects' ? selectedProjectId : null}
          on:click={(e) => select(e.detail)}
        />
        <AccordionSection
          title="Threads"
          isSidebarCollapsed={isCollapsed}
          items={threadItems}
          isSubsection={true}
          showActions={true}
          selectedId={activity?.id === 'threads' ? selectedThreadId : null}
          on:click={(e) => select(e.detail)}
          on:delete={async (e) => {
            const item = e.detail as { id: string };
            if (item?.id?.startsWith('temp_')) {
              // Remove ephemeral thread locally
              threads.deleteThread(item.id);
              return;
            }
            try {
              await threadService.softDelete(item.id);
            } catch (err) {
              console.error('Failed to delete thread', err);
            }
          }}
        />
      {/if}
      {#if activity?.id === 'threads'}
        {#each groupedThreadSections as section}
          <AccordionSection
            title={section.title}
            isSidebarCollapsed={isCollapsed}
            isSubsection={true}
            items={section.items}
            showActions={true}
            selectedId={selectedThreadId}
            on:click={(e) => select(e.detail)}
            on:delete={async (e) => {
              const item = e.detail as { id: string };
              if (item?.id?.startsWith('temp_')) {
                threads.deleteThread(item.id);
                return;
              }
              try {
                await threadService.softDelete(item.id);
              } catch (err) {
                console.error('Failed to delete thread', err);
              }
            }}
          />
        {/each}
      {/if}
      {#if activity?.id === 'projects'}
        {#each groupedProjectSections as section}
          <AccordionSection
            title={section.title}
            isSidebarCollapsed={isCollapsed}
            isSubsection={true}
            items={section.items}
            showActions={false}
            selectedId={selectedProjectId}
            on:click={(e) => select(e.detail)}
          />
        {/each}
      {/if}
    </ul>
  </div>
</aside>

<style>
  .activity-list-sidebar {
    box-shadow: var(--sidebar-secondary-box-shadow);
    width: var(--sidebar-secondary-width, 280px);
    background: var(--surface-sidebar-secondary, #0f172a);
    color: var(--text-primary, #fff);
    border-right: 1px solid var(--border-sidebar, #1f2937);
    transition: all 0.3s ease;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .activity-list-sidebar.collapsed {
    width: var(--sidebar-secondary-collapsed, 48px);
  }
  .activity-title {
    flex: 1;
    font-weight: 600;
    font-size: 1rem;
    color: var(--text-primary, #fff);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .activity-list-sidebar.collapsed .activity-title,
  .activity-list-sidebar.collapsed span {
    display: none;
  }

  .list-items {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    padding: 1rem 0;
    margin: 0;
    gap: 0.5rem;
    transition:
      padding 0.2s,
      gap 0.2s;
  }

  .activity-list-sidebar.collapsed .list-items {
    align-items: center;
    justify-content: flex-start;
    padding-top: 0.5rem;
  }
  .sidebar-scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0; /* important for flex scroll containers */
    will-change: transform; /* prevents visual flicker during collapse */
    scrollbar-color: rgba(255, 255, 255, 0.7) transparent;
  }

  .sidebar-scroll::-webkit-scrollbar {
    width: 6px;
  }

  .sidebar-scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
</style>

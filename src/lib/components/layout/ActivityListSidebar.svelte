<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { SidebarActivity } from '$lib/types/sidebar.type';
  import SidebarItem from '../common/SidebarItem.svelte';
  import AccordionSection from '../common/AccordionSection.svelte';
  import { threadService } from '$lib/services/thread.service';
  import { threads } from '$lib/stores/thread.store';
  import { ROUTE } from '$lib/constants/route.constant';
  import { push } from 'svelte-spa-router';

  const { activity } = $props<{ activity: SidebarActivity | null }>();
  const dispatch = createEventDispatcher();

  let isCollapsed = $state(false);
  let agentItems = $state<SidebarActivity[]>([]);
  let projectItems = $state<SidebarActivity[]>([]);
  let threadItems = $state<SidebarActivity[]>([]);
  let groupedThreadSections = $state<{ title: string; items: SidebarActivity[] }[]>([]);
  let lastActivityId: string | null = null;

  const navigationOptions: SidebarActivity[] = [
    { id: 'new-thread', label: 'New Thread', shortLabel: 'New', icon: 'pi pi-pen-to-square', onClick: () => push(`${ROUTE.THREADS}?create`) },
    { id: 'search-thread', label: 'Search Thread', shortLabel: 'Search', icon: 'pi pi-search', onClick: () => push(`${ROUTE.THREADS}?search`) },
  ];

  onMount(async () => {
    await getThreadItems();
  });

  $effect(() => {
    if (lastActivityId === activity?.id) return;

    agentItems = getAgentItems();
    projectItems = getProjectItems();

    lastActivityId = activity?.id ?? null;
  });

  $effect(() => {
    threadItems = $threads.map((t) => ({ id: t.id, label: t.title, route: ROUTE.THREADS }));
    groupedThreadSections = groupThreadsByTime();
  });

  function select(item: { id: string; label: string }) {
    dispatch('select', item);

    if ((item as SidebarActivity).route === ROUTE.THREADS) {
      push(`${ROUTE.THREADS}?threadId=${encodeURIComponent(item.id)}`);
    }
  }

  function toggleSidebar() {
    isCollapsed = !isCollapsed;
  }

  function groupThreadsByTime() {
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

    const toItem = (id: string, label: string): SidebarActivity => ({ id, label, route: ROUTE.THREADS });

    const sorted = [...$threads].sort((a, b) => {
      const aTime = new Date((a as any).updatedAt ?? a.createdAt).getTime();
      const bTime = new Date((b as any).updatedAt ?? b.createdAt).getTime();
      return bTime - aTime;
    });

    for (const t of sorted) {
      const created = new Date((t as any).updatedAt ?? t.createdAt);
      const cStart = startOfDay(created).getTime();
      const diffDays = Math.floor((todayStart - cStart) / oneDayMs);

      const item = toItem(t.id, t.title);
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

  function getProjectItems() {
    return [
      { id: 'project-1', label: 'Moku Web 2.0' },
      { id: 'project-2', label: 'Holokai Desktop' },
    ];
  }

  async function getThreadItems() {
    try {
      await threadService.getAll();
    } catch (error) {
      console.error('Failed to load threads:', error);
    }
  }
</script>

<aside class="activity-list-sidebar transition-all duration-300 {isCollapsed && 'collapsed'}" aria-label="Activity list sidebar">
  <div class="{isCollapsed ? 'p-0' : 'p-4'} flex items-center justify-between gap-2">
    {#if !isCollapsed}
      <span class="activity-title">{'Organization Name'}</span>
    {/if}
    <button
      class="{!isCollapsed && 'p-0'} bg-transparent border-none cursor-pointer text-secondary font-size-1-4 text-center mt-2 focus:outline-none"
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
        <AccordionSection title="Agents" isSidebarCollapsed={isCollapsed} items={agentItems} />
        <AccordionSection title="Projects" isSidebarCollapsed={isCollapsed} items={projectItems} />
        <AccordionSection title="Threads" isSidebarCollapsed={isCollapsed} items={threadItems} on:click={(e) => select(e.detail)} />
      {/if}
      {#if activity?.id === 'threads'}
        {#each groupedThreadSections as section}
          <AccordionSection title={section.title} isSidebarCollapsed={isCollapsed} items={section.items} on:click={(e) => select(e.detail)} />
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
  .list-items {
    flex: 1;
    padding: 1rem 0;
    margin: 0;
    display: flex;
    flex-direction: column;
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
    transition: padding 0.2s, gap 0.2s;
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

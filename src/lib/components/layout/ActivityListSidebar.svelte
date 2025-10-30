<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { SidebarActivity } from '$lib/types/sidebar.type';

  const { activity } = $props<{activity: SidebarActivity | null }>();
  const dispatch = createEventDispatcher();

  let isCollapsed = $state(false);
  let selectedId = $state<string | null>(null);

  let activityItems = $state<SidebarActivity[]>([]);
  let lastActivityId: string | null = null;
  $effect(() => {
    if (lastActivityId === activity?.id) return;
    lastActivityId = activity?.id ?? null;
    switch (activity?.id) {
      case 'threads':
        activityItems = [
          { id: 'thread-1', label: 'Product Launch Plan' },
          { id: 'thread-2', label: 'AI Research Roadmap' },
          { id: 'thread-3', label: 'Next Sprint' }
        ];
        break;
      case 'agents':
        activityItems = [
          { id: 'agent-1', label: 'Assistant Bot' },
          { id: 'agent-2', label: 'Marketing Bot' }
        ];
        break;
      case 'projects':
        activityItems = [
          { id: 'project-1', label: 'Moku Web 2.0' },
          { id: 'project-2', label: 'Holokai Desktop' }
        ];
        break;
      case 'home':
      default:
        activityItems = [{ id: 'welcome', label: 'Welcome!' }];
    }
    selectedId = activityItems[0]?.id ?? null;
  });

  function select(item: { id: string; label: string }) {
    selectedId = item.id;
    dispatch('select', item);
  }
  function toggle() { isCollapsed = !isCollapsed; }

  function handleKey(e: KeyboardEvent, item: { id: string; label: string }) {
    if (e.key === 'Enter' || e.key === ' ') select(item);
  }
</script>

<aside class="activity-list-sidebar {isCollapsed ? 'collapsed' : ''}">
  <div class="list-header">
    {#if !isCollapsed}
      <span class="activity-title"
        ><i class={activity?.icon || 'pi pi-bars'}></i> {activity?.label ?? 'List'}</span
      >
    {/if}
    <button class="collapse-btn" onclick={toggle} aria-label="Collapse/Expand Activity List">
      <i class={isCollapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'}></i>
    </button>
  </div>
  <ul class="list-items">
    {#each activityItems as item}
      <li
        class:selected={selectedId === item.id}
        tabindex="0"
        role="menuitem"
        aria-label={item.label}
        onclick={() => select(item)}
        onkeydown={(e) => handleKey(e, item)}
        title={isCollapsed ? item.label : undefined}
      >
        <span class="dot"></span>
        {#if !isCollapsed}<span>{item.label}</span>{/if}
      </li>
    {/each}
  </ul>
</aside>

<style>
  .activity-list-sidebar {
    width: var(--sidebar-secondary-width, 280px);
    background: var(--surface-sidebar-secondary, #0f172a);
    color: var(--text-primary, #fff);
    border-right: 1px solid var(--border-sidebar, #1f2937);
    transition: width 0.2s;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .activity-list-sidebar.collapsed {
    width: var(--sidebar-secondary-collapsed, 48px);
  }
  .list-header {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border-sidebar, #1f2937);
    min-height: 56px;
    padding: 0 1rem;
    gap: 0.5rem;
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
  .collapse-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-secondary, #9ca3af);
    font-size: 1.2rem;
  }
  .list-items {
    flex: 1;
    padding: 1rem 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .list-items li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border-radius: 8px;
    cursor: pointer;
    color: var(--text-secondary, #9ca3af);
    padding: 0.75rem 1.25rem;
    transition:
      background 0.12s,
      color 0.12s;
    outline: none;
  }
  .list-items li:focus {
    outline: 2px solid var(--border-active, #3b82f6);
    background: var(--surface-hover, rgba(59, 130, 246, 0.08));
  }
  .list-items li.selected {
    background: var(--surface-hover, rgba(59, 130, 246, 0.13));
    color: var(--text-primary, #fff);
    border-left: 2px solid var(--border-active, #3b82f6);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--border-active, #3b82f6);
    display: inline-block;
  }
  .badge {
    margin-left: auto;
    background: #3b82f6;
    color: #fff;
    padding: 2px 8px;
    font-size: 0.8em;
    font-weight: 700;
    border-radius: 1rem;
  }
  .activity-list-sidebar.collapsed .activity-title,
  .activity-list-sidebar.collapsed span:not(.dot) {
    display: none;
  }
</style>

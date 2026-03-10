<script lang="ts">
  import { ROUTE } from '$lib/constants/route.constant';
  import type { Project } from '$lib/types/project.type';
  import { favorites } from '$lib/stores/favorite.store';
  import { breadcrumbStore } from '$lib/stores/breadcrumb.store';
  import { toastStore } from '$lib/services/toast.service';
  import { projectService } from '$lib/services/project.service';
  import ProjectRename from '$lib/modals/ProjectRename.svelte';
  import ProjectDelete from '$lib/modals/ProjectDelete.svelte';

  interface Props {
    project: Project;
  }

  let { project }: Props = $props();

  let showMenu = $state(false);
  let showRenameModal = $state(false);
  let showDeleteModal = $state(false);
  let projectToDelete = $state<Project | null>(null);

  const isFav = $derived($favorites.some((e) => e.id === project.id));

  function handleClick() {
    breadcrumbStore.navigateForward({
      label: project.title || 'Untitled',
      route: `${ROUTE.PROJECTS_VIEW}?projectId=${encodeURIComponent(project.id)}`,
      projectId: project.id,
    });
  }

  function handleMenuClick(e: MouseEvent) {
    e.stopPropagation();
    showMenu = !showMenu;
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.menu-container')) {
      showMenu = false;
    }
  }

  function handleToggleFavorite(e: MouseEvent) {
    e.stopPropagation();
    favorites.toggleFavorite(
      project.id,
      'project',
      project.title ?? '',
      `${ROUTE.PROJECTS_VIEW}?projectId=${project.id}`,
    );
    showMenu = false;
  }

  function handleRename(e: MouseEvent) {
    e.stopPropagation();
    showMenu = false;
    showRenameModal = true;
  }

  async function handleRenameConfirmed(
    event: CustomEvent<{ projectId: string; newTitle: string }>,
  ) {
    const { projectId, newTitle } = event.detail;
    try {
      await projectService.updateProject(projectId as any, { title: newTitle });
      toastStore.show('Project renamed', { variant: 'success' });
      showRenameModal = false;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to rename project';
      toastStore.show(msg, { variant: 'error' });
    }
  }

  function handleRenameCancel() {
    showRenameModal = false;
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    showMenu = false;
    projectToDelete = project;
    showDeleteModal = true;
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="project-item-container">
  <button class="project-item" onclick={handleClick}>
    <div class="project-item-title">
      <i class="pi pi-folder folder-icon"></i>
      <span class="title-text">{project.title || 'Untitled Project'}</span>
      {#if isFav}<i class="pi pi-star-fill fav-indicator"></i>{/if}
    </div>
    <div class="project-item-info">
      <span class="project-item-description">{project.description || ''}</span>
      <span class="project-item-type">{project.type === 'shared' ? 'Shared' : 'Private'}</span>
    </div>
  </button>

  <div class="menu-container">
    <button class="menu-trigger" onclick={handleMenuClick} aria-label="Project options">
      <i class="pi pi-ellipsis-h"></i>
    </button>
    {#if showMenu}
      <div class="context-menu" role="menu">
        <button class="menu-item" role="menuitem" onclick={handleToggleFavorite}>
          {isFav ? 'Remove Favorite' : 'Make Favorite'}
        </button>
        <button class="menu-item" role="menuitem" onclick={handleRename}> Rename </button>
        <hr class="menu-divider" />
        <button class="menu-item menu-item-danger" role="menuitem" onclick={handleDelete}>
          Delete Project
        </button>
      </div>
    {/if}
  </div>
</div>

{#if showRenameModal}
  <ProjectRename
    projectId={project.id}
    currentTitle={project.title}
    on:confirm={handleRenameConfirmed}
    on:cancel={handleRenameCancel}
  />
{/if}

<ProjectDelete bind:show={showDeleteModal} bind:project={projectToDelete} />

<style>
  .project-item-container {
    position: relative;
    display: flex;
    align-items: stretch;
    border-bottom: 1px solid var(--surface-border);
  }

  .project-item-container:hover {
    background: var(--surface-hover);
  }

  .project-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem 0.5rem 0.5rem 0;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    flex: 1;
  }

  .project-item:focus {
    outline: 2px solid var(--primary-color);
    outline-offset: -2px;
  }

  .project-item-title {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .folder-icon {
    font-size: 0.875rem;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .title-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fav-indicator {
    font-size: 0.75rem;
    color: #f59e0b;
    flex-shrink: 0;
  }

  .project-item-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    gap: 1rem;
  }

  .project-item-description {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project-item-type {
    flex-shrink: 0;
    font-style: italic;
  }

  .menu-container {
    position: relative;
    display: flex;
    align-items: flex-start;
    padding-top: 0.5rem;
  }

  .menu-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
    opacity: 0.5;
  }

  .project-item-container:hover .menu-trigger {
    opacity: 1;
  }

  .menu-trigger:hover {
    background: var(--surface-hover);
  }

  .menu-trigger i {
    font-size: 14px;
  }

  .context-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: var(--surface-card);
    border: 1px solid var(--input-border);
    border-radius: 0.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 160px;
    z-index: 1000;
    padding: 0.25rem 0;
  }

  :global(html.dark) .context-menu {
    background: var(--surface-overlay);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  }

  .menu-item {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s ease;
    display: block;
  }

  .menu-item:hover {
    background-color: var(--surface-hover);
  }

  .menu-item-danger {
    color: var(--action-delete-color, #ef4444);
  }

  .menu-divider {
    margin: 0.25rem 0;
    border: none;
    border-top: 1px solid var(--input-border);
    opacity: 0.5;
  }
</style>

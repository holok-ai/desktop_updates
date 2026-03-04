<script lang="ts">
  import { querystring, push } from 'svelte-spa-router';
  import { projects } from '$lib/stores/project.store';
  import { threads } from '$lib/stores/thread.store';
  import { threadFacade as threadService } from '$lib/services/thread-facade';
  import { projectService } from '$lib/services/project.service';
  import { ROUTE } from '$lib/constants/route.constant';
  import ThreadListItem from '$lib/components/threads/ThreadListItem.svelte';
  import EditableText from '$lib/components/common/EditableText.svelte';
  import { favorites } from '$lib/stores/favorite.store';
  import { breadcrumbStore } from '$lib/stores/breadcrumb.store';
  import type { GUID } from '$lib/types/app.type';

  let projectId = $state<string | null>(null);
  let localTitle = $state('');
  let localDescription = $state('');

  // Get project from store
  const project = $derived(projectId ? $projects.find((p) => p.id === projectId) : null);

  // Favorite status for this project
  const isFav = $derived(projectId ? $favorites.some((e) => e.id === projectId) : false);

  function toggleFavorite() {
    if (projectId) {
      favorites.toggleFavorite(
        projectId,
        'project',
        project?.title ?? '',
        `${ROUTE.PROJECTS_VIEW}?projectId=${projectId}`,
      );
    }
  }

  // Get project threads
  const projectThreads = $derived(
    $threads
      .filter((t) => t.projectId === projectId)
      .sort((a, b) => {
        const aTime =
          typeof a.updatedAt === 'number' ? a.updatedAt : new Date(a.updatedAt).getTime();
        const bTime =
          typeof b.updatedAt === 'number' ? b.updatedAt : new Date(b.updatedAt).getTime();
        return bTime - aTime;
      }),
  );

  // Count members by role
  const memberCounts = $derived.by(() => {
    if (!project?.members) return { owner: 0, editor: 0, viewer: 0 };

    const counts = { owner: 0, editor: 0, viewer: 0 };
    project.members.forEach((member: any) => {
      const role = member.memberRole?.toLowerCase() || 'viewer';
      if (role in counts) {
        counts[role as keyof typeof counts]++;
      }
    });
    return counts;
  });

  // Format member count display
  const memberCountsDisplay = $derived.by(() => {
    const lines: string[] = [];
    if (memberCounts.owner > 0) {
      lines.push(`${memberCounts.owner} ${memberCounts.owner === 1 ? 'owner' : 'owners'}`);
    }
    if (memberCounts.editor > 0) {
      lines.push(`${memberCounts.editor} ${memberCounts.editor === 1 ? 'editor' : 'editors'}`);
    }
    if (memberCounts.viewer > 0) {
      lines.push(`${memberCounts.viewer} ${memberCounts.viewer === 1 ? 'viewer' : 'viewers'}`);
    }
    return lines;
  });

  // File and folder counts (initialized to 0 until files feature is implemented)
  const fileCounts = $derived.by(() => {
    return {
      folders: 0,
      files: 0,
    };
  });

  // Instructions status
  const instructionsStatus = $derived.by(() => {
    const instructions = project?.metadata?.instructions;
    if (instructions && typeof instructions === 'string' && instructions.trim().length > 0) {
      const byteLength = new TextEncoder().encode(instructions).length;
      return `Instructions created. (${byteLength} characters)`;
    }
    return 'No instructions defined.';
  });

  // Sync local editable fields from store when project changes
  $effect(() => {
    if (project) {
      localTitle = project.title ?? '';
      localDescription = project.description ?? '';
    }
  });

  async function handleTitleChange(newTitle: string) {
    if (!projectId || !project) return;
    await projectService.updateProject(projectId as GUID, { title: newTitle });
    projects.updateProject({ ...project, title: newTitle });
  }

  async function handleDescriptionChange(newDesc: string) {
    if (!projectId || !project) return;
    await projectService.updateProject(projectId as GUID, { description: newDesc });
    projects.updateProject({ ...project, description: newDesc });
  }

  // Extract projectId from query string and load full project
  $effect(() => {
    const params = new URLSearchParams($querystring);
    const id = params.get('projectId');
    if (id && id !== projectId) {
      projectId = id;
      // Load full project with members and files
      projects.loadProject(id as GUID).catch((error) => {
        console.error('Failed to load project:', error);
      });
    }
  });

  // Load threads when project changes
  $effect(() => {
    if (projectId) {
      loadProjectThreads();
    }
  });

  async function loadProjectThreads() {
    if (!projectId) return;
    const result = await threadService.getAll({ projectId, updateStore: true });
    if (!result.success) {
      console.error('Failed to load project threads:', result.errorText);
    }
  }

  function handleNewThread() {
    if (!projectId) return;
    const targetRoute = `${ROUTE.PROJECT_NEW_THREAD}?projectId=${projectId}`;
    breadcrumbStore.push({ label: 'New Thread', route: targetRoute });
    push(targetRoute);
  }

  function handleMembersClick() {
    if (!projectId) return;
    const targetRoute = `${ROUTE.PROJECT_MEMBERS}?projectId=${projectId}`;
    breadcrumbStore.push({ label: 'Members', route: targetRoute });
    push(targetRoute);
  }

  function handleFilesClick() {
    if (!projectId) return;
    const targetRoute = `${ROUTE.PROJECT_FILES}?projectId=${projectId}`;
    breadcrumbStore.push({ label: 'Files', route: targetRoute });
    push(targetRoute);
  }

  function handleInstructionsClick() {
    if (!projectId) return;
    const targetRoute = `${ROUTE.PROJECT_INSTRUCTIONS}?projectId=${projectId}`;
    breadcrumbStore.push({ label: 'Instructions', route: targetRoute });
    push(targetRoute);
  }
</script>

{#if project}
  <div class="project-page">
    <div class="two-column-layout">
      <!-- Left Column -->
      <div class="left-column">
        <div class="title-row">
          <EditableText
            tag="h2"
            class="project-title"
            bind:value={localTitle}
            onChange={handleTitleChange}
            placeholder="Untitled Project"
          />
          <button
            class="favorite-star"
            class:is-favorited={isFav}
            onclick={toggleFavorite}
            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
          >
            <i class="pi {isFav ? 'pi-star-fill' : 'pi-star'}"></i>
          </button>
        </div>
        <EditableText
          tag="p"
          class="project-description"
          bind:value={localDescription}
          onChange={handleDescriptionChange}
          placeholder="Add a description..."
        />

        <!-- Threads Grid -->
        {#if projectThreads.length > 0}
          <div class="threads-section">
            <div class="threads-section-header">
              <h3>Threads</h3>
              <button class="new-thread-button" onclick={handleNewThread}>
                <i class="pi pi-plus"></i>
                New Thread
              </button>
            </div>
            <div class="threads-list">
              {#each projectThreads as thread (thread.id)}
                <ThreadListItem {thread} {projectId} />
              {/each}
            </div>
          </div>
        {:else}
          <div class="empty-threads">
            <button class="new-thread-button" onclick={handleNewThread}>
              <i class="pi pi-plus"></i>
              New Thread
            </button>
            <p>No threads yet. Click "+ New Thread" to get started.</p>
          </div>
        {/if}
      </div>

      <!-- Right Column -->
      <div class="right-column">
        <button class="info-card clickable-card" onclick={handleMembersClick}>
          <h4>Members</h4>
          {#if memberCountsDisplay.length > 0}
            <div class="member-counts">
              {#each memberCountsDisplay as line}
                <div class="member-count-line">{line}</div>
              {/each}
            </div>
          {:else}
            <p class="coming-soon">No members yet</p>
          {/if}
        </button>

        <button class="info-card clickable-card" onclick={handleFilesClick}>
          <h4>Files</h4>
          {#if fileCounts.folders > 0 || fileCounts.files > 0}
            <div class="file-counts">
              <div class="file-count-line">
                {fileCounts.folders}
                {fileCounts.folders === 1 ? 'folder' : 'folders'}
              </div>
              <div class="file-count-line">
                {fileCounts.files}
                {fileCounts.files === 1 ? 'file' : 'files'}
              </div>
            </div>
          {:else}
            <div class="file-counts">
              <div class="file-count-line">No folders</div>
              <div class="file-count-line">No files</div>
            </div>
          {/if}
        </button>

        <button class="info-card clickable-card" onclick={handleInstructionsClick}>
          <h4>Instructions</h4>
          <p class="instructions-status">{instructionsStatus}</p>
        </button>
      </div>
    </div>
  </div>
{:else}
  <div class="loading">
    <i class="pi pi-spin pi-spinner"></i>
    <p>Loading project...</p>
  </div>
{/if}

<style>
  .project-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    padding: 2rem 1.2rem;
    background: var(--surface-main);
  }

  .two-column-layout {
    display: flex;
    gap: 2rem;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  .left-column {
    flex: 1;
    min-width: 0;
    max-width: calc(100% - var(--project-right-column-max-width) - 2rem);
  }

  .right-column {
    width: 33%;
    max-width: var(--project-right-column-max-width);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 3.7rem;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  :global(.project-title) {
    margin: 0;
    text-align: left;
    max-width: 100%;
  }

  :global(.project-title.editable-editing) {
    flex: 1;
    min-width: 0;
  }

  .favorite-star {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    outline: none;
    background: transparent;
    border-radius: 6px;
    color: var(--text-secondary, #666);
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s,
      opacity 0.15s;
    flex-shrink: 0;
    font-size: 18px;
    opacity: 0;
  }

  .favorite-star:focus,
  .favorite-star:active {
    outline: none;
    box-shadow: none;
  }

  .title-row:hover .favorite-star {
    opacity: 1;
  }

  .favorite-star:hover {
    background: var(--surface-hover, #f0f0f0);
    color: #f59e0b;
  }

  .favorite-star.is-favorited {
    color: #f59e0b;
    opacity: 1;
  }

  .favorite-star.is-favorited:hover {
    color: #d97706;
  }

  :global(.project-description) {
    color: var(--text-primary);
    font-size: 1rem;
    line-height: 1.5;
    margin: 0 0 1.5rem 0;
    text-align: left;
  }

  .new-thread-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .new-thread-button:hover {
    background: var(--primary-color-hover);
  }

  .new-thread-button i {
    font-size: 0.875rem;
  }

  .threads-section {
    margin-top: 2rem;
  }

  .threads-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .threads-section-header h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem 0;
  }

  .threads-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .empty-threads {
    margin-top: 2rem;
    padding: 2rem;
    text-align: center;
    color: var(--text-secondary);
  }

  .info-card {
    background: var(--surface-card);
    border: 2px solid var(--control-border-card);
    border-radius: 8px;
    padding: 1.5rem;
    text-align: left;
    width: 100%;
  }

  .clickable-card {
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .clickable-card:hover {
    border-color: var(--primary-color);
    background: var(--surface-hover);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .info-card h4 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.75rem 0;
  }

  .coming-soon {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin: 0;
    font-style: italic;
  }

  .member-counts {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .member-count-line {
    color: var(--text-primary);
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .file-counts {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .file-count-line {
    color: var(--text-primary);
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .instructions-status {
    color: var(--text-primary);
    font-size: 0.875rem;
    margin: 0;
    line-height: 1.5;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 1rem;
    color: var(--text-secondary);
  }

  .loading i {
    font-size: 2rem;
  }

  @media (max-width: 1024px) {
    .two-column-layout {
      flex-direction: column;
    }

    .left-column {
      max-width: 100%;
    }

    .right-column {
      width: 100%;
      max-width: 100%;
    }
  }
</style>

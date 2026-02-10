<script lang="ts">
  import { querystring, push } from 'svelte-spa-router';
  import { projects } from '$lib/stores/project.store';
  import { threads } from '$lib/stores/thread.store';
  import { threadService } from '$lib/services/thread.service';
  import { ROUTE } from '$lib/constants/route.constant';
  import { THREAD_STATUS } from '$lib/constants/status.constant';
  import ModelSelector from '$lib/components/common/ModelSelector.svelte';
  import ThreadListItem from '$lib/components/threads/ThreadListItem.svelte';
  import { favorites } from '$lib/stores/favorite.store';
  import type { ModelDetails } from '../../../src-electron/preload';

  let projectId = $state<string | null>(null);
  let selectedModelId = $state<string | null>(null);
  let prompt = $state('');
  let isSubmitting = $state(false);

  // Get project from store
  const project = $derived(
    projectId ? $projects.find(p => p.id === projectId) : null
  );

  // Favorite status for this project
  const isFav = $derived(projectId ? $favorites.some((e) => e.id === projectId) : false);

  function toggleFavorite() {
    if (projectId) {
      favorites.toggleFavorite(projectId, 'project');
    }
  }

  // Get project threads
  const projectThreads = $derived(
    $threads
      .filter(t => t.metadata?.projectId === projectId)
      .sort((a, b) => {
        const aTime = typeof a.updatedAt === 'number' ? a.updatedAt : new Date(a.updatedAt).getTime();
        const bTime = typeof b.updatedAt === 'number' ? b.updatedAt : new Date(b.updatedAt).getTime();
        return bTime - aTime;
      })
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

  // Extract projectId from query string and load full project
  $effect(() => {
    const params = new URLSearchParams($querystring);
    const id = params.get('projectId');
    if (id && id !== projectId) {
      projectId = id;
      // Load full project with members and files
      projects.loadProject(id).catch((error) => {
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
    try {
      await threadService.getAll({ projectId, updateStore: true });
    } catch (error) {
      console.error('Failed to load project threads:', error);
    }
  }

  function handleModelSelect(e: CustomEvent<{
    modelId: string;
    modelDetails: ModelDetails;
    appSlug: string;
    modelSlug: string;
  }>) {
    selectedModelId = e.detail.modelId;
  }

  async function handleSubmit() {
    if (!projectId || !selectedModelId || !prompt.trim() || isSubmitting) return;

    isSubmitting = true;
    try {
      // Get model details
      const models = await window.electronAPI.models.listAll();
      const modelDetails = models.find(m => m.accessName === selectedModelId);

      if (!modelDetails) {
        throw new Error('Model not found');
      }

      console.log('[Project] Creating thread with model:', {
        selectedModelId,
        modelTitle: modelDetails.title,
        modelId: modelDetails.id,
        modelAccessName: modelDetails.accessName
      });

      // Create thread with metadata
      const thread = await threadService.create({
        title: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
        description: '',
        status: THREAD_STATUS.ACTIVE,
        metadata: {
          projectId,
          modelTitle: modelDetails.title,
          modelProvider: modelDetails.provider,
          modelId: modelDetails.id,
          modelAccessName: modelDetails.accessName,
        },
      });

      // Navigate to thread with prompt (ThreadChatView will auto-submit)
      const params = new URLSearchParams();
      params.set('threadId', thread.id);
      params.set('prompt', prompt);
      params.set('projectId', projectId);
      push(`${ROUTE.PROJECT_THREAD}?${params.toString()}`);

      // Clear prompt after navigation
      prompt = '';
    } catch (error) {
      console.error('Failed to create thread:', error);
    } finally {
      isSubmitting = false;
    }
  }

  function handleMembersClick() {
    if (!projectId) return;
    push(`${ROUTE.PROJECT_MEMBERS}?projectId=${projectId}`);
  }

  function handleFilesClick() {
    if (!projectId) return;
    push(`${ROUTE.PROJECT_FILES}?projectId=${projectId}`);
  }

  function handleInstructionsClick() {
    if (!projectId) return;
    push(`${ROUTE.PROJECT_INSTRUCTIONS}?projectId=${projectId}`);
  }
</script>

{#if project}
  <div class="project-page">
    <div class="two-column-layout">
      <!-- Left Column -->
      <div class="left-column">
        <div class="title-row">
          <h2>{project.title}</h2>
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
        {#if project.description}
          <p class="project-description">{project.description}</p>
        {/if}

        <textarea
          class="prompt-input"
          bind:value={prompt}
          placeholder="Type your message here..."
          rows="6"
        ></textarea>

        <div class="submit-wrapper">
          <ModelSelector
            bind:selectedModelId
            label=""
            allowMultipleSelections={false}
            on:select={handleModelSelect}
          />
          <button
            class="btn-holokai submit-button"
            onclick={handleSubmit}
            aria-label="Send message"
            data-tooltip="Enter to run prompt. Shift+Enter to insert a new line."
          >
            <i class="pi pi-arrow-up"></i>
          </button>
        </div>

        <!-- Threads Grid -->
        {#if projectThreads.length > 0}
          <div class="threads-section">
            <h3>Threads</h3>
            <div class="threads-list">
              {#each projectThreads as thread (thread.id)}
                <ThreadListItem {thread} {projectId} />
              {/each}
            </div>
          </div>
        {:else}
          <div class="empty-threads">
            <p>No threads yet. Create your first thread above.</p>
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
              <div class="file-count-line">{fileCounts.folders} {fileCounts.folders === 1 ? 'folder' : 'folders'}</div>
              <div class="file-count-line">{fileCounts.files} {fileCounts.files === 1 ? 'file' : 'files'}</div>
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

  h2 {
    margin: 0;
    text-align: left;
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
    transition: background 0.15s, color 0.15s, opacity 0.15s;
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

  .project-description {
    color: var(--text-primary);
    font-size: 1rem;
    line-height: 1.5;
    margin: 0 0 1.5rem 0;
    text-align: left;
  }

  .prompt-input {
    width: 100%;
    padding: 14px;
    border-radius: 6px;
    font-family: inherit;
    font-size: 16px;
    line-height: 1.5;
    border: 1px solid var(--input-border);
    background: var(--input-background);
    color: var(--text-primary);
    resize: vertical;
    min-height: 140px;
    margin-bottom: 1rem;
  }

  .prompt-input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 20%, transparent);
  }

  .prompt-input::placeholder {
    color: var(--text-secondary);
    opacity: 0.7;
  }

  .submit-wrapper {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-bottom: 2rem;
  }

  .submit-button {
    width: 56px;
    height: 40px;
    padding: 0 !important;
  }

  .submit-button i {
    font-size: 18px;
  }

  .threads-section {
    margin-top: 2rem;
  }

  .threads-section h3 {
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

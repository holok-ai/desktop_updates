<script lang="ts">
  /**
   * ThreadBreadcrumb - Displays navigation breadcrumb for thread page
   *
   * Two modes:
   * 1. General thread: "Thread Title (Model Name)" - no link
   * 2. Project thread: "Project Name -> Thread Title (Model Name)" - with link to project
   */
  import { projects } from '$lib/stores/project.store';
  import { push } from 'svelte-spa-router';
  import { ROUTE } from '$lib/constants/route.constant';
  import type { Thread, Message } from '$lib/types/thread.type';
  import { getBranchMessages } from '$lib/utils/branch-utils';

  interface Props {
    thread: Thread;
    messages?: Message[];
  }

  const { thread, messages: messagesProp = [] }: Props = $props();

  // Determine if thread belongs to a project
  const projectId = $derived((thread.metadata?.projectId as string | undefined) ?? null);

  // Get project details if this is a project thread
  const project = $derived(
    projectId ? $projects.find(p => p.id === projectId) : null
  );

  // Get model name from current branch's messages, fallback to thread metadata
  let modelName = $state('Unknown Model');

  $effect(() => {
    const currentMessages = messagesProp ?? [];
    const currentBranchId = thread.currentBranchId;

    if (currentMessages.length > 0 && currentBranchId) {
      const branchMessages = getBranchMessages(currentMessages, currentBranchId);
      // Find the most recent message with a modelId
      const messageWithModel = [...branchMessages]
        .reverse()
        .find(m => m.modelId);
      if (messageWithModel?.modelId) {
        modelName = messageWithModel.modelId;
        return;
      }
    }
    modelName = (thread.metadata?.modelAccessName as string) ?? 'Unknown Model';
  });

  // Navigate to project's thread tab
  function navigateToProject() {
    if (projectId) {
      push(`${ROUTE.PROJECTS}?projectId=${encodeURIComponent(projectId)}&tab=threads`);
    }
  }
</script>

<nav class="breadcrumb" aria-label="Thread navigation">
  {#if project}
    <!-- Project thread: Show "Project Name -> Thread Title (Model Name)" -->
    <button
      class="breadcrumb-link"
      onclick={navigateToProject}
      aria-label="Navigate to {project.title} project"
    >
      {project.title}
    </button>
    <span class="breadcrumb-separator" aria-hidden="true">→</span>
  {/if}

  <span class="breadcrumb-current">
    {thread.title}
    <span class="breadcrumb-model">({modelName})</span>
  </span>
</nav>

<style>
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--surface-card);
    border-bottom: 1px solid var(--surface-border);
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .breadcrumb-link {
    background: none;
    border: none;
    padding: 0;
    color: var(--primary-color);
    cursor: pointer;
    font-size: inherit;
    font-weight: 500;
    transition: color 0.2s ease;
    text-decoration: none;
  }

  .breadcrumb-link:hover {
    color: var(--primary-color-hover, var(--primary-color));
    text-decoration: underline;
  }

  .breadcrumb-link:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .breadcrumb-separator {
    color: var(--text-secondary);
    font-weight: 300;
  }

  .breadcrumb-current {
    font-weight: 600;
    color: var(--text-primary);
  }

  .breadcrumb-model {
    font-weight: 400;
    color: var(--text-secondary);
    font-style: italic;
  }
</style>

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
  import { normalizeBranchId, getRowNumber } from '$lib/utils/branch-utils';

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

  // Get model name from messages using the same rules as ChatPane's selectedModelId:
  // - Look at the highest row (getRowNumber) that has messages with a modelId
  // - If that row has variations and one is selected: use that variation's model
  // - If that row has variations and none are selected: use the original branch's model for that row
  // - If that row has no variations: use the latest message's model in that row
  const modelName = $derived.by(() => {
    const currentMessages = messagesProp ?? [];

    if (currentMessages.length === 0) {
      return (thread.metadata?.modelAccessName as string) ?? 'Unknown Model';
    }

    const messagesWithModel = currentMessages.filter(
      (m) => m.modelId && m.modelId !== null && m.modelId !== '',
    );
    if (messagesWithModel.length === 0) {
      return (thread.metadata?.modelAccessName as string) ?? 'Unknown Model';
    }

    // Find highest row that has any message with a modelId
    let maxRow = 0;
    for (const m of messagesWithModel) {
      const row = getRowNumber(normalizeBranchId(m.branchId));
      if (row > maxRow) {
        maxRow = row;
      }
    }

    // Consider only messages in that row
    const rowMessages = messagesWithModel.filter(
      (m) => getRowNumber(normalizeBranchId(m.branchId)) === maxRow,
    );
    if (rowMessages.length === 0) {
      return (thread.metadata?.modelAccessName as string) ?? 'Unknown Model';
    }

    // Determine base branch and variation branches for this row
    const normalizedIds = Array.from(
      new Set(rowMessages.map((m) => normalizeBranchId(m.branchId))),
    );
    let baseBranchId: string | null = null;
    const variationBranchIds: string[] = [];

    for (const id of normalizedIds) {
      const parts = id.split('.');
      if (parts.length === 3 && parts[1] === '0' && parts[2] === '0') {
        baseBranchId = id;
      } else if (parts.length === 3) {
        variationBranchIds.push(id);
      }
    }

    const selectedBranchIds = Array.isArray(thread.metadata?.selectedBranchIds)
      ? (thread.metadata.selectedBranchIds as string[])
      : [];

    // Find selected variation branches in this row
    const selectedVariationIds = variationBranchIds.filter((variationId) => {
      return selectedBranchIds.some((selectedId) => {
        const normSelected = normalizeBranchId(selectedId);
        return normSelected === variationId || normSelected.startsWith(`${variationId}.`);
      });
    });

    let modelToUse: string | null = null;

    if (selectedVariationIds.length > 0) {
      // Use latest message from any selected variation in this row
      let latestSelectedMsg: (typeof messagesWithModel)[number] | null = null;
      for (const m of rowMessages) {
        const normId = normalizeBranchId(m.branchId);
        const isInSelectedVariation = selectedVariationIds.some(
          (variationId) =>
            normId === variationId || normId.startsWith(`${variationId}.`),
        );
        if (!isInSelectedVariation) continue;
        if (!latestSelectedMsg || m.createdAt > latestSelectedMsg.createdAt) {
          latestSelectedMsg = m;
        }
      }
      modelToUse = latestSelectedMsg?.modelId ?? null;
    } else if (baseBranchId) {
      // No selected variation in this row - use latest message from base branch
      let latestBaseMsg: (typeof messagesWithModel)[number] | null = null;
      for (const m of rowMessages) {
        const normId = normalizeBranchId(m.branchId);
        const isBase =
          normId === baseBranchId || normId.startsWith(`${baseBranchId}.`);
        if (!isBase) continue;
        if (!latestBaseMsg || m.createdAt > latestBaseMsg.createdAt) {
          latestBaseMsg = m;
        }
      }
      modelToUse = latestBaseMsg?.modelId ?? null;
    }

    // Fallbacks: latest message in this row, then latest message overall, then metadata
    if (!modelToUse) {
      const latestInRow = rowMessages.reduce((latest, m) => {
        if (!latest || m.createdAt > latest.createdAt) return m;
        return latest;
      });
      modelToUse = latestInRow?.modelId ?? null;
    }

    if (!modelToUse) {
      const latestOverall = messagesWithModel.reduce((latest, m) => {
        if (!latest || m.createdAt > latest.createdAt) return m;
        return latest;
      });
      modelToUse = latestOverall?.modelId ?? null;
    }

    return modelToUse ?? (thread.metadata?.modelAccessName as string) ?? 'Unknown Model';
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

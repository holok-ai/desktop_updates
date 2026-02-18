<script lang="ts">
  /**
   * ChatBranch — container for multiple conversation lanes at a branch point
   */
  import ChatBranchHeader from './ChatBranchHeader.svelte';
  import ChatBranchFooter from './ChatBranchFooter.svelte';
  import ChatLane from './ChatLane.svelte';
  import type { ChatLayout } from '$lib/types/app.type';

  interface MessagePair {
    request: {
      content: string;
      createdAt: number;
      modelId?: string | null;
    };
    responses: Array<{
      id: string;
      content: string;
    }>;
    isStreamingResponse: boolean;
    streamingContent: string;
  }

  interface Lane {
    id: string;
    branchId: string;
    messagePairs: MessagePair[];
    modelName?: string;
  }

  interface Props {
    /** Branch identifier */
    branchId: string;
    /** Array of lanes to display side-by-side */
    lanes: Lane[];
    /** Chat layout alignment */
    chatLayout: ChatLayout;
    /** Font size from settings */
    fontSize?: number;
    /** Callback when a lane is selected as primary */
    onSelectLane?: (laneIndex: number) => void;
  }

  let {
    branchId,
    lanes = [],
    chatLayout,
    fontSize = 14,
    onSelectLane
  }: Props = $props();

  // Track which lane is expanded (-1 means none)
  let expandedLaneIndex = $state<number>(-1);

  $effect(() => {
    console.log('[ChatBranch] Rendered with:', { branchId, laneCount: lanes.length, lanes });
  });

  function handleSelectLane(laneIndex: number) {
    onSelectLane?.(laneIndex);
  }

  function handleToggleExpand(laneIndex: number) {
    // Toggle: if already expanded, collapse; otherwise expand this lane
    expandedLaneIndex = expandedLaneIndex === laneIndex ? -1 : laneIndex;
  }
</script>

<div class="chat-branch">
  <ChatBranchHeader
    {branchId}
    laneCount={lanes.length}
  />

  <div class="branch-lanes">
    {#each lanes as lane, index (lane.id)}
      <ChatLane
        laneId={lane.id}
        laneIndex={index}
        messagePairs={lane.messagePairs}
        {chatLayout}
        {fontSize}
        modelName={lane.modelName}
        isExpanded={expandedLaneIndex === index}
        isCollapsed={expandedLaneIndex !== -1 && expandedLaneIndex !== index}
        onToggleExpand={() => handleToggleExpand(index)}
        onSelectLane={() => handleSelectLane(index)}
      />
    {/each}
  </div>

  <ChatBranchFooter
    onSelectLane={handleSelectLane}
  />
</div>

<style>
  .chat-branch {
    display: flex;
    flex-direction: column;
    border: 2px solid var(--surface-border, #e0e0e0);
    border-radius: 8px;
    margin: 0.5rem 0;
    background: var(--surface-main, #fff);
  }

  .branch-lanes {
    display: flex;
    gap: 1rem;
    padding: 0 1rem 1rem 1rem;
    overflow-x: auto;
    align-items: stretch;
  }

  /* Equal width lanes */
  .branch-lanes > :global(*) {
    flex: 1 1 0;
    min-width: 300px;
    transition: all 0.3s ease;
  }

  /* Expanded lane takes all width */
  .branch-lanes > :global(.lane-expanded) {
    flex: 1 1 auto;
    max-width: 100%;
    width: 100%;
  }

  /* Collapsed lanes are completely hidden */
  .branch-lanes > :global(.lane-collapsed) {
    flex: 0 0 0;
    min-width: 0;
    max-width: 0;
    width: 0;
    overflow: hidden;
    opacity: 0;
    padding: 0;
    margin: 0;
    border: none;
    position: absolute;
    visibility: hidden;
  }

  /* Handle 2 lanes nicely */
  @media (min-width: 768px) {
    .branch-lanes:has(> :global(:nth-child(2):last-child)) > :global(*) {
      min-width: 400px;
    }
  }

  /* Handle 3+ lanes with scrolling */
  @media (max-width: 1200px) {
    .branch-lanes:has(> :global(:nth-child(3))) {
      overflow-x: auto;
    }

    .branch-lanes:has(> :global(:nth-child(3))) > :global(*) {
      min-width: 350px;
      flex-shrink: 0;
    }
  }
</style>

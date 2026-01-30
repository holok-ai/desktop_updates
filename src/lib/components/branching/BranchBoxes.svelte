<script lang="ts">
  import type { Message } from '$lib/types/thread.type';
  import BranchLane from './BranchLane.svelte';
  import { getVariationsForBranch, getBranchMessages } from '$lib/utils/branch-utils';

  interface Props {
    messages: Message[];
    forkPointId: string;
    selectedBranchIndex: number;
    onSelectBranch: (branchIndex: number) => void;
  }

  let { messages, forkPointId, selectedBranchIndex, onSelectBranch }: Props = $props();

  // Get the fork point message
  const forkPointMsg = $derived(() => messages.find((m) => m.id === forkPointId));

  // Get all branches based on branchId variations
  const userBranches = $derived(() => {
    const forkPoint = forkPointMsg();
    if (!forkPoint) return [];

    // Get the base branch (original)
    const baseBranchId = forkPoint.branchId;
    
    // Get all variations of this branch
    const variations = getVariationsForBranch(messages, baseBranchId);
    
    // Return original branch message and all variation messages
    return [forkPoint, ...variations];
  });

  // Separate original and variations
  const originalBranch = $derived(() => userBranches()[0]);
  const variationBranches = $derived(() => userBranches().slice(1));

  // Create a derived map of assistant responses for reactivity
  const assistantResponses = $derived(() => {
    const map = new Map<string, Message | null>();
    for (const userMsg of userBranches()) {
      // Find the next assistant message in the same branch
      const branchMessages = getBranchMessages(messages, userMsg.branchId);
      const userMsgIndex = branchMessages.findIndex(m => m.id === userMsg.id);
      const assistant = branchMessages.slice(userMsgIndex + 1).find(m => m.role === 'assistant') ?? null;
      map.set(userMsg.id, assistant);
    }
    return map;
  });
  
  // Map branchId to index for compatibility with existing selectedBranchIndex
  const branchIdToIndex = $derived(() => {
    const map = new Map<string, number>();
    userBranches().forEach((msg, index) => {
      map.set(msg.branchId, index);
    });
    return map;
  });
  
</script>

<div class="branch-boxes-container">
  {#if originalBranch() && variationBranches().length > 0}
    <div class="split-view">
      <div class="split-panel original" class:selected={branchIdToIndex().get(originalBranch()?.branchId ?? '') === selectedBranchIndex}>
        <div class="panel-header">Original Conversation</div>
        <BranchLane
          userMessage={originalBranch() as Message}
          assistantMessage={assistantResponses().get(originalBranch()?.id ?? '') ?? null}
          branchIndex={branchIdToIndex().get(originalBranch()?.branchId ?? '') ?? 0}
          isSelected={branchIdToIndex().get(originalBranch()?.branchId ?? '') === selectedBranchIndex}
          isActiveBranch={false}
          onSelect={() => onSelectBranch(branchIdToIndex().get(originalBranch()?.branchId ?? '') ?? 0)}
          hideHeader={true}
        />
      </div>
      <div class="divider"></div>
      <div class="split-panel variation" class:selected={variationBranches().some(b => branchIdToIndex().get(b.branchId) === selectedBranchIndex)}>
        <div class="panel-header">Variation Conversation</div>
        <div class="variation-lanes-scroll">
          {#each variationBranches() as userMsg (userMsg.id)}
            <BranchLane
              userMessage={userMsg}
              assistantMessage={assistantResponses().get(userMsg.id) ?? null}
              branchIndex={branchIdToIndex().get(userMsg.branchId) ?? 0}
              isSelected={branchIdToIndex().get(userMsg.branchId) === selectedBranchIndex}
              isActiveBranch={false}
              onSelect={() => onSelectBranch(branchIdToIndex().get(userMsg.branchId) ?? 0)}
              hideHeader={true}
            />
          {/each}
        </div>
      </div>
    </div>
  {:else}
    <div class="branch-lanes">
      {#each userBranches() as userMsg (userMsg.id)}
        <BranchLane
          userMessage={userMsg}
          assistantMessage={assistantResponses().get(userMsg.id) ?? null}
          branchIndex={branchIdToIndex().get(userMsg.branchId) ?? 0}
          isSelected={branchIdToIndex().get(userMsg.branchId) === selectedBranchIndex}
          isActiveBranch={false}
          onSelect={() => onSelectBranch(branchIdToIndex().get(userMsg.branchId) ?? 0)}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .branch-boxes-container {
    width: 100%;
    margin-top: 16px;
    margin-bottom: 16px;
  }

  .split-view {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 0;
    align-items: flex-start;
    width: 100%;
    max-width: 100%;
    overflow: hidden;
  }

  .split-panel {
    display: flex;
    flex-direction: column;
    min-width: 0;
    max-width: 100%;
    border: 2px solid var(--surface-border);
    border-radius: 8px;
    background: var(--surface-ground);
    overflow: hidden;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .split-panel.selected {
    border-color: #646cff;
    box-shadow: 0 0 0 3px rgba(100, 108, 255, 0.2);
    background: rgba(100, 108, 255, 0.05);
  }

  .panel-header {
    padding: 12px 16px;
    font-weight: 600;
    font-size: 14px;
    color: var(--text-primary);
    background: var(--surface-overlay);
    border-bottom: 1px solid var(--surface-border);
  }

  .divider {
    width: 1px;
    background: var(--surface-border);
    margin: 0 16px;
    align-self: stretch;
  }

  .branch-lanes {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 8px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    /* Prevent scroll from propagating to parent */
    overscroll-behavior-x: contain;
  }

  /* Hide scrollbar but keep functionality */
  .branch-lanes::-webkit-scrollbar {
    height: 6px;
  }

  .branch-lanes::-webkit-scrollbar-track {
    background: transparent;
  }

  .branch-lanes::-webkit-scrollbar-thumb {
    background: var(--surface-border);
    border-radius: 3px;
  }

  .branch-lanes::-webkit-scrollbar-thumb:hover {
    background: var(--text-secondary);
  }

  .variation-lanes-scroll {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 12px;
    padding-bottom: 8px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    /* Prevent scroll from propagating to parent */
    overscroll-behavior-x: contain;
  }

  .variation-lanes-scroll::-webkit-scrollbar {
    height: 6px;
  }

  .variation-lanes-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .variation-lanes-scroll::-webkit-scrollbar-thumb {
    background: var(--surface-border);
    border-radius: 3px;
  }

  .variation-lanes-scroll::-webkit-scrollbar-thumb:hover {
    background: var(--text-secondary);
  }
</style>



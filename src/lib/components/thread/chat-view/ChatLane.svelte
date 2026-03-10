<script lang="ts">
  /**
   * ChatLane — a single lane within a branch, containing messages
   */
  import ChatLaneHeader from './ChatLaneHeader.svelte';
  import ChatLaneHeaderReadOnly from './ChatLaneHeaderReadOnly.svelte';
  import ChatMessage from './ChatMessage.svelte';
  import type { ChatLayout } from '$lib/types/app.type';

  interface MessagePair {
    request: {
      content: string;
      createdAt: number;
      modelId?: string | null;
      guardExecution?: 'none' | 'pass' | 'fail' | 'fail-context';
      guardError?: string;
    };
    responses: Array<{
      id: string;
      content: string;
    }>;
    isStreamingResponse: boolean;
    streamingContent: string;
  }

  interface Props {
    /** Lane identifier */
    laneId: string;
    /** Display index for this lane */
    laneIndex: number;
    /** Message pairs to display in this lane */
    messagePairs: MessagePair[];
    /** Chat layout alignment */
    chatLayout: ChatLayout;
    /** Font size from settings */
    fontSize?: number;
    /** Optional model name for this lane */
    modelName?: string;
    /** Optional model intended use for tooltip */
    modelIntendedUse?: string;
    /** Whether this lane is expanded */
    isExpanded?: boolean;
    /** Whether this lane is collapsed (another lane is expanded) */
    isCollapsed?: boolean;
    /** Callback to toggle expand/collapse */
    onToggleExpand?: () => void;
    /** Callback when lane is selected */
    onSelectLane?: () => void;
    /** Callback to dismiss/close the branch view (view mode) */
    onDismiss?: () => void;
    /** Callback when copy request is clicked */
    onCopyRequest?: (content: string) => void;
    /** Callback when copy response is clicked */
    onCopyResponse?: () => void;
    /** Callback when retry is clicked */
    onRetry?: () => void;
  }

  let {
    laneId,
    laneIndex,
    messagePairs = [],
    chatLayout,
    fontSize = 14,
    modelName = '',
    modelIntendedUse = '',
    isExpanded = false,
    isCollapsed = false,
    onToggleExpand,
    onSelectLane,
    onDismiss,
    onCopyRequest,
    onCopyResponse,
    onRetry,
  }: Props = $props();
</script>

<div class="chat-lane" class:lane-expanded={isExpanded} class:lane-collapsed={isCollapsed}>
  {#if onDismiss}
    <ChatLaneHeaderReadOnly
      {laneId}
      {laneIndex}
      {modelName}
      {modelIntendedUse}
      {isExpanded}
      {onToggleExpand}
      {onDismiss}
    />
  {:else}
    <ChatLaneHeader
      {laneId}
      {laneIndex}
      {modelName}
      {modelIntendedUse}
      {isExpanded}
      {onToggleExpand}
      onSelect={onSelectLane}
    />
  {/if}

  <div class="lane-messages">
    {#each messagePairs as pair (pair.request.createdAt)}
      <ChatMessage
        requestContent={pair.request.content}
        requestCreatedAt={pair.request.createdAt}
        modelId={pair.request.modelId}
        responses={pair.responses}
        streamingContent={pair.streamingContent}
        isStreaming={pair.isStreamingResponse}
        {chatLayout}
        {fontSize}
        {onCopyRequest}
        {onCopyResponse}
        {onRetry}
        guardStatus={pair.request.guardExecution ?? 'none'}
        guardError={pair.request.guardError ?? ''}
      />
    {/each}
  </div>
</div>

<style>
  .chat-lane {
    display: flex;
    flex-direction: column;
    min-width: 300px;
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 6px;
    background: var(--surface-main, #fff);
    transition: all 0.3s ease;
  }

  .chat-lane.lane-expanded {
    min-width: 0;
    flex: 1;
  }

  .chat-lane.lane-collapsed {
    min-width: 0;
    width: 0;
    overflow: hidden;
    opacity: 0;
    border: none;
    padding: 0;
    margin: 0;
  }

  .lane-messages {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1rem;
    flex: 1;
  }
</style>

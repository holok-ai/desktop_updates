<script lang="ts">
  /**
   * ChatLane — a single lane within a branch, containing messages
   */
  import ChatLaneHeader from './ChatLaneHeader.svelte';
  import ChatMessage from './ChatMessage.svelte';
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
    /** Callback when lane is selected */
    onSelectLane?: () => void;
    /** Callback when copy request is clicked */
    onCopyRequest?: () => void;
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
    onSelectLane,
    onCopyRequest,
    onCopyResponse,
    onRetry
  }: Props = $props();

  $effect(() => {
    console.log('[ChatLane] Rendered with:', { laneId, laneIndex, pairCount: messagePairs.length, modelName });
  });
</script>

<div class="chat-lane">
  <ChatLaneHeader
    {laneId}
    {laneIndex}
    {modelName}
    onSelect={onSelectLane}
  />

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
  }

  .lane-messages {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1rem;
    flex: 1;
  }
</style>

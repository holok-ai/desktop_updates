<script lang="ts">
  /**
   * ChatMessage — a complete message pair:
   *   ChatRequest  →  ChatRequestCommands  →  ChatResponse  →  ChatResponseCommands
   *
   * Hover over the message area to reveal command bars.
   */
  import ChatRequest from './ChatRequest.svelte';
  import ChatResponse from './ChatResponse.svelte';
  import ChatMessageCommands from './ChatMessageCommands.svelte';
  import type { ChatLayout } from '$lib/types/app.type';

  interface Props {
    /** User prompt text */
    requestContent: string;
    /** Timestamp of user prompt */
    requestCreatedAt: number;
    /** Model ID used for this request */
    modelId?: string | null;
    /** User's display name */
    userName?: string;
    /** Attachment filenames */
    attachments?: string[];

    /** Assistant response text */
    responseContent?: string;
    /** Whether the response is still streaming */
    isStreaming?: boolean;
    /** Tool usage details */
    tools?: Array<{ name: string; status: string }>;
    /** File outputs from the response */
    files?: string[];

    /** Chat alignment layout */
    chatLayout: ChatLayout;

    /** Gap between messages and command bars */
    commandGap?: number;

    /** Callback when copy is clicked on request */
    onCopyRequest?: () => void;
    /** Callback when copy is clicked on response */
    onCopyResponse?: () => void;
    /** Callback when retry is clicked */
    onRetry?: () => void;
  }

  let {
    requestContent,
    requestCreatedAt,
    modelId = null,
    userName = 'You',
    attachments = [],
    responseContent = '',
    isStreaming = false,
    tools = [],
    files = [],
    chatLayout,
    commandGap = 4,
    onCopyRequest,
    onCopyResponse,
    onRetry,
  }: Props = $props();

  let hovered = $state(false);

  const requestCommands = $derived([
    {
      icon: 'pi-copy',
      label: 'Copy prompt',
      action: () => {
        navigator.clipboard.writeText(requestContent);
        onCopyRequest?.();
      },
    },
    {
      icon: 'pi-pencil',
      label: 'Edit prompt',
      action: () => {
        /* TODO: wire edit flow */
      },
    },
  ]);

  const responseCommands = $derived([
    {
      icon: 'pi-copy',
      label: 'Copy response',
      action: () => {
        navigator.clipboard.writeText(responseContent);
        onCopyResponse?.();
      },
    },
    {
      icon: 'pi-refresh',
      label: 'Retry',
      action: () => {
        onRetry?.();
      },
    },
  ]);
</script>

<div
  class="chat-message"
  role="article"
  aria-label="Chat message"
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
>
  <!-- Request -->
  <ChatRequest
    content={requestContent}
    createdAt={requestCreatedAt}
    {modelId}
    {userName}
    {chatLayout}
    {attachments}
  />

  <!-- Request commands (hover-reveal) -->
  <ChatMessageCommands
    commands={requestCommands}
    gapHeight={commandGap}
    visible={hovered}
  />

  <!-- Response (if available or streaming) -->
  {#if responseContent || isStreaming}
    <ChatResponse
      content={responseContent}
      {chatLayout}
      {isStreaming}
      {tools}
      {files}
    />

    <!-- Response commands (hover-reveal) -->
    {#if responseContent && !isStreaming}
      <ChatMessageCommands
        commands={responseCommands}
        gapHeight={commandGap}
        visible={hovered}
      />
    {/if}
  {/if}
</div>

<style>
  .chat-message {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0.25rem 0;
  }
</style>

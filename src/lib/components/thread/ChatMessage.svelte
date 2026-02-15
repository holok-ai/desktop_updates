<script lang="ts">
  /**
   * ChatMessage — a complete message pair:
   *   ChatRequest  →  ChatRequestCommands  →  ChatResponse  →  ChatResponseCommands
   *
   * Hover over the message area to reveal command bars.
   */
  import ChatRequest from './ChatRequest.svelte';
  import ChatResponse from './ChatResponse.svelte';
  import ChatRequestCommands from './ChatRequestCommands.svelte';
  import ChatResponseCommands from './ChatResponseCommands.svelte';
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

    /** Font size in pixels from settings */
    fontSize?: number;

    /** Gap between messages and command bars */
    commandGap?: number;

    /** Branch ID for this message */
    branchId?: string;

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
    fontSize = 14,
    commandGap = 4,
    branchId,
    onCopyRequest,
    onCopyResponse,
    onRetry,
  }: Props = $props();

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
>
  <!-- Request -->
  <ChatRequest
    content={requestContent}
    createdAt={requestCreatedAt}
    {modelId}
    {userName}
    {chatLayout}
    {attachments}
    {fontSize}
    {branchId}
  />

  <!-- Request commands (hover-reveal) -->
  <ChatRequestCommands
    commands={requestCommands}
    gapHeight={commandGap}
    {chatLayout}
  />

  <!-- Response (if available or streaming) -->
  {#if responseContent || isStreaming}
    <ChatResponse
      content={responseContent}
      {chatLayout}
      {isStreaming}
      {tools}
      {files}
      {fontSize}
    />

    <!-- Response commands (hover-reveal) -->
    {#if responseContent && !isStreaming}
      <ChatResponseCommands
        commands={responseCommands}
        gapHeight={commandGap}
        {chatLayout}
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

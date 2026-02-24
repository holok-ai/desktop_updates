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
  import type { Message } from '$lib/types/thread.type';

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

    /** Assistant responses (array to support multiple consecutive responses) */
    responses?: Message[];
    /** Streaming content for active streaming response */
    streamingContent?: string;
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

    /** Guard execution status for this request */
    guardStatus?: 'none' | 'pass' | 'fail';
    /** Guard error reason when guardStatus is 'fail' */
    guardError?: string;

    /** Callback when copy is clicked on request */
    onCopyRequest?: (content: string) => void;
    /** Callback when copy is clicked on response */
    onCopyResponse?: () => void;
    /** Callback when retry is clicked */
    onRetry?: () => void;
    /** Whether this message came from a selected branch lane (shows tree icon) */
    showBranchIcon?: boolean;
    /** Callback when branch icon is clicked to re-expand branch view */
    onBranchClick?: () => void;
  }

  let {
    requestContent,
    requestCreatedAt,
    modelId = null,
    userName = 'You',
    attachments = [],
    responses = [],
    streamingContent = '',
    isStreaming = false,
    tools = [],
    files = [],
    chatLayout,
    fontSize = 14,
    commandGap = 4,
    branchId,
    guardStatus = 'none',
    guardError = '',
    onCopyRequest,
    onCopyResponse,
    onRetry,
    showBranchIcon = false,
    onBranchClick,
  }: Props = $props();

  const requestCommands = $derived([
    {
      icon: 'pi-copy',
      label: 'Copy prompt',
      action: () => {
        navigator.clipboard.writeText(requestContent);
        onCopyRequest?.(requestContent);
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

  // Concatenate all response content for copying
  const allResponseContent = $derived(responses.map((r) => r.content).join('\n\n---\n\n'));

  const responseCommands = $derived([
    {
      icon: 'pi-copy',
      label: 'Copy response',
      action: () => {
        navigator.clipboard.writeText(allResponseContent);
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

<div class="chat-message" role="article" aria-label="Chat message">
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
    {guardStatus}
    {guardError}
  />

  <!-- Request commands (hover-reveal) -->
  <ChatRequestCommands
    commands={requestCommands}
    gapHeight={commandGap}
    {chatLayout}
    {showBranchIcon}
    {onBranchClick}
  />

  <!-- Render all responses -->
  {#each responses as response (response.id)}
    <ChatResponse
      content={response.content}
      {chatLayout}
      isStreaming={false}
      {tools}
      {files}
      {fontSize}
    />
  {/each}

  <!-- Render streaming response if applicable -->
  {#if isStreaming && streamingContent}
    <ChatResponse
      content={streamingContent}
      {chatLayout}
      isStreaming={true}
      {tools}
      {files}
      {fontSize}
    />
  {/if}

  <!-- Response commands (hover-reveal) - shown if there are any responses -->
  {#if responses.length > 0 && !isStreaming}
    <ChatResponseCommands commands={responseCommands} gapHeight={commandGap} {chatLayout} />
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

<script lang="ts">
  import type { Message } from '$lib/types/thread.type';
  import MarkdownRenderer from '../MarkdownRenderer.svelte';

  interface Props {
    userMessage: Message;
    assistantMessage: Message | null;
    branchIndex: number;
    isSelected: boolean;
    isActiveBranch: boolean;
    onSelect: () => void;
    hideHeader?: boolean;
    streamingText?: string | null;
    onSendMessage?: (message: string, branchIndex: number) => Promise<void>;
    isStreaming?: boolean;
    allMessages?: Message[]; // All messages in this branch for display
  }

  let { 
    userMessage, 
    assistantMessage, 
    branchIndex, 
    isSelected, 
    onSelect, 
    hideHeader = false, 
    streamingText = null,
    isActiveBranch = false,
    onSendMessage,
    isStreaming = false,
    allMessages = [],
  }: Props = $props();

  let inputValue = $state('');
  let inputRef: HTMLTextAreaElement | null = $state(null);

  const branchLabel = $derived(() => {
    if (branchIndex === 0) return 'Original';
    // Variation branches - show model name if available, otherwise just "Variation"
    if (userMessage.modelId) {
      return `Model: ${userMessage.modelId}`;
    }
    return `Branch ${branchIndex}`;
  });

  async function handleSend() {
    if (!inputValue.trim() || isStreaming || !onSendMessage) return;
    
    const message = inputValue.trim();
    inputValue = '';
    
    await onSendMessage(message, branchIndex);
    
    // Focus input again after sending
    if (inputRef) {
      setTimeout(() => inputRef?.focus(), 100);
    }
  }
</script>

<div class="branch-lane" class:selected={isSelected} class:active={isActiveBranch} class:no-border={hideHeader}>
  {#if !hideHeader}
    <div class="lane-header">
      <span class="lane-label">{branchLabel()}</span>
      {#if userMessage.modelId}
        <span class="type-badge">Model</span>
      {:else if branchIndex > 0}
        <span class="type-badge prompt">Prompt</span>
      {/if}
    </div>
  {/if}

  <div class="lane-content">
    <!-- Show all messages in the branch -->
    {#if allMessages.length > 0}
      {#each allMessages as msg (msg.id)}
        {#if msg.role === 'user'}
          <div class="message user">
            <div class="message-content">{msg.content}</div>
          </div>
        {:else if msg.role === 'assistant'}
          <div class="message assistant">
            <div class="message-content">
              <MarkdownRenderer content={msg.content} enableCopy={false} />
            </div>
          </div>
        {/if}
      {/each}
    {:else}
      <!-- Fallback: show first user and assistant messages if allMessages not provided -->
      <div class="message user">
        <div class="message-content">{userMessage.content}</div>
      </div>
      {#if assistantMessage}
        <div class="message assistant">
          <div class="message-content">
            <MarkdownRenderer content={assistantMessage.content} enableCopy={false} />
          </div>
        </div>
      {/if}
    {/if}

    <!-- Show streaming response if active -->
    {#if isStreaming && streamingText !== null && streamingText !== undefined}
      <div class="message assistant streaming">
        <div class="message-content">
          <MarkdownRenderer content={streamingText} enableCopy={false} />
        </div>
        <div class="message-meta">Streaming... ●</div>
      </div>
    {/if}
  </div>

  <!-- Input field for continuing conversation in this branch -->
  {#if onSendMessage}
    <div class="branch-input-container">
      <textarea
        bind:this={inputRef}
        bind:value={inputValue}
        placeholder="Type a message..."
        class="branch-input"
        rows="2"
        disabled={isStreaming}
        onkeydown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (inputValue.trim() && !isStreaming) {
              handleSend();
            }
          }
        }}
      ></textarea>
      <button
        class="branch-send-btn"
        onclick={handleSend}
        disabled={!inputValue.trim() || isStreaming}
      >
        {isStreaming ? 'Sending...' : 'Send'}
      </button>
    </div>
  {/if}

  <button class="select-btn" class:active={isSelected} onclick={onSelect} disabled={isSelected}>
    {isSelected ? '✓ Selected' : 'Continue with this variation'}
  </button>
</div>

<style>
  .branch-lane {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 450px;
    max-width: 600px;
    min-height: 100%;
    border: 2px solid var(--surface-border);
    border-radius: 8px;
    background: var(--surface-ground);
    overflow: visible;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .branch-lane.no-border {
    border: none;
    border-radius: 0;
    background: transparent;
  }

  .branch-lane.selected {
    border-color: #646cff;
    box-shadow: 0 0 0 3px rgba(100, 108, 255, 0.2);
    background: rgba(100, 108, 255, 0.05);
  }

  .branch-lane.active {
    min-height: unset;
    overflow: visible;
  }

  .lane-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--surface-overlay);
    border-bottom: 1px solid var(--surface-border);
  }

  .lane-label {
    font-weight: 600;
    font-size: 13px;
    color: var(--text-primary);
  }

  .type-badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 10px;
    background: rgba(100, 108, 255, 0.15);
    color: #646cff;
    font-weight: 500;
  }

  .type-badge.prompt {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  .lane-content {
    flex: 1;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: fit-content;
    overflow-y: visible;
  }

  .message {
    padding: 0;
    border-radius: 0;
  }

  .message.user {
    display: flex;
    justify-content: flex-end;
    flex-direction: column;
    align-items: flex-end;
  }

  .message.user .message-content {
    background: var(--surface-card);
    padding: 0.5rem;
    border-radius: 6px;
    text-align: left;
    max-width: 80%;
  }

  .message.assistant {
    display: flex;
    justify-content: flex-start;
    flex-direction: column;
    align-items: flex-start;
  }

  .message.assistant .message-content {
    background: transparent;
    padding: 0.5rem;
    border-radius: 6px;
    text-align: left;
    max-width: 100%;
  }

  .message-content {
    font-size: 14px;
    line-height: 1.5;
  }

  .message.streaming {
    opacity: 0.9;
  }

  .message-meta {
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 4px;
    font-style: italic;
  }

  .select-btn {
    margin: 12px;
    padding: 8px 16px;
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .select-btn:hover:not(:disabled) {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
  }

  .select-btn.active {
    background: rgba(100, 108, 255, 0.1);
    border-color: #646cff;
    color: #646cff;
    cursor: default;
  }

  .select-btn:disabled {
    opacity: 0.7;
  }

  .branch-input-container {
    margin-top: 12px;
    padding: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--surface-border);
    display: flex;
    gap: 8px;
    background: var(--surface-ground);
    flex-shrink: 0;
  }

  .branch-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    background: var(--surface-card);
    color: var(--text-primary);
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
    min-height: 60px;
    max-height: 200px;
  }

  .branch-input:focus {
    outline: none;
    border-color: #646cff;
    box-shadow: 0 0 0 2px rgba(100, 108, 255, 0.1);
  }

  .branch-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .branch-send-btn {
    align-self: flex-end;
    padding: 6px 16px;
    background: #646cff;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .branch-send-btn:hover:not(:disabled) {
    background: #535bf2;
  }

  .branch-send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>



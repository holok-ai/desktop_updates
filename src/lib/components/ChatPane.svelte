<script lang="ts">
  import type { Thread } from '../../../src-electron/preload';
  // Message type used by the chat pane
  type Message = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: number;
  };

  export let thread: Thread | null = null;
  export let messages: Message[] = [];
</script>

{#if !thread}
  <div class="chat-pane empty">Select a thread to open chat</div>
{:else}
  <div class="chat-pane">
    <div class="chat-header">
      <h2>{thread.title}</h2>
      <div class="meta">{thread.description}</div>
    </div>

    <div class="messages">
      {#if messages.length === 0}
        <div class="no-messages">No messages yet — send a prompt to start the conversation.</div>
      {:else}
        {#each messages as m (m.id)}
          <div class="message {m.role}">
            <div class="message-content">{m.content}</div>
            <div class="message-meta">{new Date(m.createdAt).toLocaleString()}</div>
          </div>
        {/each}
      {/if}
    </div>

    <div class="composer">
      <!-- Composer is rendered in the page and wired separately -->
    </div>
  </div>
{/if}

<style>
  .chat-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    border-left: 1px solid #e5e7eb;
    padding: 1rem;
    background: #fafafa;
  }

  .chat-header h2 {
    margin: 0;
  }

  .messages {
    flex: 1;
    overflow: auto;
    margin-top: 1rem;
    padding-right: 0.5rem;
  }

  .message { margin-bottom: 1rem; }
  .message.user .message-content { background: #e0f2fe; padding: .5rem; border-radius: 6px; }
  .message.assistant .message-content { background: #eef2ff; padding: .5rem; border-radius: 6px; }
  .message-meta { font-size: .75rem; color: #666; margin-top: .25rem }

  .composer { margin-top: 1rem; }

  .no-messages { color: #6b7280; }
</style>



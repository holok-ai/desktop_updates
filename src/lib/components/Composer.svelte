<script lang="ts">
  // Props from ChatPane slot
  interface Props {
    sendMessage?: (text: string) => Promise<void>;
    isStreaming?: boolean;
  }

  let { sendMessage, isStreaming = false }: Props = $props();

  let text = $state('');

  async function send() {
    const payload = text.trim();
    if (!payload || !sendMessage || isStreaming) return;

    text = ''; // Clear input immediately
    await sendMessage(payload);
  }
</script>

<div class="composer">
  <textarea
    bind:value={text}
    placeholder="Write a message..."
    rows={3}
    disabled={isStreaming}
    data-testid="message-input"
    onkeydown={(e) => {
      // Send on Enter (without Shift). Allow Shift+Enter for newline.
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    }}
  ></textarea>
  <div class="actions">
    <button class="primary" onclick={send} disabled={isStreaming || !text.trim()} data-testid="send-button">
      {isStreaming ? 'Sending...' : 'Send'}
    </button>
  </div>
</div>

<style>
  .composer textarea {
    width: 100%;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--border-sidebar);
    font-family: inherit;
    resize: vertical;
  }

  .composer textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  .actions {
    margin-top: 0.5rem;
    text-align: right;
  }

  .primary {
    background: #646cff;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-weight: 500;
  }

  .primary:hover:not(:disabled) {
    background: #535bf2;
  }

  .primary:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
</style>

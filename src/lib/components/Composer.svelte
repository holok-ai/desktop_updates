<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();
  export let onSend: Function | undefined;
  let text = '';

  function send() {
    if (!text.trim()) return;
    const payload = text.trim();
    dispatch('send', payload);
    if (onSend) onSend(new CustomEvent('send', { detail: payload }));
    text = '';
  }
</script>

<div class="composer">
  <textarea bind:value={text} placeholder="Write a message..." rows={3}></textarea>
  <div class="actions">
    <button class="primary" onclick={send}>Send</button>
  </div>
</div>

<style>
  .composer textarea { width: 100%; padding: .5rem; border-radius: 6px; border: 1px solid #d0d0d0 }
  .actions { margin-top: .5rem; text-align: right }
  .primary { background: #646cff; color: white; padding: .5rem 1rem; border-radius: 6px }
</style>



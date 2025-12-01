<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import ModelChooser from '$lib/components/ModelChooser.svelte';
  import type { Thread, MokuModel } from '../../../../src-electron/preload';
  import CreatePageLayout from '$lib/components/common/CreatePageLayout.svelte';

  const dispatch = createEventDispatcher<{
    submit: void;
    modelSelectionChange: { model: MokuModel | null; isAuto: boolean };
  }>();

  interface Props {
    formData: Thread;
    selectedModel: MokuModel | null;
    chooserInitial?: { provider: string; id: string } | null;
    newThreadPrompt: string;
  }

  let {
    formData = $bindable(),
    selectedModel = $bindable(),
    chooserInitial = null,
    newThreadPrompt = $bindable(),
  }: Props = $props();

  let promptTextarea: HTMLTextAreaElement | undefined = $state();

  // Derived state for validation - require both model AND non-empty prompt
  const canSubmit = $derived(selectedModel !== null && newThreadPrompt.trim().length > 0);

  // Auto-focus prompt input on mount
  onMount(() => {
    // Small delay to ensure DOM is ready after model chooser loads
    setTimeout(() => {
      promptTextarea?.focus();
    }, 100);
  });

  function handleSubmit(event: Event) {
    event.preventDefault();
    if (canSubmit) {
      dispatch('submit');
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    // Enter (without Shift) submits the form
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) {
        dispatch('submit');
      }
    }
    // Shift+Enter allows newline (default behavior, no action needed)
  }

  function handleModelSelected(e: CustomEvent) {
    const m = e.detail as MokuModel | null;
    if (m) {
      selectedModel = m;
      formData.metadata = {
        ...(formData.metadata ?? {}),
        model: m.id,
        provider: m.provider,
      };
      dispatch('modelSelectionChange', { model: m, isAuto: false });
    }
  }
</script>

<CreatePageLayout>
  {#snippet form()}
    <form class="add-thread-form" onsubmit={handleSubmit} aria-label="Create New Thread">
      <div class="form-group model-group">
        <label for="model-select" class="field-label">Model</label>
        <ModelChooser initialSelection={chooserInitial} on:modelSelected={handleModelSelected} />
      </div>

      <div class="form-group prompt-group">
        <label for="thread-prompt">What would you like to discuss?</label>
        <textarea
          bind:this={promptTextarea}
          id="thread-prompt"
          bind:value={newThreadPrompt}
          placeholder="Type your message here... (Enter to send, Shift+Enter for new line)"
          rows="6"
          onkeydown={handleKeyDown}
          aria-label="Message input. Press Enter to send, Shift+Enter for new line"
          aria-describedby="prompt-help-text"
        ></textarea>
        <span id="prompt-help-text" class="help-text">
          Press <kbd>Enter</kbd> to send · <kbd>Shift + Enter</kbd> for new line
        </span>
      </div>

      <div class="form-actions">
        <button type="submit" class="primary" disabled={!canSubmit} aria-disabled={!canSubmit}>
          {#if !selectedModel}
            Select a model
          {:else if !newThreadPrompt.trim()}
            Enter a message
          {:else}
            Send
          {/if}
        </button>
      </div>
    </form>
  {/snippet}
</CreatePageLayout>

<style>
  .add-thread-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-group label,
  .field-label {
    display: block;
    margin-bottom: var(--inline-spacing);
    font-weight: 500;
    color: var(--text-primary);
  }

  .prompt-group {
    flex: 1;
  }

  .form-group textarea {
    width: 100%;
    padding: 14px;
    border-radius: var(--border-radius);
    font-family: inherit;
    font-size: 16px;
    line-height: 1.5;
    border: 1px solid var(--surface-border);
    background: var(--surface-overlay);
    color: var(--text-primary);
    resize: vertical;
    min-height: 140px;
  }

  .form-group textarea:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 20%, transparent);
  }

  .form-group textarea::placeholder {
    color: var(--text-secondary);
    opacity: 0.7;
  }

  .help-text {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .help-text kbd {
    display: inline-block;
    padding: 0.15rem 0.4rem;
    font-family: inherit;
    font-size: 0.75rem;
    background: var(--surface-ground);
    border: 1px solid var(--surface-border);
    border-radius: 4px;
    box-shadow: 0 1px 0 var(--surface-border);
  }

  .form-actions {
    display: flex;
    gap: var(--content-padding);
    justify-content: flex-end;
    margin-top: 0.5rem;
  }

  .form-actions button {
    min-width: 120px;
    border-radius: var(--border-radius);
    padding: 12px 24px;
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
  }

  .form-actions .primary {
    background: var(--primary-color);
    color: var(--primary-color-text);
  }

  .form-actions .primary:hover:not(:disabled) {
    background: var(--primary-600, #2563eb);
  }

  .form-actions .primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 560px) {
    .form-actions {
      flex-direction: column;
    }

    .form-actions button {
      width: 100%;
    }
  }
</style>

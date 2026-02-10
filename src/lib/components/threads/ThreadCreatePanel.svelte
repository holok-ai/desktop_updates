<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import ModelSelector from '$lib/components/common/ModelSelector.svelte';
  import type { ModelDetails } from '../../../../src-electron/preload';
  import CreatePageLayout from '$lib/components/common/CreatePageLayout.svelte';

  const dispatch = createEventDispatcher<{
    save: void;
    modelSelectionChange: { model: ModelDetails | null; isAuto: boolean };
  }>();

  interface Props {
    selectedModel: ModelDetails | null;
    newThreadPrompt: string;
  }

  let {
    selectedModel = $bindable(),
    newThreadPrompt = $bindable(),
  }: Props = $props();

  let promptTextarea: HTMLTextAreaElement | undefined = $state();
  let selectedModelId = $state<string | null>(null);

  // Auto-focus prompt input on mount
  onMount(() => {
    // Small delay to ensure DOM is ready after model chooser loads
    setTimeout(() => {
      promptTextarea?.focus();
    }, 100);
  });

  function handleSubmit(event: Event) {
    event.preventDefault();
    if (!selectedModel || !newThreadPrompt.trim()) {
      return;
    }
    dispatch('save');
  }

  function handleKeyDown(event: KeyboardEvent) {
    // Enter (without Shift) submits the form
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (selectedModel && newThreadPrompt.trim()) {
        dispatch('save');
      }
    }
    // Shift+Enter allows newline (default behavior, no action needed)
  }

  function handleModelSelectorSelect(e: CustomEvent<{
    modelId: string;
    modelDetails: ModelDetails;
    appSlug: string;
    modelSlug: string;
  }>) {
    const { modelDetails } = e.detail;
    selectedModel = modelDetails;
    selectedModelId = modelDetails.accessName;
    dispatch('modelSelectionChange', { model: modelDetails, isAuto: false });
  }
</script>

<CreatePageLayout>
  {#snippet form()}
    <form class="add-thread-form" onsubmit={handleSubmit} aria-label="Create New Thread">
      <div class="form-group prompt-group">
        <textarea
          bind:this={promptTextarea}
          id="thread-prompt"
          bind:value={newThreadPrompt}
          placeholder="Type your message here..."
          rows="6"
          onkeydown={handleKeyDown}
          aria-label="Message input"
        ></textarea>
      </div>

      <div class="form-actions">
        <div class="model-and-send">
          <ModelSelector
            bind:selectedModelId
            label=""
            allowMultipleSelections={false}
            on:select={handleModelSelectorSelect}
          />

          <button
            type="submit"
            class="btn-holokai send-button"
            aria-label="Send message"
            data-tooltip-left="Enter to run prompt. Shift+Enter to insert a new line."
          >
            <i class="pi pi-arrow-up"></i>
          </button>
        </div>
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
    border: 1px solid var(--input-border);
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

  .form-actions {
    display: flex;
    gap: var(--content-padding);
    justify-content: flex-end;
    margin-top: 0.5rem;
  }

  .model-and-send {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .send-button {
    width: 56px;
    height: 40px;
    padding: 0 !important;
  }

  .send-button i {
    font-size: 18px;
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

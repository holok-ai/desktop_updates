<script lang="ts">
  import { onMount } from 'svelte';
  import type { Message, BranchType } from '$lib/types/thread.type';
  import { canCreateVariation } from '$lib/utils/branch-utils';
  import type { ModelDetails } from '../../../../src-electron/preload';

  interface Props {
    originalMessage: Message;
    messages: Message[];
    onSubmit: (content: string, branchType: BranchType, modelIds: string[]) => void;
    onCancel: () => void;
    isSubmitting?: boolean;
    error?: string;
  }

  let {
    originalMessage,
    messages,
    onSubmit,
    onCancel,
    isSubmitting = false,
    error = '',
  }: Props = $props();

  let content = $state(originalMessage.content);
  let branchType = $state<BranchType>('prompt-variation');
  let selectedModelIds = $state<Set<string>>(new Set());
  let models: ModelDetails[] = $state([]);
  let loadingModels = $state(true);
  let textareaEl: HTMLTextAreaElement | null = $state(null);
  let selectEl: HTMLSelectElement | null = $state(null);

  const canPromptVar = $derived(
    canCreateVariation(originalMessage),
  );
  const canModelVar = $derived(
    canCreateVariation(originalMessage),
  );

  onMount(async () => {
    try {
      models = await window.electronAPI.models.listAll();
    } catch (err) {
      console.error('Failed to load models:', err);
    } finally {
      loadingModels = false;
    }
  });

  // If can't create prompt variation, default to model variation
  $effect(() => {
    if (!canPromptVar && canModelVar) {
      branchType = 'model-variation';
    }
  });

  // Clear model selection when switching to prompt variation
  $effect(() => {
    if (branchType === 'prompt-variation') {
      selectedModelIds = new Set();
    }
  });

  // Update select element when selectedModelIds changes
  $effect(() => {
    if (selectEl) {
      for (const option of Array.from(selectEl.options)) {
        option.selected = selectedModelIds.has(option.value);
      }
    }
  });

  // Focus and select on mount
  $effect(() => {
    if (textareaEl) {
      textareaEl.focus();
      textareaEl.select();
    }
  });

  function toggleModel(modelId: string) {
    selectedModelIds = new Set(selectedModelIds);
    if (selectedModelIds.has(modelId)) {
      selectedModelIds.delete(modelId);
    } else {
      selectedModelIds.add(modelId);
    }
  }

  function getModelKey(model: ModelDetails): string {
    return `${model.provider}::${model.id}`;
  }

  function getSelectedModels(): ModelDetails[] {
    return models.filter(m => selectedModelIds.has(getModelKey(m)));
  }

  const canSubmit = $derived(() => {
    if (!content.trim() || isSubmitting) return false;
    if (branchType === 'model-variation') {
      return selectedModelIds.size > 0;
    }
    return true;
  });

  function handleSubmit() {
    if (!canSubmit()) return;
    
    if (branchType === 'model-variation') {
      const modelAccessNames = getSelectedModels().map(m => m.accessName);
      onSubmit(content.trim(), branchType, modelAccessNames);
    } else {
      onSubmit(content.trim(), branchType, []);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }
</script>

<div class="modal-overlay" onclick={onCancel} onkeydown={(e) => e.key === 'Escape' && onCancel()} role="button" tabindex="-1">
  <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && onCancel()} role="dialog" aria-modal="true" tabindex="0">
    <div class="modal-header">
      <h3>Create Branch</h3>
      <button class="close-btn" onclick={onCancel} aria-label="Close">✕</button>
    </div>

    <div class="modal-body">
      <div class="field">
        <label for="variation-type">Type of Branch</label>
        <div class="type-selector">
          <button
            class="type-btn"
            class:active={branchType === 'prompt-variation'}
            disabled={!canPromptVar}
            onclick={() => (branchType = 'prompt-variation')}
            title={canPromptVar ? 'Create prompt variation' : 'Prompt variation already exists'}
          >
            Prompt
          </button>
          <button
            class="type-btn"
            class:active={branchType === 'model-variation'}
            disabled={!canModelVar}
            onclick={() => (branchType = 'model-variation')}
            title={canModelVar ? 'Create model variation' : 'Maximum model variations reached'}
          >
            Models
          </button>
        </div>
      </div>

      {#if branchType === 'model-variation'}
        <div class="field">
          <label for="model-select">Model <span class="required">*</span></label>
          {#if loadingModels}
            <div class="loading">Loading models...</div>
          {:else if models.length === 0}
            <div class="error">No models available</div>
          {:else}
            <div class="model-select-container">
              <select
                id="model-select"
                bind:this={selectEl}
                multiple
                class="model-select"
                onchange={(e) => {
                  const select = e.target as HTMLSelectElement;
                  const selected = new Set<string>();
                  for (const option of Array.from(select.selectedOptions)) {
                    selected.add(option.value);
                  }
                  selectedModelIds = selected;
                }}
                onmousedown={(e) => {
                  // Handle click on option to toggle selection
                  const target = e.target as HTMLElement;
                  if (target.tagName === 'OPTION') {
                    e.preventDefault();
                    const option = target as HTMLOptionElement;
                    const modelKey = option.value;
                    toggleModel(modelKey);
                  }
                }}
              >
                {#each models as model (getModelKey(model))}
                  <option value={getModelKey(model)}>
                    {model.title}
                  </option>
                {/each}
              </select>
              {#if selectedModelIds.size > 0}
                <div class="selected-models">
                  <span class="selected-count">{selectedModelIds.size} model{selectedModelIds.size > 1 ? 's' : ''} selected</span>
                  <div class="selected-tags">
                    {#each getSelectedModels() as model}
                      <span class="model-tag">
                        {model.title}
                        <button
                          type="button"
                          class="remove-btn"
                          onclick={() => toggleModel(getModelKey(model))}
                          aria-label="Remove {model.title}"
                        >
                          ×
                        </button>
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <div class="field">
        <label for="content">Prompt</label>
        <textarea
          id="content"
          bind:this={textareaEl}
          bind:value={content}
          rows={6}
          placeholder="Enter your variation prompt..."
          onkeydown={handleKeydown}
        ></textarea>
      </div>

      {#if error}
        <div class="error">{error}</div>
      {/if}
    </div>

    <div class="modal-footer">
      <span class="hint">⌘+Enter to submit, Esc to cancel</span>
      <div class="actions">
        <button class="cancel-btn" onclick={onCancel} disabled={isSubmitting}>Cancel</button>
        <button
          class="submit-btn"
          onclick={handleSubmit}
          disabled={!canSubmit()}
        >
          {isSubmitting ? 'Creating...' : branchType === 'model-variation' && selectedModelIds.size > 1 ? `Create ${selectedModelIds.size} Branches` : 'Create'}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal {
    background: var(--surface-main);
    border: 1px solid var(--surface-border);
    border-radius: 12px;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: slideIn 0.2s ease-out;
  }

  @keyframes slideIn {
    from { 
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to { 
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--surface-border);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 16px;
  }

  .close-btn:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
  }

  .modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .type-selector {
    display: flex;
    gap: 8px;
  }

  .type-btn {
    flex: 1;
    padding: 10px 16px;
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .type-btn:hover:not(:disabled) {
    border-color: var(--primary-color);
  }

  .type-btn.active {
    background: rgba(100, 108, 255, 0.1);
    border-color: #646cff;
    color: #646cff;
  }

  .type-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  textarea {
    padding: 10px 12px;
    background: var(--surface-ground);
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
  }

  textarea:focus {
    outline: none;
    border-color: #646cff;
    box-shadow: 0 0 0 2px rgba(100, 108, 255, 0.2);
  }

  .required {
    color: #ef4444;
  }

  .loading {
    padding: 10px 12px;
    color: var(--text-secondary);
    font-size: 13px;
  }

  .model-select-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .model-select {
    min-height: 120px;
    padding: 8px;
  }

  .model-select option {
    padding: 6px 8px;
  }

  .selected-models {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .selected-count {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .model-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: rgba(100, 108, 255, 0.1);
    border: 1px solid rgba(100, 108, 255, 0.3);
    border-radius: 4px;
    font-size: 12px;
    color: #646cff;
  }

  .remove-btn {
    background: none;
    border: none;
    color: #646cff;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
  }

  .remove-btn:hover {
    background: rgba(100, 108, 255, 0.2);
  }

  .error {
    padding: 10px 12px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    color: #ef4444;
    font-size: 13px;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-top: 1px solid var(--surface-border);
    background: var(--surface-overlay);
  }

  .hint {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .cancel-btn, .submit-btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-btn {
    background: var(--surface-ground);
    border: 1px solid var(--surface-border);
    color: var(--text-primary);
  }

  .cancel-btn:hover:not(:disabled) {
    background: var(--surface-hover);
  }

  .submit-btn {
    background: #646cff;
    border: 1px solid #646cff;
    color: white;
  }

  .submit-btn:hover:not(:disabled) {
    background: #535bf2;
  }

  .submit-btn:disabled, .cancel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>



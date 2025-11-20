<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ModelChooser from '$lib/components/ModelChooser.svelte';
  import { THREAD_STATUS } from '$lib/constants/status.constant';
  import type { Thread, MokuModel } from '../../../../src-electron/preload';
  import CreatePageLayout from '$lib/components/common/CreatePageLayout.svelte';

  const dispatch = createEventDispatcher<{
    submit: void;
    reset: void;
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

  function updateField<T extends keyof Thread>(field: T, value: Thread[T]) {
    formData = {
      ...formData,
      [field]: value,
    };
  }

  function handleSubmit(event: Event) {
    event.preventDefault();
    dispatch('submit');
  }

  function handleReset() {
    dispatch('reset');
  }
</script>

<CreatePageLayout>
  {#snippet form()}
    <form class="add-thread-form" onsubmit={handleSubmit}>
      <div class="form-group">
        <label for="thread-title">Title *</label>
        <input
          id="thread-title"
          type="text"
          value={formData.title}
          oninput={(event) => {
            const target = event.currentTarget as HTMLInputElement;
            updateField('title', target.value);
          }}
          placeholder="Enter thread title"
          required
        />
      </div>

      <div class="form-group">
        <label for="thread-description">Description</label>
        <textarea
          id="thread-description"
          value={formData.description}
          oninput={(event) => {
            const target = event.currentTarget as HTMLTextAreaElement;
            updateField('description', target.value);
          }}
          placeholder="What is this thread about?"
          rows="3"
        ></textarea>
      </div>

      <div class="flex gap-4">
        <div class="form-group">
          <label for="thread-status">Status</label>
          <select
            id="thread-status"
            value={formData.status}
            onchange={(event) => {
              const target = event.currentTarget as HTMLSelectElement;
              updateField('status', target.value as Thread['status']);
            }}
          >
            <option value={THREAD_STATUS.ACTIVE}>Active</option>
            <option value={THREAD_STATUS.ARCHIVED}>Archived</option>
          </select>
        </div>

        <div class="form-group">
          <span class="field-label">Model</span>
          <ModelChooser
            initialSelection={chooserInitial}
            on:modelSelected={(e) => {
              // e.detail is the selected MokuModel
              const m = (e as CustomEvent).detail as any;
              if (m) {
                selectedModel = m;
                formData.metadata = {
                  ...(formData.metadata ?? {}),
                  model: m.id,
                  provider: m.provider,
                };
              }
            }}
          />
        </div>
      </div>

      <div class="form-group">
        <label for="thread-prompt">Initial Prompt</label>
        <textarea
          id="thread-prompt"
          bind:value={newThreadPrompt}
          placeholder="Share the context you want to start with"
          rows="6"
        ></textarea>
      </div>

      <div class="form-actions">
        <button type="button" class="ghost" onclick={handleReset}> Reset </button>
        <button
          type="submit"
          class="primary"
          disabled={!selectedModel}
          aria-disabled={!selectedModel}
        >
          Create Thread
        </button>
      </div>
    </form>
  {/snippet}
</CreatePageLayout>

<style>
  .add-thread-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-group label,
  .field-label {
    display: block;
    margin-bottom: var(--inline-spacing);
    font-weight: 500;
  }

  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 12px;
    border-radius: var(--border-radius);
    font-family: inherit;
    font-size: 16px;
    border: 1px solid var(--surface-border);
    background: var(--surface-overlay);
    color: var(--text-primary);
  }

  .form-group input:focus,
  .form-group textarea:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 20%, transparent);
  }

  .form-group textarea {
    resize: vertical;
  }

  .form-actions {
    display: flex;
    gap: var(--content-padding);
    justify-content: flex-end;
    margin-top: calc(var(--content-padding) * 1.6);
    flex-wrap: wrap;
  }

  .form-actions button {
    min-width: 80px;
    border-radius: var(--border-radius);
    padding: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
  }

  .form-actions .ghost {
    background: transparent;
    color: var(--text-primary);
    border-color: var(--surface-border);
  }

  .form-actions .ghost:hover {
    background: var(--surface-hover);
  }

  .form-actions .primary {
    background: var(--primary-color);
    color: var(--primary-color-text);
  }

  .form-actions .primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 560px) {
    .form-actions {
      flex-direction: column-reverse;
    }

    .form-actions button {
      width: 100%;
    }
  }
</style>

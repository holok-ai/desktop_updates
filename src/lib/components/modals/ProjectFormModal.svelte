<script lang="ts">
  import { projectService } from '$lib/services/project.service';
  import type { Project } from '../../../../src-electron/preload';

  let { show = $bindable(false), project = $bindable<Project | null>(null) } = $props();

  let projectName = $state('');
  let projectDescription = $state('');
  let isSubmitting = $state(false);
  let error = $state('');

  const isEditMode = $derived(!!project);

  $effect(() => {
    if (project) {
      projectName = project.name;
      projectDescription = project.description || '';
    } else {
      projectName = '';
      projectDescription = '';
    }
  });

  async function handleSubmit() {
    if (!projectName.trim()) {
      error = 'Project name is required';
      return;
    }

    isSubmitting = true;
    error = '';

    try {
      if (isEditMode && project) {
        await projectService.updateProject(project.id, {
          name: projectName.trim(),
          description: projectDescription.trim() || undefined,
        });
      } else {
        await projectService.createProject(
          projectName.trim(),
          projectDescription.trim() || undefined,
        );
      }

      projectName = '';
      projectDescription = '';
      show = false;
    } catch (err) {
      error =
        err instanceof Error
          ? err.message
          : `Failed to ${isEditMode ? 'update' : 'create'} project`;
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    projectName = '';
    projectDescription = '';
    error = '';
    show = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleCancel();
    } else if (event.key === 'Enter' && event.metaKey) {
      handleSubmit();
    }
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={handleCancel} onkeydown={handleKeydown} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="modal-content"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-labelledby="modal-title"
      tabindex="0"
    >
      <h2 id="modal-title">{isEditMode ? 'Edit Project' : 'Create New Project'}</h2>
      <form
        onsubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <div class="form-group">
          <label for="project-name">Project Name *</label>
          <!-- svelte-ignore a11y_autofocus -->
          <input
            id="project-name"
            type="text"
            bind:value={projectName}
            placeholder="Enter project name"
            disabled={isSubmitting}
            autofocus
          />
        </div>

        <div class="form-group">
          <label for="project-description">Description (optional)</label>
          <textarea
            id="project-description"
            bind:value={projectDescription}
            placeholder="Enter project description"
            rows="3"
            disabled={isSubmitting}
          ></textarea>
        </div>

        {#if error}
          <div class="error-message">{error}</div>
        {/if}

        <div class="modal-actions">
          <button
            type="button"
            class="btn-secondary"
            onclick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button type="submit" class="btn-primary" disabled={isSubmitting || !projectName.trim()}>
            {#if isSubmitting}
              {isEditMode ? 'Saving...' : 'Creating...'}
            {:else}
              {isEditMode ? 'Save Changes' : 'Create Project'}
            {/if}
          </button>
        </div>
      </form>

      <div class="hint">
        Tip: Press <kbd>Esc</kbd> to cancel or <kbd>⌘+Enter</kbd> to submit
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--modal-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--surface-ground);
    border-radius: 8px;
    padding: 24px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  h2 {
    margin: 0 0 20px 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .form-group {
    margin-bottom: 16px;
  }

  label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  input,
  textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    font-size: 14px;
    background: var(--surface-overlay);
    color: var(--text-primary);
    transition: border-color 0.2s;
  }

  input:focus,
  textarea:focus {
    outline: none;
    border-color: var(--primary-color);
  }

  input:disabled,
  textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  textarea {
    resize: vertical;
    font-family: inherit;
  }

  .error-message {
    padding: 10px 12px;
    background: var(--error-bg);
    border: 1px solid var(--error-color);
    border-radius: 6px;
    color: var(--error-color);
    font-size: 14px;
    margin-bottom: 16px;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 20px;
  }

  button {
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .btn-secondary {
    background: var(--surface-overlay);
    color: var(--text-primary);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--surface-hover);
  }

  .btn-primary {
    background: var(--primary-color);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .hint {
    margin-top: 16px;
    font-size: 12px;
    color: var(--text-secondary);
    text-align: center;
  }

  kbd {
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 3px;
    padding: 2px 6px;
    font-family: monospace;
    font-size: 11px;
  }
</style>

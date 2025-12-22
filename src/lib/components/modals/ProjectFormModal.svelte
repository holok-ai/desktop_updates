<script lang="ts">
  import BaseModal from './BaseModal.svelte';
  import { projectService } from '$lib/services/project.service';
  import type { Project } from '$lib/types/project.type';

  let {
    show = $bindable(false),
    project = $bindable<Project | null>(null),
  }: { show: boolean; project: Project | null } = $props();

  let projectName = $state('');
  let projectDescription = $state('');
  let isSubmitting = $state(false);
  let error = $state('');

  const isEditMode = $derived(!!project);
  const modalTitle = $derived(isEditMode ? 'Edit Project' : 'Create New Project');
  const submitLabel = $derived(
    isSubmitting
      ? isEditMode
        ? 'Saving...'
        : 'Creating...'
      : isEditMode
        ? 'Save Changes'
        : 'Create Project',
  );

  let lastShownState = $state(false);

  $effect(() => {
    // Only initialize when modal opens (transitions from false to true)
    if (show && !lastShownState) {
      if (project) {
        projectName = project.title;
        projectDescription = project.description || '';
      } else {
        projectName = '';
        projectDescription = '';
      }
    }
    lastShownState = show;
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
          title: projectName.trim(),
          description: projectDescription.trim() || undefined,
        });
      } else {
        // This modal is only for editing, creation happens in ProjectCreatePanel
        throw new Error('Cannot create projects from this modal');
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
</script>

<BaseModal
  bind:show
  title={modalTitle}
  {error}
  {isSubmitting}
  {submitLabel}
  submitDisabled={!projectName.trim()}
  oncancel={handleCancel}
  onsubmit={handleSubmit}
>
  {#snippet content()}
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

      {#if isEditMode && project}
        <div class="form-group">
          <span class="field-label">Project Type</span>
          <div class="read-only-field">
            <span class={project.type === 'shared' ? 'type-badge shared' : 'type-badge personal'}>
              {project.type === 'shared' ? 'Shared' : 'Personal'}
            </span>
          </div>
          <div class="field-hint">Project type cannot be changed after creation.</div>
        </div>
      {/if}
    </form>
  {/snippet}
</BaseModal>

<style>
  /* Component-specific styles only - modal infrastructure handled by BaseModal */

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

  .field-label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .read-only-field {
    padding: 10px 12px;
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 6px;
  }

  .type-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .type-badge.personal {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.35);
    color: #3b82f6;
  }

  .type-badge.shared {
    background: rgba(168, 85, 247, 0.1);
    border: 1px solid rgba(168, 85, 247, 0.35);
    color: #a855f7;
  }

  .field-hint {
    margin-top: 6px;
    font-size: 12px;
    color: var(--text-secondary);
    font-style: italic;
  }
</style>

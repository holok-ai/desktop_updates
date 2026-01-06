<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { projectService } from '$lib/services/project.service';
  import { clearUnsavedChanges, setUnsavedChanges } from '$lib/stores/navigation-guard.store';
  import { push } from 'svelte-spa-router';
  import { ROUTE } from '$lib/constants/route.constant';
  import CreatePageLayout from '$lib/components/common/CreatePageLayout.svelte';
  import MokuColorGrid from '$lib/components/common/MokuColorGrid.svelte';
  import MokuIconPicker from '$lib/components/common/MokuIconPicker.svelte';
  import {
    MOKU_COLOR_PALETTE,
    VALID_PROJECT_ICONS,
    PROJECT_TITLE_MAX_LENGTH,
    PROJECT_DESCRIPTION_MAX_LENGTH,
  } from '$lib/constants/project-validation';
  import type { Project } from '$lib/types/project.type';

  let { project }: { project: Project } = $props();

  const dispatch = createEventDispatcher<{ updated: { projectId: string }; cancelled: void }>();

  // Form state using Svelte 5 Runes - initialize from project
  let projectTitle = $state(project.title || project.name || '');
  let projectDescription = $state(project.description || '');
  let selectedColor = $state<(typeof MOKU_COLOR_PALETTE)[number]>(
    (project.metadata?.color as (typeof MOKU_COLOR_PALETTE)[number]) || MOKU_COLOR_PALETTE[0]
  );
  let selectedIcon = $state<(typeof VALID_PROJECT_ICONS)[number]>(
    (project.metadata?.icon as (typeof VALID_PROJECT_ICONS)[number]) || VALID_PROJECT_ICONS[0]
  );
  let isSubmitting = $state(false);
  let error = $state('');
  let hasAttemptedSubmit = $state(false);

  // Validation using $derived
  const titleError = $derived(() => {
    const trimmed = projectTitle.trim();
    if (!trimmed) return 'Project title is required';
    if (trimmed.length > PROJECT_TITLE_MAX_LENGTH) {
      return `Title cannot exceed ${PROJECT_TITLE_MAX_LENGTH} characters`;
    }
    // Regex: alphanumeric + spaces + hyphens only
    if (!/^[a-zA-Z0-9\s\-]+$/.test(trimmed)) {
      return 'Title can only contain letters, numbers, spaces, and hyphens';
    }
    return '';
  });

  const descriptionError = $derived(() => {
    if (projectDescription.length > PROJECT_DESCRIPTION_MAX_LENGTH) {
      return `Description cannot exceed ${PROJECT_DESCRIPTION_MAX_LENGTH} characters`;
    }
    return '';
  });

  const isFormValid = $derived(!titleError() && !descriptionError());

  // Check if form has changes
  const hasChanges = $derived(() => {
    const originalTitle = project.title || project.name || '';
    const originalDescription = project.description || '';
    const originalColor = project.metadata?.color || MOKU_COLOR_PALETTE[0];
    const originalIcon = project.metadata?.icon || VALID_PROJECT_ICONS[0];

    return (
      projectTitle.trim() !== originalTitle ||
      projectDescription.trim() !== originalDescription ||
      selectedColor !== originalColor ||
      selectedIcon !== originalIcon
    );
  });

  $effect(() => {
    setUnsavedChanges('edit-project', hasChanges());
  });

  function handleCancel() {
    clearUnsavedChanges('edit-project');
    // Go back to project detail view
    push(`${ROUTE.PROJECTS}?projectId=${project.id}`);
  }

  async function handleSubmit(event?: Event) {
    event?.preventDefault();

    hasAttemptedSubmit = true;

    if (!isFormValid) {
      error = titleError() || descriptionError();
      return;
    }

    isSubmitting = true;
    error = '';

    try {
      await projectService.updateProject(project.id, {
        title: projectTitle.trim(),
        description: projectDescription.trim() || undefined,
        metadata: {
          color: selectedColor,
          icon: selectedIcon,
        },
      });

      dispatch('updated', { projectId: project.id });
      clearUnsavedChanges('edit-project');

      // Navigate back to project detail view (threads tab)
      push(`${ROUTE.PROJECTS}?projectId=${project.id}`);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to update project. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<CreatePageLayout>
  {#snippet form()}
    <form class="project-form" onsubmit={handleSubmit}>
      <!-- Title Field with Inline Validation -->
      <div class="form-group">
        <label for="project-title">Project Title *</label>
        <input
          id="project-title"
          type="text"
          bind:value={projectTitle}
          placeholder="Enter project title"
          aria-label="Project title"
          aria-invalid={hasAttemptedSubmit && !!titleError()}
          aria-describedby={hasAttemptedSubmit && titleError() ? 'title-error' : undefined}
          required
          disabled={isSubmitting}
        />
        {#if hasAttemptedSubmit && titleError()}
          <span id="title-error" class="error-text" role="alert">{titleError()}</span>
        {/if}
      </div>

      <!-- Description Field with Character Counter -->
      <div class="form-group">
        <div class="label-with-counter">
          <label for="project-description">Description</label>
          <span class="char-counter" class:error={descriptionError()}>
            {projectDescription.length}/{PROJECT_DESCRIPTION_MAX_LENGTH}
          </span>
        </div>
        <textarea
          id="project-description"
          bind:value={projectDescription}
          placeholder="Add a short description"
          rows="4"
          aria-label="Project description"
          aria-invalid={hasAttemptedSubmit && !!descriptionError()}
          aria-describedby={hasAttemptedSubmit && descriptionError() ? 'description-error' : undefined}
          disabled={isSubmitting}
        ></textarea>
        {#if hasAttemptedSubmit && descriptionError()}
          <span id="description-error" class="error-text" role="alert">{descriptionError()}</span>
        {/if}
      </div>

      <!-- Project Type Display (Read-Only) -->
      <div class="form-group">
        <span class="field-label">Project Type</span>
        <div class="read-only-field">
          <span class="type-badge type-{project.type}">
            {project.type === 'personal' ? 'Personal' : 'Shared'}
          </span>
          <span class="hint-text">Project type cannot be changed after creation</span>
        </div>
      </div>

      <!-- Color Picker -->
      <div class="form-group">
        <span class="field-label">Color</span>
        <MokuColorGrid bind:value={selectedColor} disabled={isSubmitting} />
      </div>

      <!-- Icon Picker -->
      <div class="form-group">
        <span class="field-label">Icon</span>
        <MokuIconPicker bind:value={selectedIcon} disabled={isSubmitting} />
      </div>

      {#if error}
        <div class="error-banner" role="alert">{error}</div>
      {/if}

      <footer class="actions">
        <button type="button" class="ghost" onclick={handleCancel} disabled={isSubmitting}>
          Cancel
        </button>
        <button
          type="submit"
          class="primary"
          disabled={isSubmitting || !isFormValid || !hasChanges()}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </footer>
    </form>
  {/snippet}
</CreatePageLayout>

<style>
  .project-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label,
  .field-label {
    font-weight: 600;
    margin-bottom: 0.25rem;
    display: inline-block;
  }

  .label-with-counter {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .char-counter {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .char-counter.error {
    color: var(--error-color);
    font-weight: 600;
  }

  .error-text {
    font-size: 0.875rem;
    color: var(--error-color);
    margin-top: 0.25rem;
  }

  input,
  textarea {
    width: 100%;
    border-radius: 8px;
    border: 1px solid var(--surface-border);
    background: var(--surface-overlay);
    color: var(--text-primary);
    padding: 0.75rem 1rem;
    font-size: 1rem;
  }

  input[aria-invalid='true'],
  textarea[aria-invalid='true'] {
    border-color: var(--error-color);
  }

  input:focus,
  textarea:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 35%, transparent);
  }

  input[aria-invalid='true']:focus,
  textarea[aria-invalid='true']:focus {
    border-color: var(--error-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--error-color) 25%, transparent);
  }

  .read-only-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--surface-ground);
    border-radius: 8px;
    border: 1px solid var(--surface-border);
  }

  .type-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 600;
    width: fit-content;
  }

  .type-badge.type-personal {
    background: color-mix(in srgb, var(--primary-color) 15%, transparent);
    color: var(--primary-color);
  }

  .type-badge.type-shared {
    background: color-mix(in srgb, var(--green-500) 15%, transparent);
    color: var(--green-500);
  }

  .hint-text {
    font-size: 0.875rem;
    color: var(--text-secondary);
    font-style: italic;
  }

  .error-banner {
    padding: 0.75rem 1rem;
    background: color-mix(in srgb, var(--error-color) 10%, transparent);
    border: 1px solid var(--error-color);
    border-radius: 8px;
    color: var(--error-color);
    font-size: 0.875rem;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    padding-top: 1rem;
    border-top: 1px solid var(--surface-border);
  }

  button {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
  }

  button.ghost {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--surface-border);
  }

  button.ghost:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--text-secondary);
  }

  button.primary {
    background: var(--primary-color);
    color: white;
  }

  button.primary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--primary-color) 85%, black);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button[aria-busy='true'] {
    position: relative;
    color: transparent;
  }

  button[aria-busy='true']::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    top: 50%;
    left: 50%;
    margin-left: -8px;
    margin-top: -8px;
    border: 2px solid white;
    border-radius: 50%;
    border-top-color: transparent;
    animation: spinner 0.6s linear infinite;
  }

  @keyframes spinner {
    to {
      transform: rotate(360deg);
    }
  }
</style>


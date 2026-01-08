<script lang="ts">
  import { selectedProjectStore } from '$lib/stores/selected-project.store';
  import { createEventDispatcher } from 'svelte';
  import { projectService, type CreateProjectInput } from '$lib/services/project.service';
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

  // Props
  type FormMode = 'create' | 'edit';

  let {
    mode
  }: {
    mode: FormMode;
  } = $props();

  // Selected project from store (only used in edit mode)
  const projectStoreValue = $derived($selectedProjectStore);
  const project = $derived(mode === 'edit' ? projectStoreValue : null);

  const dispatch = createEventDispatcher<{
    created: { projectId: string };
    updated: { projectId: string };
    cancelled: void;
  }>();

  // Derived values based on mode
  const isEditMode = $derived(mode === 'edit');
  const guardKey = $derived(isEditMode ? 'edit-project' : 'add-project');

  function normalizeColor(value: unknown): (typeof MOKU_COLOR_PALETTE)[number] {
    if (typeof value !== 'string') return MOKU_COLOR_PALETTE[0];
    const normalized = value.trim().toUpperCase();
    const match = MOKU_COLOR_PALETTE.find((c) => c.toUpperCase() === normalized);
    return match ?? MOKU_COLOR_PALETTE[0];
  }

  function normalizeIcon(value: unknown): (typeof VALID_PROJECT_ICONS)[number] {
    if (typeof value !== 'string') return VALID_PROJECT_ICONS[0];
    const normalized = value.trim().toLowerCase();
    const match = VALID_PROJECT_ICONS.find((i) => i.toLowerCase() === normalized);
    return match ?? VALID_PROJECT_ICONS[0];
  }

  // Form state (initialized via $effect to avoid capturing derived values in $state initializers)
  let projectTitle = $state('');
  let projectDescription = $state('');
  let selectedColor = $state<(typeof MOKU_COLOR_PALETTE)[number]>(MOKU_COLOR_PALETTE[0]);
  let selectedIcon = $state<(typeof VALID_PROJECT_ICONS)[number]>(VALID_PROJECT_ICONS[0]);
  let projectType = $state<'personal' | 'shared'>('personal');

  let isSubmitting = $state(false);
  let error = $state('');
  let hasAttemptedSubmit = $state(false);

  // Re-init when switching mode or editing a different project
  let initKey = $state<string | null>(null);
  $effect(() => {
    const key = mode === 'edit' && project ? `edit:${project.id}` : 'create';
    if (initKey === key) return;
    initKey = key;

    if (mode === 'edit' && project) {
      projectTitle = project.title || '';
      projectDescription = project.description || '';
      selectedColor = normalizeColor(project.metadata?.color);
      selectedIcon = normalizeIcon(project.metadata?.icon);
      projectType = project.type;
    } else {
      projectTitle = '';
      projectDescription = '';
      selectedColor = MOKU_COLOR_PALETTE[0];
      selectedIcon = VALID_PROJECT_ICONS[0];
      projectType = 'personal';
    }

    // Reset submit state when the form context changes
    isSubmitting = false;
    error = '';
    hasAttemptedSubmit = false;
  });

  // Validation (shared between create and edit)
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

  // Track changes for navigation guard
  const hasChanges = $derived(() => {
    if (!isEditMode) {
      // For create mode, any input is a change
      return projectTitle.trim() !== '' ||
             projectDescription.trim() !== '' ||
             selectedColor !== MOKU_COLOR_PALETTE[0] ||
             selectedIcon !== VALID_PROJECT_ICONS[0] ||
             projectType !== 'personal';
    }

    // For edit mode, compare with original
    if (!project) return false;
    const originalTitle = project.title || '';
    const originalDescription = project.description || '';
    const originalColor = normalizeColor(project.metadata?.color);
    const originalIcon = normalizeIcon(project.metadata?.icon);

    return (
      projectTitle.trim() !== originalTitle ||
      projectDescription.trim() !== originalDescription ||
      selectedColor !== originalColor ||
      selectedIcon !== originalIcon
    );
  });

  $effect(() => {
    setUnsavedChanges(guardKey, hasChanges());
  });

  // Submit handler - branches based on mode
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
      const input: CreateProjectInput = {
        title: projectTitle.trim(),
        description: projectDescription.trim() || undefined,
        type: projectType,
        metadata: {
          color: selectedColor,
          icon: selectedIcon,
        },
      };

      if (isEditMode && project) {
        // Update existing project
        await projectService.updateProject(project.id, input);
        clearUnsavedChanges(guardKey);
        dispatch('updated', { projectId: project.id });
        push(`${ROUTE.PROJECTS}?projectId=${project.id}`);
      } else {
        // Create new project
        const newProject = await projectService.createProject(input);
        clearUnsavedChanges(guardKey);
        dispatch('created', { projectId: newProject.id });
        push(`${ROUTE.PROJECTS}?projectId=${newProject.id}`);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} project. Please try again.`;
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    clearUnsavedChanges(guardKey);
    dispatch('cancelled');

    if (isEditMode && project) {
      push(`${ROUTE.PROJECTS}?projectId=${project.id}`);
    } else {
      push(ROUTE.PROJECTS);
    }
  }

  const typeChoices: {
    id: 'personal' | 'shared';
    title: string;
    description: string;
  }[] = [
    {
      id: 'personal',
      title: 'Personal',
      description: 'Only you can access. Can be upgraded to shared later.',
    },
    {
      id: 'shared',
      title: 'Shared',
      description: 'Invite team members to collaborate.',
    },
  ];
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

      <!-- Type Field - Conditional rendering based on mode -->
      <div class="form-group">
        <span class="field-label">Project Type{isEditMode ? '' : ' *'}</span>

        {#if isEditMode}
          <!-- Edit mode: Read-only badge -->
          <div class="read-only-field">
            <span class="type-badge type-{project?.type}">
              {project?.type === 'personal' ? 'Personal' : 'Shared'}
            </span>
            <span class="hint-text">Project type cannot be changed after creation</span>
          </div>
        {:else}
          <!-- Create mode: Type selector -->
          <div class="type-options" role="radiogroup" aria-label="Project type">
            {#each typeChoices as choice (choice.id)}
              <button
                type="button"
                class="type-option"
                class:active={projectType === choice.id}
                role="radio"
                aria-checked={projectType === choice.id}
                onclick={() => (projectType = choice.id)}
                disabled={isSubmitting}
              >
                <div class="option-header">
                  <span>{choice.title}</span>
                </div>
                <p>{choice.description}</p>
              </button>
            {/each}
          </div>
        {/if}
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
        <button type="button" class="btn-ghost" onclick={handleCancel} disabled={isSubmitting}>
          Cancel
        </button>
        <button
          type="submit"
          class="btn-primary {isSubmitting ? 'btn-loading' : ''}"
          disabled={isSubmitting || (hasAttemptedSubmit && !isFormValid) || (isEditMode && !hasChanges())}
          aria-busy={isSubmitting}
        >
          {#if !isSubmitting}
            {isEditMode ? 'Save Changes' : 'Create Project'}
          {:else}
            &nbsp;
          {/if}
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

  textarea {
    resize: vertical;
    min-height: 120px;
  }

  /* Type selector for create mode */
  .type-options {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  .type-option {
    border: 1px solid var(--surface-border);
    border-radius: 12px;
    padding: 1rem;
    background: transparent;
    text-align: left;
    color: inherit;
    cursor: pointer;
    transition:
      border-color 0.2s ease,
      background 0.2s ease;
  }

  .type-option.active {
    border-color: var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 12%, transparent);
  }

  .type-option .option-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    font-weight: 600;
  }

  .type-option p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  /* Read-only type display for edit mode */
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
    border-radius: 8px;
    background: color-mix(in srgb, var(--error-color) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--error-color) 35%, transparent);
    color: var(--error-color);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    flex-wrap: wrap;
  }

  @media (max-width: 560px) {
    .actions {
      flex-direction: column-reverse;
    }

    .actions button {
      width: 100%;
      justify-content: center;
    }
  }
</style>


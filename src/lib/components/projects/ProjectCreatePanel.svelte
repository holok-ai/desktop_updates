<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { projectService } from '$lib/services/project.service';
  import type { ProjectPrivacyMode } from '$lib/types/project.type';
  import { clearUnsavedChanges, setUnsavedChanges } from '$lib/stores/navigation-guard.store';
  import CreatePageLayout from '$lib/components/common/CreatePageLayout.svelte';

  const dispatch = createEventDispatcher<{ created: { projectId: string } }>();

  let projectName = $state('');
  let projectDescription = $state('');
  let privacyMode = $state<ProjectPrivacyMode>('default');
  let isSubmitting = $state(false);
  let error = $state('');

  const privacyChoices: {
    id: ProjectPrivacyMode;
    title: string;
    description: string;
  }[] = [
    {
      id: 'default',
      title: 'Default',
      description:
        'Allow memories to surface between this project and outside chats when policy allows.',
    },
    {
      id: 'project_only',
      title: 'Project Only',
      description: 'Keep context and memories locked to this project.',
    },
  ];

  $effect(() => {
    const dirty =
      projectName.trim().length > 0 ||
      projectDescription.trim().length > 0 ||
      privacyMode !== 'default';
    setUnsavedChanges('add-project', dirty);
  });

  function resetForm() {
    projectName = '';
    projectDescription = '';
    privacyMode = 'default';
    error = '';
    clearUnsavedChanges('add-project');
  }

  async function handleSubmit(event?: Event) {
    event?.preventDefault();
    if (!projectName.trim()) {
      error = 'Project name is required';
      return;
    }

    isSubmitting = true;
    error = '';

    try {
      const project = await projectService.createProject(
        projectName.trim(),
        projectDescription.trim() || undefined,
        privacyMode,
      );
      dispatch('created', { projectId: project.id });
      resetForm();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create project. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<CreatePageLayout>
  {#snippet form()}
    <form class="project-form" onsubmit={handleSubmit}>
      <div class="form-group">
        <label for="project-name">Project Name *</label>
        <input
          id="project-name"
          type="text"
          bind:value={projectName}
          placeholder="Enter project name"
          required
          disabled={isSubmitting}
        />
      </div>

      <div class="form-group">
        <label for="project-description">Description</label>
        <textarea
          id="project-description"
          bind:value={projectDescription}
          placeholder="Add a short description"
          rows="4"
          disabled={isSubmitting}
        ></textarea>
      </div>

      <div class="form-group">
        <span class="field-label">Privacy Mode</span>
        <div class="privacy-options">
          {#each privacyChoices as choice (choice.id)}
            <button
              type="button"
              class="privacy-option"
              class:active={privacyMode === choice.id}
              onclick={() => (privacyMode = choice.id)}
              disabled={isSubmitting}
            >
              <div class="option-header">
                <span>{choice.title}</span>
                {#if privacyMode === choice.id}
                  <span class="badge">Selected</span>
                {/if}
              </div>
              <p>{choice.description}</p>
            </button>
          {/each}
        </div>
      </div>

      {#if error}
        <div class="error-banner">{error}</div>
      {/if}

      <footer class="actions">
        <button type="button" class="ghost" onclick={resetForm} disabled={isSubmitting}>
          Reset
        </button>
        <button type="submit" class="primary" disabled={isSubmitting || !projectName.trim()}>
          {isSubmitting ? 'Creating...' : 'Create Project'}
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

  .form-group label,
  .field-label {
    font-weight: 600;
    margin-bottom: 0.5rem;
    display: inline-block;
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

  input:focus,
  textarea:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 35%, transparent);
  }

  textarea {
    resize: vertical;
    min-height: 120px;
  }

  .privacy-options {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  .privacy-option {
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

  .privacy-option.active {
    border-color: var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 12%, transparent);
  }

  .privacy-option .option-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    font-weight: 600;
  }

  .privacy-option p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .badge {
    background: var(--primary-color);
    color: #fff;
    padding: 0.15rem 0.75rem;
    border-radius: 999px;
    font-size: 0.75rem;
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

  button {
    border-radius: 999px;
    padding: 0.75rem 1.5rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: opacity 0.2s ease;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .ghost {
    background: transparent;
    border: 1px solid var(--surface-border);
    color: var(--text-primary);
  }

  .primary {
    background: var(--primary-color);
    color: #fff;
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

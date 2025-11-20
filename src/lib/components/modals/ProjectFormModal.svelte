<script lang="ts">
  import BaseModal from './BaseModal.svelte';
  import { projectService } from '$lib/services/project.service';
  import type { Project, ProjectPrivacyMode } from '$lib/types/project.type';

  let {
    show = $bindable(false),
    project = $bindable<Project | null>(null),
  }: { show: boolean; project: Project | null } = $props();

  let projectName = $state('');
  let projectDescription = $state('');
  let isSubmitting = $state(false);
  let error = $state('');
  let privacyMode = $state<ProjectPrivacyMode>('default');
  let initialPrivacyMode = $state<ProjectPrivacyMode>('default');

  const privacyChoices: { id: 'default' | 'project_only'; title: string; description: string }[] = [
    {
      id: 'default',
      title: 'Default',
      description:
        'Allow memories to surface between this project and outside chats when policy allows.',
    },
    {
      id: 'project_only',
      title: 'Project Only',
      description:
        'Keep context and memories locked to this project. Nothing flows in or out without migration.',
    },
  ];

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
        privacyMode = project.privacyMode ?? 'default';
        initialPrivacyMode = privacyMode;
      } else {
        projectName = '';
        projectDescription = '';
        privacyMode = 'default';
        initialPrivacyMode = 'default';
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
        if (initialPrivacyMode !== privacyMode && privacyMode === 'project_only') {
          const ok = window.confirm(
            'Switching to Project Only will isolate memories and context to this project. This may hide context from general chats and other projects. Proceed?',
          );
          if (!ok) {
            isSubmitting = false;
            return;
          }
        }
        await projectService.updateProject(project.id, {
          title: projectName.trim(),
          description: projectDescription.trim() || undefined,
          privacyMode,
        });
      } else {
        await projectService.createProject(
          projectName.trim(),
          projectDescription.trim() || undefined,
          privacyMode,
        );
      }

      projectName = '';
      projectDescription = '';
      privacyMode = 'default';
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

      <div class="form-group">
        <span class="field-label">Privacy Mode</span>
        <div class="privacy-options" role="radiogroup" aria-label="Privacy mode">
          {#each privacyChoices as choice (choice.id)}
            <button
              type="button"
              role="radio"
              class="privacy-option"
              class:active={privacyMode === choice.id}
              aria-checked={privacyMode === choice.id}
              disabled={isSubmitting}
              onclick={() => {
                if (!isSubmitting) {
                  privacyMode = choice.id;
                }
              }}
            >
              <input
                type="radio"
                name="privacy-mode"
                value={choice.id}
                bind:group={privacyMode}
                disabled={isSubmitting}
              />
              <div class="option-header">
                <span class="option-title">{choice.title}</span>
                {#if privacyMode === choice.id}
                  <span class="option-badge">Selected</span>
                {/if}
              </div>
              <p class="option-description">{choice.description}</p>
            </button>
          {/each}
        </div>
        <div class="privacy-hint">
          Changes apply in under 2 seconds across all threads. Organization policy may limit your
          options.
        </div>
      </div>
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

  .privacy-options {
    display: grid;
    gap: 12px;
  }

  .privacy-option {
    width: 100%;
    text-align: left;
    background: var(--surface-overlay);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      background 0.2s ease;
    color: var(--text-primary);
    cursor: pointer;
  }

  .privacy-option:hover {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.1);
  }

  .privacy-option:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.1);
  }

  .privacy-option input[type='radio'] {
    position: absolute;
    opacity: 0;
  }

  .privacy-option.active {
    border-color: var(--primary-color);
    background: rgba(66, 133, 244, 0.08);
  }

  .privacy-option:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    box-shadow: none;
  }

  .privacy-option:disabled:hover {
    border-color: var(--surface-border);
    box-shadow: none;
  }

  .option-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .option-title {
    font-weight: 600;
    font-size: 15px;
  }

  .option-badge {
    background: var(--primary-color);
    color: #fff;
    border-radius: 14px;
    font-size: 12px;
    padding: 2px 10px;
  }

  .option-description {
    margin: 0;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .privacy-hint {
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-secondary);
  }
</style>

<script lang="ts">
  import BaseModal from './BaseModal.svelte';
  import { projectService } from '$lib/services/project.service';
  import MokuColorGrid from '$lib/components/common/MokuColorGrid.svelte';
  import MokuIconPicker from '$lib/components/common/MokuIconPicker.svelte';
  import {
    MOKU_COLOR_PALETTE,
    VALID_PROJECT_ICONS,
  } from '$lib/constants/project-validation';
  import type { Project } from '$lib/types/project.type';

  let {
    show = $bindable(false),
    project = $bindable<Project | null>(null),
  }: { show: boolean; project: Project | null } = $props();

  let projectName = $state('');
  let projectDescription = $state('');
  let selectedColor = $state<(typeof MOKU_COLOR_PALETTE)[number]>(MOKU_COLOR_PALETTE[0]);
  let selectedIcon = $state<(typeof VALID_PROJECT_ICONS)[number]>(VALID_PROJECT_ICONS[0]);
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
        console.log('[ProjectFormModal] Initializing with project:', {
          id: project.id,
          title: project.title,
          metadata: project.metadata,
          metadataType: typeof project.metadata,
          metadataKeys: project.metadata ? Object.keys(project.metadata) : [],
        });
        
        projectName = project.title || "";
        projectDescription = project.description || '';
        
        // Initialize color and icon from metadata
        // Metadata is Record<string, unknown> so we need to check carefully
        if (project.metadata && typeof project.metadata === 'object') {
          const metadataColor = project.metadata['color'];
          const metadataIcon = project.metadata['icon'];
          
          if (typeof metadataColor === 'string' && metadataColor) {
            console.log('[ProjectFormModal] Setting color from metadata:', metadataColor);
            selectedColor = metadataColor as (typeof MOKU_COLOR_PALETTE)[number];
          } else {
            console.log('[ProjectFormModal] Using default color, metadata.color:', metadataColor);
            selectedColor = MOKU_COLOR_PALETTE[0];
          }
          
          if (typeof metadataIcon === 'string' && metadataIcon) {
            console.log('[ProjectFormModal] Setting icon from metadata:', metadataIcon);
            selectedIcon = metadataIcon as (typeof VALID_PROJECT_ICONS)[number];
          } else {
            console.log('[ProjectFormModal] Using default icon, metadata.icon:', metadataIcon);
            selectedIcon = VALID_PROJECT_ICONS[0];
          }
        } else {
          console.log('[ProjectFormModal] No metadata object, using defaults');
          selectedColor = MOKU_COLOR_PALETTE[0];
          selectedIcon = VALID_PROJECT_ICONS[0];
        }
      } else {
        projectName = '';
        projectDescription = '';
        selectedColor = MOKU_COLOR_PALETTE[0];
        selectedIcon = VALID_PROJECT_ICONS[0];
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
          name: projectName.trim(),
          description: projectDescription.trim() || undefined,
          metadata: {
            color: selectedColor,
            icon: selectedIcon,
          },
        });
      } else {
        // This modal is only for editing; project creation happens via ProjectFormPanel (inline create flow).
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

      <!-- Appearance Section -->
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Appearance</label>
        <div class="appearance-section">
          <!-- Color Selector -->
          <div class="appearance-field">
            <span class="field-subtitle">Color</span>
            <MokuColorGrid bind:value={selectedColor} disabled={isSubmitting} />
          </div>

          <!-- Icon Selector -->
          <div class="appearance-field">
            <span class="field-subtitle">Icon</span>
            <MokuIconPicker bind:value={selectedIcon} disabled={isSubmitting} />
          </div>
        </div>
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

  .appearance-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .appearance-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field-subtitle {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }
</style>

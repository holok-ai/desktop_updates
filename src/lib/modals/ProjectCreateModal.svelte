<script lang="ts">
  import { projectService } from '$lib/services/project.service';
  import { MOKU_COLOR_PALETTE, VALID_PROJECT_ICONS } from '$lib/constants/project-validation';

  let { show = $bindable(false) }: { show: boolean } = $props();

  let projectName = $state('');
  let projectDescription = $state('');
  let projectType = $state<'personal' | 'shared'>('personal');
  let selectedColor = $state<(typeof MOKU_COLOR_PALETTE)[number]>(MOKU_COLOR_PALETTE[0]);
  let selectedIcon = $state<(typeof VALID_PROJECT_ICONS)[number]>(VALID_PROJECT_ICONS[0]);
  let isSubmitting = $state(false);
  let error = $state('');

  let lastShownState = $state(false);

  $effect(() => {
    // Initialize when modal opens (transitions from false to true)
    if (show && !lastShownState) {
      projectName = '';
      projectDescription = '';
      projectType = 'personal';
      selectedColor = MOKU_COLOR_PALETTE[0];
      selectedIcon = VALID_PROJECT_ICONS[0];
      error = '';
    }
    lastShownState = show;
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!projectName.trim() || isSubmitting) return;

    isSubmitting = true;
    error = '';

    try {
      await projectService.createProject({
        title: projectName.trim(),
        description: projectDescription.trim() || undefined,
        type: projectType,
        metadata: {
          color: selectedColor,
          icon: selectedIcon,
        },
      });

      projectName = '';
      projectDescription = '';
      show = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create project';
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

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !isSubmitting) {
      handleCancel();
    }
  }

  function focus(node: HTMLInputElement) {
    node.focus();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
  <div
    class="dialog-overlay"
    onclick={handleCancel}
    onkeydown={(e) => e.key === 'Escape' && handleCancel()}
    role="button"
    tabindex="-1"
    aria-label="Close modal"
  >
    <div
      class="dialog"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-labelledby="create-project-dialog-title"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="dialog-header">
        <h2 id="create-project-dialog-title">New Project</h2>
        <button
          class="close-button"
          onclick={handleCancel}
          aria-label="Close dialog"
          type="button"
          disabled={isSubmitting}
        >
          <i class="pi pi-times"></i>
        </button>
      </div>

      <form class="dialog-content" onsubmit={handleSubmit}>
        {#if error}
          <div class="error-banner" role="alert">
            <i class="pi pi-exclamation-triangle"></i>
            <span>{error}</span>
          </div>
        {/if}

        <div class="form-group">
          <label for="project-name">Name *</label>
          <input
            id="project-name"
            type="text"
            bind:value={projectName}
            placeholder="New project name"
            disabled={isSubmitting}
            use:focus
          />
        </div>

        <div class="form-group">
          <label for="project-description">Description</label>
          <textarea
            id="project-description"
            bind:value={projectDescription}
            placeholder="Purpose or description"
            rows="3"
            disabled={isSubmitting}
          ></textarea>
        </div>

        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label>Type</label>
          <div class="project-type-selector">
            <button
              type="button"
              class="type-button"
              class:selected={projectType === 'personal'}
              onclick={() => (projectType = 'personal')}
              disabled={isSubmitting}
            >
              <i class="pi pi-user"></i>
              <div class="type-info">
                <div class="type-title">Personal</div>
                <div class="type-desc">Only visible to you</div>
              </div>
            </button>
            <button
              type="button"
              class="type-button"
              class:selected={projectType === 'shared'}
              onclick={() => (projectType = 'shared')}
              disabled={isSubmitting}
            >
              <i class="pi pi-users"></i>
              <div class="type-info">
                <div class="type-title">Shared</div>
                <div class="type-desc">Collaborate with team members</div>
              </div>
            </button>
          </div>
        </div>

        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label>Appearance</label>
          <div class="appearance-section">
            <div class="appearance-field">
              <span class="field-subtitle">Color</span>
              <select
                bind:value={selectedColor}
                disabled={isSubmitting}
                class="color-dropdown"
                style="background-color: {selectedColor}; color: white;"
              >
                {#each MOKU_COLOR_PALETTE as color}
                  <option value={color} style="background-color: {color}; color: white;">
                    ●
                  </option>
                {/each}
              </select>
            </div>

            <div class="appearance-field">
              <span class="field-subtitle">Icon</span>
              <select bind:value={selectedIcon} disabled={isSubmitting} class="icon-dropdown">
                {#each VALID_PROJECT_ICONS as icon}
                  <option value={icon}>
                    {icon.replace('-', ' ')}
                  </option>
                {/each}
              </select>
            </div>
          </div>
        </div>

        <div class="dialog-actions">
          <button
            type="button"
            class="btn-secondary"
            onclick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button type="submit" class="btn-primary" disabled={!projectName.trim() || isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  /* Override: wider dialog with scroll */
  .dialog {
    max-width: 715px;
    max-height: 90vh;
    overflow-y: auto;
  }

  /* Override: sticky header with space-between layout */
  .dialog-header {
    justify-content: space-between;
    position: sticky;
    top: 0;
    background: var(--surface-main);
    z-index: 1;
  }

  .close-button i {
    font-size: 16px;
  }

  /* Override: margin-top for actions */
  .dialog-actions {
    margin-top: 24px;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    color: #ef4444;
    border-radius: 6px;
    margin-bottom: 20px;
    font-size: 14px;
  }

  .error-banner i {
    font-size: 16px;
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

  .project-type-selector {
    display: flex;
    gap: 12px;
  }

  .type-button {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--surface-overlay);
    border: 2px solid var(--surface-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .type-button:hover:not(:disabled) {
    border-color: var(--primary-color);
    background: var(--surface-hover);
  }

  .type-button.selected {
    border-color: var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 10%, transparent);
  }

  .type-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .type-button i {
    font-size: 24px;
    color: var(--text-primary);
    flex-shrink: 0;
  }

  .type-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .type-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .type-desc {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .appearance-section {
    display: flex;
    gap: 12px;
  }

  .appearance-field {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field-subtitle {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .color-dropdown,
  .icon-dropdown {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .icon-dropdown {
    background: var(--surface-overlay);
    color: var(--text-primary);
    text-transform: capitalize;
  }

  .icon-dropdown option {
    color: black;
    background: white;
  }

  :global(html.dark) .icon-dropdown option {
    color: white;
    background: var(--surface-overlay);
  }

  .color-dropdown:focus,
  .icon-dropdown:focus {
    outline: none;
    border-color: var(--primary-color);
  }

  .color-dropdown:disabled,
  .icon-dropdown:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>

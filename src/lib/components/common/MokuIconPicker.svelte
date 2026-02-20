<!--
  MokuIconPicker.svelte
  A grid selector for project icons using inline SVG
  
  Props:
  - value: Currently selected icon ID
  - disabled: Whether the picker is disabled
  
  Events:
  - change: Fired when an icon is selected (detail: { icon: string })
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { VALID_PROJECT_ICONS, type ProjectIcon } from '$lib/constants/project-validation';
  import { PROJECT_ICON_SVGS } from '$lib/constants/project-icons';

  let { value = $bindable(VALID_PROJECT_ICONS[0]), disabled = false } = $props<{
    value?: ProjectIcon;
    disabled?: boolean;
  }>();

  const dispatch = createEventDispatcher<{ change: { icon: ProjectIcon } }>();

  function handleIconSelect(icon: ProjectIcon) {
    if (disabled) return;
    value = icon;
    dispatch('change', { icon });
  }
</script>

<div class="icon-picker" role="radiogroup" aria-label="Project icon">
  {#each VALID_PROJECT_ICONS as icon}
    <button
      type="button"
      class="icon-option"
      class:active={value === icon}
      role="radio"
      aria-checked={value === icon}
      aria-label="Select {icon} icon"
      title={icon}
      onclick={() => handleIconSelect(icon)}
      {disabled}
    >
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d={PROJECT_ICON_SVGS[icon]} fill="currentColor" />
      </svg>
    </button>
  {/each}
</div>

<style>
  .icon-picker {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
    gap: 0.5rem;
    max-width: 600px;
  }

  .icon-option {
    width: 50px;
    height: 50px;
    border-radius: 8px;
    border: 1px solid var(--surface-border);
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    transition:
      border-color 0.2s ease,
      background 0.2s ease,
      color 0.2s ease;
  }

  .icon-option:hover:not(:disabled) {
    border-color: var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 8%, transparent);
    color: var(--text-primary);
  }

  .icon-option.active {
    border-color: var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 15%, transparent);
    color: var(--primary-color);
  }

  .icon-option:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .icon-option:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  .icon-option svg {
    transition: transform 0.2s ease;
  }

  .icon-option:hover:not(:disabled) svg {
    transform: scale(1.1);
  }
</style>

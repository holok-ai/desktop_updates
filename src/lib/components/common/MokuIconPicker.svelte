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

  // SVG paths for each icon (16x16 viewBox)
  const iconSvgs: Record<ProjectIcon, string> = {
    folder:
      'M2 2C1.44772 2 1 2.44772 1 3V13C1 13.5523 1.44772 14 2 14H14C14.5523 14 15 13.5523 15 13V5C15 4.44772 14.5523 4 14 4H8L6 2H2Z',
    'folder-open':
      'M2 2C1.44772 2 1 2.44772 1 3V13C1 13.5523 1.44772 14 2 14H14C14.5523 14 15 13.5523 15 13V7H8L6.5 5.5H2V2Z M2 7H14L13 13H3L2 7Z',
    briefcase:
      'M5 3C5 2.44772 5.44772 2 6 2H10C10.5523 2 11 2.44772 11 3V4H13C13.5523 4 14 4.44772 14 5V13C14 13.5523 13.5523 14 13 14H3C2.44772 14 2 13.5523 2 13V5C2 4.44772 2.44772 4 3 4H5V3ZM6 4H10V3H6V4Z M2 8H14V6H2V8Z',
    rocket:
      'M8 1L12 5L11 9L9 11L7 11L5 9L4 5L8 1Z M3 10L1 12L4 15L6 13L3 10Z M11 7C11.5523 7 12 6.55228 12 6C12 5.44772 11.5523 5 11 5C10.4477 5 10 5.44772 10 6C10 6.55228 10.4477 7 11 7Z',
    star: 'M8 1L10 5.5L15 6.5L11.5 10L12 15L8 12.5L4 15L4.5 10L1 6.5L6 5.5L8 1Z',
    heart:
      'M8 14L1.5 8C0.5 7 0 5.5 0 4C0 2 1.5 0.5 3.5 0.5C5 0.5 6.5 1.5 7 2.5C7.5 3.5 8.5 3.5 9 2.5C9.5 1.5 11 0.5 12.5 0.5C14.5 0.5 16 2 16 4C16 5.5 15.5 7 14.5 8L8 14Z',
    zap: 'M9 1L2 9H8L7 15L14 7H8L9 1Z',
    target:
      'M8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1Z M8 3C10.7614 3 13 5.23858 13 8C13 10.7614 10.7614 13 8 13C5.23858 13 3 10.7614 3 8C3 5.23858 5.23858 3 8 3Z M8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6Z',
    flag: 'M3 1H4V15H3V1Z M4 2L12 2L10 5L12 8L4 8V2Z',
    bookmark: 'M4 1C3.44772 1 3 1.44772 3 2V15L8 12L13 15V2C13 1.44772 12.5523 1 12 1H4Z',
    box: 'M1 4L8 1L15 4V12L8 15L1 12V4Z M8 8V15 M1 4L8 8L15 4',
    package:
      'M1 4L8 1L15 4V12L8 15L1 12V4Z M8 8V15 M1 4L8 8L15 4 M3 3L8 5.5L13 3 M8 1V8',
    layers:
      'M8 1L15 5L8 9L1 5L8 1Z M1 8L8 12L15 8 M1 11L8 15L15 11',
    grid: 'M1 1H7V7H1V1Z M9 1H15V7H9V1Z M1 9H7V15H1V9Z M9 9H15V15H9V9Z',
    archive:
      'M1 1H15V5H1V1Z M2 5H14V14C14 14.5523 13.5523 15 13 15H3C2.44772 15 2 14.5523 2 14V5Z M6 8H10V10H6V8Z',
    'file-box':
      'M2 1C1.44772 1 1 1.44772 1 2V14C1 14.5523 1.44772 15 2 15H14C14.5523 15 15 14.5523 15 14V2C15 1.44772 14.5523 1 14 1H2Z M4 4H12V6H4V4Z M4 8H12V10H4V8Z',
    inbox:
      'M1 1H15V12L12 15H4L1 12V1Z M1 9H5L6 11H10L11 9H15',
    clipboard:
      'M5 1H11V3H13V14H3V3H5V1Z M5 2V4H11V2H5Z M4 5V13H12V5H4Z',
  };
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
      disabled={disabled}
    >
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d={iconSvgs[icon]} fill="currentColor" />
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


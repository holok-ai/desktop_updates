<!--
  MokuColorGrid.svelte
  A grid selector for the 12-color Moku palette
  
  Props:
  - value: Currently selected color (hex string)
  - disabled: Whether the picker is disabled
  
  Events:
  - change: Fired when a color is selected (detail: { color: string })
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { MOKU_COLOR_PALETTE, type MokuColor } from '$lib/constants/project-validation';

  let { value = $bindable(MOKU_COLOR_PALETTE[0]), disabled = false } = $props<{
    value?: MokuColor;
    disabled?: boolean;
  }>();

  const dispatch = createEventDispatcher<{ change: { color: MokuColor } }>();

  function handleColorSelect(color: MokuColor) {
    if (disabled) return;
    value = color;
    dispatch('change', { color });
  }

  // Color names for better accessibility
  const colorNames: Record<MokuColor, string> = {
    '#7BA3E0': 'Blue',
    '#A78BDB': 'Purple',
    '#E893B8': 'Pink',
    '#E8B567': 'Amber',
    '#6BC9A3': 'Emerald',
    '#66C7BC': 'Teal',
    '#8B8FDB': 'Indigo',
    '#E88484': 'Red',
    '#A3D66E': 'Lime',
    '#E89B68': 'Orange',
    '#61C7DB': 'Cyan',
    '#BB82E0': 'Violet',
  };
</script>

<div class="color-grid" role="radiogroup" aria-label="Project color">
  {#each MOKU_COLOR_PALETTE as color}
    <button
      type="button"
      class="color-option"
      class:active={value === color}
      style="background-color: {color}"
      role="radio"
      aria-checked={value === color}
      aria-label="Select {colorNames[color]} ({color})"
      onclick={() => handleColorSelect(color)}
      {disabled}
    ></button>
  {/each}
</div>

<style>
  .color-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
    gap: 0.5rem;
    max-width: 600px;
  }

  .color-option {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    border: 2px solid transparent;
    cursor: pointer;
    transition:
      transform 0.2s ease,
      border-color 0.2s ease;
  }

  .color-option:hover:not(:disabled) {
    transform: scale(1.1);
  }

  .color-option.active {
    border-color: var(--text-primary);
    box-shadow: 0 0 0 2px var(--surface-overlay);
  }

  .color-option:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .color-option:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
</style>

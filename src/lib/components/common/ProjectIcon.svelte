<script lang="ts">
  import { PROJECT_ICON_SVGS } from '$lib/constants/project-icons';

  let {
    icon = 'folder',
    color = '#3B82F6',
    size = 48,
    iconSize = 24,
  }: {
    icon?: string;
    color?: string;
    size?: number;
    iconSize?: number;
  } = $props();

  const iconPath = $derived(
    icon && PROJECT_ICON_SVGS[icon] ? PROJECT_ICON_SVGS[icon] : PROJECT_ICON_SVGS['folder'],
  );
</script>

<div
  class="project-icon"
  style="
    background-color: {color};
    width: {size}px;
    height: {size}px;
  "
>
  <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d={iconPath} fill="currentColor" />
  </svg>
</div>

<style>
  .project-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    color: white;
    flex-shrink: 0;
  }
</style>

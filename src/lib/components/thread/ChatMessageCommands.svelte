<script lang="ts">
  /**
   * ChatMessageCommands — hover-reveal command icons.
   * Positioned between request and response (or after response) with a configurable gap.
   */

  interface CommandDef {
    icon: string;
    label: string;
    action: () => void;
  }

  interface Props {
    commands: CommandDef[];
    /** Gap height in pixels between the message and the command bar */
    gapHeight?: number;
  }

  let { commands = [], gapHeight = 4 }: Props = $props();
  let hovered = $state(false);
</script>

<div
  class="commands-row"
  class:visible={hovered}
  style="height: {gapHeight + 24}px; padding-top: {gapHeight}px;"
  role="toolbar"
  aria-label="Message commands"
  tabindex="-1"
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
>
  {#each commands as cmd}
    <button
      class="cmd-btn"
      onclick={cmd.action}
      title={cmd.label}
      aria-label={cmd.label}
    >
      <i class="pi {cmd.icon}"></i>
    </button>
  {/each}
</div>

<style>
  .commands-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    opacity: 0;
    transition: opacity 0.15s ease;
    overflow: hidden;
  }

  .commands-row.visible {
    opacity: 1;
  }

  .commands-row .cmd-btn {
    pointer-events: auto;
  }

  .cmd-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: var(--surface-hover, #f0f0f0);
    border-radius: 4px;
    color: var(--text-secondary, #666);
    cursor: pointer;
    font-size: 0.75rem;
    transition: background 0.15s, color 0.15s;
  }

  .cmd-btn:hover {
    background: color-mix(in srgb, var(--primary-color, #646cff) 15%, transparent);
    color: var(--primary-color, #646cff);
  }
</style>

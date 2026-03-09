<script lang="ts">
  /**
   * ComposerVersionCard — inline card rendered in a chat bubble when the AI
   * returns a <composer> response. Shows the version description and timestamp.
   * Clicking navigates the ArtifactPane to that version.
   */

  interface Props {
    /** Short description of this version (e.g. "Initial business plan") */
    versionDescription: string;
    /** Document title (fallback if versionDescription is empty) */
    title: string;
    /** Epoch ms when the version was created */
    createdAt: number;
    /** Called when the card is clicked */
    onclick?: () => void;
  }

  let { versionDescription, title, createdAt, onclick }: Props = $props();

  let label = $derived(versionDescription || title || 'Document update');

  let formattedDate = $derived.by(() => {
    const d = new Date(createdAt);
    const dateStr = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timeStr = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${dateStr} \u00b7 ${timeStr}`;
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="version-card" {onclick}>
  <i class="pi pi-file-edit card-icon"></i>
  <div class="card-body">
    <span class="card-label">{label}</span>
    <span class="card-date">{formattedDate}</span>
  </div>
  <i class="pi pi-chevron-right card-arrow"></i>
</div>

<style>
  .version-card {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 10px;
    background: color-mix(in srgb, var(--primary-color, #646cff) 4%, transparent);
    cursor: pointer;
    transition: all 0.15s;
    margin: 0.25rem 0;
  }

  .version-card:hover {
    background: color-mix(in srgb, var(--primary-color, #646cff) 10%, transparent);
    border-color: color-mix(in srgb, var(--primary-color, #646cff) 30%, transparent);
  }

  .card-icon {
    font-size: 0.9rem;
    color: var(--primary-color, #646cff);
    flex-shrink: 0;
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
    flex: 1;
  }

  .card-label {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-primary, #111);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-date {
    font-size: 0.7rem;
    color: var(--text-secondary, #666);
  }

  .card-arrow {
    font-size: 0.6rem;
    color: var(--text-secondary, #666);
    flex-shrink: 0;
    opacity: 0.5;
  }
</style>

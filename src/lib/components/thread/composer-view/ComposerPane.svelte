<script lang="ts">
  /**
   * ComposerPane — the main document editing pane (Gemini Canvas style).
   *
   * Shows as the right column in ThreadComposerView's split layout.
   * Contains version navigation, export dropdown, and the inline markup view.
   */
  import { artifactStore } from '$lib/stores/artifact.store';
  import InlineMarkupView from './InlineMarkupView.svelte';
  import MarkdownRenderer from '$lib/components/MarkdownRenderer.svelte';
  import { artifactFrontendService } from '$lib/services/artifact-frontend.service';
  import type {
    Artifact,
    ArtifactVersion,
    DiffResult,
  } from '../../../../../src-shared/types/artifact.types';

  interface Props {
    threadId: string;
    fontSize?: number;
    /** Called whenever the user edits content in the textarea */
    onContentChange?: (content: string) => void;
    /** Live streaming content from AI — overrides display while streaming */
    streamingContent?: string | null;
  }

  let { threadId, fontSize = 14, onContentChange, streamingContent = null }: Props = $props();

  // Reactive state driven by store subscription
  let artifact = $state<Artifact | null>(null);
  let diff = $state<DiffResult | null>(null);
  let scope = $state<{ baseVersionId: number; targetVersionId: number } | null>(null);
  let isLoading = $state(false);
  let errorMsg = $state<string | null>(null);
  let hasResolved = $state(false);

  // Subscribe to artifact store and sync local state
  $effect(() => {
    const unsub = artifactStore.subscribe(() => {
      artifact = artifactStore.getArtifact(threadId);
      diff = artifactStore.getDiff(threadId);
      scope = artifactStore.getScope(threadId);
      isLoading = artifactStore.isLoading(threadId);
      errorMsg = artifactStore.getError(threadId);
      hasResolved = artifactStore.hasResolvedChanges(threadId);
    });
    return unsub;
  });

  let totalVersions = $derived(artifact?.versions.length ?? 0);
  let canGoPrev = $derived(scope != null && scope.baseVersionId > 1);
  let canGoNext = $derived(scope != null && scope.targetVersionId < totalVersions);

  // Get target version content for display
  let targetContent = $derived.by(() => {
    if (!artifact) return '';
    // If we have a comparison scope, show that version; otherwise show the latest
    if (scope) {
      const version = artifact.versions.find(
        (v: ArtifactVersion) => v.id === scope!.targetVersionId,
      );
      return version?.content ?? '';
    }
    // Single version (no scope) — show the latest version content
    const latest = artifact.versions[artifact.versions.length - 1];
    return latest?.content ?? '';
  });

  // Editable content — synced from targetContent, modified by user typing
  let editableContent = $state('');
  // Track which version the editable content was last synced from
  let lastSyncedVersion = $state(-1);
  // Whether the user is actively editing (textarea visible) vs reading (rendered markdown)
  let isEditing = $state(false);
  let textareaRef = $state<HTMLTextAreaElement | null>(null);

  // Sync editableContent when the underlying artifact version changes
  $effect(() => {
    const currentVersionId = scope?.targetVersionId ?? artifact?.versions.length ?? 0;
    if (currentVersionId !== lastSyncedVersion) {
      editableContent = targetContent;
      lastSyncedVersion = currentVersionId;
    }
  });

  function handleTextareaInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    editableContent = textarea.value;
    onContentChange?.(editableContent);
  }

  function enterEditMode(): void {
    isEditing = true;
    // Focus the textarea after Svelte renders it
    requestAnimationFrame(() => {
      textareaRef?.focus();
    });
  }

  function exitEditMode(): void {
    isEditing = false;
  }

  // Export dropdown state
  let showExportMenu = $state(false);

  function handlePrev(): void {
    artifactStore.navigateVersion(threadId, 'prev');
  }

  function handleNext(): void {
    artifactStore.navigateVersion(threadId, 'next');
  }

  function handleAcceptAll(): void {
    artifactStore.resolveAllChanges(threadId, 'accepted');
  }

  function handleRejectAll(): void {
    artifactStore.resolveAllChanges(threadId, 'rejected');
  }

  async function handleApply(): Promise<void> {
    await artifactStore.applyResolutions(threadId);
  }

  function handleResolveChange(changeIndex: number, resolution: 'accepted' | 'rejected'): void {
    artifactStore.resolveChange(threadId, changeIndex, resolution);
  }

  function handleClose(): void {
    artifactStore.deactivate(threadId);
  }

  async function handleDiscard(): Promise<void> {
    await artifactStore.discardLatest(threadId);
  }

  function toggleExportMenu(): void {
    showExportMenu = !showExportMenu;
  }

  function closeExportMenu(): void {
    showExportMenu = false;
  }

  /** Handle click outside the export dropdown to close it */
  function handleWindowClick(event: MouseEvent): void {
    if (!showExportMenu) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.create-wrapper')) {
      showExportMenu = false;
    }
  }

  /** Derive a clean filename stem for downloads */
  let filenameStem = $derived(
    (artifact?.filename ?? 'document').replace(/\.[^.]+$/, '') || 'document',
  );

  async function handleExportMarkdown(): Promise<void> {
    closeExportMenu();
    const result = await artifactFrontendService.exportDocument(threadId, false);
    if (result.success && result.content != null) {
      const blob = new Blob([result.content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameStem}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="composer-pane">
  <!-- Header bar -->
  <div class="composer-header">
    <div class="header-left">
      <i class="pi pi-file-edit header-icon"></i>
      <span class="filename">{artifact?.filename ?? 'Document'}</span>

      <!-- Version navigation -->
      <div class="version-nav">
        <button class="nav-btn" disabled={!canGoPrev} onclick={handlePrev} title="Previous version">
          <i class="pi pi-chevron-left"></i>
        </button>
        <span class="version-label">
          {#if scope && scope.targetVersionId < totalVersions}
            {scope.targetVersionId} of {totalVersions}
          {:else}
            Current
          {/if}
        </span>
        <button class="nav-btn" disabled={!canGoNext} onclick={handleNext} title="Next version">
          <i class="pi pi-chevron-right"></i>
        </button>
      </div>

      <span class="header-divider"></span>

      <!-- Formatting toolbar icons (placeholder) -->
      <div class="format-toolbar">
        <button class="format-btn" title="Bold" disabled>
          <span class="format-icon bold">B</span>
        </button>
        <button class="format-btn" title="Italic" disabled>
          <span class="format-icon italic">I</span>
        </button>
        <button class="format-btn" title="Bullet list" disabled>
          <i class="pi pi-list"></i>
        </button>
        <button class="format-btn" title="Numbered list" disabled>
          <i class="pi pi-list-check"></i>
        </button>
      </div>
    </div>

    <div class="header-right">
      <!-- Create / Export dropdown -->
      <div class="create-wrapper">
        <button class="create-btn" onclick={toggleExportMenu} title="Export options">
          <span>Create</span>
          <i class="pi pi-chevron-down"></i>
        </button>
        {#if showExportMenu}
          <div class="export-dropdown context-menu">
            <button class="menu-item" onclick={handleExportMarkdown}>
              <i class="pi pi-file-edit"></i>
              <span>Markdown (.md)</span>
            </button>
            <button class="menu-item disabled" disabled>
              <i class="pi pi-file-pdf"></i>
              <span>PDF</span>
              <span class="coming-soon">Soon</span>
            </button>
            <button class="menu-item disabled" disabled>
              <i class="pi pi-file-word"></i>
              <span>Word (.docx)</span>
              <span class="coming-soon">Soon</span>
            </button>
            <button class="menu-item disabled" disabled>
              <i class="pi pi-image"></i>
              <span>Infographic</span>
              <span class="coming-soon">Soon</span>
            </button>
          </div>
        {/if}
      </div>

      <!-- Close -->
      <button class="close-btn" onclick={handleClose} title="Close Document Mode">
        <i class="pi pi-times"></i>
      </button>
    </div>
  </div>

  <!-- Resolve controls sub-bar (shown when there are active diffs) -->
  {#if diff && diff.changes.length > 0}
    <div class="resolve-bar">
      <div class="resolve-controls">
        <button class="control-btn accept-all" onclick={handleAcceptAll} title="Accept all changes">
          <i class="pi pi-check"></i>
          <span>Accept All</span>
        </button>
        <button class="control-btn reject-all" onclick={handleRejectAll} title="Reject all changes">
          <i class="pi pi-times"></i>
          <span>Reject All</span>
        </button>
        {#if hasResolved}
          <button class="control-btn apply-btn" onclick={handleApply} title="Apply resolutions">
            <i class="pi pi-save"></i>
            <span>Apply</span>
          </button>
        {/if}
      </div>
      {#if totalVersions > 1}
        <button
          class="control-btn discard-btn"
          onclick={handleDiscard}
          title="Discard latest version"
        >
          <i class="pi pi-undo"></i>
        </button>
      {/if}
    </div>
  {/if}

  <!-- Error -->
  {#if errorMsg}
    <div class="composer-error">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{errorMsg}</span>
    </div>
  {/if}

  <!-- Content area -->
  <div class="composer-content">
    {#if streamingContent != null}
      <!-- Streaming: show live AI content as it arrives -->
      <div class="document-streaming" style="font-size: {fontSize}px">
        <MarkdownRenderer content={streamingContent} enableCopy={false} {fontSize} />
      </div>
    {:else if isLoading}
      <div class="loading-state">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    {:else if diff && diff.changes.length > 0}
      <InlineMarkupView
        {targetContent}
        changes={diff.changes}
        {fontSize}
        onResolveChange={handleResolveChange}
      />
    {:else if isEditing}
      <!-- Edit mode: raw textarea -->
      <textarea
        class="document-editor"
        style="font-size: {fontSize}px"
        value={editableContent}
        oninput={handleTextareaInput}
        onblur={exitEditMode}
        placeholder="Start typing or ask the assistant to create a draft..."
        spellcheck="true"
        bind:this={textareaRef}
      ></textarea>
    {:else if editableContent}
      <!-- Read mode: rendered markdown (click to edit) -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="document-rendered" style="font-size: {fontSize}px" onclick={enterEditMode}>
        <MarkdownRenderer content={editableContent} enableCopy={false} {fontSize} />
      </div>
    {:else}
      <!-- Empty state: click to start typing -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="document-empty" onclick={enterEditMode}>
        <span class="empty-placeholder">Start typing or ask the assistant to create a draft...</span
        >
      </div>
    {/if}
  </div>
</div>

<style>
  /* ── Pane container — gray border with rounded corners ── */
  .composer-pane {
    flex: 2;
    min-width: 300px;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--surface-border, #d0d0d0);
    border-radius: 12px;
    background: var(--surface-card, #fff);
    overflow: hidden;
    margin: 0.5rem;
  }

  /* ── Header bar ── */
  .composer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--surface-border, #e0e0e0);
    background: transparent;
    flex-shrink: 0;
    gap: 0.75rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .header-icon {
    font-size: 0.9rem;
    color: var(--text-secondary, #666);
    flex-shrink: 0;
  }

  .filename {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #111);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  /* ── Version navigation (undo/redo arrows) ── */
  .version-nav {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    margin-left: 0.25rem;
  }

  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--text-secondary, #666);
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 0.15s;
  }

  .nav-btn:hover:not(:disabled) {
    background: var(--surface-hover, #f0f0f0);
    color: var(--text-primary, #111);
  }

  .nav-btn:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }

  .version-label {
    font-size: 0.7rem;
    color: var(--text-secondary, #666);
    white-space: nowrap;
    min-width: 3rem;
    text-align: center;
  }

  /* ── Vertical divider ── */
  .header-divider {
    width: 1px;
    height: 16px;
    background: var(--surface-border, #d0d0d0);
    flex-shrink: 0;
    margin: 0 0.15rem;
  }

  /* ── Formatting toolbar ── */
  .format-toolbar {
    display: flex;
    align-items: center;
    gap: 0.1rem;
  }

  .format-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--text-secondary, #666);
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 0.15s;
  }

  .format-btn:hover:not(:disabled) {
    background: var(--surface-hover, #f0f0f0);
    color: var(--text-primary, #111);
  }

  .format-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .format-icon {
    font-size: 0.8rem;
    font-family: 'Georgia', 'Times New Roman', serif;
    line-height: 1;
  }

  .format-icon.bold {
    font-weight: 700;
  }

  .format-icon.italic {
    font-style: italic;
  }

  /* ── Create / Export dropdown ── */
  .create-wrapper {
    position: relative;
  }

  .create-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 1rem;
    font-size: 0.75rem;
    font-weight: 500;
    background: color-mix(in srgb, #4a9eff 12%, transparent);
    color: #3b82f6;
    border: 1px solid color-mix(in srgb, #4a9eff 25%, transparent);
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .create-btn:hover {
    background: color-mix(in srgb, #4a9eff 20%, transparent);
  }

  .create-btn i {
    font-size: 0.6rem;
  }

  .export-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.35rem;
    min-width: 180px;
    z-index: 100;
  }

  .menu-item.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .menu-item.disabled:hover {
    background: transparent;
  }

  .coming-soon {
    margin-left: auto;
    font-size: 0.625rem;
    font-weight: 500;
    color: var(--text-secondary, #999);
    background: var(--surface-hover, #f0f0f0);
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  /* ── Close button ── */
  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--text-secondary, #666);
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: color-mix(in srgb, rgb(239, 68, 68) 12%, transparent);
    color: rgb(220, 38, 38);
  }

  /* ── Resolve controls sub-bar ── */
  .resolve-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.3rem 0.75rem;
    border-bottom: 1px solid var(--surface-border, #e0e0e0);
    background: color-mix(in srgb, var(--primary-color, #646cff) 4%, transparent);
    flex-shrink: 0;
    gap: 0.5rem;
  }

  .resolve-controls {
    display: flex;
    gap: 0.25rem;
  }

  .control-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0.2rem 0.45rem;
    font-size: 0.7rem;
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 5px;
    background: var(--surface-card, #fff);
    color: var(--text-secondary, #666);
    cursor: pointer;
    transition: all 0.15s;
  }

  .control-btn:hover {
    background: var(--surface-hover, #f0f0f0);
  }

  .control-btn i {
    font-size: 0.6rem;
  }

  .accept-all:hover {
    color: rgb(22, 163, 74);
    border-color: color-mix(in srgb, rgb(34, 197, 94) 40%, transparent);
    background: color-mix(in srgb, rgb(34, 197, 94) 10%, transparent);
  }

  .reject-all:hover {
    color: rgb(220, 38, 38);
    border-color: color-mix(in srgb, rgb(239, 68, 68) 40%, transparent);
    background: color-mix(in srgb, rgb(239, 68, 68) 10%, transparent);
  }

  .apply-btn {
    color: var(--primary-color, #646cff);
    border-color: color-mix(in srgb, var(--primary-color, #646cff) 30%, transparent);
    background: color-mix(in srgb, var(--primary-color, #646cff) 8%, transparent);
  }

  .apply-btn:hover {
    background: color-mix(in srgb, var(--primary-color, #646cff) 18%, transparent);
  }

  .discard-btn:hover {
    color: rgb(234, 88, 12);
    border-color: color-mix(in srgb, rgb(249, 115, 22) 40%, transparent);
    background: color-mix(in srgb, rgb(249, 115, 22) 10%, transparent);
  }

  /* ── Error bar ── */
  .composer-error {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.75rem;
    font-size: 0.75rem;
    color: rgb(220, 38, 38);
    background: color-mix(in srgb, rgb(239, 68, 68) 6%, transparent);
    border-bottom: 1px solid color-mix(in srgb, rgb(239, 68, 68) 20%, transparent);
    flex-shrink: 0;
  }

  /* ── Content area ── */
  .composer-content {
    flex: 1;
    overflow-y: auto;
    min-height: 100px;
  }

  .document-editor {
    width: 100%;
    height: 100%;
    border: none;
    outline: none;
    resize: none;
    padding: 0.75rem 1rem;
    line-height: 1.6;
    color: var(--text-primary, #111);
    background: transparent;
    font-family:
      'Inter',
      -apple-system,
      BlinkMacSystemFont,
      sans-serif;
  }

  .document-editor::placeholder {
    color: var(--text-secondary, #999);
    opacity: 0.6;
  }

  .document-streaming {
    padding: 0.75rem 1rem;
    min-height: 100%;
  }

  .document-rendered {
    padding: 0.75rem 1rem;
    cursor: text;
    min-height: 100%;
  }

  .document-empty {
    padding: 0.75rem 1rem;
    cursor: text;
    min-height: 100%;
  }

  .empty-placeholder {
    color: var(--text-secondary, #999);
    opacity: 0.6;
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    gap: 0.4rem;
  }

  .loading-state .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--primary-color, #646cff);
    animation: pulse-composer 1.2s infinite ease-in-out;
  }

  .loading-state .dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .loading-state .dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes pulse-composer {
    0%,
    80%,
    100% {
      opacity: 0.4;
      transform: scale(1);
    }
    40% {
      opacity: 1;
      transform: scale(1.2);
    }
  }
</style>

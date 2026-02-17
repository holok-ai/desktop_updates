<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import ModelSelector from './common/ModelSelector.svelte';
  import type { Attachment } from '../../../src-shared/types/attachment.types';
  import type { ModelDetails } from '../../../src-electron/preload';
  import { copyToInputStore, clearCopyToInput } from '$lib/services/clipboard.service';

  // Props from ChatPane slot
  interface Props {
    sendMessage?: (appSlug: string, modelIds: string[], text: string, attachments?: Attachment[]) => Promise<void>;
    isStreaming?: boolean;
    threadId?: string | null;
    disabled?: boolean;
    initialText?: string;
    applicationSlug?: string;
    agentId?: string | null;
    modelId?: string;
  }

  let { sendMessage, isStreaming = false, threadId: _threadId = null, disabled = false, initialText = '', applicationSlug, agentId, modelId }: Props = $props();

  let text = $state('');
  let selectedApplicationSlug = $state('');
  let selectedModelId = $state('');
  let selectedModelIds = $state<string[]>([]); // Track all selected models

  // Update local state when props change
  $effect(() => {
    if (applicationSlug) selectedApplicationSlug = applicationSlug;
  });

  $effect(() => {
    if (modelId) selectedModelId = modelId;
  });

  // Track if we've auto-submitted the initial text
  let hasAutoSubmitted = $state(false);

  // Update text when initialText changes
  $effect(() => {
    if (initialText) {
      text = initialText;
    }
  });

  // Auto-submit when initialText is provided (for new threads)
  $effect(() => {
    if (
      initialText &&
      !hasAutoSubmitted &&
      !disabled &&
      !isStreaming &&
      selectedApplicationSlug &&
      selectedModelId &&
      sendMessage
    ) {
      hasAutoSubmitted = true;
      // Small delay to ensure everything is ready
      setTimeout(() => {
        void send();
      }, 100);
    }
  });

  // Auto-grow textarea when text changes
  $effect(() => {
    // Track text changes to trigger effect
    text;
    if (textareaRef) {
      textareaRef.style.height = 'auto';
      textareaRef.style.height = textareaRef.scrollHeight + 'px';
    }
  });

  let selectedFiles = $state<File[]>([]);
  let fileInputRef: HTMLInputElement | undefined = $state();
  let textareaRef: HTMLTextAreaElement | undefined = $state();
  let isDragging = $state(false);
  let dragCounter = $state(0); // Track nested drag enter/leave events
  let validationError = $state('');

  // Listen for copy-to-input requests
  let unsubCopyToInput: (() => void) | undefined;
  onMount(() => {
    unsubCopyToInput = copyToInputStore.subscribe((content) => {
      if (content !== null) {
        text = content;
        clearCopyToInput();
        // Focus the textarea
        setTimeout(() => textareaRef?.focus(), 0);
      }
    });
  });
  onDestroy(() => unsubCopyToInput?.());

  function handleFileSelect() {
    fileInputRef?.click();
  }

  // Drag and drop handlers
  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    if (e.dataTransfer?.types.includes('Files')) {
      isDragging = true;
    }
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter === 0) {
      isDragging = false;
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragging = false;
    dragCounter = 0;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      selectedFiles = [...selectedFiles, ...Array.from(files)];
    }
  }

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      selectedFiles = [...selectedFiles, ...Array.from(input.files)];
      // Reset input so same file can be selected again
      input.value = '';
    }
  }

  function removeFile(index: number) {
    selectedFiles = selectedFiles.filter((_, i) => i !== index);
  }

  /**
   * Upload files and return Attachment array
   */
  async function _uploadFiles(files: File[], threadId: string): Promise<Attachment[]> {
    const attachments: Attachment[] = [];

    for (const file of files) {
      try {
        // Validate file first
        const validation = await window.electronAPI.file.validate({
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        });

        if (!validation.valid) {
          console.error('File validation failed:', validation.error);
          // Surface validation error to UI for accessibility/testing
          validationError = String(validation.error ?? 'File validation failed');
          // auto-clear after 5s
          setTimeout(() => {
            validationError = '';
          }, 5000);
          continue;
        }

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        // Upload file
        const result = await window.electronAPI.file.upload({
          threadId,
          fileBuffer: buffer as any, // IPC will handle the Buffer conversion
          filename: file.name,
          mimeType: file.type,
        });

        if (result.success && result.attachment) {
          attachments.push(result.attachment);
        } else {
          console.error('File upload failed:', result.error);
          // TODO: Show error to user
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        // TODO: Show error to user
      }
    }

    return attachments;
  }

  async function send() {
    if (disabled) {
      console.log('[Composer] Blocked send() - composer is disabled', { disabled, isStreaming });
      return;
    }

    let payload = text.trim();
    if ((!payload && selectedFiles.length === 0) || !sendMessage || isStreaming || !selectedApplicationSlug || !selectedModelId) {
      return;
    }

    const filesToProcess = [...selectedFiles];
    text = ''; // Clear input immediately
    selectedFiles = [];

    // Read text file contents and append to message
    const MAX_FILE_SIZE = 100 * 1024; // 100KB
    for (const file of filesToProcess) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        validationError = `File "${file.name}" is too large. Maximum size is 100KB.`;
        setTimeout(() => {
          validationError = '';
        }, 5000);
        continue;
      }

      try {
        // Read file as text
        const fileContents = await file.text();

        // Append to payload in the specified format
        const fileSection = `\n\nFile contents for ${file.name} are: ${fileContents}`;
        payload += fileSection;
      } catch (error) {
        console.error('Error reading file:', file.name, error);
        validationError = `Failed to read file: ${file.name}`;
        setTimeout(() => {
          validationError = '';
        }, 5000);
      }
    }

    await sendMessage(selectedApplicationSlug, selectedModelIds.length > 0 ? selectedModelIds : [selectedModelId], payload, []);
  }

  // Keyboard shortcut: Cmd/Ctrl + U to attach file
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
      e.preventDefault();
      handleFileSelect();
    }
  }

  function handleModelSelect(e: CustomEvent<{
    modelId: string;
    modelDetails: ModelDetails;
    appSlug: string;
    modelSlug: string;
    selectedModelIds: string[];
  }>) {
    selectedModelId = e.detail.modelId;
    selectedModelIds = e.detail.selectedModelIds;
    selectedApplicationSlug = e.detail.appSlug;
    console.log('[Composer] Model selected - appSlug:', e.detail.appSlug, 'modelIds:', e.detail.selectedModelIds);
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- Hidden file input -->
<input
  type="file"
  bind:this={fileInputRef}
  onchange={handleFileChange}
  multiple
  accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/markdown,application/json,text/csv"
  style="display: none;"
  aria-label="Select files to attach"
/>

  <div class="composer-container">
    <div
      class="composer-box"
      role="region"
      aria-label="Message input with file drop zone"
      class:dragging={isDragging}
      ondragenter={handleDragEnter}
      ondragleave={handleDragLeave}
      ondragover={handleDragOver}
      ondrop={handleDrop}
    >
      {#if isDragging}
        <div class="drag-overlay" role="status" aria-live="polite">
          <div class="drag-message">
            <svg
              class="w-12 h-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p>Drop files here to attach</p>
          </div>
        </div>
      {/if}

      <textarea
        bind:this={textareaRef}
        bind:value={text}
        placeholder={disabled ? "Select a branch to continue..." : "Enter a prompt ..."}
        rows={2}
        disabled={isStreaming || disabled}
        aria-label="Message input. Press Enter to send, Shift+Enter for new line"
        data-testid="message-input"
        aria-describedby="composer-help-text"
        class="composer-textarea"
        onkeydown={(e) => {
          // Send on Enter (without Shift). Allow Shift+Enter for newline.
          // Don't send if disabled or streaming
          if (e.key === 'Enter' && !e.shiftKey && !disabled && !isStreaming) {
            e.preventDefault();
            send();
          }
        }}
      ></textarea>
      <span id="composer-help-text" class="sr-only">
        Press Enter to send message. Press Shift+Enter for new line. Press Ctrl+U or Cmd+U to attach
        files.
      </span>

      <div class="composer-actions">
        <button
          type="button"
          class="attach-icon-button"
          onclick={handleFileSelect}
          disabled={isStreaming || disabled}
          aria-label="Attach file (Ctrl+U or Cmd+U)"
          title="Attach file"
        >
          <i class="pi pi-plus"></i>
        </button>

        <div class="model-and-send">
          <div class="model-selector-wrapper">
            <ModelSelector
              bind:selectedModelId
              {agentId}
              label=""
              dropdownDirection="up"
              backgroundColor="var(--surface-card)"
              allowMultipleSelections={true}
              on:select={handleModelSelect}
            />
          </div>

          <button
            class="btn-holokai send-button"
            type="button"
            onclick={send}
            disabled={isStreaming || disabled}
            aria-label={isStreaming ? 'Sending message...' : 'Send message (Enter)'}
            aria-disabled={isStreaming || disabled}
            class:sending={isStreaming}
            data-tooltip-left="Enter to run prompt. Shift+Enter to insert a new line."
          >
            <i class="pi pi-arrow-up"></i>
          </button>
        </div>
      </div>
    </div>

    {#if validationError}
      <div role="alert" class="error-message" aria-live="assertive">{validationError}</div>
    {/if}

    <!-- Attachment badges outside the box -->
    {#if selectedFiles.length > 0}
      <div class="attachments-badges" role="list" aria-label="Selected attachments">
        {#each selectedFiles as file, index}
          <div class="attachment-badge" role="listitem">
            <span class="badge-filename">{file.name}</span>
            <button
              class="badge-remove"
              onclick={() => removeFile(index)}
              aria-label="Remove {file.name}"
              type="button"
            >
              <i class="pi pi-times"></i>
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

<style>
  /* Screen reader only class for accessibility */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .composer-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
    background: var(--surface-main, #fafafa);
  }

  .composer-box {
    width: 90%;
    background: var(--surface-card, #fff);
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 12px;
    padding: 0.5rem 1rem 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    position: relative;
    transition: border-color 0.2s ease;
  }

  .composer-box.dragging {
    border-color: var(--primary-color);
    border-width: 2px;
    background: color-mix(in srgb, var(--primary-color) 8%, var(--surface-card));
  }

  .drag-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: color-mix(in srgb, var(--primary-color) 12%, transparent);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    border-radius: 12px;
    pointer-events: none;
  }

  .drag-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    color: var(--primary-color);
    font-weight: 500;
  }

  .drag-message svg {
    width: 48px;
    height: 48px;
  }

  .drag-message p {
    font-size: 16px;
    margin: 0;
  }

  .composer-textarea {
    width: 100%;
    padding: 0.5rem;
    background: var(--surface-card, #fff);
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    font-family: inherit;
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--text-primary);
    resize: none;
    overflow: hidden;
    min-height: 3em;
  }

  .composer-textarea:focus,
  .composer-textarea:active,
  .composer-textarea:hover,
  .composer-textarea:focus-visible {
    outline: none !important;
    border: none !important;
    box-shadow: none !important;
  }

  .composer-textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .composer-textarea::placeholder {
    color: var(--text-secondary);
    opacity: 0.6;
  }

  .composer-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .model-and-send {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .model-selector-wrapper {
    display: flex;
    align-items: center;
  }

  .attach-icon-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
    font-size: 1.25rem;
  }

  .attach-icon-button:hover:not(:disabled) {
    background: var(--surface-hover, #f0f0f0);
    color: var(--text-primary);
  }

  .attach-icon-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .send-button {
    width: 40px;
    height: 40px;
    padding: 0 !important;
  }

  .send-button i {
    font-size: 18px;
  }

  .send-button.sending {
    opacity: 0.7;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.7;
    }
    50% {
      opacity: 0.5;
    }
  }

  .send-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-message {
    color: var(--error-color, #dc2626);
    font-size: 0.875rem;
    padding: 0.5rem;
    background: var(--error-bg);
    border-radius: 6px;
    width: 90%;
  }

  .attachments-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    width: 90%;
  }

  .attachment-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    background: var(--surface-hover, #f0f0f0);
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 6px;
    font-size: 0.8125rem;
    color: var(--text-primary);
    max-width: 200px;
  }

  .badge-filename {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 3px;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .badge-remove:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
  }

  .badge-remove i {
    font-size: 10px;
  }
</style>

<script lang="ts">
  import AttachmentPreview from './AttachmentPreview.svelte';
  import type { Attachment } from '../../../src-shared/types/attachment.types';

  // Props from ChatPane slot
  interface Props {
    sendMessage?: (text: string, attachments?: Attachment[]) => Promise<void>;
    isStreaming?: boolean;
    threadId?: string | null;
  }

  let { sendMessage, isStreaming = false, threadId = null }: Props = $props();

  let text = $state('');
  let selectedFiles = $state<File[]>([]);
  let fileInputRef: HTMLInputElement | undefined = $state();
  let isDragging = $state(false);
  let dragCounter = $state(0); // Track nested drag enter/leave events
  let validationError = $state('');

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
  async function uploadFiles(files: File[], threadId: string): Promise<Attachment[]> {
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
    const payload = text.trim();
    if ((!payload && selectedFiles.length === 0) || !sendMessage || isStreaming) return;

    const filesToUpload = [...selectedFiles];
    text = ''; // Clear input immediately
    selectedFiles = [];

    // Upload files if we have a threadId
    let attachments: Attachment[] = [];
    if (filesToUpload.length > 0 && threadId) {
      attachments = await uploadFiles(filesToUpload, threadId);
    }

    await sendMessage(payload, attachments);
  }

  // Keyboard shortcut: Cmd/Ctrl + U to attach file
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
      e.preventDefault();
      handleFileSelect();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div
  class="composer"
  role="region"
  aria-label="Message composer with file drop zone"
  ondragenter={handleDragEnter}
  ondragleave={handleDragLeave}
  ondragover={handleDragOver}
  ondrop={handleDrop}
  class:dragging={isDragging}
>
  <!-- Drag overlay -->
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

  <!-- Attachment previews -->
  {#if selectedFiles.length > 0}
    <div class="attachments-preview" role="list" aria-label="Selected attachments">
      {#each selectedFiles as file, index}
        <AttachmentPreview
          attachment={{
            id: `temp-${index}`,
            filename: file.name,
            mimeType: file.type,
            size: file.size,
            uploadedAt: Date.now(),
            status: 'success',
          }}
          mode="preview"
          onRemove={() => removeFile(index)}
        />
      {/each}
    </div>
  {/if}

  {#if validationError}
    <div role="alert" class="error-message" aria-live="assertive">{validationError}</div>
  {/if}

  <div class="input-container">
    <!-- Attach button -->
    <button
      type="button"
      class="attach-button"
      onclick={handleFileSelect}
      disabled={isStreaming}
      aria-label="Attach file (Ctrl+U or Cmd+U)"
      title="Attach file (Ctrl+U or Cmd+U)"
    >
      <svg
        class="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
        />
      </svg>
    </button>

    <textarea
      bind:value={text}
      placeholder="Write a message..."
      rows={3}
      disabled={isStreaming}
      aria-label="Message input. Press Enter to send, Shift+Enter for new line"
      data-testid="message-input"
      aria-describedby="composer-help-text"
      onkeydown={(e) => {
        // Send on Enter (without Shift). Allow Shift+Enter for newline.
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          send();
        }
      }}
    ></textarea>
    <span id="composer-help-text" class="sr-only">
      Press Enter to send message. Press Shift+Enter for new line. Press Ctrl+U or Cmd+U to attach
      files.
    </span>
  </div>

  <div class="actions">
    <button
      class="primary"
      type="button"
      onclick={send}
      disabled={isStreaming || (!text.trim() && selectedFiles.length === 0)}
      aria-label={isStreaming ? 'Sending message...' : 'Send message (Enter)'}
      aria-disabled={isStreaming || (!text.trim() && selectedFiles.length === 0)}
    >
      {isStreaming ? 'Sending...' : 'Send'}
    </button>
  </div>
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

  .composer {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    position: relative;
    transition: all 0.2s ease;
  }

  .composer.dragging {
    border: 2px dashed #646cff;
    border-radius: 8px;
    background-color: #f5f5ff;
  }

  .drag-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(100, 108, 255, 0.1);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    border-radius: 8px;
    pointer-events: none;
  }

  .drag-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: #646cff;
    font-weight: 500;
  }

  .drag-message svg {
    width: 48px;
    height: 48px;
  }

  .drag-message p {
    font-size: 1.125rem;
    margin: 0;
  }

  .attachments-preview {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .input-container {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .attach-button {
    flex-shrink: 0;
    padding: 0.5rem;
    background: transparent;
    border: 1px solid var(--border-sidebar);
    border-radius: 6px;
    cursor: pointer;
    color: #646cff;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .attach-button:hover:not(:disabled) {
    background: #f5f5ff;
    border-color: #646cff;
  }

  .attach-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .attach-button svg {
    width: 20px;
    height: 20px;
  }

  .composer textarea {
    flex: 1;
    width: 100%;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--border-sidebar);
    font-family: inherit;
    resize: vertical;
  }

  .composer textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  .actions {
    text-align: right;
  }

  .primary {
    background: #646cff;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-weight: 500;
  }

  .primary:hover:not(:disabled) {
    background: #535bf2;
  }

  .primary:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
</style>

# Thread Panel Message Media

**Version:** 1.1
**Date:** 2026-01-27
**Status:** Draft

---

## Related Documents

| Document | Description |
|----------|-------------|
| **ui-threadpanel-message-layout.md** | Message layout and content rendering |
| **chat-response-resources.md** | Resource extraction and caching |
| **ui-threadpanel-chatview.md** | Chat view and message timeline |

---

## 1. Overview

This document defines the requirements for handling media content in chat messages, including file attachment thumbnails, image display with resizing, audio playback, and video playback.

### Scope

| In Scope | Out of Scope |
|----------|--------------|
| File attachment thumbnails | File upload handling |
| Image display and resizing | Image generation |
| Audio playback controls | Audio recording |
| Video playback controls | Video recording |
| Media player UI | Resource caching (see chat-response-resources.md) |

---

## 2. Requirements

### 2.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| **FR-1** | Display thumbnails for user-attached files | HIGH |
| **FR-2** | Display images in responses with resizing controls | HIGH |
| **FR-3** | Play audio in responses with replay controls | MEDIUM |
| **FR-4** | Play video in responses with replay controls | MEDIUM |
| **FR-5** | Support fullscreen mode for images and video | MEDIUM |
| **FR-6** | Provide download option for all media types | HIGH |
| **FR-7** | Show loading states for media content | HIGH |
| **FR-8** | Handle media load errors gracefully | HIGH |

### 2.2 Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| **NFR-1** | Image thumbnail generation | < 100ms |
| **NFR-2** | Media player initialization | < 200ms |
| **NFR-3** | Seek response time | < 100ms |
| **NFR-4** | Memory usage per media item | < 50MB |

---

## 3. Base Media Abstraction

All media components (ImageViewer, AudioPlayer, VideoPlayer) share common functionality for resource loading, state management, error handling, and telemetry. This is implemented as a composable function that returns reactive state and methods.

### 3.1 Benefits

| Benefit | Description |
|---------|-------------|
| **DRY** | Resource loading logic implemented once |
| **Consistent UX** | Same loading/error states across all media types |
| **Maintainability** | Fix bugs or add features in one place |
| **Telemetry** | Centralized performance logging |
| **Extensibility** | Easy to add new media types (PDFs, 3D models) |
| **Testing** | Shared logic can be unit tested independently |

### 3.2 Common State

```typescript
type MediaLoadState = 'idle' | 'loading' | 'loaded' | 'error';

interface MediaState {
  // Resource identification
  resourceId: string;
  mimeType: string;
  
  // Loading state
  loadState: MediaLoadState;
  src: string | null;           // Resolved file:// URL
  error: string | null;
  
  // Timing (for telemetry)
  loadStartTime: number | null;
  loadEndTime: number | null;
  loadDuration: number | null;  // ms
}
```

### 3.3 Common Methods

```typescript
interface MediaActions {
  // Resource loading
  load(): Promise<void>;
  retry(): Promise<void>;
  
  // Download
  download(): Promise<void>;
  
  // Cleanup
  dispose(): void;
  
  // Logging
  logEvent(event: MediaEvent): void;
}

type MediaEvent = 
  | { type: 'load_start'; resourceId: string }
  | { type: 'load_success'; resourceId: string; duration: number }
  | { type: 'load_error'; resourceId: string; error: string }
  | { type: 'download_start'; resourceId: string }
  | { type: 'download_complete'; resourceId: string }
  | { type: 'playback_start'; resourceId: string }
  | { type: 'playback_pause'; resourceId: string; position: number }
  | { type: 'playback_complete'; resourceId: string }
  | { type: 'playback_error'; resourceId: string; error: string };
```

### 3.4 useMediaResource Composable

**File:** `src/lib/composables/useMediaResource.svelte.ts`

```typescript
import { onMount, onDestroy } from 'svelte';

export interface UseMediaResourceOptions {
  resourceId: string;
  mimeType: string;
  autoLoad?: boolean;          // Default: true
  onLoad?: (src: string) => void;
  onError?: (error: string) => void;
}

export interface MediaResource {
  // State (reactive)
  state: MediaState;
  
  // Computed
  isLoading: boolean;
  isLoaded: boolean;
  isError: boolean;
  
  // Actions
  load: () => Promise<void>;
  retry: () => Promise<void>;
  download: () => Promise<void>;
  dispose: () => void;
}

export function useMediaResource(options: UseMediaResourceOptions): MediaResource {
  // Reactive state
  let state = $state<MediaState>({
    resourceId: options.resourceId,
    mimeType: options.mimeType,
    loadState: 'idle',
    src: null,
    error: null,
    loadStartTime: null,
    loadEndTime: null,
    loadDuration: null,
  });
  
  // Computed properties
  const isLoading = $derived(state.loadState === 'loading');
  const isLoaded = $derived(state.loadState === 'loaded');
  const isError = $derived(state.loadState === 'error');
  
  // Load resource from cache
  async function load(): Promise<void> {
    if (state.loadState === 'loading') return;
    
    state.loadState = 'loading';
    state.error = null;
    state.loadStartTime = performance.now();
    
    logEvent({ type: 'load_start', resourceId: options.resourceId });
    
    try {
      const filePath = await window.electronAPI.resource.getFilePath(options.resourceId);
      
      if (!filePath) {
        throw new Error('Resource not found in cache');
      }
      
      state.src = `file://${filePath}`;
      state.loadState = 'loaded';
      state.loadEndTime = performance.now();
      state.loadDuration = state.loadEndTime - state.loadStartTime;
      
      logEvent({ 
        type: 'load_success', 
        resourceId: options.resourceId,
        duration: state.loadDuration 
      });
      
      options.onLoad?.(state.src);
      
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      state.loadState = 'error';
      state.error = errorMessage;
      state.loadEndTime = performance.now();
      state.loadDuration = state.loadEndTime - (state.loadStartTime ?? 0);
      
      logEvent({ 
        type: 'load_error', 
        resourceId: options.resourceId, 
        error: errorMessage 
      });
      
      options.onError?.(errorMessage);
    }
  }
  
  // Retry loading
  async function retry(): Promise<void> {
    state.loadState = 'idle';
    state.error = null;
    await load();
  }
  
  // Download resource
  async function download(): Promise<void> {
    logEvent({ type: 'download_start', resourceId: options.resourceId });
    
    try {
      await window.electronAPI.resource.download(options.resourceId);
      logEvent({ type: 'download_complete', resourceId: options.resourceId });
    } catch (e) {
      console.error('[MediaResource] Download failed:', e);
    }
  }
  
  // Cleanup
  function dispose(): void {
    state.src = null;
    state.loadState = 'idle';
  }
  
  // Logging
  function logEvent(event: MediaEvent): void {
    console.log('[MediaResource]', event.type, {
      resourceId: event.resourceId,
      ...event,
    });
    
    // Send to telemetry service if available
    window.electronAPI?.telemetry?.log('media', event);
  }
  
  // Auto-load on mount
  onMount(() => {
    if (options.autoLoad !== false) {
      load();
    }
  });
  
  // Cleanup on destroy
  onDestroy(() => {
    dispose();
  });
  
  return {
    get state() { return state; },
    get isLoading() { return isLoading; },
    get isLoaded() { return isLoaded; },
    get isError() { return isError; },
    load,
    retry,
    download,
    dispose,
  };
}
```

### 3.5 Usage in Media Components

**ImageViewer using composable:**
```svelte
<script lang="ts">
  import { useMediaResource } from '$lib/composables/useMediaResource.svelte';
  
  interface Props {
    resourceId: string;
    width: number;
    height: number;
    alt?: string;
    options?: ImageDisplayOptions;
  }
  
  const { resourceId, width, height, alt, options }: Props = $props();
  
  // Use shared resource loading
  const media = useMediaResource({
    resourceId,
    mimeType: 'image/*',
  });
  
  // Image-specific state
  let showLightbox = $state(false);
  let currentSize = $state({ width, height });
</script>

<div class="image-viewer">
  {#if media.isLoading}
    <div class="image-placeholder" style="aspect-ratio: {width}/{height}">
      <Spinner />
    </div>
  {:else if media.isError}
    <MediaError 
      error={media.state.error} 
      onRetry={media.retry} 
    />
  {:else if media.isLoaded}
    <img
      src={media.state.src}
      {alt}
      width={currentSize.width}
      height={currentSize.height}
      onclick={() => showLightbox = true}
    />
    <MediaToolbar onDownload={media.download} />
  {/if}
</div>
```

**AudioPlayer using composable:**
```svelte
<script lang="ts">
  import { useMediaResource } from '$lib/composables/useMediaResource.svelte';
  
  interface Props {
    resourceId: string;
    duration?: number;
    options?: AudioPlayerOptions;
  }
  
  const { resourceId, duration, options }: Props = $props();
  
  // Use shared resource loading
  const media = useMediaResource({
    resourceId,
    mimeType: 'audio/*',
  });
  
  // Audio-specific state
  let audioElement: HTMLAudioElement;
  let isPlaying = $state(false);
  let currentTime = $state(0);
  let volume = $state(options?.defaultVolume ?? 0.8);
</script>

<div class="audio-player">
  {#if media.isLoading}
    <MediaLoading message="Loading audio..." />
  {:else if media.isError}
    <MediaError error={media.state.error} onRetry={media.retry} />
  {:else if media.isLoaded}
    <audio bind:this={audioElement} src={media.state.src} />
    <!-- Audio controls -->
  {/if}
</div>
```

### 3.6 Shared UI Components

Common UI elements used across all media types:

```typescript
// MediaLoading.svelte - Loading spinner with message
interface MediaLoadingProps {
  message?: string;           // Default: "Loading..."
}

// MediaError.svelte - Error display with retry
interface MediaErrorProps {
  error: string | null;
  onRetry?: () => void;
  showRetry?: boolean;        // Default: true
}

// MediaToolbar.svelte - Common action buttons
interface MediaToolbarProps {
  onDownload?: () => void;
  onFullscreen?: () => void;
  showDownload?: boolean;     // Default: true
  showFullscreen?: boolean;   // Default: false
  children?: Snippet;         // Additional buttons
}
```

**MediaError Component:**
```svelte
<script lang="ts">
  interface Props {
    error: string | null;
    onRetry?: () => void;
    showRetry?: boolean;
  }
  
  const { error, onRetry, showRetry = true }: Props = $props();
</script>

<div class="media-error">
  <ErrorIcon size={32} />
  <span class="error-message">{error ?? 'Failed to load media'}</span>
  {#if showRetry && onRetry}
    <button class="retry-button" onclick={onRetry}>
      <RetryIcon size={16} />
      Retry
    </button>
  {/if}
</div>

<style>
  .media-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem;
    background: var(--surface-secondary);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    color: var(--text-secondary);
  }
  
  .error-message {
    font-size: 0.875rem;
    text-align: center;
  }
  
  .retry-button {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    background: var(--surface-tertiary);
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
  }
  
  .retry-button:hover {
    background: var(--surface-hover);
  }
</style>
```

### 3.7 Telemetry Events

The base composable emits telemetry events for monitoring and debugging:

| Event | When | Data |
|-------|------|------|
| `load_start` | Resource loading begins | resourceId |
| `load_success` | Resource loaded successfully | resourceId, duration (ms) |
| `load_error` | Resource failed to load | resourceId, error message |
| `download_start` | Download initiated | resourceId |
| `download_complete` | Download finished | resourceId |
| `playback_start` | Media playback started | resourceId |
| `playback_pause` | Media paused | resourceId, position (s) |
| `playback_complete` | Media finished playing | resourceId |
| `playback_error` | Playback error occurred | resourceId, error |

### 3.8 Component Hierarchy

```
useMediaResource (composable)
├── MediaState (reactive state)
├── load() / retry() / download() / dispose()
└── logEvent() (telemetry)

Shared UI Components
├── MediaLoading.svelte
├── MediaError.svelte
└── MediaToolbar.svelte

Media Players (use composable + shared UI)
├── ImageViewer.svelte
│   ├── useMediaResource()
│   ├── MediaLoading / MediaError
│   ├── Image-specific: resize, lightbox
│   └── ImageLightbox.svelte
├── AudioPlayer.svelte
│   ├── useMediaResource()
│   ├── MediaLoading / MediaError
│   ├── Audio-specific: play, seek, volume
│   └── WaveformDisplay.svelte (optional)
└── VideoPlayer.svelte
    ├── useMediaResource()
    ├── MediaLoading / MediaError
    ├── Video-specific: play, seek, volume, fullscreen, PiP
    └── VideoControls.svelte
```

---

## 4. File Attachment Thumbnails (FR-1)

Display thumbnails for files attached to user prompts.

### 4.1 Thumbnail Types

| File Type | Thumbnail | Generation |
|-----------|-----------|------------|
| Images (png, jpg, gif, webp, svg) | Scaled preview | Resize to fit |
| PDF | First page preview | PDF renderer |
| Video (mp4, webm) | First frame | Video decoder |
| Audio (mp3, wav, ogg) | Waveform icon | Static icon |
| Code files | Language icon + filename | Static icon |
| Documents (docx, xlsx, pptx) | File type icon | Static icon |
| Other | Generic file icon | Static icon |

### 4.2 Data Model

```typescript
interface AttachmentThumbnail {
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;                // Bytes
  thumbnailUrl?: string;       // Generated thumbnail or icon
  width: number;               // Thumbnail width (default: 80px)
  height: number;              // Thumbnail height (default: 80px)
}

interface AttachmentDisplayOptions {
  maxThumbnails: number;       // Show "+N more" after this (default: 5)
  showFilename: boolean;       // Display filename below thumbnail
  showFilesize: boolean;       // Display file size
  clickAction: 'preview' | 'download' | 'expand';
}
```

### 4.3 Visual Layout

```
┌────────────────────────────────────────────────────────────┐
│  User: "Analyze these images"                              │
│                                                            │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │
│  │ img1 │ │ img2 │ │ img3 │ │ doc  │ │ +2   │              │
│  │ .png │ │ .jpg │ │ .svg │ │ .pdf │ │ more │              │
│  │ 1.2MB│ │ 845KB│ │ 12KB │ │ 2.1MB│ │      │              │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘              │
└────────────────────────────────────────────────────────────┘
```

### 4.4 AttachmentList Component

```svelte
<script lang="ts">
  interface Props {
    attachments: AttachmentThumbnail[];
    options?: AttachmentDisplayOptions;
    onAttachmentClick?: (attachment: AttachmentThumbnail) => void;
  }
  
  const { attachments, options, onAttachmentClick }: Props = $props();
  
  const maxVisible = options?.maxThumbnails ?? 5;
  const visibleAttachments = $derived(attachments.slice(0, maxVisible));
  const hiddenCount = $derived(Math.max(0, attachments.length - maxVisible));
</script>

<div class="attachment-list">
  {#each visibleAttachments as attachment}
    <button
      class="attachment-thumbnail"
      onclick={() => onAttachmentClick?.(attachment)}
      title={attachment.filename}
    >
      <div class="thumbnail-image">
        {#if attachment.thumbnailUrl}
          <img src={attachment.thumbnailUrl} alt={attachment.filename} />
        {:else}
          <FileIcon mimeType={attachment.mimeType} />
        {/if}
      </div>
      {#if options?.showFilename}
        <span class="filename">{truncateFilename(attachment.filename)}</span>
      {/if}
      {#if options?.showFilesize}
        <span class="filesize">{formatFileSize(attachment.size)}</span>
      {/if}
    </button>
  {/each}
  
  {#if hiddenCount > 0}
    <button class="attachment-more" onclick={() => showAll = true}>
      +{hiddenCount} more
    </button>
  {/if}
</div>

<style>
  .attachment-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  
  .attachment-thumbnail {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5rem;
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    background: var(--surface-secondary);
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .attachment-thumbnail:hover {
    background: var(--surface-hover);
  }
  
  .thumbnail-image {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 4px;
  }
  
  .thumbnail-image img {
    max-width: 100%;
    max-height: 100%;
    object-fit: cover;
  }
  
  .filename {
    font-size: 0.75rem;
    margin-top: 0.25rem;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .filesize {
    font-size: 0.625rem;
    color: var(--text-secondary);
  }
  
  .attachment-more {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border: 1px dashed var(--surface-border);
    border-radius: 8px;
    background: none;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
</style>
```

---

## 5. Image Display (FR-2)

Display images in assistant responses with sizing and interaction controls.

### 5.1 Display Modes

| Mode | Description | Trigger |
|------|-------------|---------|
| `inline` | Display at natural size up to max width | Default |
| `thumbnail` | Small preview (150px), click to expand | User preference |
| `lightbox` | Full resolution in overlay | Click inline/thumbnail |

### 5.2 Configuration

```typescript
interface ImageDisplayOptions {
  initialMode: 'inline' | 'thumbnail';
  maxInlineWidth: string;      // Default: '100%'
  maxInlineHeight: string;     // Default: '400px'
  thumbnailSize: number;       // Default: 150px
  allowResize: boolean;        // Drag corners to resize (default: true)
  allowFullscreen: boolean;    // Expand to lightbox (default: true)
  allowDownload: boolean;      // Download button (default: true)
  showDimensions: boolean;     // Show WxH on hover (default: true)
}
```

### 5.3 Visual Layout

**Inline Mode:**
```
┌─────────────────────────────────────────────────────────────┐
│  Assistant: "Here's the generated chart:"                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                                                         ││
│  │                                                         ││
│  │                    [Image Content]                      ││
│  │                                                         ││
│  │                                                         ││
│  ├─────────────────────────────────────────────────────────┤│
│  │  800 × 600  |  ⛶ Fullscreen  |  ⬇️ Download             ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Lightbox Mode:**
```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │ ✕  │
│  │                                                     │    │
│  │                                                     │    │
│  │               [Full Resolution Image]               │    │
│  │                                                     │    │
│  │                                                     │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ◀ 1 / 3 ▶       800 × 600       ⬇️ Download               │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 ImageViewer Component

```svelte
<script lang="ts">
  import { useMediaResource } from '$lib/composables/useMediaResource.svelte';
  import MediaError from '$lib/components/media/MediaError.svelte';
  import MediaToolbar from '$lib/components/media/MediaToolbar.svelte';
  
  interface Props {
    resourceId: string;
    width: number;
    height: number;
    alt?: string;
    options?: ImageDisplayOptions;
    onResize?: (width: number, height: number) => void;
  }
  
  const { resourceId, width, height, alt, options, onResize }: Props = $props();
  
  // Use shared resource loading
  const media = useMediaResource({
    resourceId,
    mimeType: 'image/*',
  });
  
  // Image-specific state
  let showLightbox = $state(false);
  let currentSize = $state({ width, height });
  let isResizing = $state(false);
  
  function handleResizeStart(event: MouseEvent) {
    if (!options?.allowResize) return;
    isResizing = true;
    // ... resize logic
  }
</script>

<div class="image-viewer" class:loading={media.isLoading} class:error={media.isError}>
  {#if media.isLoading}
    <div class="image-placeholder" style="aspect-ratio: {width}/{height}">
      <Spinner />
    </div>
  {:else if media.isError}
    <MediaError 
      error={media.state.error} 
      onRetry={media.retry} 
    />
  {:else}
    <div 
      class="image-container"
      style="width: {currentSize.width}px; max-width: 100%"
    >
      <img
        src={media.state.src}
        {alt}
        width={currentSize.width}
        height={currentSize.height}
        onclick={() => options?.allowFullscreen && (showLightbox = true)}
      />
      
      {#if options?.allowResize}
        <div class="resize-handle" onmousedown={handleResizeStart}></div>
      {/if}
      
      <MediaToolbar 
        onDownload={media.download}
        onFullscreen={() => showLightbox = true}
        showFullscreen={options?.allowFullscreen}
        showDownload={options?.allowDownload}
      >
        {#if options?.showDimensions}
          <span class="dimensions">{currentSize.width} × {currentSize.height}</span>
        {/if}
      </MediaToolbar>
    </div>
  {/if}
</div>

{#if showLightbox}
  <ImageLightbox
    src={media.state.src}
    {alt}
    {width}
    {height}
    onClose={() => showLightbox = false}
    onDownload={media.download}
  />
{/if}

<style>
  .image-viewer {
    position: relative;
    display: inline-block;
    max-width: 100%;
  }
  
  .image-container {
    position: relative;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .image-container img {
    display: block;
    max-width: 100%;
    height: auto;
    cursor: pointer;
  }
  
  .resize-handle {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 16px;
    height: 16px;
    cursor: nwse-resize;
    background: linear-gradient(135deg, transparent 50%, var(--surface-border) 50%);
  }
  
  .dimensions {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-right: auto;
  }
  
  .image-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-secondary);
    border-radius: 8px;
  }
</style>
```

### 5.5 Resize Interaction

| Action | Result |
|--------|--------|
| Drag corner | Resize maintaining aspect ratio |
| Shift+drag | Free resize (ignore aspect ratio) |
| Double-click | Reset to original size |
| Right-click | Context menu: View full, Download, Copy |

---

## 6. Audio Playback (FR-3)

Play audio content in responses with full playback controls.

### 6.1 Supported Formats

| Format | Extension | MIME Type |
|--------|-----------|-----------|
| MP3 | .mp3 | audio/mpeg |
| WAV | .wav | audio/wav |
| OGG | .ogg | audio/ogg |
| WebM | .webm | audio/webm |
| M4A | .m4a | audio/mp4 |

### 6.2 Configuration

```typescript
interface AudioPlayerOptions {
  autoplay: boolean;           // Default: false
  showWaveform: boolean;       // Visual waveform (default: false)
  showDownload: boolean;       // Download button (default: true)
  defaultVolume: number;       // 0-1 (default: 0.8)
  showPlaybackSpeed: boolean;  // Speed control (default: false)
}
```

### 6.3 Visual Layout

**Standard Player:**
```
┌─────────────────────────────────────────────────────────────┐
│  🔊 Audio Response                                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ▶️  ━━━━━━━━━●━━━━━━━━━━━━━━  1:23 / 3:45   🔉 ▓▓░  ⬇️  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘

▶️ = Play/Pause
━━●━━ = Seek bar (draggable)
1:23 / 3:45 = Current / Total time
🔉 ▓▓░ = Volume slider
⬇️ = Download
```

**With Waveform:**
```
┌─────────────────────────────────────────────────────────────┐
│  🔊 Audio Response                                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │    ▁▃▅▇█▇▅▃▁▂▄▆█▆▄▂▁▃▅▇█▇▅▃▁▂▄▆█▆▄▂▁                   ││
│  │         ▲ (playhead)                                    ││
│  │ ▶️      1:23 / 3:45                      🔉 ▓▓░   ⬇️    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 6.4 AudioPlayer Component

```svelte
<script lang="ts">
  import { useMediaResource } from '$lib/composables/useMediaResource.svelte';
  import MediaError from '$lib/components/media/MediaError.svelte';
  
  interface Props {
    resourceId: string;
    duration?: number;
    options?: AudioPlayerOptions;
  }
  
  const { resourceId, duration, options }: Props = $props();
  
  // Use shared resource loading
  const media = useMediaResource({
    resourceId,
    mimeType: 'audio/*',
  });
  
  // Audio-specific state
  let audioElement: HTMLAudioElement;
  let isPlaying = $state(false);
  let currentTime = $state(0);
  let totalDuration = $state(duration ?? 0);
  let volume = $state(options?.defaultVolume ?? 0.8);
  let isMuted = $state(false);
  
  function togglePlay() {
    if (isPlaying) {
      audioElement.pause();
      media.logEvent({ type: 'playback_pause', resourceId, position: currentTime });
    } else {
      audioElement.play();
      media.logEvent({ type: 'playback_start', resourceId });
    }
    isPlaying = !isPlaying;
  }
  
  function handleSeek(event: MouseEvent) {
    const bar = event.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    audioElement.currentTime = percent * totalDuration;
  }
  
  function handleVolumeChange(event: Event) {
    const input = event.target as HTMLInputElement;
    volume = parseFloat(input.value);
    audioElement.volume = volume;
    isMuted = volume === 0;
  }
  
  function toggleMute() {
    isMuted = !isMuted;
    audioElement.muted = isMuted;
  }
  
  function handleEnded() {
    isPlaying = false;
    media.logEvent({ type: 'playback_complete', resourceId });
  }
</script>

<div class="audio-player" class:loading={media.isLoading} class:error={media.isError}>
  {#if media.isLoading}
    <div class="audio-loading">
      <Spinner size="sm" />
      <span>Loading audio...</span>
    </div>
  {:else if media.isError}
    <MediaError error={media.state.error} onRetry={media.retry} />
  {:else}
    <audio
      bind:this={audioElement}
      src={media.state.src}
      bind:currentTime
      bind:duration={totalDuration}
      onended={handleEnded}
    />
    
    <div class="player-controls">
      <button class="play-button" onclick={togglePlay}>
        {#if isPlaying}
          <PauseIcon />
        {:else}
          <PlayIcon />
        {/if}
      </button>
      
      <div class="seek-bar" onclick={handleSeek}>
        <div 
          class="seek-progress" 
          style="width: {(currentTime / totalDuration) * 100}%"
        />
        <div 
          class="seek-handle" 
          style="left: {(currentTime / totalDuration) * 100}%"
        />
      </div>
      
      <span class="time-display">
        {formatTime(currentTime)} / {formatTime(totalDuration)}
      </span>
      
      <div class="volume-control">
        <button onclick={toggleMute}>
          {#if isMuted || volume === 0}
            <VolumeMuteIcon />
          {:else if volume < 0.5}
            <VolumeLowIcon />
          {:else}
            <VolumeHighIcon />
          {/if}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          oninput={handleVolumeChange}
        />
      </div>
      
      {#if options?.showDownload}
        <button class="download-button" onclick={media.download}>
          <DownloadIcon />
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .audio-player {
    background: var(--surface-secondary);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }
  
  .player-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .play-button {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--primary-color);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .seek-bar {
    flex: 1;
    height: 6px;
    background: var(--surface-tertiary);
    border-radius: 3px;
    position: relative;
    cursor: pointer;
  }
  
  .seek-progress {
    height: 100%;
    background: var(--primary-color);
    border-radius: 3px;
  }
  
  .seek-handle {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 12px;
    height: 12px;
    background: var(--primary-color);
    border-radius: 50%;
    opacity: 0;
    transition: opacity 0.2s;
  }
  
  .seek-bar:hover .seek-handle {
    opacity: 1;
  }
  
  .time-display {
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    color: var(--text-secondary);
    min-width: 80px;
  }
  
  .volume-control {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .volume-control input[type="range"] {
    width: 60px;
  }
  
  .audio-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
  }
</style>
```

---

## 7. Video Playback (FR-4)

Play video content in responses with full playback controls.

### 7.1 Supported Formats

| Format | Extension | MIME Type |
|--------|-----------|-----------|
| MP4 | .mp4 | video/mp4 |
| WebM | .webm | video/webm |
| OGG | .ogv | video/ogg |

### 7.2 Configuration

```typescript
interface VideoPlayerOptions {
  autoplay: boolean;           // Default: false
  muted: boolean;              // Start muted (default: false)
  loop: boolean;               // Loop playback (default: false)
  controls: boolean;           // Show controls (default: true)
  maxWidth: string;            // Default: '100%'
  maxHeight: string;           // Default: '400px'
  allowFullscreen: boolean;    // Fullscreen button (default: true)
  showDownload: boolean;       // Download button (default: true)
  poster?: string;             // Preview image URL
  showPlaybackSpeed: boolean;  // Speed control (default: true)
  showPictureInPicture: boolean; // PiP button (default: true)
}
```

### 7.3 Visual Layout

**Standard Player:**
```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────┐│
│  │                                                         ││
│  │                                                         ││
│  │                    [Video Frame]                        ││
│  │                                                         ││
│  │                                                         ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ ▶️  ━━━━━━━━━●━━━━━━━━━━━  1:23 / 3:45  🔉  1x  ⛶  📺  ⬇️││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘

▶️ = Play/Pause
━━●━━ = Seek bar
🔉 = Volume
1x = Playback speed (0.5x, 1x, 1.5x, 2x)
⛶ = Fullscreen
📺 = Picture-in-Picture
⬇️ = Download
```

### 7.4 Playback Speed Options

| Speed | Label |
|-------|-------|
| 0.5 | 0.5x |
| 0.75 | 0.75x |
| 1.0 | Normal |
| 1.25 | 1.25x |
| 1.5 | 1.5x |
| 2.0 | 2x |

### 7.5 VideoPlayer Component

```svelte
<script lang="ts">
  import { useMediaResource } from '$lib/composables/useMediaResource.svelte';
  import MediaError from '$lib/components/media/MediaError.svelte';
  
  interface Props {
    resourceId: string;
    width: number;
    height: number;
    duration?: number;
    options?: VideoPlayerOptions;
  }
  
  const { resourceId, width, height, duration, options }: Props = $props();
  
  // Use shared resource loading
  const media = useMediaResource({
    resourceId,
    mimeType: 'video/*',
  });
  
  // Video-specific state
  let videoElement: HTMLVideoElement;
  let containerElement: HTMLDivElement;
  let isPlaying = $state(false);
  let currentTime = $state(0);
  let totalDuration = $state(duration ?? 0);
  let volume = $state(0.8);
  let isMuted = $state(options?.muted ?? false);
  let playbackSpeed = $state(1.0);
  let isFullscreen = $state(false);
  let showControls = $state(true);
  
  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  
  function togglePlay() {
    if (isPlaying) {
      videoElement.pause();
      media.logEvent({ type: 'playback_pause', resourceId, position: currentTime });
    } else {
      videoElement.play();
      media.logEvent({ type: 'playback_start', resourceId });
    }
  }
  
  function handleSeek(event: MouseEvent) {
    const bar = event.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    videoElement.currentTime = percent * totalDuration;
  }
  
  function setPlaybackSpeed(speed: number) {
    playbackSpeed = speed;
    videoElement.playbackRate = speed;
  }
  
  function toggleFullscreen() {
    if (isFullscreen) {
      document.exitFullscreen();
    } else {
      containerElement.requestFullscreen();
    }
  }
  
  function togglePictureInPicture() {
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture();
    } else {
      videoElement.requestPictureInPicture();
    }
  }
  
  function handleEnded() {
    isPlaying = false;
    media.logEvent({ type: 'playback_complete', resourceId });
  }
</script>

<div 
  class="video-player" 
  class:loading={media.isLoading}
  class:error={media.isError}
  class:fullscreen={isFullscreen}
  bind:this={containerElement}
  onfullscreenchange={() => isFullscreen = !!document.fullscreenElement}
  onmouseenter={() => showControls = true}
  onmouseleave={() => showControls = !isPlaying}
>
  {#if media.isLoading}
    <div class="video-loading" style="aspect-ratio: {width}/{height}">
      <Spinner />
    </div>
  {:else if media.isError}
    <MediaError error={media.state.error} onRetry={media.retry} />
  {:else}
    <video
      bind:this={videoElement}
      src={media.state.src}
      poster={options?.poster}
      loop={options?.loop}
      bind:currentTime
      bind:duration={totalDuration}
      bind:paused={v => isPlaying = !v}
      onclick={togglePlay}
      onended={handleEnded}
    />
    
    <div class="video-controls" class:visible={showControls}>
      <button class="play-button" onclick={togglePlay}>
        {#if isPlaying}
          <PauseIcon />
        {:else}
          <PlayIcon />
        {/if}
      </button>
      
      <div class="seek-bar" onclick={handleSeek}>
        <div 
          class="seek-progress" 
          style="width: {(currentTime / totalDuration) * 100}%"
        />
      </div>
      
      <span class="time-display">
        {formatTime(currentTime)} / {formatTime(totalDuration)}
      </span>
      
      <div class="volume-control">
        <button onclick={() => isMuted = !isMuted}>
          {#if isMuted}
            <VolumeMuteIcon />
          {:else}
            <VolumeHighIcon />
          {/if}
        </button>
      </div>
      
      {#if options?.showPlaybackSpeed}
        <div class="speed-control">
          <select 
            value={playbackSpeed} 
            onchange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
          >
            {#each speedOptions as speed}
              <option value={speed}>
                {speed === 1 ? 'Normal' : `${speed}x`}
              </option>
            {/each}
          </select>
        </div>
      {/if}
      
      {#if options?.allowFullscreen}
        <button onclick={toggleFullscreen} title="Fullscreen">
          <FullscreenIcon />
        </button>
      {/if}
      
      {#if options?.showPictureInPicture}
        <button onclick={togglePictureInPicture} title="Picture in Picture">
          <PipIcon />
        </button>
      {/if}
      
      {#if options?.showDownload}
        <button onclick={media.download} title="Download">
          <DownloadIcon />
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .video-player {
    position: relative;
    background: #000;
    border-radius: 8px;
    overflow: hidden;
    max-width: 100%;
  }
  
  .video-player video {
    display: block;
    width: 100%;
    height: auto;
    cursor: pointer;
  }
  
  .video-controls {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
    opacity: 0;
    transition: opacity 0.3s;
  }
  
  .video-controls.visible {
    opacity: 1;
  }
  
  .video-player:hover .video-controls {
    opacity: 1;
  }
  
  .video-controls button {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 0.25rem;
  }
  
  .play-button {
    width: 32px;
    height: 32px;
  }
  
  .seek-bar {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
    cursor: pointer;
  }
  
  .seek-progress {
    height: 100%;
    background: var(--primary-color);
    border-radius: 2px;
  }
  
  .time-display {
    font-size: 0.75rem;
    color: white;
    font-variant-numeric: tabular-nums;
  }
  
  .speed-control select {
    background: transparent;
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    padding: 0.125rem 0.25rem;
    font-size: 0.75rem;
  }
  
  .video-player.fullscreen {
    border-radius: 0;
  }
  
  .video-player.fullscreen video {
    height: 100vh;
    object-fit: contain;
  }
  
  .video-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-secondary);
  }
</style>
```

---

## 8. Media Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play/pause |
| `←` | Seek back 5 seconds |
| `→` | Seek forward 5 seconds |
| `↑` | Volume up 10% |
| `↓` | Volume down 10% |
| `M` | Toggle mute |
| `F` | Toggle fullscreen (video) |
| `P` | Toggle picture-in-picture (video) |
| `<` | Decrease playback speed |
| `>` | Increase playback speed |
| `Escape` | Exit fullscreen / close lightbox |

---

## 9. Error Handling

### 9.1 Loading States

| State | Display |
|-------|---------|
| Loading | Spinner with "Loading..." text |
| Resource not found | Error icon with "Media not found" |
| Format not supported | Error icon with "Format not supported" |
| Network error | Error icon with "Failed to load media" |

### 9.2 Fallback Behavior

| Scenario | Fallback |
|----------|----------|
| Image fails to load | Show placeholder with error message |
| Audio fails to load | Show error state with retry button |
| Video fails to load | Show error state with retry button |
| Thumbnail generation fails | Show generic file icon |

---

**End of Document**

<script lang="ts">
  import { onMount } from 'svelte';
  import { threads } from '../../lib/stores/thread.store';
  import { projects } from '$lib/stores/project.store';
  import { threadService } from '../../lib/services/thread.service';
  import type { Thread } from '../../../src-electron/preload';
  import { THREAD_STATUS } from '$lib/constants/status.constant';
  import { querystring, replace } from 'svelte-spa-router';
  import ChatPane from '../../lib/components/ChatPane.svelte';
  import Composer from '../../lib/components/Composer.svelte';
  import type { MokuModel } from '../../../src-electron/preload';
  import { ROUTE } from '$lib/constants/route.constant';
  import type { Message } from '$lib/types/thread.type';
  import { storageService } from '$lib/services/storage.service';
  import { clearUnsavedChanges, setUnsavedChanges } from '$lib/stores/navigation-guard.store';
  import ThreadCreatePanel from '$lib/components/threads/ThreadCreatePanel.svelte';

  let isLoading = $state(true);
  let formData: Thread = $state({
    id: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    title: '',
    description: '',
    status: THREAD_STATUS.ACTIVE,
  });

  let selectedModel: MokuModel | null = $state(null);
  let chooserInitial: { provider: string; id: string } | null = $state(null);
  let newThreadPrompt = $state('');

  let selectedThread: Thread | null = $state(null);
  let messages: Message[] = $state([]);
  let chatPaneRef: any = $state(null);
  let currentProjectId: string | null = $state(null);
  let errorMessage = $state<string | null>(null);
  let modelSelectionTouched = $state(false);
  const isAddThreadView = $derived(!selectedThread);

  function resetThreadForm(prefillPrompt = '') {
    formData = {
      id: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      title: '',
      description: '',
      status: THREAD_STATUS.ACTIVE,
      metadata: {},
    } as Thread;
    selectedModel = null;
    chooserInitial = null;
    newThreadPrompt = prefillPrompt;
    modelSelectionTouched = false;
  }

  function startThreadCreationFlow(prefillPrompt = '') {
    resetThreadForm(prefillPrompt);
    selectedThread = null;
    storageService.removeLastThreadId();
    replace(ROUTE.THREADS);
  }

  $effect(() => {
    if (!isAddThreadView) {
      clearUnsavedChanges('add-thread');
      return;
    }
    // Only track prompt content and model selection as "dirty" state
    const dirty = newThreadPrompt.trim().length > 0 || modelSelectionTouched;
    setUnsavedChanges('add-thread', dirty);
  });

  onMount(async () => {
    await loadThreads();
  });

  // Handlers for events emitted by ChatPane component
  function handleThreadCreated(e: CustomEvent<{ thread: Thread; tempId?: string }>) {
    const detail = e.detail;
    if (detail.tempId) threads.deleteThread(detail.tempId);
    threads.addThread(detail.thread);
    selectThread(detail.thread);
    void replace(`${ROUTE.THREADS}?threadId=${encodeURIComponent(detail.thread.id)}`);
  }

  function handleOpenNewThreadPrefill(e: CustomEvent<{ prompt: string }>) {
    const d = e.detail;
    startThreadCreationFlow(d?.prompt ?? '');
  }

  // Fallback global listener for dispatches from renderer components
  onMount(() => {
    const winListener = (ev: Event) => {
      const e = ev as CustomEvent;
      const detail = e.detail as { prompt?: string } | undefined;
      if (detail?.prompt) {
        startThreadCreationFlow(detail.prompt);
      }
    };
    window.addEventListener('openNewThreadPrefill', winListener as any);
    return () => window.removeEventListener('openNewThreadPrefill', winListener as any);
  });

  // Attach listeners directly to ChatPane DOM node (avoids typed on: event issues)
  onMount(() => {
    if (!chatPaneRef) return;
    const onThreadCreated = (ev: Event) => handleThreadCreated(ev as any);
    const onOpenPrefill = (ev: Event) => handleOpenNewThreadPrefill(ev as any);
    try {
      chatPaneRef.addEventListener('threadCreated', onThreadCreated as any);
      chatPaneRef.addEventListener('openNewThreadPrefill', onOpenPrefill as any);
    } catch {
      // ignore if chatPaneRef is not a DOM node
    }
    return () => {
      try {
        chatPaneRef.removeEventListener('threadCreated', onThreadCreated as any);
        chatPaneRef.removeEventListener('openNewThreadPrefill', onOpenPrefill as any);
      } catch {
        // ignore
      }
    };
  });

  // Refresh messages when the selected thread is updated elsewhere
  onMount(() => {
    const off = window.electronAPI.thread.onThreadUpdated((t) => {
      if (selectedThread && t.id === selectedThread.id) {
        void (async () => {
          try {
            messages = await threadService.getMessages(t.id);
          } catch (e) {
            console.error('Failed to refresh messages:', e);
          }
        })();
      }
    });
    return () => {
      off();
    };
  });

  $effect(() => {
    const unsubscribe = querystring.subscribe((qs: string | undefined) => {
      const params = new URLSearchParams(qs ?? '');

      const projectIdParam = params.get('projectId');
      currentProjectId = projectIdParam;
      if (projectIdParam) {
        storageService.setLastProjectId(projectIdParam);
      }

      if (params.has('createThread')) {
        startThreadCreationFlow();
        void replace(ROUTE.THREADS);
      }
      const threadId = params.get('threadId');
      if (threadId) {
        const found = $threads.find((thread) => thread.id === threadId);
        if (found) {
          // Verify thread belongs to current project context
          // If we're in projects activity, only show threads from selected project
          // If we're in threads activity, only show threads without a project
          const threadProjectId = (found.metadata?.projectId as string | undefined) ?? null;

          // Check if we're in projects context (project selected) or threads context (general)
          // We determine this by checking if there's a selected project in localStorage
          if (currentProjectId) {
            // In project context - only show threads that belong to this project
            if (threadProjectId === currentProjectId) {
              selectThread(found);
              errorMessage = null;
            } else {
              errorMessage = 'This thread does not belong to the current project.';
              selectedThread = null;
              messages = [];
              setTimeout(() => {
                errorMessage = null;
              }, 5000);
            }
          } else {
            // In general/global context - allow threads without a project or from non-isolated projects
            if (threadProjectId === null) {
              selectThread(found);
              errorMessage = null;
            } else {
              const project = $projects.find((p) => p.id === threadProjectId);
              const isProjectOnly = project?.privacyMode === 'project_only';
              if (!isProjectOnly) {
                selectThread(found);
                errorMessage = null;
              } else {
                errorMessage =
                  'This thread belongs to a project. Please access it from the project view.';
                selectedThread = null;
                messages = [];
                setTimeout(() => {
                  errorMessage = null;
                }, 5000);
              }
            }
          }
        } else {
          errorMessage = 'Thread not found. It may have been deleted.';
          selectedThread = null;
          messages = [];
          setTimeout(() => {
            errorMessage = null;
          }, 5000);
        }
      }
    });
    return unsubscribe;
  });

  async function loadThreads() {
    isLoading = true;
    try {
      // Load all threads - filtering happens in UI/sidebar
      await threadService.getAll({ includeProjectOnly: true });
    } catch (error) {
      console.error('Failed to load threads:', error);
    } finally {
      isLoading = false;
    }
  }

  function selectThread(thread: Thread) {
    clearUnsavedChanges('add-thread');
    selectedThread = thread;
    messages = [];
    // Load persisted messages for this thread
    void (async () => {
      try {
        messages = await threadService.getMessages(thread.id);
      } catch (e) {
        console.error('Failed to load messages:', e);
      }
    })();
    storageService.setLastThreadId(thread.id);
  }

  /**
   * Auto-generate a title from the prompt (max 80 chars)
   */
  function generateTitleFromPrompt(prompt: string): string {
    const trimmed = prompt.trim();
    if (trimmed.length <= 80) {
      // Use first line or entire prompt if short
      const firstLine = trimmed.split('\n')[0];
      return firstLine.length <= 80 ? firstLine : firstLine.substring(0, 77) + '...';
    }
    // Truncate at word boundary if possible
    const truncated = trimmed.substring(0, 77);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 50) {
      return truncated.substring(0, lastSpace) + '...';
    }
    return truncated + '...';
  }

  async function handleSave() {
    // Require both model and prompt (validation in ThreadCreatePanel ensures this)
    if (!selectedModel || !newThreadPrompt.trim()) {
      return;
    }

    try {
      // Auto-generate title from prompt
      const autoTitle = generateTitleFromPrompt(newThreadPrompt);

      // Create thread with prompt atomically
      const res = await window.electronAPI.thread.addUserPrompt(null, newThreadPrompt, {
        title: autoTitle,
        model: selectedModel.id,
      });
      const created = res.thread as Thread;
      threads.addThread(created);
      selectThread(created);
      void replace(`${ROUTE.THREADS}?threadId=${encodeURIComponent(created.id)}`);

      clearUnsavedChanges('add-thread');
      resetThreadForm();
    } catch (error) {
      console.error('Failed to create thread:', error);
    }
  }
</script>

<div class="threads-page">
  <div class="header">
    {#if !isAddThreadView}
      <button class="btn-primary" onclick={() => startThreadCreationFlow()}> + New Thread </button>
    {/if}
  </div>

  {#if errorMessage && selectedThread}
    <div class="error-banner" role="alert">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{errorMessage}</span>
      <button class="error-close" onclick={() => (errorMessage = null)} aria-label="Dismiss error">
        <i class="pi pi-times"></i>
      </button>
    </div>
  {/if}

  {#if isLoading}
    <div class="loading">Loading threads...</div>
  {:else if isAddThreadView}
    <ThreadCreatePanel
      bind:formData
      bind:selectedModel
      bind:newThreadPrompt
      {chooserInitial}
      on:modelSelectionChange={(event) => {
        const detail = (event as CustomEvent<{ model: MokuModel | null; isAuto: boolean }>).detail;
        if (!detail?.isAuto) {
          modelSelectionTouched = true;
        }
      }}
      on:submit={() => handleSave()}
    />
  {:else}
    <div class="threads-grid">
      <div class="w-full">
        <ChatPane bind:this={chatPaneRef} thread={selectedThread} {messages}>
          {#snippet composer({ sendMessage, isStreaming })}
            {#if selectedThread}
              <Composer {sendMessage} {isStreaming} threadId={selectedThread.id} />
            {/if}
          {/snippet}
        </ChatPane>
      </div>
    </div>
  {/if}
</div>

<style>
  .threads-page {
    max-width: 1200px;
  }

  .header {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-bottom: 2rem;
  }

  .loading {
    text-align: center;
    padding: calc(var(--content-padding) * 2.5);
    color: var(--text-secondary);
  }

  .threads-grid {
    display: flex;
    gap: var(--content-padding);
  }

  .btn-primary {
    background: var(--primary-color);
    color: var(--primary-color-text);
    border: none;
    padding: 0.65rem 1.5rem;
    border-radius: 999px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .btn-primary:hover {
    background: var(--primary-600, #2563eb);
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background: var(--error-color, #ef4444);
    color: white;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
  }

  .error-banner i {
    font-size: 1.1rem;
  }

  .error-banner span {
    flex: 1;
  }

  .error-close {
    background: transparent;
    border: none;
    color: white;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .error-close:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>

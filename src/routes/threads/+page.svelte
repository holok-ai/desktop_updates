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
  import ModelChooser from '../../lib/components/ModelChooser.svelte';
  import type { MokuModel } from '../../../src-electron/preload';
  import { ROUTE } from '$lib/constants/route.constant';
  import type { Message } from '$lib/types/thread.type';
  import { storageService } from '$lib/services/storage.service';
  import BaseModal from '$lib/components/modals/BaseModal.svelte';

  let isLoading = $state(true);
  let showDialog = $state(false);
  let editingThread: Thread | null = $state(null);

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

  onMount(async () => {
    await loadThreads();
    // If no threadId in URL, restore last selected from localStorage
    const params = new URLSearchParams((window as any).location?.search ?? '');
    if (!params.get('threadId')) {
      try {
        const last = storageService.getLastThreadId();
        if (last) {
          const found = $threads.find((t) => t.id === last);
          if (found) {
            selectThread(found);
            void replace(`${ROUTE.THREADS}?threadId=${encodeURIComponent(last)}`);
          }
        }
      } catch {
        // ignore
      }
    }
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
    openCreateDialog();
    newThreadPrompt = d?.prompt ?? '';
  }

  // Fallback global listener for dispatches from renderer components
  onMount(() => {
    const winListener = (ev: Event) => {
      const e = ev as CustomEvent;
      const detail = e.detail as { prompt?: string } | undefined;
      if (detail?.prompt) {
        openCreateDialog();
        newThreadPrompt = detail.prompt;
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

      // Track current project from localStorage (set by sidebar when project is selected)
      try {
        const lastProjectId = storageService.getLastProjectId();
        currentProjectId = lastProjectId;
      } catch {
        currentProjectId = null;
      }

      if (params.has('createThread') && !showDialog) {
        openCreateDialog();
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

  function openCreateDialog() {
    editingThread = null;
    formData = {
      id: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      title: '',
      description: '',
      status: THREAD_STATUS.ACTIVE,
    };
    // Reset model selection for new thread
    selectedModel = null;
    chooserInitial = null;
    formData.metadata = {};
    newThreadPrompt = '';
    showDialog = true;
  }

  function selectThread(thread: Thread) {
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

  async function handleSave() {
    try {
      const data = $state.snapshot(formData);
      if (selectedModel) {
        const merged = {
          ...((data.metadata as Record<string, unknown>) ?? {}),
          model: selectedModel.id,
          provider: selectedModel.provider,
        } as Record<string, unknown>;
        (data as any).metadata = merged;
      }

      if (editingThread) {
        await threadService.update(editingThread.id, data);
      } else {
        // If an initial prompt was provided, create thread + prompt atomically
        if (newThreadPrompt && newThreadPrompt.trim()) {
          try {
            const res = await window.electronAPI.thread.addUserPrompt(null, newThreadPrompt, {
              title: data.title,
              description: data.description,
              model: selectedModel?.id,
            });
            const created = res.thread as Thread;
            // Add to store and select it
            threads.addThread(created);
            selectThread(created);
            // Update URL to select created thread
            void replace(`${ROUTE.THREADS}?threadId=${encodeURIComponent(created.id)}`);
          } catch (e) {
            console.error('Failed to create thread with prompt:', e);
          }
        } else {
          // Create an ephemeral thread for sidebar/selection (not persisted yet)
          const tempId = `temp_${crypto.randomUUID()}`;
          const tempThread: Thread = {
            id: tempId,
            title: data.title,
            description: data.description,
            status: THREAD_STATUS.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: data.metadata ?? {},
          } as Thread;
          // Add to store and select it
          threads.addThread(tempThread);
          selectedThread = tempThread;
          messages = [];
          // Update URL so sidebar highlights the temp thread
          void replace(`${ROUTE.THREADS}?threadId=${encodeURIComponent(tempId)}`);
        }
      }
      showDialog = false;
    } catch (error) {
      console.error('Failed to save thread:', error);
    }
  }
</script>

<div class="threads-page">
  <div class="header">
    <h1>Threads</h1>
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
  {:else if $threads.length === 0}
    <div class="empty">
      <p>No threads yet. Create your first thread!</p>
      <button onclick={openCreateDialog}>Create Thread</button>
    </div>
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

<BaseModal
  bind:show={showDialog}
  title={editingThread ? 'Edit Thread' : 'Create Thread'}
  submitLabel={editingThread ? 'Confirm Update' : 'Confirm Create'}
  cancelLabel="Cancel"
  submitDisabled={!editingThread && !selectedModel}
  oncancel={() => (showDialog = false)}
  onsubmit={handleSave}
>
  {#snippet content()}
    <div class="form-group">
      <label for="title">Title</label>
      <input id="title" type="text" bind:value={formData.title} placeholder="Enter thread title" />
    </div>

    <div class="form-group">
      <label for="description">Description</label>
      <textarea
        id="description"
        bind:value={formData.description}
        placeholder="Enter thread description"
        rows="4"
      ></textarea>
    </div>

    <div class="form-group">
      <label for="status">Status</label>
      <select id="status" bind:value={formData.status}>
        <option value="active">Active</option>
        <option value="archived">Archived</option>
      </select>
    </div>

    <div class="form-group">
      <span>Model</span>
      <ModelChooser
        initialSelection={chooserInitial}
        on:modelSelected={(e) => {
          // e.detail is the selected MokuModel
          const m = (e as CustomEvent).detail as any;
          if (m) {
            selectedModel = m;
            formData.metadata = {
              ...(formData.metadata ?? {}),
              model: m.id,
              provider: m.provider,
            };
          }
        }}
      />
    </div>

    <div class="form-group">
      <label for="initial-prompt">Initial Prompt</label>
      <textarea
        id="initial-prompt"
        bind:value={newThreadPrompt}
        rows="6"
        placeholder="Enter the prompt to run in the new thread"
      ></textarea>
    </div>
  {/snippet}
</BaseModal>

<style>
  .threads-page {
    max-width: 1200px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .loading,
  .empty {
    text-align: center;
    padding: calc(var(--content-padding) * 2.5);
    color: var(--text-secondary);
  }

  .empty button {
    margin-top: 1rem;
  }

  .threads-grid {
    display: flex;
    gap: var(--content-padding);
  }

  /* Form styles for modal content */
  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: var(--inline-spacing);
    font-weight: 500;
  }

  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: calc(var(--inline-spacing) * 1.5);
    border-radius: var(--border-radius);
    font-family: inherit;
    font-size: 16px;
  }

  .form-group input:focus,
  .form-group textarea:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--primary-color);
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

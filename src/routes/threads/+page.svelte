<script lang="ts">
  import { onMount, tick as _tick } from 'svelte';
  import { get } from 'svelte/store';
  import { threads } from '../../lib/stores/thread.store';
  import { projects } from '$lib/stores/project.store';
  import { threadService } from '../../lib/services/thread.service';
  import type { Thread } from '../../../src-electron/preload';
  import { THREAD_STATUS } from '$lib/constants/status.constant';
  import { querystring, replace, push } from 'svelte-spa-router';
  import ChatPane from '../../lib/components/ChatPane.svelte';
  import Composer from '../../lib/components/Composer.svelte';
  import type { ModelDetails } from '../../../src-electron/preload';
  import { ROUTE } from '$lib/constants/route.constant';
  import type { Message } from '$lib/types/thread.type';
  import { storageService } from '$lib/services/storage.service';
  import {
    clearUnsavedChanges,
    setUnsavedChanges,
    registerDiscardCallback,
  } from '$lib/stores/navigation-guard.store';
  import ThreadCreatePanel from '$lib/components/threads/ThreadCreatePanel.svelte';
  import ThreadBreadcrumb from '$lib/components/threads/ThreadBreadcrumb.svelte';
  import { isAuthenticated } from '$lib/stores/auth.store';
  import { toastStore } from '$lib/services/toast.service';
  import { selectedProjectStore } from '$lib/stores/selected-project.store';

  let isLoading = $state(true);
  let formData: Thread = $state({
    id: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    title: '',
    description: '',
    status: THREAD_STATUS.ACTIVE,
    currentBranchId: '1.0'
  });

  let selectedModel: ModelDetails | null = $state(null);
  let chooserInitial: string | null = $state(null);
  let newThreadPrompt = $state('');

  let selectedThread: Thread | null = $state(null);
  let messages: Message[] = $state([]);
  let chatPaneRef: any = $state(null);
  let currentProjectId: string | null = $state(null);
  let errorMessage = $state<string | null>(null);
  let modelSelectionTouched = $state(false);
  const isAddThreadView = $derived(!selectedThread);

  // Auth guard: redirect to login if not authenticated
  $effect(() => {
    if (!$isAuthenticated) {
      toastStore.show('Please log in to access Threads.', { variant: 'info' });
      push(ROUTE.LOGIN);
    }
  });

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

  function startThreadCreationFlow(
    prefillPrompt = '',
    options?: { projectId?: string | null },
  ) {
    resetThreadForm(prefillPrompt);
    selectedThread = null;
    storageService.removeLastThreadId();
    const params = new URLSearchParams();
    if (options?.projectId) {
      params.set('projectId', options.projectId);
    }
    void replace(params.toString() ? `${ROUTE.THREADS}?${params.toString()}` : ROUTE.THREADS);
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

  // Register cleanup callback for when user discards unsaved thread creation data
  onMount(() => {
    const unregisterDiscard = registerDiscardCallback('add-thread', () => {
      resetThreadForm();
    });
    return () => {
      unregisterDiscard();
    };
  });

  // Listen for thread updates and sync selectedThread if it's the current thread
  // Use onMount to register listener once, not in $effect which would recreate it on every selectedThread change
  onMount(() => {
    const unsubUpdated = window.electronAPI.thread.onThreadUpdated((updatedThread: Thread) => {
      // Only update if this is the currently selected thread
      if (selectedThread && updatedThread.id === selectedThread.id) {
        console.log('[+page] Thread updated, syncing selectedThread:', updatedThread.id);
        selectedThread = updatedThread;
      }
    });
    
    return () => {
      if (unsubUpdated) unsubUpdated();
    };
  });

  onMount(() => {
    void loadThreads();

    // Set up querystring subscription
    const unsubscribe = querystring.subscribe((qs: string | undefined) => {
      const params = new URLSearchParams(qs ?? '');

      // Step 1: Handle project context (with guard to prevent unnecessary updates)
      const projectIdParam = params.get('projectId');
      const branchIdParam = params.get('branchId');

      // Only update if changed to prevent infinite loops
      if (currentProjectId !== projectIdParam) {
        currentProjectId = projectIdParam;
        console.log('[querystring subscription] projectIdParam changed to:', projectIdParam);

        if (projectIdParam) {
          storageService.setLastProjectId(projectIdParam);
          selectedProjectStore.select(projectIdParam);
        } else {
          selectedProjectStore.clear();
        }
      }

      // Step 2: Handle createThread flag and agentId
      const agentIdParam = params.get('agentId');
      if (params.has('createThread')) {
        console.log('[createThread detected] Stripping flag, preserving projectId and agentId:', projectIdParam, agentIdParam);

        // Set chooserInitial if agentId is provided
        if (agentIdParam) {
          chooserInitial = agentIdParam;
        }

        const newParams = new URLSearchParams();
        if (projectIdParam) {
          newParams.set('projectId', projectIdParam);
        }
        void replace(newParams.toString() ? `${ROUTE.THREADS}?${newParams.toString()}` : ROUTE.THREADS);
        return;
      }

      // Step 3: Handle thread viewing
      const threadId = params.get('threadId');

      if (!threadId) {
        // No thread - show create form (only if we're currently viewing a thread)
        // Defer state changes to avoid triggering effects during this subscription callback
        if (selectedThread !== null) {
          queueMicrotask(() => {
            selectedThread = null;
            messages = [];
            resetThreadForm();
          });
        }
        return;
      }

      // Thread requested - try to find in cache (use get() to avoid reactive dependency)
      const found = get(threads).find((thread) => thread.id === threadId);
      console.log('[querystring] Looking for thread:', threadId, 'found in store:', !!found);

      if (found) {
        // Thread in cache - validate and load
        console.log('[querystring] Found thread in store, loading...');
        const validation = canViewThread(found, currentProjectId);
        if (validation.canView) {
          void (async () => {
            await loadThread(found);
            // If branchId is in URL, switch to that branch
            if (branchIdParam && found.currentBranchId !== branchIdParam) {
              const result = await threadService.switchBranch(found.id, branchIdParam);
              if (result.success) {
                found.currentBranchId = branchIdParam;
              }
            }
          })();
        } else {
          showError(validation.error!);
        }
        return;
      }

      // Thread not in cache - fetch from backend
      console.log('[Thread not in store] Fetching thread:', threadId);
      void (async () => {
        try {
          const fetchedThread = await threadService.getThread(threadId);

          if (!fetchedThread) {
            showError('Thread not found. It may have been deleted.');
            return;
          }

          const validation = canViewThread(fetchedThread, currentProjectId);
          if (validation.canView) {
            await selectThread(fetchedThread);
            // If branchId is in URL, switch to that branch
            if (branchIdParam && fetchedThread.currentBranchId !== branchIdParam) {
              const result = await threadService.switchBranch(fetchedThread.id, branchIdParam);
              if (result.success) {
                fetchedThread.currentBranchId = branchIdParam;
              }
            }
            errorMessage = null;
          } else {
            showError(validation.error!);
          }
        } catch (error) {
          console.error('Failed to fetch thread:', error);
          showError('Failed to load thread. Please try again.');
        }
      })();
    });

    // Return cleanup function
    return () => {
      unsubscribe();
    };
  });

  // Handlers for events emitted by ChatPane component
  async function handleThreadCreated(e: CustomEvent<{ thread: Thread; tempId?: string }>) {
    const detail = e.detail;
    if (detail.tempId) threads.deleteThread(detail.tempId);
    threads.addThread(detail.thread);
    await selectThread(detail.thread);

    // Build URL with threadId and projectId (if in project context)
    const params = new URLSearchParams();
    params.set('threadId', detail.thread.id);
    if (currentProjectId) {
      params.set('projectId', currentProjectId);
    }
    void replace(`${ROUTE.THREADS}?${params.toString()}`);
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

  // Helper: Validate if a thread can be viewed in the current context
  function canViewThread(thread: Thread, requestedProjectId: string | null): { canView: boolean; error: string | null } {
    const threadProjectId = (thread.metadata?.projectId as string | undefined) ?? null;

    // Case 1: Viewing in project context
    if (requestedProjectId) {
      if (threadProjectId === requestedProjectId) {
        return { canView: true, error: null };
      }
      return { canView: false, error: 'This thread does not belong to the current project.' };
    }

    // Case 2: Viewing in general/global context
    if (threadProjectId === null) {
      return { canView: true, error: null };
    }

    // Thread belongs to a project - check if project is accessible (use get() to avoid reactive dependency)
    const project = get(projects).find((p) => p.id === threadProjectId);
    const isProjectOnly = project?.privacyMode === 'project_only';

    if (!isProjectOnly) {
      return { canView: true, error: null };
    }

    return {
      canView: false,
      error: 'This thread belongs to a project. Please access it from the project view.'
    };
  }

  // Helper: Display error and clear thread state
  function showError(message: string) {
    errorMessage = message;
    selectedThread = null;
    messages = [];
    setTimeout(() => { errorMessage = null; }, 5000);
  }

  // Helper: Load thread (avoid reloading if already viewing)
  async function loadThread(thread: Thread) {
    if (selectedThread?.id !== thread.id) {
      await selectThread(thread);
    }
    errorMessage = null;
  }


  /* OLD CODE (replaced by refactored version above):
  $effect(() => {
    const unsubscribe = querystring.subscribe((qs: string | undefined) => {
      const params = new URLSearchParams(qs ?? '');

      const projectIdParam = params.get('projectId');
      currentProjectId = projectIdParam;
      console.log('[querystring subscription] projectIdParam:', projectIdParam, 'currentProjectId:', currentProjectId);
      if (projectIdParam) {
        storageService.setLastProjectId(projectIdParam);
        // Maintain project context in sidebar when viewing project threads
        selectedProjectStore.select(projectIdParam);
      } else {
        // Clear project context when viewing general threads
        selectedProjectStore.clear();
      }

      if (params.has('createThread')) {
        console.log('[createThread detected] Stripping flag, preserving projectId:', projectIdParam);
        // Clear createThread flag but preserve projectId so the create form
        // can associate the new thread with the project.
        // Don't call startThreadCreationFlow here - just strip the flag from URL
        const newParams = new URLSearchParams();
        if (projectIdParam) {
          newParams.set('projectId', projectIdParam);
        }
        void replace(newParams.toString() ? `${ROUTE.THREADS}?${newParams.toString()}` : ROUTE.THREADS);
        return; // Exit early to prevent further processing
      }
      const threadId = params.get('threadId');
      if (threadId) {
        let found = $threads.find((thread) => thread.id === threadId);

        // If thread not in store, try to load it from backend
        if (!found) {
          console.log('[Thread not in store] Fetching thread:', threadId);
          // Wrap async call in void IIFE
          void (async () => {
            try {
              const fetchedThread = await threadService.getThread(threadId);
              if (fetchedThread) {
                // Manually trigger selectThread since we're in async context
                const threadProjectId = (fetchedThread.metadata?.projectId as string | undefined) ?? null;

                // Check project context matching
                if (currentProjectId) {
                  if (threadProjectId === currentProjectId) {
                    selectThread(fetchedThread);
                    errorMessage = null;
                  } else {
                    errorMessage = 'This thread does not belong to the current project.';
                    selectedThread = null;
                    messages = [];
                    setTimeout(() => { errorMessage = null; }, 5000);
                  }
                } else {
                  if (threadProjectId === null) {
                    selectThread(fetchedThread);
                    errorMessage = null;
                  } else {
                    const project = $projects.find((p) => p.id === threadProjectId);
                    const isProjectOnly = project?.privacyMode === 'project_only';
                    if (!isProjectOnly) {
                      selectThread(fetchedThread);
                      errorMessage = null;
                    } else {
                      errorMessage = 'This thread belongs to a project. Please access it from the project view.';
                      selectedThread = null;
                      messages = [];
                      setTimeout(() => { errorMessage = null; }, 5000);
                    }
                  }
                }
              }
            } catch (error) {
              console.error('Failed to fetch thread:', error);
              errorMessage = 'Failed to load thread. Please try again.';
              selectedThread = null;
              messages = [];
              setTimeout(() => { errorMessage = null; }, 5000);
            }
          })();
          return; // Exit early, async handler will process the thread
        }

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
              // Only reload if we're switching to a different thread
              if (selectedThread?.id !== found.id) {
                selectThread(found);
              }
              // Don't update selectedThread if already viewing - prevents infinite loop
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
              // Only reload if we're switching to a different thread
              if (selectedThread?.id !== found.id) {
                selectThread(found);
              }
              // Don't update selectedThread if already viewing - prevents infinite loop
              errorMessage = null;
            } else {
              const project = $projects.find((p) => p.id === threadProjectId);
              const isProjectOnly = project?.privacyMode === 'project_only';
              if (!isProjectOnly) {
                // Only reload if we're switching to a different thread
                if (selectedThread?.id !== found.id) {
                  selectThread(found);
                }
                // Don't update selectedThread if already viewing - prevents infinite loop
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
      } else {
        // No threadId in URL - clear selection to show create form
        // Check if we're coming from a different view (thread was selected before)
        const wasViewingThread = selectedThread !== null;
        selectedThread = null;
        messages = [];
        // Reset form when entering add-thread view from thread view
        // This ensures clean state after navigation (including after discard)
        if (wasViewingThread) {
          resetThreadForm();
        }
      }
    });
    return unsubscribe;
  });
  */

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

  async function selectThread(thread: Thread) {
    clearUnsavedChanges('add-thread');
    selectedThread = thread;
    messages = [];
    // Load persisted messages for this thread
    try {
      messages = await threadService.getMessages(thread.id);
      console.log('[selectThread] Loaded', messages.length, 'messages for thread:', thread.id);
      // Log timestamps to debug ordering
      messages.forEach((m, idx) => {
        const date = new Date(m.createdAt);
        console.log(`  [${idx}] ${m.role} - ${date.toISOString()} (${m.createdAt}) - ${m.content.substring(0, 50)}`);
      });
    } catch (e) {
      console.error('Failed to load messages:', e);
    }
    storageService.setLastThreadId(thread.id);
  }

  async function handleSave() {
    // Require both model and prompt (validation in ThreadCreatePanel ensures this)
    if (!selectedModel || !newThreadPrompt.trim()) {
      return;
    }

    console.log('[handleSave] currentProjectId:', currentProjectId);

    try {
      // Create thread with initial prompt atomically
      // Backend will: 1) auto-generate title, 2) create thread, 3) add initial user message
      const created = await window.electronAPI.thread.createWithInitialPrompt({
        prompt: newThreadPrompt,
        metadata: {
          modelId: selectedModel.id,
          modelTitle: formData.metadata?.modelTitle || selectedModel.title,
          modelAccessName: formData.metadata?.modelAccessName || selectedModel.accessName,
          provider: formData.metadata?.provider || selectedModel.provider,
          url: formData.metadata?.url || selectedModel.url,
          description: formData.description || '',
          status: formData.status || THREAD_STATUS.ACTIVE,
          // Pass projectId if creating from project context
          ...(currentProjectId ? { projectId: currentProjectId } : {}),
        },
      });

      console.log('[handleSave] Thread created with initial message:', created.id);

      // Use queueMicrotask to defer ALL state updates until after current execution completes
      // This prevents Svelte reactive cycle corruption
      queueMicrotask(async () => {
        // Add to store
        threads.addThread(created);
        console.log('[handleSave] Added thread to store');

        // Clear form state
        clearUnsavedChanges('add-thread');
        resetThreadForm();

        // Build URL with threadId and projectId (if in project context)
        const params = new URLSearchParams();
        params.set('threadId', created.id);
        if (currentProjectId) {
          params.set('projectId', currentProjectId);
        }

        console.log('[handleSave] Navigating to thread:', created.id);

        // Navigate - querystring subscription will load the thread
        // loadThread() will fetch fresh from backend to ensure messages are loaded
        await replace(`${ROUTE.THREADS}?${params.toString()}`);
        console.log('[handleSave] Navigation complete');
      });
    } catch (error) {
      console.error('Failed to create thread:', error);
    }
  }
</script>

<div class="threads-page">
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
        const detail = (event as CustomEvent<{ model: ModelDetails | null; isAuto: boolean }>).detail;
        if (!detail?.isAuto) {
          modelSelectionTouched = true;
        }
      }}
      on:submit={() => handleSave()}
    />
  {:else}
    {#if selectedThread}
      <ThreadBreadcrumb thread={selectedThread} {messages} />
    {/if}
    <div class="threads-grid">
      <div class="w-full">
        <ChatPane
          bind:this={chatPaneRef}
          thread={selectedThread}
          bind:messages
        >
          {#snippet composer({ sendMessage, isStreaming, disabled })}
            {#if selectedThread}
              <Composer {sendMessage} {isStreaming} {disabled} threadId={selectedThread.id} />
            {/if}
          {/snippet}
        </ChatPane>
      </div>
    </div>
  {/if}
</div>

<style>
  .threads-page {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .loading {
    text-align: center;
    padding: calc(var(--content-padding) * 2.5);
    color: var(--text-secondary);
  }

  .threads-grid {
    display: flex;
    gap: var(--content-padding);
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .threads-grid > .w-full {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
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

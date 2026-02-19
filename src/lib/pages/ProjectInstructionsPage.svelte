<script lang="ts">
  import { onDestroy } from 'svelte';
  import { querystring, push } from 'svelte-spa-router';
  import { projectService } from '$lib/services/project.service';
  import { threadService } from '$lib/services/thread.service';
  import { toastStore } from '$lib/services/toast.service';
  import { ROUTE } from '$lib/constants/route.constant';
  import { THREAD_STATUS } from '$lib/constants/status.constant';
  import ModelSelector from '$lib/components/common/ModelSelector.svelte';
  import MarkdownRenderer from '$lib/components/MarkdownRenderer.svelte';
  import type { Project } from '$lib/types/project.type';
  import type { GUID } from '$lib/types/app.type';
  import type { ModelDetails } from '../../../src-electron/preload';

  // ── Core state ──
  let projectId = $state<string | null>(null);
  let project = $state<Project | null>(null);
  let loading = $state(false);
  let saving = $state(false);
  let error = $state('');

  // ── Editor state ──
  let instructions = $state('');
  let originalInstructions = $state('');
  let isEditing = $state(false);
  const hasUnsavedChanges = $derived(instructions !== originalInstructions);

  // ── Instructions panel state ──
  let showInstructionsPanel = $state(true);

  // ── Test panel state ──
  let showTestPanel = $state(false);
  let selectedModelId = $state<string | null>(null);
  let testPrompt = $state('');
  let isTestRunning = $state(false);
  let testResponseText = $state('');
  let testError = $state('');
  let testThreadId = $state<string | null>(null);
  let testStreamCleanup = $state<(() => void) | null>(null);
  let testComplete = $state(false);

  // ── Instruction template ──
  const INSTRUCTION_TEMPLATE = `## Purpose
Describe what this project is about and what threads should focus on.

## Context
- Project/repo name:
- Technology stack:
- Key resources (Azure, AWS, etc.):

## Behavioral Guidelines
- **Data precision**: Be exact with numbers, dates, and statistics. Do not round or estimate unless asked.
- **Incomplete data**: Ask for clarification rather than guessing or filling in gaps.
- **Ambiguous prompts**: Request specifics before proceeding. Offer options when the intent is unclear.
- **Response format**: Use markdown with code blocks where appropriate. Keep responses concise unless detail is requested.

## Constraints
- Do not make assumptions about production environments or credentials.
- Always cite sources when referencing external documentation.
- Flag uncertainty clearly rather than presenting guesses as facts.

## Tone & Style
- Professional but approachable
- Target audience: [developers / stakeholders / general]
`;

  // ── Query string parsing ──
  $effect(() => {
    const qs = $querystring;
    if (qs) {
      const params = new URLSearchParams(qs);
      const id = params.get('projectId');
      if (id && id !== projectId) {
        projectId = id;
        void loadProject(id);
      }
    }
  });

  onDestroy(() => {
    testStreamCleanup?.();
  });

  // ── Load project ──
  async function loadProject(id: string) {
    loading = true;
    error = '';
    try {
      project = await projectService.getProjectById(id as GUID);
      if (project) {
        const loaded = (project.metadata?.instructions as string) ?? '';
        instructions = loaded;
        originalInstructions = loaded;
      }
    } catch (e) {
      console.error('[ProjectInstructionsPage] Failed to load project:', e);
      error = e instanceof Error ? e.message : 'Failed to load project';
      project = null;
    } finally {
      loading = false;
    }
  }

  // ── Save instructions ──
  async function saveInstructions() {
    if (!projectId || !project) return;
    saving = true;
    error = '';
    try {
      const existingMetadata = project.metadata ?? {};
      await projectService.updateProject(projectId as GUID, {
        metadata: {
          ...existingMetadata,
          instructions: instructions,
        },
      });
      originalInstructions = instructions;
      isEditing = false;
      toastStore.success('Instructions saved');
    } catch (e) {
      console.error('[ProjectInstructionsPage] Failed to save instructions:', e);
      error = e instanceof Error ? e.message : 'Failed to save instructions';
      toastStore.error('Failed to save instructions');
    } finally {
      saving = false;
    }
  }

  // ── Cancel editing ──
  function cancelEdit() {
    instructions = originalInstructions;
    isEditing = false;
  }

  // ── Insert template ──
  function insertTemplate() {
    if (instructions.trim().length > 0) {
      instructions = instructions + '\n\n' + INSTRUCTION_TEMPLATE;
    } else {
      instructions = INSTRUCTION_TEMPLATE;
    }
  }

  // ── Model selection handler ──
  function handleModelSelect(
    e: CustomEvent<{
      modelId: string;
      modelDetails: ModelDetails;
      appSlug: string;
      modelSlug: string;
    }>,
  ) {
    selectedModelId = e.detail.modelId;
  }

  // ── Run test ──
  async function handleTestSubmit() {
    if (!projectId || !selectedModelId || !testPrompt.trim() || isTestRunning) return;

    isTestRunning = true;
    testError = '';
    testResponseText = '';
    testComplete = false;
    testThreadId = null;

    try {
      // 1. Get model details
      const models = await window.electronAPI.models.listAll();
      const modelDetails = models.find((m: ModelDetails) => m.accessName === selectedModelId);
      if (!modelDetails) throw new Error('Model not found');

      // 2. Create a test thread via threadService
      const testThread = await threadService.create({
        title: `[Test] ${testPrompt.substring(0, 40)}${testPrompt.length > 40 ? '...' : ''}`,
        description: 'Instructions test thread',
        status: THREAD_STATUS.ACTIVE,
        metadata: {
          projectId,
          modelTitle: modelDetails.title,
          modelProvider: modelDetails.provider,
          modelId: modelDetails.id,
          modelAccessName: modelDetails.accessName,
          isTestThread: true,
        },
      } as any);

      const threadId = testThread.id;
      testThreadId = threadId;

      // 3. Append user message
      await threadService.appendMessage(threadId, {
        role: 'user',
        content: testPrompt.trim(),
        branchId: '1.0.0',
      });

      // 4. Create chat provider for branch 1.0.0
      const providerResult = await window.electronAPI.chat.createServiceForThread(
        threadId,
        '1.0.0',
        modelDetails.accessName,
        modelDetails.provider,
        { url: modelDetails.url, model: modelDetails.accessName },
      );
      if (!providerResult.success) {
        throw new Error(providerResult.error || 'Failed to initialize chat provider');
      }

      // Small delay for provider readiness
      await new Promise((r) => setTimeout(r, 200));

      // 5. Subscribe to streaming tokens BEFORE sending
      testStreamCleanup?.();
      const unsubscribe = threadService.subscribeToStream(threadId, '1.0.0', (token: string) => {
        testResponseText = testResponseText + token;
      });
      testStreamCleanup = unsubscribe;

      // 6. Send chat request with instructions as system message
      const chatPayload: Record<string, unknown> = {
        messages: [{ role: 'user', content: testPrompt.trim() }],
        streaming: true,
        model: modelDetails.accessName,
        thread_id: threadId,
        branch_id: '1.0.0',
      };

      // Pass instructions as the system message if present
      if (instructions.trim()) {
        chatPayload.system = instructions.trim();
      }

      const chatResult = await window.electronAPI.chat.chat(threadId, chatPayload as any);

      if (!chatResult.success) {
        throw new Error(chatResult.error || 'Chat request failed');
      }

      testComplete = true;
    } catch (e) {
      console.error('[ProjectInstructionsPage] Test failed:', e);
      testError = e instanceof Error ? e.message : 'Test failed';
    } finally {
      isTestRunning = false;
    }
  }

  // ── Clear test results ──
  function clearTestResult() {
    testStreamCleanup?.();
    testStreamCleanup = null;
    testResponseText = '';
    testError = '';
    testThreadId = null;
    testComplete = false;
  }

  // ── Navigate to test thread ──
  function navigateToTestThread() {
    if (testThreadId && projectId) {
      push(`${ROUTE.THREADS}?threadId=${testThreadId}&projectId=${projectId}`);
    }
  }
</script>

<div class="page-container">
  <div class="page-content">
    {#if loading}
      <div class="loading-state">
        <i class="pi pi-spin pi-spinner"></i>
        Loading instructions...
      </div>
    {:else if error && !project}
      <div class="error-state">{error}</div>
    {:else if project}
      <div class="instructions-section">
        <!-- Instructions Header -->
        <div class="collapsible-section">
          <button
            class="section-toggle"
            onclick={() => (showInstructionsPanel = !showInstructionsPanel)}
          >
            <i class="pi {showInstructionsPanel ? 'pi-chevron-down' : 'pi-chevron-right'}"></i>
            Instructions
          </button>
          <div class="header-actions">
            {#if isEditing}
              <button class="btn-holokai" onclick={insertTemplate}>
                <i class="pi pi-file-edit"></i> Insert Template
              </button>
              <button class="btn-holokai" onclick={cancelEdit} disabled={saving}> Cancel </button>
              <button
                class="btn-holokai"
                onclick={saveInstructions}
                disabled={saving || !hasUnsavedChanges}
              >
                {#if saving}
                  <i class="pi pi-spin pi-spinner"></i> Saving...
                {:else}
                  <i class="pi pi-check"></i> Save
                {/if}
              </button>
            {:else}
              <button class="btn-holokai" onclick={() => (isEditing = true)}>
                <i class="pi pi-pencil"></i> Edit
              </button>
            {/if}
          </div>
        </div>

        {#if showInstructionsPanel}
          <div class="instructions-panel">
            <p class="section-description">
              Instructions are sent as system context to chat threads in this project. They guide AI
              responses with project-specific knowledge and behavioral rules.
            </p>

            <!-- Error banner (non-blocking) -->
            {#if error}
              <div class="error-banner">
                <i class="pi pi-exclamation-triangle"></i>
                {error}
              </div>
            {/if}

            <!-- Editor / Display -->
            <div class="instructions-editor">
              {#if isEditing}
                <textarea
                  bind:value={instructions}
                  placeholder="Enter project instructions... Use markdown for formatting."
                  class="instructions-textarea"
                  disabled={saving}
                ></textarea>
                <div class="editor-footer">
                  <span class="char-count">{instructions.length} characters</span>
                  {#if hasUnsavedChanges}
                    <span class="unsaved-indicator">Unsaved changes</span>
                  {/if}
                </div>
              {:else}
                <div class="instructions-display">
                  {#if instructions.trim()}
                    <MarkdownRenderer content={instructions} enableCopy={false} />
                  {:else}
                    <div class="empty-state">
                      <i class="pi pi-file-edit"></i>
                      <h3>No instructions yet</h3>
                      <p>
                        Click Edit to add instructions that will guide AI responses in this project.
                        You can describe your project context, set behavioral rules, and specify how
                        the AI should handle ambiguous or incomplete information.
                      </p>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Test Panel -->
        <div class="test-section">
          <button class="test-toggle" onclick={() => (showTestPanel = !showTestPanel)}>
            <i class="pi {showTestPanel ? 'pi-chevron-down' : 'pi-chevron-right'}"></i>
            Test Instructions
          </button>

          {#if showTestPanel}
            <div class="test-panel">
              <p class="test-description">
                Send a test prompt with your current instructions to preview how the AI responds.
                {#if hasUnsavedChanges}
                  <strong>Note:</strong> Using the current editor content (unsaved).
                {/if}
              </p>

              <div class="test-controls">
                <div class="test-model-row">
                  <ModelSelector
                    bind:selectedModelId
                    label="Model"
                    allowMultipleSelections={false}
                    on:select={handleModelSelect}
                  />
                </div>

                <textarea
                  bind:value={testPrompt}
                  placeholder="Type a test prompt..."
                  class="test-prompt-textarea"
                  rows="3"
                  disabled={isTestRunning}
                ></textarea>

                <div class="test-actions">
                  <button
                    class="btn-primary"
                    onclick={handleTestSubmit}
                    disabled={isTestRunning || !testPrompt.trim() || !selectedModelId}
                  >
                    {#if isTestRunning}
                      <i class="pi pi-spin pi-spinner"></i> Running...
                    {:else}
                      <i class="pi pi-play"></i> Run Test
                    {/if}
                  </button>

                  {#if testResponseText || testError}
                    <button class="btn-secondary" onclick={clearTestResult}> Clear </button>
                  {/if}

                  {#if testThreadId && testComplete}
                    <button class="btn-secondary" onclick={navigateToTestThread}>
                      <i class="pi pi-external-link"></i> Open Thread
                    </button>
                  {/if}
                </div>
              </div>

              <!-- Test Error -->
              {#if testError}
                <div class="test-error">
                  <i class="pi pi-exclamation-triangle"></i>
                  {testError}
                </div>
              {/if}

              <!-- Test Response -->
              {#if testResponseText}
                <div class="test-response">
                  <div class="test-response-header">
                    <span>Response</span>
                    {#if isTestRunning}
                      <i class="pi pi-spin pi-spinner streaming-indicator"></i>
                    {/if}
                  </div>
                  <div class="test-response-body">
                    <MarkdownRenderer content={testResponseText} />
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .instructions-section {
    max-width: 900px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .collapsible-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .section-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 4px;
    background: none;
    border: none;
    color: var(--text-primary);
    font-size: 18px;
    font-weight: 600;
    cursor: pointer;
    transition: color 0.2s;
  }

  .section-toggle:hover {
    color: var(--primary-color);
  }

  .section-toggle i {
    font-size: 12px;
  }

  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .instructions-panel {
    margin-top: 12px;
    padding: 1.25rem;
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-description {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
  }

  /* Buttons use global holokai styles from app.css */
  .btn-holokai {
    padding: 8px 16px !important;
  }

  /* Instructions editor */
  .instructions-editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .instructions-textarea {
    width: 100%;
    min-height: 400px;
    padding: 1rem;
    border: 1px solid var(--input-border, var(--surface-border));
    border-radius: 8px;
    font-family: 'Courier New', Consolas, monospace;
    font-size: 0.875rem;
    line-height: 1.6;
    resize: vertical;
    background: var(--input-background, var(--surface-main));
    color: var(--text-primary);
    transition: border-color 0.2s;
  }

  .instructions-textarea:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 20%, transparent);
  }

  .instructions-textarea::placeholder {
    color: var(--text-secondary);
    opacity: 0.7;
  }

  .editor-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 4px;
  }

  .char-count {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .unsaved-indicator {
    font-size: 12px;
    color: #f59e0b;
    font-weight: 500;
  }

  /* Read-only display */
  .instructions-display {
    padding: 1rem;
    background: var(--surface-main);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    min-height: 200px;
  }

  /* Test section */
  .test-section {
    margin-top: 8px;
    border-top: 1px solid var(--surface-border);
    padding-top: 16px;
  }

  .test-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 4px;
    background: none;
    border: none;
    color: var(--text-primary);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: color 0.2s;
  }

  .test-toggle:hover {
    color: var(--primary-color);
  }

  .test-toggle i {
    font-size: 12px;
  }

  .test-panel {
    margin-top: 12px;
    padding: 1.25rem;
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .test-description {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
  }

  .test-controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .test-model-row {
    display: flex;
    align-items: center;
  }

  .test-prompt-textarea {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--input-border, var(--surface-border));
    border-radius: 6px;
    background: var(--input-background, var(--surface-card));
    color: var(--text-primary);
    font-family: inherit;
    font-size: 14px;
    line-height: 1.5;
    resize: vertical;
    transition: border-color 0.2s;
  }

  .test-prompt-textarea:focus {
    outline: none;
    border-color: var(--primary-color);
  }

  .test-prompt-textarea::placeholder {
    color: var(--text-secondary);
  }

  .test-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  /* Test error */
  .test-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: color-mix(in srgb, var(--error-color, #dc2626) 8%, var(--surface-card));
    border: 1px solid color-mix(in srgb, var(--error-color, #dc2626) 30%, transparent);
    border-radius: 6px;
    color: var(--error-color, #dc2626);
    font-size: 13px;
  }

  /* Test response */
  .test-response {
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    overflow: hidden;
  }

  .test-response-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    background: color-mix(in srgb, var(--text-primary) 5%, var(--surface-card));
    border-bottom: 1px solid var(--surface-border);
    font-weight: 600;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .streaming-indicator {
    font-size: 12px;
  }

  .test-response-body {
    padding: 1rem;
  }
</style>

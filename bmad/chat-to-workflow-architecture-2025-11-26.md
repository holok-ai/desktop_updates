# Chat-to-Workflow Architecture
**Holokai Desktop - Core Differentiator**

**Date:** 2025-11-26
**Version:** 1.0
**Status:** Design Specification
**Component:** Chat-to-Workflow Progression

---

## 1. Overview

### 1.1 Purpose

The Chat-to-Workflow system enables employees to progress naturally from ad-hoc chat interactions to automated, reusable workflows **without learning workflow builders**. This is the core differentiator that enables 80%+ adoption rates vs. 20-30% for traditional enterprise tools.

### 1.2 Key Capabilities

| Capability | Description | User Benefit |
|------------|-------------|--------------|
| **"Make This a Workflow" Button** | One-click workflow creation from successful chat interactions | No workflow builder knowledge required |
| **Automatic Workflow Suggestions** | ML-driven detection of repetitive patterns, proactive suggestions | Platform guides progression automatically |
| **Template Marketplace** | 50+ curated workflows activated via chat ("Set up daily standup report") | Instant value, no configuration |
| **Invisible Execution** | Workflows run in background, results appear in chat | Users stay in familiar chat interface |

### 1.3 Success Metrics

- **40%+ progression rate:** 40% of active users create their first workflow within 30 days
- **Time-to-first-value:** <7 days from account creation to first workflow automation
- **Workflow adoption:** 80%+ of created workflows executed 20+ times (demonstrates value)

---

## 2. System Architecture

### 2.1 Component Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   CHAT-TO-WORKFLOW SYSTEM ARCHITECTURE                       │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                    RENDERER PROCESS (Svelte UI)                     │     │
│  │                                                                      │     │
│  │  ┌───────────────────────────────────────────────────────────┐     │     │
│  │  │ Chat Interface (Thread View)                              │     │     │
│  │  │                                                            │     │     │
│  │  │  User Message                                             │     │     │
│  │  │  ┌─────────────────────────────────────────────────┐     │     │     │
│  │  │  │ "Summarize my last 10 emails from john@..."    │     │     │     │
│  │  │  └─────────────────────────────────────────────────┘     │     │     │
│  │  │                                                            │     │     │
│  │  │  Assistant Response                                       │     │     │
│  │  │  ┌─────────────────────────────────────────────────┐     │     │     │
│  │  │  │ Here's a summary of your last 10 emails...     │     │     │     │
│  │  │  │                                                  │     │     │     │
│  │  │  │ [Summary content...]                            │     │     │     │
│  │  │  │                                                  │     │     │     │
│  │  │  │ ┌──────────────────────────────────────┐       │     │     │     │
│  │  │  │ │ 🤖 Make this a workflow              │       │     │     │     │
│  │  │  │ └──────────────────────────────────────┘       │     │     │     │
│  │  │  └─────────────────────────────────────────────────┘     │     │     │
│  │  └───────────────────────────────────────────────────────────┘     │     │
│  │                                                                      │     │
│  │  ┌───────────────────────────────────────────────────────────┐     │     │
│  │  │ Workflow Suggestion Toast (Proactive)                     │     │     │
│  │  │                                                            │     │     │
│  │  │  ┌───────────────────────────────────────────────────┐   │     │     │
│  │  │  │ 🤖 Pattern Detected                               │   │     │     │
│  │  │  │                                                    │   │     │     │
│  │  │  │ You've summarized emails 15 times this month.    │   │     │     │
│  │  │  │ Want me to automate this?                        │   │     │     │
│  │  │  │                                                    │   │     │     │
│  │  │  │ [Yes, automate it] [Not now] [Never suggest]    │   │     │     │
│  │  │  └───────────────────────────────────────────────────┘   │     │     │
│  │  └───────────────────────────────────────────────────────────┘     │     │
│  │                                                                      │     │
│  │  ┌───────────────────────────────────────────────────────────┐     │     │
│  │  │ Template Activation (Chat-Driven)                         │     │     │
│  │  │                                                            │     │     │
│  │  │  User: "Set up daily standup report"                      │     │     │
│  │  │                                                            │     │     │
│  │  │  Assistant:                                               │     │     │
│  │  │  ┌─────────────────────────────────────────────────┐     │     │     │
│  │  │  │ I found the "Daily Standup Report" template.   │     │     │     │
│  │  │  │                                                  │     │     │     │
│  │  │  │ To set it up, I need:                           │     │     │     │
│  │  │  │ 1. Which Slack channel? [#team-updates]        │     │     │     │
│  │  │  │ 2. What time daily? [9:00 AM]                  │     │     │     │
│  │  │  │                                                  │     │     │     │
│  │  │  │ [Confirm setup] [Customize first]              │     │     │     │
│  │  │  └─────────────────────────────────────────────────┘     │     │     │
│  │  └───────────────────────────────────────────────────────────┘     │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                             │ IPC                                            │
│                             ▼                                                │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                    MAIN PROCESS (Services)                          │     │
│  │                                                                      │     │
│  │  ┌─────────────────────────────────────────────────────────┐       │     │
│  │  │ ThreadService (Extended)                                 │       │     │
│  │  │                                                           │       │     │
│  │  │ • createWorkflowFromMessage(messageId)                  │       │     │
│  │  │   → Extracts prompt template + variables                │       │     │
│  │  │   → Creates workflow definition                         │       │     │
│  │  │   → Saves to WorkflowRepository + Moku API              │       │     │
│  │  └─────────────────────────────────────────────────────────┘       │     │
│  │                                                                      │     │
│  │  ┌─────────────────────────────────────────────────────────┐       │     │
│  │  │ WorkflowSuggestionService (NEW)                          │       │     │
│  │  │                                                           │       │     │
│  │  │ • getSuggestions(userId)                                │       │     │
│  │  │   → Calls Moku API GET /workflows/suggestions           │       │     │
│  │  │   → Returns pattern-detected suggestions                │       │     │
│  │  │                                                           │       │     │
│  │  │ • dismissSuggestion(suggestionId)                       │       │     │
│  │  │   → Marks suggestion as dismissed                       │       │     │
│  │  │                                                           │       │     │
│  │  │ • acceptSuggestion(suggestionId)                        │       │     │
│  │  │   → Creates workflow from suggestion                    │       │     │
│  │  │   → Returns workflow for user to customize              │       │     │
│  │  └─────────────────────────────────────────────────────────┘       │     │
│  │                                                                      │     │
│  │  ┌─────────────────────────────────────────────────────────┐       │     │
│  │  │ TemplateMarketplaceService (NEW)                         │       │     │
│  │  │                                                           │       │     │
│  │  │ • searchTemplates(query)                                │       │     │
│  │  │   → Fuzzy search by name/description/category           │       │     │
│  │  │   → Returns matching templates                          │       │     │
│  │  │                                                           │       │     │
│  │  │ • activateTemplate(templateId, inputs)                  │       │     │
│  │  │   → Calls Moku API POST /workflow-templates/:id/activate│       │     │
│  │  │   → Returns activated workflow                          │       │     │
│  │  │                                                           │       │     │
│  │  │ • getRequiredInputs(templateId)                         │       │     │
│  │  │   → Returns input schema for guided collection          │       │     │
│  │  └─────────────────────────────────────────────────────────┘       │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                             │ HTTP API                                       │
│                             ▼                                                │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                    MOKU API (Backend Services)                      │     │
│  │                                                                      │     │
│  │  Pattern Detection (Background Job - Hourly)                        │     │
│  │  ┌─────────────────────────────────────────────────────────┐       │     │
│  │  │ 1. Fetch user messages (last 30 days)                   │       │     │
│  │  │ 2. Generate embeddings (OpenAI text-embedding-3-small)  │       │     │
│  │  │ 3. Cluster by cosine similarity (threshold: 0.85)       │       │     │
│  │  │ 4. Identify clusters with 3+ messages                   │       │     │
│  │  │ 5. Create WorkflowSuggestion records                    │       │     │
│  │  │ 6. Desktop polls GET /workflows/suggestions             │       │     │
│  │  └─────────────────────────────────────────────────────────┘       │     │
│  │                                                                      │     │
│  │  Workflow Creation from Chat                                        │     │
│  │  ┌─────────────────────────────────────────────────────────┐       │     │
│  │  │ POST /workflows/from-message                             │       │     │
│  │  │ • Extract prompt template from message                  │       │     │
│  │  │ • Detect variables ({{email}}, {{date}}, etc.)          │       │     │
│  │  │ • Create workflow definition                            │       │     │
│  │  │ • Return workflow for user confirmation                 │       │     │
│  │  └─────────────────────────────────────────────────────────┘       │     │
│  │                                                                      │     │
│  │  Template Marketplace                                               │     │
│  │  ┌─────────────────────────────────────────────────────────┐       │     │
│  │  │ GET /workflow-templates                                  │       │     │
│  │  │ • 50+ curated templates                                 │       │     │
│  │  │ • Categorized: Marketing, Sales, Ops, Finance, HR       │       │     │
│  │  │ • Featured templates highlighted                        │       │     │
│  │  │                                                          │       │     │
│  │  │ POST /workflow-templates/:id/activate                   │       │     │
│  │  │ • Clone template to user's workflow library             │       │     │
│  │  │ • Apply user-provided input values                      │       │     │
│  │  │ • Return activated workflow                             │       │     │
│  │  └─────────────────────────────────────────────────────────┘       │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Feature #1: "Make This a Workflow" Button

### 3.1 User Experience Flow

**Trigger:** User receives a successful assistant response (>50 tokens, no errors)

**Visual Design:**
```
┌─────────────────────────────────────────────────────────────┐
│ Assistant Response                                          │
│                                                              │
│ Here's a summary of your last 10 emails from john@acme.com:│
│                                                              │
│ 1. Q4 Budget Review - Requesting approval by Friday        │
│ 2. Team Standup Notes - Sprint 23 progress update          │
│ 3. Customer Feedback - Feature request for API access      │
│ ...                                                          │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 🤖 Make this a workflow                              │   │
│ │                                                        │   │
│ │ Save this task as a reusable workflow you can run    │   │
│ │ on-demand or schedule automatically.                 │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ [Copy response]  [Retry]                                    │
└─────────────────────────────────────────────────────────────┘
```

**Button States:**
- **Default:** Gray background, subtle appearance (not intrusive)
- **Hover:** Blue background, cursor pointer, tooltip: "Create reusable workflow"
- **Click:** Opens workflow creation modal

### 3.2 Workflow Creation Modal

**Step 1: Name & Description**
```
┌─────────────────────────────────────────────────────────────┐
│ Create Workflow                                        [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Name your workflow:                                         │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Email Summary from John                              │   │
│ └──────────────────────────────────────────────────────┘   │
│ Auto-generated from your prompt                             │
│                                                              │
│ Description (optional):                                     │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Summarizes recent emails from john@acme.com          │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ [Cancel]                                     [Next: Inputs]│
└─────────────────────────────────────────────────────────────┘
```

**Step 2: Input Variables (if detected)**
```
┌─────────────────────────────────────────────────────────────┐
│ Configure Inputs                                       [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ We detected these inputs in your prompt:                   │
│                                                              │
│ 1. Email sender                                             │
│    ┌──────────────────────────────────────────────────┐   │
│    │ Variable name: {{sender_email}}                  │   │
│    │ Default value: john@acme.com                      │   │
│    └──────────────────────────────────────────────────┘   │
│                                                              │
│ 2. Number of emails                                         │
│    ┌──────────────────────────────────────────────────┐   │
│    │ Variable name: {{email_count}}                   │   │
│    │ Default value: 10                                 │   │
│    └──────────────────────────────────────────────────┘   │
│                                                              │
│ [Back]                                      [Create Workflow]│
└─────────────────────────────────────────────────────────────┘
```

**Step 3: Confirmation**
```
┌─────────────────────────────────────────────────────────────┐
│ Workflow Created!                                      [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ✓ "Email Summary from John" is ready to use               │
│                                                              │
│ What would you like to do?                                 │
│                                                              │
│ [Run it now]  [Schedule it]  [View in Workflows]          │
│                                                              │
│ Tip: Find all your workflows in the Workflows sidebar.     │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Technical Implementation

#### 3.3.1 UI Component (Svelte)

```typescript
// src/lib/components/chat/MakeWorkflowButton.svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let messageId: string;
  export let visible: boolean = true;

  const dispatch = createEventDispatcher();

  async function handleClick() {
    dispatch('createWorkflow', { messageId });
  }
</script>

{#if visible}
  <button
    class="make-workflow-button"
    on:click={handleClick}
    title="Create reusable workflow"
  >
    <span class="icon">🤖</span>
    <span class="text">Make this a workflow</span>
    <span class="subtext">
      Save this task as a reusable workflow you can run on-demand or schedule automatically.
    </span>
  </button>
{/if}

<style>
  .make-workflow-button {
    width: 100%;
    padding: 12px 16px;
    margin-top: 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--surface-variant);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .make-workflow-button:hover {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
  }

  .icon {
    margin-right: 8px;
  }

  .text {
    font-weight: 600;
    display: block;
    margin-bottom: 4px;
  }

  .subtext {
    font-size: 0.875rem;
    opacity: 0.8;
    display: block;
  }
</style>
```

#### 3.3.2 Workflow Creation Modal Component

```typescript
// src/lib/components/workflows/WorkflowCreationModal.svelte
<script lang="ts">
  import { fade } from 'svelte/transition';

  export let messageId: string;
  export let onClose: () => void;

  let step: 'name' | 'inputs' | 'confirmation' = 'name';
  let workflowName = '';
  let workflowDescription = '';
  let detectedInputs: Array<{ name: string; defaultValue: string }> = [];
  let createdWorkflow: any = null;

  async function extractWorkflowData() {
    // Call IPC to extract workflow from message
    const result = await window.api.workflows.createFromMessage(messageId);

    workflowName = result.suggestedName;
    workflowDescription = result.suggestedDescription;
    detectedInputs = result.detectedInputs;
  }

  async function createWorkflow() {
    createdWorkflow = await window.api.workflows.create({
      name: workflowName,
      description: workflowDescription,
      inputs: detectedInputs,
      createdFrom: { messageId }
    });

    step = 'confirmation';
  }

  async function runNow() {
    await window.api.workflows.execute(createdWorkflow.id, {});
    onClose();
  }

  onMount(() => {
    extractWorkflowData();
  });
</script>

<div class="modal-overlay" transition:fade on:click={onClose}>
  <div class="modal-content" on:click|stopPropagation>
    {#if step === 'name'}
      <div class="modal-header">
        <h2>Create Workflow</h2>
        <button on:click={onClose}>×</button>
      </div>

      <div class="modal-body">
        <label>
          Name your workflow:
          <input
            type="text"
            bind:value={workflowName}
            placeholder="e.g., Email Summary from John"
          />
          <span class="hint">Auto-generated from your prompt</span>
        </label>

        <label>
          Description (optional):
          <textarea
            bind:value={workflowDescription}
            placeholder="What does this workflow do?"
          />
        </label>
      </div>

      <div class="modal-footer">
        <button on:click={onClose}>Cancel</button>
        <button
          class="primary"
          on:click={() => step = 'inputs'}
          disabled={!workflowName}
        >
          Next: Inputs
        </button>
      </div>
    {/if}

    {#if step === 'inputs'}
      <div class="modal-header">
        <h2>Configure Inputs</h2>
        <button on:click={onClose}>×</button>
      </div>

      <div class="modal-body">
        <p>We detected these inputs in your prompt:</p>

        {#each detectedInputs as input, i}
          <div class="input-config">
            <h4>{i + 1}. {input.name}</h4>
            <label>
              Variable name:
              <input
                type="text"
                bind:value={input.name}
                placeholder="{{variable_name}}"
              />
            </label>
            <label>
              Default value:
              <input
                type="text"
                bind:value={input.defaultValue}
              />
            </label>
          </div>
        {/each}
      </div>

      <div class="modal-footer">
        <button on:click={() => step = 'name'}>Back</button>
        <button class="primary" on:click={createWorkflow}>
          Create Workflow
        </button>
      </div>
    {/if}

    {#if step === 'confirmation'}
      <div class="modal-header">
        <h2>Workflow Created!</h2>
        <button on:click={onClose}>×</button>
      </div>

      <div class="modal-body">
        <div class="success-message">
          <span class="icon">✓</span>
          <p>"{workflowName}" is ready to use</p>
        </div>

        <p>What would you like to do?</p>
      </div>

      <div class="modal-footer">
        <button on:click={runNow}>Run it now</button>
        <button on:click={() => {/* Navigate to schedule */}}>Schedule it</button>
        <button on:click={() => {/* Navigate to workflows */}}>View in Workflows</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--surface);
    border-radius: 8px;
    width: 500px;
    max-height: 80vh;
    overflow: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-body {
    padding: 20px;
  }

  .modal-footer {
    padding: 20px;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  button.primary {
    background: var(--primary-color);
    color: white;
  }
</style>
```

#### 3.3.3 IPC API Extension

```typescript
// src-electron/preload.ts - Add to existing API
contextBridge.exposeInMainWorld('api', {
  // ... existing APIs ...

  workflows: {
    // ... existing workflow methods ...

    // NEW: Create workflow from chat message
    createFromMessage: (messageId: string) =>
      invoke('workflows:createFromMessage', messageId),
  }
});
```

#### 3.3.4 Main Process Service Extension

```typescript
// src-electron/services/domain/thread.service.ts
class ThreadService {
  // ... existing methods ...

  /**
   * NEW: Create workflow from chat message
   * Extracts prompt template, detects variables, creates workflow definition
   */
  async createWorkflowFromMessage(
    messageId: string
  ): Promise<{
    suggestedName: string;
    suggestedDescription: string;
    detectedInputs: Array<{ name: string; defaultValue: string; type: string }>;
    promptTemplate: string;
  }> {
    // 1. Get message and thread context
    const message = await this.getMessage(messageId);
    if (!message || message.role !== 'user') {
      throw new Error('Invalid message for workflow creation');
    }

    // 2. Extract prompt template
    const promptTemplate = message.content;

    // 3. Detect variables (simple regex for MVP)
    const detectedInputs = this.detectVariables(promptTemplate);

    // 4. Generate suggested name (first 50 chars of prompt)
    const suggestedName = this.generateWorkflowName(promptTemplate);

    // 5. Generate description
    const suggestedDescription = `Automates: "${promptTemplate.substring(0, 100)}..."`;

    return {
      suggestedName,
      suggestedDescription,
      detectedInputs,
      promptTemplate
    };
  }

  /**
   * Detect variables in prompt template
   * Looks for patterns like: "emails from john@acme.com" → {{sender_email}}
   */
  private detectVariables(prompt: string): Array<{
    name: string;
    defaultValue: string;
    type: string;
  }> {
    const variables: Array<any> = [];

    // Email detection
    const emailRegex = /(\w+@[\w.-]+\.\w+)/g;
    const emails = prompt.match(emailRegex);
    if (emails) {
      variables.push({
        name: 'sender_email',
        defaultValue: emails[0],
        type: 'string'
      });
    }

    // Number detection
    const numberRegex = /\b(\d+)\b/g;
    const numbers = prompt.match(numberRegex);
    if (numbers) {
      variables.push({
        name: 'count',
        defaultValue: numbers[0],
        type: 'number'
      });
    }

    // Date detection (simple patterns)
    const dateKeywords = ['today', 'yesterday', 'last week', 'this month'];
    const lowerPrompt = prompt.toLowerCase();
    for (const keyword of dateKeywords) {
      if (lowerPrompt.includes(keyword)) {
        variables.push({
          name: 'date_range',
          defaultValue: keyword,
          type: 'string'
        });
        break;
      }
    }

    return variables;
  }

  /**
   * Generate workflow name from prompt
   * Takes first meaningful phrase, max 50 chars
   */
  private generateWorkflowName(prompt: string): string {
    // Remove common prefixes
    let name = prompt
      .replace(/^(can you|could you|please|summarize|generate|create)\s+/i, '')
      .trim();

    // Capitalize first letter
    name = name.charAt(0).toUpperCase() + name.slice(1);

    // Truncate at 50 chars, at word boundary
    if (name.length > 50) {
      name = name.substring(0, 50);
      const lastSpace = name.lastIndexOf(' ');
      if (lastSpace > 30) {
        name = name.substring(0, lastSpace);
      }
      name += '...';
    }

    return name;
  }
}
```

#### 3.3.5 IPC Handler Registration

```typescript
// src-electron/main.ts
ipcMain.handle('workflows:createFromMessage', async (event, messageId: string) => {
  const threadService = services.get<ThreadService>('ThreadService');
  return await threadService.createWorkflowFromMessage(messageId);
});
```

### 3.4 Button Display Rules

**Show "Make this a workflow" button when:**
- ✅ Message role is `assistant` (not user)
- ✅ Message content >50 tokens (substantial response)
- ✅ Message has no error metadata
- ✅ User has permission to create workflows (check via RBAC)
- ✅ Thread is not archived or deleted

**Hide button when:**
- ❌ Already clicked (show "Workflow created" badge instead)
- ❌ Message is a system message
- ❌ Thread is in a project where user has "View" role only

---

## 4. Feature #2: Automatic Workflow Suggestions

### 4.1 User Experience Flow

**Trigger:** Background pattern detection (Moku API runs hourly)

**Visual Design:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🤖 Pattern Detected                                    [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ You've summarized emails 15 times this month.              │
│ Want me to automate this?                                   │
│                                                              │
│ I can create a workflow that:                               │
│ • Runs daily at 9 AM                                        │
│ • Summarizes your inbox from specified senders             │
│ • Posts results to your thread or Slack                    │
│                                                              │
│ Estimated time saved: 2 hours/month                        │
│                                                              │
│ [Yes, automate it]  [Not now]  [Never suggest this]       │
└─────────────────────────────────────────────────────────────┘
```

**Toast Notification Behavior:**
- **Position:** Top-right corner (above chat area)
- **Duration:** Stays visible until user interacts (no auto-dismiss)
- **Max 1 suggestion per day** (avoid fatigue)
- **Dismissal persists:** If user clicks "Never suggest this", pattern is blacklisted

### 4.2 Suggestion Acceptance Flow

**When user clicks "Yes, automate it":**

1. **Open workflow creation modal** (pre-filled from pattern)
2. **User reviews/edits:**
   - Workflow name (auto-generated from pattern)
   - Schedule (default: daily 9 AM)
   - Input variables (pre-filled from detected values)
3. **User clicks "Create & Enable"**
4. **Confirmation:**
   ```
   ┌─────────────────────────────────────────────────────────────┐
   │ ✓ Workflow Created & Scheduled                              │
   ├─────────────────────────────────────────────────────────────┤
   │                                                              │
   │ "Email Summary" will run daily at 9:00 AM                  │
   │                                                              │
   │ First run: Tomorrow, Nov 27 at 9:00 AM                     │
   │                                                              │
   │ [View workflow]  [Edit schedule]  [Done]                   │
   └─────────────────────────────────────────────────────────────┘
   ```

### 4.3 Technical Implementation

#### 4.3.1 Suggestion Toast Component

```typescript
// src/lib/components/workflows/SuggestionToast.svelte
<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import type { WorkflowSuggestion } from '$lib/types';

  export let suggestion: WorkflowSuggestion;
  export let onAccept: () => void;
  export let onDismiss: () => void;
  export let onNeverSuggest: () => void;

  $: timeSaved = calculateTimeSaved(suggestion.executionCount);

  function calculateTimeSaved(count: number): string {
    const minutesPerExecution = 5; // Assume 5 min per manual execution
    const totalMinutes = count * minutesPerExecution;
    const hours = Math.floor(totalMinutes / 60);
    return `${hours} hour${hours !== 1 ? 's' : ''}/month`;
  }
</script>

<div
  class="suggestion-toast"
  transition:fly={{ y: -20, duration: 300 }}
>
  <div class="toast-header">
    <span class="icon">🤖</span>
    <span class="title">Pattern Detected</span>
    <button class="close-btn" on:click={onDismiss}>×</button>
  </div>

  <div class="toast-body">
    <p class="message">{suggestion.message}</p>

    <div class="benefits">
      <p class="benefits-title">I can create a workflow that:</p>
      <ul>
        {#each suggestion.benefits as benefit}
          <li>{benefit}</li>
        {/each}
      </ul>
    </div>

    <p class="time-saved">
      Estimated time saved: <strong>{timeSaved}</strong>
    </p>
  </div>

  <div class="toast-footer">
    <button class="primary" on:click={onAccept}>
      Yes, automate it
    </button>
    <button class="secondary" on:click={onDismiss}>
      Not now
    </button>
    <button class="text" on:click={onNeverSuggest}>
      Never suggest this
    </button>
  </div>
</div>

<style>
  .suggestion-toast {
    position: fixed;
    top: 80px;
    right: 20px;
    width: 400px;
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
  }

  .toast-header {
    display: flex;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .icon {
    font-size: 1.5rem;
    margin-right: 12px;
  }

  .title {
    font-weight: 600;
    flex: 1;
  }

  .close-btn {
    border: none;
    background: none;
    font-size: 1.5rem;
    cursor: pointer;
    opacity: 0.6;
  }

  .close-btn:hover {
    opacity: 1;
  }

  .toast-body {
    padding: 16px;
  }

  .message {
    font-size: 1rem;
    margin-bottom: 12px;
  }

  .benefits {
    background: var(--surface-variant);
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 12px;
  }

  .benefits-title {
    font-weight: 600;
    margin-bottom: 8px;
  }

  .benefits ul {
    margin: 0;
    padding-left: 20px;
  }

  .benefits li {
    margin-bottom: 4px;
  }

  .time-saved {
    font-size: 0.875rem;
    color: var(--success-color);
  }

  .toast-footer {
    padding: 16px;
    border-top: 1px solid var(--border-color);
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  button.primary {
    background: var(--primary-color);
    color: white;
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  button.secondary {
    background: var(--surface-variant);
    padding: 8px 16px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
  }

  button.text {
    background: none;
    border: none;
    color: var(--text-secondary);
    text-decoration: underline;
    cursor: pointer;
    padding: 8px;
  }
</style>
```

#### 4.3.2 Suggestion Manager Service

```typescript
// src-electron/services/workflows/workflow-suggestion.service.ts
class WorkflowSuggestionService {
  constructor(
    private mokuAPI: MokuAPIClient,
    private notificationService: NotificationService
  ) {}

  /**
   * Fetch pending suggestions for user
   * Called on app startup and periodically (every hour)
   */
  async getSuggestions(userId: string): Promise<WorkflowSuggestion[]> {
    try {
      const response = await this.mokuAPI.get(`/workflows/suggestions`, {
        params: { userId, status: 'pending' }
      });

      return response.data;
    } catch (error) {
      console.error('Failed to fetch workflow suggestions:', error);
      return [];
    }
  }

  /**
   * Dismiss suggestion (user clicked "Not now")
   */
  async dismissSuggestion(suggestionId: string): Promise<void> {
    await this.mokuAPI.patch(`/workflows/suggestions/${suggestionId}`, {
      status: 'dismissed',
      dismissedAt: new Date().toISOString()
    });
  }

  /**
   * Blacklist suggestion pattern (user clicked "Never suggest this")
   */
  async neverSuggest(suggestionId: string): Promise<void> {
    await this.mokuAPI.patch(`/workflows/suggestions/${suggestionId}`, {
      status: 'blacklisted',
      blacklistedAt: new Date().toISOString()
    });
  }

  /**
   * Accept suggestion and create workflow
   */
  async acceptSuggestion(suggestionId: string): Promise<Workflow> {
    const response = await this.mokuAPI.post(
      `/workflows/suggestions/${suggestionId}/accept`
    );

    // Mark suggestion as accepted
    await this.mokuAPI.patch(`/workflows/suggestions/${suggestionId}`, {
      status: 'accepted',
      acceptedAt: new Date().toISOString()
    });

    return response.data;
  }

  /**
   * Poll for new suggestions (background job)
   * Runs every hour, shows max 1 toast per day
   */
  async pollForSuggestions(userId: string): Promise<void> {
    // Check if already shown suggestion today
    const lastShown = await this.getLastSuggestionShownTimestamp();
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (now - lastShown < oneDayMs) {
      return; // Don't show more than 1/day
    }

    // Fetch suggestions
    const suggestions = await this.getSuggestions(userId);
    if (suggestions.length === 0) {
      return;
    }

    // Show first suggestion
    const suggestion = suggestions[0];
    this.showSuggestionToast(suggestion);

    // Update last shown timestamp
    await this.setLastSuggestionShownTimestamp(now);
  }

  private async getLastSuggestionShownTimestamp(): Promise<number> {
    const stateStore = services.get<StateStoreService>('StateStoreService');
    return stateStore.get('lastSuggestionShown', 0);
  }

  private async setLastSuggestionShownTimestamp(timestamp: number): Promise<void> {
    const stateStore = services.get<StateStoreService>('StateStoreService');
    await stateStore.set('lastSuggestionShown', timestamp);
  }

  private showSuggestionToast(suggestion: WorkflowSuggestion): void {
    // Send to renderer process to show toast
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('workflows:suggestionAvailable', suggestion);
    });
  }
}

interface WorkflowSuggestion {
  id: string;
  userId: string;
  message: string;
  benefits: string[];
  patternCluster: {
    messages: Array<{ id: string; content: string; timestamp: number }>;
    similarity: number;
    executionCount: number;
  };
  suggestedWorkflow: {
    name: string;
    description: string;
    promptTemplate: string;
    schedule?: string;
  };
  status: 'pending' | 'dismissed' | 'accepted' | 'blacklisted';
  createdAt: string;
}
```

#### 4.3.3 Background Polling Setup

```typescript
// src-electron/main.ts
async function setupSuggestionPolling() {
  const suggestionService = services.get<WorkflowSuggestionService>('WorkflowSuggestionService');
  const authService = services.get<AuthService>('AuthService');

  // Poll every hour
  setInterval(async () => {
    const user = await authService.getUser();
    if (user) {
      await suggestionService.pollForSuggestions(user.id);
    }
  }, 60 * 60 * 1000); // 1 hour

  // Also poll on app startup (after 5 min delay to avoid overwhelming user)
  setTimeout(async () => {
    const user = await authService.getUser();
    if (user) {
      await suggestionService.pollForSuggestions(user.id);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

app.whenReady().then(() => {
  // ... existing setup ...
  setupSuggestionPolling();
});
```

### 4.4 Moku API Requirements

**Pattern Detection Backend (Moku API handles this):**

```
GET /workflows/suggestions
Query params:
  - userId: string
  - status: 'pending' | 'dismissed' | 'accepted' | 'blacklisted'
Response:
  - Array<WorkflowSuggestion>

PATCH /workflows/suggestions/:id
Body:
  - status: string
  - dismissedAt?: string
  - acceptedAt?: string
  - blacklistedAt?: string

POST /workflows/suggestions/:id/accept
Response:
  - Workflow (created workflow)
```

**Background Job (Moku API - runs hourly):**
1. For each active user:
   - Fetch messages from last 30 days
   - Generate embeddings (OpenAI `text-embedding-3-small`)
   - Cluster by cosine similarity (threshold: 0.85)
   - Identify clusters with 3+ messages
   - Create `WorkflowSuggestion` record
2. Desktop polls `GET /workflows/suggestions` every hour

---

## 5. Feature #3: Template Marketplace (Chat Activation)

### 5.1 User Experience Flow

**Trigger:** User types template activation phrase in chat

**Examples:**
- "Set up daily standup report"
- "Install the email summary workflow"
- "Show me marketing templates"

**Visual Design:**
```
User: Set up daily standup report

Assistant Response:
┌─────────────────────────────────────────────────────────────┐
│ I found the "Daily Standup Report" template.                │
│                                                              │
│ This workflow will:                                         │
│ • Collect yesterday's completed tasks from your projects   │
│ • Identify today's planned tasks                           │
│ • Flag any blockers or issues                              │
│ • Post the report to your specified channel                │
│                                                              │
│ To set it up, I need a few details:                        │
│                                                              │
│ 1. Which Slack channel should I post to?                   │
│    ┌──────────────────────────────────────────────────┐   │
│    │ #team-updates                                     │   │
│    └──────────────────────────────────────────────────┘   │
│                                                              │
│ 2. What time should I run this daily?                      │
│    ┌──────────────────────────────────────────────────┐   │
│    │ 9:00 AM                                           │   │
│    └──────────────────────────────────────────────────┘   │
│                                                              │
│ 3. Which projects should I include?                        │
│    ☑ Project Alpha                                         │
│    ☑ Project Beta                                          │
│    ☐ Project Gamma                                         │
│                                                              │
│ [Activate workflow] [Customize further] [Cancel]          │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Template Discovery Flow

**User asks: "Show me marketing templates"**

```
Assistant Response:
┌─────────────────────────────────────────────────────────────┐
│ Here are 5 Marketing templates:                            │
│                                                              │
│ 📊 Social Media Scheduler                                  │
│    Schedule posts across Twitter, LinkedIn, Facebook        │
│    ⭐ Used by 234 organizations                             │
│    [Activate]                                               │
│                                                              │
│ 📧 Email Campaign Analyzer                                 │
│    Analyze campaign performance and generate insights       │
│    ⭐ Used by 189 organizations                             │
│    [Activate]                                               │
│                                                              │
│ 🔍 SEO Content Optimizer                                   │
│    Optimize blog posts for search engine ranking           │
│    ⭐ Used by 156 organizations                             │
│    [Activate]                                               │
│                                                              │
│ 👥 Competitor Monitoring                                   │
│    Track competitor social media and website changes        │
│    ⭐ Used by 142 organizations                             │
│    [Activate]                                               │
│                                                              │
│ 📈 Weekly Marketing Report                                 │
│    Aggregate metrics from Google Analytics, Ads, etc.       │
│    ⭐ Used by 298 organizations                             │
│    [Activate]                                               │
│                                                              │
│ Want to see more? [View all Marketing templates]          │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Template Categories & Examples

**50+ Curated Templates:**

**Marketing (10 templates):**
1. Social Media Scheduler - Schedule posts across platforms
2. Email Campaign Analyzer - Analyze campaign metrics
3. SEO Content Optimizer - Optimize content for search
4. Competitor Monitoring - Track competitor activity
5. Weekly Marketing Report - Aggregate marketing metrics
6. Blog Post Generator - Generate blog post drafts from topics
7. Ad Copy Tester - Generate A/B test variations
8. Social Listening Report - Monitor brand mentions
9. Content Calendar Generator - Create monthly content plans
10. Landing Page Analyzer - Analyze landing page performance

**Sales (10 templates):**
1. Lead Qualifier - Score and prioritize leads
2. Proposal Generator - Generate proposals from templates
3. Meeting Notes Summarizer - Summarize sales call notes
4. CRM Update Automator - Auto-update Salesforce/HubSpot
5. Follow-up Email Writer - Generate personalized follow-ups
6. Deal Pipeline Reporter - Weekly pipeline health report
7. Contract Review Assistant - Flag issues in contracts
8. Competitive Battle Card - Generate competitive comparisons
9. Sales Forecast Generator - Predict quarterly revenue
10. Customer Onboarding Checklist - Track onboarding progress

**Operations (10 templates):**
1. Expense Report Processor - Parse and categorize expenses
2. Vendor Invoice Parser - Extract invoice data
3. Project Status Reporter - Aggregate project updates
4. Resource Capacity Planner - Forecast resource availability
5. Incident Response Automator - Create incident tickets
6. Meeting Room Scheduler - Find and book meeting rooms
7. Equipment Request Handler - Process equipment requests
8. Travel Booking Assistant - Compare flights and hotels
9. Inventory Level Monitor - Alert on low inventory
10. Supply Chain Status Reporter - Track shipment status

**Finance (10 templates):**
1. Financial Report Generator - Monthly P&L, balance sheet
2. Budget Variance Analyzer - Compare actual vs. budget
3. Invoice Approval Workflow - Route invoices for approval
4. Revenue Forecast Updater - Update revenue projections
5. Audit Log Exporter - Export compliance audit logs
6. Expense Category Analyzer - Identify spending patterns
7. Payment Reminder Sender - Send overdue payment reminders
8. Cash Flow Forecaster - Predict cash flow 90 days out
9. Tax Document Organizer - Organize tax documents by year
10. Vendor Payment Tracker - Track payment due dates

**HR (10 templates):**
1. Job Description Writer - Generate JDs from requirements
2. Candidate Screening Assistant - Score resumes against criteria
3. Onboarding Checklist Generator - Create employee onboarding plans
4. Performance Review Summarizer - Summarize 360 reviews
5. Policy Q&A Bot - Answer employee policy questions
6. Time-Off Request Processor - Process PTO requests
7. Employee Survey Analyzer - Analyze survey responses
8. Training Progress Tracker - Track training completion
9. Exit Interview Summarizer - Summarize exit interviews
10. Benefits Enrollment Assistant - Guide benefits selection

### 5.4 Template Activation Process

**Step-by-Step Flow:**

```
1. User Intent Detection
   ↓
   User types: "Set up [template name]" or "Show me [category] templates"
   ↓
   Desktop detects intent → Calls TemplateMarketplaceService
   ↓

2. Template Search & Match
   ↓
   Service searches templates (fuzzy match)
   ↓
   Returns best match or list of category templates
   ↓

3. Template Details Display
   ↓
   Assistant shows template:
   - Name & description
   - What it does (benefits)
   - Required inputs
   - Usage count (social proof)
   ↓

4. Input Collection (Guided)
   ↓
   For each required input:
   - Show input field with label
   - Provide default value if available
   - Validate input format
   ↓

5. Activation Confirmation
   ↓
   User clicks "Activate workflow"
   ↓
   Desktop calls: workflows.activateTemplate(templateId, inputs)
   ↓
   Moku API clones template → Creates user workflow
   ↓

6. Success Confirmation
   ↓
   Assistant shows:
   "✓ [Template Name] activated!"
   Next run: [scheduled time]
   [Run now] [View workflow] [Done]
```

### 5.5 Technical Implementation

#### 5.5.1 Template Discovery Service

```typescript
// src-electron/services/workflows/template-marketplace.service.ts
import Fuse from 'fuse.js'; // Fuzzy search library

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'marketing' | 'sales' | 'operations' | 'finance' | 'hr';
  benefits: string[];
  requiredInputs: Array<{
    name: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'multiselect';
    required: boolean;
    defaultValue?: string;
    options?: Array<{ label: string; value: string }>;
    validation?: { pattern?: string; min?: number; max?: number };
  }>;
  usageCount: number;
  featured: boolean;
  steps: any; // Workflow definition
  createdBy: string;
  createdAt: string;
}

class TemplateMarketplaceService {
  private templates: WorkflowTemplate[] = [];
  private fuse: Fuse<WorkflowTemplate> | null = null;

  constructor(private mokuAPI: MokuAPIClient) {}

  /**
   * Load templates from Moku API (cached for 1 hour)
   */
  async loadTemplates(): Promise<void> {
    const response = await this.mokuAPI.get('/workflow-templates');
    this.templates = response.data;

    // Initialize fuzzy search
    this.fuse = new Fuse(this.templates, {
      keys: ['name', 'description', 'category'],
      threshold: 0.4, // 0 = exact match, 1 = match anything
      includeScore: true
    });
  }

  /**
   * Search templates by query (fuzzy match)
   * Examples: "daily standup", "email summary", "expense report"
   */
  async searchTemplates(query: string): Promise<WorkflowTemplate[]> {
    if (!this.fuse) {
      await this.loadTemplates();
    }

    const results = this.fuse!.search(query);
    return results.slice(0, 5).map(r => r.item); // Top 5 matches
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(
    category: string
  ): Promise<WorkflowTemplate[]> {
    if (this.templates.length === 0) {
      await this.loadTemplates();
    }

    return this.templates
      .filter(t => t.category === category)
      .sort((a, b) => b.usageCount - a.usageCount) // Most used first
      .slice(0, 10); // Top 10
  }

  /**
   * Get template details by ID
   */
  async getTemplate(templateId: string): Promise<WorkflowTemplate> {
    if (this.templates.length === 0) {
      await this.loadTemplates();
    }

    const template = this.templates.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return template;
  }

  /**
   * Activate template for user
   * Clones template to user's workflow library with provided inputs
   */
  async activateTemplate(
    templateId: string,
    inputs: Record<string, any>,
    userId: string
  ): Promise<Workflow> {
    // Validate inputs
    const template = await this.getTemplate(templateId);
    this.validateInputs(template, inputs);

    // Call Moku API to activate
    const response = await this.mokuAPI.post(
      `/workflow-templates/${templateId}/activate`,
      {
        userId,
        inputs
      }
    );

    return response.data;
  }

  /**
   * Validate inputs against template requirements
   */
  private validateInputs(
    template: WorkflowTemplate,
    inputs: Record<string, any>
  ): void {
    for (const input of template.requiredInputs) {
      if (input.required && !inputs[input.name]) {
        throw new Error(`Missing required input: ${input.label}`);
      }

      // Type validation
      if (inputs[input.name] !== undefined) {
        if (input.type === 'number' && typeof inputs[input.name] !== 'number') {
          throw new Error(`${input.label} must be a number`);
        }

        // Pattern validation
        if (input.validation?.pattern) {
          const regex = new RegExp(input.validation.pattern);
          if (!regex.test(inputs[input.name])) {
            throw new Error(`${input.label} format is invalid`);
          }
        }

        // Range validation
        if (input.type === 'number') {
          if (input.validation?.min && inputs[input.name] < input.validation.min) {
            throw new Error(`${input.label} must be at least ${input.validation.min}`);
          }
          if (input.validation?.max && inputs[input.name] > input.validation.max) {
            throw new Error(`${input.label} must be at most ${input.validation.max}`);
          }
        }
      }
    }
  }

  /**
   * Get featured templates (homepage)
   */
  async getFeaturedTemplates(): Promise<WorkflowTemplate[]> {
    if (this.templates.length === 0) {
      await this.loadTemplates();
    }

    return this.templates
      .filter(t => t.featured)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);
  }
}
```

#### 5.5.2 Chat Intent Detection

```typescript
// src-electron/services/chat/intent-detection.service.ts
class IntentDetectionService {
  /**
   * Detect if user message is a template activation intent
   * Returns: { intent: 'activate_template', query: string } | null
   */
  detectTemplateIntent(message: string): {
    intent: 'activate_template' | 'search_templates' | null;
    query?: string;
    category?: string;
  } | null {
    const lowerMessage = message.toLowerCase().trim();

    // Activation patterns
    const activationPatterns = [
      /^set up (.+)$/,
      /^install (.+)$/,
      /^activate (.+)$/,
      /^enable (.+)$/,
      /^start using (.+)$/,
      /^use the (.+) (workflow|template)$/
    ];

    for (const pattern of activationPatterns) {
      const match = lowerMessage.match(pattern);
      if (match) {
        return {
          intent: 'activate_template',
          query: match[1].replace(/workflow|template/, '').trim()
        };
      }
    }

    // Search patterns
    const searchPatterns = [
      /^show me (.+) (templates|workflows)$/,
      /^list (.+) (templates|workflows)$/,
      /^what (.+) (templates|workflows) are available\??$/,
      /^browse (.+) (templates|workflows)$/
    ];

    for (const pattern of searchPatterns) {
      const match = lowerMessage.match(pattern);
      if (match) {
        const category = match[1];
        return {
          intent: 'search_templates',
          category
        };
      }
    }

    return null;
  }
}
```

#### 5.5.3 Template Activation UI Component

```typescript
// src/lib/components/workflows/TemplateActivationModal.svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { WorkflowTemplate } from '$lib/types';

  export let template: WorkflowTemplate;
  export let onActivate: (inputs: Record<string, any>) => void;
  export let onCancel: () => void;

  let inputs: Record<string, any> = {};
  let errors: Record<string, string> = {};
  let step: 'inputs' | 'confirmation' = 'inputs';

  onMount(() => {
    // Initialize inputs with default values
    for (const input of template.requiredInputs) {
      inputs[input.name] = input.defaultValue || '';
    }
  });

  function validateInputs(): boolean {
    errors = {};
    let valid = true;

    for (const input of template.requiredInputs) {
      if (input.required && !inputs[input.name]) {
        errors[input.name] = `${input.label} is required`;
        valid = false;
      }

      // Pattern validation
      if (inputs[input.name] && input.validation?.pattern) {
        const regex = new RegExp(input.validation.pattern);
        if (!regex.test(inputs[input.name])) {
          errors[input.name] = `${input.label} format is invalid`;
          valid = false;
        }
      }
    }

    return valid;
  }

  async function handleActivate() {
    if (!validateInputs()) {
      return;
    }

    await onActivate(inputs);
    step = 'confirmation';
  }
</script>

<div class="modal-overlay" on:click={onCancel}>
  <div class="modal-content" on:click|stopPropagation>
    {#if step === 'inputs'}
      <div class="modal-header">
        <h2>Activate Template</h2>
        <button on:click={onCancel}>×</button>
      </div>

      <div class="modal-body">
        <div class="template-info">
          <h3>{template.name}</h3>
          <p class="description">{template.description}</p>

          <div class="benefits">
            <p class="benefits-title">This workflow will:</p>
            <ul>
              {#each template.benefits as benefit}
                <li>{benefit}</li>
              {/each}
            </ul>
          </div>

          <p class="usage-count">
            ⭐ Used by {template.usageCount} organizations
          </p>
        </div>

        <div class="input-collection">
          <h4>Configuration:</h4>

          {#each template.requiredInputs as input}
            <div class="input-field">
              <label>
                {input.label}
                {#if input.required}
                  <span class="required">*</span>
                {/if}
              </label>

              {#if input.type === 'text'}
                <input
                  type="text"
                  bind:value={inputs[input.name]}
                  placeholder={input.defaultValue}
                  class:error={errors[input.name]}
                />
              {:else if input.type === 'number'}
                <input
                  type="number"
                  bind:value={inputs[input.name]}
                  min={input.validation?.min}
                  max={input.validation?.max}
                  class:error={errors[input.name]}
                />
              {:else if input.type === 'select'}
                <select
                  bind:value={inputs[input.name]}
                  class:error={errors[input.name]}
                >
                  <option value="">Select {input.label}</option>
                  {#each input.options || [] as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              {:else if input.type === 'multiselect'}
                <div class="multiselect">
                  {#each input.options || [] as option}
                    <label class="checkbox">
                      <input
                        type="checkbox"
                        value={option.value}
                        checked={inputs[input.name]?.includes(option.value)}
                        on:change={(e) => {
                          if (e.target.checked) {
                            inputs[input.name] = [...(inputs[input.name] || []), option.value];
                          } else {
                            inputs[input.name] = inputs[input.name].filter(v => v !== option.value);
                          }
                        }}
                      />
                      {option.label}
                    </label>
                  {/each}
                </div>
              {/if}

              {#if errors[input.name]}
                <span class="error-message">{errors[input.name]}</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <div class="modal-footer">
        <button on:click={onCancel}>Cancel</button>
        <button class="secondary" on:click={() => {/* Navigate to workflow editor */}}>
          Customize further
        </button>
        <button class="primary" on:click={handleActivate}>
          Activate workflow
        </button>
      </div>
    {:else if step === 'confirmation'}
      <div class="modal-header">
        <h2>Workflow Activated!</h2>
        <button on:click={onCancel}>×</button>
      </div>

      <div class="modal-body">
        <div class="success-message">
          <span class="icon">✓</span>
          <p>"{template.name}" is ready to use</p>
        </div>

        {#if inputs.schedule}
          <p class="schedule-info">
            Next run: {formatNextRun(inputs.schedule)}
          </p>
        {/if}

        <p>What would you like to do?</p>
      </div>

      <div class="modal-footer">
        <button on:click={() => {/* Run workflow now */}}>
          Run it now
        </button>
        <button on:click={() => {/* Navigate to workflows */}}>
          View in Workflows
        </button>
        <button on:click={onCancel}>Done</button>
      </div>
    {/if}
  </div>
</div>

<style>
  /* Similar styling to WorkflowCreationModal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--surface);
    border-radius: 8px;
    width: 600px;
    max-height: 80vh;
    overflow: auto;
  }

  .template-info {
    background: var(--surface-variant);
    padding: 16px;
    border-radius: 6px;
    margin-bottom: 20px;
  }

  .benefits {
    margin: 12px 0;
  }

  .benefits-title {
    font-weight: 600;
    margin-bottom: 8px;
  }

  .benefits ul {
    margin: 0;
    padding-left: 20px;
  }

  .usage-count {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 8px;
  }

  .input-collection {
    margin-top: 20px;
  }

  .input-field {
    margin-bottom: 16px;
  }

  label {
    display: block;
    font-weight: 600;
    margin-bottom: 6px;
  }

  .required {
    color: var(--error-color);
  }

  input, select, textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
  }

  input.error, select.error {
    border-color: var(--error-color);
  }

  .error-message {
    color: var(--error-color);
    font-size: 0.875rem;
    margin-top: 4px;
    display: block;
  }

  .multiselect {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: normal;
  }

  .success-message {
    text-align: center;
    padding: 20px;
  }

  .success-message .icon {
    font-size: 3rem;
    color: var(--success-color);
    display: block;
    margin-bottom: 12px;
  }

  .schedule-info {
    text-align: center;
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 12px 0;
  }
</style>
```

#### 5.5.4 IPC API Extensions

```typescript
// src-electron/preload.ts - Add to existing API
contextBridge.exposeInMainWorld('api', {
  // ... existing APIs ...

  templates: {
    // Search templates
    search: (query: string) => invoke('templates:search', query),

    // Get templates by category
    getByCategory: (category: string) => invoke('templates:getByCategory', category),

    // Get template details
    get: (templateId: string) => invoke('templates:get', templateId),

    // Activate template
    activate: (templateId: string, inputs: Record<string, any>) =>
      invoke('templates:activate', templateId, inputs),

    // Get featured templates
    getFeatured: () => invoke('templates:getFeatured')
  }
});
```

#### 5.5.5 IPC Handler Registration

```typescript
// src-electron/main.ts
const templateService = services.get<TemplateMarketplaceService>('TemplateMarketplaceService');

ipcMain.handle('templates:search', async (event, query: string) => {
  return await templateService.searchTemplates(query);
});

ipcMain.handle('templates:getByCategory', async (event, category: string) => {
  return await templateService.getTemplatesByCategory(category);
});

ipcMain.handle('templates:get', async (event, templateId: string) => {
  return await templateService.getTemplate(templateId);
});

ipcMain.handle('templates:activate', async (event, templateId: string, inputs: Record<string, any>) => {
  const authService = services.get<AuthService>('AuthService');
  const user = await authService.getUser();
  return await templateService.activateTemplate(templateId, inputs, user.id);
});

ipcMain.handle('templates:getFeatured', async () => {
  return await templateService.getFeaturedTemplates();
});
```

### 5.6 Chat-Driven Template Activation Flow

**Integration with Chat Interface:**

```typescript
// src/lib/components/chat/ChatWindow.svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import TemplateActivationModal from '../workflows/TemplateActivationModal.svelte';
  import IntentDetectionService from '$lib/services/intent-detection';

  let showTemplateModal = false;
  let selectedTemplate: WorkflowTemplate | null = null;

  async function handleUserMessage(message: string) {
    // Detect template intent
    const intentService = new IntentDetectionService();
    const intent = intentService.detectTemplateIntent(message);

    if (intent?.intent === 'activate_template') {
      // Search for template
      const templates = await window.api.templates.search(intent.query);

      if (templates.length > 0) {
        // Show best match
        selectedTemplate = templates[0];
        showTemplateModal = true;

        // Also send to chat for assistant response
        await sendMessageToAssistant(message);
      }
    } else if (intent?.intent === 'search_templates') {
      // Get templates by category
      const templates = await window.api.templates.getByCategory(intent.category);

      // Show in chat as assistant response
      displayTemplateList(templates);
    } else {
      // Normal chat flow
      await sendMessageToAssistant(message);
    }
  }

  async function activateTemplate(inputs: Record<string, any>) {
    const workflow = await window.api.templates.activate(
      selectedTemplate.id,
      inputs
    );

    // Show success message in chat
    appendAssistantMessage(`✓ "${workflow.name}" activated! Next run: ${workflow.nextRun}`);

    showTemplateModal = false;
  }
</script>

{#if showTemplateModal && selectedTemplate}
  <TemplateActivationModal
    template={selectedTemplate}
    onActivate={activateTemplate}
    onCancel={() => showTemplateModal = false}
  />
{/if}
```

### 5.7 Moku API Requirements

**Template Endpoints:**

```
GET /workflow-templates
Query params:
  - category?: string
  - featured?: boolean
  - limit?: number
Response:
  - Array<WorkflowTemplate>

GET /workflow-templates/:id
Response:
  - WorkflowTemplate

POST /workflow-templates/:id/activate
Body:
  - userId: string
  - inputs: Record<string, any>
Response:
  - Workflow (activated workflow with user-specific inputs)
```

**Template Seed Data (Backend):**
- 50+ templates pre-loaded in database
- Each template has:
  - Name, description, category, benefits
  - Required inputs schema
  - Workflow steps definition
  - Usage count (incremented on activation)
  - Featured flag

---

## 6. Complete IPC API Summary

### 6.1 Chat-to-Workflow APIs

```typescript
// All IPC APIs needed for chat-to-workflow features

window.api.workflows = {
  // Feature #1: "Make this a workflow" button
  createFromMessage: (messageId: string) => Promise<{
    suggestedName: string;
    suggestedDescription: string;
    detectedInputs: Array<{ name: string; defaultValue: string; type: string }>;
    promptTemplate: string;
  }>;

  // Feature #2: Workflow suggestions
  getSuggestions: (userId: string) => Promise<WorkflowSuggestion[]>;
  dismissSuggestion: (suggestionId: string) => Promise<void>;
  neverSuggestPattern: (suggestionId: string) => Promise<void>;
  acceptSuggestion: (suggestionId: string) => Promise<Workflow>;
};

window.api.templates = {
  // Feature #3: Template marketplace
  search: (query: string) => Promise<WorkflowTemplate[]>;
  getByCategory: (category: string) => Promise<WorkflowTemplate[]>;
  get: (templateId: string) => Promise<WorkflowTemplate>;
  activate: (templateId: string, inputs: Record<string, any>) => Promise<Workflow>;
  getFeatured: () => Promise<WorkflowTemplate[]>;
};
```

### 6.2 Event Listeners (Main → Renderer)

```typescript
// Background events sent from Main Process to Renderer

window.api.on('workflows:suggestionAvailable', (suggestion: WorkflowSuggestion) => {
  // Show suggestion toast
});
```

---

## 7. Implementation Effort Estimation

### 7.1 Feature Breakdown

| Feature | Component | Effort (Days) | Dependencies |
|---------|-----------|---------------|--------------|
| **Feature #1: "Make this a workflow" button** | | 3-5 days | |
| - UI Component (Button) | Svelte | 0.5 day | None |
| - Workflow Creation Modal | Svelte | 1 day | None |
| - Variable Detection Logic | TypeScript | 1 day | None |
| - IPC Integration | TypeScript | 0.5 day | None |
| - Testing & Polish | - | 1 day | All above |
| **Feature #2: Workflow Suggestions** | | 3-5 days | |
| - Suggestion Toast Component | Svelte | 1 day | None |
| - Suggestion Service | TypeScript | 1 day | None |
| - Background Polling | TypeScript | 0.5 day | None |
| - State Persistence | TypeScript | 0.5 day | None |
| - Moku API Integration | - | 1 day | Moku endpoints ready |
| - Testing & Polish | - | 1 day | All above |
| **Feature #3: Template Marketplace** | | 4-6 days | |
| - Template Service | TypeScript | 1 day | None |
| - Fuzzy Search Integration | TypeScript | 0.5 day | fuse.js library |
| - Template Activation Modal | Svelte | 1.5 days | None |
| - Input Validation | TypeScript | 0.5 day | None |
| - Chat Intent Detection | TypeScript | 1 day | None |
| - Template List Display | Svelte | 0.5 day | None |
| - Moku API Integration | - | 1 day | Moku endpoints + templates seeded |
| - Testing & Polish | - | 1 day | All above |

**Total Effort:** 10-16 days (2-3 weeks) for all 3 features

### 7.2 Parallel Development Strategy

**Phase 1 (Week 1):** Feature #1 + Feature #3 (can parallelize)
- Developer A: "Make this a workflow" button
- Developer B: Template Marketplace UI

**Phase 2 (Week 2):** Feature #2 + Integration
- Developer A: Workflow Suggestions
- Developer B: Chat Intent Detection + Template Integration

**Phase 3 (Week 3):** Polish + Testing
- Both developers: End-to-end testing, bug fixes, UI polish

---

## 8. Success Criteria

### 8.1 Feature Validation

**Feature #1: "Make this a workflow" button**
- ✅ Button appears on all eligible assistant responses
- ✅ Modal workflow is intuitive (3 steps: Name → Inputs → Confirmation)
- ✅ Variable detection identifies 80%+ of common variables
- ✅ Created workflows are immediately executable

**Feature #2: Workflow Suggestions**
- ✅ Background polling runs every hour without performance impact
- ✅ Max 1 suggestion shown per day (no user fatigue)
- ✅ Suggestions are relevant (>70% acceptance rate in user testing)
- ✅ "Never suggest" blacklist persists correctly

**Feature #3: Template Marketplace**
- ✅ Fuzzy search returns relevant templates (>80% user satisfaction in testing)
- ✅ Template activation completes in <30 seconds
- ✅ Input validation prevents invalid configurations
- ✅ Chat intent detection works for 5+ common activation phrases

### 8.2 User Adoption Metrics

**Target Metrics (90 days post-launch):**
- **40%+ progression rate:** 40% of active users create first workflow within 30 days
- **Workflow adoption:** 80%+ of created workflows executed 20+ times
- **Time-to-first-value:** <7 days median from account creation to first workflow
- **Template usage:** 60%+ of workflows created from templates (not manual)
- **Suggestion acceptance:** 30%+ of suggestions accepted (not dismissed)

---

## 9. Next Steps

### 9.1 Before Implementation

1. **Moku API Coordination** (2-3 days)
   - Confirm endpoints: `/workflows/suggestions`, `/workflows/from-message`, `/workflow-templates`
   - Review template seed data (50+ templates)
   - Confirm pattern detection ML runs hourly

2. **Design Review** (1-2 days)
   - Review UI mockups with design team
   - Confirm color scheme, spacing, typography
   - Get approval on modal flows

3. **External Dependencies** (1 day)
   - Install `fuse.js` for fuzzy search (`npm install fuse.js`)
   - Confirm OpenAI embeddings API access (for pattern detection backend)

### 9.2 Implementation Sequence

**Week 1:**
- Implement Feature #1 ("Make this a workflow" button)
- Implement Feature #3 UI (Template Marketplace)

**Week 2:**
- Implement Feature #2 (Workflow Suggestions)
- Integrate all features with chat interface

**Week 3:**
- End-to-end testing
- Bug fixes
- UI polish
- Performance optimization

### 9.3 Documentation Needed

- [ ] User guide: "How to create your first workflow"
- [ ] User guide: "Using the template marketplace"
- [ ] Developer docs: IPC API reference
- [ ] Developer docs: Adding new templates (for content team)

---

_Chat-to-Workflow Architecture - Holokai Desktop Enterprise MVP_
_Feature #3: Template Marketplace (COMPLETE)_

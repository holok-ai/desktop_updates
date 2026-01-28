# Thread Panel Execution View

**Version:** 1.2
**Date:** 2026-01-27
**Status:** Implementation Ready

---

## Related Documents

| Document | Description |
|----------|-------------|
| **ui-threadpanel-overview.md** | Architecture and design principles |
| **ui-threadpanel-layout.md** | Component tree and file structure |

---

## 1. Overview

The Execution View enables batch execution of thread prompts with a prepended instruction file. It provides controls to run or stop execution, displays execution history with success/error status, and shows a frequency chart for monitoring execution patterns over time.

---

## 2. Requirements

### 2.1 Functional Requirements

| ID | Requirement |
|----|-------------|
| **FR-201** | Only available for project threads |
| **FR-202** | No special permissions required |
| **FR-203** | Instruction file format: Markdown (.md) |
| **FR-204** | Instruction file fields: title, description, prompt variables, input files, outputs, tools used |
| **FR-205** | Instruction file can be empty (not required) |
| **FR-206** | Instruction file stored in project file list (shared with all project members) |
| **FR-207** | Show past 15 executions in history |
| **FR-209** | Variable scale graph: 14 days=daily, 70 days=weekly, 356 days=monthly |
| **FR-210** | Graph shows up to past year of execution data |
| **FR-211** | Display editable instruction file with markdown syntax highlighting |
| **FR-212** | Provide Run button to execute all prompts with instruction file prepended |
| **FR-213** | Provide Stop button to abort running execution |
| **FR-214** | Show execution progress indicator while running |
| **FR-215** | Record execution results (success, error, stopped) with duration and timestamp |
| **FR-216** | Allow selecting a history record to view execution details |
| **FR-217** | Support aborting execution mid-stream via AbortController |

### 2.2 Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| **FR-208** | Execution data stored in desktop_thread table with thread_parent_id |

---

## 3. ThreadExecutionView.svelte

**Responsibilities:**
- Display/edit instruction file
- Show execution controls (Run, Stop)
- Display execution history
- Show frequency chart

**Props:**
```typescript
interface ThreadExecutionViewProps {
  thread: Thread;
  onRunExecution: () => Promise<void>;
  onStopExecution: () => void;
}
```

**State:**
```typescript
let instructionFileContent = $state('');
let executionHistory = $state<ExecutionRecord[]>([]);
let isRunning = $state(false);
```

**Data Model:**
```typescript
interface ExecutionRecord {
  id: string;
  threadId: string;
  executedAt: number;        // timestamp
  executedBy: string;        // user email
  status: 'success' | 'error' | 'stopped';
  duration: number;          // milliseconds
  resultSummary?: string;
}
```

**Template:**
```svelte
<div class="thread-execution-view">
  <InstructionFileEditor
    bind:content={instructionFileContent}
    onSave={handleSaveInstructions}
  />

  <ExecutionControls
    {isRunning}
    onRun={handleRun}
    onStop={handleStop}
  />

  <ExecutionHistory
    records={executionHistory}
    onSelectRecord={handleSelectRecord}
  />

  <ExecutionFrequencyChart
    records={executionHistory}
  />
</div>
```

**Key Methods:**
```typescript
async function handleRun(): Promise<void> {
  isRunning = true;
  try {
    const record = await executionRunnerService.runThread(thread, instructionFileContent);
    executionHistory = [record, ...executionHistory];
  } catch (error) {
    console.error('Execution failed:', error);
  } finally {
    isRunning = false;
  }
}

function handleStop(): void {
  executionRunnerService.stopExecution();
  isRunning = false;
}
```

**Size Estimate:** ~350 lines

---

## 4. Sub-Components

### 4.1 InstructionFileEditor.svelte

**Responsibilities:**
- Edit instruction file content
- Syntax highlighting for markdown/text
- Save functionality

**Props:**
```typescript
interface InstructionFileEditorProps {
  content: string;
  onSave: (content: string) => void;
}
```

**Size Estimate:** ~200 lines

### 4.2 ExecutionControls.svelte

**Responsibilities:**
- Run button (disabled when running)
- Stop button (enabled when running)
- Status indicator

**Props:**
```typescript
interface ExecutionControlsProps {
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
}
```

**Template:**
```svelte
<div class="execution-controls">
  <button
    class="run-button"
    onclick={onRun}
    disabled={isRunning}
  >
    {isRunning ? 'Running...' : 'Run'}
  </button>

  <button
    class="stop-button"
    onclick={onStop}
    disabled={!isRunning}
  >
    Stop
  </button>

  {#if isRunning}
    <span class="running-indicator">
      <Spinner size="sm" />
      Executing prompts...
    </span>
  {/if}
</div>
```

**Size Estimate:** ~100 lines

### 4.3 ExecutionHistory.svelte

**Responsibilities:**
- Display list of past executions
- Show status, duration, timestamp
- Allow selecting a record for details

**Props:**
```typescript
interface ExecutionHistoryProps {
  records: ExecutionRecord[];
  onSelectRecord: (record: ExecutionRecord) => void;
}
```

**Size Estimate:** ~150 lines

### 4.4 ExecutionFrequencyChart.svelte

**Responsibilities:**
- Display chart of execution frequency over time
- Show success/error breakdown
- Interactive hover for details

**Props:**
```typescript
interface ExecutionFrequencyChartProps {
  records: ExecutionRecord[];
}
```

**Size Estimate:** ~100 lines

---

## 5. ExecutionRunnerService

**File:** `src/lib/services/execution-runner.service.ts`

**Purpose:** Thread execution for Thread Execution View

```typescript
class ExecutionRunnerService {
  private isRunning = false;
  private abortController: AbortController | null = null;

  async runThread(thread: Thread, instructionFile: string): Promise<ExecutionRecord>;
  stopExecution(): void;
  private async sendPromptWithInstructions(...): Promise<Message>;
  private async saveExecutionRecord(record: ExecutionRecord): Promise<void>;
  async getExecutionHistory(threadId: string): Promise<ExecutionRecord[]>;
}

export const executionRunnerService = new ExecutionRunnerService();
```

**Execution Flow:**
1. Load thread messages
2. Extract user prompts
3. For each prompt, send with instruction file prepended to system prompt
4. Create ExecutionRecord with status and duration
5. Save record to backend (POST /api/threads/{id}/executions)
6. Return record for UI update

---

**End of Document**

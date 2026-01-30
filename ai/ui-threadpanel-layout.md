# Thread Panel Layout

**Version:** 1.1
**Date:** 2026-01-28
**Status:** Implementation Ready

---

## Related Documents

| Document | Description |
|----------|-------------|
| **ui-threadpanel-overview.md** | Architecture and design principles |
| **ui-threadpanel-components.md** | Header, tabs, status indicator |
| **ui-threadpanel-chatview.md** | Chat view and message timeline |
| **ui-threadpanel-execution-view.md** | Thread execution view |
| **ui-threadpanel-promptview.md** | Prompt list view |

---

## 1. Component Tree

```
ThreadComponent.svelte (orchestrator, ~800 lines)
├─ ThreadHeader.svelte (~150 lines)
│  ├─ ThreadBreadcrumb.svelte (existing, reuse)
│  ├─ ThreadTitle.svelte (~80 lines)
│  ├─ ThreadStatusIndicator.svelte (NEW, ~200 lines)
│  └─ ThreadActions.svelte (~100 lines)
│
├─ ThreadViewTabs.svelte (NEW, ~100 lines)
│  └─ TabButton.svelte
│
├─ ThreadChatView.svelte (~400 lines)
│  ├─ MessageTimeline.svelte (~250 lines)
│  │  ├─ MessageItem.svelte (~150 lines)
│  │  │  └─ MessageBubble.svelte (existing, reuse)
│  │  └─ BranchBoxItem.svelte (~100 lines)
│  │     └─ BranchLane.svelte (existing, reuse)
│  └─ MessageComposerArea.svelte (NEW, ~150 lines)
│
├─ ThreadExecutionView.svelte (NEW, ~350 lines)
│  ├─ InstructionFileEditor.svelte (~200 lines)
│  ├─ ExecutionControls.svelte (~100 lines)
│  ├─ ExecutionHistory.svelte (~150 lines)
│  └─ ExecutionFrequencyChart.svelte (~100 lines)
│
├─ ThreadBranchingView.svelte (NEW, ~500 lines)
│  ├─ BranchingGraphCanvas.svelte (SVG-based, ~300 lines)
│  └─ BranchingGraphNode.svelte (~100 lines)
│
├─ ThreadPromptView.svelte (NEW, ~200 lines)
│  ├─ PromptList.svelte (~50 lines)
│  └─ PromptItem.svelte (~100 lines)
│
└─ Modals (shared)
   ├─ VariationModal.svelte (existing, reuse)
   ├─ MessageVersionHistory.svelte (existing, reuse)
   └─ MoveThreadModal.svelte (existing, reuse)

Total new code: ~5,000 lines
Reused code: ~1,500 lines
Total: ~6,500 lines (vs 3,437 in ChatPane)
```

---

## 2. Component Summary

| Component | Lines | Status | Description |
|-----------|-------|--------|-------------|
| **ThreadComponent** | ~800 | NEW | Main orchestrator |
| **ThreadHeader** | ~150 | NEW | Header with title, status, actions |
| **ThreadTitle** | ~80 | NEW | Editable thread title |
| **ThreadStatusIndicator** | ~200 | NEW | 3-circle status display |
| **ThreadActions** | ~100 | NEW | Action buttons (comments, move) |
| **ThreadViewTabs** | ~100 | NEW | View tab navigation |
| **ThreadChatView** | ~400 | NEW | Chat message view |
| **MessageTimeline** | ~250 | NEW | Message list with branches |
| **MessageItem** | ~150 | NEW | Single message display |
| **BranchBoxItem** | ~100 | NEW | Branch variation box |
| **MessageComposerArea** | ~150 | NEW | Dedicated message input component |
| **ThreadExecutionView** | ~350 | NEW | Execution management |
| **InstructionFileEditor** | ~200 | NEW | Instruction file editing |
| **ExecutionControls** | ~100 | NEW | Run/stop controls |
| **ExecutionHistory** | ~150 | NEW | Execution history list |
| **ExecutionFrequencyChart** | ~100 | NEW | Execution frequency chart |
| **ThreadBranchingView** | ~500 | NEW | Branch graph visualization |
| **BranchingGraphCanvas** | ~300 | NEW | SVG canvas for graph |
| **BranchingGraphNode** | ~100 | NEW | Graph node component |
| **ThreadPromptView** | ~200 | NEW | Prompt list view |
| **PromptList** | ~50 | NEW | Prompt container |
| **PromptItem** | ~100 | NEW | Single prompt display |

**Reused Components:**
- ThreadBreadcrumb.svelte
- MessageBubble.svelte
- BranchLane.svelte
- MarkdownRenderer.svelte
- VariationModal.svelte
- MessageVersionHistory.svelte
- MoveThreadModal.svelte

---

## 3. File Structure

```
src/lib/
├─ components/
│  ├─ ThreadComponent.svelte (~800 lines)
│  ├─ threads/
│  │  ├─ ThreadHeader.svelte (~150 lines)
│  │  ├─ ThreadTitle.svelte (~80 lines)
│  │  ├─ ThreadStatusIndicator.svelte (~200 lines)
│  │  ├─ ThreadActions.svelte (~100 lines)
│  │  ├─ ThreadViewTabs.svelte (~100 lines)
│  │  ├─ chat/
│  │  │  ├─ ThreadChatView.svelte (~400 lines)
│  │  │  ├─ MessageTimeline.svelte (~250 lines)
│  │  │  ├─ MessageItem.svelte (~150 lines)
│  │  │  ├─ BranchBoxItem.svelte (~100 lines)
│  │  │  └─ MessageComposerArea.svelte (~150 lines)
│  │  ├─ execution/
│  │  │  ├─ ThreadExecutionView.svelte (~350 lines)
│  │  │  ├─ InstructionFileEditor.svelte (~200 lines)
│  │  │  ├─ ExecutionControls.svelte (~100 lines)
│  │  │  ├─ ExecutionHistory.svelte (~150 lines)
│  │  │  └─ ExecutionFrequencyChart.svelte (~100 lines)
│  │  ├─ branching/
│  │  │  ├─ ThreadBranchingView.svelte (~500 lines)
│  │  │  ├─ BranchingGraphCanvas.svelte (~300 lines)
│  │  │  └─ BranchingGraphNode.svelte (~100 lines)
│  │  └─ prompt/
│  │     ├─ ThreadPromptView.svelte (~200 lines)
│  │     ├─ PromptList.svelte (~50 lines)
│  │     └─ PromptItem.svelte (~100 lines)
│  └─ (reuse existing)
│     ├─ ThreadBreadcrumb.svelte
│     ├─ MessageBubble.svelte
│     ├─ BranchLane.svelte
│     ├─ MarkdownRenderer.svelte
│     └─ modals/
│        ├─ VariationModal.svelte
│        ├─ MessageVersionHistory.svelte
│        └─ MoveThreadModal.svelte
│
├─ services/
│  ├─ streaming.service.ts (~300 lines)
│  ├─ timeline-builder.service.ts (~250 lines)
│  ├─ branch-context.service.ts (~150 lines)
│  ├─ thread-status.service.ts (~100 lines)
│  ├─ execution-runner.service.ts (~200 lines)
│  └─ branch-graph-layout.service.ts (~300 lines)
│
├─ stores/
│  └─ thread-view.store.ts (~200 lines)
│
└─ utils/
   └─ branch-utils.ts (already exists, minor updates)
```

---

## 4. Service Layer Summary

| Service | Lines | Purpose |
|---------|-------|---------|
| **StreamingService** | ~300 | Token streaming with timeout handling |
| **TimelineBuilderService** | ~250 | Message timeline generation |
| **BranchContextService** | ~150 | LLM context assembly |
| **ThreadStatusService** | ~100 | Status indicator state machine |
| **ExecutionRunnerService** | ~200 | Thread execution management |
| **BranchGraphLayoutService** | ~300 | Graph layout calculations |

---

## 5. Key Differences from ChatPane

| Aspect | ChatPane | ThreadComponent |
|--------|----------|-----------------|
| Main file | 3,437 lines | ~800 lines (77% reduction) |
| Structure | Monolithic | Modular with views |
| Business logic | In component | Extracted to services |
| State management | Mixed | Hybrid (stores + $state) |
| Testability | Difficult | Services independently testable |
| Views | Single | 4 distinct views |

---

**End of Document**

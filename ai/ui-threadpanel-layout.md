# Thread Panel Layout System

**Version:** 2.0
**Date:** 2026-01-30
**Status:** Implementation Ready

---

## Related Documents

| Document | Description |
|----------|-------------|
| **ui-threadpanel-overview.md** | Architecture and design principles |
| **ui-threadpanel-components.md** | Component hierarchy and state machine (Sections 13-14) |
| **Sections 13-14 in ui-threadpanel-components.md** | LayoutConfig interface and ThreadLayoutSelector component |

---

## 1. Overview

The Thread Panel Layout System allows users to display multiple views simultaneously in a flexible multi-pane configuration. Five pre-defined layout templates accommodate different workflows, from single-view simplicity to a 2x2 grid for comprehensive analysis. View types: Chat, Execution, Branching, Prompt, and File.

**Key principle:** Only one instance of each view type per layout. This eliminates the need for infrastructure changes to streaming, state management, or messaging systems.

---

## 2. Layout Templates

### 2.1 Single Column (Default)

Single full-width pane. Ideal for focused, sequential work.

```
┌─────────────────────────────────┐
│                                 │
│         Chat View (Full)        │
│                                 │
└─────────────────────────────────┘
```

**Configuration:**
- **Template:** `single-col`
- **Panes:** 1
- **View:** Chat (default)
- **Use case:** Message-focused conversation

---

### 2.2 Vertical Split

Two side-by-side panes (50/50 split). Left for primary content, right for supporting context.

```
┌──────────────────┬──────────────────┐
│                  │                  │
│   Chat View      │ Branching View   │
│   (Left 50%)     │   (Right 50%)    │
│                  │                  │
└──────────────────┴──────────────────┘
```

**Configuration:**
- **Template:** `vertical-split`
- **Panes:** 2 (left, right)
- **Views:** Chat (left), Branching (right)
- **Use case:** Compare branching decisions while composing messages

---

### 2.3 Left Column Split

Three panes: left (tall) + right side split top/bottom. Focuses main content on left.

```
┌──────────────────┬──────────────────┐
│                  │                  │
│                  │ Execution View   │
│   Chat View      ├──────────────────┤
│                  │                  │
│   (Left Tall)    │ Prompt View      │
│                  │                  │
└──────────────────┴──────────────────┘
```

**Configuration:**
- **Template:** `col-left-split`
- **Panes:** 3 (left tall, right-top, right-bottom)
- **Views:** Chat (left), Execution (right-top), Prompt (right-bottom)
- **Use case:** Message composition with execution monitoring and prompts

---

### 2.4 Right Column Split

Three panes: left side split top/bottom + right (tall). Focuses supporting content on right.

```
┌──────────────────┬──────────────────┐
│                  │                  │
│ Execution View   │                  │
├──────────────────┤ Branching View   │
│                  │                  │
│ Prompt View      │   (Right Tall)   │
│                  │                  │
└──────────────────┴──────────────────┘
```

**Configuration:**
- **Template:** `col-right-split`
- **Panes:** 3 (left-top, left-bottom, right tall)
- **Views:** Execution (left-top), Prompt (left-bottom), Branching (right)
- **Use case:** Branching analysis with supporting execution and prompt context

---

### 2.5 Quad Split (2x2 Grid)

Four equal panes arranged in a 2x2 grid. Comprehensive view of four of the five view types.

```
┌──────────────────┬──────────────────┐
│                  │                  │
│   Chat View      │ Execution View   │
│   (Top-Left)     │   (Top-Right)    │
│                  │                  │
├──────────────────┼──────────────────┤
│                  │                  │
│ Branching View   │ Prompt/File View │
│  (Bottom-Left)   │ (Bottom-Right)   │
│                  │                  │
└──────────────────┴──────────────────┘
```

**Configuration:**
- **Template:** `quad-split`
- **Panes:** 4 (top-left, top-right, bottom-left, bottom-right)
- **Views:** Chat (top-left), Execution (top-right), Branching (bottom-left), Prompt or File (bottom-right)
- **Use case:** Comprehensive workspace with multiple view types visible simultaneously

---

### 2.6 Layout with 5th View (File View)

The File View can be added to any layout template as a replacement for Prompt or other views:

| Layout | File View Position | Common Use Case |
|--------|-------------------|------------------|
| Single Column | N/A | File browser in separate window |
| Vertical Split | Right pane | Chat (left), File browser (right) |
| Left Column Split | Right-bottom | Chat (left), File (right-bottom) |
| Right Column Split | Left-top or left-bottom | File browser + chat branching support |
| Quad Split | Bottom-right | Complete workspace with file access |

**Note:** The single-instance constraint applies to File View—only one File View per layout. User can toggle between File View and Prompt View in the bottom-right pane of quad layout.

---

## 3. Responsive Behavior

Layouts adapt to screen size to maintain usability:

| Screen Width | Behavior |
|--------------|----------|
| ≥ 1200px | Render as configured |
| 900-1199px | Render if fits, otherwise collapse |
| 600-899px | Auto-collapse to single-column |
| < 600px | Force single-column, hide layout selector |

---

## 4. Single-Instance-Per-View-Type Constraint

**Core Rule:** Only ONE instance of each view type per layout. A thread panel can display Chat, Execution, Branching, Prompt, and File—but never two Chat views, two File views, etc.

### 4.1 Why This Constraint?

This constraint ensures:
- **No streaming conflicts:** Only one Chat View receives tokens from the stream
- **No state duplication:** Message timeline exists once per thread
- **Simplified architecture:** Views are presentation-only; no per-pane state machines
- **Minimal code impact:** ~300-400 lines of new UI code, zero changes to services

### 4.2 Architectural Implications

**WITH single-instance constraint:**
- ✅ ChatStreamService remains single-pane
- ✅ ThreadStateMachine unchanged
- ✅ useThreadView composable unchanged
- ✅ IPC architecture unchanged
- ✅ Message synchronization unchanged

**WITHOUT single-instance constraint:**
- ❌ ChatStreamService needs multi-listener routing
- ❌ Per-pane state machines required
- ❌ useThreadView needs multi-pane state
- ❌ IPC coordination complexity
- ❌ Potential message duplication

### 4.3 Implementation Detail

When user switches layouts, views are **moved between panes in the DOM**, not duplicated. The Chat View component instance persists; it just renders in a different pane location.

---

## 5. Validation Rules

### 5.1 Layout Validator

The `LayoutValidator` class enforces these rules:

```typescript
class LayoutValidator {
  static validate(config: ThreadLayoutConfig): void {
    // Rule 1: No duplicate view types
    if (uniqueViewTypes !== totalViewCount) {
      throw new Error("Duplicate view types in layout");
    }
    
    // Rule 2: At least one pane required
    if (paneCount === 0) {
      throw new Error("Layout must contain at least one pane");
    }
    
    // Rule 3: Exactly one pane has focus
    if (focusedPaneCount !== 1) {
      throw new Error("Exactly 1 pane must be focused");
    }
  }
}
```

### 5.2 Validation Points

| Operation | Validation |
|-----------|-----------|
| **Layout creation** | Validate before assigning to state |
| **Layout switching** | Validate new layout before apply |
| **Pane focus change** | Ensure exactly 1 focused pane |
| **View assignment** | Prevent duplicate view types |

### 5.3 Concise Rule Reference

1. **No duplicate views:** Each view type appears at most once
2. **Minimum 1 pane:** Layout must have ≥ 1 pane
3. **Exactly 1 focus:** One pane must have keyboard focus
4. **Valid template:** Must be one of 5 templates

---

## 6. LayoutConfig Interface

```typescript
export type ViewType = 'chat' | 'execution' | 'branching' | 'prompt' | 'file';
export type LayoutTemplate = 'single-col' | 'vertical-split' | 'col-left-split' | 'col-right-split' | 'quad-split';

interface PaneConfig {
  id: string;              // Unique identifier
  viewType: ViewType;      // Which view in this pane
  focused: boolean;        // Keyboard focus
  cssClass?: string;       // Layout styling
  scrollPosition?: number;  // Per-pane scroll state
}

interface ThreadLayoutConfig {
  template: LayoutTemplate;
  panes: PaneConfig[];
  modifiedAt: number;
  name?: string;           // Optional user-defined name
}
```

---

## 7. Layout Selection UI

### 7.1 ThreadLayoutSelector Component

Displays 5 layout buttons in header with icons:

| Icon | Template | Label | Action |
|------|----------|-------|--------|
| ≡ | single-col | Single | Full-width view |
| ⬌ | vertical-split | Split | Left-right split |
| ⬅ | col-left-split | Left | Left tall, right split |
| ➡ | col-right-split | Right | Left split, right tall |
| ▦ | quad-split | Grid | 2x2 grid |

### 7.2 User Workflow

1. User clicks layout button in toolbar
2. ThreadLayoutSelector validates new layout
3. LayoutValidator confirms no duplicate views
4. Layout applies: views move to new panes
5. Scroll positions preserved per pane
6. Focus set to primary pane

---

## 8. Data Flow

```
User clicks layout button
        ↓
ThreadLayoutSelector.onLayoutChange()
        ↓
LayoutValidator.validate(newLayout)
        ↓
Configuration valid?
        ├─ No → Error logged, no change
        └─ Yes → threadLayoutStore.setLayout(newLayout)
                        ↓
                Views re-render in new pane positions
                        ↓
                Scroll positions restored
                        ↓
                Focus transferred to focused pane
```

---

## 9. Persistence

Layout configuration is saved to localStorage:

```typescript
const STORAGE_KEY = 'thread-layout-config';

// On layout change
threadLayoutStore.setLayout(config);  // Saves to localStorage

// On thread load
const savedLayout = localStorage.getItem(STORAGE_KEY);
// If valid, apply; otherwise use default
```

Persists across:
- ✅ View switching (Chat → Branching → Chat)
- ✅ Thread switching
- ✅ Application restart

---

## 10. Implementation Summary

| Aspect | Details |
|--------|---------|
| **New files** | `src/lib/types/layout.ts`, `src/lib/components/threadpanel/ThreadLayoutSelector.svelte` |
| **Modified files** | `src/lib/components/threadpanel/ThreadComponent.svelte` |
| **New code** | ~300-400 lines |
| **Infrastructure changes** | None (0 lines) |
| **Implementation time** | 2-3 days |
| **Risk level** | LOW (UI layer only) |

---

**End of Document**

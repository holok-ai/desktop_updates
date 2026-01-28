# Thread Panel Branching View

**Version:** 1.2
**Date:** 2026-01-27
**Status:** Draft

---

## Related Documents

| Document | Description |
|----------|-------------|
| **ui-threadpanel-overview.md** | Architecture and design principles |
| **ui-threadpanel-layout.md** | Component tree and file structure |
| **system-branching-id.md** | Branch ID system specification |
| **ui-chat-display.md** | Message display and status indicators |

---

## 1. Overview

The Branching View provides an interactive SVG-based visualization of conversation branches, allowing users to understand the structure of multi-branch conversations and navigate to specific messages. Users can zoom from a high-level overview showing only branch structure down to detailed message inspection with full tool call inputs/outputs and timing information.

---

## 2. Requirements

| ID | Requirement |
|----|-------------|
| **FR-301** | SVG-based graphical visualization of thread structure |
| **FR-302** | Show branch points and branch selections |
| **FR-303** | Display model names, prompt/response times, tokens |
| **FR-304** | Click node → navigate to Thread Chat View at that message |
| **FR-305** | Support zoom and pan controls via mouse wheel, drag, and toolbar |
| **FR-306** | Future: Floating side panel in Thread Chat View |
| **FR-307** | Support 5 zoom levels: Overview, Branch, Message, Detail, and Inspect |
| **FR-308** | Highlight selected node and show detail panel with full message content |
| **FR-309** | Display tool call inputs and outputs at Inspect zoom level |
| **FR-310** | Show message status indicators (complete, error, streaming) at all zoom levels |
| **FR-311** | Fit-to-view button to auto-scale graph to viewport |
| **FR-312** | Support keyboard shortcuts for zoom, pan, and navigation |

---

## 3. Zoom Levels

### 3.1 Zoom Level Definitions

| Level | Name | Scale | Content Visible |
|-------|------|-------|-----------------|
| **1** | Overview | 0.1 - 0.3 | Branch lanes only, no message details |
| **2** | Branch | 0.3 - 0.6 | Branch lanes + message role indicators |
| **3** | Message | 0.6 - 1.0 | Messages with preview text, timestamps |
| **4** | Detail | 1.0 - 2.0 | Full message info, tool calls, status |
| **5** | Inspect | 2.0+ | Expanded tool responses, full metadata |

### 3.2 Zoom Level Visualization

**Level 1: Overview (0.1 - 0.3)**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ════════●════════●════════●════════●═══════               │
│                   ╲                                         │
│                    ════●════●═══                            │
│                   ╲                                         │
│                    ════●════●════●═══                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
Nodes: Small dots, no labels
Edges: Thin lines showing branch structure
```

**Level 2: Branch (0.3 - 0.6)**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [U]───[A]───[U]───[A]───[U]───[A]                         │
│              │                                              │
│              └───[A']───[U]───[A]                          │
│              │                                              │
│              └───[A'']───[U]───[A]───[A]                   │
│                                  └─ tool                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
Nodes: Role badges (U=User, A=Assistant)
Edges: Show branch relationships
Labels: Branch index on divergence points
```

**Level 3: Message (0.6 - 1.0)**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                 │
│  │ User    │───▶│ Asst    │───▶│ User    │───▶ ...        │
│  │ 2:30 PM │    │ GPT-4o  │    │ 2:31 PM │                 │
│  │ "What..."│    │ 2:30 PM │    │ "Can..." │                 │
│  └─────────┘    └─────────┘    └─────────┘                 │
│                      │                                      │
│                      ▼                                      │
│                 ┌─────────┐    ┌─────────┐                 │
│                 │ Asst    │───▶│ User    │───▶ ...        │
│                 │ Claude  │    │ 2:32 PM │                 │
│                 │ 2:31 PM │    │ "Yes..." │                 │
│                 └─────────┘    └─────────┘                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
Nodes: Message cards with role, model, time, preview
Edges: Directional arrows
```

**Level 4: Detail (1.0 - 2.0)**
```
┌─────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────┐                          │
│  │ 👤 User Message               │                          │
│  │ ─────────────────────────────│                          │
│  │ "Analyze the sales data and  │                          │
│  │  create a summary report"    │                          │
│  │ ─────────────────────────────│                          │
│  │ 📅 Jan 27, 2026 2:30:45 PM   │                          │
│  │ 🆔 1.0.0.0                    │                          │
│  └───────────────────────────────┘                          │
│                 │                                           │
│                 ▼                                           │
│  ┌───────────────────────────────┐                          │
│  │ 🤖 Assistant (GPT-4o)    ✓   │                          │
│  │ ─────────────────────────────│                          │
│  │ "I'll analyze the data..."   │                          │
│  │ ─────────────────────────────│                          │
│  │ 📅 Jan 27, 2026 2:30:47 PM   │                          │
│  │ 🆔 1.0.1.0                    │                          │
│  │ 🔢 Tokens: 1,234 in / 567 out│                          │
│  │ ⏱️ Duration: 2.3s             │                          │
│  │ ─────────────────────────────│                          │
│  │ 🔧 Tools: read_file (1)      │                          │
│  └───────────────────────────────┘                          │
│                 │                                           │
│                 ▼                                           │
│  ┌───────────────────────────────┐                          │
│  │ 🔧 Tool: read_file       ✓   │                          │
│  │ ─────────────────────────────│                          │
│  │ Input: sales_q4.csv          │                          │
│  │ Result: Found 1,234 rows     │                          │
│  │ ⏱️ Duration: 0.8s             │                          │
│  └───────────────────────────────┘                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
Nodes: Full message cards with all metadata
Tool nodes: Inline below parent message
Status: Visible indicators (✓, ✗, ●)
```

**Level 5: Inspect (2.0+)**
```
┌─────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 🔧 Tool Execution: read_file                      ✓  │  │
│  │ ───────────────────────────────────────────────────── │  │
│  │ Tool Call ID: call_abc123xyz                         │  │
│  │ ───────────────────────────────────────────────────── │  │
│  │ INPUT:                                                │  │
│  │ {                                                     │  │
│  │   "path": "/data/sales_q4.csv",                      │  │
│  │   "encoding": "utf-8"                                │  │
│  │ }                                                     │  │
│  │ ───────────────────────────────────────────────────── │  │
│  │ OUTPUT:                                               │  │
│  │ {                                                     │  │
│  │   "success": true,                                   │  │
│  │   "rows": 1234,                                      │  │
│  │   "columns": ["date", "product", "revenue", "qty"], │  │
│  │   "preview": "date,product,revenue,qty\n2024-01..."  │  │
│  │ }                                                     │  │
│  │ ───────────────────────────────────────────────────── │  │
│  │ 📅 Started: 2:30:47.123 PM                           │  │
│  │ 📅 Ended: 2:30:47.923 PM                             │  │
│  │ ⏱️ Duration: 800ms                                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
Full tool input/output JSON
Precise timestamps (milliseconds)
Expandable sections
```

---

## 4. Component Specifications

### 4.1 ThreadBranchingView.svelte

**Responsibilities:**
- Render SVG-based branch visualization
- Handle zoom level transitions
- Manage pan and zoom controls
- Handle node clicks for navigation
- Show metadata based on zoom level

**Props:**
```typescript
interface ThreadBranchingViewProps {
  thread: Thread;
  messages: Message[];
  onNavigateToMessage: (messageId: string) => void;
}
```

**State:**
```typescript
let zoomLevel = $state(1.0);
let panOffset = $state({ x: 0, y: 0 });
let selectedNodeId = $state<string | null>(null);
let hoveredNodeId = $state<string | null>(null);
let graphData = $state<BranchGraphData | null>(null);

// Derived zoom tier for rendering decisions
const zoomTier = $derived<ZoomTier>(() => {
  if (zoomLevel < 0.3) return 'overview';
  if (zoomLevel < 0.6) return 'branch';
  if (zoomLevel < 1.0) return 'message';
  if (zoomLevel < 2.0) return 'detail';
  return 'inspect';
});
```

**Template:**
```svelte
<div class="thread-branching-view">
  <BranchingToolbar
    {zoomLevel}
    onZoomIn={() => handleZoom(1.2)}
    onZoomOut={() => handleZoom(0.8)}
    onFitToView={handleFitToView}
    onResetView={handleResetView}
    {zoomTier}
  />

  <BranchingCanvas
    {graphData}
    {zoomLevel}
    {panOffset}
    {zoomTier}
    {selectedNodeId}
    {hoveredNodeId}
    onNodeClick={handleNodeClick}
    onNodeHover={handleNodeHover}
    onPan={handlePan}
    onZoom={handleZoom}
  />

  {#if selectedNodeId}
    <BranchingDetailPanel
      node={getNode(selectedNodeId)}
      {zoomTier}
      onClose={() => selectedNodeId = null}
      onNavigate={() => onNavigateToMessage(selectedNodeId)}
    />
  {/if}
</div>
```

**Size Estimate:** ~500 lines

---

### 4.2 BranchingCanvas.svelte

**Responsibilities:**
- Render SVG graph with nodes and edges
- Handle mouse/touch interactions for pan/zoom
- Render appropriate detail based on zoom tier
- Handle node selection and hover states

**Props:**
```typescript
interface BranchingCanvasProps {
  graphData: BranchGraphData;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  zoomTier: ZoomTier;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  onNodeHover: (nodeId: string | null) => void;
  onPan: (delta: { x: number; y: number }) => void;
  onZoom: (factor: number, center?: { x: number; y: number }) => void;
}
```

**Size Estimate:** ~300 lines

---

### 4.3 BranchingNode.svelte

**Responsibilities:**
- Render node appropriate to zoom tier
- Show role indicator, timestamps, status
- Handle click and hover interactions
- Animate state transitions

**Size Estimate:** ~200 lines

---

### 4.4 BranchingToolbar.svelte

**Responsibilities:**
- Zoom controls (+/-, fit, reset)
- Zoom level indicator
- Current tier indicator

**Size Estimate:** ~100 lines

---

### 4.5 BranchingDetailPanel.svelte

**Responsibilities:**
- Show expanded details for selected node
- Display full message content
- Show all tool calls with input/output
- Provide navigation action

**Size Estimate:** ~150 lines

---

## 5. Data Models

### 5.1 Graph Data Structures

```typescript
type ZoomTier = 'overview' | 'branch' | 'message' | 'detail' | 'inspect';

interface BranchGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  bounds: GraphBounds;
}

interface GraphNode {
  id: string;                    // Message ID
  branchId: string;              // 4-digit format (system-branching-id.md)
  position: { x: number; y: number };
  type: 'user' | 'assistant' | 'tool';
  metadata: NodeMetadata;
}

interface NodeMetadata {
  timestamp: number;
  status: MessageStatus;         // 'pending' | 'streaming' | 'complete' | 'error'
  preview: string;               // First ~100 chars of content
  fullContent: string;           // Full message content
  model?: string;                // Model name for assistant messages
  tokens?: {
    input: number;
    output: number;
  };
  duration?: number;             // Response time in ms
  toolCalls?: ToolCallMetadata[];
}

interface ToolCallMetadata {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: 'pending' | 'complete' | 'error';
  duration: number;
  startedAt: number;
  completedAt: number;
}

interface GraphEdge {
  id: string;
  from: string;                  // Node ID
  to: string;                    // Node ID
  type: 'sequential' | 'branch' | 'tool';
}

interface GraphBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}
```

### 5.2 Layout Configuration

```typescript
interface LayoutConfig {
  nodeWidth: number;             // Base width at zoom 1.0
  nodeHeight: number;            // Base height at zoom 1.0
  horizontalGap: number;         // Gap between sequential nodes
  verticalGap: number;           // Gap between branch lanes
  toolNodeOffset: number;        // Vertical offset for tool nodes
  toolNodeScale: number;         // Scale factor for tool nodes (0.8)
}

const DEFAULT_LAYOUT: LayoutConfig = {
  nodeWidth: 160,
  nodeHeight: 80,
  horizontalGap: 60,
  verticalGap: 120,
  toolNodeOffset: 50,
  toolNodeScale: 0.8,
};
```

---

## 6. BranchGraphLayoutService

**File:** `src/lib/services/branch-graph-layout.service.ts`

**Purpose:** Calculate node positions for branch visualization

```typescript
class BranchGraphLayoutService {
  buildGraph(messages: Message[]): BranchGraphData;
  private createNodes(messages: Message[]): GraphNode[];
  private createEdges(nodes: GraphNode[], messages: Message[]): GraphEdge[];
  private calculatePositions(nodes: GraphNode[], messages: Message[]): GraphNode[];
  private calculateBounds(nodes: GraphNode[]): GraphBounds;
  private extractMetadata(message: Message): NodeMetadata;
}

export const branchGraphLayoutService = new BranchGraphLayoutService();
```

---

## 7. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Reset zoom to 100% |
| `F` | Fit graph to view |
| `Arrow keys` | Pan view |
| `Escape` | Deselect node / close panel |
| `Enter` | Navigate to selected message |
| `1` - `5` | Jump to zoom tier |

---

## 8. Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Keyboard navigation | Full keyboard support for pan, zoom, selection |
| Screen reader | ARIA labels on all interactive elements |
| Focus indicators | Visible focus rings on nodes and controls |
| Color contrast | Status colors meet WCAG AA (4.5:1) |
| Reduced motion | Respect `prefers-reduced-motion` for animations |

---

**End of Document**

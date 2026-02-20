<script lang="ts">
  /**
   * ThreadGraphicView — SVG visualization of a chat thread.
   *
   * Renders messages as connected nodes in a directed graph:
   *   • User prompts are blue rounded rectangles
   *   • Assistant responses are green rounded rectangles
   *   • Branches (same prompt → multiple models) display lanes side-by-side
   *   • Mouse wheel zooms, drag pans the viewport
   *   • Hover shows tooltip with message preview and model info
   */
  import type { Message } from '$lib/types/thread.type';
  import { threadService } from '$lib/services/thread.service';

  // ── Props ──
  interface Props {
    messages: Message[];
  }

  let { messages = [] }: Props = $props();

  // ── Layout constants ──
  const NODE_W = 270;
  const NODE_H = 56;
  const NODE_RX = 12;
  const H_GAP = 40; // Horizontal gap between lanes
  const V_GAP = 36; // Vertical gap between rows
  const BRANCH_PAD = 16; // Padding inside branch group
  const TOP_PAD = 40;
  const LEFT_PAD = 40;
  const MAX_PREVIEW_LEN = 120;

  // ── Zoom / Pan state ──
  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let isPanning = $state(false);
  let panStartX = $state(0);
  let panStartY = $state(0);
  let panStartPanX = $state(0);
  let panStartPanY = $state(0);

  // ── Tooltip state ──
  let tooltip = $state<{
    visible: boolean;
    x: number;
    y: number;
    title: string;
    content: string;
    model: string;
    userId?: string;
    role: 'user' | 'assistant';
  }>({ visible: false, x: 0, y: 0, title: '', content: '', model: '', role: 'user' });

  // ── SVG container ref ──
  let svgEl: SVGSVGElement | undefined = $state(undefined);

  // ── Build display items from messages ──
  const displayItems = $derived.by(() => {
    return threadService.buildDisplayItems(messages, false, '');
  });

  // ── Node Layout Types ──
  interface LayoutNode {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    role: 'user' | 'assistant';
    content: string;
    modelId: string;
    userId?: string;
    createdAt: number;
    parentId: string | null;
  }

  interface LayoutEdge {
    fromId: string;
    toId: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  }

  interface BranchGroup {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
  }

  // ── Compute layout ──
  const layout = $derived.by(() => {
    const nodes: LayoutNode[] = [];
    const edges: LayoutEdge[] = [];
    const branchGroups: BranchGroup[] = [];

    let cursorY = TOP_PAD;
    let lastNodeId: string | null = null;

    for (const item of displayItems) {
      if (item.type === 'message') {
        const { pair } = item;

        // User node
        const userNode = createNode(pair.request, LEFT_PAD, cursorY, lastNodeId);
        nodes.push(userNode);
        if (lastNodeId) {
          edges.push(createEdge(lastNodeId, userNode.id, nodes));
        }
        lastNodeId = userNode.id;
        cursorY += NODE_H + V_GAP;

        // Assistant nodes (potentially multiple)
        if (pair.responses.length > 0) {
          for (const response of pair.responses) {
            const respNode = createNode(response, LEFT_PAD, cursorY, lastNodeId);
            nodes.push(respNode);
            edges.push(createEdge(lastNodeId, respNode.id, nodes));
            lastNodeId = respNode.id;
            cursorY += NODE_H + V_GAP;
          }
        } else if (pair.isStreamingResponse) {
          // Streaming placeholder
          const streamNode: LayoutNode = {
            id: `streaming-${pair.request.id}`,
            x: LEFT_PAD,
            y: cursorY,
            w: NODE_W,
            h: NODE_H,
            role: 'assistant',
            content: pair.streamingContent || 'Generating...',
            modelId: '',
            createdAt: Date.now(),
            parentId: lastNodeId,
          };
          nodes.push(streamNode);
          edges.push(createEdge(lastNodeId, streamNode.id, nodes));
          lastNodeId = streamNode.id;
          cursorY += NODE_H + V_GAP;
        }
      } else {
        // Branch display — lay lanes side by side
        const laneCount = item.lanes.length;
        const branchTotalW = laneCount * NODE_W + (laneCount - 1) * H_GAP + 2 * BRANCH_PAD;
        const branchStartX = LEFT_PAD;
        const branchStartY = cursorY;

        // Find the max vertical extent across all lanes
        let maxLaneHeight = 0;
        const laneLayouts: { nodes: LayoutNode[]; internalEdges: LayoutEdge[] }[] = [];

        for (let li = 0; li < laneCount; li++) {
          const lane = item.lanes[li];
          const laneX = branchStartX + BRANCH_PAD + li * (NODE_W + H_GAP);
          let laneY = branchStartY + BRANCH_PAD + 24; // 24px for branch label
          const laneNodes: LayoutNode[] = [];
          const laneEdges: LayoutEdge[] = [];
          let lanePrevId: string | null = lastNodeId;

          for (const pair of lane.messagePairs) {
            // User node
            const un = createNode(pair.request, laneX, laneY, lanePrevId);
            laneNodes.push(un);
            if (lanePrevId && lanePrevId === lastNodeId) {
              // Edge from pre-branch node — will be drawn separately
            } else if (lanePrevId) {
              laneEdges.push(createEdge(lanePrevId, un.id, [...nodes, ...laneNodes]));
            }
            lanePrevId = un.id;
            laneY += NODE_H + V_GAP;

            // Assistant nodes (potentially multiple)
            for (const response of pair.responses) {
              const rn = createNode(response, laneX, laneY, lanePrevId);
              laneNodes.push(rn);
              laneEdges.push(createEdge(lanePrevId, rn.id, [...nodes, ...laneNodes]));
              lanePrevId = rn.id;
              laneY += NODE_H + V_GAP;
            }
          }

          const laneHeight = laneY - (branchStartY + BRANCH_PAD + 24);
          if (laneHeight > maxLaneHeight) maxLaneHeight = laneHeight;

          laneLayouts.push({ nodes: laneNodes, internalEdges: laneEdges });
        }

        const branchH = maxLaneHeight + BRANCH_PAD * 2 + 24;

        branchGroups.push({
          x: branchStartX,
          y: branchStartY,
          w: branchTotalW,
          h: branchH,
          label: `Branch: ${laneCount} model${laneCount > 1 ? 's' : ''}`,
        });

        // Add lane nodes and edges to main arrays; also add edges from pre-branch node
        for (let li = 0; li < laneLayouts.length; li++) {
          const ll = laneLayouts[li];
          nodes.push(...ll.nodes);
          edges.push(...ll.internalEdges);

          // Edge from pre-branch node to first node in each lane
          if (lastNodeId && ll.nodes.length > 0) {
            edges.push(createEdge(lastNodeId, ll.nodes[0].id, nodes));
          }
        }

        cursorY = branchStartY + branchH + V_GAP;

        // Pick the last node from the first (main) lane as the continuation point
        const mainLane = laneLayouts[0];
        if (mainLane && mainLane.nodes.length > 0) {
          lastNodeId = mainLane.nodes[mainLane.nodes.length - 1].id;
        }
      }
    }

    return { nodes, edges, branchGroups };
  });

  // ── Computed SVG canvas size ──
  const canvasSize = $derived.by(() => {
    if (layout.nodes.length === 0) return { w: 800, h: 600 };

    let maxX = 0;
    let maxY = 0;
    for (const n of layout.nodes) {
      const right = n.x + n.w;
      const bottom = n.y + n.h;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }
    for (const bg of layout.branchGroups) {
      const right = bg.x + bg.w;
      const bottom = bg.y + bg.h;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }
    return { w: maxX + 80, h: maxY + 80 };
  });

  // ── Helper: create a node from a Message ──
  function createNode(msg: Message, x: number, y: number, parentId: string | null): LayoutNode {
    return {
      id: msg.id,
      x,
      y,
      w: NODE_W,
      h: NODE_H,
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
      modelId: msg.modelId || '',
      userId: msg.userId,
      createdAt: msg.createdAt,
      parentId,
    };
  }

  // ── Helper: create an edge ──
  function createEdge(fromId: string, toId: string, nodeList: LayoutNode[]): LayoutEdge {
    const from = nodeList.find((n) => n.id === fromId);
    const to = nodeList.find((n) => n.id === toId);
    if (!from || !to) {
      return { fromId, toId, fromX: 0, fromY: 0, toX: 0, toY: 0 };
    }
    return {
      fromId,
      toId,
      fromX: from.x + from.w / 2,
      fromY: from.y + from.h,
      toX: to.x + to.w / 2,
      toY: to.y,
    };
  }

  // ── Truncate text for node label ──
  function truncate(text: string, max: number): string {
    const cleaned = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned.length <= max) return cleaned;
    return cleaned.substring(0, max - 3) + '...';
  }

  // ── Zoom handlers ──
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.2, Math.min(3, zoom + delta));

    // Zoom toward cursor position
    if (svgEl) {
      const rect = svgEl.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Adjust pan so the point under cursor stays fixed
      panX = mx - (mx - panX) * (newZoom / zoom);
      panY = my - (my - panY) * (newZoom / zoom);
    }

    zoom = newZoom;
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return; // Left click only
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    panStartPanX = panX;
    panStartPanY = panY;
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isPanning) return;
    panX = panStartPanX + (e.clientX - panStartX);
    panY = panStartPanY + (e.clientY - panStartY);
  }

  function handleMouseUp() {
    isPanning = false;
  }

  function handleKeyDown(e: KeyboardEvent) {
    const panSpeed = 20;
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        panY += panSpeed;
        break;
      case 'ArrowDown':
        e.preventDefault();
        panY -= panSpeed;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        panX += panSpeed;
        break;
      case 'ArrowRight':
        e.preventDefault();
        panX -= panSpeed;
        break;
      case '+':
      case '=':
        e.preventDefault();
        zoomIn();
        break;
      case '-':
      case '_':
        e.preventDefault();
        zoomOut();
        break;
      case '0':
        e.preventDefault();
        resetView();
        break;
    }
  }

  // ── Zoom controls ──
  function zoomIn() {
    zoom = Math.min(3, zoom + 0.2);
  }

  function zoomOut() {
    zoom = Math.max(0.2, zoom - 0.2);
  }

  function resetView() {
    zoom = 1;
    panX = 0;
    panY = 0;
  }

  function fitToView() {
    if (!svgEl || layout.nodes.length === 0) return;
    const rect = svgEl.getBoundingClientRect();
    const scaleX = rect.width / canvasSize.w;
    const scaleY = rect.height / canvasSize.h;
    zoom = Math.min(scaleX, scaleY, 1.5) * 0.9; // 90% fill
    panX = (rect.width - canvasSize.w * zoom) / 2;
    panY = 10;
  }

  // ── Node hover ──
  function showTooltip(node: LayoutNode, e: MouseEvent) {
    const preview = node.content.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    tooltip = {
      visible: true,
      x: e.clientX + 12,
      y: e.clientY + 12,
      title: node.role === 'user' ? 'User Prompt' : 'Assistant Response',
      content:
        preview.length > MAX_PREVIEW_LEN ? preview.substring(0, MAX_PREVIEW_LEN) + '...' : preview,
      model: node.modelId || '',
      userId: node.userId,
      role: node.role,
    };
  }

  function moveTooltip(e: MouseEvent) {
    if (tooltip.visible) {
      tooltip.x = e.clientX + 12;
      tooltip.y = e.clientY + 12;
    }
  }

  function hideTooltip() {
    tooltip = { ...tooltip, visible: false };
  }

  // ── Edge path (curved connector) ──
  function edgePath(edge: LayoutEdge): string {
    const { fromX, fromY, toX, toY } = edge;
    const midY = (fromY + toY) / 2;

    if (Math.abs(fromX - toX) < 2) {
      // Straight vertical line
      return `M ${fromX} ${fromY} L ${toX} ${toY}`;
    }

    // Curved path for cross-lane connections
    return `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
  }

  // ── Node colors ──
  function nodeStroke(role: 'user' | 'assistant'): string {
    return role === 'user'
      ? 'var(--graphic-user-stroke, #3b82f6)'
      : 'var(--graphic-assistant-stroke, #10b981)';
  }

  function nodeFill(role: 'user' | 'assistant'): string {
    return role === 'user'
      ? 'var(--graphic-user-fill, #eff6ff)'
      : 'var(--graphic-assistant-fill, #ecfdf5)';
  }

  function nodeIcon(role: 'user' | 'assistant'): string {
    return role === 'user' ? '👤' : '🤖';
  }
</script>

<svelte:window onmouseup={handleMouseUp} onmousemove={handleMouseMove} />

<div class="thread-graphic-view">
  {#if displayItems.length === 0}
    <div class="graphic-empty-state">
      <i class="pi pi-sitemap"></i>
      <h3>Thread Graph</h3>
      <p>Send some messages to see the conversation graph.</p>
    </div>
  {:else}
    <!-- Zoom controls -->
    <div class="zoom-controls">
      <button class="zoom-btn" onclick={zoomIn} title="Zoom in">
        <i class="pi pi-plus"></i>
      </button>
      <button class="zoom-btn" onclick={zoomOut} title="Zoom out">
        <i class="pi pi-minus"></i>
      </button>
      <button class="zoom-btn" onclick={resetView} title="Reset view">
        <i class="pi pi-refresh"></i>
      </button>
      <button class="zoom-btn" onclick={fitToView} title="Fit to view">
        <i class="pi pi-arrows-alt"></i>
      </button>
      <span class="zoom-level">{Math.round(zoom * 100)}%</span>
    </div>

    <!-- SVG Canvas -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <svg
      bind:this={svgEl}
      class="graph-svg"
      class:panning={isPanning}
      onwheel={handleWheel}
      onmousedown={handleMouseDown}
      onkeydown={handleKeyDown}
      role="application"
      tabindex="0"
      aria-label="Thread conversation graph - use arrow keys to pan, +/- to zoom, 0 to reset"
    >
      <defs>
        <!-- Arrow marker -->
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M 0 0 L 8 3 L 0 6 Z" fill="var(--text-secondary, #666)" />
        </marker>

        <!-- Drop shadow filter -->
        <filter id="node-shadow" x="-10%" y="-10%" width="130%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.1" />
        </filter>
      </defs>

      <g transform="translate({panX}, {panY}) scale({zoom})">
        <!-- Branch group backgrounds -->
        {#each layout.branchGroups as bg}
          <rect
            x={bg.x}
            y={bg.y}
            width={bg.w}
            height={bg.h}
            rx="10"
            fill="var(--surface-card, #fafafa)"
            stroke="var(--surface-border, #e0e0e0)"
            stroke-width="1.5"
            stroke-dasharray="6 3"
            opacity="0.7"
          />
          <text x={bg.x + 12} y={bg.y + 18} class="branch-label">{bg.label}</text>
        {/each}

        <!-- Edges -->
        {#each layout.edges as edge}
          <path
            d={edgePath(edge)}
            fill="none"
            stroke="var(--text-secondary, #999)"
            stroke-width="1.5"
            stroke-opacity="0.5"
            marker-end="url(#arrowhead)"
          />
        {/each}

        <!-- Nodes -->
        {#each layout.nodes as node}
          <g
            class="graph-node"
            onmouseenter={(e) => showTooltip(node, e)}
            onmousemove={moveTooltip}
            onmouseleave={hideTooltip}
            role="button"
            tabindex="-1"
          >
            <!-- Node rectangle -->
            <rect
              x={node.x}
              y={node.y}
              width={node.w}
              height={node.h}
              rx={NODE_RX}
              fill={nodeFill(node.role)}
              stroke={nodeStroke(node.role)}
              stroke-width="2"
              filter="url(#node-shadow)"
            />

            <!-- Role icon -->
            <text x={node.x + 14} y={node.y + NODE_H / 2 + 5} class="node-icon"
              >{nodeIcon(node.role)}</text
            >

            <!-- Label line 1 — role -->
            <text
              x={node.x + 34}
              y={node.y + 20}
              class="node-role-label"
              fill={nodeStroke(node.role)}
              >{node.role === 'user' ? (node.userId ? node.userId : 'User') : 'Assistant'}
            </text>

            <!-- Label line 2 — content preview -->
            <text x={node.x + 34} y={node.y + 38} class="node-content-label"
              >{truncate(node.content, 45)}</text
            >

            <!-- Model badge (assistant only) -->
            {#if node.role === 'assistant' && node.modelId}
              <text
                x={node.x + node.w - 8}
                y={node.y + 15}
                class="node-model-badge"
                text-anchor="end">{truncate(node.modelId, 14)}</text
              >
            {/if}
          </g>
        {/each}
      </g>
    </svg>

    <!-- Tooltip (rendered outside SVG for proper layering) -->
    {#if tooltip.visible}
      <div
        class="graph-tooltip"
        class:tooltip-user={tooltip.role === 'user'}
        class:tooltip-assistant={tooltip.role === 'assistant'}
        style="left: {tooltip.x}px; top: {tooltip.y}px;"
      >
        <div class="tooltip-header">{tooltip.title}</div>
        {#if tooltip.userId}
          <div class="tooltip-model">User: {tooltip.userId}</div>
        {/if}
        {#if tooltip.model}
          <div class="tooltip-model">Model: {tooltip.model}</div>
        {/if}
        <div class="tooltip-content">{tooltip.content}</div>
      </div>
    {/if}

    <!-- Legend -->
    <div class="graph-legend">
      <div class="legend-item">
        <span class="legend-swatch legend-user"></span>
        <span>User prompt</span>
      </div>
      <div class="legend-item">
        <span class="legend-swatch legend-assistant"></span>
        <span>AI response</span>
      </div>
      <div class="legend-item">
        <span class="legend-swatch legend-branch"></span>
        <span>Branch</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .thread-graphic-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
    background: var(--surface-main, #fafafa);
  }

  /* ── Empty state ── */
  .graphic-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--text-secondary, #666);
    gap: 0.75rem;
    padding: 2rem;
  }

  .graphic-empty-state i {
    font-size: 2.5rem;
    opacity: 0.3;
  }

  .graphic-empty-state h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary, #111);
  }

  .graphic-empty-state p {
    margin: 0;
    font-size: 0.875rem;
  }

  /* ── SVG canvas ── */
  .graph-svg {
    flex: 1;
    width: 100%;
    cursor: grab;
    user-select: none;
  }

  .graph-svg.panning {
    cursor: grabbing;
  }

  /* ── Node styles ── */
  .graph-node {
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .graph-node:hover rect {
    stroke-width: 3;
    filter: url(#node-shadow);
  }

  .node-icon {
    font-size: 16px;
    pointer-events: none;
  }

  .node-role-label {
    font-size: 11px;
    font-weight: 600;
    pointer-events: none;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .node-content-label {
    font-size: 11px;
    fill: var(--text-secondary, #666);
    pointer-events: none;
  }

  .node-model-badge {
    font-size: 8px;
    fill: var(--text-secondary, #999);
    pointer-events: none;
    font-style: italic;
  }

  .branch-label {
    font-size: 11px;
    font-weight: 600;
    fill: var(--text-secondary, #888);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* ── Zoom controls ── */
  .zoom-controls {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--surface-card, #fff);
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 8px;
    padding: 4px 8px;
    z-index: 10;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .zoom-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    border-radius: 6px;
    color: var(--text-primary, #333);
    cursor: pointer;
    font-size: 12px;
    transition: background 0.15s;
  }

  .zoom-btn:hover {
    background: var(--surface-hover, #f0f0f0);
  }

  .zoom-level {
    font-size: 11px;
    color: var(--text-secondary, #666);
    min-width: 36px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  /* ── Tooltip ── */
  .graph-tooltip {
    position: fixed;
    z-index: 1000;
    max-width: 340px;
    min-width: 180px;
    background: var(--surface-card, #fff);
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 8px;
    padding: 10px 14px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    pointer-events: none;
    font-size: 12px;
    line-height: 1.5;
  }

  .tooltip-user {
    border-left: 3px solid var(--graphic-user-stroke, #3b82f6);
  }

  .tooltip-assistant {
    border-left: 3px solid var(--graphic-assistant-stroke, #10b981);
  }

  .tooltip-header {
    font-weight: 600;
    color: var(--text-primary, #111);
    margin-bottom: 4px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .tooltip-model {
    font-size: 11px;
    color: var(--text-secondary, #888);
    margin-bottom: 6px;
    font-style: italic;
  }

  .tooltip-content {
    color: var(--text-primary, #333);
    word-break: break-word;
    white-space: pre-wrap;
  }

  /* ── Legend ── */
  .graph-legend {
    position: absolute;
    bottom: 12px;
    left: 12px;
    display: flex;
    gap: 16px;
    background: var(--surface-card, #fff);
    border: 1px solid var(--surface-border, #e0e0e0);
    border-radius: 8px;
    padding: 6px 14px;
    z-index: 10;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    font-size: 11px;
    color: var(--text-secondary, #666);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .legend-swatch {
    display: inline-block;
    width: 14px;
    height: 14px;
    border-radius: 4px;
    border: 2px solid;
  }

  .legend-user {
    background: var(--graphic-user-fill, #eff6ff);
    border-color: var(--graphic-user-stroke, #3b82f6);
  }

  .legend-assistant {
    background: var(--graphic-assistant-fill, #ecfdf5);
    border-color: var(--graphic-assistant-stroke, #10b981);
  }

  .legend-branch {
    background: var(--surface-card, #fafafa);
    border-color: var(--surface-border, #e0e0e0);
    border-style: dashed;
  }
</style>

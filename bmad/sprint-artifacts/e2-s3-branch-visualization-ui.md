# Story 2.3: Branch Visualization UI

Status: ready-for-dev

## Story

As a user,
I want to see branched conversations in visual lanes,
so that I can understand the conversation tree structure at a glance.

## Acceptance Criteria

1. Clear visual distinction between lanes (borders, spacing) (TM §5.1)
2. Active lane highlighted with distinct styling (TM §5.3)
3. Lanes independently scrollable without affecting other lanes (TM §5.2)
4. Collapse hides inactive branches, shows collapsed indicator (TM §5.4)
5. Works with up to 2 levels of nested branches (TM §5.5)
6. Single column layout until branch point detected (TM §5.2)
7. Branch indicator visible at fork points
8. Smooth transitions when expanding/collapsing lanes

## Tasks / Subtasks

- [ ] Design and create BranchLane component (AC: #1, #2)
  - [ ] Create `src/components/BranchLane.svelte`
  - [ ] Define lane width: 400px (configurable)
  - [ ] Add 16px spacing between lanes
  - [ ] Add border: 2px solid with theme color
  - [ ] Create lane header with branch label ("Branch 0", "Branch 1", "Branch 2")
  - [ ] Style active state: brighter border, solid background
  - [ ] Style inactive state: dimmed border, semi-transparent background
  - [ ] Add hover effects for lane selection

- [ ] Detect branch points in message tree (AC: #6, #7)
  - [ ] Create `src/utils/branchDetector.ts`
  - [ ] Scan message tree for messages with multiple children
  - [ ] Identify fork points: messages where count(children with different branchIndex) > 1
  - [ ] Return array of branch point message IDs
  - [ ] Create BranchIndicator.svelte component
  - [ ] Show icon/badge at fork points

- [ ] Implement single column rendering until branch (AC: #6)
  - [ ] Render messages linearly in single column (normal message list)
  - [ ] Detect first branch point in conversation
  - [ ] Insert branch transition UI at fork point
  - [ ] Switch to lane layout after branch indicator

- [ ] Implement multi-lane layout at branch points (AC: #1, #3)
  - [ ] Create `src/components/BranchContainer.svelte`
  - [ ] Use CSS Grid for lane positioning: `grid-template-columns: repeat(auto-fit, 400px)`
  - [ ] Ensure lanes align horizontally at branch point
  - [ ] Add visual connectors from parent to child lanes (SVG lines)
  - [ ] Make each lane independently scrollable: `overflow-y: auto`
  - [ ] Prevent horizontal scroll on container: `overflow-x: hidden` or `auto`

- [ ] Implement active branch highlighting (AC: #2)
  - [ ] Create `activeBranchStore` (writable store)
  - [ ] Track active branch index per fork point
  - [ ] Apply highlight class to active lane
  - [ ] Update active branch on lane click
  - [ ] Dim inactive lanes: opacity 0.6
  - [ ] Animate highlight transition (200ms ease)

- [ ] Implement branch collapse/expand (AC: #4, #8)
  - [ ] Add collapse button to lane header (chevron icon)
  - [ ] Toggle collapsed state on click
  - [ ] Animate height transition: `transition: height 300ms ease`
  - [ ] Show collapsed indicator: "2 messages hidden" badge
  - [ ] Persist collapse state in localStorage: `branch-collapse:{threadId}:{branchId}`
  - [ ] Restore collapse state on thread load

- [ ] Handle nested branches (branch within branch) (AC: #5)
  - [ ] Support recursive lane rendering for nested branches
  - [ ] Limit visual depth to 2 levels (prevent overwhelming UI)
  - [ ] For deeper nesting: Show "View full branch" button
  - [ ] Button opens modal/expanded view with full tree
  - [ ] Test with complex scenarios: 3+ levels of nesting
  - [ ] Add unit test: Render tree with 2 levels of branches

- [ ] Add responsive layout handling (AC: #1, #3)
  - [ ] Detect narrow viewports (< 1200px width)
  - [ ] Stack lanes vertically on narrow screens
  - [ ] Adjust lane width to fit viewport
  - [ ] Maintain scroll independence in stacked mode

- [ ] Implement visual connectors between lanes (AC: #1)
  - [ ] Create SVG overlay for connector lines
  - [ ] Draw lines from parent message to child lane headers
  - [ ] Use bezier curves for smooth connections
  - [ ] Color code connectors by branch index
  - [ ] Update connectors on scroll (sticky positioning)

## Dev Notes

### Architecture Patterns and Constraints

**Lane Layout Structure:**
```
<BranchContainer>
  <SingleColumnMessages> <!-- Before branch point -->
  <BranchIndicator />
  <BranchLanes>
    <BranchLane active={true} index={0}>
      <LaneHeader>Branch 0 (Original)</LaneHeader>
      <Messages />
    </BranchLane>
    <BranchLane active={false} index={1}>
      <LaneHeader>Branch 1 (Retry 1)</LaneHeader>
      <Messages />
    </BranchLane>
  </BranchLanes>
</BranchContainer>
```

**CSS Grid Layout:**
```css
.branch-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, 400px);
  gap: 16px;
  overflow-x: auto;
}

.branch-lane {
  width: 400px;
  border: 2px solid var(--border-color);
  overflow-y: auto;
  max-height: calc(100vh - 200px);
}

.branch-lane.active {
  border-color: var(--primary-color);
  opacity: 1;
}

.branch-lane.inactive {
  opacity: 0.6;
}
```

**Branch Detection Algorithm:**
```typescript
function detectBranchPoints(messages: Message[]): string[] {
  const branchPoints: string[] = [];
  const childrenMap = new Map<string, Message[]>();

  // Build parent → children map
  messages.forEach(msg => {
    if (msg.parentMessageId) {
      if (!childrenMap.has(msg.parentMessageId)) {
        childrenMap.set(msg.parentMessageId, []);
      }
      childrenMap.get(msg.parentMessageId)!.push(msg);
    }
  });

  // Find parents with multiple different branchIndex children
  childrenMap.forEach((children, parentId) => {
    const uniqueBranches = new Set(children.map(c => c.branchIndex));
    if (uniqueBranches.size > 1) {
      branchPoints.push(parentId);
    }
  });

  return branchPoints;
}
```

### Project Structure Notes

**File Locations:**
- `src/components/BranchContainer.svelte` - Main container for lane layout
- `src/components/BranchLane.svelte` - Individual lane component
- `src/components/BranchIndicator.svelte` - Fork point indicator
- `src/utils/branchDetector.ts` - Branch point detection logic
- `src/stores/activeBranchStore.ts` - Active branch tracking

**Dependencies:**
- E2-S1: Message tree data model
- E2-S2: Retry flow (creates branches to visualize)

### Testing Framework

**Unit Tests:**
- BranchDetector: Identify branch points correctly
- Lane component rendering with different states
- Collapse/expand state management

**Integration Tests:**
- Full tree rendering with multiple branches
- Active branch switching
- Scroll independence between lanes

**E2E Tests:**
- Navigate branched conversation
- Click retry → verify new lane appears
- Collapse/expand lanes
- Responsive layout on different viewport sizes

### References

- [Source: docs/epics-and-stories-2025-11-25.md §E2-S3]
- [Source: docs/sprint-artifacts/tech-spec-epic-2.md (if exists)]

### Learnings from Previous Stories

**From E2-S1:**
- Message tree structure with parentMessageId and branchIndex
- Tree traversal utilities for context assembly

**From E2-S2:**
- Retry flow creates new branches that need visualization
- Branch limit of 2 retries (branchIndex 0, 1, 2)

## Dev Agent Record

### Context Reference
- [Story Context XML](e2-s3-branch-visualization-ui.context.xml)

### Agent Model Used

<!-- To be filled by dev agent during implementation -->

### Debug Log References

<!-- To be filled by dev agent during implementation -->

### Completion Notes List

<!-- To be filled by dev agent during implementation -->

### File List

<!-- To be filled by dev agent during implementation -->

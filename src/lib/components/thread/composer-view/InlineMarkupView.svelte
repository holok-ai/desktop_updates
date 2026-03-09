<script lang="ts">
  /**
   * InlineMarkupView — renders a document with inline change markup.
   *
   * Shows the full document with insertions highlighted in green and
   * deletions shown with red strikethrough. Each change hunk has
   * hover-revealed accept/reject icon buttons.
   */
  import type { DiffChange } from '../../../../../src-shared/types/artifact.types';

  interface Props {
    /** Full document content (target version — the "after" state) */
    targetContent: string;
    /** Structured diff changes to overlay */
    changes: DiffChange[];
    /** Font size in pixels */
    fontSize?: number;
    /** Callback when a change resolution button is clicked */
    onResolveChange?: (changeIndex: number, resolution: 'accepted' | 'rejected') => void;
  }

  let { targetContent, changes, fontSize = 14, onResolveChange }: Props = $props();

  /**
   * Build a list of render segments from the target content and changes.
   *
   * Strategy: walk through the target content line by line. For each change,
   * we know where its lines appear relative to the target document via newStart/newLines
   * (for additions and modifications) and oldStart/oldLines (for deletions).
   *
   * We build a flat list of segments:
   *   - 'unchanged': lines not part of any change
   *   - 'change': a change block with its lines, type, and resolve state
   */
  interface UnchangedSegment {
    kind: 'unchanged';
    lines: string[];
  }

  interface ChangeSegment {
    kind: 'change';
    changeIndex: number;
    change: DiffChange;
  }

  type Segment = UnchangedSegment | ChangeSegment;

  let segments = $derived.by((): Segment[] => {
    if (changes.length === 0) {
      return [{ kind: 'unchanged', lines: targetContent.split('\n') }];
    }

    const targetLines = targetContent.split('\n');
    const result: Segment[] = [];

    // Build a map of target line indices that are covered by changes.
    // Changes have newStart (1-based) and newLines indicating what lines in the
    // target they correspond to. For deletions, they have oldLines but no newLines
    // (the deleted lines don't appear in the target).
    //
    // We insert changes at their newStart position. Deletions (which have no newLines)
    // are inserted at the point where they would have appeared.

    // Sort changes by their position in the target
    const sortedChanges = changes
      .map((c, i) => ({ change: c, index: i }))
      .sort((a, b) => {
        const posA = a.change.type === 'deletion' ? a.change.oldStart : a.change.newStart;
        const posB = b.change.type === 'deletion' ? b.change.oldStart : b.change.newStart;
        return posA - posB;
      });

    // Track which target lines are part of additions/modifications
    const coveredTargetLines = new Set<number>();
    for (const { change } of sortedChanges) {
      if (change.type === 'addition' || change.type === 'modification') {
        for (let i = 0; i < change.newLines.length; i++) {
          coveredTargetLines.add(change.newStart + i - 1); // Convert 1-based to 0-based
        }
      }
    }

    // Walk target lines, inserting change segments at the right positions
    let targetIdx = 0;
    let changePtr = 0;
    const unchangedBuffer: string[] = [];

    function flushUnchanged(): void {
      if (unchangedBuffer.length > 0) {
        result.push({ kind: 'unchanged', lines: [...unchangedBuffer] });
        unchangedBuffer.length = 0;
      }
    }

    while (targetIdx < targetLines.length || changePtr < sortedChanges.length) {
      // Check if there's a change to insert at the current position
      if (changePtr < sortedChanges.length) {
        const { change, index } = sortedChanges[changePtr];
        const changePos = change.type === 'deletion' ? change.oldStart - 1 : change.newStart - 1;

        if (changePos <= targetIdx) {
          flushUnchanged();
          result.push({ kind: 'change', changeIndex: index, change });
          changePtr++;

          // Skip target lines that are covered by this change (additions/modifications)
          if (change.type === 'addition' || change.type === 'modification') {
            const skip = change.newLines.length;
            targetIdx += skip;
          }
          continue;
        }
      }

      // Regular line — not covered by a change
      if (targetIdx < targetLines.length) {
        if (!coveredTargetLines.has(targetIdx)) {
          unchangedBuffer.push(targetLines[targetIdx]);
        }
        targetIdx++;
      } else {
        break;
      }
    }

    flushUnchanged();

    // Append remaining changes
    while (changePtr < sortedChanges.length) {
      const { change, index } = sortedChanges[changePtr];
      result.push({ kind: 'change', changeIndex: index, change });
      changePtr++;
    }

    return result;
  });
</script>

<div class="inline-markup-view" style="font-size: {fontSize}px">
  {#each segments as segment}
    {#if segment.kind === 'unchanged'}
      {#each segment.lines as line}
        <div class="line">{line || '\u00A0'}</div>
      {/each}
    {:else}
      {@const change = segment.change}
      {@const idx = segment.changeIndex}
      {@const resolved = change.resolved}
      <div
        class="change-block"
        class:resolved={resolved != null}
        class:resolved-accepted={resolved === 'accepted'}
        class:resolved-rejected={resolved === 'rejected'}
        class:type-addition={change.type === 'addition'}
        class:type-deletion={change.type === 'deletion'}
        class:type-modification={change.type === 'modification'}
      >
        <div class="change-gutter">
          {#if !resolved}
            <button
              class="resolve-btn accept-btn"
              title="Accept change"
              onclick={() => onResolveChange?.(idx, 'accepted')}
            >
              <i class="pi pi-check"></i>
            </button>
            <button
              class="resolve-btn reject-btn"
              title="Reject change"
              onclick={() => onResolveChange?.(idx, 'rejected')}
            >
              <i class="pi pi-times"></i>
            </button>
          {:else}
            <span
              class="resolve-indicator"
              title={resolved === 'accepted' ? 'Accepted' : 'Rejected'}
            >
              <i class="pi {resolved === 'accepted' ? 'pi-check-circle' : 'pi-times-circle'}"></i>
            </span>
          {/if}
        </div>
        <div class="change-content">
          {#if change.type === 'deletion' || change.type === 'modification'}
            {#each change.oldLines as line}
              <div class="change-deleted">{line || '\u00A0'}</div>
            {/each}
          {/if}
          {#if change.type === 'addition' || change.type === 'modification'}
            {#each change.newLines as line}
              <div class="change-added">{line || '\u00A0'}</div>
            {/each}
          {/if}
        </div>
      </div>
    {/if}
  {/each}
</div>

<style>
  .inline-markup-view {
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    line-height: 1.6;
    color: var(--text-primary, #111);
    padding: 0.75rem;
  }

  .line {
    padding: 0 0.5rem;
    min-height: 1.4em;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .change-block {
    display: flex;
    gap: 0;
    border-radius: 4px;
    margin: 2px 0;
    position: relative;
  }

  .change-block.type-addition {
    border-left: 3px solid rgb(34, 197, 94);
  }

  .change-block.type-deletion {
    border-left: 3px solid rgb(239, 68, 68);
  }

  .change-block.type-modification {
    border-left: 3px solid rgb(59, 130, 246);
  }

  .change-block.resolved {
    opacity: 0.5;
  }

  .change-block.resolved-accepted {
    border-left-color: rgb(34, 197, 94);
  }

  .change-block.resolved-rejected {
    border-left-color: rgb(239, 68, 68);
  }

  .change-gutter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 2px 4px;
    opacity: 0;
    transition: opacity 0.15s;
    min-width: 24px;
  }

  .change-block:hover .change-gutter {
    opacity: 1;
  }

  .resolve-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.65rem;
    transition: background 0.15s;
  }

  .accept-btn {
    background: color-mix(in srgb, rgb(34, 197, 94) 15%, transparent);
    color: rgb(22, 163, 74);
  }

  .accept-btn:hover {
    background: color-mix(in srgb, rgb(34, 197, 94) 30%, transparent);
  }

  .reject-btn {
    background: color-mix(in srgb, rgb(239, 68, 68) 15%, transparent);
    color: rgb(220, 38, 38);
  }

  .reject-btn:hover {
    background: color-mix(in srgb, rgb(239, 68, 68) 30%, transparent);
  }

  .resolve-indicator {
    font-size: 0.75rem;
    padding: 2px;
  }

  .resolve-indicator .pi-check-circle {
    color: rgb(22, 163, 74);
  }

  .resolve-indicator .pi-times-circle {
    color: rgb(220, 38, 38);
  }

  .change-content {
    flex: 1;
    min-width: 0;
  }

  .change-added {
    background: color-mix(in srgb, rgb(34, 197, 94) 15%, transparent);
    padding: 0 0.5rem;
    min-height: 1.4em;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .change-deleted {
    background: color-mix(in srgb, rgb(239, 68, 68) 12%, transparent);
    text-decoration: line-through;
    opacity: 0.7;
    padding: 0 0.5rem;
    min-height: 1.4em;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>

/* eslint-disable security/detect-object-injection */
/**
 * DiffService
 *
 * Computes, applies, and analyses unified diffs between Markdown documents.
 * Wraps the `diff` npm package with artifact-editing-specific logic.
 */

import { structuredPatch, applyPatch } from 'diff';
import log from '../utils/logger.js';
import type {
  DiffChange,
  DiffResult,
  ArtifactAttributionSource,
} from '../../src-shared/types/artifact.types.js';

export class DiffService {
  /**
   * Compute a unified diff between two Markdown strings.
   * Returns the raw unified diff string (GitHub format).
   */
  computeUnifiedDiff(
    oldContent: string,
    newContent: string,
    filename: string = 'document',
  ): string {
    const patch = structuredPatch(
      `a/${filename}`,
      `b/${filename}`,
      oldContent,
      newContent,
      '',
      '',
      { context: 3 },
    );

    // Build unified diff string
    const lines: string[] = [];
    lines.push(`--- a/${filename}`);
    lines.push(`+++ b/${filename}`);

    for (const hunk of patch.hunks) {
      lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
      for (const line of hunk.lines) {
        lines.push(line);
      }
    }

    return lines.join('\n');
  }

  /**
   * Apply a unified diff to base content and return the resulting string.
   * Throws if the patch cannot be applied cleanly.
   */
  applyUnifiedDiff(baseContent: string, patch: string): string {
    const result = applyPatch(baseContent, patch);
    if (result === false) {
      log.error('[DiffService] Failed to apply unified diff');
      throw new Error('[DiffService] Patch could not be applied cleanly');
    }
    return result;
  }

  /**
   * Compute structured DiffChange[] between two content strings for UI rendering.
   * Includes modification detection (paired add+delete promoted to edit).
   */
  computeChanges(
    oldContent: string,
    newContent: string,
    attribution: ArtifactAttributionSource,
    versionId: number,
  ): DiffChange[] {
    const patch = structuredPatch('a/document', 'b/document', oldContent, newContent, '', '', {
      context: 0,
    });

    const rawChanges: DiffChange[] = [];

    for (const hunk of patch.hunks) {
      let oldLineNum = hunk.oldStart;
      let newLineNum = hunk.newStart;

      // Collect contiguous deleted and added lines within this hunk
      let deletedLines: string[] = [];
      let deletedStart = oldLineNum;

      let addedLines: string[] = [];
      let addedStart = newLineNum;

      const flushPending = (): void => {
        if (deletedLines.length > 0) {
          rawChanges.push({
            type: 'deletion',
            oldLines: [...deletedLines],
            newLines: [],
            oldStart: deletedStart,
            newStart: addedStart,
            attribution,
            versionId,
          });
          deletedLines = [];
        }
        if (addedLines.length > 0) {
          rawChanges.push({
            type: 'addition',
            oldLines: [],
            newLines: [...addedLines],
            oldStart: deletedStart,
            newStart: addedStart,
            attribution,
            versionId,
          });
          addedLines = [];
        }
      };

      for (const line of hunk.lines) {
        const prefix = line[0];
        const content = line.substring(1);

        if (prefix === '-') {
          // If we had pending additions, flush first
          if (addedLines.length > 0 && deletedLines.length === 0) {
            flushPending();
          }
          if (deletedLines.length === 0) {
            deletedStart = oldLineNum;
          }
          deletedLines.push(content);
          oldLineNum++;
        } else if (prefix === '+') {
          if (addedLines.length === 0) {
            addedStart = newLineNum;
          }
          addedLines.push(content);
          newLineNum++;
        } else {
          // Context line — flush pending changes
          flushPending();
          oldLineNum++;
          newLineNum++;
          deletedStart = oldLineNum;
          addedStart = newLineNum;
        }
      }

      flushPending();
    }

    // Post-process: detect modifications (paired adjacent delete+add)
    return this.detectModifications(rawChanges);
  }

  /**
   * Compute a full DiffResult between two version contents.
   */
  computeDiffResult(
    baseContent: string,
    targetContent: string,
    baseVersionId: number,
    targetVersionId: number,
    attribution: ArtifactAttributionSource,
  ): DiffResult {
    const unifiedPatch = this.computeUnifiedDiff(baseContent, targetContent);
    const changes = this.computeChanges(baseContent, targetContent, attribution, targetVersionId);

    return {
      changes,
      baseVersionId,
      targetVersionId,
      unifiedPatch,
    };
  }

  /**
   * Apply accept/reject resolutions to produce new content.
   *
   * Starting from `baseContent`, apply accepted changes from `targetContent`
   * and keep base content for rejected changes.
   */
  applyAcceptReject(
    baseContent: string,
    targetContent: string,
    resolvedChanges: DiffChange[],
  ): string {
    // Build a map of which changes are accepted
    const acceptedChanges = resolvedChanges.filter((c) => c.resolved === 'accepted');
    const rejectedChanges = resolvedChanges.filter((c) => c.resolved === 'rejected');

    // If all are accepted, return target content
    if (rejectedChanges.length === 0 && acceptedChanges.length > 0) {
      return targetContent;
    }

    // If all are rejected, return base content
    if (acceptedChanges.length === 0 && rejectedChanges.length > 0) {
      return baseContent;
    }

    // Mixed: re-compute diff and selectively apply
    // For simplicity, start with base and apply only accepted hunks
    const patch = structuredPatch('a/doc', 'b/doc', baseContent, targetContent, '', '', {
      context: 0,
    });

    // Map each hunk to its accepted/rejected state based on matching changes
    let result = baseContent;
    const acceptedHunkIndices = new Set<number>();

    for (let i = 0; i < patch.hunks.length; i++) {
      const hunk = patch.hunks[i];
      // Check if any accepted change matches this hunk's location
      const matchesAccepted = acceptedChanges.some(
        (c) => c.oldStart >= hunk.oldStart && c.oldStart < hunk.oldStart + hunk.oldLines,
      );
      if (matchesAccepted) {
        acceptedHunkIndices.add(i);
      }
    }

    // Build a selective patch with only accepted hunks
    if (acceptedHunkIndices.size > 0) {
      const selectivePatch = {
        ...patch,
        hunks: patch.hunks.filter((_, i) => acceptedHunkIndices.has(i)),
      };

      // Convert back to unified diff string and apply
      const patchLines: string[] = [];
      patchLines.push(`--- a/doc`);
      patchLines.push(`+++ b/doc`);
      for (const hunk of selectivePatch.hunks) {
        patchLines.push(
          `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
        );
        for (const line of hunk.lines) {
          patchLines.push(line);
        }
      }

      const applied = applyPatch(baseContent, patchLines.join('\n'));
      if (applied !== false) {
        result = applied;
      } else {
        log.warn('[DiffService] Selective patch failed, falling back to target content');
        result = targetContent;
      }
    }

    return result;
  }

  // ── Private helpers ──

  /**
   * Detect modification pairs: adjacent deletion immediately followed by addition
   * where the content is sufficiently similar (>40% character overlap).
   */
  private detectModifications(changes: DiffChange[]): DiffChange[] {
    const result: DiffChange[] = [];
    let i = 0;

    while (i < changes.length) {
      const current = changes[i];
      const next = i + 1 < changes.length ? changes[i + 1] : null;

      // Check for deletion immediately followed by addition at the same location
      if (
        current.type === 'deletion' &&
        next?.type === 'addition' &&
        this.isSimilarEnough(current.oldLines.join('\n'), next.newLines.join('\n'))
      ) {
        // Promote to modification
        result.push({
          type: 'modification',
          oldLines: current.oldLines,
          newLines: next.newLines,
          oldStart: current.oldStart,
          newStart: next.newStart,
          attribution: current.attribution,
          versionId: current.versionId,
        });
        i += 2; // Skip both the deletion and addition
      } else {
        result.push(current);
        i++;
      }
    }

    return result;
  }

  /**
   * Check if two strings are similar enough to be considered a modification
   * rather than a separate delete+add. Uses character-level overlap ratio.
   */
  private isSimilarEnough(oldText: string, newText: string, threshold: number = 0.4): boolean {
    if (oldText.length === 0 || newText.length === 0) return false;

    const oldChars = new Set(oldText.split(''));
    const newChars = new Set(newText.split(''));

    let overlap = 0;
    for (const char of oldChars) {
      if (newChars.has(char)) overlap++;
    }

    const ratio = overlap / Math.max(oldChars.size, newChars.size);
    return ratio >= threshold;
  }
}

export const diffService = new DiffService();

/**
 * Unit tests for DiffService
 *
 * Tests: compute diff, apply diff, detect modifications, accept/reject.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DiffService } from '../../../src-electron/services/diff.service.js';

describe('DiffService', () => {
  let service: DiffService;

  beforeEach(() => {
    service = new DiffService();
  });

  // ── computeUnifiedDiff ──

  describe('computeUnifiedDiff', () => {
    it('returns empty diff header when contents are identical', () => {
      const content = 'Hello world\nLine two\n';
      const diff = service.computeUnifiedDiff(content, content);
      // Should have headers but no hunks
      expect(diff).toContain('--- a/document');
      expect(diff).toContain('+++ b/document');
      expect(diff).not.toContain('@@');
    });

    it('detects a single line addition', () => {
      const oldContent = 'Line 1\nLine 2\n';
      const newContent = 'Line 1\nLine 2\nLine 3\n';
      const diff = service.computeUnifiedDiff(oldContent, newContent);

      expect(diff).toContain('@@');
      expect(diff).toContain('+Line 3');
    });

    it('detects a single line deletion', () => {
      const oldContent = 'Line 1\nLine 2\nLine 3\n';
      const newContent = 'Line 1\nLine 3\n';
      const diff = service.computeUnifiedDiff(oldContent, newContent);

      expect(diff).toContain('@@');
      expect(diff).toContain('-Line 2');
    });

    it('detects a modification (delete + add at same location)', () => {
      const oldContent = 'Line 1\nOld text here\nLine 3\n';
      const newContent = 'Line 1\nNew text here\nLine 3\n';
      const diff = service.computeUnifiedDiff(oldContent, newContent);

      expect(diff).toContain('-Old text here');
      expect(diff).toContain('+New text here');
    });

    it('uses custom filename in diff header', () => {
      const diff = service.computeUnifiedDiff('a\n', 'b\n', 'readme.md');
      expect(diff).toContain('--- a/readme.md');
      expect(diff).toContain('+++ b/readme.md');
    });
  });

  // ── applyUnifiedDiff ──

  describe('applyUnifiedDiff', () => {
    it('applies a valid diff to produce the expected result', () => {
      const oldContent = 'Line 1\nLine 2\nLine 3\n';
      const newContent = 'Line 1\nModified line\nLine 3\n';
      const diff = service.computeUnifiedDiff(oldContent, newContent);

      const result = service.applyUnifiedDiff(oldContent, diff);
      expect(result).toBe(newContent);
    });

    it('round-trips through compute and apply for multi-hunk diffs', () => {
      const oldContent = 'A\nB\nC\nD\nE\nF\nG\nH\nI\nJ\n';
      const newContent = 'A\nB-modified\nC\nD\nE\nF-modified\nG\nH\nI\nJ-modified\n';
      const diff = service.computeUnifiedDiff(oldContent, newContent);
      const result = service.applyUnifiedDiff(oldContent, diff);
      expect(result).toBe(newContent);
    });

    it('throws when diff cannot be applied cleanly', () => {
      const wrongBase = 'Completely different content\n';
      const diff = service.computeUnifiedDiff('Original\n', 'Changed\n');

      expect(() => service.applyUnifiedDiff(wrongBase, diff)).toThrow(
        'Patch could not be applied cleanly',
      );
    });
  });

  // ── computeChanges + detectModifications ──

  describe('computeChanges', () => {
    it('returns empty array when contents are identical', () => {
      const changes = service.computeChanges('Same\n', 'Same\n', 'ai', 2);
      expect(changes).toHaveLength(0);
    });

    it('returns an addition change for new lines', () => {
      const changes = service.computeChanges('Line 1\n', 'Line 1\nLine 2\n', 'ai', 2);
      expect(changes.length).toBeGreaterThanOrEqual(1);

      const addition = changes.find((c) => c.type === 'addition');
      expect(addition).toBeDefined();
      expect(addition!.newLines).toContain('Line 2');
      expect(addition!.attribution).toBe('ai');
      expect(addition!.versionId).toBe(2);
    });

    it('returns a deletion change for removed lines', () => {
      const changes = service.computeChanges('Line 1\nLine 2\n', 'Line 1\n', 'user', 3);
      const deletion = changes.find((c) => c.type === 'deletion');
      expect(deletion).toBeDefined();
      expect(deletion!.oldLines).toContain('Line 2');
    });

    it('detects modifications when adjacent delete+add have >40% character overlap', () => {
      const oldContent = 'The quick brown fox jumps\n';
      const newContent = 'The quick brown fox leaps\n';
      const changes = service.computeChanges(oldContent, newContent, 'ai', 2);

      // Should detect this as a modification (similar lines)
      const modification = changes.find((c) => c.type === 'modification');
      expect(modification).toBeDefined();
      expect(modification!.oldLines[0]).toBe('The quick brown fox jumps');
      expect(modification!.newLines[0]).toBe('The quick brown fox leaps');
    });

    it('keeps separate add/delete when lines have low overlap', () => {
      const oldContent = 'AAAA\n';
      const newContent = 'ZZZZ\n';
      const changes = service.computeChanges(oldContent, newContent, 'ai', 2);

      // Very low character overlap — should NOT be merged into modification
      const modification = changes.find((c) => c.type === 'modification');
      expect(modification).toBeUndefined();
      expect(changes.length).toBe(2); // one deletion, one addition
    });
  });

  // ── computeDiffResult ──

  describe('computeDiffResult', () => {
    it('returns a complete DiffResult with changes and unified patch', () => {
      const oldContent = 'Hello\n';
      const newContent = 'Hello\nWorld\n';
      const result = service.computeDiffResult(oldContent, newContent, 1, 2, 'ai');

      expect(result.baseVersionId).toBe(1);
      expect(result.targetVersionId).toBe(2);
      expect(result.unifiedPatch).toContain('+World');
      expect(result.changes.length).toBeGreaterThan(0);
    });
  });

  // ── applyAcceptReject ──

  describe('applyAcceptReject', () => {
    it('returns target content when all changes are accepted', () => {
      const base = 'Line 1\nLine 2\n';
      const target = 'Line 1\nModified\n';
      const changes = service.computeChanges(base, target, 'ai', 2);
      changes.forEach((c) => (c.resolved = 'accepted'));

      const result = service.applyAcceptReject(base, target, changes);
      expect(result).toBe(target);
    });

    it('returns base content when all changes are rejected', () => {
      const base = 'Line 1\nLine 2\n';
      const target = 'Line 1\nModified\n';
      const changes = service.computeChanges(base, target, 'ai', 2);
      changes.forEach((c) => (c.resolved = 'rejected'));

      const result = service.applyAcceptReject(base, target, changes);
      expect(result).toBe(base);
    });
  });
});

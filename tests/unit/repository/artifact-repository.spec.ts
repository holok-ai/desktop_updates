/**
 * Unit tests for ArtifactRepository
 *
 * Tests: create artifact, add versions, discard, persistence round-trip,
 *        getVersion, deleteArtifact, edge cases.
 *
 * Uses a real temp directory for filesystem persistence tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// ── Mock dependencies ──────────────────────────────────────────────

const ctx = vi.hoisted(() => ({ testDir: '' }));

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => ctx.testDir),
  },
}));

// ── Import after mocks ─────────────────────────────────────────────

import { ArtifactRepository } from '../../../src-electron/repository/artifact-repository.js';

describe('ArtifactRepository', () => {
  let repo: ArtifactRepository;

  beforeEach(() => {
    // Create a fresh temp directory for each test
    ctx.testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-repo-test-'));
    repo = new ArtifactRepository();
  });

  afterEach(() => {
    // Clean up temp directory
    try {
      fs.rmSync(ctx.testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ── createArtifact ──

  describe('createArtifact', () => {
    it('creates an artifact with version 1', async () => {
      const artifact = await repo.createArtifact(
        'thread-1',
        'test.md',
        'text/markdown',
        '# Hello World\n',
        'Initial document',
      );

      expect(artifact.threadId).toBe('thread-1');
      expect(artifact.filename).toBe('test.md');
      expect(artifact.originalMimeType).toBe('text/markdown');
      expect(artifact.versions).toHaveLength(1);
      expect(artifact.versions[0].id).toBe(1);
      expect(artifact.versions[0].content).toBe('# Hello World\n');
      expect(artifact.versions[0].attribution).toBe('user');
      expect(artifact.versions[0].changeSummary).toBe('Initial document');
      expect(artifact.id).toBeTruthy();
      expect(artifact.createdAt).toBeGreaterThan(0);
    });

    it('replaces existing artifact for the same thread', async () => {
      await repo.createArtifact('thread-1', 'first.md', 'text/markdown', 'First');
      const second = await repo.createArtifact('thread-1', 'second.md', 'text/markdown', 'Second');

      expect(second.filename).toBe('second.md');
      expect(second.versions[0].content).toBe('Second');

      // Only one artifact per thread
      const fetched = await repo.getArtifact('thread-1');
      expect(fetched!.filename).toBe('second.md');
    });
  });

  // ── getArtifact ──

  describe('getArtifact', () => {
    it('returns null for non-existent thread', async () => {
      const result = await repo.getArtifact('non-existent');
      expect(result).toBeNull();
    });

    it('returns cached artifact after creation', async () => {
      await repo.createArtifact('thread-1', 'test.md', 'text/markdown', 'Hello');
      const artifact = await repo.getArtifact('thread-1');

      expect(artifact).not.toBeNull();
      expect(artifact!.threadId).toBe('thread-1');
    });

    it('returns a deep clone (mutations do not affect cache)', async () => {
      await repo.createArtifact('thread-1', 'test.md', 'text/markdown', 'Hello');

      const a1 = await repo.getArtifact('thread-1');
      const a2 = await repo.getArtifact('thread-1');

      // Mutate one — should not affect the other
      a1!.versions[0].content = 'MUTATED';
      expect(a2!.versions[0].content).toBe('Hello');
    });
  });

  // ── addVersion ──

  describe('addVersion', () => {
    it('adds version 2 with correct sequential ID', async () => {
      await repo.createArtifact('thread-1', 'test.md', 'text/markdown', 'Version 1');
      const v2 = await repo.addVersion(
        'thread-1',
        'Version 2 content',
        'ai',
        'attachment_edit',
        'AI made changes',
        '--- a/doc\n+++ b/doc\n@@ -1 +1 @@\n-Version 1\n+Version 2 content',
      );

      expect(v2.id).toBe(2);
      expect(v2.content).toBe('Version 2 content');
      expect(v2.attribution).toBe('ai');
      expect(v2.sourceAction).toBe('attachment_edit');
      expect(v2.changeSummary).toBe('AI made changes');
      expect(v2.diffFromPrevious).toBeDefined();
    });

    it('adds multiple versions sequentially', async () => {
      await repo.createArtifact('thread-1', 'test.md', 'text/markdown', 'V1');
      await repo.addVersion('thread-1', 'V2', 'ai', 'attachment_edit', 'Change 1');
      const v3 = await repo.addVersion('thread-1', 'V3', 'user', 'user_edit_autosave', 'Change 2');

      expect(v3.id).toBe(3);

      const artifact = await repo.getArtifact('thread-1');
      expect(artifact!.versions).toHaveLength(3);
    });

    it('throws for non-existent thread', async () => {
      await expect(
        repo.addVersion('bogus', 'content', 'user', 'user_edit_autosave', 'test'),
      ).rejects.toThrow('No artifact found');
    });
  });

  // ── discardLatestVersion ──

  describe('discardLatestVersion', () => {
    it('removes the latest version and returns artifact at N-1', async () => {
      await repo.createArtifact('thread-1', 'test.md', 'text/markdown', 'V1');
      await repo.addVersion('thread-1', 'V2', 'ai', 'attachment_edit', 'AI change');
      await repo.addVersion('thread-1', 'V3', 'ai', 'attachment_edit', 'More AI changes');

      const updated = await repo.discardLatestVersion('thread-1');
      expect(updated.versions).toHaveLength(2);
      expect(updated.versions[updated.versions.length - 1].id).toBe(2);
    });

    it('throws when trying to discard version 1', async () => {
      await repo.createArtifact('thread-1', 'test.md', 'text/markdown', 'V1');

      await expect(repo.discardLatestVersion('thread-1')).rejects.toThrow(
        'Cannot discard version 1',
      );
    });

    it('logs a discard event for auditability', async () => {
      await repo.createArtifact('thread-1', 'test.md', 'text/markdown', 'V1');
      await repo.addVersion('thread-1', 'V2', 'ai', 'attachment_edit', 'AI change');

      await repo.discardLatestVersion('thread-1');
      const log = repo.getDiscardLog('thread-1');

      expect(log).toHaveLength(1);
      expect(log[0].removedVersionId).toBe(2);
      expect(log[0].resultingVersionId).toBe(1);
    });

    it('allows new version after discard with reused ID', async () => {
      await repo.createArtifact('thread-1', 'test.md', 'text/markdown', 'V1');
      await repo.addVersion('thread-1', 'V2', 'ai', 'attachment_edit', 'AI change');

      await repo.discardLatestVersion('thread-1');
      const newV2 = await repo.addVersion(
        'thread-1',
        'New V2',
        'user',
        'user_edit_autosave',
        'User edit after discard',
      );

      expect(newV2.id).toBe(2);
      expect(newV2.content).toBe('New V2');
    });
  });

  // ── getVersion ──

  describe('getVersion', () => {
    it('returns a specific version by ID', async () => {
      await repo.createArtifact('thread-1', 'test.md', 'text/markdown', 'V1');
      await repo.addVersion('thread-1', 'V2', 'ai', 'attachment_edit', 'Change');

      const v1 = repo.getVersion('thread-1', 1);
      expect(v1).not.toBeNull();
      expect(v1!.content).toBe('V1');

      const v2 = repo.getVersion('thread-1', 2);
      expect(v2).not.toBeNull();
      expect(v2!.content).toBe('V2');
    });

    it('returns null for non-existent version', async () => {
      await repo.createArtifact('thread-1', 'test.md', 'text/markdown', 'V1');

      expect(repo.getVersion('thread-1', 99)).toBeNull();
      expect(repo.getVersion('bogus-thread', 1)).toBeNull();
    });
  });

  // ── getArtifactFromCache (sync) ──

  describe('getArtifactFromCache', () => {
    it('returns cached artifact synchronously', async () => {
      await repo.createArtifact('thread-1', 'test.md', 'text/markdown', 'Content');

      const cached = repo.getArtifactFromCache('thread-1');
      expect(cached).not.toBeNull();
      expect(cached!.threadId).toBe('thread-1');
    });

    it('returns null when no artifact is in cache', () => {
      expect(repo.getArtifactFromCache('missing')).toBeNull();
    });
  });

  // ── deleteArtifact ──

  describe('deleteArtifact', () => {
    it('removes artifact from cache and disk', async () => {
      await repo.createArtifact('thread-1', 'test.md', 'text/markdown', 'Content');

      // Verify it exists
      expect(await repo.getArtifact('thread-1')).not.toBeNull();

      await repo.deleteArtifact('thread-1');

      // Should be gone from cache
      expect(repo.getArtifactFromCache('thread-1')).toBeNull();
    });
  });

  // ── Persistence round-trip ──

  describe('persistence', () => {
    it('persists artifact to JSON and a new instance can load it', async () => {
      await repo.createArtifact('thread-1', 'test.md', 'text/markdown', '# Test\n');
      await repo.addVersion(
        'thread-1',
        '# Test\n\nEdited content\n',
        'ai',
        'attachment_edit',
        'AI edit',
      );

      // Create a fresh repository instance (same testDir via mock)
      const repo2 = new ArtifactRepository();
      const loaded = await repo2.getArtifact('thread-1');

      expect(loaded).not.toBeNull();
      expect(loaded!.threadId).toBe('thread-1');
      expect(loaded!.filename).toBe('test.md');
      expect(loaded!.versions).toHaveLength(2);
      expect(loaded!.versions[0].content).toBe('# Test\n');
      expect(loaded!.versions[1].content).toBe('# Test\n\nEdited content\n');
      expect(loaded!.versions[1].attribution).toBe('ai');
    });
  });
});

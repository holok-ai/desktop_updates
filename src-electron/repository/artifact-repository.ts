/* eslint-disable security/detect-non-literal-fs-filename */
/**
 * ArtifactRepository
 *
 * Local persistence for artifact / version data.
 * Stored as JSON files at: <userData>/holokai/desktop/artifacts/<threadId>/<artifactId>.json
 * In-memory cache keyed by threadId (one artifact per thread).
 */

import { app, safeStorage } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import log from '../utils/logger.js';
import type {
  Artifact,
  ArtifactVersion,
  DiscardEvent,
} from '../../src-shared/types/artifact.types.js';

// ── Encryption helpers (mirrors ProjectCacheEncryption pattern) ──
function artifactEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

function artifactEncrypt(data: string): Buffer {
  if (!artifactEncryptionAvailable()) {
    log.warn('[ArtifactEncryption] Encryption not available, storing unencrypted');
    return Buffer.from(data, 'utf-8');
  }
  return safeStorage.encryptString(data);
}

function artifactDecrypt(buffer: Buffer): string {
  if (!artifactEncryptionAvailable()) {
    log.warn('[ArtifactEncryption] Encryption not available, reading unencrypted');
    return buffer.toString('utf-8');
  }
  return safeStorage.decryptString(buffer);
}

export class ArtifactRepository {
  private readonly baseStoragePath: string;
  private readonly cache: Map<string, Artifact> = new Map();
  private readonly discardLog: Map<string, DiscardEvent[]> = new Map();

  constructor() {
    const userDataPath = app.getPath('userData');
    this.baseStoragePath = path.join(userDataPath, 'holokai', 'desktop', 'artifacts');
    try {
      this.ensureDirectory(this.baseStoragePath);
    } catch (error) {
      // Non-fatal: directory will be created on first write
      log.warn('[ArtifactRepository] Could not create storage directory on init', { error });
    }
    log.info('[ArtifactRepository] Initialized', { storagePath: this.baseStoragePath });
  }

  /**
   * Create a new artifact with version 1.
   */
  async createArtifact(
    threadId: string,
    filename: string,
    mimeType: string,
    initialContent: string,
    changeSummary: string = 'Initial document',
  ): Promise<Artifact> {
    // Only one artifact per thread
    const existing = this.cache.get(threadId);
    if (existing) {
      log.warn('[ArtifactRepository] Artifact already exists for thread, replacing', { threadId });
      await this.deleteArtifact(threadId);
    }

    const now = Date.now();
    const artifact: Artifact = {
      id: randomUUID(),
      threadId,
      filename,
      originalMimeType: mimeType,
      versions: [
        {
          id: 1,
          content: initialContent,
          attribution: 'user',
          sourceAction: 'user_edit_autosave',
          changeSummary,
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.cache.set(threadId, artifact);
    await this.persistArtifact(artifact);

    log.info('[ArtifactRepository] Artifact created', {
      artifactId: artifact.id,
      threadId,
      filename,
    });

    return this.cloneArtifact(artifact);
  }

  /**
   * Get the artifact for a thread (one per thread).
   */
  async getArtifact(threadId: string): Promise<Artifact | null> {
    // Check cache first
    const cached = this.cache.get(threadId);
    if (cached) {
      return this.cloneArtifact(cached);
    }

    // Try loading from disk
    const artifact = await this.loadFromDisk(threadId);
    if (artifact) {
      this.cache.set(threadId, artifact);
      return this.cloneArtifact(artifact);
    }

    return null;
  }

  /**
   * Add a new version to an existing artifact.
   */
  async addVersion(
    threadId: string,
    params: {
      content: string;
      attribution: ArtifactVersion['attribution'];
      sourceAction: ArtifactVersion['sourceAction'];
      changeSummary: string;
      title?: string;
    },
  ): Promise<ArtifactVersion | null> {
    const artifact = this.cache.get(threadId);
    if (!artifact) {
      throw new Error(`[ArtifactRepository] No artifact found for thread: ${threadId}`);
    }

    const { content, attribution, sourceAction, changeSummary, title } = params;
    const latestVersion = artifact.versions[artifact.versions.length - 1];

    // Skip if content is identical to the current version
    if (latestVersion.content === content) {
      log.info('[ArtifactRepository] Skipping duplicate version', {
        threadId,
        currentVersionId: latestVersion.id,
        attribution,
        sourceAction,
      });
      return null;
    }

    if (title) {
      artifact.filename = title;
    }

    const newVersion: ArtifactVersion = {
      id: latestVersion.id + 1,
      content,
      attribution,
      sourceAction,
      changeSummary,
      createdAt: Date.now(),
    };

    artifact.versions.push(newVersion);
    artifact.updatedAt = Date.now();
    await this.persistArtifact(artifact);

    log.info('[ArtifactRepository] Version added', {
      threadId,
      versionId: newVersion.id,
      attribution,
      sourceAction,
    });

    return { ...newVersion };
  }

  /**
   * Discard the most recent version. Returns the updated artifact.
   * Version 1 cannot be discarded.
   */
  async discardLatestVersion(threadId: string): Promise<Artifact> {
    const artifact = this.cache.get(threadId);
    if (!artifact) {
      throw new Error(`[ArtifactRepository] No artifact found for thread: ${threadId}`);
    }

    if (artifact.versions.length <= 1) {
      throw new Error('[ArtifactRepository] Cannot discard version 1');
    }

    const removed = artifact.versions.pop();
    if (!removed) {
      throw new Error('[ArtifactRepository] Unexpected empty versions array');
    }
    artifact.updatedAt = Date.now();
    await this.persistArtifact(artifact);

    // Log discard event for auditability
    const discardEvent: DiscardEvent = {
      removedVersionId: removed.id,
      resultingVersionId: artifact.versions[artifact.versions.length - 1].id,
      timestamp: Date.now(),
    };

    const events = this.discardLog.get(threadId) || [];
    events.push(discardEvent);
    this.discardLog.set(threadId, events);

    log.info('[ArtifactRepository] Version discarded', {
      threadId,
      removedVersionId: removed.id,
      currentVersionId: discardEvent.resultingVersionId,
    });

    return this.cloneArtifact(artifact);
  }

  /**
   * Get the artifact from cache only (synchronous).
   * Returns null if the artifact is not loaded in memory.
   */
  getArtifactFromCache(threadId: string): Artifact | null {
    const cached = this.cache.get(threadId);
    return cached ? this.cloneArtifact(cached) : null;
  }

  /**
   * Get version by ID.
   */
  getVersion(threadId: string, versionId: number): ArtifactVersion | null {
    const artifact = this.cache.get(threadId);
    if (!artifact) return null;

    const version = artifact.versions.find((v) => v.id === versionId);
    return version ? { ...version } : null;
  }

  /**
   * Delete an artifact entirely (full cleanup).
   */
  /* eslint-disable @typescript-eslint/require-await */
  async deleteArtifact(threadId: string): Promise<void> {
    this.cache.delete(threadId);
    this.discardLog.delete(threadId);

    const threadDir = path.join(this.baseStoragePath, threadId);
    try {
      if (fs.existsSync(threadDir)) {
        fs.rmSync(threadDir, { recursive: true });
      }
    } catch (error) {
      log.error('[ArtifactRepository] Failed to delete artifact directory', { threadId, error });
    }

    log.info('[ArtifactRepository] Artifact deleted', { threadId });
  }

  /**
   * Get discard audit log for a thread.
   */
  getDiscardLog(threadId: string): DiscardEvent[] {
    return [...(this.discardLog.get(threadId) || [])];
  }

  // ── Private helpers ──

  private async persistArtifact(artifact: Artifact): Promise<void> {
    const threadDir = path.join(this.baseStoragePath, artifact.threadId);
    this.ensureDirectory(threadDir);

    const filePath = path.join(threadDir, `${artifact.id}.json`);
    try {
      const json = JSON.stringify(artifact, null, 2);
      const data = artifactEncrypt(json);
      await fs.promises.writeFile(filePath, data);
    } catch (error) {
      log.error('[ArtifactRepository] Failed to persist artifact', {
        artifactId: artifact.id,
        threadId: artifact.threadId,
        error,
      });
      throw error;
    }
  }

  private async loadFromDisk(threadId: string): Promise<Artifact | null> {
    const threadDir = path.join(this.baseStoragePath, threadId);
    if (!fs.existsSync(threadDir)) return null;

    try {
      const files = fs.readdirSync(threadDir).filter((f) => f.endsWith('.json'));
      if (files.length === 0) return null;

      // One artifact per thread — take the first (and only) JSON file
      const filePath = path.join(threadDir, files[0]);
      const rawBuffer = await fs.promises.readFile(filePath);

      // Try decrypting first; fall back to plain-text for pre-encryption files
      let json: string;
      try {
        json = artifactDecrypt(rawBuffer);
      } catch {
        json = rawBuffer.toString('utf-8');
        log.info(
          '[ArtifactRepository] Loaded legacy unencrypted artifact, will re-encrypt on next save',
          { threadId },
        );
      }

      const artifact = JSON.parse(json) as Artifact;

      log.info('[ArtifactRepository] Loaded artifact from disk', {
        threadId,
        artifactId: artifact.id,
        versionCount: artifact.versions.length,
      });

      return artifact;
    } catch (error) {
      log.error('[ArtifactRepository] Failed to load artifact from disk', { threadId, error });
      return null;
    }
  }

  private cloneArtifact(artifact: Artifact): Artifact {
    return {
      ...artifact,
      versions: artifact.versions.map((v) => ({ ...v })),
    };
  }

  private ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}

export const artifactRepository = new ArtifactRepository();

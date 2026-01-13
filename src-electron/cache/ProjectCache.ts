/**
 * Project Cache
 * Hybrid in-memory + encrypted disk cache for project data
 *
 * Features:
 * - In-memory Map for fast access (LRU eviction at 100 projects)
 * - Encrypted disk persistence using safeStorage
 * - Individual JSON files per project for atomic operations
 * - Hit/miss rate logging for performance monitoring
 */

import { safeStorage, app } from 'electron';
import log from 'electron-log';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ProjectDetailDTO } from '../services/mokuapi/project.types.js';
import type { Project } from '../types/project.types.js';

/**
 * LRU Node for tracking access order
 */
interface LRUNode {
  id: string;
  prev: LRUNode | null;
  next: LRUNode | null;
}

/**
 * Cache metrics for monitoring
 */
interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
}

/**
 * Encryption helper using Electron's safeStorage
 * Uses static methods pattern to avoid instantiation
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class ProjectCacheEncryption {
  /**
   * Check if encryption is available on this system
   */
  public static isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  /**
   * Encrypt a string using safeStorage
   * Pattern from auth.service.ts:438-450
   */
  public static encrypt(data: string): Buffer {
    if (!this.isAvailable()) {
      log.warn('[ProjectCacheEncryption] Encryption not available, storing unencrypted (INSECURE)');
      return Buffer.from(data, 'utf-8');
    }
    return safeStorage.encryptString(data);
  }

  /**
   * Decrypt a buffer using safeStorage
   * Pattern from auth.service.ts:88-96
   */
  public static decrypt(buffer: Buffer): string {
    if (!this.isAvailable()) {
      log.warn('[ProjectCacheEncryption] Encryption not available, reading unencrypted');
      return buffer.toString('utf-8');
    }
    return safeStorage.decryptString(buffer);
  }
}

/**
 * Project Cache Service
 * Provides fast in-memory access with encrypted disk persistence
 */
export class ProjectCache {
  private readonly memoryCache: Map<string, Project> = new Map();
  private readonly lruHead: LRUNode = { id: 'head', prev: null, next: null };
  private readonly lruTail: LRUNode = { id: 'tail', prev: null, next: null };
  private readonly lruNodes: Map<string, LRUNode> = new Map();
  private readonly metrics: CacheMetrics = { hits: 0, misses: 0, evictions: 0 };
  private readonly MAX_MEMORY_SIZE = 100;
  private cacheDir: string = '';

  constructor() {
    // Initialize LRU doubly-linked list
    this.lruHead.next = this.lruTail;
    this.lruTail.prev = this.lruHead;
  }

  /**
   * Initialize cache directory
   * Must be called after Electron app is ready
   */
  public async initialize(): Promise<void> {
    try {
      const userDataPath = app.getPath('userData');
      this.cacheDir = path.join(userDataPath, '.holokai', 'cache', 'encrypted', 'projects');

      // Create directory if it doesn't exist
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      await fs.mkdir(this.cacheDir, { recursive: true });

      log.info('[ProjectCache] Initialized at:', this.cacheDir);
      log.info('[ProjectCache] Encryption available:', ProjectCacheEncryption.isAvailable());
    } catch (error) {
      log.error('[ProjectCache] Failed to initialize cache directory:', error);
      throw error;
    }
  }

  /**
   * Get a project from cache
   * Flow: memory → disk → null
   */
  public async get(id: string): Promise<Project | null> {
    // Check memory first
    const memoryHit = this.memoryCache.get(id);
    if (memoryHit) {
      this.metrics.hits++;
      this.updateLRU(id);
      log.debug(`[ProjectCache] Memory hit for project: ${id} (hits: ${this.metrics.hits})`);
      return memoryHit;
    }

    // Check disk
    try {
      const filePath = this.getProjectFilePath(id);
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const encryptedData = await fs.readFile(filePath);
      const decrypted = ProjectCacheEncryption.decrypt(encryptedData);
      const project = JSON.parse(decrypted) as Project;

      // Load into memory cache
      this.memoryCache.set(id, project);
      this.addToLRU(id);
      this.enforceMemoryLimit();

      this.metrics.hits++;
      log.debug(`[ProjectCache] Disk hit for project: ${id} (hits: ${this.metrics.hits})`);
      return project;
    } catch (_error) {
      // File doesn't exist or read error
      this.metrics.misses++;
      log.debug(`[ProjectCache] Miss for project: ${id} (misses: ${this.metrics.misses})`);
      return null;
    }
  }

  /**
   * Set a project in cache (memory + disk)
   * Maps API DTO 'name' field to entity 'name'
   */
  public async set(id: string, projectDTO: ProjectDetailDTO): Promise<void> {
    try {
      // Map DTO to Project entity
      const project: Project = {
        id: projectDTO.id,
        title: projectDTO.name,
        description: projectDTO.description,
        type: projectDTO.type as Project['type'],
        createdBy: projectDTO.createdBy,
        organizationId: projectDTO.organizationId,
        active: projectDTO.active,
        status: projectDTO.status as Project['status'],
        metadata: projectDTO.metadata as Project['metadata'],
        memberCount: projectDTO.memberCount,
        createdAt: projectDTO.createdAt,
        updatedAt: projectDTO.updatedAt,
        userRole: projectDTO.userRole as Project['userRole'],
      };

      // Store in memory
      this.memoryCache.set(id, project);
      this.addToLRU(id);
      this.enforceMemoryLimit();

      // Persist to disk (encrypted)
      const json = JSON.stringify(project, null, 2);
      const encrypted = ProjectCacheEncryption.encrypt(json);
      const filePath = this.getProjectFilePath(id);

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      await fs.writeFile(filePath, encrypted);

      log.debug(`[ProjectCache] Set project: ${id} (${project.title})`);
    } catch (error) {
      log.error(`[ProjectCache] Failed to set project ${id}:`, error);
      throw error;
    }
  }

  /**
   * Invalidate a project (remove from memory and disk)
   */
  public async invalidateProject(id: string): Promise<void> {
    try {
      // Remove from memory
      this.memoryCache.delete(id);
      this.removeFromLRU(id);

      // Delete file from disk
      const filePath = this.getProjectFilePath(id);
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await fs.unlink(filePath);
        log.debug(`[ProjectCache] Invalidated project: ${id}`);
      } catch (error) {
        // File might not exist, that's okay
        if ((error as { code?: string }).code !== 'ENOENT') {
          throw error;
        }
      }
    } catch (error) {
      log.error(`[ProjectCache] Failed to invalidate project ${id}:`, error);
      throw error;
    }
  }

  /**
   * Clear entire cache (memory + disk)
   * Called on user logout
   */
  public async clearAll(): Promise<void> {
    try {
      log.info('[ProjectCache] Clearing all cache data');

      // Clear memory
      this.memoryCache.clear();
      this.lruNodes.clear();
      this.lruHead.next = this.lruTail;
      this.lruTail.prev = this.lruHead;

      // Reset metrics
      this.metrics.hits = 0;
      this.metrics.misses = 0;
      this.metrics.evictions = 0;

      // Delete cache directory recursively
      try {
        await fs.rm(this.cacheDir, { recursive: true, force: true });
        // Recreate the directory
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await fs.mkdir(this.cacheDir, { recursive: true });
        log.info('[ProjectCache] Cache cleared successfully');
      } catch (error) {
        log.error('[ProjectCache] Failed to clear cache directory:', error);
        throw error;
      }
    } catch (error) {
      log.error('[ProjectCache] Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * Get cache metrics for monitoring
   */
  public getMetrics(): CacheMetrics {
    const hitRate =
      this.metrics.hits + this.metrics.misses > 0
        ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100
        : 0;

    log.debug(
      `[ProjectCache] Metrics - Hits: ${this.metrics.hits}, Misses: ${this.metrics.misses}, Hit Rate: ${hitRate.toFixed(2)}%, Evictions: ${this.metrics.evictions}`,
    );

    return { ...this.metrics };
  }

  // ============================================================================
  // Private: LRU Management
  // ============================================================================

  /**
   * Add node to LRU (most recently used)
   */
  private addToLRU(id: string): void {
    if (this.lruNodes.has(id)) {
      this.removeFromLRU(id);
    }

    const node: LRUNode = { id, prev: null, next: null };
    this.lruNodes.set(id, node);

    // Insert at head (most recently used)
    node.next = this.lruHead.next;
    node.prev = this.lruHead;
    if (this.lruHead.next) {
      this.lruHead.next.prev = node;
    }
    this.lruHead.next = node;
  }

  /**
   * Move node to head of LRU (mark as recently used)
   */
  private updateLRU(id: string): void {
    if (!this.lruNodes.has(id)) return;
    this.removeFromLRU(id);
    this.addToLRU(id);
  }

  /**
   * Remove node from LRU
   */
  private removeFromLRU(id: string): void {
    const node = this.lruNodes.get(id);
    if (!node) return;

    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;

    this.lruNodes.delete(id);
  }

  /**
   * Enforce memory limit with LRU eviction
   */
  private enforceMemoryLimit(): void {
    while (this.memoryCache.size > this.MAX_MEMORY_SIZE) {
      // Evict least recently used (tail)
      const lru = this.lruTail.prev;
      if (!lru || lru === this.lruHead) break;

      this.memoryCache.delete(lru.id);
      this.removeFromLRU(lru.id);
      this.metrics.evictions++;

      log.debug(
        `[ProjectCache] Evicted project: ${lru.id} (total evictions: ${this.metrics.evictions})`,
      );
    }
  }

  // ============================================================================
  // Private: File System Helpers
  // ============================================================================

  /**
   * Get file path for a project
   */
  private getProjectFilePath(id: string): string {
    // Sanitize ID to prevent path traversal
    const sanitizedId = id.replace(/[^a-zA-Z0-9-]/g, '_');
    return path.join(this.cacheDir, `${sanitizedId}.json`);
  }
}

// Singleton instance
export const projectCache = new ProjectCache();

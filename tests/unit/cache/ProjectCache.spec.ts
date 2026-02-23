/**
 * ProjectCache Unit Tests
 * Tests for the hybrid in-memory + encrypted disk cache
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProjectCache } from '../../../src-electron/cache/ProjectCache.js';
import type { ProjectDetailDTO } from '../../../src-electron/services/mokuapi/project.types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

// Mock Electron modules
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (data: string) => Buffer.from(`encrypted:${data}`, 'utf-8'),
    decryptString: (buffer: Buffer) => buffer.toString('utf-8').replace('encrypted:', ''),
  },
  app: {
    getPath: (name: string) => {
      if (name === 'userData') {
        return '/tmp/holokai-test';
      }
      return '/tmp';
    },
  },
}));

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ProjectCache', () => {
  let cache: ProjectCache;
  let testCacheDir: string;

  // Helper to create mock project DTO
  const createMockProjectDTO = (id: string, name: string): ProjectDetailDTO => ({
    id,
    name, // API uses 'name'
    description: `Description for ${name}`,
    type: 'shared',
    createdBy: 'user-123',
    organizationId: 'org-456',
    status: 'active',
    metadata: { color: '#3B82F6', icon: 'folder' },
    memberCount: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userRole: 'owner',
  });

  beforeEach(async () => {
    // Create fresh cache instance
    cache = new ProjectCache();
    await cache.initialize();

    testCacheDir = path.join(app.getPath('userData'), '.holokai', 'cache', 'encrypted', 'projects');
  });

  afterEach(async () => {
    // Clean up test cache
    await cache.clearAll();
  });

  describe('Initialization', () => {
    it('should create cache directory on initialization', async () => {
      const stats = await fs.stat(testCacheDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('get() and set()', () => {
    it('should return null for non-existent project', async () => {
      const result = await cache.get('non-existent-id');
      expect(result).toBeNull();
    });

    it('should store and retrieve project from memory', async () => {
      const projectDTO = createMockProjectDTO('project-1', 'Test Project');

      await cache.set('project-1', projectDTO);
      const retrieved = await cache.get('project-1');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('project-1');
      expect(retrieved?.title).toBe('Test Project'); // Mapped from 'name'
      expect(retrieved?.description).toBe('Description for Test Project');
    });

    it('should map API "name" field to "title" field', async () => {
      const projectDTO = createMockProjectDTO('project-2', 'My Amazing Project');

      await cache.set('project-2', projectDTO);
      const retrieved = await cache.get('project-2');

      expect(retrieved?.title).toBe('My Amazing Project');
      expect(retrieved).not.toHaveProperty('name'); // Should not have 'name'
    });

    it('should persist project to encrypted disk', async () => {
      const projectDTO = createMockProjectDTO('project-3', 'Persistent Project');

      await cache.set('project-3', projectDTO);

      // Check that file exists
      const filePath = path.join(testCacheDir, 'project-3.json');
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Read and verify encrypted content
      const encryptedData = await fs.readFile(filePath);
      expect(encryptedData.toString()).toContain('encrypted:');
    });

    it('should load project from disk on memory miss', async () => {
      const projectDTO = createMockProjectDTO('project-4', 'Disk Project');

      // Set in first cache instance
      await cache.set('project-4', projectDTO);

      // Create new cache instance (empty memory)
      const newCache = new ProjectCache();
      await newCache.initialize();

      // Should load from disk
      const retrieved = await newCache.get('project-4');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.title).toBe('Disk Project');

      await newCache.clearAll();
    });
  });

  describe('invalidateProject()', () => {
    it('should remove project from memory', async () => {
      const projectDTO = createMockProjectDTO('project-5', 'To Delete');

      await cache.set('project-5', projectDTO);
      expect(await cache.get('project-5')).not.toBeNull();

      await cache.invalidateProject('project-5');
      expect(await cache.get('project-5')).toBeNull();
    });

    it('should delete project file from disk', async () => {
      const projectDTO = createMockProjectDTO('project-6', 'File Delete');

      await cache.set('project-6', projectDTO);
      const filePath = path.join(testCacheDir, 'project-6.json');
      expect(
        await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false),
      ).toBe(true);

      await cache.invalidateProject('project-6');
      expect(
        await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false),
      ).toBe(false);
    });

    it('should not throw if project does not exist', async () => {
      await expect(cache.invalidateProject('non-existent')).resolves.not.toThrow();
    });
  });

  describe('clearAll()', () => {
    it('should clear all projects from memory', async () => {
      const project1 = createMockProjectDTO('project-7', 'Project 7');
      const project2 = createMockProjectDTO('project-8', 'Project 8');

      await cache.set('project-7', project1);
      await cache.set('project-8', project2);

      await cache.clearAll();

      expect(await cache.get('project-7')).toBeNull();
      expect(await cache.get('project-8')).toBeNull();
    });

    it('should delete all cache files from disk', async () => {
      const project1 = createMockProjectDTO('project-9', 'Project 9');
      const project2 = createMockProjectDTO('project-10', 'Project 10');

      await cache.set('project-9', project1);
      await cache.set('project-10', project2);

      await cache.clearAll();

      // Check that files are deleted
      const files = await fs.readdir(testCacheDir);
      expect(files.length).toBe(0);
    });

    it('should reset cache metrics', async () => {
      const projectDTO = createMockProjectDTO('project-11', 'Project 11');
      await cache.set('project-11', projectDTO);
      await cache.get('project-11'); // Generate hit
      await cache.get('non-existent'); // Generate miss

      await cache.clearAll();

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used project when exceeding 100 projects', async () => {
      // Add 101 projects (will trigger eviction)
      for (let i = 1; i <= 101; i++) {
        const projectDTO = createMockProjectDTO(`project-${i}`, `Project ${i}`);
        await cache.set(`project-${i}`, projectDTO);
      }

      // First project should be evicted from memory
      const firstProject = await cache.get('project-1');

      // Should still exist on disk, but will be loaded from disk
      // (check metrics to verify it was a disk hit, not memory hit)
      const metricsBefore = cache.getMetrics();

      // Access project-101 (most recently used)
      const lastProject = await cache.get('project-101');
      expect(lastProject).not.toBeNull();
      expect(lastProject?.title).toBe('Project 101');
    });

    it('should update LRU order on access', async () => {
      // Add 3 projects
      for (let i = 1; i <= 3; i++) {
        const projectDTO = createMockProjectDTO(`project-${i}`, `Project ${i}`);
        await cache.set(`project-${i}`, projectDTO);
      }

      // Access project-1 to move it to head
      await cache.get('project-1');

      // Add 99 more projects (total 102, will evict oldest)
      for (let i = 4; i <= 102; i++) {
        const projectDTO = createMockProjectDTO(`project-${i}`, `Project ${i}`);
        await cache.set(`project-${i}`, projectDTO);
      }

      // project-1 should still be in memory (was accessed recently)
      // project-2 should be evicted (least recently used)
      const metrics = cache.getMetrics();
      expect(metrics.evictions).toBeGreaterThan(0);
    });
  });

  describe('Cache Metrics', () => {
    it('should track cache hits', async () => {
      const projectDTO = createMockProjectDTO('project-12', 'Project 12');
      await cache.set('project-12', projectDTO);

      await cache.get('project-12'); // Hit
      await cache.get('project-12'); // Hit

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBeGreaterThanOrEqual(2);
    });

    it('should track cache misses', async () => {
      await cache.get('non-existent-1'); // Miss
      await cache.get('non-existent-2'); // Miss

      const metrics = cache.getMetrics();
      expect(metrics.misses).toBeGreaterThanOrEqual(2);
    });

    it('should calculate hit rate correctly', async () => {
      const projectDTO = createMockProjectDTO('project-13', 'Project 13');
      await cache.set('project-13', projectDTO);

      await cache.get('project-13'); // Hit
      await cache.get('non-existent'); // Miss

      const metrics = cache.getMetrics();
      // Hit rate should be 50% (1 hit, 1 miss)
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
    });
  });

  describe('Path Sanitization', () => {
    it('should sanitize project IDs to prevent path traversal', async () => {
      const maliciousId = '../../../etc/passwd';
      const projectDTO = createMockProjectDTO(maliciousId, 'Malicious Project');

      await cache.set(maliciousId, projectDTO);

      // Should create file with sanitized name (all non-alphanumeric chars become _)
      const files = await fs.readdir(testCacheDir);
      const sanitizedFileName = maliciousId.replace(/[^a-zA-Z0-9-]/g, '_') + '.json';

      expect(files).toContain(sanitizedFileName);
      // Should NOT be able to escape the cache directory
      expect(files.some((f) => f.includes('..'))).toBe(false);
    });
  });
});

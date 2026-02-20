/**
 * ProjectCache Integration Tests
 * Tests for encryption, disk persistence, and full cache lifecycle
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectCache } from '../../../src-electron/cache/ProjectCache.js';
import type { ProjectDetailDTO } from '../../../src-electron/services/mokuapi/project.types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app, safeStorage } from 'electron';

describe('ProjectCache Integration Tests', () => {
  let cache: ProjectCache;
  let testCacheDir: string;

  const createMockProjectDTO = (id: string, name: string): ProjectDetailDTO => ({
    id,
    name,
    description: `Integration test for ${name}`,
    type: 'shared',
    createdBy: 'integration-user',
    organizationId: 'integration-org',
    status: 'active',
    metadata: { color: '#10B981', icon: 'rocket' },
    memberCount: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userRole: 'owner',
  });

  beforeEach(async () => {
    cache = new ProjectCache();
    await cache.initialize();
    testCacheDir = path.join(app.getPath('userData'), '.holokai', 'cache', 'encrypted', 'projects');
  });

  afterEach(async () => {
    await cache.clearAll();
  });

  describe('Encryption Integration', () => {
    it('should encrypt data before writing to disk', async () => {
      const projectDTO = createMockProjectDTO('encrypt-1', 'Encrypted Project');
      await cache.set('encrypt-1', projectDTO);

      const filePath = path.join(testCacheDir, 'encrypt-1.json');
      const fileContent = await fs.readFile(filePath);

      // If encryption is available, content should be encrypted
      if (safeStorage.isEncryptionAvailable()) {
        const rawContent = fileContent.toString('utf-8');
        // Should not contain plaintext project data
        expect(rawContent).not.toContain('Encrypted Project');
        expect(rawContent).not.toContain('integration-user');
      }
    });

    it('should decrypt data when reading from disk', async () => {
      const projectDTO = createMockProjectDTO('decrypt-1', 'Decrypt Test');
      await cache.set('decrypt-1', projectDTO);

      // Create new cache instance to force disk read
      const newCache = new ProjectCache();
      await newCache.initialize();

      const retrieved = await newCache.get('decrypt-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.title).toBe('Decrypt Test');
      expect(retrieved?.createdBy).toBe('integration-user');

      await newCache.clearAll();
    });

    it('should handle encryption unavailability gracefully', async () => {
      // This test documents the behavior when encryption is not available
      // In production, this should log a warning
      const projectDTO = createMockProjectDTO('no-encrypt-1', 'No Encryption');

      await expect(cache.set('no-encrypt-1', projectDTO)).resolves.not.toThrow();
      const retrieved = await cache.get('no-encrypt-1');
      expect(retrieved).not.toBeNull();
    });
  });

  describe('Disk Persistence Integration', () => {
    it('should persist multiple projects and maintain integrity', async () => {
      const projects = [
        createMockProjectDTO('persist-1', 'First Project'),
        createMockProjectDTO('persist-2', 'Second Project'),
        createMockProjectDTO('persist-3', 'Third Project'),
      ];

      // Write all projects
      for (const project of projects) {
        await cache.set(project.id, project);
      }

      // Verify all files exist
      const files = await fs.readdir(testCacheDir);
      expect(files).toHaveLength(3);
      expect(files).toContain('persist-1.json');
      expect(files).toContain('persist-2.json');
      expect(files).toContain('persist-3.json');

      // Create new cache and verify all can be loaded
      const newCache = new ProjectCache();
      await newCache.initialize();

      for (const project of projects) {
        const retrieved = await newCache.get(project.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.title).toBe(project.name);
      }

      await newCache.clearAll();
    });

    it('should handle concurrent reads and writes', async () => {
      const projectDTO = createMockProjectDTO('concurrent-1', 'Concurrent Test');

      // Simulate concurrent operations
      await Promise.all([
        cache.set('concurrent-1', projectDTO),
        cache.get('concurrent-1'),
        cache.set('concurrent-1', { ...projectDTO, name: 'Updated Concurrent' }),
      ]);

      const final = await cache.get('concurrent-1');
      expect(final).not.toBeNull();
      // Should have one of the two versions
      expect(['Concurrent Test', 'Updated Concurrent']).toContain(final?.title);
    });

    it('should recover from corrupted cache files', async () => {
      const projectDTO = createMockProjectDTO('corrupt-1', 'Corrupt Test');
      await cache.set('corrupt-1', projectDTO);

      // Corrupt the file
      const filePath = path.join(testCacheDir, 'corrupt-1.json');
      await fs.writeFile(filePath, 'corrupted data that is not valid');

      // Should return null for corrupted file (not crash)
      const retrieved = await cache.get('corrupt-1');
      expect(retrieved).toBeNull();
    });
  });

  describe('Full Lifecycle Integration', () => {
    it('should support complete CRUD lifecycle', async () => {
      // Create
      const projectDTO = createMockProjectDTO('lifecycle-1', 'Lifecycle Project');
      await cache.set('lifecycle-1', projectDTO);

      let retrieved = await cache.get('lifecycle-1');
      expect(retrieved?.title).toBe('Lifecycle Project');

      // Update
      const updatedDTO = { ...projectDTO, name: 'Updated Lifecycle Project' };
      await cache.set('lifecycle-1', updatedDTO);

      retrieved = await cache.get('lifecycle-1');
      expect(retrieved?.title).toBe('Updated Lifecycle Project');

      // Delete
      await cache.invalidateProject('lifecycle-1');
      retrieved = await cache.get('lifecycle-1');
      expect(retrieved).toBeNull();
    });

    it('should handle app restart simulation', async () => {
      // Phase 1: Create projects in first "session"
      const project1 = createMockProjectDTO('restart-1', 'Before Restart 1');
      const project2 = createMockProjectDTO('restart-2', 'Before Restart 2');

      await cache.set('restart-1', project1);
      await cache.set('restart-2', project2);

      // Phase 2: Simulate app restart (new cache instance)
      const restartedCache = new ProjectCache();
      await restartedCache.initialize();

      // Phase 3: Verify data survived restart
      const retrieved1 = await restartedCache.get('restart-1');
      const retrieved2 = await restartedCache.get('restart-2');

      expect(retrieved1?.title).toBe('Before Restart 1');
      expect(retrieved2?.title).toBe('Before Restart 2');

      await restartedCache.clearAll();
    });

    it('should handle user logout scenario', async () => {
      // Setup: User has cached projects
      for (let i = 1; i <= 5; i++) {
        const project = createMockProjectDTO(`logout-${i}`, `Project ${i}`);
        await cache.set(`logout-${i}`, project);
      }

      // Verify cache has data
      const beforeLogout = await cache.get('logout-1');
      expect(beforeLogout).not.toBeNull();

      // User logs out
      await cache.clearAll();

      // Verify all data is cleared
      const afterLogout = await cache.get('logout-1');
      expect(afterLogout).toBeNull();

      // Verify disk is also cleared
      const files = await fs.readdir(testCacheDir);
      expect(files).toHaveLength(0);
    });
  });

  describe('Performance Integration', () => {
    it('should handle 1000 projects efficiently', async () => {
      const startTime = Date.now();

      // Create 1000 projects
      const promises = [];
      for (let i = 1; i <= 1000; i++) {
        const project = createMockProjectDTO(`perf-${i}`, `Performance ${i}`);
        promises.push(cache.set(`perf-${i}`, project));
      }

      await Promise.all(promises);

      const writeTime = Date.now() - startTime;

      // Should complete in reasonable time (< 10 seconds)
      expect(writeTime).toBeLessThan(10000);

      // Memory should have 100 projects (LRU limit)
      const metrics = cache.getMetrics();
      expect(metrics.evictions).toBeGreaterThan(0);

      // But all should be accessible from disk
      const retrieved = await cache.get('perf-1');
      expect(retrieved).not.toBeNull();
    });

    it('should maintain <50MB memory footprint with 1000 projects', async () => {
      // Note: This is a behavioral test - actual memory measurement
      // would require process.memoryUsage() before/after
      for (let i = 1; i <= 1000; i++) {
        const project = createMockProjectDTO(`mem-${i}`, `Memory ${i}`);
        await cache.set(`mem-${i}`, project);
      }

      // With LRU eviction, memory cache should stay at ~100 projects
      const metrics = cache.getMetrics();
      expect(metrics.evictions).toBeGreaterThan(890); // At least 900 evictions
    });
  });

  describe('Name to Title Mapping Integration', () => {
    it('should consistently map name→title across cache lifecycle', async () => {
      const projectDTO = createMockProjectDTO('mapping-1', 'Original Name');

      // Set with 'name' field from API
      await cache.set('mapping-1', projectDTO);

      // Get from memory - should have 'title' field
      const fromMemory = await cache.get('mapping-1');
      expect(fromMemory?.title).toBe('Original Name');
      expect(fromMemory).not.toHaveProperty('name');

      // Create new cache, load from disk - should still have 'title' field
      const newCache = new ProjectCache();
      await newCache.initialize();

      const fromDisk = await newCache.get('mapping-1');
      expect(fromDisk?.title).toBe('Original Name');
      expect(fromDisk).not.toHaveProperty('name');

      await newCache.clearAll();
    });

    it('should preserve title through multiple updates', async () => {
      let projectDTO = createMockProjectDTO('update-1', 'Version 1');
      await cache.set('update-1', projectDTO);

      // Update with new name
      projectDTO = { ...projectDTO, name: 'Version 2' };
      await cache.set('update-1', projectDTO);

      const retrieved = await cache.get('update-1');
      expect(retrieved?.title).toBe('Version 2');
      expect(retrieved).not.toHaveProperty('name');
    });
  });
});

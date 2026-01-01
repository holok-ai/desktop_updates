/**
 * ProjectService Unit Tests
 * Tests for CRUD operations, permission checks, and caching
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectService } from '../../../src-electron/services/ProjectService.js';
import type { ProjectDetailDTO } from '../../../src-electron/services/mokuapi/project.types.js';
import { ValidationError, ForbiddenError } from '../../../src-electron/types/errors.js';

// Mock dependencies first (before imports)
vi.mock('../../../src-electron/services/mokuapi/project-api.service.js', () => ({
  projectApiService: {
    createProject: vi.fn(),
    getProjects: vi.fn(),
    getProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
  },
}));

vi.mock('../../../src-electron/cache/ProjectCache.js', () => ({
  projectCache: {
    get: vi.fn(),
    set: vi.fn(),
    invalidateProject: vi.fn(),
  },
}));

// Import mocked modules
import { projectApiService } from '../../../src-electron/services/mokuapi/project-api.service.js';
import { projectCache } from '../../../src-electron/cache/ProjectCache.js';

const mockProjectApi = projectApiService as any;
const mockProjectCache = projectCache as any;

describe('ProjectService', () => {
  let projectService: ProjectService;

  const mockProjectDTO: ProjectDetailDTO = {
    id: 'project-1',
    name: 'Test Project',
    description: 'Test description',
    type: 'shared',
    createdBy: 'user-1',
    organizationId: 'org-1',
    status: 'active',
    metadata: { color: '#3B82F6', icon: 'folder' },
    memberCount: 3,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    userRole: 'owner',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    projectService = new ProjectService();
  });

  describe('create()', () => {
    it('should create a project with valid input', async () => {
      mockProjectApi.createProject.mockResolvedValue(mockProjectDTO);
      mockProjectCache.set.mockResolvedValue(undefined);

      const result = await projectService.create({
        title: 'Test Project',
        description: 'Test description',
        type: 'shared',
        metadata: { color: '#3B82F6', icon: 'folder' },
      });

      expect(result.id).toBe('project-1');
      expect(result.title).toBe('Test Project');
      expect(mockProjectApi.createProject).toHaveBeenCalledWith({
        name: 'Test Project', // title mapped to name
        description: 'Test description',
        type: 'shared',
        metadata: { color: '#3B82F6', icon: 'folder' },
      });
      expect(mockProjectCache.set).toHaveBeenCalledWith('project-1', mockProjectDTO);
    });

    it('should throw ValidationError for empty title', async () => {
      await expect(
        projectService.create({ title: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for title > 100 chars', async () => {
      await expect(
        projectService.create({ title: 'a'.repeat(101) })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid color', async () => {
      await expect(
        projectService.create({
          title: 'Test',
          metadata: { color: '#INVALID' },
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid icon', async () => {
      await expect(
        projectService.create({
          title: 'Test',
          metadata: { icon: 'invalid-icon' },
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('get()', () => {
    it('should return project from cache if available', async () => {
      mockProjectCache.get.mockResolvedValue(mockProjectDTO);

      const result = await projectService.get('project-1');

      expect(result.id).toBe('project-1');
      expect(result.title).toBe('Test Project');
      expect(mockProjectCache.get).toHaveBeenCalledWith('project-1');
      expect(mockProjectApi.getProject).not.toHaveBeenCalled();
    });

    it('should fetch from API on cache miss', async () => {
      mockProjectCache.get.mockResolvedValue(null);
      mockProjectApi.getProject.mockResolvedValue(mockProjectDTO);
      mockProjectCache.set.mockResolvedValue(undefined);

      const result = await projectService.get('project-1');

      expect(result.id).toBe('project-1');
      expect(mockProjectCache.get).toHaveBeenCalledWith('project-1');
      expect(mockProjectApi.getProject).toHaveBeenCalledWith('project-1');
      expect(mockProjectCache.set).toHaveBeenCalledWith('project-1', mockProjectDTO);
    });
  });

  describe('update()', () => {
    it('should update project and invalidate cache', async () => {
      const updatedDTO = { ...mockProjectDTO, name: 'Updated Project' };
      mockProjectApi.updateProject.mockResolvedValue(updatedDTO);
      mockProjectCache.invalidateProject.mockResolvedValue(undefined);
      mockProjectCache.set.mockResolvedValue(undefined);

      const result = await projectService.update('project-1', {
        title: 'Updated Project',
      });

      expect(result.title).toBe('Updated Project');
      expect(mockProjectApi.updateProject).toHaveBeenCalledWith('project-1', {
        name: 'Updated Project',
        description: undefined,
        metadata: undefined,
      });
      expect(mockProjectCache.invalidateProject).toHaveBeenCalledWith('project-1');
      expect(mockProjectCache.set).toHaveBeenCalledWith('project-1', updatedDTO);
    });
  });

  describe('delete()', () => {
    it('should delete project and purge from cache', async () => {
      mockProjectApi.deleteProject.mockResolvedValue(undefined);
      mockProjectCache.invalidateProject.mockResolvedValue(undefined);

      await projectService.delete('project-1');

      expect(mockProjectApi.deleteProject).toHaveBeenCalledWith('project-1');
      expect(mockProjectCache.invalidateProject).toHaveBeenCalledWith('project-1');
    });
  });

  describe('Permission Checks', () => {
    beforeEach(() => {
      mockProjectCache.get.mockResolvedValue(mockProjectDTO);
    });

    it('should allow owner to delete project', async () => {
      await expect(
        projectService.hasPermission('project-1', 'delete_project' as any)
      ).resolves.not.toThrow();
    });

    it('should deny editor from deleting project', async () => {
      mockProjectCache.get.mockResolvedValue({
        ...mockProjectDTO,
        userRole: 'editor',
      });

      await expect(
        projectService.hasPermission('project-1', 'delete_project' as any)
      ).rejects.toThrow(ForbiddenError);
    });

    it('should allow editor to create threads', async () => {
      mockProjectCache.get.mockResolvedValue({
        ...mockProjectDTO,
        userRole: 'editor',
      });

      await expect(
        projectService.hasPermission('project-1', 'create_threads' as any)
      ).resolves.not.toThrow();
    });

    it('should deny viewer from creating threads', async () => {
      mockProjectCache.get.mockResolvedValue({
        ...mockProjectDTO,
        userRole: 'viewer',
      });

      await expect(
        projectService.hasPermission('project-1', 'create_threads' as any)
      ).rejects.toThrow(ForbiddenError);
    });

    it('checkPermission should return boolean', async () => {
      const hasPermission = await projectService.checkPermission(
        'project-1',
        'delete_project' as any
      );

      expect(hasPermission).toBe(true);
    });

    it('getUserRole should return user role', async () => {
      const role = await projectService.getUserRole('project-1');

      expect(role).toBe('owner');
    });
  });
});


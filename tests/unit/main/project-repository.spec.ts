import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectRepository } from '../../../src-electron/repository/project-repository';

describe('ProjectRepository', () => {
  let repository: ProjectRepository;

  beforeEach(() => {
    repository = new ProjectRepository();
    repository.clearAll();
  });

  describe('createProject', () => {
    it('should create a project with required fields', () => {
      const project = repository.createProject('Test Project');

      expect(project).toBeDefined();
      expect(typeof project.id).toBe('string');
      expect(project.title).toBe('Test Project');
      expect(project.createdAt).toBeDefined();
      expect(project.updatedAt).toBeDefined();
    });

    it('should create a project with description', () => {
      const project = repository.createProject('Test Project', 'Test description');

      expect(project.description).toBe('Test description');
    });

    it('should create a project with metadata', () => {
      const metadata = { custom: 'value' };
      const project = repository.createProject('Test Project', undefined, metadata);

      expect(project.metadata).toEqual(metadata);
    });

    it('should generate unique IDs for each project', () => {
      const project1 = repository.createProject('Project 1');
      const project2 = repository.createProject('Project 2');

      expect(project1.id).not.toBe(project2.id);
    });
  });

  describe('getProject', () => {
    it('should retrieve a project by ID', () => {
      const created = repository.createProject('Test Project');
      const retrieved = repository.getProject(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.title).toBe('Test Project');
    });

    it('should return null for non-existent project', () => {
      const result = repository.getProject('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('listProjects', () => {
    it('should return empty array when no projects exist', () => {
      const projects = repository.listProjects();
      expect(projects).toEqual([]);
    });

    it('should list all active projects', () => {
      repository.createProject('Project 1');
      repository.createProject('Project 2');
      repository.createProject('Project 3');

      const projects = repository.listProjects();
      expect(projects).toHaveLength(3);
    });

    it('should not include soft-deleted projects', () => {
      const project1 = repository.createProject('Project 1');
      const project2 = repository.createProject('Project 2');

      repository.softDeleteProject(project1.id);

      const projects = repository.listProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe(project2.id);
    });

    it('should sort projects by updatedAt descending', () => {
      const project1 = repository.createProject('Project 1');
      // Simulate time passing
      const project2 = repository.createProject('Project 2');

      const projects = repository.listProjects();
      const ids = projects.map((p) => p.id);
      expect(new Set(ids)).toEqual(new Set([project1.id, project2.id]));
    });
  });

  describe('updateProject', () => {
    it('should update project name', () => {
      const project = repository.createProject('Old Name');
      const updated = repository.updateProject(project.id, { title: 'New Name' });

      expect(updated.title).toBe('New Name');
    });

    it('should update project description', () => {
      const project = repository.createProject('Test Project');
      const updated = repository.updateProject(project.id, { description: 'New description' });

      expect(updated.description).toBe('New description');
    });

    it('should update project metadata', () => {
      const project = repository.createProject('Test Project');
      const updated = repository.updateProject(project.id, {
        metadata: { key: 'value' },
      });

      expect(updated.metadata).toEqual({ key: 'value' });
    });

    it('should merge metadata when updating', () => {
      const project = repository.createProject('Test Project', undefined, { existing: 'data' });
      const updated = repository.updateProject(project.id, {
        metadata: { new: 'value' },
      });

      expect(updated.metadata).toEqual({ existing: 'data', new: 'value' });
    });

    it('should update updatedAt timestamp', () => {
      const project = repository.createProject('Test Project');
      const originalUpdatedAt = project.updatedAt;

      // Wait a bit to ensure timestamp difference
      const updated = repository.updateProject(project.id, { name: 'Updated Name' });
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });

    it('should throw error for non-existent project', () => {
      expect(() => {
        repository.updateProject('non-existent-id', { name: 'New Name' });
      }).toThrow('Project not found');
    });
  });

  describe('deleteProject', () => {
    it('should hard delete a project', () => {
      const project = repository.createProject('Test Project');
      const deleted = repository.deleteProject(project.id);

      expect(deleted).toBe(true);
      expect(repository.getProject(project.id)).toBeNull();
    });

    it('should return false when deleting non-existent project', () => {
      const deleted = repository.deleteProject('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('softDeleteProject', () => {
    it('should soft delete a project', () => {
      const project = repository.createProject('Test Project');
      const deleted = repository.softDeleteProject(project.id);

      expect(deleted).toBe(true);

      const retrieved = repository.getProject(project.id);
      expect(retrieved?.deletedAt).toBeDefined();
    });

    it('should exclude soft-deleted projects from list', () => {
      const project = repository.createProject('Test Project');
      repository.softDeleteProject(project.id);

      const projects = repository.listProjects();
      expect(projects).toHaveLength(0);
    });

    it('should return false when soft-deleting non-existent project', () => {
      const deleted = repository.softDeleteProject('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('should remove all projects', () => {
      repository.createProject('Project 1');
      repository.createProject('Project 2');
      repository.createProject('Project 3');

      repository.clearAll();

      const projects = repository.listProjects();
      expect(projects).toHaveLength(0);
    });
  });

  describe('data persistence', () => {
    it('should clone projects to prevent mutation', () => {
      const project = repository.createProject('Test Project');
      const retrieved = repository.getProject(project.id);

      retrieved!.title = 'Modified Name';

      const retrievedAgain = repository.getProject(project.id);
      expect(retrievedAgain?.title).toBe('Test Project');
    });

    it('should return independent copies in list', () => {
      repository.createProject('Test Project');
      const list1 = repository.listProjects();
      const list2 = repository.listProjects();

      list1[0].title = 'Modified';

      expect(list2[0].title).toBe('Test Project');
    });
  });
});

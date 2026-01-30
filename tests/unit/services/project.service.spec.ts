import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import type { Project } from '../../../src/lib/types/project.type';
import type { ProjectAPI } from '../../../src-electron/preload';
import { projectService } from '../../../src/lib/services/project.service';
import { projects } from '../../../src/lib/stores/project.store';
import { setElectronAPIMocks } from '../../setup/test-setup';

describe('ProjectService', () => {
  beforeEach(() => {
    projects.setProjects([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loadProjects stores fetched projects via wrapper', async () => {
    const sampleProjects: Project[] = [
      {
        id: crypto.randomUUID(),
        title: 'Alpha',
        description: 'First',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        privacyMode: 'default',
      },
      {
        id: crypto.randomUUID(),
        title: 'Beta',
        description: 'Second',
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-02-02'),
        privacyMode: 'project_only',
      },
    ];
    const loadProjects = vi.fn().mockResolvedValue(undefined);
    const getAll = vi.fn().mockResolvedValue(sampleProjects);
    const projectOverrides: Partial<ProjectAPI> = { loadProjects, getAll };
    setElectronAPIMocks({ project: projectOverrides });

    await projectService.loadProjects();

    expect(loadProjects).toHaveBeenCalledTimes(1);
    expect(get(projects)).toEqual(sampleProjects);
  });

  it('loadProjects logs context and rethrows errors', async () => {
    const error = new Error('ipc unavailable');
    const loadProjects = vi.fn().mockRejectedValue(error);
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {});
    const projectOverrides: Partial<ProjectAPI> = { loadProjects };
    setElectronAPIMocks({ project: projectOverrides });

    await expect(projectService.loadProjects()).rejects.toThrow(error);
    expect(logger).toHaveBeenCalledWith('Failed to load projects:', error);
  });

  it('getThreadCount returns fallback when Electron API fails', async () => {
    const getThreads = vi.fn().mockRejectedValue(new Error('boom'));
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {});
    const projectOverrides: Partial<ProjectAPI> = { getThreads };
    setElectronAPIMocks({ project: projectOverrides });

    const projectId = crypto.randomUUID();
    const count = await projectService.getThreadCount(projectId);

    expect(count).toBe(0);
    expect(getThreads).toHaveBeenCalledWith(projectId);
    expect(logger).toHaveBeenCalledWith('Failed to get thread count:', expect.any(Error));
  });
});

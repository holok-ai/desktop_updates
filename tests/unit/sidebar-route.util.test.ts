import { describe, it, expect } from 'vitest';
import { getSelectedActivity } from '../../src/lib/utils/sidebar-route.util';

describe('getSelectedActivity', () => {
  it('returns "search" for /search path', () => {
    expect(getSelectedActivity('/search')).toBe('search');
    expect(getSelectedActivity('/search?q=test')).toBe('search');
  });

  it('returns "search" for home path /', () => {
    expect(getSelectedActivity('/')).toBe('search');
  });

  it('returns "search" for empty or invalid path', () => {
    expect(getSelectedActivity('')).toBe('search');
  });

  it('returns "threads" for /threads path without projectId', () => {
    expect(getSelectedActivity('/threads')).toBe('threads');
    expect(getSelectedActivity('/threads/applications')).toBe('threads');
    expect(getSelectedActivity('/threads/view')).toBe('threads');
  });

  it('returns "projects" for /threads path with projectId', () => {
    expect(getSelectedActivity('/threads/view', 'threadId=abc&projectId=123')).toBe('projects');
    expect(getSelectedActivity('/threads', 'projectId=xyz')).toBe('projects');
  });

  it('returns "projects" for /project/* paths', () => {
    expect(getSelectedActivity('/project/thread')).toBe('projects');
    expect(getSelectedActivity('/project/members')).toBe('projects');
    expect(getSelectedActivity('/project/files')).toBe('projects');
    expect(getSelectedActivity('/project/instructions')).toBe('projects');
    expect(getSelectedActivity('/project/applications')).toBe('projects');
  });

  it('returns "projects" for /projects path', () => {
    expect(getSelectedActivity('/projects')).toBe('projects');
    expect(getSelectedActivity('/projects/view')).toBe('projects');
  });
});

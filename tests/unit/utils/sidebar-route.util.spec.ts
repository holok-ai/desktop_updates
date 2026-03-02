import { describe, it, expect } from 'vitest';
import { getSelectedActivity } from '$lib/utils/sidebar-route.util';

describe('getSelectedActivity', () => {
  it('returns "search" for /search path', () => {
    expect(getSelectedActivity('/search')).toBe('search');
    expect(getSelectedActivity('/search?q=test')).toBe('search');
  });

  it('returns "threads" for /threads path without projectId', () => {
    expect(getSelectedActivity('/threads')).toBe('threads');
    expect(getSelectedActivity('/threads/view', 'threadId=abc')).toBe('threads');
    expect(getSelectedActivity('/threads/applications')).toBe('threads');
  });

  it('returns "projects" for /threads path with projectId', () => {
    expect(getSelectedActivity('/threads', 'projectId=123')).toBe('projects');
    expect(getSelectedActivity('/threads/view', 'threadId=abc&projectId=123')).toBe('projects');
  });

  it('returns "projects" for /project/* sub-routes', () => {
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

  it('returns "search" for / home path', () => {
    expect(getSelectedActivity('/')).toBe('search');
  });

  it('returns "search" for empty or invalid paths (falls back to HOME)', () => {
    expect(getSelectedActivity('')).toBe('search');
    expect(getSelectedActivity(null as unknown as string)).toBe('search');
    expect(getSelectedActivity(undefined as unknown as string)).toBe('search');
  });

  it('returns "search" for unrecognized paths (no branch matches, falls through to HOME check)', () => {
    expect(getSelectedActivity('/settings')).toBe('search');
    expect(getSelectedActivity('/login')).toBe('search');
  });
});

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getSelectedActivity } from '$lib/utils/sidebar-route.util';

// ─── Task 2: Exploratory tests to confirm the bug ───────────────────────────

describe('getSelectedActivity – Bug Exploration (Fault Condition)', () => {
  const buggyRoutes = [
    '/project/applications',
    '/project/members',
    '/project/files',
    '/project/instructions',
  ];

  it.each(buggyRoutes)('should return "projects" for %s', (route) => {
    expect(getSelectedActivity(route)).toBe('projects');
  });

  it('[PBT] all /project/* suffixes (excluding /project/thread) should return "projects"', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/).filter((s) => !s.startsWith('thread')),
        (suffix) => {
          const path = `/project/${suffix}`;
          expect(getSelectedActivity(path)).toBe('projects');
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ─── Task 4: Fix Checking (Property 1) ──────────────────────────────────────

describe('getSelectedActivity – Fix Checking', () => {
  it('[PBT] all /project/* paths return "projects"', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z][a-z0-9-/]{0,30}$/), (suffix) => {
        const path = `/project/${suffix}`;
        expect(getSelectedActivity(path)).toBe('projects');
      }),
      { numRuns: 500 },
    );
  });
});

// ─── Task 5: Preservation Checking (Property 2) ─────────────────────────────

describe('getSelectedActivity – Preservation', () => {
  // 5.1 /project/thread still returns 'projects'
  it('/project/thread returns "projects"', () => {
    expect(getSelectedActivity('/project/thread')).toBe('projects');
  });

  it('/project/thread?threadId=abc returns "projects"', () => {
    expect(getSelectedActivity('/project/thread', 'threadId=abc')).toBe('projects');
  });

  // 5.2 /projects and /projects/view still return 'projects'
  it('/projects returns "projects"', () => {
    expect(getSelectedActivity('/projects')).toBe('projects');
  });

  it('/projects/view returns "projects"', () => {
    expect(getSelectedActivity('/projects/view')).toBe('projects');
  });

  // 5.3 /threads returns 'threads', /threads/view?projectId=abc returns 'projects'
  it('/threads returns "threads"', () => {
    expect(getSelectedActivity('/threads')).toBe('threads');
  });

  it('/threads/view returns "threads" (no projectId)', () => {
    expect(getSelectedActivity('/threads/view')).toBe('threads');
  });

  it('/threads/view?projectId=abc returns "projects"', () => {
    expect(getSelectedActivity('/threads/view', 'projectId=abc')).toBe('projects');
  });

  // 5.4 /search returns 'search', / returns 'search'
  it('/search returns "search"', () => {
    expect(getSelectedActivity('/search')).toBe('search');
  });

  it('/ returns "search"', () => {
    expect(getSelectedActivity('/')).toBe('search');
  });

  it('empty string defaults to "search"', () => {
    expect(getSelectedActivity('')).toBe('search');
  });

  // 5.5 [PBT] Preservation: non-/project/* routes produce the same result as original logic
  it('[PBT] non-/project/* known routes match expected original behavior', () => {
    // Reference implementation of the ORIGINAL logic (before fix)
    function originalLogic(path: string, qs?: string): string {
      const normalized = typeof path === 'string' && path.length > 0 ? path : '/';
      let next = 'search';
      const params = new URLSearchParams(qs ?? '');
      const hasProjectId = params.has('projectId');

      if (normalized.startsWith('/search')) {
        next = 'search';
      } else if (normalized.startsWith('/threads')) {
        next = hasProjectId ? 'projects' : 'threads';
      } else if (normalized.startsWith('/project/thread')) {
        next = 'projects';
      } else if (normalized.startsWith('/projects')) {
        next = 'projects';
      } else if (normalized.startsWith('/')) {
        next = 'search';
      }
      return next;
    }

    // Generate paths that are NOT /project/* (the bug-condition domain)
    const nonProjectRoutes = [
      '/threads',
      '/threads/view',
      '/threads/applications',
      '/projects',
      '/projects/view',
      '/search',
      '/',
    ];
    const qsArb = fc.oneof(
      fc.constant(undefined),
      fc.constant(''),
      fc.constant('projectId=abc'),
      fc.constant('threadId=xyz'),
    );

    fc.assert(
      fc.property(fc.constantFrom(...nonProjectRoutes), qsArb, (path, qs) => {
        expect(getSelectedActivity(path, qs)).toBe(originalLogic(path, qs));
      }),
      { numRuns: 200 },
    );
  });
});

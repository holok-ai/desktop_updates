import { ROUTE } from '../constants/route.constant';

/**
 * Determines which sidebar activity should be selected based on the current
 * URL path and querystring. This is a pure function extracted from
 * ActivitySidebar.svelte so it can be unit-tested independently.
 */
export function getSelectedActivity(path: string, querystring?: string): string {
  const normalized = typeof path === 'string' && path.length > 0 ? path : ROUTE.HOME;
  let next = 'search';

  const params = new URLSearchParams(querystring ?? '');
  const hasProjectId = params.has('projectId');

  if (normalized.startsWith('/search')) {
    next = 'search';
  } else if (normalized.startsWith(ROUTE.THREADS)) {
    next = hasProjectId ? 'projects' : 'threads';
  } else if (normalized.startsWith('/project/')) {
    // All /project/* routes belong to Projects
    next = 'projects';
  } else if (normalized.startsWith(ROUTE.PROJECTS)) {
    next = 'projects';
  } else if (normalized.startsWith(ROUTE.HOME)) {
    next = 'search';
  }

  return next;
}

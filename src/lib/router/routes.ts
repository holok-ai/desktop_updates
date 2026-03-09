// Route map for svelte-spa-router (hash-based routing)
// Use async route components so route code is split from the initial chunk.
import { wrap } from 'svelte-spa-router/wrap';

// svelte-spa-router expects Svelte 4 ComponentType; Svelte 5 components are
// structurally incompatible, so we cast through unknown to keep the router happy.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazy(importer: () => Promise<any>): ReturnType<typeof wrap> {
  return wrap({ asyncComponent: importer });
}

// Note: svelte-spa-router uses hash routing by default (e.g., #/threads)
// Back/forward works automatically via the hashchange + history stack
// Catch-all route (*) handles invalid routes and redirects to home
/* eslint-disable @typescript-eslint/naming-convention */
export const routes = {
  '/': lazy(() => import('../pages/ApplicationThread.svelte')),
  '/search': lazy(() => import('../../routes/search/+page.svelte')),
  '/threads/applications': lazy(() => import('../pages/ApplicationThread.svelte')),
  '/threads': lazy(() => import('../../routes/threads/+page.svelte')),
  '/threads/view': lazy(() => import('../../routes/threads/view/+page.svelte')),
  '/project/thread': lazy(() => import('../../routes/project/thread/+page.svelte')),
  '/projects': lazy(() => import('../../routes/projects/+page.svelte')),
  '/projects/view': lazy(() => import('../../routes/projects/view/+page.svelte')),
  '/project/members': lazy(() => import('../../routes/project/members/+page.svelte')),
  '/project/applications': lazy(() => import('../pages/ApplicationThread.svelte')),
  '/project/files': lazy(() => import('../../routes/project/files/+page.svelte')),
  '/project/instructions': lazy(() => import('../../routes/project/instructions/+page.svelte')),
  '/login': lazy(() => import('../../routes/login/+page.svelte')),
  '/settings': lazy(() => import('../../routes/settings/+page.svelte')),
  '/app-updates': lazy(() => import('../../routes/app-updates/+page.svelte')),
  '*': lazy(() => import('../components/NotFound.svelte')),
};
/* eslint-enable @typescript-eslint/naming-convention */

export default routes;

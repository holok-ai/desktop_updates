// Route map for svelte-spa-router (hash-based routing)
// Keep imports local to avoid circular deps
import Search from '../../routes/search/+page.svelte';
import ThreadList from '../../routes/threads/+page.svelte';
import ApplicationThread from '../pages/ApplicationThread.svelte';
import ThreadPage from '../../routes/threads/view/+page.svelte';
import ProjectThread from '../../routes/project/thread/+page.svelte';
import Login from '../../routes/login/+page.svelte';
import Settings from '../../routes/settings/+page.svelte';
import AppUpdates from '../../routes/app-updates/+page.svelte';
import Projects from '../../routes/projects/+page.svelte';
import ProjectView from '../../routes/projects/view/+page.svelte';
import ProjectMembers from '../../routes/project/members/+page.svelte';
import ProjectFiles from '../../routes/project/files/+page.svelte';
import ProjectInstructions from '../../routes/project/instructions/+page.svelte';
import NotFound from '../components/NotFound.svelte';

// Note: svelte-spa-router uses hash routing by default (e.g., #/threads)
// Back/forward works automatically via the hashchange + history stack
// Catch-all route (*) handles invalid routes and redirects to home
/* eslint-disable @typescript-eslint/naming-convention */
export const routes = {
  '/': ApplicationThread,
  '/search': Search,
  '/threads/applications': ApplicationThread,
  '/threads': ThreadList,
  '/threads/view': ThreadPage,
  '/project/thread': ProjectThread,
  '/projects': Projects,
  '/projects/view': ProjectView,
  '/project/members': ProjectMembers,
  '/project/applications': ApplicationThread,
  '/project/files': ProjectFiles,
  '/project/instructions': ProjectInstructions,
  '/login': Login,
  '/settings': Settings,
  '/app-updates': AppUpdates,
  '*': NotFound,
};
/* eslint-enable @typescript-eslint/naming-convention */

export default routes;

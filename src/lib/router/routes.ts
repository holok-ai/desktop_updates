export {};

// Route map for svelte-spa-router (hash-based routing)
// Keep imports local to avoid circular deps
import Home from '../../routes/+page.svelte';
import Threads from '../../routes/threads/+page.svelte';
import Login from '../../routes/login/+page.svelte';
import NotFound from '../components/NotFound.svelte';

// Note: svelte-spa-router uses hash routing by default (e.g., #/threads)
// Back/forward works automatically via the hashchange + history stack
// Catch-all route (*) handles invalid routes and redirects to home
/* eslint-disable @typescript-eslint/naming-convention */
export const routes = {
  '/': Home,
  '/threads': Threads,
  '/login': Login,
  '*': NotFound,
};
/* eslint-enable @typescript-eslint/naming-convention */

export default routes;

import { threads } from '$lib/stores/thread.store';
import { projects } from '$lib/stores/project.store';
import { favorites } from '$lib/stores/favorite.store';

/**
 * Clears renderer-side session-scoped state to avoid cross-user data leakage
 * when logging out and signing in as a different user.
 */
export function resetRendererSessionState(): void {
  threads.clearThreads();
  projects.clearProjects();
  favorites.clearFavorites();
}

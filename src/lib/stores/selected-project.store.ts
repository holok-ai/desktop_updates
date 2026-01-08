import { writable, derived, get } from 'svelte/store';
import type { Project } from '$lib/types/project.type';
import { projects } from '$lib/stores/project.store';

/**
 * Store for the currently selected project in the Projects page
 *
 * Architecture:
 * - Stores only the project ID (not the full object)
 * - Derives the full project from the projects store
 * - Auto-updates when projects store refreshes
 *
 * Usage:
 * - +page.svelte: selectedProjectStore.select(projectId) or .clear()
 * - Child components: const project = $derived($selectedProjectStore)
 */
function createSelectedProjectStore() {
  // Store only the selected project ID
  const selectedId = writable<string | null>(null);

  // Derive the full project object from projects store
  const selectedProject = derived(
    [selectedId, projects],
    ([$selectedId, $projects]) => {
      if (!$selectedId) return null;
      return $projects.find(p => p.id === $selectedId) ?? null;
    }
  );

  return {
    // Subscribe to get reactive project updates
    subscribe: selectedProject.subscribe,

    // Set the selected project by ID
    select: (projectId: string | null) => {
      selectedId.set(projectId);
    },

    // Clear selection
    clear: () => {
      selectedId.set(null);
    },

    // Get current value synchronously (use sparingly)
    get: () => get(selectedProject)
  };
}

export const selectedProjectStore = createSelectedProjectStore();

/**
 * Optional: Type-safe helper for components that require a project
 * Throws error if called when no project is selected
 */
export function useSelectedProject(): Project {
  const project = selectedProjectStore.get();
  if (!project) {
    throw new Error(
      'useSelectedProject() called when no project selected. ' +
      'Ensure component is only rendered inside {#if project} blocks.'
    );
  }
  return project;
}


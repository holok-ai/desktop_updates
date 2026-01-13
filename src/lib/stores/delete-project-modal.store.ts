import { writable, type Writable } from 'svelte/store';
import type { GUID } from '$lib/types/app.type';

interface DeleteProjectModalState {
  show: boolean;
  project: { id: GUID; title?: string; name?: string } | null;
}

interface DeleteProjectModalStore extends Writable<DeleteProjectModalState> {
  open: (project: { id: GUID; title?: string; name?: string }) => void;
  close: () => void;
  reset: () => void;
}

function createDeleteProjectModalStore(): DeleteProjectModalStore {
  const { subscribe, set } = writable<DeleteProjectModalState>({
    show: false,
    project: null,
  });

  return {
    subscribe,
    set,
    update: () => {},
    /**
     * Open the delete project modal
     */
    open: (project: { id: GUID; title?: string; name?: string }): void => {
      set({ show: true, project });
    },
    /**
     * Close the delete project modal
     */
    close: (): void => {
      set({ show: false, project: null });
    },
    /**
     * Reset the modal state
     */
    reset: (): void => {
      set({ show: false, project: null });
    },
  };
}

export const deleteProjectModalStore = createDeleteProjectModalStore();

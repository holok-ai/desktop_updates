import { writable } from 'svelte/store';
import type { Project } from '../types/project.type.js';
import type { GUID } from '../types/app.type.js';
import { projectService } from '../services/project.service.js';

interface ProjectStore {
  subscribe: (run: (value: Project[]) => void) => () => void;
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (updatedProject: Project) => void;
  deleteProject: (projectId: GUID) => void;
  loadProject: (projectId: GUID) => Promise<Project | null>;
}

function createProjectStore(): ProjectStore {
  const { subscribe, set, update } = writable<Project[]>([]);

  return {
    subscribe,
    setProjects: (projects: Project[]): void => set(projects),
    addProject: (project: Project): void => {
      update((projects) => {
        const updated = [...projects, project];
        // Sort by updatedAt, newest first
        return updated.sort((a, b) => {
          const aTime =
            typeof a.updatedAt === 'number' ? a.updatedAt : new Date(a.updatedAt).getTime();
          const bTime =
            typeof b.updatedAt === 'number' ? b.updatedAt : new Date(b.updatedAt).getTime();
          return bTime - aTime;
        });
      });
    },
    updateProject: (updatedProject: Project): void => {
      update((projects) => projects.map((p) => (p.id === updatedProject.id ? updatedProject : p)));
    },
    deleteProject: (projectId: GUID): void => {
      update((projects) => projects.filter((p) => p.id !== projectId));
    },
    loadProject: async (projectId: GUID): Promise<Project | null> => {
      // Fetch full project with members and files from backend
      const result = await projectService.getProjectById(projectId);
      const project = result.success ? result.data : null;

      if (project !== null) {
        // Update store with the full project details
        update((projects) => {
          const index = projects.findIndex((p) => p.id === projectId);
          if (index >= 0) {
            // Replace existing project
            const updated = [...projects];
            // eslint-disable-next-line security/detect-object-injection
            updated[index] = project;
            return updated;
          } else {
            // Add new project to store
            return [...projects, project];
          }
        });
      }

      return project;
    },
  };
}

export const projects = createProjectStore();

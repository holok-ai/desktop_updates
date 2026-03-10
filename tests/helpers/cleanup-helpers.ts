import type { Page } from 'playwright';

/**
 * Delete all projects whose title starts with the given prefix.
 * Uses window.electronAPI directly inside the renderer context.
 */
export async function deleteProjectsByPrefix(page: Page, prefix: string): Promise<void> {
  await page.evaluate(
    async ({ prefix: projectPrefix }) => {
      const api = (globalThis as any).electronAPI;

      if (!api?.project?.getAll || !api?.project?.delete) {
        console.warn('[E2E cleanup][projects] electronAPI.project is not available');
        return;
      }

      let projectsResponse: any;
      try {
        projectsResponse = await api.project.getAll();
      } catch (error) {
        console.warn('[E2E cleanup][projects] Failed to load projects for cleanup', error);
        return;
      }

      const projects: any[] = Array.isArray(projectsResponse?.data) ? projectsResponse.data : [];
      const candidates = projects.filter(
        (project) => typeof project?.title === 'string' && project.title.startsWith(projectPrefix),
      );

      if (candidates.length === 0) {
        return;
      }

      console.warn(
        `[E2E cleanup][projects] Deleting ${candidates.length} project(s) with prefix "${projectPrefix}"`,
      );

      for (const project of candidates) {
        const id = project?.id ?? project?.projectId;
        if (!id) {
          console.warn(
            '[E2E cleanup][projects] Skipping project without id field:',
            project?.title,
          );
          continue;
        }

        try {
          const result = await api.project.delete(id, { deleteThreads: true });
          if (!result?.success) {
            console.warn(
              `[E2E cleanup][projects] Failed to delete project "${project.title}" (${id}):`,
              result?.errorText ?? 'Unknown error',
            );
          }
        } catch (error) {
          console.warn(
            `[E2E cleanup][projects] Error deleting project "${project.title}" (${id})`,
            error,
          );
        }
      }
    },
    { prefix },
  );
}

/**
 * Delete all threads whose title starts with the given prefix.
 * Uses window.electronAPI directly inside the renderer context.
 */
export async function deleteThreadsByPrefix(page: Page, prefix: string): Promise<void> {
  await page.evaluate(
    async ({ prefix: threadPrefix }) => {
      const api = (globalThis as any).electronAPI;

      if (!api?.thread?.getAll || !api?.thread?.delete) {
        console.warn('[E2E cleanup][threads] electronAPI.thread is not available');
        return;
      }

      let threadsResponse: any;
      try {
        threadsResponse = await api.thread.getAll();
      } catch (error) {
        console.warn('[E2E cleanup][threads] Failed to load threads for cleanup', error);
        return;
      }

      const threads: any[] = Array.isArray(threadsResponse?.data) ? threadsResponse.data : [];
      const candidates = threads.filter(
        (thread) => typeof thread?.title === 'string' && thread.title.startsWith(threadPrefix),
      );

      if (candidates.length === 0) {
        return;
      }

      console.warn(
        `[E2E cleanup][threads] Deleting ${candidates.length} thread(s) with prefix "${threadPrefix}"`,
      );

      for (const thread of candidates) {
        const id = thread?.id ?? thread?.threadId;
        if (!id) {
          console.warn('[E2E cleanup][threads] Skipping thread without id field:', thread?.title);
          continue;
        }

        try {
          const result = await api.thread.delete(id);
          if (!result?.success) {
            console.warn(
              `[E2E cleanup][threads] Failed to delete thread "${thread.title}" (${id}):`,
              result?.errorText ?? 'Unknown error',
            );
          }
        } catch (error) {
          console.warn(
            `[E2E cleanup][threads] Error deleting thread "${thread.title}" (${id})`,
            error,
          );
        }
      }
    },
    { prefix },
  );
}

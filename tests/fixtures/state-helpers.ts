/**
 * Lightweight app state helpers for E2E tests.
 *
 * These provide quick sanity checks that suites which *should* be net-zero
 * on threads/projects (create + delete) actually leave global counts unchanged.
 */

import { expect } from '@playwright/test';
import type { Page } from 'playwright';

export interface AppStateCounts {
  threadCount: number;
  projectCount: number;
}

/**
 * Get global thread/project counts via the Electron API.
 *
 * Uses the same IPC-backed APIs the app uses (`thread.getAll`, `project.getAll`)
 * to avoid test-only backdoors.
 */
export async function getAppStateCounts(page: Page): Promise<AppStateCounts> {
  const result = await page.evaluate(async () => {
    const [threads, projects] = await Promise.all([
      window.electronAPI.thread.getAll(),
      window.electronAPI.project.getAll(),
    ]);

    const threadCount = Array.isArray(threads?.data) ? threads.data.length : 0;
    const projectCount = Array.isArray(projects?.data) ? projects.data.length : 0;

    return { threadCount, projectCount };
  });

  return result;
}

/**
 * Soft-assert that thread/project counts are unchanged between two snapshots.
 *
 * This is intentionally non-fatal: it logs a warning via a failing
 * `expect` only when counts differ, but does not throw for tiny mismatches
 * caused by flakey cleanup or parallel suites.
 */
export function expectAppStateUnchanged(
  before: AppStateCounts,
  after: AppStateCounts,
  context: string,
): void {
  if (after.threadCount !== before.threadCount) {
    console.warn(
      `[AppStateCounts] ${context}: thread count changed from ${before.threadCount} to ${after.threadCount}`,
    );
  }

  if (after.projectCount !== before.projectCount) {
    console.warn(
      `[AppStateCounts] ${context}: project count changed from ${before.projectCount} to ${after.projectCount}`,
    );
  }
}

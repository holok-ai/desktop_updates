/**
 * Shared Project Helper Functions for E2E Tests
 *
 * Extracts duplicated project creation, deletion, toast dismissal,
 * and project navigation patterns from multiple spec files into
 * reusable helpers.
 *
 * Used by: project-instructions, project-members, project-view,
 *          project-thread, sidebar-favorites spec files.
 */

import { expect } from '@playwright/test';
import type { Page } from 'playwright';

/**
 * Create a project via the UI.
 *
 * Navigates to the Projects page, clicks New Project, fills the modal,
 * and waits for creation to complete. Dismisses any lingering toast
 * before opening the modal.
 *
 * @param page - Playwright Page object
 * @param name - Project name to use
 * @param type - Optional project type: 'Personal' (default) or 'Shared'
 */
export async function createProject(
  page: Page,
  name: string,
  type?: 'Personal' | 'Shared',
): Promise<void> {
  // Navigate to Projects page
  await page.locator('button[aria-label="Projects"]').click();

  // Wait for the projects page to fully render (header with New Project button)
  const newProjectBtn = page.locator('.projects-header button.btn-holokai');
  await expect(newProjectBtn).toBeVisible({ timeout: 15000 });

  // Wait for the project list to finish loading from the API
  // The page shows "Loading projects..." while fetching, then .projects-grid or .empty-state
  const loadingText = page.getByText('Loading projects...');
  await loadingText.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});

  // Ensure either the grid or empty state is visible before proceeding
  const readyState = page.locator('.projects-grid, .empty-state');
  await expect(readyState).toBeVisible({ timeout: 15000 });

  // Dismiss any lingering toast from prior test runs before opening the modal
  await dismissToast(page);

  // Open the create project modal
  await newProjectBtn.click();

  const modal = page.locator('div[role="dialog"][aria-labelledby="create-project-dialog-title"]');
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Fill in the project name
  await modal.locator('input#project-name').fill(name);

  // Select project type if specified
  if (type === 'Shared') {
    const sharedBtn = modal.locator('.type-button').filter({ hasText: 'Shared' });
    await sharedBtn.click();
  }

  // Submit and wait for modal to close (API call is async)
  await modal.locator('button.btn-primary').click();
  await expect(modal).not.toBeVisible({ timeout: 30000 });
}

/**
 * Delete a project by name via the UI context menu.
 *
 * Navigates to the Projects page, finds the project card, opens its
 * context menu, clicks Delete, and confirms the modal if shown.
 * Best-effort — does not throw if the project is not found or
 * deletion fails.
 *
 * @param page - Playwright Page object
 * @param name - Name of the project to delete
 */
export async function deleteProject(page: Page, name: string): Promise<void> {
  try {
    // Navigate to Projects page
    await page.locator('button[aria-label="Projects"]').click();

    const projectCard = page.locator('.project-card', { hasText: name });
    const isVisible = await projectCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      return; // Project not found — nothing to clean up
    }

    // Open the project context menu
    const menuBtn = projectCard.locator('button.project-menu-button');
    await menuBtn.click();

    const deleteItem = projectCard.locator('.menu-item', { hasText: 'Delete Project' });
    await expect(deleteItem).toBeVisible({ timeout: 3000 });
    await deleteItem.click();

    // Handle the optional delete confirmation modal
    const deleteModal = page.locator('div[role="dialog"][aria-labelledby="delete-dialog-title"]');
    const modalVisible = await deleteModal.isVisible({ timeout: 2000 }).catch(() => false);

    if (modalVisible) {
      await deleteModal.locator('button.btn-danger').click();
      await expect(deleteModal).not.toBeVisible({ timeout: 10000 });
    }
  } catch {
    // Cleanup is best-effort — do not throw
  }
}

/**
 * Dismiss a visible toast notification by waiting for it to auto-hide.
 *
 * No-op if no toast is currently visible. Uses a catch fallback so it
 * never throws even if the toast doesn't disappear within the timeout.
 *
 * @param page - Playwright Page object
 */
export async function dismissToast(page: Page): Promise<void> {
  const toast = page.locator('.toast');
  const isVisible = await toast.isVisible({ timeout: 1000 }).catch(() => false);

  if (isVisible) {
    await toast.waitFor({ state: 'hidden', timeout: 6000 }).catch(() => {});
  }
}

/**
 * Navigate into a project by clicking its card from the projects list.
 *
 * Assumes the page is already on the Projects page (or navigates there).
 * Waits for the project view URL to contain `projectId=`.
 *
 * @param page - Playwright Page object
 * @param name - Name of the project to open
 */
export async function openProject(page: Page, name: string): Promise<void> {
  const projectCard = page.locator('.project-card', { hasText: name });
  await expect(projectCard).toBeVisible({ timeout: 10000 });
  await projectCard.click();
  await expect(page).toHaveURL(/projectId=/, { timeout: 15000 });
}

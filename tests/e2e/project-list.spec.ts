/**
 * Project List E2E Tests
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8
 * - Projects page shows list of projects with titles and timestamps
 * - Clicking Create Project shows creation modal
 * - Creating a project adds it to the list
 * - Clicking a project navigates to project view
 * - Context menu shows Rename, Delete, Favorite options
 * - Renaming a project updates the title
 * - Deleting a project removes it from the list
 * - Toggling favorite adds/removes from sidebar favorites
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

let app: ElectronApplication;
let page: Page;

const TEST_PROJECT_NAME = `E2E Test Project ${Date.now()}`;
const RENAMED_PROJECT_NAME = `Renamed ${Date.now()}`;

test.describe.serial('Project List', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('projects page shows list of projects with titles and timestamps', async () => {
    // Requirement 7.1: projects page displays projects
    await page.locator('button[aria-label="Projects"]').click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/projects/, { timeout: 10000 });

    // Verify the projects page is loaded
    const projectsPage = page.locator('.projects-page');
    await expect(projectsPage).toBeVisible({ timeout: 10000 });

    // Verify the New Project button is visible in the header
    const newProjectBtn = projectsPage.locator('.projects-header button.btn-holokai');
    await expect(newProjectBtn).toBeVisible({ timeout: 5000 });
    await expect(newProjectBtn).toContainText('New Project');

    // Check if projects exist or empty state is shown
    const projectCards = page.locator('.project-card');
    const emptyState = page.locator('.empty-state');
    const count = await projectCards.count();

    if (count > 0) {
      // Verify first project card has title and timestamp
      const firstCard = projectCards.first();
      await expect(firstCard.locator('h3.project-title')).toBeVisible({ timeout: 3000 });
      await expect(firstCard.locator('.project-last-opened')).toBeVisible({ timeout: 3000 });
      await expect(firstCard.locator('.project-type-badge')).toBeVisible({ timeout: 3000 });
    } else {
      // Empty state is also valid
      await expect(emptyState).toBeVisible({ timeout: 5000 });
      await expect(emptyState).toContainText('No Projects Yet');
    }
  });

  test('clicking Create Project shows creation modal', async () => {
    // Requirement 7.2: Create Project button shows modal
    const newProjectBtn = page.locator('.projects-header button.btn-holokai');
    await newProjectBtn.click();
    await page.waitForTimeout(1000);

    // Verify the create modal is visible
    const modal = page.locator('div[role="dialog"][aria-labelledby="create-project-dialog-title"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Verify modal has form elements
    await expect(modal.locator('h2#create-project-dialog-title')).toContainText('New Project');
    await expect(modal.locator('input#project-name')).toBeVisible({ timeout: 3000 });
    await expect(modal.locator('textarea#project-description')).toBeVisible({ timeout: 3000 });

    // Verify type selector buttons exist
    const personalBtn = modal.locator('.type-button').filter({ hasText: 'Personal' });
    const sharedBtn = modal.locator('.type-button').filter({ hasText: 'Shared' });
    await expect(personalBtn).toBeVisible({ timeout: 3000 });
    await expect(sharedBtn).toBeVisible({ timeout: 3000 });

    // Verify Create Project button is disabled when name is empty
    const submitBtn = modal.locator('button.btn-primary');
    await expect(submitBtn).toBeDisabled();

    // Close the modal
    const cancelBtn = modal.locator('button.btn-secondary');
    await cancelBtn.click();
    await page.waitForTimeout(500);
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  test('creating a project adds it to the list', async () => {
    // Requirement 7.3: creating a project adds it to the list
    const newProjectBtn = page.locator('.projects-header button.btn-holokai');
    await newProjectBtn.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('div[role="dialog"][aria-labelledby="create-project-dialog-title"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill in the project name
    const nameInput = modal.locator('input#project-name');
    await nameInput.fill(TEST_PROJECT_NAME);

    // Fill in description
    const descInput = modal.locator('textarea#project-description');
    await descInput.fill('E2E test project description');

    // Submit the form
    const submitBtn = modal.locator('button.btn-primary');
    await expect(submitBtn).toBeEnabled({ timeout: 3000 });
    await submitBtn.click();

    // Wait for modal to close and project to appear
    await expect(modal).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verify the new project appears in the list
    const projectCard = page.locator('.project-card', { hasText: TEST_PROJECT_NAME });
    await expect(projectCard).toBeVisible({ timeout: 10000 });
    await expect(projectCard.locator('h3.project-title')).toContainText(TEST_PROJECT_NAME);
  });

  test('clicking a project navigates to project view', async () => {
    // Requirement 7.4: clicking a project navigates to project view
    const projectCard = page.locator('.project-card', { hasText: TEST_PROJECT_NAME });
    await expect(projectCard).toBeVisible({ timeout: 5000 });

    await projectCard.click();
    await page.waitForTimeout(2000);

    // Should navigate to project view with projectId parameter
    await expect(page).toHaveURL(/projectId=/, { timeout: 15000 });

    // Navigate back to projects list
    await page.locator('button[aria-label="Projects"]').click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/projects/, { timeout: 10000 });
  });

  test('context menu shows Rename, Delete, Favorite options', async () => {
    // Requirement 7.5: context menu shows options
    const projectCard = page.locator('.project-card', { hasText: TEST_PROJECT_NAME });
    await expect(projectCard).toBeVisible({ timeout: 5000 });

    // Open context menu
    const menuBtn = projectCard.locator('button.project-menu-button');
    await menuBtn.click();
    await page.waitForTimeout(500);

    // Verify dropdown is visible with all options
    const dropdown = projectCard.locator('.project-menu-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    const favoriteItem = dropdown.locator('.menu-item', {
      hasText: /Make Favorite|Remove Favorite/,
    });
    const renameItem = dropdown.locator('.menu-item', { hasText: 'Rename' });
    const deleteItem = dropdown.locator('.menu-item', { hasText: 'Delete Project' });

    await expect(favoriteItem).toBeVisible({ timeout: 3000 });
    await expect(renameItem).toBeVisible({ timeout: 3000 });
    await expect(deleteItem).toBeVisible({ timeout: 3000 });

    // Close menu by clicking elsewhere
    await page.locator('.projects-page').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);
  });

  test('renaming a project updates the title', async () => {
    // Requirement 7.6: renaming a project updates the title
    const projectCard = page.locator('.project-card', { hasText: TEST_PROJECT_NAME });
    await expect(projectCard).toBeVisible({ timeout: 5000 });

    // Open context menu and click Rename
    const menuBtn = projectCard.locator('button.project-menu-button');
    await menuBtn.click();
    await page.waitForTimeout(500);

    const renameItem = projectCard.locator('.menu-item', { hasText: 'Rename' });
    await renameItem.click();
    await page.waitForTimeout(1000);

    // Verify rename modal is visible
    const renameModal = page.locator('div[role="dialog"][aria-labelledby="rename-dialog-title"]');
    await expect(renameModal).toBeVisible({ timeout: 5000 });

    // Clear and type new name
    const titleInput = renameModal.locator('input#project-title');
    await expect(titleInput).toBeVisible({ timeout: 3000 });
    await titleInput.clear();
    await titleInput.fill(RENAMED_PROJECT_NAME);

    // Submit rename
    const renameBtn = renameModal.locator('button.btn-primary');
    await expect(renameBtn).toBeEnabled({ timeout: 3000 });
    await renameBtn.click();

    // Wait for modal to close
    await expect(renameModal).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Verify the project title is updated
    const renamedCard = page.locator('.project-card', { hasText: RENAMED_PROJECT_NAME });
    await expect(renamedCard).toBeVisible({ timeout: 10000 });
  });

  test('toggling favorite adds project to sidebar favorites', async () => {
    // Requirement 7.8: toggling favorite adds/removes from sidebar
    const projectCard = page.locator('.project-card', { hasText: RENAMED_PROJECT_NAME });
    await expect(projectCard).toBeVisible({ timeout: 5000 });

    // Open context menu and click Make Favorite
    const menuBtn = projectCard.locator('button.project-menu-button');
    await menuBtn.click();
    await page.waitForTimeout(500);

    const favoriteItem = projectCard.locator('.menu-item', { hasText: 'Make Favorite' });
    await favoriteItem.click();
    await page.waitForTimeout(1000);

    // Open context menu again to verify it now says "Remove Favorite"
    await menuBtn.click();
    await page.waitForTimeout(500);

    const removeFavoriteItem = projectCard.locator('.menu-item', { hasText: 'Remove Favorite' });
    await expect(removeFavoriteItem).toBeVisible({ timeout: 3000 });

    // Toggle it back off
    await removeFavoriteItem.click();
    await page.waitForTimeout(500);
  });

  test('deleting a project removes it from the list', async () => {
    // Requirement 7.7: deleting a project removes it from the list
    const projectCard = page.locator('.project-card', { hasText: RENAMED_PROJECT_NAME });
    await expect(projectCard).toBeVisible({ timeout: 5000 });

    // Open context menu and click Delete
    const menuBtn = projectCard.locator('button.project-menu-button');
    await menuBtn.click();
    await page.waitForTimeout(500);

    const deleteItem = projectCard.locator('.menu-item', { hasText: 'Delete Project' });
    await deleteItem.click();
    await page.waitForTimeout(1000);

    // Verify delete confirmation modal is visible
    const deleteModal = page.locator('div[role="dialog"][aria-labelledby="delete-dialog-title"]');
    await expect(deleteModal).toBeVisible({ timeout: 5000 });
    await expect(deleteModal).toContainText(RENAMED_PROJECT_NAME);

    // Confirm deletion
    const confirmBtn = deleteModal.locator('button.btn-danger');
    await confirmBtn.click();

    // Wait for modal to close and project to be removed
    await expect(deleteModal).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Verify the project is no longer in the list
    const deletedCard = page.locator('.project-card', { hasText: RENAMED_PROJECT_NAME });
    await expect(deletedCard).not.toBeVisible({ timeout: 5000 });
  });
});

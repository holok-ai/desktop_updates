/**
 * Project View and Navigation E2E Tests
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 * - Project view shows header with project title
 * - Navigation cards for Members, Files, Instructions are visible
 * - Clicking Members card navigates to members page
 * - Clicking Files card navigates to files page
 * - Clicking Instructions card navigates to instructions page
 *
 * Note: The project view uses a two-column layout with clickable info cards
 * (Members, Files, Instructions) rather than traditional tabs.
 * We first create a project, then navigate into it for testing.
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

let app: ElectronApplication;
let page: Page;

const TEST_PROJECT_NAME = `E2E View Project ${Date.now()}`;

test.describe.serial('Project View and Navigation', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Create a test project to navigate into
    await page.locator('button[aria-label="Projects"]').click();
    await page.waitForTimeout(2000);

    const newProjectBtn = page.locator('.projects-header button.btn-holokai');
    await newProjectBtn.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('div[role="dialog"][aria-labelledby="create-project-dialog-title"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    await modal.locator('input#project-name').fill(TEST_PROJECT_NAME);
    await modal.locator('button.btn-primary').click();
    await expect(modal).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Click the newly created project to navigate to its view
    const projectCard = page.locator('.project-card', { hasText: TEST_PROJECT_NAME });
    await expect(projectCard).toBeVisible({ timeout: 10000 });
    await projectCard.click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/projectId=/, { timeout: 15000 });
  });

  test.afterAll(async () => {
    // Clean up: delete the test project
    try {
      await page.locator('button[aria-label="Projects"]').click();
      await page.waitForTimeout(2000);

      const projectCard = page.locator('.project-card', { hasText: TEST_PROJECT_NAME });
      if (await projectCard.isVisible()) {
        const menuBtn = projectCard.locator('button.project-menu-button');
        await menuBtn.click();
        await page.waitForTimeout(500);

        const deleteItem = projectCard.locator('.menu-item', { hasText: 'Delete Project' });
        await deleteItem.click();
        await page.waitForTimeout(1000);

        const deleteModal = page.locator(
          'div[role="dialog"][aria-labelledby="delete-dialog-title"]',
        );
        if (await deleteModal.isVisible()) {
          await deleteModal.locator('button.btn-danger').click();
          await page.waitForTimeout(2000);
        }
      }
    } catch {
      // Cleanup is best-effort
    }
    await app?.close();
  });

  test('project view shows header with project title', async () => {
    // Requirement 8.1: project view displays project header with title
    const projectPage = page.locator('.project-page');
    await expect(projectPage).toBeVisible({ timeout: 15000 });

    // Verify the project title is displayed
    const titleRow = projectPage.locator('.title-row h2');
    await expect(titleRow).toBeVisible({ timeout: 5000 });
    await expect(titleRow).toContainText(TEST_PROJECT_NAME);

    // Verify the favorite star button is present
    const favStar = projectPage.locator('.favorite-star');
    await expect(favStar).toBeAttached({ timeout: 3000 });
  });

  test('navigation cards show Members, Files, Instructions sections', async () => {
    // Requirement 8.2: project view displays navigation sections
    const rightColumn = page.locator('.right-column');
    await expect(rightColumn).toBeVisible({ timeout: 5000 });

    // Verify all three info cards are visible
    const membersCard = rightColumn.locator('.info-card', { hasText: 'Members' });
    const filesCard = rightColumn.locator('.info-card', { hasText: 'Files' });
    const instructionsCard = rightColumn.locator('.info-card', { hasText: 'Instructions' });

    await expect(membersCard).toBeVisible({ timeout: 3000 });
    await expect(filesCard).toBeVisible({ timeout: 3000 });
    await expect(instructionsCard).toBeVisible({ timeout: 3000 });

    // Verify the prompt input area is visible in the left column
    const promptInput = page.locator('.prompt-input');
    await expect(promptInput).toBeVisible({ timeout: 3000 });
  });

  test('clicking Members card navigates to members page', async () => {
    // Requirement 8.3: clicking Members navigates to project members page
    const membersCard = page.locator('.right-column .info-card', { hasText: 'Members' });
    await membersCard.click();
    await page.waitForTimeout(2000);

    await expect(page).toHaveURL(/\/project\/members\?projectId=/, { timeout: 10000 });

    // Navigate back to project view
    await page.goBack();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/projects\/view\?projectId=/, { timeout: 10000 });
    await expect(page.locator('.project-page')).toBeVisible({ timeout: 10000 });
  });

  test('clicking Files card navigates to files page', async () => {
    // Requirement 8.4: clicking Files navigates to project files page
    const filesCard = page.locator('.right-column .info-card', { hasText: 'Files' });
    await filesCard.click();
    await page.waitForTimeout(2000);

    await expect(page).toHaveURL(/\/project\/files\?projectId=/, { timeout: 10000 });

    // Navigate back to project view
    await page.goBack();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/projects\/view\?projectId=/, { timeout: 10000 });
    await expect(page.locator('.project-page')).toBeVisible({ timeout: 10000 });
  });

  test('clicking Instructions card navigates to instructions page', async () => {
    // Requirement 8.5: clicking Instructions navigates to project instructions page
    const instructionsCard = page.locator('.right-column .info-card', { hasText: 'Instructions' });
    await instructionsCard.click();
    await page.waitForTimeout(2000);

    await expect(page).toHaveURL(/\/project\/instructions\?projectId=/, { timeout: 10000 });

    // Navigate back to project view
    await page.goBack();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/projects\/view\?projectId=/, { timeout: 10000 });
    await expect(page.locator('.project-page')).toBeVisible({ timeout: 10000 });
  });
});

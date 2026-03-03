/**
 * Project Thread Route E2E Tests
 *
 * Validates: Requirements 8.1, 8.2, 8.3
 *
 * Tests project thread route navigation including:
 * - Navigating to a project thread renders the thread view with chat pane and sidebar keeps "Projects" selected
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import { createThreadViaUI } from '../fixtures/thread-context-menu-helpers';

let app: ElectronApplication;
let page: Page;

const TEST_PROJECT_NAME = `E2E Thread Project ${Date.now()}`;

test.describe.serial('Project Thread Route', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });

  test.afterAll(async () => {
    // Clean up: navigate to projects list and delete the test project
    try {
      await page.locator('button[aria-label="Projects"]').click();
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/\/projects/, { timeout: 10000 });

      const projectCard = page.locator('.project-card', { hasText: TEST_PROJECT_NAME });
      const exists = await projectCard.isVisible({ timeout: 5000 }).catch(() => false);

      if (exists) {
        const menuBtn = projectCard.locator('button.project-menu-button');
        await menuBtn.click();
        await page.waitForTimeout(500);

        const deleteItem = projectCard.locator('.menu-item', { hasText: 'Delete Project' });
        await deleteItem.click();
        await page.waitForTimeout(1000);

        // Handle optional confirmation modal
        const deleteModal = page.locator(
          'div[role="dialog"][aria-labelledby="delete-dialog-title"]',
        );
        const modalVisible = await deleteModal.isVisible().catch(() => false);
        if (modalVisible) {
          const confirmBtn = deleteModal.locator('button.btn-danger');
          await confirmBtn.click();
          await expect(deleteModal).not.toBeVisible({ timeout: 10000 });
        }
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.error('[E2E Cleanup] Failed to delete test project:', e);
    }

    await app?.close();
  });

  // ─── Requirements 8.1, 8.2, 8.3: Navigate to project thread, verify chat pane and sidebar ───

  test('creating a project thread via UI and navigating renders the chat view with Projects selected', async () => {
    test.setTimeout(90000);

    // Step 1: Navigate to Projects page
    await page.locator('button[aria-label="Projects"]').click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/projects/, { timeout: 10000 });

    // Step 2: Create a new project via UI
    const newProjectBtn = page.locator('.projects-header button.btn-holokai');
    await expect(newProjectBtn).toBeVisible({ timeout: 5000 });
    await newProjectBtn.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('div[role="dialog"][aria-labelledby="create-project-dialog-title"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const nameInput = modal.locator('input#project-name');
    await nameInput.fill(TEST_PROJECT_NAME);

    const submitBtn = modal.locator('button.btn-primary');
    await expect(submitBtn).toBeEnabled({ timeout: 3000 });
    await submitBtn.click();

    await expect(modal).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Step 3: Click the newly created project to open it
    const projectCard = page.locator('.project-card', { hasText: TEST_PROJECT_NAME });
    await expect(projectCard).toBeVisible({ timeout: 10000 });
    await projectCard.click();
    await page.waitForTimeout(3000);

    // Should be on project view page with projectId in URL
    await expect(page).toHaveURL(/projectId=/, { timeout: 15000 });

    // Step 4: Extract projectId from the URL
    const projectUrl = page.url();
    const projectIdMatch = projectUrl.match(/projectId=([^&]+)/);
    expect(projectIdMatch).toBeTruthy();
    const projectId = projectIdMatch![1];

    // Step 5: Navigate to threads first, then create a thread via the UI
    // createThreadViaUI expects to start from a page where the "+ New Thread" button
    // leads to the /threads/applications route with application cards visible.
    await page.locator('button[aria-label="Threads"]').click();
    await page.waitForTimeout(2000);
    await createThreadViaUI(page);

    // Extract threadId from the URL after thread creation
    const threadUrl = page.url();
    const threadIdMatch = threadUrl.match(/threadId=([^&]+)/);
    expect(threadIdMatch).toBeTruthy();
    const threadId = threadIdMatch![1];

    // Step 6: Navigate to the project-thread route
    await page.evaluate(
      ({ tId, pId }: { tId: string; pId: string }) => {
        window.location.hash = `/project/thread?threadId=${tId}&projectId=${pId}`;
      },
      { tId: threadId, pId: projectId },
    );

    await page.waitForTimeout(3000);

    // Step 7: Verify URL contains both threadId and projectId
    await expect(page).toHaveURL(/threadId=/, { timeout: 15000 });
    await expect(page).toHaveURL(/projectId=/, { timeout: 5000 });

    // Step 8: Verify the chat view is visible
    const chatView = page.locator('.thread-chat-view');
    await expect(chatView).toBeVisible({ timeout: 30000 });

    // Step 9: Verify sidebar keeps "Projects" selected
    const projectsButton = page.locator('button[aria-label="Projects"]');
    await expect(projectsButton).toBeVisible({ timeout: 5000 });

    const selectedButton = page.locator('.nav-button.selected');
    await expect(selectedButton).toBeVisible({ timeout: 5000 });

    const selectedLabel = await selectedButton.getAttribute('aria-label');
    expect(selectedLabel).toBe('Projects');
  });
});

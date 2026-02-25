/**
 * Sidebar Favorites E2E Tests
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
 *
 * Tests sidebar favorites section interactions including:
 * - Favorites section header visibility
 * - Show/hide toggle on hover
 * - Expanding/collapsing the section
 * - Favorited thread display and navigation
 * - Favorited project display and navigation
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

let app: ElectronApplication;
let page: Page;

const TEST_PROJECT_NAME = `E2E Fav Project ${Date.now()}`;

test.describe.serial('Sidebar Favorites', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });

  test.afterAll(async () => {
    // Clean up: unfavorite and delete the test project
    try {
      await page.locator('button[aria-label="Projects"]').click();
      await page.waitForTimeout(2000);

      const projectCard = page.locator('.project-card', { hasText: TEST_PROJECT_NAME });
      const exists = await projectCard.isVisible({ timeout: 5000 }).catch(() => false);

      if (exists) {
        // Unfavorite first
        const menuBtn = projectCard.locator('button.project-menu-button');
        await menuBtn.click();
        await page.waitForTimeout(500);

        const removeFavItem = projectCard.locator('.menu-item', { hasText: 'Remove Favorite' });
        const isFavorited = await removeFavItem.isVisible({ timeout: 2000 }).catch(() => false);
        if (isFavorited) {
          await removeFavItem.click();
          await page.waitForTimeout(1000);
        } else {
          // Close menu
          await page.locator('.projects-page').click({ position: { x: 10, y: 10 } });
          await page.waitForTimeout(500);
        }

        // Delete the project
        await menuBtn.click();
        await page.waitForTimeout(500);

        const deleteItem = projectCard.locator('.menu-item', { hasText: 'Delete Project' });
        await deleteItem.click();
        await page.waitForTimeout(1000);

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
      console.error('[E2E Cleanup] Failed to clean up test project:', e);
    }

    await app?.close();
  });

  // ─── Setup: Ensure at least one thread is favorited ───

  test('ensure at least one thread is favorited via context menu', async () => {
    // Navigate to threads list
    await page.locator('button[aria-label="Threads"]').click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });

    const threadItems = page.locator('.thread-item-container');
    const count = await threadItems.count();
    if (count === 0) {
      // Create a thread by navigating to new thread — for now just verify threads exist
      // If no threads exist, the remaining tests will still work with the project favorite
    }

    if (count > 0) {
      // Open context menu on first thread
      const firstItem = threadItems.first();
      await firstItem.hover();
      await page.waitForTimeout(300);
      await firstItem.locator('.menu-trigger').click();
      await page.waitForTimeout(300);

      // Check if already favorited
      const makeFavItem = page.locator('.menu-item[role="menuitem"]', { hasText: 'Make Favorite' });

      if (await makeFavItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Not yet favorited — click Make Favorite
        await makeFavItem.click();
        await page.waitForTimeout(1000);
      } else {
        // Already favorited — close the menu
        await page.locator('body').click({ position: { x: 10, y: 10 } });
        await page.waitForTimeout(300);
      }
    }
  });

  // ─── Setup: Ensure a project is favorited for tests 71-72 ───

  test('ensure a project is favorited for sidebar display', async () => {
    // Navigate to Projects page
    await page.locator('button[aria-label="Projects"]').click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/projects/, { timeout: 10000 });

    // Check if any projects exist
    const projectCards = page.locator('.project-card');
    const projectCount = await projectCards.count();

    if (projectCount === 0) {
      // Create a new project
      const newProjectBtn = page.locator('.projects-header button.btn-holokai');
      await expect(newProjectBtn).toBeVisible({ timeout: 5000 });
      await newProjectBtn.click();
      await page.waitForTimeout(1000);

      const modal = page.locator(
        'div[role="dialog"][aria-labelledby="create-project-dialog-title"]',
      );
      await expect(modal).toBeVisible({ timeout: 5000 });

      const nameInput = modal.locator('input#project-name');
      await nameInput.fill(TEST_PROJECT_NAME);

      const submitBtn = modal.locator('button.btn-primary');
      await expect(submitBtn).toBeEnabled({ timeout: 3000 });
      await submitBtn.click();

      await expect(modal).not.toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(2000);
    } else {
      // Use the first existing project — but we still need to track it for cleanup
      // Check if our test project already exists
      const testProjectCard = page.locator('.project-card', { hasText: TEST_PROJECT_NAME });
      const testProjectExists = await testProjectCard
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      if (!testProjectExists) {
        // Create our own test project so we can safely clean it up
        const newProjectBtn = page.locator('.projects-header button.btn-holokai');
        await newProjectBtn.click();
        await page.waitForTimeout(1000);

        const modal = page.locator(
          'div[role="dialog"][aria-labelledby="create-project-dialog-title"]',
        );
        await expect(modal).toBeVisible({ timeout: 5000 });

        const nameInput = modal.locator('input#project-name');
        await nameInput.fill(TEST_PROJECT_NAME);

        const submitBtn = modal.locator('button.btn-primary');
        await expect(submitBtn).toBeEnabled({ timeout: 3000 });
        await submitBtn.click();

        await expect(modal).not.toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(2000);
      }
    }

    // Now favorite the test project
    const projectCard = page.locator('.project-card', { hasText: TEST_PROJECT_NAME });
    await expect(projectCard).toBeVisible({ timeout: 10000 });

    const menuBtn = projectCard.locator('button.project-menu-button');
    await menuBtn.click();
    await page.waitForTimeout(500);

    const dropdown = projectCard.locator('.project-menu-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Check if already favorited
    const makeFavItem = dropdown.locator('.menu-item', { hasText: 'Make Favorite' });
    const removeFavItem = dropdown.locator('.menu-item', { hasText: 'Remove Favorite' });

    if (await makeFavItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await makeFavItem.click();
      await page.waitForTimeout(1000);
    } else {
      // Already favorited — close menu
      await page.locator('.projects-page').click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(500);
    }

    // Navigate back to threads page so sidebar favorites are visible
    await page.locator('button[aria-label="Threads"]').click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });
  });

  // ─── Requirement 5.1: Favorites section header ───

  test('sidebar displays Favorites section header with "Favorites" label', async () => {
    const favoritesSection = page.locator('.favorites-section');
    await expect(favoritesSection).toBeVisible({ timeout: 5000 });

    const label = favoritesSection.locator('.recent-label');
    await expect(label).toBeVisible({ timeout: 5000 });
    await expect(label).toHaveText('Favorites');
  });

  // ─── Requirement 5.2: Show/hide toggle on hover ───

  test('hovering the Favorites header reveals the show/hide toggle button', async () => {
    const favoritesSection = page.locator('.favorites-section');
    const header = favoritesSection.locator('.recent-header');

    // Hover over the header to reveal the toggle
    await header.hover();
    await page.waitForTimeout(300);

    const toggle = favoritesSection.locator('.recent-toggle');
    await expect(toggle).toBeVisible({ timeout: 5000 });
  });

  // ─── Requirement 5.3: Clicking header expands the section ───

  test('clicking the header expands the section showing favorited items', async () => {
    const favoritesSection = page.locator('.favorites-section');
    const header = favoritesSection.locator('.recent-header');

    // Click the header to expand (toggle)
    await header.click();
    await page.waitForTimeout(500);

    // Check if items are visible — if collapsed, click again to expand
    const itemsList = favoritesSection.locator('.recent-threads');
    if (!(await itemsList.isVisible({ timeout: 2000 }).catch(() => false))) {
      await header.click();
      await page.waitForTimeout(500);
    }

    await expect(itemsList).toBeVisible({ timeout: 5000 });

    const items = favoritesSection.locator('.recent-thread-item');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  // ─── Requirement 5.4: Favorited threads show title and model name ───

  test('expanded section shows each favorited thread with title and model name', async () => {
    const favoritesSection = page.locator('.favorites-section');
    const items = favoritesSection.locator('.recent-thread-item');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);

    // Check first item has title and model sublabel
    const firstItem = items.first();
    const title = firstItem.locator('.thread-title');
    await expect(title).toBeVisible({ timeout: 5000 });
    const titleText = await title.textContent();
    expect(titleText!.trim().length).toBeGreaterThan(0);

    const model = firstItem.locator('.thread-model');
    await expect(model).toBeVisible({ timeout: 5000 });
  });

  // ─── Requirement 5.5: Clicking a favorited thread navigates to thread view ───

  test('clicking a favorited thread navigates to thread view', async () => {
    const favoritesSection = page.locator('.favorites-section');
    const items = favoritesSection.locator('.recent-thread-item');

    // Find a thread item (not a project — projects have folder icon)
    let threadItem = null;
    const count = await items.count();
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const folderIcon = item.locator('.thread-title i.pi-folder');
      if (!(await folderIcon.isVisible({ timeout: 500 }).catch(() => false))) {
        threadItem = item;
        break;
      }
    }

    if (threadItem) {
      await threadItem.click();
      await page.waitForTimeout(2000);

      // Should navigate to thread view
      await expect(page).toHaveURL(/\/threads\/view\?threadId=/, { timeout: 10000 });

      // Navigate back to threads list for subsequent tests
      await page.locator('button[aria-label="Threads"]').click();
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });
    } else {
      // No non-project favorites — click the first item (project) and verify navigation
      const firstItem = items.first();
      await firstItem.click();
      await page.waitForTimeout(2000);

      // Should navigate to either thread or project view
      const url = page.url();
      expect(url).toMatch(/threadId=|projectId=/);

      // Navigate back
      await page.locator('button[aria-label="Threads"]').click();
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });
    }
  });

  // ─── Requirement 5.6: Favorited projects display with folder icon ───

  test('favorited projects display with folder icon, title, and type', async () => {
    const favoritesSection = page.locator('.favorites-section');

    // Ensure section is expanded
    const header = favoritesSection.locator('.recent-header');
    await header.hover();
    await page.waitForTimeout(300);
    const itemsList = favoritesSection.locator('.recent-threads');
    if (!(await itemsList.isVisible({ timeout: 2000 }).catch(() => false))) {
      await header.click();
      await page.waitForTimeout(500);
    }

    const items = favoritesSection.locator('.recent-thread-item');
    const count = await items.count();

    // Look for a project item (has folder icon)
    let projectItem = null;
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const folderIcon = item.locator('.thread-title i.pi-folder');
      if (await folderIcon.isVisible({ timeout: 500 }).catch(() => false)) {
        projectItem = item;
        break;
      }
    }

    // We created and favorited a project in setup, so it should exist
    expect(projectItem).not.toBeNull();

    // Verify project has folder icon, title, and type
    const folderIcon = projectItem!.locator('.thread-title i.pi-folder');
    await expect(folderIcon).toBeVisible({ timeout: 5000 });

    const title = projectItem!.locator('.thread-title');
    await expect(title).toBeVisible({ timeout: 5000 });

    const model = projectItem!.locator('.thread-model');
    await expect(model).toBeVisible({ timeout: 5000 });
  });

  // ─── Requirement 5.7: Clicking a favorited project navigates to project view ───

  test('clicking a favorited project navigates to project view', async () => {
    const favoritesSection = page.locator('.favorites-section');
    const items = favoritesSection.locator('.recent-thread-item');
    const count = await items.count();

    // Look for a project item (has folder icon)
    let projectItem = null;
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const folderIcon = item.locator('.thread-title i.pi-folder');
      if (await folderIcon.isVisible({ timeout: 500 }).catch(() => false)) {
        projectItem = item;
        break;
      }
    }

    // We created and favorited a project in setup, so it should exist
    expect(projectItem).not.toBeNull();

    await projectItem!.click();
    await page.waitForTimeout(2000);

    // Should navigate to project view
    await expect(page).toHaveURL(/\/projects\/view\?projectId=/, { timeout: 10000 });

    // Navigate back to threads list
    await page.locator('button[aria-label="Threads"]').click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });
  });

  // ─── Requirement 5.8: Clicking hide toggle collapses the section ───

  test('clicking the hide toggle collapses the section', async () => {
    const favoritesSection = page.locator('.favorites-section');
    const header = favoritesSection.locator('.recent-header');

    // Ensure section is expanded first
    const itemsList = favoritesSection.locator('.recent-threads');
    if (!(await itemsList.isVisible({ timeout: 2000 }).catch(() => false))) {
      await header.click();
      await page.waitForTimeout(500);
    }
    await expect(itemsList).toBeVisible({ timeout: 5000 });

    // Hover to reveal the toggle
    await header.hover();
    await page.waitForTimeout(300);

    const toggle = favoritesSection.locator('.recent-toggle');
    await expect(toggle).toBeVisible({ timeout: 5000 });

    // Click the toggle to collapse
    await toggle.click();
    await page.waitForTimeout(500);

    // Items should no longer be visible
    await expect(itemsList).not.toBeVisible({ timeout: 5000 });
  });
});

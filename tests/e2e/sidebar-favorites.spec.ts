/**
 * Sidebar Favorites E2E Tests
 * Validates: Requirements 5.1–5.8
 *
 * Note: The favorite toggle behavior (Make/Remove Favorite) is tested in
 * thread-favorite.spec.ts. This file sets up favorite state as a precondition
 * for testing sidebar display and navigation.
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Locator, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import { createProject, deleteProject } from '../fixtures/project-helpers';
import {
  getAppStateCounts,
  expectAppStateUnchanged,
  type AppStateCounts,
} from '../fixtures/state-helpers';

let app: ElectronApplication;
let page: Page;

const TEST_PROJECT_NAME = `E2E Favorites Project ${Date.now()}`;
let createdProject = false;
/** Ids we favorited during setup — cleanup only unfavorites these. */
let favoritedThreadId: string | null = null;
let favoritedProjectId: string | null = null;
let initialCounts: AppStateCounts | null = null;

/**
 * Precondition helper: ensure at least one thread is favorited.
 * Tracks the thread we favorited so cleanup only unfavorites that one.
 */
async function ensureThreadFavorited(page: Page): Promise<void> {
  await page.locator('button[aria-label="Threads"]').click();
  await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });

  const threadItems = page.locator('.thread-item-container');
  const count = await threadItems.count();
  if (count === 0) return;

  const firstItem = threadItems.first();
  favoritedThreadId = await firstItem.getAttribute('data-thread-id');
  await firstItem.hover();
  const menuTrigger = firstItem.locator('.menu-trigger');
  await expect(menuTrigger).toBeVisible({ timeout: 5000 });
  await menuTrigger.click();

  const makeFavItem = page.locator('.menu-item[role="menuitem"]', { hasText: 'Make Favorite' });
  const needsFavorite = await makeFavItem.isVisible({ timeout: 2000 }).catch(() => false);

  if (needsFavorite) {
    await makeFavItem.click();
    await expect(page.locator('.favorites-section')).toBeVisible({ timeout: 5000 });
  } else {
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.context-menu[role="menu"]'))
      .not.toBeVisible({ timeout: 3000 })
      .catch(() => {});
  }
}

/**
 * Precondition helper: ensure a project is favorited for sidebar display tests.
 * Creates a project if none exist, then favorites it via the context menu.
 */
async function ensureProjectFavorited(page: Page): Promise<void> {
  await page.locator('button[aria-label="Projects"]').click();
  const newProjectBtn = page.locator('.projects-header button.btn-holokai');
  await expect(newProjectBtn).toBeVisible({ timeout: 15000 });

  const projectCards = page.locator('.project-card');
  const count = await projectCards.count();

  if (count === 0) {
    await createProject(page, TEST_PROJECT_NAME);
    createdProject = true;
  }

  // Pick the first project and favorite it; track its id for cleanup
  const projectCard = page.locator('.project-card').first();
  favoritedProjectId = await projectCard.getAttribute('data-project-id');
  const menuBtn = projectCard.locator('button.project-menu-button');
  await menuBtn.click();

  const dropdown = projectCard.locator('.project-menu-dropdown');
  await expect(dropdown).toBeVisible({ timeout: 3000 });

  const makeFavItem = dropdown.locator('.menu-item', { hasText: 'Make Favorite' });
  const needsFavorite = await makeFavItem.isVisible({ timeout: 2000 }).catch(() => false);

  if (needsFavorite) {
    await makeFavItem.click();
  } else {
    // Already favorited — close menu
    await page.locator('.projects-page').click({ position: { x: 10, y: 10 } });
    await expect(dropdown)
      .not.toBeVisible({ timeout: 3000 })
      .catch(() => {});
  }

  // Navigate back to threads page so sidebar favorites are visible
  await page.locator('button[aria-label="Threads"]').click();
  await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });
}

/**
 * Cleanup: unfavorite only the thread we favorited during setup.
 */
async function cleanupFavoritedThread(page: Page): Promise<void> {
  if (!favoritedThreadId) return;
  await page.locator('button[aria-label="Threads"]').click();
  await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });

  const item = page.locator(`.thread-item-container[data-thread-id="${favoritedThreadId}"]`);
  const visible = await item.isVisible({ timeout: 5000 }).catch(() => false);
  if (!visible) return;

  await item.hover();
  const menuTrigger = item.locator('.menu-trigger');
  await menuTrigger.click();
  const removeFav = page.locator('.menu-item[role="menuitem"]', { hasText: 'Remove Favorite' });
  if (await removeFav.isVisible({ timeout: 2000 }).catch(() => false)) {
    await removeFav.click();
  } else {
    await page.locator('body').click({ position: { x: 10, y: 10 } });
  }
}

/**
 * Cleanup: unfavorite only the project we favorited during setup.
 */
async function cleanupFavoritedProject(page: Page): Promise<void> {
  if (!favoritedProjectId) return;
  await page.locator('button[aria-label="Projects"]').click();
  await expect(page.locator('.projects-header')).toBeVisible({ timeout: 15000 });

  const card = page.locator(`.project-card[data-project-id="${favoritedProjectId}"]`);
  const visible = await card.isVisible({ timeout: 5000 }).catch(() => false);
  if (!visible) return;

  const menuBtn = card.locator('button.project-menu-button');
  await menuBtn.click();
  const removeFavItem = card.locator('.menu-item', { hasText: 'Remove Favorite' });
  if (await removeFavItem.isVisible({ timeout: 2000 }).catch(() => false)) {
    await removeFavItem.click();
  } else {
    await page.locator('.projects-page').click({ position: { x: 10, y: 10 } });
  }
}

test.describe.serial('Sidebar Favorites', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');

    // Capture initial global state snapshot for sanity check
    initialCounts = await getAppStateCounts(page);

    // Set up preconditions: ensure a thread and project are favorited
    await ensureThreadFavorited(page);
    await ensureProjectFavorited(page);
  });

  test.afterAll(async () => {
    try {
      await cleanupFavoritedThread(page);
      await cleanupFavoritedProject(page);
      if (createdProject) {
        await deleteProject(page, TEST_PROJECT_NAME);
      }
    } catch (e) {
      console.error('[E2E Cleanup] Failed to clean up favorites:', e);
    }

    // Sanity check: suite may create a project and favorite/unfavorite items,
    // but should not change the total project/thread counts overall.
    if (page && !page.isClosed() && initialCounts) {
      const finalCounts = await getAppStateCounts(page);
      expectAppStateUnchanged(initialCounts, finalCounts, 'Sidebar Favorites suite');
    }

    await app?.close();
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

    await header.hover();

    const toggle = favoritesSection.locator('.recent-toggle');
    await expect(toggle).toBeVisible({ timeout: 5000 });
  });

  // ─── Requirement 5.3: Clicking header expands the section ───

  test('clicking the header expands the section showing favorited items', async () => {
    const favoritesSection = page.locator('.favorites-section');
    const header = favoritesSection.locator('.recent-header');

    await header.click();

    const itemsList = favoritesSection.locator('.recent-threads');
    if (!(await itemsList.isVisible({ timeout: 2000 }).catch(() => false))) {
      await header.click();
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
    let threadItem: Locator | null = null;
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
      await expect(page).toHaveURL(/\/threads\/view\?threadId=/, { timeout: 10000 });

      // Navigate back to threads list for subsequent tests
      await page.locator('button[aria-label="Threads"]').click();
      await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });
    } else {
      // No non-project favorites — click the first item and verify navigation
      const firstItem = items.first();
      await firstItem.click();

      const url = page.url();
      expect(url).toMatch(/threadId=|projectId=/);

      await page.locator('button[aria-label="Threads"]').click();
      await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });
    }
  });

  // ─── Requirement 5.6: Favorited projects display with folder icon ───

  test('favorited projects display with folder icon, title, and type', async () => {
    const favoritesSection = page.locator('.favorites-section');

    // Ensure section is expanded
    const header = favoritesSection.locator('.recent-header');
    await header.hover();
    const itemsList = favoritesSection.locator('.recent-threads');
    if (!(await itemsList.isVisible({ timeout: 2000 }).catch(() => false))) {
      await header.click();
    }

    const items = favoritesSection.locator('.recent-thread-item');
    const count = await items.count();

    let projectItem: Locator | null = null;
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const folderIcon = item.locator('.thread-title i.pi-folder');
      if (await folderIcon.isVisible({ timeout: 500 }).catch(() => false)) {
        projectItem = item;
        break;
      }
    }

    expect(projectItem).not.toBeNull();
    if (!projectItem) return;

    const folderIcon = projectItem.locator('.thread-title i.pi-folder');
    await expect(folderIcon).toBeVisible({ timeout: 5000 });

    const title = projectItem.locator('.thread-title');
    await expect(title).toBeVisible({ timeout: 5000 });

    const model = projectItem.locator('.thread-model');
    await expect(model).toBeVisible({ timeout: 5000 });
  });

  // ─── Requirement 5.7: Clicking a favorited project navigates to project view ───

  test('clicking a favorited project navigates to project view', async () => {
    const favoritesSection = page.locator('.favorites-section');
    const items = favoritesSection.locator('.recent-thread-item');
    const count = await items.count();

    let projectItem: Locator | null = null;
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const folderIcon = item.locator('.thread-title i.pi-folder');
      if (await folderIcon.isVisible({ timeout: 500 }).catch(() => false)) {
        projectItem = item;
        break;
      }
    }

    expect(projectItem).not.toBeNull();
    if (!projectItem) return;

    await projectItem.click();
    await expect(page).toHaveURL(/\/projects\/view\?projectId=/, { timeout: 10000 });

    // Navigate back to threads list
    await page.locator('button[aria-label="Threads"]').click();
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
    }
    await expect(itemsList).toBeVisible({ timeout: 5000 });

    // Hover to reveal the toggle
    await header.hover();

    const toggle = favoritesSection.locator('.recent-toggle');
    await expect(toggle).toBeVisible({ timeout: 5000 });

    // Click the toggle to collapse
    await toggle.click();

    // Items should no longer be visible
    await expect(itemsList).not.toBeVisible({ timeout: 5000 });
  });
});

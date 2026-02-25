/**
 * Thread Context Menu E2E Tests
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4 (Context Menu Visibility)
 *            Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7 (Thread Rename)
 *            Requirements 3.1, 3.2, 3.3, 3.4 (Thread Delete)
 *            Requirements 4.1, 4.2 (Thread Favorite Toggle)
 *
 * Tests thread list context menu interactions including:
 * - Context menu visibility and dismissal
 * - Thread rename via modal
 * - Thread delete via modal
 * - Thread favorite toggle via context menu
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

let app: ElectronApplication;
let page: Page;

test.describe.serial('Thread Context Menu', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  // ─── Sub-task 1.1: Context Menu Visibility Tests ───

  test('navigate to threads page and verify thread list has items', async () => {
    // Navigate to threads list via sidebar
    await page.locator('button[aria-label="Threads"]').click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });

    // Verify thread list has items — skip entire suite if empty
    const threadItems = page.locator('.thread-item-container');
    const count = await threadItems.count();
    if (count === 0) {
      test.skip();
    }
  });

  test('hovering a ThreadListItem reveals the ellipsis menu trigger', async () => {
    // Requirement 1.1: hovering reveals ellipsis menu trigger
    const firstItem = page.locator('.thread-item-container').first();
    await expect(firstItem).toBeVisible({ timeout: 5000 });

    // Hover over the thread item to reveal the menu trigger
    await firstItem.hover();
    await page.waitForTimeout(300);

    const menuTrigger = firstItem.locator('.menu-trigger');
    await expect(menuTrigger).toBeVisible({ timeout: 5000 });
  });

  test('clicking the ellipsis button opens the context menu with expected items', async () => {
    // Requirement 1.2: clicking ellipsis opens context menu with correct items
    const firstItem = page.locator('.thread-item-container').first();
    await firstItem.hover();
    await page.waitForTimeout(300);

    const menuTrigger = firstItem.locator('.menu-trigger');
    await menuTrigger.click();
    await page.waitForTimeout(300);

    // Context menu should be visible
    const contextMenu = page.locator('.context-menu[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // Verify menu items exist
    const menuItems = contextMenu.locator('.menu-item[role="menuitem"]');
    const menuTexts = await menuItems.allTextContents();

    // Should have "Make Favorite" or "Remove Favorite", "Rename", "Move", and "Delete Thread"
    const hasFavoriteOption =
      menuTexts.some((t) => t.includes('Make Favorite')) ||
      menuTexts.some((t) => t.includes('Remove Favorite'));
    expect(hasFavoriteOption).toBe(true);
    expect(menuTexts.some((t) => t.includes('Rename'))).toBe(true);
    expect(menuTexts.some((t) => t.includes('Move'))).toBe(true);
    expect(menuTexts.some((t) => t.includes('Delete Thread'))).toBe(true);

    // Close the menu for next test
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(300);
  });

  test('clicking outside the context menu closes it', async () => {
    // Requirement 1.3: clicking outside closes the context menu
    const firstItem = page.locator('.thread-item-container').first();
    await firstItem.hover();
    await page.waitForTimeout(300);

    // Open the context menu
    const menuTrigger = firstItem.locator('.menu-trigger');
    await menuTrigger.click();
    await page.waitForTimeout(300);

    const contextMenu = page.locator('.context-menu[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // Click outside the menu (on the page body area)
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);

    // Context menu should be closed
    await expect(contextMenu).not.toBeVisible({ timeout: 5000 });
  });

  test('clicking the ellipsis button again while open closes the context menu', async () => {
    // Requirement 1.4: clicking ellipsis again toggles menu closed
    const firstItem = page.locator('.thread-item-container').first();
    await firstItem.hover();
    await page.waitForTimeout(300);

    const menuTrigger = firstItem.locator('.menu-trigger');

    // Open the context menu
    await menuTrigger.click();
    await page.waitForTimeout(300);

    const contextMenu = page.locator('.context-menu[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // Click the ellipsis button again to close
    await menuTrigger.click();
    await page.waitForTimeout(300);

    // Context menu should be closed
    await expect(contextMenu).not.toBeVisible({ timeout: 5000 });
  });

  // ─── Sub-task 1.2: Thread Rename Tests ───

  test('clicking Rename opens modal with current title pre-filled and input focused', async () => {
    // Requirements 2.1, 2.2: Rename opens modal with pre-filled title, input focused/selected
    const firstItem = page.locator('.thread-item-container').first();
    const originalTitle = await firstItem.locator('.thread-item-title').textContent();

    // Open context menu and click Rename
    await firstItem.hover();
    await page.waitForTimeout(300);
    await firstItem.locator('.menu-trigger').click();
    await page.waitForTimeout(300);

    const renameMenuItem = page.locator('.menu-item[role="menuitem"]', { hasText: 'Rename' });
    await renameMenuItem.click();
    await page.waitForTimeout(500);

    // Rename modal should be visible
    const dialog = page.locator('[role="dialog"][aria-labelledby="rename-dialog-title"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Title heading should say "Rename Thread"
    await expect(dialog.locator('#rename-dialog-title')).toHaveText('Rename Thread');

    // Input should have the current title pre-filled
    const titleInput = dialog.locator('#thread-title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await expect(titleInput).toHaveValue(originalTitle!.trim());

    // Input should be focused (use:focus directive auto-focuses and selects)
    await expect(titleInput).toBeFocused({ timeout: 3000 });

    // Close the modal for next test
    await dialog.locator('button.btn-secondary').click();
    await page.waitForTimeout(300);
  });

  test('modifying title to valid value enables Rename button; clicking Rename updates title and shows toast', async () => {
    // Requirements 2.3, 2.4: valid title enables Rename; clicking Rename updates list and shows toast
    const firstItem = page.locator('.thread-item-container').first();

    // Open context menu and click Rename
    await firstItem.hover();
    await page.waitForTimeout(500);
    await firstItem.locator('.menu-trigger').click();
    await page.waitForTimeout(500);
    await page.locator('.menu-item[role="menuitem"]', { hasText: 'Rename' }).click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"][aria-labelledby="rename-dialog-title"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const titleInput = dialog.locator('#thread-title');
    const renameButton = dialog.locator('button.btn-primary[type="submit"]');

    // Rename button should be disabled initially (title unchanged)
    await expect(renameButton).toBeDisabled({ timeout: 3000 });

    // Select all text and type a new title (triple-click to select all, then type)
    const newTitle = `Renamed E2E ${Date.now()}`;
    await titleInput.click({ clickCount: 3 });
    await page.waitForTimeout(200);
    await titleInput.pressSequentially(newTitle, { delay: 20 });
    await page.waitForTimeout(500);

    // Rename button should now be enabled
    await expect(renameButton).toBeEnabled({ timeout: 5000 });

    // Click Rename
    await renameButton.click();

    // Modal should close
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Toast should appear with "Thread renamed"
    const toast = page.locator('.toast[role="alert"]');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText('Thread renamed', { timeout: 5000 });

    // Wait for toast to disappear
    await page.waitForTimeout(4000);
  });

  test('clicking Cancel in rename modal closes without changing title', async () => {
    // Requirement 2.5: Cancel closes modal without modifying title
    const firstItem = page.locator('.thread-item-container').first();
    const originalTitle = await firstItem.locator('.thread-item-title').textContent();

    // Open context menu and click Rename
    await firstItem.hover();
    await page.waitForTimeout(300);
    await firstItem.locator('.menu-trigger').click();
    await page.waitForTimeout(300);
    await page.locator('.menu-item[role="menuitem"]', { hasText: 'Rename' }).click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"][aria-labelledby="rename-dialog-title"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Modify the title
    const titleInput = dialog.locator('#thread-title');
    await titleInput.clear();
    await titleInput.fill('Should Not Be Saved');
    await page.waitForTimeout(300);

    // Click Cancel
    await dialog.locator('button.btn-secondary').click();
    await page.waitForTimeout(500);

    // Modal should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Title should remain unchanged
    const currentTitle = await firstItem.locator('.thread-item-title').textContent();
    expect(currentTitle!.trim()).toBe(originalTitle!.trim());
  });

  test('closing rename modal via close button dismisses without changing title', async () => {
    // Requirement 2.6: Dismissing modal without modifying title
    const firstItem = page.locator('.thread-item-container').first();
    const originalTitle = await firstItem.locator('.thread-item-title').textContent();

    // Open context menu and click Rename
    await firstItem.hover();
    await page.waitForTimeout(300);
    await firstItem.locator('.menu-trigger').click();
    await page.waitForTimeout(300);
    await page.locator('.menu-item[role="menuitem"]', { hasText: 'Rename' }).click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"][aria-labelledby="rename-dialog-title"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Modify the title
    const titleInput = dialog.locator('#thread-title');
    await titleInput.clear();
    await titleInput.fill('Should Not Be Saved Either');
    await page.waitForTimeout(300);

    // Click the Close dialog button instead of pressing Escape
    await dialog.locator('button[aria-label="Close dialog"]').click();
    await page.waitForTimeout(500);

    // Modal should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Title should remain unchanged
    const currentTitle = await firstItem.locator('.thread-item-title').textContent();
    expect(currentTitle!.trim()).toBe(originalTitle!.trim());
  });

  test('empty or unchanged title keeps Rename button disabled', async () => {
    // Requirement 2.7: empty or unchanged title keeps Rename button disabled
    const firstItem = page.locator('.thread-item-container').first();

    // Open context menu and click Rename
    await firstItem.hover();
    await page.waitForTimeout(300);
    await firstItem.locator('.menu-trigger').click();
    await page.waitForTimeout(300);
    await page.locator('.menu-item[role="menuitem"]', { hasText: 'Rename' }).click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"][aria-labelledby="rename-dialog-title"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const titleInput = dialog.locator('#thread-title');
    const renameButton = dialog.locator('button.btn-primary[type="submit"]');

    // Unchanged title — button should be disabled
    await expect(renameButton).toBeDisabled({ timeout: 3000 });

    // Clear the input (empty title) — button should still be disabled
    await titleInput.clear();
    await page.waitForTimeout(300);
    await expect(renameButton).toBeDisabled({ timeout: 3000 });

    // Type only whitespace — button should still be disabled
    await titleInput.fill('   ');
    await page.waitForTimeout(300);
    await expect(renameButton).toBeDisabled({ timeout: 3000 });

    // Close the modal
    await dialog.locator('button.btn-secondary').click();
    await page.waitForTimeout(300);
  });

  // ─── Sub-task 1.3: Thread Delete Tests ───
  // Create a fresh thread first so deletion doesn't affect other tests

  test('create a fresh thread for delete tests', async () => {
    // Step 1: Enable delete confirmation via Settings UI
    // Navigate to settings page
    await page.evaluate(() => {
      window.location.hash = '#/settings';
    });
    await page.waitForTimeout(2000);

    // Click "General" sidebar item to ensure we're on the General tab
    const generalItem = page.locator('.sidebar-item', { hasText: 'General' });
    await generalItem.click();
    await page.waitForTimeout(1000);

    // Use a more reliable selector — find the label text and get its sibling checkbox
    const confirmationLabel = page.locator('label', {
      hasText: 'Require confirmation to delete threads and projects',
    });
    const checkbox = confirmationLabel.locator('input[type="checkbox"]');

    await expect(checkbox).toBeVisible({ timeout: 5000 });

    // Check if it's already checked
    const isChecked = await checkbox.isChecked();
    if (!isChecked) {
      await checkbox.check();
      await page.waitForTimeout(500);
    }

    // Click Save button
    const saveButton = page.locator('button.btn-primary', { hasText: 'Save' });
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Wait for success toast
    const toast = page.locator('.toast[role="alert"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(3000);

    // Step 2: Create a fresh thread
    await page.locator('button[aria-label="+ New Thread"]').click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/threads\/applications/, { timeout: 10000 });

    // Wait for application cards to load
    const cards = page.locator('.application-card');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });

    // Click the first application card to create a thread
    await cards.first().click();
    await page.waitForTimeout(2000);

    // Wait for navigation to thread view
    await expect(page).toHaveURL(/threadId=/, { timeout: 30000 });
    await expect(page.locator('.thread-chat-view')).toBeVisible({ timeout: 30000 });

    // Step 3: Navigate back to threads list
    await page.locator('button[aria-label="Threads"]').click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });

    // Verify the new thread appears in the list
    const threadItems = page.locator('.thread-item-container');
    const count = await threadItems.count();
    expect(count).toBeGreaterThan(0);

    // Extra wait for page to settle before delete tests start
    await page.waitForTimeout(2000);
  });

  test('clicking Delete Thread opens delete modal with thread title and warning', async () => {
    // Requirement 3.1: clicking Delete Thread opens ThreadDeleteModal
    const firstItem = page.locator('.thread-item-container').first();
    const threadTitle = await firstItem.locator('.thread-item-title').textContent();

    // Open context menu and click Delete Thread
    await firstItem.hover();
    await page.waitForTimeout(500);
    const menuTrigger = firstItem.locator('.menu-trigger');
    await expect(menuTrigger).toBeVisible({ timeout: 5000 });
    await menuTrigger.click();

    // Wait for context menu to be visible before clicking menu item
    const contextMenu = page.locator('.context-menu[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    const deleteMenuItem = page.locator('.menu-item-danger[role="menuitem"]', {
      hasText: 'Delete Thread',
    });
    await expect(deleteMenuItem).toBeVisible({ timeout: 3000 });
    await deleteMenuItem.click();
    await page.waitForTimeout(500);

    // Delete modal should be visible
    const dialog = page.locator('[role="dialog"][aria-labelledby="delete-dialog-title"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Title heading should say "Delete Thread"
    await expect(dialog.locator('#delete-dialog-title')).toHaveText('Delete Thread');

    // Warning text should contain the thread title
    const warningText = dialog.locator('.warning-text');
    await expect(warningText).toBeVisible({ timeout: 3000 });
    await expect(warningText).toContainText(threadTitle!.trim(), { timeout: 3000 });

    // Warning subtext should be visible
    await expect(dialog.locator('.warning-subtext')).toBeVisible({ timeout: 3000 });

    // Close the modal for next test
    await dialog.locator('button.btn-secondary').click();
    await page.waitForTimeout(300);
  });

  test('clicking Cancel in delete modal closes without deleting', async () => {
    // Requirement 3.3: Cancel closes modal without deleting
    const threadItems = page.locator('.thread-item-container');
    const countBefore = await threadItems.count();

    const firstItem = threadItems.first();

    // Open context menu and click Delete Thread
    await firstItem.hover();
    await page.waitForTimeout(500);
    const menuTrigger = firstItem.locator('.menu-trigger');
    await expect(menuTrigger).toBeVisible({ timeout: 5000 });
    await menuTrigger.click();

    // Wait for context menu to be visible before clicking menu item
    const contextMenu = page.locator('.context-menu[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    const deleteMenuItem = page.locator('.menu-item-danger[role="menuitem"]', {
      hasText: 'Delete Thread',
    });
    await expect(deleteMenuItem).toBeVisible({ timeout: 3000 });
    await deleteMenuItem.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"][aria-labelledby="delete-dialog-title"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click Cancel
    await dialog.locator('button.btn-secondary').click();
    await page.waitForTimeout(500);

    // Modal should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Thread count should remain the same
    const countAfter = await threadItems.count();
    expect(countAfter).toBe(countBefore);
  });

  test('pressing Escape in delete modal closes without deleting', async () => {
    // Requirement 3.4: Escape closes modal without deleting
    const threadItems = page.locator('.thread-item-container');
    const countBefore = await threadItems.count();

    const firstItem = threadItems.first();

    // Open context menu and click Delete Thread
    await firstItem.hover();
    await page.waitForTimeout(500);
    const menuTrigger = firstItem.locator('.menu-trigger');
    await expect(menuTrigger).toBeVisible({ timeout: 5000 });
    await menuTrigger.click();

    // Wait for context menu to be visible before clicking menu item
    const contextMenu = page.locator('.context-menu[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    const deleteMenuItem = page.locator('.menu-item-danger[role="menuitem"]', {
      hasText: 'Delete Thread',
    });
    await expect(deleteMenuItem).toBeVisible({ timeout: 3000 });
    await deleteMenuItem.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"][aria-labelledby="delete-dialog-title"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Modal should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Thread count should remain the same
    const countAfter = await threadItems.count();
    expect(countAfter).toBe(countBefore);
  });

  test('clicking Delete Thread in modal removes thread from list and shows toast', async () => {
    // Requirement 3.2: confirming delete removes thread and shows success toast
    const threadItems = page.locator('.thread-item-container');
    const countBefore = await threadItems.count();

    const firstItem = threadItems.first();

    // Open context menu and click Delete Thread
    await firstItem.hover();
    await page.waitForTimeout(500);
    const menuTrigger = firstItem.locator('.menu-trigger');
    await expect(menuTrigger).toBeVisible({ timeout: 5000 });
    await menuTrigger.click();

    // Wait for context menu to be visible before clicking menu item
    const contextMenu = page.locator('.context-menu[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    const deleteMenuItem = page.locator('.menu-item-danger[role="menuitem"]', {
      hasText: 'Delete Thread',
    });
    await expect(deleteMenuItem).toBeVisible({ timeout: 3000 });
    await deleteMenuItem.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"][aria-labelledby="delete-dialog-title"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click "Delete Thread" button in the modal
    const deleteButton = dialog.locator('button.btn-danger');
    await deleteButton.click();
    await page.waitForTimeout(1000);

    // Modal should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Toast should appear with "Thread deleted successfully"
    const toast = page.locator('.toast[role="alert"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText('Thread deleted successfully', { timeout: 3000 });

    // Thread count should decrease by 1
    await page.waitForTimeout(1000);
    const countAfter = await threadItems.count();
    expect(countAfter).toBe(countBefore - 1);

    // Restore default setting via Settings UI
    await page.evaluate(() => {
      window.location.hash = '#/settings';
    });
    await page.waitForTimeout(2000);
    const generalItem2 = page.locator('.sidebar-item', { hasText: 'General' });
    await generalItem2.click();
    await page.waitForTimeout(1000);
    const confirmLabel2 = page.locator('label', {
      hasText: 'Require confirmation to delete threads and projects',
    });
    const checkbox2 = confirmLabel2.locator('input[type="checkbox"]');
    await expect(checkbox2).toBeVisible({ timeout: 5000 });
    const isChecked2 = await checkbox2.isChecked();
    if (isChecked2) {
      await checkbox2.uncheck();
      await page.waitForTimeout(500);
    }
    const saveBtn2 = page.locator('button.btn-primary', { hasText: 'Save' });
    await saveBtn2.click();
    await page.waitForTimeout(1000);
    // Navigate back to threads for remaining tests
    await page.locator('button[aria-label="Threads"]').click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });
  });

  // ─── Sub-task 1.4: Thread Favorite Toggle Tests ───

  test('clicking Make Favorite adds thread to sidebar Favorites section', async () => {
    // Requirement 4.1: Make Favorite adds thread to sidebar Favorites_Section
    const firstItem = page.locator('.thread-item-container').first();
    const threadTitle = await firstItem.locator('.thread-item-title').textContent();

    // Open context menu
    await firstItem.hover();
    await page.waitForTimeout(500);
    const menuTrigger1 = firstItem.locator('.menu-trigger');
    await expect(menuTrigger1).toBeVisible({ timeout: 5000 });
    await menuTrigger1.click();

    // Wait for context menu to be visible
    const contextMenu = page.locator('.context-menu[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // Check if thread is already favorited — if so, remove first to set up clean state
    const menuItems = page.locator('.menu-item[role="menuitem"]');
    const firstMenuText = await menuItems.first().textContent();

    if (firstMenuText!.includes('Remove Favorite')) {
      // Already favorited — remove it first
      await menuItems.first().click();
      await page.waitForTimeout(1000);

      // Re-open context menu
      await firstItem.hover();
      await page.waitForTimeout(500);
      const menuTrigger2 = firstItem.locator('.menu-trigger');
      await expect(menuTrigger2).toBeVisible({ timeout: 5000 });
      await menuTrigger2.click();

      // Wait for context menu to be visible
      await expect(contextMenu).toBeVisible({ timeout: 5000 });
    }

    // Click "Make Favorite"
    const makeFavItem = page.locator('.menu-item[role="menuitem"]', { hasText: 'Make Favorite' });
    await expect(makeFavItem).toBeVisible({ timeout: 3000 });
    await makeFavItem.click();
    await page.waitForTimeout(1000);

    // Verify thread appears in sidebar Favorites section
    const favoritesSection = page.locator('.favorites-section');
    await expect(favoritesSection).toBeVisible({ timeout: 5000 });

    // Expand favorites if collapsed — hover to reveal toggle, then click header
    const favHeader = favoritesSection.locator('.recent-header');
    await favHeader.hover();
    await page.waitForTimeout(300);
    await favHeader.click();
    await page.waitForTimeout(500);

    // Look for the thread title in the favorites section
    const favoriteItems = favoritesSection.locator('.recent-thread-item');
    const favTexts = await favoriteItems.allTextContents();
    const found = favTexts.some((t) => t.includes(threadTitle!.trim()));
    expect(found).toBe(true);

    // Re-open context menu and verify it now shows "Remove Favorite"
    await firstItem.hover();
    await page.waitForTimeout(500);
    const menuTrigger3 = firstItem.locator('.menu-trigger');
    await expect(menuTrigger3).toBeVisible({ timeout: 5000 });
    await menuTrigger3.click();

    // Wait for context menu to be visible
    const contextMenu2 = page.locator('.context-menu[role="menu"]');
    await expect(contextMenu2).toBeVisible({ timeout: 5000 });

    const removeFavItem = page.locator('.menu-item[role="menuitem"]', {
      hasText: 'Remove Favorite',
    });
    await expect(removeFavItem).toBeVisible({ timeout: 3000 });

    // Close the menu
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(300);
  });

  test('clicking Remove Favorite removes thread from sidebar Favorites section', async () => {
    // Requirement 4.2: Remove Favorite removes thread from sidebar Favorites_Section
    const firstItem = page.locator('.thread-item-container').first();
    const threadTitle = await firstItem.locator('.thread-item-title').textContent();

    // Open context menu and click "Remove Favorite"
    await firstItem.hover();
    await page.waitForTimeout(500);
    const menuTrigger = firstItem.locator('.menu-trigger');
    await expect(menuTrigger).toBeVisible({ timeout: 5000 });
    await menuTrigger.click();

    // Wait for context menu to be visible
    const contextMenu = page.locator('.context-menu[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    const removeFavItem = page.locator('.menu-item[role="menuitem"]', {
      hasText: 'Remove Favorite',
    });
    await expect(removeFavItem).toBeVisible({ timeout: 3000 });
    await removeFavItem.click();
    await page.waitForTimeout(1000);

    // Verify thread is no longer in sidebar Favorites section
    const favoritesSection = page.locator('.favorites-section');

    // Expand favorites if visible
    if (await favoritesSection.isVisible({ timeout: 2000 }).catch(() => false)) {
      const favHeader = favoritesSection.locator('.recent-header');
      await favHeader.hover();
      await page.waitForTimeout(300);
      await favHeader.click();
      await page.waitForTimeout(500);

      const favoriteItems = favoritesSection.locator('.recent-thread-item');
      const favCount = await favoriteItems.count();

      if (favCount > 0) {
        const favTexts = await favoriteItems.allTextContents();
        const found = favTexts.some((t) => t.includes(threadTitle!.trim()));
        expect(found).toBe(false);
      }
      // If no favorite items, the thread was successfully removed
    }

    // Re-open context menu and verify it now shows "Make Favorite"
    await firstItem.hover();
    await page.waitForTimeout(500);
    const menuTrigger2 = firstItem.locator('.menu-trigger');
    await expect(menuTrigger2).toBeVisible({ timeout: 5000 });
    await menuTrigger2.click();

    // Wait for context menu to be visible
    const contextMenu2 = page.locator('.context-menu[role="menu"]');
    await expect(contextMenu2).toBeVisible({ timeout: 5000 });

    const makeFavItem = page.locator('.menu-item[role="menuitem"]', { hasText: 'Make Favorite' });
    await expect(makeFavItem).toBeVisible({ timeout: 3000 });

    // Close the menu
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(300);
  });
});

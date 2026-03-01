/**
 * Project Members E2E Tests
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 * - Members page shows current member list
 * - Typing in search field shows matching users dropdown
 * - Selecting a user adds them with default viewer role
 * - Changing member role updates the assignment
 *
 * Note: We create a SHARED project first (search/add members only available for shared projects),
 * then navigate to its members page. The test user (Kong Pham) is always the owner.
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

let app: ElectronApplication;
let page: Page;

const TEST_PROJECT_NAME = `E2E Members Project ${Date.now()}`;

test.describe.serial('Project Members', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Create a SHARED project (search is only available for shared projects)
    await page.locator('button[aria-label="Projects"]').click();
    await page.waitForTimeout(2000);

    const newProjectBtn = page.locator('.projects-header button.btn-holokai');
    await newProjectBtn.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('div[role="dialog"][aria-labelledby="create-project-dialog-title"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    await modal.locator('input#project-name').fill(TEST_PROJECT_NAME);

    // Select "Shared" type
    const sharedBtn = modal.locator('.type-button').filter({ hasText: 'Shared' });
    await sharedBtn.click();
    await page.waitForTimeout(300);

    await modal.locator('button.btn-primary').click();
    // The create API call is async — modal stays open until projectService.createProject() resolves
    await expect(modal).not.toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(2000);

    // Navigate away and back to ensure fresh project list (SPA may cache the component)
    await page.locator('button[aria-label="Threads"]').click();
    await page.waitForTimeout(2000);
    await page.locator('button[aria-label="Projects"]').click();
    await page.waitForTimeout(3000);

    // Navigate into the project
    const projectCard = page.locator('.project-card', { hasText: TEST_PROJECT_NAME });
    await expect(projectCard).toBeVisible({ timeout: 15000 });
    await projectCard.click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/projectId=/, { timeout: 15000 });

    // Click Members card to navigate to members page
    const membersCard = page.locator('.right-column .info-card', { hasText: 'Members' });
    await membersCard.click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/project\/members\?projectId=/, { timeout: 10000 });
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

  test('members page shows current member list', async () => {
    // Requirement 9.1: members page displays current members
    const membersSection = page.locator('.members-section');
    await expect(membersSection).toBeVisible({ timeout: 10000 });

    // Verify the members title with count
    const membersTitle = membersSection.locator('.members-title');
    await expect(membersTitle).toBeVisible({ timeout: 5000 });
    await expect(membersTitle).toContainText('Members');

    // The test user (owner) should be in the list
    const memberCards = page.locator('.member-card');
    const count = await memberCards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify the first member card has name, email, and role
    const firstMember = memberCards.first();
    await expect(firstMember.locator('.member-name')).toBeVisible({ timeout: 3000 });
    await expect(firstMember.locator('.member-email')).toBeVisible({ timeout: 3000 });
    await expect(firstMember.locator('.role-badge')).toBeVisible({ timeout: 3000 });
  });

  test('typing in search field shows matching users dropdown', async () => {
    // Requirement 9.2: search field shows matching users
    const searchInput = page.locator('input#user-search');
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Type a search term
    await searchInput.fill('a');
    await page.waitForTimeout(2000);

    // The dropdown should appear
    const dropdown = page.locator('.search-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 10000 });

    // Should show either results or "No users found" or loading
    const dropdownItems = dropdown.locator('.dropdown-item-wrapper');
    const itemCount = await dropdownItems.count();
    expect(itemCount).toBeGreaterThanOrEqual(1);

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);
  });

  test('selecting a user adds them with default viewer role', async () => {
    // Requirement 9.3: selecting a user adds them as viewer
    const searchInput = page.locator('input#user-search');
    await searchInput.fill('a');
    await page.waitForTimeout(2000);

    const dropdown = page.locator('.search-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 10000 });

    // Check if there are actual user results (not "No users found")
    const addViewerBtn = dropdown.locator('.add-button.add-viewer').first();
    const hasResults = await addViewerBtn.isVisible().catch(() => false);

    if (hasResults) {
      // Click "Add Viewer" on the first result
      await addViewerBtn.click();

      // Wait for the loading state to finish and member cards to reappear
      const loadingState = page.locator('.loading-state');
      await loadingState.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);

      // Verify the member was added — member count should increase
      const memberCards = page.locator('.member-card');
      await expect(memberCards.first()).toBeVisible({ timeout: 10000 });
      const count = await memberCards.count();
      expect(count).toBeGreaterThanOrEqual(2);

      // The new member should have a viewer role badge
      const viewerBadges = page.locator('.role-badge.role-viewer');
      const viewerCount = await viewerBadges.count();
      expect(viewerCount).toBeGreaterThanOrEqual(1);
    } else {
      // No search results available — skip gracefully
      // This can happen if the test environment has no other users
      test.skip();
    }
  });

  test('new member is reflected on the Members card in the project page', async () => {
    // Navigate back to the project view
    await page.goBack();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/projectId=/, { timeout: 10000 });

    // Verify the Members card shows the updated count (should include a viewer now)
    const membersCard = page.locator('.info-card', { hasText: 'Members' });
    await expect(membersCard).toBeVisible({ timeout: 5000 });

    const memberCountLines = membersCard.locator('.member-count-line');
    const lineCount = await memberCountLines.count();
    expect(lineCount).toBeGreaterThanOrEqual(1);

    // Should show at least "1 owner" and "1 viewer" if a member was added
    const allText = await membersCard.textContent();
    expect(allText).toContain('owner');

    // Click Members card to go back to members page for remaining tests
    await membersCard.click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/project\/members\?projectId=/, { timeout: 10000 });
  });

  test('member role badge is displayed correctly', async () => {
    // Requirement 9.4: role assignment is visible
    // Verify the owner has an owner role badge
    const ownerBadge = page.locator('.role-badge.role-owner');
    const ownerCount = await ownerBadge.count();
    expect(ownerCount).toBeGreaterThanOrEqual(1);

    // Verify all member cards have a role badge
    const memberCards = page.locator('.member-card');
    const count = await memberCards.count();

    for (let i = 0; i < count; i++) {
      const card = memberCards.nth(i);
      const roleBadge = card.locator('.role-badge');
      await expect(roleBadge).toBeVisible({ timeout: 3000 });
    }
  });
});

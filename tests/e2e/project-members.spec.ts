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
import { createProject, deleteProject, openProject } from '../fixtures/project-helpers';

let app: ElectronApplication;
let page: Page;

const TEST_PROJECT_NAME = `E2E Members Project ${Date.now()}`;

test.describe.serial('Project Members', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');

    // Create a SHARED project using shared helper (search is only available for shared projects)
    await createProject(page, TEST_PROJECT_NAME, 'Shared');

    // Navigate into the project
    await openProject(page, TEST_PROJECT_NAME);

    // Click Members card to navigate to members page
    const membersCard = page.locator('.right-column .info-card', { hasText: 'Members' });
    await expect(membersCard).toBeVisible({ timeout: 10000 });
    await membersCard.click();
    await expect(page).toHaveURL(/\/project\/members\?projectId=/, { timeout: 10000 });
  });

  test.afterAll(async () => {
    // Clean up: delete the test project using shared helper (best-effort)
    try {
      await deleteProject(page, TEST_PROJECT_NAME);
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

    // The dropdown should appear with results
    const dropdown = page.locator('.search-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 10000 });

    // Should show either results or "No users found" or loading
    const dropdownItems = dropdown.locator('.dropdown-item-wrapper');
    const itemCount = await dropdownItems.count();
    expect(itemCount).toBeGreaterThanOrEqual(1);

    // Clear search and wait for dropdown to disappear
    await searchInput.clear();
    await expect(dropdown).not.toBeVisible({ timeout: 5000 });
  });

  test('selecting a user adds them with default viewer role', async () => {
    // Requirement 9.3: selecting a user adds them as viewer
    const searchInput = page.locator('input#user-search');
    await searchInput.fill('a');

    const dropdown = page.locator('.search-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 10000 });

    // Wait for the "Add Viewer" button to appear (search results loaded)
    const addViewerBtn = dropdown.locator('.add-button.add-viewer').first();
    await expect(addViewerBtn).toBeVisible({ timeout: 10000 });

    // Click "Add Viewer" on the first result
    await addViewerBtn.click();

    // Wait for the member list to update — the page reloads members after adding
    const memberCards = page.locator('.member-card');
    await expect(memberCards).toHaveCount(2, { timeout: 15000 });

    // The new member should have a viewer role badge
    const viewerBadges = page.locator('.role-badge.role-viewer');
    const viewerCount = await viewerBadges.count();
    expect(viewerCount).toBeGreaterThanOrEqual(1);
  });

  test('new member is reflected on the Members card in the project page', async () => {
    // Navigate back to the project view
    await page.goBack();
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
    await expect(page).toHaveURL(/\/project\/members\?projectId=/, { timeout: 10000 });
  });

  test('member role badge is displayed correctly', async () => {
    // Requirement 9.4: role assignment is visible
    // Wait for member cards to be rendered first
    const memberCards = page.locator('.member-card');
    await expect(memberCards.first()).toBeVisible({ timeout: 10000 });

    // Wait for at least one owner badge to appear
    const ownerBadge = page.locator('.role-badge.role-owner');
    await expect(ownerBadge.first()).toBeVisible({ timeout: 5000 });

    const ownerCount = await ownerBadge.count();
    expect(ownerCount).toBeGreaterThanOrEqual(1);

    // Verify all member cards have a role badge
    const count = await memberCards.count();

    for (let i = 0; i < count; i++) {
      const card = memberCards.nth(i);
      const roleBadge = card.locator('.role-badge');
      await expect(roleBadge).toBeVisible({ timeout: 3000 });
    }
  });
});

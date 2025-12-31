/**
 * E3-S5: Project Creation View - E2E Tests
 *
 * Tests the inline project creation form including:
 * - Form rendering and fields
 * - Validation (title, description)
 * - Type selector
 * - Color and icon pickers
 * - Success navigation
 * - Error handling
 */

import { test, expect, type Page } from '@playwright/test';

// Mock project response helper
async function mockProjectCreation(page: Page, projectId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11') {
  await page.route('**/api/v1/projects', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: projectId,
          name: 'Test Project',
          description: 'Test description',
          type: 'personal',
          status: 'active',
          createdBy: 'user-123',
          organizationId: 'org-456',
          userRole: 'owner',
          metadata: {
            color: '#3B82F6',
            icon: 'folder',
            title: 'Test Project',
          },
          memberCount: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    }
  });
}

test.describe('E3-S5: Project Creation View', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure authenticated
    await page.goto('http://localhost:5173');
    // Wait for app to be ready
    await page.waitForSelector('[data-testid="primary-sidebar"]', { timeout: 10000 });
  });

  test('should render creation form when navigating to /projects/create', async ({ page }) => {
    // Navigate to create route
    await page.goto('http://localhost:5173/#/projects/create');

    // AC#1: Verify form renders in main activity area
    await expect(page.locator('#project-title')).toBeVisible();
    await expect(page.locator('#project-description')).toBeVisible();
    await expect(page.locator('.type-options')).toBeVisible();
    await expect(page.locator('.color-picker')).toBeVisible();
    await expect(page.locator('.icon-picker')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('button.ghost')).toBeVisible(); // Cancel button
  });

  test('should show validation error when title is empty', async ({ page }) => {
    await page.goto('http://localhost:5173/#/projects/create');

    // AC#2: Title is required
    const submitButton = page.locator('button[type="submit"]');

    // Submit button should be disabled when title is empty
    await expect(submitButton).toBeDisabled();

    // Type and clear title
    await page.fill('#project-title', 'Test');
    await expect(submitButton).toBeEnabled();

    await page.fill('#project-title', '');
    await expect(submitButton).toBeDisabled();

    // Check for validation error
    await expect(page.locator('#title-error')).toBeVisible();
    await expect(page.locator('#title-error')).toContainText('required');
  });

  test('should show validation error for invalid title characters', async ({ page }) => {
    await page.goto('http://localhost:5173/#/projects/create');

    // AC#2: Title regex validation (^[a-zA-Z0-9\s\-]+$)
    await page.fill('#project-title', 'Invalid@#$%^&*');

    // Check for validation error
    await expect(page.locator('#title-error')).toBeVisible();
    await expect(page.locator('#title-error')).toContainText('letters, numbers, spaces, and hyphens');
  });

  test('should show character counter for description', async ({ page }) => {
    await page.goto('http://localhost:5173/#/projects/create');

    // AC#2: Description max 500 chars
    const description = 'A'.repeat(50);
    await page.fill('#project-description', description);

    // Check character counter
    const charCounter = page.locator('.char-counter');
    await expect(charCounter).toBeVisible();
    await expect(charCounter).toContainText('50/500');
  });

  test('should show error when description exceeds 500 characters', async ({ page }) => {
    await page.goto('http://localhost:5173/#/projects/create');

    // Exceed max length
    const longDescription = 'A'.repeat(501);
    await page.fill('#project-description', longDescription);

    // Check for validation error
    await expect(page.locator('#description-error')).toBeVisible();
    await expect(page.locator('#description-error')).toContainText('cannot exceed 500 characters');

    // Submit button should be disabled
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test('should allow selecting project type', async ({ page }) => {
    await page.goto('http://localhost:5173/#/projects/create');

    // AC#3: Type selector with Personal (default) and Shared
    const personalOption = page.locator('.type-option').filter({ hasText: 'Personal' });
    const sharedOption = page.locator('.type-option').filter({ hasText: 'Shared' });

    // Personal should be default
    await expect(personalOption).toHaveClass(/active/);
    await expect(personalOption).toContainText(
      'Only you can access. Can be upgraded to shared later.',
    );

    // Switch to Shared
    await sharedOption.click();
    await expect(sharedOption).toHaveClass(/active/);
    await expect(personalOption).not.toHaveClass(/active/);
    await expect(sharedOption).toContainText('Invite team members to collaborate.');
  });

  test('should allow selecting colors from Moku palette', async ({ page }) => {
    await page.goto('http://localhost:5173/#/projects/create');

    // AC#4: Color picker with 12 Moku colors
    const colorOptions = page.locator('.color-option');
    await expect(colorOptions).toHaveCount(12);

    // First color (Blue #3B82F6) should be default
    const firstColor = colorOptions.first();
    await expect(firstColor).toHaveClass(/active/);

    // Click second color
    const secondColor = colorOptions.nth(1);
    await secondColor.click();
    await expect(secondColor).toHaveClass(/active/);
    await expect(firstColor).not.toHaveClass(/active/);
  });

  test('should allow selecting icons', async ({ page }) => {
    await page.goto('http://localhost:5173/#/projects/create');

    // AC: Icon picker
    const iconOptions = page.locator('.icon-option');
    await expect(iconOptions.first()).toHaveClass(/active/); // Default: folder

    // Click second icon
    const secondIcon = iconOptions.nth(1);
    await secondIcon.click();
    await expect(secondIcon).toHaveClass(/active/);
  });

  test('should navigate back when Cancel button is clicked', async ({ page }) => {
    await page.goto('http://localhost:5173/#/projects/create');

    // AC#6: Cancel button navigates to /projects
    const cancelButton = page.locator('button.ghost').filter({ hasText: 'Cancel' });
    await cancelButton.click();

    // Should navigate to projects overview
    await expect(page).toHaveURL(/.*\/#\/projects$/);
  });

  test('should create project and navigate to detail view', async ({ page }) => {
    const projectId = 'new-project-123';
    await mockProjectCreation(page, projectId);
    await page.goto('http://localhost:5173/#/projects/create');

    // Fill form
    await page.fill('#project-title', 'My Test Project');
    await page.fill('#project-description', 'This is a test project');

    // Select shared type
    await page.locator('.type-option').filter({ hasText: 'Shared' }).click();

    // Select color
    await page.locator('.color-option').nth(2).click();

    // Select icon
    await page.locator('.icon-option').nth(3).click();

    // Submit
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // AC#7: Should navigate to /projects?projectId={id}
    await page.waitForURL(`**/projects?projectId=${projectId}`, { timeout: 5000 });
  });

  test('should show loading state while creating project', async ({ page }) => {
    await page.route('**/api/v1/projects', async (route) => {
      // Delay response to test loading state
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'delayed-project',
          name: 'Test Project',
          type: 'personal',
          status: 'active',
          createdBy: 'user-123',
          organizationId: 'org-456',
          userRole: 'owner',
          metadata: {},
          memberCount: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto('http://localhost:5173/#/projects/create');

    await page.fill('#project-title', 'Test Project');
    const submitButton = page.locator('button[type="submit"]');

    await submitButton.click();

    // Should show "Creating..." text
    await expect(submitButton).toContainText('Creating...');
    await expect(submitButton).toBeDisabled();
  });

  test('should show error banner on API failure', async ({ page }) => {
    await page.route('**/api/v1/projects', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Project with this title already exists',
        }),
      });
    });

    await page.goto('http://localhost:5173/#/projects/create');

    await page.fill('#project-title', 'Duplicate Project');
    await page.locator('button[type="submit"]').click();

    // AC#8: Should show error banner
    const errorBanner = page.locator('.error-banner');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText(/failed/i);

    // Form state should be preserved
    await expect(page.locator('#project-title')).toHaveValue('Duplicate Project');
  });

  test('should have proper accessibility attributes', async ({ page }) => {
    await page.goto('http://localhost:5173/#/projects/create');

    // AC#5: Accessibility
    const titleInput = page.locator('#project-title');
    await expect(titleInput).toHaveAttribute('aria-label', 'Project title');
    await expect(titleInput).toHaveAttribute('required');

    // Fill invalid title
    await page.fill('#project-title', 'Invalid@@@');
    await expect(titleInput).toHaveAttribute('aria-invalid', 'true');
    await expect(titleInput).toHaveAttribute('aria-describedby', 'title-error');

    // Type selector should have radiogroup role
    const typeSelector = page.locator('.type-options');
    await expect(typeSelector).toHaveAttribute('role', 'radiogroup');
    await expect(typeSelector).toHaveAttribute('aria-label', 'Project type');

    // Type options should have radio role
    const typeOptions = page.locator('.type-option');
    await expect(typeOptions.first()).toHaveAttribute('role', 'radio');
    await expect(typeOptions.first()).toHaveAttribute('aria-checked');
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('http://localhost:5173/#/projects/create');

    // Tab through form fields
    await page.keyboard.press('Tab'); // Focus title
    await expect(page.locator('#project-title')).toBeFocused();

    await page.keyboard.type('Keyboard Project');

    await page.keyboard.press('Tab'); // Focus description
    await expect(page.locator('#project-description')).toBeFocused();

    await page.keyboard.type('Created via keyboard');

    // Should be able to submit with Enter (when focused on submit button)
    await page.keyboard.press('Tab'); // Type options
    await page.keyboard.press('Tab'); // Color picker
    await page.keyboard.press('Tab'); // Icon picker
    await page.keyboard.press('Tab'); // Cancel button
    await page.keyboard.press('Tab'); // Submit button

    await expect(page.locator('button[type="submit"]')).toBeFocused();
  });
});


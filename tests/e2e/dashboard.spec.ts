/**
 * Dashboard (Home Page) E2E Tests
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 * - ModelListCard is visible with model information
 * - RecentProjectsCard is visible
 * - InvitationsCard is visible
 * - SupportCard and ResourcesCard are visible
 * - MetricsChartsSection is visible
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

let app: ElectronApplication;
let page: Page;

test.describe('Dashboard (Home Page)', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Navigate to dashboard via hash route (sidebar has no "Home" button)
    const currentUrl = page.url();
    const baseUrl = currentUrl.split('#')[0];
    await page.goto(`${baseUrl}#/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('ModelListCard is visible with model information', async () => {
    // Requirement 2.1: Dashboard displays ModelListCard with AI model info
    const modelCard = page.locator('.dashboard-card', { hasText: 'Models by Agent' });
    await expect(modelCard).toBeVisible({ timeout: 15000 });

    // Verify the card has content (either applications list or empty state)
    const applicationsList = modelCard.locator('.applications-list');
    const emptyState = modelCard.locator('.empty-state');

    const hasApps = await applicationsList.isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasApps || hasEmpty).toBe(true);
  });

  test('RecentProjectsCard is visible', async () => {
    // Requirement 2.2: Dashboard displays RecentProjectsCard
    const recentProjectsCard = page.locator('.dashboard-card', { hasText: 'Recent Projects' });
    await expect(recentProjectsCard).toBeVisible({ timeout: 10000 });
  });

  test('InvitationsCard is visible', async () => {
    // Requirement 2.3: Dashboard displays InvitationsCard
    const invitationsCard = page.locator('.dashboard-card', { hasText: 'Project Invitations' });
    await expect(invitationsCard).toBeVisible({ timeout: 10000 });
  });

  test('SupportCard and ResourcesCard are visible', async () => {
    // Requirement 2.4: Dashboard displays SupportCard and ResourcesCard
    const supportCard = page.locator('.dashboard-card', { hasText: 'Support Center' });
    await expect(supportCard).toBeVisible({ timeout: 10000 });

    const resourcesCard = page.locator('.dashboard-card', { hasText: 'Help & Resources' });
    await expect(resourcesCard).toBeVisible({ timeout: 10000 });
  });

  test('MetricsChartsSection is visible', async () => {
    // Requirement 2.5: Dashboard displays MetricsChartsSection
    const metricsCard = page.locator('.dashboard-card', { hasText: 'Usage Metrics' });
    await metricsCard.scrollIntoViewIfNeeded();
    await expect(metricsCard).toBeVisible({ timeout: 10000 });
  });
});

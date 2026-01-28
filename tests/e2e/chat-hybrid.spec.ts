/**
 * E2E Chat Test - Hybrid Approach
 *
 * This approach balances performance and isolation:
 * - One app instance per test group (describe block)
 * - State reset between tests within the group
 * - Better performance than fully isolated
 * - Better isolation than serial mode
 */

import { test, expect, type ElectronApplication } from '@playwright/test';
import { launchElectronApp, closeElectronApp } from '../helpers/electron-app';
import { createThread, waitForStreamingComplete } from '../helpers/ui-helpers';

test.describe('E2E: Chat with Hybrid Approach', () => {
  let app: ElectronApplication;

  // Launch app once for this test group
  test.beforeAll(async () => {
    console.log('\n=== Launching App for Test Group ===');
    app = await launchElectronApp();
    console.log('✓ App launched for group\n');
  });

  // Close app after all tests in this group
  test.afterAll(async () => {
    console.log('\n=== Closing App for Test Group ===');
    await closeElectronApp(app);
    console.log('✓ App closed for group\n');
  });

  // Reset state between tests
  test.afterEach(async () => {
    if (!app) return;

    try {
      const page = await app.firstWindow();

      // Navigate to home to reset state
      const homeMenuItem = page.getByRole('menuitem', { name: 'Home' });
      if (await homeMenuItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await homeMenuItem.click();
        await page.waitForTimeout(1000);
        console.log('✓ State reset to home');
      }

      // Clear any modals
      const modal = page.locator('[role="dialog"]');
      if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
        await page.keyboard.press('Escape');
        console.log('✓ Modal dismissed');
      }
    } catch (error) {
      console.error('⚠️ State reset failed:', error);
    }
  });

  test('send first prompt', async () => {
    console.log('\n=== Test 1: First Prompt ===');
    const page = await app.firstWindow();

    const prompt = `Say "Test 1" ${Date.now()}`;
    await createThread(page, prompt);

    await expect(
      page.locator('.messages .message.user .message-content', { hasText: 'Say "Test 1"' }),
    ).toBeVisible({ timeout: 10000 });

    await expect(page.locator('.messages .message.assistant .message-content')).toBeVisible({
      timeout: 60000,
    });

    await waitForStreamingComplete(page, 120000);
    console.log('✓ Test 1 complete\n');
  });

  test('send second prompt', async () => {
    console.log('\n=== Test 2: Second Prompt ===');
    const page = await app.firstWindow();

    const prompt = `Say "Test 2" ${Date.now()}`;
    await createThread(page, prompt);

    await expect(
      page.locator('.messages .message.user .message-content', { hasText: 'Say "Test 2"' }),
    ).toBeVisible({ timeout: 10000 });

    await expect(page.locator('.messages .message.assistant .message-content')).toBeVisible({
      timeout: 60000,
    });

    await waitForStreamingComplete(page, 120000);
    console.log('✓ Test 2 complete\n');
  });

  test('send third prompt', async () => {
    console.log('\n=== Test 3: Third Prompt ===');
    const page = await app.firstWindow();

    const prompt = `Say "Test 3" ${Date.now()}`;
    await createThread(page, prompt);

    await expect(
      page.locator('.messages .message.user .message-content', { hasText: 'Say "Test 3"' }),
    ).toBeVisible({ timeout: 10000 });

    await expect(page.locator('.messages .message.assistant .message-content')).toBeVisible({
      timeout: 60000,
    });

    await waitForStreamingComplete(page, 120000);
    console.log('✓ Test 3 complete\n');
  });
});

// You can have multiple test groups, each with their own app instance
test.describe('E2E: Chat - Different Scenarios', () => {
  let app: ElectronApplication;

  test.beforeAll(async () => {
    console.log('\n=== Launching App for Second Test Group ===');
    app = await launchElectronApp();
    console.log('✓ App launched for second group\n');
  });

  test.afterAll(async () => {
    console.log('\n=== Closing App for Second Test Group ===');
    await closeElectronApp(app);
    console.log('✓ App closed for second group\n');
  });

  test.afterEach(async () => {
    if (!app) return;
    const page = await app.firstWindow();
    const homeMenuItem = page.getByRole('menuitem', { name: 'Home' });
    if (await homeMenuItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await homeMenuItem.click();
      await page.waitForTimeout(1000);
    }
  });

  test('long prompt test', async () => {
    console.log('\n=== Test: Long Prompt ===');
    const page = await app.firstWindow();

    const longPrompt = `Write a short poem about testing ${Date.now()}`;
    await createThread(page, longPrompt);

    await expect(
      page.locator('.messages .message.user .message-content', { hasText: 'Write a short poem' }),
    ).toBeVisible({ timeout: 10000 });

    await expect(page.locator('.messages .message.assistant .message-content')).toBeVisible({
      timeout: 60000,
    });

    await waitForStreamingComplete(page, 120000);
    console.log('✓ Long prompt test complete\n');
  });
});

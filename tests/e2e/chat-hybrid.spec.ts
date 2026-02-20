/**
 * E2E Chat Test - Hybrid Approach
 *
 * This approach balances performance and isolation:
 * - One app instance per test group (describe block)
 * - State reset between tests within the group
 * - Better performance than fully isolated
 * - Better isolation than serial mode
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication } from 'playwright';
import { launchElectronApp, closeElectronApp } from '../helpers/electron-app';
import {
  createThread,
  waitForStreamingComplete,
  SIMPLE_TEST_PROMPT,
  forceThreadRefresh,
} from '../helpers/ui-helpers';

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

      // Clear any modals that might be blocking
      const modal = page.locator('[role="dialog"]');
      if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
        await page.keyboard.press('Escape');
        console.log('✓ Modal dismissed');
      }

      // Wait a bit for any pending operations to complete
      await expect(modal)
        .toBeHidden({ timeout: 5000 })
        .catch(() => {});
      console.log('✓ State reset complete');
    } catch (error) {
      console.error('⚠️ State reset failed:', error);
    }
  });

  test('send first prompt', async () => {
    console.log('\n=== Test 1: First Prompt ===');
    const page = await app.firstWindow();

    await createThread(page, SIMPLE_TEST_PROMPT);

    await expect(
      page.locator('.messages .message.user .message-content', { hasText: SIMPLE_TEST_PROMPT }),
    ).toBeVisible({ timeout: 10000 });

    const assistant = page.locator('.messages .message.assistant').last();
    try {
      await expect(assistant).toBeVisible({ timeout: 60000 });
    } catch (error) {
      console.log('[E2E] Assistant message not visible after 60s, attempting recovery...');
      await forceThreadRefresh(page);
      await expect(page.locator('.messages .message.assistant').first()).toBeVisible({
        timeout: 60000,
      });
    }

    await waitForStreamingComplete(page, 120000);
    console.log('✓ Test 1 complete\n');
  });

  test('send second prompt', async () => {
    console.log('\n=== Test 2: Second Prompt ===');
    const page = await app.firstWindow();

    await createThread(page, SIMPLE_TEST_PROMPT);

    await expect(
      page.locator('.messages .message.user .message-content', { hasText: SIMPLE_TEST_PROMPT }),
    ).toBeVisible({ timeout: 10000 });

    const assistant = page.locator('.messages .message.assistant').last();
    try {
      await expect(assistant).toBeVisible({ timeout: 60000 });
    } catch (error) {
      console.log('[E2E] Assistant message not visible after 60s, attempting recovery...');
      await forceThreadRefresh(page);
      await expect(page.locator('.messages .message.assistant').first()).toBeVisible({
        timeout: 60000,
      });
    }

    await waitForStreamingComplete(page, 120000);
    console.log('✓ Test 2 complete\n');
  });

  test('send third prompt', async () => {
    console.log('\n=== Test 3: Third Prompt ===');
    const page = await app.firstWindow();

    await createThread(page, SIMPLE_TEST_PROMPT);

    await expect(
      page.locator('.messages .message.user .message-content', { hasText: SIMPLE_TEST_PROMPT }),
    ).toBeVisible({ timeout: 10000 });

    const assistant = page.locator('.messages .message.assistant').last();
    try {
      await expect(assistant).toBeVisible({ timeout: 60000 });
    } catch (error) {
      console.log('[E2E] Assistant message not visible after 60s, attempting recovery...');
      await forceThreadRefresh(page);
      await expect(page.locator('.messages .message.assistant').first()).toBeVisible({
        timeout: 60000,
      });
    }

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

    try {
      const page = await app.firstWindow();

      // Clear any modals
      const modal = page.locator('[role="dialog"]');
      if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
        await page.keyboard.press('Escape');
        await expect(modal)
          .toBeHidden({ timeout: 5000 })
          .catch(() => {});
      }
    } catch (error) {
      console.error('⚠️ State reset failed:', error);
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

    const assistant = page.locator('.messages .message.assistant').last();
    try {
      await expect(assistant).toBeVisible({ timeout: 60000 });
    } catch (error) {
      console.log('[Long Prompt] Assistant message not visible after 60s, attempting recovery...');
      await forceThreadRefresh(page);
      await expect(page.locator('.messages .message.assistant').first()).toBeVisible({
        timeout: 60000,
      });
    }

    await waitForStreamingComplete(page, 120000);
    console.log('✓ Long prompt test complete\n');
  });
});

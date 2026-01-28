/**
 * E2E Chat Test - Isolated Instance Approach
 *
 * This test demonstrates the isolated instance pattern that solves
 * the Windows hanging issue. Each test gets its own Electron app.
 */

import { test, expect } from '@playwright/test';
import { launchElectronApp, closeElectronApp } from '../helpers/electron-app';
import { createThread, waitForStreamingComplete } from '../helpers/ui-helpers';

test.describe('E2E: Chat with Isolated Instances', () => {
  test('send prompt and receive assistant response', async () => {
    console.log('\n=== Test 1: Send Prompt ===');

    // Launch isolated app instance for this test
    const app = await launchElectronApp();

    try {
      const page = await app.firstWindow();

      // Already authenticated - no login needed!
      console.log('✓ App authenticated');

      // Create a thread with a simple prompt
      const prompt = `Just say "Okay" ${Date.now()}`;
      console.log('Creating thread with prompt:', prompt);

      await createThread(page, prompt);
      console.log('✓ Thread created');

      // Wait for user message to appear in the UI
      await expect(
        page.locator('.messages .message.user .message-content', { hasText: 'Just say "Okay"' }),
      ).toBeVisible({ timeout: 10000 });
      console.log('✓ User message visible');

      // Wait for assistant response to start streaming (message appears)
      await expect(page.locator('.messages .message.assistant .message-content')).toBeVisible({
        timeout: 60000,
      });
      console.log('✓ Assistant response started');

      // Wait for streaming to complete
      await waitForStreamingComplete(page, 120000);
      console.log('✓ Streaming complete');

      console.log('=== Test 1 Completed Successfully ===\n');
    } finally {
      // Always close the app, even if test fails
      await closeElectronApp(app);
    }
  });

  test('send second prompt in new instance', async () => {
    console.log('\n=== Test 2: Send Second Prompt ===');

    // Launch a fresh isolated app instance for this test
    // This prevents state from test 1 affecting test 2
    const app = await launchElectronApp();

    try {
      const page = await app.firstWindow();

      console.log('✓ Fresh app instance launched');

      // Create a different thread
      const prompt = `Say "Hello World" ${Date.now()}`;
      console.log('Creating thread with prompt:', prompt);

      await createThread(page, prompt);
      console.log('✓ Thread created');

      // Wait for user message
      await expect(
        page.locator('.messages .message.user .message-content', { hasText: 'Say "Hello World"' }),
      ).toBeVisible({ timeout: 10000 });
      console.log('✓ User message visible');

      // Wait for assistant response
      await expect(page.locator('.messages .message.assistant .message-content')).toBeVisible({
        timeout: 60000,
      });
      console.log('✓ Assistant response started');

      // Wait for streaming to complete
      await waitForStreamingComplete(page, 120000);
      console.log('✓ Streaming complete');

      console.log('=== Test 2 Completed Successfully ===\n');
    } finally {
      await closeElectronApp(app);
    }
  });

  test('send third prompt - no hanging on Windows', async () => {
    console.log('\n=== Test 3: Third Prompt (Windows Hang Test) ===');

    // This is where the Windows hanging would occur in serial mode
    // With isolated instances, this test runs independently
    const app = await launchElectronApp();

    try {
      const page = await app.firstWindow();

      console.log('✓ Third instance launched (no hanging!)');

      const prompt = `Reply with "Test 3" ${Date.now()}`;
      console.log('Creating thread with prompt:', prompt);

      await createThread(page, prompt);
      console.log('✓ Thread created');

      // Wait for user message
      await expect(
        page.locator('.messages .message.user .message-content', {
          hasText: 'Reply with "Test 3"',
        }),
      ).toBeVisible({ timeout: 10000 });
      console.log('✓ User message visible');

      // Wait for assistant response
      await expect(page.locator('.messages .message.assistant .message-content')).toBeVisible({
        timeout: 60000,
      });
      console.log('✓ Assistant response started');

      // Wait for streaming to complete
      await waitForStreamingComplete(page, 120000);
      console.log('✓ Streaming complete');

      console.log('=== Test 3 Completed Successfully (No Hanging!) ===\n');
    } finally {
      await closeElectronApp(app);
    }
  });
});

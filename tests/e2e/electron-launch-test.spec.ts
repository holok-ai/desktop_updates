/**
 * Test to verify Electron app launches correctly
 * This is a diagnostic test to check cross-platform compatibility
 */

import { test, expect } from '@playwright/test';
import { launchElectronApp, closeElectronApp, isAppHealthy } from '../helpers/electron-app';

test.describe('Electron App Launch Test', () => {
  test('should launch Electron app successfully', async () => {
    console.log('\n=== Starting Electron Launch Test ===');
    console.log('Platform:', process.platform);
    console.log('Node version:', process.version);

    let app;

    try {
      // Launch the app
      console.log('\n1. Launching Electron app...');
      app = await launchElectronApp();
      console.log('✓ App launched');

      // Get first window
      console.log('\n2. Getting first window...');
      const page = await app.firstWindow();
      console.log('✓ Got first window');

      // Wait for page to load
      console.log('\n3. Waiting for page to load...');
      await page.waitForLoadState('domcontentloaded');
      console.log('✓ Page loaded');

      // Get URL
      const url = page.url();
      console.log('\n4. Current URL:', url);
      expect(url).toContain('index.html');

      // Check if app is healthy
      console.log('\n5. Checking app health...');
      const healthy = await isAppHealthy(app);
      console.log('✓ App health:', healthy);
      expect(healthy).toBe(true);

      // Take screenshot for verification
      console.log('\n6. Taking screenshot...');
      await page.screenshot({ path: 'test-results/electron-launch.png' });
      console.log('✓ Screenshot saved to test-results/electron-launch.png');

      // Check if we can interact with the page
      console.log('\n7. Testing page interaction...');
      const title = await page.title();
      console.log('✓ Page title:', title);

      // Try to find navigation elements
      console.log('\n8. Looking for navigation elements...');
      const homeMenuItem = page.getByRole('menuitem', { name: 'Home' });
      const isHomeVisible = await homeMenuItem.isVisible({ timeout: 10000 }).catch(() => false);
      console.log('✓ Home menu item visible:', isHomeVisible);

      if (isHomeVisible) {
        console.log('✓ Navigation elements found - app is fully loaded');
      } else {
        console.log('⚠ Navigation elements not found - app may still be loading');
      }

      console.log('\n=== Test Completed Successfully ===\n');
    } catch (error) {
      console.error('\n❌ Test failed with error:', error);
      throw error;
    } finally {
      // Always close the app
      console.log('\n9. Closing Electron app...');
      await closeElectronApp(app);
      console.log('✓ App closed\n');
    }
  });

  test('should handle multiple launch/close cycles', async () => {
    console.log('\n=== Testing Multiple Launch Cycles ===');

    for (let i = 1; i <= 3; i++) {
      console.log(`\nCycle ${i}/3:`);
      let app;

      try {
        app = await launchElectronApp();
        const page = await app.firstWindow();
        await page.waitForLoadState('domcontentloaded');

        const healthy = await isAppHealthy(app);
        expect(healthy).toBe(true);

        console.log(`✓ Cycle ${i} completed successfully`);
      } finally {
        await closeElectronApp(app);
      }

      // Wait a bit between cycles
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log('\n=== All Cycles Completed ===\n');
  });
});

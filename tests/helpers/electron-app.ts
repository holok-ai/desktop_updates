/**
 * Cross-platform Electron App Launcher for E2E Tests
 *
 * Provides isolated Electron instances per test with proper cleanup
 */

import { _electron as electron, type ElectronApplication } from '@playwright/test';
import { TEST_TOKENS } from '../fixtures/electron-auth';

/**
 * Launch Electron app with isolated instance
 *
 * @returns ElectronApplication instance
 */
export async function launchElectronApp(): Promise<ElectronApplication> {
  // Get electron executable path using dynamic import
  const electronModule = await import('electron');
  const electronPath = electronModule.default as unknown as string;

  console.log('Platform:', process.platform);
  console.log('Electron path:', electronPath);

  const app = await electron.launch({
    executablePath: electronPath,
    args: ['.'], // Let Electron find package.json and launch from there
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PLAYWRIGHT_TEST_TOKENS: JSON.stringify(TEST_TOKENS),
    },
    // Windows needs more time to launch
    timeout: process.platform === 'win32' ? 90000 : 60000,
  });

  console.log('✓ Electron app launched successfully');

  // Wait for the app to load properly
  // The app tries to load from dev server first, then falls back to built files
  // We need to wait for this fallback to complete
  const page = await app.firstWindow();

  // Wait for the page to navigate away from error page
  let retries = 0;
  const maxRetries = 10;

  while (retries < maxRetries) {
    const url = page.url();

    if (url.includes('index.html') || url.includes('/#/')) {
      console.log('✓ App loaded successfully:', url);
      break;
    }

    if (url.includes('chrome-error')) {
      console.log(`⏳ Waiting for app to load (attempt ${retries + 1}/${maxRetries})...`);
      await page.waitForTimeout(1000);
      retries++;
    } else {
      // Unknown URL, assume it's loaded
      console.log('✓ App loaded at:', url);
      break;
    }
  }

  if (retries >= maxRetries) {
    console.warn('⚠️ App may not have loaded correctly, continuing anyway...');
  }

  return app;
}

/**
 * Check if Electron app is healthy and responsive
 *
 * @param app - ElectronApplication instance
 * @returns true if app is responsive
 */
export async function isAppHealthy(app: ElectronApplication): Promise<boolean> {
  try {
    const page = await app.firstWindow({ timeout: 5000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    const isResponsive = await page.evaluate(() => true, { timeout: 5000 });
    return isResponsive;
  } catch (error) {
    console.error('App health check failed:', error);
    return false;
  }
}

/**
 * Safely close Electron app with error handling
 *
 * @param app - ElectronApplication instance
 */
export async function closeElectronApp(app: ElectronApplication | undefined): Promise<void> {
  if (!app) return;

  try {
    await app.close();
    console.log('✓ Electron app closed successfully');
  } catch (error) {
    console.error('Failed to close Electron app:', error);
    // Try to force kill if graceful close fails
    try {
      await (app as any).process()?.kill();
    } catch (killError) {
      console.error('Failed to force kill Electron app:', killError);
    }
  }
}

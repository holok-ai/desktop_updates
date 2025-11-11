/**
 * Performance tests for file preview and download
 */

import {
  test,
  expect,
  type ElectronApplication,
  type Page,
  _electron as electron,
} from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

let electronApp: ElectronApplication;
let page: Page;
const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'e2e', 'fixtures');

test.describe.serial('File Preview Performance', () => {
  test.beforeAll(async () => {
    // Launch Electron app
    const mainPath = fs.existsSync(path.join(process.cwd(), 'dist-electron/main.js'))
      ? path.join(process.cwd(), 'dist-electron/main.js')
      : '.';

    // Let Playwright resolve the Electron binary; provide main path as arg.
    // Ensure fixtures directory exists so test file writes succeed.
    try {
      if (!fs.existsSync(FIXTURES_DIR)) {
        fs.mkdirSync(FIXTURES_DIR, { recursive: true });
      }
    } catch {
      // best-effort create, tests will fail later if not writable
    }

    const electronModule = await import('electron');
    const electronPath = (electronModule as any).default as string;
    electronApp = await electron.launch({
      executablePath: electronPath,
      args: [mainPath],
    });

    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    await electronApp?.close();
  });

  test('should load small image preview (<500KB) within 1.5s', async () => {
    // Create a small test image (< 500KB)
    const testImagePath = path.join(FIXTURES_DIR, 'small-image.png');

    // Create a 100KB PNG (reusing minimal PNG)
    const pngData = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );

    // Repeat to make it larger but still < 500KB
    const smallImage = Buffer.concat(Array(100).fill(pngData));
    fs.writeFileSync(testImagePath, smallImage);

    // Navigate to threads route (hash-based router) and wait for UI to settle
    await page.evaluate(() => {
      location.hash = '#/threads';
    });
    await page.waitForTimeout(500);

    // Upload file
    const fileInput = page.locator('input[type="file"]').first();
    if ((await fileInput.count()) > 0) {
      await fileInput.setInputFiles(testImagePath);
      await page.waitForTimeout(1000);

      // Find attachment
      const attachment = page.locator('[data-testid="attachment-preview"]').first();

      if ((await attachment.count()) > 0) {
        // Measure time to open preview
        const startTime = Date.now();

        const previewButton = attachment.locator('button[title*="Preview"]');
        if ((await previewButton.count()) > 0) {
          await previewButton.first().click();

          // Wait for modal to open
          await page.waitForSelector('[role="dialog"]', { timeout: 2000 });

          // Wait for image to load
          const modal = page.locator('[role="dialog"]');
          const modalImage = modal.locator('img');
          await modalImage.waitFor({ state: 'visible', timeout: 2000 });

          const endTime = Date.now();
          const loadTime = endTime - startTime;

          // Should be within 1.5s (1500ms)
          expect(loadTime).toBeLessThan(1500);

          console.log(`Small image preview loaded in ${loadTime}ms`);

          // Close modal
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }
    }

    // Cleanup
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
  });

  test('should load medium image preview (1-2MB) within 1.5s', async () => {
    // Create a medium test image (1-2MB)
    const testImagePath = path.join(FIXTURES_DIR, 'medium-image.png');

    // Create a larger PNG by repeating data
    const pngData = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );

    // Create 1.5MB image
    const mediumImage = Buffer.concat(Array(15000).fill(pngData));
    fs.writeFileSync(testImagePath, mediumImage);

    const fileSize = fs.statSync(testImagePath).size;
    console.log(`Created test image of ${(fileSize / 1024 / 1024).toFixed(2)}MB`);

    // Upload file
    const fileInput = page.locator('input[type="file"]').first();
    if ((await fileInput.count()) > 0) {
      await fileInput.setInputFiles(testImagePath);
      await page.waitForTimeout(1500);

      // Find attachment
      const attachment = page.locator('[data-testid="attachment-preview"]').last();

      if ((await attachment.count()) > 0) {
        // Measure time to open preview
        const startTime = Date.now();

        const previewButton = attachment.locator('button[title*="Preview"]');
        if ((await previewButton.count()) > 0) {
          await previewButton.first().click();

          // Wait for modal to open
          await page.waitForSelector('[role="dialog"]', { timeout: 3000 });

          // Wait for image to load
          const modal = page.locator('[role="dialog"]');
          const modalImage = modal.locator('img');
          await modalImage.waitFor({ state: 'visible', timeout: 3000 });

          const endTime = Date.now();
          const loadTime = endTime - startTime;

          // Should be within 1.5s (1500ms) for files < 2MB
          expect(loadTime).toBeLessThan(1500);

          console.log(
            `Medium image (${(fileSize / 1024 / 1024).toFixed(2)}MB) preview loaded in ${loadTime}ms`,
          );

          // Close modal
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }
    }

    // Cleanup
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
  });

  test('should load PDF preview within 1.5s', async () => {
    // Create a test PDF
    const testPdfPath = path.join(FIXTURES_DIR, 'test-performance.pdf');

    // Minimal PDF
    const pdfData = Buffer.from(
      '%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF',
    );
    fs.writeFileSync(testPdfPath, pdfData);

    // Upload file
    const fileInput = page.locator('input[type="file"]').first();
    if ((await fileInput.count()) > 0) {
      await fileInput.setInputFiles(testPdfPath);
      await page.waitForTimeout(1000);

      // Find PDF attachment
      const attachment = page
        .locator('[data-testid="attachment-preview"]')
        .filter({
          has: page.locator('text=/\\.pdf/i'),
        })
        .last();

      if ((await attachment.count()) > 0) {
        // Measure time to open preview
        const startTime = Date.now();

        const previewButton = attachment.locator('button[title*="Preview"]');
        if ((await previewButton.count()) > 0) {
          await previewButton.first().click();

          // Wait for modal to open
          await page.waitForSelector('[role="dialog"]', { timeout: 2000 });

          const endTime = Date.now();
          const loadTime = endTime - startTime;

          // Should be within 1.5s (1500ms)
          expect(loadTime).toBeLessThan(1500);

          console.log(`PDF preview loaded in ${loadTime}ms`);

          // Close modal
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }
    }

    // Cleanup
    if (fs.existsSync(testPdfPath)) {
      fs.unlinkSync(testPdfPath);
    }
  });

  test('should complete download flow within 1.5s for files < 2MB', async () => {
    // Create a test file (1MB)
    const testFilePath = path.join(FIXTURES_DIR, 'test-download.txt');
    const testData = Buffer.alloc(1024 * 1024, 'test data '); // 1MB
    fs.writeFileSync(testFilePath, testData);

    const fileSize = fs.statSync(testFilePath).size;
    console.log(`Created test file of ${(fileSize / 1024 / 1024).toFixed(2)}MB`);

    // Upload file
    const fileInput = page.locator('input[type="file"]').first();
    if ((await fileInput.count()) > 0) {
      await fileInput.setInputFiles(testFilePath);
      await page.waitForTimeout(1000);

      // Find attachment
      const attachment = page.locator('[data-testid="attachment-preview"]').last();

      if ((await attachment.count()) > 0) {
        // Measure time to complete download
        const startTime = Date.now();

        const downloadButton = attachment.locator('button[title*="Download"]');
        if ((await downloadButton.count()) > 0) {
          // Set up download listener
          const downloadPromise = page
            .waitForEvent('download', { timeout: 2000 })
            .catch(() => null);

          await downloadButton.first().click();

          // Wait for download to start or complete
          await downloadPromise;

          const endTime = Date.now();
          const downloadTime = endTime - startTime;

          // Should be within 1.5s (1500ms)
          expect(downloadTime).toBeLessThan(1500);

          console.log(
            `Download (${(fileSize / 1024 / 1024).toFixed(2)}MB) completed in ${downloadTime}ms`,
          );
        } else {
          // If download button not found, wait and verify no crash
          await page.waitForTimeout(1000);
        }
      }
    }

    // Cleanup
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  test('should cache inline preview URLs to avoid redundant fetches', async () => {
    // Create a small image that should be cached
    const testImagePath = path.join(FIXTURES_DIR, 'cached-image.png');
    const pngData = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    fs.writeFileSync(testImagePath, pngData);

    // Upload file
    const fileInput = page.locator('input[type="file"]').first();
    if ((await fileInput.count()) > 0) {
      await fileInput.setInputFiles(testImagePath);
      await page.waitForTimeout(1000);

      // Find inline preview image
      const inlineImage = page.locator('.inline-preview img').last();

      if ((await inlineImage.count()) > 0) {
        // First load
        const startTime1 = Date.now();
        await inlineImage.waitFor({ state: 'visible', timeout: 2000 });
        const loadTime1 = Date.now() - startTime1;

        console.log(`First inline preview load: ${loadTime1}ms`);

        // Scroll away and back (to test cache)
        await page.evaluate(() => window.scrollTo(0, 1000));
        await page.waitForTimeout(500);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);

        // Second load (should be cached)
        const startTime2 = Date.now();
        await inlineImage.waitFor({ state: 'visible', timeout: 1000 });
        const loadTime2 = Date.now() - startTime2;

        console.log(`Cached inline preview load: ${loadTime2}ms`);

        // Cached load should be faster
        expect(loadTime2).toBeLessThanOrEqual(loadTime1);
      }
    }

    // Cleanup
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
  });

  test('should handle concurrent preview requests efficiently', async () => {
    // Create multiple test images
    const testImages: string[] = [];

    for (let i = 0; i < 3; i++) {
      const imagePath = path.join(FIXTURES_DIR, `concurrent-${i}.png`);
      const pngData = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );
      fs.writeFileSync(imagePath, pngData);
      testImages.push(imagePath);
    }

    // Upload all images
    const fileInput = page.locator('input[type="file"]').first();
    if ((await fileInput.count()) > 0) {
      for (const imagePath of testImages) {
        await fileInput.setInputFiles(imagePath);
        await page.waitForTimeout(500);
      }

      // Wait for all attachments to load
      await page.waitForTimeout(1500);

      // Find all attachments
      const attachments = page.locator('[data-testid="attachment-preview"]');
      const count = await attachments.count();

      if (count >= 3) {
        // Measure time to open multiple previews rapidly
        const startTime = Date.now();

        for (let i = 0; i < Math.min(3, count); i++) {
          const attachment = attachments.nth(i);
          const previewButton = attachment.locator('button[title*="Preview"]');

          if ((await previewButton.count()) > 0) {
            await previewButton.first().click();
            await page.waitForTimeout(100);

            // Close modal
            await page.keyboard.press('Escape');
            await page.waitForTimeout(100);
          }
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        console.log(`Concurrent preview handling completed in ${totalTime}ms`);

        // Should handle 3 previews in reasonable time (< 3s total)
        expect(totalTime).toBeLessThan(3000);
      }
    }

    // Cleanup
    for (const imagePath of testImages) {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
  });
});

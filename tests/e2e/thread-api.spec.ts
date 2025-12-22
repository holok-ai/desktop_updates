import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

let app: ElectronApplication;

// Helper to get first window
async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

// Helper to verify authentication and ensure UI is updated
async function ensureAuthenticated(page: Page): Promise<void> {
  // Wait for the app to fully load
  await page.waitForLoadState('networkidle');

  // Check current URL
  const currentUrl = page.url();
  console.log('[Test] Current URL:', currentUrl);

  if (currentUrl.includes('#/login')) {
    console.log('[Test] On login page - clicking Login With Key button');

    // If on login page, click "Login With Key" button
    const keyButton = page.getByRole('button', { name: 'Login With Key' });
    await expect(keyButton).toBeVisible({ timeout: 5000 });
    await keyButton.click();

    // Wait for navigation to home
    await page.waitForTimeout(1000);
  } else {
    console.log('[Test] Already authenticated - not on login page');
  }

  // Navigate to Threads page to trigger reactive re-evaluation of sidebar
  console.log('[Test] Navigating to Threads to ensure sidebar items are visible');
  await page.evaluate(() => {
    window.location.hash = '#/threads';
  });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Verify we're authenticated by checking for navigation items
  await expect(page.getByRole('menuitem', { name: 'Threads' })).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('menuitem', { name: 'Projects' })).toBeVisible({ timeout: 5000 });

  // Verify auth state via IPC
  const isAuth = await page.evaluate(async () => {
    const api = (window as any).electronAPI;
    return await api.auth.isAuthenticated();
  });

  if (!isAuth) {
    throw new Error(
      'Authentication failed. Please set PLAYWRIGHT_TEST_TOKENS environment variable.\n' +
      'See tests/e2e/README-thread-api.md for instructions.'
    );
  }

  console.log('✓ Authenticated successfully via test tokens');
}

test.describe.configure({ mode: 'serial' });

test.describe('Thread API E2E', () => {
  test.beforeAll(async () => {
    // Hardcoded test tokens for development
    // TODO: Move to environment variable for production/CI
    const testTokens = JSON.stringify({
      accessToken: 'eyJhbGciOiJIUzM4NCJ9.eyJ1c2VySWQiOiJwZXRlci5iYXh0ZXJAZHluYW1vLndvcmtzIiwib3JnYW5pemF0aW9uSWQiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJzdWIiOiIzYmY2NGUxOC03MzMzLTRjYjMtYWQzMy1iMDU1YjM2MzA4OGIiLCJpc3MiOiJtb2t1LWFwaSIsImlhdCI6MTc2NTQwMDg4MywiZXhwIjoyMDgwOTMzNjgzfQ.Kf5HkoEtr4DcjL5YqPWG0HcYmNYnxfgA0uIIfg3SAJWorJNekkysSoxfdf-PrcDz',
      user: {
        id: '3bf64e18-7333-4cb3-ad33-b055b363088b',
        email: 'peter.baxter@dynamo.works',
        name: 'Peter Baxter',
        organizationId: '00000000-0000-0000-0000-000000000001',
      },
      expiresAt: 2080933683000, // Expires in 2035
    });

    // Use hardcoded tokens or environment variable if provided
    const tokensToUse = process.env.PLAYWRIGHT_TEST_TOKENS || testTokens;

    try {
      const electronExec = (await import('electron')).default as unknown as string;
      app = await electron.launch({
        executablePath: electronExec,
        args: ['.'],
        env: {
          ...process.env,
          PLAYWRIGHT_TEST_TOKENS: tokensToUse,
        },
      });
    } catch {
      const electronExec = (await import('electron')).default as unknown as string;
      app = await electron.launch({
        executablePath: electronExec,
        args: ['dist-electron/main.js'],
        env: {
          ...process.env,
          PLAYWRIGHT_TEST_TOKENS: tokensToUse,
        },
      });
    }
  });

  test.afterAll(async () => {
    await app.close();
  });

  test('should create thread via API and verify in thread list', async () => {
    const page = await getFirstWindow(app);

    // 1. Verify authentication (test tokens loaded from environment)
    await ensureAuthenticated(page);

    // 2. Get initial thread count via electronAPI
    const initialThreads = await page.evaluate(async () => {
      const api = (window as any).electronAPI;
      const threads = await api.thread.getAll();
      return threads.length;
    });

    // 3. Create a new thread via electronAPI (calls real Moku API)
    const testThreadTitle = `E2E Test Thread ${Date.now()}`;
    const createdThreadId = await page.evaluate(
      async (title) => {
        const api = (window as any).electronAPI;
        const result = await api.thread.create({ title });
        return result.id;
      },
      testThreadTitle,
    );

    // 4. Verify thread was created
    expect(createdThreadId).toBeTruthy();
    expect(typeof createdThreadId).toBe('string');

    // 5. Verify thread appears in list via API
    const updatedThreads = await page.evaluate(async () => {
      const api = (window as any).electronAPI;
      const threads = await api.thread.getAll();
      return threads;
    });

    expect(updatedThreads.length).toBe(initialThreads + 1);

    const createdThread = updatedThreads.find((t: any) => t.id === createdThreadId);
    expect(createdThread).toBeDefined();
    expect(createdThread.title).toBe(testThreadTitle);

    // 6. Navigate to Threads page and verify in UI
    await page.getByRole('menuitem', { name: 'Threads' }).click();
    await page.waitForLoadState('networkidle');

    // Verify thread appears in the UI list
    await expect(page.getByText(testThreadTitle)).toBeVisible({ timeout: 5000 });

    // 7. Cleanup - delete the test thread
    await page.evaluate(
      async (threadId) => {
        const api = (window as any).electronAPI;
        await api.thread.delete(threadId);
      },
      createdThreadId,
    );

    // 8. Verify deletion
    const finalThreads = await page.evaluate(async () => {
      const api = (window as any).electronAPI;
      const threads = await api.thread.getAll();
      return threads;
    });

    expect(finalThreads.length).toBe(initialThreads);
    expect(finalThreads.find((t: any) => t.id === createdThreadId)).toBeUndefined();
  });

  test('should create multiple threads and verify count', async () => {
    const page = await getFirstWindow(app);

    // Verify authentication (should already be authenticated from first test in serial mode)
    await ensureAuthenticated(page);

    // Get initial thread count
    const initialThreads = await page.evaluate(async () => {
      const api = (window as any).electronAPI;
      const threads = await api.thread.getAll();
      return threads;
    });

    const initialCount = initialThreads.length;

    // Create multiple threads
    const threadIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const testThreadTitle = `E2E Multi Thread ${Date.now()}-${i}`;
      const threadId = await page.evaluate(
        async (title) => {
          const api = (window as any).electronAPI;
          const thread = await api.thread.create({ title });
          return thread.id;
        },
        testThreadTitle,
      );
      threadIds.push(threadId);
    }

    // Verify all threads were created
    const updatedThreads = await page.evaluate(async () => {
      const api = (window as any).electronAPI;
      const threads = await api.thread.getAll();
      return threads;
    });

    expect(updatedThreads.length).toBe(initialCount + 3);

    // Verify all created threads exist
    for (const threadId of threadIds) {
      const thread = updatedThreads.find((t: any) => t.id === threadId);
      expect(thread).toBeDefined();
    }

    // Cleanup - delete all test threads
    for (const threadId of threadIds) {
      await page.evaluate(
        async (id) => {
          const api = (window as any).electronAPI;
          await api.thread.delete(id);
        },
        threadId,
      );
    }

    // Verify cleanup
    const finalThreads = await page.evaluate(async () => {
      const api = (window as any).electronAPI;
      const threads = await api.thread.getAll();
      return threads;
    });

    expect(finalThreads.length).toBe(initialCount);
  });
});

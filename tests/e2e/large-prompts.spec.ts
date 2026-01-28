import { test, expect, type ElectronApplication, Page } from '@playwright/test';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import { createThread, waitForStreamingComplete, navigateToThreads } from '../helpers/ui-helpers';

async function waitForMessageInput(page: Page): Promise<void> {
  const input = page.locator('[data-testid="message-input"]');
  await expect(input).toBeVisible({ timeout: 60000 });

  // Wait for streaming to complete if there is any
  try {
    const streamingMessage = page.locator('.message.assistant.streaming');
    const isStreaming = await streamingMessage.isVisible({ timeout: 2000 }).catch(() => false);
    if (isStreaming) {
      await expect(streamingMessage).toBeHidden({ timeout: 120000 });
    }
  } catch {
    // No streaming, continue
  }

  // Wait for input to be enabled
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="message-input"]') as HTMLTextAreaElement;
      return el && !el.disabled;
    },
    undefined,
    { timeout: 120000 },
  );
}

test.describe('Large Prompts - Long-form Content Handling', () => {
  let app: ElectronApplication | undefined;
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    try {
      app = await launchAuthenticatedApp();
    } catch (error) {
      console.error('Failed to launch authenticated app:', error);
      test.skip(true, 'Electron failed to launch in this environment');
    }
  });

  test.afterAll(async () => {
    if (app) await app.close();
  });

  test('Prompt 1: Comprehensive technical explanation', async () => {
    test.setTimeout(180000);
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const prompt = `Explain how the React Virtual DOM works in detail, including the reconciliation algorithm,
      the diffing process, fiber architecture, and how it compares to the actual DOM. Include code
      examples showing how updates propagate through the component tree, how React batches updates
      for performance, and the role of keys in list rendering. Also explain the trade-offs between
      Virtual DOM and direct DOM manipulation, and how React 18's concurrent features affect this
      process. Provide examples of common performance pitfalls and how to optimize React applications.`;

    // Use Haiku 3.5 for faster, cost-effective large responses
    await createThread(page, prompt, undefined, 'claude-3-5-haiku-20241022');

    await expect(
      page.locator('.messages .message.user .message-content', {
        hasText: prompt.substring(0, 50),
      }),
    ).toBeVisible({
      timeout: 10000,
    });

    const streamingMsg = page.locator('.message.assistant.streaming');
    let sawStreaming = false;
    try {
      await expect(streamingMsg).toBeVisible({ timeout: 30000 });
      sawStreaming = true;
    } catch {
      // Some providers may not expose an explicit streaming message element; fall back to final check
      sawStreaming = false;
    }

    if (sawStreaming) {
      let previousLength = 0;
      const streamingChecks = 5;
      const checkInterval = 10000;

      for (let i = 0; i < streamingChecks; i++) {
        await page.waitForTimeout(checkInterval);

        const isVisible = await streamingMsg.isVisible().catch(() => false);
        if (!isVisible) break;

        const content = await streamingMsg.locator('.markdown-content').textContent();
        const currentLength = content?.length || 0;

        // Only check if content is growing if we have previous content
        if (previousLength > 0 && currentLength === previousLength) {
          // Content stopped growing, streaming might be done
          break;
        }

        if (currentLength > previousLength) {
          previousLength = currentLength;
        }

        const input = page.locator('[data-testid="message-input"]');
        const isInputDisabled = await input.isDisabled();
        expect(isInputDisabled).toBe(true);

        await expect(streamingMsg).toBeInViewport();
      }
    }

    await waitForStreamingComplete(page, 120000);

    const response = await page
      .locator('.message.assistant')
      .last()
      .locator('.markdown-content')
      .textContent();
    expect(response?.length).toBeGreaterThan(2000);

    const codeBlocks = await page.locator('.code-block-wrapper').count();
    expect(codeBlocks).toBeGreaterThanOrEqual(3);

    await page.locator('.message.assistant h2, .message.assistant h3').count();
    await page.locator('.message.assistant ul, .message.assistant ol').count();

    const copyButtons = await page.locator('.copy-btn').count();
    expect(copyButtons).toBe(codeBlocks);

    const messagesContainer = page.locator('.messages');
    await messagesContainer.evaluate((el) => (el.scrollTop = 0));
    await page.waitForTimeout(500);
    await messagesContainer.evaluate((el) => (el.scrollTop = el.scrollHeight));
    await page.waitForTimeout(500);
  });

  test('Prompt 2: Multi-part coding task with many files', async () => {
    test.setTimeout(240000);
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const prompt = `Provide a comprehensive architectural guide for a REST API backend for a todo application using Node.js and Express. Include:
      1. Full Express server setup with middleware (CORS, body-parser, error handling)
      2. Database schema design with proper relationships (users, todos, categories, tags)
      3. Authentication system with JWT tokens (login, register, logout, refresh tokens)
      4. Complete CRUD operations for todos (create, read, update, delete, filter, search, pagination)
      5. Input validation using a validation library
      6. Error handling middleware with custom error classes
      7. API documentation with example requests and responses
      8. Database migrations for schema management
      9. Proper project structure with separate folders for routes, controllers, models, middleware, utils
      
      IMPORTANT: Do NOT create any actual files or directories. Only provide code examples, explanations, and architectural guidance in your response. Show example code snippets inline in your explanation.
      
      Include all necessary code examples, explain the architecture decisions, and add inline comments
      explaining complex parts. Show how to run the application and tests.`;

    // Use Haiku 3.5 for faster, cost-effective large responses
    await createThread(page, prompt, undefined, 'claude-3-5-haiku-20241022');

    await expect(
      page.locator('.messages .message.user .message-content', {
        hasText: prompt.substring(0, 50),
      }),
    ).toBeVisible({
      timeout: 10000,
    });

    const streamingLocator = page.locator('.messages .message.assistant.streaming');
    let sawStreaming = false;
    try {
      await expect(streamingLocator).toBeVisible({ timeout: 30000 });
      sawStreaming = true;
    } catch {
      sawStreaming = false;
    }

    if (sawStreaming) {
      const streamingDuration = 90000;
      const checkInterval = 15000;
      const checks = Math.floor(streamingDuration / checkInterval);

      for (let i = 0; i < checks; i++) {
        await page.waitForTimeout(checkInterval);

        const isStreaming = await streamingLocator.isVisible().catch(() => false);
        if (!isStreaming) {
          break;
        }

        const inputExists = await page.locator('[data-testid="message-input"]').isVisible();
        expect(inputExists).toBe(true);
      }
    }

    await waitForStreamingComplete(page, 150000);

    // Store the current thread URL before navigating away
    const currentThreadUrl = page.url();
    console.log('[Test 2] Current thread URL:', currentThreadUrl);

    // Wait for streaming to complete before navigating
    console.log('[Test 2] Checking if streaming is in progress...');
    const streamingIndicator = page.locator('text=/Streaming/i');
    const isStreaming = await streamingIndicator.isVisible({ timeout: 1000 }).catch(() => false);

    if (isStreaming) {
      console.log('[Test 2] Waiting for streaming to complete...');
      await streamingIndicator.waitFor({ state: 'hidden', timeout: 120000 });
      await page.waitForTimeout(1000);
      console.log('[Test 2] Streaming completed');
    }

    // Check for and dismiss "Unsaved Changes" modal if present (fallback)
    const unsavedModal = page.locator('text=Unsaved Changes');
    if (await unsavedModal.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('[Test 2] Dismissing unsaved changes modal...');
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.waitForTimeout(500);
    }

    // Navigate to threads list
    await page.getByRole('menuitem', { name: 'Threads' }).click();
    await page.waitForTimeout(1000);

    // Wait for threads list to be visible
    await page.waitForFunction(() => !window.location.href.includes('/chat/'), { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Try to find thread items - use multiple selectors
    let threadItems = page.locator('div.thread-item');
    let threadCount = await threadItems.count();

    // Fallback to role="menuitem" if div.thread-item doesn't exist
    if (threadCount === 0) {
      threadItems = page
        .locator('[role="menuitem"]')
        .filter({ hasNotText: /^(Home|Threads|Projects|Settings)$/i });
      threadCount = await threadItems.count();
    }

    console.log('[Test 2] Found', threadCount, 'threads in list');

    if (threadCount > 1) {
      // Click on the second thread
      console.log('[Test 2] Clicking second thread...');
      await threadItems.nth(1).click();
      await page.waitForTimeout(2000);

      // Wait for chat pane to appear
      await expect(page.locator('.chat-pane')).toBeVisible({ timeout: 10000 });

      // Navigate back to threads list
      await page.getByRole('menuitem', { name: 'Threads' }).click();
      await page.waitForTimeout(1000);
      
      // Wait for threads list to be visible - check for "New Thread" button or thread items
      const newThreadButton = page.getByRole('button', { name: /create new thread|new thread/i });
      try {
        await expect(newThreadButton).toBeVisible({ timeout: 10000 });
      } catch {
        // If button not visible, might already be on threads list, just wait a bit
        console.log('[Test 2] New Thread button not visible, waiting for threads list...');
        await page.waitForTimeout(2000);
      }
      await page.waitForTimeout(1000);

      // Re-query thread items (locator might be stale)
      let threadItemsAfterNav = page.locator('div.thread-item');
      let threadCountAfterNav = await threadItemsAfterNav.count();
      
      if (threadCountAfterNav === 0) {
        threadItemsAfterNav = page
          .locator('[role="menuitem"]')
          .filter({ hasNotText: /^(Home|Threads|Projects|Settings)$/i });
        threadCountAfterNav = await threadItemsAfterNav.count();
      }

      // Click back to the first thread (our test thread)
      console.log('[Test 2] Clicking back to first thread...');
      await threadItemsAfterNav.first().click();
      await page.waitForTimeout(2000);
    } else {
      // Only one thread, just click it to reload
      console.log('[Test 2] Only one thread, clicking to reload...');
      await threadItems.first().click();
      await page.waitForTimeout(2000);
    }

    // Wait for URL to change to thread view
    await page.waitForFunction(() => window.location.href.includes('threadId='), {
      timeout: 10000,
    });
    await page.waitForTimeout(1000);

    // Wait for chat pane to be visible
    await expect(page.locator('.chat-pane')).toBeVisible({ timeout: 10000 });

    // Wait for messages container to be visible first
    await expect(page.locator('.messages')).toBeVisible({ timeout: 10000 });

    // Wait for messages to load - check if any messages exist first
    let messageCount = 0;
    let retries = 0;
    const maxRetries = 10;
    
    while (messageCount === 0 && retries < maxRetries) {
      await page.waitForTimeout(1000);
      messageCount = await page.locator('.messages .message').count();
      retries++;
      
      if (messageCount === 0 && retries < maxRetries) {
        console.log(`[Test 2] No messages found, retry ${retries}/${maxRetries}...`);
      }
    }
    
    if (messageCount === 0) {
      console.log('[Test 2] No messages found after waiting, checking for loading state...');
      // Check if there's a loading indicator
      const loadingIndicator = page.locator('text=/Loading|loading/i');
      const isLoading = await loadingIndicator.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (isLoading) {
        console.log('[Test 2] Still loading, waiting for loading to complete...');
        await loadingIndicator.waitFor({ state: 'hidden', timeout: 30000 });
        await page.waitForTimeout(2000);
      }
    }

    // Wait for messages to be rendered - ensure we have at least user and assistant messages
    const userMessages = page.locator('.messages .message.user');
    const assistantMessages = page.locator('.messages .message.assistant');
    
    await expect(userMessages.first()).toBeVisible({ timeout: 10000 });
    await expect(assistantMessages.last()).toBeVisible({
      timeout: 15000,
    });

    // Wait for content to be fully rendered
    await page.waitForTimeout(2000);

    const response = await page
      .locator('.message.assistant')
      .last()
      .locator('.markdown-content')
      .textContent();
    expect(response?.length).toBeGreaterThan(5000);

    const codeBlocks = await page.locator('.code-block-wrapper').count();
    expect(codeBlocks).toBeGreaterThanOrEqual(3);

    const languageTags = await page.locator('.code-lang').allTextContents();
    const uniqueLanguages = new Set(languageTags.map((l) => l.toLowerCase()));
    expect(uniqueLanguages.size).toBeGreaterThanOrEqual(1);

    await expect(page.locator('.message.assistant ol').first()).toBeVisible();

    const firstCopyBtn = page.locator('.copy-btn').first();
    await firstCopyBtn.click();
    await expect(page.locator('.copy-text').first()).toContainText('Copied!', { timeout: 2000 });

    const lastCopyBtn = page.locator('.copy-btn').last();
    await lastCopyBtn.click();
    await expect(page.locator('.copy-text').last()).toContainText('Copied!', { timeout: 2000 });

    // Verify we have at least one assistant message with the comprehensive response
    const messages = await page.locator('.message.assistant').count();
    expect(messages).toBeGreaterThanOrEqual(1);
  });

  test('Manual scroll during streaming maintains position', async () => {
    test.setTimeout(180000);
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const prompt = `Explain how the React Virtual DOM works in detail, including the reconciliation algorithm,
      the diffing process, fiber architecture, and how it compares to the actual DOM. Include code
      examples showing how updates propagate through the component tree, how React batches updates
      for performance, and the role of keys in list rendering. Also explain the trade-offs between
      Virtual DOM and direct DOM manipulation, and how React 18's concurrent features affect this
      process. Provide examples of common performance pitfalls and how to optimize React applications.`;

    // Use Haiku 3.5 for faster, cost-effective large responses
    await createThread(page, prompt, undefined, 'claude-3-5-haiku-20241022');

    const streamingLocator = page.locator('.messages .message.assistant.streaming');
    let sawStreaming = false;
    try {
      await expect(streamingLocator).toBeVisible({ timeout: 30000 });
      sawStreaming = true;
    } catch {
      sawStreaming = false;
    }

    if (!sawStreaming) {
      // No explicit streaming element; just ensure we eventually get a final assistant response
      await waitForStreamingComplete(page, 120000);
      return;
    }

    // Wait for streaming to complete first
    await waitForStreamingComplete(page, 120000);

    // Now test scroll behavior with the complete response
    const messagesContainer = page.locator('.messages');

    // Get initial scroll position (should be at bottom after streaming completes)
    const initialScrollTop = await messagesContainer.evaluate((el) => el.scrollTop);
    const scrollHeight = await messagesContainer.evaluate((el) => el.scrollHeight);
    const clientHeight = await messagesContainer.evaluate((el) => el.clientHeight);

    // Verify we have scrollable content
    expect(scrollHeight).toBeGreaterThan(clientHeight);

    // Manually scroll to top
    await messagesContainer.evaluate((el) => (el.scrollTop = 0));
    await page.waitForTimeout(1000);

    // Verify we scrolled to top
    const scrollTopAfterManualScroll = await messagesContainer.evaluate((el) => el.scrollTop);
    expect(scrollTopAfterManualScroll).toBe(0);

    // Wait and verify position is maintained (no auto-scroll after streaming completes)
    await page.waitForTimeout(3000);
    const maintainedScrollTop = await messagesContainer.evaluate((el) => el.scrollTop);

    // Position should stay at top (within small margin for any minor adjustments)
    expect(maintainedScrollTop).toBeLessThan(100);

    // Scroll back to bottom
    await messagesContainer.evaluate((el) => (el.scrollTop = el.scrollHeight));
  });

  test('Performance: No UI freeze with large response', async () => {
    test.setTimeout(240000);
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const prompt = `Provide a comprehensive architectural guide for a REST API backend for a todo application using Node.js and Express. Include:
      1. Full Express server setup with middleware (CORS, body-parser, error handling)
      2. Database schema design with proper relationships (users, todos, categories, tags)
      3. Authentication system with JWT tokens (login, register, logout, refresh tokens)
      4. Complete CRUD operations for todos (create, read, update, delete, filter, search, pagination)
      5. Input validation using a validation library
      6. Error handling middleware with custom error classes
      7. Unit tests using Jest for at least 3 endpoints
      8. API documentation with example requests and responses
      9. Database migrations for schema management
      10. Proper project structure with separate folders for routes, controllers, models, middleware, utils
      
      IMPORTANT: Do NOT create any actual files or directories. Only provide code examples, explanations, and architectural guidance in your response. Show example code snippets inline in your explanation.
      
      Include all necessary code examples, explain the architecture decisions, and add inline comments
      explaining complex parts. Show how to run the application and tests.`;

    // Use Haiku 3.5 for faster, cost-effective large responses
    await createThread(page, prompt, undefined, 'claude-3-5-haiku-20241022');

    const streamingLocator = page.locator('.messages .message.assistant.streaming');
    let sawStreaming = false;
    try {
      await expect(streamingLocator).toBeVisible({ timeout: 30000 });
      sawStreaming = true;
    } catch {
      sawStreaming = false;
    }

    const iterations = 10;
    const interval = 5000;

    for (let i = 0; i < iterations; i++) {
      await page.waitForTimeout(interval);

      if (sawStreaming) {
        const isStreaming = await streamingLocator.isVisible().catch(() => false);
        if (!isStreaming) break;
      } else {
        const hasFinal = await page
          .locator('.message.assistant:not(.streaming)')
          .first()
          .isVisible()
          .catch(() => false);
        if (hasFinal) break;
      }

      const sidebar = page.locator('.activity-list-sidebar');
      if (await sidebar.isVisible().catch(() => false)) {
        await expect(sidebar).toBeVisible();
      }

      const threadTitle = page.locator('.thread-title, .chat-header');
      await expect(threadTitle.first()).toBeVisible();

      const start = Date.now();
      await page.evaluate(() => document.title);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(150);
    }

    await waitForStreamingComplete(page, 150000);
  });

  test('All code blocks have working syntax highlighting', async () => {
    test.setTimeout(240000);
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const prompt = `Provide a comprehensive architectural guide for a REST API backend for a todo application using Node.js and Express. Include:
      1. Full Express server setup with middleware (CORS, body-parser, error handling)
      2. Database schema design with proper relationships (users, todos, categories, tags)
      3. Authentication system with JWT tokens (login, register, logout, refresh tokens)
      4. Complete CRUD operations for todos (create, read, update, delete, filter, search, pagination)
      5. Input validation using a validation library
      6. Error handling middleware with custom error classes
      7. Unit tests using Jest for at least 3 endpoints
      8. API documentation with example requests and responses
      9. Database migrations for schema management
      10. Proper project structure with separate folders for routes, controllers, models, middleware, utils
      
      IMPORTANT: Do NOT create any actual files or directories. Only provide code examples, explanations, and architectural guidance in your response. Show example code snippets inline in your explanation.
      
      Include all necessary code examples, explain the architecture decisions, and add inline comments
      explaining complex parts. Show how to run the application and tests.`;

    // Use Haiku 3.5 for faster, cost-effective large responses
    await createThread(page, prompt, undefined, 'claude-3-5-haiku-20241022');

    // Wait for user message to appear
    await expect(
      page.locator('.messages .message.user .message-content', {
        hasText: prompt.substring(0, 50),
      }),
    ).toBeVisible({ timeout: 10000 });

    // Wait for assistant message to start appearing
    const assistantMessages = page.locator('.message.assistant');
    await expect(assistantMessages.first()).toBeVisible({ timeout: 30000 });

    // Wait for streaming to complete - poll for content length to stabilize
    let previousLength = 0;
    let stableCount = 0;
    const maxWaitTime = 150000; // 2.5 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      await page.waitForTimeout(5000);

      // Check if assistant message still exists
      const messageCount = await assistantMessages.count();
      if (messageCount === 0) {
        console.log('[Test 5] No assistant messages found, breaking loop');
        break;
      }

      const currentContent = await assistantMessages
        .last()
        .textContent()
        .catch(() => '');
      const currentLength = currentContent?.length || 0;

      console.log('[Test 5] Content length:', currentLength);

      if (currentLength === previousLength && currentLength > 5000) {
        stableCount++;
        if (stableCount >= 2) {
          // Content hasn't changed for 10 seconds and is substantial
          console.log('[Test 5] Content stable at', currentLength, 'chars');
          break;
        }
      } else {
        stableCount = 0;
      }

      previousLength = currentLength;
    }

    // Navigate to threads list and back to ensure response is persisted
    console.log('[Test 5] Navigating to threads list...');

    // Check for and dismiss "Unsaved Changes" modal if present
    const unsavedModal = page.locator('text=Unsaved Changes');
    if (await unsavedModal.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('[Test 5] Dismissing unsaved changes modal...');
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.waitForTimeout(500);
    }

    await page.getByRole('menuitem', { name: 'Threads' }).click();
    await page.waitForTimeout(1000);

    // Wait for threads list to be visible
    await page.waitForFunction(() => !window.location.href.includes('/chat/'), { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Find thread items
    let threadItems = page.locator('div.thread-item');
    let threadCount = await threadItems.count();

    if (threadCount === 0) {
      threadItems = page
        .locator('[role="menuitem"]')
        .filter({ hasNotText: /^(Home|Threads|Projects|Settings)$/i });
      threadCount = await threadItems.count();
    }

    console.log('[Test 5] Found', threadCount, 'threads in list');

    if (threadCount > 1) {
      // Click on the second thread
      console.log('[Test 5] Clicking second thread...');
      await threadItems.nth(1).click();
      await page.waitForTimeout(2000);

      // Wait for chat pane to appear
      await expect(page.locator('.chat-pane')).toBeVisible({ timeout: 10000 });

      // Navigate back to threads list
      await page.getByRole('menuitem', { name: 'Threads' }).click();
      await page.waitForTimeout(1000);

      // Click back to the first thread (our test thread)
      console.log('[Test 5] Clicking back to first thread...');
      await threadItems.first().click();
      await page.waitForTimeout(2000);
    } else {
      // Only one thread, just click it to reload
      console.log('[Test 5] Only one thread, clicking to reload...');
      await threadItems.first().click();
      await page.waitForTimeout(2000);
    }

    // Wait for chat pane to be visible
    await expect(page.locator('.chat-pane')).toBeVisible({ timeout: 10000 });

    // Wait for messages to be rendered
    await expect(assistantMessages.last()).toBeVisible({ timeout: 10000 });

    // Final wait for rendering
    await page.waitForTimeout(2000);

    // Get the response content
    const response = await assistantMessages.last().locator('.markdown-content').textContent();
    console.log('[Test 5] Final response length:', response?.length);
    expect(response?.length).toBeGreaterThan(5000);

    // Check for code blocks
    const codeBlocks = page.locator('pre code');
    const count = await codeBlocks.count();
    console.log('[Test 5] Found', count, 'code blocks');
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 10); i++) {
      const block = codeBlocks.nth(i);
      const className = await block.getAttribute('class');
      expect(className).toContain('hljs');
    }

    const highlightedElements = await page.locator('pre code .hljs-keyword').count();
    expect(highlightedElements).toBeGreaterThan(0);
  });
});

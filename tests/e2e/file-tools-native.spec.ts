/**
 * File Tools (Native) E2E Tests
 *
 * Exercises native file system tool functions (read_file, read_folder, write_file)
 * through the Playwright-driven Electron app.
 *
 * Validates: Requirements 1–7 from restore-e2e-file-tools-tests spec.
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import { addTestDataFolderToAllowedFolders, getTestDataFolderPath } from './helpers/testDataFolder';
import { navigateToHome } from '../helpers/ui-helpers';
import {
  sendMessage,
  getLastAssistantMessage,
  createThreadAndSend,
  expectNoRawToolSyntax,
} from '../helpers/chat-helpers';
import fs from 'node:fs';
import path from 'node:path';

const TEST_PREFIX = 'E2E-file-tools';
const TEST_DATA_PATH = getTestDataFolderPath();

let app: ElectronApplication;
let page: Page;

test.describe.serial('File Tools - Native', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await addTestDataFolderToAllowedFolders(page);
    await navigateToHome(page);
    // Wait for assistant cards to be visible before proceeding — confirms
    // the home page has fully loaded and models are available.
    await expect(page.locator('.application-card').first()).toBeVisible({ timeout: 30000 });
  });

  test.afterAll(async () => {
    // Clean up files created by write_file tests (prefixed with TEST_PREFIX)
    try {
      const entries = fs.readdirSync(TEST_DATA_PATH);
      for (const entry of entries) {
        if (entry.startsWith(`${TEST_PREFIX}-`)) {
          fs.unlinkSync(path.join(TEST_DATA_PATH, entry));
        }
      }
    } catch (err) {
      console.warn('[file-tools-native] Cleanup error:', err);
    }
    // NOTE: Threads created during this suite are not deleted.
    // Thread cleanup via context menu is fragile in serial E2E and risks
    // disturbing other threads. Orphan threads are harmless for test isolation.
    await app?.close();
  });

  test('read_folder lists directory contents', async () => {
    test.setTimeout(120000);
    await createThreadAndSend(
      page,
      `Use the read_folder tool to list all files in this directory: ${TEST_DATA_PATH}`,
    );
    const response = await getLastAssistantMessage(page);
    expect(response.toLowerCase()).toMatch(/bahamas|fiji|saba|stcroix/i);
  });

  test('read_folder error on non-existent path', async () => {
    test.setTimeout(120000);
    const fakePath = `/tmp/nonexistent-dir-${Date.now()}`;
    await sendMessage(
      page,
      `Use the read_folder tool to list files in ${fakePath}. Tell me the full error message if it fails.`,
    );
    const response = await getLastAssistantMessage(page);
    expect(response.toLowerCase()).toMatch(
      /not found|doesn't exist|does not exist|no such|error|cannot|couldn't|could not|fail|unable|directory.*not|doesn't|invalid/i,
    );
    // Verify the error is about the path we requested, not an unrelated failure
    expect(response).toMatch(/nonexistent/i);
  });

  test('read_file returns file content', async () => {
    test.setTimeout(120000);
    await createThreadAndSend(
      page,
      `Use the read_file tool to read the file at ${path.join(TEST_DATA_PATH, 'bahamas.md')}`,
    );
    const response = await getLastAssistantMessage(page);
    expect(response.toLowerCase()).toMatch(/bahamas|lucayan|nassau|atlantic/i);
  });

  test('read_file error on non-existent file', async () => {
    test.setTimeout(120000);
    const fakeFile = `nonexistent-file-${Date.now()}.md`;
    await sendMessage(
      page,
      `Use the read_file tool to read the file at ${path.join(TEST_DATA_PATH, fakeFile)}. Tell me the full error message if it fails.`,
    );
    const response = await getLastAssistantMessage(page);
    expect(response.toLowerCase()).toMatch(
      /not found|doesn't exist|does not exist|no such|error|cannot|couldn't|could not|fail|unable/i,
    );
    expect(response).toMatch(/nonexistent/i);
  });

  test('write_file creates a new file', async () => {
    test.setTimeout(120000);
    const testFile = `${TEST_PREFIX}-${Date.now()}.md`;
    const testFilePath = path.join(TEST_DATA_PATH, testFile);
    await createThreadAndSend(
      page,
      `Use the write_file tool to create a new file at ${testFilePath} with the content: "Hello from E2E test"`,
    );
    const response = await getLastAssistantMessage(page);
    expect(response.toLowerCase()).toMatch(/created|written|saved|success/i);
    expect(fs.existsSync(testFilePath)).toBe(true);
  });

  test('write_file overwrites with overwrite flag', async () => {
    test.setTimeout(120000);
    const entries = fs.readdirSync(TEST_DATA_PATH).filter((e) => e.startsWith(`${TEST_PREFIX}-`));
    expect(entries.length).toBeGreaterThan(0);
    const existingFile = path.join(TEST_DATA_PATH, entries[0]);
    await sendMessage(
      page,
      `Use the write_file tool to overwrite the file at ${existingFile} with new content: "Updated by E2E test". Set overwrite to true.`,
    );
    const response = await getLastAssistantMessage(page);
    expect(response.toLowerCase()).toMatch(/updated|overwritten|written|replaced|saved/i);
    const content = fs.readFileSync(existingFile, 'utf-8');
    expect(content).toContain('Updated by E2E test');
  });

  test('write_file error on invalid filename', async () => {
    test.setTimeout(120000);
    // Null byte in filename is rejected at the OS level on macOS/Linux.
    // Behavior may differ on Windows — this test assumes POSIX semantics.
    const invalidPath = path.join(TEST_DATA_PATH, 'invalid\0file.md');
    await sendMessage(
      page,
      `Use the write_file tool to create a file at ${invalidPath} with content: "test"`,
    );
    const response = await getLastAssistantMessage(page);
    expect(response.toLowerCase()).toMatch(/error|invalid|cannot|couldn't|could not|fail/i);
    expect(fs.existsSync(path.join(TEST_DATA_PATH, 'invalid\0file.md'))).toBe(false);
  });

  test('write_file error when file exists without overwrite', async () => {
    test.setTimeout(120000);
    const existingFile = path.join(TEST_DATA_PATH, 'bahamas.md');
    const originalContent = fs.readFileSync(existingFile, 'utf-8');
    await sendMessage(
      page,
      `Use the write_file tool to write "overwrite attempt" to the file at ${existingFile}. Do NOT set overwrite to true.`,
    );
    const response = await getLastAssistantMessage(page);
    expect(response.toLowerCase()).toMatch(/exists|already|error|cannot|overwrite/i);
    const currentContent = fs.readFileSync(existingFile, 'utf-8');
    expect(currentContent).toBe(originalContent);
  });

  test('blacklist denies access to ~/.ssh', async () => {
    test.setTimeout(120000);
    await createThreadAndSend(
      page,
      `Use the read_file tool to read the file at ~/.ssh/known_hosts`,
    );
    // Guard may block entirely (alert) or AI may respond with denial text
    const alertText = await page
      .locator('[role="alert"]')
      .textContent()
      .catch(() => '');
    const response = await getLastAssistantMessage(page);
    const combined = `${alertText} ${response}`.toLowerCase();
    expect(combined).toMatch(
      /access.denied|denied|blocked|not allowed|blacklist|restricted|forbidden|cannot access|security|no response|guard.*fail/i,
    );
  });

  test('whitelist denies access to non-allowed path', async () => {
    test.setTimeout(120000);
    // New thread — previous blacklist test may have left error state
    await createThreadAndSend(
      page,
      `Use the read_file tool to read the file at /tmp/not-allowed-${Date.now()}/secret.txt`,
    );
    const alertText = await page
      .locator('[role="alert"]')
      .textContent()
      .catch(() => '');
    const response = await getLastAssistantMessage(page);
    const combined = `${alertText} ${response}`.toLowerCase();
    expect(combined).toMatch(
      /access.denied|denied|not allowed|whitelist|restricted|forbidden|cannot access|not in.*allowed|security|no response|guard.*fail/i,
    );
  });

  test('multiple tool calls combined in one response', async () => {
    test.setTimeout(120000);
    await createThreadAndSend(
      page,
      `Use the read_file tool to read both of these files and summarize them: ${path.join(TEST_DATA_PATH, 'bahamas.md')} and ${path.join(TEST_DATA_PATH, 'fiji.md')}`,
    );
    const response = await getLastAssistantMessage(page);
    expect(response.toLowerCase()).toMatch(/bahamas/i);
    expect(response.toLowerCase()).toMatch(/fiji/i);
  });

  test('no raw tool syntax in responses', async () => {
    test.setTimeout(120000);
    await sendMessage(page, `Use the read_folder tool to list files in ${TEST_DATA_PATH}`);
    const response = await getLastAssistantMessage(page);
    expectNoRawToolSyntax(response);
    expect(response.length).toBeGreaterThan(10);
  });
});

/**
 * Shared Chat Interaction Helpers for E2E Tests
 *
 * Provides reusable functions for sending messages, reading AI responses,
 * and creating threads via application cards. Used by file-tools and other
 * E2E specs that interact with the chat UI.
 */

import { expect } from '@playwright/test';
import type { Page } from 'playwright';

/**
 * Send a message in the current thread and wait for the AI response.
 *
 * Waits for the message input to become disabled (send acknowledged) then
 * re-enabled (response complete). Gracefully handles guard-blocked requests
 * that produce "No response from model" instead of a chat bubble.
 */
export async function sendMessage(pg: Page, message: string): Promise<void> {
  const input = pg.locator('[data-testid="message-input"]');
  await expect(input).toBeVisible({ timeout: 10000 });
  await expect(input).toBeEnabled({ timeout: 60000 });
  await input.fill(message);

  const sendBtn = pg.locator('button.send-button');
  await expect(sendBtn).toBeVisible({ timeout: 5000 });
  await sendBtn.click();

  // Wait for input to become disabled (confirms message was sent and processing started)
  await expect(input)
    .not.toBeEnabled({ timeout: 10000 })
    .catch(() => {});

  // Wait for the message input to be re-enabled — most reliable signal that
  // the AI has finished responding (including tool calls)
  await expect(input).toBeEnabled({ timeout: 120000 });

  // Wait for a response bubble to appear, confirming the AI responded.
  // Guard-blocked requests may show "No response" alert instead — allow graceful failure.
  const allResponses = pg.locator('.chat-response .response-bubble');
  await expect(allResponses.last())
    .toBeVisible({ timeout: 30000 })
    .catch(() => {});

  // Electron/Svelte DOM needs a brief settle after response renders.
  // No explicit element state to wait on here — the response-bubble check above
  // covers the main signal; this prevents flaky text extraction immediately after.
  await pg.waitForTimeout(500);
}

/**
 * Get the text content of the last assistant response in the chat.
 *
 * Uses page.evaluate to query the DOM directly because Playwright locator-based
 * text extraction is unreliable in the Electron/Svelte rendering context.
 *
 * DOM selectors are coupled to:
 *   - ChatMessage.svelte → div[role="article"][aria-label="Chat message"]
 *   - ChatResponse.svelte → .response-text inside .chat-response > .response-bubble
 * Update this function if those components change their markup.
 */
export async function getLastAssistantMessage(pg: Page): Promise<string> {
  const chatMessages = pg.locator('div[role="article"][aria-label="Chat message"]');
  await expect(chatMessages.last()).toBeVisible({ timeout: 10000 });

  const text = await pg.evaluate(() => {
    const articles = document.querySelectorAll('div[role="article"][aria-label="Chat message"]');
    if (articles.length === 0) return '';
    const last = articles[articles.length - 1];

    // Primary: grab text from .response-text elements (ChatResponse component)
    const responseTexts = last.querySelectorAll('.response-text');
    if (responseTexts.length > 0) {
      return Array.from(responseTexts)
        .map((el) => el.textContent ?? '')
        .join('\n')
        .trim();
    }

    // Fallback: get all text from the article minus the first two children
    // (ChatRequest + ChatRequestCommands)
    const children = Array.from(last.children);
    if (children.length <= 2) return last.textContent ?? '';
    return children
      .slice(2)
      .map((el) => el.textContent ?? '')
      .join('\n')
      .trim();
  });

  return text;
}

/**
 * Create a new thread via a Claude-powered app card, then send the initial prompt.
 *
 * Clicks "+ New Thread", waits for application cards (with retry for transient
 * "No assistants" errors), selects a Claude card, and sends the given prompt.
 */
export async function createThreadAndSend(pg: Page, prompt: string): Promise<void> {
  await pg.locator('button[aria-label="+ New Thread"]').click();

  // Wait for application cards. Retry on transient "No assistants" error.
  const cards = pg.locator('.application-card');
  const retryBtn = pg.locator('button:has-text("Retry")');

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await expect(cards.first()).toBeVisible({ timeout: 15000 });
      break;
    } catch {
      if (await retryBtn.isVisible()) {
        await retryBtn.click();
      } else {
        await pg.locator('button[aria-label="+ New Thread"]').click();
      }
    }
  }

  await expect(cards.first()).toBeVisible({ timeout: 15000 });
  await pg
    .locator('.loading-state')
    .waitFor({ state: 'hidden', timeout: 20000 })
    .catch(() => {});
  await pg.waitForLoadState('networkidle').catch(() => {});

  // Prefer a Claude-powered card (skip Codex/Ollama)
  const allCards = await cards.all();
  let targetCard = cards.first(); // fallback
  for (const card of allCards) {
    const text = (await card.textContent()) ?? '';
    if (/claude/i.test(text) && !/codex/i.test(text)) {
      targetCard = card;
      break;
    }
  }

  await targetCard.click();
  await expect(pg).toHaveURL(/threadId=/, { timeout: 30000 });

  await sendMessage(pg, prompt);
}

/**
 * Assert that a response contains no raw tool-call JSON syntax.
 * Centralises the check so individual tests don't duplicate these matchers.
 */
export function expectNoRawToolSyntax(response: string): void {
  expect(response).not.toMatch(/\{"tool_use"/);
  expect(response).not.toMatch(/"type"\s*:\s*"tool_call"/);
  expect(response).not.toMatch(/"type"\s*:\s*"tool_result"/);
  expect(response).not.toMatch(/\{"name"\s*:\s*"read_/);
  expect(response).not.toMatch(/\{"name"\s*:\s*"write_/);
}

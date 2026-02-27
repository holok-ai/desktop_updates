/**
 * Dev-only API response capture utility.
 *
 * Dumps raw Moku API responses to disk as JSON fixtures for use in tests.
 * Enabled by setting the environment variable CAPTURE_API_DATA=true before
 * launching the Electron app.
 *
 * Captured files are written to tests/fixtures/api-captures/raw/ and should
 * be reviewed/curated into the appropriate subdirectory before committing.
 *
 * Usage:
 *   CAPTURE_API_DATA=true npm run dev
 *
 * Then exercise scenarios in the app. Files appear under api-captures/raw/.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import log from 'electron-log';

let captureDir: string | null = null;

function getCaptureDir(): string {
  if (!captureDir) {
    // Resolve relative to the current working directory (project root in dev)
    const projectRoot = process.cwd();
    captureDir = join(projectRoot, 'tests', 'fixtures', 'api-captures', 'raw');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    mkdirSync(captureDir, { recursive: true });
  }
  return captureDir;
}

/**
 * Whether capture mode is active.
 */
export function isCaptureEnabled(): boolean {
  return process.env.CAPTURE_API_DATA === 'true';
}

/**
 * Capture an API response to disk.
 *
 * @param label - Descriptive label for the capture (e.g. "getMessages-thread-abc")
 * @param data  - The raw response data to capture
 */
export function captureResponse(label: string, data: unknown): void {
  if (!isCaptureEnabled()) return;

  try {
    const dir = getCaptureDir();
    const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeLabel}-${Date.now()}.json`;
    const filepath = join(dir, filename);

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
    log.info(`[Capture] Wrote ${filepath}`);
  } catch (err) {
    log.error('[Capture] Failed to write capture file:', err);
  }
}

/**
 * Capture a messages response with thread context.
 * Convenience wrapper that labels the file with threadId.
 */
export function captureMessages(threadId: string, messages: unknown): void {
  captureResponse(`messages-${threadId}`, messages);
}

/**
 * Capture a thread response.
 */
export function captureThread(threadId: string, thread: unknown): void {
  captureResponse(`thread-${threadId}`, thread);
}

/**
 * Capture an error response together with minimal context.
 *
 * This is useful for recording provider / guard failures where we don't
 * get a normal MessageDTO[] payload but still want to replay or inspect
 * the failure shape in tests.
 */
export function captureError(params: {
  provider: string;
  model: string;
  threadId?: string;
  branchId?: string;
  originalPrompt?: string;
  error: unknown;
}): void {
  const { provider, model, threadId, branchId, originalPrompt, error } = params;

  captureResponse(`error-${provider}-${model}-${threadId ?? 'unknown'}-${branchId ?? 'unknown'}`, {
    provider,
    model,
    threadId,
    branchId,
    originalPrompt,
    error,
  });
}

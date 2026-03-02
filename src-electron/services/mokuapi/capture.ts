/**
 * Dev-only API response capture utility.
 *
 * Two modes:
 * 1. Original: captureMessages, captureResponse, captureError, captureThread
 *    → write to tests/fixtures/api-captures/raw/ (unchanged).
 * 2. Provider-based: captureMessagesToProvider, captureErrorToProvider
 *    → auto-detect provider/category and write to providers/<PROVIDER>/<category>/.
 *
 * Usage:
 *   CAPTURE_API_DATA=true npm run dev
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import log from 'electron-log';

// ── Raw capture dir (original behaviour) ──────────────────────────────────────

let captureDir: string | null = null;

function getCaptureDir(): string {
  if (!captureDir) {
    const projectRoot = process.cwd();
    captureDir = join(projectRoot, 'tests', 'fixtures', 'api-captures', 'raw');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    mkdirSync(captureDir, { recursive: true });
  }
  return captureDir;
}

// ── Provider detection helpers ────────────────────────────────────────────────

function projectRoot(): string {
  return process.cwd();
}

function ensureDir(dir: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  mkdirSync(dir, { recursive: true });
  return dir;
}

function detectProvider(messages: unknown[]): string {
  const msg = messages.find((m) => (m as Record<string, unknown>)?.provider);
  const raw = (msg as Record<string, unknown>)?.provider;
  return typeof raw === 'string' ? raw.toUpperCase() : 'UNKNOWN';
}

function detectCategory(messages: unknown[]): string {
  type Msg = Record<string, unknown>;

  const userTurns = messages.filter((m) => (m as Msg)?.role === 'user').length;
  const totalMessages = messages.length;
  if (userTurns >= 4 || totalMessages >= 8) return 'prompts/long-turn';

  const hasToolCalls = messages.some((m) => {
    const rd = (m as Msg)?.rawData as Msg | undefined;
    if (!rd) return false;
    const calls = rd.tool_calls;
    if (Array.isArray(calls) && calls.length > 0) return true;
    const content = (rd.message as Msg)?.content;
    if (Array.isArray(content) && content.some((b) => (b as Msg)?.type === 'tool_use')) return true;
    if ((rd.message as Msg)?.stop_reason === 'tool_use') return true;
    return false;
  });
  if (hasToolCalls) return 'tool-calling';

  const errorStatuses = new Set(['error', 'timeout', 'rate_limited', 'invalid_request']);
  const hasErrorStatus = messages.some((m) => errorStatuses.has((m as Msg)?.status as string));

  const hasJsonLeak = messages.some((m) => {
    if ((m as Msg)?.role !== 'assistant') return false;
    const content = (m as Msg)?.content;
    if (typeof content !== 'string' || content.length < 2) return false;
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  });

  if (hasErrorStatus || hasJsonLeak) return 'error-handling';

  const totalLen = messages.reduce(
    (sum: number, m) =>
      sum + (typeof (m as Msg)?.content === 'string' ? ((m as Msg).content as string).length : 0),
    0,
  );
  if (totalLen > 1500) return 'prompts/large';
  if (totalLen > 400) return 'prompts/medium';

  return 'prompts/small';
}

function labelFromMessages(messages: unknown[]): string {
  type Msg = Record<string, unknown>;
  const firstUser = messages.find((m) => (m as Msg)?.role === 'user');
  const content = (firstUser as Msg)?.content;
  if (typeof content !== 'string' || !content.trim()) return 'capture';
  return content
    .slice(0, 50)
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function detectModel(messages: unknown[]): string {
  const msg = messages.find((m) => (m as Record<string, unknown>)?.model);
  const raw = (msg as Record<string, unknown>)?.model;
  return typeof raw === 'string' ? raw : 'unknown-model';
}

function normalizeModel(model: string): string {
  return model
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resultTypeFromCategory(category: string): 'pass' | 'error' {
  return category === 'error-handling' ? 'error' : 'pass';
}

function buildTestSlug(category: string, label: string, timestamp: number): string {
  const cat = category.replace(/[\\/]/g, '-');
  return `${cat}-${label}-${timestamp}`;
}

// ── Public API: original (raw/) ───────────────────────────────────────────────

export function isCaptureEnabled(): boolean {
  return process.env.CAPTURE_API_DATA === 'true';
}

/**
 * Capture an API response to disk (original behaviour).
 * Writes to api-captures/raw/ with label and timestamp.
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
 * Capture a messages response with thread context (original behaviour).
 * Writes to api-captures/raw/ as messages-{threadId}-{timestamp}.json
 */
export function captureMessages(threadId: string, messages: unknown): void {
  captureResponse(`messages-${threadId}`, messages);
}

/**
 * Capture a thread response (original behaviour).
 * Writes to api-captures/raw/ as thread-{threadId}-{timestamp}.json
 */
export function captureThread(threadId: string, thread: unknown): void {
  captureResponse(`thread-${threadId}`, thread);
}

/**
 * Capture an error response (original behaviour).
 * Writes to api-captures/raw/ with provider, model, threadId, branchId, error.
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

// ── Public API: provider-based (providers/<PROVIDER>/<category>/) ───────────────

/**
 * Capture messages into the correct providers/<PROVIDER>/<category>/ folder.
 * Provider and category are auto-detected. Skips when UNKNOWN and empty [].
 */
export function captureMessagesToProvider(threadId: string, messages: unknown): void {
  if (!isCaptureEnabled()) return;

  try {
    const arr = Array.isArray(messages) ? messages : [];
    const provider = detectProvider(arr);
    if (provider === 'UNKNOWN' && arr.length === 0) return;
    const category = detectCategory(arr);
    const label = labelFromMessages(arr);
    const modelRaw = detectModel(arr);
    const modelSlug = normalizeModel(modelRaw);
    const kind = resultTypeFromCategory(category);
    const ts = Date.now();
    const testSlug = buildTestSlug(category, label, ts);

    const dir = ensureDir(
      join(
        projectRoot(),
        'tests',
        'fixtures',
        'api-captures',
        'providers',
        provider,
        ...category.split('/'),
      ),
    );

    const providerPrefix = provider.toLowerCase();
    const filename = `${providerPrefix}_${modelSlug}-${kind}-${testSlug}.json`;
    const filepath = join(dir, filename);

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    writeFileSync(filepath, JSON.stringify(messages, null, 2), 'utf-8');
    log.info(`[Capture] ${provider}/${category}/${filename}`);
  } catch (err) {
    log.error('[Capture] Failed to write capture file:', err);
  }
}

/**
 * Capture an error into providers/<PROVIDER>/error-handling/.
 */
export function captureErrorToProvider(params: {
  provider: string;
  model: string;
  threadId?: string;
  branchId?: string;
  originalPrompt?: string;
  error: unknown;
}): void {
  if (!isCaptureEnabled()) return;

  try {
    const { provider, model, threadId, branchId, originalPrompt, error } = params;
    const providerUpper = provider.toUpperCase();
    const modelSlug = normalizeModel(model);
    const kind: 'pass' | 'error' = 'error';
    const label = originalPrompt
      ? originalPrompt
          .slice(0, 50)
          .replace(/[^a-zA-Z0-9 ]/g, ' ')
          .trim()
          .replace(/\s+/g, '-')
          .toLowerCase()
      : 'error';
    const ts = Date.now();
    const testSlug = buildTestSlug('error-handling', label, ts);

    const dir = ensureDir(
      join(
        projectRoot(),
        'tests',
        'fixtures',
        'api-captures',
        'providers',
        providerUpper,
        'error-handling',
      ),
    );

    const providerPrefix = provider.toLowerCase();
    const filename = `${providerPrefix}_${modelSlug}-${kind}-${testSlug}.json`;
    const filepath = join(dir, filename);

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    writeFileSync(
      filepath,
      JSON.stringify({ provider, model, threadId, branchId, originalPrompt, error }, null, 2),
      'utf-8',
    );
    log.info(`[Capture] ${providerUpper}/error-handling/${filename}`);
  } catch (err) {
    log.error('[Capture] Failed to write error capture:', err);
  }
}

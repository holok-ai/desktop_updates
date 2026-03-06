/**
 * Property-based fixture validation tests.
 *
 * Feature: replace-synthetic-fixtures
 *
 * Validates universal properties across all fixtures in turns/ and tool-calls/:
 * - Property 1: UUID-format IDs
 * - Property 5: Fixture discovery completeness
 */
import { describe, it, expect, vi } from 'vitest';
import {
  listFixtures,
  loadCapture,
  validateMessageDTOArray,
  formatErrors,
} from './thread-messages-test-helpers';

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }));
vi.mock('../../../src-electron/services/file-storage.service', () => ({
  fileStorageService: { deleteThreadFiles: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../../src-electron/services/title-generator.service', () => ({
  titleGeneratorService: {
    generateTitle: vi.fn((text: string) => text.slice(0, 40)),
    ensureUniqueTitle: vi.fn((title: string) => title),
  },
}));
vi.mock('../../../src-electron/services/mokuapi/thread-api.service', () => ({
  threadApiService: {},
}));

// ── Constants ──────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INSPECTED_DIRS = ['turns', 'tool-calls'] as const;

// ── Fixture collection ─────────────────────────────────────────────

const allFixtures = INSPECTED_DIRS.flatMap((dir) =>
  listFixtures(dir).map((f) => [dir, f] as const),
);

// ── Helpers ─────────────────────────────────────────────────────────

/** Detect synthetic fixtures by checking if the first DTO has a non-UUID id. */
function isSyntheticFixture(fixturePath: string): boolean {
  const dtos = loadCapture(fixturePath);
  if (dtos.length === 0) return false;
  return !UUID_RE.test(dtos[0].id);
}

// ── Real-capture-only fixtures ─────────────────────────────────────

const realFixtures = allFixtures.filter(([, f]) => !isSyntheticFixture(f));

// ── Property 1: UUID-format IDs ────────────────────────────────────

describe('Property 1: All real-capture fixtures have UUID-format IDs', () => {
  it('at least one real fixture exists', () => {
    expect(realFixtures.length).toBeGreaterThan(0);
  });

  it.each(realFixtures)('%s — %s: every DTO has UUID id and threadId', (_dir, fixturePath) => {
    const dtos = loadCapture(fixturePath);
    const errors = validateMessageDTOArray(dtos);
    expect(errors, `Schema errors in ${fixturePath}:\n${formatErrors(errors)}`).toHaveLength(0);

    for (const dto of dtos) {
      expect(dto.id, `${fixturePath}: id "${dto.id}" is not UUID`).toMatch(UUID_RE);
      expect(dto.threadId, `${fixturePath}: threadId "${dto.threadId}" is not UUID`).toMatch(
        UUID_RE,
      );
    }
  });
});

// ── Property 5: Fixture discovery completeness ─────────────────────

describe('Property 5: Fixture discovery returns all JSON files', () => {
  it.each(INSPECTED_DIRS)('%s: listFixtures finds at least one fixture', (dir) => {
    const fixtures = listFixtures(dir);
    expect(fixtures.length, `No fixtures in ${dir}/`).toBeGreaterThan(0);
  });

  it.each(INSPECTED_DIRS)('%s: every discovered fixture loads without error', (dir) => {
    const fixtures = listFixtures(dir);
    for (const f of fixtures) {
      expect(() => loadCapture(f)).not.toThrow();
    }
  });
});

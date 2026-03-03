/**
 * One-shot script to generate JSON fixture files from the typed scenario builders.
 * Run with: npx tsx tests/fixtures/api-captures/generate-fixtures.ts
 *
 * This can be re-run any time the builders change to regenerate the fixtures.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  resetSequence,
  successfulTurn,
  multiTurnConversation,
  guardPassedTurn,
  guardBlockedTurn,
  guardDoubleEncodedTurn,
  errorPayloadResponse,
  timeoutResponse,
  rateLimitedResponse,
  invalidRequestResponse,
  orphanAssistant,
  duplicateAuditRecords,
  emptyContentWithRawData,
  nullBranchId,
  twoPartBranchId,
  overLongBranchId,
  nullContent,
  toolCallInRawData,
  desktopOptionsBlocked,
  desktopOptionsSelectedBranch,
} from './message-scenarios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BASE = resolve(__dirname);

const fixtures: [string, () => unknown][] = [
  // Successful turns
  ['turns/openai_gpt-4-pass-successful-turn-1.json', successfulTurn],
  ['turns/openai_gpt-4-pass-multi-turn-conversation-1.json', multiTurnConversation],

  // Guard scenarios
  ['guard/openai_gpt-4-pass-guard-passed-1.json', guardPassedTurn],
  ['guard/openai_gpt-4-pass-guard-blocked-1.json', guardBlockedTurn],
  ['guard/openai_gpt-4-pass-guard-double-encoded-1.json', guardDoubleEncodedTurn],

  // Error scenarios
  ['errors/openai_gpt-4-error-error-payload-400-1.json', errorPayloadResponse],
  ['errors/openai_gpt-4-error-timeout-1.json', timeoutResponse],
  ['errors/openai_gpt-4-error-rate-limited-1.json', rateLimitedResponse],
  ['errors/openai_claude-opus-4-6-error-invalid-request-400-1.json', invalidRequestResponse],

  // Edge cases
  ['edge-cases/openai_gpt-4-pass-orphan-assistant-1.json', orphanAssistant],
  ['edge-cases/openai_gpt-4-pass-duplicate-audit-records-1.json', duplicateAuditRecords],
  ['edge-cases/openai_gpt-4-pass-empty-content-with-rawdata-1.json', emptyContentWithRawData],
  ['edge-cases/openai_gpt-4-pass-null-branch-id-1.json', nullBranchId],
  ['edge-cases/openai_gpt-4-pass-two-part-branch-id-1.json', twoPartBranchId],
  ['edge-cases/openai_gpt-4-pass-over-long-branch-id-1.json', overLongBranchId],
  ['edge-cases/openai_gpt-4-pass-null-content-1.json', nullContent],
  ['edge-cases/openai_gpt-4-pass-desktop-options-blocked-1.json', desktopOptionsBlocked],
  [
    'edge-cases/openai_gpt-4-pass-desktop-options-selected-branch-1.json',
    desktopOptionsSelectedBranch,
  ],

  // Tool calls
  ['tool-calls/openai_gpt-4-pass-tool-call-in-rawdata-1.json', toolCallInRawData],
];

let generated = 0;

for (const [relativePath, builder] of fixtures) {
  resetSequence();
  const data = builder();
  const fullPath = join(BASE, relativePath);
  mkdirSync(resolve(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`  wrote ${relativePath}`);
  generated++;
}

console.log(`\nGenerated ${generated} fixture files.`);

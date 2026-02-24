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
  ['turns/01-successful-turn.json', successfulTurn],
  ['turns/02-multi-turn-conversation.json', multiTurnConversation],

  // Guard scenarios
  ['guard/03-guard-passed.json', guardPassedTurn],
  ['guard/04-guard-blocked.json', guardBlockedTurn],
  ['guard/05-guard-double-encoded.json', guardDoubleEncodedTurn],

  // Error scenarios
  ['errors/06-error-payload-400.json', errorPayloadResponse],
  ['errors/17-timeout.json', timeoutResponse],
  ['errors/18-rate-limited.json', rateLimitedResponse],
  ['errors/19-invalid-request.json', invalidRequestResponse],

  // Edge cases
  ['edge-cases/07-orphan-assistant.json', orphanAssistant],
  ['edge-cases/08-duplicate-audit-records.json', duplicateAuditRecords],
  ['edge-cases/09-empty-content-with-rawdata.json', emptyContentWithRawData],
  ['edge-cases/10-null-branch-id.json', nullBranchId],
  ['edge-cases/11-two-part-branch-id.json', twoPartBranchId],
  ['edge-cases/12-over-long-branch-id.json', overLongBranchId],
  ['edge-cases/13-null-content.json', nullContent],
  ['edge-cases/15-desktop-options-blocked.json', desktopOptionsBlocked],
  ['edge-cases/16-desktop-options-selected-branch.json', desktopOptionsSelectedBranch],

  // Tool calls
  ['tool-calls/14-tool-call-in-rawdata.json', toolCallInRawData],
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

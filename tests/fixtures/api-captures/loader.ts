/**
 * Fixture loader for captured Moku API responses.
 *
 * JSON files under api-captures/ represent raw MessageDTO[] arrays
 * exactly as returned by threadApiService.getMessages().data.content.
 *
 * Usage in tests:
 *   import { loadCapture, pagedCapture } from '../../fixtures/api-captures/loader';
 *   mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedCapture('turns/successful-openai-turn.json')));
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { MessageDTO, PagedResponse } from 'src-electron/services/mokuapi/thread.types';

/**
 * Load a captured MessageDTO[] from a JSON fixture file.
 * @param relativePath - Path relative to the api-captures/ directory (e.g. 'turns/successful-openai-turn.json')
 */
export function loadCapture(relativePath: string): MessageDTO[] {
  const fullPath = resolve(__dirname, relativePath);
  const raw = readFileSync(fullPath, 'utf-8');
  return JSON.parse(raw) as MessageDTO[];
}

/**
 * Load a captured fixture and wrap it in the PagedResponse envelope
 * that threadApiService.getMessages() returns.
 */
export function pagedCapture(relativePath: string): PagedResponse<MessageDTO> {
  const messages = loadCapture(relativePath);
  return pagedMessages(messages);
}

/**
 * Wrap a MessageDTO[] in a PagedResponse envelope.
 * Shared between fixture loader and inline test data.
 */
export function pagedMessages(messages: MessageDTO[]): PagedResponse<MessageDTO> {
  return {
    content: messages,
    page: 0,
    size: 1000,
    totalElements: messages.length,
    totalPages: 1,
    first: true,
    last: true,
    hasNext: false,
    hasPrevious: false,
  };
}

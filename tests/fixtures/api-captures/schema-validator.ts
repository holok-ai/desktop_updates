/**
 * Lightweight MessageDTO schema validator for fixture drift detection.
 *
 * Validates that captured JSON fixtures still match the expected MessageDTO
 * shape. Run as a test — if the API schema changes and fixtures aren't
 * updated, this fails fast with a clear description of what drifted.
 *
 * No external dependencies — uses plain runtime type checks against the
 * MessageDTO contract defined in src-electron/services/mokuapi/thread.types.ts.
 */
import type { MessageDTO, LLMStatus } from 'src-electron/services/mokuapi/thread.types';

const VALID_LLM_STATUSES: readonly (LLMStatus | string | null)[] = [
  'success',
  'error',
  'timeout',
  'partial',
  'rate_limited',
  'invalid_request',
  'chat', // Used by provider fixtures for user messages (not in LLMStatus type but valid API value)
  null,
];

const VALID_ROLES: readonly (string | null)[] = ['user', 'assistant', 'system', null];

interface ValidationError {
  field: string;
  expected: string;
  actual: string;
}

/**
 * Validate a single MessageDTO against the expected schema.
 * Returns an array of validation errors (empty = valid).
 */
export function validateMessageDTO(dto: unknown, index?: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = index !== undefined ? `[${index}].` : '';

  if (!dto || typeof dto !== 'object') {
    return [{ field: `${prefix}(root)`, expected: 'object', actual: typeof dto }];
  }

  const obj = dto as Record<string, unknown>;

  // Required string fields
  for (const field of ['id', 'threadId', 'createdAt', 'updatedAt']) {
    if (typeof obj[field] !== 'string') {
      errors.push({
        field: `${prefix}${field}`,
        expected: 'string',
        actual: `${typeof obj[field]} (${JSON.stringify(obj[field])})`,
      });
    }
  }

  // Nullable string fields
  for (const field of ['branchId', 'model', 'provider', 'role', 'createdUserId']) {
    if (obj[field] !== null && typeof obj[field] !== 'string') {
      errors.push({
        field: `${prefix}${field}`,
        expected: 'string | null',
        actual: `${typeof obj[field]} (${JSON.stringify(obj[field])})`,
      });
    }
  }

  // role must be in the valid set
  if (!VALID_ROLES.includes(obj['role'] as string | null)) {
    errors.push({
      field: `${prefix}role`,
      expected: `one of ${JSON.stringify(VALID_ROLES)}`,
      actual: JSON.stringify(obj['role']),
    });
  }

  // status must be in the valid set
  if (!VALID_LLM_STATUSES.includes(obj['status'] as LLMStatus | null)) {
    errors.push({
      field: `${prefix}status`,
      expected: `one of ${JSON.stringify(VALID_LLM_STATUSES)}`,
      actual: JSON.stringify(obj['status']),
    });
  }

  // content, rawData are JSONB — can be anything (string, object, null, etc.)
  // We only check they exist as keys
  if (!('content' in obj)) {
    errors.push({ field: `${prefix}content`, expected: 'present (any type)', actual: 'missing' });
  }
  if (!('rawData' in obj)) {
    errors.push({ field: `${prefix}rawData`, expected: 'present (any type)', actual: 'missing' });
  }
  // options is JSONB and may be absent on assistant messages in real API responses
  // (only user/request messages carry options). We accept its absence.
  if (!('options' in obj)) {
    // Not an error — options is optional in real provider fixtures
  }

  // Timestamp format check (ISO-8601 or server format)
  for (const field of ['createdAt', 'updatedAt']) {
    const val = obj[field];
    if (typeof val === 'string') {
      const parsed = new Date(val.includes(' ') ? val.replace(' ', 'T') + 'Z' : val);
      if (isNaN(parsed.getTime())) {
        errors.push({
          field: `${prefix}${field}`,
          expected: 'parseable timestamp',
          actual: `"${val}" (unparseable)`,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate an entire MessageDTO[] array. Returns all errors across all messages.
 */
export function validateMessageDTOArray(dtos: unknown): ValidationError[] {
  if (!Array.isArray(dtos)) {
    return [{ field: '(root)', expected: 'array', actual: typeof dtos }];
  }

  const errors: ValidationError[] = [];
  for (let i = 0; i < dtos.length; i++) {
    errors.push(...validateMessageDTO(dtos[i], i));
  }
  return errors;
}

/**
 * Pretty-format validation errors for assertion messages.
 */
export function formatErrors(errors: ValidationError[]): string {
  return errors.map((e) => `  ${e.field}: expected ${e.expected}, got ${e.actual}`).join('\n');
}

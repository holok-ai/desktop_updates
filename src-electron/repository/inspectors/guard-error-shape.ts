/**
 * Shared definition for the guard/PII error payload shape.
 *
 * When the Moku server rejects a request due to a guard rule (e.g. PII
 * detection), it returns a JSON envelope matching this shape.  Both
 * `GuardInspector` (which hides these messages) and `ErrorResponseInspector`
 * (which must *skip* them) reference this single definition so the check
 * stays consistent and easy to maintain.
 *
 * Current shape:
 * ```json
 * {
 *   "type": "error",
 *   "status": 400,
 *   "requestId": "<uuid>",
 *   "seq": 0,
 *   "error": { … }
 * }
 * ```
 */

/** Required top-level fields that identify a guard error payload. */
export const GUARD_ERROR_REQUIRED_FIELDS = ['requestId', 'seq', 'error'] as const;

/** HTTP status code used for guard rejections. */
export const GUARD_ERROR_STATUS = 400;

/**
 * Returns `true` when `content` is a parsed JSON object matching the
 * guard / PII error envelope shape.
 *
 * The check intentionally avoids importing provider-specific logic — it
 * only looks at the structural envelope fields that are common across all
 * providers when the Moku server rejects a request.
 */
export function isGuardErrorPayload(content: unknown): boolean {
  if (!content || typeof content !== 'object') return false;

  const c = content as Record<string, unknown>;

  if (c.type !== 'error') return false;
  if (c.status !== GUARD_ERROR_STATUS) return false;

  for (const field of GUARD_ERROR_REQUIRED_FIELDS) {
    if (!(field in c)) return false;
  }

  return true;
}

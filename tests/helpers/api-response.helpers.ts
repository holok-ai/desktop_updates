/**
 * Shared test assertion helpers for ApiResponse<T> contract testing.
 *
 * These verify the discriminated union shape returned by IPC handlers:
 *   Success: { success: true, data: T, errorCode: 0, errorText: '' }
 *   Failure: { success: false, data: null, errorCode: number, errorText: string }
 */
import { expect } from 'vitest';

/**
 * Assert that a value is a successful ApiResponse and narrow the type.
 */
export function expectApiSuccess<T = unknown>(result: unknown): asserts result is {
  success: true;
  data: T;
  errorCode: 0;
  errorText: '';
} {
  expect(result).toHaveProperty('success', true);
  expect(result).toHaveProperty('errorCode', 0);
  expect(result).toHaveProperty('errorText', '');
  expect(result).toHaveProperty('data');
  expect((result as Record<string, unknown>).data).not.toBeNull();
}

/**
 * Assert that a value is a successful ApiResponse where data may be undefined (void).
 */
export function expectApiSuccessVoid(result: unknown): void {
  expect(result).toHaveProperty('success', true);
  expect(result).toHaveProperty('errorCode', 0);
  expect(result).toHaveProperty('errorText', '');
}

/**
 * Assert that a value is a failed ApiResponse with the expected error code.
 */
export function expectApiFail(result: unknown, expectedCode?: number): void {
  expect(result).toHaveProperty('success', false);
  expect(result).toHaveProperty('data', null);
  expect((result as Record<string, unknown>).errorCode).not.toBe(0);
  expect((result as Record<string, unknown>).errorText).toBeTruthy();
  if (expectedCode !== undefined) {
    expect(result).toHaveProperty('errorCode', expectedCode);
  }
}

/**
 * ApiResponse<T> discriminated union
 * Standard return type for model-repository and moku API service calls.
 */

export type ApiResponse<T> =
  | { success: true; data: T; errorCode: 0; errorText: '' }
  | { success: false; data: null; errorCode: number; errorText: string };

/**
 * Construct a successful ApiResponse.
 */
export function apiOk<T>(data: T): ApiResponse<T> {
  return { success: true, data, errorCode: 0, errorText: '' };
}

/**
 * Construct a failed ApiResponse.
 */
export function apiFail<T>(errorCode: number, errorText: string): ApiResponse<T> {
  return { success: false, data: null, errorCode, errorText };
}

/**
 * Wrap an async fetch-based call and convert thrown errors into ApiResponse failures.
 *
 * HTTP errors (Response objects or errors with a `statusCode` / `status` property)
 * use the HTTP status code as errorCode. Network/unknown errors use -1.
 */
export async function apiCall<T>(fn: () => Promise<T>): Promise<ApiResponse<T>> {
  try {
    const data = await fn();
    return apiOk(data);
  } catch (err: unknown) {
    // HolokaiError or any error carrying a numeric statusCode
    if (err instanceof Error) {
      const asAny = err as unknown as Record<string, unknown>;
      const statusCode =
        typeof asAny['statusCode'] === 'number'
          ? asAny['statusCode']
          : typeof asAny['status'] === 'number'
            ? asAny['status']
            : null;

      if (statusCode !== null && statusCode > 0) {
        return apiFail(statusCode, err.message);
      }
      return apiFail(-1, err.message);
    }

    // Non-Error thrown value (string, object, etc.)
    return apiFail(-1, String(err));
  }
}

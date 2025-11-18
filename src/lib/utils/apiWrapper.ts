/**
 * Wraps an Electron API call with consistent error handling and logging.
 *
 * @param operation - The async function to execute (typically an Electron API call)
 * @param errorContext - A descriptive message for logging (e.g., "Failed to load projects")
 * @param options - Optional configuration (e.g., custom logger)
 * @returns The result from the operation
 * @throws Re-throws the original error after logging
 *
 * @example
 * const projects = await wrapElectronCall(
 *   () => window.electronAPI.project.getAll(),
 *   'Failed to load projects'
 * );
 */
type WrapLogger = (message: string, error: unknown) => void;

interface WrapOptions {
  logger?: WrapLogger;
}

const defaultLogger: WrapLogger = (message, error) => {
  console.error(message, error);
};

export async function wrapElectronCall<T>(
  operation: () => Promise<T>,
  errorContext: string,
  options?: WrapOptions,
): Promise<T> {
  const logger = options?.logger ?? defaultLogger;
  try {
    return await operation();
  } catch (error) {
    logger(`${errorContext}:`, error);
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Wraps an Electron API call with error handling and a fallback value on failure.
 * Use this variant when you want to return a default value instead of throwing.
 *
 * @param operation - The async function to execute
 * @param errorContext - A descriptive message for logging
 * @param fallbackValue - The value to return if the operation fails
 * @param options - Optional configuration (e.g., custom logger)
 * @returns The result from the operation, or fallbackValue on error
 *
 * @example
 * const count = await wrapElectronCallWithFallback(
 *   () => window.electronAPI.project.getThreadCount(id),
 *   'Failed to get thread count',
 *   0
 * );
 */
export async function wrapElectronCallWithFallback<T>(
  operation: () => Promise<T>,
  errorContext: string,
  fallbackValue: T,
  options?: WrapOptions,
): Promise<T> {
  const logger = options?.logger ?? defaultLogger;
  try {
    return await operation();
  } catch (error) {
    logger(`${errorContext}:`, error);
    return fallbackValue;
  }
}

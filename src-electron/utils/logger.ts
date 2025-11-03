import log from 'electron-log';
import { app } from 'electron';
import path from 'node:path';

/**
 * Centralized Logger Configuration
 *
 * This module provides a configured electron-log instance with:
 * - File rotation and retention
 * - Appropriate log levels
 * - Structured logging format
 * - Context metadata
 */

// Configure log paths
log.transports.file.resolvePath = (variables) => {
  return path.join(app.getPath('userData'), 'logs', variables.fileName || 'app.log');
};

// Set log levels based on environment
const isDevelopment = process.env.NODE_ENV === 'development';
log.transports.file.level = 'info';
log.transports.console.level = isDevelopment ? 'debug' : 'info';

// Configure file rotation and size limits
log.transports.file.maxSize = 50 * 1024 * 1024; // 50MB
// Note: maxAge is not available in electron-log, rotation is handled by maxSize

// Configure log format with timestamp, level, and context
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] {text}';

// Add application context to all logs
log.variables.appVersion = app.getVersion();
log.variables.platform = process.platform;
log.variables.nodeVersion = process.versions.node;

/**
 * Create scoped loggers for different modules
 * Usage: const authLog = createScopedLogger('auth');
 */
export function createScopedLogger(scope: string): {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
} {
  return {
    info: (message: string, ...args: unknown[]) =>
      log.info(`[${scope.toUpperCase()}] ${message}`, ...args),
    warn: (message: string, ...args: unknown[]) =>
      log.warn(`[${scope.toUpperCase()}] ${message}`, ...args),
    error: (message: string, ...args: unknown[]) =>
      log.error(`[${scope.toUpperCase()}] ${message}`, ...args),
    debug: (message: string, ...args: unknown[]) =>
      log.debug(`[${scope.toUpperCase()}] ${message}`, ...args),
  };
}

/**
 * Log with structured metadata
 * Usage: logStructured('info', 'User action performed', { action: 'CREATE_THREAD', userId: '123' });
 */
export function logStructured(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  metadata?: Record<string, unknown>,
): void {
  const logMessage = metadata ? `${message} ${JSON.stringify(metadata)}` : message;

  switch (level) {
    case 'info':
      log.info(logMessage);
      break;
    case 'warn':
      log.warn(logMessage);
      break;
    case 'error':
      log.error(logMessage);
      break;
    case 'debug':
      log.debug(logMessage);
      break;
  }
}

/**
 * Performance logging helper
 * Usage: const perfLog = logPerformance('thread:create');
 */
export function logPerformance(operation: string): {
  end: (metadata?: Record<string, unknown>) => void;
} {
  const startTime = Date.now();

  return {
    end: (metadata?: Record<string, unknown>) => {
      const duration = Date.now() - startTime;
      logStructured('debug', `Performance: ${operation}`, {
        ...metadata,
        duration: `${duration}ms`,
      });
    },
  };
}

/**
 * Error logging with stack trace
 * Usage: logError('Failed to load threads', error, { threadId: '123' });
 */
export function logError(message: string, error: Error, metadata?: Record<string, unknown>): void {
  log.error(message, {
    ...metadata,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
  });
}

export default log;

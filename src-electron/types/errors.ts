/**
 * Custom Error Types
 * Domain-specific errors for better error handling
 */

/**
 * Base error class for Holokai errors
 */
export class HolokaiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Authentication error (401)
 * User is not authenticated or token is invalid
 */
export class UnauthorizedError extends HolokaiError {
  constructor(message = 'Not authenticated. Please log in.') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

/**
 * Authorization error (403)
 * User does not have permission to perform action
 */
export class ForbiddenError extends HolokaiError {
  constructor(message = 'Access denied. Insufficient permissions.') {
    super(message, 'FORBIDDEN', 403);
  }
}

/**
 * Resource not found error (404)
 */
export class NotFoundError extends HolokaiError {
  constructor(resourceType: string, resourceId: string) {
    super(`${resourceType} not found: ${resourceId}`, 'NOT_FOUND', 404);
  }
}

/**
 * Validation error (400)
 * Input data does not meet validation requirements
 */
export class ValidationError extends HolokaiError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly constraint?: string,
  ) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

/**
 * Conflict error (409)
 * Resource already exists or operation conflicts with current state
 */
export class ConflictError extends HolokaiError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

/**
 * Network error
 * Connection issues, timeouts, etc.
 */
export class NetworkError extends HolokaiError {
  constructor(
    message: string,
    public readonly originalError?: Error,
  ) {
    super(message, 'NETWORK_ERROR');
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends HolokaiError {
  constructor(
    message = 'Rate limit exceeded. Please try again later.',
    public readonly retryAfter?: number,
  ) {
    super(message, 'RATE_LIMIT', 429);
  }
}

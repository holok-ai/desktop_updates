/* eslint-disable security/detect-object-injection */
/**
 * Error message templates for thread copy operations
 * Feature: thread-copy-functionality
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4
 */

export type CopyErrorCode =
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'FILE_TOO_LARGE'
  | 'CANCELLED'
  | 'UNKNOWN';

export interface CopyErrorMessage {
  message: string;
  suggestion?: string;
}

/**
 * Error message templates with user-friendly explanations and corrective actions
 */
export const COPY_ERROR_MESSAGES: Record<CopyErrorCode, CopyErrorMessage> = {
  PERMISSION_DENIED: {
    message: 'Permission denied',
    suggestion:
      'You do not have permission to copy to this project. Please contact the project owner or choose a different destination.',
  },
  NETWORK_ERROR: {
    message: 'Network connection lost',
    suggestion: 'Please check your internet connection and try again.',
  },
  QUOTA_EXCEEDED: {
    message: 'Storage quota exceeded',
    suggestion:
      'Your storage is full. Please free up space or contact your administrator for more storage.',
  },
  FILE_TOO_LARGE: {
    message: 'File exceeds maximum size limit',
    suggestion:
      'One or more files are too large to copy. Please remove large attachments and try again.',
  },
  CANCELLED: {
    message: 'Operation cancelled',
    suggestion: 'The copy operation was cancelled by you.',
  },
  UNKNOWN: {
    message: 'Copy operation failed',
    suggestion:
      'An unexpected error occurred. Please try again or contact support if the problem persists.',
  },
};

/**
 * Get user-friendly error message from error code or error object
 */
export function getCopyErrorMessage(error: unknown): CopyErrorMessage {
  // Check if error has a name property (enhanced errors from service)
  if (error instanceof Error && error.name !== '') {
    const errorCode = error.name as CopyErrorCode;
    // Validate errorCode is a valid key before accessing
    const validCodes: CopyErrorCode[] = [
      'PERMISSION_DENIED',
      'NETWORK_ERROR',
      'QUOTA_EXCEEDED',
      'FILE_TOO_LARGE',
      'CANCELLED',
      'UNKNOWN',
    ];
    if (validCodes.includes(errorCode)) {
      return COPY_ERROR_MESSAGES[errorCode];
    }
  }

  // Check if error message contains known error patterns
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('permission') || message.includes('denied')) {
      return COPY_ERROR_MESSAGES.PERMISSION_DENIED;
    }

    if (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('etimedout')
    ) {
      return COPY_ERROR_MESSAGES.NETWORK_ERROR;
    }

    if (
      message.includes('quota') ||
      message.includes('storage full') ||
      message.includes('insufficient space')
    ) {
      return COPY_ERROR_MESSAGES.QUOTA_EXCEEDED;
    }

    if (
      message.includes('too large') ||
      message.includes('exceeds maximum') ||
      message.includes('file size')
    ) {
      return COPY_ERROR_MESSAGES.FILE_TOO_LARGE;
    }

    if (message.includes('cancel') || message.includes('abort')) {
      return COPY_ERROR_MESSAGES.CANCELLED;
    }
  }

  // Default to unknown error
  return COPY_ERROR_MESSAGES.UNKNOWN;
}

/**
 * Format error message with suggestion for display
 */
export function formatCopyError(error: unknown): string {
  const errorInfo = getCopyErrorMessage(error);

  if (errorInfo.suggestion !== undefined && errorInfo.suggestion !== '') {
    return `${errorInfo.message}. ${errorInfo.suggestion}`;
  }

  return errorInfo.message;
}

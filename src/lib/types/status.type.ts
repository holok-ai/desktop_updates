import { THREAD_STATUS } from '../constants/status.constant.js';

export type ThreadStatus = (typeof THREAD_STATUS)[keyof typeof THREAD_STATUS];

// Runtime helpers
export const DEFAULT_THREAD_STATUS: ThreadStatus = THREAD_STATUS.ACTIVE as ThreadStatus;

export function getAvailableThreadStatuses(): string[] {
  return Object.values(THREAD_STATUS);
}

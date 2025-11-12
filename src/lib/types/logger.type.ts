import { LOG_LEVEL } from '../constants/app.constant.js';

export type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];

// Runtime helpers for tests and consumers
export const DEFAULT_LOG_LEVEL: LogLevel = LOG_LEVEL.INFO as LogLevel;

export function getAvailableLogLevels(): string[] {
  return Object.values(LOG_LEVEL);
}

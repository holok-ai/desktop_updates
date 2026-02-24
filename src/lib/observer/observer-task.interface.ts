/**
 * Observer Task Interface
 *
 * Each background task implements this interface to define:
 * - When it should run (shouldRun)
 * - What request to send (buildRequest)
 * - How to handle results (onResult)
 */

import type { Message } from '$lib/types/thread.type';
import type {
  ObserverTaskType,
  BackgroundChatRequest,
} from '../../../src-shared/types/observer.types';

/**
 * Minimal thread shape required by the observer system.
 * Compatible with both the renderer Thread type and the preload Thread type.
 */
export interface ObserverThread {
  id: string;
  title: string;
  messages: Message[];
}

export interface ObserverTask {
  /** The task type identifier */
  readonly taskType: ObserverTaskType;

  /** Optional AppSettings key to check before running (e.g. 'autoTitleEnabled') */
  readonly settingKey?: string;

  /** Evaluate whether this task should run given the current thread state */
  shouldRun(thread: ObserverThread, messages: Message[]): boolean;

  /** Build the background chat request */
  buildRequest(thread: ObserverThread, messages: Message[]): BackgroundChatRequest;

  /** Handle a successful response */
  onResult(thread: ObserverThread, response: string): void | Promise<void>;

  /** Handle an error (optional — defaults to silent) */
  onError?(thread: ObserverThread, error: string): void;
}

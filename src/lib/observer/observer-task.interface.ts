/**
 * Observer Task Interface
 *
 * Each background task implements this interface to define:
 * - When it should run (shouldRun)
 * - What to do — either via local computation (execute) or an LLM call (buildRequest / onResult)
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

  /**
   * Called once when a thread is loaded and messages are available.
   * Allows tasks to populate their initial state from existing messages
   * (e.g. computing context status from a loaded thread's history).
   * Tasks that don't need initialization can omit this method.
   */
  initialize?(thread: ObserverThread, messages: Message[]): void | Promise<void>;

  /**
   * Local (no-LLM) execution path.
   * When defined, the observer calls this directly instead of the LLM pipeline.
   * Mutually exclusive with buildRequest / onResult.
   */
  execute?(thread: ObserverThread, messages: Message[]): void | Promise<void>;

  /**
   * Build the background chat request (LLM path).
   * Required when execute is not defined.
   */
  buildRequest?(thread: ObserverThread, messages: Message[]): BackgroundChatRequest;

  /**
   * Handle a successful LLM response (LLM path).
   * Required when execute is not defined.
   */
  onResult?(thread: ObserverThread, response: string): void | Promise<void>;

  /** Handle an error (optional — defaults to silent) */
  onError?(thread: ObserverThread, error: string): void;
}

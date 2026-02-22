import type { Message } from '../../types/thread.types.js';

/**
 * Interface for message inspection passes.
 * Each inspector receives a message list and returns a (possibly modified) list.
 */
export interface IMessageInspector {
  inspect(messages: Message[]): Message[];
}

/**
 * Runs an ordered list of IMessageInspector passes over a message array.
 */
export class MessageInspector {
  static run(inspectors: IMessageInspector[], messages: Message[]): Message[] {
    return inspectors.reduce<Message[]>((msgs, inspector) => inspector.inspect(msgs), messages);
  }
}

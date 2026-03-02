import log from 'electron-log';
import type { Message } from '../../types/thread.types.js';
import type { IMessageInspector } from './message-inspector.js';

type ResponseCompletedPayload = {
  type?: string;
  response?: {
    output?: Array<{
      type?: string;
      name?: string;
    }>;
  };
};

/**
 * Rehydrates tool-use badges from Responses API response.completed payloads.
 *
 * - Extracts tool calls from response.completed output
 * - Attaches them to the nearest prior assistant message on the same branch
 * - Hides the response.completed message from the chat view
 */
export class ResponseCompletedInspector implements IMessageInspector {
  inspect(messages: Message[]): Message[] {
    const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);
    let attachedCount = 0;
    let hiddenCount = 0;

    for (let i = 0; i < sorted.length; i++) {
      // eslint-disable-next-line security/detect-object-injection
      const message = sorted[i];
      const payload = this.parsePayload(message.content);
      if (!payload) continue;

      const toolNames = this.extractToolNames(payload);
      if (toolNames.length === 0) {
        continue;
      }

      const parent = this.findParent(sorted, i, message.threadId, message.branchId);
      if (parent) {
        parent.toolUses = toolNames.map((name) => ({ name, status: 'complete' }));
        attachedCount += 1;
      }

      message.isHidden = true;
      hiddenCount += 1;
    }

    if (attachedCount > 0 || hiddenCount > 0) {
      log.info('[ResponseCompletedInspector] Rehydrated tool uses:', {
        attachedCount,
        hiddenCount,
      });
    }

    return sorted;
  }

  private parsePayload(content: unknown): ResponseCompletedPayload | null {
    if (typeof content !== 'string') return null;
    const trimmed = content.trim();
    if (!trimmed.startsWith('{')) return null;

    try {
      const parsed = JSON.parse(trimmed) as ResponseCompletedPayload;
      if (parsed?.type !== 'response.completed') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private extractToolNames(payload: ResponseCompletedPayload): string[] {
    const output = payload.response?.output;
    if (!Array.isArray(output)) return [];
    return output
      .filter((item) => item.type === 'function_call' && typeof item.name === 'string')
      .map((item) => item.name as string);
  }

  private findParent(
    messages: Message[],
    startIndex: number,
    threadId: string,
    branchId: string,
  ): Message | null {
    const targetBranch = this.normalizeBranchId(branchId);
    for (let i = startIndex + 1; i < messages.length; i++) {
      // eslint-disable-next-line security/detect-object-injection
      const candidate = messages[i];
      if (candidate.threadId !== threadId) continue;
      if (candidate.role !== 'assistant') continue;
      if (candidate.isHidden === true) continue;

      const candidateBranch = this.normalizeBranchId(candidate.branchId);
      if (candidateBranch === targetBranch) {
        return candidate;
      }
    }
    return null;
  }

  private normalizeBranchId(branchId: string): string {
    const parts = branchId.split('.');
    if (parts.length === 2) return `${parts[0]}.${parts[1]}.0`;
    if (parts.length > 3) return parts.slice(0, 3).join('.');
    return branchId;
  }
}

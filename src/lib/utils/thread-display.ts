/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/**
 * ThreadDisplay — pure static utility class for building UI display items
 * from a flat array of messages.
 *
 * All methods are stateless and side-effect-free.
 */

import type { Message } from '$lib/types/thread.type';
import type { ModelDetails } from '../../../src-electron/preload.js';
import { ThreadContext } from './thread-context';
import { formatResponseContent } from './response-formatter';

// ── Exported Types ──────────────────────────────────────────────────

export interface MessagePair {
  request: Message;
  responses: Message[];
  isStreamingResponse: boolean;
  streamingContent: string;
}

export interface Lane {
  id: string;
  branchId: string;
  messagePairs: MessagePair[];
  modelName?: string;
  modelIntendedUse?: string;
}

export interface MessageDisplay {
  type: 'message';
  pair: MessagePair;
  isFromBranch?: boolean;
}

export interface BranchDisplay {
  type: 'branch';
  id: string;
  position: number;
  lanes: Lane[];
  /** True when the branch is re-expanded for viewing (a lane was already selected). */
  isviewMode?: boolean;
}

export type DisplayItem = MessageDisplay | BranchDisplay;

// ── Static Class ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ThreadDisplay {
  /** Prevent instantiation — all methods are static. */
  private constructor() {}

  /**
   * Build display items from messages — handles both regular messages and
   * multi-lane branches.
   *
   * Returns an array of items that can be either single message pairs
   * (MessageDisplay) or branch groups with multiple lanes (BranchDisplay).
   */
  static buildDisplayItems(
    messages: Message[],
    isStreaming: boolean = false,
    responseText: string = '',
    availableModels: ModelDetails[] = [],
    expandedBranchRows: Set<number> = new Set(),
  ): DisplayItem[] {
    if (messages.length === 0) {
      return [];
    }

    // Filter out hidden messages (e.g., guard-blocked messages)
    const visibleMessages = messages.filter((m) => !m.isHidden);

    if (visibleMessages.length === 0) {
      return [];
    }

    // Sort messages by branchId: row → lane → iteration
    const sortedMessages = [...visibleMessages].sort((a, b) => {
      const [aRow, aLane, aIter] = a.branchId.split('.').map(Number);
      const [bRow, bLane, bIter] = b.branchId.split('.').map(Number);

      if (aRow !== bRow) {
        return aRow - bRow;
      }
      if (aLane !== bLane) {
        return aLane - bLane;
      }
      return aIter - bIter;
    });

    // Group messages by row (first segment of branchId)
    const rowMap = new Map<number, Message[]>();

    for (const msg of sortedMessages) {
      const row = ThreadContext.parseBranchRow(msg.branchId);

      if (!rowMap.has(row)) {
        rowMap.set(row, []);
      }

      const rowArray = rowMap.get(row);
      if (rowArray) {
        rowArray.push(msg);
      }
    }

    // Build display items
    const items: DisplayItem[] = [];
    const sortedRows = Array.from(rowMap.keys()).sort((a, b) => a - b);

    for (const row of sortedRows) {
      const rowMessages = rowMap.get(row);
      if (!rowMessages) {
        continue;
      }

      // Check if this row has branches (any message with lane ≠ 0)
      const hasrowBranches = rowMessages.some(
        (msg) => ThreadContext.parseBranchLane(msg.branchId) !== 0,
      );

      if (!hasrowBranches) {
        // Single lane (main branch only) — display as regular message pairs
        const pairs = ThreadDisplay.buildMessagePairs(rowMessages, isStreaming, responseText);

        for (const pair of pairs) {
          items.push({
            type: 'message',
            pair,
          });
        }
      } else {
        // Multiple lanes — display as branch
        const laneMap = new Map<string, Message[]>();

        for (const msg of rowMessages) {
          const laneKey = ThreadContext.getLaneKey(msg.branchId);

          if (!laneMap.has(laneKey)) {
            laneMap.set(laneKey, []);
          }

          const laneArray = laneMap.get(laneKey);
          if (laneArray) {
            laneArray.push(msg);
          }
        }

        // Build lanes sorted by lane number
        const laneKeys = Array.from(laneMap.keys()).sort((a, b) => {
          const laneA = ThreadContext.parseBranchLane(a);
          const laneB = ThreadContext.parseBranchLane(b);
          return laneA - laneB;
        });

        // Check if any lane has been selected (isSelectedBranch = true)
        const selectedLaneKey = laneKeys.find((laneKey) => {
          const msgs = laneMap.get(laneKey);
          const firstUserMsg = msgs?.find((m) => m.role === 'user');
          return firstUserMsg?.desktopOptions?.isSelectedBranch === true;
        });

        if (selectedLaneKey && !expandedBranchRows.has(row)) {
          // Render only the selected lane — filter rowMessages by lane number directly
          const selectedLaneNum = ThreadContext.parseBranchLane(selectedLaneKey);
          const selectedMsgs = rowMessages.filter(
            (m) => ThreadContext.parseBranchLane(m.branchId) === selectedLaneNum,
          );
          const pairs = ThreadDisplay.buildMessagePairs(selectedMsgs, isStreaming, responseText);
          for (const pair of pairs) {
            items.push({ type: 'message', pair, isFromBranch: true });
          }
        } else {
          // No selected lane, or force-expanded for viewing — render full multi-lane branch
          const isviewMode = Boolean(selectedLaneKey) && expandedBranchRows.has(row);
          const lanes: Lane[] = laneKeys.map((laneKey, index) => {
            const msgs = laneMap.get(laneKey);
            if (!msgs) {
              return {
                id: `lane-${row}-${index}`,
                branchId: laneKey,
                messagePairs: [],
                modelName: undefined,
                modelIntendedUse: undefined,
              };
            }

            const pairs = ThreadDisplay.buildMessagePairs(msgs, isStreaming, responseText);

            // Try to extract model name and intended use from first message
            const modelId = msgs[0]?.modelId ?? undefined;
            let modelName = modelId;
            let modelIntendedUse: string | undefined;

            // Look up model details if available
            if (modelId && availableModels.length > 0) {
              const modelDetails = availableModels.find(
                (m) => m.id === modelId || m.accessName === modelId,
              );
              if (modelDetails) {
                modelName = modelDetails.title || modelDetails.accessName;
                modelIntendedUse = modelDetails.intendedUse;
              }
            }

            return {
              id: `lane-${row}-${index}`,
              branchId: laneKey,
              messagePairs: pairs,
              modelName,
              modelIntendedUse,
            };
          });

          items.push({
            type: 'branch',
            id: `branch-${row}`,
            position: row,
            lanes,
            isviewMode,
          });
        }
      }
    }

    return items;
  }

  /**
   * Build message pairs from a list of messages.
   *
   * Groups each user message with its consecutive assistant/system responses
   * into a MessagePair. Orphan assistant messages (without a preceding user
   * message) are skipped.
   *
   * Response content is formatted via formatResponseContent and image tags
   * are injected for image attachments.
   */
  static buildMessagePairs(
    msgs: Message[],
    isStreaming: boolean,
    responseText: string,
  ): MessagePair[] {
    const pairs: MessagePair[] = [];
    let i = 0;
    while (i < msgs.length) {
      // eslint-disable-next-line security/detect-object-injection
      const msg = msgs[i];
      if (msg.role === 'user') {
        // Collect all consecutive assistant/system messages following this user message
        const responses: Message[] = [];
        let j = i + 1;

        // eslint-disable-next-line security/detect-object-injection
        while (j < msgs.length && (msgs[j].role === 'assistant' || msgs[j].role === 'system')) {
          // eslint-disable-next-line security/detect-object-injection
          const assistantMsg = msgs[j];
          const provider = (assistantMsg.metadata?.provider as string) ?? '';
          const modelId = assistantMsg.modelId ?? msg.modelId ?? '';

          // Format the response content based on provider and model ID
          let formattedContent = formatResponseContent(assistantMsg.content, provider, modelId);

          // Inject image tags for attachments
          if (assistantMsg.attachments && assistantMsg.attachments.length > 0) {
            formattedContent = ThreadDisplay.injectAttachmentTags(
              formattedContent,
              assistantMsg.attachments,
            );
          }

          const formattedResponse = {
            ...assistantMsg,
            content: formattedContent,
          };

          responses.push(formattedResponse);
          j++;
        }

        // Check if this is the last message and we're streaming
        const islastMessage = i === msgs.length - 1;
        const isstreamingNow = islastMessage && isStreaming && responses.length === 0;

        pairs.push({
          request: msg,
          responses: responses,
          isStreamingResponse: isstreamingNow,
          streamingContent: isstreamingNow ? responseText : '',
        });

        // Skip past the user message and all collected responses
        i = j;
      } else {
        // Orphan assistant/system message (no user request before it) — skip
        i += 1;
      }
    }
    return pairs;
  }

  /**
   * Inject markdown image tags for image attachments into content.
   * Non-image attachments and attachments missing base64 data are skipped.
   */
  static injectAttachmentTags(
    content: string,
    attachments: Array<{ mimeType: string; data?: string; filename: string }>,
  ): string {
    let result = content;

    for (const attachment of attachments) {
      switch (true) {
        case attachment.mimeType === 'application/pdf':
          break;

        case attachment.mimeType.startsWith('image/'):
          if (!attachment.data) {
            break;
          }
          result += `\n\n![${attachment.filename}](data:${attachment.mimeType};base64,${attachment.data})`;
          break;
      }
    }

    return result;
  }

}

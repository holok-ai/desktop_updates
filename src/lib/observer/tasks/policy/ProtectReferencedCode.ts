/* eslint-disable @typescript-eslint/strict-boolean-expressions, security/detect-unsafe-regex */
import type { Message } from '$lib/types/thread.type';
import type { CompressionContext, CompressionPolicy } from './types';

export class ProtectReferencedCode implements CompressionPolicy {
  readonly name = 'ProtectReferencedCode';
  readonly priority = 10;

  shouldRun(_messages: Message[], _context: CompressionContext): boolean {
    return true;
  }

  apply(messages: Message[], _context: CompressionContext): Promise<Message[]> {
    const referencedIdentifiers = new Set<string>();

    for (const message of messages) {
      if (!message.context?.isProtected) {
        continue;
      }
      this.extractIdentifiers(message.content).forEach((identifier) => {
        referencedIdentifiers.add(identifier);
      });
    }

    if (referencedIdentifiers.size === 0) {
      return Promise.resolve(messages);
    }

    const updated = messages.map((message) => {
      if (message.context?.isProtected || !this.hasCodeBlock(message.content)) {
        return message;
      }

      const codeIdentifiers = this.extractCodeIdentifiers(message.content);
      const isReferenced = codeIdentifiers.some((identifier) =>
        referencedIdentifiers.has(identifier),
      );
      if (!isReferenced) {
        return message;
      }

      return {
        ...message,
        context: {
          turnIndex: message.context?.turnIndex ?? 0,
          isProtected: true,
          hasCodeBlock: message.context?.hasCodeBlock ?? true,
          compressedByPolicy: message.context?.compressedByPolicy,
          originalTokenSize: message.context?.originalTokenSize,
          compressedTokenSize: message.context?.compressedTokenSize,
          compressionTimestamp: message.context?.compressionTimestamp,
          sourceMessageIds: message.context?.sourceMessageIds,
        },
      };
    });

    return Promise.resolve(updated);
  }

  private hasCodeBlock(content: string): boolean {
    return /```[\s\S]*?```/.test(content);
  }

  private extractIdentifiers(content: string): string[] {
    const identifiers: string[] = [];

    const pathMatches = content.match(
      /(?:\/[\w.-]+)+\.(?:ts|js|py|java|go|rs|tsx|jsx|sql|yaml|yml|json|toml)/g,
    );
    if (pathMatches !== null) {
      identifiers.push(...pathMatches);
    }

    const functionMatches = content.match(/\b[a-zA-Z_]\w*(?=\s*\()/g);
    if (functionMatches !== null) {
      identifiers.push(...functionMatches.filter((value) => value.length > 3));
    }

    const classMatches = content.match(/\b[A-Z][a-zA-Z0-9]+\b/g);
    if (classMatches !== null) {
      identifiers.push(...classMatches.filter((value) => value.length > 3));
    }

    return identifiers;
  }

  private extractCodeIdentifiers(content: string): string[] {
    const codeBlocks = content.match(/```[\s\S]*?```/g) ?? [];
    return codeBlocks.flatMap((block) => this.extractIdentifiers(block));
  }
}

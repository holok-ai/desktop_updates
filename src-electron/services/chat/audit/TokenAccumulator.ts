import type { ChatAuditData, TokenCounter } from './AuditTypes.js';
import { getTokenCounter } from './TokenCounters.js';

/**
 * Accumulates tokens from streaming responses and tracks performance metrics
 */
export class TokenAccumulator {
    private accumulatedResponse: string = '';
    private requestStartTime: number;
    private firstTokenTime?: number;
    private tokenCounter?: TokenCounter;
    private originalCallback?: (token: string) => void;
    private totalTokens: number = 0;
    private tokensReceived: number = 0;
    private isFirstToken: boolean = true;

    constructor(
        private provider: string,
        private model: string,
        private prompt: unknown[],
        private onComplete: (auditData: ChatAuditData) => void,
        onTokenReceived?: (token: string) => void
    ) {
        this.requestStartTime = Date.now();
        this.originalCallback = onTokenReceived;
        this.tokenCounter = getTokenCounter(provider);
    }

    /**
     * Handle each token as it arrives
     */
    public handleToken(token: string): void {
        // Track first token time
        if (this.isFirstToken) {
            this.firstTokenTime = Date.now();
            this.isFirstToken = false;
        }

        // Accumulate the response
        this.accumulatedResponse += token;
        this.tokensReceived++;

        // Pass to original callback for UI updates
        if (this.originalCallback) {
            this.originalCallback(token);
        }
    }

    /**
     * Complete the accumulation and generate audit data
     */
    public complete(error?: unknown): ChatAuditData {
        const completionTime = Date.now();
        const promptTokens = this.tokenCounter?.countPromptTokens(this.prompt) ?? 0;
        const completionTokens = this.tokenCounter?.estimateResponseTokens(this.accumulatedResponse) ?? 0;
        
        const auditData: ChatAuditData = {
            requestId: crypto.randomUUID(),
            provider: this.provider,
            model: this.model,
            requestTimestamp: this.requestStartTime,
            firstTokenTimestamp: this.firstTokenTime,
            completionTimestamp: completionTime,
            totalDuration: completionTime - this.requestStartTime,
            timeToFirstToken: this.firstTokenTime ? this.firstTokenTime - this.requestStartTime : undefined,
            promptTokenCount: promptTokens,
            completionTokenCount: completionTokens,
            totalTokenCount: promptTokens + completionTokens,
            tokensPerSecond: this.calculateTokensPerSecond(completionTime),
            promptText: JSON.stringify(this.prompt),
            completeResponse: this.accumulatedResponse,
            success: !error,
            error: error
                ? (error instanceof Error
                    ? error.message
                    : typeof error === 'string'
                        ? error
                        : JSON.stringify(error))
                : undefined
        };

        // Call the completion handler
        this.onComplete(auditData);
        
        return auditData;
    }

    /**
     * Calculate tokens per second rate
     */
    private calculateTokensPerSecond(endTime: number): number | undefined {
        if (!this.firstTokenTime || this.tokensReceived === 0) {
            return undefined;
        }
        
        const streamingDuration = (endTime - this.firstTokenTime) / 1000; // in seconds
        return streamingDuration > 0 ? this.tokensReceived / streamingDuration : undefined;
    }
}
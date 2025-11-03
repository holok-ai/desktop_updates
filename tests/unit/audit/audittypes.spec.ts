import { describe, it, expect } from 'vitest';

import {
  makeAuditData,
  redactAuditData,
} from '../../../src-electron/services/chat/audit/AuditTypes';

describe('AuditTypes helpers', () => {
  it('makeAuditData returns a complete ChatAuditData object with defaults', () => {
    const a = makeAuditData();
    expect(a.requestId).toBeDefined();
    expect(a.provider).toBe('provider');
    expect(typeof a.requestTimestamp).toBe('number');
    expect(a.totalDuration).toBe(10);
    expect(a.promptText).toBe('prompt');
    expect(a.completeResponse).toBe('response');
  });

  it('makeAuditData accepts overrides', () => {
    const a = makeAuditData({ requestId: 'custom', success: false });
    expect(a.requestId).toBe('custom');
    expect(a.success).toBe(false);
  });

  it('redactAuditData replaces prompt/response unless included', () => {
    const a = makeAuditData({ promptText: 'secret', completeResponse: 'answer' });
    const r1 = redactAuditData(a, {});
    expect(r1.promptText).toBe('[REDACTED]');
    expect(r1.completeResponse).toBe('[REDACTED]');

    const r2 = redactAuditData(a, { includePrompt: true });
    expect(r2.promptText).toBe('secret');
    expect(r2.completeResponse).toBe('[REDACTED]');

    const r3 = redactAuditData(a, { includeResponse: true });
    expect(r3.promptText).toBe('[REDACTED]');
    expect(r3.completeResponse).toBe('answer');
  });
});

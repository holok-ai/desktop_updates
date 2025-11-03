import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('AuditService', () => {
  let AuditService: any;

  beforeEach(async () => {
    vi.resetModules();
    ({ AuditService } = await import('../../../src-electron/services/chat/audit/AuditService'));
    // clear singleton between tests
    (AuditService as any).instance = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeSample(): any {
    return {
      requestId: 'r1',
      provider: 'p',
      model: 'm',
      requestTimestamp: Date.now(),
      completionTimestamp: Date.now() + 10,
      totalDuration: 10,
      promptText: 'secret prompt',
      completeResponse: 'full answer',
      success: true,
    };
  }

  it('returns early when disabled', () => {
    const svc = AuditService.getInstance({ enabled: false });
    const spy = vi.spyOn(console, 'log');
    svc.logChatAudit(makeSample());
    expect(svc.getAuditLogs()).toHaveLength(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('applies privacy filters and still stores original audit data', () => {
    const svc = AuditService.getInstance({
      enabled: true,
      logToConsole: true,
      includePromptText: false,
      includeResponseText: false,
    });
    const sample = makeSample();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    svc.logChatAudit(sample);

    // original stored
    const stored = svc.getAuditLogs();
    expect(stored).toHaveLength(1);
    expect(stored[0].promptText).toBe('secret prompt');

    // console saw filtered values
    expect(logSpy).toHaveBeenCalled();
    const calledWith = logSpy.mock.calls[0][1];
    expect(calledWith.promptText).toBe('[REDACTED]');
    expect(calledWith.completeResponse).toBe('[REDACTED]');
  });

  it('sends to server when configured (ok response)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }));
    // @ts-ignore
    global.fetch = fetchMock;

    const svc = AuditService.getInstance({
      enabled: true,
      logToConsole: false,
      logToServer: true,
      serverEndpoint: 'http://mock',
    });
    const sample = makeSample();

    await svc.logChatAudit(sample);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('http://mock');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body as string);
    expect(body.requestId).toBe(sample.requestId);
  });

  it('logs error when server responds not ok', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500, statusText: 'err' }));
    // @ts-ignore
    global.fetch = fetchMock;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const svc = AuditService.getInstance({
      enabled: true,
      logToConsole: false,
      logToServer: true,
      serverEndpoint: 'http://mock',
    });
    const sample = makeSample();

    await svc.logChatAudit(sample);

    expect(fetchMock).toHaveBeenCalled();
    // console.error may be called with a single formatted string or multiple args
    const firstArg = errSpy.mock.calls[0][0];
    expect(String(firstArg)).toMatch(/Failed to send audit data to server/);
  });

  it('logs error when fetch throws', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('net');
    });
    // @ts-ignore
    global.fetch = fetchMock;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const svc = AuditService.getInstance({
      enabled: true,
      logToConsole: false,
      logToServer: true,
      serverEndpoint: 'http://mock',
    });
    const sample = makeSample();

    await svc.logChatAudit(sample);

    expect(fetchMock).toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledWith('Error sending audit data to server:', expect.any(Error));
  });
});
